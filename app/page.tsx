'use client';

import { useEffect } from 'react';

export default function Home() {
  useEffect(() => {
    const SCRIPT_GEN_URL = 'https://your-script-generator.vercel.app';
    const STORAGE_KEY = 'soon_ideas_v2';
    const COUNTRIES: Record<string, string> = {
      HK:'🇭🇰 香港', TW:'🇹🇼 台灣', CN:'🇨🇳 內地', JP:'🇯🇵 日本',
      KR:'🇰🇷 韓國', SG:'🇸🇬 新加坡', TH:'🇹🇭 泰國', MY:'🇲🇾 馬來西亞',
      ID:'🇮🇩 印尼', VN:'🇻🇳 越南', IN:'🇮🇳 印度',
      US:'🇺🇸 美國', GB:'🇬🇧 英國', AU:'🇦🇺 澳洲', CA:'🇨🇦 加拿大',
      FR:'🇫🇷 法國', DE:'🇩🇪 德國', OTHER:'🌍 其他'
    };

    let ideas: any[] = [];
    try { ideas = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch(e) {}
    let currentFilter = 'all';
    let selectedType = 'reel';
    let uploadedImageBase64: string | null = null;
    let isLoading = false;

    const $ = (id: string) => document.getElementById(id);

    function esc(s: string) {
      return (s||'').toString().replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }
    function fmtNum(n: number) {
      if(n>=1e6) return (n/1e6).toFixed(1)+'M';
      if(n>=1e3) return (n/1e3).toFixed(0)+'K';
      return String(n);
    }
    function hostOf(url: string) {
      try { return new URL(url.startsWith('http')?url:'https://'+url).hostname.replace('www.',''); }
      catch { return url.slice(0,40); }
    }
    function showNotif(msg: string, type='') {
      const el = $('notif')!;
      el.textContent = msg;
      el.className = 'notif show'+(type?' '+type:'');
      setTimeout(() => { el.className='notif'; }, 3000);
    }
    function setStatus(steps: {label:string,state:string}[]|null) {
      const el = $('ai-status')!;
      if (!steps) { el.classList.remove('visible'); el.innerHTML=''; return; }
      el.classList.add('visible');
      el.innerHTML = steps.map(s =>
        `<div class="step ${s.state}"><div class="step-dot"></div><span>${s.label}</span></div>`
      ).join('');
    }
    function save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(ideas)); }

    // File upload
    const fileInput = $('file-input') as HTMLInputElement;
    const uploadZone = $('upload-zone')!;
    const uploadPreview = $('upload-preview') as HTMLImageElement;

    function readFile(file: File) {
      const r = new FileReader();
      r.onload = (ev) => {
        uploadedImageBase64 = ev.target!.result as string;
        uploadPreview.src = uploadedImageBase64;
        uploadPreview.style.display = 'block';
      };
      r.readAsDataURL(file);
    }
    fileInput.addEventListener('change', (e) => {
      const f = (e.target as HTMLInputElement).files?.[0];
      if (f) readFile(f);
    });
    uploadZone.addEventListener('dragover', (e) => { e.preventDefault(); uploadZone.classList.add('drag'); });
    uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('drag'));
    uploadZone.addEventListener('drop', (e) => {
      e.preventDefault(); uploadZone.classList.remove('drag');
      const f = (e as DragEvent).dataTransfer?.files[0];
      if (f && f.type.startsWith('image/')) readFile(f);
    });

    // Type chips
    document.querySelectorAll('#type-chips .chip').forEach(c => {
      c.addEventListener('click', () => {
        document.querySelectorAll('#type-chips .chip').forEach(x => x.classList.remove('sel'));
        c.classList.add('sel');
        selectedType = (c as HTMLElement).dataset.t!;
      });
    });

    // Filter buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', () => setFilter((btn as HTMLElement).dataset.f!, btn as HTMLElement));
    });

    $('sort-select')!.addEventListener('change', renderGallery);
    $('search-bar')!.addEventListener('input', renderGallery);

    // Viral score
    function computeViralScore(views: number, likes: number, shares: number, aiScore: number) {
      const likeRate  = views > 0 ? Math.min((likes  / views) * 500,  100) : 0;
      const shareRate = views > 0 ? Math.min((shares / views) * 1000, 100) : 0;
      const engScore  = likeRate * 0.5 + shareRate * 0.5;
      const reach     = Math.min(Math.log10(Math.max(views, 1)) / 8 * 100, 100);
      return Math.round(aiScore * 0.35 + engScore * 0.40 + reach * 0.25);
    }

    const SYSTEM = `You are an AI content strategist for SOON, a Hong Kong AI media content company.
Analyse the given content reference and return ONLY valid JSON (no markdown, no code fences, no explanation):
{
  "title": "concise title in Traditional Chinese or English (max 10 words)",
  "topic": "core topic theme in 3-5 Chinese/English words",
  "summary": "2-3 sentences in Traditional Chinese explaining the idea and why it could work for HK audience",
  "tags": ["tag1","tag2","tag3"],
  "aiViralBase": <number 0-100>,
  "scriptHook": "one punchy opening line for a video script in Traditional Chinese"
}`;

    async function callClaude(url: string, desc: string, image: string|null, views: number, likes: number, shares: number, country: string) {
      const countryName = COUNTRIES[country] || country;
      let userContent: any;
      if (image) {
        const mediaType = image.startsWith('data:image/png') ? 'image/png'
          : image.startsWith('data:image/webp') ? 'image/webp' : 'image/jpeg';
        const data = image.split(',')[1];
        userContent = [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data } },
          { type: 'text', text: `URL: ${url||'(none)'}\nDescription: ${desc||'(none)'}\nCountry: ${countryName}\nViews: ${views}\nLikes: ${likes}\nShares/Saves: ${shares}\n\nAnalyse and return JSON only.` }
        ];
      } else {
        userContent = `URL: ${url}\nDescription: ${desc||'(none)'}\nCountry: ${countryName}\nViews: ${views}\nLikes: ${likes}\nShares/Saves: ${shares}\n\nAnalyse and return JSON only.`;
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

    function resetForm() {
      ['url-input','url-desc','stat-views','stat-likes','stat-shares'].forEach(id => {
        const el = $(id) as HTMLInputElement;
        if (el) el.value = '';
      });
      ($('country-select') as HTMLSelectElement).value = '';
      uploadedImageBase64 = null;
      uploadPreview.style.display = 'none';
      uploadPreview.src = '';
      fileInput.value = '';
    }

    async function handleSubmit() {
      if (isLoading) return;
      const url = ($('url-input') as HTMLInputElement).value.trim();
      const desc = ($('url-desc') as HTMLTextAreaElement).value.trim();
      const views = parseInt(($('stat-views') as HTMLInputElement).value) || 0;
      const likes = parseInt(($('stat-likes') as HTMLInputElement).value) || 0;
      const shares = parseInt(($('stat-shares') as HTMLInputElement).value) || 0;
      const country = ($('country-select') as HTMLSelectElement).value;

      if (!url && !uploadedImageBase64 && !desc) {
        showNotif('請輸入 URL、上載截圖或輸入描述', 'error'); return;
      }

      isLoading = true;
      const btn = $('submit-btn')! as HTMLButtonElement;
      btn.disabled = true;
      $('btn-text')!.textContent = '分析中…';
      setStatus([
        {label:'讀取內容',state:'active'},
        {label:'AI 分析主題',state:''},
        {label:'計算爆款評分',state:''},
        {label:'儲存',state:''}
      ]);

      try {
        setStatus([
          {label:'讀取內容',state:'done'},
          {label:'AI 分析主題',state:'active'},
          {label:'計算爆款評分',state:''},
          {label:'儲存',state:''}
        ]);
        const analysis = await callClaude(url, desc, uploadedImageBase64, views, likes, shares, country);
        setStatus([
          {label:'讀取內容',state:'done'},
          {label:'AI 分析主題',state:'done'},
          {label:'計算爆款評分',state:'done'},
          {label:'儲存',state:'active'}
        ]);
        const idea = {
          id: Date.now(), type: selectedType, url, thumb: uploadedImageBase64,
          views, likes, shares, country: country || 'OTHER',
          date: new Date().toISOString(), ...analysis
        };
        ideas.unshift(idea);
        save(); renderGallery(); renderStatBar();
        showNotif('想法已儲存 ✓', 'success');
        resetForm();
        setStatus([
          {label:'讀取內容',state:'done'},
          {label:'AI 分析主題',state:'done'},
          {label:'計算爆款評分',state:'done'},
          {label:'儲存完成',state:'done'}
        ]);
        setTimeout(() => setStatus(null), 2500);
      } catch(err) {
        console.error(err);
        const fallback = {
          id: Date.now(), type: selectedType, url, thumb: uploadedImageBase64,
          views, likes, shares, country: country || 'OTHER',
          date: new Date().toISOString(),
          title: url || desc || '未命名想法', topic: '待分類',
          summary: desc || '', tags: [],
          viralScore: computeViralScore(views, likes, shares, 50), scriptHook: ''
        };
        ideas.unshift(fallback); save(); renderGallery(); renderStatBar();
        showNotif('AI 分析失敗，已儲存草稿', 'error');
        resetForm(); setStatus(null);
      }

      isLoading = false;
      btn.disabled = false;
      $('btn-text')!.textContent = '分析並儲存想法';
    }

    $('submit-btn')!.addEventListener('click', handleSubmit);

    function setFilter(f: string, el: HTMLElement) {
      currentFilter = f;
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      el.classList.add('active');
      renderGallery();
    }

    function renderStatBar() {
      const total = ideas.length;
      const totalViews = ideas.reduce((s,i) => s + (i.views||0), 0);
      const avgViral = total ? Math.round(ideas.reduce((s,i) => s + (i.viralScore||0), 0) / total) : 0;
      const countries = [...new Set(ideas.map(i => i.country).filter(Boolean))].length;
      $('stat-bar')!.innerHTML =
        `<span class="stat-bar-item"><strong>${total}</strong> 個想法</span>` +
        `<span class="stat-bar-item"><strong>${fmtNum(totalViews)}</strong> 總 Views</span>` +
        `<span class="stat-bar-item"><strong>${avgViral}</strong> 平均爆款分</span>` +
        `<span class="stat-bar-item"><strong>${countries}</strong> 個國家</span>`;
      $('header-meta')!.textContent = `${total} 個想法已儲存`;
    }

    function renderGallery() {
      const search = ($('search-bar') as HTMLInputElement).value.toLowerCase();
      const sort = ($('sort-select') as HTMLSelectElement).value;
      let filtered = ideas.filter(i => {
        if (currentFilter.startsWith('country-')) {
          if (i.country !== currentFilter.replace('country-','')) return false;
        } else if (currentFilter !== 'all' && i.type !== currentFilter) return false;
        if (search) {
          const hay = [i.title,i.topic,i.summary,...(i.tags||[]),COUNTRIES[i.country]||''].join(' ').toLowerCase();
          if (!hay.includes(search)) return false;
        }
        return true;
      });
      filtered.sort((a,b) =>
        sort==='viral' ? (b.viralScore||0)-(a.viralScore||0) :
        sort==='views' ? (b.views||0)-(a.views||0) :
        new Date(b.date).getTime()-new Date(a.date).getTime()
      );
      const gtitle = currentFilter==='all' ? '所有想法' :
        currentFilter.startsWith('country-') ? (COUNTRIES[currentFilter.replace('country-','')]||'') + ' 的想法' :
        ({reel:'IG Reel',blog:'文章 / Blog',social:'Social Post'} as any)[currentFilter] || currentFilter;
      $('gallery-title')!.textContent = `${gtitle} · ${filtered.length} 個`;
      const wrap = $('gallery-wrap')!;
      if (!filtered.length) {
        wrap.innerHTML = `<div class="empty-state"><div class="empty-title">${ideas.length?'沒有符合條件的想法':'尚未儲存任何想法'}</div><div class="empty-sub">${ideas.length?'試試其他篩選或搜尋':'貼入一條 URL 或上載截圖，AI 會自動分析並儲存。'}</div></div>`;
        return;
      }
      const typeBadgeClass: Record<string,string> = {reel:'badge-reel',blog:'badge-blog',social:'badge-social'};
      const typeLabel: Record<string,string> = {reel:'IG Reel',blog:'Blog',social:'Social'};
      wrap.innerHTML = `<div class="grid-wrap"><div class="grid">${filtered.map(idea => {
        const vs = idea.viralScore||0;
        const viralColor = vs>=70?'#7a5a2a':vs>=40?'#3d7a5c':'#5a6a8a';
        const tags = (idea.tags||[]).map((t: string) => `<span class="tag">${esc(t)}</span>`).join('');
        const thumb = idea.thumb ? `<img class="card-thumb visible" src="${idea.thumb}" alt="">` : '';
        const stats = (idea.views||idea.likes||idea.shares) ? `<div class="card-stats">
          ${idea.views?`<div class="stat-item"><div class="stat-val">${fmtNum(idea.views)}</div><div class="stat-key">Views</div></div>`:''}
          ${idea.likes?`<div class="stat-item"><div class="stat-val">${fmtNum(idea.likes)}</div><div class="stat-key">Likes</div></div>`:''}
          ${idea.shares?`<div class="stat-item"><div class="stat-val">${fmtNum(idea.shares)}</div><div class="stat-key">Shares</div></div>`:''}
        </div>` : '';
        const source = idea.url ? `<a class="card-source" href="${esc(idea.url)}" target="_blank" rel="noopener">${esc(hostOf(idea.url))}</a>` : '';
        const hook = idea.scriptHook ? `<div class="hook-quote">「${esc(idea.scriptHook)}」</div>` : '';
        const date = new Date(idea.date).toLocaleDateString('zh-HK',{month:'short',day:'numeric'});
        const scriptUrl = `${SCRIPT_GEN_URL}?idea=${encodeURIComponent(idea.title||'')}&hook=${encodeURIComponent(idea.scriptHook||'')}`;
        const countryLabel = COUNTRIES[idea.country]||idea.country||'';
        return `<div class="card" id="c${idea.id}">
          <div class="card-head">
            <div class="card-badges">
              <span class="badge ${typeBadgeClass[idea.type]||'badge-reel'}">${typeLabel[idea.type]||idea.type}</span>
              ${countryLabel?`<span class="badge badge-country">${countryLabel}</span>`:''}
            </div>
            <button class="card-delete" data-id="${idea.id}" title="刪除">×</button>
          </div>
          ${thumb}
          ${idea.topic?`<div class="card-topic">${esc(idea.topic)}</div>`:''}
          <div class="card-title">${esc(idea.title||'未命名')}</div>
          ${idea.summary?`<div class="card-summary">${esc(idea.summary)}</div>`:''}
          <div class="viral-row">
            <span class="viral-label">爆款</span>
            <div class="viral-bar"><div class="viral-fill" style="width:${vs}%;background:${viralColor}"></div></div>
            <span class="viral-score">${vs}</span>
          </div>
          ${stats}
          ${tags?`<div class="card-tags">${tags}</div>`:''}
          ${source}${hook}
          <div class="card-footer">
            <span class="card-date">${date}</span>
            <a class="btn-script" href="${scriptUrl}" target="_blank">Script →</a>
          </div>
        </div>`;
      }).join('')}</div></div>`;
      wrap.querySelectorAll('.card-delete').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = parseInt((btn as HTMLElement).dataset.id!);
          ideas = ideas.filter(i => i.id !== id);
          save(); renderGallery(); renderStatBar();
          showNotif('已刪除');
        });
      });
    }

    renderGallery();
    renderStatBar();
  }, []);

  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,500;1,400&family=DM+Sans:wght@300;400;500&display=swap" rel="stylesheet" />
      <style>{`
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
        .upload-zone{border:1px dashed var(--border2);border-radius:var(--radius);padding:20px;text-align:center;cursor:pointer;position:relative;transition:background 0.2s,border-color 0.2s;background:var(--surface2)}
        .upload-zone:hover,.upload-zone.drag{background:var(--surface3);border-color:var(--text3)}
        .upload-zone input{position:absolute;inset:0;opacity:0;cursor:pointer;width:100%;height:100%}
        .upload-text{font-size:12px;color:var(--text3);line-height:1.7}
        .upload-preview{width:100%;border-radius:var(--radius);margin-top:10px;display:none;border:1px solid var(--border)}
        .stats-row{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px}
        .stat-block{display:flex;flex-direction:column;gap:6px}
        .stat-label{font-size:10px;font-weight:500;letter-spacing:0.1em;text-transform:uppercase;color:var(--text3)}
        .chips{display:flex;flex-wrap:wrap;gap:6px}
        .chip{padding:5px 14px;border-radius:20px;border:1px solid var(--border2);background:transparent;color:var(--text2);font-family:var(--sans);font-size:12px;font-weight:400;cursor:pointer;transition:all 0.15s}
        .chip:hover{background:var(--surface2);color:var(--text)}
        .chip.sel{background:var(--text);color:var(--bg);border-color:var(--text)}
        .divider{height:1px;background:var(--border);margin:0 -32px}
        .ai-status{padding:14px 16px;background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius);font-size:12px;color:var(--text2);display:none;line-height:1.9}
        .ai-status.visible{display:block}
        .ai-status .step{display:flex;align-items:center;gap:8px}
        .step-dot{width:6px;height:6px;border-radius:50%;flex-shrink:0;background:var(--border2);transition:background 0.3s}
        .step.done .step-dot{background:#5a8a6a}
        .step.active .step-dot{background:var(--text);animation:pulse 1s ease-in-out infinite}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
        .step.done{color:var(--text3)}.step.active{color:var(--text);font-weight:400}
        .btn-submit{width:100%;padding:13px 20px;background:var(--text);border:none;border-radius:var(--radius);color:var(--bg);font-family:var(--sans);font-size:13px;font-weight:400;letter-spacing:0.04em;cursor:pointer;transition:opacity 0.2s;display:flex;align-items:center;justify-content:center;gap:10px}
        .btn-submit:hover{opacity:0.82}.btn-submit:disabled{opacity:0.35;cursor:not-allowed}
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
        .card{background:var(--surface);padding:22px 20px;display:flex;flex-direction:column;gap:12px;border-right:1px solid var(--border);border-bottom:1px solid var(--border);transition:background 0.15s;animation:fadeIn 0.25s ease}
        .card:hover{background:var(--surface2)}
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
        .card-head{display:flex;align-items:flex-start;justify-content:space-between;gap:8px}
        .card-badges{display:flex;gap:6px;flex-wrap:wrap}
        .badge{font-size:9px;font-weight:500;letter-spacing:0.1em;text-transform:uppercase;padding:2px 8px;border-radius:2px;border:1px solid currentColor;opacity:0.75}
        .badge-reel{color:#6b5d9e}.badge-blog{color:#3d7a5c}.badge-social{color:#a05a3a}.badge-country{color:var(--text3);border-color:var(--border2)}
        .card-delete{background:none;border:none;color:var(--text3);cursor:pointer;font-size:14px;line-height:1;padding:2px 4px;border-radius:2px;transition:color 0.15s;flex-shrink:0}
        .card-delete:hover{color:var(--text)}
        .card-thumb{width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:var(--radius);display:none;border:1px solid var(--border)}
        .card-thumb.visible{display:block}
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
      `}</style>

      <header>
        <div className="header-left">
          <span className="brand-label">AI Media Content Creation</span>
          <h1 className="page-title">Idea Collection <em>/ Beta</em></h1>
        </div>
        <div className="header-meta" id="header-meta">0 個想法已儲存</div>
      </header>

      <div className="stat-bar" id="stat-bar">
        <span className="stat-bar-item"><strong>0</strong> 個想法</span>
      </div>

      <div className="layout">
        <div className="input-panel">
          <div className="step-block">
            <span className="step-num">01</span>
            <span className="step-label">URL / Link</span>
            <input className="field" id="url-input" type="url" placeholder="例：https://www.instagram.com/reel/…" />
            <textarea className="field" id="url-desc" rows={2} placeholder="片嘅描述（補充 AI 分析）" />
          </div>
          <div className="divider" />
          <div className="step-block">
            <span className="step-num">02</span>
            <span className="step-label">截圖 / 封面</span>
            <div className="upload-zone" id="upload-zone">
              <input type="file" id="file-input" accept="image/*" />
              <div className="upload-text">Click 上載或拖放截圖<br /><span style={{fontSize:'10px',opacity:0.6}}>PNG · JPG · WEBP</span></div>
              <img className="upload-preview" id="upload-preview" alt="" />
            </div>
          </div>
          <div className="divider" />
          <div className="step-block">
            <span className="step-num">03</span>
            <span className="step-label">數據</span>
            <div className="stats-row">
              <div className="stat-block"><span className="stat-label">Views</span><input className="field" id="stat-views" type="number" min="0" placeholder="例：1200000" /></div>
              <div className="stat-block"><span className="stat-label">Likes</span><input className="field" id="stat-likes" type="number" min="0" placeholder="例：36000" /></div>
              <div className="stat-block"><span className="stat-label">Shares / Saves</span><input className="field" id="stat-shares" type="number" min="0" placeholder="例：48000" /></div>
            </div>
          </div>
          <div className="divider" />
          <div className="step-block">
            <span className="step-num">04</span>
            <span className="step-label">國家 / 地區</span>
            <select className="field" id="country-select">
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
            <div className="chips" id="type-chips">
              <button className="chip sel" data-t="reel">IG Reel</button>
              <button className="chip" data-t="blog">文章 / Blog</button>
              <button className="chip" data-t="social">Social Post</button>
            </div>
          </div>
          <div className="ai-status" id="ai-status" />
          <button className="btn-submit" id="submit-btn">
            <span id="btn-text">分析並儲存想法</span>
          </button>
        </div>

        <div className="gallery-panel">
          <div className="gallery-header">
            <div className="gallery-title" id="gallery-title">所有想法 · 0 個</div>
            <div className="controls">
              <input className="search-field" id="search-bar" placeholder="搜尋…" />
              <select className="sort-select" id="sort-select">
                <option value="date">最新優先</option>
                <option value="viral">爆款評分</option>
                <option value="views">Views 最多</option>
              </select>
            </div>
          </div>
          <div style={{display:'flex',gap:'6px',flexWrap:'wrap',marginBottom:'20px'}}>
            <button className="filter-btn active" data-f="all">All</button>
            <button className="filter-btn" data-f="reel">IG Reel</button>
            <button className="filter-btn" data-f="blog">Blog</button>
            <button className="filter-btn" data-f="social">Social</button>
            <span style={{width:'1px',background:'var(--border2)',margin:'0 4px'}} />
            <button className="filter-btn" data-f="country-HK">🇭🇰 HK</button>
            <button className="filter-btn" data-f="country-TW">🇹🇼 TW</button>
            <button className="filter-btn" data-f="country-JP">🇯🇵 JP</button>
            <button className="filter-btn" data-f="country-KR">🇰🇷 KR</button>
            <button className="filter-btn" data-f="country-US">🇺🇸 US</button>
          </div>
          <div id="gallery-wrap">
            <div className="empty-state">
              <div className="empty-title">尚未儲存任何想法</div>
              <div className="empty-sub">貼入一條 URL 或上載截圖，AI 會自動分析並儲存。</div>
            </div>
          </div>
        </div>
      </div>
      <div className="notif" id="notif" />
    </>
  );
}
