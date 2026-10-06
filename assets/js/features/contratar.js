/* CONTRATAR · uma pergunta por vez → mensagem pronta no WhatsApp oficial.
   Ordem: tipo de evento → quem contrata → data → local → público → contato → mensagem.
   - Escolhas únicas avançam sozinhas; Enter continua; teclas 1–9 escolhem a opção; Voltar e o mapa à esquerda revisitam etapas.
   - Transição entre perguntas: a atual sai desfocando, a próxima entra pelo Corte 56° e as opções sobem em sequência.
   - Sem campos de formato, duração, pacote ou montagem do show (regra da marca). Sem prévia da mensagem. */
import { $, $$, config, hojeSP, coarse, testMode, reduce } from '../core/env.js';
import { lerOrigem } from '../core/origem.js';

const DRAFT = 'ny-form-draft-v2', DRAFT_MS = 7 * 864e5;
const ORG = {
  'Órgão público': { label: 'Nome do órgão, prefeitura ou secretaria', req: true },
  'Empresa': { label: 'Nome da empresa', req: true },
  'Casa de show / produtora': { label: 'Casa de show ou produtora', req: false },
  'Outro': { label: 'Organização', req: false },
};
const DIAS = ['dom.', 'seg.', 'ter.', 'qua.', 'qui.', 'sex.', 'sáb.'];
const STEPS = ['evento', 'contratante', 'data', 'cidade', 'publico', 'contato', 'mensagem'];
const CAMPOS = { evento: ['evento'], contratante: ['contratante', 'organizacao'], data: ['data'], cidade: ['cidade', 'uf'], publico: [], contato: ['nome', 'whatsapp', 'email'], mensagem: [] };
const AUTO = new Set(['evento', 'publico']);   // escolha única que avança sozinha (contratante avança se não pedir organização)

export const limpa = (s) => String(s || '').replace(/[*_~`]/g, '').replace(/\s+/g, ' ').trim();
export function fmtData(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || ''); if (!m) return '';
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return `${m[3]}/${m[2]}/${m[1]} (${DIAS[d.getUTCDay()]})`;
}
export function mascara(v) {
  let d = String(v).replace(/\D/g, '');
  if (d.length > 11 && d.startsWith('55')) d = d.slice(2);
  d = d.slice(0, 11);
  if (d.length <= 2) return d ? `(${d}` : '';
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}
export function telValido(v) {
  let d = String(v).replace(/\D/g, '');
  if (d.length > 11 && d.startsWith('55')) d = d.slice(2);
  if (d.length < 10 || d.length > 11) return false;
  const ddd = +d.slice(0, 2); if (ddd < 11 || ddd > 99 || d[1] === '0') return false;
  if (d.length === 11 && d[2] !== '9') return false;
  return true;
}
function protocolo() {
  const h = hojeSP().replace(/-/g, '').slice(2);
  const r = Math.random().toString(36).slice(2, 6).toUpperCase().padEnd(4, 'X');
  return `${config.codigo || 'NY-SITE'}-${h}-${r}`;
}

export function montarMensagem(v, origem, codigo) {
  const L = ['Olá, Nova York! Quero a Nova York no meu evento.', ''];
  const org = limpa(v.organizacao);
  L.push(`*Contratante:* ${limpa(v.contratante) || '—'}${org ? ` — ${org}` : ''}`);
  L.push(`*Evento:* ${limpa(v.evento) || '—'}`);
  L.push(`*Data:* ${v.semdata ? 'ainda não definida' : fmtData(v.data) || '—'}`);
  L.push(`*Cidade:* ${limpa(v.cidade) || '—'}${v.uf ? `/${v.uf}` : ''}`);
  if (limpa(v.local)) L.push(`*Local:* ${limpa(v.local)}`);
  if (v.publico) L.push(`*Público estimado:* ${v.publico}`);
  L.push('');
  L.push(`*Nome:* ${limpa(v.nome) || '—'}`);
  if (v.whatsapp) L.push(`*WhatsApp:* ${mascara(v.whatsapp)}`);
  if (limpa(v.email)) L.push(`*E-mail:* ${limpa(v.email)}`);
  const msg = String(v.mensagem || '').replace(/[*_~`]/g, '').trim();
  if (msg) L.push('', `*Mensagem:* ${msg}`);
  L.push('', `Código: ${codigo}${origem ? ` · origem: ${origem}` : ''}`);
  return L.join('\n');
}

export function initContratar() {
  const form = $('[data-form]'); if (!form) return;
  const { gsap } = window;
  const anim = !!gsap && !reduce;
  const wa = config.whatsapp || form.elements.phone.value;
  const stage = $('[data-stage]', form), bar = $('[data-bar]', form), live = $('[data-step-live]', form);
  const iEl = $('[data-step-i]', form), nEl = $('[data-step-n]', form);
  const back = $('[data-back]', form), next = $('[data-next]', form), hint = $('[data-hint]', form);
  const done = $('[data-done]', form), again = $('[data-open-again]', form), copyBtn = $('[data-copy]', form), copied = $('.st__copied', form), restartBtn = $('[data-restart]', form);
  const orgFld = $('[data-org]', form), orgLbl = $('[data-org-label]', form), orgReq = $('[data-org-req]', form);
  const dataIn = form.elements.data, semdata = form.elements.semdata, tel = form.elements.whatsapp, msg = form.elements.mensagem, count = $('[data-count]', form);
  const steps = STEPS.map((k) => $(`[data-step="${k}"]`, form));
  const mapItems = new Map($$('[data-map-step]').map((li) => [li.dataset.mapStep, li]));
  let cur = 0, busy = false, interacted = false, codigo = protocolo(), lastUrl = '', lastMsg = '', autoT = null;

  form.classList.add('is-flow');
  nEl.textContent = String(STEPS.length).padStart(2, '0');
  bar.innerHTML = STEPS.map(() => '<i></i>').join('');
  const segs = $$('i', bar);

  // datas: hoje (São Paulo) até +3 anos
  const hoje = hojeSP(); dataIn.min = hoje; dataIn.max = `${+hoje.slice(0, 4) + 3}${hoje.slice(4)}`;

  const val = () => {
    const f = form.elements;
    return { contratante: f.contratante.value, organizacao: f.organizacao.value, evento: f.evento.value, data: f.data.value, semdata: f.semdata.checked, cidade: f.cidade.value, uf: f.uf.value, local: f.local.value, publico: f.publico.value, nome: f.nome.value, whatsapp: f.whatsapp.value, email: f.email.value, mensagem: f.mensagem.value };
  };
  function erros(v) {
    const e = {};
    if (!v.evento) e.evento = 'Escolha o tipo de evento.';
    if (!v.contratante) e.contratante = 'Escolha quem está contratando.';
    if (ORG[v.contratante]?.req && limpa(v.organizacao).length < 2) e.organizacao = `Informe ${v.contratante === 'Empresa' ? 'o nome da empresa' : 'o órgão, a prefeitura ou a secretaria'}.`;
    if (!v.semdata) {
      if (!v.data) e.data = 'Informe a data ou marque “Ainda não defini a data”.';
      else if (v.data < dataIn.min) e.data = 'A data precisa ser a partir de hoje.';
      else if (v.data > dataIn.max) e.data = 'Escolha uma data nos próximos três anos.';
    }
    const cid = limpa(v.cidade);
    if (cid.length < 2 || !/^[A-Za-zÀ-ÿ' .\-]{2,60}$/.test(cid)) e.cidade = 'Informe a cidade do evento.';
    if (!v.uf) e.uf = 'Escolha a UF.';
    if (limpa(v.nome).length < 2) e.nome = 'Informe seu nome.';
    if (!telValido(v.whatsapp)) e.whatsapp = 'Informe um WhatsApp com DDD, como (34) 99999-9999.';
    if (v.email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.email.trim())) e.email = 'Confira o e-mail.';
    return e;
  }
  const errosDa = (k, e = erros(val())) => Object.fromEntries(Object.entries(e).filter(([c]) => CAMPOS[k].includes(c)));
  function paint(k, e) {
    CAMPOS[k].forEach((c) => {
      const p = $(`#err-${c}`, form); if (p) { p.textContent = e[c] || ''; p.classList.toggle('is-on', !!e[c]); }
      const f = $(`[data-field="${c}"]`, form); if (!f) return;
      f.classList.toggle('is-err', !!e[c]);
      $$('input:not([type=radio]):not([type=checkbox]), select, textarea', f).forEach((i) => i.setAttribute('aria-invalid', e[c] ? 'true' : 'false'));
    });
  }
  function syncOrg() {
    const o = ORG[form.elements.contratante.value];
    const was = !orgFld.hidden;
    orgFld.hidden = !o;
    if (o) { orgLbl.textContent = o.label; orgReq.hidden = !o.req; }
    if (o && !was && anim) gsap.fromTo(orgFld, { height: 0, opacity: 0, y: 10 }, { height: 'auto', opacity: 1, y: 0, duration: 0.45, ease: 'power3.out', clearProps: 'height,transform,opacity' });
    return !!o;
  }

  // ---------- resumo no mapa à esquerda ----------
  function resumo(k, v) {
    if (k === 'evento') return v.evento;
    if (k === 'contratante') return [v.contratante, limpa(v.organizacao)].filter(Boolean).join(' · ');
    if (k === 'data') return v.semdata ? 'A definir' : (v.data ? fmtData(v.data) : '');
    if (k === 'cidade') return limpa(v.cidade) ? `${limpa(v.cidade)}/${v.uf}` : '';
    if (k === 'publico') return v.publico || '';
    if (k === 'contato') return limpa(v.nome);
    return '';
  }
  let furthest = 0;
  function paintMap() {
    const v = val(), e = erros(v);
    STEPS.forEach((k, i) => {
      const li = mapItems.get(k); if (!li) return;
      const ok = !Object.keys(errosDa(k, e)).length;
      const isDone = i < cur ? ok : (i <= furthest && ok && i !== cur);
      li.classList.toggle('is-cur', i === cur && !form.classList.contains('is-sent'));
      li.classList.toggle('is-done', isDone);
      const b = $('button', li); b.disabled = !(isDone || i === cur) || form.classList.contains('is-sent');
      $('[data-map-v]', li).textContent = i <= furthest ? resumo(k, v) : '';
      if (i === cur) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
    });
  }

  // ---------- passos ----------
  function chrome() {
    iEl.textContent = String(cur + 1).padStart(2, '0');
    segs.forEach((s, i) => { s.style.setProperty('--f', i < cur ? 1 : i === cur ? 0.35 : 0); s.classList.toggle('is-cur', i === cur); });
    back.hidden = cur === 0;
    form.classList.toggle('is-last', cur === STEPS.length - 1);
    hint.textContent = cur === STEPS.length - 1 ? 'Ctrl + Enter para enviar' : 'Enter ↵ para continuar';
    furthest = Math.max(furthest, cur);
    paintMap();
  }
  function focusStep(st) {
    if (!interacted) return;
    const target = $('input:checked', st) || $('input:not([type=hidden]):not([type=checkbox]):not([disabled]), select, textarea', st) || $('input', st);
    target?.focus({ preventScroll: true });
    // a pergunta fica inteira na tela
    const r = form.getBoundingClientRect();
    if (r.top < 0 || r.top > window.innerHeight * 0.6) import('../core/scroll.js').then((m) => m.scrollToY(Math.max(0, r.top + window.scrollY - 80), 0.7));
  }
  function enter(st, dir) {
    st.classList.add('is-on');
    if (!anim) return;
    const t = $('.st__t', st), n = $('.st__n', st);
    const items = $$('.opt, .fld:not([hidden]), .check, .st__hint, .st__note, .st__done-a', st);
    gsap.fromTo(n, { opacity: 0, x: -12 }, { opacity: 1, x: 0, duration: 0.4, ease: 'power2.out', clearProps: 'all' });
    gsap.fromTo(t, { clipPath: 'polygon(0 0, 0 0, -40% 100%, 0 100%)', y: 22 * dir }, { clipPath: 'polygon(0 0, 140% 0, 100% 100%, 0 100%)', y: 0, duration: 0.7, ease: 'power3.out', clearProps: 'clipPath,transform' });
    gsap.fromTo(items, { y: 18 * dir, opacity: 0, filter: 'blur(6px)' }, { y: 0, opacity: 1, filter: 'blur(0px)', duration: 0.5, ease: 'power3.out', stagger: 0.035, delay: 0.1, clearProps: 'filter,transform,opacity' });
  }
  function go(to, { focus = true } = {}) {
    if (busy || to === cur || to < 0 || to >= STEPS.length) return;
    clearTimeout(autoT);
    const dir = to > cur ? 1 : -1, a = steps[cur], b = steps[to];
    const swap = () => {
      a.classList.remove('is-on');
      cur = to; chrome();
      live.textContent = `Pergunta ${cur + 1} de ${STEPS.length}: ${$('.st__t', b).textContent}`;
      if (anim) {
        const h0 = stage.offsetHeight;
        enter(b, dir);
        gsap.fromTo(stage, { height: h0 }, { height: 'auto', duration: 0.45, ease: 'power3.inOut', clearProps: 'height', onComplete: refreshLater });
      } else { enter(b, dir); refreshLater(); }
      if (focus) focusStep(b);
      busy = false;
    };
    busy = true;
    if (anim) {
      stage.style.height = `${stage.offsetHeight}px`;
      gsap.to(a, { y: -26 * dir, opacity: 0, filter: 'blur(8px)', duration: 0.26, ease: 'power2.in', onComplete: () => { gsap.set(a, { clearProps: 'all' }); swap(); } });
    } else swap();
  }
  let rt = null;
  const refreshLater = () => { clearTimeout(rt); rt = setTimeout(() => window.ScrollTrigger?.refresh(), 250); };
  function shake(st) {
    if (!anim) return;
    st.classList.remove('is-shake'); void st.offsetWidth; st.classList.add('is-shake');
    setTimeout(() => st.classList.remove('is-shake'), 450);
  }
  function avancar() {
    const k = STEPS[cur], e = errosDa(k);
    paint(k, e);
    if (Object.keys(e).length) {
      shake(steps[cur]);
      const first = Object.keys(e)[0];
      const f = $(`[data-field="${first}"]`, form);
      ($('input:not([type=radio]), select, textarea', f) || $('input', f))?.focus({ preventScroll: true });
      return false;
    }
    if (cur < STEPS.length - 1) go(cur + 1);
    return true;
  }

  // ---------- eventos ----------
  form.addEventListener('input', (e) => {
    interacted = true;
    if (e.target === tel) { const pos = tel.selectionStart, before = tel.value.length; tel.value = mascara(tel.value); const diff = tel.value.length - before; try { tel.setSelectionRange(pos + diff, pos + diff); } catch (x) { /* tipo tel */ } }
    if (e.target === semdata) { dataIn.disabled = semdata.checked; if (semdata.checked) dataIn.value = ''; }
    if (e.target === msg) count.textContent = msg.value.length;
    const k = STEPS[cur];
    // erros somem enquanto a pessoa corrige
    const er = errosDa(k); const shown = CAMPOS[k].filter((c) => $(`#err-${c}`, form)?.classList.contains('is-on'));
    if (shown.length) paint(k, Object.fromEntries(Object.entries(er).filter(([c]) => shown.includes(c))));
    saveDraft(); paintMap();
  });
  form.addEventListener('change', (e) => {
    const t = e.target; if (t.type !== 'radio') return;
    interacted = true;
    const opt = t.closest('.opt');
    $$(`input[name="${t.name}"]`, form).forEach((r) => r.closest('.opt')?.classList.remove('is-pick'));
    if (opt) { void opt.offsetWidth; opt.classList.add('is-pick'); }
    const k = STEPS[cur];
    paint(k, {});
    if (t.name === 'contratante') {
      const precisa = syncOrg();
      if (precisa) { setTimeout(() => form.elements.organizacao.focus({ preventScroll: true }), anim ? 260 : 0); return; }
    }
    if (AUTO.has(k) || t.name === 'contratante') { clearTimeout(autoT); autoT = setTimeout(() => avancar(), anim ? 420 : 0); }
  });
  next.addEventListener('click', () => { interacted = true; avancar(); });
  back.addEventListener('click', () => { interacted = true; go(cur - 1); });
  $$('[data-map-step] button').forEach((b) => b.addEventListener('click', () => { interacted = true; go(STEPS.indexOf(b.closest('[data-map-step]').dataset.mapStep)); }));
  form.addEventListener('keydown', (e) => {
    if (form.classList.contains('is-sent')) return;
    const t = e.target, txt = t.matches('input[type=text], input[type=tel], input[type=email], input[type=date], textarea, select');
    if (e.key === 'Enter') {
      if (t.matches('textarea')) { if (e.ctrlKey || e.metaKey) { e.preventDefault(); form.requestSubmit(); } return; }
      if (t.matches('button, a')) return;
      e.preventDefault(); interacted = true;
      if (cur === STEPS.length - 1) form.requestSubmit(); else avancar();
      return;
    }
    // atalhos 1–9 nas perguntas de escolha
    if (!txt && /^[1-9]$/.test(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const radios = $$('.opt input', steps[cur]); const r = radios[+e.key - 1];
      if (r) { e.preventDefault(); r.checked = true; r.dispatchEvent(new Event('change', { bubbles: true })); r.focus({ preventScroll: true }); }
    }
  });

  // ao chegar na seção (pelo menu ou por "Solicitar proposta"), as teclas já funcionam: 1–9 escolhem, Enter entra na pergunta
  let inView = false;
  if ('IntersectionObserver' in window) new IntersectionObserver((es) => { inView = es[0].isIntersecting; }, { threshold: 0.25 }).observe(form);
  document.addEventListener('keydown', (e) => {
    if (!inView || form.contains(e.target) || form.classList.contains('is-sent') || e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target;
    const livre = t === document.body || t === document.documentElement || (t.closest('#contratar') && !t.matches('a, button, input, select, textarea, [contenteditable]'));
    if (!livre) return;
    if (/^[1-9]$/.test(e.key)) {
      const r = $$('.opt input', steps[cur])[+e.key - 1];
      if (r) { e.preventDefault(); interacted = true; r.checked = true; r.dispatchEvent(new Event('change', { bubbles: true })); r.focus({ preventScroll: true }); }
    } else if (e.key === 'Enter') { e.preventDefault(); interacted = true; focusStep(steps[cur]); }
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const v = val(), er = erros(v);
    const bad = STEPS.findIndex((k) => Object.keys(errosDa(k, er)).length);
    if (bad >= 0) {
      if (bad === cur) { paint(STEPS[cur], errosDa(STEPS[cur], er)); shake(steps[cur]); }
      else { go(bad); setTimeout(() => paint(STEPS[bad], errosDa(STEPS[bad], er)), anim ? 320 : 0); }
      return;
    }
    const m = montarMensagem(v, lerOrigem().texto || '', codigo);
    const url = `https://wa.me/${wa}?text=${encodeURIComponent(m)}`;
    lastUrl = url; lastMsg = m;
    // abre de forma síncrona (sem await) para o navegador não bloquear
    if (coarse) window.location.href = url;
    else window.open(url, '_blank', 'noopener');
    again.href = url;
    finish();
    codigo = protocolo();
    try { localStorage.removeItem(DRAFT); } catch (x) { /* privado */ }
    if (testMode) (window.__NY__ ||= {}).lastWa = url;
  });
  function finish() {
    const a = steps[cur];
    const show = () => {
      a.classList.remove('is-on');
      form.classList.add('is-sent'); done.hidden = false;
      paintMap();
      if (anim) enter(done, 1);
      done.focus({ preventScroll: true });
      refreshLater();
    };
    if (anim) gsap.to(a, { y: -26, opacity: 0, filter: 'blur(8px)', duration: 0.26, ease: 'power2.in', onComplete: () => { gsap.set(a, { clearProps: 'all' }); show(); } });
    else show();
  }
  restartBtn.addEventListener('click', () => {
    const keep = { nome: form.elements.nome.value, whatsapp: form.elements.whatsapp.value, email: form.elements.email.value };
    form.reset(); restore(keep); dataIn.disabled = false; syncOrg();
    $$('.opt', form).forEach((o) => o.classList.remove('is-pick'));
    done.hidden = true; form.classList.remove('is-sent');
    steps.forEach((s) => s.classList.remove('is-on'));
    cur = 0; furthest = 0; steps[0].classList.add('is-on'); chrome(); count.textContent = '0';
    if (anim) enter(steps[0], 1);
    interacted = true; focusStep(steps[0]);
  });
  copyBtn.addEventListener('click', async () => {
    const t = lastMsg;
    try { await navigator.clipboard.writeText(t); copied.textContent = 'Mensagem copiada. Cole no WhatsApp da Nova York.'; }
    catch (x) { const ta = document.createElement('textarea'); ta.value = t; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); copied.textContent = 'Mensagem copiada.'; } catch (y) { copied.textContent = 'Não foi possível copiar agora.'; } ta.remove(); }
  });

  // ---------- rascunho (7 dias) e pré-preenchimento por URL (?evento=Réveillon&contratante=Empresa) ----------
  function saveDraft() { try { const v = val(); delete v.mensagem; localStorage.setItem(DRAFT, JSON.stringify({ t: Date.now(), v })); } catch (x) { /* sem storage */ } }
  function restore(v) {
    const f = form.elements;
    Object.entries(v).forEach(([k, x]) => {
      if (k === 'semdata') { f.semdata.checked = !!x; f.data.disabled = !!x; }
      else if (f[k] && typeof x === 'string') f[k].value = x;      // RadioNodeList marca a opção com esse valor
    });
  }
  try { const d = JSON.parse(localStorage.getItem(DRAFT) || 'null'); if (d && Date.now() - d.t < DRAFT_MS) restore(d.v); } catch (x) { /* nada */ }
  const q = new URLSearchParams(location.search);
  if (q.get('evento')) { const r = $$('input[name=evento]', form).find((i) => i.value.toLowerCase().includes(q.get('evento').toLowerCase())); if (r) r.checked = true; }
  if (q.get('contratante')) { const r = $$('input[name=contratante]', form).find((i) => i.value.toLowerCase() === q.get('contratante').toLowerCase()); if (r) r.checked = true; }
  syncOrg(); count.textContent = msg.value.length;
  // começa na primeira pergunta ainda sem resposta
  const er0 = erros(val());
  const pend = STEPS.findIndex((k) => Object.keys(errosDa(k, er0)).length);
  const start = pend < 0 ? STEPS.length - 1 : pend;
  furthest = start;
  cur = start; steps[cur].classList.add('is-on'); chrome();
  $$('a[data-wa-direct]').forEach((a) => { a.href = `https://wa.me/${wa}?text=${encodeURIComponent('Olá, Nova York! Vi o site e quero a Nova York no meu evento.')}`; });
  if (testMode) Object.assign((window.__NY__ ||= {}), { flow: { go, get cur() { return STEPS[cur]; }, avancar } });
}
