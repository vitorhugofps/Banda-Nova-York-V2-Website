/* Cabeçalho: entra animado depois da montagem do logo, fica sobre a abertura e some com blur preto depois do 2º slide.
   Volta quando o mouse vai até o topo da tela (no toque, quando a pessoa rola para cima) e quando recebe foco pelo teclado.
   Também cuida do link ativo, do menu do celular e da barra fixa "Quero a Nova York". */
import { $, $$, reduce, fine } from '../core/env.js';
import { stopScroll, startScroll } from '../core/scroll.js';

export function initHeader() {
  const hd = $('[data-hd]'); if (!hd) return null;
  const { gsap } = window;
  const op = $('#abertura');
  const menu = $('#menu'), openBtn = $('[data-menu-open]'), closeBtn = $('[data-menu-close]');

  // fora da abertura o cabeçalho é sempre sólido e mostra o logo
  const solid = () => {
    const end = op ? op.offsetTop + op.offsetHeight - window.innerHeight * 0.4 : 0;
    if (window.scrollY > end) hd.classList.add('is-solid', 'has-logo');
  };

  // ---------- some depois do 2º slide (fim da abertura) e volta no topo ----------
  const hideFrom = () => (op ? op.offsetTop + op.offsetHeight - window.innerHeight * 0.85 : 0);
  let hidden = false, peek = false, focusIn = false, lastY = window.scrollY, upRun = 0, leaveT = null, moveT = null;
  const moving = () => { hd.classList.add('is-moving'); clearTimeout(moveT); moveT = setTimeout(() => hd.classList.remove('is-moving'), 760); };
  function setHidden(h) {
    if (h === hidden) return;
    hidden = h; moving();
    hd.classList.toggle('is-hidden', h);
  }
  function update() {
    const y = window.scrollY;
    const past = y > hideFrom();
    if (!past) { peek = false; hd.classList.remove('is-peek'); setHidden(false); }
    else if (!peek && !focusIn && menu.hidden) setHidden(true);
    // toque: rolar para cima mostra; para baixo esconde
    if (!fine && past) {
      const dy = y - lastY;
      if (dy < 0) { upRun -= dy; if (upRun > 36 && !peek) { peek = true; setHidden(false); } }
      else if (dy > 4) { upRun = 0; if (peek && !focusIn && menu.hidden) { peek = false; setHidden(true); } }
    }
    lastY = y;
  }
  if (!reduce) {
    // mouse no topo: o cabeçalho aparece; ao sair da faixa, volta a sumir
    window.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse' || window.scrollY <= hideFrom()) return;
      const zone = hd.offsetHeight + 28;
      if (e.clientY <= zone) {
        clearTimeout(leaveT);
        if (!peek) { peek = true; hd.classList.add('is-peek'); setHidden(false); }
      } else if (peek && e.clientY > zone + 70) {
        clearTimeout(leaveT);
        leaveT = setTimeout(() => { if (!focusIn && menu.hidden) { peek = false; hd.classList.remove('is-peek'); setHidden(true); } }, 420);
      }
    }, { passive: true });
    document.documentElement.addEventListener('mouseleave', (e) => {
      if (e.clientY <= 0 && window.scrollY > hideFrom()) { peek = true; hd.classList.add('is-peek'); setHidden(false); }
    });
    hd.addEventListener('focusin', () => { focusIn = true; setHidden(false); });
    hd.addEventListener('focusout', (e) => { if (!hd.contains(e.relatedTarget)) { focusIn = false; update(); } });
  }
  window.addEventListener('scroll', () => { solid(); if (!reduce) update(); }, { passive: true });
  solid(); if (!reduce) update();

  // ---------- link ativo ----------
  const links = $$('.hd__nav a');
  const map = new Map(links.map((a) => [a.getAttribute('href').slice(1), a]));
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((es) => es.forEach((e) => {
      const a = map.get(e.target.id); if (!a) return;
      if (e.isIntersecting) { links.forEach((l) => { l.classList.remove('is-on'); l.removeAttribute('aria-current'); }); a.classList.add('is-on'); a.setAttribute('aria-current', 'true'); }
    }), { rootMargin: '-45% 0px -50% 0px' });
    ['experiencia', 'momentos', 'videos', 'media-kit', 'contratar'].forEach((id) => { const el = document.getElementById(id); if (el) io.observe(el); });
  }

  // ---------- menu (celular/tablet) ----------
  let lastFocus = null;
  const open = () => {
    lastFocus = document.activeElement; menu.hidden = false; openBtn.setAttribute('aria-expanded', 'true'); stopScroll();
    if (!reduce) gsap.fromTo(menu, { clipPath: 'polygon(0 0, 0 0, -67% 100%, 0 100%)' }, { clipPath: 'polygon(0 0, 167% 0, 100% 100%, 0 100%)', duration: 0.6, ease: 'power3.inOut' });
    $('a', menu).focus();
  };
  const close = (focusBack = true) => { menu.hidden = true; openBtn.setAttribute('aria-expanded', 'false'); startScroll(); if (focusBack && lastFocus) lastFocus.focus(); if (!reduce) update(); };
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

  // ---------- barra fixa "Quero a Nova York" no celular ----------
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

  return { get hidden() { return hidden; }, show: () => setHidden(false), hide: () => setHidden(true) };
}
