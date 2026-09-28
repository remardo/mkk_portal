import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"
import { randomBytes } from "crypto"
import { z } from "zod"

const RoleEnum = z.enum([
  "agent",
  "branch_manager",
  "ops_manager",
  "director",
  "security",
  "accountant",
  "it_admin",
  "hr",
])

const BodySchema = z.object({
  full_name: z.string().trim().min(1).max(200),
  email: z.string().trim().email().max(254),
  phone: z.string().trim().max(40).optional(),
  role: RoleEnum,
  branch_id: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? null : v),
    z.string().uuid().nullable().optional()
  ),
})

type NormalizedBody = {
  full_name: string
  email: string
  phone?: string
  role: z.infer<typeof RoleEnum>
  branch_id: string | null
}

function normalizeBody(value: z.infer<typeof BodySchema>): NormalizedBody {
  return {
    full_name: value.full_name,
    email: value.email,
    phone:
      typeof value.phone === "string" && value.phone.trim() !== ""
        ? value.phone
        : undefined,
    role: value.role,
    branch_id: value.branch_id ?? null,
  }
}

function isAllowedOrigin(req: NextRequest): boolean {
  const origin = req.headers.get("origin")
  if (!origin) return true
  if (origin === req.nextUrl.origin) return true
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  if (appUrl && (origin === appUrl || origin === appUrl.replace(/\/$/, ""))) {
    return true
  }
  return false
}

function isDuplicateEmailMessage(message: string): boolean {
  const m = message.toLowerCase()
  return (
    m.includes("already") ||
    m.includes("duplicate") ||
    m.includes("exists") ||
    m.includes("unique") ||
    m.includes("registered")
  )
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role,is_active")
    .eq("id", user.id)
    .single()

  if (!profile || profile.role !== "it_admin" || profile.is_active !== true) {
    return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 })
  }

  if (!isAllowedOrigin(req)) {
    return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 })
  }

  let rawBody: unknown
  try {
    rawBody = await req.json()
  } catch {
    return NextResponse.json({ error: "Некорректные данные" }, { status: 400 })
  }

  const parsed = BodySchema.safeParse(rawBody)
  if (!parsed.success) {
    return NextResponse.json({ error: "Некорректные данные" }, { status: 400 })
  }
  const body = normalizeBody(parsed.data)

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json(
      { error: "Сервис временно недоступен" },
      { status: 503 }
    )
  }

  const service = createServiceClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  if (body.branch_id) {
    const { data: branch } = await service
      .from("branches")
      .select("id,is_active")
      .eq("id", body.branch_id)
      .single()
    if (!branch || branch.is_active !== true) {
      return NextResponse.json({ error: "Некорректные данные" }, { status: 400 })
    }
  }

  const temporary_password = randomBytes(18).toString("base64url") + "A1!"

  const { data: created, error: createError } =
    await service.auth.admin.createUser({
      email: body.email,
      password: temporary_password,
      email_confirm: true,
      user_metadata: { full_name: body.full_name },
    })

  if (createError || !created?.user) {
    const message = createError?.message ?? ""
    if (message && isDuplicateEmailMessage(message)) {
      return NextResponse.json(
        { error: "Пользователь с таким email уже существует" },
        { status: 409 }
      )
    }
    console.error("Admin create user failed")
    return NextResponse.json(
      { error: "Не удалось создать пользователя" },
      { status: 502 }
    )
  }

  const newUserId = created.user.id

  const { data: updatedProfile, error: profileError } = await service
    .from("profiles")
    .update({
      full_name: body.full_name,
      email: body.email,
      phone: body.phone ?? null,
      role: body.role,
      branch_id: body.branch_id,
    })
    .eq("id", newUserId)
    .select("id")
    .single()

  if (profileError || !updatedProfile) {
    await service.auth.admin.deleteUser(newUserId)
    console.error("Admin create user profile update failed")
    return NextResponse.json(
      { error: "Не удалось создать пользователя" },
      { status: 502 }
    )
  }

  return NextResponse.json(
    { user: { id: newUserId }, temporary_password },
    { status: 201, headers: { "Cache-Control": "no-store" } }
  )
}
