/* /api/videos · últimos vídeos do canal oficial (Vercel Function, Node 18+). Não usa chave de API.
   Fontes, em ordem:
   1. RSS público do canal: 15 mais recentes, com data exata. Shorts são detectados pelo link /shorts/.
   2. Página da playlist de envios do canal, quando o RSS falha (o RSS do YouTube cai de tempos em tempos desde 2025).
   3. assets/data/videos.json, a lista de reserva.
   Títulos curados e o vídeo em destaque vêm sempre de assets/data/videos.json.
   Cache na borda: 30 min (s-maxage) + 1 dia servindo o anterior enquanto revalida. ?debug=1 mostra o diagnóstico, sem cache. */
const fs = require('fs');
const path = require('path');

const CHANNEL = process.env.YT_CHANNEL_ID || 'UCI7G43SicG2nEoRWxZ72fnA';
const UPLOADS = 'UU' + CHANNEL.slice(2);
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36';
const MAX = 15;

function decode(s) {
  return String(s || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
    .trim();
}

function parseFeed(xml) {
  const out = [];
  const entries = xml.match(/<entry>[\s\S]*?<\/entry>/g) || [];
  for (const e of entries) {
    const id = (e.match(/<yt:videoId>([\w-]{11})<\/yt:videoId>/) || [])[1];
    if (!id) continue;
    const title = decode((e.match(/<title>([\s\S]*?)<\/title>/) || [])[1]);
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
      if (!seen.has(pv.videoId)) {
        seen.add(pv.videoId);
        const reel = !!(pv.navigationEndpoint && pv.navigationEndpoint.reelWatchEndpoint);
        const secs = +pv.lengthSeconds || 0;
        out.push({ id: pv.videoId, title: textOf(pv.title), publishedAt: relDate(textOf(pv.videoInfo), now), isShort: reel || (secs > 0 && secs <= 60) });
      }
      return;
    }
    const lv = o.lockupViewModel;
    if (lv && lv.contentId && /VIDEO/.test(lv.contentType || '')) {
      if (!seen.has(lv.contentId)) {
        seen.add(lv.contentId);
        const md = (lv.metadata && lv.metadata.lockupMetadataViewModel) || {};
        const rel = (JSON.stringify(md.metadata || {}).match(/\d+\s+(?:second|minute|hour|day|week|month|year)s?\s+ago/i) || [])[0];
        out.push({ id: lv.contentId, title: textOf(md.title), publishedAt: relDate(rel, now), isShort: /reelWatchEndpoint/.test(JSON.stringify(lv)) });
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

async function get(url, accept) {
  const r = await fetch(url, {
    signal: AbortSignal.timeout(3500),
    headers: { 'user-agent': UA, accept, 'accept-language': 'en-US,en;q=0.9', cookie: 'CONSENT=YES+cb; SOCS=CAI' },
  });
  if (!r.ok) throw new Error(String(r.status));
  return r.text();
}

module.exports = async function handler(req, res) {
  const base = readStatic();
  const debug = /[?&]debug=1/.test(req.url || '');
  const tried = [];
  const now = Date.now();
  const common = { v: 1, generatedAt: new Date(now).toISOString(), channel: base.channel, featured: base.featured, titles: base.titles || {} };
  // vídeos curados que saíram da fonte continuam disponíveis no fim da lista
  const withExtras = (items) => {
    const ids = new Set(items.map((i) => i.id));
    (base.items || []).forEach((i) => { if (!ids.has(i.id)) items.push(i); });
    return items;
  };
  const send = (body, cache) => {
    res.setHeader('Cache-Control', debug ? 'no-store' : cache);
    res.status(200).json(debug ? { ...body, tried } : body);
  };

  try {
    const items = parseFeed(await get(`https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL}`, 'application/atom+xml,text/xml'));
    if (!items.length) throw new Error('vazio');
    return send({ ...common, source: 'rss', items: withExtras(items) }, 'public, s-maxage=1800, stale-while-revalidate=86400');
  } catch (e) { tried.push('rss ' + (e && e.message || e)); }

  try {
    const page = parsePlaylistPage(await get(`https://www.youtube.com/playlist?list=${UPLOADS}&hl=en&gl=US`, 'text/html'), now);
    const items = mergeKnown(page.slice(0, MAX), base, now);
    if (items.length < 3) throw new Error('lista curta (' + items.length + ')');
    return send({ ...common, source: 'canal', items: withExtras(items) }, 'public, s-maxage=1800, stale-while-revalidate=86400');
  } catch (e) { tried.push('canal ' + (e && e.message || e)); }

  send({ ...base, source: 'static', error: tried.join(' | ') }, 'public, s-maxage=300, stale-while-revalidate=3600');
};

module.exports.parseFeed = parseFeed;
module.exports.parsePlaylistPage = parsePlaylistPage;
