import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { fetchLinkMetadata, normalizeLinkMetadataUrl } from '@/lib/linkMetadata'
import { resolveSocialVideo } from '@/lib/socialVideoResolver'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SUPPORTED_TYPE_VALUES = new Set(['reel', 'blog', 'social'])
const SUPPORTED_COUNTRY_VALUES = new Set([
  'HK', 'TW', 'CN', 'JP', 'KR', 'SG', 'TH', 'MY', 'ID', 'VN', 'IN',
  'US', 'GB', 'AU', 'CA', 'FR', 'DE', 'OTHER',
])

function normalizeUrl(input: string) {
  const trimmed = input.trim()
  if (!trimmed) return ''
  const url = trimmed.startsWith('http://') || trimmed.startsWith('https://')
    ? trimmed
    : `https://${trimmed}`
  return normalizeLinkMetadataUrl(url)
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

function normalizeSharedCaption(value: unknown) {
  if (typeof value !== 'string') return ''
  const text = value.trim()
  if (!text || /^https?:\/\/\S+$/i.test(text)) return ''
  if (text.length < 8) return ''
  return text.slice(0, 4000)
}

function isGenericSocialTitle(value: string) {
  const text = value.trim().toLowerCase()
  return !text ||
    text === 'instagram' ||
    text === 'instagram reel' ||
    text === 'instagram reels' ||
    text === 'tiktok' ||
    text === 'xiaohongshu'
}

function cleanDisplayTitle(value: string, platform: string, caption: string) {
  const title = value
    .split(/\s+(?:on|在)\s+Instagram\s*:/i)[0]
    ?.replace(/\s+(?:on|在)\s+Instagram$/i, '')
    .trim() || ''

  if (title && !isGenericSocialTitle(title)) return title

  const captionLead = caption
    .split('\n')
    .map(line => line.trim())
    .find(Boolean)

  if (captionLead && !/^https?:\/\//i.test(captionLead)) {
    return captionLead.slice(0, 80)
  }

  if (platform === 'instagram') return 'Instagram Reel 靈感'
  if (platform === 'tiktok') return 'TikTok 靈感'
  if (platform === 'xiaohongshu') return '小紅書靈感'
  return ''
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
  "ideaTitle": "short creator-friendly title in Traditional Chinese, 8-20 characters, not a generic platform name",
  "country": "HK | TW | CN | JP | KR | SG | TH | MY | ID | VN | IN | US | GB | AU | CA | FR | DE | OTHER",
  "contentType": "reel | blog | social",
  "placeName": "exact shop / restaurant / cafe / hotel / attraction / event official name if any, else empty string",
  "locationName": "broad location tag, city, district, region, railway line, or landmark area if inferable, else empty string",
  "placeAddress": "precise street address if present, else empty string",
  "shopHighlights": "if this is a food/drink/place business, 1-2 concise Traditional Chinese sentences about famous dishes, must-try items, signature products, or what it is known for; else empty string",
  "desc": "2-3 sentences in Traditional Chinese, concise, explaining what this content seems to be and why it may work for HK audience",
  "tags": ["food","travel","cafe","lifestyle","relationship","citywalk","microdrama","hook-heavy"]
}`

  const user = `URL: ${params.url}
Platform: ${params.platform}
Title: ${params.title || '(none)'}
Description: ${params.description || '(none)'}

The description may be a full Instagram/TikTok/Xiaohongshu caption with mixed languages, hashtags, address, business hours, station information, phone numbers, menu items, and prices.

Infer the most likely country/region and content type.
Important distinction:
- ideaTitle is the creator-facing idea title. It should summarize the content idea naturally, e.g. "日本食物模型列車靈感", not just copy an account name or "Instagram".
- placeName is only for an exact visitable venue/business/attraction/event official name.
- locationName is for a broad location tag, city, district, region, railway line, or nearby area.
- If the caption is about a transport line, city, region, or themed experience and there is no exact shop/venue address, keep placeName empty, put the area/line in locationName, and write a useful ideaTitle.
If there is a restaurant, cafe, shop, venue, brand, hotel, attraction, or event:
- placeName must be the official name from the caption when possible, not just "Instagram".
- placeAddress should copy only the most precise street address found in the caption. Do not invent an address.
- shopHighlights should say what the place is famous for or what viewers should try. Prefer facts from caption/metadata; if placeName is specific enough, use web search to verify signature dishes/items. Do not invent details if uncertain.
- desc should summarize the actual content in Traditional Chinese for a Hong Kong creator, not say metadata is missing if the description contains caption text.
- tags should describe the content and location, using short lowercase tags.`

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 850,
    tools: [{ type: 'web_search_20250305', name: 'web_search' } as any],
    system,
    messages: [{ role: 'user', content: user }],
  })

  const text = response.content.find(block => block.type === 'text')
  const raw = text?.type === 'text' ? text.text : ''
  const jsonMatch = raw.match(/\{[\s\S]*\}/)
  if (!jsonMatch) return null

  const parsed = JSON.parse(jsonMatch[0])
  return {
    ideaTitle: typeof parsed.ideaTitle === 'string' ? parsed.ideaTitle.trim() : '',
    country: SUPPORTED_COUNTRY_VALUES.has(parsed.country) ? parsed.country : 'OTHER',
    contentType: SUPPORTED_TYPE_VALUES.has(parsed.contentType) ? parsed.contentType : inferType(params.platform),
    placeName: typeof parsed.placeName === 'string' ? parsed.placeName.trim() : '',
    locationName: typeof parsed.locationName === 'string' ? parsed.locationName.trim() : '',
    placeAddress: typeof parsed.placeAddress === 'string' ? parsed.placeAddress.trim() : '',
    shopHighlights: typeof parsed.shopHighlights === 'string' ? parsed.shopHighlights.trim() : '',
    desc: typeof parsed.desc === 'string' ? parsed.desc.trim() : '',
    tags: Array.isArray(parsed.tags)
      ? parsed.tags.filter((tag: unknown) => typeof tag === 'string').map((tag: string) => tag.trim()).filter(Boolean).slice(0, 6)
      : [],
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { url } = body
    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'URL required' }, { status: 400 })
    }
    const sharedCaption = normalizeSharedCaption(body.caption ?? body.sharedText ?? body.text)

    const normalizedUrl = normalizeUrl(url)
    const parsedUrl = new URL(normalizedUrl)
    const platform = inferPlatform(parsedUrl.hostname.replace('www.', ''))
    const [metadata, resolved] = await Promise.all([
      fetchLinkMetadata(normalizedUrl),
      resolveSocialVideo(normalizedUrl),
    ])
    const metadataCaption = metadata?.caption || metadata?.description || ''
    const description = sharedCaption || resolved?.description || metadataCaption || ''
    const rawTitle = resolved?.title || metadata?.title || ''
    const title = cleanDisplayTitle(rawTitle, platform, description)
    const image = resolved?.image || resolved?.thumbnail || metadata?.image || ''
    const video = resolved?.videoUrl || metadata?.video || ''
    const metadataBlocked = metadata?.metadataBlocked ?? (!rawTitle && !description && !image)
    const effectiveMetadataBlocked = metadataBlocked && !sharedCaption

    const aiFields = effectiveMetadataBlocked
      ? null
      : await inferFields({
          url: normalizedUrl,
          platform,
          title,
          description,
        })

    const fallbackTags = platform === 'instagram' || platform === 'tiktok' || platform === 'xiaohongshu'
      ? ['reel', platform]
      : ['social']

    return NextResponse.json({
      url: normalizedUrl,
      platform,
      contentType: aiFields?.contentType || inferType(platform),
      country: aiFields?.country || resolved?.country || '',
      placeName: aiFields?.placeName || resolved?.placeName || '',
      locationName: aiFields?.locationName || '',
      placeAddress: aiFields?.placeAddress || resolved?.placeAddress || aiFields?.locationName || '',
      shopHighlights: aiFields?.shopHighlights || '',
      shop_highlights: aiFields?.shopHighlights || '',
      desc: aiFields?.desc || description || (effectiveMetadataBlocked ? buildMetadataBlockedDesc(platform) : ''),
      tags: aiFields?.tags || fallbackTags,
      image,
      video_url: video,
      videoUrl: video,
      media_url: video,
      playback_url: video,
      hls_url: video,
      thumbnail: image,
      thumbnail_url: image,
      title: aiFields?.ideaTitle || aiFields?.placeName || title || (isGenericSocialTitle(rawTitle) ? '' : rawTitle),
      caption: sharedCaption || metadata?.caption || '',
      metadataDescription: description,
      metadataBlocked: effectiveMetadataBlocked,
      metadataSource: metadata?.source || '',
      provider: resolved?.provider || '',
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
