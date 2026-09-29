"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import { ArrowLeft, CheckSquare, MessageSquare, Paperclip, Plus, Trash2, Download, ListTodo, Send } from "lucide-react"
import { formatDate, formatRelativeTime, getPriorityColor, getTaskPriorityLabel, getTaskStatusLabel, getTaskTypeLabel, getStatusColor } from "@/lib/utils"
import { TaskWithDetails, TaskComment, TaskAttachment, Profile, Project } from "@/types/database"

type CommentWithAuthor = TaskComment & { author?: Profile }

export default function TaskPage() {
  const params = useParams()
  const taskId = params.id as string
  const [task, setTask] = useState<TaskWithDetails | null>(null)
  const [comments, setComments] = useState<CommentWithAuthor[]>([])
  const [attachments, setAttachments] = useState<TaskAttachment[]>([])
  const [subtasks, setSubtasks] = useState<TaskWithDetails[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [employees, setEmployees] = useState<Profile[]>([])
  const [commentText, setCommentText] = useState("")
  const [subtaskTitle, setSubtaskTitle] = useState("")
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const supabase = useMemo(() => createClient(), [])

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        toast.error("Сессия истекла, войдите снова")
        return
      }
      const { data: taskData, error } = await supabase
        .from("tasks")
        .select("*, author:profiles!tasks_author_id_fkey(id,full_name), assignee:profiles!tasks_assignee_id_fkey(id,full_name), branch:branches(name), project:projects(id,name)")
        .eq("id", taskId)
        .single()
      if (error || !taskData) {
        toast.error("Задача не найдена")
        return
      }
      setTask(taskData)

      const [{ data: commentsData }, { data: attachData }, { data: subsData }, { data: projectsData }, { data: employeesData }] = await Promise.all([
        supabase.from("task_comments").select("*, author:profiles!task_comments_author_id_fkey(full_name)").eq("task_id", taskId).order("created_at"),
        supabase.from("task_attachments").select("*").eq("task_id", taskId).order("uploaded_at"),
        supabase.from("tasks").select("*, assignee:profiles!tasks_assignee_id_fkey(full_name)").eq("parent_task_id", taskId).order("created_at"),
        supabase.from("projects").select("*").eq("status", "active").order("name"),
        supabase.from("profiles").select("*").eq("is_active", true).order("full_name"),
      ])
      setComments(commentsData || [])
      setAttachments(attachData || [])
      setSubtasks(subsData || [])
      setProjects(projectsData || [])
      setEmployees(employeesData || [])
    } catch (error) {
      console.error("Error fetching task:", error)
      toast.error("Ошибка загрузки задачи")
    } finally {
      setLoading(false)
    }
  }, [supabase, taskId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const updateTask = async (updates: Record<string, unknown>) => {
    try {
      const patch = { ...updates }
      if (patch.status === "done" || patch.status === "rejected") {
        patch.closed_at = new Date().toISOString()
      }
      const { error } = await supabase.from("tasks").update(patch).eq("id", taskId)
      if (error) throw error
      setTask((prev) => (prev ? { ...prev, ...patch } : prev))
      toast.success("Задача обновлена")
    } catch (error) {
      console.error("Error updating task:", error)
      toast.error("Ошибка обновления")
    }
  }

  const sendComment = async () => {
    if (!commentText.trim()) return
    try {
      setSending(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { error } = await supabase.from("task_comments").insert({
        task_id: taskId,
        author_id: user.id,
        content: commentText.trim(),
      })
      if (error) throw error
      setCommentText("")
      const { data } = await supabase
        .from("task_comments").select("*, author:profiles!task_comments_author_id_fkey(full_name)").eq("task_id", taskId).order("created_at")
      setComments(data || [])
    } catch (error) {
      console.error("Error sending comment:", error)
      toast.error("Ошибка отправки комментария")
    } finally {
      setSending(false)
    }
  }

  const createSubtask = async () => {
    if (!subtaskTitle.trim() || !task) return
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { error } = await supabase.from("tasks").insert({
        title: subtaskTitle.trim(),
        status: "new",
        priority: "medium",
        type: task.type,
        author_id: user.id,
        project_id: task.project_id,
        parent_task_id: taskId,
        branch_id: task.branch_id,
      })
      if (error) throw error
      setSubtaskTitle("")
      fetchData()
      toast.success("Подзадача создана")
    } catch (error) {
      console.error("Error creating subtask:", error)
      toast.error("Ошибка создания подзадачи")
    }
  }

  const uploadFile = async (file: File) => {
    if (!task) return
    try {
      setUploading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const path = `${taskId}/${Date.now()}_${file.name}`
      const { error: upError } = await supabase.storage.from("task-attachments").upload(path, file)
      if (upError) throw upError
      const { error: dbError } = await supabase.from("task_attachments").insert({
        task_id: taskId,
        file_path: path,
        uploaded_by: user.id,
      })
      if (dbError) throw dbError
      fetchData()
      toast.success("Файл прикреплён")
    } catch (error) {
      console.error("Error uploading file:", error)
      toast.error("Ошибка загрузки файла")
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ""
    }
  }

  const deleteAttachment = async (id: string, path: string) => {
    try {
      await supabase.storage.from("task-attachments").remove([path])
      await supabase.from("task_attachments").delete().eq("id", id)
      setAttachments((prev) => prev.filter((a) => a.id !== id))
      toast.success("Файл удалён")
    } catch (error) {
      console.error("Error deleting file:", error)
      toast.error("Ошибка удаления файла")
    }
  }

  const downloadFile = async (path: string) => {
    const { data, error } = await supabase.storage.from("task-attachments").download(path)
    if (error || !data) {
      toast.error("Не удалось скачать файл")
      return
    }
    const url = URL.createObjectURL(data)
    const a = document.createElement("a")
    a.href = url
    a.download = path.split("/").pop() || "file"
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-12 w-3/4" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!task) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">Задача не найдена</p>
          <Link href="/tasks">
            <Button variant="outline" className="mt-4">
              <ArrowLeft className="h-4 w-4 mr-2" />К задачам
            </Button>
          </Link>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Link href="/tasks">
        <Button variant="ghost" className="pl-0">
          <ArrowLeft className="h-4 w-4 mr-2" />К задачам
        </Button>
      </Link>

      <div>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="text-2xl font-bold flex-1">{task.title}</h1>
          <div className="flex gap-2">
            <Badge className={getPriorityColor(task.priority)}>{getTaskPriorityLabel(task.priority)}</Badge>
            <Badge className={getStatusColor(task.status)}>{getTaskStatusLabel(task.status)}</Badge>
          </div>
        </div>
        <p className="text-sm text-muted-foreground mt-2">
          {task.project?.name && <span>Проект: {task.project.name} • </span>}
          {getTaskTypeLabel(task.type)} • От: {task.author?.full_name}
          {task.due_date && <span> • Срок: {formatDate(task.due_date)}</span>}
        </p>
        {task.description && <p className="mt-3 whitespace-pre-wrap">{task.description}</p>}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Управление</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2">
            <Label>Статус</Label>
            <Select value={task.status} onValueChange={(v) => updateTask({ status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="new">Новая</SelectItem>
                <SelectItem value="in_progress">В работе</SelectItem>
                <SelectItem value="done">Выполнена</SelectItem>
                <SelectItem value="rejected">Отклонена</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Исполнитель</Label>
            <Select value={task.assignee_id || "none"} onValueChange={(v) => updateTask({ assignee_id: v === "none" ? null : v })}>
              <SelectTrigger><SelectValue placeholder="Не назначен" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Не назначен</SelectItem>
                {employees.map((e) => (
                  <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Проект</Label>
            <Select value={task.project_id || "none"} onValueChange={(v) => updateTask({ project_id: v === "none" ? null : v })}>
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
            <Label>Приоритет</Label>
            <Select value={task.priority} onValueChange={(v) => updateTask({ priority: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Низкий</SelectItem>
                <SelectItem value="medium">Средний</SelectItem>
                <SelectItem value="high">Высокий</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ListTodo className="h-4 w-4" />Подзадачи ({subtasks.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {subtasks.map((s) => (
              <Link key={s.id} href={`/tasks/${s.id}`}>
                <div className="flex items-center gap-2 px-3 py-2 rounded-md border hover:bg-muted">
                  <CheckSquare className={`h-4 w-4 shrink-0 ${s.status === "done" ? "text-green-500" : "text-muted-foreground"}`} />
                  <span className={`text-sm flex-1 truncate ${s.status === "done" ? "line-through text-muted-foreground" : ""}`}>{s.title}</span>
                  <span className="text-xs text-muted-foreground shrink-0">{s.assignee?.full_name || ""}</span>
                </div>
              </Link>
            ))}
            <div className="flex gap-2 pt-2">
              <Input value={subtaskTitle} onChange={(e) => setSubtaskTitle(e.target.value)} placeholder="Новая подзадача..." onKeyDown={(e) => e.key === "Enter" && createSubtask()} />
              <Button size="icon" onClick={createSubtask} disabled={!subtaskTitle.trim()}><Plus className="h-4 w-4" /></Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Paperclip className="h-4 w-4" />Файлы ({attachments.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {attachments.map((a) => (
              <div key={a.id} className="flex items-center gap-2 px-3 py-2 rounded-md border">
                <span className="text-sm flex-1 truncate">{a.file_path.split("/").pop()}</span>
                <Button size="icon" variant="ghost" onClick={() => downloadFile(a.file_path)}><Download className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" onClick={() => deleteAttachment(a.id, a.file_path)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
            <div className="pt-2">
              <input ref={fileRef} type="file" className="hidden" onChange={(e) => e.target.files?.[0] && uploadFile(e.target.files[0])} />
              <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading}>
                <Plus className="h-4 w-4 mr-2" />{uploading ? "Загрузка..." : "Прикрепить файл"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />Комментарии ({comments.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            {comments.map((c) => (
              <div key={c.id} className="rounded-md border p-3">
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                  <span className="font-medium text-foreground">{c.author?.full_name || "—"}</span>
                  <span>{formatRelativeTime(c.created_at)}</span>
                </div>
                <p className="text-sm whitespace-pre-wrap">{c.content}</p>
              </div>
            ))}
            {comments.length === 0 && (
              <p className="text-sm text-muted-foreground">Комментариев пока нет</p>
            )}
          </div>
          <Separator />
          <div className="flex gap-2">
            <Textarea
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Написать комментарий..."
              className="min-h-10"
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) sendComment()
              }}
            />
            <Button onClick={sendComment} disabled={sending || !commentText.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Ctrl+Enter — отправить. Участники получат уведомление.</p>
        </CardContent>
      </Card>
    </div>
  )
}
