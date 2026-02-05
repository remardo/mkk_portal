"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "sonner"
import Link from "next/link"
import { 
  Users, 
  Building2, 
  BookOpen, 
  FileText, 
  GraduationCap, 
  ClipboardCheck,
  Settings,
  Plus,
  ArrowRight
} from "lucide-react"
import { formatDate, getRoleLabel } from "@/lib/utils"

export default function AdminPage() {
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    checkAccess()
  }, [])

  const checkAccess = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push("/login")
        return
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single()

      if (profile?.role !== "it_admin" && profile?.role !== "director") {
        router.push("/dashboard")
        toast.error("У вас нет доступа к этой странице")
        return
      }

      setIsAdmin(true)
      fetchStats()
    } catch (error) {
      console.error("Error checking access:", error)
    }
  }

  const fetchStats = async () => {
    try {
      setLoading(true)
      
      // Fetch various stats
      const [
        { count: usersCount },
        { count: branchesCount },
        { count: articlesCount },
        { count: documentsCount },
        { count: coursesCount },
        { count: checklistsCount },
      ] = await Promise.all([
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase.from("branches").select("*", { count: "exact", head: true }),
        supabase.from("knowledge_articles").select("*", { count: "exact", head: true }),
        supabase.from("documents").select("*", { count: "exact", head: true }),
        supabase.from("courses").select("*", { count: "exact", head: true }),
        supabase.from("checklists").select("*", { count: "exact", head: true }),
      ])

      setStats({
        users: usersCount || 0,
        branches: branchesCount || 0,
        articles: articlesCount || 0,
        documents: documentsCount || 0,
        courses: coursesCount || 0,
        checklists: checklistsCount || 0,
      })
    } catch (error) {
      console.error("Error fetching stats:", error)
    } finally {
      setLoading(false)
    }
  }

  if (!isAdmin) {
    return null
  }

  const adminSections = [
    {
      title: "Пользователи",
      description: "Управление сотрудниками и ролями",
      icon: Users,
      count: stats?.users,
      href: "/admin/users",
      color: "bg-blue-500",
    },
    {
      title: "Точки",
      description: "Управление филиалами",
      icon: Building2,
      count: stats?.branches,
      href: "/admin/branches",
      color: "bg-green-500",
    },
    {
      title: "База знаний",
      description: "Статьи и категории",
      icon: BookOpen,
      count: stats?.articles,
      href: "/admin/knowledge",
      color: "bg-purple-500",
    },
    {
      title: "Документы",
      description: "Регламенты и ЛНА",
      icon: FileText,
      count: stats?.documents,
      href: "/admin/documents",
      color: "bg-orange-500",
    },
    {
      title: "Обучение",
      description: "Курсы и тесты",
      icon: GraduationCap,
      count: stats?.courses,
      href: "/admin/courses",
      color: "bg-pink-500",
    },
    {
      title: "Чек-листы",
      description: "Шаблоны чек-листов",
      icon: ClipboardCheck,
      count: stats?.checklists,
      href: "/admin/checklists",
      color: "bg-cyan-500",
    },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Администрирование</h1>
        <p className="text-muted-foreground mt-1">
          Управление порталом и настройками
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-3">
        {adminSections.map((section) => {
          const Icon = section.icon
          return (
            <Link key={section.title} href={section.href}>
              <Card className="hover:border-primary transition-colors cursor-pointer h-full">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className={`${section.color} p-3 rounded-lg`}>
                      <Icon className="h-5 w-5 text-white" />
                    </div>
                    {section.count !== undefined && (
                      <Badge variant="secondary">{section.count}</Badge>
                    )}
                  </div>
                  <CardTitle className="text-lg mt-3">{section.title}</CardTitle>
                  <CardDescription>{section.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center text-sm text-primary">
                    Перейти <ArrowRight className="h-4 w-4 ml-1" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Быстрые действия</CardTitle>
          <CardDescription>Часто используемые операции</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Link href="/admin/users/new">
              <Button variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                Новый пользователь
              </Button>
            </Link>
            <Link href="/admin/knowledge/new">
              <Button variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                Новая статья
              </Button>
            </Link>
            <Link href="/admin/documents/new">
              <Button variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                Новый документ
              </Button>
            </Link>
            <Link href="/admin/checklists/new">
              <Button variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                Новый чек-лист
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
