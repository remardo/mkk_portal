"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Sidebar, navigation, adminNavigation } from "@/components/sidebar"
import { Building2, Menu, LogOut, X } from "lucide-react"
import { NotificationsBell } from "@/components/notifications-bell"
import { Profile } from "@/types/database"

interface MobileNavProps {
  user: Profile | null
}

export function MobileNav({ user }: MobileNavProps) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const isAdmin = user?.role === "it_admin" || user?.role === "director"
  const items = [...(isAdmin ? adminNavigation : []), ...navigation]
  const current = items.find(
    (i) => pathname === i.href || pathname.startsWith(i.href + "/")
  )
  const initials = (user?.full_name || "?")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-40 flex h-14 items-center gap-2 border-b bg-white/90 px-3 backdrop-blur md:hidden">
        <Button variant="ghost" size="icon" onClick={() => setOpen(true)} aria-label="Меню">
          <Menu className="h-5 w-5" />
        </Button>
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-blue-700">
            <Building2 className="h-4 w-4 text-white" />
          </div>
          <span className="font-semibold">{current?.name ?? "МКК ФК"}</span>
        </Link>
        <div className="ml-auto flex items-center gap-1">
          <NotificationsBell />
          <form action="/auth/signout" method="post">
            <Button variant="ghost" size="icon" type="submit" aria-label="Выйти">
              <LogOut className="h-5 w-5" />
            </Button>
          </form>
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-blue-700 text-[11px] font-semibold text-white">
            {initials}
          </div>
        </div>
      </header>

      {open && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-slate-950/60" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[85vw] shadow-2xl">
            <button
              onClick={() => setOpen(false)}
              className="absolute right-3 top-4 z-10 text-slate-500 hover:text-white"
              aria-label="Закрыть меню"
            >
              <X className="h-5 w-5" />
            </button>
            <Sidebar user={user} onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}
    </>
  )
}
