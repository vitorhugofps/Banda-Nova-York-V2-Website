/* Barramento mínimo de eventos entre cenas (ex.: só uma mídia tocando por vez). */
const map = new Map();
export const bus = {
  on(ev, fn) { if (!map.has(ev)) map.set(ev, new Set()); map.get(ev).add(fn); return () => map.get(ev).delete(fn); },
  emit(ev, data) { (map.get(ev) || []).forEach((fn) => { try { fn(data); } catch (e) { console.error(e); } }); },
};
