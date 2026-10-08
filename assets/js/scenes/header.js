/* Cabeçalho: escondido no slide do logo; aparece quando a animação do logo termina (a câmera atravessou o O);
   some quando a pessoa passa o slide de vídeo da abertura e, daí em diante, volta sempre que ela rola para cima
   (e some de novo ao rolar para baixo). Também aparece quando recebe foco pelo teclado.
   Cuida ainda do link ativo, do menu do celular e da barra fixa "Quero a Nova York". */
import { $, $$, reduce, clamp } from '../core/env.js';
import { stopScroll, startScroll, scroll } from '../core/scroll.js';

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

  // ---------- visibilidade ----------
  const opP = () => (op ? clamp((window.scrollY - op.offsetTop) / Math.max(1, op.offsetHeight - window.innerHeight)) : 1);
  const hideFrom = () => (op ? op.offsetTop + op.offsetHeight - window.innerHeight * 0.85 : 0);
  const LOGO_END = 0.48;           // fim da travessia do O (ver opening.js)
  let hidden = hd.classList.contains('is-hidden'), focusIn = false, lastY = window.scrollY, upRun = 0, shown = false;
  function setHidden(h) {
    if (h === hidden) return;
    hidden = h;
    hd.classList.toggle('is-hidden', h);
  }
  function update() {
    const y = window.scrollY, dy = y - lastY; lastY = y;
    if (focusIn || !menu.hidden) { setHidden(false); return; }
    if (y <= hideFrom()) {
      // abertura: escondido no slide do logo, visível no slide de vídeo
      upRun = 0; shown = false;
      setHidden(opP() < LOGO_END);
      return;
    }
    // rolagem feita pelo próprio site (âncora, formulário) não conta como "subir"
    if (scroll.auto) return;
    // depois do slide de vídeo: some ao descer, volta ao subir
    if (dy < 0) { upRun -= dy; if (upRun > 24) shown = true; }
    else if (dy > 2) { upRun = 0; shown = false; }
    setHidden(!shown);
  }
  if (reduce) setHidden(false);
  else {
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
      if (e.target.id === 'abertura') { if (e.isIntersecting) links.forEach((l) => { l.classList.remove('is-on'); l.removeAttribute('aria-current'); }); return; }
      const a = map.get(e.target.id); if (!a) return;
      if (e.isIntersecting) { links.forEach((l) => { l.classList.remove('is-on'); l.removeAttribute('aria-current'); }); a.classList.add('is-on'); a.setAttribute('aria-current', 'true'); }
    }), { rootMargin: '-45% 0px -50% 0px' });
    ['abertura', 'experiencia', 'momentos', 'videos', 'media-kit', 'contratar'].forEach((id) => { const el = document.getElementById(id); if (el) io.observe(el); });
  }

  // ---------- menu (celular/tablet) ----------
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

  // ---------- barra fixa "Quero a Nova York" no celular ----------
  const bar = $('[data-cta-bar]'), ct = $('#contratar'), ft = $('.ft'), wp = $('.wall-pin');
  let ctVisible = false, ftVisible = false, wpVisible = false;
  // no telão a barra sai do caminho (legenda e progresso ficam no pé da tela)
  if (bar && 'IntersectionObserver' in window && wp) new IntersectionObserver((es) => { wpVisible = es[0].isIntersecting; upd(); }, { rootMargin: '-40% 0px -40% 0px' }).observe(wp);
  if (bar && 'IntersectionObserver' in window && ct) new IntersectionObserver((es) => { ctVisible = es[0].isIntersecting; upd(); }, { threshold: 0 }).observe(ct);
  if (bar && 'IntersectionObserver' in window && ft) new IntersectionObserver((es) => { ftVisible = es[0].isIntersecting; upd(); }, { threshold: 0 }).observe(ft);
  const vv = window.visualViewport;
  function upd() {
    const past = op ? window.scrollY > op.offsetHeight - window.innerHeight : true;
    const kb = vv ? vv.height < window.innerHeight * 0.75 : false;
    bar?.classList.toggle('is-on', past && !ctVisible && !ftVisible && !wpVisible && !kb && menu.hidden);
    // o controle de som flutuante sobe quando a barra está na tela
    document.documentElement.classList.toggle('has-cta', !!bar && bar.classList.contains('is-on') && bar.getClientRects().length > 0);
  }
  window.addEventListener('scroll', upd, { passive: true });
  vv?.addEventListener('resize', upd);
  upd();

  return { get hidden() { return hidden; }, show: () => setHidden(false), hide: () => setHidden(true) };
}
