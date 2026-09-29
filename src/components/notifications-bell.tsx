"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Bell } from "lucide-react"

export function NotificationsBell({ className }: { className?: string }) {
  const [unread, setUnread] = useState(0)

  const fetchUnread = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { count } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("is_read", false)
    setUnread(count || 0)
  }, [])

  useEffect(() => {
    fetchUnread()
    const t = setInterval(fetchUnread, 30000)
    const onFocus = () => fetchUnread()
    window.addEventListener("focus", onFocus)
    return () => {
      clearInterval(t)
      window.removeEventListener("focus", onFocus)
    }
  }, [fetchUnread])

  return (
    <Link href="/notifications">
      <Button variant="ghost" size="icon" className={`relative ${className || ""}`} title="Уведомления">
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <Badge className="absolute -top-1 -right-1 h-5 min-w-5 px-1 flex items-center justify-center text-[10px] bg-red-500">
            {unread > 99 ? "99+" : unread}
          </Badge>
        )}
      </Button>
    </Link>
  )
}
