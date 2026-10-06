/* Rolagem: Lenis (só mouse/trackpad) sincronizado com o ScrollTrigger num único RAF (gsap.ticker). */
import { reduce, fine, $ } from './env.js';

export const scroll = { lenis: null };

export function initScroll() {
  const { gsap, ScrollTrigger } = window;
  gsap.registerPlugin(ScrollTrigger);
  ScrollTrigger.config({ ignoreMobileResize: true });
  if (!reduce && fine && window.Lenis) {
    const lenis = new window.Lenis({ lerp: 0.12, smoothWheel: true, syncTouch: false, autoRaf: false, anchors: false });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
    scroll.lenis = lenis;
  }
  // Âncoras internas com deslocamento do cabeçalho e foco no destino
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey) return;
    const id = a.getAttribute('href');
    if (id.length < 2) return;
    const el = document.querySelector(id);
    if (!el) return;
    e.preventDefault();
    goTo(el);
    if (history.replaceState) history.replaceState(null, '', id === '#abertura' ? location.pathname + location.search : id);
  });
}

export function y(el) { return el.getBoundingClientRect().top + window.scrollY; }

export function goTo(target, { duration = 1.2, focus = true } = {}) {
  const hd = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--hd')) || 64;
  let top = typeof target === 'number' ? target : (target.id === 'abertura' ? 0 : y(target) - hd);
  // Seções com palco preso: entrar pelo começo
  top = Math.max(0, top);
  scrollToY(top, duration);
  if (focus && typeof target !== 'number') {
    const f = target.matches('[tabindex], a, button, input') ? target : (target.querySelector('h2, h1') || target);
    if (!f.hasAttribute('tabindex') && !f.matches('a, button, input')) f.setAttribute('tabindex', '-1');
    setTimeout(() => f.focus({ preventScroll: true }), reduce ? 0 : Math.min(900, duration * 1000));
  }
}

export function scrollToY(top, duration = 1.2) {
  const { lenis } = scroll;
  if (lenis) { lenis.scrollTo(top, { duration, easing: (t) => 1 - Math.pow(1 - t, 3) }); return; }
  if (reduce) { window.scrollTo(0, top); return; }
  const { gsap } = window;
  const o = { y: window.scrollY };
  let killed = false;
  const kill = () => { killed = true; };
  window.addEventListener('touchstart', kill, { once: true, passive: true });
  window.addEventListener('wheel', kill, { once: true, passive: true });
  gsap.to(o, { y: top, duration, ease: 'power3.inOut', onUpdate: () => { if (!killed) window.scrollTo(0, o.y); } });
}

export function stopScroll() { scroll.lenis?.stop(); document.documentElement.style.overflow = 'hidden'; }
export function startScroll() { scroll.lenis?.start(); document.documentElement.style.overflow = ''; }
export const header = () => $('[data-hd]');
