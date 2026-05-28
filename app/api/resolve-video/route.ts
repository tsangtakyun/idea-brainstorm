import { NextRequest, NextResponse } from 'next/server'
import { fetchLinkMetadata, normalizeLinkMetadataUrl } from '@/lib/linkMetadata'
import { resolveSocialVideo } from '@/lib/socialVideoResolver'

function normalizeUrl(input: string) {
  const trimmed = input.trim()
  if (!trimmed) return ''
  const url = trimmed.startsWith('http://') || trimmed.startsWith('https://')
    ? trimmed
    : `https://${trimmed}`
  return normalizeLinkMetadataUrl(url)
}

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json()
    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'URL required' }, { status: 400 })
    }

    const normalizedUrl = normalizeUrl(url)
    const [metadata, resolved] = await Promise.all([
      fetchLinkMetadata(normalizedUrl),
      resolveSocialVideo(normalizedUrl),
    ])
    const image = resolved?.image || resolved?.thumbnail || metadata?.image || ''
    const video = resolved?.videoUrl || metadata?.video || ''

    return NextResponse.json({
      url: normalizedUrl,
      title: resolved?.title || metadata?.title || '',
      description: resolved?.description || metadata?.caption || metadata?.description || '',
      caption: metadata?.caption || '',
      image,
      thumbnail: image,
      thumbnail_url: image,
      video_url: video,
      videoUrl: video,
      media_url: video,
      playback_url: video,
      hls_url: video,
      placeName: resolved?.placeName || '',
      placeAddress: resolved?.placeAddress || '',
      country: resolved?.country || '',
      metadataBlocked: metadata?.metadataBlocked || false,
      metadataSource: metadata?.source || '',
      provider: resolved?.provider || '',
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
