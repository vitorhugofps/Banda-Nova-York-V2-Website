/* BANDA NOVA YORK · boot do site.
   Vocabulário de movimento: CORTE (56°), FEIXE (faixa vermelha a 56°), LARGURA (Archivo 62→125) e ACENDER (manifesto). */
import { $, $$, reduce, testMode, RUN, onIdle } from './core/env.js';
import { initScroll, scroll } from './core/scroll.js';
import { audio } from './core/audio.js';
import { registrarOrigem } from './core/origem.js';
import { initOpening } from './scenes/opening.js';
import { initHeader } from './scenes/header.js';
import { initReveals, initExperiencia, initAssinatura, initMomentos, initFiguras, initShowUnico, initEmpresas, initVideoStage, initFooter } from './scenes/sections.js';

registrarOrigem();

// --kr: avanço horizontal do corte de 56° em relação à largura de cada elemento
function setKr(el) { const w = el.clientWidth || 1, h = el.clientHeight || 0; el.style.setProperty('--kr', ((RUN * h) / w).toFixed(4)); }
const krEls = $$('[data-corte], .mk__item, .mo__fig-b');
if ('ResizeObserver' in window) { const ro = new ResizeObserver((es) => es.forEach((e) => setKr(e.target))); krEls.forEach((el) => ro.observe(el)); }
else krEls.forEach(setKr);

function boot() {
  if (!window.gsap || !window.ScrollTrigger) { document.documentElement.classList.add('reduce'); return; }
  initScroll();
  // cenas com palco preso primeiro, na ordem do DOM
  const opening = initOpening();
  const header = initHeader();
  initExperiencia();
  initAssinatura();
  initMomentos();
  initFiguras();
  initShowUnico();
  initEmpresas();
  initVideoStage();
  initFooter();
  initReveals();
  document.fonts?.ready.then(() => window.ScrollTrigger.refresh());
  window.addEventListener('load', () => window.ScrollTrigger.refresh());
  // a página muda de altura sem redimensionar a janela (grade aberta, filtros, formulário, player, imagens):
  // as cenas recalculam onde começam e terminam (senão o rodapé e as âncoras ficam defasados)
  if ('ResizeObserver' in window) {
    let hAnt = document.body.offsetHeight, rt = 0;
    new ResizeObserver(() => {
      const h = document.body.offsetHeight;
      if (Math.abs(h - hAnt) < 2) return;
      hAnt = h; clearTimeout(rt);
      rt = setTimeout(() => { if (!window.ScrollTrigger.isRefreshing) window.ScrollTrigger.refresh(); hAnt = document.body.offsetHeight; }, 200);
    }).observe(document.body);
  }

  // módulos sob demanda
  const lazy = (sel, margin, load) => {
    const el = $(sel); if (!el) return;
    if (!('IntersectionObserver' in window)) { load(); return; }
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { io.disconnect(); load(); } }, { rootMargin: margin });
    io.observe(el);
  };
  lazy('#videos', '100% 0px', () => import('./features/player.js').then((m) => m.initPlayer()));
  let mkP = null; const mk = () => (mkP ||= import('./features/mediakit.js').then((m) => m.initMediaKit()));   // uma vez só
  lazy('#media-kit', '150% 0px', mk);
  let ctOk = false; const ct = () => { if (ctOk) return; ctOk = true; import('./features/contratar.js').then((m) => m.initContratar()); };
  lazy('#contratar', '150% 0px', ct);
  window.addEventListener('load', () => onIdle(ct), { once: true });
  // deep links
  if (/^#foto=/.test(location.hash)) mk();
  if (location.hash && location.hash.length > 1 && !/^#foto=/.test(location.hash)) {
    let t = null; try { t = document.getElementById(decodeURIComponent(location.hash.slice(1))); } catch (e) { t = null; }
    if (t) setTimeout(() => import('./core/scroll.js').then((s) => s.goTo(t, { duration: 0.01, focus: false })), 300);
  }
  $$('[data-year]').forEach((e) => { e.textContent = new Date().getFullYear(); });
  // faixa de momentos (celular): quando rola de lado, também rola pelo teclado
  const ml = $('.mo__layers');
  if (ml) {
    const f = () => {
      const s = ml.scrollWidth > ml.clientWidth + 4 && getComputedStyle(ml).overflowX !== 'visible';
      if (s) { ml.tabIndex = 0; ml.setAttribute('role', 'region'); ml.setAttribute('aria-label', 'Momentos do show (role para o lado)'); }
      else { ml.removeAttribute('tabindex'); ml.removeAttribute('role'); ml.removeAttribute('aria-label'); }
    };
    f(); window.addEventListener('resize', f);
  }
  if (testMode) Object.assign((window.__NY__ ||= {}), { lenis: scroll.lenis, audio, opening, header, reduce });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
