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

const folhaVista = new Map(); // lista → folha mostrada

const NOME_CTRL = { 'send-660': 'MCTRL660', 'taurus-tb60': 'Taurus TB60', 'taurus-tb1': 'Taurus TB1' };
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
      <label class="campo"><span>Controladora</span>${sel('controladora', [['auto', 'MCTRL660'], ['taurus-tb60', 'Taurus TB60'], ['taurus-tb1', 'Taurus TB1'], ['nenhuma', 'Nenhuma']], cfg.controladora)}</label>
      <label class="campo"><span>Cabo de dados</span>${sel('backup', [['0', '1 por porta'], ['1', '2 por porta (backup)']], cfg.backup ? '1' : '0')}</label>
    </div>
    <div class="res">${res}</div>
  </div>`;
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
  const doProjeto = new Set(['pc-10m', 'rj-20m', 'regua-pc', 'rack-9', 'rack-12', 'rack-5', 'camlock-150', 'send-660', 'taurus-tb1', 'taurus-tb60', 'usb-ab', 'prol-media', 'prol-longa', 'mf-192', 'mf-144', 'mf-096', 'peso']);
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

  <div class="card"><h2>Folhas <span class="conta">${folhas.length}</span>
      <span class="dir">${folhas.map((f, i) => `<button class="btn sm folha-tab ${i === fi ? 'on' : ''}" data-i="${i}">${String(i + 1).padStart(2, '0')} · ${NOME_FOLHA[f.tipo]}</button>`).join(' ')}</span></h2>
    ${folhas.length ? `<div class="proj-prev pj-folha">${svgDaFolha(ctx, lista, folhas[fi])}</div>` : '<p class="muted">Ponha uma tela com painel e medida (L × A) — o desenho aparece aqui.</p>'}
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
      <label class="campo"><span>Processadora</span><input data-sc="processadora" data-k="pj-proc" value="${B.esc(sc.processadora || '')}" placeholder="Ex.: VX1000 (aparece na folha)" ${pode ? '' : 'disabled'}></label>
      <label class="campo"><span>Folha do PDF</span>${sel('folha', Object.entries(FORMATOS).map(([k, F]) => [k, F.nome]), formatoDaLista(lista))}</label>
      <label class="campo"><span>Folhas</span>${sel('folhas', [['auto', 'Automático'], ['separadas', 'AC e Sinal separadas'], ['juntas', 'Uma folha só (AC e Sinal)']], sc.folhas)}</label>
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
  el.querySelectorAll('.ir-lista').forEach(b => { b.onclick = () => ctx.ir('lista/' + id); });
  el.querySelector('.exportar').onclick = async () => {
    try {
      const n = await exportarProjeto(ctx, lista);
      await ctx.D.registrar('projeto', `exportou o projeto ${B.nomeLista(lista)} (${n} folha${n === 1 ? '' : 's'})`, lista.id);
    } catch (e) { B.toast(e.message, { tipo: 'erro' }); }
  };
  el.querySelectorAll('.folha-tab').forEach(b => { b.onclick = () => { folhaVista.set(id, +b.dataset.i); ctx.atualizar(); }; });

  const pode = editavel(lista) && ctx.pode('listas');
  // a lista acompanha o projeto: sem nada separado, recalcula sozinha (regras novas, catálogo)
  const plano = planoDeRecalculo(ctx, lista);
  if (pode && !plano.temSep && plano.diff.length) { recalcularLista(ctx, lista).then(() => ctx.atualizar()); return; }
  if (!pode) { el.querySelectorAll('input,select').forEach(i => { i.disabled = true; }); return; }

  const salvar = async (campos, { recalc = true } = {}) => {
    Object.assign(lista, campos);
    await ctx.D.salvar('listas', lista, { silencioso: true });
    if (recalc) {
      const r = await recalcularLista(ctx, lista);
      if (r.pendente) B.toast('A separação já começou: confira as mudanças na lista (aviso amarelo).');
    }
    ctx.atualizar();
  };
  el.querySelectorAll('[data-lc]').forEach(inp => inp.addEventListener('change', () => salvar({ [inp.dataset.lc]: inp.value.trim() }, { recalc: false })));

  // sala
  el.querySelectorAll('[data-sc]').forEach(inp => inp.addEventListener('change', () => {
    const campo = inp.dataset.sc;
    let val = inp.value;
    if (campo === 'reguas_rack') { val = B.lerNum(val); if (!(val >= 1)) { inp.classList.add('erro'); return; } }
    salvar({ projeto: Object.assign({}, lista.projeto || {}, { [campo]: campo === 'processadora' ? val.trim() : val }) }, { recalc: campo !== 'processadora' && campo !== 'folhas' && campo !== 'folha' });
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
