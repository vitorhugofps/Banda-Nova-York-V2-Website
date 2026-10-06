/* Cenas das seções: CORTE (revelação 56°), LARGURA (assinatura 62→125), Experiência, Momentos, O show é único, Empresas. */
import { $, $$, clamp, lerp, smooth, cutEase, inOut, reduce, saveData, cortePolygon, corteEdge, once, RUN, mq } from '../core/env.js';
import { bus } from '../core/bus.js';

const { gsap, ScrollTrigger } = window;

/* ---------- revelações simples (IntersectionObserver + transição CSS) ---------- */
export function initReveals() {
  // o IntersectionObserver considera o clip-path do alvo: observa-se o pai do elemento cortado
  $$('[data-corte], .mo__fig-b').forEach((el) => once(el.parentElement, () => el.classList.add('is-in')));
  $$('[data-reveal]').forEach((el) => once(el, (t) => t.classList.add('is-in')));
  // LARGURA: a assinatura ganha largura com a rolagem (fora da abertura)
  if (!reduce) {
    $$('[data-largura]').forEach((el) => {
      if (el.closest('#abertura')) return;
      el.style.setProperty('--wdth', 62); el.style.setProperty('--ls', '0em');
      ScrollTrigger.create({
        trigger: el, start: 'top 92%', end: 'top 45%',
        onUpdate: (s) => { const t = inOut(s.progress); el.style.setProperty('--wdth', (62 + 63 * t).toFixed(1)); el.style.setProperty('--ls', `${(0.22 * t).toFixed(3)}em`); },
      });
    });
  }
  // loop de vídeo da Performance: toca só em vista
  $$('.as__loop').forEach((v) => {
    if (reduce || saveData) return;
    let claimed = false;
    bus.on('media:claim', (w) => { claimed = w === 'yt'; if (claimed) v.pause(); });
    if ('IntersectionObserver' in window) new IntersectionObserver((es) => {
      if (es[0].isIntersecting && !claimed) { v.preload = 'auto'; v.play().catch(() => {}); } else v.pause();
    }, { threshold: 0.35 }).observe(v);
  });
}

/* ---------- ASSINATURA: cada palavra abre a largura (62 → 100) e mostra mais do palco ---------- */
export function initAssinatura() {
  const rows = $$('[data-row]'); if (!rows.length || reduce) return;
  const wide = mq('(min-width: 1024px)');
  rows.forEach((row) => {
    const mask = $('.as__mask', row), src = $('.as__src', row), bar = $('.as__bar', row);
    ScrollTrigger.create({
      trigger: row, start: 'top 92%', end: 'top 38%',
      onUpdate: (s) => {
        const t = inOut(s.progress);
        if (wide) mask.style.setProperty('--wdth', (62 + 38 * t).toFixed(1));
        bar.style.setProperty('--bar', (0.15 + 0.85 * t).toFixed(3));
      },
    });
    ScrollTrigger.create({ trigger: row, start: 'top bottom', end: 'bottom top', onUpdate: (s) => src.style.setProperty('--py', `${((s.progress - 0.5) * -40).toFixed(1)}px`) });
  });
}

/* ---------- A EXPERIÊNCIA: o elenco passa de P&B a cor pelo Corte ---------- */
export function initExperiencia() {
  const media = $('.xp__media'), frame = $('.xp__frame'), cor = $('.xp__cor'), edge = $('.xp__edge'), todos = $('.xp__todos');
  if (!media || reduce) { todos?.classList.add('is-in'); return; }
  const desk = mq('(min-width: 1024px)');
  ScrollTrigger.create({
    trigger: desk ? media : frame, start: desk ? 'top 60%' : 'top 85%', end: desk ? 'bottom 75%' : 'bottom 30%',
    onUpdate: (s) => {
      const t = cutEase(clamp(s.progress / 0.85));
      const w = frame.clientWidth, h = frame.clientHeight;
      const c = cortePolygon(t, w, h);
      cor.style.clipPath = c.css;
      edge.style.clipPath = t > 0.001 && t < 0.999 ? corteEdge(c.xb, c.xt, w, h, 4) : 'polygon(0 0,0 0,0 0)';
      if (t > 0.97) todos.classList.add('is-in');
    },
  });
}

/* ---------- MOMENTOS: o show em cortes (palco preso no desktop) ---------- */
export function initMomentos() {
  const sec = $('#momentos'); if (!sec) return;
  if (reduce || !mq('(min-width: 1024px)')) return;
  const stage = $('.mo__stage', sec), layers = $$('.mo__layer', sec), head = $('.mo__head', sec), label = $('.mo__label', sec);
  const edge = $('.mo__edge', sec), nameEl = $('[data-mo-name]', sec), iEl = $('[data-mo-i]', sec), nEl = $('[data-mo-n]', sec);
  const prog = $('.mo__progress', sec);
  const N = layers.length;
  nEl.textContent = String(N).padStart(2, '0');
  prog.innerHTML = layers.map(() => '<i></i>').join('');
  const ticks = $$('i', prog);
  const imgs = layers.map((l) => $('img', l));
  const INTRO = 35, SEG = 48, CUT = 0.6, TOTAL = INTRO + (N - 1) * SEG;
  let cur = -1;
  function setName(i) {
    if (i === cur) return; cur = i;
    iEl.textContent = String(i + 1).padStart(2, '0');
    nameEl.textContent = layers[i].dataset.name;
    ticks.forEach((t, k) => t.classList.toggle('on', k <= i));
    gsap.fromTo(nameEl, { clipPath: 'polygon(0 0, 0 0, -60% 100%, 0 100%)' }, { clipPath: 'polygon(0 0, 160% 0, 100% 100%, 0 100%)', duration: 0.5, ease: 'power3.inOut', overwrite: true });
  }
  // carrega as próximas fotos à medida que o palco avança
  imgs.forEach((im, i) => { if (i > 1) im.loading = 'lazy'; });
  function render(P) {
    const v = P * TOTAL, w = stage.clientWidth, h = stage.clientHeight;
    head.style.opacity = (1 - smooth(18, 34, v)).toFixed(3);
    head.style.transform = `translateY(calc(-50% - ${(smooth(18, 34, v) * 40).toFixed(1)}px))`;
    label.style.opacity = smooth(32, 38, v).toFixed(3);
    imgs[0].style.transform = `scale(${(1.08 - 0.08 * smooth(0, INTRO, v)).toFixed(4)})`;
    let idx = 0, edgeCss = 'polygon(0 0,0 0,0 0)';
    for (let j = 1; j < N; j++) {
      const s0 = INTRO + (j - 1) * SEG;
      const c = clamp((v - s0) / (SEG * CUT));
      const t = cutEase(c);
      const L = layers[j];
      if (c <= 0) { L.style.clipPath = 'polygon(0 0,0 0,0 100%,0 100%)'; }
      else if (c >= 1) { L.style.clipPath = 'none'; }
      else { const p = cortePolygon(t, w, h); L.style.clipPath = p.css; edgeCss = corteEdge(p.xb, p.xt, w, h, 3); }
      imgs[j].style.transform = `scale(${(1.12 - 0.12 * t).toFixed(4)})`;
      layers[j - 1].style.setProperty('--dim', (0.4 * t).toFixed(3));
      if (c >= 0.5) idx = j;
      if (c > 0 && j + 1 < N) imgs[j + 1].loading = 'eager';
    }
    edge.style.clipPath = edgeCss;
    setName(idx);
  }
  ScrollTrigger.create({ trigger: $('.mo__pin', sec), start: 'top top', end: 'bottom bottom', onUpdate: (s) => render(s.progress), onRefresh: (s) => render(s.progress) });
  render(0);
}

/* ---------- O SHOW É ÚNICO: o feixe se alarga até virar o palco inteiro ---------- */
export function initShowUnico() {
  const sec = $('#show-unico'); if (!sec) return;
  const field = $('.su__field', sec), track = $('.su__track', sec);
  if (reduce) { field.style.clipPath = 'none'; return; }
  ScrollTrigger.create({
    trigger: sec, start: 'top bottom', end: 'top top',
    onUpdate: (s) => {
      const t = inOut(s.progress);
      const vw = sec.clientWidth, H = sec.clientHeight, run = RUN * H;
      const cx = vw * 0.5;
      const wEnd = vw + run + 40, wStart = 0.12 * vw;
      const w = lerp(wStart, wEnd, t);
      if (t >= 0.999) { field.style.clipPath = 'none'; return; }
      const tc = cx + run / 2, bc = cx - run / 2;
      field.style.clipPath = `polygon(${tc - w / 2}px 0, ${tc + w / 2}px 0, ${bc + w / 2}px ${H}px, ${bc - w / 2}px ${H}px)`;
    },
  });
  ScrollTrigger.create({
    trigger: sec, start: 'top bottom', end: 'bottom top',
    onUpdate: (s) => { const max = track.scrollWidth / 2; track.style.transform = `translateX(${(-s.progress * max).toFixed(1)}px)`; },
  });
}

/* ---------- EMPRESAS: onda diagonal de 56° ---------- */
export function initEmpresas() {
  const grid = $('.em__grid'); if (!grid || reduce) return;
  once(grid, () => {
    const items = $$(':scope > li', grid);
    const vals = items.map((li) => li.offsetLeft + RUN * li.offsetTop);
    const mn = Math.min(...vals), mx = Math.max(...vals) || 1;
    items.forEach((li, i) => li.style.setProperty('--d', `${(0.6 * (vals[i] - mn) / (mx - mn || 1)).toFixed(3)}s`));
    requestAnimationFrame(() => grid.classList.add('is-in'));
  }, { margin: '0px 0px -15% 0px' });
}

/* ---------- VÍDEOS: o palco digital "levanta" em perspectiva ---------- */
export function initVideoStage() {
  const pl = $('[data-player]'); if (!pl || reduce || !mq('(min-width: 1024px)')) return;
  ScrollTrigger.create({
    trigger: pl, start: 'top bottom', end: 'top 35%',
    onUpdate: (s) => pl.style.setProperty('--rx', `${(14 * (1 - inOut(s.progress))).toFixed(2)}deg`),
  });
}
