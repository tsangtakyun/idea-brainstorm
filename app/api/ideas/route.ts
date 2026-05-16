import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { createAdminSupabase } from '@/lib/admin-supabase'

export async function GET(_request: NextRequest) {
  const cookieStore = await cookies()
  const authSupabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    }
  )

  const { data: { user }, error: authError } = await authSupabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: '未登入' }, { status: 401 })
  }

  const supabase = createAdminSupabase()
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase admin 未設定' }, { status: 500 })
  }

  const { data, error } = await supabase
    .from('ideas')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ideas: data ?? [] })
}
