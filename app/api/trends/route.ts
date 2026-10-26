import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

import { createAdminSupabase } from '@/lib/admin-supabase'

type CreateTrendBody = {
  topic?: unknown
  category?: unknown
  angles?: unknown
}

const categorySet = new Set(['news', 'finance', 'tech', 'life', 'sports', 'gaming', 'anime', 'entertainment'])

async function getRequestUser(request: NextRequest) {
  const bearerToken = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!bearerToken) return { user: null, error: new Error('Missing token') }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const { data, error } = await supabase.auth.getUser(bearerToken)
  return { user: data.user, error }
}

function cleanText(value: unknown, maxLength: number) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : ''
}

function normalizeAngles(value: unknown) {
  const raw = Array.isArray(value) ? value : []
  const names = raw.map((item) => cleanText(item, 28)).filter(Boolean).slice(0, 4)
  const safeNames = names.length >= 2 ? names : ['會爆', '未必']
  const percentage = Math.floor(100 / safeNames.length)
  let remainder = 100 - percentage * safeNames.length

  return safeNames.map((name, index) => {
    const extra = remainder > 0 ? 1 : 0
    remainder -= extra
    return {
      emoji: ['🔥', '👀', '💬', '⚡'][index] ?? '💬',
      name,
      percentage: percentage + extra,
    }
  })
}

export async function POST(request: NextRequest) {
  const { user, error: authError } = await getRequestUser(request)
  if (authError || !user) {
    return NextResponse.json({ error: '請先登入' }, { status: 401 })
  }

  const supabase = createAdminSupabase()
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase admin 未設定' }, { status: 500 })
  }

  const body = await request.json() as CreateTrendBody
  const topic = cleanText(body.topic, 80)
  const category = categorySet.has(cleanText(body.category, 32)) ? cleanText(body.category, 32) : 'life'
  const angles = normalizeAngles(body.angles)

  if (topic.length < 4) {
    return NextResponse.json({ error: 'Topic 至少需要 4 個字' }, { status: 400 })
  }

  const deadlineAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  const fullPayload = {
    topic,
    icon: '💬',
    category,
    heat_score: 0,
    angles,
    is_active: true,
    deadline_at: deadlineAt,
    deadline_timezone: 'Asia/Hong_Kong',
    news_headlines: [],
    created_by: user.id,
    source: 'user',
  }

  const { data, error } = await supabase
    .from('trends')
    .insert(fullPayload)
    .select('*')
    .single()

  if (!error) {
    return NextResponse.json({ trend: data })
  }

  const fallbackPayload = {
    topic,
    icon: '💬',
    heat_score: 0,
    angles,
    is_active: true,
  }

  const { data: fallbackData, error: fallbackError } = await supabase
    .from('trends')
    .insert(fallbackPayload)
    .select('*')
    .single()

  if (fallbackError) {
    return NextResponse.json({ error: fallbackError.message }, { status: 500 })
  }

  return NextResponse.json({ trend: fallbackData, warning: error.message })
}
