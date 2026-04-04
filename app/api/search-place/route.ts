import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

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
        content: `搜尋「${name}」${address ? `（地址：${address}）` : ''}嘅資料，然後用繁體中文廣東話寫一段2-3句嘅背景介紹，包括：店鋪特色、主打產品／服務、受歡迎程度、任何有趣嘅賣點。
        
只返回 JSON 格式（唔好加其他文字）：
{
  "desc": "背景介紹..."
}`
      }]
    })

    const text = response.content
      .filter((b: any) => b.type === 'text')
      .map((b: any) => b.text)
      .join('')

    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('Cannot parse response')
    const parsed = JSON.parse(jsonMatch[0])

    return NextResponse.json({ desc: parsed.desc })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
