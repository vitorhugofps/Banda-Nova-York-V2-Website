/* Cabeçalho: estado sobre o palco, link ativo, botão de som (barras /// reagem ao áudio), menu e barra fixa do celular. */
import { $, $$, reduce } from '../core/env.js';
import { audio } from '../core/audio.js';
import { bus } from '../core/bus.js';
import { stopScroll, startScroll } from '../core/scroll.js';

export function initHeader() {
  const hd = $('[data-hd]'); if (!hd) return;
  const { gsap } = window;
  const op = $('#abertura');

  // fora da abertura o cabeçalho é sempre sólido e mostra o logo
  const solid = () => {
    const end = op ? op.offsetHeight - window.innerHeight * 0.4 : 0;
    if (window.scrollY > end) hd.classList.add('is-solid', 'has-logo');
  };
  window.addEventListener('scroll', solid, { passive: true }); solid();

  // link ativo
  const links = $$('.hd__nav a');
  const map = new Map(links.map((a) => [a.getAttribute('href').slice(1), a]));
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((es) => es.forEach((e) => {
      const a = map.get(e.target.id); if (!a) return;
      if (e.isIntersecting) { links.forEach((l) => { l.classList.remove('is-on'); l.removeAttribute('aria-current'); }); a.classList.add('is-on'); a.setAttribute('aria-current', 'true'); }
    }), { rootMargin: '-45% 0px -50% 0px' });
    ['experiencia', 'momentos', 'videos', 'media-kit', 'contratar'].forEach((id) => { const el = document.getElementById(id); if (el) io.observe(el); });
  }

  // som
  const snd = $('[data-sound]'), sndState = $('[data-sound-state]'), bars = $$('.snd__bars i', snd);
  snd.addEventListener('click', () => {
    if (audio.on) audio.disable();
    else { audio.enable({ play: op && op.getBoundingClientRect().bottom > 0 }); }
  });
  let ytPlaying = false;
  bus.on('sound', (on) => { snd.setAttribute('aria-pressed', String(on)); sndState.textContent = on ? ' ligado' : ' desligado'; });
  bus.on('yt:state', (s) => { ytPlaying = s === 'playing'; });
  // equalizador: o ângulo de 56° é mantido (skewX antes de scaleY)
  const k = [0.35, 0.35, 0.35];
  let acc = 0;
  gsap.ticker.add((t, dt) => {
    acc += dt; if (acc < 33) return; acc = 0;
    const b = audio.bands();
    for (let i = 0; i < 3; i++) {
      let target = 0.35;
      if (b) target = 0.2 + 0.8 * Math.min(1, b[i] * (i === 2 ? 2.2 : 1.3));
      const att = target > k[i] ? 0.6 : 0.15;
      k[i] += (target - k[i]) * att;
      bars[i].style.setProperty('--k', k[i].toFixed(3));
    }
  });

  // menu (celular/tablet)
  const menu = $('#menu'), openBtn = $('[data-menu-open]'), closeBtn = $('[data-menu-close]');
  let lastFocus = null;
  const open = () => {
    lastFocus = document.activeElement; menu.hidden = false; openBtn.setAttribute('aria-expanded', 'true'); stopScroll();
    if (!reduce) gsap.fromTo(menu, { clipPath: 'polygon(0 0, 0 0, -67% 100%, 0 100%)' }, { clipPath: 'polygon(0 0, 167% 0, 100% 100%, 0 100%)', duration: 0.6, ease: 'power3.inOut' });
    $('a', menu).focus();
  };
  const close = (focusBack = true) => { menu.hidden = true; openBtn.setAttribute('aria-expanded', 'false'); startScroll(); if (focusBack && lastFocus) lastFocus.focus(); };
  openBtn.addEventListener('click', open);
  closeBtn.addEventListener('click', () => close());
  menu.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
    if (e.key === 'Tab') {
      const f = $$('a, button', menu); const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
  $$('a', menu).forEach((a) => a.addEventListener('click', () => close(false)));

  // barra fixa "Quero a Nova York" no celular
  const bar = $('[data-cta-bar]'), ct = $('#contratar'), ft = $('.ft');
  let ctVisible = false, ftVisible = false;
  if (bar && 'IntersectionObserver' in window && ct) new IntersectionObserver((es) => { ctVisible = es[0].isIntersecting; upd(); }, { threshold: 0 }).observe(ct);
  if (bar && 'IntersectionObserver' in window && ft) new IntersectionObserver((es) => { ftVisible = es[0].isIntersecting; upd(); }, { threshold: 0 }).observe(ft);
  const vv = window.visualViewport;
  function upd() {
    const past = op ? window.scrollY > op.offsetHeight - window.innerHeight : true;
    const kb = vv ? vv.height < window.innerHeight * 0.75 : false;
    bar?.classList.toggle('is-on', past && !ctVisible && !ftVisible && !kb && menu.hidden);
  }
  window.addEventListener('scroll', upd, { passive: true });
  vv?.addEventListener('resize', upd);
  upd();
}
