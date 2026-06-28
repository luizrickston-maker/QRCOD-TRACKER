import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { isAuthorizedAdmin } from '@/lib/auth'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Ignorado em Server Components (read-only)
          }
        },
      },
    }
  )
}

// Retorna o usuário autenticado SE ele estiver na allowlist de admin.
// Caso contrário, retorna null. Use nas rotas /api/admin/* como
// defesa em profundidade (além do middleware).
export async function getAdminUser() {
  const auth = await createClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user || !isAuthorizedAdmin(user.email)) return null
  return user
}

// Cliente com service role (bypassa RLS) — apenas server-side
export function createServiceClient() {
  const { createClient: createSupabaseClient } = require('@supabase/supabase-js')
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}
