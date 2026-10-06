/* CONTRATAR · credencial do contratante → mensagem pronta no WhatsApp oficial.
   Sem campos de formato, duração, pacote ou montagem do show (regra da marca). */
import { $, $$, config, hojeSP, coarse, testMode } from '../core/env.js';
import { lerOrigem } from '../core/origem.js';

const DRAFT = 'ny-form-draft', DRAFT_MS = 7 * 864e5;
const ORG = {
  'Órgão público': { label: 'Órgão / Prefeitura / Secretaria', req: true },
  'Empresa': { label: 'Empresa', req: true },
  'Casa de show / produtora': { label: 'Casa de show / produtora', req: false },
  'Outro': { label: 'Organização', req: false },
};
const DIAS = ['dom.', 'seg.', 'ter.', 'qua.', 'qui.', 'sex.', 'sáb.'];

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
  const wa = config.whatsapp || form.elements.phone.value;
  const preview = $('[data-preview]'), done = $('[data-done]'), again = $('[data-open-again]'), copyBtn = $('[data-copy]'), copied = $('.prev__copied');
  const errBox = $('[data-errors]', form), orgFld = $('[data-org]', form), orgLbl = $('[data-org-label]', form), orgReq = $('[data-org-req]', form);
  const dataIn = form.elements.data, semdata = form.elements.semdata, tel = form.elements.whatsapp, msg = form.elements.mensagem, count = $('[data-count]', form);
  let codigo = protocolo(), touched = new Set(), submitted = false, lastUrl = '', lastMsg = '';

  // datas: hoje (São Paulo) até +3 anos
  const hoje = hojeSP(); dataIn.min = hoje; dataIn.max = `${+hoje.slice(0, 4) + 3}${hoje.slice(4)}`;

  const val = () => {
    const f = form.elements;
    return { contratante: f.contratante.value, organizacao: f.organizacao.value, evento: f.evento.value, data: f.data.value, semdata: f.semdata.checked, cidade: f.cidade.value, uf: f.uf.value, local: f.local.value, publico: f.publico.value, nome: f.nome.value, whatsapp: f.whatsapp.value, email: f.email.value, mensagem: f.mensagem.value };
  };
  function syncOrg() {
    const c = form.elements.contratante.value, o = ORG[c];
    orgFld.hidden = !o;
    if (o) { orgLbl.textContent = o.label; orgReq.hidden = !o.req; form.elements.organizacao.required = o.req; }
    else form.elements.organizacao.required = false;
  }
  function erros(v) {
    const e = {};
    if (!v.contratante) e.contratante = 'Escolha quem está contratando.';
    if (ORG[v.contratante]?.req && limpa(v.organizacao).length < 2) e.organizacao = `Informe ${ORG[v.contratante].label === 'Empresa' ? 'a empresa' : 'o órgão, a prefeitura ou a secretaria'}.`;
    if (!v.evento) e.evento = 'Escolha o tipo de evento.';
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
  function paintErrors(e, all) {
    $$('[data-field]', form).forEach((f) => {
      const k = f.dataset.field, show = e[k] && (all || touched.has(k));
      f.classList.toggle('is-err', !!show);
      const p = $(`#err-${k}`, form); if (p) p.textContent = show ? e[k] : '';
      $$('input, select, textarea', f).forEach((i) => { if (i.type === 'radio' || i.type === 'checkbox') return; i.setAttribute('aria-invalid', show ? 'true' : 'false'); });
    });
  }
  function render() {
    const v = val();
    const m = montarMensagem(v, origemTxt(), codigo);
    preview.innerHTML = esc(m).replace(/\*([^*\n]+)\*/g, '<strong>$1</strong>');
    count.textContent = msg.value.length;
    return m;
  }
  const esc = (s) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  function origemTxt() { const o = lerOrigem(); return o.texto || ''; }

  // eventos
  form.addEventListener('input', (e) => {
    if (e.target === tel) { const pos = tel.selectionStart, before = tel.value.length; tel.value = mascara(tel.value); const diff = tel.value.length - before; try { tel.setSelectionRange(pos + diff, pos + diff); } catch (x) { /* tipo tel */ } }
    if (e.target.name === 'contratante') syncOrg();
    if (e.target === semdata) { dataIn.disabled = semdata.checked; if (semdata.checked) dataIn.value = ''; }
    render(); saveDraft();
    if (submitted) paintErrors(erros(val()), true); else paintErrors(erros(val()), false);
  });
  form.addEventListener('change', (e) => { if (e.target.name === 'contratante') { touched.add('contratante'); syncOrg(); render(); } });
  form.addEventListener('focusout', (e) => { const f = e.target.closest('[data-field]'); if (f) { touched.add(f.dataset.field); paintErrors(erros(val()), submitted); } });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    submitted = true;
    const v = val(), er = erros(v), keys = Object.keys(er);
    paintErrors(er, true);
    if (keys.length) {
      errBox.hidden = false;
      errBox.innerHTML = `<strong>Faltam ${keys.length === 1 ? 'um campo' : `${keys.length} campos`} para continuar:</strong><ul>${keys.map((k) => `<li><a href="#" data-goto="${k}">${er[k]}</a></li>`).join('')}</ul>`;
      errBox.focus();
      return;
    }
    errBox.hidden = true;
    const m = render();
    const url = `https://wa.me/${wa}?text=${encodeURIComponent(m)}`;
    lastUrl = url; lastMsg = m;
    // abre de forma síncrona (sem await) para o navegador não bloquear
    if (coarse) { window.location.href = url; }
    else { const w = window.open(url, '_blank', 'noopener'); if (!w) { /* bloqueado: o painel oferece o link */ } }
    again.href = url; done.hidden = false;
    codigo = protocolo();
    try { localStorage.removeItem(DRAFT); } catch (x) { /* privado */ }
    if (testMode) (window.__NY__ ||= {}).lastWa = url;
  });
  errBox.addEventListener('click', (e) => {
    const a = e.target.closest('[data-goto]'); if (!a) return; e.preventDefault();
    const f = $(`[data-field="${a.dataset.goto}"]`, form); const i = $('input:not([type=hidden]), select, textarea', f); i?.focus();
  });
  copyBtn.addEventListener('click', async () => {
    const t = lastMsg || render();
    try { await navigator.clipboard.writeText(t); copied.textContent = 'Mensagem copiada. Cole no WhatsApp da Nova York.'; }
    catch (x) { const ta = document.createElement('textarea'); ta.value = t; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); copied.textContent = 'Mensagem copiada.'; } catch (y) { copied.textContent = 'Selecione e copie a prévia acima.'; } ta.remove(); }
  });

  // rascunho (7 dias) e pré-preenchimento por URL (?evento=Réveillon&contratante=Empresa)
  function saveDraft() { try { const v = val(); delete v.mensagem; localStorage.setItem(DRAFT, JSON.stringify({ t: Date.now(), v })); } catch (x) { /* sem storage */ } }
  function restore(v) {
    const f = form.elements;
    Object.entries(v).forEach(([k, x]) => {
      if (k === 'contratante') { const r = $$('input[name=contratante]', form).find((i) => i.value === x); if (r) r.checked = true; }
      else if (k === 'semdata') { f.semdata.checked = !!x; f.data.disabled = !!x; }
      else if (f[k] && typeof x === 'string') f[k].value = x;
    });
  }
  try { const d = JSON.parse(localStorage.getItem(DRAFT) || 'null'); if (d && Date.now() - d.t < DRAFT_MS) restore(d.v); } catch (x) { /* nada */ }
  const q = new URLSearchParams(location.search);
  if (q.get('evento')) { const o = $$('option', form.elements.evento).find((op) => op.text.toLowerCase().includes(q.get('evento').toLowerCase())); if (o) form.elements.evento.value = o.text; }
  if (q.get('contratante')) restore({ contratante: q.get('contratante') });
  syncOrg(); render();
  $$('a[data-wa-direct]').forEach((a) => { a.href = `https://wa.me/${wa}?text=${encodeURIComponent('Olá, Nova York! Vi o site e quero a Nova York no meu evento.')}`; });
}
