import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value,
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value,
            ...options,
          })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value: '',
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value: '',
            ...options,
          })
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname
  const isRoute = (route: string) => pathname === route || pathname.startsWith(route + '/')

  // Protected routes
  const protectedRoutes = ['/dashboard', '/knowledge', '/documents', '/courses', '/checklists', '/tasks', '/news', '/chat', '/admin', '/profile', '/contacts', '/ai-assistant']
  const isProtectedRoute = protectedRoutes.some(isRoute)

  if (isProtectedRoute && !user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // /admin: только it_admin и director
  if (user && isRoute('/admin')) {
    const { data: adminProfile } = await supabase
      .from('profiles')
      .select('role,is_active')
      .eq('id', user.id)
      .single()
    if (!adminProfile || adminProfile.is_active !== true || !['it_admin', 'director'].includes(adminProfile.role)) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  // Deactivate redirect loop: inactive or missing profile must not stay authenticated.
  // Sign out and send to /login instead of bouncing dashboard <-> login.
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_active')
      .eq('id', user.id)
      .single()
    if (!profile || profile.is_active !== true) {
      await supabase.auth.signOut()
      if (request.nextUrl.pathname !== '/login') {
        const redirectResponse = NextResponse.redirect(new URL('/login', request.url))
        // Propagate cleared auth cookies so the browser actually signs out
        // and does not bounce between /dashboard and /login.
        response.cookies.getAll().forEach((c) => {
          redirectResponse.cookies.set(c.name, c.value, c as unknown as CookieOptions)
        })
        return redirectResponse
      }
      return response
    }
  }

  // Redirect authenticated users from auth pages
  const authRoutes = ['/login', '/register']
  const isAuthRoute = authRoutes.some(route => pathname === route || pathname === route + '/')

  if (isAuthRoute && user) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
