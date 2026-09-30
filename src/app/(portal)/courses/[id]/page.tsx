"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { toast } from "sonner"
import { ArrowLeft, CheckCircle, BookOpen, ChevronRight } from "lucide-react"
import { Course, CourseLesson, CourseProgress } from "@/types/database"

export default function CoursePage() {
  const params = useParams()
  const [course, setCourse] = useState<Course | null>(null)
  const [lessons, setLessons] = useState<CourseLesson[]>([])
  const [progress, setProgress] = useState<CourseProgress | null>(null)
  const [activeLessonId, setActiveLessonId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [finishing, setFinishing] = useState(false)
  const supabase = useMemo(() => createClient(), [])

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        toast.error("Сессия истекла, войдите снова")
        return
      }
      const { data: courseData, error: courseError } = await supabase
        .from("courses")
        .select("*")
        .eq("id", params.id)
        .single()
      if (courseError || !courseData) {
        toast.error("Курс не найден")
        return
      }
      setCourse(courseData)

      const { data: lessonsData } = await supabase
        .from("course_lessons")
        .select("*")
        .eq("course_id", params.id)
        .order("order")

      setLessons(lessonsData || [])

      let { data: progressData } = await supabase
        .from("course_progress")
        .select("*")
        .eq("course_id", params.id)
        .eq("user_id", user.id)
        .maybeSingle()

      if (!progressData) {
        const { data: created } = await supabase
          .from("course_progress")
          .upsert(
            { course_id: params.id as string, user_id: user.id, status: "in_progress" },
            { onConflict: "course_id,user_id" }
          )
          .select()
          .single()
        progressData = created
      }
      setProgress(progressData)
      setActiveLessonId(progressData?.last_lesson_id || lessonsData?.[0]?.id || null)
    } catch (error) {
      console.error("Error fetching course:", error)
      toast.error("Ошибка загрузки курса")
    } finally {
      setLoading(false)
    }
  }, [supabase, params.id])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const openLesson = async (lessonId: string) => {
    setActiveLessonId(lessonId)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from("course_progress")
        .upsert(
          { course_id: params.id as string, user_id: user.id, status: "in_progress", last_lesson_id: lessonId },
          { onConflict: "course_id,user_id" }
        )
        .select()
        .single()
      if (data) setProgress(data)
    } catch (error) {
      console.error("Error saving progress:", error)
    }
  }

  const finishCourse = async () => {
    try {
      setFinishing(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data, error } = await supabase
        .from("course_progress")
        .upsert(
          {
            course_id: params.id as string,
            user_id: user.id,
            status: "completed",
            last_lesson_id: activeLessonId,
            completed_at: new Date().toISOString(),
          },
          { onConflict: "course_id,user_id" }
        )
        .select()
        .single()
      if (error) throw error
      setProgress(data)
      toast.success("Курс завершён")
    } catch (error) {
      console.error("Error finishing course:", error)
      toast.error("Ошибка при завершении курса")
    } finally {
      setFinishing(false)
    }
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

  if (!course) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">Курс не найден</p>
          <Link href="/courses">
            <Button variant="outline" className="mt-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Назад к обучению
            </Button>
          </Link>
        </CardContent>
      </Card>
    )
  }

  const activeLesson = lessons.find((l) => l.id === activeLessonId) || null
  const activeIndex = lessons.findIndex((l) => l.id === activeLessonId)
  const isCompleted = progress?.status === "completed"
  const percent = lessons.length === 0 || isCompleted ? (isCompleted ? 100 : 0)
    : Math.round(((activeIndex + 1) / lessons.length) * 100)

  return (
    <div className="space-y-6">
      <Link href="/courses">
        <Button variant="ghost" className="pl-0">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Назад к обучению
        </Button>
      </Link>

      <div className="min-w-0">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <h1 className="text-3xl font-bold break-words min-w-0">{course.title}</h1>
          <div className="flex gap-2">
            {course.mandatory && <Badge variant="destructive">Обязательный</Badge>}
            {isCompleted && <Badge className="bg-green-500">Завершён</Badge>}
          </div>
        </div>
        {course.description && (
          <p className="text-muted-foreground mt-2">{course.description}</p>
        )}
        <div className="flex items-center gap-4 mt-4">
          <Progress value={percent} className="h-2 flex-1" />
          <span className="text-sm text-muted-foreground whitespace-nowrap">
            {activeIndex >= 0 ? activeIndex + 1 : 0}/{lessons.length}
          </span>
        </div>
      </div>

      <Separator />

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <Card className="h-fit">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              Уроки
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {lessons.map((lesson, i) => (
              <button
                key={lesson.id}
                onClick={() => openLesson(lesson.id)}
                className={`w-full text-left px-3 py-2 rounded-md text-sm flex items-center gap-2 hover:bg-muted min-w-0 ${
                  lesson.id === activeLessonId ? "bg-muted font-medium" : ""
                }`}
              >
                <span className="text-muted-foreground shrink-0">{i + 1}.</span>
                <span className="flex-1 min-w-0 truncate">{lesson.title}</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </button>
            ))}
            {lessons.length === 0 && (
              <p className="text-sm text-muted-foreground">Уроков пока нет</p>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          {activeLesson ? (
            <Card>
              <CardHeader>
                <CardTitle>{activeLesson.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="markdown-content prose max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {activeLesson.content}
                  </ReactMarkdown>
                </div>
                <div className="flex justify-between mt-6">
                  <Button
                    variant="outline"
                    disabled={activeIndex <= 0}
                    onClick={() => openLesson(lessons[activeIndex - 1].id)}
                  >
                    Назад
                  </Button>
                  {activeIndex < lessons.length - 1 ? (
                    <Button onClick={() => openLesson(lessons[activeIndex + 1].id)}>
                      Далее
                    </Button>
                  ) : (
                    !isCompleted && (
                      <Button onClick={finishCourse} disabled={finishing}>
                        <CheckCircle className="h-4 w-4 mr-2" />
                        {finishing ? "..." : "Завершить курс"}
                      </Button>
                    )
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                Выберите урок слева
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
