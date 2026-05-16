import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

function parseJsonArray(text: string) {
  const cleaned = text.replace(/```json|```/g, '').trim()
  const start = cleaned.indexOf('[')
  const end = cleaned.lastIndexOf(']')
  const json = start >= 0 && end >= start ? cleaned.slice(start, end + 1) : cleaned
  return JSON.parse(json)
}

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })
  }

  const { keyword } = await req.json()
  if (!keyword) return NextResponse.json({ error: 'no keyword' }, { status: 400 })

  try {
    const claudeRes = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      messages: [{
        role: 'user',
        content: `你係一個 IG Reel 題材策略師，專門分析亞洲市場（香港、台灣、日本、韓國）嘅爆款短影片題材。

用家想搵關於「${keyword}」嘅 IG Reel 題材靈感。

請生成 6 個具體題材建議，每個包括：
- title：吸引眼球嘅題材標題（繁體中文，20字內）
- angle：拍攝角度或故事切入點（30字內）
- hook：第一秒鐘嘅開場 hook（20字內）
- youtube_query：用英文或中文搜尋呢個題材嘅 YouTube Shorts 關鍵字（10字內，最準確）
- tags：3-4個相關 hashtag
- region：最適合嘅地區（HK / TW / JP / KR / 通用）
- viral_potential：爆款潛力評分 1-100

只回傳 JSON array，唔好有任何其他文字：
[
  {
    "title": "",
    "angle": "",
    "hook": "",
    "youtube_query": "",
    "tags": [],
    "region": "",
    "viral_potential": 0
  }
]`
      }]
    })

    const claudeText = claudeRes.content[0]?.type === 'text' ? claudeRes.content[0].text : '[]'
    const directions = parseJsonArray(claudeText)
    if (!Array.isArray(directions)) {
      return NextResponse.json({ error: 'Claude response is not an array' }, { status: 500 })
    }

    const YOUTUBE_KEY = process.env.YOUTUBE_API_KEY

    const withVideos = await Promise.all(
      directions.map(async (dir: any) => {
        if (!YOUTUBE_KEY || !dir?.youtube_query) return { ...dir, videos: [] }
        try {
          const ytRes = await fetch(
            `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(dir.youtube_query)}&type=video&videoDuration=short&maxResults=3&order=viewCount&relevanceLanguage=zh-Hant&key=${YOUTUBE_KEY}`
          )
          const ytData = await ytRes.json()
          const videos = (ytData.items || []).map((item: any) => ({
            id: item.id.videoId,
            title: item.snippet.title,
            channel: item.snippet.channelTitle,
            thumb: item.snippet.thumbnails?.medium?.url || '',
            url: `https://www.youtube.com/shorts/${item.id.videoId}`,
          }))
          return { ...dir, videos }
        } catch {
          return { ...dir, videos: [] }
        }
      })
    )

    return NextResponse.json({ directions: withVideos })
  } catch (err) {
    console.error('[/api/explore] error:', err)
    return NextResponse.json({ error: '未能生成建議，請重試' }, { status: 500 })
  }
}
