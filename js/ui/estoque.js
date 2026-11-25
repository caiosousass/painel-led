/* Tela: Estoque — quanto tem, quanto está em evento, em manutenção e livre; detalhe por item. */

let dia = null;
let cenario = false; // com rascunhos
let busca = '';
let catFiltro = '';
let soProblema = false;

export function render(ctx, params, rota) {
  return rota === 'item' ? renderItem(ctx, params[0]) : renderLista(ctx);
}
export function ligar(el, ctx, params, rota) {
  return rota === 'item' ? ligarItem(el, ctx, params[0]) : ligarLista(el, ctx);
}

function renderLista(ctx) {
  const { B, M } = ctx;
  const hoje = ctx.hoje();
  const d = dia || hoje;
  const disp = M.disponibilidade(ctx.estadoEstoque(), { ini: d, fim: d, hoje, comRascunhos: cenario });
  const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const q = norm(busca);
  const itens = ctx.est.catalogo.filter(c => c.ativo !== false)
    .filter(c => !catFiltro || c.cat === catFiltro)
    .filter(c => !q || norm(c.nome).includes(q))
    .map(c => ({ c, x: disp.get(c.id) }))
    .filter(({ x }) => !soProblema || (x && x.dias[0] && x.dias[0].livre != null && x.dias[0].livre < 0))
    .sort((a, b) => (a.c.ordem || 0) - (b.c.ordem || 0));
  const negativos = [...disp.values()].filter(x => x.dias[0] && x.dias[0].livre != null && x.dias[0].livre < 0).length;
  const semConta = ctx.est.catalogo.filter(c => c.ativo !== false && (c.qtd == null || c.qtd === '')).length;
  return `
  <div class="cab"><div><h1>Estoque</h1><div class="sub">Inventário − manutenção − o que está reservado em listas no dia.</div></div></div>
  <div class="card">
    <div class="grade g3 m1">
      <label class="campo"><span>Disponível no dia</span><input type="date" class="f-dia" value="${d}"></label>
      <label class="campo"><span>Categoria</span><select class="f-cat"><option value="">Todas</option>${ctx.ORDEM_CAT.map(k => `<option value="${k}" ${k === catFiltro ? 'selected' : ''}>${B.esc(ctx.CATEGORIAS[k])}</option>`).join('')}</select></label>
      <label class="campo"><span>Buscar</span><input type="search" class="f-busca" value="${B.esc(busca)}" placeholder="Nome do item…"></label>
    </div>
    <div class="chips" style="margin-top:10px">
      <button class="chip ${cenario ? 'on' : ''} f-cen">Contar rascunhos também</button>
      <button class="chip ${soProblema ? 'on' : ''} f-prob">Só o que falta${negativos ? ' (' + negativos + ')' : ''}</button>
    </div>
    ${semConta ? `<p class="dica">${semConta} itens estão sem quantidade no inventário — o sistema não acusa falta deles. Preencha em Catálogo.</p>` : ''}
  </div>
  <div class="card" style="padding:6px 10px">
    <table class="tab resp"><thead><tr><th>Item</th><th class="n">Inventário</th><th class="n">Manut.</th><th class="n">Em listas</th><th class="n">Livre</th></tr></thead><tbody>
    ${itens.map(({ c, x }) => {
      const dd = x && x.dias[0];
      const livre = dd ? dd.livre : null;
      const led = c.painel && c.painel.por_case ? ` <span class="mut2 peq">(${B.num(Math.round((x && x.total || 0) * c.painel.por_case))} gab)</span>` : '';
      return `<tr class="clic" data-item="${B.esc(c.id)}"><td class="primeira">${B.esc(c.nome)}</td>
        <td class="n" data-r="inv.">${x && x.total != null ? B.num(x.total) + led : '<span class="mut2">não contado</span>'}</td>
        <td class="n" data-r="manut.">${x && x.manut ? B.num(x.manut) : '—'}</td>
        <td class="n" data-r="listas">${dd && dd.uso ? B.num(dd.uso) : '—'}</td>
        <td class="n ${livre != null && livre < 0 ? 'vermelho' : ''}" data-r="livre"><b>${livre == null ? '—' : B.num(livre)}</b></td></tr>`;
    }).join('') || '<tr><td colspan="5" class="vazio">Nada encontrado.</td></tr>'}
    </tbody></table>
  </div>`;
}

function ligarLista(el, ctx) {
  el.querySelector('.f-dia').onchange = e => { dia = e.target.value || null; ctx.atualizar(); };
  el.querySelector('.f-cat').onchange = e => { catFiltro = e.target.value; ctx.atualizar(); };
  const b = el.querySelector('.f-busca');
  b.addEventListener('input', () => { busca = b.value; clearTimeout(b._t); b._t = setTimeout(ctx.atualizar, 250); });
  el.querySelector('.f-cen').onclick = () => { cenario = !cenario; ctx.atualizar(); };
  el.querySelector('.f-prob').onclick = () => { soProblema = !soProblema; ctx.atualizar(); };
  el.querySelectorAll('[data-item]').forEach(tr => { tr.onclick = () => ctx.ir('item/' + tr.dataset.item); });
}

/* ---------------- detalhe do item ---------------- */
const TIPO_MOV = { perda: ['Não voltou', 'vermelho'], recuperado: ['Apareceu', 'verde'], descarte: ['Descartado', 'vermelho'], ajuste: ['Ajuste de inventário', 'azul'], entrada: ['Entrada', 'verde'] };

function renderItem(ctx, id) {
  const { B, M } = ctx;
  const c = ctx.item(id);
  if (!c) return `<button class="voltar" data-ir="estoque">${B.ico('back')} Estoque</button><div class="card vazio">Item não encontrado.</div>`;
  const hoje = ctx.hoje();
  const fim = M.D.mais(hoje, 44);
  const disp = M.disponibilidade(ctx.estadoEstoque(), { ini: hoje, fim, hoje, itens: [id], comRascunhos: cenario }).get(id);
  const atual = M.estoqueAtual([c], ctx.est.movimentos).get(id);
  const movs = ctx.est.movimentos.filter(m => m.item === id).sort((a, b) => String(b.data || '').localeCompare(String(a.data || '')));
  const recup = new Map();
  for (const m of ctx.est.movimentos) if (m.tipo === 'recuperado' && m.ref) recup.set(m.ref, (recup.get(m.ref) || 0) + +m.qtd);
  const listasUso = new Map();
  for (const d of disp.dias) for (const q of d.quem) listasUso.set(q.lista, Math.max(listasUso.get(q.lista) || 0, q.qtd));
  const mans = ctx.est.manutencoes.filter(m => m.item === id && M.STATUS_MANUT_ABERTA.includes(m.status));
  const maxBar = Math.max(1, ...(disp.dias.map(d => Math.abs(d.livre || 0))), atual || 0);
  return `
  <button class="voltar" data-ir="estoque">${B.ico('back')} Estoque</button>
  <div class="cab"><div><h1>${B.esc(c.nome)}</h1><div class="sub">${B.esc(ctx.CATEGORIAS[c.cat] || c.cat)}${c.obs ? ' · ' + B.esc(c.obs) : ''}</div></div>
    <div class="acoes">${ctx.pode('estoque') ? `<button class="btn ajustar">Ajustar inventário</button>` : ''}${ctx.ve('catalogo') ? `<button class="btn" data-ir="catalogo/${B.esc(id)}">${ctx.pode('catalogo') ? 'Editar item' : 'Ver no catálogo'}</button>` : ''}</div></div>
  <div class="stats">
    <div class="stat"><div class="rot">Inventário hoje</div><b>${atual == null ? '—' : B.num(atual)}</b><div class="sub">${c.qtd == null ? 'não contado' : 'contagem ' + B.num(c.qtd) + (movs.length ? ' ± movimentos' : '')}</div></div>
    <div class="stat ${disp.manut ? 'vermelho' : ''}"><div class="rot">Em manutenção</div><b>${B.num(disp.manut)}</b></div>
    <div class="stat"><div class="rot">Em listas hoje</div><b>${B.num(disp.dias[0] ? disp.dias[0].uso : 0)}</b></div>
    <div class="stat ${disp.minimo != null && disp.minimo < 0 ? 'vermelho' : 'verde'}"><div class="rot">Menor livre (45 dias)</div><b>${disp.minimo == null ? '—' : B.num(disp.minimo)}</b></div>
  </div>
  ${atual != null ? `<div class="card"><h2>Livre nos próximos 45 dias</h2>
    <div class="dias">${disp.dias.map(d => `<i class="${d.livre < 0 ? 'neg' : ''}" style="height:${Math.max(3, Math.abs(d.livre) / maxBar * 100)}%" title="${B.dataSemana(d.dia)}: ${B.num(d.livre)} livres"></i>`).join('')}</div>
    <div class="dias-leg"><span>${B.dataBR(hoje)}</span><span>${B.dataBR(M.D.mais(hoje, 22))}</span><span>${B.dataBR(fim)}</span></div></div>` : ''}
  <div class="card"><h2>Listas que usam este item</h2>
    ${listasUso.size ? [...listasUso.entries()].map(([lid, q]) => { const l = ctx.lista(lid) || {}; return `<button class="alerta-it" data-ir="lista/${B.esc(lid)}">${B.ico('listas')}<span>${B.esc(B.nomeLista(l))} — ${B.num(q)}<small>${B.dataBR(l.ida)} → ${B.dataBR(l.volta)} · ${(B.STATUS_LISTA[l.status] || [l.status])[0]}</small></span></button>`; }).join('') : '<p class="muted" style="margin:0">Nenhuma lista nos próximos 45 dias.</p>'}
  </div>
  ${mans.length ? `<div class="card"><h2>Em manutenção</h2>${mans.map(m => `<div class="peq" style="margin:4px 0">${B.num(+m.qtd - (+m.consertadas || 0) - (+m.descartadas || 0))} — ${B.esc(m.defeito || '')} <span class="mut2">desde ${B.dataBR(m.aberta_em)}</span></div>`).join('')}<button class="btn sm" data-ir="manutencao" style="margin-top:6px">Abrir manutenção</button></div>` : ''}
  <div class="card"><h2>Movimentos</h2>
    ${movs.length ? movs.map(m => {
      const t = TIPO_MOV[m.tipo] || [m.tipo, ''];
      const resta = m.tipo === 'perda' ? Math.abs(+m.qtd) - (recup.get(m.id) || 0) : 0;
      const l = m.lista ? ctx.lista(m.lista) : null;
      return `<div class="linha-flex" style="padding:8px 0;border-bottom:1px solid var(--line)"><span class="cresce peq">${B.pill(t[0], t[1])} <b class="${+m.qtd < 0 ? 'vermelho' : 'verde'}">${+m.qtd > 0 ? '+' : ''}${B.num(m.qtd)}</b>
        ${l ? ' · ' + B.esc(B.nomeLista(l)) : ''}${m.obs ? ' · ' + B.esc(m.obs) : ''}<br><span class="mut2">${B.dataBR(m.data, true)} · ${B.esc(m.por || '—')}</span></span>
        ${resta > 0 && (ctx.pode('estoque') || ctx.pode('retorno')) ? `<button class="btn sm apareceu" data-id="${B.esc(m.id)}" data-resta="${resta}">Apareceu</button>` : ''}</div>`;
    }).join('') : '<p class="muted" style="margin:0">Nenhuma perda, descarte ou ajuste registrado.</p>'}
  </div>`;
}

function ligarItem(el, ctx, id) {
  const { B, M } = ctx;
  el.querySelectorAll('[data-ir]').forEach(b => { b.onclick = () => ctx.ir(b.dataset.ir); });
  const c = ctx.item(id);
  if (!c) return;
  const aj = el.querySelector('.ajustar');
  if (aj) aj.onclick = async () => {
    const atual = M.estoqueAtual([c], ctx.est.movimentos).get(id);
    const v = await B.pedirNumero('Contagem de ' + c.nome, { rotulo: 'Quantos existem de fato hoje?', valor: atual == null ? '' : atual, dica: 'Registra a diferença como ajuste (com seu nome) — o histórico não é apagado.' });
    if (v == null) return;
    const motivo = await B.pedirTexto('Motivo do ajuste', { rotulo: 'Ex.: contagem de inventário, compra, sumiu no galpão', obrigatorio: true });
    if (!motivo) return;
    if (atual == null) {
      await ctx.D.salvar('catalogo', Object.assign({}, c, { qtd: v }), { silencioso: true });
      await ctx.D.registrar('inventario', `contou ${v} × ${c.nome} (${motivo})`, id);
    } else if (v !== atual) {
      await ctx.D.salvar('movimentos', { id: ctx.novoId(), item: id, qtd: +(v - atual).toFixed(3), tipo: v > atual ? 'entrada' : 'ajuste', data: ctx.hoje(), por: ctx.quem(), obs: motivo }, { silencioso: true });
      await ctx.D.registrar('inventario', `ajustou ${c.nome}: ${B.num(atual)} → ${B.num(v)} (${motivo})`, id);
    }
    ctx.atualizar();
  };
  el.querySelectorAll('.apareceu').forEach(b => {
    b.onclick = async () => {
      const perda = ctx.est.movimentos.find(m => m.id === b.dataset.id);
      const v = await B.pedirNumero('Quantos apareceram?', { rotulo: c.nome, valor: b.dataset.resta, max: +b.dataset.resta });
      if (!v) return;
      const mv = M.recuperarPerda(perda, { novoId: ctx.novoId, hoje: ctx.hoje(), por: ctx.quem(), qtd: Math.min(v, +b.dataset.resta) });
      await ctx.D.salvar('movimentos', mv, { silencioso: true });
      await ctx.D.registrar('perda_recuperada', `registrou que ${mv.qtd} × ${c.nome} apareceram`, id);
      ctx.atualizar();
    };
  });
}
