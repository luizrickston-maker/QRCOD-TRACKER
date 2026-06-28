import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { isAuthorizedAdmin } from '@/lib/auth'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const isAdminRoute = request.nextUrl.pathname.startsWith('/admin')
  const isLoginPage = request.nextUrl.pathname === '/admin/login'
  const isApiAdminRoute = request.nextUrl.pathname.startsWith('/api/admin')

  // Só é admin quem está autenticado E está na allowlist (ADMIN_EMAILS)
  const isAdmin = !!user && isAuthorizedAdmin(user.email)

  // Redireciona para login se não autorizado em rotas admin
  if (isAdminRoute && !isLoginPage && !isAdmin) {
    return NextResponse.redirect(new URL('/admin/login', request.url))
  }

  // Redireciona para dashboard se já autorizado e tenta acessar login
  if (isLoginPage && isAdmin) {
    return NextResponse.redirect(new URL('/admin/dashboard', request.url))
  }

  // Protege API routes de admin
  if (isApiAdminRoute && !isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*'],
}
