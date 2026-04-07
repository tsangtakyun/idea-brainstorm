import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import chromium from '@sparticuz/chromium'
import { chromium as playwright } from 'playwright-core'

export const runtime = 'nodejs'
export const maxDuration = 60

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

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

function toDataUrl(buffer: Buffer) {
  return `data:image/png;base64,${buffer.toString('base64')}`
}

async function tryClickMore(page: import('playwright-core').Page) {
  const candidates = [
    page.getByText('更多', { exact: false }).first(),
    page.getByText('more', { exact: false }).first(),
    page.getByText('更多內容', { exact: false }).first(),
    page.getByRole('button', { name: /more|更多/i }).first(),
  ]

  for (const locator of candidates) {
    try {
      if (await locator.count()) {
        await locator.click({ timeout: 1500 })
        return true
      }
    } catch {
      // ignore and continue
    }
  }

  return false
}

async function analyseScreenshots(params: {
  url: string
  platform: string
  screenshots: string[]
}) {
  const system = `You enrich short-form content references for SOON Idea Collection.
Look at the screenshots and infer what the content is about.
Return only valid JSON:
{
  "country": "HK | TW | CN | JP | KR | SG | TH | MY | ID | VN | IN | US | GB | AU | CA | FR | DE | OTHER",
  "contentType": "reel | blog | social",
  "placeName": "shop / brand / venue name if any, else empty string",
  "placeAddress": "address / district / city if inferable, else empty string",
  "desc": "2-3 sentences in Traditional Chinese. Be explicit that this is AI-inferred from screenshots and may be wrong.",
  "tags": ["food","travel","cafe","lifestyle","relationship","citywalk","microdrama","hook-heavy"]
}`

  const content: Record<string, unknown>[] = [
    ...params.screenshots.map(image => ({
      type: 'image',
      source: {
        type: 'base64',
        media_type: 'image/png',
        data: image.split(',')[1],
      },
    })),
    {
      type: 'text',
      text: `URL: ${params.url}
Platform: ${params.platform}

Infer the likely country, content type, place name, place address, and a useful description for idea intake. If uncertain, say so clearly in the description and keep it conservative.`,
    },
  ]

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1000,
    system,
    messages: [{ role: 'user', content }] as any,
  })

  const text = response.content.find(block => block.type === 'text')
  const raw = text?.type === 'text' ? text.text : ''
  const jsonMatch = raw.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error('Cannot parse AI response')
  }

  return JSON.parse(jsonMatch[0])
}

export async function POST(req: NextRequest) {
  let browser: import('playwright-core').Browser | null = null
  let stage = 'init'

  try {
    stage = 'parse-request'
    const { url } = await req.json()
    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'URL required' }, { status: 400 })
    }
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })
    }

    const normalizedUrl = normalizeUrl(url)
    const parsedUrl = new URL(normalizedUrl)
    const platform = inferPlatform(parsedUrl.hostname.replace('www.', ''))

    stage = 'launch-browser'
    browser = await playwright.launch({
      args: [...chromium.args, '--disable-dev-shm-usage'],
      executablePath: await chromium.executablePath(),
      headless: true,
    })

    stage = 'new-page'
    const page = await browser.newPage({
      viewport: { width: 1280, height: 1800 },
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
      ignoreHTTPSErrors: true,
    })

    stage = 'goto-url'
    await page.goto(normalizedUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForTimeout(2500)

    stage = 'screenshot-first'
    const firstShot = await page.screenshot({ type: 'png', fullPage: false })
    stage = 'click-more'
    const clickedMore = await tryClickMore(page)
    if (clickedMore) {
      await page.waitForTimeout(1200)
    }
    stage = 'screenshot-second'
    const secondShot = await page.screenshot({ type: 'png', fullPage: false })

    const screenshots = [toDataUrl(firstShot), toDataUrl(secondShot)]
    stage = 'analyse-screenshots'
    const analysis = await analyseScreenshots({
      url: normalizedUrl,
      platform,
      screenshots,
    })

    return NextResponse.json({
      url: normalizedUrl,
      platform,
      contentType: analysis.contentType || inferType(platform),
      country: analysis.country || '',
      placeName: analysis.placeName || '',
      placeAddress: analysis.placeAddress || '',
      desc: analysis.desc || '',
      tags: Array.isArray(analysis.tags) ? analysis.tags.slice(0, 6) : [],
      image: screenshots[0],
      screenshots,
      browserAssist: true,
      warning: 'AI 從瀏覽器截圖推斷內容，可能有錯，請 double check。',
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: `[${stage}] ${message}` }, { status: 500 })
  } finally {
    if (browser) {
      await browser.close()
    }
  }
}
