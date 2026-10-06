/* /api/videos · últimos vídeos do canal oficial (Vercel Serverless Function, Node 18+).
   Lê o RSS público do YouTube (15 mais recentes, sem chave de API), detecta Shorts pelo link /shorts/
   e mescla títulos curados e o vídeo em destaque de assets/data/videos.json.
   Cache na borda: 30 min (s-maxage) + 1 dia servindo o anterior enquanto revalida. */
const fs = require('fs');
const path = require('path');

const CHANNEL = process.env.YT_CHANNEL_ID || 'UCI7G43SicG2nEoRWxZ72fnA';

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

function readStatic() {
  try {
    return JSON.parse(fs.readFileSync(path.join(process.cwd(), 'assets', 'data', 'videos.json'), 'utf8'));
  } catch (e) {
    return { v: 1, items: [], titles: {}, featured: null };
  }
}

module.exports = async function handler(req, res) {
  const base = readStatic();
  try {
    const r = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL}`, {
      signal: AbortSignal.timeout(3500),
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; BandaNovaYorkSite/1.0)', accept: 'application/atom+xml,text/xml' },
    });
    if (!r.ok) throw new Error(`rss ${r.status}`);
    const items = parseFeed(await r.text());
    if (!items.length) throw new Error('rss vazio');
    // vídeos curados que saíram do RSS continuam disponíveis no fim da lista
    const ids = new Set(items.map((i) => i.id));
    (base.items || []).forEach((i) => { if (!ids.has(i.id)) items.push(i); });
    res.setHeader('Cache-Control', 'public, s-maxage=1800, stale-while-revalidate=86400');
    res.status(200).json({ v: 1, source: 'rss', generatedAt: new Date().toISOString(), channel: base.channel, featured: base.featured, titles: base.titles || {}, items });
  } catch (err) {
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=3600');
    res.status(200).json({ ...base, source: 'static', error: String(err && err.message || err) });
  }
};

module.exports.parseFeed = parseFeed;
