"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import Link from "next/link"
import { Bell, AlertCircle, Check, Clock, Eye } from "lucide-react"
import { formatDate, formatRelativeTime, getNewsTypeLabel } from "@/lib/utils"
import { NewsWithRead } from "@/types/database"

export default function NewsPage() {
  const [news, setNews] = useState<NewsWithRead[]>([])
  const [readNewsIds, setReadNewsIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      
      // Fetch news
      const { data: newsData } = await supabase
        .from("news")
        .select("*, created_by_profile:profiles(full_name)")
        .lte("published_at", new Date().toISOString())
        .order("published_at", { ascending: false })
      
      // Fetch read news
      const { data: readData } = await supabase
        .from("news_reads")
        .select("news_id")
        .eq("user_id", user.id)
      
      const readIds = new Set(readData?.map(r => r.news_id) || [])
      setReadNewsIds(readIds)
      
      setNews((newsData || []).map(n => ({
        ...n,
        is_read: readIds.has(n.id),
      })))
    } catch (error) {
      console.error("Error fetching news:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleMarkAsRead = async (newsId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      
      const { error } = await supabase
        .from("news_reads")
        .insert({
          news_id: newsId,
          user_id: user.id,
        })
      
      if (error) throw error
      
      setReadNewsIds(prev => new Set([...prev, newsId]))
      setNews(prev => prev.map(n => 
        n.id === newsId ? { ...n, is_read: true } : n
      ))
      
      toast.success("Отмечено как прочитанное")
    } catch (error) {
      console.error("Error marking news as read:", error)
    }
  }

  const unreadNews = news.filter(n => !n.is_read)
  const readNews = news.filter(n => n.is_read)

  const NewsCard = ({ item, showMarkAsRead = false }: { item: NewsWithRead; showMarkAsRead?: boolean }) => (
    <Card className={item.type === "critical" ? "border-red-200" : item.is_read ? "opacity-75" : ""}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            {item.type === "critical" && (
              <AlertCircle className="h-5 w-5 text-red-500" />
            )}
            <CardTitle className={`text-lg ${item.is_read ? "font-normal" : ""}`}>
              {item.title}
            </CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={item.type === "critical" ? "destructive" : "secondary"}>
              {getNewsTypeLabel(item.type)}
            </Badge>
            {showMarkAsRead && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleMarkAsRead(item.id)}
              >
                <Check className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
        <CardDescription className="flex items-center gap-4 mt-2">
          <span>{item.created_by_profile?.full_name}</span>
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatRelativeTime(item.published_at)}
          </span>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground line-clamp-3">
          {item.content}
        </p>
        <Link href={`/news/${item.id}`}>
          <Button variant="link" className="pl-0 mt-2">
            <Eye className="h-4 w-4 mr-2" />
            Читать полностью
          </Button>
        </Link>
      </CardContent>
    </Card>
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Новости</h1>
        <p className="text-muted-foreground mt-1">
          Объявления и важная информация
        </p>
      </div>

      {/* Unread News */}
      {unreadNews.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Непрочитанные
            <Badge>{unreadNews.length}</Badge>
          </h2>
          <div className="space-y-4">
            {unreadNews.map((item) => (
              <NewsCard key={item.id} item={item} showMarkAsRead />
            ))}
          </div>
        </div>
      )}

      {/* All News */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Все новости</h2>
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="h-32" />
            ))}
          </div>
        ) : news.length > 0 ? (
          <div className="space-y-4">
            {news.map((item) => (
              <NewsCard key={item.id} item={item} />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <Bell className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Нет новостей</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
