import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })
  }

  const { title, placeName, placeAddress, summary } = await req.json()

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      tools: [{ type: 'web_search_20250305', name: 'web_search' } as any],
      messages: [{
        role: 'user',
        content: `你係一個 IG Reel 題材研究員。

題材：${title || '未命名題材'}
${placeName ? `店鋪／品牌：${placeName}` : ''}
${placeAddress ? `地址：${placeAddress}` : ''}
${summary ? `現有描述：${summary}` : ''}

請用繁體中文，搜尋並提供以下資料：
1. 店鋪／地點詳細介紹（特色、環境、必點）
2. 適合拍 IG Reel 嘅角度同賣點
3. 營業時間（如有）
4. 任何 IG 創作者值得知道嘅特別資訊

用自然、口語化嘅繁體中文（香港風格）回答，格式清晰易讀。`
      }]
    })

    const text = response.content
      .filter((block: any) => block.type === 'text')
      .map((block: any) => block.text)
      .join('\n')

    return NextResponse.json({ detail: text })
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'AI detail failed',
    }, { status: 500 })
  }
}
