"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { Plus, Search, CheckSquare, Clock, AlertCircle, FolderKanban, ChevronRight, MessageSquare, Paperclip, ListTodo, KanbanSquare } from "lucide-react"
import { formatDate, getPriorityColor, getTaskTypeLabel, getTaskPriorityLabel, getTaskStatusLabel, isOverdue } from "@/lib/utils"
import { TaskWithDetails, TaskType, TaskPriority, Profile, Branch, Project } from "@/types/database"

type ViewMode = "kanban" | "list"

const COLUMNS: { key: string; title: string; statuses: string[] }[] = [
  { key: "new", title: "Новые", statuses: ["new"] },
  { key: "in_progress", title: "В работе", statuses: ["in_progress"] },
  { key: "done", title: "Завершённые", statuses: ["done", "rejected"] },
]

export default function TasksPage() {
  const [tasks, setTasks] = useState<TaskWithDetails[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [employees, setEmployees] = useState<Profile[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedProject, setSelectedProject] = useState<string | "all" | "none">("all")
  const [view, setView] = useState<ViewMode>("kanban")
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false)
  const [isProjectDialogOpen, setIsProjectDialogOpen] = useState(false)
  const [dragTaskId, setDragTaskId] = useState<string | null>(null)
  const [currentUser, setCurrentUser] = useState<Profile | null>(null)
  const supabase = useMemo(() => createClient(), [])

  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    type: "operations" as TaskType,
    priority: "medium" as TaskPriority,
    assignee_id: "",
    branch_id: "",
    project_id: "",
    parent_task_id: "",
    due_date: "",
  })
  const [newProject, setNewProject] = useState({ name: "", description: "", parent_id: "" })

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        toast.error("Сессия истекла, войдите снова")
        return
      }
      const { data: profile } = await supabase
        .from("profiles").select("*").eq("id", user.id).single()
      setCurrentUser(profile)

      const [{ data: tasksData }, { data: projectsData }] = await Promise.all([
        supabase
          .from("tasks")
          .select("*, author:profiles!tasks_author_id_fkey(full_name), assignee:profiles!tasks_assignee_id_fkey(full_name), branch:branches(name), project:projects(id,name)")
          .order("position")
          .order("created_at", { ascending: false }),
        supabase.from("projects").select("*").eq("status", "active").order("name"),
      ])
      setTasks(tasksData || [])
      setProjects(projectsData || [])

      const { data: employeesData } = await supabase
        .from("profiles").select("*").eq("is_active", true).order("full_name")
      setEmployees(employeesData || [])

      const { data: branchesData } = await supabase
        .from("branches").select("*").eq("is_active", true).order("name")
      setBranches(branchesData || [])
    } catch (error) {
      console.error("Error fetching tasks:", error)
      toast.error("Ошибка загрузки задач")
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleCreateTask = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const payload: Record<string, unknown> = {
        title: newTask.title.trim(),
        description: newTask.description || null,
        type: newTask.type,
        priority: newTask.priority,
        assignee_id: newTask.assignee_id || null,
        branch_id: newTask.branch_id || null,
        project_id: newTask.project_id || null,
        parent_task_id: newTask.parent_task_id || null,
        due_date: newTask.due_date || null,
        author_id: user.id,
        status: "new",
      }
      const { error } = await supabase.from("tasks").insert(payload)
      if (error) throw error
      toast.success("Задача создана")
      setIsTaskDialogOpen(false)
      setNewTask({ title: "", description: "", type: "operations", priority: "medium", assignee_id: "", branch_id: "", project_id: "", parent_task_id: "", due_date: "" })
      fetchData()
    } catch (error) {
      console.error("Error creating task:", error)
      toast.error("Ошибка при создании задачи")
    }
  }

  const handleCreateProject = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { error } = await supabase.from("projects").insert({
        name: newProject.name.trim(),
        description: newProject.description || null,
        parent_id: newProject.parent_id || null,
        created_by: user.id,
        status: "active",
      })
      if (error) throw error
      toast.success("Проект создан")
      setIsProjectDialogOpen(false)
      setNewProject({ name: "", description: "", parent_id: "" })
      fetchData()
    } catch (error) {
      console.error("Error creating project:", error)
      toast.error("Ошибка при создании проекта")
    }
  }

  const handleStatusChange = async (taskId: string, newStatus: string) => {
    try {
      const updates: Record<string, string> = { status: newStatus }
      if (newStatus === "done" || newStatus === "rejected") {
        updates.closed_at = new Date().toISOString()
      }
      const { error } = await supabase.from("tasks").update(updates).eq("id", taskId)
      if (error) throw error
      setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, ...(updates as Partial<TaskWithDetails>) } : t)))
      toast.success("Статус: " + getTaskStatusLabel(newStatus))
    } catch (error) {
      console.error("Error updating task:", error)
      toast.error("Ошибка при обновлении статуса")
    }
  }

  const visibleTasks = tasks.filter((task) => {
    if (selectedProject === "all") return true
    if (selectedProject === "none") return !task.project_id
    return task.project_id === selectedProject
  }).filter((task) =>
    (task.title || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
    (task.description || "").toLowerCase().includes(searchQuery.toLowerCase())
  )

  const topLevel = (list: TaskWithDetails[]) => list.filter((t) => !t.parent_task_id)
  const subtaskCount = (id: string) => tasks.filter((t) => t.parent_task_id === id).length

  const rootProjects = projects.filter((p) => !p.parent_id)
  const childProjects = (id: string) => projects.filter((p) => p.parent_id === id)
  const projectTaskCount = (id: string) => tasks.filter((t) => t.project_id === id).length

  const TaskCard = ({ task, compact }: { task: TaskWithDetails; compact?: boolean }) => {
    const overdue = isOverdue(task.due_date, task.status)
    const subs = subtaskCount(task.id)
    return (
      <Link href={`/tasks/${task.id}`}>
        <Card
          className={`hover:shadow-md transition-shadow cursor-grab ${overdue ? "border-red-200" : ""}`}
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData("text/plain", task.id)
            setDragTaskId(task.id)
          }}
          onDragEnd={() => setDragTaskId(null)}
        >
          <CardContent className={compact ? "p-3" : "p-4"}>
            <div className="flex items-start justify-between gap-2">
              <p className="font-medium text-sm flex-1">{task.title}</p>
              <Badge className={getPriorityColor(task.priority)}>{getTaskPriorityLabel(task.priority)}</Badge>
            </div>
            {!compact && task.description && (
              <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{task.description}</p>
            )}
            <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
              <span className="truncate">
                {task.assignee?.full_name || "Не назначен"} • {getTaskTypeLabel(task.type)}
              </span>
              {task.due_date && (
                <span className={`flex items-center gap-1 shrink-0 ml-2 ${overdue ? "text-red-500" : ""}`}>
                  {overdue && <AlertCircle className="h-3 w-3" />}
                  <Clock className="h-3 w-3" />
                  {formatDate(task.due_date)}
                </span>
              )}
            </div>
            {(subs > 0 || task.project) && (
              <div className="flex items-center gap-2 mt-2 text-[11px] text-muted-foreground">
                {subs > 0 && <span className="flex items-center gap-1"><ListTodo className="h-3 w-3" />{subs}</span>}
                {task.project && <span className="truncate">{task.project.name}</span>}
              </div>
            )}
          </CardContent>
        </Card>
      </Link>
    )
  }

  const onDropTo = (e: React.DragEvent, statuses: readonly string[]) => {
    e.preventDefault()
    const id = e.dataTransfer.getData("text/plain") || dragTaskId
    if (!id) return
    const task = tasks.find((t) => t.id === id)
    if (!task || statuses.includes(task.status)) return
    handleStatusChange(id, statuses[0])
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Задачи и проекты</h1>
          <p className="text-muted-foreground mt-1">Канбан, подзадачи, файлы и комментарии</p>
        </div>
        <div className="flex gap-2">
          <div className="flex rounded-md border p-0.5">
            <Button variant={view === "kanban" ? "secondary" : "ghost"} size="sm" onClick={() => setView("kanban")}>
              <KanbanSquare className="h-4 w-4 mr-1" />Канбан
            </Button>
            <Button variant={view === "list" ? "secondary" : "ghost"} size="sm" onClick={() => setView("list")}>
              <ListTodo className="h-4 w-4 mr-1" />Список
            </Button>
          </div>
          <Dialog open={isProjectDialogOpen} onOpenChange={setIsProjectDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline"><FolderKanban className="h-4 w-4 mr-2" />Проект</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Новый проект</DialogTitle>
                <DialogDescription>Проект или подпроект</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Название</Label>
                  <Input value={newProject.name} onChange={(e) => setNewProject({ ...newProject, name: e.target.value })} placeholder="Название проекта" />
                </div>
                <div className="space-y-2">
                  <Label>Описание</Label>
                  <Textarea value={newProject.description} onChange={(e) => setNewProject({ ...newProject, description: e.target.value })} placeholder="О проекте" />
                </div>
                <div className="space-y-2">
                  <Label>Родительский проект (подпроект)</Label>
                  <Select value={newProject.parent_id} onValueChange={(v) => setNewProject({ ...newProject, parent_id: v === "root" ? "" : v })}>
                    <SelectTrigger><SelectValue placeholder="Корневой проект" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="root">Корневой проект</SelectItem>
                      {projects.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsProjectDialogOpen(false)}>Отмена</Button>
                <Button onClick={handleCreateProject} disabled={!newProject.name.trim()}>Создать</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Dialog open={isTaskDialogOpen} onOpenChange={setIsTaskDialogOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />Новая задача</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Создать задачу</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Название</Label>
                  <Input value={newTask.title} onChange={(e) => setNewTask({ ...newTask, title: e.target.value })} placeholder="Название задачи" />
                </div>
                <div className="space-y-2">
                  <Label>Описание</Label>
                  <Textarea value={newTask.description} onChange={(e) => setNewTask({ ...newTask, description: e.target.value })} placeholder="Описание задачи" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Тип</Label>
                    <Select value={newTask.type} onValueChange={(v) => setNewTask({ ...newTask, type: v as TaskType })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="operations">Операционная</SelectItem>
                        <SelectItem value="it">IT</SelectItem>
                        <SelectItem value="security">Безопасность</SelectItem>
                        <SelectItem value="other">Другое</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Приоритет</Label>
                    <Select value={newTask.priority} onValueChange={(v) => setNewTask({ ...newTask, priority: v as TaskPriority })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Низкий</SelectItem>
                        <SelectItem value="medium">Средний</SelectItem>
                        <SelectItem value="high">Высокий</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Проект</Label>
                    <Select value={newTask.project_id} onValueChange={(v) => setNewTask({ ...newTask, project_id: v === "none" ? "" : v })}>
                      <SelectTrigger><SelectValue placeholder="Без проекта" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Без проекта</SelectItem>
                        {projects.map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Исполнитель</Label>
                    <Select value={newTask.assignee_id} onValueChange={(v) => setNewTask({ ...newTask, assignee_id: v === "none" ? "" : v })}>
                      <SelectTrigger><SelectValue placeholder="Выберите" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Не назначать</SelectItem>
                        {employees.map((emp) => (
                          <SelectItem key={emp.id} value={emp.id}>{emp.full_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Точка</Label>
                    <Select value={newTask.branch_id} onValueChange={(v) => setNewTask({ ...newTask, branch_id: v === "none" ? "" : v })}>
                      <SelectTrigger><SelectValue placeholder="Не важно" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Не важно</SelectItem>
                        {branches.map((b) => (
                          <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Срок</Label>
                    <Input type="datetime-local" value={newTask.due_date} onChange={(e) => setNewTask({ ...newTask, due_date: e.target.value })} />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsTaskDialogOpen(false)}>Отмена</Button>
                <Button onClick={handleCreateTask} disabled={!newTask.title.trim()}>Создать</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Поиск задач..." className="pl-10" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <Card className="h-fit">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FolderKanban className="h-4 w-4" />Проекты
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <button
              onClick={() => setSelectedProject("all")}
              className={`w-full text-left px-3 py-2 rounded-md text-sm hover:bg-muted ${selectedProject === "all" ? "bg-muted font-medium" : ""}`}
            >
              Все задачи <span className="text-muted-foreground">({tasks.length})</span>
            </button>
            <button
              onClick={() => setSelectedProject("none")}
              className={`w-full text-left px-3 py-2 rounded-md text-sm hover:bg-muted ${selectedProject === "none" ? "bg-muted font-medium" : ""}`}
            >
              Без проекта <span className="text-muted-foreground">({tasks.filter((t) => !t.project_id).length})</span>
            </button>
            {rootProjects.map((p) => (
              <div key={p.id}>
                <button
                  onClick={() => setSelectedProject(p.id)}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm hover:bg-muted flex items-center gap-1 ${selectedProject === p.id ? "bg-muted font-medium" : ""}`}
                >
                  <ChevronRight className="h-3 w-3 text-muted-foreground" />
                  <span className="flex-1 truncate">{p.name}</span>
                  <span className="text-muted-foreground text-xs">({projectTaskCount(p.id)})</span>
                </button>
                {childProjects(p.id).map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setSelectedProject(c.id)}
                    className={`w-full text-left pl-8 pr-3 py-1.5 rounded-md text-sm hover:bg-muted flex items-center gap-1 ${selectedProject === c.id ? "bg-muted font-medium" : ""}`}
                  >
                    <span className="flex-1 truncate">{c.name}</span>
                    <span className="text-muted-foreground text-xs">({projectTaskCount(c.id)})</span>
                  </button>
                ))}
              </div>
            ))}
          </CardContent>
        </Card>

        <div>
          {loading && tasks.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">Загрузка...</CardContent></Card>
          ) : view === "kanban" ? (
            <div className="grid gap-4 md:grid-cols-3 items-start">
              {COLUMNS.map((col) => {
                const colTasks = topLevel(visibleTasks).filter((t) => col.statuses.includes(t.status))
                return (
                  <div
                    key={col.key}
                    className="rounded-lg bg-muted/50 p-3 min-h-[200px]"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => onDropTo(e, col.statuses)}
                  >
                    <div className="flex items-center justify-between px-1 pb-3">
                      <span className="font-medium text-sm">{col.title}</span>
                      <Badge variant="secondary">{colTasks.length}</Badge>
                    </div>
                    <div className="space-y-2">
                      {colTasks.map((t) => <TaskCard key={t.id} task={t} compact />)}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="space-y-2">
              {topLevel(visibleTasks).map((t) => <TaskCard key={t.id} task={t} />)}
              {visibleTasks.length === 0 && (
                <Card>
                  <CardContent className="py-12 text-center">
                    <CheckSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">Нет задач</p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      </div>

      <p className="text-xs text-muted-foreground flex items-center gap-4">
        <span className="flex items-center gap-1"><MessageSquare className="h-3 w-3" />комментарии с уведомлениями</span>
        <span className="flex items-center gap-1"><Paperclip className="h-3 w-3" />файлы в карточке задачи</span>
      </p>
    </div>
  )
}
