/* Origem da visita (UTM, gclid/fbclid, site de referência) para chegar até o WhatsApp.
   Fica só na aba aberta (sessionStorage); nada é guardado por mais tempo. */
const LAST = 'ny-last';
const KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'gclid', 'fbclid'];
// a origem vai para a mensagem do WhatsApp: só letras, números e _ - + (sem quebras de linha, negrito ou links), até 40 caracteres inteiros;
// o ponto vira "·" para o WhatsApp não transformar um domínio em link clicável (instagram·com)
const seguro = (v) => Array.from(String(v || '').normalize('NFC').replace(/\./g, '·').replace(/[^\p{L}\p{N}·_\-+ ]+/gu, ' ').replace(/\s+/g, ' ').trim()).slice(0, 40).join('');

export function registrarOrigem() {
  try {
    const u = new URL(location.href), o = {};
    KEYS.forEach((k) => { const v = seguro(u.searchParams.get(k)); if (v) o[k] = v; });
    // referência interna (o próprio site, com ou sem www, ou a ida de http para https) não conta como origem
    const semWww = (h) => String(h || '').toLowerCase().replace(/^www\./, '');
    const refHost = document.referrer ? new URL(document.referrer).hostname : '';
    if (refHost && semWww(refHost) !== semWww(location.hostname)) o.ref = seguro(refHost);
    // sem UTM nem clique de anúncio, uma nova referência não apaga a campanha já guardada nesta aba
    const ant = (() => { try { return JSON.parse(sessionStorage.getItem(LAST) || 'null'); } catch (e) { return null; } })();
    const temCampanha = (x) => !!x && KEYS.some((k) => x[k]);
    if (!temCampanha(o) && (temCampanha(ant) || (ant && !o.ref))) return;
    o.t = Date.now();
    sessionStorage.setItem(LAST, JSON.stringify(o));
  } catch (e) { /* navegação privada */ }
  try { localStorage.removeItem('ny-first'); } catch (e) { /* versões antigas guardavam o primeiro toque */ }
}

export function lerOrigem() {
  let o = {};
  try { o = JSON.parse(sessionStorage.getItem(LAST) || '{}'); } catch (e) { o = {}; }
  const partes = [o.utm_source, o.utm_medium, o.utm_campaign, o.utm_content].map(seguro).filter(Boolean);
  let texto = partes.join('/');
  if (!texto && (o.gclid || o.fbclid)) texto = o.gclid ? 'google-ads' : 'meta-ads';
  if (!texto && o.ref) texto = `via ${seguro(o.ref)}`;
  return { ...o, texto: texto || 'site' };
}
