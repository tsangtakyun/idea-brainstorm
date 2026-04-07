import Link from 'next/link'

import { campaigns, creators, getCreatorById, statusMeta } from '@/lib/campaign-workspace'

function metricValue(label: string, value: string) {
  return (
    <div style={{
      padding: '18px 20px',
      borderRadius: '18px',
      background: 'rgba(255,255,255,0.75)',
      border: '1px solid rgba(26,26,24,0.10)',
    }}>
      <div style={{ fontSize: '12px', letterSpacing: '0.14em', color: '#887b68', marginBottom: '8px' }}>{label}</div>
      <div style={{ fontSize: '28px', color: '#1a1a18' }}>{value}</div>
    </div>
  )
}

export default function OpsCampaignsPage() {
  const activeCampaigns = campaigns.filter((campaign) => campaign.status !== 'closed')
  const matchingCount = campaigns.filter((campaign) => campaign.status === 'matching').length
  const productionCount = campaigns.filter((campaign) => campaign.status === 'in_production' || campaign.status === 'creator_pending').length

  return (
    <main style={{
      minHeight: '100vh',
      background: 'linear-gradient(180deg, #f6f1e8 0%, #ece3d6 100%)',
      padding: '42px 24px 90px',
      fontFamily: 'Georgia, Times New Roman, serif',
      color: '#1a1a18',
    }}>
      <div style={{ maxWidth: '1220px', margin: '0 auto' }}>
        <section style={{ marginBottom: '28px' }}>
          <p style={{ fontSize: '12px', letterSpacing: '0.18em', color: '#8b7c69', marginBottom: '10px' }}>OPS CAMPAIGN QUEUE</p>
          <h1 style={{ fontSize: '52px', lineHeight: 1.03, margin: '0 0 12px', fontWeight: 500 }}>
            Campaign Workspace
          </h1>
          <p style={{ maxWidth: '760px', margin: 0, color: '#5b5348', fontSize: '18px', lineHeight: 1.7 }}>
            呢個 page 係 SOON ops 角度嘅第一版 campaign queue。之後會接商戶 brief submission、AI enriched brief、creator matching 同 script / storyboard workflow。
          </p>
        </section>

        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
          {metricValue('Active Campaigns', String(activeCampaigns.length))}
          {metricValue('Need Matching', String(matchingCount))}
          {metricValue('In Creator / Production Flow', String(productionCount))}
        </section>

        <section style={{
          background: 'rgba(255,255,255,0.70)',
          border: '1px solid rgba(26,26,24,0.10)',
          borderRadius: '26px',
          overflow: 'hidden',
          boxShadow: '0 24px 60px rgba(26,26,24,0.06)',
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '2.2fr 0.9fr 1fr 1fr 1.2fr 0.8fr',
            padding: '16px 20px',
            borderBottom: '1px solid rgba(26,26,24,0.08)',
            color: '#857866',
            fontSize: '12px',
            letterSpacing: '0.10em',
            textTransform: 'uppercase',
          }}>
            <div>Campaign</div>
            <div>Status</div>
            <div>Budget</div>
            <div>Location</div>
            <div>Suggested Creator</div>
            <div>Open</div>
          </div>

          {campaigns.map((campaign) => {
            const leadMatch = campaign.matches[0]
            const creator = leadMatch ? getCreatorById(leadMatch.creatorId) : null
            return (
              <div key={campaign.id} style={{
                display: 'grid',
                gridTemplateColumns: '2.2fr 0.9fr 1fr 1fr 1.2fr 0.8fr',
                padding: '18px 20px',
                borderBottom: '1px solid rgba(26,26,24,0.06)',
                alignItems: 'start',
                gap: '14px',
              }}>
                <div>
                  <div style={{ fontSize: '22px', lineHeight: 1.2, marginBottom: '8px' }}>{campaign.title}</div>
                  <div style={{ color: '#6d655a', fontSize: '14px', lineHeight: 1.6 }}>
                    {campaign.merchantName} · {campaign.sourceChannel}
                  </div>
                  <div style={{ marginTop: '10px', color: '#5f584e', fontSize: '14px', lineHeight: 1.6 }}>
                    {campaign.aiSummary}
                  </div>
                </div>

                <div>
                  <span style={{
                    display: 'inline-flex',
                    padding: '8px 12px',
                    borderRadius: '999px',
                    background: 'rgba(255,255,255,0.88)',
                    color: statusMeta[campaign.status].tone,
                    border: `1px solid ${statusMeta[campaign.status].tone}22`,
                    fontSize: '13px',
                  }}>
                    {statusMeta[campaign.status].label}
                  </span>
                </div>

                <div style={{ fontSize: '15px', color: '#4f493f' }}>{campaign.budgetRange}</div>
                <div style={{ fontSize: '15px', color: '#4f493f' }}>{campaign.locationText}</div>

                <div>
                  {creator ? (
                    <>
                      <div style={{ fontSize: '15px', color: '#1a1a18', marginBottom: '4px' }}>{creator.displayName}</div>
                      <div style={{ fontSize: '13px', color: '#71695d', lineHeight: 1.5 }}>
                        {creator.portfolioLabel}
                      </div>
                      <div style={{ fontSize: '12px', color: '#8a7d6d', marginTop: '6px' }}>
                        Match {leadMatch.matchScore}
                      </div>
                    </>
                  ) : (
                    <div style={{ fontSize: '14px', color: '#857866' }}>No match yet</div>
                  )}
                </div>

                <div>
                  <Link href={`/ops/campaigns/${campaign.id}`} style={{
                    display: 'inline-flex',
                    padding: '10px 14px',
                    borderRadius: '999px',
                    textDecoration: 'none',
                    background: '#1a1a18',
                    color: '#f6f1e8',
                    fontSize: '13px',
                  }}>
                    Workspace
                  </Link>
                </div>
              </div>
            )
          })}
        </section>

        <section style={{ marginTop: '24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div style={{
            padding: '20px 22px',
            borderRadius: '22px',
            background: 'rgba(255,255,255,0.75)',
            border: '1px solid rgba(26,26,24,0.10)',
          }}>
            <div style={{ fontSize: '12px', letterSpacing: '0.14em', color: '#887b68', marginBottom: '10px' }}>CONNECTED MODULES</div>
            <div style={{ display: 'grid', gap: '8px', fontSize: '15px', lineHeight: 1.65, color: '#4e483f' }}>
              <div><code>idea-brainstorm</code>{' -> '}brief enrichment / campaign angles</div>
              <div><code>script-generator</code>{' -> '}campaign script draft</div>
              <div><code>soon-storyboard</code>{' -> '}storyboard and shot plan</div>
              <div><code>soon-video-generator</code>{' -> '}later visual preview / concept frame</div>
            </div>
          </div>

          <div style={{
            padding: '20px 22px',
            borderRadius: '22px',
            background: 'rgba(255,255,255,0.75)',
            border: '1px solid rgba(26,26,24,0.10)',
          }}>
            <div style={{ fontSize: '12px', letterSpacing: '0.14em', color: '#887b68', marginBottom: '10px' }}>CREATOR POOL SNAPSHOT</div>
            <div style={{ display: 'grid', gap: '12px' }}>
              {creators.map((creator) => (
                <div key={creator.id} style={{ paddingBottom: '12px', borderBottom: '1px solid rgba(26,26,24,0.06)' }}>
                  <div style={{ fontSize: '16px', marginBottom: '4px' }}>{creator.displayName}</div>
                  <div style={{ fontSize: '14px', color: '#6e665b', lineHeight: 1.6 }}>
                    {creator.niches.join(' / ')} · from {creator.baseCity}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
