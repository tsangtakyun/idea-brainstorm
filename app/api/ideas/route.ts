import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { createAdminSupabase } from '@/lib/admin-supabase'

async function getRequestUser(request: NextRequest) {
  const cookieStore = await cookies()
  const bearerToken = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')

  if (bearerToken) {
    return createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    ).auth.getUser(bearerToken)
  }

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

  return authSupabase.auth.getUser()
}

export async function GET(request: NextRequest) {
  const { data: { user }, error: authError } = await getRequestUser(request)

  if (authError || !user) {
    return NextResponse.json({ error: '請先登入' }, { status: 401 })
  }

  const supabase = createAdminSupabase()
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase admin 未設定' }, { status: 500 })
  }

  const workspaceId = request.nextUrl.searchParams.get('workspace_id')
  let query = supabase
    .from('ideas')
    .select('*')
    .eq('user_id', user.id)

  if (workspaceId) query = query.eq('workspace_id', workspaceId)

  const { data, error } = await query.order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ideas: data ?? [] })
}

export async function POST(request: NextRequest) {
  const { data: { user }, error: authError } = await getRequestUser(request)

  if (authError || !user) {
    return NextResponse.json({ error: '請先登入' }, { status: 401 })
  }

  const supabase = createAdminSupabase()
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase admin 未設定' }, { status: 500 })
  }

  const idea = await request.json()
  const { data, error } = await supabase
    .from('ideas')
    .insert({
      user_id: user.id,
      workspace_id: idea.workspace_id || null,
      type: idea.type,
      url: idea.url,
      thumb: idea.thumb,
      views: idea.views,
      likes: idea.likes,
      shares: idea.shares,
      country: idea.country,
      date: idea.date,
      title: idea.title,
      topic: idea.topic,
      summary: idea.summary,
      tags: idea.tags,
      viral_score: idea.viralScore,
      ai_viral_base: idea.aiViralBase || 50,
      script_hook: idea.scriptHook,
      lat: idea.lat ?? null,
      lng: idea.lng ?? null,
      notes: idea.notes ?? null,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ idea: data })
}
