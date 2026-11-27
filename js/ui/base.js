/* Projetech · Painel de LED — utilidades da interface: formatação para gente, modais, avisos. */

export const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const nf = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });
const nf1 = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });
export const num = (v, casas) => (v == null || v === '' || !Number.isFinite(+v) ? '—' : (casas === 1 ? nf1 : nf).format(+v));
export const lerNum = v => {
  if (v == null) return null;
  const s = String(v).trim().replace(/\s/g, '').replace(',', '.');
  if (s === '') return null;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
};

const DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
export function dataBR(iso, comAno) {
  if (!iso) return '—';
  const p = iso.slice(0, 10).split('-');
  return p[2] + '/' + p[1] + (comAno ? '/' + p[0] : '');
}
export function dataSemana(iso) {
  if (!iso) return '—';
  const p = iso.split('-');
  const d = new Date(+p[0], +p[1] - 1, +p[2], 12);
  return DIAS[d.getDay()] + ' ' + p[2] + '/' + p[1];
}
export function horaBR(isoDT) {
  if (!isoDT) return '';
  const d = new Date(isoDT);
  return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}
export function quando(isoDT, hojeISO) {
  if (!isoDT) return '';
  const d = new Date(isoDT);
  const dia = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  if (dia === hojeISO) return 'hoje ' + horaBR(isoDT);
  return dataBR(dia) + ' ' + horaBR(isoDT);
}
export function emDias(n) {
  if (n === 0) return 'hoje';
  if (n === 1) return 'amanhã';
  if (n === -1) return 'ontem';
  return n > 0 ? 'em ' + n + ' dias' : 'há ' + -n + ' dias';
}

export const STATUS_LISTA = {
  rascunho: ['Rascunho', 'cinza'], pronta: ['Pronta p/ separar', 'azul'], separando: ['Separando', 'amarelo'],
  separada: ['Separada', 'verde'], em_evento: ['No evento', 'roxo'], retornada: ['Retornada', 'cinza2'], cancelada: ['Cancelada', 'vermelho']
};
export const STATUS_MANUT = { aberta: ['Aberta', 'vermelho'], em_reparo: ['Em reparo', 'amarelo'], aguardando_peca: ['Aguardando peça', 'roxo'], concluida: ['Concluída', 'verde'] };
export const MONTAGEM = { chao: 'No chão (mão francesa)', aereo: 'Aéreo / bumper', totem: 'Totem', balcao: 'Balcão / cubo', outro: 'Outro' };
export const MODO_TELA = { medida: 'Largura × altura (m)', grade: 'Colunas × linhas', m2: 'Área (m²)', gabinetes: 'Nº de gabinetes' };
export const unidade = (c, q) => { const u = (c && c.un) || 'un'; if (u === 'case') return +q === 1 ? 'case' : 'cases'; return u; };
export const pill = (txt, cor) => `<span class="pill ${cor || ''}">${esc(txt)}</span>`;
export const pillStatus = s => { const x = STATUS_LISTA[s] || [s, '']; return pill(x[0], x[1]); };
// Nome da lista para gente: "FICO Forum · Foyer" (a sala entra quando a lista é sublista de um evento)
export const nomeLista = l => [(l && l.evento) || 'Lista sem nome', l && l.sala].filter(Boolean).join(' · ');

export const BASE_NOME = {
  gabinetes: 'gabinetes', cases: 'cases', colunas: 'colunas', linhas: 'linhas', largura_m: 'm de largura', altura_m: 'm de altura',
  m2: 'm²', circuitos: 'circuitos', portas: 'portas de dados', apoios: 'apoios de mão francesa', mf_192: 'peças de 1,92 (pelos apoios)',
  mf_144: 'peças de 1,44 (pelos apoios)', mf_096: 'peças de 0,96 (pelos apoios)', pesos: 'pesos (1 por metro, por fileira)',
  mf_segunda_linha: 'fileiras com segunda linha', tela: 'tela', lista: 'lista',
  gabinetes_chao: 'gabinetes no chão', telas: 'telas', telas_chao: 'telas no chão',
  // do projeto (da tela ou da sala inteira)
  circuitos_projeto: 'circuitos do projeto', cabos_dados: 'cabos de dados do projeto', reguas: 'réguas do projeto',
  racks: 'racks do projeto', racks_5: 'racks de 5 saídas', racks_9: 'racks de 9 saídas', racks_12: 'racks de 12 saídas',
  controladoras: 'controladoras do projeto', ctrl_660: 'MCTRL660 do projeto', ctrl_tb1: 'Taurus TB1 do projeto', ctrl_tb60: 'Taurus TB60 do projeto', ctrl_cvt10: 'CVT10 do projeto', ctrl_cvt4k: 'CVT4K-S do projeto'
};
export const ARRED_NOME = { cima: 'para cima', baixo: 'para baixo', proximo: 'para o mais próximo' };

export function nomeBase(base, catIdx) {
  if (!base) return '—';
  if (base.startsWith('item:')) { const c = catIdx.get(base.slice(5)); return c ? c.nome : base.slice(5); }
  if (base.startsWith('itens:')) {
    const nomes = base.slice(6).split(',').map(id => { const c = catIdx.get(id.trim()); return c ? c.nome : id; });
    // "Mão francesa 1,92 m + 1,44 m + 0,96 m" → "peças de mão francesa (todas as medidas)"
    const pal = nomes.map(n => n.split(' '));
    let k = 0;
    while (pal.every(p => p[k] && p[k] === pal[0][k])) k++;
    if (nomes.length > 1 && k >= 1) return 'peças de ' + pal[0].slice(0, k).join(' ').toLowerCase() + ' (todas as medidas)';
    return nomes.join(' + ');
  }
  return BASE_NOME[base] || base;
}

export function fatorTexto(f) {
  if (f == null || f === '') return '× 1';
  const v = +f;
  if (v > 0 && v < 1) {
    const inv = 1 / v;
    if (Math.abs(inv - Math.round(inv)) < 1e-6) return '÷ ' + Math.round(inv);
  }
  return '× ' + num(v);
}

/* A frase da justificativa — o motor manda números, quem escreve é a tela. */
export function fraseOrigem(o, catIdx) {
  const partes = [];
  partes.push(`${num(o.valor_base)} ${nomeBase(o.base, catIdx)}`);
  if (o.fator !== 1) partes.push(fatorTexto(o.fator));
  if (o.reserva) partes.push(`+ ${num(o.reserva * 100)}%`);
  if (o.adicional) partes.push((o.adicional > 0 ? '+ ' : '− ') + num(Math.abs(o.adicional)));
  let txt = partes.join(' ');
  const exato = Math.abs(o.bruto - o.qtd) < 1e-6;
  txt += exato ? ` = ${num(o.qtd)}` : ` = ${num(o.bruto)} → ${num(o.qtd)}`;
  const extras = [];
  if (o.multiplo > 1) extras.push(`de ${o.multiplo} em ${o.multiplo}`);
  if (o.minimo && o.qtd === o.minimo && o.bruto < o.minimo) extras.push(`mínimo ${o.minimo}`);
  if (o.maximo && o.qtd === o.maximo && o.bruto > o.maximo) extras.push(`máximo ${o.maximo}`);
  if (o.teto) extras.push(`no máximo ${num(o.teto.fator)} por ${(BASE_NOME[o.teto.base] || o.teto.base).replace(/s( |$)/, '$1')} = ${num(o.teto.limite)}`);
  if (extras.length) txt += ` (${extras.join(', ')})`;
  return (o.tela_nome ? o.tela_nome + ': ' : (o.tela === null ? 'Lista: ' : '')) + txt;
}

export function fraseRegra(r, catIdx) {
  const alvo = r.item === '@painel' ? 'Case do painel da tela' : (catIdx.get(r.item) || { nome: r.item }).nome;
  let t = `${nomeBase(r.base, catIdx)} ${fatorTexto(r.fator)}`;
  if (+r.reserva) t += ` + ${num(r.reserva * 100)}%`;
  if (+r.adicional) t += (r.adicional > 0 ? ' + ' : ' − ') + num(Math.abs(r.adicional));
  const ex = [];
  if (r.arred && r.arred !== 'cima') ex.push('arredonda ' + ARRED_NOME[r.arred]);
  if (+r.multiplo > 1) ex.push(`de ${r.multiplo} em ${r.multiplo}`);
  if (+r.minimo) ex.push('mín. ' + r.minimo);
  if (+r.maximo) ex.push('máx. ' + r.maximo);
  if (r.teto && r.teto.base) ex.push(`no máximo ${num(r.teto.fator == null ? 1 : r.teto.fator)} por ${(BASE_NOME[r.teto.base] || r.teto.base).replace(/s( |$)/, '$1')}`);
  if (r.cond && r.cond.base) ex.push(`só se ${BASE_NOME[r.cond.base] || r.cond.base} ${r.cond.op} ${num(r.cond.valor)}`);
  return { alvo, conta: t + (ex.length ? ' · ' + ex.join(' · ') : '') };
}

/* ---------------- ícones (traço, herdam a cor) ---------------- */
const I = {
  inicio: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/>',
  listas: '<path d="M9 6h11M9 12h11M9 18h11"/><path d="M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2"/>',
  estoque: '<path d="M21 8l-9-5-9 5 9 5 9-5z"/><path d="M3 8v8l9 5 9-5V8"/><path d="M12 13v8"/>',
  manut: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4 2.5-2.5z"/>',
  bancada: '<path d="M3 21h18"/><path d="M5 21V10h14v11"/><path d="M9 10V6h6v4"/>',
  regras: '<path d="M4 6h16M4 12h10M4 18h6"/><circle cx="18" cy="16" r="3"/>',
  catalogo: '<path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z"/>',
  ajustes: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  mais: '<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>',
  add: '<path d="M12 5v14M5 12h14"/>',
  check: '<path d="M5 12l5 5L20 7"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  back: '<path d="M15 18l-6-6 6-6"/>',
  print: '<path d="M6 9V3h12v6"/><rect x="4" y="9" width="16" height="8" rx="2"/><path d="M7 14h10v7H7z"/>',
  copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>',
  upload: '<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v4h16v-4"/>',
  box: '<path d="M21 8l-9-5-9 5 9 5 9-5z"/><path d="M3 8v8l9 5 9-5V8"/>',
  truck: '<path d="M3 6h11v10H3zM14 10h4l3 3v3h-7z"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>',
  undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>',
  alerta: '<path d="M12 3l10 18H2L12 3z"/><path d="M12 10v5M12 18v.5"/>',
  busca: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M5 7l1 13h12l1-13M9 7V4h6v3"/>',
  sair: '<path d="M15 4h4v16h-4"/><path d="M10 8l-4 4 4 4M6 12h10"/>',
  nuvem: '<path d="M7 18a5 5 0 0 1-.5-10A6 6 0 0 1 18 9a4.5 4.5 0 0 1-.5 9z"/>',
  equipe: '<circle cx="9" cy="8" r="3.5"/><path d="M2 20c0-3.5 3-6 7-6s7 2.5 7 6"/><circle cx="17.5" cy="9" r="2.5"/><path d="M17 14c3 0 5 2 5 5"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
  chev: '<path d="M9 6l6 6-6 6"/>',
  sol: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  lua: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
  painel: '<rect x="3" y="4" width="18" height="12" rx="1.5"/><path d="M9 4v12M15 4v12M3 10h18M8 20h8M12 16v4"/>',
  fixar: '<path d="M9 3h6l-1 6 4 4H6l4-4-1-6z"/><path d="M12 13v8"/>',
  refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7M20 5v6h-6"/>',
  cheia: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  cheia_sair: '<path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/>'
};
export const ico = (n, cls) => `<svg class="ico ${cls || ''}" viewBox="0 0 24 24" aria-hidden="true">${I[n] || ''}</svg>`;

/* ---------------- tema claro / escuro (vale para este aparelho) ---------------- */
export function temaEscolhido() { try { return localStorage.getItem('led-tema') || 'escuro'; } catch (e) { return 'escuro'; } }
export function temaEfetivo() {
  const t = temaEscolhido();
  if (t !== 'auto') return t;
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'claro' : 'escuro';
}
export function aplicarTema(t) {
  try { localStorage.setItem('led-tema', t); } catch (e) { /* modo privado: vale só nesta visita */ }
  document.documentElement.dataset.tema = t;
  const m = document.querySelector('meta[name="theme-color"]');
  if (m) m.setAttribute('content', temaEfetivo() === 'claro' ? '#f2f4f9' : '#0b1020');
}

/* ---------------- toast, modal, confirmação ---------------- */
let raiz = null;
export function definirRaiz(el) { raiz = el; }

export function toast(msg, { acao, onAcao, tempo = 3800, tipo } = {}) {
  const host = raiz.querySelector('.toasts');
  const t = document.createElement('div');
  t.className = 'toast ' + (tipo || '');
  t.innerHTML = `<span>${esc(msg)}</span>${acao ? `<button class="toast-acao">${esc(acao)}</button>` : ''}`;
  host.appendChild(t);
  let fim = setTimeout(() => t.remove(), tempo);
  if (acao) t.querySelector('.toast-acao').onclick = () => { clearTimeout(fim); t.remove(); onAcao && onAcao(); };
  return () => { clearTimeout(fim); t.remove(); };
}

/* Modal genérico: devolve uma Promise que resolve com o valor do botão (ou null ao fechar). */
export function modal({ titulo, corpo, botoes = [{ txt: 'OK', valor: true, cls: 'pri' }], aoAbrir, largo }) {
  return new Promise(resolve => {
    const fundo = document.createElement('div');
    fundo.className = 'modal-fundo';
    fundo.innerHTML = `<div class="modal ${largo ? 'largo' : ''}" role="dialog" aria-modal="true">
      <div class="modal-topo"><h3>${esc(titulo || '')}</h3><button class="icon-btn fechar" aria-label="Fechar">${ico('x')}</button></div>
      <div class="modal-corpo">${corpo || ''}</div>
      <div class="modal-pe">${botoes.map((b, i) => `<button class="btn ${b.cls || ''}" data-i="${i}">${esc(b.txt)}</button>`).join('')}</div>
    </div>`;
    raiz.appendChild(fundo);
    const el = fundo.querySelector('.modal');
    const fechar = v => { fundo.remove(); document.removeEventListener('keydown', tecla); resolve(v); };
    const tecla = e => { if (e.key === 'Escape') fechar(null); };
    document.addEventListener('keydown', tecla);
    fundo.addEventListener('click', e => { if (e.target === fundo) fechar(null); });
    el.querySelector('.fechar').onclick = () => fechar(null);
    el.querySelectorAll('.modal-pe .btn').forEach(b => {
      b.onclick = async () => {
        const def = botoes[+b.dataset.i];
        if (def.validar) { const ok = await def.validar(el); if (!ok) return; }
        fechar(typeof def.valor === 'function' ? def.valor(el) : def.valor);
      };
    });
    if (aoAbrir) aoAbrir(el, fechar);
    const foco = el.querySelector('[autofocus]') || el.querySelector('input,select,textarea');
    if (foco) setTimeout(() => foco.focus(), 30);
  });
}

export function confirmar(titulo, texto, { sim = 'Confirmar', perigo } = {}) {
  return modal({
    titulo, corpo: `<p class="modal-txt">${texto}</p>`,
    botoes: [{ txt: 'Cancelar', valor: false }, { txt: sim, valor: true, cls: perigo ? 'danger' : 'pri' }]
  });
}

export function pedirTexto(titulo, { rotulo = '', valor = '', obrigatorio, multilinha, dica } = {}) {
  return modal({
    titulo,
    corpo: `<label class="campo"><span>${esc(rotulo)}</span>${multilinha
      ? `<textarea rows="4" autofocus>${esc(valor)}</textarea>` : `<input type="text" value="${esc(valor)}" autofocus>`}</label>${dica ? `<p class="dica">${dica}</p>` : ''}`,
    botoes: [{ txt: 'Cancelar', valor: null }, {
      txt: 'Salvar', cls: 'pri',
      validar: el => { const v = el.querySelector('input,textarea').value.trim(); if (obrigatorio && !v) { el.querySelector('input,textarea').classList.add('erro'); return false; } return true; },
      valor: el => el.querySelector('input,textarea').value.trim()
    }],
    aoAbrir: el => { const i = el.querySelector('input'); if (i) i.addEventListener('keydown', e => { if (e.key === 'Enter') el.querySelector('.modal-pe .pri').click(); }); }
  });
}

/* Teclado numérico grande (parcial na separação, retorno, quantidade). */
export function pedirNumero(titulo, { valor = '', rotulo = '', max, dica } = {}) {
  return modal({
    titulo,
    corpo: `<label class="campo grande"><span>${esc(rotulo)}</span><input type="text" inputmode="decimal" value="${esc(valor)}" autofocus></label>
      ${max != null ? `<div class="atalhos"><button type="button" class="btn sm" data-v="0">0</button><button type="button" class="btn sm" data-v="${max}">Tudo (${num(max)})</button></div>` : ''}
      ${dica ? `<p class="dica">${dica}</p>` : ''}`,
    botoes: [{ txt: 'Cancelar', valor: null }, {
      txt: 'OK', cls: 'pri',
      validar: el => { const v = lerNum(el.querySelector('input').value); if (v == null || v < 0) { el.querySelector('input').classList.add('erro'); return false; } return true; },
      valor: el => lerNum(el.querySelector('input').value)
    }],
    aoAbrir: el => {
      const i = el.querySelector('input');
      i.select();
      i.addEventListener('keydown', e => { if (e.key === 'Enter') el.querySelector('.modal-pe .pri').click(); });
      el.querySelectorAll('.atalhos [data-v]').forEach(b => { b.onclick = () => { i.value = b.dataset.v; el.querySelector('.modal-pe .pri').click(); }; });
    }
  });
}

/* Busca de item do catálogo (lista rolável filtrada enquanto digita). */
export function escolherItem(catalogo, { titulo = 'Escolher item', excluir, soAtivos = true, categorias } = {}) {
  const itens = catalogo.filter(c => (!soAtivos || c.ativo !== false) && (!excluir || !excluir.has(c.id)))
    .sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
  return modal({
    titulo,
    corpo: `<input type="search" class="busca-item" placeholder="Digite parte do nome…" autofocus>
      <div class="lista-escolha">${itens.map(c => `<button class="escolha" data-id="${esc(c.id)}"><b>${esc(c.nome)}</b><small>${esc((categorias && categorias[c.cat]) || c.cat)}${c.qtd != null ? ' · estoque ' + num(c.qtd) : ''}</small></button>`).join('')}</div>`,
    botoes: [{ txt: 'Cancelar', valor: null }],
    aoAbrir: (el, fechar) => {
      const q = el.querySelector('.busca-item');
      const norm = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
      q.addEventListener('input', () => {
        const t = norm(q.value).split(/\s+/).filter(Boolean);
        el.querySelectorAll('.escolha').forEach(b => { const n = norm(b.textContent); b.hidden = !t.every(p => n.includes(p)); });
      });
      el.querySelectorAll('.escolha').forEach(b => { b.onclick = () => fechar(b.dataset.id); });
    }
  });
}

export function baixarArquivo(nome, conteudo, tipo = 'application/json') {
  const blob = conteudo instanceof Blob ? conteudo : new Blob([conteudo], { type: tipo });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

export function barra(pct, cor) {
  return `<div class="barra ${cor || ''}"><i style="width:${Math.max(0, Math.min(100, pct))}%"></i></div>`;
}
