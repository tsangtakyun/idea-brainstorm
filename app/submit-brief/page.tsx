'use client'

import type { CSSProperties, FormEvent } from 'react'
import { useMemo, useState } from 'react'

const cardStyle: CSSProperties = {
  background: 'rgba(255,255,255,0.72)',
  border: '1px solid rgba(26,26,24,0.12)',
  borderRadius: '22px',
  padding: '24px',
  boxShadow: '0 20px 50px rgba(26,26,24,0.06)',
}

const inputStyle: CSSProperties = {
  width: '100%',
  padding: '13px 14px',
  borderRadius: '14px',
  border: '1px solid rgba(26,26,24,0.14)',
  background: 'rgba(255,255,255,0.88)',
  fontSize: '14px',
  boxSizing: 'border-box',
}

type FormState = {
  businessName: string
  campaignTitle: string
  vertical: string
  budgetRange: string
  locationText: string
  deadline: string
  targetPlatforms: string
  brief: string
  mustInclude: string
}

const initialState: FormState = {
  businessName: '',
  campaignTitle: '',
  vertical: 'food',
  budgetRange: '',
  locationText: '',
  deadline: '',
  targetPlatforms: 'Instagram Reels',
  brief: '',
  mustInclude: '',
}

export default function SubmitBriefPage() {
  const [form, setForm] = useState<FormState>(initialState)
  const [submitted, setSubmitted] = useState(false)

  const aiPreview = useMemo(() => {
    if (!form.brief.trim()) return null

    const focusMap: Record<string, string> = {
      food: '以第一口反應同氣氛感做主線',
      travel: '以地方感同 reveal 動線做主線',
      product: '以實用情境同轉化點做主線',
      experience: '以體驗前後反差同過程感做主線',
    }

    return {
      summary: `${form.businessName || '呢個商戶'}想做一個 ${form.vertical} 向 campaign，核心需求係「${form.brief.slice(0, 56)}${form.brief.length > 56 ? '...' : ''}」，建議先以 ${focusMap[form.vertical] || '清楚 angle'} 包裝，再決定最適合嘅 creator。`,
      angleA: form.vertical === 'food'
        ? '值唔值得專程去食'
        : form.vertical === 'travel'
          ? '離開城市半日就去到另一個世界'
          : form.vertical === 'product'
            ? '生活中一用就有感分別'
            : '原來香港仲有呢種體驗',
      angleB: form.vertical === 'product'
        ? '一條偏實測，一條偏情境種草'
        : '一條主 Reel + 一條補充 cutdown',
    }
  }, [form])

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitted(true)
  }

  return (
    <main style={{
      minHeight: '100vh',
      background: 'linear-gradient(180deg, #f4efe6 0%, #ebe3d6 100%)',
      color: '#1a1a18',
      fontFamily: 'Georgia, Times New Roman, serif',
      padding: '40px 24px 80px',
    }}>
      <div style={{ maxWidth: '1180px', margin: '0 auto' }}>
        <section style={{ marginBottom: '28px' }}>
          <p style={{ fontSize: '12px', letterSpacing: '0.18em', color: '#857866', marginBottom: '10px' }}>
            SOON EXTERNAL PLATFORM
          </p>
          <h1 style={{ fontSize: '54px', lineHeight: 1.02, fontWeight: 500, margin: '0 0 14px' }}>
            Submit A Campaign Brief
          </h1>
          <p style={{ maxWidth: '760px', fontSize: '18px', lineHeight: 1.7, color: '#5a5349', margin: 0 }}>
            呢頁係 Campaign Workspace MVP 嘅 merchant 入口。商戶交 brief 之後，SOON 可以幫佢整理需求、配對 creator，直接進入 script 同 storyboard workflow。
          </p>
        </section>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.3fr) minmax(320px, 0.9fr)', gap: '22px', alignItems: 'start' }}>
          <form onSubmit={handleSubmit} style={cardStyle}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <label>
                <div style={{ marginBottom: '8px', fontSize: '13px', color: '#6b6257' }}>Business / Brand</div>
                <input value={form.businessName} onChange={(e) => updateField('businessName', e.target.value)} style={inputStyle} placeholder="例如 One Bite / cafe / 餐廳品牌" />
              </label>
              <label>
                <div style={{ marginBottom: '8px', fontSize: '13px', color: '#6b6257' }}>Campaign Title</div>
                <input value={form.campaignTitle} onChange={(e) => updateField('campaignTitle', e.target.value)} style={inputStyle} placeholder="例如 春季新 menu 推廣" />
              </label>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '16px' }}>
              <label>
                <div style={{ marginBottom: '8px', fontSize: '13px', color: '#6b6257' }}>Vertical</div>
                <select value={form.vertical} onChange={(e) => updateField('vertical', e.target.value)} style={inputStyle}>
                  <option value="food">Food</option>
                  <option value="travel">Travel</option>
                  <option value="product">Product</option>
                  <option value="experience">Experience</option>
                </select>
              </label>
              <label>
                <div style={{ marginBottom: '8px', fontSize: '13px', color: '#6b6257' }}>Budget</div>
                <input value={form.budgetRange} onChange={(e) => updateField('budgetRange', e.target.value)} style={inputStyle} placeholder="HK$8k - 12k" />
              </label>
              <label>
                <div style={{ marginBottom: '8px', fontSize: '13px', color: '#6b6257' }}>Location</div>
                <input value={form.locationText} onChange={(e) => updateField('locationText', e.target.value)} style={inputStyle} placeholder="尖沙咀 / 香港 / Online" />
              </label>
              <label>
                <div style={{ marginBottom: '8px', fontSize: '13px', color: '#6b6257' }}>Deadline</div>
                <input type="date" value={form.deadline} onChange={(e) => updateField('deadline', e.target.value)} style={inputStyle} />
              </label>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label>
                <div style={{ marginBottom: '8px', fontSize: '13px', color: '#6b6257' }}>Target Platforms</div>
                <input value={form.targetPlatforms} onChange={(e) => updateField('targetPlatforms', e.target.value)} style={inputStyle} placeholder="Instagram Reels, YouTube Shorts" />
              </label>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label>
                <div style={{ marginBottom: '8px', fontSize: '13px', color: '#6b6257' }}>Campaign Brief</div>
                <textarea value={form.brief} onChange={(e) => updateField('brief', e.target.value)} style={{ ...inputStyle, minHeight: '150px', resize: 'vertical' }} placeholder="描述商戶想做咩、想吸引咩客、想帶出咩感覺。" />
              </label>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label>
                <div style={{ marginBottom: '8px', fontSize: '13px', color: '#6b6257' }}>Must Include</div>
                <textarea value={form.mustInclude} onChange={(e) => updateField('mustInclude', e.target.value)} style={{ ...inputStyle, minHeight: '100px', resize: 'vertical' }} placeholder="例如地址、優惠、價格、預約方式、產品連結。" />
              </label>
            </div>

            <button type="submit" style={{
              border: 'none',
              borderRadius: '999px',
              padding: '14px 22px',
              background: '#1a1a18',
              color: '#f4efe6',
              cursor: 'pointer',
              fontSize: '14px',
              letterSpacing: '0.05em',
            }}>
              Save Brief Draft
            </button>

            {submitted && (
              <div style={{ marginTop: '18px', padding: '14px 16px', borderRadius: '14px', background: '#f7f2d8', color: '#6b5d1c', fontSize: '14px' }}>
                呢一版先係 workflow prototype，暫時未寫入 Supabase。下一步會直接將呢份 brief 接去 `campaigns` table 同 ops queue。
              </div>
            )}
          </form>

          <aside style={{ display: 'grid', gap: '18px' }}>
            <section style={cardStyle}>
              <p style={{ margin: '0 0 8px', fontSize: '12px', letterSpacing: '0.16em', color: '#857866' }}>AI ENRICHED PREVIEW</p>
              {aiPreview ? (
                <>
                  <p style={{ margin: '0 0 12px', fontSize: '16px', lineHeight: 1.7, color: '#433d35' }}>{aiPreview.summary}</p>
                  <div style={{ display: 'grid', gap: '10px' }}>
                    <div style={{ padding: '14px', borderRadius: '16px', background: '#fbf8f1', border: '1px solid rgba(26,26,24,0.08)' }}>
                      <div style={{ fontSize: '12px', color: '#8a7f71', marginBottom: '6px' }}>Suggested Angle A</div>
                      <strong style={{ fontSize: '16px', fontWeight: 500 }}>{aiPreview.angleA}</strong>
                    </div>
                    <div style={{ padding: '14px', borderRadius: '16px', background: '#fbf8f1', border: '1px solid rgba(26,26,24,0.08)' }}>
                      <div style={{ fontSize: '12px', color: '#8a7f71', marginBottom: '6px' }}>Suggested Deliverable Shape</div>
                      <strong style={{ fontSize: '16px', fontWeight: 500 }}>{aiPreview.angleB}</strong>
                    </div>
                  </div>
                </>
              ) : (
                <p style={{ margin: 0, fontSize: '15px', lineHeight: 1.7, color: '#6f675d' }}>
                  商戶一填 brief，右邊就可以即時見到 AI 幫手整理過嘅 summary、angle suggestions 同 deliverable 建議。
                </p>
              )}
            </section>

            <section style={cardStyle}>
              <p style={{ margin: '0 0 8px', fontSize: '12px', letterSpacing: '0.16em', color: '#857866' }}>MVP FLOW</p>
              <div style={{ display: 'grid', gap: '10px' }}>
                {[
                  '1. Merchant submit brief',
                  '2. AI enrich campaign',
                  '3. SOON / system match creator',
                  '4. Generate script',
                  '5. Generate storyboard',
                  '6. Track deliverables',
                ].map((step) => (
                  <div key={step} style={{ padding: '12px 14px', borderRadius: '14px', background: '#fbf8f1', border: '1px solid rgba(26,26,24,0.08)', fontSize: '14px' }}>
                    {step}
                  </div>
                ))}
              </div>
            </section>
          </aside>
        </div>
      </div>
    </main>
  )
}
