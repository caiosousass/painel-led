/* Tela: Catálogo — os itens do setor (a "lista zerada"), com quantidade de inventário e dados do painel. */

let busca = '';

export function render(ctx, [abrir]) {
  const { B, M } = ctx;
  const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const q = norm(busca);
  const atual = M.estoqueAtual(ctx.est.catalogo, ctx.est.movimentos);
  const grupos = ctx.ORDEM_CAT.map(k => [k, ctx.est.catalogo.filter(c => c.cat === k && (!q || norm(c.nome).includes(q))).sort((a, b) => (a.ordem || 0) - (b.ordem || 0))]).filter(g => g[1].length);
  const sup = ctx.pode('catalogo');
  if (abrir) setTimeout(() => { const c = ctx.item(abrir); if (c) editarItem(ctx, c); history.replaceState(null, '', '#/catalogo'); }, 50);
  return `
  <div class="cab"><div><h1>Catálogo</h1><div class="sub">A lista zerada do setor, na ordem do galpão. ${ctx.est.catalogo.length} itens.</div></div>
    ${sup ? `<div class="acoes"><button class="btn pri novo">${B.ico('add')} Novo item</button></div>` : ''}</div>
  <div class="busca-linha"><input type="search" class="buscar" placeholder="Buscar item…" value="${B.esc(busca)}"></div>
  ${grupos.map(([k, its]) => `<div class="card" style="padding:10px 12px"><h2>${B.esc(ctx.CATEGORIAS[k])} <span class="conta">${its.length}</span></h2>
    ${its.map(c => `<div class="lin" data-c="${B.esc(c.id)}" style="${c.ativo === false ? 'opacity:.5' : ''};cursor:pointer">
      <div class="nome">${B.esc(c.nome)}<small>${c.painel ? B.esc(c.painel.modelo || '') + ` · ${c.painel.por_case} gab/case · ${c.painel.por_circuito} gab/circuito` : ''}${c.obs ? (c.painel ? ' · ' : '') + B.esc(c.obs) : ''}${c.ativo === false ? ' · inativo' : ''}</small></div>
      <span class="num ${c.qtd == null ? 'mut2' : ''}" style="font-weight:800">${c.qtd == null ? 'não contado' : B.num(atual.get(c.id))}</span>
      <span>${B.ico('chev')}</span></div>`).join('')}</div>`).join('') || '<div class="card vazio">Nada encontrado.</div>'}`;
}

export function ligar(el, ctx) {
  const bus = el.querySelector('.buscar');
  bus.addEventListener('input', () => { busca = bus.value; clearTimeout(bus._t); bus._t = setTimeout(() => { ctx.atualizar(); const b2 = document.querySelector('.buscar'); if (b2) { b2.focus(); b2.setSelectionRange(b2.value.length, b2.value.length); } }, 300); });
  const novo = el.querySelector('.novo');
  if (novo) novo.onclick = () => editarItem(ctx, null);
  el.querySelectorAll('[data-c]').forEach(r => { r.onclick = () => editarItem(ctx, ctx.item(r.dataset.c)); });
}

async function editarItem(ctx, c) {
  const { B } = ctx;
  const sup = ctx.pode('catalogo');
  const novo = !c;
  const it = Object.assign({ id: ctx.novoId(), nome: '', cat: 'energia', un: 'un', qtd: null, peso_kg: null, ordem: 2000, ativo: true, obs: '', painel: null }, c ? JSON.parse(JSON.stringify(c)) : {});
  const p = it.painel || {};
  const v = x => (x == null ? '' : String(x).replace('.', ','));
  const ro = sup ? '' : 'disabled';
  const r = await B.modal({
    titulo: novo ? 'Novo item' : it.nome, largo: true,
    corpo: `<label class="campo"><span>Nome</span><input class="f-nome" value="${B.esc(it.nome)}" ${ro}></label>
      <div class="grade g4 m1" style="margin-top:10px">
        <label class="campo"><span>Categoria</span><select class="f-cat" ${ro}>${ctx.ORDEM_CAT.map(k => `<option value="${k}" ${k === it.cat ? 'selected' : ''}>${B.esc(ctx.CATEGORIAS[k])}</option>`).join('')}</select></label>
        <label class="campo"><span>Unidade</span><select class="f-un" ${ro}>${['un', 'm', 'par', 'kg', 'rolo', 'conjunto', 'case'].map(u => `<option ${u === it.un ? 'selected' : ''}>${u}</option>`).join('')}</select></label>
        <label class="campo"><span>Inventário (contagem)</span><input class="f-qtd" inputmode="decimal" value="${v(it.qtd)}" placeholder="não contado" ${ro}></label>
        <label class="campo"><span>Peso unit. (kg)</span><input class="f-peso" inputmode="decimal" value="${v(it.peso_kg)}" ${ro}></label>
        <label class="campo"><span>Ordem no galpão</span><input class="f-ord" inputmode="numeric" value="${v(it.ordem)}" ${ro}></label>
        <label class="campo"><span>Ativo</span><select class="f-at" ${ro}><option value="1" ${it.ativo !== false ? 'selected' : ''}>Sim</option><option value="0" ${it.ativo === false ? 'selected' : ''}>Não (some das listas novas)</option></select></label>
      </div>
      <label class="campo" style="margin-top:10px"><span>Observação</span><input class="f-obs" value="${B.esc(it.obs || '')}" ${ro}></label>
      <div class="f-painel" ${it.cat === 'led' ? '' : 'hidden'}>
        <h3 style="font-size:14px;margin:16px 0 8px">Dados do painel (por gabinete)</h3>
        <div class="grade g4 m1">
          <label class="campo"><span>Modelo</span><input class="p-modelo" value="${B.esc(p.modelo || '')}" ${ro}></label>
          <label class="campo"><span>Largura (m)</span><input class="p-l" inputmode="decimal" value="${v(p.larg_m || 0.5)}" ${ro}></label>
          <label class="campo"><span>Altura (m)</span><input class="p-a" inputmode="decimal" value="${v(p.alt_m || 0.5)}" ${ro}></label>
          <label class="campo"><span>Peso (kg)</span><input class="p-kg" inputmode="decimal" value="${v(p.kg)}" ${ro}></label>
          <label class="campo"><span>Pixels largura</span><input class="p-pl" inputmode="numeric" value="${v(p.px_l)}" ${ro}></label>
          <label class="campo"><span>Pixels altura</span><input class="p-pa" inputmode="numeric" value="${v(p.px_a)}" ${ro}></label>
          <label class="campo"><span>Consumo máx (W)</span><input class="p-wm" inputmode="decimal" value="${v(p.w_max)}" ${ro}></label>
          <label class="campo"><span>Consumo médio (W)</span><input class="p-wd" inputmode="decimal" value="${v(p.w_med)}" ${ro}></label>
          <label class="campo"><span>Gabinetes por case</span><input class="p-pc" inputmode="numeric" value="${v(p.por_case || 6)}" ${ro}></label>
          <label class="campo"><span>Gabinetes por circuito</span><input class="p-ci" inputmode="numeric" value="${v(p.por_circuito || 12)}" ${ro}></label>
          <label class="campo"><span>Pixels por porta</span><input class="p-pp" inputmode="numeric" value="${v(p.px_porta || 650000)}" ${ro}></label>
        </div>
        <p class="dica">Gabinetes por circuito e pixels por porta mudam a quantidade de cabos de tronco. Padrão 12 e 650.000 — confira com a prática.</p>
      </div>
      ${!novo ? `<p class="dica">Quantidade atual considera perdas, descartes e ajustes registrados. Para recontar, use "Ajustar inventário" na tela do item no Estoque.</p>` : ''}`,
    botoes: sup ? [{ txt: 'Cancelar', valor: null }].concat(!novo ? [{ txt: 'Ver no estoque', valor: 'estoque' }] : []).concat([{
      txt: 'Salvar', cls: 'pri',
      validar: el => { if (!el.querySelector('.f-nome').value.trim()) { el.querySelector('.f-nome').classList.add('erro'); return false; } return true; },
      valor: el => {
        const n = s => B.lerNum(el.querySelector(s).value);
        const out = Object.assign({}, it, {
          nome: el.querySelector('.f-nome').value.trim(), cat: el.querySelector('.f-cat').value, un: el.querySelector('.f-un').value,
          qtd: n('.f-qtd'), peso_kg: n('.f-peso'), ordem: n('.f-ord') || 0, ativo: el.querySelector('.f-at').value === '1', obs: el.querySelector('.f-obs').value.trim()
        });
        out.painel = out.cat === 'led' ? {
          modelo: el.querySelector('.p-modelo').value.trim(), larg_m: n('.p-l') || 0.5, alt_m: n('.p-a') || 0.5, kg: n('.p-kg') || 0,
          px_l: n('.p-pl') || 0, px_a: n('.p-pa') || 0, w_max: n('.p-wm') || 0, w_med: n('.p-wd') || 0,
          por_case: n('.p-pc') || 6, por_circuito: n('.p-ci') || 12, px_porta: n('.p-pp') || 650000
        } : null;
        return out;
      }
    }]) : [{ txt: 'Fechar', valor: null }, { txt: 'Ver no estoque', valor: 'estoque', cls: 'pri' }],
    aoAbrir: el => { const s = el.querySelector('.f-cat'); s.onchange = () => { el.querySelector('.f-painel').hidden = s.value !== 'led'; }; }
  });
  if (!r) return;
  if (r === 'estoque') return ctx.ir('item/' + it.id);
  const mudouQtd = c && c.qtd !== r.qtd;
  await ctx.D.salvar('catalogo', r, { silencioso: true });
  await ctx.D.registrar('catalogo', `${novo ? 'cadastrou' : 'alterou'} o item ${r.nome}${mudouQtd ? ` (inventário ${c.qtd == null ? '—' : c.qtd} → ${r.qtd == null ? '—' : r.qtd})` : ''}`, r.id);
  ctx.atualizar();
}
