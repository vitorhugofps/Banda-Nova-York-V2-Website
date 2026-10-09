/* Ambiente, configuração e utilidades compartilhadas. */
export const html = document.documentElement;
export const mq = (q) => window.matchMedia(q).matches;
export const reduce = mq('(prefers-reduced-motion: reduce)');
export const fine = mq('(pointer: fine)');
export const coarse = mq('(pointer: coarse)');
export const config = JSON.parse(document.getElementById('ny-config')?.textContent || '{}');
const conn = navigator.connection || {};
export const saveData = !!conn.saveData || /(^|slow-)2g|3g/.test(conn.effectiveType || '');
export const lowMem = (navigator.deviceMemory || 8) < 2;
// ganchos de teste só no computador de quem desenvolve (nunca no site publicado)
export const testMode = new URLSearchParams(location.search).has('test') && /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);

export const RUN = 0.6745;           // 1 / tan(56°)
export const SKEW = -34;             // skewX que transforma vertical em 56°

export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
export const inOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);   // power2.inOut
export const cutEase = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2); // power3.inOut
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

/** Polígono do CORTE 56° para um elemento w×h com progresso t (0 = fechado, 1 = aberto). */
export function cortePolygon(t, w, h) {
  const kr = (RUN * h) / Math.max(1, w);
  const xb = t * (1 + kr) - kr;
  const xt = xb + kr;
  return { xb, xt, css: `polygon(0% 0%, ${(xt * 100).toFixed(3)}% 0%, ${(xb * 100).toFixed(3)}% 100%, 0% 100%)` };
}
/** Polígonos de entrada pelo CORTE 56° em % do próprio elemento (o ângulo fica certo em qualquer proporção). */
export function corteVals(el) {
  const w = el.offsetWidth || 1, h = el.offsetHeight || 0, k = (RUN * h * 100) / w;
  return { from: `polygon(0 0, 0 0, ${(-k).toFixed(2)}% 100%, 0 100%)`, to: `polygon(0 0, ${(100 + k).toFixed(2)}% 0, 100% 100%, 0 100%)` };
}
/** Texto sem metades de emoji (um corte no meio de um par substituto quebra o encodeURIComponent). */
export function bemFormado(s) {
  s = String(s ?? '');
  if (s.toWellFormed) return s.toWellFormed();
  let o = '';
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff) { const d = s.charCodeAt(i + 1); if (d >= 0xdc00 && d <= 0xdfff) { o += s[i] + s[i + 1]; i++; } else o += '\ufffd'; }
    else if (c >= 0xdc00 && c <= 0xdfff) o += '\ufffd';
    else o += s[i];
  }
  return o;
}
/** Linha vermelha que acompanha a aresta do corte (px). */
export function corteEdge(xb, xt, w, h, px = 3) {
  const a = xb * w, b = xt * w;
  return `polygon(${b}px 0px, ${b + px}px 0px, ${a + px}px ${h}px, ${a}px ${h}px)`;
}

export const onIdle = (fn) => ('requestIdleCallback' in window ? requestIdleCallback(fn, { timeout: 1500 }) : setTimeout(fn, 200));

/** Observa uma vez (entrada) e chama fn. */
export function once(el, fn, opts = {}) {
  if (!el) return;
  if (!('IntersectionObserver' in window)) { fn(el); return; }
  const io = new IntersectionObserver((es) => {
    es.forEach((e) => { if (e.isIntersecting) { io.unobserve(e.target); fn(e.target); } });
  }, { rootMargin: opts.margin || '0px 0px -12% 0px', threshold: opts.threshold ?? 0.01 });
  io.observe(el);
}

/** Fuso de São Paulo: AAAA-MM-DD de hoje. */
export function hojeSP() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}
