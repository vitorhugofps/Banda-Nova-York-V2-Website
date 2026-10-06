/* PALCO DIGITAL · player próprio sobre a IFrame API do YouTube.
   - Lista "Últimos vídeos": /api/videos (RSS ou playlist do canal, cache na Vercel) → assets/data/videos.json → itens estáticos do HTML.
   - O quadro acompanha o formato do vídeo: 16:9 para horizontal e 9:16 para vertical (Shorts), com transição animada.
   - Modo "clean" (padrão): iframe sem controles, sem cliques e recortado (60 px acima e abaixo), capa/controles/estados da marca.
   - Modo "compat": iframe inteiro, sem nada por cima (configurável em ny-config.playerMode).
   Máquina de estados: idle → arming → ready → playing ⇄ paused · buffering · ended · blocked/unavailable/error. */
import { $, $$, clamp, config, testMode, reduce } from '../core/env.js';
import { bus } from '../core/bus.js';

const CACHE = 'ny-videos-v1', CACHE_MS = 6 * 3600e3;
const MESES = ['jan.', 'fev.', 'mar.', 'abr.', 'maio', 'jun.', 'jul.', 'ago.', 'set.', 'out.', 'nov.', 'dez.'];
const DATE_TITLE = /^\s*\d{1,2} de [a-zç]+ de \d{4}\s*$/i;

export function cleanTitle(t, id, titles = {}) {
  if (titles[id]) return titles[id].replace(/Nova York/g, 'Nova\u00a0York');
  t = String(t || '').replace(/[\u{1F000}-\u{1FFFF}☀-➿️]/gu, '').trim();
  t = t.replace(/\s*[-–|]\s*Contatos?:.*$/i, '').replace(/^banda nova york\s*[-–|:]\s*/i, '').replace(/^[\s\-–]+|[\s\-–]+$/g, '');
  if (DATE_TITLE.test(t)) return 'Registro de show';
  return (t || 'Banda Nova York').replace(/Nova York/g, 'Nova\u00a0York');
}

function fmtTime(s) {
  if (!Number.isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60), r = Math.floor(s % 60), h = Math.floor(m / 60);
  return h ? `${h}:${String(m % 60).padStart(2, '0')}:${String(r).padStart(2, '0')}` : `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}
function relDate(iso) {
  const d = new Date(iso); if (isNaN(d)) return '';
  const days = Math.round((Date.now() - d.getTime()) / 864e5);
  const rtf = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' });
  if (days < 1) return 'hoje';
  if (days < 7) return rtf.format(-days, 'day');
  if (days < 45) return rtf.format(-Math.round(days / 7), 'week');
  const sp = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', month: 'numeric', year: 'numeric' }).formatToParts(d);
  const mo = +sp.find((p) => p.type === 'month').value, yr = sp.find((p) => p.type === 'year').value;
  return `${MESES[mo - 1]} ${yr}`;
}
const isNew = (iso) => (Date.now() - new Date(iso).getTime()) / 864e5 <= (config.newBadgeDays || 21);

async function fetchJSON(url, ms = 3500) {
  const ctrl = new AbortController(); const tm = setTimeout(() => ctrl.abort(), ms);
  try { const r = await fetch(url, { signal: ctrl.signal, headers: { accept: 'application/json' } }); if (!r.ok) throw new Error(r.status); return await r.json(); }
  finally { clearTimeout(tm); }
}

let ytPromise = null;
function loadYT() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (ytPromise) return ytPromise;
  ytPromise = new Promise((res, rej) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { prev?.(); res(window.YT); };
    const s = document.createElement('script'); s.src = 'https://www.youtube.com/iframe_api'; s.async = true;
    s.onerror = () => { ytPromise = null; rej(new Error('api')); };
    document.head.appendChild(s);
    setTimeout(() => { ytPromise = null; rej(new Error('timeout')); }, 8000);
  });
  return ytPromise;
}

export function initPlayer() {
  const root = $('[data-player]'); if (!root) return null;
  const mode = config.playerMode === 'compat' ? 'compat' : 'clean';
  root.dataset.mode = mode;
  const screen = $('.pl__screen', root), mount = $('#pl-mount'), cover = $('[data-pl-cover]', root);
  const thumb = $('.pl__thumb', cover), badge = $('.pl__badge', cover), tEl = $('.pl__title', cover), dEl = $('.pl__date', cover), coverLbl = $('[data-pl-cover-label]', cover);
  const stateBox = $('[data-pl-state]', root), stateT = $('.pl__state-t', stateBox), stateA = $('.pl__state-a', stateBox);
  const list = $('[data-pl-list]'), nowEl = $('[data-pl-now]', root);
  const bPlay = $('[data-act="play"]', root), bMute = $('[data-act="mute"]', root), bFs = $('[data-act="fs"]', root);
  const prog = $('.pl__prog', root), vol = $('.pl__vol', root), cur = $('[data-cur]', root), dur = $('[data-dur]', root);
  const channel = config.channelUrl || 'https://www.youtube.com/@bandanovayork';

  const S = { items: [], titles: {}, idx: 0, state: 'idle', player: null, ready: false, wantPlay: false, retry: 0, dead: new Set(), seeking: false };
  const setState = (s) => {
    S.state = s;
    root.classList.toggle('is-live', ['playing', 'paused', 'buffering'].includes(s));
    root.classList.toggle('is-paused', s === 'paused');
    root.classList.toggle('is-loading', s === 'arming' || s === 'buffering' || s === 'switching');
    bPlay.setAttribute('aria-label', s === 'playing' ? 'Pausar' : 'Reproduzir');
    bus.emit('yt:state', s);
  };

  // ---------- dados ----------
  function fromStatic() {
    return $$('.pl__item', list).map((a) => ({ id: a.dataset.id, title: $('.pl__it', a).textContent, publishedAt: a.dataset.date, isShort: a.dataset.short === '1', _clean: true }));
  }
  function normalize(d) {
    S.titles = d.titles || {};
    const items = (d.items || []).filter((i) => i && /^[\w-]{11}$/.test(i.id))
      .map((i) => ({ id: i.id, title: i._clean ? i.title : cleanTitle(i.title, i.id, S.titles), publishedAt: i.publishedAt, isShort: !!i.isShort }))
      .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))
      .slice(0, 14);
    return { items, featured: d.featured };
  }
  function apply(d, source) {
    const n = normalize(d);
    if (!n.items.length) return;
    const playingId = S.picked ? S.items[S.idx]?.id : null;
    S.items = n.items;
    S.source = source;
    let i = playingId ? S.items.findIndex((x) => x.id === playingId) : -1;
    if (i < 0) {
      const q = new URLSearchParams(location.search).get('v');
      i = q ? S.items.findIndex((x) => x.id === q) : -1;
    }
    if (i < 0) i = Math.max(0, S.items.findIndex((x) => x.id === n.featured));
    if (i < 0) i = Math.max(0, S.items.findIndex((x) => !x.isShort));
    S.idx = i;
    renderList(); paintCover();
  }
  function renderList() {
    list.innerHTML = S.items.map((v, i) => {
      const novo = isNew(v.publishedAt) ? '<span class="pl__new">Novo</span>' : '';
      return `<li><a class="pl__item" href="https://www.youtube.com/watch?v=${v.id}" target="_blank" rel="noopener" data-i="${i}" data-id="${v.id}" data-short="${v.isShort ? 1 : 0}"${i === S.idx ? ' aria-current="true"' : ''}>
        <span class="pl__ith"><img src="https://i.ytimg.com/vi/${v.id}/mqdefault.jpg" alt="" width="320" height="180" loading="lazy" decoding="async"></span>
        <span class="pl__itx"><span class="pl__it">${escapeHtml(v.title)}</span><span class="pl__id larga">${novo}<span>${v.isShort ? 'Vertical' : 'Vídeo'} · ${relDate(v.publishedAt)}</span>${i === S.idx ? '<span class="pl__playing">· No palco</span>' : ''}</span></span></a></li>`;
    }).join('');
    syncListHeight();
  }
  function markCurrent() {
    $$('.pl__item', list).forEach((a) => {
      const on = +a.dataset.i === S.idx;
      a.toggleAttribute('aria-current', on); if (on) a.setAttribute('aria-current', 'true');
      $('.pl__playing', a)?.remove();
      if (on) $('.pl__id', a).insertAdjacentHTML('beforeend', '<span class="pl__playing">· No palco</span>');
    });
  }
  // ---------- formato do quadro ----------
  let painted = false;
  function target() {
    const v = S.items[S.idx]; const vert = !!(v && v.isShort);
    const cw = root.clientWidth || screen.parentElement.clientWidth || 640;
    if (!vert) return { w: cw, h: Math.round((cw * 9) / 16), vert };
    const desk = window.innerWidth >= 1024;
    // o quadro e os controles cabem inteiros na tela (no celular, acima da barra fixa)
    const barH = desk ? 58 : 108, cta = desk ? 0 : 64;
    const maxH = Math.max(320, Math.min(window.innerHeight - barH - cta - (desk ? 56 : 40), 860));
    const h = Math.round(Math.min(maxH, (cw * 16) / 9));
    return { w: Math.round((h * 9) / 16), h, vert };
  }
  let tween = null;
  function fit(animate) {
    const t = target();
    root.classList.toggle('is-vertical', t.vert);
    root.classList.toggle('is-narrow', t.w < 640);
    const follow = () => { root.style.setProperty('--pl-w', `${screen.offsetWidth}px`); syncListHeight(); };
    tween?.kill?.();
    if (animate && window.gsap && !reduce) {
      tween = window.gsap.to(screen, { width: t.w, height: t.h, duration: 0.75, ease: 'power3.inOut', onUpdate: follow, onComplete: () => { follow(); window.ScrollTrigger?.refresh(); keepInView(); } });
    } else { screen.style.width = `${t.w}px`; screen.style.height = `${t.h}px`; follow(); }
  }
  // depois de trocar o formato, o quadro inteiro (com os controles) fica na tela
  function keepInView() {
    const r = root.getBoundingClientRect(), top = r.top + window.scrollY;
    const bottom = r.top + screen.offsetHeight + 58;
    if (r.top >= 0 && bottom <= window.innerHeight) return;
    import('../core/scroll.js').then((m) => m.scrollToY(Math.max(0, top - 20), 0.8));
  }
  let rz = null;
  window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => fit(false), 120); });

  function paintCover() {
    const v = S.items[S.idx]; if (!v) return;
    const orient = v.isShort ? 'v' : 'h';
    const changed = screen.dataset.orient !== orient;
    screen.dataset.orient = orient;
    if (changed || !painted) fit(painted && changed);
    painted = true;
    tEl.textContent = v.title;
    dEl.textContent = `${v.isShort ? 'Vertical' : 'Vídeo'} · ${relDate(v.publishedAt)}`;
    badge.hidden = !isNew(v.publishedAt);
    coverLbl.textContent = `Assistir: ${v.title}`;
    nowEl.textContent = v.title;
    thumb.onerror = null; thumb.onload = null;
    const hi = `https://i.ytimg.com/vi/${v.id}/${v.isShort ? 'oardefault' : 'maxresdefault'}.jpg`, lo = `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`;
    thumb.onload = () => { if (thumb.naturalWidth <= 120 && thumb.src !== lo) thumb.src = lo; };
    thumb.onerror = () => { if (thumb.src !== lo) thumb.src = lo; };
    thumb.src = hi;
    markCurrent();
    syncListHeight();
  }
  function syncListHeight() {
    const aside = list.closest('.vd__list');
    if (window.innerWidth >= 1024) aside.style.setProperty('--list-h', `${Math.max(root.offsetHeight, 420)}px`);
  }

  async function loadData() {
    try { const c = JSON.parse(localStorage.getItem(CACHE) || 'null'); if (c && Date.now() - c.t < CACHE_MS) apply(c.d, 'cache'); } catch (e) { /* sem storage */ }
    if (!S.items.length) apply({ items: fromStatic(), featured: list.dataset.featured }, 'html');
    let d = null;
    try { d = await fetchJSON('/api/videos'); } catch (e) { /* sem API (servidor local) */ }
    if (!d || !d.items?.length) { try { d = await fetchJSON('/assets/data/videos.json'); } catch (e) { d = null; } }
    if (d && d.items?.length) { apply(d, d.source || 'json'); try { localStorage.setItem(CACHE, JSON.stringify({ t: Date.now(), d })); } catch (e) { /* cheio */ } }
  }

  // ---------- YouTube ----------
  let arming = null;
  function arm() {
    if (arming) return arming;
    setState(S.state === 'idle' ? 'arming' : S.state);
    arming = loadYT().then((YT) => new Promise((res) => {
      const v = S.items[S.idx];
      const host = document.createElement('div'); mount.appendChild(host);
      S.player = new YT.Player(host, {
        host: 'https://www.youtube-nocookie.com',
        videoId: v.id, width: '100%', height: '100%',
        playerVars: { controls: 0, rel: 0, playsinline: 1, iv_load_policy: 3, disablekb: 1, fs: 0, modestbranding: 1, cc_load_policy: 0, enablejsapi: 1, origin: location.origin, widget_referrer: location.href },
        events: {
          onReady: () => {
            S.ready = true;
            const f = S.player.getIframe();
            f.setAttribute('title', 'Player de vídeo da Banda Nova York');
            f.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
            f.setAttribute('allow', 'autoplay; encrypted-media; picture-in-picture; fullscreen');
            if (mode === 'clean') f.setAttribute('tabindex', '-1');
            S.player.setVolume(+vol.value);
            if (S.state === 'arming') setState('ready');
            res(S.player);
            if (S.wantPlay) S.player.playVideo();
          },
          onStateChange: (e) => onYT(e.data),
          onError: (e) => onErr(e.data),
          onAutoplayBlocked: () => { setState('paused'); },
        },
      });
    })).catch(() => {
      arming = null;
      if (!S.wantPlay) { setState('idle'); return; }   // falhou sem o usuário pedir: fica na capa e tenta de novo no clique
      setState('error');
      showState('Não foi possível carregar o player agora.', [link(`https://www.youtube.com/watch?v=${S.items[S.idx]?.id || ''}`, 'Assistir no YouTube')]);
    });
    return arming;
  }
  let tick = null;
  function onYT(s) {
    // -1 não iniciado · 0 fim · 1 tocando · 2 pausado · 3 carregando · 5 pronto
    if (s === 1) { hideState(); setState('playing'); bus.emit('media:claim', 'yt'); startTick(); }
    else if (s === 2) { setState('paused'); stopTick(); }
    else if (s === 3) setState('buffering');
    else if (s === 0) { stopTick(); setState('ended'); endCard(); }
    else if (s === 5 && S.state !== 'playing') setState('ready');
  }
  function onErr(code) {
    const v = S.items[S.idx];
    if (code === 5 && S.retry < 1) { S.retry++; S.player.loadVideoById(v.id); return; }
    if (code === 101 || code === 150 || code === 153) {
      setState('blocked');
      showState('Este vídeo abre direto no YouTube.', [link(`https://www.youtube.com/watch?v=${v.id}`, 'Assistir no YouTube'), btn('Próximo vídeo', () => go(S.idx + 1, true))]);
      return;
    }
    S.dead.add(v.id); setState('unavailable');
    showState('Este vídeo não está disponível.', [btn('Próximo vídeo', () => go(S.idx + 1, true))]);
  }
  function startTick() {
    stopTick();
    tick = setInterval(() => {
      if (!S.player?.getCurrentTime || S.seeking) return;
      const c = S.player.getCurrentTime(), d = S.player.getDuration() || 0;
      cur.textContent = fmtTime(c); dur.textContent = fmtTime(d);
      const p = d ? (c / d) * 100 : 0;
      prog.style.setProperty('--p', `${p}%`);
      prog.setAttribute('aria-valuenow', Math.round(p)); prog.setAttribute('aria-valuetext', `${fmtTime(c)} de ${fmtTime(d)}`);
    }, 250);
  }
  function stopTick() { if (tick) clearInterval(tick); tick = null; }

  function play() {
    S.wantPlay = true; hideState();
    if (!S.ready) { arm(); return; }
    S.player.playVideo();
  }
  function pause() { S.wantPlay = false; S.player?.pauseVideo(); }
  function go(i, autoplay = true) {
    const n = S.items.length; if (!n) return;
    S.picked = true;
    i = ((i % n) + n) % n;
    let guard = 0; while (S.dead.has(S.items[i].id) && guard++ < n) i = (i + 1) % n;
    const changedOrient = S.items[i].isShort !== S.items[S.idx]?.isShort;
    S.idx = i; S.retry = 0; hideState();
    if (changedOrient && window.gsap && !reduce) {
      window.gsap.fromTo(thumb, { clipPath: 'polygon(0 0, 0 0, -60% 100%, 0 100%)' }, { clipPath: 'polygon(0 0, 160% 0, 100% 100%, 0 100%)', duration: 0.7, delay: 0.15, ease: 'power3.inOut', clearProps: 'clipPath' });
    }
    paintCover();
    prog.style.setProperty('--p', '0%'); cur.textContent = '00:00'; dur.textContent = '00:00';
    if (history.replaceState) { const u = new URL(location.href); u.searchParams.set('v', S.items[i].id); history.replaceState(null, '', u.pathname + u.search + u.hash); }
    if (!S.ready) { if (autoplay) play(); return; }
    setState('switching');
    if (autoplay) { S.wantPlay = true; S.player.loadVideoById(S.items[i].id); } else { S.player.cueVideoById(S.items[i].id); setState('ready'); }
  }
  function endCard() {
    showState('Gostou do que viu?', [
      `<a class="btn btn--red btn--sm" href="#contratar">Quero a Nova York no meu evento</a>`,
      btn('Próximo vídeo', () => go(S.idx + 1, true)),
    ]);
  }
  function showState(t, actions) {
    stateT.textContent = t; stateA.innerHTML = '';
    actions.forEach((a) => { if (typeof a === 'string') stateA.insertAdjacentHTML('beforeend', a); else stateA.appendChild(a); });
    stateBox.hidden = false;
  }
  function hideState() { stateBox.hidden = true; }
  function link(href, label) { const a = document.createElement('a'); a.className = 'btn btn--red btn--sm'; a.href = href; a.target = '_blank'; a.rel = 'noopener'; a.textContent = `${label} ↗`; return a; }
  function btn(label, fn) { const b = document.createElement('button'); b.type = 'button'; b.className = 'btn btn--line btn--sm'; b.textContent = label; b.addEventListener('click', fn); return b; }
  function escapeHtml(s) { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

  // ---------- eventos ----------
  cover.addEventListener('click', () => (S.state === 'playing' ? pause() : play()));
  bPlay.addEventListener('click', () => (S.state === 'playing' || S.state === 'buffering' ? pause() : play()));
  $('[data-act="prev"]', root).addEventListener('click', () => go(S.idx - 1, S.state === 'playing'));
  $('[data-act="next"]', root).addEventListener('click', () => go(S.idx + 1, S.state === 'playing'));
  bMute.addEventListener('click', () => {
    if (!S.player) return;
    const m = !S.player.isMuted(); m ? S.player.mute() : S.player.unMute();
    root.classList.toggle('is-muted', m); bMute.setAttribute('aria-pressed', String(m)); bMute.setAttribute('aria-label', m ? 'Ativar som' : 'Silenciar');
  });
  vol.addEventListener('input', () => { if (S.player?.setVolume) { S.player.setVolume(+vol.value); if (+vol.value > 0 && S.player.isMuted()) { S.player.unMute(); root.classList.remove('is-muted'); } } });
  list.addEventListener('click', (e) => { const a = e.target.closest('.pl__item'); if (!a) return; e.preventDefault(); go(+a.dataset.i, true); setTimeout(keepInView, 60); });
  // tela cheia (no iPhone, abre no YouTube)
  const canFs = !!(screen.requestFullscreen || screen.webkitRequestFullscreen) && document.fullscreenEnabled !== false;
  bFs.addEventListener('click', () => {
    if (!canFs) { window.open(`https://www.youtube.com/watch?v=${S.items[S.idx].id}`, '_blank', 'noopener'); return; }
    if (document.fullscreenElement) document.exitFullscreen(); else (screen.requestFullscreen || screen.webkitRequestFullscreen).call(screen);
  });
  // progresso: arrastar e teclado
  const seekTo = (x) => {
    const r = prog.getBoundingClientRect(); const t = clamp((x - r.left) / r.width);
    prog.style.setProperty('--p', `${t * 100}%`);
    const d = S.player?.getDuration?.() || 0; if (d) { cur.textContent = fmtTime(t * d); return t * d; } return null;
  };
  prog.addEventListener('pointerdown', (e) => {
    if (!S.ready) return; S.seeking = true; prog.setPointerCapture(e.pointerId); seekTo(e.clientX);
    const mv = (ev) => seekTo(ev.clientX);
    const up = (ev) => { const s = seekTo(ev.clientX); if (s != null) S.player.seekTo(s, true); S.seeking = false; prog.removeEventListener('pointermove', mv); prog.removeEventListener('pointerup', up); };
    prog.addEventListener('pointermove', mv); prog.addEventListener('pointerup', up);
  });
  prog.addEventListener('keydown', (e) => {
    if (!S.ready) return; const c = S.player.getCurrentTime(), d = S.player.getDuration();
    const map = { ArrowRight: c + 5, ArrowLeft: c - 5, ArrowUp: c + 10, ArrowDown: c - 10, Home: 0, End: d - 1 };
    if (e.key in map) { e.preventDefault(); S.player.seekTo(clamp(map[e.key], 0, d), true); }
  });
  // uma mídia por vez
  bus.on('media:claim', (who) => { if (who !== 'yt' && S.state === 'playing') pause(); });

  // carrega a API na intenção (mouse/teclado) ou quando metade do palco estiver visível
  ['pointerenter', 'focusin', 'touchstart'].forEach((ev) => root.addEventListener(ev, () => arm(), { once: true, passive: true }));
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((es) => { if (es[0].isIntersecting) { io.disconnect(); arm(); } }, { threshold: 0.5 });
    io.observe(screen);
  }

  loadData();
  const api = { get state() { return S.state; }, get items() { return S.items; }, go, play, pause, get source() { return S.source; } };
  if (testMode) (window.__NY__ ||= {}).player = api;
  return api;
}
