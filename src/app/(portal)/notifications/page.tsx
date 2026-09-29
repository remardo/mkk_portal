"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import { Bell, CheckCheck } from "lucide-react"
import { formatRelativeTime } from "@/lib/utils"
import { Notification } from "@/types/database"

const TYPE_LABEL: Record<string, string> = {
  task_assigned: "Назначение",
  task_comment: "Комментарий",
  task_status: "Статус задачи",
}

export default function NotificationsPage() {
  const [items, setItems] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = useMemo(() => createClient(), [])

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        toast.error("Сессия истекла, войдите снова")
        return
      }
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(100)
      setItems(data || [])
    } catch (error) {
      console.error("Error fetching notifications:", error)
      toast.error("Ошибка загрузки уведомлений")
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const markRead = async (id: string) => {
    await supabase.from("notifications").update({ is_read: true }).eq("id", id)
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)))
  }

  const markAllRead = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from("notifications").update({ is_read: true }).eq("user_id", user.id).eq("is_read", false)
    setItems((prev) => prev.map((n) => ({ ...n, is_read: true })))
    toast.success("Все прочитаны")
  }

  const unread = items.filter((n) => !n.is_read).length

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-1/2" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Уведомления</h1>
          <p className="text-muted-foreground mt-1">
            {unread > 0 ? `Непрочитанных: ${unread}` : "Всё прочитано"}
          </p>
        </div>
        {unread > 0 && (
          <Button variant="outline" onClick={markAllRead}>
            <CheckCheck className="h-4 w-4 mr-2" />
            Прочитать все
          </Button>
        )}
      </div>

      <div className="space-y-2">
        {items.map((n) => (
          <Card key={n.id} className={n.is_read ? "opacity-70" : "border-blue-200"}>
            <CardContent className="p-4 flex items-start gap-3">
              <div className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${n.is_read ? "bg-muted" : "bg-blue-500"}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="secondary">{TYPE_LABEL[n.type] || n.type}</Badge>
                  <span className="text-xs text-muted-foreground">{formatRelativeTime(n.created_at)}</span>
                </div>
                <p className="font-medium mt-1">{n.title}</p>
                {n.body && <p className="text-sm text-muted-foreground line-clamp-2 mt-0.5">{n.body}</p>}
                <div className="flex gap-2 mt-2">
                  {n.link && (
                    <Link href={n.link} onClick={() => markRead(n.id)}>
                      <Button size="sm" variant="outline">Открыть</Button>
                    </Link>
                  )}
                  {!n.is_read && (
                    <Button size="sm" variant="ghost" onClick={() => markRead(n.id)}>Прочитано</Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {items.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <Bell className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Уведомлений пока нет</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
