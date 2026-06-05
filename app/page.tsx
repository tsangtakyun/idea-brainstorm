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

async function callClaude(url: string, desc: string, image: string | null, country: string) {
  const countryName = COUNTRIES[country] || country;
  let userContent: any;
  if (image) {
    const mediaType = image.startsWith('data:image/png') ? 'image/png'
      : image.startsWith('data:image/webp') ? 'image/webp' : 'image/jpeg';
    userContent = [
      { type: 'image', source: { type: 'base64', media_type: mediaType, data: image.split(',')[1] } },
      { type: 'text', text: `URL: ${url || '(none)'}\nDesc: ${desc || '(none)'}\nCountry: ${countryName}\nReturn JSON only.` }
    ];
  } else {
    userContent = `URL: ${url}\nDesc: ${desc || '(none)'}\nCountry: ${countryName}\nReturn JSON only.`;
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
  return { ...parsed, viralScore: parsed.aiViralBase || 50 };
}

export default function Home() {
  const [ideas, setIdeas] = useState<any[]>([]);
  const [ideasLoading, setIdeasLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'my-ideas' | 'explore'>('my-ideas');
  const [exploreKeyword, setExploreKeyword] = useState('');
  const [exploreResults, setExploreResults] = useState<any[]>([]);
  const [exploreLoading, setExploreLoading] = useState(false);
  const [exploreError, setExploreError] = useState('');
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
  const [inputPanelOpen, setInputPanelOpen] = useState(false);
  const [detailIdeaId, setDetailIdeaId] = useState<string | null>(null);
  const [soonAccessToken, setSoonAccessToken] = useState('');
  const [aiDetail, setAiDetail] = useState('');
  const [aiDetailLoading, setAiDetailLoading] = useState(false);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [savingNote, setSavingNote] = useState<string | null>(null);
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null);
  const [titleDrafts, setTitleDrafts] = useState<Record<string, string>>({});
  const [statusSteps, setStatusSteps] = useState<{ label: string; state: string }[] | null>(null);
  const [notif, setNotif] = useState<{ msg: string; type: string } | null>(null);
  const [url, setUrl] = useState('');
  const [customTitle, setCustomTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [country, setCountry] = useState('');
  const [activeNav, setActiveNav] = useState<'home' | 'work' | 'board' | 'analysis'>('home');
  const detectedPlatform = inferPlatformFromUrl(url);
  const homeRef = useRef<HTMLDivElement | null>(null);
  const workRef = useRef<HTMLElement | null>(null);
  const boardRef = useRef<HTMLElement | null>(null);
  const analysisRef = useRef<HTMLElement | null>(null);

  function normalizeIdeas(data: any[]) {
    return data.map((d: any) => ({
      id: d.id,
      type: d.type ?? 'reel',
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
      sourceUrl: d.source_url ?? d.url ?? '',
      videoUrl: d.video_url ?? '',
      platform: d.platform ?? '',
      categories: Array.isArray(d.categories) ? d.categories : [],
      placeName: d.place_name ?? '',
      placeAddress: d.place_address ?? '',
    }))
  }

  useEffect(() => {
    const fetchIdeas = async () => {
      if (window.location.hash.includes('soon_auth=')) return

      let data: any[] = []

      try {
        const res = await fetch('/api/ideas')
        const payload = await res.json()
        if (res.ok && Array.isArray(payload.ideas) && payload.ideas.length > 0) {
          data = payload.ideas
        } else {
          const supabase = createClient()
          const { data: { user } } = await supabase.auth.getUser()
          if (!user) {
            throw new Error('請先登入')
          }

          const { data: fallbackData, error } = await supabase
            .from('ideas')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })

          if (error) {
            throw new Error(payload.error || error.message || '讀取 ideas 失敗')
          }

          data = fallbackData ?? []

          if (!res.ok) {
            showNotif(payload.error || '共享資料暫時未讀到，已切回個人資料', 'error')
          }
        }
      } catch (err) {
        setIdeas([])
        setNotes({})
        setIdeasLoading(false)
        showNotif(err instanceof Error ? err.message : '讀取 ideas 失敗', 'error')
        return
      }

      if (data) {
        setIdeas(normalizeIdeas(data))
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

  useEffect(() => {
    const loadIdeasForCurrentSession = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from('ideas')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) {
        showNotif(error.message || '讀取 ideas 失敗', 'error')
        return
      }

      setIdeas(normalizeIdeas(data ?? []))
      const initialNotes: Record<string, string> = {}
      ;(data ?? []).forEach((d: any) => {
        if (d.notes) initialNotes[d.id] = d.notes
      })
      setNotes(initialNotes)
      setIdeasLoading(false)
    }

    const loadIdeasWithToken = async (accessToken: string) => {
      try {
        const res = await fetch('/api/ideas', {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        const payload = await res.json()
        if (!res.ok) throw new Error(payload.error || '讀取 ideas 失敗')

        const data = Array.isArray(payload.ideas) ? payload.ideas : []
        setIdeas(normalizeIdeas(data))
        const initialNotes: Record<string, string> = {}
        data.forEach((d: any) => {
          if (d.notes) initialNotes[d.id] = d.notes
        })
        setNotes(initialNotes)
        setIdeasLoading(false)
      } catch (err) {
        setIdeas([])
        setNotes({})
        setIdeasLoading(false)
        showNotif(err instanceof Error ? err.message : '讀取 ideas 失敗', 'error')
      }
    }

    const applySoonAuth = async (payload: any) => {
      const accessToken = payload?.accessToken || payload?.token
      const refreshToken = payload?.refreshToken
      if (!accessToken) {
        setIdeasLoading(false)
        return
      }

      setSoonAccessToken(accessToken)
      const supabase = createClient()
      if (refreshToken) {
        await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        })
      }
      void loadIdeasWithToken(accessToken)
    }

    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''))
    const encodedAuth = hashParams.get('soon_auth')
    if (encodedAuth) {
      try {
        const payload = JSON.parse(window.atob(decodeURIComponent(encodedAuth)))
        void applySoonAuth(payload)
        window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`)
      } catch {
        setIdeasLoading(false)
      }
    }

    const handleSoonAuth = async (event: MessageEvent) => {
      if (event.data?.type !== 'SOON_AUTH') return

      const isAllowedOrigin =
        event.origin === 'https://soon-core.vercel.app' ||
        /^https:\/\/soon-core-[\w-]+\.vercel\.app$/.test(event.origin) ||
        event.origin === 'http://localhost:3000'

      if (!isAllowedOrigin) return

      void applySoonAuth(event.data)
    }

    window.addEventListener('message', handleSoonAuth)
    const notifyParent = () => {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ type: 'SOON_TOOL_READY', tool: 'idea-brainstorm' }, '*')
      }
    }
    notifyParent()
    const timers = [700, 1800, 3200].map((delay) => window.setTimeout(notifyParent, delay))

    return () => {
      window.removeEventListener('message', handleSoonAuth)
      timers.forEach((timer) => window.clearTimeout(timer))
    }
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
          ? `\n\nAI 標籤：${data.tags.join(' / ')}`
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
    if (soonAccessToken) {
      const res = await fetch('/api/ideas', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${soonAccessToken}`,
        },
        body: JSON.stringify(idea),
      })
      const payload = await res.json()
      if (!res.ok) throw new Error(payload.error || '儲存失敗')
      return payload.idea
    }

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
      source_url: idea.sourceUrl ?? idea.url ?? null,
      platform: idea.platform ?? inferPlatformFromUrl(idea.url || ''),
      categories: Array.isArray(idea.categories) ? idea.categories : [],
      video_url: idea.videoUrl ?? null,
      place_name: idea.placeName ?? null,
      place_address: idea.placeAddress ?? null,
    }).select().single()
    if (error) throw error
    return data
  }

  async function deleteIdeaFromSupabase(id: any) {
    if (soonAccessToken) {
      const res = await fetch(`/api/ideas?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${soonAccessToken}` },
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(payload.error || '刪除失敗')
      return
    }

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not logged in')
    const { error } = await supabase.from('ideas').delete().eq('id', id).eq('user_id', user.id)
    if (error) throw error
  }

  async function saveNote(id: any, note: string) {
    setSavingNote(id)
    try {
      if (soonAccessToken) {
        const res = await fetch('/api/ideas', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${soonAccessToken}`,
          },
          body: JSON.stringify({ id, notes: note }),
        })
        const payload = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(payload.error || '儲存筆記失敗')
      } else {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('Not logged in')
        const { error } = await supabase.from('ideas').update({ notes: note }).eq('id', id).eq('user_id', user.id)
        if (error) throw error
      }
      setIdeas(prev => prev.map(idea => idea.id === id ? { ...idea, notes: note } : idea))
    } catch (error) {
      showNotif(error instanceof Error ? error.message : '儲存筆記失敗', 'error')
    } finally {
      setSavingNote(null)
    }
  }

  async function saveIdeaTitle(id: string, title: string) {
    const nextTitle = title.trim()
    if (!nextTitle) {
      showNotif('題目不可留空', 'error')
      return
    }
    if (soonAccessToken) {
      try {
        const res = await fetch('/api/ideas', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${soonAccessToken}`,
          },
          body: JSON.stringify({ id, title: nextTitle }),
        })
        const payload = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(payload.error || '更新標題失敗')
        setIdeas(prev => prev.map(idea => idea.id === id ? { ...idea, title: nextTitle } : idea))
        setEditingTitleId(null)
        showNotif('標題已儲存', 'success')
      } catch (error) {
        showNotif(error instanceof Error ? error.message : '更新標題失敗，請重試', 'error')
      }
      return
    }
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      showNotif('請先登入', 'error')
      return
    }
    const { error } = await supabase.from('ideas').update({ title: nextTitle }).eq('id', id).eq('user_id', user.id)
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
      { label: '整理題材資料', state: '' },
      { label: '儲存', state: '' }
    ]);
    try {
      setStatusSteps([
        { label: '讀取內容', state: 'done' },
        { label: 'AI 分析主題', state: 'active' },
        { label: '整理題材資料', state: '' },
        { label: '儲存', state: '' }
      ]);
      const analysis = await callClaude(url, desc, image, country);
      setStatusSteps([
        { label: '讀取內容', state: 'done' },
        { label: 'AI 分析主題', state: 'done' },
        { label: '整理題材資料', state: 'done' },
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
        views: 0,
        likes: 0,
        shares: 0,
        country: country || 'OTHER',
        date: new Date().toISOString(),
        lat: finalLat,
        lng: finalLng,
        notes: desc || null,
        sourceUrl: url || null,
        platform: detectedPlatform || 'instagram',
        categories: country ? [COUNTRIES[country]?.split(' ').slice(1).join(' ') || country] : [],
        placeName,
        placeAddress,
        ...analysis,
        title: customTitle.trim() || analysis.title,
      };
      const saved = await saveIdeaToSupabase(ideaData)
      setIdeas(prev => [{ ...ideaData, id: saved.id, sourceUrl: saved.source_url ?? ideaData.sourceUrl, categories: saved.categories ?? ideaData.categories }, ...prev]);
      setActiveTab('my-ideas');
      setFilter('all');
      setSearch('');
      setInputPanelOpen(false);
      setStatusSteps([
        { label: '讀取內容', state: 'done' },
        { label: 'AI 分析主題', state: 'done' },
        { label: '整理題材資料', state: 'done' },
        { label: '儲存完成', state: 'done' }
      ]);
      showNotif('想法已儲存 ✓', 'success');
      setUrl(''); setCustomTitle(''); setDesc(''); setCountry(''); setImage(null); setPlaceName(''); setPlaceAddress(''); setPlaceLat(null); setPlaceLng(null);
      setTimeout(() => setStatusSteps(null), 2500);
    } catch (err) {
      console.error(err);
      showNotif('儲存失敗，請重試', 'error');
      setStatusSteps(null);
    }
    setIsLoading(false);
  }

  async function handleExplore() {
    const keyword = exploreKeyword.trim();
    if (!keyword || exploreLoading) return;
    setExploreLoading(true);
    setExploreResults([]);
    setExploreError('');
    try {
      const res = await fetch('/api/explore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '未能生成建議，請重試');
      setExploreResults(Array.isArray(data.directions) ? data.directions : []);
    } catch (err) {
      setExploreResults([]);
      setExploreError(err instanceof Error ? err.message : '未能生成建議，請重試');
    }
    setExploreLoading(false);
  }

  function addExploreDirection(dir: any) {
    const tags = Array.isArray(dir.tags) ? dir.tags.join(' / ') : '';
    setCustomTitle(dir.title || '');
    setDesc([
      dir.angle ? `拍攝角度：${dir.angle}` : '',
      dir.hook ? `開場 hook：${dir.hook}` : '',
      tags ? `Tags：${tags}` : '',
      dir.youtube_query ? `YouTube 參考搜尋：${dir.youtube_query}` : '',
    ].filter(Boolean).join('\n'));
    if (['HK', 'TW', 'JP', 'KR'].includes(dir.region)) setCountry(dir.region);
    setSelectedType('reel');
    setActiveTab('my-ideas');
    setInputPanelOpen(true);
  }

  const handlePushToScript = (idea: any) => {
    const noteContent = idea.notes || idea.summary || '';
    window.parent.postMessage({
      type: 'SOON_NAVIGATE_TOOL',
      pipeline: 'ig',
      tool: 'script',
      topic: idea.title || '',
      background: noteContent,
      location: idea.placeAddress || idea.address || '',
    }, '*');
  };

  const buildColdTellSource = (idea: any) => [
    idea.title ? `標題：${idea.title}` : '',
    idea.topic ? `主題：${idea.topic}` : '',
    idea.summary ? `摘要：${idea.summary}` : '',
    idea.notes ? `筆記：${idea.notes}` : '',
    idea.scriptHook ? `Hook：${idea.scriptHook}` : '',
    idea.sourceUrl || idea.url || idea.videoUrl ? `來源：${idea.sourceUrl || idea.url || idea.videoUrl}` : '',
    idea.placeName ? `地點：${idea.placeName}` : '',
    idea.placeAddress || idea.address ? `地址：${idea.placeAddress || idea.address}` : '',
  ].filter(Boolean).join('\n')

  const handlePushToColdTell = (idea: any) => {
    window.parent.postMessage({
      type: 'SOON_NAVIGATE_TOOL',
      pipeline: 'ig',
      tool: 'script',
      target: 'cold_tell',
      topic: idea.title || idea.topic || '',
      source: buildColdTellSource(idea),
      location: idea.placeAddress || idea.address || '',
    }, '*');
  };

  const filtered = ideas
    .filter(i => {
      if (filter.startsWith('board-')) return (i.categories || []).includes(filter.replace('board-', ''));
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
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );

  const ideaBoards = Array.from(new Set(ideas.flatMap(i => Array.isArray(i.categories) ? i.categories : []).filter(Boolean))).slice(0, 8);
  const mappedCountries = Array.from(new Set(filtered.map(i => i.country).filter(Boolean))).slice(0, 6);
  const detailIdea = detailIdeaId ? ideas.find(i => i.id === detailIdeaId) : null;
  const detailNoteContent = detailIdea ? (notes[detailIdea.id] !== undefined ? notes[detailIdea.id] : (detailIdea.notes || detailIdea.summary || '')) : '';
  const pendingFields = [url, desc, country].filter(Boolean).length;

  useEffect(() => {
    setAiDetail('');
    setAiDetailLoading(false);
  }, [detailIdeaId]);

  async function handleAiDetail() {
    if (!detailIdea || aiDetailLoading) return;
    setAiDetailLoading(true);
    try {
      const res = await fetch('/api/ai-detail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: detailIdea.title,
          placeName: (detailIdea as any).placeName || '',
          placeAddress: (detailIdea as any).placeAddress || '',
          summary: detailIdea.summary || detailIdea.notes || '',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Unable to load detail');
      setAiDetail(data.detail || '');
    } catch {
      setAiDetail('Unable to load detail');
    }
    setAiDetailLoading(false);
  }

  const typeBadge: Record<string, string> = { reel: 'badge-reel', blog: 'badge-blog', social: 'badge-social' };
  const typeLabel: Record<string, string> = { reel: 'IG Reel' };
  const filterLabel = filter === 'all' ? 'All Ideas' :
    filter.startsWith('board-') ? filter.replace('board-', '') + ' Board' :
    filter.startsWith('country-') ? (COUNTRIES[filter.replace('country-', '')] || '') + ' Ideas' :
    { reel: 'IG Reel' }[filter] || filter;

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
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      <style>{CSS}</style>

      <div className="workspace-shell">
        {inputPanelOpen && (
          <button className="panel-backdrop" type="button" aria-label="關閉快速輸入" onClick={() => setInputPanelOpen(false)} />
        )}

        <aside className={`sidebar${inputPanelOpen ? ' open' : ''}`}>
          <div className="sidebar-top">
            <div>
              <div className="workspace-chip-title">新增想法</div>
              <div className="workspace-sub">快速輸入題材資料</div>
            </div>
            <button className="panel-close" onClick={() => setInputPanelOpen(false)} type="button">
              關閉
            </button>
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
            <span className="step-label">參考連結</span>
            <div style={{ position: 'relative' }}>
              <input className="field" type="url" placeholder="例：https://www.instagram.com/reel/…" value={url} onChange={e => setUrl(e.target.value)} style={{ paddingRight: 112 }} />
              <button
                onClick={autoFillFromLink}
                disabled={linkAutoFilling || !url.trim()}
                style={{
                  position: 'absolute', top: 7, right: 8,
                  fontSize: 10, padding: '6px 10px',
                  background: 'var(--accent)', color: '#fff',
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
              平台如果限制資料讀取，請直接上載截圖或封面。AI 會根據連結與截圖預填資料，但仍建議人手覆核。
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
              有填會優先使用你的題目；沒有填寫就由 AI 生成。
            </div>
          </div>

          <div className="divider" />

          <div className="step-block">
            <span className="step-num">03</span>
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
            <span className="step-num">04</span>
            <span className="step-label">內容類型</span>
            <div className="chips">
              {['reel'].map(t => (
                <button key={t} className={`chip${selectedType === t ? ' sel' : ''}`} onClick={() => setSelectedType(t)}>
                  IG 短片
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
            <div className="sidebar-footer-number">{pendingFields}/3</div>
            <div className="sidebar-footer-copy">已填寫欄位愈完整，AI 生成結果愈穩定。</div>
          </div>
        </aside>

        <main className="main-panel">
          <div className="workspace-header" ref={homeRef}>
            <div>
              <div className="brand-label">SOON 創意營運</div>
              <h1 className="page-title">IG 短片題材靈感工作台</h1>
              <div className="header-meta">{ideasLoading ? '正在同步資料...' : `目前已整理 ${ideas.length} 個靈感素材`}</div>
            </div>
            <div className="workspace-actions">
              <button
                className={`tab-action-btn tab-action-my${activeTab === 'my-ideas' ? ' active' : ''}`}
                type="button"
                onClick={() => setActiveTab('my-ideas')}
              >
                我的靈感庫
              </button>
              <button
                className={`tab-action-btn tab-action-explore${activeTab === 'explore' ? ' active' : ''}`}
                type="button"
                onClick={() => setActiveTab('explore')}
              >
                發掘題材
              </button>
              <button className="primary-top-btn" onClick={() => setInputPanelOpen(true)} type="button">
                新增想法
              </button>
            </div>
          </div>

          {activeTab === 'my-ideas' ? (
            <>
              <section className="board-toolbar" ref={boardRef}>
                <div className="gallery-title">{filterLabel} · {filtered.length} 個</div>
                <div className="controls">
                  <input className="search-field" placeholder="搜尋題目、主題、標籤…" value={search} onChange={e => setSearch(e.target.value)} />
                  <select className="sort-select" value={sort} onChange={e => setSort(e.target.value)}>
                    <option value="date">最新優先</option>
                  </select>
                </div>
              </section>
              <div className="filter-strip">
                {['all', 'reel'].map(f => (
                  <button key={f} className={`filter-btn${filter === f ? ' active' : ''}`} onClick={() => setFilter(f)}>
                    {f === 'all' ? '全部' : 'IG 短片'}
                  </button>
                ))}
                {ideaBoards.length > 0 && <span className="filter-divider" />}
                {ideaBoards.map(board => (
                  <button key={board} className={`filter-btn${filter === 'board-' + board ? ' active' : ''}`} onClick={() => setFilter('board-' + board)}>
                    {board}
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
                    <div>操作</div>
                  </div>
                  <div className="idea-list">
                    {filtered.map(idea => {
                      const referenceUrl = idea.sourceUrl || idea.url || idea.videoUrl || '';
                      const platform = inferPlatformFromUrl(referenceUrl);
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
                                  {referenceUrl && (
                                    <a className="source-link-chip" href={referenceUrl} target="_blank" rel="noopener">
                                      IG Reel link
                                    </a>
                                  )}
                                  <span className={`badge ${typeBadge[idea.type] || 'badge-reel'}`}>{typeLabel[idea.type] || idea.type}</span>
                                  {idea.country && <span className="badge badge-country">{COUNTRIES[idea.country] || idea.country}</span>}
                                  {idea.tags?.slice(0, 3).map((t: string) => <span key={t} className="tag">{t}</span>)}
                                </div>
                              </div>
                            </div>
                            <div className="idea-actions">
                              <button className="btn-script btn-script-meta" type="button" onClick={() => handlePushToScript(idea)}>推上劇本生產線</button>
                              <button className="btn-script btn-script-meta btn-cold-tell" type="button" onClick={() => handlePushToColdTell(idea)}>推上冷敘事</button>
                              <button onClick={()=>setDetailIdeaId(idea.id)} className="row-action-btn">
                                詳情
                              </button>
                              <button className="card-delete row-delete" onClick={async () => {
                                setIdeas(prev => prev.filter(i => i.id !== idea.id));
                                if (detailIdeaId === idea.id) setDetailIdeaId(null);
                                await deleteIdeaFromSupabase(idea.id);
                              }}>×</button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
                </section>
              </div>
            </>
          ) : (
            <section className="explore-placeholder">
              <p className="explore-title">發掘題材方向</p>
              <p className="explore-copy">輸入關鍵字，AI 會整理 IG / YouTube 的近期題材方向。</p>
              <div className="explore-search">
                <input
                  className="explore-input"
                  placeholder="例：香港咖啡店、日本旅行、美食探店…"
                  value={exploreKeyword}
                  onChange={e => setExploreKeyword(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleExplore();
                  }}
                />
                <button className="explore-button" type="button" onClick={handleExplore} disabled={exploreLoading}>
                  {exploreLoading ? '分析中…' : '搜尋'}
                </button>
              </div>
              {!exploreLoading && !exploreError && exploreResults.length === 0 && (
                <p className="explore-note">即將推出 — AI 題材發掘功能開發中</p>
              )}
              {exploreLoading && (
                <div className="explore-loading">
                  <p>🤖 AI 分析題材方向中…</p>
                  <p>📺 搜尋 YouTube 參考例子…</p>
                </div>
              )}
              {exploreError && <p className="explore-error">{exploreError}</p>}
              {exploreResults.length > 0 && (
                <div className="explore-results">
                  {exploreResults.map((dir, idx) => (
                    <article className="explore-card" key={`${dir.title || 'direction'}-${idx}`}>
                      <div className="explore-card-top">
                        <div>
                          <h2 className="explore-card-title">{dir.title}</h2>
                          <p className="explore-card-angle">{dir.angle}</p>
                          {dir.hook && <p className="explore-card-hook">💡 開場：{dir.hook}</p>}
                          <div className="explore-tags">
                            {(dir.tags || []).map((tag: string) => (
                              <span className="explore-tag" key={tag}>{tag}</span>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="explore-videos">
                        <div className="explore-video-label">參考例子</div>
                        {dir.videos?.length ? (
                          <div className="youtube-grid">
                            {dir.videos.map((video: any) => (
                              <button
                                className="youtube-card"
                                key={video.id}
                                type="button"
                                onClick={() => window.open(video.url, '_blank')}
                              >
                                {video.thumb && <img src={video.thumb} alt="" />}
                                <div className="youtube-title">{video.title}</div>
                                <div className="youtube-channel">{video.channel}</div>
                              </button>
                            ))}
                          </div>
                        ) : (
                          <p className="explore-empty-video">暫無參考影片</p>
                        )}
                      </div>
                      <button className="explore-add-btn" type="button" onClick={() => addExploreDirection(dir)}>
                        + 加入我的靈感庫
                      </button>
                    </article>
                  ))}
                </div>
              )}
            </section>
          )}
        </main>

        {detailIdea && (
          <>
            <button className="detail-backdrop" type="button" aria-label="關閉詳情" onClick={() => setDetailIdeaId(null)} />
            <aside className="detail-panel" ref={analysisRef}>
              <div className="detail-panel-head">
                <div>
                  <div className="rail-eyebrow">鏈結摘要</div>
                  <div className="rail-title">{detailIdea.title || '未命名題材'}</div>
                </div>
                <button className="panel-close" type="button" onClick={() => setDetailIdeaId(null)}>×</button>
              </div>

              <div className="detail-section">
                <div className="rail-copy">{detailIdea.summary || detailIdea.notes || '未有摘要內容。'}</div>
                {detailIdea.scriptHook && <div className="hook-quote">「{detailIdea.scriptHook}」</div>}
                <button
                  className={`ai-detail-btn${aiDetail ? ' generated' : ''}`}
                  type="button"
                  onClick={handleAiDetail}
                  disabled={aiDetailLoading}
                >
                  {aiDetailLoading ? '🔍 AI 搜尋中…' : aiDetail ? '✓ 已生成詳細內容' : '✨ AI 提供詳細內容'}
                </button>
                {aiDetail && (
                  <div className="ai-detail-box">
                    {aiDetail}
                  </div>
                )}
              </div>

              <div className="detail-section">
                <div className="rail-eyebrow">詳細內容</div>
                <textarea
                  className="field"
                  rows={6}
                  style={{fontSize:12,lineHeight:1.6,resize:'vertical'}}
                  value={detailNoteContent}
                  onChange={e => setNotes(prev => ({...prev, [detailIdea.id]: e.target.value}))}
                  onBlur={e => saveNote(detailIdea.id, e.target.value)}
                  placeholder="加入筆記、補充資料、拍攝角度...（失焦自動儲存）"
                />
                <div className="expanded-save-state">
                  {savingNote === detailIdea.id ? '儲存中...' : notes[detailIdea.id] !== undefined ? '✓ 已儲存' : ''}
                </div>
              </div>
              <div className="detail-section">
                <div className="rail-eyebrow">參考影片</div>
                {(detailIdea.sourceUrl || detailIdea.url || detailIdea.videoUrl) ? (
                  <div className="detail-link-group">
                    <a className="video-link-btn" href={detailIdea.sourceUrl || detailIdea.url || detailIdea.videoUrl} target="_blank" rel="noopener">
                      {PLATFORM_META[inferPlatformFromUrl(detailIdea.sourceUrl || detailIdea.url || detailIdea.videoUrl)]?.label || '影片'} →
                    </a>
                    <a className="card-source" href={detailIdea.sourceUrl || detailIdea.url || detailIdea.videoUrl} target="_blank" rel="noopener">{hostOf(detailIdea.sourceUrl || detailIdea.url || detailIdea.videoUrl)}</a>
                    <span className="card-date">{new Date(detailIdea.date).toLocaleDateString('zh-HK', { month: 'short', day: 'numeric' })}</span>
                  </div>
                ) : (
                  <div className="rail-muted">未有參考影片連結</div>
                )}
              </div>

              <div className="detail-section">
                <div className="rail-eyebrow">常用地區</div>
                <div className="rail-chip-wrap">
                  {mappedCountries.length ? mappedCountries.map(code => (
                    <span key={code} className="rail-chip">{COUNTRIES[code] || code}</span>
                  )) : <span className="rail-muted">尚未有地區資料</span>}
                </div>
              </div>
            </aside>
          </>
        )}
      </div>

      {notif && (
        <div className={`notif show${notif.type ? ' ' + notif.type : ''}`}>{notif.msg}</div>
      )}
    </>
  );
}

const CSS = `
:root{--bg-base:var(--soon-bg);--bg-surface:var(--soon-surface);--bg-card:var(--soon-card-bg);--bg-card-hover:#fffaf2;--border-subtle:var(--soon-card-border);--border-default:var(--soon-input-border);--accent:var(--soon-accent);--accent-hover:var(--soon-link);--text-primary:var(--soon-text);--text-secondary:var(--soon-text-secondary);--text-muted:var(--soon-text-muted);--bg:var(--bg-base);--surface:var(--bg-surface);--surface2:var(--bg-card);--surface3:var(--bg-card-hover);--surface4:var(--bg-surface);--text:var(--text-primary);--text2:var(--text-secondary);--text3:var(--text-muted);--border:var(--border-subtle);--border2:var(--border-default);--tag-bg:var(--soon-badge-bg);--radius:var(--soon-radius);--radius-md:var(--soon-radius-lg);--sans:var(--soon-font)}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{background:var(--soon-bg-gradient);color:var(--text-primary);font-family:var(--sans);font-size:14px;font-weight:400;line-height:1.65;min-height:100vh}
.workspace-shell{display:flex;flex-direction:column;min-height:100vh;background:var(--soon-bg-gradient)}
.sidebar{position:fixed;top:0;right:0;bottom:0;z-index:1001;width:min(460px,100vw);background:var(--bg-card);border-left:1px solid var(--border-subtle);padding:22px;display:flex;flex-direction:column;gap:18px;overflow-y:auto;transform:translateX(100%);transition:transform .22s ease;box-shadow:var(--soon-card-shadow)}
.sidebar.open{transform:translateX(0)}
.panel-backdrop{position:fixed;inset:0;z-index:1000;border:0;background:rgba(31,35,40,.22);cursor:pointer}
.sidebar-top{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding-bottom:16px;border-bottom:1px solid var(--border-subtle)}
.workspace-chip-title{font-size:18px;font-weight:600;color:var(--text-primary)}
.panel-close{border:1px solid var(--border-default);background:transparent;color:var(--text-secondary);border-radius:var(--radius);padding:7px 10px;font-family:var(--sans);font-size:12px;cursor:pointer}
.panel-close:hover{background:var(--bg-card-hover);color:var(--text-primary)}
.detail-backdrop{position:fixed;inset:0;z-index:1000;border:0;background:rgba(31,35,40,.20);cursor:pointer}
.detail-panel{position:fixed;top:0;right:0;bottom:0;z-index:1001;width:min(360px,100vw);background:var(--bg-card);border-left:1px solid var(--border-subtle);padding:22px;display:flex;flex-direction:column;gap:18px;overflow-y:auto;box-shadow:var(--soon-card-shadow);animation:slideDetail .22s ease}
@keyframes slideDetail{from{transform:translateX(100%)}to{transform:translateX(0)}}
.detail-panel-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding-bottom:16px;border-bottom:1px solid var(--border-subtle)}
.detail-section{display:grid;gap:12px;padding-bottom:16px;border-bottom:1px solid var(--border-subtle)}
.detail-section:last-child{border-bottom:0;padding-bottom:0}
.detail-link-group{display:flex;flex-direction:column;align-items:flex-start;gap:8px}
.ai-detail-btn{width:100%;padding:10px;margin-top:12px;background:var(--soon-btn-primary-bg);color:var(--soon-btn-primary-text);border:0;border-radius:8px;font-size:13px;font-weight:500;cursor:pointer;font-family:var(--sans)}
.ai-detail-btn.generated{background:transparent;color:var(--text-secondary);border:1px solid var(--border-subtle)}
.ai-detail-btn:disabled{cursor:not-allowed;opacity:.7}
.ai-detail-box{margin-top:16px;padding:14px;background:var(--bg-surface);border-radius:8px;border:1px solid var(--border-subtle);font-size:13px;color:var(--text-primary);line-height:1.8;white-space:pre-wrap}
.explore-placeholder{padding:48px 0;text-align:center}
.explore-title{font-size:24px;font-weight:600;color:var(--text-primary)}
.explore-copy{font-size:14px;color:var(--text-secondary);margin-top:8px}
.explore-search{margin:24px auto 0;display:flex;gap:8px;max-width:480px}
.explore-input{flex:1;padding:10px 14px;border-radius:8px;border:1px solid var(--border-default);background:var(--bg-surface);color:var(--text-primary);font-family:var(--sans);font-size:13px;outline:none}
.explore-input:focus{border-color:var(--accent)}
.explore-button{padding:10px 20px;background:var(--soon-btn-primary-bg);color:var(--soon-btn-primary-text);border-radius:8px;border:none;cursor:pointer;font-family:var(--sans);font-size:13px}
.explore-button:disabled{opacity:.65;cursor:not-allowed}
.explore-note{font-size:12px;color:var(--text-muted);margin-top:16px}
.explore-loading{margin-top:24px;color:var(--text-secondary);font-size:14px;line-height:1.9}
.explore-error{margin-top:20px;color:var(--soon-danger-text);font-size:13px}
.explore-results{max-width:980px;margin:32px auto 0;text-align:left}
.explore-card{background:var(--bg-card);border:1px solid var(--border-subtle);border-radius:12px;padding:20px;margin-bottom:16px}
.explore-card-top{display:flex;justify-content:space-between;gap:18px}
.explore-card-title{font-size:18px;font-weight:600;color:var(--text-primary);line-height:1.3}
.explore-card-angle{font-size:13px;color:var(--text-secondary);margin-top:6px}
.explore-card-hook{font-size:12px;color:var(--accent);margin-top:8px}
.explore-tags{display:flex;flex-wrap:wrap;gap:6px;margin-top:12px}
.explore-tag{font-size:10px;padding:4px 9px;background:var(--tag-bg);border:1px solid var(--border-subtle);border-radius:999px;color:var(--text-secondary)}
.explore-videos{border-top:1px solid var(--border-subtle);margin-top:16px;padding-top:16px}
.explore-video-label{font-size:12px;color:var(--text-muted);margin-bottom:10px}
.youtube-grid{display:flex;gap:10px}
.youtube-card{flex:1;min-width:0;background:var(--bg-surface);border:1px solid var(--border-subtle);border-radius:8px;overflow:hidden;text-align:left;cursor:pointer;color:var(--text-primary);font-family:var(--sans);padding:0}
.youtube-card:hover{background:var(--bg-card-hover)}
.youtube-card img{width:100%;aspect-ratio:16/9;object-fit:cover;display:block}
.youtube-title{font-size:11px;line-height:1.35;padding:6px 8px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.youtube-channel{font-size:10px;color:var(--text-muted);padding:0 8px 6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.explore-empty-video{color:var(--text-muted);font-size:12px}
.explore-add-btn{width:100%;margin-top:16px;background:var(--soon-btn-primary-bg);color:var(--soon-btn-primary-text);border:0;border-radius:8px;padding:10px;font-family:var(--sans);font-size:13px;font-weight:500;cursor:pointer}
.explore-add-btn:hover{background:var(--soon-link)}
.workspace-chip{display:inline-flex;align-items:center;gap:10px;padding:10px 14px;border-radius:var(--radius);background:var(--bg-card);border:1px solid var(--border-subtle);font-size:13px;font-weight:500;color:var(--text-primary);cursor:pointer}
.workspace-chip-logo{display:inline-flex;align-items:center;justify-content:center;padding:6px 8px;border-radius:var(--radius);background:var(--bg-card-hover);border:1px solid var(--border-subtle);font-size:10px;font-weight:600;letter-spacing:0.12em;line-height:1;color:var(--accent)}
.workspace-sub{margin-top:10px;font-size:12px;color:var(--text3)}
.sidebar-nav{display:none}
.sidebar-nav-item{padding:10px 14px;border:none;border-left:2px solid transparent;border-radius:0;background:transparent;color:var(--text-secondary);text-align:left;font-family:var(--sans);font-size:13px;font-weight:400;cursor:pointer}
.sidebar-nav-item:hover{background:var(--bg-card);color:var(--text-primary)}
.sidebar-nav-item.active{background:var(--bg-card);color:var(--soon-link);border-left-color:var(--accent)}
.sidebar-section-title{display:none}
.brand-label{font-size:10px;font-weight:500;letter-spacing:0.18em;text-transform:uppercase;color:var(--text3)}
.page-title{font-size:36px;font-weight:600;line-height:1.05;color:var(--text-primary);letter-spacing:0}
.header-meta{font-size:13px;color:var(--text3);font-weight:400;margin-top:8px}
.main-panel{width:100%;padding:24px;display:flex;flex-direction:column;gap:18px}
.workspace-header{display:flex;justify-content:space-between;align-items:flex-start;gap:18px;flex-wrap:wrap}
.workspace-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:flex-end}
.ghost-top-btn,.primary-top-btn{border-radius:8px;padding:8px 16px;font-family:var(--sans);font-size:13px;font-weight:500;cursor:pointer;transition:background 0.15s,transform 0.15s,color 0.15s,border-color 0.15s}
.ghost-top-btn{background:transparent;border:1px solid var(--soon-btn-secondary-border);color:var(--soon-btn-secondary-text)}
.ghost-top-btn:hover{background:var(--soon-btn-secondary-bg);color:var(--soon-btn-secondary-text)}
.primary-top-btn{border:1px solid var(--soon-btn-primary-border);background:var(--soon-btn-primary-bg);color:var(--soon-btn-primary-text);box-shadow:none}
.primary-top-btn:hover{background:var(--soon-link);border-color:var(--soon-link);color:var(--soon-btn-primary-text)}
.tab-action-btn{border:1px solid var(--border-default);background:transparent;color:var(--text-secondary);border-radius:8px;padding:8px 16px;font-family:var(--sans);font-size:13px;font-weight:500;cursor:pointer;transition:background 0.15s,transform 0.15s,color 0.15s,border-color 0.15s}
.tab-action-btn:hover,.ghost-top-btn:hover,.primary-top-btn:hover{transform:translateY(-1px)}
.tab-action-my{border-color:var(--soon-btn-secondary-border);color:var(--soon-btn-secondary-text)}
.tab-action-my.active{background:var(--soon-btn-primary-bg);color:var(--soon-btn-primary-text);border-color:var(--soon-btn-primary-border)}
.tab-action-explore{border-color:var(--soon-btn-secondary-border);color:var(--soon-btn-secondary-text)}
.tab-action-explore.active{background:var(--soon-btn-primary-bg);color:var(--soon-btn-primary-text);border-color:var(--soon-btn-primary-border)}
.hero-row{display:grid;grid-template-columns:1fr;gap:18px}
.board-toolbar{display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap;margin-top:4px}
.gallery-title{font-size:18px;color:var(--text-primary);font-weight:600}
.controls{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.filter-strip{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
.filter-divider{width:1px;height:18px;background:var(--border2);margin:0 4px}
.content-grid{display:grid;grid-template-columns:1fr;gap:18px;align-items:start}
.board-panel{min-width:0}
.rail-eyebrow{font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:var(--text3);margin-bottom:10px}
.rail-title{font-size:20px;line-height:1.2;font-weight:500}
.rail-copy{font-size:13px;line-height:1.7;color:var(--text2);margin-top:10px}
.rail-chip-wrap{display:flex;gap:8px;flex-wrap:wrap}
.rail-chip{padding:7px 10px;border-radius:999px;background:var(--bg-card);border:1px solid var(--border-subtle);font-size:12px;color:var(--text-secondary)}
.rail-muted{font-size:13px;color:var(--text3)}
.rail-list{display:grid;gap:10px}
.rail-list-item{padding:12px 14px;border-radius:var(--radius);background:var(--bg-card);border:1px solid var(--border-subtle);color:var(--text-secondary);font-size:13px;line-height:1.65}
.sidebar-footer-card{display:none}
.sidebar-footer-eyebrow{font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#c8d1f0}
.sidebar-footer-number{font-size:34px;line-height:1;font-weight:600;margin:8px 0;color:var(--text-primary)}
.sidebar-footer-copy{font-size:13px;color:var(--text2);line-height:1.6}
.step-block{display:flex;flex-direction:column;gap:10px}
.step-num{font-size:10px;font-weight:500;letter-spacing:0.12em;color:var(--text3)}
.step-label{font-size:18px;font-weight:600;color:var(--text-primary);line-height:1.2;margin-top:-2px}
.field{width:100%;padding:11px 14px;background:var(--bg-surface);border:1px solid var(--border-subtle);border-radius:var(--radius);color:var(--text-primary);font-family:var(--sans);font-size:13px;font-weight:400;outline:none;transition:border-color 0.2s, background 0.2s;resize:none;appearance:none;-webkit-appearance:none}
.field:focus{border-color:var(--accent);background:var(--bg-card)}
.field::placeholder{color:var(--text3)}
select.field{cursor:pointer;background-image:url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%2396a1c4' stroke-width='1.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 12px center;padding-right:32px}
.stats-row{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px}
.stat-block{display:flex;flex-direction:column;gap:6px}
.stat-label{font-size:10px;font-weight:500;letter-spacing:0.1em;text-transform:uppercase;color:var(--text3)}
.chips{display:flex;flex-wrap:wrap;gap:6px}
.chip{padding:7px 14px;border-radius:999px;border:1px solid var(--border-default);background:transparent;color:var(--text-secondary);font-family:var(--sans);font-size:12px;font-weight:500;cursor:pointer;transition:all 0.15s}
.chip:hover{background:var(--bg-card);color:var(--text-primary)}
.chip.sel{background:var(--accent);color:var(--soon-btn-primary-text);border-color:var(--accent)}
.divider{display:none}
.ai-status{padding:14px 16px;background:var(--bg-card);border:1px solid var(--border-subtle);border-radius:var(--radius-md);font-size:12px;color:var(--text-secondary);line-height:1.9}
.ai-status .step{display:flex;align-items:center;gap:8px}
.step-dot{width:6px;height:6px;border-radius:50%;flex-shrink:0;background:var(--border2);transition:background 0.3s}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
.step.done .step-dot{background:var(--soon-success-text)}
.step.active .step-dot{background:var(--text);animation:pulse 1s ease-in-out infinite}
.step.done{color:var(--text3)}.step.active{color:var(--text);font-weight:400}
.btn-submit{width:100%;padding:13px 20px;background:var(--soon-btn-primary-bg);border:none;border-radius:var(--radius);color:var(--soon-btn-primary-text);font-family:var(--sans);font-size:13px;font-weight:500;letter-spacing:0.02em;cursor:pointer;transition:background 0.15s,transform 0.15s;display:flex;align-items:center;justify-content:center;gap:10px;box-shadow:none}
.btn-submit:hover{background:var(--soon-link);transform:scale(0.98)}
.spinner{width:14px;height:14px;border:1.5px solid rgba(255,255,255,0.25);border-top-color:rgba(255,255,255,0.9);border-radius:50%;animation:spin 0.7s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
.filter-btn{padding:7px 14px;border-radius:999px;border:1px solid var(--border-default);background:transparent;color:var(--text-secondary);font-family:var(--sans);font-size:11px;font-weight:500;letter-spacing:0.05em;cursor:pointer;transition:all 0.15s;text-transform:uppercase}
.filter-btn:hover{background:var(--bg-card);color:var(--text-primary)}
.search-field{padding:9px 14px;background:var(--bg-surface);border:1px solid var(--border-subtle);border-radius:var(--radius);color:var(--text-primary);font-family:var(--sans);font-size:12px;font-weight:400;outline:none;width:220px;transition:border-color 0.2s}
.search-field:focus{border-color:var(--accent)}
.sort-select{padding:9px 32px 9px 12px;background:var(--bg-surface);border:1px solid var(--border-subtle);border-radius:var(--radius);color:var(--text-secondary);font-family:var(--sans);font-size:11px;font-weight:400;outline:none;appearance:none;-webkit-appearance:none;cursor:pointer;background-image:url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%239090a8' stroke-width='1.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 10px center}
.map-panel{margin-bottom:4px;border-radius:var(--radius-md);overflow:hidden;border:1px solid var(--border-subtle)}
.list-wrap{border:1px solid var(--border-subtle);border-radius:var(--radius-md);overflow:hidden;background:var(--bg-card)}
.list-head{display:grid;grid-template-columns:minmax(0,1fr) 220px;gap:12px;padding:12px 16px;background:var(--bg-surface);border-bottom:1px solid var(--border-subtle);font-size:12px;font-weight:500;letter-spacing:0.06em;text-transform:uppercase;color:var(--text-muted)}
.list-head > div:last-child{text-align:right}
.idea-list{display:flex;flex-direction:column}
.idea-row-group{border-bottom:1px solid var(--border-subtle)}
.idea-row-group:last-child{border-bottom:none}
.idea-row{display:grid;grid-template-columns:minmax(0,1fr) 220px;gap:12px;padding:16px;background:transparent;align-items:center}
.idea-row:hover{background:var(--bg-card-hover)}
.idea-main{display:flex;align-items:flex-start;gap:14px;min-width:0}
.idea-main-copy{min-width:0;display:flex;flex-direction:column;gap:5px}
.idea-topic{font-size:10px;font-weight:500;letter-spacing:0.08em;text-transform:uppercase;color:var(--text3)}
.idea-title-row{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.idea-title{font-size:22px;font-weight:600;color:var(--text-primary);line-height:1.15;letter-spacing:0}
.title-edit-btn{font-size:10px;font-weight:500;letter-spacing:0.06em;padding:6px 10px;background:transparent;border:1px solid var(--border-default);color:var(--text-secondary);border-radius:var(--radius);cursor:pointer;font-family:var(--sans)}
.title-edit-btn:hover{background:var(--bg-card-hover);color:var(--text-primary)}
.title-edit-wrap{display:flex;flex-direction:column;gap:8px}
.title-edit-actions{display:flex;gap:8px}
.idea-summary{font-size:12px;color:var(--text2);line-height:1.5;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.idea-badges{display:flex;gap:6px;flex-wrap:wrap;margin-top:2px}
.idea-score-cell{display:flex;flex-direction:column;gap:10px}
.score-number{font-size:20px;font-weight:600;color:var(--text-primary);line-height:1}
.viral-row.compact{width:96px;gap:0}
.idea-metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
.metric-box{padding:10px;border:1px solid var(--border-subtle);border-radius:var(--radius);background:var(--bg-card)}
.metric-value{font-size:18px;font-weight:600;color:var(--text-primary)}
.metric-key{font-size:9px;font-weight:500;letter-spacing:0.1em;text-transform:uppercase;color:var(--text3)}
.idea-meta{display:flex;flex-direction:column;gap:8px}
.idea-actions{display:flex;align-items:center;justify-content:flex-end;gap:8px;flex-wrap:wrap}
.idea-actions .row-action-btn{font-size:10px;font-weight:500;letter-spacing:0.06em;padding:7px 11px;background:var(--soon-btn-primary-bg);border:1px solid var(--soon-btn-primary-border);color:var(--soon-btn-primary-text);border-radius:var(--radius);cursor:pointer;font-family:var(--sans)}
.idea-actions .row-action-btn:hover{background:var(--soon-link);border-color:var(--soon-link);color:var(--soon-btn-primary-text)}
.idea-actions .btn-cold-tell{border-color:rgba(125,211,252,0.38);background:rgba(14,165,233,0.14);color:#bae6fd}
.idea-actions .btn-cold-tell:hover{border-color:#7dd3fc;background:rgba(14,165,233,0.24);color:#fff}
.title-edit-actions .row-action-btn{font-size:10px;font-weight:500;letter-spacing:0.06em;padding:7px 11px;background:transparent;border:1px solid var(--border-default);color:var(--text-secondary);border-radius:var(--radius);cursor:pointer;font-family:var(--sans)}
.title-edit-actions .row-action-btn:hover{background:var(--bg-card-hover);color:var(--text-primary)}
.row-delete{padding:7px 9px;border:1px solid rgba(255,255,255,0.14)}
.idea-expanded{padding:0 16px 16px;background:transparent}
.idea-expanded-grid{display:grid;grid-template-columns:minmax(0,1.6fr) minmax(220px,1fr);gap:16px;padding:16px;border:1px solid var(--border-subtle);border-radius:var(--radius-md);background:var(--bg-card)}
.idea-expanded-side{display:flex;flex-direction:column;gap:12px}
.expanded-label{font-size:10px;font-weight:500;letter-spacing:0.1em;text-transform:uppercase;color:var(--text3);margin-bottom:6px}
.expanded-save-state{font-size:10px;color:var(--text3);margin-top:6px}
.empty-state{text-align:center;padding:80px 20px;color:var(--text3)}
.empty-title{font-size:22px;font-style:italic;color:var(--text2);margin-bottom:8px}
.empty-sub{font-size:13px}
.badge{font-size:9px;font-weight:500;letter-spacing:0.1em;text-transform:uppercase;padding:4px 9px;border-radius:999px;border:1px solid currentColor;opacity:0.9}
.badge-reel{color:var(--soon-link)}.badge-blog{color:var(--soon-success-text)}.badge-social{color:var(--soon-pending-text)}.badge-country{color:var(--text-secondary);border-color:var(--border-subtle);background:var(--bg-card)}
.source-link-chip{display:inline-flex;align-items:center;padding:4px 9px;border:1px solid var(--border-subtle);border-radius:999px;background:var(--bg-card);color:var(--soon-link);font-size:10px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;text-decoration:none}
.source-link-chip:hover{background:var(--soon-link);border-color:var(--soon-link);color:var(--soon-btn-primary-text)}
.card-delete{background:none;border:none;color:var(--text3);cursor:pointer;font-size:14px;line-height:1;padding:2px 4px;border-radius:2px;transition:color 0.15s;flex-shrink:0}
.card-delete:hover{color:var(--text)}
.viral-row{display:flex;align-items:center;gap:10px}
.viral-label{font-size:10px;font-weight:500;letter-spacing:0.08em;text-transform:uppercase;color:var(--text3);white-space:nowrap}
.viral-bar{flex:1;height:4px;background:var(--border-subtle);border-radius:999px;overflow:hidden}
.viral-fill{height:100%;border-radius:2px;transition:width 0.6s ease}
.tag{font-size:10px;padding:4px 9px;background:var(--tag-bg);border-radius:999px;color:var(--text2)}
.video-link-btn{display:inline-flex;align-items:center;justify-content:center;padding:7px 10px;border:1px solid rgba(255,255,255,0.12);border-radius:12px;background:rgba(255,255,255,0.06);font-size:10px;font-weight:500;letter-spacing:0.06em;text-transform:uppercase;color:var(--text2);text-decoration:none;transition:all 0.15s;width:max-content}
.video-link-btn:hover{background:var(--text);color:var(--bg);border-color:var(--text)}
.card-source{font-size:10px;color:var(--text3);word-break:break-all;text-decoration:none;display:block}
.card-source:hover{color:var(--text2)}
.card-date{font-size:10px;color:var(--text3);font-weight:400}
.btn-script{display:inline-flex;align-items:center;justify-content:center;padding:7px 10px;border:1px solid var(--soon-btn-secondary-border);border-radius:var(--radius);background:var(--soon-btn-secondary-bg);font-size:10px;font-weight:500;letter-spacing:0.06em;text-transform:uppercase;color:var(--soon-btn-secondary-text);text-decoration:none;transition:all 0.15s;width:max-content;box-shadow:none}
.btn-script:hover{background:var(--soon-badge-bg);border-color:var(--soon-input-hover);transform:scale(0.98)}
.btn-script-meta{white-space:nowrap}
.hook-quote{font-size:13px;color:var(--text-secondary);padding:10px 14px;border-left:2px solid var(--accent);background:var(--bg-card);border-radius:0 var(--radius) var(--radius) 0;line-height:1.5}
.notif{position:fixed;bottom:28px;right:28px;background:var(--bg-card);border:1px solid var(--border-default);border-radius:var(--radius-md);padding:12px 20px;font-size:12px;color:var(--text-primary);box-shadow:0 12px 28px rgba(53,38,22,.11);z-index:999;transform:translateY(60px);opacity:0;transition:all 0.3s cubic-bezier(.16,1,.3,1);pointer-events:none;font-weight:400}
.notif.show{transform:translateY(0);opacity:1}
.notif.success{border-color:var(--soon-success-border);color:var(--soon-success-text)}
.notif.error{border-color:var(--soon-danger-border);color:var(--soon-danger-text)}
@media(max-width:1200px){.list-head{display:none}.idea-row{grid-template-columns:1fr;gap:12px}.idea-actions{justify-content:flex-start}}
@media(max-width:900px){.main-panel{padding:18px}}
@media(max-width:640px){.workspace-actions{width:100%}.ghost-top-btn,.primary-top-btn{flex:1}.search-field{width:100%}}
`;
