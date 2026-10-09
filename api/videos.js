/* /api/videos · últimos vídeos do canal oficial (Vercel Function, Node 18+). Não usa chave de API.
   Fontes, em ordem:
   1. RSS público do canal: 15 mais recentes, com data exata. Shorts são detectados pelo link /shorts/.
   2. Página da playlist de envios do canal, quando o RSS falha (o RSS do YouTube cai de tempos em tempos desde 2025).
   3. assets/data/videos.json, a lista de reserva.
   Títulos curados e o vídeo em destaque vêm sempre de assets/data/videos.json.
   O formato de cada vídeo (vertical ou horizontal) é conferido no oEmbed do YouTube pelo endereço /shorts/:
   ele responde 113×200 para vídeos verticais e 200×113 para horizontais. O player usa isso para mudar o quadro.
   Cache na borda: 30 min (s-maxage) + 1 dia servindo o anterior enquanto revalida.
   Só aceita GET/HEAD em /api/videos sem parâmetros (qualquer parâmetro redireciona para a URL limpa, que é a que fica em cache).
   Diagnóstico: /api/videos?debug=<DEBUG_TOKEN>, só quando a variável de ambiente DEBUG_TOKEN estiver definida na Vercel. */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const CHANNEL = process.env.YT_CHANNEL_ID || 'UCI7G43SicG2nEoRWxZ72fnA';
const UPLOADS = 'UU' + CHANNEL.slice(2);
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36';
const MAX = 15;
const MAX_BYTES = 3e6;   // respostas maiores que isso são descartadas
const ID = /^[\w-]{11}$/;
const MEMO_MS = 10 * 60e3;   // instância aquecida reaproveita a última lista boa (menos chamadas ao YouTube)
let memo = null;
const corta = (t) => Array.from(String(t || '')).slice(0, 200).join('');

// entidade numérica fora do Unicode não derruba a leitura
const ponto = (n) => (n > 0 && n <= 0x10ffff && !(n >= 0xd800 && n <= 0xdfff) ? String.fromCodePoint(n) : '');

function decode(s) {
  return String(s || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#(\d{1,7});/g, (_, n) => ponto(+n))
    .replace(/&#x([0-9a-f]{1,6});/gi, (_, n) => ponto(parseInt(n, 16)))
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
    .trim();
}

// leitura linear (indexOf), no máximo MAX * 2 entradas: um feed malformado não trava a função
function parseFeed(xml) {
  const out = [];
  const entries = [];
  let i = 0;
  while (entries.length < MAX * 2) {
    const a = xml.indexOf('<entry>', i); if (a < 0) break;
    const b = xml.indexOf('</entry>', a); if (b < 0) break;
    entries.push(xml.slice(a, b + 8)); i = b + 8;
  }
  for (const e of entries) {
    const id = (e.match(/<yt:videoId>([\w-]{11})<\/yt:videoId>/) || [])[1];
    if (!id) continue;
    const title = corta(decode((e.match(/<title>([\s\S]*?)<\/title>/) || [])[1]));
    const publishedAt = (e.match(/<published>([^<]+)<\/published>/) || [])[1] || null;
    const href = (e.match(/<link[^>]+rel="alternate"[^>]+href="([^"]+)"/) || e.match(/<link[^>]+href="([^"]+)"/) || [])[1] || '';
    out.push({ id, title, publishedAt, isShort: /\/shorts\//.test(href) });
  }
  return out;
}

// "2 weeks ago" vira uma data aproximada
const UNIT = { second: 1, minute: 60, hour: 3600, day: 86400, week: 604800, month: 2629800, year: 31557600 };
function relDate(text, now) {
  const m = /(\d+)\s+(second|minute|hour|day|week|month|year)s?\s+ago/i.exec(String(text || ''));
  return m ? new Date(now - +m[1] * UNIT[m[2].toLowerCase()] * 1000).toISOString() : null;
}

function textOf(t) {
  if (!t) return '';
  if (typeof t === 'string') return t;
  if (t.simpleText) return t.simpleText;
  if (t.content) return t.content;
  if (Array.isArray(t.runs)) return t.runs.map((r) => r.text || '').join('');
  return '';
}

// lê o objeto JSON que começa em html[start], respeitando strings
function scanJson(html, start) {
  let depth = 0, inStr = false, esc = false;
  for (let j = start; j < html.length; j++) {
    const c = html[j];
    if (inStr) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inStr = false; continue; }
    if (c === '"') inStr = true;
    else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) return JSON.parse(html.slice(start, j + 1));
  }
  return null;
}

// página da playlist de envios: vídeos e Shorts, do mais novo para o mais antigo
function parsePlaylistPage(html, now = Date.now()) {
  const m = /ytInitialData\s*=\s*\{/.exec(html);
  if (!m) return [];
  const data = scanJson(html, m.index + m[0].length - 1);
  const out = [], seen = new Set();
  (function walk(o) {
    if (!o || typeof o !== 'object') return;
    if (Array.isArray(o)) { o.forEach(walk); return; }
    const pv = o.playlistVideoRenderer;
    if (pv && pv.videoId) {
      if (ID.test(pv.videoId) && !seen.has(pv.videoId)) {
        seen.add(pv.videoId);
        const reel = !!(pv.navigationEndpoint && pv.navigationEndpoint.reelWatchEndpoint);
        const secs = +pv.lengthSeconds || 0;
        out.push({ id: pv.videoId, title: corta(textOf(pv.title)), publishedAt: relDate(textOf(pv.videoInfo), now), isShort: reel || (secs > 0 && secs <= 60) });
      }
      return;
    }
    const lv = o.lockupViewModel;
    if (lv && lv.contentId && /VIDEO/.test(lv.contentType || '')) {
      if (ID.test(lv.contentId) && !seen.has(lv.contentId)) {
        seen.add(lv.contentId);
        const md = (lv.metadata && lv.metadata.lockupMetadataViewModel) || {};
        const rel = (JSON.stringify(md.metadata || {}).match(/\d+\s+(?:second|minute|hour|day|week|month|year)s?\s+ago/i) || [])[0];
        out.push({ id: lv.contentId, title: corta(textOf(md.title)), publishedAt: relDate(rel, now), isShort: /reelWatchEndpoint/.test(JSON.stringify(lv)) });
      }
      return;
    }
    for (const k in o) walk(o[k]);
  })(data);
  return out;
}

// dados conhecidos (data exata e Shorts) valem mais que os aproximados; quem ficou sem data herda a do vizinho mais novo
function mergeKnown(items, base, now) {
  const known = new Map((base.items || []).map((i) => [i.id, i]));
  let last = now;
  return items.map((i) => {
    const k = known.get(i.id);
    const v = k ? { ...i, publishedAt: k.publishedAt || i.publishedAt, isShort: !!k.isShort } : { ...i };
    if (v.publishedAt) last = Date.parse(v.publishedAt); else { last -= 60000; v.publishedAt = new Date(last).toISOString(); }
    return v;
  });
}

function readStatic() {
  try {
    return JSON.parse(fs.readFileSync(path.join(process.cwd(), 'assets', 'data', 'videos.json'), 'utf8'));
  } catch (e) {
    return { v: 1, items: [], titles: {}, featured: null };
  }
}

async function get(url, accept, ms = 3000) {
  const r = await fetch(url, {
    signal: AbortSignal.timeout(ms),
    headers: { 'user-agent': UA, accept, 'accept-language': 'en-US,en;q=0.9', cookie: 'CONSENT=YES+cb; SOCS=CAI' },
  });
  if (!r.ok) throw new Error(String(r.status));
  if (+(r.headers.get('content-length') || 0) > MAX_BYTES) throw new Error('grande demais');
  // lê aos pedaços e para no teto (sem content-length, não carrega tudo na memória antes de conferir)
  if (!r.body || !r.body.getReader) { const t = await r.text(); if (t.length > MAX_BYTES) throw new Error('grande demais'); return t; }
  const rd = r.body.getReader(), partes = []; let n = 0;
  for (;;) {
    const { done, value } = await rd.read(); if (done) break;
    n += value.length; if (n > MAX_BYTES) { try { await rd.cancel(); } catch (e) { /* nada */ } throw new Error('grande demais'); }
    partes.push(value);
  }
  return Buffer.concat(partes.map((p) => Buffer.from(p))).toString('utf8');
}

// confere vertical × horizontal de cada vídeo (em paralelo; se falhar, mantém o que já se sabia)
async function checkFormat(items) {
  await Promise.all(items.slice(0, MAX).map(async (it) => {
    try {
      const j = JSON.parse(await get(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent('https://www.youtube.com/shorts/' + it.id)}`, 'application/json', 2500));
      if (j && j.width && j.height) it.isShort = j.height > j.width;
    } catch (e) { /* mantém */ }
  }));
  return items;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.setHeader('Allow', 'GET, HEAD'); return res.status(405).end(); }
  const q = new URL(req.url || '/', 'http://local').searchParams;
  const token = process.env.DEBUG_TOKEN || '';
  const dado = q.get('debug') || '';
  const h = (x) => crypto.createHash('sha256').update(String(x)).digest();
  const debug = !!token && !!dado && crypto.timingSafeEqual(h(dado), h(token));   // comparação em tempo constante
  // parâmetros extras não furam o cache da borda
  if ([...q.keys()].length && !debug) { res.setHeader('Cache-Control', 'public, s-maxage=86400'); res.setHeader('Location', '/api/videos'); return res.status(308).end(); }
  const base = readStatic();
  const tried = [];
  const now = Date.now();
  const common = { v: 1, generatedAt: new Date(now).toISOString(), channel: base.channel, featured: base.featured, titles: base.titles || {} };
  // vídeos curados que saíram da fonte continuam disponíveis no fim da lista
  const withExtras = (items) => {
    const ids = new Set(items.map((i) => i.id));
    (base.items || []).forEach((i) => { if (!ids.has(i.id)) items.push(i); });
    return items;
  };
  if (!debug && memo && now - memo.t < MEMO_MS) { res.setHeader('Cache-Control', memo.cache); res.setHeader('X-Robots-Tag', 'noindex'); return res.status(200).json(memo.body); }
  const send = (body, cache) => {
    if (!debug && body.source !== 'static') memo = { t: now, body, cache };
    res.setHeader('Cache-Control', debug ? 'no-store' : cache);
    res.setHeader('X-Robots-Tag', 'noindex');
    if (!debug) delete body.error;
    res.status(200).json(debug ? { ...body, tried } : body);
  };

  try {
    const items = parseFeed(await get(`https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL}`, 'application/atom+xml,text/xml'));
    if (!items.length) throw new Error('vazio');
    await checkFormat(items);
    return send({ ...common, source: 'rss', items: withExtras(items) }, 'public, s-maxage=1800, stale-while-revalidate=86400');
  } catch (e) { tried.push('rss ' + (e && e.message || e)); }

  try {
    const page = parsePlaylistPage(await get(`https://www.youtube.com/playlist?list=${UPLOADS}&hl=en&gl=US`, 'text/html'), now);
    const items = mergeKnown(page.slice(0, MAX), base, now);
    if (items.length < 3) throw new Error('lista curta (' + items.length + ')');
    await checkFormat(items);
    return send({ ...common, source: 'canal', items: withExtras(items) }, 'public, s-maxage=1800, stale-while-revalidate=86400');
  } catch (e) { tried.push('canal ' + (e && e.message || e)); }

  send({ ...base, source: 'static', error: tried.join(' | ') }, 'public, s-maxage=300, stale-while-revalidate=3600');
};

module.exports.parseFeed = parseFeed;
module.exports.parsePlaylistPage = parsePlaylistPage;
module.exports.checkFormat = checkFormat;
