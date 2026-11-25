/* Tela: montar a lista de um evento — telas (painéis) em cima, itens sugeridos embaixo. */
import { novaTela } from './listas.js';
import { imprimirLista } from './imprimir.js';
import { novaSala } from './evento.js';
import { HISTORICO } from '../historico.js';
import { desenhoTela, svg as svgProjeto, folhasDaLista, primsDaFolha, exportarProjeto, FOLHA } from './projeto.js';

const abertos = new Set();   // "por quê?" abertos
const abertosProj = new Set(); // telas com o projeto aberto

/* Seção "Projeto" de uma tela: ajustes do cabeamento de sinal e de energia + prévia do desenho. */
function projetoHtml(ctx, t, pode) {
  const { B, M } = ctx;
  const c = ctx.item(t.painel);
  const pl = c && c.painel ? M.planoProjeto(t, c.painel) : null;
  const cfg = M.configProjeto(t);
  const ro = pode ? '' : 'disabled';
  const k = s => `p-${t.id}-${s}`;
  const pl1 = (n, s, p) => n + ' ' + (n === 1 ? s : p);
  const resumo = pl
    ? `${pl1(pl.dados.portas.length, 'porta', 'portas')} (${pl.dados.modo === 'cheia' ? 'até ' + pl1(pl.dados.gab_por_porta, 'placa', 'placas') : pl1(pl.dados.cols_por_porta, 'coluna', 'colunas')} cada) · ${pl1(pl.energia.reguas.length, 'régua', 'réguas')} · ${pl1(pl.energia.racks.length, 'rack', 'racks')} de ${M.RACKS[cfg.rack] || 9} saídas`
    : 'o desenho precisa de largura × altura ou colunas × linhas';
  const inicio = [['inf-esq', 'Embaixo, esq.'], ['inf-dir', 'Embaixo, dir.'], ['sup-esq', 'Em cima, esq.'], ['sup-dir', 'Em cima, dir.']];
  return `<details class="projeto-tela" ${abertosProj.has(t.id) ? 'open' : ''}>
    <summary>${B.ico('painel')} <b>Projeto</b> <span class="peq muted">${resumo}</span></summary>
    ${pl ? `<div class="proj-prev">${svgProjeto(desenhoTela(pl, { x: 0, y: 0, w: 380, h: 150 }), { x: -2, y: -2, w: 384, h: 156 })}</div>` : ''}
    <div class="grade g3" style="margin-top:10px">
      <label class="campo"><span>Sinal começa</span><select data-pc="inicio" ${ro}>${inicio.map(([v, tx]) => `<option value="${v}" ${v === cfg.inicio ? 'selected' : ''}>${tx}</option>`).join('')}</select></label>
      <label class="campo"><span>Cada porta pega</span><select data-pc="portas" ${ro}>
        <option value="colunas">Colunas inteiras</option>
        <option value="cheia" ${cfg.portas === 'cheia' ? 'selected' : ''}>O máximo de placas (quebra coluna)</option></select></label>
      <label class="campo"><span>Cabo de dados</span><select data-pc="backup" ${ro}><option value="0">1 por porta</option><option value="1" ${cfg.backup ? 'selected' : ''}>2 por porta (backup)</option></select></label>
      <label class="campo"><span>Processadora</span><input data-pc="processadora" data-k="${k('proc')}" value="${B.esc(cfg.processadora || '')}" placeholder="Ex.: H5 (etiqueta)" ${ro}></label>
      <label class="campo"><span>Limite por régua (kW)</span><input inputmode="decimal" data-pc="kw_regua" data-k="${k('kw')}" value="${String(cfg.kw_regua).replace('.', ',')}" ${ro}></label>
      <label class="campo"><span>Réguas por rack</span><input inputmode="numeric" data-pc="reguas_rack" data-k="${k('rr')}" value="${cfg.reguas_rack}" ${ro}></label>
      <label class="campo"><span>Rack</span><select data-pc="rack" ${ro}>${Object.entries(M.RACKS).map(([id, s]) => `<option value="${id}" ${id === cfg.rack ? 'selected' : ''}>${s} saídas</option>`).join('')}</select></label>
    </div>
    ${pl && pl.dados.coluna_excede ? `<p class="dica amarelo">Uma coluna sozinha já passa do limite de pixels da porta — confira o cabeamento.</p>` : ''}
    <p class="dica">${pl ? `Cada régua fecha colunas inteiras até ${B.num(cfg.kw_regua)} kW de consumo máximo (${B.num(pl.energia.w_coluna / 1000, 1)} kW por coluna). ` : ''}Mudou aqui, a lista muda junto: cabos de 20 m pelas portas, réguas e racks pela energia.</p>
    ${pl ? `<button class="btn sm ver-folha">Ver a folha</button>` : ''}
  </details>`;
}

/* Prévia da folha inteira (igual ao PDF). */
async function verFolha(ctx, lista, telaId) {
  const { B } = ctx;
  const folhas = folhasDaLista(ctx, lista, { hoje: ctx.hoje() });
  let i = folhas.findIndex(f => f.tipo === 'tela' && f.grupo.telas.some(t => t.id === telaId));
  if (i < 0) i = 0;
  const caixa = { x: 0, y: 0, w: FOLHA.w, h: FOLHA.h };
  const mostra = el => {
    el.querySelector('.folha-svg').innerHTML = svgProjeto(primsDaFolha(ctx, lista, folhas[i]), caixa);
    el.querySelector('.folha-n').textContent = `Folha ${i + 1} de ${folhas.length}`;
  };
  const r = await B.modal({
    titulo: 'Projeto — ' + B.nomeLista(lista), largo: true,
    corpo: `<div class="folha-svg proj-prev"></div>
      <div class="linha-flex" style="margin-top:8px"><button class="btn sm ant">‹</button><span class="folha-n peq muted cresce" style="text-align:center"></span><button class="btn sm prox">›</button></div>`,
    botoes: [{ txt: 'Fechar', valor: null }, { txt: 'Exportar PDF', cls: 'pri', valor: 'pdf' }],
    aoAbrir: el => {
      mostra(el);
      el.querySelector('.ant').onclick = () => { i = (i - 1 + folhas.length) % folhas.length; mostra(el); };
      el.querySelector('.prox').onclick = () => { i = (i + 1) % folhas.length; mostra(el); };
    }
  });
  if (r === 'pdf') exportar(ctx, lista);
}

async function exportar(ctx, lista) {
  const { B } = ctx;
  try {
    const n = await exportarProjeto(ctx, lista);
    await ctx.D.registrar('projeto', `exportou o projeto da lista ${B.nomeLista(lista)} (${n} folha${n === 1 ? '' : 's'})`, lista.id);
  } catch (e) { B.toast(e.message, { tipo: 'erro' }); }
}
let mostrarRemovidos = false;

/* Coluna "Separado" na própria lista (opcional, por aparelho): ir ticando item a item enquanto separam,
 * mesmo com a lista ainda em rascunho. Usa os mesmos campos do checklist de separação (sep_qtd, sep_marca). */
const SEP_CHAVE = 'led-sep-listas';
const sepLigadas = () => { try { return new Set(JSON.parse(localStorage.getItem(SEP_CHAVE) || '[]')); } catch (e) { return new Set(); } };
const sepGuardar = s => { try { localStorage.setItem(SEP_CHAVE, JSON.stringify([...s].slice(-200))); } catch (e) { /* sem storage: vale até recarregar */ } };
const sepDesligadas = new Set(); // desligou nesta sessão (mesmo com itens já separados)
function colunaSepLigada(ctx, lista, linhas) {
  if (sepDesligadas.has(lista.id)) return false;
  return sepLigadas().has(lista.id) || linhas.some(ctx.M.temSeparacao) || ['separando', 'separada'].includes(lista.status);
}

/* ---------------- recálculo (usado também por Listas e Regras) ---------------- */
const semMeta = l => { const c = Object.assign({}, l); delete c.atualizado_em; delete c.atualizado_por; return c; };

async function gravarLinhas(ctx, atuais, novas) {
  const porId = new Map(atuais.map(l => [l.id, l]));
  const mudaram = novas.filter(l => { const a = porId.get(l.id); return !a || JSON.stringify(semMeta(a)) !== JSON.stringify(semMeta(l)); });
  const ids = new Set(novas.map(l => l.id));
  const sairam = atuais.filter(l => !ids.has(l.id)).map(l => l.id);
  if (mudaram.length) await ctx.D.salvar('linhas', mudaram.map(l => Object.assign({}, l)), { silencioso: true });
  if (sairam.length) await ctx.D.excluir('linhas', sairam, { silencioso: true });
}

export function planoDeRecalculo(ctx, lista) {
  const { M } = ctx;
  const atuais = ctx.linhasDa(lista.id);
  const sug = M.calcularSugestoes(lista.telas || [], ctx.est.catalogo, ctx.regrasAtivas());
  const r = M.aplicarSugestoes(atuais, sug.itens, { novoId: ctx.novoId, listaId: lista.id });
  return { atuais, sug, novas: r.linhas, diff: r.diff, temSep: atuais.some(M.temSeparacao) };
}

/* Com algo já separado, mudança nas telas vira um diff para o técnico aplicar — nunca some check. */
export async function recalcularLista(ctx, lista, { forcar } = {}) {
  const p = planoDeRecalculo(ctx, lista);
  if (p.temSep && p.diff.length && !forcar) return { pendente: true, diff: p.diff };
  await gravarLinhas(ctx, p.atuais, p.novas);
  return { pendente: false, diff: p.diff };
}

function qtdTipica(item) {
  const vs = HISTORICO.map(h => h.itens[item]).filter(v => v > 0).sort((a, b) => a - b);
  return vs.length ? vs[Math.floor(vs.length / 2)] : 1;
}

export const editavel = l => ['rascunho', 'pronta', 'separando', 'separada'].includes(l.status);

/* ---------------- render ---------------- */
export function render(ctx, [id]) {
  const { B, M } = ctx;
  const lista = ctx.lista(id);
  if (!lista) return `<button class="voltar" onclick="location.hash='#/listas'">${B.ico('back')} Listas</button><div class="card vazio">Lista não encontrada (pode ter sido excluída).</div>`;
  const cat = ctx.catIdx();
  const plano = planoDeRecalculo(ctx, lista);
  const linhas = ctx.linhasDa(id);
  const ativas = linhas.filter(M.linhaAtiva);
  const removidas = linhas.filter(l => l.recusado);
  const tot = M.totaisLista(lista, linhas, ctx.est.catalogo);
  const prog = M.progressoSeparacao(linhas);
  const pode = editavel(lista) && ctx.pode('listas');
  const pSep = ctx.pode('separacao'), vSep = ctx.ve('separacao'), pRet = ctx.pode('retorno'), vRet = ctx.ve('retorno');
  const { freq } = ctx.frequencias(lista);
  const esquec = lista.telas && lista.telas.length ? M.esquecidos(linhas, freq, { limiar: 0.6, catalogo: ctx.est.catalogo }).slice(0, 8) : [];
  const faltas = lista.status === 'retornada' || lista.status === 'cancelada' ? [] : M.faltasDeEstoque(lista, linhas, ctx.estadoEstoque(), { hoje: ctx.hoje() });
  const diverg = M.divergencias(linhas);
  const erros = plano.sug.erros.filter(e => e.tipo === 'ciclo');
  const infoTela = new Map(plano.sug.telas.map(t => [t.id, t]));
  const regraIdx = new Map(ctx.est.regras.map(r => [r.id, r]));

  /* ---- ações por status ---- */
  let acoes = '';
  const s = lista.status;
  if (s === 'rascunho') acoes = ctx.pode('listas') ? `<button class="btn pri grande cheio liberar">${B.ico('check')} Lista pronta — liberar para separação</button>` : '<p class="muted" style="margin:0">Rascunho — ainda sendo montada.</p>';
  else if (s === 'pronta' || s === 'separando') acoes = `<div class="prog-txt"><span>Separação</span><b>${prog.resolvidos} de ${prog.total} · ${prog.pct}%</b></div>${B.barra(prog.pct, prog.pct === 100 ? 'verde' : '')}
    <div style="height:10px"></div>${vSep ? `<button class="btn pri grande cheio ir-separar">${B.ico('box')} ${!pSep ? 'Ver a separação' : s === 'pronta' ? 'Começar a separação' : 'Continuar a separação'}</button>` : ''}
    ${s === 'pronta' && ctx.pode('listas') && !linhas.some(M.temSeparacao) ? '<button class="btn ghost sm voltar-rascunho" style="margin-top:8px">Voltar para rascunho</button>' : ''}`;
  else if (s === 'separada') acoes = `<div class="linha-flex peq muted" style="margin-bottom:10px">
      <span>Separada por <b>${B.esc((lista.sep && lista.sep.por) || '—')}</b> ${lista.sep && lista.sep.em ? B.quando(lista.sep.em, ctx.hoje()) : ''}</span>
      <span>· Conferida por <b>${lista.conf && lista.conf.por ? B.esc(lista.conf.por) : '<span class="amarelo">ninguém ainda</span>'}</b></span></div>
      ${lista.sep && lista.sep.justificativa ? `<div class="card alerta" style="margin-bottom:10px"><b>Saiu com pendência:</b> ${B.esc(lista.sep.justificativa)}</div>` : ''}
      ${pSep ? `<div class="grade g2 m1">${!(lista.conf && lista.conf.por) ? `<button class="btn grande conferir">${B.ico('check')} Registrar conferência</button>` : ''}
      <button class="btn pri grande saiu">${B.ico('truck')} Saiu para o evento</button></div>` : ''}
      <div class="linha-flex" style="margin-top:8px">${vSep ? '<button class="btn ghost sm ir-separar">Ver a separação</button>' : ''}${pSep ? '<button class="btn ghost sm reabrir-sep">Reabrir a separação</button>' : ''}</div>`;
  else if (s === 'em_evento') acoes = `<p class="muted peq" style="margin:0 0 10px">No evento ${lista.volta ? '· volta prevista ' + B.dataSemana(lista.volta) : ''}</p>${vRet ? `<button class="btn pri grande cheio ir-retorno">${B.ico('undo')} ${pRet ? 'Conferir o retorno' : 'Ver o retorno'}</button>` : ''}`;
  else if (s === 'retornada') {
    const r = M.resumoRetorno(linhas);
    acoes = `<p class="peq" style="margin:0 0 10px">Retorno conferido por <b>${B.esc((lista.ret && lista.ret.por) || '—')}</b> ${lista.ret && lista.ret.em ? B.quando(lista.ret.em, ctx.hoje()) : ''} ·
      ${r.falta ? `<b class="vermelho">${B.num(r.falta)} peças não voltaram</b>` : '<b class="verde">nada faltou</b>'}${r.avaria ? ` · <b class="amarelo">${B.num(r.avaria)} com avaria</b>` : ''}</p>
      ${vRet ? '<button class="btn ir-retorno">Ver o retorno</button>' : ''}`;
  } else if (s === 'cancelada') acoes = `<p class="muted">Lista cancelada.</p>${ctx.pode('listas') ? '<button class="btn reabrir">Reabrir como rascunho</button>' : ''}`;

  /* ---- telas ---- */
  const leds = ctx.est.catalogo.filter(c => c.cat === 'led' && (c.ativo !== false || (lista.telas || []).some(t => t.painel === c.id)));
  const telasHtml = (lista.telas || []).map((t, i) => {
    const info = infoTela.get(t.id);
    const b = info && info.bases;
    const k = c => `t-${t.id}-${c}`;
    const v = x => (x == null ? '' : String(x).replace('.', ','));
    const ro = pode ? '' : 'disabled';
    const campos = {
      medida: `<label class="campo"><span>Largura (m)</span><input inputmode="decimal" data-tc="largura_m" data-k="${k('l')}" value="${v(t.largura_m)}" ${ro}></label>
               <label class="campo"><span>Altura (m)</span><input inputmode="decimal" data-tc="altura_m" data-k="${k('a')}" value="${v(t.altura_m)}" ${ro}></label>`,
      grade: `<label class="campo"><span>Colunas</span><input inputmode="numeric" data-tc="colunas" data-k="${k('c')}" value="${v(t.colunas)}" ${ro}></label>
              <label class="campo"><span>Linhas</span><input inputmode="numeric" data-tc="linhas" data-k="${k('li')}" value="${v(t.linhas)}" ${ro}></label>`,
      m2: `<label class="campo"><span>Área (m²)</span><input inputmode="decimal" data-tc="m2" data-k="${k('m')}" value="${v(t.m2)}" ${ro}></label>`,
      gabinetes: `<label class="campo"><span>Gabinetes</span><input inputmode="numeric" data-tc="gabinetes" data-k="${k('g')}" value="${v(t.gabinetes)}" ${ro}></label>`
    };
    let res = '<span class="mut2">Informe a medida para o sistema montar a lista.</span>';
    if (info && info.erro === 'sem_painel') res = '<span class="vermelho">Escolha o painel.</span>';
    else if (b && b.gabinetes) {
      const ajuste = t.modo === 'medida' && (Math.abs(b.largura_m - (+t.largura_m || 0)) > 0.001 || Math.abs(b.altura_m - (+t.altura_m || 0)) > 0.001);
      res = `${b.colunas ? `<span>${b.colunas} × ${b.linhas} =</span>` : ''}<span><b>${b.gabinetes} gabinetes</b></span>
        ${b.largura_m ? `<span class="${ajuste ? 'amarelo' : ''}">${B.num(b.largura_m)} × ${B.num(b.altura_m)} m${ajuste ? ' (ajustado ao gabinete)' : ''}</span>` : ''}
        <span><b>${b.cases} cases</b></span><span>${b.circuitos} circuitos</span><span>${b.portas} portas</span>
        <span>${B.num(b.potencia_max_w / 1000, 1)} kW máx</span><span>${B.num(b.peso_painel_kg, 1)} kg</span>`;
    }
    return `<div class="tela" data-t="${B.esc(t.id)}">
      <div class="linha-flex" style="margin-bottom:10px"><input class="inp cresce" data-tc="nome" data-k="${k('n')}" placeholder="Nome da tela (ex.: Plenária, Foyer)" value="${B.esc(t.nome || '')}" ${ro}>
        ${pode ? `<button class="icon-btn sm rm-tela" title="Tirar esta tela">${B.ico('trash')}</button>` : ''}</div>
      <div class="grade g2 m1">
        <label class="campo"><span>Painel</span><select data-tc="painel" ${ro} class="${t.painel ? '' : 'erro'}">${t.painel ? '' : '<option value="" selected>— escolher o painel —</option>'}${leds.map(c => `<option value="${B.esc(c.id)}" ${c.id === t.painel ? 'selected' : ''}>${B.esc(c.nome.replace('Case de Led ', ''))}</option>`).join('')}</select></label>
        <label class="campo"><span>Montagem</span><select data-tc="montagem" ${ro}>${Object.entries(B.MONTAGEM).map(([kk, vv]) => `<option value="${kk}" ${kk === (t.montagem || 'chao') ? 'selected' : ''}>${vv}</option>`).join('')}</select></label>
      </div>
      <div class="abas" style="margin:10px 0">${Object.entries({ medida: 'L × A', grade: 'Col × lin', m2: 'm²', gabinetes: 'Gab.' }).map(([kk, vv]) => `<button data-modo="${kk}" class="${(t.modo || 'medida') === kk ? 'on' : ''}" ${ro}>${vv}</button>`).join('')}</div>
      <div class="grade g2">${campos[t.modo || 'medida']}</div>
      <div class="res">${res}</div>
      ${b && b.gabinetes ? projetoHtml(ctx, t, pode) : ''}
    </div>`;
  }).join('');

  /* ---- alertas ---- */
  const avisos = [];
  if (plano.temSep && plano.diff.length) {
    avisos.push(`<div class="card aviso"><h2>${B.ico('alerta')} A lista mudou depois que a separação começou</h2>
      <p class="peq" style="margin:0 0 6px">Aplicando, ${plano.diff.length} ite${plano.diff.length === 1 ? 'm muda' : 'ns mudam'}. <b>Nada do que já foi separado é desmarcado.</b></p>
      ${diffHtml(ctx, plano.diff)}<button class="btn pri aplicar-diff">Aplicar mudanças</button></div>`);
  }
  if (erros.length) avisos.push(`<div class="card alerta"><h2>${B.ico('alerta')} Regra com problema</h2><p class="peq">Há regras que dependem uma da outra em círculo e foram ignoradas: ${[...new Set(erros.map(e => e.regra))].map(r => B.esc(r)).join(', ')}. Corrija em Regras.</p></div>`);
  if (faltas.length) avisos.push(`<div class="card alerta"><h2>${B.ico('estoque')} Falta no estoque para estas datas</h2>
    ${faltas.map(f => `<div class="peq" style="margin:4px 0"><b>${B.esc(ctx.nomeItem(f.item))}</b>: precisa ${B.num(f.precisa)}, livres ${B.num(f.livre)} em ${B.dataSemana(f.dia)} → <b class="vermelho">faltam ${B.num(f.falta)}${(ctx.item(f.item) || {}).painel ? ' (' + B.num(Math.round(f.falta * ctx.item(f.item).painel.por_case)) + ' gabinetes)' : ''}</b>
      ${f.outras.length ? `<span class="mut2"> (em uso: ${f.outras.map(o => B.esc(ctx.lista(o.lista) ? B.nomeLista(ctx.lista(o.lista)) : 'outra lista') + ' ' + B.num(o.qtd)).join(', ')}${f.manut ? ', manutenção ' + B.num(f.manut) : ''})</span>` : f.manut ? `<span class="mut2"> (manutenção ${B.num(f.manut)})</span>` : ''}</div>`).join('')}
    <p class="dica">Sublocar, trocar por outro modelo ou rever a quantidade. Lista sem data não é checada.</p></div>`);
  if (esquec.length && pode) avisos.push(`<div class="card dica"><h2>${B.ico('info')} Costuma ir e não está nesta lista</h2>
    <div class="chips">${esquec.map(e => `<button class="chip add-esq" data-item="${B.esc(e.item)}">+ ${B.esc(ctx.nomeItem(e.item))} <span class="mut2">${Math.round(e.freq * 100)}%</span></button>`).join('')}</div>
    <p class="dica">% das listas de painel no chão que levaram o item. Se não vai mesmo, ignore.</p></div>`);
  if (diverg.length) avisos.push(`<div class="card aviso"><h2>${B.ico('lock')} Quantidades que você fixou</h2>
    ${diverg.map(d => `<div class="linha-flex peq" style="margin:4px 0"><span class="cresce"><b>${B.esc(ctx.nomeItem(d.item))}</b>: você fixou ${B.num(d.qtd)} — a regra sugere ${B.num(d.sug)}</span>${pode ? `<button class="btn sm usar-sug" data-id="${B.esc(d.id)}">Usar ${B.num(d.sug)}</button>` : ''}</div>`).join('')}</div>`);

  /* ---- itens ---- */
  const grupos = new Map();
  for (const l of ativas) {
    const c = cat.get(l.item);
    const g = c ? c.cat : 'outros';
    if (!grupos.has(g)) grupos.set(g, []);
    grupos.get(g).push(l);
  }
  const ordemGrupo = [...ctx.ORDEM_CAT, 'outros'];
  // coluna "Separado": quem pode separar tica na própria lista (rascunho, pronta ou separando)
  const verSep = vSep && ativas.length > 0;
  const sepOn = verSep && colunaSepLigada(ctx, lista, linhas);
  const sep = sepOn ? { pode: pSep && ['rascunho', 'pronta', 'separando'].includes(s) } : null;
  const itensHtml = [...grupos.entries()].sort((a, b) => ordemGrupo.indexOf(a[0]) - ordemGrupo.indexOf(b[0])).map(([g, ls]) => {
    ls.sort((a, b) => ((cat.get(a.item) || {}).ordem || 0) - ((cat.get(b.item) || {}).ordem || 0));
    return `<div class="grupo"><h3>${B.esc(ctx.CATEGORIAS[g] || 'Outros')}</h3>${ls.map(l => linhaHtml(ctx, l, cat, regraIdx, pode, sep)).join('')}</div>`;
  }).join('');

  const irmas = lista.grupo ? M.salasDoEvento(ctx.est.listas, lista.grupo) : [];
  return `
  ${lista.grupo ? `<button class="voltar" data-ir="evento/${B.esc(lista.grupo)}">${B.ico('back')} Evento: ${B.esc(lista.evento || 'sem nome')}</button>` : `<button class="voltar" data-ir="listas">${B.ico('back')} Listas</button>`}
  <div class="cab"><div class="cresce"><h1>${lista.grupo && lista.sala ? `<span class="sala-tag">SALA</span>${B.esc(lista.sala)}` : B.esc(B.nomeLista(lista))}</h1>
    <div class="sub">${lista.grupo ? B.esc(lista.evento || '') + (irmas.length > 1 ? ` <span class="mut2">(${irmas.length} salas)</span>` : '') + ' · ' : ''}${lista.os ? 'OS ' + B.esc(lista.os) + ' · ' : ''}${B.pillStatus(lista.status)} ${lista.criada_por ? '<span class="mut2">· criada por ' + B.esc(lista.criada_por) + '</span>' : ''}</div></div>
    <div class="acoes"><button class="icon-btn imprimir" title="Imprimir / PDF">${B.ico('print')}</button><button class="icon-btn menu-lista" title="Mais">${B.ico('mais')}</button></div></div>

  <div class="card">${acoes}</div>

  <details class="card evento" ${lista.evento && lista.ida ? '' : 'open'}><summary class="h2" style="cursor:pointer;list-style:none">Evento
      <span class="dir peq mut2" style="text-transform:none;letter-spacing:0">${B.esc([lista.local, lista.ida ? B.dataBR(lista.ida) + (lista.volta ? ' → ' + B.dataBR(lista.volta) : '') : 'sem data'].filter(Boolean).join(' · '))} ▾</span></summary>
    <div class="grade g3" style="margin-top:12px">
      <label class="campo"><span>OS</span><input data-lc="os" data-k="l-os" value="${B.esc(lista.os || '')}" inputmode="text"></label>
      <label class="campo"><span>Evento</span><input data-lc="evento" data-k="l-ev" value="${B.esc(lista.evento || '')}"></label>
      <label class="campo"><span>Cliente / agência</span><input data-lc="cliente" data-k="l-cl" value="${B.esc(lista.cliente || '')}"></label>
      <label class="campo"><span>Sala / local no evento</span><input data-lc="sala" data-k="l-sala" value="${B.esc(lista.sala || '')}" placeholder="Ex.: Foyer, Hotel B — Plenária"></label>
      <label class="campo"><span>Local</span><input data-lc="local" data-k="l-lo" value="${B.esc(lista.local || '')}"></label>
      <label class="campo"><span>Ida (sai do galpão)</span><input type="date" data-lc="ida" data-k="l-ida" value="${lista.ida || ''}"></label>
      <label class="campo"><span>Volta</span><input type="date" data-lc="volta" data-k="l-vo" value="${lista.volta || ''}"></label>
      <label class="campo"><span>Responsável pelo projeto</span><input data-lc="responsavel_projeto" data-k="l-resp" value="${B.esc(lista.responsavel_projeto || '')}" placeholder="${B.esc(ctx.quem())}"></label>
    </div>
    <label class="campo" style="margin-top:10px"><span>Observações</span><textarea data-lc="obs" data-k="l-obs" rows="2">${B.esc(lista.obs || '')}</textarea></label>
  </details>

  <div class="card"><h2>Telas de LED <span class="conta">${(lista.telas || []).length}</span>${(lista.telas || []).length ? '<span class="dir"><button class="btn sm exportar-proj">' + B.ico('painel') + ' Exportar projeto (PDF)</button></span>' : ''}</h2>
    ${telasHtml || '<p class="muted">Nenhuma tela. Adicione o painel e a medida — o sistema monta a lista.</p>'}
    ${pode ? `<button class="btn add-tela">${B.ico('add')} Adicionar tela</button>` : ''}
  </div>

  ${avisos.join('')}

  <div class="card"><h2>Itens da lista <span class="conta">${ativas.length}</span>
    <span class="dir peq mut2">${pode ? 'mude a quantidade e ela fica fixa ' : ''}${verSep ? `<button class="btn sm ver-sep ${sepOn ? 'on' : ''}" title="Mostrar a coluna para ir ticando o que já foi separado">${B.ico('check')} Separado</button>` : ''}</span></h2>
    ${sepOn ? `<div class="prog-txt"><span>${prog.parcial ? `<span class="amarelo">${prog.parcial} parcia${prog.parcial === 1 ? 'l' : 'is'}</span>` : 'Separado'}${prog.faltou ? ` · <span class="vermelho">${prog.faltou} faltaram</span>` : ''}${s === 'rascunho' && prog.resolvidos ? ' <span class="mut2">· lista ainda em rascunho</span>' : ''}</span><b>${prog.resolvidos} de ${prog.total} · ${prog.pct}%</b></div>
      ${B.barra(prog.pct, prog.pct === 100 ? 'verde' : '')}
      <p class="dica" style="margin:6px 0 10px">${sep && sep.pode ? 'Toque no quadrado quando o item estiver separado. Separou só uma parte? Toque no número e diga quantos.' : 'Só para ver — a separação desta lista está fechada ou você não tem acesso à separação.'}</p>` : ''}
    ${itensHtml || '<p class="muted">Os itens aparecem aqui assim que houver uma tela com medida.</p>'}
    ${pode ? `<button class="btn add-item" style="margin-top:8px">${B.ico('add')} Adicionar item à mão</button>` : ''}
    ${removidas.length ? `<div style="margin-top:12px"><button class="link ver-removidos">${mostrarRemovidos ? 'Esconder' : 'Ver'} itens tirados da lista (${removidas.length})</button>
      ${mostrarRemovidos ? removidas.map(l => `<div class="linha-flex peq" style="margin:6px 0"><span class="cresce mut2"><s>${B.esc(ctx.nomeItem(l.item))}</s> — a regra sugere ${B.num(l.sug)}</span>${pode ? `<button class="btn sm devolver" data-id="${B.esc(l.id)}">Devolver</button>` : ''}</div>`).join('') : ''}</div>` : ''}
  </div>

  <div class="rodape-fixo">
    <div>Cases <b>${B.num(tot.cases_led)}</b></div><div>Gabinetes <b>${B.num(tot.gabinetes)}</b></div><div>m² <b>${B.num(tot.m2)}</b></div>
    <div>Itens <b>${tot.linhas}</b></div><div>Peças <b>${B.num(tot.pecas)}</b></div>
    <div>Peso painéis <b>${B.num(tot.peso_painel_kg, 1)} kg</b></div><div>Potência <b>${B.num(tot.potencia_max_w / 1000, 1)} kW</b> <span class="mut2">máx · ${B.num(tot.potencia_med_w / 1000, 1)} méd</span></div>
  </div>`;
}

function diffHtml(ctx, diff) {
  const { B } = ctx;
  return `<div class="diff">${diff.map(d => {
    const delta = d.para - d.de;
    return `<div><span>${B.esc(ctx.nomeItem(d.item))}</span><span class="${delta > 0 ? 'mais' : 'menos'}">${delta > 0 ? '+' : '−'}${B.num(Math.abs(delta))} <span class="mut2">(${B.num(d.de)} → ${B.num(d.para)})</span></span></div>`;
  }).join('')}</div>`;
}

function linhaHtml(ctx, l, cat, regraIdx, pode, sep) {
  const { B, M } = ctx;
  const c = cat.get(l.item);
  const aberto = abertos.has(l.id);
  const sub = [];
  const st = sep ? M.statusSeparacao(l) : null;
  if (st === 'parcial') sub.push(`<b class="amarelo">separado ${B.num(l.sep_qtd)} de ${B.num(l.qtd)}</b>`);
  if (st === 'faltou') sub.push(`<b class="vermelho">faltou no galpão${l.sep_qtd ? ' (' + B.num(l.sep_qtd) + ' separados)' : ''}</b>`);
  if (st === 'na') sub.push('não se aplica neste evento');
  if (sep && l.sep_por && st !== 'pendente') sub.push(`<span class="mut2">${B.esc(l.sep_por)} · ${B.quando(l.sep_em, ctx.hoje())}</span>`);
  if (l.origem === 'manual') sub.push('adicionado à mão');
  if (l.travado && l.origem === 'regra') sub.push(`<span class="tag">${B.ico('lock')} fixo</span> regra: ${B.num(l.sug)}`);
  const temPq = (l.origens && l.origens.length) || l.origem === 'manual';
  if (temPq) sub.push(`<button class="link pq" data-id="${B.esc(l.id)}">${aberto ? 'fechar' : 'por quê?'}</button>`);
  const porque = aberto ? `<div class="porque">${(l.origens || []).map(o => {
    const r = regraIdx.get(o.regra);
    return `<div>• ${B.esc(B.fraseOrigem(o, cat))}${r && r.obs ? `<br><span class="mut2">${B.esc(r.obs)}</span>` : ''}</div>`;
  }).join('') || '<div>Adicionado à mão — nenhuma regra sugere este item.</div>'}
    ${l.travado ? `<div class="amarelo">Você fixou ${B.num(l.qtd)}. Recalcular não mexe nesta quantidade.</div>` : ''}</div>` : '';
  return `<div class="lin ${l.travado ? 'travada' : ''} ${l.origem === 'manual' ? 'manual' : ''} ${sep ? 'com-sep sep-' + st : ''}" data-id="${B.esc(l.id)}">
    ${sep ? `<button class="sep-btn" aria-label="${st === 'ok' ? 'Desmarcar separado' : 'Marcar como separado'}" ${sep.pode ? '' : 'disabled'}>${B.ico('check')}</button>` : ''}
    <div class="nome">${B.esc(c ? c.nome : '(item removido do catálogo)')}<small>${sub.join(' · ')}</small></div>
    ${sep ? `<button class="sep-q num" title="Quantos foram separados" ${sep.pode ? '' : 'disabled'}>${l.sep_qtd != null ? B.num(l.sep_qtd) : '0'}<small>/${B.num(l.qtd)}</small></button>` : ''}
    <input class="qtd num" inputmode="decimal" data-k="q-${B.esc(l.id)}" value="${String(l.qtd).replace('.', ',')}" ${pode ? '' : 'disabled'} aria-label="Quantidade">
    <div class="acoes-lin">${pode ? `<button class="icon-btn sm rm" title="Tirar da lista">${B.ico('x')}</button>` : ''}</div>
    ${porque}
  </div>`;
}

/* ---------------- eventos ---------------- */
export function ligar(el, ctx, [id]) {
  const { B, M } = ctx;
  const lista = ctx.lista(id);
  el.querySelectorAll('[data-ir]').forEach(b => { b.onclick = () => ctx.ir(b.dataset.ir); });
  if (!lista) return;

  // lista sem nada separado acompanha regras novas sozinha
  const plano = planoDeRecalculo(ctx, lista);
  if (!plano.temSep && plano.diff.length && editavel(lista) && ctx.pode('listas')) {
    recalcularLista(ctx, lista).then(() => ctx.atualizar());
    return;
  }

  const salvarLista = async (campos, { recalc } = {}) => {
    Object.assign(lista, campos);
    await ctx.D.salvar('listas', lista, { silencioso: true });
    if (recalc) {
      const r = await recalcularLista(ctx, lista);
      if (r.pendente) B.toast('A separação já começou: confira as mudanças no aviso amarelo.');
    }
    ctx.atualizar();
  };

  // cabeçalho
  if (!ctx.pode('listas')) el.querySelectorAll('[data-lc]').forEach(inp => { inp.disabled = true; });
  else el.querySelectorAll('[data-lc]').forEach(inp => {
    inp.addEventListener('change', async () => {
      const campo = inp.dataset.lc;
      const v = inp.value.trim() || (inp.type === 'date' ? null : '');
      // sala de um evento: OS, nome e cliente são do evento (mudam em todas as salas);
      // datas e local podem ser diferentes por sala/hotel — pergunta
      const outras = lista.grupo ? ctx.M.salasDoEvento(ctx.est.listas, lista.grupo).filter(l => l.id !== lista.id) : [];
      if (outras.length && ['os', 'evento', 'cliente'].includes(campo)) {
        for (const l of outras) { l[campo] = v; await ctx.D.salvar('listas', l, { silencioso: true }); }
        B.toast(`Atualizado também nas outras ${outras.length} sala${outras.length === 1 ? '' : 's'} do evento.`);
      } else if (outras.length && ['ida', 'volta', 'local'].includes(campo) && outras.some(l => (l[campo] || null) !== v)
        && await B.confirmar('Mudar nas outras salas também?', `As outras ${outras.length} sala${outras.length === 1 ? '' : 's'} do evento: ${outras.map(l => B.esc(l.sala || 'sem nome')).join(', ')}.`, { sim: 'Mudar em todas' })) {
        for (const l of outras) { l[campo] = v; await ctx.D.salvar('listas', l, { silencioso: true }); }
      }
      salvarLista({ [campo]: v });
    });
  });

  // telas
  el.querySelectorAll('.tela[data-t]').forEach(box => {
    const t = (lista.telas || []).find(x => x.id === box.dataset.t);
    if (!t) return;
    box.querySelectorAll('[data-tc]').forEach(inp => {
      inp.addEventListener('change', () => {
        const campo = inp.dataset.tc;
        let v = inp.value;
        if (!['nome', 'painel', 'montagem'].includes(campo)) v = B.lerNum(v);
        t[campo] = v;
        salvarLista({ telas: lista.telas }, { recalc: campo !== 'nome' });
      });
    });
    box.querySelectorAll('[data-modo]').forEach(b => {
      b.onclick = () => {
        // converte a medida atual para o modo novo, para não perder o que foi digitado
        const c = ctx.item(t.painel);
        const g = c && c.painel ? M.geometria(t, c.painel) : null;
        t.modo = b.dataset.modo;
        if (g && g.gabinetes) {
          if (t.modo === 'grade' && g.colunas) { t.colunas = g.colunas; t.linhas = g.linhas; }
          if (t.modo === 'medida' && g.colunas) { t.largura_m = g.largura_m; t.altura_m = g.altura_m; }
          if (t.modo === 'm2') t.m2 = g.m2;
          if (t.modo === 'gabinetes') t.gabinetes = g.gabinetes;
        }
        salvarLista({ telas: lista.telas }, { recalc: true });
      };
    });
    // projeto da tela: mexeu aqui, a lista acompanha (portas → cabos 20 m; energia → réguas e racks)
    const pj = box.querySelector('.projeto-tela');
    if (pj) {
      pj.addEventListener('toggle', () => { pj.open ? abertosProj.add(t.id) : abertosProj.delete(t.id); });
      pj.querySelectorAll('[data-pc]').forEach(inp => {
        inp.addEventListener('change', () => {
          const campo = inp.dataset.pc;
          let v = inp.value;
          if (campo === 'backup') v = v === '1';
          else if (['kw_regua', 'reguas_rack'].includes(campo)) { v = B.lerNum(v); if (!(v > 0)) { inp.classList.add('erro'); return; } }
          t.projeto = Object.assign({}, t.projeto || {}, { [campo]: v });
          salvarLista({ telas: lista.telas }, { recalc: campo !== 'processadora' });
        });
      });
      const vf = pj.querySelector('.ver-folha');
      if (vf) vf.onclick = () => verFolha(ctx, lista, t.id);
    }
    const rm = box.querySelector('.rm-tela');
    if (rm) rm.onclick = async () => {
      if (!(await B.confirmar('Tirar esta tela?', `Os itens que vieram só dela saem da lista.`, { sim: 'Tirar', perigo: true }))) return;
      lista.telas = lista.telas.filter(x => x.id !== t.id);
      salvarLista({ telas: lista.telas }, { recalc: true });
    };
  });
  const addTela = el.querySelector('.add-tela');
  if (addTela) addTela.onclick = () => { lista.telas = (lista.telas || []).concat([novaTela(ctx)]); salvarLista({ telas: lista.telas }); };

  // linhas
  el.querySelectorAll('.lin[data-id]').forEach(row => {
    const l = ctx.est.linhas.find(x => x.id === row.dataset.id);
    if (!l) return;
    const q = row.querySelector('.qtd');
    q.addEventListener('focus', () => q.select());
    q.addEventListener('change', async () => {
      const v = B.lerNum(q.value);
      if (v == null || v < 0) { q.value = String(l.qtd).replace('.', ','); return; }
      if (v === 0) return tirar(l);
      await ctx.D.salvar('linhas', M.editarQuantidade(l, v), { silencioso: true });
      ctx.atualizar();
    });
    q.addEventListener('keydown', e => { if (e.key === 'Enter') q.blur(); });
    const rm = row.querySelector('.rm');
    if (rm) rm.onclick = () => tirar(l);
  });
  async function tirar(l) {
    const antes = Object.assign({}, l);
    if (l.origem === 'manual') await ctx.D.excluir('linhas', l.id, { silencioso: true });
    else await ctx.D.salvar('linhas', Object.assign({}, l, { recusado: true }), { silencioso: true });
    ctx.atualizar();
    B.toast(`${ctx.nomeItem(l.item)} saiu da lista.`, { acao: 'Desfazer', onAcao: async () => { await ctx.D.salvar('linhas', antes, { silencioso: true }); ctx.atualizar(); } });
  }
  el.querySelectorAll('.pq').forEach(b => { b.onclick = () => { abertos.has(b.dataset.id) ? abertos.delete(b.dataset.id) : abertos.add(b.dataset.id); ctx.atualizar(); }; });
  el.querySelectorAll('.usar-sug').forEach(b => {
    b.onclick = async () => { const l = ctx.est.linhas.find(x => x.id === b.dataset.id); await ctx.D.salvar('linhas', M.editarQuantidade(l, l.sug), { silencioso: true }); ctx.atualizar(); };
  });
  el.querySelectorAll('.devolver').forEach(b => {
    b.onclick = async () => { const l = ctx.est.linhas.find(x => x.id === b.dataset.id); await ctx.D.salvar('linhas', Object.assign({}, l, { recusado: false, qtd: l.sug || l.qtd }), { silencioso: true }); ctx.atualizar(); };
  });
  // coluna "Separado": liga/desliga (por aparelho) e tica item a item, inclusive parcial
  const vs = el.querySelector('.ver-sep');
  if (vs) vs.onclick = () => {
    const ligadas = sepLigadas();
    if (vs.classList.contains('on')) { ligadas.delete(lista.id); sepDesligadas.add(lista.id); } else { ligadas.add(lista.id); sepDesligadas.delete(lista.id); }
    sepGuardar(ligadas);
    ctx.atualizar();
  };
  const gravarSep = async nova => {
    const primeira = !ctx.linhasDa(lista.id).some(M.temSeparacao);
    await ctx.D.salvar('linhas', nova, { silencioso: true });
    if (lista.status === 'pronta') {
      lista.status = 'separando';
      lista.sep_inicio = ctx.agora();
      await ctx.D.salvar('listas', lista, { silencioso: true });
      await ctx.D.registrar('separacao_iniciada', `começou a separar a lista ${B.nomeLista(lista)}`, lista.id);
    } else if (primeira && lista.status === 'rascunho') {
      await ctx.D.registrar('separacao_iniciada', `começou a separar a lista ${B.nomeLista(lista)} (ainda em rascunho)`, lista.id);
    }
    ctx.atualizar();
  };
  el.querySelectorAll('.lin.com-sep[data-id]').forEach(row => {
    const l = ctx.est.linhas.find(x => x.id === row.dataset.id);
    if (!l) return;
    const quem = () => ({ por: ctx.quem(), em: ctx.agora() });
    const b = row.querySelector('.sep-btn');
    if (b && !b.disabled) b.onclick = () => {
      gravarSep(M.statusSeparacao(l) === 'ok' ? M.desmarcar(l) : M.marcarSeparado(l, quem()));
      if (navigator.vibrate) navigator.vibrate(15);
    };
    const qs = row.querySelector('.sep-q');
    if (qs && !qs.disabled) qs.onclick = async () => {
      const v = await B.pedirNumero(ctx.nomeItem(l.item), { rotulo: `Quantos já foram separados (de ${B.num(l.qtd)})?`, valor: l.sep_qtd != null ? l.sep_qtd : '', max: +l.qtd });
      if (v == null) return;
      if (v > +l.qtd && !(await B.confirmar('Separou mais do que a lista pede?', `A lista pede ${B.num(l.qtd)} de ${B.esc(ctx.nomeItem(l.item))}. Fica ${B.num(v)} separados?`, { sim: `Sim, ${B.num(v)}` }))) return;
      gravarSep(v === 0 ? M.desmarcar(l) : M.marcarSeparado(l, Object.assign({ qtd: v }, quem())));
    };
  });
  const verRem = el.querySelector('.ver-removidos');
  if (verRem) verRem.onclick = () => { mostrarRemovidos = !mostrarRemovidos; ctx.atualizar(); };
  el.querySelectorAll('.add-esq').forEach(b => { b.onclick = () => adicionarManual(ctx, lista, b.dataset.item, qtdTipica(b.dataset.item)); });
  const addItem = el.querySelector('.add-item');
  if (addItem) addItem.onclick = async () => {
    const item = await B.escolherItem(ctx.est.catalogo, { titulo: 'Adicionar item', categorias: ctx.CATEGORIAS });
    if (!item) return;
    const existe = ctx.linhasDa(lista.id).find(x => x.item === item);
    if (existe && !existe.recusado) { B.toast('Esse item já está na lista — mude a quantidade nele.'); const i = el.querySelector(`[data-k="q-${CSS.escape(existe.id)}"]`); if (i) i.focus(); return; }
    const q = await B.pedirNumero(ctx.nomeItem(item), { rotulo: 'Quantidade', valor: existe ? existe.sug || '' : '' });
    if (!q) return;
    await adicionarManual(ctx, lista, item, q, true);
  };
  const aplicar = el.querySelector('.aplicar-diff');
  if (aplicar) aplicar.onclick = async () => { await recalcularLista(ctx, lista, { forcar: true }); await ctx.D.registrar('lista_recalculada', `aplicou mudanças na lista ${B.nomeLista(lista)} durante a separação`, lista.id); ctx.atualizar(); };

  // status
  const liberar = el.querySelector('.liberar');
  if (liberar) liberar.onclick = () => liberarLista(ctx, lista);
  el.querySelectorAll('.ir-separar').forEach(b => { b.onclick = () => ctx.ir('separar/' + lista.id); });
  el.querySelectorAll('.ir-retorno').forEach(b => { b.onclick = () => ctx.ir('retorno/' + lista.id); });
  const volt = el.querySelector('.voltar-rascunho');
  if (volt) volt.onclick = () => salvarLista({ status: 'rascunho' });
  const conferir = el.querySelector('.conferir');
  if (conferir) conferir.onclick = () => registrarConferencia(ctx, lista);
  const saiu = el.querySelector('.saiu');
  if (saiu) saiu.onclick = async () => {
    if (!(lista.conf && lista.conf.por) && !(await B.confirmar('Sair sem conferência?', 'Ninguém registrou a conferência desta separação. O supervisor vai ver isso no painel.', { sim: 'Saiu assim mesmo' }))) return;
    await salvarLista({ status: 'em_evento', saiu_em: ctx.agora(), saiu_por: ctx.quem() });
    await ctx.D.registrar('lista_saiu', `marcou que a lista ${B.nomeLista(lista)} saiu para o evento`, lista.id);
  };
  const reabrirSep = el.querySelector('.reabrir-sep');
  if (reabrirSep) reabrirSep.onclick = async () => {
    if (!(await B.confirmar('Reabrir a separação?', 'Os itens já ticados continuam ticados. A conferência registrada é desfeita — alguém confere de novo depois.', { sim: 'Reabrir' }))) return;
    await salvarLista({ status: 'separando', conf: null });
    await ctx.D.registrar('separacao_reaberta', `reabriu a separação da lista ${B.nomeLista(lista)}`, lista.id);
    ctx.ir('separar/' + lista.id);
  };
  const reabrir = el.querySelector('.reabrir');
  if (reabrir) reabrir.onclick = () => salvarLista({ status: 'rascunho' });
  el.querySelector('.imprimir').onclick = () => imprimirLista(ctx, lista);
  const ep = el.querySelector('.exportar-proj');
  if (ep) ep.onclick = () => exportar(ctx, lista);
  el.querySelector('.menu-lista').onclick = () => menuLista(ctx, lista);
}

async function adicionarManual(ctx, lista, item, qtd, perguntarRegra) {
  const { B, M } = ctx;
  const existe = ctx.linhasDa(lista.id).find(x => x.item === item);
  if (existe) await ctx.D.salvar('linhas', Object.assign({}, existe, { recusado: false, qtd, travado: existe.origem === 'regra' ? qtd !== existe.sug : existe.travado }), { silencioso: true });
  else await ctx.D.salvar('linhas', {
    id: ctx.novoId(), lista: lista.id, item, qtd, sug: null, origem: 'manual', travado: false, recusado: false, origens: [], obs: '',
    sep_qtd: null, sep_marca: null, sep_por: null, sep_em: null, ret_ok: null, ret_avaria: null, ret_por: null, ret_em: null
  }, { silencioso: true });
  ctx.atualizar();
  if (!perguntarRegra || existe || !ctx.pode('regras')) return;
  // aprender: item que nenhuma regra sugeriu pode virar regra
  const cat = ctx.est.catalogo;
  let gab = 0;
  for (const t of lista.telas || []) { const c = cat.find(x => x.id === t.painel); if (c && c.painel) gab += M.geometria(t, c.painel).gabinetes; }
  B.toast(`${ctx.nomeItem(item)} entrou à mão.`, {
    acao: 'Virar regra', tempo: 7000, onAcao: async () => {
      const porGab = gab && qtd > 3;
      const fator = porGab ? +(qtd / gab).toFixed(3) : qtd;
      const regra = {
        id: ctx.novoId(), ativa: true, escopo: porGab ? 'tela' : 'lista', paineis: [], montagens: [], cond: null, item,
        base: porGab ? 'gabinetes' : 'lista', fator, reserva: 0, adicional: 0, arred: 'cima', multiplo: 0, minimo: 0, maximo: 0,
        obs: `Criada a partir da lista ${B.nomeLista(lista)}: ${qtd} para ${porGab ? gab + ' gabinetes' : 'a lista'}.`
      };
      await ctx.D.salvar('regras', regra, { silencioso: true });
      await ctx.D.registrar('regra_criada', `criou regra para ${ctx.nomeItem(item)} a partir da lista ${B.nomeLista(lista)}`, regra.id);
      await recalcularLista(ctx, lista);
      ctx.atualizar();
      B.toast(porGab ? `Regra criada: ${B.num(fator)} por gabinete. Ajuste em Regras.` : `Regra criada: ${qtd} por lista. Ajuste em Regras.`);
    }
  });
}

async function liberarLista(ctx, lista) {
  const { B, M } = ctx;
  const linhas = ctx.linhasDa(lista.id);
  if (!linhas.some(M.linhaAtiva)) return B.toast('A lista está vazia — adicione uma tela com medida.');
  const { freq } = ctx.frequencias(lista);
  const esq = M.esquecidos(linhas, freq, { limiar: 0.6, catalogo: ctx.est.catalogo });
  const faltas = M.faltasDeEstoque(lista, linhas, ctx.estadoEstoque(), { hoje: ctx.hoje() });
  const problemas = [];
  if (!lista.ida) problemas.push('A lista está <b>sem data de ida</b> — o estoque não consegue reservar o material.');
  if (!lista.evento) problemas.push('A lista está <b>sem nome de evento</b>.');
  if (esq.length) problemas.push(`Costumam ir e não estão aqui: <b>${esq.slice(0, 6).map(e => B.esc(ctx.nomeItem(e.item))).join(', ')}</b>.`);
  if (faltas.length) problemas.push(`Falta no estoque: <b>${faltas.map(f => B.esc(ctx.nomeItem(f.item)) + ' (' + B.num(f.falta) + ')').join(', ')}</b>.`);
  if (problemas.length && !(await B.confirmar('Antes de liberar', problemas.map(p => '• ' + p).join('<br>') + '<br><br>Liberar mesmo assim?', { sim: 'Liberar' }))) return;
  lista.status = 'pronta';
  lista.pronta_em = ctx.agora(); lista.pronta_por = ctx.quem();
  await ctx.D.salvar('listas', lista, { silencioso: true });
  await ctx.D.registrar('lista_pronta', `liberou a lista ${B.nomeLista(lista)} para separação (${linhas.filter(M.linhaAtiva).length} itens)`, lista.id);
  ctx.atualizar();
}

export async function registrarConferencia(ctx, lista) {
  const { B } = ctx;
  const nome = await B.pedirTexto('Quem conferiu a separação?', {
    rotulo: 'Nome', valor: ctx.quem(), obrigatorio: true,
    dica: lista.sep && lista.sep.por === ctx.quem() ? '<span class="amarelo">Você mesmo separou esta lista. O ideal é outra pessoa conferir.</span>' : 'Conferência = outra pessoa olhar o que foi separado antes de carregar.'
  });
  if (!nome) return;
  lista.conf = { por: nome, em: ctx.agora(), registrado_por: ctx.quem() };
  await ctx.D.salvar('listas', lista, { silencioso: true });
  await ctx.D.registrar('lista_conferida', `registrou conferência da lista ${B.nomeLista(lista)} por ${nome}`, lista.id);
  ctx.atualizar();
}

async function menuLista(ctx, lista) {
  const { B, M } = ctx;
  const ops = [['imprimir', 'Imprimir / salvar PDF'], ['projeto', 'Exportar projeto (PDF)']];
  const podeMexerTelas = ctx.pode('listas') && ['rascunho', 'pronta'].includes(lista.status) && !ctx.linhasDa(lista.id).some(M.temSeparacao);
  if (lista.grupo) {
    ops.unshift(['evento', 'Abrir o evento (todas as salas)']);
    if (ctx.pode('listas')) ops.push(['nova-sala', 'Nova sala neste evento']);
    if (podeMexerTelas && (lista.telas || []).length) ops.push(['mover', 'Mover telas para outra sala']);
    if (ctx.pode('listas')) ops.push(['sair-evento', 'Tirar esta sala do evento']);
  } else if (podeMexerTelas && (lista.telas || []).length) ops.push(['mover', 'Dividir em salas (uma lista por sala)']);
  if (ctx.pode('listas')) ops.push(['duplicar', 'Duplicar esta lista']);
  if (ctx.pode('listas') && !['retornada', 'cancelada'].includes(lista.status)) ops.push(['cancelar', 'Cancelar lista']);
  if (ctx.admin() || (lista.criada_por === ctx.quem() && ctx.pode('listas'))) ops.push(['excluir', 'Excluir lista']);
  const v = await B.modal({
    titulo: B.nomeLista(lista),
    corpo: `<div class="lista-escolha">${ops.map(([k, t]) => `<button class="escolha" data-v="${k}"><b class="${k === 'excluir' || k === 'cancelar' ? 'vermelho' : ''}">${t}</b></button>`).join('')}</div>`,
    botoes: [{ txt: 'Fechar', valor: null }],
    aoAbrir: (el, fechar) => el.querySelectorAll('[data-v]').forEach(b => { b.onclick = () => fechar(b.dataset.v); })
  });
  if (v === 'imprimir') imprimirLista(ctx, lista);
  if (v === 'projeto') exportar(ctx, lista);
  if (v === 'evento') ctx.ir('evento/' + lista.grupo);
  if (v === 'nova-sala') novaSala(ctx, lista.grupo);
  if (v === 'mover') moverTelas(ctx, lista);
  if (v === 'sair-evento' && await B.confirmar('Tirar esta sala do evento?', `"${B.esc(lista.sala || 'Esta sala')}" vira uma lista solta (continua com as telas e os itens).`, { sim: 'Tirar do evento' })) {
    const grupo = lista.grupo;
    lista.grupo = null;
    await ctx.D.salvar('listas', lista);
    await ctx.D.registrar('lista_sala', `tirou a sala ${lista.sala || ''} do evento ${lista.evento || ''}`, lista.id);
    ctx.atualizar();
    if (!ctx.M.salasDoEvento(ctx.est.listas, grupo).length) B.toast('O evento ficou sem salas.');
  }
  if (v === 'duplicar') {
    const r = M.duplicarLista(lista, ctx.linhasDa(lista.id), { novoId: ctx.novoId, hoje: ctx.agora(), por: ctx.quem() });
    await ctx.D.salvar('listas', r.lista); await ctx.D.salvar('linhas', r.linhas);
    await ctx.D.registrar('lista_duplicada', `duplicou a lista ${B.nomeLista(lista)}`, r.lista.id);
    ctx.ir('lista/' + r.lista.id);
  }
  if (v === 'cancelar' && await B.confirmar('Cancelar a lista?', 'Ela para de reservar estoque. Dá para reabrir depois.', { sim: 'Cancelar lista', perigo: true })) {
    lista.status = 'cancelada';
    await ctx.D.salvar('listas', lista);
    await ctx.D.registrar('lista_cancelada', `cancelou a lista ${B.nomeLista(lista)}`, lista.id);
    ctx.atualizar();
  }
  if (v === 'excluir' && await B.confirmar('Excluir a lista?', 'Some a lista, os itens e o histórico de separação dela. <b>Perdas e manutenções que ela gerou continuam registradas.</b>', { sim: 'Excluir', perigo: true })) {
    await ctx.D.excluir('linhas', ctx.linhasDa(lista.id).map(l => l.id), { silencioso: true });
    await ctx.D.excluir('listas', lista.id);
    await ctx.D.registrar('lista_excluida', `excluiu a lista ${B.nomeLista(lista)} (OS ${lista.os || '—'})`, null);
    ctx.ir('listas');
  }
}

/* Mover telas para outra sala do evento — ou, numa lista solta, dividir em salas (vira um evento).
 * Cada sala é uma lista própria: separa, confere, carrega e volta à parte. Só antes de começar a separar. */
async function moverTelas(ctx, lista) {
  const { B, M } = ctx;
  const solta = !lista.grupo;
  const destinos = solta ? [] : M.salasDoEvento(ctx.est.listas, lista.grupo)
    .filter(l => l.id !== lista.id && ['rascunho', 'pronta'].includes(l.status) && !ctx.linhasDa(l.id).some(M.temSeparacao));
  const res = await B.modal({
    titulo: solta ? 'Dividir em salas' : 'Mover telas para outra sala',
    corpo: `<p class="dica" style="margin-top:0">${solta
      ? 'A lista vira um <b>evento</b> com uma lista por sala: cada sala é separada, conferida e carregada à parte (bom para hotel grande ou mais de um hotel).'
      : 'As telas marcadas vão para a outra sala; os itens das duas salas são refeitos pelas regras.'}</p>
      ${solta ? `<label class="campo"><span>Nome desta sala (fica com as telas não marcadas)</span><input class="f-esta" value="${B.esc(lista.sala || '')}" placeholder="Ex.: Plenária"></label>` : ''}
      <div class="h2" style="margin:12px 0 6px;font-size:13px">Telas que mudam de sala</div>
      ${(lista.telas || []).map(t => `<label class="linha-flex" style="margin:6px 0"><input type="checkbox" class="f-t" value="${B.esc(t.id)}" style="width:20px;height:20px"> <span class="cresce">${B.esc(t.nome || 'Tela sem nome')}</span>
        <span class="peq mut2">${t.largura_m ? B.num(t.largura_m) + ' × ' + B.num(t.altura_m) + ' m' : ''}</span></label>`).join('')}
      <label class="campo" style="margin-top:12px"><span>Para qual sala</span><select class="f-dest">
        ${destinos.map(l => `<option value="${B.esc(l.id)}">${B.esc(l.sala || 'Sem nome')}</option>`).join('')}
        <option value="__nova" ${destinos.length ? '' : 'selected'}>Nova sala…</option></select></label>
      <label class="campo f-nova-box" ${destinos.length ? 'hidden' : ''}><span>Nome da nova sala</span><input class="f-nova" placeholder="Ex.: Foyer, Hotel B"></label>`,
    aoAbrir: el => { const s = el.querySelector('.f-dest'); s.onchange = () => { el.querySelector('.f-nova-box').hidden = s.value !== '__nova'; }; },
    botoes: [{ txt: 'Cancelar', valor: null }, {
      txt: solta ? 'Dividir' : 'Mover', cls: 'pri',
      validar: el => {
        const ids = [...el.querySelectorAll('.f-t:checked')].map(i => i.value);
        if (!ids.length) { B.toast('Marque as telas que mudam de sala.'); return false; }
        if (solta && ids.length === (lista.telas || []).length) { B.toast('Deixe ao menos uma tela nesta sala.'); return false; }
        if (solta && !el.querySelector('.f-esta').value.trim()) { el.querySelector('.f-esta').classList.add('erro'); B.toast('Dê um nome a esta sala.'); return false; }
        if (el.querySelector('.f-dest').value === '__nova' && !el.querySelector('.f-nova').value.trim()) { el.querySelector('.f-nova').classList.add('erro'); B.toast('Dê um nome à nova sala.'); return false; }
        return true;
      },
      valor: el => ({
        ids: [...el.querySelectorAll('.f-t:checked')].map(i => i.value),
        esta: solta ? el.querySelector('.f-esta').value.trim() : null,
        dest: el.querySelector('.f-dest').value, nova: el.querySelector('.f-nova').value.trim()
      })
    }]
  });
  if (!res) return;
  if (solta) Object.assign(lista, { grupo: ctx.novoId(), sala: res.esta, ordem_sala: 0 });
  const irmas = M.salasDoEvento(ctx.est.listas, lista.grupo);
  let destino = res.dest === '__nova' ? null : ctx.lista(res.dest);
  if (!destino) {
    destino = {
      id: ctx.novoId(), grupo: lista.grupo, sala: res.nova, ordem_sala: Math.max(0, ...irmas.map(l => l.ordem_sala ?? 0)) + 1,
      os: lista.os || '', evento: lista.evento || '', cliente: lista.cliente || '', local: lista.local || '', ida: lista.ida || null, volta: lista.volta || null,
      responsavel_projeto: lista.responsavel_projeto || '', obs: '', status: 'rascunho', telas: [],
      criada_em: ctx.agora(), criada_por: ctx.quem(), sep: null, conf: null, ret: null
    };
  }
  const r = M.moverTelas(lista, destino, res.ids);
  Object.assign(lista, r.origem);
  await ctx.D.salvar('listas', lista, { silencioso: true });
  await ctx.D.salvar('listas', r.destino, { silencioso: true });
  await recalcularLista(ctx, lista, { forcar: true });
  await recalcularLista(ctx, ctx.lista(r.destino.id) || r.destino, { forcar: true });
  await ctx.D.registrar('lista_sala', `${solta ? 'dividiu a lista em salas' : 'moveu telas de sala'}: ${res.ids.length} tela${res.ids.length === 1 ? '' : 's'} de ${lista.sala || ''} para ${r.destino.sala || ''} (${lista.evento || ''})`, lista.id);
  B.toast(`${res.ids.length} tela${res.ids.length === 1 ? '' : 's'} foram para ${r.destino.sala}.`);
  ctx.ir('evento/' + lista.grupo);
}
