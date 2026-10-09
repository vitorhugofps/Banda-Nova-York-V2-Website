/* Cenas das seções: CORTE (revelação 56°), LARGURA (assinatura 62→125), Experiência, Momentos, Figurinos, O show é único, Empresas e Rodapé. */
import { $, $$, clamp, lerp, smooth, cutEase, inOut, reduce, fine, saveData, cortePolygon, corteEdge, corteVals, once, RUN, testMode } from '../core/env.js';
import { scroll } from '../core/scroll.js';
import { bus } from '../core/bus.js';

const { gsap, ScrollTrigger } = window;

/* ---------- revelações simples (IntersectionObserver + transição CSS) ---------- */
export function initReveals() {
  // o IntersectionObserver considera o clip-path do alvo: observa-se o pai do elemento cortado
  $$('[data-corte]').forEach((el) => once(el.parentElement, () => el.classList.add('is-in')));
  $$('[data-reveal]').forEach((el) => once(el, (t) => t.classList.add('is-in')));
  // LARGURA: a assinatura ganha largura com a rolagem (fora da abertura)
  if (!reduce) {
    $$('[data-largura]').forEach((el) => {
      if (el.closest('#abertura')) return;
      el.style.setProperty('--wdth', 62); el.style.setProperty('--ls', '0em');
      ScrollTrigger.create({
        trigger: el, start: 'top 92%', end: 'top 45%',
        onUpdate: (s) => {
          if (getComputedStyle(el).whiteSpace !== 'nowrap') { el.style.removeProperty('--wdth'); el.style.removeProperty('--ls'); return; }
          const t = inOut(s.progress); el.style.setProperty('--wdth', (62 + 63 * t).toFixed(1)); el.style.setProperty('--ls', `${(0.22 * t).toFixed(3)}em`);
        },
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
  const largo = window.matchMedia('(min-width: 1024px)');
  rows.forEach((row) => {
    const mask = $('.as__mask', row), src = $('.as__src', row), bar = $('.as__bar', row);
    ScrollTrigger.create({
      trigger: row, start: 'top 92%', end: 'top 38%',
      onUpdate: (s) => {
        const t = inOut(s.progress);
        if (largo.matches) mask.style.setProperty('--wdth', (62 + 38 * t).toFixed(1)); else mask.style.removeProperty('--wdth');
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
  gsap.matchMedia().add({ desk: '(min-width: 1024px)', mob: '(max-width: 1023.98px)' }, (ctx) => {
  const { desk } = ctx.conditions;
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
  });
}

/* ---------- MOMENTOS: o show em cortes (palco preso no desktop) ----------
   gsap.matchMedia: liga e desliga a cena quando a tela cruza 1024 px (girar o tablet, redimensionar a janela)
   e limpa os estilos ao sair, para a faixa do celular voltar inteira. */
export function initMomentos() {
  const sec = $('#momentos'); if (!sec || reduce) return;
  const stage = $('.mo__stage', sec), layers = $$('.mo__layer', sec), head = $('.mo__head', sec), label = $('.mo__label', sec);
  const edge = $('.mo__edge', sec), nameEl = $('[data-mo-name]', sec), iEl = $('[data-mo-i]', sec), nEl = $('[data-mo-n]', sec);
  const prog = $('.mo__progress', sec);
  const N = layers.length;
  const imgs = layers.map((l) => $('img', l));
  const INTRO = 35, SEG = 48, CUT = 0.6, TOTAL = INTRO + (N - 1) * SEG;
  gsap.matchMedia().add('(min-width: 1024px)', () => {
    nEl.textContent = String(N).padStart(2, '0');
    prog.innerHTML = layers.map(() => '<i></i>').join('');
    const ticks = $$('i', prog);
    let cur = -1;
    function setName(i) {
      if (i === cur) return; cur = i;
      iEl.textContent = String(i + 1).padStart(2, '0');
      nameEl.textContent = layers[i].dataset.name;
      ticks.forEach((t, k) => t.classList.toggle('on', k <= i));
      const c = corteVals(nameEl);
      gsap.fromTo(nameEl, { clipPath: c.from }, { clipPath: c.to, duration: 0.5, ease: 'power3.inOut', overwrite: true });
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
        // camada própria só enquanto a foto está sendo cortada (sem 18 camadas de tela cheia o tempo todo)
        imgs[j].style.willChange = c > 0 && c < 1 ? 'transform' : '';
        layers[j - 1].style.setProperty('--dim', (0.4 * t).toFixed(3));
        if (c >= 0.5) idx = j;
        if (c > 0 && j + 1 < N) imgs[j + 1].loading = 'eager';
      }
      edge.style.clipPath = edgeCss;
      setName(idx);
    }
    ScrollTrigger.create({ trigger: $('.mo__pin', sec), start: 'top top', end: 'bottom bottom', onUpdate: (s) => render(s.progress), onRefresh: (s) => render(s.progress) });
    render(0);
    return () => {
      gsap.killTweensOf(nameEl);
      layers.forEach((L) => { L.style.clipPath = ''; L.style.removeProperty('--dim'); });
      imgs.forEach((im) => { im.style.transform = ''; im.style.willChange = ''; });
      [head, label, edge, nameEl].forEach((el) => { el.style.opacity = ''; el.style.transform = ''; el.style.clipPath = ''; });
      prog.innerHTML = '';
    };
  });
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

/* ---------- FIGURINOS: uma imagem vira a outra pelo corte de 56°, preso na tela ----------
   Rolando para baixo, o palco vermelho cobre o elenco de branco da direita para a esquerda até tomar a imagem inteira;
   rolando para cima, o caminho volta. */
export function initFiguras() {
  const fig = $('[data-fig]'); if (!fig || reduce) return;
  const media = $('.mo__fig-media', fig), b = $('.mo__fig-b', fig), edge = $('.mo__fig-edge', fig);
  const ia = $('.mo__fig-a img', fig), ib = $('.mo__fig-b img', fig);
  function render(p) {
    const t = cutEase(clamp((p - 0.1) / 0.76));
    const w = media.clientWidth, h = media.clientHeight, run = RUN * h;
    const xb = lerp(w + 2, -run - 6, t), xt = xb + run;
    if (t <= 0) b.style.clipPath = 'polygon(100% 0, 100% 0, 100% 100%, 100% 100%)';
    else if (t >= 1) b.style.clipPath = 'none';
    else b.style.clipPath = `polygon(${xt.toFixed(1)}px 0, ${(w + run).toFixed(1)}px 0, ${(w + run).toFixed(1)}px ${h}px, ${xb.toFixed(1)}px ${h}px)`;
    edge.style.clipPath = t > 0.001 && t < 0.999 ? `polygon(${(xt - 5).toFixed(1)}px 0, ${xt.toFixed(1)}px 0, ${xb.toFixed(1)}px ${h}px, ${(xb - 5).toFixed(1)}px ${h}px)` : 'polygon(0 0, 0 0, 0 0)';
    ia.style.transform = `scale(${(1 + 0.07 * t).toFixed(4)}) translateX(${(-2 * t).toFixed(2)}%)`;
    ib.style.transform = `scale(${(1.12 - 0.12 * t).toFixed(4)})`;
  }
  ScrollTrigger.create({ trigger: fig, start: 'top top', end: 'bottom bottom', onUpdate: (s) => render(s.progress), onRefresh: (s) => render(s.progress) });
  render(0);
}

/* ---------- EMPRESAS: 4 linhas de marcas passando (→ ← → ←), caixas flutuando ----------
   A velocidade aumenta com a rolagem da página; o mouse sobre uma linha a desacelera; há botão para pausar. */
export function initEmpresas() {
  const box = $('[data-em]'); if (!box) return;
  const rows = $$('.em__row', box);
  $$('.em__box', box).forEach((b, i) => b.style.setProperty('--i', String(i % 9)));
  if (reduce) return;
  // entrada: as caixas acendem pela diagonal de 56°
  once(box, () => {
    rows.forEach((r, ri) => $$('.em__box', r).forEach((b, i) => b.style.setProperty('--d', `${Math.min(1.1, (i * 0.07 + ri * 0.12)).toFixed(2)}s`)));
    requestAnimationFrame(() => box.classList.add('is-in'));
  }, { margin: '0px 0px -10% 0px' });
  const R = rows.map((el) => ({ el, dir: +el.dataset.dir || 1, w: 0, x: 0, k: 1, kT: 1 }));
  function measure() {
    R.forEach((r) => {
      const tracks = $$('.em__track', r.el);
      // cópias suficientes para cobrir a tela mesmo em monitores largos
      const w0 = r.w;
      r.w = tracks[0].getBoundingClientRect().width;
      const need = Math.ceil((window.innerWidth * 1.2) / Math.max(1, r.w)) + 1;
      for (let n = tracks.length; n < need; n++) { const c = tracks[1].cloneNode(true); r.el.appendChild(c); }
      // primeira medida: posição inicial; depois, mantém a fase (sem salto)
      r.x = w0 ? (r.x / w0) * r.w : (r.dir > 0 ? -r.w * 0.37 : -r.w * 0.11);
    });
  }
  let active = false, paused = false, boost = 0, lastY = window.scrollY;
  const pauseBtn = $('[data-em-pause]');
  pauseBtn?.addEventListener('click', () => {
    paused = !paused;
    pauseBtn.setAttribute('aria-pressed', String(paused));
    pauseBtn.textContent = paused ? 'Retomar as marcas' : 'Pausar as marcas';
    box.classList.toggle('is-paused', paused);
  });
  R.forEach((r) => {
    r.el.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') r.kT = 0.18; });
    r.el.addEventListener('pointerleave', () => { r.kT = 1; });
    r.el.addEventListener('focusin', () => { r.kT = 0; });
    r.el.addEventListener('focusout', () => { r.kT = 1; });
  });
  if ('IntersectionObserver' in window) new IntersectionObserver((es) => { active = es[0].isIntersecting; }, { rootMargin: '120px 0px' }).observe(box);
  else active = true;
  measure();
  let lastW = window.innerWidth;
  window.addEventListener('resize', () => { if (window.innerWidth === lastW) return; lastW = window.innerWidth; measure(); });   // só largura (a barra do celular muda a altura)
  const BASE = window.innerWidth < 600 ? 26 : 38;          // px/s
  gsap.ticker.add((time, dt) => {
    const y = window.scrollY, dy = Math.abs(y - lastY); lastY = y;
    const v = scroll.lenis ? Math.abs(scroll.lenis.velocity || 0) * 60 : dy * (1000 / Math.max(8, dt));
    boost += (Math.min(420, v * 0.35) - boost) * 0.08;
    if (!active || paused) return;
    const s = Math.min(0.05, dt / 1000);
    R.forEach((r) => {
      r.k += (r.kT - r.k) * 0.08;
      r.x += r.dir * (BASE + boost) * r.k * s;
      // laço contínuo: a posição volta uma cópia inteira sem salto visível
      if (r.x > 0) r.x -= r.w; else if (r.x < -r.w) r.x += r.w;
      r.el.style.transform = `translate3d(${r.x.toFixed(2)}px, 0, 0)`;
    });
  });
}

/* ---------- RODAPÉ: o logo se monta pelo Corte 56°, o O abre o palco e "Viva a experiência" sobe letra por letra ---------- */
export function initFooter() {
  const ft = $('.ft'); if (!ft) return;
  const svg = $('.ft__svg', ft), vid = $('.ft__o', ft), logo = $('.ft__logo', ft), viva = $('[data-viva]', ft), cta = $('.ft__top .btn', ft);
  const cpNy = $('.ft-ny__p', ft), cpBl = $('.ft-bl__r', ft), cpBr = $('.ft-br__r', ft), banda = $('.ft-banda', ft);
  const setNy = (t) => { const y0 = 150, y1 = 640, run = RUN * (y1 - y0); const xb = lerp(26 - run - 10, 2147 + 10, t), xt = xb + run; cpNy.setAttribute('d', `M-400 ${y0}L${xt} ${y0}L${xb} ${y1}L-400 ${y1}Z`); };
  const setBars = (t) => { const L = 478; cpBl.setAttribute('x', 560 - L * t); cpBl.setAttribute('width', L * t + 1); cpBr.setAttribute('width', L * t + 1); };
  // letras de "Viva a experiência."
  const chars = [];
  if (viva) {
    const txt = viva.textContent.trim();
    viva.textContent = '';
    const sr = document.createElement('span'); sr.className = 'sr-only'; sr.textContent = txt; viva.appendChild(sr);
    txt.split(' ').forEach((w, wi, arr) => {
      const wd = document.createElement('span'); wd.className = 'wd'; wd.setAttribute('aria-hidden', 'true');
      [...w].forEach((c) => { const ch = document.createElement('span'); ch.className = 'ch'; ch.textContent = c; wd.appendChild(ch); chars.push(ch); });
      viva.appendChild(wd); if (wi < arr.length - 1) viva.appendChild(document.createTextNode(' '));
    });
  }
  const h264 = !!vid?.canPlayType('video/mp4; codecs="avc1.640028"');
  const src = `/assets/media/video/loop-energia-720.${h264 ? 'mp4' : 'webm'}`;
  const done = () => { setNy(1); setBars(1); banda.style.opacity = 1; logo.style.setProperty('--o', 1); chars.forEach((c) => { c.style.setProperty('--y', '0%'); c.style.setProperty('--k', '0deg'); c.style.setProperty('--a', 1); }); };
  if (reduce) { done(); return; }
  setNy(0); setBars(0); banda.style.opacity = 0; logo.style.setProperty('--o', 0);
  // vídeo do O: carrega perto do rodapé e toca só em vista
  let claimed = false, vis = false;
  bus.on('media:claim', (w) => { claimed = w === 'yt'; if (claimed) vid.pause(); else if (vis && vid.src) vid.play().catch(() => {}); });
  if (vid && !saveData && 'IntersectionObserver' in window) {
    new IntersectionObserver((es) => {
      vis = es[0].isIntersecting;
      if (vis && !vid.src) { vid.preload = 'auto'; vid.src = src; }
      if (vis && !claimed) vid.play().catch(() => {}); else vid.pause();
    }, { rootMargin: '200px 0px', threshold: 0 }).observe(logo);
  }
  // montagem do logo ao entrar
  once(logo, () => {
    const o = { bars: 0, ny: 0, banda: 0, ring: 0 };
    gsap.timeline()
      .to(o, { bars: 1, duration: 0.55, ease: 'expo.out', onUpdate: () => setBars(o.bars) })
      .to(o, { banda: 1, duration: 0.35, ease: 'none', onUpdate: () => { banda.style.opacity = o.banda; } }, '<0.1')
      .to(o, { ny: 1, duration: 0.85, ease: 'power3.inOut', onUpdate: () => setNy(o.ny) }, '<0.05')
      .to(o, { ring: 1, duration: 0.9, ease: 'expo.out', onUpdate: () => logo.style.setProperty('--o', o.ring.toFixed(3)) }, '>-0.25')
      .add(() => cta?.classList.add('is-swept'), '<');
  }, { margin: '0px 0px -18% 0px' });
  // "Viva a experiência." sobe letra por letra com a rolagem (inclinadas a 56° até assentarem)
  if (chars.length) {
    const N = chars.length;
    const paint = (p) => chars.forEach((c, i) => {
      const t = cutEase(clamp(p * 1.6 - (i / N) * 0.6));
      c.style.setProperty('--y', `${((1 - t) * 105).toFixed(1)}%`);
      c.style.setProperty('--k', `${((1 - t) * -34).toFixed(1)}deg`);
      c.style.setProperty('--a', (0.15 + 0.85 * t).toFixed(3));
    });
    paint(0);
    ScrollTrigger.create({ trigger: viva, start: 'top bottom', end: 'bottom bottom', onUpdate: (s) => paint(s.progress), onRefresh: (s) => paint(s.progress) });
  }
  // o logo sobe levemente enquanto o rodapé entra
  ScrollTrigger.create({ trigger: ft, start: 'top bottom', end: 'top 30%', onUpdate: (s) => { logo.style.transform = `translateY(${((1 - inOut(s.progress)) * 60).toFixed(1)}px)`; } });
}

/* ---------- VÍDEOS: o palco digital ----------
   - O player "levanta" em perspectiva ao entrar.
   - A capa do player inclina levemente com o mouse e o feixe largo da capa segue o ponteiro.
   - O clique no play dispara os feixes através da tela. */
export function initVideoStage() {
  const sec = $('#videos'), pl = $('[data-player]'); if (!sec || !pl || reduce) return;
  const isPlaying = () => pl.classList.contains('is-live') && !pl.classList.contains('is-paused');
  const screen = $('.pl__screen', pl), cover = $('[data-pl-cover]', pl);
  const zera = () => { pl.style.setProperty('--ty', '0deg'); pl.style.setProperty('--tx', '0deg'); };
  gsap.matchMedia().add('(min-width: 1024px)', () => {
    // o player "levanta" em perspectiva ao entrar
    ScrollTrigger.create({
      trigger: pl, start: 'top bottom', end: 'top 35%',
      onUpdate: (s) => pl.style.setProperty('--rx', `${(14 * (1 - inOut(s.progress))).toFixed(2)}deg`),
    });
    if (!screen || !cover || !fine) return () => pl.style.removeProperty('--rx');
    // capa: inclinação e feixe que segue o mouse
    const move = (e) => {
      if (e.pointerType !== 'mouse') return;
      const r = screen.getBoundingClientRect(), x = clamp((e.clientX - r.left) / r.width), y = clamp((e.clientY - r.top) / r.height);
      cover.style.setProperty('--mx', x.toFixed(3));
      if (isPlaying()) { zera(); return; }
      pl.style.setProperty('--ty', `${((x - 0.5) * 5).toFixed(2)}deg`);
      pl.style.setProperty('--tx', `${((0.5 - y) * 3.5).toFixed(2)}deg`);
    };
    const leave = () => { zera(); cover.style.setProperty('--mx', '.5'); };
    screen.addEventListener('pointermove', move, { passive: true });
    screen.addEventListener('pointerleave', leave);
    return () => { screen.removeEventListener('pointermove', move); screen.removeEventListener('pointerleave', leave); leave(); pl.style.removeProperty('--rx'); };
  });
  if (cover) cover.addEventListener('click', () => {
    if (isPlaying()) return;
    cover.classList.remove('is-go'); void cover.offsetWidth; cover.classList.add('is-go');
    zera();
    setTimeout(() => cover.classList.remove('is-go'), 1400);
  });
}
