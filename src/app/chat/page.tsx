"use client"

import { useState, useEffect, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "sonner"
import { Send, MessageSquare, Hash, Paperclip } from "lucide-react"
import { formatRelativeTime } from "@/lib/utils"
import { ChatChannel, ChatMessageWithAuthor, Profile } from "@/types/database"

export default function ChatPage() {
  const [channels, setChannels] = useState<ChatChannel[]>([])
  const [messages, setMessages] = useState<ChatMessageWithAuthor[]>([])
  const [activeChannel, setActiveChannel] = useState<string | null>(null)
  const [input, setInput] = useState("")
  const [currentUser, setCurrentUser] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const scrollRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  useEffect(() => {
    fetchData()
  }, [])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  useEffect(() => {
    if (!activeChannel) return

    // Subscribe to new messages
    const subscription = supabase
      .channel(`chat:${activeChannel}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `channel_id=eq.${activeChannel}`,
        },
        async (payload) => {
          // Fetch full message with author
          const { data } = await supabase
            .from("chat_messages")
            .select("*, author:profiles(full_name)")
            .eq("id", payload.new.id)
            .single()
          
          if (data) {
            setMessages((prev) => [...prev, data])
          }
        }
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [activeChannel])

  const fetchData = async () => {
    try {
      setLoading(true)
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single()
      
      setCurrentUser(profile)
      
      // Fetch channels
      const { data: channelsData } = await supabase
        .from("chat_channels")
        .select("*")
        .order("created_at")
      
      setChannels(channelsData || [])
      
      // Set first channel as active
      if (channelsData && channelsData.length > 0) {
        setActiveChannel(channelsData[0].id)
        fetchMessages(channelsData[0].id)
      }
    } catch (error) {
      console.error("Error fetching chat data:", error)
    } finally {
      setLoading(false)
    }
  }

  const fetchMessages = async (channelId: string) => {
    try {
      const { data } = await supabase
        .from("chat_messages")
        .select("*, author:profiles(full_name)")
        .eq("channel_id", channelId)
        .order("created_at", { ascending: true })
        .limit(100)
      
      setMessages(data || [])
    } catch (error) {
      console.error("Error fetching messages:", error)
    }
  }

  const handleChannelChange = (channelId: string) => {
    setActiveChannel(channelId)
    fetchMessages(channelId)
  }

  const handleSend = async () => {
    if (!input.trim() || !activeChannel || !currentUser) return

    try {
      const { error } = await supabase
        .from("chat_messages")
        .insert({
          channel_id: activeChannel,
          author_id: currentUser.id,
          content: input.trim(),
        })

      if (error) throw error

      setInput("")
    } catch (error) {
      console.error("Error sending message:", error)
      toast.error("Ошибка при отправке сообщения")
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const activeChannelData = channels.find(c => c.id === activeChannel)

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-3xl font-bold">Чат</h1>
        <p className="text-muted-foreground mt-1">
          Внутренняя коммуникация
        </p>
      </div>

      {/* Chat Layout */}
      <Card className="flex-1 flex overflow-hidden">
        {/* Channels Sidebar */}
        <div className="w-64 border-r bg-muted/30 hidden md:block">
          <div className="p-4 border-b">
            <h3 className="font-semibold flex items-center gap-2">
              <Hash className="h-4 w-4" />
              Каналы
            </h3>
          </div>
          <ScrollArea className="h-[calc(100%-60px)]">
            <div className="p-2 space-y-1">
              {channels.map((channel) => (
                <button
                  key={channel.id}
                  onClick={() => handleChannelChange(channel.id)}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                    activeChannel === channel.id
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-muted"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Hash className="h-4 w-4" />
                    {channel.name}
                  </span>
                </button>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Mobile Channels */}
        <div className="md:hidden w-full border-b">
          <ScrollArea className="whitespace-nowrap">
            <div className="p-2 space-x-2">
              {channels.map((channel) => (
                <Button
                  key={channel.id}
                  variant={activeChannel === channel.id ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleChannelChange(channel.id)}
                >
                  {channel.name}
                </Button>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Messages Area */}
        <div className="flex-1 flex flex-col">
          {/* Channel Header */}
          <div className="p-4 border-b">
            <h3 className="font-semibold flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              {activeChannelData?.name || "Выберите канал"}
            </h3>
          </div>

          {/* Messages */}
          <ScrollArea className="flex-1 p-4" ref={scrollRef}>
            <div className="space-y-4">
              {messages.map((message, idx) => {
                const isOwn = message.author_id === currentUser?.id
                const showAuthor = idx === 0 || messages[idx - 1].author_id !== message.author_id

                return (
                  <div
                    key={message.id}
                    className={`flex gap-3 ${isOwn ? "justify-end" : "justify-start"}`}
                  >
                    {!isOwn && showAuthor && (
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-medium text-primary">
                          {message.author?.full_name?.split(" ").map(n => n[0]).join("").toUpperCase()}
                        </span>
                      </div>
                    )}
                    {!isOwn && !showAuthor && <div className="w-8" />}
                    
                    <div
                      className={`max-w-[70%] rounded-lg px-4 py-2 ${
                        isOwn
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      }`}
                    >
                      {showAuthor && !isOwn && (
                        <p className="text-xs font-medium mb-1 opacity-75">
                          {message.author?.full_name}
                        </p>
                      )}
                      <p className="text-sm">{message.content}</p>
                      <p className={`text-xs mt-1 ${isOwn ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                        {formatRelativeTime(message.created_at)}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </ScrollArea>

          {/* Input */}
          <div className="p-4 border-t">
            <div className="flex gap-2">
              <Input
                placeholder="Введите сообщение..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={!activeChannel}
                className="flex-1"
              />
              <Button onClick={handleSend} disabled={!input.trim() || !activeChannel}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}
