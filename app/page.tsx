'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { createClient } from '@/lib/supabase';

const COUNTRIES: Record<string, string> = {
  HK:'🇭🇰 香港', TW:'🇹🇼 台灣', CN:'🇨🇳 內地', JP:'🇯🇵 日本',
  KR:'🇰🇷 韓國', SG:'🇸🇬 新加坡', TH:'🇹🇭 泰國', MY:'🇲🇾 馬來西亞',
  ID:'🇮🇩 印尼', VN:'🇻🇳 越南', IN:'🇮🇳 印度',
  US:'🇺🇸 美國', GB:'🇬🇧 英國', AU:'🇦🇺 澳洲', CA:'🇨🇦 加拿大',
  FR:'🇫🇷 法國', DE:'🇩🇪 德國', OTHER:'🌍 其他'
};

const SCRIPT_GEN_URL = 'https://script-generator-xi.vercel.app';

function fmtNum(n: number) {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(0) + 'K';
  return String(n);
}
function hostOf(url: string) {
  try { return new URL(url.startsWith('http') ? url : 'https://' + url).hostname.replace('www.', ''); }
  catch { return url.slice(0, 40); }
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
  const [isDrag, setIsDrag] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [autoFilling, setAutoFilling] = useState(false);
  const [placeName, setPlaceName] = useState('');
  const [placeAddress, setPlaceAddress] = useState('');
  const [placeLat, setPlaceLat] = useState<number | null>(null);
  const [placeLng, setPlaceLng] = useState<number | null>(null);
  const [showWorldMap, setShowWorldMap] = useState(false);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [savingNote, setSavingNote] = useState<string | null>(null);
  const [showNotesPanel, setShowNotesPanel] = useState(false);
  const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>({});
  const [statusSteps, setStatusSteps] = useState<{ label: string; state: string }[] | null>(null);
  const [notif, setNotif] = useState<{ msg: string; type: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [url, setUrl] = useState('');
  const [desc, setDesc] = useState('');
  const [views, setViews] = useState('');
  const [likes, setLikes] = useState('');
  const [shares, setShares] = useState('');
  const [country, setCountry] = useState('');

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
      // Initialise notes state from Supabase
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

  function readFile(file: File) {
    const r = new FileReader();
    r.onload = (e) => setImage(e.target!.result as string);
    r.readAsDataURL(file);
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDrag(false);
    const f = e.dataTransfer.files[0];
    if (f && f.type.startsWith('image/')) readFile(f);
  }, []);

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
      // Auto-geocode if lat/lng not already set by AI search
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
        type: selectedType, url, thumb: image,
        views: +views || 0, likes: +likes || 0, shares: +shares || 0,
        country: country || 'OTHER', date: new Date().toISOString(), lat: finalLat, lng: finalLng, notes: desc || null, ...analysis
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
      setUrl(''); setDesc(''); setViews(''); setLikes(''); setShares(''); setCountry(''); setImage(null); setPlaceName(''); setPlaceAddress(''); setPlaceLat(null); setPlaceLng(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
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

  const typeBadge: Record<string, string> = { reel: 'badge-reel', blog: 'badge-blog', social: 'badge-social' };
  const typeLabel: Record<string, string> = { reel: 'IG Reel', blog: 'Blog', social: 'Social' };
  const filterLabel = filter === 'all' ? '所有想法' :
    filter.startsWith('country-') ? (COUNTRIES[filter.replace('country-', '')] || '') + ' 的想法' :
    { reel: 'IG Reel', blog: '文章 / Blog', social: 'Social Post' }[filter] || filter;

  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,500;1,400&family=DM+Sans:wght@300;400;500&display=swap" rel="stylesheet" />
      <style>{CSS}</style>

      <header>
        <div className="header-left">
          <span className="brand-label">AI Media Content Creation</span>
          <h1 className="page-title">Idea Collection <em>/ Beta</em></h1>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
        <button onClick={()=>setShowNotesPanel(true)} style={{fontSize:11,padding:'5px 14px',background:'transparent',color:'var(--text2)',border:'1px solid var(--border2)',borderRadius:'var(--radius)',cursor:'pointer',fontFamily:'var(--sans)',letterSpacing:'0.05em'}}>
          📋 Notes 總覽
        </button>
        <div className="header-meta">{ideasLoading ? '載入中...' : `${ideas.length} 個想法已儲存`}</div>
      </div>
      </header>

      <div className="stat-bar">
        <span className="stat-bar-item"><strong>{ideas.length}</strong> 個想法</span>
        <span className="stat-bar-item"><strong>{fmtNum(totalViews)}</strong> 總 Views</span>
        <span className="stat-bar-item"><strong>{avgViral}</strong> 平均爆款分</span>
        <span className="stat-bar-item"><strong>{countryCount}</strong> 個國家</span>
      </div>

      <div className="layout">
        <div className="input-panel">
          <div className="step-block">
            <span className="step-num">01</span>
            <span className="step-label">URL / Link</span>
            <input className="field" type="url" placeholder="例：https://www.instagram.com/reel/…"
              value={url} onChange={e => setUrl(e.target.value)} />
            <div style={{ display: 'flex', gap: 8 }}>
              <input className="field" placeholder="店鋪 / 品牌名稱"
                value={placeName} onChange={e => setPlaceName(e.target.value)}
                style={{ flex: 2 }} />
              <input className="field" placeholder="地址（選填）"
                value={placeAddress} onChange={e => setPlaceAddress(e.target.value)}
                style={{ flex: 3 }} />
            </div>
            <div style={{ position: 'relative' }}>
              <textarea className="field" rows={2} placeholder="片嘅描述（補充 AI 分析）"
                value={desc} onChange={e => setDesc(e.target.value)}
                style={{ paddingBottom: 28 }} />
              <button
                onClick={autoFillDesc}
                disabled={autoFilling || !placeName}
                style={{
                  position: 'absolute', bottom: 8, right: 8,
                  fontSize: 10, padding: '3px 10px',
                  background: 'var(--text)', color: 'var(--bg)',
                  border: 'none', borderRadius: 'var(--radius)',
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
            <span className="step-label">截圖 / 封面</span>
            <div
              className={`upload-zone${isDrag ? ' drag' : ''}`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setIsDrag(true); }}
              onDragLeave={() => setIsDrag(false)}
              onDrop={handleDrop}
            >
              <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }}
                onChange={e => { const f = e.target.files?.[0]; if (f) readFile(f); }} />
              {image
                ? <img src={image} alt="" style={{ width: '100%', borderRadius: 2, border: '1px solid var(--border)' }} />
                : <div className="upload-text">Click 上載或拖放截圖<br /><span style={{ fontSize: 10, opacity: 0.6 }}>PNG · JPG · WEBP</span></div>
              }
            </div>
            {image && (
              <button onClick={() => { setImage(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                style={{ fontSize: 11, color: 'var(--text3)', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                × 移除圖片
              </button>
            )}
          </div>

          <div className="divider" />

          <div className="step-block">
            <span className="step-num">03</span>
            <span className="step-label">數據</span>
            <div className="stats-row">
              <div className="stat-block">
                <span className="stat-label">Views</span>
                <input className="field" type="number" min="0" placeholder="例：1200000"
                  value={views} onChange={e => setViews(e.target.value)} />
              </div>
              <div className="stat-block">
                <span className="stat-label">Likes</span>
                <input className="field" type="number" min="0" placeholder="例：36000"
                  value={likes} onChange={e => setLikes(e.target.value)} />
              </div>
              <div className="stat-block">
                <span className="stat-label">Shares / Saves</span>
                <input className="field" type="number" min="0" placeholder="例：48000"
                  value={shares} onChange={e => setShares(e.target.value)} />
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
                <button key={t} className={`chip${selectedType === t ? ' sel' : ''}`}
                  onClick={() => setSelectedType(t)}>
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
        </div>

        <div className="gallery-panel">
          <div className="gallery-header">
            <div style={{display:"flex",alignItems:"center",gap:12}}>
            <div className="gallery-title">{filterLabel} · {filtered.length} 個</div>
            <button onClick={()=>setShowWorldMap(v=>!v)} style={{fontSize:10,padding:"3px 10px",background:showWorldMap?"var(--text)":"transparent",color:showWorldMap?"var(--bg)":"var(--text3)",border:"1px solid var(--border2)",borderRadius:"var(--radius)",cursor:"pointer",fontFamily:"var(--sans)",letterSpacing:"0.05em"}}>
              {showWorldMap ? "✕ 收起地圖" : "🗺 世界地圖"}
            </button>
          </div>
            <div className="controls">
              <input className="search-field" placeholder="搜尋…" value={search} onChange={e => setSearch(e.target.value)} />
              <select className="sort-select" value={sort} onChange={e => setSort(e.target.value)}>
                <option value="date">最新優先</option>
                <option value="viral">爆款評分</option>
                <option value="views">Views 最多</option>
              </select>
            </div>
          </div>

          {showWorldMap && filtered.length > 0 && (
          <div style={{marginBottom:20,borderRadius:"var(--radius-md)",overflow:"hidden",border:"1px solid var(--border2)"}}>
            <iframe
              src={`https://www.google.com/maps/embed/v1/search?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&q=${encodeURIComponent(filtered.filter((i:any)=>i.lat&&i.lng).length > 0 ? filtered.filter((i:any)=>i.lat&&i.lng).map((i:any)=>i.title).slice(0,5).join("|") : filtered.map((i:any)=>i.title).slice(0,3).join("|"))}`}
              width="100%" height="360" style={{border:0,display:"block"}} allowFullScreen
            />
          </div>
        )}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 20 }}>
            {['all', 'reel', 'blog', 'social'].map(f => (
              <button key={f} className={`filter-btn${filter === f ? ' active' : ''}`} onClick={() => setFilter(f)}>
                {f === 'all' ? 'All' : f === 'reel' ? 'IG Reel' : f === 'blog' ? 'Blog' : 'Social'}
              </button>
            ))}
            <span style={{ width: 1, background: 'var(--border2)', margin: '0 4px' }} />
            {['HK', 'TW', 'JP', 'KR', 'US'].map(c => (
              <button key={c} className={`filter-btn${filter === 'country-' + c ? ' active' : ''}`}
                onClick={() => setFilter('country-' + c)}>
                {COUNTRIES[c].split(' ')[0]} {c}
              </button>
            ))}
          </div>

          {ideasLoading ? (
            <div className="empty-state">
              <div className="empty-title">載入中...</div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="empty-state">
              <div className="empty-title">{ideas.length ? '沒有符合條件的想法' : '尚未儲存任何想法'}</div>
              <div className="empty-sub">{ideas.length ? '試試其他篩選或搜尋' : '貼入一條 URL 或上載截圖，AI 會自動分析並儲存。'}</div>
            </div>
          ) : (
            <div className="grid-wrap">
              <div className="grid">
                {filtered.map(idea => {
                  const vs = idea.viralScore || 0;
                  const viralColor = vs >= 70 ? '#7a5a2a' : vs >= 40 ? '#3d7a5c' : '#5a6a8a';
                  const scriptUrl = `${SCRIPT_GEN_URL}?topic=${encodeURIComponent(idea.title || '')}&background=${encodeURIComponent(notes[idea.id] !== undefined ? notes[idea.id] : (idea.notes || idea.summary || ''))}`;
                  return (
                    <div key={idea.id} className="card">
                      <div className="card-head">
                        <div className="card-badges">
                          <span className={`badge ${typeBadge[idea.type] || 'badge-reel'}`}>{typeLabel[idea.type] || idea.type}</span>
                          {idea.country && <span className="badge badge-country">{COUNTRIES[idea.country] || idea.country}</span>}
                        </div>
                        <button className="card-delete" onClick={async () => {
                          setIdeas(prev => prev.filter(i => i.id !== idea.id));
                          await deleteIdeaFromSupabase(idea.id);
                        }}>×</button>
                      </div>
                      {idea.thumb && <img src={idea.thumb} alt="" className="card-thumb visible" />}
                      {idea.topic && <div className="card-topic">{idea.topic}</div>}
                      <div className="card-title">{idea.title || '未命名'}</div>
                      {idea.summary && <div className="card-summary">{idea.summary}</div>}
                      <div className="viral-row">
                        <span className="viral-label">爆款</span>
                        <div className="viral-bar"><div className="viral-fill" style={{ width: vs + '%', background: viralColor }} /></div>
                        <span className="viral-score">{vs}</span>
                      </div>
                      {(idea.views || idea.likes || idea.shares) && (
                        <div className="card-stats">
                          {idea.views ? <div className="stat-item"><div className="stat-val">{fmtNum(idea.views)}</div><div className="stat-key">Views</div></div> : null}
                          {idea.likes ? <div className="stat-item"><div className="stat-val">{fmtNum(idea.likes)}</div><div className="stat-key">Likes</div></div> : null}
                          {idea.shares ? <div className="stat-item"><div className="stat-val">{fmtNum(idea.shares)}</div><div className="stat-key">Shares</div></div> : null}
                        </div>
                      )}
                      {idea.tags?.length > 0 && (
                        <div className="card-tags">{idea.tags.map((t: string) => <span key={t} className="tag">{t}</span>)}</div>
                      )}
                      {idea.url && <a className="card-source" href={idea.url} target="_blank" rel="noopener">{hostOf(idea.url)}</a>}
                      {idea.scriptHook && <div className="hook-quote">「{idea.scriptHook}」</div>}
                      {expandedNotes[idea.id] && (
                        <div style={{marginTop:4}}>
                          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:4}}>
                            <span style={{fontSize:10,fontWeight:500,letterSpacing:'0.08em',textTransform:'uppercase',color:'var(--text3)'}}>📝 Notes</span>
                            {savingNote === idea.id && <span style={{fontSize:9,color:'var(--text3)'}}>儲存中...</span>}
                            {savingNote !== idea.id && notes[idea.id] !== undefined && <span style={{fontSize:9,color:'#3d7a5c'}}>✓ 已儲存</span>}
                          </div>
                          <textarea
                            className="field"
                            rows={4}
                            style={{fontSize:11,lineHeight:1.6,resize:'vertical'}}
                            value={notes[idea.id] !== undefined ? notes[idea.id] : (idea.notes || idea.summary || '')}
                            onChange={e => setNotes(prev => ({...prev, [idea.id]: e.target.value}))}
                            onBlur={e => saveNote(idea.id, e.target.value)}
                            placeholder="加入筆記、補充資料、拍攝角度...（失焦自動儲存）"
                            autoFocus
                          />
                        </div>
                      )}
                      {idea.lat && idea.lng && (
                        <div style={{borderRadius:"var(--radius)",overflow:"hidden",border:"1px solid var(--border)"}}>
                          <iframe
                            src={`https://www.google.com/maps/embed/v1/place?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&q=${idea.lat},${idea.lng}&zoom=15`}
                            width="100%" height="140" style={{border:0,display:"block"}} allowFullScreen
                          />
                        </div>
                      )}
                      {expandedNotes[idea.id] && (
                        <div>
                          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:4}}>
                            <span style={{fontSize:10,fontWeight:500,letterSpacing:'0.08em',textTransform:'uppercase',color:'var(--text3)'}}>📝 Notes</span>
                            {savingNote === idea.id ? <span style={{fontSize:9,color:'var(--text3)'}}>儲存中...</span> : notes[idea.id] !== undefined ? <span style={{fontSize:9,color:'#3d7a5c'}}>✓ 已儲存</span> : null}
                          </div>
                          <textarea
                            className="field"
                            rows={4}
                            style={{fontSize:11,lineHeight:1.6,resize:'vertical'}}
                            value={notes[idea.id] !== undefined ? notes[idea.id] : (idea.notes || idea.summary || '')}
                            onChange={e => setNotes(prev => ({...prev, [idea.id]: e.target.value}))}
                            onBlur={e => saveNote(idea.id, e.target.value)}
                            placeholder="加入筆記、補充資料、拍攝角度...（失焦自動儲存）"
                            autoFocus
                          />
                        </div>
                      )}
                      <div className="card-footer">
                        <span className="card-date">{new Date(idea.date).toLocaleDateString('zh-HK', { month: 'short', day: 'numeric' })}</span>
                        <div style={{display:'flex',gap:6}}>
                          <button
                            onClick={()=>setExpandedNotes(prev=>({...prev,[idea.id]:!prev[idea.id]}))}
                            style={{fontSize:10,fontWeight:500,letterSpacing:'0.06em',padding:'5px 10px',background:expandedNotes[idea.id]?'var(--surface3)':'none',border:'1px solid var(--border2)',color:expandedNotes[idea.id]?'var(--text)':'var(--text2)',borderRadius:'var(--radius)',cursor:'pointer',fontFamily:'var(--sans)'}}>
                            📝 {expandedNotes[idea.id] ? '▴' : '▾'}
                          </button>
                          <a className="btn-script" href={scriptUrl} target="_blank" rel="noopener">Script →</a>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {notif && (
        <div className={`notif show${notif.type ? ' ' + notif.type : ''}`}>{notif.msg}</div>
      )}

      {showNotesPanel && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.4)',zIndex:1000,display:'flex',alignItems:'flex-start',justifyContent:'flex-end'}} onClick={()=>setShowNotesPanel(false)}>
          <div style={{width:480,height:'100vh',background:'var(--surface)',borderLeft:'1px solid var(--border2)',overflowY:'auto',padding:'36px 32px',display:'flex',flexDirection:'column',gap:24}} onClick={e=>e.stopPropagation()}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <div>
                <div style={{fontSize:10,fontWeight:500,letterSpacing:'0.18em',textTransform:'uppercase',color:'var(--text3)'}}>Script Prep</div>
                <h2 style={{fontFamily:'var(--serif)',fontSize:26,fontWeight:400,color:'var(--text)',marginTop:2}}>Notes 總覽</h2>
              </div>
              <button onClick={()=>setShowNotesPanel(false)} style={{background:'none',border:'none',fontSize:20,color:'var(--text3)',cursor:'pointer'}}>×</button>
            </div>
            <div style={{height:1,background:'var(--border2)'}}/>
            {ideas.filter(i => (notes[i.id] !== undefined ? notes[i.id] : i.notes)).map(idea => {
              const noteContent = notes[idea.id] !== undefined ? notes[idea.id] : (idea.notes || '')
              const scriptUrl = `${SCRIPT_GEN_URL}?topic=${encodeURIComponent(idea.title||'')}&background=${encodeURIComponent(noteContent)}`
              return (
                <div key={idea.id} style={{borderBottom:'1px solid var(--border)',paddingBottom:20}}>
                  <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:8,marginBottom:8}}>
                    <div>
                      <div style={{fontSize:10,fontWeight:500,letterSpacing:'0.08em',textTransform:'uppercase',color:'var(--text3)',marginBottom:3}}>{idea.topic}</div>
                      <div style={{fontFamily:'var(--serif)',fontSize:16,fontWeight:500,color:'var(--text)'}}>{idea.title}</div>
                    </div>
                    <a href={scriptUrl} target="_blank" rel="noopener" style={{flexShrink:0,fontSize:10,fontWeight:500,letterSpacing:'0.06em',textTransform:'uppercase',padding:'5px 12px',background:'var(--text)',color:'var(--bg)',borderRadius:'var(--radius)',textDecoration:'none',whiteSpace:'nowrap'}}>Script →</a>
                  </div>
                  <div style={{fontSize:12,color:'var(--text2)',lineHeight:1.65,background:'var(--surface2)',padding:'10px 12px',borderRadius:'var(--radius)',whiteSpace:'pre-wrap',fontFamily:'var(--sans)'}}>{noteContent}</div>
                </div>
              )
            })}
            {ideas.filter(i => (notes[i.id] !== undefined ? notes[i.id] : i.notes)).length === 0 && (
              <div style={{textAlign:'center',padding:'40px 0',color:'var(--text3)'}}>
                <div style={{fontFamily:'var(--serif)',fontSize:20,fontStyle:'italic',marginBottom:8}}>尚未有 Notes</div>
                <div style={{fontSize:12}}>喺每張 card 底部嘅 Notes 欄加入筆記</div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

const CSS = `
:root{--bg:#EEEAE2;--surface:#F4F1EA;--surface2:#EAE6DC;--surface3:#E0DBCF;--text:#1a1916;--text2:#5a5750;--text3:#8a8780;--border:rgba(26,25,22,0.10);--border2:rgba(26,25,22,0.18);--tag-bg:rgba(26,25,22,0.07);--radius:2px;--radius-md:4px;--serif:'EB Garamond',Georgia,serif;--sans:'DM Sans',sans-serif}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{background:var(--bg);color:var(--text);font-family:var(--sans);font-size:14px;font-weight:300;line-height:1.65;min-height:100vh}
header{padding:28px 40px 20px;border-bottom:1px solid var(--border2);display:flex;align-items:flex-end;justify-content:space-between}
.header-left{display:flex;flex-direction:column;gap:2px}
.brand-label{font-size:10px;font-weight:500;letter-spacing:0.18em;text-transform:uppercase;color:var(--text3)}
.page-title{font-family:var(--serif);font-size:32px;font-weight:400;line-height:1.1;color:var(--text);letter-spacing:-0.02em}
.page-title em{font-style:italic;color:var(--text3)}
.header-meta{font-size:12px;color:var(--text3);font-weight:300;text-align:right}
.stat-bar{display:flex;gap:24px;padding:12px 40px;border-bottom:1px solid var(--border);background:var(--surface);font-size:11px;color:var(--text3)}
.stat-bar-item strong{color:var(--text);font-weight:500;font-family:var(--serif);font-size:14px}
.layout{display:grid;grid-template-columns:380px 1fr;min-height:calc(100vh - 109px)}
.input-panel{border-right:1px solid var(--border2);padding:36px 32px;display:flex;flex-direction:column;gap:28px;background:var(--surface);position:sticky;top:0;height:calc(100vh - 109px);overflow-y:auto}
.step-block{display:flex;flex-direction:column;gap:10px}
.step-num{font-size:10px;font-weight:500;letter-spacing:0.12em;color:var(--text3)}
.step-label{font-family:var(--serif);font-size:18px;font-weight:500;color:var(--text);line-height:1.2;margin-top:-2px}
.field{width:100%;padding:11px 14px;background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius);color:var(--text);font-family:var(--sans);font-size:13px;font-weight:300;outline:none;transition:border-color 0.2s;resize:none;appearance:none;-webkit-appearance:none}
.field:focus{border-color:var(--border2);background:var(--surface3)}
.field::placeholder{color:var(--text3)}
select.field{cursor:pointer;background-image:url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%238a8780' stroke-width='1.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 12px center;padding-right:32px}
.upload-zone{border:1px dashed var(--border2);border-radius:var(--radius);padding:20px;text-align:center;cursor:pointer;transition:background 0.2s,border-color 0.2s;background:var(--surface2)}
.upload-zone:hover,.upload-zone.drag{background:var(--surface3);border-color:var(--text3)}
.upload-text{font-size:12px;color:var(--text3);line-height:1.7}
.stats-row{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px}
.stat-block{display:flex;flex-direction:column;gap:6px}
.stat-label{font-size:10px;font-weight:500;letter-spacing:0.1em;text-transform:uppercase;color:var(--text3)}
.chips{display:flex;flex-wrap:wrap;gap:6px}
.chip{padding:5px 14px;border-radius:20px;border:1px solid var(--border2);background:transparent;color:var(--text2);font-family:var(--sans);font-size:12px;font-weight:400;cursor:pointer;transition:all 0.15s}
.chip:hover{background:var(--surface2);color:var(--text)}
.chip.sel{background:var(--text);color:var(--bg);border-color:var(--text)}
.divider{height:1px;background:var(--border);margin:0 -32px}
.ai-status{padding:14px 16px;background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius);font-size:12px;color:var(--text2);line-height:1.9}
.ai-status .step{display:flex;align-items:center;gap:8px}
.step-dot{width:6px;height:6px;border-radius:50%;flex-shrink:0;background:var(--border2);transition:background 0.3s}
.step.done .step-dot{background:#5a8a6a}
.step.active .step-dot{background:var(--text);animation:pulse 1s ease-in-out infinite}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
.step.done{color:var(--text3)}.step.active{color:var(--text);font-weight:400}
.btn-submit{width:100%;padding:13px 20px;background:var(--text);border:none;border-radius:var(--radius);color:var(--bg);font-family:var(--sans);font-size:13px;font-weight:400;letter-spacing:0.04em;cursor:pointer;transition:opacity 0.2s;display:flex;align-items:center;justify-content:center;gap:10px}
.btn-submit:hover{opacity:0.82}.btn-submit:disabled{opacity:0.35;cursor:not-allowed}
.spinner{width:14px;height:14px;border:1.5px solid rgba(255,255,255,0.25);border-top-color:rgba(255,255,255,0.9);border-radius:50%;animation:spin 0.7s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
.gallery-panel{padding:36px;overflow-y:auto}
.gallery-header{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:28px;gap:16px;flex-wrap:wrap}
.gallery-title{font-family:var(--serif);font-size:13px;color:var(--text3);font-style:italic}
.controls{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.filter-btn{padding:5px 14px;border-radius:20px;border:1px solid var(--border2);background:transparent;color:var(--text3);font-family:var(--sans);font-size:11px;font-weight:400;letter-spacing:0.05em;cursor:pointer;transition:all 0.15s;text-transform:uppercase}
.filter-btn:hover{color:var(--text)}.filter-btn.active{background:var(--text);color:var(--bg);border-color:var(--text)}
.search-field{padding:5px 12px;background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius);color:var(--text);font-family:var(--sans);font-size:12px;font-weight:300;outline:none;width:180px;transition:border-color 0.2s}
.search-field:focus{border-color:var(--border2)}.search-field::placeholder{color:var(--text3)}
.sort-select{padding:5px 28px 5px 10px;background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius);color:var(--text2);font-family:var(--sans);font-size:11px;font-weight:300;outline:none;appearance:none;-webkit-appearance:none;cursor:pointer;background-image:url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%238a8780' stroke-width='1.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 8px center}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:1px}
.grid-wrap{border:1px solid var(--border2);border-radius:var(--radius-md);overflow:hidden}
.empty-state{text-align:center;padding:80px 20px;color:var(--text3)}
.empty-title{font-family:var(--serif);font-size:22px;font-style:italic;color:var(--text2);margin-bottom:8px}
.empty-sub{font-size:13px}
.card{background:var(--surface);padding:22px 20px;display:flex;flex-direction:column;gap:12px;border-right:1px solid var(--border);border-bottom:1px solid var(--border);transition:background 0.15s}
.card:hover{background:var(--surface2)}
.card-head{display:flex;align-items:flex-start;justify-content:space-between;gap:8px}
.card-badges{display:flex;gap:6px;flex-wrap:wrap}
.badge{font-size:9px;font-weight:500;letter-spacing:0.1em;text-transform:uppercase;padding:2px 8px;border-radius:2px;border:1px solid currentColor;opacity:0.75}
.badge-reel{color:#6b5d9e}.badge-blog{color:#3d7a5c}.badge-social{color:#a05a3a}.badge-country{color:var(--text3);border-color:var(--border2)}
.card-delete{background:none;border:none;color:var(--text3);cursor:pointer;font-size:14px;line-height:1;padding:2px 4px;border-radius:2px;transition:color 0.15s;flex-shrink:0}
.card-delete:hover{color:var(--text)}
.card-thumb{width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:var(--radius);border:1px solid var(--border)}
.card-title{font-family:var(--serif);font-size:17px;font-weight:500;color:var(--text);line-height:1.35;letter-spacing:-0.01em}
.card-topic{font-size:11px;font-weight:500;letter-spacing:0.08em;text-transform:uppercase;color:var(--text3);padding-bottom:8px;border-bottom:1px solid var(--border)}
.card-summary{font-size:12px;color:var(--text2);line-height:1.6;font-weight:300}
.viral-row{display:flex;align-items:center;gap:10px}
.viral-label{font-size:10px;font-weight:500;letter-spacing:0.08em;text-transform:uppercase;color:var(--text3);white-space:nowrap}
.viral-bar{flex:1;height:3px;background:var(--surface3);border-radius:2px;overflow:hidden}
.viral-fill{height:100%;border-radius:2px;transition:width 0.6s ease}
.viral-score{font-size:11px;font-weight:500;color:var(--text2);white-space:nowrap;min-width:36px;text-align:right}
.card-stats{display:flex;gap:14px}
.stat-item{display:flex;flex-direction:column;gap:1px}
.stat-val{font-size:14px;font-weight:500;color:var(--text);font-family:var(--serif)}
.stat-key{font-size:9px;font-weight:500;letter-spacing:0.1em;text-transform:uppercase;color:var(--text3)}
.card-tags{display:flex;flex-wrap:wrap;gap:5px}
.tag{font-size:10px;padding:2px 9px;background:var(--tag-bg);border-radius:12px;color:var(--text2)}
.card-source{font-size:10px;color:var(--text3);word-break:break-all;text-decoration:none;display:block}
.card-source:hover{color:var(--text2)}
.card-footer{display:flex;align-items:center;justify-content:space-between;margin-top:2px}
.card-date{font-size:10px;color:var(--text3);font-weight:300}
.btn-script{font-size:10px;font-weight:500;letter-spacing:0.06em;text-transform:uppercase;padding:5px 12px;background:none;border:1px solid var(--border2);color:var(--text2);border-radius:var(--radius);cursor:pointer;text-decoration:none;transition:all 0.15s}
.btn-script:hover{background:var(--text);color:var(--bg);border-color:var(--text)}
.hook-quote{font-family:var(--serif);font-style:italic;font-size:13px;color:var(--text2);padding:8px 12px;border-left:2px solid var(--border2);background:var(--surface2);border-radius:0 var(--radius) var(--radius) 0;line-height:1.5}
.notif{position:fixed;bottom:28px;right:28px;background:var(--surface);border:1px solid var(--border2);border-radius:var(--radius-md);padding:12px 20px;font-size:12px;color:var(--text);box-shadow:0 4px 20px rgba(0,0,0,0.12);z-index:999;transform:translateY(60px);opacity:0;transition:all 0.3s cubic-bezier(.16,1,.3,1);pointer-events:none;font-weight:300}
.notif.show{transform:translateY(0);opacity:1}
.notif.success{border-color:rgba(90,138,106,0.4);color:#3d7a5c}
.notif.error{border-color:rgba(180,80,60,0.3);color:#a05a3a}
@media(max-width:860px){.layout{grid-template-columns:1fr}.input-panel{position:static;height:auto}}
`;
