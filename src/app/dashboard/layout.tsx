import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Sidebar } from "@/components/sidebar"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  // Get user profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single()

  return (
    <div className="flex h-screen">
      <aside className="w-64 hidden md:block">
        <Sidebar user={profile} />
      </aside>
      <main className="flex-1 overflow-auto">
        <div className="md:hidden h-16 border-b flex items-center px-4">
          <span className="font-semibold">МКК ФК Портал</span>
        </div>
        <div className="p-6">{children}</div>
      </main>
    </div>
  )
}
