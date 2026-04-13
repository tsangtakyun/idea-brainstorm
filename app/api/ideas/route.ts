import { NextResponse } from 'next/server'

import { createAdminSupabase } from '@/lib/admin-supabase'

export async function GET() {
  const supabase = createAdminSupabase()
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase admin 未設定' }, { status: 500 })
  }

  const { data, error } = await supabase
    .from('ideas')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ideas: data ?? [] })
}
