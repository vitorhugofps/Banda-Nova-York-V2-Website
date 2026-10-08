/* Origem da visita (UTM, gclid/fbclid, site de referência) para chegar até o WhatsApp.
   Fica só na aba aberta (sessionStorage); nada é guardado por mais tempo. */
const LAST = 'ny-last';
const KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'gclid', 'fbclid'];

export function registrarOrigem() {
  try {
    const u = new URL(location.href), o = {};
    KEYS.forEach((k) => { const v = u.searchParams.get(k); if (v) o[k] = v.slice(0, 60); });
    const ref = document.referrer ? new URL(document.referrer).hostname : '';
    if (ref && ref !== location.hostname) o.ref = ref;
    if (!Object.keys(o).length && sessionStorage.getItem(LAST)) return;
    o.t = Date.now();
    sessionStorage.setItem(LAST, JSON.stringify(o));
  } catch (e) { /* navegação privada */ }
  try { localStorage.removeItem('ny-first'); } catch (e) { /* versões antigas guardavam o primeiro toque */ }
}

export function lerOrigem() {
  let o = {};
  try { o = JSON.parse(sessionStorage.getItem(LAST) || '{}'); } catch (e) { o = {}; }
  const partes = [o.utm_source, o.utm_medium, o.utm_campaign, o.utm_content].filter(Boolean);
  let texto = partes.join('/');
  if (!texto && (o.gclid || o.fbclid)) texto = o.gclid ? 'google-ads' : 'meta-ads';
  if (!texto && o.ref) texto = `via ${o.ref}`;
  return { ...o, texto: texto || 'site' };
}
