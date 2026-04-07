import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SUPPORTED_TYPE_VALUES = new Set(['reel', 'blog', 'social'])
const SUPPORTED_COUNTRY_VALUES = new Set([
  'HK', 'TW', 'CN', 'JP', 'KR', 'SG', 'TH', 'MY', 'ID', 'VN', 'IN',
  'US', 'GB', 'AU', 'CA', 'FR', 'DE', 'OTHER',
])

function normalizeUrl(input: string) {
  const trimmed = input.trim()
  if (!trimmed) return ''
  return trimmed.startsWith('http://') || trimmed.startsWith('https://')
    ? trimmed
    : `https://${trimmed}`
}

function inferPlatform(hostname: string) {
  if (hostname.includes('instagram.com')) return 'instagram'
  if (hostname.includes('tiktok.com')) return 'tiktok'
  if (hostname.includes('xiaohongshu.com') || hostname.includes('xhslink.com')) return 'xiaohongshu'
  return 'web'
}

function inferType(platform: string) {
  if (platform === 'instagram' || platform === 'tiktok' || platform === 'xiaohongshu') return 'reel'
  return 'social'
}

function buildMetadataBlockedDesc(platform: string) {
  const platformLabel = platform === 'instagram'
    ? 'Instagram Reel'
    : platform === 'tiktok'
      ? 'TikTok'
      : platform === 'xiaohongshu'
        ? '小紅書'
        : '呢條連結'

  return `${platformLabel} 呢類連結經常攔截公開 metadata，所以目前未能直接讀到標題、描述或封面。建議你補一張截圖，或者手動寫一兩句內容重點，我先可以更準確判斷地區、題材同爆點。`
}

function extractMeta(html: string, key: string) {
  const regexes = [
    new RegExp(`<meta[^>]+property=["']${key}["'][^>]+content=["']([^"']+)["'][^>]*>`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${key}["'][^>]*>`, 'i'),
    new RegExp(`<meta[^>]+name=["']${key}["'][^>]+content=["']([^"']+)["'][^>]*>`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${key}["'][^>]*>`, 'i'),
  ]

  for (const regex of regexes) {
    const match = html.match(regex)
    if (match?.[1]) return decodeHtml(match[1])
  }

  return ''
}

function extractTitle(html: string) {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  return match?.[1] ? decodeHtml(match[1].trim()) : ''
}

function decodeHtml(text: string) {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim()
}

async function fetchMetadata(url: string) {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
        'Accept-Language': 'zh-HK,zh-TW;q=0.9,en;q=0.8',
      },
      redirect: 'follow',
      cache: 'no-store',
    })

    if (!res.ok) {
      return null
    }

    const html = await res.text()
    return {
      title: extractMeta(html, 'og:title') || extractMeta(html, 'twitter:title') || extractTitle(html),
      description: extractMeta(html, 'og:description') || extractMeta(html, 'twitter:description'),
      image: extractMeta(html, 'og:image') || extractMeta(html, 'twitter:image'),
    }
  } catch {
    return null
  }
}

async function inferFields(params: {
  url: string
  platform: string
  title: string
  description: string
}) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return null
  }

  const system = `You help enrich short-form content references for SOON Idea Collection.
Return only valid JSON:
{
  "country": "HK | TW | CN | JP | KR | SG | TH | MY | ID | VN | IN | US | GB | AU | CA | FR | DE | OTHER",
  "contentType": "reel | blog | social",
  "placeName": "shop / brand / venue name if any, else empty string",
  "placeAddress": "address / district / city if inferable, else empty string",
  "desc": "2-3 sentences in Traditional Chinese, concise, explaining what this content seems to be and why it may work for HK audience",
  "tags": ["food","travel","cafe","lifestyle","relationship","citywalk","microdrama","hook-heavy"]
}`

  const user = `URL: ${params.url}
Platform: ${params.platform}
Title: ${params.title || '(none)'}
Description: ${params.description || '(none)'}

Infer the most likely country/region and content type. If there is a place, shop, or brand, extract it.`

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 600,
    system,
    messages: [{ role: 'user', content: user }],
  })

  const text = response.content.find(block => block.type === 'text')
  const raw = text?.type === 'text' ? text.text : ''
  const jsonMatch = raw.match(/\{[\s\S]*\}/)
  if (!jsonMatch) return null

  const parsed = JSON.parse(jsonMatch[0])
  return {
    country: SUPPORTED_COUNTRY_VALUES.has(parsed.country) ? parsed.country : 'OTHER',
    contentType: SUPPORTED_TYPE_VALUES.has(parsed.contentType) ? parsed.contentType : inferType(params.platform),
    placeName: typeof parsed.placeName === 'string' ? parsed.placeName.trim() : '',
    placeAddress: typeof parsed.placeAddress === 'string' ? parsed.placeAddress.trim() : '',
    desc: typeof parsed.desc === 'string' ? parsed.desc.trim() : '',
    tags: Array.isArray(parsed.tags)
      ? parsed.tags.filter((tag: unknown) => typeof tag === 'string').map((tag: string) => tag.trim()).filter(Boolean).slice(0, 6)
      : [],
  }
}

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json()
    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'URL required' }, { status: 400 })
    }

    const normalizedUrl = normalizeUrl(url)
    const parsedUrl = new URL(normalizedUrl)
    const platform = inferPlatform(parsedUrl.hostname.replace('www.', ''))
    const metadata = await fetchMetadata(normalizedUrl)
    const metadataBlocked = !metadata?.title && !metadata?.description && !metadata?.image

    const aiFields = metadataBlocked
      ? null
      : await inferFields({
          url: normalizedUrl,
          platform,
          title: metadata?.title || '',
          description: metadata?.description || '',
        })

    const fallbackTags = platform === 'instagram' || platform === 'tiktok' || platform === 'xiaohongshu'
      ? ['reel', platform]
      : ['social']

    return NextResponse.json({
      url: normalizedUrl,
      platform,
      contentType: aiFields?.contentType || inferType(platform),
      country: aiFields?.country || '',
      placeName: aiFields?.placeName || '',
      placeAddress: aiFields?.placeAddress || '',
      desc: aiFields?.desc || metadata?.description || (metadataBlocked ? buildMetadataBlockedDesc(platform) : ''),
      tags: aiFields?.tags || fallbackTags,
      image: metadata?.image || '',
      title: metadata?.title || '',
      metadataDescription: metadata?.description || '',
      metadataBlocked,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
