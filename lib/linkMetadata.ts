export type LinkMetadata = {
  title: string
  description: string
  caption?: string
  image: string
  video: string
  metadataBlocked?: boolean
  source?: string
  url?: string
}

const HTML_ENTITIES: Record<string, string> = {
  amp: '&',
  quot: '"',
  apos: "'",
  lt: '<',
  gt: '>',
  nbsp: ' ',
  ndash: '–',
  mdash: '—',
  hellip: '…',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
}

function decodeHtmlEntity(entity: string) {
  if (entity.startsWith('#x') || entity.startsWith('#X')) {
    const codePoint = Number.parseInt(entity.slice(2), 16)
    return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : `&${entity};`
  }

  if (entity.startsWith('#')) {
    const codePoint = Number.parseInt(entity.slice(1), 10)
    return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : `&${entity};`
  }

  return HTML_ENTITIES[entity] ?? `&${entity};`
}

function decodeHtml(text: string) {
  let output = text

  for (let i = 0; i < 3; i += 1) {
    const next = output.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z][a-zA-Z0-9]+);/g, (_, entity) =>
      decodeHtmlEntity(entity),
    )
    if (next === output) break
    output = next
  }

  return output.trim()
}

function normalizePlainText(text: string) {
  return decodeHtml(text).replace(/[ \t\f\v]+/g, ' ').trim()
}

function normalizeCaptionText(text: string) {
  return decodeHtml(text)
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t\f\v]+/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

type FetchAttempt = {
  source: string
  userAgent: string
}

type CachedMetadataRow = {
  metadata?: LinkMetadata
  expires_at?: string
}

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000

const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36'

const INSTAGRAM_USER_AGENTS: FetchAttempt[] = [
  {
    source: 'facebookexternalhit',
    userAgent: 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
  },
  {
    source: 'mobile-safari',
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1',
  },
  {
    source: 'desktop-chrome',
    userAgent: DEFAULT_USER_AGENT,
  },
]

function isInstagramUrl(url: string) {
  try {
    const parsed = new URL(url)
    return parsed.hostname.replace(/^www\./, '').endsWith('instagram.com')
  } catch {
    return false
  }
}

export function normalizeLinkMetadataUrl(input: string) {
  const trimmed = input.trim()
  const withProtocol = trimmed.startsWith('http://') || trimmed.startsWith('https://')
    ? trimmed
    : `https://${trimmed}`

  try {
    const parsed = new URL(withProtocol)
    const hostname = parsed.hostname.replace(/^www\./, '')
    const match = parsed.pathname.match(/^\/(reel|p|tv)\/([^/?#]+)/i)

    if (hostname.endsWith('instagram.com') && match) {
      return `https://www.instagram.com/${match[1].toLowerCase()}/${match[2]}/`
    }

    parsed.hash = ''
    return parsed.toString()
  } catch {
    return withProtocol
  }
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

function decodeJsString(value: string) {
  try {
    return JSON.parse(`"${value.replace(/"/g, '\\"')}"`)
  } catch {
    return value
      .replace(/\\"/g, '"')
      .replace(/\\n/g, '\n')
      .replace(/\\u0026/g, '&')
      .replace(/\\\//g, '/')
  }
}

function extractQuotedText(text: string) {
  const straight = text.match(/"([\s\S]*?)"/)
  if (straight?.[1]) return straight[1]

  const curly = text.match(/[“「]([\s\S]*?)[”」]/)
  if (curly?.[1]) return curly[1]

  return text
}

function stripInstagramPrefix(text: string) {
  return text
    .replace(
      /^\s*[\d,.]+\s*(?:K|M|B|萬|万|億|亿|千|百)?\s+likes?,\s*[\d,.]+\s*(?:K|M|B|萬|万|億|亿|千|百)?\s+comments?\s*-\s*.*?:\s*/i,
      '',
    )
    .replace(
      /^\s*[\d,.]+\s*(?:K|M|B|萬|万|億|亿|千|百)?\s+likes?,\s*[\d,.]+\s*(?:K|M|B|萬|万|億|亿|千|百)?\s+comments?\s*-\s*/i,
      '',
    )
    .replace(/^\s*Instagram\s*:\s*/i, '')
}

function cleanInstagramCaption(description: string) {
  const decoded = decodeHtml(description)
  const withoutPrefix = stripInstagramPrefix(decoded)
  const quoted = extractQuotedText(withoutPrefix)

  return normalizeCaptionText(quoted.replace(/\s*View all comments\s*$/i, ''))
}

function cleanInstagramTitle(rawTitle: string, caption = '') {
  const decoded = normalizePlainText(rawTitle)
  const titleBeforeInstagram = decoded.split(/\s+(?:on|在)\s+Instagram\s*:/i)[0]?.trim() || ''
  const withoutSuffix = titleBeforeInstagram
    .replace(/\s+(?:on|在)\s+Instagram$/i, '')
    .trim()

  if (withoutSuffix && !/^instagram$/i.test(withoutSuffix)) return withoutSuffix

  const firstCaptionLine = normalizeCaptionText(caption)
    .split('\n')
    .map(line => line.trim())
    .find(Boolean)

  return firstCaptionLine || decoded
}

function normalizeMetadata(metadata: LinkMetadata): LinkMetadata {
  const caption = metadata.caption ? normalizeCaptionText(metadata.caption) : ''
  const description = metadata.description ? normalizeCaptionText(metadata.description) : ''
  const normalizedUrl = metadata.url ? normalizeLinkMetadataUrl(metadata.url) : metadata.url
  const isInstagram = normalizedUrl ? isInstagramUrl(normalizedUrl) : false
  const title = isInstagram
    ? cleanInstagramTitle(metadata.title, caption || description)
    : normalizePlainText(metadata.title)

  return {
    ...metadata,
    title,
    description,
    caption,
    image: metadata.image ? decodeHtml(metadata.image) : '',
    video: metadata.video ? decodeHtml(metadata.video) : '',
    url: normalizedUrl,
  }
}

function extractInlineInstagramCaption(html: string) {
  const decodedHtml = decodeHtml(html)
  const patterns = [
    /"edge_media_to_caption"\s*:\s*\{[\s\S]{0,3000}?"text"\s*:\s*"((?:\\.|[^"\\])*)"/i,
    /"caption"\s*:\s*"((?:\\.|[^"\\])*)"/i,
    /"accessibility_caption"\s*:\s*"((?:\\.|[^"\\])*)"/i,
  ]

  for (const pattern of patterns) {
    const match = decodedHtml.match(pattern)
    if (match?.[1]) {
      const caption = normalizeCaptionText(decodeJsString(match[1]))
      if (caption) return caption
    }
  }

  return ''
}

function isOnlyHashtags(text: string) {
  const withoutHashtags = text
    .replace(/#[\p{L}\p{N}_]+/gu, '')
    .replace(/[.,，。!！?？:：;；\-–—_\s]/g, '')
  return withoutHashtags.length === 0
}

function isMeaningfulDescription(text: string) {
  const cleaned = text.trim()
  if (!cleaned) return false
  if (/^instagram$/i.test(cleaned)) return false
  if (/^instagram\s+(reel|post|photo|video)$/i.test(cleaned)) return false
  if (isOnlyHashtags(cleaned)) return false
  return true
}

function parseMetadataFromHtml(html: string, source = 'default', url?: string): LinkMetadata {
  const rawDescription = extractMeta(html, 'og:description') || extractMeta(html, 'twitter:description')
  const isInstagram = url ? isInstagramUrl(url) : false
  const inlineCaption = isInstagram ? extractInlineInstagramCaption(html) : ''
  const cleanedCaption = isInstagram && rawDescription ? cleanInstagramCaption(rawDescription) : ''
  const caption = inlineCaption || cleanedCaption
  const description = caption || rawDescription
  const metadataBlocked = isInstagram && !isMeaningfulDescription(description)
  const rawTitle = extractMeta(html, 'og:title') || extractMeta(html, 'twitter:title') || extractTitle(html)

  return normalizeMetadata({
    title: isInstagram ? cleanInstagramTitle(rawTitle, caption) : rawTitle,
    description: metadataBlocked ? '' : description,
    caption: metadataBlocked ? '' : caption,
    image: extractMeta(html, 'og:image') || extractMeta(html, 'twitter:image'),
    video: extractVideo(html),
    metadataBlocked,
    source,
    url,
  })
}

function extractTitle(html: string) {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  return match?.[1] ? decodeHtml(match[1].trim()) : ''
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function findVideoInJsonLd(value: unknown): string {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findVideoInJsonLd(item)
      if (found) return found
    }
    return ''
  }

  if (!isRecord(value)) return ''

  const typeValue = value['@type']
  const typeText = Array.isArray(typeValue) ? typeValue.join(' ') : String(typeValue ?? '')
  const looksLikeVideo = /video/i.test(typeText)
  const directVideo = String(value.contentUrl || value.embedUrl || value.url || '')

  if (looksLikeVideo && directVideo) return directVideo

  for (const item of Object.values(value)) {
    const found = findVideoInJsonLd(item)
    if (found) return found
  }

  return ''
}

function extractJsonLdVideo(html: string) {
  const matches = html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)

  for (const match of matches) {
    try {
      const parsed = JSON.parse(decodeHtml(match[1]))
      const video = findVideoInJsonLd(parsed)
      if (video) return video
    } catch {
      // Ignore malformed JSON-LD. Social pages often include partial snippets.
    }
  }

  return ''
}

function extractVideo(html: string) {
  return (
    extractMeta(html, 'og:video:secure_url') ||
    extractMeta(html, 'og:video:url') ||
    extractMeta(html, 'og:video') ||
    extractMeta(html, 'twitter:player:stream') ||
    extractMeta(html, 'twitter:player') ||
    extractJsonLdVideo(html)
  )
}

async function getCachedMetadata(url: string): Promise<LinkMetadata | null> {
  try {
    const { createAdminSupabase } = await import('./admin-supabase')
    const supabase = createAdminSupabase()
    if (!supabase) return null

    const { data, error } = await supabase
      .from('link_metadata_cache')
      .select('metadata, expires_at')
      .eq('url', url)
      .maybeSingle()

    if (error || !data) return null

    const row = data as CachedMetadataRow
    if (!row.expires_at || new Date(row.expires_at).getTime() <= Date.now()) return null
    return row.metadata ? normalizeMetadata(row.metadata) : null
  } catch {
    return null
  }
}

async function setCachedMetadata(url: string, metadata: LinkMetadata) {
  try {
    const { createAdminSupabase } = await import('./admin-supabase')
    const supabase = createAdminSupabase()
    if (!supabase) return

    const normalizedMetadata = normalizeMetadata(metadata)

    await supabase
      .from('link_metadata_cache')
      .upsert({
        url,
        metadata: normalizedMetadata,
        metadata_blocked: Boolean(normalizedMetadata.metadataBlocked),
        source: normalizedMetadata.source || null,
        expires_at: new Date(Date.now() + CACHE_TTL_MS).toISOString(),
        updated_at: new Date().toISOString(),
      })
  } catch {
    // Cache is best-effort. Missing tables or local env should not block saving ideas.
  }
}

async function fetchHtml(url: string, attempt: FetchAttempt) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': attempt.userAgent,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'zh-TW,zh;q=0.9,en;q=0.8',
      'Cache-Control': 'no-cache',
    },
    redirect: 'follow',
    cache: 'no-store',
  })

  if (!res.ok) return ''
  return res.text()
}

export async function fetchLinkMetadata(url: string): Promise<LinkMetadata | null> {
  const normalizedUrl = normalizeLinkMetadataUrl(url)
  const cached = await getCachedMetadata(normalizedUrl)
  if (cached) return cached

  try {
    const attempts = isInstagramUrl(normalizedUrl)
      ? INSTAGRAM_USER_AGENTS
      : [{ source: 'desktop-chrome', userAgent: DEFAULT_USER_AGENT }]

    let fallback: LinkMetadata | null = null

    for (const attempt of attempts) {
      const html = await fetchHtml(normalizedUrl, attempt)
      if (!html) continue

      const metadata = parseMetadataFromHtml(html, attempt.source, normalizedUrl)
      if (!fallback || (!fallback.image && metadata.image)) {
        fallback = metadata
      }

      if (!metadata.metadataBlocked && isMeaningfulDescription(metadata.description)) {
        await setCachedMetadata(normalizedUrl, metadata)
        return metadata
      }
    }

    if (fallback) {
      await setCachedMetadata(normalizedUrl, fallback)
    }

    return fallback
  } catch {
    return null
  }
}
