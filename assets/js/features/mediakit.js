/* MEDIA KIT · banco de imagens
   - Telão de LED curvo em 3D (CSS): câmera no centro de um anel de fotos. Fica preso na tela por um bom trecho da rolagem
     e gira com ela (e com o arraste); a legenda acompanha a foto que está de frente.
   - Grade com recortes por ponto focal, filtros (GSAP Flip) e lightbox acessível. O site não oferece download das fotos. */
import { $, $$, clamp, reduce, mq, once, RUN, testMode } from '../core/env.js';
import { stopScroll, startScroll } from '../core/scroll.js';

export async function initMediaKit() {
  const sec = $('#media-kit'); if (!sec) return;
  let data;
  try { data = await (await fetch('/assets/data/media.json')).json(); } catch (e) { return; }
  const byId = new Map(data.items.map((m) => [m.id, m]));
  const grid = $('[data-mk-grid]', sec);
  const cells = $$('.mk__cell', grid);

  // revelação em CORTE com atraso pela diagonal
  if (!reduce && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver((es) => {
      const vis = es.filter((e) => e.isIntersecting).map((e) => e.target);
      vis.sort((a, b) => (a.offsetLeft + RUN * a.offsetTop) - (b.offsetLeft + RUN * b.offsetTop));
      vis.forEach((c, i) => { c.style.setProperty('--d', `${Math.min(i * 0.06, 0.42)}s`); c.classList.add('is-in'); io.unobserve(c); });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.01 });
    cells.forEach((c) => io.observe(c));
  } else cells.forEach((c) => c.classList.add('is-in'));

  // prévia curta + "ver todas"
  const more = $('[data-mk-more]', sec);
  more?.addEventListener('click', () => {
    grid.classList.add('is-open'); more.setAttribute('aria-expanded', 'true');
    const first = $('.mk__cell.is-more .mk__item', grid); first?.focus({ preventScroll: true });
    window.ScrollTrigger?.refresh();
  });
  // filtros
  const fbtns = $$('[data-filter]', sec);
  fbtns.forEach((b) => b.addEventListener('click', () => {
    const f = b.dataset.filter;
    if (f !== 'todas') grid.classList.add('is-open');
    fbtns.forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    const { Flip } = window;
    const state = Flip && !reduce ? Flip.getState(cells) : null;
    cells.forEach((c) => c.classList.toggle('is-out', f !== 'todas' && c.dataset.cat !== f));
    cells.forEach((c) => { if (!c.classList.contains('is-out')) c.classList.add('is-in'); });
    if (state) Flip.from(state, { duration: 0.6, ease: 'power3.inOut', absolute: true, scale: false, onEnter: (els) => window.gsap.fromTo(els, { opacity: 0 }, { opacity: 1, duration: 0.4 }), onLeave: (els) => window.gsap.to(els, { opacity: 0, duration: 0.25 }) });
  }));

  // ---------- lightbox ----------
  const lb = $('[data-lb]'), stage = $('[data-lb-stage]', lb), cap = $('[data-lb-cap]', lb);
  const iEl = $('[data-lb-i]', lb), nEl = $('[data-lb-n]', lb);
  let seq = [], at = 0, opener = null;
  const visibleIds = () => cells.filter((c) => !c.classList.contains('is-out') && getComputedStyle(c).display !== 'none').map((c) => c.dataset.id);
  function srcset(m) { return m.sizes.map((s) => `${s.src} ${s.w}w`).join(', '); }
  function show(i, dir = 1) {
    at = (i + seq.length) % seq.length;
    const m = byId.get(seq[at]);
    const im = new Image();
    im.className = 'lb__img'; im.alt = m.alt; im.decoding = 'async'; im.draggable = false; im.sizes = '100vw'; im.srcset = srcset(m); im.src = m.sizes[m.sizes.length - 1].src;
    const old = $('.lb__img', stage);
    if (!reduce) { im.classList.add('is-enter'); im.style.setProperty('--kr', '.4'); }
    stage.appendChild(im);
    const reveal = () => { requestAnimationFrame(() => { im.classList.add('go'); setTimeout(() => old?.remove(), 520); }); };
    if (reduce) old?.remove(); else if (im.complete) reveal(); else { im.onload = reveal; im.onerror = reveal; }
    iEl.textContent = String(at + 1).padStart(2, '0'); nEl.textContent = String(seq.length).padStart(2, '0');
    cap.textContent = `${m.alt} · ${data.credit}`;
    [1, -1].forEach((d) => { const n = byId.get(seq[(at + d + seq.length) % seq.length]); const p = new Image(); p.sizes = '100vw'; p.srcset = srcset(n); });
    if (history.replaceState) history.replaceState(null, '', `#foto=${m.id}`);
  }
  function open(id, from) {
    seq = visibleIds(); if (!seq.includes(id)) seq = data.items.map((m) => m.id);
    opener = from || document.activeElement;
    lb.showModal(); stopScroll(); show(seq.indexOf(id));
    $('[data-lb-close]', lb).focus();
  }
  function close() {
    if (!lb.open) return;
    lb.close(); startScroll();
    $$('.lb__img', stage).forEach((n) => n.remove());
    if (history.replaceState) history.replaceState(null, '', location.pathname + location.search + '#media-kit');
    opener?.focus?.({ preventScroll: true });
  }
  grid.addEventListener('click', (e) => { const b = e.target.closest('[data-open]'); if (b) open(b.dataset.open, b); });
  $('[data-lb-close]', lb).addEventListener('click', close);
  $('[data-lb-prev]', lb).addEventListener('click', () => show(at - 1, -1));
  $('[data-lb-next]', lb).addEventListener('click', () => show(at + 1, 1));
  lb.addEventListener('cancel', (e) => { e.preventDefault(); close(); });
  lb.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); show(at + 1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); show(at - 1); }
    else if (e.key === 'Home') { e.preventDefault(); show(0); }
    else if (e.key === 'End') { e.preventDefault(); show(seq.length - 1); }
  });
  // gestos
  let sx = 0, sy = 0, st = 0;
  stage.addEventListener('pointerdown', (e) => { sx = e.clientX; sy = e.clientY; st = performance.now(); });
  stage.addEventListener('pointerup', (e) => {
    const dx = e.clientX - sx, dy = e.clientY - sy, v = Math.abs(dx) / Math.max(1, performance.now() - st);
    if (dy > 120 && Math.abs(dy) > Math.abs(dx)) { close(); return; }
    if (Math.abs(dx) > 50 || v > 0.4) { if (Math.abs(dx) > 10) show(at + (dx < 0 ? 1 : -1)); }
  });
  const hash = location.hash.match(/^#foto=([\w-]+)/);
  if (hash && byId.has(hash[1])) setTimeout(() => open(hash[1]), 400);

  // sem menu de "salvar imagem" nas fotos do banco
  [stage, grid].forEach((el) => el.addEventListener('contextmenu', (e) => { if (e.target.tagName === 'IMG') e.preventDefault(); }));

  // ---------- TELÃO 3D ----------
  initWall(sec, (id, el) => open(id, el));
  if (testMode) (window.__NY__ ||= {}).mediakit = { open, close };
}

function initWall(sec, onOpen) {
  const wall = $('.wall', sec); if (!wall || reduce) return;
  const cam = $('.wall__cam', wall), ring = $('.wall__ring', wall), panels = $$('.wall__p', wall);
  const capEl = $('[data-wall-cap]', wall), iEl = $('[data-wall-i]', wall), nEl = $('[data-wall-n]', wall), progEl = $('[data-wall-prog]', wall);
  const pin = wall.closest('.wall-pin') || wall;
  if (nEl) nEl.textContent = String(panels.length).padStart(2, '0');
  let front = -1;
  const N = panels.length, TH = 360 / N;
  const { gsap, ScrollTrigger } = window;
  let W, H, R, P, scrollRy = 0, dragRy = 0, vel = 0, active = false, dragging = false, moved = 0;
  function measure() {
    const vw = window.innerWidth, vh = window.innerHeight;
    // telão grande: as fotos ocupam boa parte da tela
    // (o painel da frente aparece a 80% do tamanho por causa da perspectiva)
    const portrait = vw < 600 || vh > vw * 1.2;
    const ar = portrait ? 1.05 : 0.66;
    W = clamp(vw * (portrait ? 1.04 : 0.56), 280, 980);
    H = Math.min(W * ar, vh * (portrait ? 0.62 : 0.66));
    W = H / ar;
    R = (W + 10) / (2 * Math.sin((TH / 2) * Math.PI / 180));
    P = R * 0.8;
    cam.style.setProperty('--p', `${P}px`);
    panels.forEach((p, i) => { p.style.setProperty('--w', `${W}px`); p.style.setProperty('--h', `${H}px`); p.style.transform = `rotateY(${i * TH}deg) translateZ(${-R}px)`; });
  }
  function render() {
    const ry = scrollRy + dragRy;
    ring.style.transform = `translateZ(${P}px) rotateY(${ry}deg)`;
    let best = 0, bestA = 999;
    panels.forEach((p, i) => {
      let a = ((i * TH + ry) % 360 + 540) % 360 - 180;
      const vis = Math.abs(a) < 82;
      p.style.visibility = vis ? 'visible' : 'hidden';
      if (vis) p.style.setProperty('--dim', (clamp((Math.abs(a) - 10) / 55) * 0.6).toFixed(3));
      if (Math.abs(a) < bestA) { bestA = Math.abs(a); best = i; }
    });
    if (best !== front) {
      front = best;
      if (iEl) iEl.textContent = String(best + 1).padStart(2, '0');
      if (capEl) { capEl.textContent = panels[best].dataset.cap || ''; gsap.fromTo(capEl, { clipPath: 'polygon(0 0, 0 0, -40% 100%, 0 100%)' }, { clipPath: 'polygon(0 0, 140% 0, 100% 100%, 0 100%)', duration: 0.45, ease: 'power3.out', overwrite: true }); }
    }
  }
  // acerto do clique em 3D: o painel visível mais frontal cujo retângulo contém o ponto
  function hit(x, y) {
    const ry = scrollRy + dragRy; let best = null, bestA = 999;
    panels.forEach((p, i) => {
      if (p.style.visibility === 'hidden') return;
      const r = p.getBoundingClientRect();
      if (x < r.left || x > r.right || y < r.top || y > r.bottom) return;
      const a = Math.abs(((i * TH + ry) % 360 + 540) % 360 - 180);
      if (a < bestA) { bestA = a; best = p; }
    });
    return best;
  }
  measure(); render();
  window.addEventListener('resize', () => { measure(); render(); });
  // preso na tela: a rolagem gira o anel quase uma volta inteira
  ScrollTrigger.create({ trigger: pin, start: 'top bottom', end: 'bottom top', onUpdate: (s) => { scrollRy = 60 - s.progress * 400; if (progEl) progEl.style.transform = `scaleX(${s.progress.toFixed(3)})`; render(); } });
  if ('IntersectionObserver' in window) new IntersectionObserver((es) => { active = es[0].isIntersecting; }, { threshold: 0 }).observe(wall);
  gsap.ticker.add(() => {
    if (!active || dragging || Math.abs(vel) < 0.01) return;
    dragRy += vel; vel *= 0.93; render();
  });
  // arraste (mouse e caneta; no toque a rolagem já gira o telão)
  if (mq('(pointer: fine)')) {
    let lx = 0;
    wall.addEventListener('pointerdown', (e) => { dragging = true; moved = 0; lx = e.clientX; vel = 0; wall.classList.add('is-drag'); wall.setPointerCapture(e.pointerId); });
    wall.addEventListener('pointermove', (e) => { if (!dragging) return; const dx = e.clientX - lx; lx = e.clientX; moved += Math.abs(dx); const d = dx * 0.12; dragRy += d; vel = d; render(); });
    const end = (e) => {
      if (!dragging) return; dragging = false; wall.classList.remove('is-drag');
      if (moved < 6) { const el = hit(e.clientX, e.clientY); if (el) onOpen(el.dataset.open, $(`[data-open="${el.dataset.open}"]`, $('[data-mk-grid]'))); }
    };
    wall.addEventListener('pointerup', end); wall.addEventListener('pointercancel', end);
  } else {
    $('.wall__hint', wall).textContent = 'Role para girar o telão';
    wall.addEventListener('click', (e) => { const el = hit(e.clientX, e.clientY); if (el) onOpen(el.dataset.open, $(`[data-open="${el.dataset.open}"]`, $('[data-mk-grid]'))); });
  }
}
