"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { toast } from "sonner"
import Link from "next/link"
import { Plus, Search, Filter, CheckSquare, Clock, AlertCircle } from "lucide-react"
import { formatDate, getStatusColor, getPriorityColor, getTaskTypeLabel, getTaskPriorityLabel, getTaskStatusLabel, isOverdue } from "@/lib/utils"
import { TaskWithDetails, TaskType, TaskPriority, Profile, Branch } from "@/types/database"

export default function TasksPage() {
  const [tasks, setTasks] = useState<TaskWithDetails[]>([])
  const [employees, setEmployees] = useState<Profile[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [currentUser, setCurrentUser] = useState<Profile | null>(null)
  const router = useRouter()
  const supabase = createClient()

  // Form state
  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    type: "operations" as TaskType,
    priority: "medium" as TaskPriority,
    assignee_id: "",
    branch_id: "",
    due_date: "",
  })

  useEffect(() => {
    fetchData()
  }, [])

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
      
      // Fetch tasks
      const { data: tasksData } = await supabase
        .from("tasks")
        .select("*, author:profiles!tasks_author_id_fkey(full_name), assignee:profiles!tasks_assignee_id_fkey(full_name), branch:branches(name)")
        .order("created_at", { ascending: false })
      
      setTasks(tasksData || [])
      
      // Fetch employees for assignee selection
      const { data: employeesData } = await supabase
        .from("profiles")
        .select("*")
        .eq("is_active", true)
        .order("full_name")
      
      setEmployees(employeesData || [])
      
      // Fetch branches
      const { data: branchesData } = await supabase
        .from("branches")
        .select("*")
        .eq("is_active", true)
        .order("name")
      
      setBranches(branchesData || [])
    } catch (error) {
      console.error("Error fetching tasks:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateTask = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      
      const { error } = await supabase
        .from("tasks")
        .insert({
          ...newTask,
          author_id: user.id,
          status: "new",
        })
      
      if (error) throw error
      
      toast.success("Задача создана")
      setIsDialogOpen(false)
      setNewTask({
        title: "",
        description: "",
        type: "operations",
        priority: "medium",
        assignee_id: "",
        branch_id: "",
        due_date: "",
      })
      fetchData()
    } catch (error) {
      console.error("Error creating task:", error)
      toast.error("Ошибка при создании задачи")
    }
  }

  const handleStatusChange = async (taskId: string, newStatus: string) => {
    try {
      const updates: any = { status: newStatus }
      if (newStatus === "done" || newStatus === "rejected") {
        updates.closed_at = new Date().toISOString()
      }
      
      const { error } = await supabase
        .from("tasks")
        .update(updates)
        .eq("id", taskId)
      
      if (error) throw error
      
      toast.success("Статус обновлен")
      fetchData()
    } catch (error) {
      console.error("Error updating task:", error)
      toast.error("Ошибка при обновлении статуса")
    }
  }

  const filteredTasks = tasks.filter(task =>
    task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    task.description?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const myTasks = filteredTasks.filter(t => 
    t.assignee_id === currentUser?.id || t.author_id === currentUser?.id
  )
  const openTasks = filteredTasks.filter(t => t.status !== "done" && t.status !== "rejected")
  const completedTasks = filteredTasks.filter(t => t.status === "done" || t.status === "rejected")

  const TaskCard = ({ task }: { task: TaskWithDetails }) => {
    const overdue = isOverdue(task.due_date, task.status)
    
    return (
      <Card className={overdue ? "border-red-200" : ""}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <Link href={`/tasks/${task.id}`}>
                <CardTitle className="text-base hover:underline cursor-pointer">
                  {task.title}
                </CardTitle>
              </Link>
              <CardDescription className="mt-1">
                {task.branch?.name} • {getTaskTypeLabel(task.type)}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Badge className={getPriorityColor(task.priority)}>
                {getTaskPriorityLabel(task.priority)}
              </Badge>
              <Badge className={getStatusColor(task.status)}>
                {getTaskStatusLabel(task.status)}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
            {task.description || "Без описания"}
          </p>
          
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-4 text-muted-foreground">
              <span>От: {task.author?.full_name}</span>
              {task.assignee && <span>Исп: {task.assignee.full_name}</span>}
            </div>
            
            <div className="flex items-center gap-2">
              {overdue && (
                <AlertCircle className="h-4 w-4 text-red-500" />
              )}
              {task.due_date && (
                <span className={overdue ? "text-red-500" : ""}>
                  <Clock className="h-4 w-4 inline mr-1" />
                  {formatDate(task.due_date)}
                </span>
              )}
            </div>
          </div>
          
          {task.status !== "done" && task.status !== "rejected" && (
            <div className="flex gap-2 mt-4">
              {task.status === "new" && (
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => handleStatusChange(task.id, "in_progress")}
                >
                  Взять в работу
                </Button>
              )}
              {task.status === "in_progress" && (
                <Button 
                  size="sm"
                  onClick={() => handleStatusChange(task.id, "done")}
                >
                  <CheckSquare className="h-4 w-4 mr-2" />
                  Выполнено
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Задачи</h1>
          <p className="text-muted-foreground mt-1">
            Управление задачами и поручениями
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Новая задача
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Создать задачу</DialogTitle>
              <DialogDescription>
                Заполните информацию о новой задаче
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Название</Label>
                <Input
                  value={newTask.title}
                  onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                  placeholder="Название задачи"
                />
              </div>
              <div className="space-y-2">
                <Label>Описание</Label>
                <Textarea
                  value={newTask.description}
                  onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                  placeholder="Описание задачи"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Тип</Label>
                  <Select
                    value={newTask.type}
                    onValueChange={(v) => setNewTask({ ...newTask, type: v as TaskType })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
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
                  <Select
                    value={newTask.priority}
                    onValueChange={(v) => setNewTask({ ...newTask, priority: v as TaskPriority })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Низкий</SelectItem>
                      <SelectItem value="medium">Средний</SelectItem>
                      <SelectItem value="high">Высокий</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Исполнитель</Label>
                <Select
                  value={newTask.assignee_id}
                  onValueChange={(v) => setNewTask({ ...newTask, assignee_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите исполнителя" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Точка (опционально)</Label>
                <Select
                  value={newTask.branch_id}
                  onValueChange={(v) => setNewTask({ ...newTask, branch_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите точку" />
                  </SelectTrigger>
                  <SelectContent>
                    {branches.map((branch) => (
                      <SelectItem key={branch.id} value={branch.id}>
                        {branch.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Срок выполнения</Label>
                <Input
                  type="datetime-local"
                  value={newTask.due_date}
                  onChange={(e) => setNewTask({ ...newTask, due_date: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Отмена
              </Button>
              <Button onClick={handleCreateTask} disabled={!newTask.title}>
                Создать
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Поиск задач..."
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Tasks Tabs */}
      <Tabs defaultValue="my">
        <TabsList>
          <TabsTrigger value="my">Мои задачи</TabsTrigger>
          <TabsTrigger value="open">Открытые</TabsTrigger>
          <TabsTrigger value="completed">Завершенные</TabsTrigger>
        </TabsList>
        
        <TabsContent value="my" className="mt-6">
          <div className="space-y-4">
            {myTasks.length > 0 ? (
              myTasks.map((task) => <TaskCard key={task.id} task={task} />)
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <CheckSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">У вас нет задач</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
        
        <TabsContent value="open" className="mt-6">
          <div className="space-y-4">
            {openTasks.length > 0 ? (
              openTasks.map((task) => <TaskCard key={task.id} task={task} />)
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <CheckSquare className="h-12 w-12 text-green-500 mx-auto mb-4" />
                  <p className="text-muted-foreground">Нет открытых задач</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
        
        <TabsContent value="completed" className="mt-6">
          <div className="space-y-4">
            {completedTasks.length > 0 ? (
              completedTasks.map((task) => <TaskCard key={task.id} task={task} />)
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground">Нет завершенных задач</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
