import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321'
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'build-placeholder-key'
  return createBrowserClient(url, key)
}
