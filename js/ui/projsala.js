/* Tela: Projeto da sala — começar pelo projeto.
 *
 * As telas da sala lado a lado (esquerda → direita, como na folha), o cabeamento de AC (circuitos, réguas,
 * racks da sala) e de sinal (portas, controladoras, processadora). A lista desta sala é a mesma coisa vista
 * de outro jeito: tudo o que muda aqui muda a lista na hora, e o que muda na lista (telas, medida) muda o
 * desenho. Projeto e lista são o mesmo registro (a lista e as telas dela). */
import { novaTela } from './listas.js';
import { abrir3D } from './tres.js';
import { folhasDaLista, svgDaFolha, exportarProjeto, NOME_FOLHA, FORMATOS, formatoDaLista } from './projeto.js';
import { planoDeRecalculo, recalcularLista, editavel } from './lista.js';
import { htmlMontagem, ligarMontagem } from './montagem.js';
import * as Cab from '../cabeamento.js';

const folhaVista = new Map(); // lista → folha mostrada

const NOME_CTRL = { 'send-660': 'MCTRL660', 'taurus-tb60': 'Taurus TB60', 'taurus-tb1': 'Taurus TB1', 'cvt10': 'CVT10', 'cvt4k-s': 'CVT4K-S' };
const pl1 = (n, s, p) => n + ' ' + (n === 1 ? s : p);

function telaHtml(ctx, lista, t, i, n, it, pode, leds) {
  const { B } = ctx;
  const ro = pode ? '' : 'disabled';
  const v = x => (x == null ? '' : String(x).replace('.', ','));
  const k = s => `pj-${t.id}-${s}`;
  const cfg = ctx.M.configProjeto(t);
  const modo = t.modo || 'medida';
  const sel = (campo, ops, atual) => `<select data-pc="${campo}" ${ro}>${ops.map(([val, txt]) => `<option value="${val}" ${String(val) === String(atual) ? 'selected' : ''}>${txt}</option>`).join('')}</select>`;
  const medida = modo === 'medida'
    ? `<label class="campo"><span>Largura (m)</span><input inputmode="decimal" data-tc="largura_m" data-k="${k('l')}" value="${v(t.largura_m)}" ${ro}></label>
       <label class="campo"><span>Altura (m)</span><input inputmode="decimal" data-tc="altura_m" data-k="${k('a')}" value="${v(t.altura_m)}" ${ro}></label>`
    : modo === 'grade'
      ? `<label class="campo"><span>Colunas</span><input inputmode="numeric" data-tc="colunas" data-k="${k('c')}" value="${v(t.colunas)}" ${ro}></label>
       <label class="campo"><span>Linhas</span><input inputmode="numeric" data-tc="linhas" data-k="${k('li')}" value="${v(t.linhas)}" ${ro}></label>`
      : `<div class="campo"><span>Medida</span><div class="peq amarelo" style="padding-top:8px">em ${modo === 'm2' ? 'm²' : 'gabinetes'}: sem desenho — <button class="link para-medida">passar para L × A</button></div></div>`;
  let res = '<span class="mut2">Informe painel e medida.</span>';
  if (it && it.pl) {
    const d = it.pl.dados, e = it.pl.energia;
    res = `<span>${it.pl.colunas} × ${it.pl.linhas} = <b>${it.g.gabinetes} gab</b></span>
      <span><b>${pl1(d.portas.length, 'porta', 'portas')}</b> ${d.modo === 'cheia' ? '(enchendo a porta)' : `(${d.sentido === 'horizontal' ? pl1(d.linhas_por_porta, 'fileira', 'fileiras') : pl1(d.linhas_por_porta, 'coluna', 'colunas')} · ${d.sentido})`}</span>
      <span>${pl1(e.circuitos.length, 'circuito', 'circuitos')}</span><span>${pl1(e.reguas.length, 'régua', 'réguas')}</span>
      <span>${it.ctrl.item ? (it.ctrl.qtd > 1 ? it.ctrl.qtd + ' × ' : '') + NOME_CTRL[it.ctrl.item] : 'sem controladora'}</span>
      <span>${B.num(it.g.potencia_max_w / 1000, 1)} kW</span>
      ${d.coluna_excede ? '<span class="amarelo">uma coluna sozinha passa do limite da porta</span>' : ''}
      ${d.sentido_trocado ? '<span class="amarelo">na horizontal não cabe: ficou vertical</span>' : ''}`;
  } else if (it) res = `<span><b>${it.g.gabinetes} gab</b></span><span>${pl1(it.portas, 'porta', 'portas')} (estimado)</span>`;
  const pal = t.palco || {};
  const chao = (t.montagem || 'chao') === 'chao';
  return `<div class="tela pj-tela" data-t="${B.esc(t.id)}">
    <div class="linha-flex" style="margin-bottom:10px">
      <span class="pj-ordem">${i + 1}</span>
      <input class="inp cresce" data-tc="nome" data-k="${k('n')}" placeholder="Nome (ex.: Lateral esq., Central)" value="${B.esc(t.nome || '')}" ${ro}>
      ${pode ? `<button class="icon-btn sm mv" data-d="-1" title="Mais para a esquerda" ${i === 0 ? 'disabled' : ''}>‹</button><button class="icon-btn sm mv" data-d="1" title="Mais para a direita" ${i === n - 1 ? 'disabled' : ''}>›</button>` : ''}
      ${it && it.pl ? `<button class="icon-btn sm ver-3d" title="Ver em 3D">${B.ico('painel')}</button>` : ''}
      ${pode ? `<button class="icon-btn sm rm-tela" title="Tirar esta tela">${B.ico('trash')}</button>` : ''}
    </div>
    <div class="grade g4 m1">
      <label class="campo"><span>Painel</span><select data-tc="painel" ${ro} class="${t.painel ? '' : 'erro'}">${t.painel ? '' : '<option value="" selected>— escolher —</option>'}${leds.map(c => `<option value="${B.esc(c.id)}" ${c.id === t.painel ? 'selected' : ''}>${B.esc(c.nome.replace('Case de Led ', ''))}</option>`).join('')}</select></label>
      ${medida}
      <label class="campo"><span>Montagem</span><select data-tc="montagem" ${ro}>${Object.entries(B.MONTAGEM).map(([kk, vv]) => `<option value="${kk}" ${kk === (t.montagem || 'chao') ? 'selected' : ''}>${vv}</option>`).join('')}</select></label>
    </div>
    ${chao ? `<div class="linha-flex peq" style="margin:8px 0 2px;gap:12px;flex-wrap:wrap">
      <label class="linha-flex"><input type="checkbox" data-pal="sobre" ${pal.sobre ? 'checked' : ''} ${ro} style="width:18px;height:18px"> Em cima do palco</label>
      ${pal.sobre ? `<label class="linha-flex">altura <input class="inp curto" inputmode="decimal" data-pal="altura_m" data-k="${k('pa')}" value="${v(pal.altura_m)}" placeholder="0,60" ${ro}> m</label>
        <label class="linha-flex">mão francesa <select data-pal="mf" ${ro}><option value="chao">no chão, atrás</option><option value="palco" ${pal.mf === 'palco' ? 'selected' : ''}>no palco</option></select></label>` : ''}
    </div>` : ''}
    <div class="grade g4 m1" style="margin-top:8px">
      <label class="campo"><span>Sinal</span>${sel('sentido', [['auto', 'Automático'], ['vertical', 'Vertical (colunas)'], ['horizontal', 'Horizontal (fileiras)']], cfg.sentido)}</label>
      <label class="campo"><span>Começa</span>${sel('inicio', [['inf-esq', 'Embaixo, esq.'], ['inf-dir', 'Embaixo, dir.'], ['sup-esq', 'Em cima, esq.'], ['sup-dir', 'Em cima, dir.']], cfg.inicio)}</label>
      <label class="campo"><span>Cada porta</span>${sel('portas', [['colunas', 'Linhas inteiras'], ['cheia', 'Enche a porta']], cfg.portas)}</label>
      <label class="campo"><span>Controladora</span>${sel('controladora', [['auto', 'MCTRL660'], ['taurus-tb60', 'Taurus TB60'], ['taurus-tb1', 'Taurus TB1'], ['cvt10', 'CVT10 (fibra da H)'], ['cvt4k-s', 'CVT4K-S (fibra da H)'], ['nenhuma', 'Nenhuma']], cfg.controladora)}</label>
      <label class="campo"><span>Cabo de dados</span>${sel('backup', [['0', '1 por porta'], ['1', '2 por porta (redundância)']], cfg.backup ? '1' : '0')}</label>
    </div>
    <div class="res">${res}</div>
  </div>`;
}

/* ================= Prancha editável =================
 * Na prévia da folha dá para mexer em tudo — vem no padrão, e o que a pessoa muda fica gravado na sala:
 *  - arrastar telas, racks, controladoras/CVT e a processadora (projeto.layout[folha][chave], frações da área);
 *  - ligar um cabo: arrastar a bolinha verde da porta até uma controladora/CVT; tocar na porta para trocar a
 *    controladora/saída, levar a tela toda, ou desligar (porta "solta", em vermelho);
 *  - pôr aparelho novo (+ CVT4K-S…), trocar o tipo ou tirar (tocando nele);
 *  - tocar num texto (título, nomes, carimbo) para escrever por cima (projeto.textos[chave]; vazio = padrão);
 *  - Desfazer / Refazer (também Ctrl+Z / Ctrl+Y). */
const selPrancha = new Map();   // lista → o que está selecionado na prancha { tipo, chave, id }
const historico = new Map();    // lista → { antes: [estado…], depois: [estado…] } (estado = projeto + telas)
const estadoMostrado = new Map(); // lista → o estado que está na tela agora (vira o "antes" da próxima mudança)
let areaTransf = null;          // o que foi copiado na prancha (aparelho ou tela) — dá para colar em outra sala
let atalhoPrancha = null;       // { id, voltar, copiar, colar, cortar, apagar, temSel } da prancha aberta
/* Tela cheia do editor da montagem (mt) ou da prancha (pj): o cartão ocupa a tela toda e o navegador entra em
 * tela cheia (some a barra do navegador). Esc ou o botão "Sair" voltam. Sair da página do projeto também. */
function telaCheia(qual) {
  const cl = document.body.classList, ja = cl.contains('cheio-' + qual);
  cl.remove('cheio-mt', 'cheio-pj');
  if (!ja) {
    cl.add('cheio-' + qual);
    const raiz = document.documentElement;
    if (raiz.requestFullscreen && !document.fullscreenElement) raiz.requestFullscreen().catch(() => {});
  } else if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {});
}
document.addEventListener('fullscreenchange', () => {
  if (!document.fullscreenElement && /cheio-(mt|pj)/.test(document.body.className)) { document.body.classList.remove('cheio-mt', 'cheio-pj'); window.dispatchEvent(new HashChangeEvent('hashchange')); }
});
window.addEventListener('hashchange', () => {
  if (!/^#\/projeto\//.test(location.hash) && /cheio-(mt|pj)/.test(document.body.className)) {
    document.body.classList.remove('cheio-mt', 'cheio-pj');
    if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {});
  }
});
document.addEventListener('keydown', e => {
  // sem a tela cheia do navegador (celular), o Esc também sai
  if (e.key === 'Escape' && !document.fullscreenElement && /cheio-(mt|pj)/.test(document.body.className) && !document.querySelector('.modal')) {
    document.body.classList.remove('cheio-mt', 'cheio-pj');
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  }
});

const fotoDa = lista => JSON.stringify({ projeto: lista.projeto || {}, telas: lista.telas || [] });
/* guarda o estado de antes da mudança (toda mudança da tela do projeto passa aqui: campos, editor e prancha) */
function guardarHistorico(id) {
  const h = historico.get(id) || { antes: [], depois: [] }, antes = estadoMostrado.get(id);
  historico.set(id, h);
  if (antes == null || h.antes[h.antes.length - 1] === antes) return;
  h.antes.push(antes);
  if (h.antes.length > 60) h.antes.shift();
  h.depois.length = 0;
}
document.addEventListener('keydown', e => {
  const A = atalhoPrancha;
  if (!A || location.hash !== '#/projeto/' + A.id) return;
  const alvo = e.target, digitando = alvo && (/^(INPUT|TEXTAREA|SELECT)$/.test(alvo.tagName) || alvo.isContentEditable);
  if (digitando || document.querySelector('.modal-fundo, .modal')) return;   // nos campos e janelas, o normal do navegador
  const k = e.key.toLowerCase(), ctrl = e.ctrlKey || e.metaKey;
  const textoMarcado = String(window.getSelection && window.getSelection()).trim() !== '';
  if (ctrl && (k === 'z' || k === 'y')) { e.preventDefault(); return A.voltar(k === 'y' || e.shiftKey ? 'refazer' : 'desfazer'); }
  if (ctrl && k === 'c' && A.temSel() && !textoMarcado) { e.preventDefault(); return A.copiar(); }
  if (ctrl && k === 'x' && A.temSel() && !textoMarcado) { e.preventDefault(); return A.cortar(); }
  if (ctrl && k === 'v' && areaTransf) { e.preventDefault(); return A.colar(); }
  if (!ctrl && (k === 'delete' || k === 'backspace') && A.temSel()) { e.preventDefault(); return A.apagar(); }
  if (!ctrl && k === 'escape' && A.temSel()) { e.preventDefault(); return A.limparSel(); }
});

/* a montagem de processamento como a pessoa vê agora (a sugestão automática vira dela, com ids novos) */
function processamentoEditavel(ctx, ps) {
  const ids = new Map(), novo = id => { if (!ids.has(id)) ids.set(id, /^auto-/.test(id) ? ctx.novoId() : id); return ids.get(id); };
  // sugerida: veio da sugestão do sistema (some sozinha se ficar sem cabo); a que a pessoa pôs fica
  const ctrls = ps.processamento.ctrls.map(c => Object.assign({ id: novo(c.id), tipo: c.tipo }, !c.manual || c.sugerida ? { sugerida: true } : {}));
  const ligacoes = {};
  ps.processamento.ctrls.forEach(c => c.saidas.forEach((p, i) => { if (p && !p.estimada) ligacoes[p.chave] = { ctrl: novo(c.id), saida: i + 1 }; }));
  for (const p of ps.processamento.soltas || []) ligacoes[p.chave] = { solta: true };
  return { pr: { ctrls, ligacoes }, novo };
}
const saidaLivre = (pr, ctrlId, cap, menos) => { for (let i = 1; i <= cap; i++) if (!Object.entries(pr.ligacoes).some(([k, l]) => k !== menos && l.ctrl === ctrlId && l.saida === i)) return i; return null; };

/* o painel do que está selecionado (porta, controladora ou nada) */
function selecaoHtml(ctx, ps, sel) {
  const { B, M } = ctx;
  if (!sel) return '';
  const nomeTela = ti => (ps.telas[ti] && ps.telas[ti].nome) || 'Tela';
  const C = M.CONTROLADORAS, lista = ps.processamento.ctrls;
  const fechar = `<button class="icon-btn sm pj-sel-x" title="Fechar" aria-label="Fechar">${B.ico('x')}</button>`;
  if (sel.tipo === 'porta') {
    const p = ps.processamento.portas.find(q => q.chave === sel.chave);
    if (!p) return '';
    const c = lista.find(q => q.saidas.some(x => x && x.chave === sel.chave));
    const k = c ? c.saidas.findIndex(x => x && x.chave === sel.chave) : -1;
    const solta = (ps.processamento.soltas || []).some(q => q.chave === sel.chave);
    const opC = lista.map(q => `<option value="${B.esc(q.id)}" ${c && q.id === c.id ? 'selected' : ''}>${C[q.tipo].nome} ${q.n} · ${q.usadas}/${C[q.tipo].portas}</option>`).join('')
      + `<option value="__solta" ${solta ? 'selected' : ''}>— solta (sem ligação) —</option>`
      + Object.entries(C).map(([t, X]) => `<option value="__nova:${t}">+ Nova ${X.nome}</option>`).join('');
    const cap = c ? C[c.tipo].portas : 0;
    const opS = c ? Array.from({ length: cap }, (_, i) => { const q = c.saidas[i]; return `<option value="${i + 1}" ${i === k ? 'selected' : ''}>Saída ${i + 1}${q && q.chave !== sel.chave ? ' — ' + B.esc(nomeTela(q.ti)) + ' cabo ' + q.n : ''}</option>`; }).join('') : '';
    return `<div class="pj-sel"><div class="pj-sel-t"><b>Cabo ${p.n} · ${B.esc(nomeTela(p.ti))}</b> <span class="mut2">${solta ? 'solto, sem ligação' : c ? 'ligado em ' + C[c.tipo].nome + ' ' + c.n + ', saída ' + (k + 1) : ''}</span>${fechar}</div>
      <div class="grade g3 m1"><label class="campo"><span>Ligado em</span><select data-ps="ctrl">${opC}</select></label>
      ${c ? `<label class="campo"><span>Saída</span><select data-ps="saida">${opS}</select></label>` : '<div></div>'}
      <div class="pj-sel-b">${c ? `<button class="btn sm pj-tela-toda">Toda a ${B.esc(nomeTela(p.ti))} aqui</button>` : ''}${solta ? '' : '<button class="btn sm pj-soltar">Desligar</button>'}</div></div></div>`;
  }
  if (sel.tipo === 'tela') {
    const it = ps.telas.find(x => x.tela && 'tela:' + x.tela.id === sel.chave);
    if (!it) return '';
    return `<div class="pj-sel"><div class="pj-sel-t"><b>${B.esc(it.nome || 'Tela')}</b> <span class="mut2">${it.pl ? B.num(it.pl.largura_m) + ' × ' + B.num(it.pl.altura_m) + ' m' : ''} · Ctrl+C / Ctrl+V duplica · Delete tira</span>${fechar}</div>
      <div class="pj-sel-b"><button class="btn sm pj-tela-dup">Duplicar</button><button class="btn sm pj-tela-tirar">Tirar da sala</button></div></div>`;
  }
  if (sel.tipo === 'ctrl') {
    const c = lista.find(q => q.id === sel.id);
    if (!c) return '';
    const X = C[c.tipo];
    return `<div class="pj-sel"><div class="pj-sel-t"><b>${X.nome} ${c.n}</b> <span class="mut2">${c.usadas} de ${X.portas} saídas</span>${fechar}</div>
      <div class="grade g3 m1"><label class="campo"><span>Tipo</span><select data-ps="tipo">${Object.entries(C).map(([t, Y]) => `<option value="${t}" ${t === c.tipo ? 'selected' : ''}>${Y.nome} (${Y.portas} saídas)</option>`).join('')}</select></label>
      <div class="pj-sel-b"><button class="btn sm pj-ctrl-soltar">Desligar os cabos dela</button><button class="btn sm pj-ctrl-tirar">Tirar</button></div></div></div>`;
  }
  return '';
}

function ligarPrancha(el, ctx, lista, id) {
  const { B, M } = ctx;
  const caixa = el.querySelector('.pj-folha.pode');
  const hist = historico.get(id) || { antes: [], depois: [] };
  historico.set(id, hist);
  // grava a sala (com histórico); recalc quando a mudança mexe na lista (ligações, telas)
  const gravar = async (projeto, { recalc = false, sel, telas } = {}) => {
    guardarHistorico(id);
    if (sel !== undefined) { if (sel) selPrancha.set(id, sel); else selPrancha.delete(id); }
    lista.projeto = projeto;
    if (telas) lista.telas = telas;
    await ctx.D.salvar('listas', lista, { silencioso: true });
    if (recalc) { const r = await recalcularLista(ctx, lista); if (r && r.pendente) B.toast('A separação já começou: confira as mudanças na lista (aviso amarelo).'); }
    ctx.atualizar();
  };
  const voltar = async qual => {
    const de = qual === 'desfazer' ? hist.antes : hist.depois, para = qual === 'desfazer' ? hist.depois : hist.antes;
    if (!de.length) return B.toast(qual === 'desfazer' ? 'Nada para desfazer.' : 'Nada para refazer.');
    para.push(fotoDa(lista));
    const e = JSON.parse(de.pop());
    lista.projeto = e.projeto;
    lista.telas = e.telas;
    selPrancha.delete(id);
    await ctx.D.salvar('listas', lista, { silencioso: true });
    await recalcularLista(ctx, lista);
    ctx.atualizar();
  };
  const bt = (q, fn) => { const b = el.querySelector(q); if (b) b.onclick = fn; };
  bt('.pj-desf', () => voltar('desfazer'));
  bt('.pj-ref', () => voltar('refazer'));
  atalhoPrancha = { id, voltar, temSel: () => false };   // sem prancha: só Ctrl+Z / Ctrl+Y
  if (!caixa) return;

  const fs0 = folhasDaLista(ctx, lista, { hoje: ctx.hoje() });
  const fi = Math.min(folhaVista.get(id) || 0, Math.max(0, fs0.length - 1)), folha = fs0[fi];
  if (!folha) return;
  const psAgora = () => M.planoSala(lista.telas || [], ctx.catIdx(), lista.projeto);
  const proj = extra => Object.assign({}, lista.projeto || {}, extra);
  // muda as ligações: a sugestão vira montagem da pessoa; os lugares e rótulos arrastados vão junto
  const mudarProc = (fn, sel) => {
    const ps = psAgora(), { pr, novo } = processamentoEditavel(ctx, ps);
    if (fn(pr, novo) === false) return;
    // a controladora que o sistema tinha sugerido e ficou sem cabo sai sozinha (a que a pessoa pôs fica)
    pr.ctrls = pr.ctrls.filter(c => !c.sugerida || Object.values(pr.ligacoes).some(l => l.ctrl === c.id));
    const layout = Cab.layoutRenomeado(ps, novo, (lista.projeto || {}).layout), textos = Cab.textosRenomeados(ps, novo, (lista.projeto || {}).textos);
    return gravar(proj({ processamento: pr, layout, textos }), { recalc: true, sel: typeof sel === 'function' ? sel(novo) : sel });
  };
  const ligar = (chavePorta, ctrlId) => mudarProc((pr, novo) => {
    const cid = novo(ctrlId), c = pr.ctrls.find(q => q.id === cid);
    if (!c) return false;
    const atual = pr.ligacoes[chavePorta];
    if (atual && atual.ctrl === cid) return false;
    const saida = saidaLivre(pr, cid, M.CONTROLADORAS[c.tipo].portas, chavePorta);
    if (saida == null) { B.toast('Essa controladora está com as saídas cheias.'); return false; }
    pr.ligacoes[chavePorta] = { ctrl: cid, saida };
  }, { tipo: 'porta', chave: chavePorta });

  // ---- arrastar (telas e aparelhos), ligar cabo (porta → controladora), tocar (selecionar / editar texto) ----
  const paraFolha = e => { const svg = caixa.querySelector('svg'), p = svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY; return p.matrixTransform(svg.getScreenCTM().inverse()); };
  // o projeto com o arrasto aplicado (sempre a partir do projeto de quando começou a arrastar)
  const projetoArrastado = (a, p) => {
    const pj = JSON.parse(JSON.stringify(a.proj0)), F = folha.formato, A = folha.area;
    pj.layout = Object.assign({}, pj.layout);
    const L0 = pj.layout[folha.tipo] = Object.assign({}, pj.layout[folha.tipo]);
    if (a.tipo === 'texto') {
      const d0 = L0['txt:' + a.chave] || {};
      L0['txt:' + a.chave] = { dx: +((+d0.dx || 0) + p.x - a.p0.x).toFixed(2), dy: +((+d0.dy || 0) + p.y - a.p0.y).toFixed(2) };
    } else if (a.tipo === 'nota' || a.tipo === 'seta') {
      const n = (pj.notas || []).find(q => q.id === a.id);
      if (n && a.tipo === 'nota') { n.fx = +(((+n.fx || 0) * F.w + p.x - a.p0.x) / F.w).toFixed(4); n.fy = +(((+n.fy || 0) * F.h + p.y - a.p0.y) / F.h).toFixed(4); }
      if (n && a.tipo === 'seta') n.seta = { fx: +(p.x / F.w).toFixed(4), fy: +(p.y / F.h).toFixed(4) };
    } else L0[a.chave] = { fx: +((p.x - a.dx - A.x) / A.w).toFixed(4), fy: +((p.y - a.dy - A.y) / A.h).toFixed(4) };
    return pj;
  };
  let arr = null, quadro = 0;
  caixa.addEventListener('pointerdown', e => {
    const alvo = e.target.closest('[data-alvo]');
    if (!alvo || e.button > 0) return;
    const x = +alvo.getAttribute('x'), y = +alvo.getAttribute('y'), w = +alvo.getAttribute('width'), h = +alvo.getAttribute('height');
    const p = paraFolha(e);
    arr = { tipo: alvo.dataset.tipo, chave: alvo.dataset.alvo, id: alvo.dataset.id, fixo: alvo.dataset.fixo === '1', p0: p, dx: p.x - (x + w / 2), dy: p.y - y, cx: x + w / 2, cy: y + h / 2, mexeu: false,
      proj0: JSON.parse(JSON.stringify(lista.projeto || {})) };
    caixa.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  caixa.addEventListener('pointermove', e => {
    if (!arr) return;
    const p = paraFolha(e);
    if (!arr.mexeu && Math.hypot(p.x - arr.p0.x, p.y - arr.p0.y) < 1.2) return;
    arr.mexeu = true;
    caixa.classList.add('arrastando');
    if (arr.tipo === 'texto' && arr.fixo) return;
    if (arr.tipo === 'porta') {
      // o cabo novo seguindo o dedo; a controladora embaixo acende
      const svg = caixa.querySelector('svg');
      let fio = svg.querySelector('.pj-fio');
      if (!fio) { fio = document.createElementNS('http://www.w3.org/2000/svg', 'line'); fio.setAttribute('class', 'pj-fio'); svg.appendChild(fio); }
      fio.setAttribute('x1', arr.cx); fio.setAttribute('y1', arr.cy); fio.setAttribute('x2', p.x); fio.setAttribute('y2', p.y);
      const sob = document.elementFromPoint(e.clientX, e.clientY), alvo = sob && sob.closest && sob.closest('[data-tipo="ctrl"]');
      svg.querySelectorAll('.pj-alvo.on').forEach(a => { if (a !== alvo) a.classList.remove('on'); });
      if (alvo) alvo.classList.add('on');
      return;
    }
    arr.novo = projetoArrastado(arr, p);
    if (!quadro) quadro = requestAnimationFrame(() => {
      quadro = 0;
      if (!arr || arr.tipo === 'porta' || !arr.novo) return;
      const tmp = Object.assign({}, lista, { projeto: arr.novo }), f = folhasDaLista(ctx, tmp, { hoje: ctx.hoje() })[fi];
      if (f) caixa.innerHTML = svgDaFolha(ctx, tmp, f, { alvos: true, sel: selPrancha.get(id) });
    });
  });
  const soltar = async e => {
    if (!arr) return;
    const a = arr;
    arr = null;
    caixa.classList.remove('arrastando');
    if (!a.mexeu) {
      // tocar: texto → escrever por cima; porta/controladora → selecionar
      if (a.tipo === 'texto') return editarTexto(a.chave);
      if (a.tipo === 'nota' || a.tipo === 'seta') return editarNota(a.id);
      if (a.tipo === 'porta' || a.tipo === 'ctrl' || a.tipo === 'tela') { selPrancha.set(id, { tipo: a.tipo, chave: a.chave, id: a.id }); return ctx.atualizar(); }
      return;
    }
    if (a.tipo === 'texto' && a.fixo) return;
    if (a.tipo === 'porta') {
      const fio = caixa.querySelector('.pj-fio');
      if (fio) fio.remove();
      const sob = e && document.elementFromPoint(e.clientX, e.clientY), alvo = sob && sob.closest && sob.closest('[data-tipo="ctrl"]');
      if (alvo) return ligar(a.chave, alvo.dataset.id);
      return ctx.atualizar();
    }
    return a.novo ? gravar(a.novo) : ctx.atualizar();
  };
  caixa.addEventListener('pointerup', soltar);
  caixa.addEventListener('pointercancel', () => soltar(null));

  // ---- textos livres (com seta, se quiser) ----
  const editarNota = async nid => {
    const notas = JSON.parse(JSON.stringify((lista.projeto || {}).notas || [])), n = notas.find(q => q.id === nid);
    if (!n) return;
    const v = await B.modal({
      titulo: 'Texto na folha',
      corpo: `<label class="campo"><span>Texto</span><textarea class="f-nota" rows="3">${B.esc(n.txt || '')}</textarea></label>
        <div class="grade g3 m1" style="margin-top:8px">
          <label class="campo"><span>Cor</span><select class="f-cor">${[['vermelho', 'Vermelho'], ['preto', 'Preto'], ['azul', 'Azul']].map(([k, t]) => `<option value="${k}" ${(n.cor || 'vermelho') === k ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
          <label class="campo"><span>Tamanho</span><select class="f-tam">${[[6, 'Pequeno'], [8, 'Médio'], [11, 'Grande'], [16, 'Bem grande']].map(([k, t]) => `<option value="${k}" ${(+n.tam || 8) === k ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
          <label class="linha-flex" style="align-self:end;padding-bottom:8px"><input type="checkbox" class="f-seta" ${n.seta ? 'checked' : ''} style="width:18px;height:18px"> Com seta</label>
        </div><p class="dica" style="margin:6px 0 0">Enter quebra a linha. Arraste o texto (e a ponta da seta) na folha para pôr no lugar.</p>`,
      aoAbrir: m => { const t = m.querySelector('.f-nota'); t.focus(); t.select(); },
      botoes: [{ txt: 'Apagar', valor: '__apagar' }, { txt: 'Cancelar', valor: null },
        { txt: 'Salvar', cls: 'pri', valor: m => ({ txt: m.querySelector('.f-nota').value.replace(/\s+$/, ''), cor: m.querySelector('.f-cor').value, tam: +m.querySelector('.f-tam').value, seta: m.querySelector('.f-seta').checked }) }]
    });
    if (v == null) return;
    if (v === '__apagar' || !v.txt.trim()) return gravar(proj({ notas: notas.filter(q => q.id !== nid) }));
    Object.assign(n, { txt: v.txt, cor: v.cor, tam: v.tam });
    if (v.seta && !n.seta) n.seta = { fx: Math.min(0.95, (+n.fx || 0) + 0.12), fy: Math.min(0.9, (+n.fy || 0) + 0.1) };
    if (!v.seta) n.seta = null;
    return gravar(proj({ notas }));
  };
  bt('.pj-nota-nova', async () => {
    const A = folha.area, F = folha.formato, nid = ctx.novoId();
    const notas = ((lista.projeto || {}).notas || []).concat([{ id: nid, folha: folha.tipo, txt: 'Texto novo', fx: +((A.x + A.w * 0.08) / F.w).toFixed(4), fy: +((A.y + A.h * 0.1) / F.h).toFixed(4), cor: 'vermelho', tam: 8, seta: null }]);
    await gravar(proj({ notas }));
    editarNota(nid);
  });
  el.querySelectorAll('.pj-zoom').forEach(b => { b.onclick = () => {
    const passos = [0.4, 0.5, 0.6, 0.75, 0.9, 1, 1.15, 1.3, 1.5, 1.75, 2, 2.5, 3];
    const lay = Object.assign({}, (lista.projeto || {}).layout), L0 = Object.assign({}, lay[folha.tipo]), z = +L0.zoom || 1;
    const i = passos.findIndex(p => p >= z - 1e-6), j = Math.max(0, Math.min(passos.length - 1, (i < 0 ? passos.length - 1 : i) + (+b.dataset.z)));
    L0.zoom = passos[j];
    if (L0.zoom === 1) delete L0.zoom;
    lay[folha.tipo] = L0;
    return gravar(proj({ layout: lay }));
  }; });

  // ---- textos: escrever por cima (vazio = volta ao padrão) ----
  const editarTexto = async chave => {
    const a = (folha.alvos || []).find(x => x.tipo === 'texto' && x.chave === chave);
    if (!a) return;
    const v = await B.modal({
      titulo: a.nome || 'Texto da prancha',
      corpo: `<label class="campo"><span>Texto na folha</span><input class="f-txt" value="${B.esc(a.valor || '')}"></label>
        <p class="dica" style="margin:6px 0 0">Padrão: <b>${B.esc(a.padrao || '—')}</b>. Deixe vazio para voltar ao padrão. Vale para todas as folhas desta sala.</p>`,
      aoAbrir: m => { const i = m.querySelector('.f-txt'); i.focus(); i.select(); },
      botoes: [{ txt: 'Padrão', valor: '' }, { txt: 'Cancelar', valor: null }, { txt: 'Salvar', cls: 'pri', valor: m => m.querySelector('.f-txt').value.trim() }]
    });
    if (v == null) return;
    const textos = Object.assign({}, (lista.projeto || {}).textos || {});
    if (v === '' || v === a.padrao) delete textos[chave]; else textos[chave] = v;
    return gravar(proj({ textos }));
  };

  // ---- barra: aparelho novo, lugares/ligações automáticas ----
  el.querySelectorAll('.pj-novo').forEach(b => { b.onclick = () => {
    const nid = ctx.novoId();
    mudarProc(pr => { pr.ctrls.push({ id: nid, tipo: b.dataset.tipo }); }, { tipo: 'ctrl', id: nid });
    B.toast('Aparelho posto na folha: arraste as bolinhas verdes das portas até ele.');
  }; });
  bt('.pj-lay-auto', () => { const lay = Object.assign({}, (lista.projeto || {}).layout || {}); delete lay[folha.tipo]; return gravar(proj({ layout: lay })); });
  bt('.pj-lig-auto', () => gravar(proj({ processamento: null }), { recalc: true, sel: null }));
  bt('.pj-txt-auto', () => gravar(proj({ textos: {} })));

  // ---- painel da seleção ----
  const sel = selPrancha.get(id);
  bt('.pj-sel-x', () => { selPrancha.delete(id); ctx.atualizar(); });
  el.querySelectorAll('[data-ps]').forEach(inp => inp.addEventListener('change', () => {
    const v = inp.value, q = inp.dataset.ps;
    if (q === 'ctrl' && sel) {
      if (v === '__solta') return mudarProc(pr => { pr.ligacoes[sel.chave] = { solta: true }; }, sel);
      if (v.startsWith('__nova:')) {
        const nid = ctx.novoId();
        return mudarProc(pr => { pr.ctrls.push({ id: nid, tipo: v.slice(7) }); pr.ligacoes[sel.chave] = { ctrl: nid, saida: 1 }; }, sel);
      }
      return ligar(sel.chave, v);
    }
    if (q === 'saida' && sel) return mudarProc(pr => {
      const atual = pr.ligacoes[sel.chave];
      if (!atual || atual.solta) return false;
      const nova = +v, outra = Object.keys(pr.ligacoes).find(k => k !== sel.chave && pr.ligacoes[k].ctrl === atual.ctrl && pr.ligacoes[k].saida === nova);
      if (outra) pr.ligacoes[outra] = { ctrl: atual.ctrl, saida: atual.saida };   // troca de lugar com o cabo que estava lá
      pr.ligacoes[sel.chave] = { ctrl: atual.ctrl, saida: nova };
    }, sel);
    if (q === 'tipo' && sel) return mudarProc((pr, novo) => {
      const cid = novo(sel.id), c = pr.ctrls.find(x => x.id === cid);
      if (!c) return false;
      c.tipo = v;
      const cap = M.CONTROLADORAS[v].portas;
      for (const [k, l] of Object.entries(pr.ligacoes)) if (l.ctrl === cid && l.saida > cap) pr.ligacoes[k] = { solta: true };   // não cabe: fica solto
    }, novo => ({ tipo: 'ctrl', id: novo(sel.id) }));
  }));
  bt('.pj-soltar', () => sel && mudarProc(pr => { pr.ligacoes[sel.chave] = { solta: true }; }, sel));
  bt('.pj-tela-toda', () => sel && mudarProc(pr => {
    const atual = pr.ligacoes[sel.chave];
    if (!atual || atual.solta) return false;
    const c = pr.ctrls.find(x => x.id === atual.ctrl), cap = M.CONTROLADORAS[c.tipo].portas;
    const ti = sel.chave.slice(0, sel.chave.lastIndexOf(':'));
    const daTela = psAgora().processamento.portas.filter(p => p.chave.slice(0, p.chave.lastIndexOf(':')) === ti && !p.estimada);
    let faltou = 0;
    for (const p of daTela) {
      const l = pr.ligacoes[p.chave];
      if (l && l.ctrl === c.id) continue;
      const s = saidaLivre(pr, c.id, cap, p.chave);
      if (s == null) { faltou++; continue; }
      pr.ligacoes[p.chave] = { ctrl: c.id, saida: s };
    }
    if (faltou) B.toast(`Não coube tudo: ${faltou} cabo${faltou === 1 ? '' : 's'} ficou${faltou === 1 ? '' : 'ram'} onde estava${faltou === 1 ? '' : 'm'}.`);
  }, sel));
  bt('.pj-ctrl-soltar', () => sel && mudarProc((pr, novo) => {
    const cid = novo(sel.id);
    for (const [k, l] of Object.entries(pr.ligacoes)) if (l.ctrl === cid) pr.ligacoes[k] = { solta: true };
  }, novo => ({ tipo: 'ctrl', id: novo(sel.id) })));
  const tirarCtrl = () => sel && mudarProc((pr, novo) => {
    const cid = novo(sel.id);
    pr.ctrls = pr.ctrls.filter(c => c.id !== cid);
    for (const [k, l] of Object.entries(pr.ligacoes)) if (l.ctrl === cid) pr.ligacoes[k] = { solta: true };
  }, null);
  bt('.pj-ctrl-tirar', tirarCtrl);

  // ---- telas: duplicar e tirar (também Ctrl+C / Ctrl+V e Delete) ----
  const idTela = chave => String(chave || '').replace(/^tela:/, '');
  const colarTela = modelo => {
    const ps = psAgora(), pos = Cab.posicoesDaSala(ps), telas = JSON.parse(JSON.stringify(lista.telas || []));
    let fim = 0;
    for (const it of ps.telas) if (it.pl) {
      const t = telas.find(x => x.id === it.tela.id);
      if (t && !t.pos) t.pos = { x: +pos.get(it).toFixed(2) };
      fim = Math.max(fim, pos.get(it) + it.pl.largura_m);
    }
    const c = JSON.parse(JSON.stringify(modelo));
    c.id = ctx.novoId(); c.nome = (modelo.nome || 'Tela') + ' (cópia)'; delete c.calc_uid;
    c.pos = { x: +(fim + 1).toFixed(2) };
    telas.push(c);
    return gravar(proj({}), { recalc: true, telas, sel: { tipo: 'tela', chave: 'tela:' + c.id } });
  };
  const tirarTela = chave => {
    const tid = idTela(chave), t = (lista.telas || []).find(x => x.id === tid);
    if (!t) return;
    B.toast(`${t.nome || 'Tela'} saiu da sala — Ctrl+Z desfaz.`);
    return gravar(proj({}), { recalc: true, telas: lista.telas.filter(x => x.id !== tid), sel: null });
  };
  bt('.pj-tela-dup', () => { const t = sel && (lista.telas || []).find(x => x.id === idTela(sel.chave)); if (t) colarTela(t); });
  bt('.pj-tela-tirar', () => sel && tirarTela(sel.chave));

  const copiar = () => {
    const sAtual = selPrancha.get(id);
    if (!sAtual) return;
    if (sAtual.tipo === 'ctrl') {
      const c = psAgora().processamento.ctrls.find(q => q.id === sAtual.id);
      if (!c) return;
      areaTransf = { tipo: 'ctrl', ctrlTipo: c.tipo };
      return B.toast(`${M.CONTROLADORAS[c.tipo].nome} copiada — Ctrl+V põe outra igual.`);
    }
    if (sAtual.tipo === 'tela') {
      const t = (lista.telas || []).find(x => x.id === idTela(sAtual.chave));
      if (!t) return;
      areaTransf = { tipo: 'tela', tela: JSON.parse(JSON.stringify(t)) };
      return B.toast(`${t.nome || 'Tela'} copiada — Ctrl+V cola uma igual (nesta ou noutra sala).`);
    }
    B.toast('Selecione uma tela ou um aparelho para copiar.');
  };
  const colar = () => {
    if (!areaTransf) return;
    if (areaTransf.tipo === 'tela') return colarTela(areaTransf.tela);
    const nid = ctx.novoId();
    return mudarProc(pr => { pr.ctrls.push({ id: nid, tipo: areaTransf.ctrlTipo }); }, { tipo: 'ctrl', id: nid });
  };
  const apagar = () => {
    const sAtual = selPrancha.get(id);
    if (!sAtual) return;
    if (sAtual.tipo === 'ctrl') return tirarCtrl();
    if (sAtual.tipo === 'tela') return tirarTela(sAtual.chave);
    if (sAtual.tipo === 'porta') return mudarProc(pr => { pr.ligacoes[sAtual.chave] = { solta: true }; }, sAtual);
  };
  atalhoPrancha = {
    id, voltar, copiar, colar, apagar,
    cortar: () => { copiar(); return apagar(); },
    temSel: () => !!selPrancha.get(id),
    limparSel: () => { selPrancha.delete(id); ctx.atualizar(); }
  };
}

export function render(ctx, [id]) {
  const { B, M } = ctx;
  const lista = ctx.lista(id);
  if (!lista) return `<button class="voltar" data-ir="listas">${B.ico('back')} Listas</button><div class="card vazio">Sala não encontrada (pode ter sido excluída).</div>`;
  const pode = editavel(lista) && ctx.pode('listas');
  const ps = M.planoSala(lista.telas || [], ctx.catIdx(), lista.projeto);
  const porTela = new Map(ps.telas.map(it => [it.tela.id, it]));
  const folhas = folhasDaLista(ctx, lista, { hoje: ctx.hoje() });
  const fi = Math.min(folhaVista.get(id) || 0, Math.max(0, folhas.length - 1));
  const leds = ctx.est.catalogo.filter(c => c.cat === 'led' && (c.ativo !== false || (lista.telas || []).some(t => t.painel === c.id)));
  const telas = lista.telas || [];
  const sc = Object.assign({}, M.SALA_PADRAO, lista.projeto || {});
  const t0 = ps.telas[0];
  const cfg0 = t0 ? t0.cfg : M.PROJETO_PADRAO;
  const sel = (campo, ops, atual) => `<select data-sc="${campo}" ${pode ? '' : 'disabled'}>${ops.map(([val, txt]) => `<option value="${val}" ${String(val) === String(atual) ? 'selected' : ''}>${txt}</option>`).join('')}</select>`;
  const v = x => (x == null ? '' : String(x).replace('.', ','));

  // o que o projeto põe na lista (e o resto da lista desta sala)
  const cat = ctx.catIdx();
  const ativas = ctx.linhasDa(id).filter(M.linhaAtiva)
    .sort((a, b) => ctx.ORDEM_CAT.indexOf((cat.get(a.item) || {}).cat) - ctx.ORDEM_CAT.indexOf((cat.get(b.item) || {}).cat) || ((cat.get(a.item) || {}).ordem || 0) - ((cat.get(b.item) || {}).ordem || 0));
  const doProjeto = new Set(['pc-10m', 'rj-20m', 'regua-pc', 'rack-9', 'rack-12', 'rack-5', 'camlock-150', 'send-660', 'taurus-tb1', 'taurus-tb60', 'cvt10', 'cvt4k-s', 'usb-ab', 'prol-media', 'prol-longa', 'mf-192', 'mf-144', 'mf-096', 'peso']);
  const ctrls = Object.entries(ps.controladoras).map(([c, q]) => q + ' × ' + NOME_CTRL[c]).join(' + ');
  const racksTxt = ps.racks.length ? pl1(ps.racks.length, 'rack', 'racks') + ' de ' + [...new Set(ps.racks.map(r => M.RACKS[r.tipo]))].join('/') + ' saídas' : 'sem rack';

  return `
  <button class="voltar" data-ir="${lista.grupo ? 'evento/' + B.esc(lista.grupo) : 'listas'}">${B.ico('back')} ${lista.grupo ? 'Evento: ' + B.esc(lista.evento || 'sem nome') : 'Listas'}</button>
  <div class="cab"><div class="cresce"><h1><span class="sala-tag">PROJETO</span>${B.esc(lista.sala || B.nomeLista(lista))}</h1>
    <div class="sub">${lista.grupo || lista.sala ? B.esc(lista.evento || '') + ' · ' : ''}${lista.os ? 'OS ' + B.esc(lista.os) + ' · ' : ''}${B.pillStatus(lista.status)}</div></div>
    <div class="acoes"><button class="btn ir-lista">${B.ico('listas')} Lista desta sala</button><button class="btn pri exportar">${B.ico('print')} Exportar PDF</button></div></div>

  ${pode ? `<details class="card" ${lista.sala && lista.evento ? '' : 'open'}><summary class="h2" style="cursor:pointer;list-style:none">Sala e evento <span class="dir peq mut2" style="text-transform:none;letter-spacing:0">${B.esc([lista.sala, lista.evento, lista.os ? 'OS ' + lista.os : ''].filter(Boolean).join(' · ') || 'sem nome')} ▾</span></summary>
    <div class="grade g3 m1" style="margin-top:12px">
      <label class="campo"><span>Sala / local</span><input data-lc="sala" data-k="pj-sala" value="${B.esc(lista.sala || '')}" placeholder="Ex.: Plenária, Foyer"></label>
      <label class="campo"><span>Evento</span><input data-lc="evento" data-k="pj-ev" value="${B.esc(lista.evento || '')}"></label>
      <label class="campo"><span>OS</span><input data-lc="os" data-k="pj-os" value="${B.esc(lista.os || '')}"></label>
    </div><p class="dica">Data, cliente e local ficam na lista desta sala.</p></details>` : ''}

  ${htmlMontagem(ctx, lista, ps, pode)}

  <div class="card pj-folhas"><h2>Folhas do PDF <span class="conta">${folhas.length}</span>
      <span class="dir">${folhas.length ? (() => { const on = document.body.classList.contains('cheio-pj'); return `<button class="btn sm tela-cheia-btn" data-cheio="pj" title="${on ? 'Sair da tela cheia (Esc)' : 'Tela cheia'}">${B.ico(on ? 'cheia_sair' : 'cheia')} ${on ? 'Sair' : 'Tela cheia'}</button> `; })() : ''}${folhas.map((f, i) => `<button class="btn sm folha-tab ${i === fi ? 'on' : ''}" data-i="${i}">${String(i + 1).padStart(2, '0')} · ${NOME_FOLHA[f.tipo]}${f.partes > 1 ? ' ' + f.parte : ''}</button>`).join(' ')}</span></h2>
    ${pode && folhas.length ? (() => {
      const f = folhas[fi], h = historico.get(id) || { antes: [], depois: [] }, pj = lista.projeto || {};
      const temLay = Object.keys((pj.layout || {})[f.tipo] || {}).length, temTxt = Object.keys(pj.textos || {}).length, temLig = !!(pj.processamento && pj.processamento.ctrls);
      return `<div class="pj-barra">
        ${f.tipo === 'sinal' || f.tipo === 'ambos' ? `<span class="peq mut2">Pôr:</span>${Object.entries(M.CONTROLADORAS).map(([t, C]) => `<button class="btn sm pj-novo" data-tipo="${t}">+ ${C.nome}</button>`).join('')}` : ''}
        ${f.tipo !== 'lista' ? '<button class="btn sm pj-nota-nova" title="Acrescentar um texto (com seta, se quiser) nesta folha">+ Texto</button>' : '<span class="peq mut2">A lista sai do jeito que está na aba Lista da sala.</span>'}
        ${f.tipo !== 'titulo' && f.tipo !== 'lista' ? `<span class="pj-zoom-g"><button class="btn sm pj-zoom" data-z="-1" title="Desenho menor">−</button><span class="peq mut2">Desenho ${Math.round((+((pj.layout || {})[f.tipo] || {}).zoom || 1) * 100)}%</span><button class="btn sm pj-zoom" data-z="1" title="Desenho maior">+</button></span>` : ''}
        <span class="cresce"></span>
        <button class="btn sm pj-desf" ${h.antes.length ? '' : 'disabled'} title="Desfazer (Ctrl+Z)">↶ Desfazer</button>
        <button class="btn sm pj-ref" ${h.depois.length ? '' : 'disabled'} title="Refazer (Ctrl+Y)">↷ Refazer</button></div>`
        + `<div class="proj-prev pj-folha pode">${svgDaFolha(ctx, lista, f, { alvos: true, sel: selPrancha.get(id) })}</div>`
        + selecaoHtml(ctx, ps, selPrancha.get(id))
        + (f.tipo === 'lista' ? '' : `<div class="pj-arraste peq mut2">${B.ico('info')} <span class="cresce">Arraste telas, aparelhos e textos para mudar o lugar · bolinha verde da porta até uma controladora/CVT liga o cabo · toque num texto para escrever por cima · + Texto acrescenta um texto (com seta).</span>
          ${temLay ? '<button class="btn sm pj-lay-auto">Lugares automáticos</button>' : ''}${temLig ? '<button class="btn sm pj-lig-auto">Ligações automáticas</button>' : ''}${temTxt ? '<button class="btn sm pj-txt-auto">Textos padrão</button>' : ''}</div>`);
    })() : folhas.length ? `<div class="proj-prev pj-folha">${svgDaFolha(ctx, lista, folhas[fi])}</div>` : '<p class="muted">Ponha uma tela com painel e medida (L × A) — o desenho aparece aqui.</p>'}
    <div class="pj-resumo">
      <span><b>${pl1(ps.portas, 'porta', 'portas')}</b></span><span><b>${pl1(ps.circuitos, 'circuito', 'circuitos')}</b></span>
      <span><b>${pl1(ps.reguas, 'régua', 'réguas')}</b></span><span><b>${racksTxt}</b>${ps.racks.length && sc.racks !== 'tela' && ps.telas.length > 1 ? ' (da sala)' : ''}</span>
      ${ctrls ? `<span><b>${ctrls}</b></span>` : ''}<span>${B.num(ps.w_total / 1000, 1)} kW máx</span>
    </div>
  </div>

  <div class="card"><h2>Telas da sala <span class="conta">${telas.length}</span><span class="dir peq mut2">na ordem da folha: esquerda → direita</span></h2>
    ${telas.map((t, i) => telaHtml(ctx, lista, t, i, telas.length, porTela.get(t.id), pode, leds)).join('') || '<p class="muted">Nenhuma tela ainda.</p>'}
    ${pode ? `<button class="btn add-tela">${B.ico('add')} Adicionar tela</button>` : ''}
  </div>

  <details class="card" ${telas.length > 1 ? 'open' : ''}><summary class="h2" style="cursor:pointer;list-style:none">Energia e processamento da sala <span class="dir peq mut2" style="text-transform:none;letter-spacing:0">▾</span></summary>
    <div class="grade g3 m1" style="margin-top:12px">
      <label class="campo"><span>Racks</span>${sel('racks', [['sala', 'Divididos na sala inteira'], ['tela', 'Um (ou mais) por tela']], sc.racks)}</label>
      <label class="campo"><span>Rack</span>${sel('rack', Object.entries(M.RACKS).map(([r, s]) => [r, s + ' saídas']), sc.rack || cfg0.rack)}</label>
      <label class="campo"><span>Réguas por rack</span><input inputmode="numeric" data-sc="reguas_rack" data-k="pj-rr" value="${v(sc.reguas_rack || cfg0.reguas_rack)}" ${pode ? '' : 'disabled'}></label>
      <label class="campo"><span>Limite por régua (kW)</span><input inputmode="decimal" data-todas="kw_regua" data-k="pj-kr" value="${v(cfg0.kw_regua)}" ${pode ? '' : 'disabled'}></label>
      <label class="campo"><span>Limite por circuito (kW)</span><input inputmode="decimal" data-todas="kw_circuito" data-k="pj-kc" value="${v(cfg0.kw_circuito)}" ${pode ? '' : 'disabled'}></label>
      <label class="campo"><span>Processadora</span><select data-sc="processadora" ${pode ? '' : 'disabled'}>${[['', '— sem processadora —'], ['H2', 'Novastar H2'], ['H5', 'Novastar H5'], ['H9', 'Novastar H9'], ['H15', 'Novastar H15']]
        .concat(sc.processadora && !['H2', 'H5', 'H9', 'H15'].includes(sc.processadora) ? [[sc.processadora, sc.processadora + ' (escrita antes)']] : [])
        .map(([val, txt]) => `<option value="${B.esc(val)}" ${val === (sc.processadora || '') ? 'selected' : ''}>${B.esc(txt)}</option>`).join('')}</select></label>
      <label class="campo"><span>Folha do PDF</span>${sel('folha', Object.entries(FORMATOS).map(([k, F]) => [k, F.nome]), formatoDaLista(lista))}</label>
      <label class="campo"><span>Folhas</span>${sel('folhas', [['auto', 'Automático'], ['separadas', 'AC e Sinal separadas'], ['juntas', 'Uma folha só (AC e Sinal)']], sc.folhas)}</label>
      <label class="campo"><span>Folha de título</span>${sel('capa', [['1', 'Com (nome da sala)'], ['0', 'Sem']], sc.capa === '0' ? '0' : '1')}</label>
      <label class="campo"><span>Lista no fim do PDF</span>${sel('listas_pdf', [['1', 'Com (para imprimir)'], ['0', 'Sem']], sc.listas_pdf === '0' ? '0' : '1')}</label>
    </div>
    <p class="dica">Cada bloco de porta é um circuito de powercon (dividido se passar do limite por circuito) e desce até uma régua; a régua junta circuitos até o limite dela; as réguas da sala inteira são repartidas nos racks. O PDF sai na prancha do Projetech Calculator (A3, 16:9 ou A4), com o desenho do projeto da Syngenta: folha de AC (réguas e rack de energia) e folha de Sinal (controladoras e processadora); no automático, sala com 1 tela e 1 régua sai numa folha só.</p>
  </details>

  <div class="card"><h2>A lista desta sala <span class="conta">${ativas.length}</span><span class="dir"><button class="btn sm ir-lista">Abrir a lista ${B.ico('chev')}</button></span></h2>
    <p class="dica" style="margin-top:0">Montada sozinha com este projeto. Em negrito, o que vem do desenho (cabos, réguas, racks, controladoras, estrutura).</p>
    ${ativas.length ? `<div class="pj-itens">${ativas.map(l => `<div class="${doProjeto.has(l.item) ? 'proj' : ''}"><span class="num">${B.num(l.qtd)}</span> ${B.esc(ctx.nomeItem(l.item))}${l.travado ? ' <span class="mut2" title="quantidade fixada à mão">🔒</span>' : ''}</div>`).join('')}</div>` : '<p class="muted">Os itens aparecem quando houver uma tela com medida.</p>'}
  </div>`;
}

export function ligar(el, ctx, [id]) {
  const { B, M } = ctx;
  el.querySelectorAll('[data-ir]').forEach(b => { b.onclick = () => ctx.ir(b.dataset.ir); });
  const lista = ctx.lista(id);
  if (!lista) return;
  estadoMostrado.set(id, fotoDa(lista));
  el.querySelectorAll('.tela-cheia-btn').forEach(b => { b.onclick = () => { telaCheia(b.dataset.cheio); ctx.atualizar(); }; });
  el.querySelectorAll('.ir-lista').forEach(b => { b.onclick = () => ctx.ir('lista/' + id); });
  el.querySelector('.exportar').onclick = async () => {
    try {
      const n = await exportarProjeto(ctx, lista);
      await ctx.D.registrar('projeto', `exportou o projeto ${B.nomeLista(lista)} (${n} folha${n === 1 ? '' : 's'})`, lista.id);
    } catch (e) { B.toast(e.message, { tipo: 'erro' }); }
  };
  el.querySelectorAll('.folha-tab').forEach(b => { b.onclick = () => { folhaVista.set(id, +b.dataset.i); ctx.atualizar(); }; });
  ligarPrancha(el, ctx, lista, id);

  const pode = editavel(lista) && ctx.pode('listas');
  // a lista acompanha o projeto: sem nada separado, recalcula sozinha (regras novas, catálogo)
  const plano = planoDeRecalculo(ctx, lista);
  if (pode && !plano.temSep && plano.diff.length) { recalcularLista(ctx, lista).then(() => ctx.atualizar()); return; }
  const psAgora = () => M.planoSala(lista.telas || [], ctx.catIdx(), lista.projeto);
  if (!pode) { ligarMontagem(el, ctx, lista, psAgora(), null, false); el.querySelectorAll('input,select').forEach(i => { i.disabled = true; }); return; }

  const salvar = async (campos, { recalc = true } = {}) => {
    guardarHistorico(id);
    Object.assign(lista, campos);
    await ctx.D.salvar('listas', lista, { silencioso: true });
    if (recalc) {
      const r = await recalcularLista(ctx, lista);
      if (r.pendente) B.toast('A separação já começou: confira as mudanças na lista (aviso amarelo).');
    }
    ctx.atualizar();
  };
  el.querySelectorAll('[data-lc]').forEach(inp => inp.addEventListener('change', () => salvar({ [inp.dataset.lc]: inp.value.trim() }, { recalc: false })));

  // a montagem da sala (Painéis e Sinal): o editor grava pela mesma porta
  ligarMontagem(el, ctx, lista, psAgora(), salvar, true);

  // sala
  el.querySelectorAll('[data-sc]').forEach(inp => inp.addEventListener('change', () => {
    const campo = inp.dataset.sc;
    let val = inp.value;
    if (campo === 'reguas_rack') { val = B.lerNum(val); if (!(val >= 1)) { inp.classList.add('erro'); return; } }
    salvar({ projeto: Object.assign({}, lista.projeto || {}, { [campo]: campo === 'processadora' ? val.trim() : val }) }, { recalc: !['processadora', 'folhas', 'folha', 'capa', 'listas_pdf'].includes(campo) });
  }));
  el.querySelectorAll('[data-todas]').forEach(inp => inp.addEventListener('change', () => {
    const val = B.lerNum(inp.value);
    if (!(val > 0)) { inp.classList.add('erro'); return; }
    for (const t of lista.telas || []) t.projeto = Object.assign({}, t.projeto || {}, { [inp.dataset.todas]: val });
    salvar({ telas: lista.telas });
  }));

  // telas
  el.querySelectorAll('.pj-tela[data-t]').forEach(box => {
    const i = (lista.telas || []).findIndex(x => x.id === box.dataset.t);
    const t = lista.telas[i];
    if (!t) return;
    box.querySelectorAll('[data-tc]').forEach(inp => inp.addEventListener('change', () => {
      const campo = inp.dataset.tc;
      t[campo] = ['nome', 'painel', 'montagem'].includes(campo) ? inp.value : B.lerNum(inp.value);
      salvar({ telas: lista.telas }, { recalc: campo !== 'nome' });
    }));
    box.querySelectorAll('[data-pc]').forEach(inp => inp.addEventListener('change', () => {
      const campo = inp.dataset.pc;
      t.projeto = Object.assign({}, t.projeto || {}, { [campo]: campo === 'backup' ? inp.value === '1' : inp.value });
      salvar({ telas: lista.telas });
    }));
    box.querySelectorAll('[data-pal]').forEach(inp => inp.addEventListener('change', () => {
      const campo = inp.dataset.pal;
      let val = inp.type === 'checkbox' ? inp.checked : inp.value;
      if (campo === 'altura_m') { val = B.lerNum(val); if (val != null && !(val >= 0 && val < 10)) { inp.classList.add('erro'); return; } }
      t.palco = Object.assign({ sobre: false, altura_m: null, fundo_m: null, mf: 'chao' }, t.palco || {}, { [campo]: val });
      salvar({ telas: lista.telas });
    }));
    box.querySelectorAll('.mv').forEach(b => { b.onclick = () => {
      const j = i + +b.dataset.d;
      if (j < 0 || j >= lista.telas.length) return;
      const ts = lista.telas.slice(); [ts[i], ts[j]] = [ts[j], ts[i]];
      salvar({ telas: ts });
    }; });
    const pm = box.querySelector('.para-medida');
    if (pm) pm.onclick = () => {
      const c = ctx.item(t.painel);
      const g = c && c.painel ? M.geometria(t, c.painel) : null;
      t.modo = 'medida';
      if (g && g.gabinetes && !t.largura_m) { const lado = Math.ceil(Math.sqrt(g.gabinetes)); t.largura_m = +(lado * (c.painel.larg_m || 0.5)).toFixed(2); t.altura_m = +(Math.ceil(g.gabinetes / lado) * (c.painel.alt_m || 0.5)).toFixed(2); }
      salvar({ telas: lista.telas });
    };
    const v3 = box.querySelector('.ver-3d');
    if (v3) v3.onclick = () => abrir3D(ctx, lista, t);
    const rm = box.querySelector('.rm-tela');
    if (rm) rm.onclick = async () => {
      if (!(await B.confirmar('Tirar esta tela?', 'Os itens que vieram só dela saem da lista.', { sim: 'Tirar', perigo: true }))) return;
      salvar({ telas: lista.telas.filter(x => x.id !== t.id) });
    };
  });
  const add = el.querySelector('.add-tela');
  if (add) add.onclick = () => salvar({ telas: (lista.telas || []).concat([novaTela(ctx)]) }, { recalc: false });
}
