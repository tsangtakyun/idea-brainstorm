export type LinkMetadata = {
  title: string
  description: string
  image: string
  video: string
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

export async function fetchLinkMetadata(url: string): Promise<LinkMetadata | null> {
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
      video: extractVideo(html),
    }
  } catch {
    return null
  }
}
