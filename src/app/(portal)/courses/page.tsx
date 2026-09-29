"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "sonner"
import Link from "next/link"
import { GraduationCap, Clock, CheckCircle, Play, BookOpen } from "lucide-react"
import { CourseWithProgress, Test, TestAttempt, Profile } from "@/types/database"

export default function CoursesPage() {
  const [courses, setCourses] = useState<CourseWithProgress[]>([])
  const [tests, setTests] = useState<Test[]>([])
  const [attempts, setAttempts] = useState<TestAttempt[]>([])
  const [loading, setLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState<Profile | null>(null)
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        toast.error("Сессия истекла, войдите снова")
        return
      }
      
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single()
      
      setCurrentUser(profile)
      
      // Fetch courses with progress: 3 запроса вместо N*2
      const { data: coursesData } = await supabase
        .from("courses")
        .select("*")
        .order("created_at", { ascending: false })

      const courseIds = (coursesData || []).map(c => c.id)
      const { data: progressRows } = courseIds.length
        ? await supabase.from("course_progress").select("*").eq("user_id", user.id).in("course_id", courseIds)
        : { data: [] }
      const { data: lessonRows } = courseIds.length
        ? await supabase.from("course_lessons").select("course_id").in("course_id", courseIds)
        : { data: [] }

      const lessonsCount = new Map<string, number>()
      for (const r of (lessonRows || [])) {
        lessonsCount.set(r.course_id, (lessonsCount.get(r.course_id) || 0) + 1)
      }
      const progressByCourse = new Map((progressRows || []).map(p => [p.course_id, p]))

      const coursesWithProgress = (coursesData || []).map((course) => {
        const progress = progressByCourse.get(course.id)
        return {
          ...course,
          progress: progress || undefined,
          progress_percent: progress?.status === "completed" ? 100 :
            progress?.status === "in_progress" ? 50 : 0,
          total_lessons: lessonsCount.get(course.id) || 0,
        }
      })
      
      setCourses(coursesWithProgress)
      
      // Fetch tests
      const { data: testsData } = await supabase
        .from("tests")
        .select("*")
        .order("created_at", { ascending: false })
      
      setTests(testsData || [])
      
      // Fetch test attempts
      const { data: attemptsData } = await supabase
        .from("test_attempts")
        .select("*")
        .eq("user_id", user.id)
      
      setAttempts(attemptsData || [])
    } catch (error) {
      console.error("Error fetching courses:", error)
      toast.error("Ошибка загрузки обучения")
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const startCourse = async (courseId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      
      const { error } = await supabase
        .from("course_progress")
        .upsert(
          {
            course_id: courseId,
            user_id: user.id,
            status: "in_progress",
          },
          { onConflict: "course_id,user_id" }
        )
      
      if (error) throw error
      
      // Navigate to course
      router.push(`/courses/${courseId}`)
    } catch (error) {
      console.error("Error starting course:", error)
      toast.error("Ошибка при начале курса")
    }
  }

  const startTest = async (testId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      
      // Check if there are previous attempts
      const testAttempts = attempts.filter(a => a.test_id === testId)
      const test = tests.find(t => t.id === testId)
      
      if (test?.max_attempts && testAttempts.length >= test.max_attempts) {
        toast.error("Исчерпано максимальное количество попыток")
        return
      }
      
      const { data, error } = await supabase
        .from("test_attempts")
        .insert({
          test_id: testId,
          user_id: user.id,
          status: "in_progress",
        })
        .select()
        .single()
      
      if (error) throw error
      
      // Navigate to test
      router.push(`/tests/${testId}/attempt/${data.id}`)
    } catch (error) {
      console.error("Error starting test:", error)
      toast.error("Ошибка при начале теста")
    }
  }

  const inProgressCourses = courses.filter(c => c.progress?.status === "in_progress")
  const completedCourses = courses.filter(c => c.progress?.status === "completed")
  const notStartedCourses = courses.filter(c => !c.progress || c.progress.status === "not_started")

  const CourseCard = ({ course }: { course: CourseWithProgress }) => (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg">{course.title}</CardTitle>
            <CardDescription className="line-clamp-2">
              {course.description || "Нет описания"}
            </CardDescription>
          </div>
          {course.mandatory && (
            <Badge variant="destructive">Обязательный</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <BookOpen className="h-4 w-4" />
              {course.total_lessons} уроков
            </span>
            {course.period_days && (
              <span className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                {course.period_days} дней
              </span>
            )}
          </div>
          
          {course.progress && (
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Прогресс</span>
                <span>{course.progress_percent}%</span>
              </div>
              <Progress value={course.progress_percent} className="h-2" />
            </div>
          )}
          
          <div className="flex gap-2">
            {!course.progress || course.progress.status === "not_started" ? (
              <Button onClick={() => startCourse(course.id)} className="w-full">
                <Play className="h-4 w-4 mr-2" />
                Начать
              </Button>
            ) : course.progress.status === "in_progress" ? (
              <Button className="w-full" asChild>
                <Link href={`/courses/${course.id}`}>
                  <Play className="h-4 w-4 mr-2" />
                  Продолжить
                </Link>
              </Button>
            ) : (
              <Button variant="outline" className="w-full" disabled>
                <CheckCircle className="h-4 w-4 mr-2" />
                Завершен
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )

  return (
    <div className="space-y-6">
      {loading && courses.length === 0 && (
        <Card><CardContent className="py-12 text-center text-muted-foreground">Загрузка курсов...</CardContent></Card>
      )}
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Обучение</h1>
        <p className="text-muted-foreground mt-1">
          Курсы и аттестации
        </p>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">Все курсы</TabsTrigger>
          <TabsTrigger value="in_progress">В процессе</TabsTrigger>
          <TabsTrigger value="completed">Завершенные</TabsTrigger>
        </TabsList>
        
        <TabsContent value="all" className="mt-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {courses.map((course) => (
              <CourseCard key={course.id} course={course} />
            ))}
          </div>
        </TabsContent>
        
        <TabsContent value="in_progress" className="mt-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {inProgressCourses.length > 0 ? (
              inProgressCourses.map((course) => (
                <CourseCard key={course.id} course={course} />
              ))
            ) : (
              <Card className="md:col-span-2 lg:col-span-3">
                <CardContent className="py-12 text-center">
                  <GraduationCap className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">Нет курсов в процессе</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
        
        <TabsContent value="completed" className="mt-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {completedCourses.length > 0 ? (
              completedCourses.map((course) => (
                <CourseCard key={course.id} course={course} />
              ))
            ) : (
              <Card className="md:col-span-2 lg:col-span-3">
                <CardContent className="py-12 text-center">
                  <GraduationCap className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">Нет завершенных курсов</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Tests Section */}
      <div className="mt-8">
        <h2 className="text-xl font-semibold mb-4">Тесты и аттестации</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {tests.map((test) => {
            const testAttempts = attempts.filter(a => a.test_id === test.id)
            const lastAttempt = testAttempts[testAttempts.length - 1]
            const passed = testAttempts.some(a => a.passed)
            
            return (
              <Card key={test.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{test.title}</CardTitle>
                      <CardDescription>
                        Проходной балл: {test.pass_score}% • 
                        Попыток: {testAttempts.length}{test.max_attempts ? `/${test.max_attempts}` : ""}
                      </CardDescription>
                    </div>
                    {passed ? (
                      <Badge className="bg-green-500">Сдан</Badge>
                    ) : lastAttempt ? (
                      <Badge variant="destructive">Не сдан</Badge>
                    ) : (
                      <Badge variant="secondary">Не начат</Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-2">
                    {!passed && (!test.max_attempts || testAttempts.length < test.max_attempts) && (
                      <Button onClick={() => startTest(test.id)}>
                        {lastAttempt ? "Пересдать" : "Начать тест"}
                      </Button>
                    )}
                    {lastAttempt && (
                      <span className="text-sm text-muted-foreground self-center">
                        Оценка: {lastAttempt.score ?? "—"}%
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>
    </div>
  )
}
