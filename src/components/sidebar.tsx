"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import {
  Building2,
  BookOpen,
  FileText,
  GraduationCap,
  ClipboardCheck,
  CheckSquare,
  MessageSquare,
  Bell,
  Users,
  LayoutDashboard,
  Settings,
  Bot,
  LogOut,
} from "lucide-react"
import { Profile, UserRole } from "@/types/database"

interface SidebarProps {
  user: Profile | null
}

const navigation = [
  { name: "Главная", href: "/dashboard", icon: LayoutDashboard },
  { name: "База знаний", href: "/knowledge", icon: BookOpen },
  { name: "Документы", href: "/documents", icon: FileText },
  { name: "Обучение", href: "/courses", icon: GraduationCap },
  { name: "Чек-листы", href: "/checklists", icon: ClipboardCheck },
  { name: "Задачи", href: "/tasks", icon: CheckSquare },
  { name: "Новости", href: "/news", icon: Bell },
  { name: "Чат", href: "/chat", icon: MessageSquare },
  { name: "Контакты", href: "/contacts", icon: Users },
]

const adminNavigation = [
  { name: "Админка", href: "/admin", icon: Settings },
]

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname()

  const isAdmin = user?.role === "it_admin" || user?.role === "director"

  return (
    <div className="flex h-full flex-col border-r bg-card">
      {/* Logo */}
      <div className="flex h-16 items-center border-b px-6">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="bg-primary p-2 rounded-lg">
            <Building2 className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="font-semibold text-lg">МКК ФК</span>
        </Link>
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 px-4 py-4">
        <nav className="flex flex-col gap-1">
          {navigation.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)
            
            return (
              <Link key={item.name} href={item.href}>
                <Button
                  variant={isActive ? "secondary" : "ghost"}
                  className={cn(
                    "w-full justify-start gap-3",
                    isActive && "bg-secondary"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.name}
                </Button>
              </Link>
            )
          })}

          {isAdmin && (
            <>
              <Separator className="my-4" />
              <span className="px-3 text-xs font-medium text-muted-foreground mb-2">
                Администрирование
              </span>
              {adminNavigation.map((item) => {
                const Icon = item.icon
                const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)
                
                return (
                  <Link key={item.name} href={item.href}>
                    <Button
                      variant={isActive ? "secondary" : "ghost"}
                      className={cn(
                        "w-full justify-start gap-3",
                        isActive && "bg-secondary"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {item.name}
                    </Button>
                  </Link>
                )
              })}
            </>
          )}
        </nav>
      </ScrollArea>

      {/* User & Logout */}
      <div className="border-t p-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
            <span className="text-sm font-medium text-primary">
              {user?.full_name?.split(" ").map(n => n[0]).join("").toUpperCase() || "??"}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user?.full_name}</p>
            <p className="text-xs text-muted-foreground truncate">
              {user?.role && getRoleLabel(user.role)}
            </p>
          </div>
        </div>
        <form action="/auth/signout" method="post">
          <Button variant="outline" className="w-full justify-start gap-2" type="submit">
            <LogOut className="h-4 w-4" />
            Выйти
          </Button>
        </form>
      </div>
    </div>
  )
}

function getRoleLabel(role: UserRole): string {
  const labels: Record<UserRole, string> = {
    agent: "Сотрудник точки",
    branch_manager: "Старший точки",
    ops_manager: "Операционный руководитель",
    director: "Директор",
    security: "Безопасность",
    accountant: "Бухгалтерия",
    it_admin: "IT-администратор",
    hr: "HR",
  }
  return labels[role] || role
}
