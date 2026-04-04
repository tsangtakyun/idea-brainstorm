import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

function stripCiteTags(text: string): string {
  return text.replace(/<cite[^>]*>([\s\S]*?)<\/cite>/g, '$1')
    .replace(/<\/?cite[^>]*>/g, '')
    .trim()
}

async function geocode(query: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${process.env.GOOGLE_MAPS_API_KEY}`
    const res = await fetch(url)
    const data = await res.json()
    if (data.status === 'OK' && data.results[0]) {
      const { lat, lng } = data.results[0].geometry.location
      return { lat, lng }
    }
    return null
  } catch {
    return null
  }
}

export async function POST(req: NextRequest) {
  try {
    const { name, address } = await req.json()
    if (!name) return NextResponse.json({ error: 'Name required' }, { status: 400 })

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      tools: [{ type: 'web_search_20250305', name: 'web_search' }] as any,
      messages: [{
        role: 'user',
        content: `搜尋「${name}」${address ? `（地址：${address}）` : ''}嘅資料，然後用繁體中文廣東話寫一段2-3句嘅背景介紹，包括：店鋪特色、主打產品／服務、受歡迎程度、任何有趣嘅賣點。\n\n重要：只返回純 JSON，desc 入面唔好有任何 HTML tags：\n{\n  "desc": "背景介紹純文字..."\n}`
      }]
    })

    const text = response.content
      .filter((b: any) => b.type === 'text')
      .map((b: any) => b.text)
      .join('')

    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('Cannot parse response')

    const parsed = JSON.parse(jsonMatch[0])
    const cleanDesc = stripCiteTags(parsed.desc || '')

    const geoQuery = address ? `${name} ${address}` : name
    const coords = await geocode(geoQuery)

    return NextResponse.json({
      desc: cleanDesc,
      lat: coords?.lat ?? null,
      lng: coords?.lng ?? null,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
