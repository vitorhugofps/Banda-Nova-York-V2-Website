/* ABERTURA · a câmera atravessa o O.
   O primeiro O do logotipo é um círculo perfeito (centro 427.6, 386.1; contraforma r 84.8; anel até r 166 — coordenadas do viewBox).
   O vídeo aparece por clip-path circle com a borda escondida sob o anel branco. O logo só escala de forma uniforme (nunca gira).
   Fases por progresso p (0–1) da seção presa:
     0–.04 repouso · .04–.50 travessia · .46–.62 feixe 56° · .58–.90 manifesto acende · .88–1 assinatura ganha largura. */
import { $, $$, clamp, lerp, smooth, inOut, reduce, saveData, lowMem, config, testMode } from '../core/env.js';
import { audio } from '../core/audio.js';
import { bus } from '../core/bus.js';
import { scrollToY, y as docY } from '../core/scroll.js';

const OX = 427.6, OY = 386.1, R_COUNTER = 84.8, R_HIDE = 124.8;
const VB = { x: 26, y: 95.25, w: 2121, h: 478.5 };

export function initOpening() {
  const sec = $('#abertura');
  if (!sec) return null;
  const { gsap, ScrollTrigger } = window;
  const stage = $('.op__stage', sec), media = $('.op__media', sec), video = $('.op__video', sec), tint = $('.op__tint', sec);
  const svg = $('.op__logo', sec), xf = $('.op__xf', sec), scrim = $('.op__scrim', sec), feixe = $('.op__feixe', sec);
  const copy = $('.op__copy', sec), manif = $('[data-acender]', sec), assin = $('.op__assin', sec);
  const ui = $('.op__ui', sec), skip = $('.op__skip', sec), pauseBtn = $('[data-op-pause]', sec), hd = $('[data-hd]');
  const banda = $('.lg-banda', sec), cpNy = $('.cp-ny__p', sec), cpBl = $('.cp-bl__r', sec), cpBr = $('.cp-br__r', sec);
  const loadBars = $$('.op__load i', sec);

  // Manifesto: cada palavra vira um <span class="w"> para acender
  const words = [];
  $$('span', manif).forEach((line) => {
    const parts = line.textContent.trim().split(/[ \t\n]+/);
    line.textContent = '';
    parts.forEach((w, i) => { const s = document.createElement('span'); s.className = 'w'; s.textContent = w; line.appendChild(s); if (i < parts.length - 1) line.appendChild(document.createTextNode(' ')); words.push(s); });
  });

  const st = { p: 0, ign: 0, vw: 0, vh: 0, g: null, userPaused: false, claimed: false, visible: true, video: false };

  // ---------- fonte do vídeo ----------
  const portrait = window.matchMedia('(orientation: portrait)').matches && window.innerWidth < 768;
  const conn = navigator.connection || {};
  const big = window.innerWidth >= 1280 && (!conn.effectiveType || conn.effectiveType === '4g') && !saveData && (navigator.deviceMemory || 8) >= 4;
  const V = '/assets/media/video/';
  const h264 = !!video.canPlayType('video/mp4; codecs="avc1.640028"');
  // sem H.264 (alguns Linux/Chromium): WebM VP9
  const src = !h264 ? `${V}abertura-720.webm` : portrait ? `${V}abertura-retrato-720.mp4` : big ? `${V}abertura-1080.mp4` : `${V}abertura-720.mp4`;
  video.poster = portrait ? `${V}abertura-poster-retrato.webp` : `${V}abertura-poster-1280.webp`;
  const useVideo = !reduce && !saveData && !lowMem;
  audio.attach(video);

  // ---------- geometria ----------
  function measure() {
    const vw = stage.clientWidth, vh = stage.clientHeight;
    svg.setAttribute('viewBox', `0 0 ${vw} ${vh}`);
    let W = vw >= 1024 ? Math.min(0.64 * vw, 1180) : vw >= 600 ? 0.74 * vw : 0.84 * vw;
    W = Math.min(W, (vh * 0.3) / 0.2256);
    const H = 0.2256 * W;
    const yc = vw < 600 ? 0.42 * vh : 0.47 * vh;
    const Lx = (vw - W) / 2, Ly = yc - H / 2, k0 = W / VB.w;
    const O0 = { x: Lx + 0.18935 * W, y: Ly + 0.60784 * H };
    const r0 = R_COUNTER * k0, rHide = R_HIDE * k0;
    const C = { x: vw / 2, y: vh / 2 };
    const Rcov = 1.02 * Math.hypot(vw / 2, vh / 2);
    st.vw = vw; st.vh = vh;
    st.g = { W, H, k0, O0, r0, rHide, C, sMax: Rcov / r0 };
  }

  // ---------- render por progresso ----------
  let lastDone = null;
  function render(p) {
    st.p = p;
    const g = st.g; if (!g) return;
    const u = clamp((p - 0.04) / 0.46);
    const e = 0.5 - 0.5 * Math.cos(Math.PI * u);
    const s = Math.pow(g.sMax, e);
    const m = smooth(0, 0.7, e);
    const cx = g.O0.x + (g.C.x - g.O0.x) * m, cy = g.O0.y + (g.C.y - g.O0.y) * m;
    const k = g.k0 * s;
    const done = e >= 0.999;
    if (!done) xf.setAttribute('transform', `matrix(${k.toFixed(5)} 0 0 ${k.toFixed(5)} ${(cx - OX * k).toFixed(2)} ${(cy - OY * k).toFixed(2)})`);
    if (done !== lastDone) { svg.style.visibility = done ? 'hidden' : 'visible'; lastDone = done; }
    media.style.clipPath = done ? 'none' : `circle(${(g.rHide * s * st.ign).toFixed(2)}px at ${cx.toFixed(1)}px ${cy.toFixed(1)}px)`;
    video.style.transformOrigin = `${cx.toFixed(1)}px ${cy.toFixed(1)}px`;
    st.e = e;
    video.style.transform = `scale(${((1 + 0.08 * e) * (1 + 0.03 * (st.bass || 0))).toFixed(4)})`;
    const gray = 1 - smooth(0.55, 1, e);
    video.style.filter = gray > 0.002 ? `grayscale(${gray.toFixed(3)}) contrast(${(1 + 0.15 * gray).toFixed(3)})` : 'none';
    tint.style.opacity = gray.toFixed(3);
    banda.style.opacity = st.introDone ? (1 - smooth(0.04, 0.16, p)).toFixed(3) : banda.style.opacity;
    audio.setOpen(e);

    if (reduce) { hd.classList.add('has-logo'); return; }
    // interface
    const uiO = 1 - smooth(0.015, 0.06, p);
    ui.style.opacity = uiO; ui.style.visibility = uiO < 0.01 ? 'hidden' : 'visible';
    hd.classList.toggle('has-logo', p > 0.44);
    hd.classList.toggle('is-solid', p > 0.6);

    // feixe 56° + scrim
    const f = clamp((p - 0.44) / 0.12), fe = inOut(f), vw = st.vw, vh = st.vh;
    const fw = 0.22 * vw;
    const X = lerp(-fw - 0.34 * vh, vw + 0.34 * vh, fe);
    feixe.style.visibility = f > 0 && f < 1 ? 'visible' : 'hidden';
    feixe.style.transform = `translateX(${X.toFixed(1)}px) skewX(-34deg)`;
    const top = X + 0.337 * vh, bot = X - 0.337 * vh;
    scrim.style.clipPath = f <= 0 ? 'polygon(0 0, 0 0, 0 100%, 0 100%)' : f >= 1 ? 'none' : `polygon(0 0, ${top.toFixed(1)}px 0, ${bot.toFixed(1)}px 100%, 0 100%)`;

    // manifesto acende palavra por palavra
    const q = clamp((p - 0.58) / 0.32);
    copy.style.visibility = p > 0.555 ? 'visible' : 'hidden';
    copy.style.opacity = smooth(0.555, 0.6, p).toFixed(3);
    const N = words.length;
    for (let i = 0; i < N; i++) words[i].style.setProperty('--o', (0.16 + 0.84 * clamp(q * N - i)).toFixed(3));
    // assinatura: largura 62 → 125
    const a = clamp((p - 0.86) / 0.08);
    assin.style.setProperty('--wdth', (62 + 63 * a).toFixed(1));
    assin.style.setProperty('--ls', `${(0.22 * a).toFixed(3)}em`);
    assin.style.opacity = (0.25 + 0.75 * a).toFixed(3);
  }

  measure();
  // estado inicial do logo (antes da intro)
  const introSeen = document.documentElement.classList.contains('intro-seen') || reduce;
  if (!introSeen) {
    document.documentElement.classList.add('intro-run');
    setNy(0); setBars(0); banda.style.opacity = 0; st.ign = 0;
  } else { finishIntroState(); }
  render(0);

  // ---------- pin (seção alta + palco sticky) ----------
  let trig = null;
  if (!reduce) {
    trig = ScrollTrigger.create({
      trigger: sec, start: 'top top', end: 'bottom bottom',
      onUpdate: (self) => render(self.progress),
      onRefresh: (self) => { measure(); render(self.progress); },
    });
    // som baixa quando a abertura sai
    ScrollTrigger.create({
      trigger: '#experiencia', start: 'top bottom', end: 'top 20%',
      onUpdate: (self) => audio.setExit(1 - smooth(0, 1, self.progress)),
      onLeaveBack: () => audio.setExit(1),
    });
    window.addEventListener('resize', () => { measure(); render(st.p); });
  } else {
    window.addEventListener('resize', () => { measure(); render(0); });
  }

  // ---------- o palco pulsa com o grave (só com som ligado) ----------
  if (!reduce) gsap.ticker.add(() => {
    if (!audio.on || !st.visible) { if (st.bass) { st.bass = 0; render(st.p); } return; }
    const b = audio.bands(); const target = b ? Math.min(1, b[0] * 1.4) : 0;
    st.bass = (st.bass || 0) + (target - (st.bass || 0)) * (target > (st.bass || 0) ? 0.5 : 0.12);
    video.style.transform = `scale(${((1 + 0.08 * (st.e || 0)) * (1 + 0.03 * st.bass)).toFixed(4)})`;
  });

  // ---------- snap: o logo nunca repousa cortado ----------
  let snapping = false;
  if (trig && !/nosnap/.test(location.search)) {
    ScrollTrigger.addEventListener('scrollEnd', () => {
      if (snapping || !trig) return;
      const p = trig.progress;
      if (p > 0.04 && p < 0.5 && window.scrollY < trig.end) {
        snapping = true;
        const target = p < 0.12 ? trig.start : trig.start + 0.5 * (trig.end - trig.start);
        scrollToY(target, 0.9);
        setTimeout(() => { snapping = false; }, 1100);
      }
    });
  }

  // ---------- vídeo: tocar só visível e sem outra mídia ----------
  function wantPlay() { return useVideo && st.visible && !st.userPaused && !st.claimed && !document.hidden; }
  function sync() {
    if (!st.video) return;
    if (wantPlay()) { const pr = video.play(); if (pr && pr.catch) pr.catch(() => {}); } else video.pause();
    pauseBtn.setAttribute('aria-pressed', String(video.paused || st.userPaused));
    pauseBtn.setAttribute('aria-label', video.paused ? 'Tocar o vídeo da abertura' : 'Pausar o vídeo da abertura');
  }
  function loadVideo() {
    if (!useVideo || st.video) return;
    st.video = true;
    video.preload = 'auto';
    video.src = src;
    video.addEventListener('play', () => pauseBtn.setAttribute('aria-pressed', 'false'));
    video.addEventListener('pause', () => pauseBtn.setAttribute('aria-pressed', 'true'));
    sync();
  }
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((es) => { st.visible = es[0].isIntersecting; sync(); }, { threshold: 0 }).observe(stage);
  }
  document.addEventListener('visibilitychange', sync);
  pauseBtn.addEventListener('click', () => {
    st.userPaused = !video.paused ? true : false;
    if (!st.userPaused) st.claimed = false;
    sync();
  });
  bus.on('media:claim', (who) => {
    if (who === 'opening') { st.claimed = false; sync(); return; }
    st.claimed = true;
    if (audio.on) audio.disable();
    sync();
  });

  // ---------- botões ENTRAR ----------
  $$('[data-enter]', sec).forEach((b) => b.addEventListener('click', () => {
    if (b.dataset.enter === 'som') { st.userPaused = false; st.claimed = false; loadVideo(); audio.enable(); }
    if (trig) scrollToY(trig.start + 0.93 * (trig.end - trig.start), 3.2);
  }));
  skip.addEventListener('click', () => { if (audio.on) audio.disable(); });

  // ---------- movimento reduzido: vídeo sob demanda ----------
  const watch = $('[data-watch]', sec), dlg = $('[data-opd]');
  if (watch && dlg) {
    const v2 = $('video', dlg);
    watch.addEventListener('click', () => { if (!v2.src) v2.src = !h264 ? `${V}abertura-720.webm` : portrait ? `${V}abertura-retrato-720.mp4` : `${V}abertura-720.mp4`; dlg.showModal(); v2.play().catch(() => {}); });
    const close = () => { v2.pause(); if (dlg.open) dlg.close(); watch.focus(); };
    $('[data-opd-close]', dlg).addEventListener('click', close);
    dlg.addEventListener('cancel', (e) => { e.preventDefault(); close(); });
  }

  // ---------- INTRO: o logo se monta ----------
  function setBars(t) {
    // barras reveladas das pontas internas para fora (clip, nunca scaleX)
    const L = 478; cpBl.setAttribute('x', 560 - L * t); cpBl.setAttribute('width', L * t + 1);
    cpBr.setAttribute('x', 1613); cpBr.setAttribute('width', L * t + 1);
  }
  function setNy(t) {
    // CORTE 56° varrendo NOVAYORK da esquerda para a direita
    const y0 = 150, y1 = 640, run = 0.6745 * (y1 - y0);
    const xb = lerp(26 - run - 10, 2147 + 10, t), xt = xb + run;
    cpNy.setAttribute('d', `M-400 ${y0}L${xt} ${y0}L${xb} ${y1}L-400 ${y1}Z`);
  }
  function finishIntroState() {
    setNy(1); setBars(1); banda.style.opacity = 1;
    $('.lg-ny', sec).removeAttribute('clip-path');
    $$('.lg-bar', sec).forEach((b) => b.removeAttribute('clip-path'));
    st.introDone = true;
  }
  function runIntro() {
    const o = { bars: 0, ny: 0, banda: 0, ign: 0 };
    let ready = 0;
    const mark = (i) => { if (loadBars[i]) loadBars[i].classList.add('on'); ready++; };
    const tasks = [
      document.fonts ? document.fonts.load('900 1em Archivo').then(() => mark(0), () => mark(0)) : (mark(0), Promise.resolve()),
      new Promise((res) => { const im = new Image(); im.src = video.poster; (im.decode ? im.decode() : Promise.resolve()).then(() => { mark(1); res(); }, () => { mark(1); res(); }); }),
      new Promise((res) => { if (!useVideo) { mark(2); res(); return; } let ok = false; const fin = () => { if (ok) return; ok = true; mark(2); res(); }; video.addEventListener('canplay', fin, { once: true }); setTimeout(fin, 1200); }),
    ];
    const tl = gsap.timeline({ paused: true, onComplete: endIntro });
    tl.to(loadBars, { opacity: 0, duration: 0.2, stagger: 0.04 })
      .to(o, { bars: 1, duration: 0.45, ease: 'expo.out', onUpdate: () => setBars(o.bars) }, '>-0.05')
      .to(o, { banda: 1, duration: 0.3, ease: 'none', onUpdate: () => { banda.style.opacity = o.banda; } }, '<0.1')
      .to(o, { ny: 1, duration: 0.65, ease: 'power3.inOut', onUpdate: () => setNy(o.ny) }, '<0.05')
      .to(o, { ign: 1, duration: 0.6, ease: 'expo.out', onUpdate: () => { st.ign = o.ign; render(st.p); } }, '>-0.15')
      .add(() => document.documentElement.classList.remove('intro-run'), '<0.3');
    const start = () => tl.play();
    Promise.race([Promise.all(tasks), new Promise((r) => setTimeout(r, 1300))]).then(start);
    const skipIntro = () => { if (tl.progress() < 1) tl.progress(1); };
    ['wheel', 'keydown', 'touchstart', 'pointerdown'].forEach((ev) => window.addEventListener(ev, skipIntro, { once: true, passive: true }));
    setTimeout(skipIntro, 2600);
  }
  function endIntro() {
    finishIntroState();
    document.documentElement.classList.remove('intro-run');
    try { sessionStorage.setItem('ny-intro', '1'); } catch (e) { /* privado */ }
    render(st.p);
  }

  if (!introSeen) runIntro();
  else { const o = { ign: 0 }; gsap.to(o, { ign: 1, duration: reduce ? 0 : 0.3, ease: 'power2.out', onUpdate: () => { st.ign = o.ign; render(st.p); } }); }
  // carrega o vídeo logo após a primeira pintura
  if (useVideo) requestAnimationFrame(() => loadVideo());

  const api = { get progress() { return st.p; }, render, measure, video, trig };
  if (testMode) (window.__NY__ ||= {}).opening = api;
  return api;
}
