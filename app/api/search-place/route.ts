import { NextRequest, NextResponse } from 'next/server'

function stripHtmlTags(text: string): string {
  return text.replace(/<[^>]*>/g, '').trim()
}

export async function POST(req: NextRequest) {
  try {
    const { name, address } = await req.json()
    if (!name) return NextResponse.json({ error: 'Name required' }, { status: 400 })

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tools: [{ google_search: {} }],
          contents: [{
            role: 'user',
            parts: [{
              text: `搜尋「${name}」${address ? `（地址：${address}）` : ''}嘅資料，然後用繁體中文廣東話寫一段2-3句嘅背景介紹，包括：店鋪特色、主打產品／服務、受歡迎程度、任何有趣嘅賣點。

只返回純 JSON 格式，唔好有任何其他文字：
{
  "desc": "背景介紹純文字..."
}`
            }]
          }]
        })
      }
    )

    if (!response.ok) {
      const err = await response.json()
      throw new Error(err.error?.message || 'Gemini API error')
    }

    const data = await response.json()
    const text = data.candidates?.[0]?.content?.parts
      ?.filter((p: any) => p.text)
      ?.map((p: any) => p.text)
      ?.join('') || ''

    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('Cannot parse response')

    const parsed = JSON.parse(jsonMatch[0])
    const cleanDesc = stripHtmlTags(parsed.desc || '')

    return NextResponse.json({ desc: cleanDesc })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
