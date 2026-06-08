import { NextRequest, NextResponse } from 'next/server'

import { createAdminSupabase } from '@/lib/admin-supabase'

type PendingIdea = {
  id: string
  url?: string | null
  source_url?: string | null
  categories?: string[] | null
  tags?: string[] | null
}

type IdeaUpdate = Record<string, unknown>

function firstString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value !== 'string') continue
    const text = value.trim()
    if (text) return text
  }
  return ''
}

function pendingTags(tags: string[] | null | undefined, fallback: string[]) {
  const next = Array.from(new Set([...(tags ?? []), ...fallback].filter(Boolean)))
    .filter((tag) => tag !== '待分析')
  return next.length > 0 ? next : ['instagram']
}

function missingColumnName(error: unknown) {
  const message = typeof error === 'object' && error && 'message' in error
    ? String((error as { message?: unknown }).message ?? '')
    : String(error ?? '')

  if (!message.includes('schema cache') && !message.includes('Could not find')) return ''
  return message.match(/'([^']+)' column/)?.[1] ?? ''
}

async function updateIdeaWithFallback(ideaId: string, update: IdeaUpdate) {
  const supabase = createAdminSupabase()
  if (!supabase) throw new Error('Supabase admin 未設定')

  let payload = { ...update }
  let lastError: unknown = null

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const { error } = await supabase.from('ideas').update(payload).eq('id', ideaId)
    if (!error) return

    lastError = error
    const column = missingColumnName(error)
    if (!column) break

    const beforeKeys = Object.keys(payload).length
    delete payload[column]
    delete payload[`${column}s`]
    if (column.endsWith('s')) delete payload[column.slice(0, -1)]

    if (Object.keys(payload).length === beforeKeys || Object.keys(payload).length === 0) break
  }

  throw lastError
}

async function enrichOne(origin: string, idea: PendingIdea) {
  const url = firstString(idea.source_url, idea.url)
  if (!url) return { id: idea.id, skipped: true, reason: 'missing_url' }

  const autofillRes = await fetch(new URL('/api/autofill-link', origin), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
    cache: 'no-store',
  })

  if (!autofillRes.ok) {
    return { id: idea.id, skipped: true, reason: `autofill_${autofillRes.status}` }
  }

  const data = await autofillRes.json()
  const title = firstString(data.title, data.placeName, data.place_name, 'IG Reel 靈感')
  const description = firstString(data.desc, data.caption, data.metadataDescription, data.description)
  const country = firstString(data.country, data.region, 'HK')
  const placeName = firstString(data.placeName, data.place_name)
  const placeAddress = firstString(data.placeAddress, data.place_address)
  const shopHighlights = firstString(data.shopHighlights, data.shop_highlights)
  const image = firstString(data.image, data.image_url, data.thumbnail, data.thumbnail_url)
  const videoUrl = firstString(data.video_url, data.videoUrl, data.video, data.media_url, data.playback_url, data.hls_url)
  const categories = Array.from(new Set([...(Array.isArray(data.categories) ? data.categories : []), ...(idea.categories ?? [])].filter(Boolean)))

  const update: IdeaUpdate = {
    title,
    topic: firstString(data.topic, data.title, title),
    summary: description,
    description,
    script_hook: firstString(data.script_hook, data.hook),
    hook: firstString(data.hook),
    country,
    region: country,
    platform: firstString(data.platform, 'instagram'),
    tags: pendingTags(idea.tags, Array.isArray(data.tags) ? data.tags : []),
    categories,
    place_name: placeName,
    place_address: placeAddress,
    shop_highlights: shopHighlights,
    viral_potential: firstString(data.viral_potential, 'medium'),
    source_url: url,
    updated_at: new Date().toISOString(),
  }

  if (image) update.thumb = image
  if (videoUrl) update.video_url = videoUrl

  await updateIdeaWithFallback(idea.id, update)
  return { id: idea.id, enriched: true }
}

async function handleCron(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
    const querySecret = request.nextUrl.searchParams.get('secret')
    if (token !== cronSecret && querySecret !== cronSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const supabase = createAdminSupabase()
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase admin 未設定' }, { status: 500 })
  }

  const { data, error } = await supabase
    .from('ideas')
    .select('id,url,source_url,categories,tags')
    .contains('tags', ['待分析'])
    .order('created_at', { ascending: true })
    .limit(12)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const origin = request.nextUrl.origin
  const results = []
  for (const idea of (data ?? []) as PendingIdea[]) {
    try {
      results.push(await enrichOne(origin, idea))
    } catch (err) {
      results.push({
        id: idea.id,
        error: err instanceof Error ? err.message : 'Unknown error',
      })
    }
  }

  return NextResponse.json({
    checked: data?.length ?? 0,
    results,
  })
}

export async function GET(request: NextRequest) {
  return handleCron(request)
}

export async function POST(request: NextRequest) {
  return handleCron(request)
}
