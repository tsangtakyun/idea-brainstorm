import type { ReactNode } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { getCampaignById, getCreatorById, statusMeta } from '@/lib/campaign-workspace'

function sectionCard(title: string, eyebrow: string, content: ReactNode) {
  return (
    <section style={{
      background: 'rgba(255,255,255,0.76)',
      border: '1px solid rgba(26,26,24,0.10)',
      borderRadius: '24px',
      padding: '22px',
      boxShadow: '0 20px 50px rgba(26,26,24,0.05)',
    }}>
      <p style={{ margin: '0 0 8px', fontSize: '12px', letterSpacing: '0.16em', color: '#8b7c69' }}>{eyebrow}</p>
      <h2 style={{ margin: '0 0 16px', fontSize: '26px', fontWeight: 500 }}>{title}</h2>
      {content}
    </section>
  )
}

export default async function CampaignWorkspaceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const campaign = getCampaignById(id)

  if (!campaign) notFound()

  return (
    <main style={{
      minHeight: '100vh',
      background: 'linear-gradient(180deg, #f5f0e6 0%, #e9dece 100%)',
      padding: '38px 24px 90px',
      fontFamily: 'Georgia, Times New Roman, serif',
      color: '#1a1a18',
    }}>
      <div style={{ maxWidth: '1240px', margin: '0 auto' }}>
        <Link href="/ops/campaigns" style={{ color: '#6c6358', textDecoration: 'none', fontSize: '14px' }}>
          ← Back to campaign queue
        </Link>

        <section style={{ marginTop: '16px', marginBottom: '22px', display: 'grid', gridTemplateColumns: '1.3fr 0.7fr', gap: '18px' }}>
          <div style={{
            padding: '28px',
            borderRadius: '28px',
            background: 'rgba(255,255,255,0.76)',
            border: '1px solid rgba(26,26,24,0.10)',
          }}>
            <p style={{ margin: '0 0 8px', fontSize: '12px', letterSpacing: '0.18em', color: '#8b7c69' }}>CAMPAIGN WORKSPACE</p>
            <h1 style={{ margin: '0 0 12px', fontSize: '48px', lineHeight: 1.04, fontWeight: 500 }}>{campaign.title}</h1>
            <p style={{ margin: '0 0 18px', fontSize: '18px', lineHeight: 1.7, color: '#5c554a' }}>{campaign.aiSummary}</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
              <span style={{
                display: 'inline-flex',
                padding: '9px 13px',
                borderRadius: '999px',
                background: '#fbf8f1',
                border: '1px solid rgba(26,26,24,0.08)',
                fontSize: '13px',
              }}>
                {campaign.merchantName}
              </span>
              <span style={{
                display: 'inline-flex',
                padding: '9px 13px',
                borderRadius: '999px',
                background: '#fbf8f1',
                border: '1px solid rgba(26,26,24,0.08)',
                fontSize: '13px',
                color: statusMeta[campaign.status].tone,
              }}>
                {statusMeta[campaign.status].label}
              </span>
              {campaign.targetPlatforms.map((platform) => (
                <span key={platform} style={{
                  display: 'inline-flex',
                  padding: '9px 13px',
                  borderRadius: '999px',
                  background: '#fbf8f1',
                  border: '1px solid rgba(26,26,24,0.08)',
                  fontSize: '13px',
                }}>
                  {platform}
                </span>
              ))}
            </div>
          </div>

          <div style={{
            padding: '24px',
            borderRadius: '28px',
            background: 'rgba(29,29,27,0.94)',
            color: '#f5f0e6',
          }}>
            <div style={{ fontSize: '12px', letterSpacing: '0.14em', color: '#b8b0a2', marginBottom: '10px' }}>WORKSPACE SNAPSHOT</div>
            <div style={{ display: 'grid', gap: '12px', fontSize: '15px', lineHeight: 1.65 }}>
              <div>Budget: {campaign.budgetRange}</div>
              <div>Deadline: {campaign.deadlineText}</div>
              <div>Location: {campaign.locationText}</div>
              <div>Source: {campaign.sourceChannel}</div>
              <div>Deliverables: {campaign.deliverables.length}</div>
            </div>
            <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.10)' }}>
              <div style={{ fontSize: '12px', letterSpacing: '0.12em', color: '#b8b0a2', marginBottom: '8px' }}>NEXT ACTION</div>
              <div style={{ fontSize: '16px', lineHeight: 1.6 }}>
                {campaign.status === 'matching'
                  ? '確認 creator short list，然後出第一版 script。'
                  : campaign.status === 'brief_review'
                    ? '補完 brief 同 must include，再進入 matching。'
                    : '跟進 creator 接單同 production handoff。'}
              </div>
            </div>
          </div>
        </section>

        <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: '18px', marginBottom: '18px' }}>
          {sectionCard('Brief', 'OVERVIEW', (
            <div style={{ display: 'grid', gap: '14px' }}>
              <div>
                <div style={{ fontSize: '12px', letterSpacing: '0.12em', color: '#877a69', marginBottom: '6px' }}>OBJECTIVE</div>
                <div style={{ fontSize: '17px', lineHeight: 1.7, color: '#3f392f' }}>{campaign.objective}</div>
              </div>
              <div>
                <div style={{ fontSize: '12px', letterSpacing: '0.12em', color: '#877a69', marginBottom: '8px' }}>KEY SELLING POINTS</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {campaign.keySellingPoints.map((item) => (
                    <span key={item} style={{ padding: '8px 12px', borderRadius: '999px', background: '#fbf8f1', border: '1px solid rgba(26,26,24,0.08)', fontSize: '13px' }}>{item}</span>
                  ))}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '12px', letterSpacing: '0.12em', color: '#877a69', marginBottom: '8px' }}>MUST INCLUDE</div>
                <ul style={{ margin: 0, paddingLeft: '18px', color: '#4d463d', lineHeight: 1.8, fontSize: '15px' }}>
                  {campaign.mustInclude.map((item) => <li key={item}>{item}</li>)}
                </ul>
              </div>
            </div>
          ))}

          {sectionCard('Matching', 'CREATOR FIT', (
            <div style={{ display: 'grid', gap: '12px' }}>
              {campaign.matches.map((match) => {
                const creator = getCreatorById(match.creatorId)
                if (!creator) return null
                return (
                  <div key={match.id} style={{ padding: '16px', borderRadius: '18px', background: '#fbf8f1', border: '1px solid rgba(26,26,24,0.08)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', marginBottom: '8px' }}>
                      <strong style={{ fontSize: '17px', fontWeight: 500 }}>{creator.displayName}</strong>
                      <span style={{ fontSize: '13px', color: '#6a5f53' }}>Match {match.matchScore}</span>
                    </div>
                    <div style={{ fontSize: '14px', color: '#6a5f53', marginBottom: '8px' }}>{creator.niches.join(' / ')} · {creator.portfolioLabel}</div>
                    <div style={{ fontSize: '15px', lineHeight: 1.7, color: '#3d382f' }}>{match.matchReason}</div>
                  </div>
                )
              })}
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px', marginBottom: '18px' }}>
          {sectionCard('Script', 'CONNECTED MODULE', (
            <div style={{ display: 'grid', gap: '12px', color: '#463f35' }}>
              <div style={{ fontSize: '16px', lineHeight: 1.7 }}>
                呢個位會直接接 `script-generator`。第一版可以先從 campaign brief 自動生成：
              </div>
              <div style={{ padding: '16px', borderRadius: '18px', background: '#fbf8f1', border: '1px solid rgba(26,26,24,0.08)', fontSize: '15px', lineHeight: 1.8 }}>
                【Opening Hook】由 campaign angle 切入<br />
                【背景 VO】交代品牌 / 地點 / 賣點<br />
                【轉場】承接主體內容<br />
                【實測內容】按 vertical 做 food / travel / product workflow<br />
                【Ending】對應 CTA / 到店 / 購買 / 預約
              </div>
              <div style={{ fontSize: '14px', color: '#70685d' }}>
                下一步實作：將 generate action 接返你現有 script prompt。
              </div>
            </div>
          ))}

          {sectionCard('Storyboard', 'CONNECTED MODULE', (
            <div style={{ display: 'grid', gap: '12px', color: '#463f35' }}>
              <div style={{ fontSize: '16px', lineHeight: 1.7 }}>
                呢個位會接 `soon-storyboard`，由 script 拆成 opening / background / transition / main / ending，再推薦 shot plan。
              </div>
              <div style={{ display: 'grid', gap: '10px' }}>
                {campaign.angleSuggestions.map((item, index) => (
                  <div key={item} style={{ padding: '14px 16px', borderRadius: '16px', background: '#fbf8f1', border: '1px solid rgba(26,26,24,0.08)', fontSize: '15px' }}>
                    Angle {index + 1}: {item}
                  </div>
                ))}
              </div>
              <div style={{ fontSize: '14px', color: '#70685d' }}>
                下一步實作：將 script 內容丟入 storyboard analyse route，再回寫 campaign workspace。
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px' }}>
          {sectionCard('Deliverables', 'TRACKING', (
            <div style={{ display: 'grid', gap: '12px' }}>
              {campaign.deliverables.map((deliverable) => (
                <div key={deliverable.id} style={{ padding: '16px', borderRadius: '18px', background: '#fbf8f1', border: '1px solid rgba(26,26,24,0.08)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', marginBottom: '6px' }}>
                    <strong style={{ fontSize: '16px', fontWeight: 500 }}>{deliverable.label}</strong>
                    <span style={{ fontSize: '13px', color: '#6a5f53' }}>{deliverable.status}</span>
                  </div>
                  <div style={{ fontSize: '14px', color: '#6a5f53' }}>{deliverable.dueText}</div>
                </div>
              ))}
            </div>
          ))}

          {sectionCard('Production Notes', 'OPS HANDOFF', (
            <div style={{ display: 'grid', gap: '10px' }}>
              {campaign.productionNotes.map((note) => (
                <div key={note} style={{ padding: '14px 16px', borderRadius: '16px', background: '#fbf8f1', border: '1px solid rgba(26,26,24,0.08)', fontSize: '15px', color: '#463f35', lineHeight: 1.7 }}>
                  {note}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}
