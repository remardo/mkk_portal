import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import Link from "next/link"
import {
  CheckSquare,
  GraduationCap,
  FileText,
  Bell,
  ArrowRight,
  Clock,
  AlertCircle,
  Bot,
} from "lucide-react"
import { formatDate, formatRelativeTime, getStatusColor, getPriorityColor, getRoleLabel } from "@/lib/utils"

export default async function DashboardPage() {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  // Get user profile with branch
  const { data: profile } = await supabase
    .from("profiles")
    .select("*, branch:branches(*)")
    .eq("id", user.id)
    .single()

  if (!profile) {
    redirect("/login")
  }

  // Fetch dashboard data in parallel
  const [
    { data: myTasks },
    { data: myChecklists },
    { data: myCourses },
    { data: unreadNews },
    { data: mandatoryDocs },
  ] = await Promise.all([
    // My tasks
    supabase
      .from("tasks")
      .select("*, author:profiles!tasks_author_id_fkey(full_name), assignee:profiles!tasks_assignee_id_fkey(full_name), branch:branches(name)")
      .or(`assignee_id.eq.${user.id},author_id.eq.${user.id}`)
      .not("status", "in", "(done,rejected)")
      .order("due_date", { ascending: true })
      .limit(5),
    
    // My checklists
    supabase
      .from("checklist_runs")
      .select("*, checklist:checklists(title, type), branch:branches(name)")
      .eq("branch_id", profile.branch_id)
      .not("status", "eq", "completed")
      .order("due_date", { ascending: true })
      .limit(5),
    
    // My courses in progress
    supabase
      .from("course_progress")
      .select("*, course:courses(*)")
      .eq("user_id", user.id)
      .eq("status", "in_progress")
      .limit(3),
    
    // Unread news
    supabase
      .from("news")
      .select("*")
      .not("news_reads", "cs", `{${user.id}}`)
      .lte("published_at", new Date().toISOString())
      .order("published_at", { ascending: false })
      .limit(5),
    
    // Mandatory documents not acknowledged
    supabase
      .from("documents")
      .select("*")
      .eq("mandatory", true)
      .not("document_acknowledgements", "cs", `{${user.id}}`)
      .limit(5),
  ])

  const isOverdue = (dueDate: string | null, status: string) => {
    if (!dueDate) return false
    if (['done', 'completed', 'rejected'].includes(status)) return false
    return new Date(dueDate) < new Date()
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Добро пожаловать, {profile.full_name.split(" ")[0]}!</h1>
          <p className="text-muted-foreground mt-1">
            {profile.branch?.name} • {getRoleLabel(profile.role)}
          </p>
        </div>
        <Link href="/ai-assistant">
          <Button variant="outline" className="gap-2">
            <Bot className="h-4 w-4" />
            ИИ-помощник
          </Button>
        </Link>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Мои задачи</CardTitle>
            <CheckSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{myTasks?.length || 0}</div>
            <p className="text-xs text-muted-foreground">
              {myTasks?.filter(t => isOverdue(t.due_date, t.status)).length || 0} просрочено
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Чек-листы</CardTitle>
            <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{myChecklists?.length || 0}</div>
            <p className="text-xs text-muted-foreground">
              {myChecklists?.filter(c => isOverdue(c.due_date, c.status)).length || 0} просрочено
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Обучение</CardTitle>
            <GraduationCap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{myCourses?.length || 0}</div>
            <p className="text-xs text-muted-foreground">в процессе</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Новости</CardTitle>
            <Bell className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{unreadNews?.length || 0}</div>
            <p className="text-xs text-muted-foreground">непрочитанных</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* My Tasks */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Мои задачи</CardTitle>
              <CardDescription>Актуальные задачи</CardDescription>
            </div>
            <Link href="/tasks">
              <Button variant="ghost" size="sm" className="gap-1">
                Все <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[250px]">
              <div className="space-y-3">
                {myTasks && myTasks.length > 0 ? (
                  myTasks.map((task) => (
                    <div key={task.id} className="flex items-start gap-3 p-3 rounded-lg border">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Link href={`/tasks/${task.id}`} className="font-medium hover:underline truncate">
                            {task.title}
                          </Link>
                          {isOverdue(task.due_date, task.status) && (
                            <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="secondary" className={getPriorityColor(task.priority)}>
                            {task.priority}
                          </Badge>
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {task.due_date ? formatDate(task.due_date) : "Без срока"}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-muted-foreground text-center py-8">Нет активных задач</p>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Checklists */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Чек-листы</CardTitle>
              <CardDescription>На сегодня</CardDescription>
            </div>
            <Link href="/checklists">
              <Button variant="ghost" size="sm" className="gap-1">
                Все <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[250px]">
              <div className="space-y-3">
                {myChecklists && myChecklists.length > 0 ? (
                  myChecklists.map((checklist) => (
                    <div key={checklist.id} className="flex items-start gap-3 p-3 rounded-lg border">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Link href={`/checklists/${checklist.id}`} className="font-medium hover:underline truncate">
                            {checklist.checklist?.title}
                          </Link>
                          {isOverdue(checklist.due_date, checklist.status) && (
                            <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="secondary" className={getStatusColor(checklist.status)}>
                            {checklist.status}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            Срок: {formatDate(checklist.due_date)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-muted-foreground text-center py-8">Нет активных чек-листов</p>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Learning */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Обучение</CardTitle>
              <CardDescription>Текущие курсы</CardDescription>
            </div>
            <Link href="/courses">
              <Button variant="ghost" size="sm" className="gap-1">
                Все <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[200px]">
              <div className="space-y-3">
                {myCourses && myCourses.length > 0 ? (
                  myCourses.map((progress) => (
                    <div key={progress.id} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Link href={`/courses/${progress.course_id}`} className="font-medium hover:underline">
                          {progress.course?.title}
                        </Link>
                      </div>
                      <Progress value={30} className="h-2" />
                      <p className="text-xs text-muted-foreground">В процессе</p>
                    </div>
                  ))
                ) : (
                  <p className="text-muted-foreground text-center py-8">Нет активных курсов</p>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* News */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Новости</CardTitle>
              <CardDescription>Последние объявления</CardDescription>
            </div>
            <Link href="/news">
              <Button variant="ghost" size="sm" className="gap-1">
                Все <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[200px]">
              <div className="space-y-3">
                {unreadNews && unreadNews.length > 0 ? (
                  unreadNews.map((news) => (
                    <div key={news.id} className="flex items-start gap-3 p-3 rounded-lg border">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Link href={`/news/${news.id}`} className="font-medium hover:underline truncate">
                            {news.title}
                          </Link>
                          {news.type === "critical" && (
                            <Badge variant="destructive">Важно</Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatRelativeTime(news.published_at)}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-muted-foreground text-center py-8">Нет новых новостей</p>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Mandatory Documents Alert */}
      {mandatoryDocs && mandatoryDocs.length > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-800">
              <FileText className="h-5 w-5" />
              Обязательные документы к ознакомлению
            </CardTitle>
            <CardDescription className="text-amber-700">
              Необходимо ознакомиться с {mandatoryDocs.length} документами
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {mandatoryDocs.map((doc) => (
                <Link key={doc.id} href={`/documents/${doc.id}`}>
                  <Badge variant="outline" className="cursor-pointer hover:bg-amber-100">
                    {doc.title}
                  </Badge>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
