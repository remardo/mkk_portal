import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Sidebar } from "@/components/sidebar"
import { MobileNav } from "@/components/mobile-nav"

export const dynamic = "force-dynamic"
export const revalidate = 0

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single()

  if (!profile || profile.is_active !== true) {
    redirect("/login")
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <MobileNav user={profile} />
      <div className="lg:flex">
        <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 md:block">
          <Sidebar user={profile} />
        </aside>
        <div className="min-h-screen w-full lg:pl-72">
          <main className="pt-14 md:pt-0">
            <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}
