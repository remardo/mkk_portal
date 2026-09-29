"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { cn, getRoleLabel } from "@/lib/utils"
import {
  Building2,
  BookOpen,
  FileText,
  GraduationCap,
  ClipboardCheck,
  CheckSquare,
  MessageSquare,
  Bell,
  BellRing,
  Users,
  LayoutDashboard,
  Settings,
  Bot,
  LogOut,
} from "lucide-react"
import { NotificationsBell } from "@/components/notifications-bell"
import { Profile } from "@/types/database"

interface SidebarProps {
  user: Profile | null
  onNavigate?: () => void
}

export const navigation = [
  { name: "Главная", href: "/dashboard", icon: LayoutDashboard },
  { name: "База знаний", href: "/knowledge", icon: BookOpen },
  { name: "Документы", href: "/documents", icon: FileText },
  { name: "Обучение", href: "/courses", icon: GraduationCap },
  { name: "Чек-листы", href: "/checklists", icon: ClipboardCheck },
  { name: "Задачи", href: "/tasks", icon: CheckSquare },
  { name: "Новости", href: "/news", icon: Bell },
  { name: "Чат", href: "/chat", icon: MessageSquare },
  { name: "Уведомления", href: "/notifications", icon: BellRing },
  { name: "Контакты", href: "/contacts", icon: Users },
  { name: "ИИ-помощник", href: "/ai-assistant", icon: Bot },
]

export const adminNavigation = [
  { name: "Админка", href: "/admin", icon: Settings },
]

function initials(name?: string | null) {
  return (name || "?")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

export function Sidebar({ user, onNavigate }: SidebarProps) {
  const pathname = usePathname()
  const isAdmin = user?.role === "it_admin" || user?.role === "director"
  const userName = user?.full_name || "Сотрудник"
  const userRole = user?.role ? getRoleLabel(user.role) : "—"

  return (
    <div className="flex h-full flex-col bg-slate-950 text-slate-300">
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 px-5">
        <Link href="/dashboard" onClick={onNavigate} className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 shadow-lg shadow-blue-900/40">
            <Building2 className="h-5 w-5 text-white" />
          </div>
          <div className="leading-tight">
            <p className="text-[15px] font-semibold text-white">МКК ФК</p>
            <p className="text-[11px] text-slate-500">Корпоративный портал</p>
          </div>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <p className="px-3 pb-2 text-[11px] font-medium uppercase tracking-wider text-slate-600">
          Разделы
        </p>
        <div className="space-y-1">
          {navigation.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/")
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                className={cn(
                  "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                  isActive
                    ? "bg-blue-600 font-medium text-white shadow-lg shadow-blue-950/50"
                    : "text-slate-400 hover:bg-white/5 hover:text-white"
                )}
              >
                <Icon className={cn("h-[18px] w-[18px]", isActive ? "text-white" : "text-slate-500 group-hover:text-slate-300")} />
                {item.name}
              </Link>
            )
          })}
        </div>

        {isAdmin && (
          <div className="mt-6">
            <p className="px-3 pb-2 text-[11px] font-medium uppercase tracking-wider text-slate-600">
              Управление
            </p>
            <div className="space-y-1">
              {adminNavigation.map((item) => {
                const Icon = item.icon
                const isActive = pathname === item.href || pathname.startsWith(item.href + "/")
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onNavigate}
                    className={cn(
                      "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                      isActive
                        ? "bg-blue-600 font-medium text-white shadow-lg shadow-blue-950/50"
                        : "text-slate-400 hover:bg-white/5 hover:text-white"
                    )}
                  >
                    <Icon className={cn("h-[18px] w-[18px]", isActive ? "text-white" : "text-slate-500 group-hover:text-slate-300")} />
                    {item.name}
                  </Link>
                )
              })}
            </div>
          </div>
        )}
      </nav>

      {/* User */}
      <div className="border-t border-white/5 p-3">
        <div className="mb-3 flex items-center gap-3 rounded-lg bg-white/5 p-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-blue-700 text-[12px] font-semibold text-white">
            {initials(userName)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white">{userName}</p>
            <p className="truncate text-[11px] text-slate-500">{userRole}</p>
          </div>
          <NotificationsBell className="h-8 w-8 text-slate-400 hover:bg-white/10 hover:text-white" />
          <form action="/auth/signout" method="post">
            <Button
              variant="ghost"
              size="icon"
              type="submit"
              title="Выйти"
              className="h-8 w-8 text-slate-500 hover:bg-white/10 hover:text-white"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
