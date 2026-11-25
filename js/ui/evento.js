/* Tela: Evento com várias salas (OS principal + sublistas).
 * Cada sala/hotel é uma lista própria — separa, confere, carrega e volta à parte. Aqui fica o conjunto:
 * o andamento de cada sala, o total do evento por item, imprimir todas e o projeto do evento inteiro. */
import { cartaoLista, ligarCartoes, novaTela } from './listas.js';
import { imprimirEvento } from './imprimir.js';
import { exportarProjetoEvento } from './projeto.js';

export function render(ctx, [grupo]) {
  const { B, M } = ctx;
  const salas = M.salasDoEvento(ctx.est.listas, grupo);
  if (!salas.length) return `<button class="voltar" data-ir="listas">${B.ico('back')} Listas</button><div class="card vazio">Evento não encontrado (as salas podem ter sido excluídas).</div>`;
  const l0 = salas[0];
  const vivas = salas.filter(l => l.status !== 'cancelada');
  const idas = [...new Set(vivas.map(l => l.ida).filter(Boolean))].sort();
  const voltas = [...new Set(vivas.map(l => l.volta).filter(Boolean))].sort();
  const quando = idas.length ? `${B.dataSemana(idas[0])}${voltas.length ? ' → ' + B.dataSemana(voltas[voltas.length - 1]) : ''}` : 'sem data';
  const datasDiferentes = idas.length > 1 || voltas.length > 1;

  // total do evento: o que sai do galpão somando todas as salas
  const tot = M.totaisEvento(salas, ctx.est.linhas);
  const cat = ctx.catIdx();
  const ordemGrupo = [...ctx.ORDEM_CAT, 'outros'];
  const itens = [...tot.values()].sort((a, b) => {
    const ca = cat.get(a.item) || {}, cb = cat.get(b.item) || {};
    return ordemGrupo.indexOf(ca.cat || 'outros') - ordemGrupo.indexOf(cb.cat || 'outros') || (ca.ordem || 0) - (cb.ordem || 0);
  });
  const colunas = vivas.length <= 5;
  const nomeSala = l => l.sala || 'Sem sala';
  const tabela = itens.length ? `<div class="tab-evento"><table>
      <thead><tr><th>Item</th><th class="n">Total</th>${colunas ? vivas.map(l => `<th class="n">${B.esc(nomeSala(l))}</th>`).join('') : '<th>Por sala</th>'}</tr></thead>
      <tbody>${itens.map(t => `<tr><td>${B.esc(ctx.nomeItem(t.item))}</td><td class="n"><b>${B.num(t.total)}</b></td>${colunas
        ? vivas.map(l => `<td class="n">${t.porSala.get(l.id) ? B.num(t.porSala.get(l.id)) : '<span class="mut2">—</span>'}</td>`).join('')
        : `<td class="peq mut2">${vivas.filter(l => t.porSala.get(l.id)).map(l => B.esc(nomeSala(l)) + ' ' + B.num(t.porSala.get(l.id))).join(' · ')}</td>`}</tr>`).join('')}</tbody>
    </table></div>` : '<p class="muted">Os itens aparecem quando as salas tiverem telas com medida.</p>';

  const pode = ctx.pode('listas');
  return `
  <button class="voltar" data-ir="listas">${B.ico('back')} Listas</button>
  <div class="cab"><div class="cresce"><h1>${B.esc(l0.evento || 'Evento sem nome')}</h1>
    <div class="sub">${l0.os ? 'OS ' + B.esc(l0.os) + ' · ' : ''}${B.pillStatus(M.statusEvento(salas))} <span class="mut2">· ${quando}${l0.cliente ? ' · ' + B.esc(l0.cliente) : ''}</span></div></div>
    <div class="acoes"><button class="icon-btn imprimir-todas" title="Imprimir todas as salas">${B.ico('print')}</button></div></div>

  <div class="card"><h2>Salas <span class="conta">${salas.length}</span><span class="dir peq mut2">cada sala separa e carrega à parte</span></h2>
    <div class="lcards">${salas.map(l => cartaoLista(ctx, l, { soSala: true })).join('')}</div>
    ${pode ? `<button class="btn nova-sala" style="margin-top:10px">${B.ico('add')} Nova sala / local</button>` : ''}
  </div>

  <div class="grade g2 m1" style="margin-bottom:14px">
    <button class="btn grande imprimir-todas">${B.ico('print')} Imprimir todas as salas</button>
    <button class="btn grande projeto-evento">${B.ico('painel')} Projeto do evento (PDF)</button>
  </div>

  <details class="card"><summary class="h2" style="cursor:pointer;list-style:none">Dados do evento <span class="dir peq mut2" style="text-transform:none;letter-spacing:0">vale para todas as salas ▾</span></summary>
    <div class="grade g3" style="margin-top:12px">
      <label class="campo"><span>OS</span><input data-ec="os" value="${B.esc(l0.os || '')}" ${pode ? '' : 'disabled'}></label>
      <label class="campo"><span>Evento</span><input data-ec="evento" value="${B.esc(l0.evento || '')}" ${pode ? '' : 'disabled'}></label>
      <label class="campo"><span>Cliente / agência</span><input data-ec="cliente" value="${B.esc(l0.cliente || '')}" ${pode ? '' : 'disabled'}></label>
      <label class="campo"><span>Ida (sai do galpão)</span><input type="date" data-ec="ida" value="${idas.length === 1 ? idas[0] : ''}" ${pode ? '' : 'disabled'}></label>
      <label class="campo"><span>Volta</span><input type="date" data-ec="volta" value="${voltas.length === 1 ? voltas[0] : ''}" ${pode ? '' : 'disabled'}></label>
    </div>
    ${datasDiferentes ? '<p class="dica">As salas têm datas diferentes (cada uma no seu editor). Mudar aqui coloca a mesma data em todas.</p>' : ''}
  </details>

  <div class="card"><h2>Total do evento <span class="conta">${itens.length}</span><span class="dir peq mut2">o que sai do galpão somando as salas</span></h2>
    ${tabela}
  </div>`;
}

export function ligar(el, ctx, [grupo]) {
  const { B, M } = ctx;
  el.querySelectorAll('[data-ir]').forEach(b => { b.onclick = () => ctx.ir(b.dataset.ir); });
  ligarCartoes(el, ctx);
  const salas = M.salasDoEvento(ctx.est.listas, grupo);
  if (!salas.length) return;
  const vivas = () => M.salasDoEvento(ctx.est.listas, grupo).filter(l => l.status !== 'cancelada');

  el.querySelectorAll('.imprimir-todas').forEach(b => { b.onclick = () => imprimirEvento(ctx, vivas()); });
  el.querySelector('.projeto-evento').onclick = async () => {
    try {
      const n = await exportarProjetoEvento(ctx, vivas());
      await ctx.D.registrar('projeto', `exportou o projeto do evento ${salas[0].evento || ''} (${n} folha${n === 1 ? '' : 's'}, ${vivas().length} salas)`, salas[0].id);
    } catch (e) { B.toast(e.message, { tipo: 'erro' }); }
  };

  if (!ctx.pode('listas')) return;
  el.querySelectorAll('[data-ec]').forEach(inp => {
    inp.addEventListener('change', async () => {
      const campo = inp.dataset.ec;
      const v = inp.value.trim() || (inp.type === 'date' ? null : '');
      const todas = M.salasDoEvento(ctx.est.listas, grupo);
      for (const l of todas) { l[campo] = v; await ctx.D.salvar('listas', l, { silencioso: true }); }
      B.toast(`Atualizado nas ${todas.length} salas.`);
      ctx.atualizar();
    });
  });
  el.querySelector('.nova-sala').onclick = () => novaSala(ctx, grupo);
}

/* Nova sala no evento: copia os dados do evento e abre a sala para pôr as telas */
export async function novaSala(ctx, grupo, { nome } = {}) {
  const { B, M } = ctx;
  const salas = M.salasDoEvento(ctx.est.listas, grupo);
  const l0 = salas[0];
  const sala = nome || await B.pedirTexto('Nova sala / local', { rotulo: 'Nome da sala ou local', obrigatorio: true, dica: 'Ex.: Foyer, Ballroom 2, Hotel B — Plenária. O que vai para lá é separado e carregado à parte.' });
  if (!sala) return null;
  const lista = {
    id: ctx.novoId(), grupo, sala: sala.trim(), ordem_sala: Math.max(-1, ...salas.map(l => l.ordem_sala ?? -1)) + 1,
    os: l0.os || '', evento: l0.evento || '', cliente: l0.cliente || '', local: l0.local || '', ida: l0.ida || null, volta: l0.volta || null,
    responsavel_projeto: l0.responsavel_projeto || '', obs: '', status: 'rascunho', telas: [novaTela(ctx)],
    criada_em: ctx.agora(), criada_por: ctx.quem(), sep: null, conf: null, ret: null
  };
  await ctx.D.salvar('listas', lista);
  await ctx.D.registrar('lista_criada', `criou a sala ${lista.sala} no evento ${lista.evento || ''}`, lista.id);
  ctx.ir('lista/' + lista.id);
  return lista;
}
