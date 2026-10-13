/* BANDA NOVA YORK · página de links.
   - Agenda: some o que já passou (no fuso de São Paulo); o próximo show acende com a contagem de dias.
   - Contratação em 4 perguntas → mensagem pronta no WhatsApp oficial, com código e origem da campanha.
   - Lançamento em destaque: o vídeo mais recente do canal (/api/videos), tocando aqui mesmo.
   Sem JS, tudo continua visível e os botões de contratação abrem o WhatsApp direto. */
import { registrarOrigem, lerOrigem } from '/assets/js/core/origem.js';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const html = document.documentElement;
html.classList.remove('no-js'); html.classList.add('js');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
registrarOrigem();

const hojeSP = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const diasAte = (iso) => Math.round((Date.parse(iso + 'T12:00:00Z') - Date.parse(hojeSP() + 'T12:00:00Z')) / 864e5);

/* ---------------- agenda ---------------- */
function agenda() {
  const hoje = hojeSP();
  $$('.ag__it').forEach((li) => { if (li.dataset.data < hoje) li.remove(); });
  $$('.ag__grupo').forEach((g) => { if (!$('.ag__it', g)) g.remove(); });
  const itens = $$('.ag__it');
  const sec = $('[data-agenda]'), chip = $('[data-prox-chip]'), link = $('[data-ag-link]');
  if (!itens.length) { [sec, chip, link].forEach((el) => el && (el.hidden = true)); return; }
  const n = itens.length;
  const cont = $('[data-ag-n]'); if (cont) cont.textContent = `${n} ${n === 1 ? 'data confirmada' : 'datas confirmadas'}`;
  const p = itens[0];
  p.classList.add('ag__it--prox');
  const rel = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' }).format(diasAte(p.dataset.data), 'day');
  const lab = $('[data-prox-label]', p), falta = $('[data-prox-cont]', p);
  if (lab) lab.hidden = false;
  if (falta) { falta.textContent = rel; falta.hidden = false; }
  // o Corte 56° do bloco acompanha a altura real
  const corte = () => p.style.setProperty('--sl', `${(p.offsetHeight * 0.6745).toFixed(1)}px`);
  corte(); if ('ResizeObserver' in window) new ResizeObserver(corte).observe(p);
  // as 5 próximas datas na tela; o resto abre no "Ver todas"
  const mais = $('[data-ag-mais]');
  if (mais && n > 5) {
    const extra = itens.slice(5);
    const grupos = () => $$('.ag__grupo').forEach((g) => { g.hidden = !$$('.ag__it', g).some((li) => !li.hidden); });
    extra.forEach((li) => { li.hidden = true; }); grupos();
    $('[data-ag-mais-t]', mais).textContent = `Ver todas as ${n} datas`;
    mais.hidden = false;
    mais.addEventListener('click', () => {
      const abrir = mais.getAttribute('aria-expanded') !== 'true';
      mais.setAttribute('aria-expanded', String(abrir));
      extra.forEach((li, i) => { li.hidden = !abrir; if (abrir) { li.classList.remove('on'); li.style.setProperty('--i', i % 6); } });
      grupos();
      $('[data-ag-mais-t]', mais).textContent = abrir ? 'Mostrar menos datas' : `Ver todas as ${n} datas`;
      if (abrir) requestAnimationFrame(() => requestAnimationFrame(() => extra.forEach((li) => li.classList.add('on'))));
      else mais.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' });
    });
  }
  if (chip) {
    $('[data-prox-dia]', chip).textContent = `${$('.ag__d', p).textContent} ${$('.ag__m', p).textContent}`;
    $('[data-prox-cid]', chip).textContent = $('.ag__cid', p).textContent;
    chip.setAttribute('aria-label', `Próximo show: ${$('.ag__d', p).textContent} de ${$('.ag__m', p).textContent}, ${$('.ag__cid', p).textContent}, ${rel}. Ver a agenda`);
  }
}
agenda();

/* ---------------- revelação ao rolar ---------------- */
const rv = $$('.rv');
if (reduce || !('IntersectionObserver' in window)) rv.forEach((el) => el.classList.add('on'));
else {
  // quem começa recortado (clip-path) não é visto pelo observador: observa o elemento de fora
  const alvo = new Map();
  const io = new IntersectionObserver((es) => es.forEach((e) => {
    if (!e.isIntersecting) return;
    (alvo.get(e.target) || [e.target]).forEach((el) => el.classList.add('on'));
    io.unobserve(e.target);
  }), { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
  rv.forEach((el) => {
    const pai = el.matches('.ag__it, .mo__it, .tit') ? el.parentElement : null;
    if (pai) { if (!alvo.has(pai)) { alvo.set(pai, []); io.observe(pai); } alvo.get(pai).push(el); }
    else io.observe(el);
  });
}

/* o botão principal recebe um feixe quando a entrada termina */
if (!reduce) {
  const cta = $('.hero__in > .cta');
  if (cta) setTimeout(() => { cta.classList.add('is-feixe'); setTimeout(() => cta.classList.remove('is-feixe'), 900); }, 2100);
}

/* ---------------- momentos: barras que acendem e levam a cada momento ---------------- */
const faixa = $('[data-mo]'), moNav = $('[data-mo-nav]');
if (faixa && moNav) {
  const its = $$('.mo__it', faixa), bts = $$('button', moNav);
  moNav.hidden = false;
  const marca = (i) => bts.forEach((b, j) => b.setAttribute('aria-current', String(i === j)));
  marca(0);
  bts.forEach((b, i) => b.addEventListener('click', () => {
    const pad = parseFloat(getComputedStyle(faixa).scrollPaddingInlineStart) || 20;
    faixa.scrollTo({ left: its[i].offsetLeft - pad, behavior: reduce ? 'auto' : 'smooth' });
    marca(i);
  }));
  if ('IntersectionObserver' in window) {
    const vis = new Map();
    const io2 = new IntersectionObserver((es) => {
      es.forEach((e) => vis.set(e.target, e.intersectionRatio));
      let melhor = 0, r = -1; its.forEach((it, i) => { const v = vis.get(it) || 0; if (v > r + 0.01) { r = v; melhor = i; } });
      marca(melhor);
    }, { root: faixa, threshold: [0, 0.25, 0.5, 0.75, 1] });
    its.forEach((it) => io2.observe(it));
  }
}

/* ---------------- atendimento ---------------- */
const atBtn = $('[data-at]'), atCorpo = $('[data-at-corpo]');
if (atBtn && atCorpo) atBtn.addEventListener('click', () => {
  const abrir = atBtn.getAttribute('aria-expanded') !== 'true';
  atBtn.setAttribute('aria-expanded', String(abrir));
  atCorpo.hidden = !abrir;
  if (abrir) { atCorpo.classList.remove('is-abrindo'); void atCorpo.offsetWidth; atCorpo.classList.add('is-abrindo'); }
});

/* ---------------- lançamento em destaque ---------------- */
const vid = $('[data-video]');
function poeVideo(id, titulo, data) {
  if (!vid || !id) return;
  vid.dataset.video = id;
  const th = $('[data-thumb]', vid);
  if (th) {
    th.src = `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
    const im = new Image();
    im.onload = () => { if (im.naturalWidth > 200 && vid.dataset.video === id) th.src = im.src; };
    im.src = `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`;
  }
  if (titulo) {
    $('[data-vtit]').textContent = titulo;
    const b = $('[data-play]', vid); if (b) b.setAttribute('aria-label', `Assistir: ${titulo}`);
  }
  const t = $('[data-vpub]');
  if (t && data && /^\d{4}-\d{2}-\d{2}/.test(data)) {
    t.dateTime = data.slice(0, 10);
    t.textContent = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(data.slice(0, 10) + 'T12:00:00Z'));
  }
}
if (vid) {
  poeVideo(vid.dataset.video, '', $('[data-vpub]')?.dateTime);
  const ctrl = 'AbortController' in window ? new AbortController() : null;
  const t = setTimeout(() => ctrl?.abort(), 3500);
  fetch('/api/videos', { signal: ctrl?.signal, headers: { accept: 'application/json' } })
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => {
      const it = d?.items?.find((x) => x && x.id && !x.isShort);
      if (it && !vid.querySelector('iframe')) poeVideo(it.id, (d.titles && d.titles[it.id]) || it.title, it.publishedAt);
    })
    .catch(() => {})
    .finally(() => clearTimeout(t));
  vid.addEventListener('click', (e) => {
    const b = e.target.closest('[data-play]'); if (!b) return;
    const f = document.createElement('iframe');
    f.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(vid.dataset.video)}?autoplay=1&playsinline=1&rel=0&modestbranding=1`;
    f.title = $('[data-vtit]').textContent;
    f.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
    f.allowFullscreen = true;
    f.referrerPolicy = 'strict-origin-when-cross-origin';
    b.replaceWith(f);
    f.focus();
  });
}

/* ---------------- contratação ---------------- */
const dlg = $('[data-bk]');
const form = $('[data-bk-form]');
const WA = dlg?.dataset.wa || '5534998790035';
const DIAS = ['dom.', 'seg.', 'ter.', 'qua.', 'qui.', 'sex.', 'sáb.'];
const limpa = (s) => String(s || '').replace(/[*_~`]/g, '').replace(/\s+/g, ' ').trim();
const sem = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[’ʼ´‘]/g, "'").trim();
function mascara(v) {
  let d = String(v).replace(/\D/g, '');
  if (d.length > 11 && d.startsWith('55')) d = d.slice(2);
  d = d.slice(0, 11);
  if (d.length <= 2) return d ? `(${d}` : '';
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 3)} ${d.slice(3, 7)}-${d.slice(7)}`;
}
function telValido(v) {
  let d = String(v).replace(/\D/g, '');
  if (d.length > 11 && d.startsWith('55')) d = d.slice(2);
  if (d.length < 10 || d.length > 11) return false;
  const ddd = +d.slice(0, 2); if (ddd < 11 || ddd > 99 || d[1] === '0') return false;
  return !(d.length === 11 && d[2] !== '9');
}
function fmtData(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || ''); if (!m) return '';
  return `${m[3]}/${m[2]}/${m[1]} (${DIAS[new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).getUTCDay()]})`;
}
function codigo() {
  const h = hojeSP().replace(/-/g, '').slice(2);
  return `NY-LINKS-${h}-${Math.random().toString(36).slice(2, 6).toUpperCase().padEnd(4, 'X')}`;
}
export function montarMensagem(v, origem, cod) {
  const L = ['Olá, Nova York! Quero a Nova York no meu evento.', ''];
  L.push(`*Evento:* ${limpa(v.evento) || '-'}`);
  L.push(`*Data:* ${v.semdata ? 'ainda não definida' : fmtData(v.data) || '-'}`);
  L.push(`*Cidade:* ${limpa(v.cidade) || '-'}${v.uf ? `/${v.uf}` : ''}`);
  if (v.publico) L.push(`*Público estimado:* ${v.publico}`);
  L.push('');
  L.push(`*Nome:* ${limpa(v.nome) || '-'}`);
  if (v.whatsapp) L.push(`*WhatsApp:* ${mascara(v.whatsapp)}`);
  if (limpa(v.organizacao)) L.push(`*Organização:* ${limpa(v.organizacao)}`);
  L.push('', `Código: ${cod} · origem: ${limpa(origem) || 'links'}`);
  return L.join('\n');
}

if (dlg && form && typeof dlg.showModal === 'function') {
  const passos = $$('[data-passo]', form);
  const barras = $$('.bk__prog i', form);
  const status = $('[data-bk-status]', form);
  const cidade = $('#bk-cidade'), uf = $('#bk-uf'), data = $('#bk-data'), semdata = $('[data-semdata]');
  const sug = $('#bk-sug'), wa = $('#bk-wa');
  let passo = '1', lista = null, carregando = null, ufAuto = false, ativo = -1, opcoes = [];
  data.min = hojeSP();

  const campo = (n) => form.elements[n];
  const valor = (n) => { const el = campo(n); if (!el) return ''; if (el instanceof RadioNodeList) return el.value; return el.type === 'checkbox' ? el.checked : el.value; };
  // o erro aparece logo abaixo do campo que precisa de ajuste
  const erro = (fs, msg, el) => {
    const p = $('[data-err]', fs); if (!p) return;
    $$('[aria-invalid]', fs).forEach((x) => { x.removeAttribute('aria-invalid'); x.removeAttribute('aria-describedby'); });
    p.textContent = msg || '';
    if (el && msg) {
      const box = el.closest('.fld, .chk'); if (box && box.nextElementSibling !== p) box.after(p);
      el.setAttribute('aria-invalid', 'true'); el.setAttribute('aria-describedby', p.id); el.focus();
    }
  };

  function vaiPara(n) {
    passo = String(n);
    form.dataset.etapa = passo;
    passos.forEach((fs) => { const on = fs.dataset.passo === passo; fs.hidden = !on; fs.classList.toggle('is-entrando', on && !reduce); });
    const k = passo === 'ok' ? 4 : +passo;
    barras.forEach((b, i) => b.classList.toggle('on', i < k));
    status.textContent = passo === 'ok' ? 'Mensagem pronta no WhatsApp.' : `Pergunta ${k} de 4`;
    const atual = passos.find((fs) => fs.dataset.passo === passo);
    if (atual) { atual.tabIndex = -1; atual.focus({ preventScroll: true }); }
    form.scrollTop = 0;
  }

  function carregaLista() {
    if (lista || carregando) return carregando;
    carregando = fetch('/links/municipios.json').then((r) => r.json()).then((arr) => {
      lista = arr.map((s) => { const [nome, u] = s.split('|'); return { nome, uf: u, k: sem(nome) }; });
      return lista;
    }).catch(() => { carregando = null; return null; });
    return carregando;
  }

  /* abre e fecha: o botão Voltar do celular fecha a folha */
  let abriuEm = null, abertaEm = 0;
  function abre(empurra = true) {
    if (dlg.open) return;
    abriuEm = document.activeElement;
    if (passo === 'ok') { form.reset(); ufAuto = false; vaiPara(1); }
    dlg.showModal(); abertaEm = performance.now();
    html.style.overflow = 'hidden';
    if (empurra && location.hash !== '#contratar') history.pushState({ bk: 1 }, '', '#contratar');
    vaiPara(passo);
    carregaLista();
  }
  function fecha() {
    if (!dlg.open) return;
    const fim = () => {
      dlg.classList.remove('is-saindo'); dlg.close(); html.style.overflow = '';
      if (location.hash === '#contratar') history.replaceState(history.state && history.state.bk ? null : history.state, '', location.pathname + location.search);
      if (abriuEm && abriuEm.focus) abriuEm.focus({ preventScroll: true });
    };
    if (reduce) fim(); else { dlg.classList.add('is-saindo'); setTimeout(fim, 260); }
  }
  const pedeFechar = () => { if (history.state && history.state.bk && location.hash === '#contratar') history.back(); else fecha(); };
  window.addEventListener('popstate', () => {
    if (dlg.open && location.hash !== '#contratar') fecha();
    else if (!dlg.open && location.hash === '#contratar') abre(false);
  });
  $$('[data-abrir]').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); abre(); }));
  $$('[data-fechar]', dlg).forEach((b) => b.addEventListener('click', pedeFechar));
  dlg.addEventListener('cancel', (e) => { e.preventDefault(); pedeFechar(); });
  // fecha tocando no fundo só se o toque começou e terminou no fundo (evita o clique fantasma logo depois de abrir)
  let tocouFundo = false;
  dlg.addEventListener('pointerdown', (e) => { tocouFundo = e.target === dlg && performance.now() - abertaEm > 450; });
  dlg.addEventListener('click', (e) => { if (e.target === dlg && tocouFundo) pedeFechar(); tocouFundo = false; });
  if (location.hash === '#contratar') abre(false);

  /* escolhas únicas avançam sozinhas no toque; pelo teclado, Enter confirma */
  let porToque = false;
  form.addEventListener('pointerdown', () => { porToque = true; }, true);
  form.addEventListener('keydown', (e) => {
    porToque = false;
    if (e.key === 'Enter' && e.target.type === 'radio') { e.preventDefault(); e.target.checked = true; avancaEscolha(e.target); }
  });
  form.addEventListener('change', (e) => {
    const el = e.target;
    if (el.type === 'radio' && porToque) avancaEscolha(el);
  });
  function avancaEscolha(el) {
    const fs = el.closest('[data-passo]'); erro(fs, '');
    const prox = fs.dataset.passo === '1' ? 2 : fs.dataset.passo === '3' ? 4 : null;
    if (prox) setTimeout(() => vaiPara(prox), reduce ? 0 : 320);
  }
  $$('[data-voltar]', form).forEach((b) => b.addEventListener('click', () => vaiPara(Math.max(1, +passo - 1))));

  /* passo 2: cidade (o estado vem junto), data */
  function fechaSug() { sug.hidden = true; cidade.setAttribute('aria-expanded', 'false'); cidade.removeAttribute('aria-activedescendant'); ativo = -1; }
  function marca(i) {
    ativo = i;
    $$('li', sug).forEach((li, j) => li.setAttribute('aria-selected', String(j === i)));
    if (i >= 0) { cidade.setAttribute('aria-activedescendant', `sug-${i}`); $(`#sug-${i}`)?.scrollIntoView({ block: 'nearest' }); }
  }
  function escolhe(i) {
    const o = opcoes[i]; if (!o) return;
    cidade.value = o.nome; uf.value = o.uf; ufAuto = true; fechaSug();
    erro(cidade.closest('[data-passo]'), '');
  }
  function sugere() {
    if (ufAuto) { uf.value = ''; ufAuto = false; }
    const q = sem(cidade.value);
    if (!lista || q.length < 2) { fechaSug(); return; }
    const ini = [], meio = [];
    for (const m of lista) { if (m.k.startsWith(q)) ini.push(m); else if (m.k.includes(q)) meio.push(m); if (ini.length >= 6) break; }
    opcoes = ini.concat(meio).slice(0, 6);
    if (!opcoes.length) { fechaSug(); return; }
    sug.innerHTML = '';
    opcoes.forEach((o, i) => {
      const li = document.createElement('li');
      li.id = `sug-${i}`; li.setAttribute('role', 'option'); li.setAttribute('aria-selected', 'false');
      li.textContent = o.nome;
      const s = document.createElement('span'); s.textContent = o.uf; li.appendChild(s);
      li.addEventListener('pointerdown', (e) => { e.preventDefault(); escolhe(i); });
      sug.appendChild(li);
    });
    sug.hidden = false; cidade.setAttribute('aria-expanded', 'true'); marca(-1);
  }
  cidade.addEventListener('input', () => { if (!lista) carregaLista()?.then(sugere); else sugere(); });
  cidade.addEventListener('keydown', (e) => {
    if (sug.hidden) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); marca(Math.min(opcoes.length - 1, ativo + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); marca(Math.max(0, ativo - 1)); }
    else if (e.key === 'Enter' && ativo >= 0) { e.preventDefault(); e.stopPropagation(); escolhe(ativo); data.focus(); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); fechaSug(); }
  });
  cidade.addEventListener('blur', () => setTimeout(() => {
    fechaSug();
    if (!uf.value && lista) {
      const exatas = lista.filter((m) => m.k === sem(cidade.value));
      if (exatas.length === 1) { cidade.value = exatas[0].nome; uf.value = exatas[0].uf; ufAuto = true; }
    }
  }, 120));
  uf.addEventListener('change', () => { ufAuto = false; });
  semdata.addEventListener('change', () => { data.disabled = semdata.checked; if (semdata.checked) data.value = ''; });
  wa.addEventListener('input', () => { const p = wa.selectionStart === wa.value.length; wa.value = mascara(wa.value); if (p) wa.setSelectionRange(wa.value.length, wa.value.length); });

  $('[data-passo="2"] [data-seguir]', form).addEventListener('click', () => {
    const fs = $('[data-passo="2"]', form);
    if (limpa(cidade.value).length < 2) return erro(fs, 'Digite a cidade do evento.', cidade);
    if (!uf.value) return erro(fs, 'Escolha o estado da cidade.', uf);
    if (!semdata.checked && !data.value) return erro(fs, 'Escolha a data do evento ou marque que ainda não tem data.', data);
    if (!semdata.checked && data.value < hojeSP()) return erro(fs, 'Essa data já passou. Escolha uma data a partir de hoje.', data);
    erro(fs, ''); vaiPara(3);
  });
  // Enter no passo 2 continua (não envia o formulário)
  $('[data-passo="2"]', form).addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.matches('input') && e.target !== cidade) { e.preventDefault(); $('[data-passo="2"] [data-seguir]', form).click(); }
    else if (e.key === 'Enter' && e.target === cidade && sug.hidden) { e.preventDefault(); (uf.value ? data : uf).focus(); }
  });

  /* passo 4: contato → WhatsApp */
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (passo !== '4') return;
    const fs = $('[data-passo="4"]', form);
    const nome = campo('nome');
    if (limpa(nome.value).length < 2) return erro(fs, 'Digite seu nome para a equipe saber com quem falar.', nome);
    if (!telValido(wa.value)) return erro(fs, 'Confira o WhatsApp com DDD. Exemplo: (34) 9 9999-9999.', wa);
    erro(fs, '');
    const v = { evento: valor('evento'), data: valor('data'), semdata: valor('semdata'), cidade: cidade.value, uf: uf.value, publico: valor('publico'),
      nome: nome.value, whatsapp: wa.value, organizacao: valor('organizacao') };
    const o = lerOrigem().texto;
    const msg = montarMensagem(v, o === 'site' ? 'links' : o, codigo());
    const url = `https://wa.me/${WA}?text=${encodeURIComponent(msg)}`;
    const link = $('[data-wa-link]', form); if (link) link.href = url;
    let w = null;
    try { w = window.open(url, '_blank'); if (w) w.opener = null; } catch (err) { w = null; }
    vaiPara('ok');
    if (!w) location.href = url;
  });

  if (/[?&]teste=1\b/.test(location.search)) window.__LINKS__ = { abre, fecha, vaiPara, montarMensagem, get passo() { return passo; }, get lista() { return lista; } };
}
