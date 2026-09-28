"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Building2, Loader2, LogIn } from "lucide-react"
import { toast } from "sonner"

const highlights = [
  "База знаний и регламенты",
  "Обучение и аттестация",
  "Чек-листы точек и задачи",
  "ИИ-помощник по базе знаний",
]

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        throw error
      }

      if (data.user) {
        toast.success("Вход выполнен успешно")
        router.push("/dashboard")
        router.refresh()
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Ошибка входа"
      setError(message)
      toast.error("Ошибка входа")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 p-4 sm:p-6">
      <div aria-hidden className="absolute -right-32 -top-32 h-[420px] w-[420px] rounded-full bg-blue-600/25 blur-3xl" />
      <div aria-hidden className="absolute -bottom-40 -left-32 h-[420px] w-[420px] rounded-full bg-cyan-500/15 blur-3xl" />
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.15]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, rgba(148,163,184,0.35) 1px, transparent 0)",
          backgroundSize: "28px 28px",
        }}
      />

      <div className="relative z-10 grid w-full max-w-4xl overflow-hidden rounded-2xl border border-white/10 bg-slate-900/60 shadow-2xl shadow-blue-950/40 backdrop-blur md:grid-cols-5">
        {/* Brand panel */}
        <div className="relative hidden flex-col justify-between bg-gradient-to-br from-blue-600 to-blue-800 p-10 md:col-span-2 md:flex">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15">
              <Building2 className="h-6 w-6 text-white" />
            </div>
            <div className="leading-tight">
              <p className="text-lg font-semibold text-white">МКК ФК</p>
              <p className="text-xs text-blue-200">Корпоративный портал</p>
            </div>
          </div>

          <div>
            <h2 className="text-2xl font-bold leading-snug text-white">
              Всё о работе компании — в одном месте
            </h2>
            <ul className="mt-6 space-y-3">
              {highlights.map((h) => (
                <li key={h} className="flex items-center gap-3 text-sm text-blue-100">
                  <span className="h-1.5 w-1.5 rounded-full bg-cyan-300" />
                  {h}
                </li>
              ))}
            </ul>
          </div>

          <p className="text-[11px] text-blue-300/70">
            Доступы выдаёт IT-отдел
          </p>
        </div>

        {/* Form panel */}
        <div className="bg-white p-8 md:col-span-3 sm:p-10">
          <div className="mb-8 flex items-center gap-3 md:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-700">
              <Building2 className="h-5 w-5 text-white" />
            </div>
            <div className="leading-tight">
              <p className="font-semibold text-slate-900">Портал МКК ФК</p>
              <p className="text-xs text-slate-500">Внутренний портал сотрудников</p>
            </div>
          </div>

          <h1 className="text-2xl font-bold text-slate-900">Вход в портал</h1>
          <p className="mt-1 text-sm text-slate-500">
            Используйте корпоративный email
          </p>

          <form onSubmit={handleLogin} className="mt-8 space-y-5">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="name@company.ru"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Пароль</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-11"
              />
            </div>
            <Button type="submit" className="h-11 w-full gap-2" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Вход...
                </>
              ) : (
                <>
                  <LogIn className="h-4 w-4" />
                  Войти
                </>
              )}
            </Button>
            <p className="text-center text-sm text-slate-500">
              Нет аккаунта? Обратитесь к администратору
            </p>
          </form>
        </div>
      </div>
    </div>
  )
}
