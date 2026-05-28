import { NextRequest, NextResponse } from 'next/server'
import { fetchLinkMetadata } from '@/lib/linkMetadata'

function normalizeUrl(input: string) {
  const trimmed = input.trim()
  if (!trimmed) return ''
  return trimmed.startsWith('http://') || trimmed.startsWith('https://')
    ? trimmed
    : `https://${trimmed}`
}

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json()
    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'URL required' }, { status: 400 })
    }

    const normalizedUrl = normalizeUrl(url)
    const metadata = await fetchLinkMetadata(normalizedUrl)

    return NextResponse.json({
      url: normalizedUrl,
      title: metadata?.title || '',
      description: metadata?.description || '',
      image: metadata?.image || '',
      thumbnail: metadata?.image || '',
      thumbnail_url: metadata?.image || '',
      video_url: metadata?.video || '',
      videoUrl: metadata?.video || '',
      media_url: metadata?.video || '',
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
