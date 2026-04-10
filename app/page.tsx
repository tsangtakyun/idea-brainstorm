'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase';

const COUNTRIES: Record<string, string> = {
  HK:'🇭🇰 香港', TW:'🇹🇼 台灣', CN:'🇨🇳 內地', JP:'🇯🇵 日本',
  KR:'🇰🇷 韓國', SG:'🇸🇬 新加坡', TH:'🇹🇭 泰國', MY:'🇲🇾 馬來西亞',
  ID:'🇮🇩 印尼', VN:'🇻🇳 越南', IN:'🇮🇳 印度',
  US:'🇺🇸 美國', GB:'🇬🇧 英國', AU:'🇦🇺 澳洲', CA:'🇨🇦 加拿大',
  FR:'🇫🇷 法國', DE:'🇩🇪 德國', OTHER:'🌍 其他'
};

const SCRIPT_GEN_URL = 'https://script-generator-xi.vercel.app';
const PLATFORM_META: Record<string, { label: string; emoji: string }> = {
  instagram: { label: 'IG REEL', emoji: '📸' },
  tiktok: { label: 'TIKTOK', emoji: '🎵' },
  xiaohongshu: { label: '小紅書', emoji: '📕' },
  web: { label: 'WEB', emoji: '🌐' },
};

function fmtNum(n: number) {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(0) + 'K';
  return String(n);
}
function hostOf(url: string) {
  try { return new URL(url.startsWith('http') ? url : 'https://' + url).hostname.replace('www.', ''); }
  catch { return url.slice(0, 40); }
}
function inferPlatformFromUrl(url: string) {
  try {
    const hostname = new URL(url.startsWith('http') ? url : 'https://' + url).hostname.replace('www.', '');
    if (hostname.includes('instagram.com')) return 'instagram';
    if (hostname.includes('tiktok.com')) return 'tiktok';
    if (hostname.includes('xiaohongshu.com') || hostname.includes('xhslink.com')) return 'xiaohongshu';
    return 'web';
  } catch {
    return '';
  }
}
function computeViralScore(views: number, likes: number, shares: number, aiScore: number) {
  let viewScore = 0
  if (views >= 1000000) viewScore = 90 + Math.min((views - 1000000) / 500000 * 10, 10)
  else if (views >= 500000) viewScore = 75 + (views - 500000) / 500000 * 15
  else if (views >= 200000) viewScore = 55 + (views - 200000) / 300000 * 20
  else if (views >= 100000) viewScore = 35 + (views - 100000) / 100000 * 20
  else if (views >= 50000) viewScore = 10 + (views - 50000) / 50000 * 25
  else viewScore = 0

  let likeScore = 0
  if (likes >= 20000) likeScore = 90 + Math.min((likes - 20000) / 10000 * 10, 10)
  else if (likes >= 10000) likeScore = 75 + (likes - 10000) / 10000 * 15
  else if (likes >= 5000) likeScore = 55 + (likes - 5000) / 5000 * 20
  else if (likes >= 2000) likeScore = 30 + (likes - 2000) / 3000 * 25
  else likeScore = 0

  let shareScore = 0
  if (shares >= 10000) shareScore = 90 + Math.min((shares - 10000) / 5000 * 10, 10)
  else if (shares >= 5000) shareScore = 75 + (shares - 5000) / 5000 * 15
  else if (shares >= 2000) shareScore = 55 + (shares - 2000) / 3000 * 20
  else if (shares >= 500) shareScore = 30 + (shares - 500) / 1500 * 25
  else shareScore = 0

  const total = Math.round(viewScore * 0.35 + likeScore * 0.35 + shareScore * 0.15 + aiScore * 0.15)
  return Math.min(total, 100)
}

const SYSTEM = `You are an AI content strategist for SOON, a Hong Kong AI media content company.
Analyse the given content reference and return ONLY valid JSON (no markdown, no code fences):
{
  "title": "concise title in Traditional Chinese or English (max 10 words)",
  "topic": "core topic theme in 3-5 Chinese/English words",
  "summary": "2-3 sentences in Traditional Chinese explaining why this could work for HK audience",
  "tags": ["tag1","tag2","tag3"],
  "aiViralBase": <number 0-100. Score based on content quality and viral potential: highly engaging/trending content = 70-90, good content = 50-70, average = 30-50, weak = below 30>,
  "scriptHook": "one punchy opening line in Traditional Chinese"
}`;

async function callClaude(url: string, desc: string, image: string | null, views: number, likes: number, shares: number, country: string) {
  const countryName = COUNTRIES[country] || country;
  let userContent: any;
  if (image) {
    const mediaType = image.startsWith('data:image/png') ? 'image/png'
      : image.startsWith('data:image/webp') ? 'image/webp' : 'image/jpeg';
    userContent = [
      { type: 'image', source: { type: 'base64', media_type: mediaType, data: image.split(',')[1] } },
      { type: 'text', text: `URL: ${url || '(none)'}\nDesc: ${desc || '(none)'}\nCountry: ${countryName}\nViews: ${views}\nLikes: ${likes}\nShares: ${shares}\nReturn JSON only.` }
    ];
  } else {
    userContent = `URL: ${url}\nDesc: ${desc || '(none)'}\nCountry: ${countryName}\nViews: ${views}\nLikes: ${likes}\nShares: ${shares}\nReturn JSON only.`;
  }
  const res = await fetch('/api/analyse', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ system: SYSTEM, messages: [{ role: 'user', content: userContent }] })
  });
  if (!res.ok) throw new Error('API ' + res.status);
  const d = await res.json();
  const text = d.content.find((b: any) => b.type === 'text')?.text || '';
  const parsed = JSON.parse(text.replace(/```json|```/g, '').trim());
  return { ...parsed, viralScore: computeViralScore(views, likes, shares, parsed.aiViralBase || 50) };
}

export default function Home() {
  const [ideas, setIdeas] = useState<any[]>([]);
  const [ideasLoading, setIdeasLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState('date');
  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState('reel');
  const [image, setImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [autoFilling, setAutoFilling] = useState(false);
  const [linkAutoFilling, setLinkAutoFilling] = useState(false);
  const [placeName, setPlaceName] = useState('');
  const [placeAddress, setPlaceAddress] = useState('');
  const [placeLat, setPlaceLat] = useState<number | null>(null);
  const [placeLng, setPlaceLng] = useState<number | null>(null);
  const [showWorldMap, setShowWorldMap] = useState(false);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [savingNote, setSavingNote] = useState<string | null>(null);
  const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>({});
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null);
  const [titleDrafts, setTitleDrafts] = useState<Record<string, string>>({});
  const [statusSteps, setStatusSteps] = useState<{ label: string; state: string }[] | null>(null);
  const [notif, setNotif] = useState<{ msg: string; type: string } | null>(null);
  const [url, setUrl] = useState('');
  const [customTitle, setCustomTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [views, setViews] = useState('');
  const [likes, setLikes] = useState('');
  const [shares, setShares] = useState('');
  const [country, setCountry] = useState('');
  const [activeNav, setActiveNav] = useState<'home' | 'work' | 'board' | 'analysis'>('home');
  const detectedPlatform = inferPlatformFromUrl(url);
  const homeRef = useRef<HTMLElement | null>(null);
  const workRef = useRef<HTMLElement | null>(null);
  const boardRef = useRef<HTMLElement | null>(null);
  const analysisRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const fetchIdeas = async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('ideas')
        .select('*')
        .order('created_at', { ascending: false })
      if (!error && data) {
        setIdeas(data.map((d: any) => ({
          id: d.id,
          type: d.type,
          url: d.url,
          thumb: d.thumb,
          views: d.views,
          likes: d.likes,
          shares: d.shares,
          country: d.country,
          date: d.date,
          title: d.title,
          topic: d.topic,
          summary: d.summary,
          tags: d.tags || [],
          viralScore: d.viral_score,
          aiViralBase: d.ai_viral_base,
          scriptHook: d.script_hook,
          lat: d.lat ?? null,
          lng: d.lng ?? null,
          notes: d.notes ?? null,
        })))
      }
      const initialNotes: Record<string, string> = {}
      if (data) {
        data.forEach((d: any) => {
          if (d.notes) initialNotes[d.id] = d.notes
        })
      }
      setNotes(initialNotes)
      setIdeasLoading(false)
    }
    fetchIdeas()
  }, [])

  function showNotif(msg: string, type = '') {
    setNotif({ msg, type });
    setTimeout(() => setNotif(null), 3000);
  }

  async function autoFillDesc() {
    if (!placeName) { showNotif('請先輸入店鋪名稱', 'error'); return; }
    setAutoFilling(true);
    try {
      const res = await fetch('/api/search-place', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: placeName, address: placeAddress }),
      });
      const d = await res.json();
      if (d.error) throw new Error(d.error);
      if (d.desc) {
        setDesc(d.desc);
        if (d.lat) setPlaceLat(d.lat);
        if (d.lng) setPlaceLng(d.lng);
        showNotif('背景資料已自動生成 ✓', 'success');
      }
    } catch (err) {
      showNotif('搜尋失敗，請手動填寫', 'error');
    }
    setAutoFilling(false);
  }

  async function autoFillFromLink() {
    if (!url.trim()) {
      showNotif('請先貼上連結', 'error');
      return;
    }

    setLinkAutoFilling(true);
    try {
      const res = await fetch('/api/autofill-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || `API ${res.status}`);

      setUrl(data.url || url);
      if (data.contentType) setSelectedType(data.contentType);
      if (data.country) setCountry(data.country);
      if (data.placeName && !placeName) setPlaceName(data.placeName);
      if (data.placeAddress && !placeAddress) setPlaceAddress(data.placeAddress);
      if (data.desc) {
        const tagSummary = Array.isArray(data.tags) && data.tags.length > 0
          ? `\n\nAI tags：${data.tags.join(' / ')}`
          : '';
        setDesc(prev => prev?.trim() ? prev : `${data.desc}${tagSummary}`);
      }
      if (data.image && !image) setImage(data.image);

      if (data.metadataBlocked) {
        showNotif('平台限制，未能直接讀到內容資料；建議補截圖或描述', 'error');
      } else {
        showNotif(data.image ? '連結資料已自動填入 ✓' : '已自動填資料，但未搵到封面，建議補截圖', data.image ? 'success' : 'error');
      }
    } catch (err) {
      console.error(err);
      showNotif('自動分析連結失敗，請手動補充', 'error');
    }
    setLinkAutoFilling(false);
  }

  async function saveIdeaToSupabase(idea: any) {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not logged in')
    const { data, error } = await supabase.from('ideas').insert({
      user_id: user.id,
      type: idea.type,
      url: idea.url,
      thumb: idea.thumb,
      views: idea.views,
      likes: idea.likes,
      shares: idea.shares,
      country: idea.country,
      date: idea.date,
      title: idea.title,
      topic: idea.topic,
      summary: idea.summary,
      tags: idea.tags,
      viral_score: idea.viralScore,
      ai_viral_base: idea.aiViralBase || 50,
      script_hook: idea.scriptHook,
      lat: idea.lat ?? null,
      lng: idea.lng ?? null,
      notes: idea.notes ?? null,
    }).select().single()
    if (error) throw error
    return data
  }

  async function deleteIdeaFromSupabase(id: any) {
    const supabase = createClient()
    await supabase.from('ideas').delete().eq('id', id)
  }

  async function saveNote(id: any, note: string) {
    setSavingNote(id)
    const supabase = createClient()
    await supabase.from('ideas').update({ notes: note }).eq('id', id)
    setSavingNote(null)
  }

  async function saveIdeaTitle(id: string, title: string) {
    const nextTitle = title.trim()
    if (!nextTitle) {
      showNotif('題目不可留空', 'error')
      return
    }
    const supabase = createClient()
    const { error } = await supabase.from('ideas').update({ title: nextTitle }).eq('id', id)
    if (error) {
      showNotif('更新題目失敗，請重試', 'error')
      return
    }
    setIdeas(prev => prev.map(idea => idea.id === id ? { ...idea, title: nextTitle } : idea))
    setEditingTitleId(null)
    showNotif('題目已更新 ✓', 'success')
  }

  async function handleSubmit() {
    if (isLoading) return;
    if (!url && !image && !desc) { showNotif('請輸入 URL、上載截圖或輸入描述', 'error'); return; }
    setIsLoading(true);
    setStatusSteps([
      { label: '讀取內容', state: 'active' },
      { label: 'AI 分析主題', state: '' },
      { label: '計算爆款評分', state: '' },
      { label: '儲存', state: '' }
    ]);
    try {
      setStatusSteps([
        { label: '讀取內容', state: 'done' },
        { label: 'AI 分析主題', state: 'active' },
        { label: '計算爆款評分', state: '' },
        { label: '儲存', state: '' }
      ]);
      const analysis = await callClaude(url, desc, image, +views || 0, +likes || 0, +shares || 0, country);
      setStatusSteps([
        { label: '讀取內容', state: 'done' },
        { label: 'AI 分析主題', state: 'done' },
        { label: '計算爆款評分', state: 'done' },
        { label: '儲存中...', state: 'active' }
      ]);
      let finalLat = placeLat
      let finalLng = placeLng
      if (!finalLat && !finalLng && (placeName || analysis.title)) {
        try {
          const geoQuery = encodeURIComponent([placeName, placeAddress, COUNTRIES[country] || country].filter(Boolean).join(' '))
          const geoRes = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${geoQuery}&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}`)
          const geoData = await geoRes.json()
          if (geoData.status === 'OK' && geoData.results[0]) {
            finalLat = geoData.results[0].geometry.location.lat
            finalLng = geoData.results[0].geometry.location.lng
          }
        } catch (e) { /* silent fail */ }
      }
      const ideaData = {
        type: selectedType,
        url,
        thumb: image,
        views: +views || 0,
        likes: +likes || 0,
        shares: +shares || 0,
        country: country || 'OTHER',
        date: new Date().toISOString(),
        lat: finalLat,
        lng: finalLng,
        notes: desc || null,
        ...analysis,
        title: customTitle.trim() || analysis.title,
      };
      const saved = await saveIdeaToSupabase(ideaData)
      setIdeas(prev => [{ ...ideaData, id: saved.id }, ...prev]);
      setStatusSteps([
        { label: '讀取內容', state: 'done' },
        { label: 'AI 分析主題', state: 'done' },
        { label: '計算爆款評分', state: 'done' },
        { label: '儲存完成', state: 'done' }
      ]);
      showNotif('想法已儲存 ✓', 'success');
      setUrl(''); setCustomTitle(''); setDesc(''); setViews(''); setLikes(''); setShares(''); setCountry(''); setImage(null); setPlaceName(''); setPlaceAddress(''); setPlaceLat(null); setPlaceLng(null);
      setTimeout(() => setStatusSteps(null), 2500);
    } catch (err) {
      console.error(err);
      showNotif('儲存失敗，請重試', 'error');
      setStatusSteps(null);
    }
    setIsLoading(false);
  }

  const filtered = ideas
    .filter(i => {
      if (filter.startsWith('country-')) return i.country === filter.replace('country-', '');
      if (filter !== 'all') return i.type === filter;
      return true;
    })
    .filter(i => {
      if (!search) return true;
      const hay = [i.title, i.topic, i.summary, ...(i.tags || []), COUNTRIES[i.country] || ''].join(' ').toLowerCase();
      return hay.includes(search.toLowerCase());
    })
    .sort((a, b) =>
      sort === 'viral' ? (b.viralScore || 0) - (a.viralScore || 0) :
      sort === 'views' ? (b.views || 0) - (a.views || 0) :
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );

  const totalViews = ideas.reduce((s, i) => s + (i.views || 0), 0);
  const avgViral = ideas.length ? Math.round(ideas.reduce((s, i) => s + (i.viralScore || 0), 0) / ideas.length) : 0;
  const countryCount = new Set(ideas.map(i => i.country).filter(Boolean)).size;
  const topIdea = filtered[0] || ideas[0] || null;
  const mappedCountries = Array.from(new Set(filtered.map(i => i.country).filter(Boolean))).slice(0, 6);
  const pendingFields = [url, desc, country, views, likes, shares].filter(Boolean).length;

  const typeBadge: Record<string, string> = { reel: 'badge-reel', blog: 'badge-blog', social: 'badge-social' };
  const typeLabel: Record<string, string> = { reel: 'IG Reel', blog: 'Blog', social: 'Social' };
  const filterLabel = filter === 'all' ? '所有想法' :
    filter.startsWith('country-') ? (COUNTRIES[filter.replace('country-', '')] || '') + ' 的想法' :
    { reel: 'IG Reel', blog: '文章 / Blog', social: 'Social Post' }[filter] || filter;

  function jumpTo(section: 'home' | 'work' | 'board' | 'analysis') {
    setActiveNav(section);
    const target =
      section === 'home' ? homeRef.current :
      section === 'work' ? workRef.current :
      section === 'board' ? boardRef.current :
      analysisRef.current;
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,500;1,400&family=DM+Sans:wght@300;400;500&display=swap" rel="stylesheet" />
      <style>{CSS}</style>

      <div className="workspace-shell">
        <aside className="sidebar">
          <div className="sidebar-top">
            <button className="workspace-chip" onClick={() => jumpTo('home')} type="button">
              <span className="workspace-chip-logo">SOON</span>
              <span>Idea Brainstorm</span>
            </button>
            <div className="workspace-sub">SOON 內部題材系統</div>
          </div>

          <div className="sidebar-nav">
            <button className={`sidebar-nav-item${activeNav === 'home' ? ' active' : ''}`} onClick={() => jumpTo('home')} type="button">首頁</button>
            <button className={`sidebar-nav-item${activeNav === 'work' ? ' active' : ''}`} onClick={() => jumpTo('work')} type="button">我的工作</button>
            <button className={`sidebar-nav-item${activeNav === 'board' ? ' active' : ''}`} onClick={() => jumpTo('board')} type="button">題材板</button>
            <button className={`sidebar-nav-item${activeNav === 'analysis' ? ' active' : ''}`} onClick={() => jumpTo('analysis')} type="button">近期分析</button>
          </div>

          <div className="sidebar-section-title">快速輸入</div>

          <div className="step-block">
            <span className="step-num">01</span>
            <span className="step-label">URL / Link</span>
            <div style={{ position: 'relative' }}>
              <input className="field" type="url" placeholder="例：https://www.instagram.com/reel/…" value={url} onChange={e => setUrl(e.target.value)} style={{ paddingRight: 112 }} />
              <button
                onClick={autoFillFromLink}
                disabled={linkAutoFilling || !url.trim()}
                style={{
                  position: 'absolute', top: 7, right: 8,
                  fontSize: 10, padding: '6px 10px',
                  background: 'linear-gradient(135deg,#4b89ff,#7b61ff)', color: '#fff',
                  border: 'none', borderRadius: 12,
                  cursor: linkAutoFilling || !url.trim() ? 'not-allowed' : 'pointer',
                  opacity: !url.trim() ? 0.4 : 1,
                  fontFamily: 'var(--sans)',
                  letterSpacing: '0.05em',
                  whiteSpace: 'nowrap',
                }}
              >
                {linkAutoFilling ? '分析中...' : '✦ 自動分析'}
              </button>
            </div>
            {detectedPlatform && (
              <div style={{ fontSize: 10, color: 'var(--text3)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>{PLATFORM_META[detectedPlatform]?.emoji || '🌐'}</span>
                <span>已偵測平台：{PLATFORM_META[detectedPlatform]?.label || detectedPlatform}</span>
              </div>
            )}
            <div style={{ fontSize: 10, color: 'var(--text3)', lineHeight: 1.6 }}>
              平台如果限制 metadata，請直接上載截圖或封面。AI 會根據連結與截圖預填資料，但仍建議人手覆核。
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input className="field" placeholder="店鋪 / 品牌名稱" value={placeName} onChange={e => setPlaceName(e.target.value)} style={{ flex: 2 }} />
              <input className="field" placeholder="地址（選填）" value={placeAddress} onChange={e => setPlaceAddress(e.target.value)} style={{ flex: 3 }} />
            </div>
            <div style={{ position: 'relative' }}>
              <textarea className="field" rows={2} placeholder="片嘅描述（補充 AI 分析）" value={desc} onChange={e => setDesc(e.target.value)} style={{ paddingBottom: 28 }} />
              <button
                onClick={autoFillDesc}
                disabled={autoFilling || !placeName}
                style={{
                  position: 'absolute', bottom: 8, right: 8,
                  fontSize: 10, padding: '3px 10px',
                  background: 'rgba(255,255,255,0.1)', color: '#fff',
                  border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10,
                  cursor: autoFilling || !placeName ? 'not-allowed' : 'pointer',
                  opacity: !placeName ? 0.4 : 1,
                  fontFamily: 'var(--sans)',
                  letterSpacing: '0.05em',
                  whiteSpace: 'nowrap',
                }}
              >
                {autoFilling ? '搜尋中...' : '✦ AI 搜尋'}
              </button>
            </div>
          </div>

          <div className="divider" />

          <div className="step-block">
            <span className="step-num">02</span>
            <span className="step-label">自設題目</span>
            <input
              className="field"
              placeholder="如果你有想法，可以自己寫題目；留空就由 AI 生成"
              value={customTitle}
              onChange={e => setCustomTitle(e.target.value)}
            />
            <div style={{ fontSize: 10, color: 'var(--text3)', lineHeight: 1.6 }}>
              有填會優先用你嘅題目；冇填就由 AI 幫你生成。
            </div>
          </div>

          <div className="divider" />

          <div className="step-block">
            <span className="step-num">03</span>
            <span className="step-label">數據</span>
            <div className="stats-row">
              <div className="stat-block">
                <span className="stat-label">Views</span>
                <input className="field" type="number" min="0" placeholder="例：1200000" value={views} onChange={e => setViews(e.target.value)} />
              </div>
              <div className="stat-block">
                <span className="stat-label">Likes</span>
                <input className="field" type="number" min="0" placeholder="例：36000" value={likes} onChange={e => setLikes(e.target.value)} />
              </div>
              <div className="stat-block">
                <span className="stat-label">Save</span>
                <input className="field" type="number" min="0" placeholder="例：48000" value={shares} onChange={e => setShares(e.target.value)} />
              </div>
            </div>
          </div>

          <div className="divider" />

          <div className="step-block">
            <span className="step-num">04</span>
            <span className="step-label">國家 / 地區</span>
            <select className="field" value={country} onChange={e => setCountry(e.target.value)}>
              <option value="">— 請選擇 —</option>
              <optgroup label="亞洲">
                <option value="HK">🇭🇰 香港</option><option value="TW">🇹🇼 台灣</option>
                <option value="CN">🇨🇳 中國內地</option><option value="JP">🇯🇵 日本</option>
                <option value="KR">🇰🇷 韓國</option><option value="SG">🇸🇬 新加坡</option>
                <option value="TH">🇹🇭 泰國</option><option value="MY">🇲🇾 馬來西亞</option>
                <option value="ID">🇮🇩 印尼</option><option value="VN">🇻🇳 越南</option>
                <option value="IN">🇮🇳 印度</option>
              </optgroup>
              <optgroup label="西方">
                <option value="US">🇺🇸 美國</option><option value="GB">🇬🇧 英國</option>
                <option value="AU">🇦🇺 澳洲</option><option value="CA">🇨🇦 加拿大</option>
                <option value="FR">🇫🇷 法國</option><option value="DE">🇩🇪 德國</option>
              </optgroup>
              <option value="OTHER">🌍 其他</option>
            </select>
          </div>

          <div className="divider" />

          <div className="step-block">
            <span className="step-num">05</span>
            <span className="step-label">內容類型</span>
            <div className="chips">
              {['reel', 'blog', 'social'].map(t => (
                <button key={t} className={`chip${selectedType === t ? ' sel' : ''}`} onClick={() => setSelectedType(t)}>
                  {t === 'reel' ? 'IG Reel' : t === 'blog' ? '文章 / Blog' : 'Social Post'}
                </button>
              ))}
            </div>
          </div>

          {statusSteps && (
            <div className="ai-status visible">
              {statusSteps.map((s, i) => (
                <div key={i} className={`step ${s.state}`}>
                  <div className="step-dot" />
                  <span>{s.label}</span>
                </div>
              ))}
            </div>
          )}

          <button className="btn-submit" onClick={handleSubmit} disabled={isLoading}>
            {isLoading ? <><span className="spinner" /> 分析中…</> : '分析並儲存想法'}
          </button>

          <div className="sidebar-footer-card">
            <div className="sidebar-footer-eyebrow">當前進度</div>
            <div className="sidebar-footer-number">{pendingFields}/6</div>
            <div className="sidebar-footer-copy">已填寫欄位愈完整，AI 生成結果愈穩定。</div>
          </div>
        </aside>

        <main className="main-panel">
          <div className="workspace-header">
            <div>
              <div className="brand-label">SOON 創意營運</div>
              <h1 className="page-title">IG reel 題材靈感工作台</h1>
              <div className="header-meta">{ideasLoading ? '正在同步資料...' : `目前已整理 ${ideas.length} 個靈感素材`}</div>
            </div>
            <div className="workspace-actions">
              <button className="ghost-top-btn" onClick={()=>setShowWorldMap(v=>!v)}>
                {showWorldMap ? '收起地圖' : '打開地圖'}
              </button>
              <button className="primary-top-btn" onClick={handleSubmit} disabled={isLoading}>
                {isLoading ? '分析中…' : '新增想法'}
              </button>
            </div>
          </div>

          <section className="hero-row" ref={homeRef}>
            <div className="hero-card hero-card-primary">
              <div className="hero-eyebrow">今日概況</div>
              <div className="hero-title">集中管理連結、AI 分析與題材方向，讓前期研究更像真正工作台。</div>
              <div className="hero-copy">由連結自動分析、地區標記、爆款評分到腳本前置筆記，全部可直接留在同一個內部 board 裡處理。</div>
            </div>

            <div className="stat-grid">
              <div className="stat-card"><span>已收錄想法</span><strong>{ideas.length}</strong></div>
              <div className="stat-card"><span>總 Views</span><strong>{fmtNum(totalViews)}</strong></div>
              <div className="stat-card"><span>平均爆款分</span><strong>{avgViral}</strong></div>
              <div className="stat-card"><span>地區數量</span><strong>{countryCount}</strong></div>
            </div>
          </section>

          <section className="board-toolbar" ref={boardRef}>
            <div className="gallery-title">{filterLabel} · {filtered.length} 個</div>
            <div className="controls">
              <input className="search-field" placeholder="搜尋題目、主題、標籤…" value={search} onChange={e => setSearch(e.target.value)} />
              <select className="sort-select" value={sort} onChange={e => setSort(e.target.value)}>
                <option value="date">最新優先</option>
                <option value="viral">爆款評分</option>
                <option value="views">Views 最多</option>
              </select>
            </div>
          </section>

          {showWorldMap && filtered.length > 0 && (
            <div className="map-panel">
              <iframe
                src={`https://www.google.com/maps/embed/v1/search?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&q=${encodeURIComponent(filtered.filter((i:any)=>i.lat&&i.lng).length > 0 ? filtered.filter((i:any)=>i.lat&&i.lng).map((i:any)=>i.title).slice(0,5).join("|") : filtered.map((i:any)=>i.title).slice(0,3).join("|"))}`}
                width="100%" height="320" style={{border:0,display:"block"}} allowFullScreen
              />
            </div>
          )}

          <div className="filter-strip">
            {['all', 'reel', 'blog', 'social'].map(f => (
              <button key={f} className={`filter-btn${filter === f ? ' active' : ''}`} onClick={() => setFilter(f)}>
                {f === 'all' ? '全部' : f === 'reel' ? 'IG Reel' : f === 'blog' ? '文章 / Blog' : 'Social'}
              </button>
            ))}
            <span className="filter-divider" />
            {['HK', 'TW', 'JP', 'KR', 'US'].map(c => (
              <button key={c} className={`filter-btn${filter === 'country-' + c ? ' active' : ''}`} onClick={() => setFilter('country-' + c)}>
                {COUNTRIES[c].split(' ')[0]} {c}
              </button>
            ))}
          </div>

          <div className="content-grid">
            <section className="board-panel" ref={workRef}>
              {ideasLoading ? (
                <div className="empty-state">
                  <div className="empty-title">載入中...</div>
                </div>
              ) : filtered.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-title">{ideas.length ? '沒有符合條件的想法' : '尚未儲存任何想法'}</div>
                  <div className="empty-sub">{ideas.length ? '試試其他篩選或搜尋' : '貼入連結、補上描述，AI 便會為你整理成內部題材卡。'}</div>
                </div>
              ) : (
                <div className="list-wrap">
                  <div className="list-head">
                    <div>題材</div>
                    <div>爆款指數</div>
                    <div>數據</div>
                    <div>參考影片</div>
                    <div>操作</div>
                  </div>
                  <div className="idea-list">
                    {filtered.map(idea => {
                      const vs = idea.viralScore || 0;
                      const viralColor = vs >= 70 ? '#7b61ff' : vs >= 40 ? '#35c98f' : '#4b89ff';
                      const noteContent = notes[idea.id] !== undefined ? notes[idea.id] : (idea.notes || idea.summary || '');
                      const scriptUrl = `${SCRIPT_GEN_URL}?topic=${encodeURIComponent(idea.title || '')}&background=${encodeURIComponent(noteContent)}`;
                      const platform = inferPlatformFromUrl(idea.url || '');
                      return (
                        <div key={idea.id} className="idea-row-group">
                          <div className="idea-row">
                            <div className="idea-main">
                              <div className="idea-main-copy">
                                {idea.topic && <div className="idea-topic">{idea.topic}</div>}
                                {editingTitleId === idea.id ? (
                                  <div className="title-edit-wrap">
                                    <input
                                      className="field"
                                      value={titleDrafts[idea.id] ?? idea.title ?? ''}
                                      onChange={e => setTitleDrafts(prev => ({ ...prev, [idea.id]: e.target.value }))}
                                      onKeyDown={async e => {
                                        if (e.key === 'Enter') {
                                          await saveIdeaTitle(idea.id, titleDrafts[idea.id] ?? idea.title ?? '')
                                        }
                                        if (e.key === 'Escape') {
                                          setEditingTitleId(null)
                                        }
                                      }}
                                    />
                                    <div className="title-edit-actions">
                                      <button className="row-action-btn" onClick={async () => {
                                        await saveIdeaTitle(idea.id, titleDrafts[idea.id] ?? idea.title ?? '')
                                      }}>儲存</button>
                                      <button className="row-action-btn" onClick={() => setEditingTitleId(null)}>取消</button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="idea-title-row">
                                    <div className="idea-title">{idea.title || '未命名'}</div>
                                    <button
                                      className="title-edit-btn"
                                      onClick={() => {
                                        setEditingTitleId(idea.id)
                                        setTitleDrafts(prev => ({ ...prev, [idea.id]: idea.title || '' }))
                                      }}
                                    >
                                      編輯
                                    </button>
                                  </div>
                                )}
                                {idea.summary && <div className="idea-summary">{idea.summary}</div>}
                                <div className="idea-badges">
                                  {platform && (
                                    <span className="badge badge-country">
                                      {PLATFORM_META[platform]?.emoji || '🌐'} {PLATFORM_META[platform]?.label || platform}
                                    </span>
                                  )}
                                  <span className={`badge ${typeBadge[idea.type] || 'badge-reel'}`}>{typeLabel[idea.type] || idea.type}</span>
                                  {idea.country && <span className="badge badge-country">{COUNTRIES[idea.country] || idea.country}</span>}
                                  {idea.tags?.slice(0, 3).map((t: string) => <span key={t} className="tag">{t}</span>)}
                                </div>
                              </div>
                            </div>

                            <div className="idea-score-cell">
                              <div className="score-pill">{vs}</div>
                              <div className="viral-row wide">
                                <span className="viral-label">爆款指數</span>
                                <div className="viral-bar"><div className="viral-fill" style={{ width: vs + '%', background: viralColor }} /></div>
                              </div>
                            </div>

                            <div className="idea-metrics">
                              <div className="metric-box">
                                <div className="metric-value">{fmtNum(idea.views || 0)}</div>
                                <div className="metric-key">Views</div>
                              </div>
                              <div className="metric-box">
                                <div className="metric-value">{fmtNum(idea.likes || 0)}</div>
                                <div className="metric-key">Likes</div>
                              </div>
                              <div className="metric-box">
                                <div className="metric-value">{fmtNum(idea.shares || 0)}</div>
                                <div className="metric-key">Save</div>
                              </div>
                            </div>

                            <div className="idea-meta">
                              {idea.url && <a className="video-link-btn" href={idea.url} target="_blank" rel="noopener">{PLATFORM_META[platform]?.label || '影片'} →</a>}
                              <a className="btn-script btn-script-meta" href={scriptUrl} target="_blank" rel="noopener">推上劇本生成</a>
                              {idea.url && <a className="card-source" href={idea.url} target="_blank" rel="noopener">{hostOf(idea.url)}</a>}
                              <span className="card-date">{new Date(idea.date).toLocaleDateString('zh-HK', { month: 'short', day: 'numeric' })}</span>
                            </div>

                            <div className="idea-actions">
                              <button onClick={()=>setExpandedNotes(prev=>({...prev,[idea.id]:!prev[idea.id]}))} className="row-action-btn">
                                {expandedNotes[idea.id] ? '▴ 收起詳情' : '▾ 詳情'}
                              </button>
                              <button className="card-delete row-delete" onClick={async () => {
                                setIdeas(prev => prev.filter(i => i.id !== idea.id));
                                await deleteIdeaFromSupabase(idea.id);
                              }}>×</button>
                            </div>
                          </div>

                          {expandedNotes[idea.id] && (
                            <div className="idea-expanded">
                              <div className="idea-expanded-grid">
                                <div>
                                  <div className="expanded-label">詳細內容</div>
                                  <textarea
                                    className="field"
                                    rows={5}
                                    style={{fontSize:11,lineHeight:1.6,resize:'vertical'}}
                                    value={noteContent}
                                    onChange={e => setNotes(prev => ({...prev, [idea.id]: e.target.value}))}
                                    onBlur={e => saveNote(idea.id, e.target.value)}
                                    placeholder="加入筆記、補充資料、拍攝角度...（失焦自動儲存）"
                                  />
                                  <div className="expanded-save-state">
                                    {savingNote === idea.id ? '儲存中...' : notes[idea.id] !== undefined ? '✓ 已儲存' : ''}
                                  </div>
                                </div>

                                <div className="idea-expanded-side">
                                  {idea.scriptHook && <div className="hook-quote">「{idea.scriptHook}」</div>}
                                  {idea.lat && idea.lng && (
                                    <div style={{borderRadius:"18px",overflow:"hidden",border:"1px solid rgba(255,255,255,0.08)"}}>
                                      <iframe
                                        src={`https://www.google.com/maps/embed/v1/place?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&q=${idea.lat},${idea.lng}&zoom=15`}
                                        width="100%" height="140" style={{border:0,display:"block"}} allowFullScreen
                                      />
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </section>

            <aside className="right-rail" ref={analysisRef}>
              <div className="rail-card">
                <div className="rail-eyebrow">精選摘要</div>
                <div className="rail-title">{topIdea?.title || '等待第一個題材進入系統'}</div>
                <div className="rail-copy">{topIdea?.summary || '當你儲存第一個想法之後，右側會自動顯示優先關注的題材摘要。'}</div>
              </div>

              <div className="rail-card">
                <div className="rail-eyebrow">常用地區</div>
                <div className="rail-chip-wrap">
                  {mappedCountries.length ? mappedCountries.map(code => (
                    <span key={code} className="rail-chip">{COUNTRIES[code] || code}</span>
                  )) : <span className="rail-muted">尚未有地區資料</span>}
                </div>
              </div>

              <div className="rail-card">
                <div className="rail-eyebrow">工作建議</div>
                <div className="rail-list">
                  <div className="rail-list-item">先用「自動分析」讀取連結，再補上店鋪背景，AI 會更易生成貼地題材。</div>
                  <div className="rail-list-item">爆款分高但主題分散的內容，可以先記錄在筆記區，之後再交給劇本生成器延伸。</div>
                  <div className="rail-list-item">如果是跨地區題材，建議同時開地圖檢查題材來源分布。</div>
                </div>
              </div>
            </aside>
          </div>
        </main>
      </div>

      {notif && (
        <div className={`notif show${notif.type ? ' ' + notif.type : ''}`}>{notif.msg}</div>
      )}
    </>
  );
}

const CSS = `
:root{--bg:#15192c;--surface:#232744;--surface2:#2b3154;--surface3:#353d63;--surface4:#1a1f38;--text:#f6f8ff;--text2:#d3daf2;--text3:#96a1c4;--border:rgba(255,255,255,0.08);--border2:rgba(255,255,255,0.14);--tag-bg:rgba(255,255,255,0.08);--radius:14px;--radius-md:20px;--serif:'EB Garamond',Georgia,serif;--sans:'DM Sans',sans-serif}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{background:var(--bg);color:var(--text);font-family:var(--sans);font-size:14px;font-weight:300;line-height:1.65;min-height:100vh}
.workspace-shell{display:grid;grid-template-columns:320px minmax(0,1fr);min-height:calc(100vh - 60px);background:radial-gradient(circle at top right, rgba(123,97,255,0.14), transparent 28%),linear-gradient(180deg,#171b31 0%, #14182a 100%)}
.sidebar{background:linear-gradient(180deg,#1f2340 0%,#1b2038 100%);border-right:1px solid var(--border);padding:22px 18px;display:flex;flex-direction:column;gap:18px;position:sticky;top:60px;height:calc(100vh - 60px);overflow-y:auto}
.sidebar-top{padding:10px 8px 2px}
.workspace-chip{display:inline-flex;align-items:center;gap:10px;padding:10px 14px;border-radius:16px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);font-size:13px;font-weight:500;color:var(--text);cursor:pointer}
.workspace-chip-logo{display:inline-flex;align-items:center;justify-content:center;padding:6px 8px;border-radius:10px;background:linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03));border:1px solid rgba(255,255,255,0.08);font-size:10px;font-weight:800;letter-spacing:0.12em;line-height:1}
.workspace-sub{margin-top:10px;font-size:12px;color:var(--text3)}
.sidebar-nav{display:grid;gap:6px}
.sidebar-nav-item{padding:11px 14px;border:none;border-radius:12px;background:transparent;color:var(--text3);text-align:left;font-family:var(--sans);font-size:13px;cursor:pointer}
.sidebar-nav-item.active,.sidebar-nav-item:hover{background:rgba(123,97,255,0.16);color:var(--text)}
.sidebar-section-title{font-size:11px;font-weight:500;letter-spacing:0.12em;text-transform:uppercase;color:var(--text3);padding:0 8px}
.brand-label{font-size:10px;font-weight:500;letter-spacing:0.18em;text-transform:uppercase;color:var(--text3)}
.page-title{font-family:var(--serif);font-size:36px;font-weight:500;line-height:1.05;color:var(--text);letter-spacing:-0.02em}
.header-meta{font-size:13px;color:var(--text3);font-weight:300;margin-top:8px}
.main-panel{padding:24px;display:flex;flex-direction:column;gap:18px}
.workspace-header{display:flex;justify-content:space-between;align-items:flex-start;gap:18px;flex-wrap:wrap}
.workspace-actions{display:flex;gap:10px;align-items:center}
.ghost-top-btn,.primary-top-btn{border:none;border-radius:14px;padding:12px 16px;font-family:var(--sans);font-size:13px;cursor:pointer}
.ghost-top-btn{background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);color:var(--text)}
.primary-top-btn{background:linear-gradient(135deg,#4b89ff,#7b61ff);color:white;box-shadow:0 10px 20px rgba(75,137,255,0.2)}
.hero-row{display:grid;grid-template-columns:minmax(0,1.2fr) 380px;gap:18px}
.hero-card{border-radius:24px;border:1px solid var(--border);padding:24px}
.hero-card-primary{background:linear-gradient(135deg, rgba(75,137,255,0.2), rgba(123,97,255,0.22) 45%, rgba(255,255,255,0.04) 100%)}
.hero-eyebrow{font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#b7c2e6;margin-bottom:12px}
.hero-title{font-size:28px;line-height:1.15;font-weight:500;max-width:720px}
.hero-copy{margin-top:12px;color:var(--text2);max-width:760px}
.stat-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.stat-card{background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:20px;padding:18px;display:flex;flex-direction:column;gap:8px}
.stat-card span{font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:var(--text3)}
.stat-card strong{font-size:28px;line-height:1;font-family:var(--serif);font-weight:500}
.board-toolbar{display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap;margin-top:4px}
.gallery-title{font-family:var(--serif);font-size:18px;color:var(--text);font-style:italic}
.controls{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.filter-strip{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
.filter-divider{width:1px;height:18px;background:var(--border2);margin:0 4px}
.content-grid{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:18px;align-items:start}
.board-panel{min-width:0}
.right-rail{display:grid;gap:14px;position:sticky;top:84px}
.rail-card{background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:20px;padding:18px}
.rail-eyebrow{font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:var(--text3);margin-bottom:10px}
.rail-title{font-size:20px;line-height:1.2;font-weight:500}
.rail-copy{font-size:13px;line-height:1.7;color:var(--text2);margin-top:10px}
.rail-chip-wrap{display:flex;gap:8px;flex-wrap:wrap}
.rail-chip{padding:7px 10px;border-radius:999px;background:rgba(255,255,255,0.07);font-size:12px;color:var(--text2)}
.rail-muted{font-size:13px;color:var(--text3)}
.rail-list{display:grid;gap:10px}
.rail-list-item{padding:12px 14px;border-radius:14px;background:rgba(255,255,255,0.04);color:var(--text2);font-size:13px;line-height:1.65}
.sidebar-footer-card{padding:16px;border-radius:18px;background:linear-gradient(135deg,rgba(75,137,255,0.14),rgba(123,97,255,0.18));border:1px solid rgba(123,97,255,0.22);margin-top:auto}
.sidebar-footer-eyebrow{font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#c8d1f0}
.sidebar-footer-number{font-size:34px;line-height:1;font-family:var(--serif);margin:8px 0}
.sidebar-footer-copy{font-size:13px;color:var(--text2);line-height:1.6}
.step-block{display:flex;flex-direction:column;gap:10px}
.step-num{font-size:10px;font-weight:500;letter-spacing:0.12em;color:var(--text3)}
.step-label{font-family:var(--serif);font-size:18px;font-weight:500;color:var(--text);line-height:1.2;margin-top:-2px}
.field{width:100%;padding:11px 14px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.08);border-radius:14px;color:var(--text);font-family:var(--sans);font-size:13px;font-weight:300;outline:none;transition:border-color 0.2s, background 0.2s;resize:none;appearance:none;-webkit-appearance:none}
.field:focus{border-color:rgba(123,97,255,0.42);background:rgba(255,255,255,0.09)}
.field::placeholder{color:var(--text3)}
select.field{cursor:pointer;background-image:url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%2396a1c4' stroke-width='1.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 12px center;padding-right:32px}
.stats-row{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px}
.stat-block{display:flex;flex-direction:column;gap:6px}
.stat-label{font-size:10px;font-weight:500;letter-spacing:0.1em;text-transform:uppercase;color:var(--text3)}
.chips{display:flex;flex-wrap:wrap;gap:6px}
.chip{padding:7px 14px;border-radius:999px;border:1px solid rgba(255,255,255,0.14);background:transparent;color:var(--text2);font-family:var(--sans);font-size:12px;font-weight:400;cursor:pointer;transition:all 0.15s}
.chip:hover{background:rgba(255,255,255,0.06);color:var(--text)}
.chip.sel{background:linear-gradient(135deg,#4b89ff,#7b61ff);color:#fff;border-color:transparent}
.divider{height:1px;background:var(--border);margin:0 -18px}
.ai-status{padding:14px 16px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);border-radius:16px;font-size:12px;color:var(--text2);line-height:1.9}
.ai-status .step{display:flex;align-items:center;gap:8px}
.step-dot{width:6px;height:6px;border-radius:50%;flex-shrink:0;background:var(--border2);transition:background 0.3s}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
.step.done .step-dot{background:#5a8a6a}
.step.active .step-dot{background:var(--text);animation:pulse 1s ease-in-out infinite}
.step.done{color:var(--text3)}.step.active{color:var(--text);font-weight:400}
.btn-submit{width:100%;padding:13px 20px;background:linear-gradient(135deg,#4b89ff,#7b61ff);border:none;border-radius:16px;color:white;font-family:var(--sans);font-size:13px;font-weight:500;letter-spacing:0.02em;cursor:pointer;transition:opacity 0.2s;display:flex;align-items:center;justify-content:center;gap:10px;box-shadow:0 10px 20px rgba(75,137,255,0.18)}
.btn-submit:hover{opacity:0.82}.btn-submit:disabled{opacity:0.35;cursor:not-allowed}
.spinner{width:14px;height:14px;border:1.5px solid rgba(255,255,255,0.25);border-top-color:rgba(255,255,255,0.9);border-radius:50%;animation:spin 0.7s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
.filter-btn{padding:7px 14px;border-radius:999px;border:1px solid var(--border2);background:transparent;color:var(--text3);font-family:var(--sans);font-size:11px;font-weight:500;letter-spacing:0.05em;cursor:pointer;transition:all 0.15s;text-transform:uppercase}
.filter-btn:hover{color:var(--text)}.filter-btn.active{background:var(--text);color:var(--bg);border-color:var(--text)}
.search-field{padding:9px 14px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.08);border-radius:14px;color:var(--text);font-family:var(--sans);font-size:12px;font-weight:300;outline:none;width:220px;transition:border-color 0.2s}
.search-field:focus{border-color:var(--border2)}.search-field::placeholder{color:var(--text3)}
.sort-select{padding:9px 32px 9px 12px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.08);border-radius:14px;color:var(--text2);font-family:var(--sans);font-size:11px;font-weight:300;outline:none;appearance:none;-webkit-appearance:none;cursor:pointer;background-image:url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%2396a1c4' stroke-width='1.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 10px center}
.map-panel{margin-bottom:4px;border-radius:20px;overflow:hidden;border:1px solid rgba(255,255,255,0.08)}
.list-wrap{border:1px solid rgba(255,255,255,0.08);border-radius:22px;overflow:hidden;background:rgba(255,255,255,0.04);backdrop-filter:blur(6px)}
.list-head{display:grid;grid-template-columns:minmax(320px,1.8fr) minmax(180px,0.9fr) minmax(180px,0.9fr) minmax(140px,0.8fr) minmax(180px,0.9fr);gap:16px;padding:12px 16px;background:rgba(255,255,255,0.05);border-bottom:1px solid rgba(255,255,255,0.08);font-size:10px;font-weight:500;letter-spacing:0.12em;text-transform:uppercase;color:var(--text3)}
.idea-list{display:flex;flex-direction:column}
.idea-row-group{border-bottom:1px solid rgba(255,255,255,0.08)}
.idea-row-group:last-child{border-bottom:none}
.idea-row{display:grid;grid-template-columns:minmax(320px,1.8fr) minmax(180px,0.9fr) minmax(180px,0.9fr) minmax(140px,0.8fr) minmax(180px,0.9fr);gap:16px;padding:16px;background:transparent;align-items:center}
.idea-row:hover{background:rgba(255,255,255,0.03)}
.idea-main{display:flex;align-items:flex-start;gap:14px;min-width:0}
.idea-main-copy{min-width:0;display:flex;flex-direction:column;gap:5px}
.idea-topic{font-size:10px;font-weight:500;letter-spacing:0.08em;text-transform:uppercase;color:var(--text3)}
.idea-title-row{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.idea-title{font-family:var(--serif);font-size:22px;font-weight:500;color:var(--text);line-height:1.15;letter-spacing:-0.02em}
.title-edit-btn{font-size:10px;font-weight:500;letter-spacing:0.06em;padding:6px 10px;background:none;border:1px solid rgba(255,255,255,0.14);color:var(--text2);border-radius:12px;cursor:pointer;font-family:var(--sans)}
.title-edit-btn:hover{background:rgba(255,255,255,0.08);color:var(--text)}
.title-edit-wrap{display:flex;flex-direction:column;gap:8px}
.title-edit-actions{display:flex;gap:8px}
.idea-summary{font-size:12px;color:var(--text2);line-height:1.5;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.idea-badges{display:flex;gap:6px;flex-wrap:wrap;margin-top:2px}
.idea-score-cell{display:flex;flex-direction:column;gap:10px}
.score-pill{display:inline-flex;align-items:center;justify-content:center;min-width:54px;padding:6px 10px;border-radius:999px;background:rgba(123,97,255,0.18);font-family:var(--serif);font-size:22px;font-weight:500;color:var(--text)}
.viral-row.wide{gap:8px}
.idea-metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
.metric-box{padding:10px;border:1px solid rgba(255,255,255,0.08);border-radius:14px;background:rgba(255,255,255,0.04)}
.metric-value{font-family:var(--serif);font-size:18px;font-weight:500;color:var(--text)}
.metric-key{font-size:9px;font-weight:500;letter-spacing:0.1em;text-transform:uppercase;color:var(--text3)}
.idea-meta{display:flex;flex-direction:column;gap:8px}
.idea-actions{display:flex;align-items:center;justify-content:flex-end;gap:8px;flex-wrap:wrap}
.row-action-btn{font-size:10px;font-weight:500;letter-spacing:0.06em;padding:7px 11px;background:none;border:1px solid rgba(255,255,255,0.14);color:var(--text2);border-radius:12px;cursor:pointer;font-family:var(--sans)}
.row-action-btn:hover{background:rgba(255,255,255,0.08);color:var(--text)}
.row-delete{padding:7px 9px;border:1px solid rgba(255,255,255,0.14)}
.idea-expanded{padding:0 16px 16px;background:transparent}
.idea-expanded-grid{display:grid;grid-template-columns:minmax(0,1.6fr) minmax(220px,1fr);gap:16px;padding:16px;border:1px solid rgba(255,255,255,0.08);border-radius:18px;background:rgba(255,255,255,0.04)}
.idea-expanded-side{display:flex;flex-direction:column;gap:12px}
.expanded-label{font-size:10px;font-weight:500;letter-spacing:0.1em;text-transform:uppercase;color:var(--text3);margin-bottom:6px}
.expanded-save-state{font-size:10px;color:var(--text3);margin-top:6px}
.empty-state{text-align:center;padding:80px 20px;color:var(--text3)}
.empty-title{font-family:var(--serif);font-size:22px;font-style:italic;color:var(--text2);margin-bottom:8px}
.empty-sub{font-size:13px}
.badge{font-size:9px;font-weight:500;letter-spacing:0.1em;text-transform:uppercase;padding:4px 9px;border-radius:999px;border:1px solid currentColor;opacity:0.9}
.badge-reel{color:#9a8cff}.badge-blog{color:#61d3a4}.badge-social{color:#ffae63}.badge-country{color:var(--text3);border-color:rgba(255,255,255,0.14)}
.card-delete{background:none;border:none;color:var(--text3);cursor:pointer;font-size:14px;line-height:1;padding:2px 4px;border-radius:2px;transition:color 0.15s;flex-shrink:0}
.card-delete:hover{color:var(--text)}
.viral-row{display:flex;align-items:center;gap:10px}
.viral-label{font-size:10px;font-weight:500;letter-spacing:0.08em;text-transform:uppercase;color:var(--text3);white-space:nowrap}
.viral-bar{flex:1;height:4px;background:rgba(255,255,255,0.08);border-radius:999px;overflow:hidden}
.viral-fill{height:100%;border-radius:2px;transition:width 0.6s ease}
.tag{font-size:10px;padding:4px 9px;background:var(--tag-bg);border-radius:999px;color:var(--text2)}
.video-link-btn{display:inline-flex;align-items:center;justify-content:center;padding:7px 10px;border:1px solid rgba(255,255,255,0.12);border-radius:12px;background:rgba(255,255,255,0.06);font-size:10px;font-weight:500;letter-spacing:0.06em;text-transform:uppercase;color:var(--text2);text-decoration:none;transition:all 0.15s;width:max-content}
.video-link-btn:hover{background:var(--text);color:var(--bg);border-color:var(--text)}
.card-source{font-size:10px;color:var(--text3);word-break:break-all;text-decoration:none;display:block}
.card-source:hover{color:var(--text2)}
.card-date{font-size:10px;color:var(--text3);font-weight:300}
.btn-script{display:inline-flex;align-items:center;justify-content:center;padding:7px 10px;border:1px solid rgba(167,156,255,0.48);border-radius:12px;background:linear-gradient(135deg,#6f6bff 0%,#8f7cff 100%);font-size:10px;font-weight:500;letter-spacing:0.06em;text-transform:uppercase;color:#f7f7ff;text-decoration:none;transition:all 0.15s;width:max-content;box-shadow:0 10px 28px rgba(111,107,255,0.22)}
.btn-script:hover{transform:translateY(-1px);box-shadow:0 14px 32px rgba(111,107,255,0.28);filter:brightness(1.03)}
.btn-script-meta{white-space:nowrap}
.hook-quote{font-family:var(--serif);font-style:italic;font-size:13px;color:var(--text2);padding:10px 14px;border-left:2px solid rgba(123,97,255,0.42);background:rgba(255,255,255,0.04);border-radius:0 14px 14px 0;line-height:1.5}
.notif{position:fixed;bottom:28px;right:28px;background:var(--surface);border:1px solid var(--border2);border-radius:var(--radius-md);padding:12px 20px;font-size:12px;color:var(--text);box-shadow:0 12px 28px rgba(0,0,0,0.24);z-index:999;transform:translateY(60px);opacity:0;transition:all 0.3s cubic-bezier(.16,1,.3,1);pointer-events:none;font-weight:300}
.notif.show{transform:translateY(0);opacity:1}
.notif.success{border-color:rgba(90,138,106,0.4);color:#7fdfaa}
.notif.error{border-color:rgba(180,80,60,0.3);color:#ff9f8f}
@media(max-width:1360px){.content-grid{grid-template-columns:1fr}.right-rail{position:static}.hero-row{grid-template-columns:1fr}.stat-grid{grid-template-columns:repeat(4,1fr)}}
@media(max-width:1200px){.list-head{display:none}.idea-row{grid-template-columns:1fr;gap:12px}.idea-actions{justify-content:flex-start}.idea-expanded-grid{grid-template-columns:1fr}.workspace-shell{grid-template-columns:280px 1fr}}
@media(max-width:900px){.workspace-shell{grid-template-columns:1fr}.sidebar{position:static;height:auto}.stat-grid{grid-template-columns:1fr 1fr}.main-panel{padding:18px}}
@media(max-width:640px){.stat-grid{grid-template-columns:1fr}.workspace-actions{width:100%}.ghost-top-btn,.primary-top-btn{flex:1}.search-field{width:100%}}
`;
