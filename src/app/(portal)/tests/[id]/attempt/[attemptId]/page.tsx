"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import { toast } from "sonner"
import { ArrowLeft, CheckCircle, XCircle } from "lucide-react"
import { Test, TestAttempt, TestQuestion, TestAnswerOption } from "@/types/database"

type QuestionWithOptions = TestQuestion & { options: TestAnswerOption[] }
type Result = { score: number | null; passed: boolean | null; correct: number; total: number }

export default function AttemptPage() {
  const params = useParams()
  const testId = params.id as string
  const attemptId = params.attemptId as string
  const [test, setTest] = useState<Test | null>(null)
  const [attempt, setAttempt] = useState<TestAttempt | null>(null)
  const [questions, setQuestions] = useState<QuestionWithOptions[]>([])
  const [selected, setSelected] = useState<Record<string, string[]>>({})
  const [textAnswers, setTextAnswers] = useState<Record<string, string>>({})
  const [result, setResult] = useState<Result | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const supabase = useMemo(() => createClient(), [])

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        toast.error("Сессия истекла, войдите снова")
        return
      }
      const { data: testData } = await supabase
        .from("tests").select("*").eq("id", testId).single()
      if (!testData) {
        toast.error("Тест не найден")
        return
      }
      setTest(testData)

      const { data: attemptData } = await supabase
        .from("test_attempts").select("*").eq("id", attemptId).single()
      if (!attemptData || attemptData.user_id !== user.id) {
        toast.error("Попытка не найдена")
        return
      }
      setAttempt(attemptData)

      const { data: questionsData } = await supabase
        .from("test_questions").select("*").eq("test_id", testId).order("order")
      const withOptions: QuestionWithOptions[] = []
      for (const q of questionsData || []) {
        // is_correct скрыт RLS: до завершения NULL, после — виден (разбор)
        const { data: options } = await supabase
          .rpc("get_question_options" as never, { p_question_id: q.id } as never) as unknown as { data: TestAnswerOption[] | null }
        withOptions.push({ ...q, options: options || [] })
      }
      setQuestions(withOptions)

      if (attemptData.status === "completed") {
        const { data: answers } = await supabase
          .from("test_attempt_answers").select("*").eq("attempt_id", attemptId)
        const sel: Record<string, string[]> = {}
        const txt: Record<string, string> = {}
        for (const a of answers || []) {
          sel[a.question_id] = a.selected_option_ids || []
          if (a.text_answer) txt[a.question_id] = a.text_answer
        }
        setSelected(sel)
        setTextAnswers(txt)
        setResult({
          score: attemptData.score,
          passed: attemptData.passed,
          correct: (answers || []).filter((a) => a.is_correct).length,
          total: withOptions.filter((q) => q.type !== "text").length,
        })
      }
    } catch (error) {
      console.error("Error fetching attempt:", error)
      toast.error("Ошибка загрузки теста")
    } finally {
      setLoading(false)
    }
  }, [supabase, testId, attemptId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const toggleOption = (questionId: string, optionId: string, multi: boolean) => {
    setSelected((prev) => {
      const cur = prev[questionId] || []
      if (multi) {
        return { ...prev, [questionId]: cur.includes(optionId) ? cur.filter((x) => x !== optionId) : [...cur, optionId] }
      }
      return { ...prev, [questionId]: [optionId] }
    })
  }

  const submit = async () => {
    const unanswered = questions.filter((q) =>
      q.type === "text" ? !(textAnswers[q.id]?.trim()) : !(selected[q.id]?.length)
    )
    if (unanswered.length > 0 && !confirm(`Без ответа: ${unanswered.length}. Отправить?`)) return
    try {
      setSubmitting(true)
      const payload = questions.map((q) => ({
        question_id: q.id,
        selected_option_ids: selected[q.id] || [],
        text_answer: textAnswers[q.id] || null,
      }))
      const { data, error } = await supabase
        .rpc("submit_test_attempt" as never, { p_attempt_id: attemptId, p_answers: payload } as never) as unknown as { data: Result | Result[] | null; error: unknown }
      if (error) throw error
      const row = (Array.isArray(data) ? data[0] : data) as Result | undefined
      if (!row) throw new Error("Empty result")
      setResult(row)
      const { data: updated } = await supabase
        .from("test_attempts").select("*").eq("id", attemptId).single()
      if (updated) setAttempt(updated)
      // подтянуть разбор с правильными ответами
      fetchData()
      toast.success(row?.passed ? "Тест сдан" : "Тест завершён")
    } catch (error) {
      console.error("Error submitting attempt:", error)
      toast.error("Ошибка при отправке ответов")
    } finally {
      setSubmitting(false)
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

  if (!test || !attempt) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">Тест не найден</p>
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

  const finished = attempt.status === "completed"

  return (
    <div className="space-y-6">
      <Link href="/courses">
        <Button variant="ghost" className="pl-0">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Назад к обучению
        </Button>
      </Link>

      <div className="min-w-0">
        <h1 className="text-3xl font-bold break-words">{test.title}</h1>
        <p className="text-muted-foreground mt-1">
          Проходной балл: {test.pass_score}%
        </p>
      </div>

      {finished && result && (
        <Card className={result.passed ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}>
          <CardHeader className="flex flex-row items-center gap-3">
            {result.passed ? (
              <CheckCircle className="h-8 w-8 text-green-600" />
            ) : (
              <XCircle className="h-8 w-8 text-red-600" />
            )}
            <div>
              <CardTitle className={result.passed ? "text-green-800" : "text-red-800"}>
                {result.passed ? "Тест сдан" : "Тест не сдан"}
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                {result.score !== null ? `Оценка: ${result.score}% • ` : ""}
                Верно: {result.correct}/{result.total}
              </p>
            </div>
          </CardHeader>
        </Card>
      )}

      <Separator />

      <div className="space-y-4">
        {questions.map((q, i) => (
          <Card key={q.id}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                {i + 1}. {q.question_text}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {q.type === "text" ? (
                <textarea
                  className="w-full min-h-20 rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="Ваш ответ"
                  value={textAnswers[q.id] || ""}
                  disabled={finished}
                  onChange={(e) => setTextAnswers((p) => ({ ...p, [q.id]: e.target.value }))}
                />
              ) : (
                q.options.map((opt) => {
                  const checked = (selected[q.id] || []).includes(opt.id)
                  const showCorrect = finished && opt.is_correct
                  const showWrong = finished && checked && !opt.is_correct
                  return (
                    <label
                      key={opt.id}
                      className={`flex items-center gap-3 px-3 py-2 rounded-md border cursor-pointer hover:bg-muted ${
                        showCorrect ? "border-green-500 bg-green-50" : showWrong ? "border-red-500 bg-red-50" : ""
                      } ${finished ? "cursor-default" : ""}`}
                    >
                      <input
                        type={q.type === "multiple_choice" ? "checkbox" : "radio"}
                        name={q.id}
                        checked={checked}
                        disabled={finished}
                        onChange={() => toggleOption(q.id, opt.id, q.type === "multiple_choice")}
                      />
                      <span className="text-sm flex-1">{opt.text}</span>
                      {showCorrect && <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />}
                      {showWrong && <XCircle className="h-4 w-4 text-red-600 shrink-0" />}
                    </label>
                  )
                })
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {!finished && questions.length > 0 && (
        <Button onClick={submit} disabled={submitting} size="lg">
          {submitting ? "Отправка..." : "Завершить тест"}
        </Button>
      )}
    </div>
  )
}
