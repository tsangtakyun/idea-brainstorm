export type SocialVideoResult = {
  title?: string
  description?: string
  image?: string
  thumbnail?: string
  videoUrl?: string
  placeName?: string
  placeAddress?: string
  country?: string
  provider?: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return ''
}

function pickRecord(value: unknown): Record<string, unknown> | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = pickRecord(item)
      if (found) return found
    }
    return null
  }

  if (!isRecord(value)) return null
  return value
}

function nestedValue(record: Record<string, unknown>, path: string) {
  return path.split('.').reduce<unknown>((current, key) => {
    if (!isRecord(current)) return undefined
    return current[key]
  }, record)
}

function looksLikePageUrl(value: string, originalUrl: string) {
  const normalized = value.toLowerCase()
  const original = originalUrl.toLowerCase()

  if (normalized === original) return true
  return /instagram\.com\/(reel|p|tv)\//.test(normalized)
}

function looksLikePlayableVideo(value: string, originalUrl: string) {
  if (!value || looksLikePageUrl(value, originalUrl)) return false
  const url = value.toLowerCase()
  return (
    url.startsWith('http://') ||
    url.startsWith('https://') ||
    url.includes('.mp4') ||
    url.includes('.m3u8') ||
    url.includes('video') ||
    url.includes('fbcdn') ||
    url.includes('cdninstagram') ||
    url.includes('akamai') ||
    url.includes('mux') ||
    url.includes('cloudinary')
  )
}

function resolveFromPayload(payload: unknown, originalUrl: string): SocialVideoResult | null {
  const root = pickRecord(payload)
  if (!root) return null

  const candidates = [
    root,
    pickRecord(root.data),
    pickRecord(root.result),
    pickRecord(root.media),
    pickRecord(root.video),
    pickRecord(root.item),
    pickRecord(root.items),
    pickRecord(root.medias),
  ].filter(Boolean) as Record<string, unknown>[]

  for (const item of candidates) {
    const videoUrl = firstString(
      item.video_url,
      item.videoUrl,
      item.video,
      item.media_url,
      item.playback_url,
      item.playbackUrl,
      item.hls_url,
      item.hlsUrl,
      item.download_url,
      item.downloadUrl,
      item.src,
      nestedValue(item, 'media.video_url'),
      nestedValue(item, 'media.playback_url'),
      nestedValue(item, 'video.url'),
      nestedValue(item, 'video.src'),
      item.url
    )

    if (!looksLikePlayableVideo(videoUrl, originalUrl)) continue

    const image = firstString(
      item.thumbnail,
      item.thumbnail_url,
      item.thumbnailUrl,
      item.cover,
      item.cover_url,
      item.poster,
      item.image,
      item.image_url,
      nestedValue(item, 'media.thumbnail_url'),
      nestedValue(item, 'video.thumbnail_url')
    )

    return {
      title: firstString(item.title, item.caption, item.name),
      description: firstString(item.description, item.desc, item.caption),
      image,
      thumbnail: image,
      videoUrl,
      placeName: firstString(item.placeName, item.place_name, item.location_name, nestedValue(item, 'location.name'), nestedValue(item, 'place.name')),
      placeAddress: firstString(item.placeAddress, item.place_address, item.location_address, nestedValue(item, 'location.address'), nestedValue(item, 'place.address')),
      country: firstString(item.country, item.region, nestedValue(item, 'location.country'), nestedValue(item, 'place.country')),
      provider: firstString(root.provider, item.provider, 'custom-resolver'),
    }
  }

  return null
}

export async function resolveSocialVideo(url: string): Promise<SocialVideoResult | null> {
  const endpoint = process.env.SOCIAL_VIDEO_RESOLVER_ENDPOINT || process.env.INSTAGRAM_RESOLVER_ENDPOINT
  const apiKey = process.env.SOCIAL_VIDEO_RESOLVER_API_KEY || process.env.INSTAGRAM_RESOLVER_API_KEY

  if (!endpoint) return null

  try {
    const headers: Record<string, string> = {
      Accept: 'application/json',
    }
    if (apiKey) {
      headers.Authorization = `Bearer ${apiKey}`
      headers['x-api-key'] = apiKey
    }

    const response = endpoint.includes('{url}')
      ? await fetch(endpoint.replace('{url}', encodeURIComponent(url)), {
          method: 'GET',
          headers,
          cache: 'no-store',
        })
      : await fetch(endpoint, {
          method: 'POST',
          headers: {
            ...headers,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ url }),
          cache: 'no-store',
        })

    if (!response.ok) {
      console.log('[social-video] resolver failed', response.status)
      return null
    }

    const payload = await response.json()
    return resolveFromPayload(payload, url)
  } catch (error) {
    console.log('[social-video] resolver skipped', error)
    return null
  }
}
