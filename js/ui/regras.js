/* Tela: Regras — o motor que transforma "painel + medida" em lista. Editável sem programar, com simulador. */

const sim = { painel: 'led-v10', largura_m: 6, altura_m: 3.5, montagem: 'chao' };
let busca = '';

// base que conta outro item: "item:x" (um) ou "itens:a,b,c" (soma de vários)
const ehBaseItem = b => /^itens?:/.test(b || '');

const lerFator = v => {
  const s = String(v || '').trim().replace(',', '.').replace('÷', '1/');
  const m = s.match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/);
  if (m) return +m[1] / +m[2];
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
};

export function render(ctx) {
  const { B, M } = ctx;
  const cat = ctx.catIdx();
  const leds = ctx.est.catalogo.filter(c => c.cat === 'led' && c.ativo !== false);
  const tela = { id: 'sim', nome: '', painel: sim.painel, modo: 'medida', largura_m: sim.largura_m, altura_m: sim.altura_m, montagem: sim.montagem };
  const res = M.calcularSugestoes([tela], ctx.est.catalogo, ctx.regrasAtivas());
  const b = res.telas[0] && res.telas[0].bases;
  const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const q = norm(busca);
  const regras = ctx.est.regras.slice().filter(r => {
    if (!q) return true;
    const f = B.fraseRegra(r, cat);
    return norm(f.alvo + ' ' + f.conta + ' ' + (r.obs || '')).includes(q);
  });
  const porItem = new Map();
  for (const r of regras) { const k = r.item; if (!porItem.has(k)) porItem.set(k, []); porItem.get(k).push(r); }
  const ordem = [...porItem.keys()].sort((a, b) => (a === '@painel' ? -1 : b === '@painel' ? 1 : ((cat.get(a) || {}).ordem || 0) - ((cat.get(b) || {}).ordem || 0)));
  const sup = ctx.pode('regras');
  const erros = res.erros.filter(e => e.tipo === 'ciclo');

  return `
  <div class="cab"><div><h1>Regras</h1><div class="sub">Cada regra diz quanto de um item vai por gabinete, por circuito, por apoio… Saíram das listas conferidas — ajuste à vontade.</div></div>
    ${sup ? `<div class="acoes"><button class="btn pri nova">${B.ico('add')} Nova regra</button></div>` : ''}</div>

  <div class="card dica"><h2>Simulador — confira sem criar lista</h2>
    <div class="grade g4 m1">
      <label class="campo"><span>Painel</span><select class="s-painel">${leds.map(c => `<option value="${B.esc(c.id)}" ${c.id === sim.painel ? 'selected' : ''}>${B.esc(c.nome.replace('Case de Led ', ''))}</option>`).join('')}</select></label>
      <label class="campo"><span>Largura (m)</span><input inputmode="decimal" class="s-l" data-k="s-l" value="${String(sim.largura_m).replace('.', ',')}"></label>
      <label class="campo"><span>Altura (m)</span><input inputmode="decimal" class="s-a" data-k="s-a" value="${String(sim.altura_m).replace('.', ',')}"></label>
      <label class="campo"><span>Montagem</span><select class="s-m">${Object.entries(B.MONTAGEM).map(([k, v]) => `<option value="${k}" ${k === sim.montagem ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
    </div>
    ${b ? `<p class="peq" style="margin:10px 0 6px"><b>${b.colunas} × ${b.linhas} = ${b.gabinetes} gabinetes</b> · ${b.cases} cases · ${b.circuitos} circuitos · ${b.portas} portas · ${b.apoios} apoios de mão francesa</p>` : ''}
    ${erros.length ? `<p class="vermelho peq">Regras em ciclo (ignoradas): ${erros.map(e => B.esc(e.regra)).join(', ')}</p>` : ''}
    <details><summary class="link" style="cursor:pointer">Ver a lista que sairia (${res.itens.size} itens)</summary>
      <table class="tab" style="margin-top:8px"><tbody>${[...res.itens.entries()].sort((a, b) => ((cat.get(a[0]) || {}).ordem || 0) - ((cat.get(b[0]) || {}).ordem || 0)).map(([id, it]) => `<tr><td>${B.esc(ctx.nomeItem(id))}<div class="peq mut2">${it.origens.map(o => B.esc(B.fraseOrigem(Object.assign({}, o, { tela_nome: '', tela: 'x' }), cat))).join('<br>')}</div></td><td class="n"><b>${B.num(it.qtd)}</b></td></tr>`).join('')}</tbody></table>
    </details>
  </div>

  <div class="busca-linha"><input type="search" class="buscar" placeholder="Buscar regra por item…" value="${B.esc(busca)}"></div>
  ${ordem.map(it => {
    const nome = it === '@painel' ? 'Case do painel (o próprio painel da tela)' : ctx.nomeItem(it);
    const qSim = it === '@painel' ? (res.itens.get(sim.painel) || {}).qtd : (res.itens.get(it) || {}).qtd;
    return `<div class="card" style="padding:12px"><div class="linha-flex" style="margin-bottom:6px"><b class="cresce">${B.esc(nome)}</b>${qSim ? `<span class="pill azul">simulador: ${B.num(qSim)}</span>` : ''}</div>
      ${porItem.get(it).map(r => {
        const f = B.fraseRegra(r, cat);
        const filtros = [];
        if (r.escopo === 'lista') filtros.push('uma vez por lista');
        if (r.paineis && r.paineis.length) filtros.push('só ' + r.paineis.map(p => (ctx.nomeItem(p) || p).replace('Case de Led ', '')).join(', '));
        if (r.montagens && r.montagens.length) filtros.push('só ' + r.montagens.map(m => B.MONTAGEM[m] || m).join(', '));
        return `<div class="lin" data-r="${B.esc(r.id)}" style="${r.ativa === false ? 'opacity:.5' : ''}">
          <div class="nome">${B.esc(f.conta)}<small>${filtros.length ? B.esc(filtros.join(' · ')) + ' — ' : ''}${B.esc(r.obs || '')}</small></div>
          ${sup ? `<label class="linha-flex peq"><input type="checkbox" class="ativa" ${r.ativa !== false ? 'checked' : ''} style="width:20px;height:20px"></label>
          <div class="acoes-lin"><button class="icon-btn sm editar" title="Editar">${B.ico('regras')}</button></div>` : '<span></span><span></span>'}
        </div>`;
      }).join('')}</div>`;
  }).join('') || '<div class="card vazio">Nenhuma regra.</div>'}`;
}

export function ligar(el, ctx) {
  const { B } = ctx;
  el.querySelector('.s-painel').onchange = e => { sim.painel = e.target.value; ctx.atualizar(); };
  el.querySelector('.s-m').onchange = e => { sim.montagem = e.target.value; ctx.atualizar(); };
  el.querySelector('.s-l').onchange = e => { sim.largura_m = B.lerNum(e.target.value) || 0; ctx.atualizar(); };
  el.querySelector('.s-a').onchange = e => { sim.altura_m = B.lerNum(e.target.value) || 0; ctx.atualizar(); };
  const bus = el.querySelector('.buscar');
  bus.addEventListener('input', () => { busca = bus.value; clearTimeout(bus._t); bus._t = setTimeout(() => { ctx.atualizar(); const b2 = document.querySelector('.buscar'); if (b2) { b2.focus(); b2.setSelectionRange(b2.value.length, b2.value.length); } }, 300); });
  const nova = el.querySelector('.nova');
  if (nova) nova.onclick = () => editarRegra(ctx, null);
  el.querySelectorAll('[data-r]').forEach(row => {
    const r = ctx.est.regras.find(x => x.id === row.dataset.r);
    if (!r) return;
    const at = row.querySelector('.ativa');
    if (at) at.onchange = async () => {
      await ctx.D.salvar('regras', Object.assign({}, r, { ativa: at.checked }), { silencioso: true });
      await ctx.D.registrar('regra', `${at.checked ? 'ativou' : 'desativou'} a regra de ${r.item === '@painel' ? 'cases do painel' : ctx.nomeItem(r.item)}`, r.id);
      ctx.atualizar();
    };
    const ed = row.querySelector('.editar');
    if (ed) ed.onclick = () => editarRegra(ctx, r);
  });
}

async function editarRegra(ctx, r) {
  const { B, M } = ctx;
  const nova = !r;
  const reg = Object.assign({ id: ctx.novoId(), ativa: true, escopo: 'tela', paineis: [], montagens: [], cond: null, item: null, base: 'gabinetes', fator: 1, reserva: 0, adicional: 0, arred: 'cima', multiplo: 0, minimo: 0, maximo: 0, obs: '' }, r ? JSON.parse(JSON.stringify(r)) : {});
  if (nova) {
    const item = await B.escolherItem(ctx.est.catalogo, { titulo: 'Regra para qual item?', categorias: ctx.CATEGORIAS });
    if (!item) return;
    reg.item = item;
  }
  const leds = ctx.est.catalogo.filter(c => c.cat === 'led');
  const baseOpts = esc => {
    const lista = esc === 'lista' ? M.BASES_LISTA : M.BASES_TELA;
    const ehItem = ehBaseItem(reg.base);
    return lista.map(b => `<option value="${b}" ${b === reg.base ? 'selected' : ''}>${B.esc(B.BASE_NOME[b] || b)}</option>`).join('') +
      `<option value="__item" ${ehItem ? 'selected' : ''}>quantidade de outro item…</option>`;
  };
  const v = x => (x == null ? '' : String(x).replace('.', ','));
  const fatorTxt = f => { const t = B.fatorTexto(f); return t.startsWith('÷') ? '1/' + t.slice(2) : v(+(+f).toFixed(4)); };
  const corpo = () => `
    <p class="modal-txt"><b>${B.esc(reg.item === '@painel' ? 'Case do painel da tela' : ctx.nomeItem(reg.item))}</b></p>
    <div class="grade g2 m1">
      <label class="campo"><span>Calcula</span><select class="f-esc"><option value="tela" ${reg.escopo !== 'lista' ? 'selected' : ''}>Para cada tela</option><option value="lista" ${reg.escopo === 'lista' ? 'selected' : ''}>Uma vez por lista</option></select></label>
      <label class="campo"><span>A partir de</span><select class="f-base">${baseOpts(reg.escopo)}</select></label>
    </div>
    <div class="f-itens-box" ${ehBaseItem(reg.base) ? '' : 'hidden'} style="margin-top:8px"><span class="peq muted">Item(ns): </span><b class="f-itens-txt">${B.esc(ehBaseItem(reg.base) ? B.nomeBase(reg.base, ctx.catIdx()) : '')}</b> <button class="link f-itens">escolher</button></div>
    <div class="grade g4 m1" style="margin-top:10px">
      <label class="campo"><span>Fator (× ou 1/3)</span><input class="f-fator" value="${fatorTxt(reg.fator)}" inputmode="decimal"></label>
      <label class="campo"><span>Reserva %</span><input class="f-res" value="${v(+(reg.reserva * 100).toFixed(2))}" inputmode="decimal"></label>
      <label class="campo"><span>Somar (+/−)</span><input class="f-add" value="${v(reg.adicional)}" inputmode="decimal"></label>
      <label class="campo"><span>Arredonda</span><select class="f-arr">${Object.entries(B.ARRED_NOME).map(([k, t]) => `<option value="${k}" ${k === (reg.arred || 'cima') ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
      <label class="campo"><span>De quanto em quanto</span><input class="f-mult" value="${reg.multiplo || ''}" inputmode="numeric" placeholder="ex.: 10"></label>
      <label class="campo"><span>Mínimo</span><input class="f-min" value="${reg.minimo || ''}" inputmode="decimal"></label>
      <label class="campo"><span>Máximo</span><input class="f-max" value="${reg.maximo || ''}" inputmode="decimal"></label>
    </div>
    <div class="f-filtros" ${reg.escopo === 'lista' ? 'hidden' : ''}>
      <p class="peq muted" style="margin:12px 0 6px">Só para estes painéis (nenhum marcado = todos):</p>
      <div class="chips">${leds.map(c => `<button type="button" class="chip f-pa ${reg.paineis.includes(c.id) ? 'on' : ''}" data-id="${B.esc(c.id)}">${B.esc(c.nome.replace('Case de Led ', ''))}</button>`).join('')}</div>
      <p class="peq muted" style="margin:12px 0 6px">Só para estas montagens (nenhuma = todas):</p>
      <div class="chips">${Object.entries(B.MONTAGEM).map(([k, t]) => `<button type="button" class="chip f-mo ${reg.montagens.includes(k) ? 'on' : ''}" data-id="${k}">${t}</button>`).join('')}</div>
    </div>
    <p class="peq muted" style="margin:12px 0 6px">Teto (opcional) — no máximo:</p>
    <div class="grade g2"><input class="inp f-tf" value="${reg.teto ? v(reg.teto.fator) : ''}" inputmode="decimal" placeholder="ex.: 5">
      <select class="inp f-tb"><option value="">por… (sem teto)</option>${M.BASES_TELA.concat(M.BASES_LISTA.filter(x => !M.BASES_TELA.includes(x))).map(b => `<option value="${b}" ${reg.teto && reg.teto.base === b ? 'selected' : ''}>por ${B.esc((B.BASE_NOME[b] || b).replace(/s( |$)/, '$1'))}</option>`).join('')}</select></div>
    <p class="peq muted" style="margin:12px 0 6px">Só quando (opcional):</p>
    <div class="grade g3"><select class="inp f-cb"><option value="">— sempre —</option>${M.BASES_TELA.concat(M.BASES_LISTA.filter(x => !M.BASES_TELA.includes(x))).map(b => `<option value="${b}" ${reg.cond && reg.cond.base === b ? 'selected' : ''}>${B.esc(B.BASE_NOME[b] || b)}</option>`).join('')}</select>
      <select class="inp f-co">${['>=', '>', '<=', '<', '=', '!='].map(o => `<option ${reg.cond && reg.cond.op === o ? 'selected' : ''}>${o}</option>`).join('')}</select>
      <input class="inp f-cv" value="${reg.cond ? v(reg.cond.valor) : ''}" inputmode="decimal" placeholder="valor"></div>
    <label class="campo" style="margin-top:12px"><span>Por que esta regra existe</span><textarea class="f-obs" rows="2">${B.esc(reg.obs || '')}</textarea></label>
    <p class="dica f-prev"></p>`;

  const ler = el => {
    const base = el.querySelector('.f-base').value;
    const out = Object.assign({}, reg, {
      escopo: el.querySelector('.f-esc').value,
      base: base === '__item' ? ehBaseItem(reg.base) ? reg.base : null : base,
      fator: lerFator(el.querySelector('.f-fator').value),
      reserva: (B.lerNum(el.querySelector('.f-res').value) || 0) / 100,
      adicional: B.lerNum(el.querySelector('.f-add').value) || 0,
      arred: el.querySelector('.f-arr').value,
      multiplo: B.lerNum(el.querySelector('.f-mult').value) || 0,
      minimo: B.lerNum(el.querySelector('.f-min').value) || 0,
      maximo: B.lerNum(el.querySelector('.f-max').value) || 0,
      paineis: [...el.querySelectorAll('.f-pa.on')].map(b => b.dataset.id),
      montagens: [...el.querySelectorAll('.f-mo.on')].map(b => b.dataset.id),
      obs: el.querySelector('.f-obs').value.trim()
    });
    const cb = el.querySelector('.f-cb').value;
    out.cond = cb ? { base: cb, op: el.querySelector('.f-co').value, valor: B.lerNum(el.querySelector('.f-cv').value) || 0 } : null;
    const tb = el.querySelector('.f-tb').value, tf = B.lerNum(el.querySelector('.f-tf').value);
    out.teto = tb && tf != null ? { base: tb, fator: tf } : null;
    if (out.escopo === 'lista') { out.paineis = []; out.montagens = []; }
    return out;
  };
  const previa = el => {
    const t = ler(el);
    const p = el.querySelector('.f-prev');
    if (!t.base || t.fator == null) { p.textContent = ''; return; }
    const outras = ctx.regrasAtivas().filter(x => x.id !== t.id);
    const tela = { id: 'sim', painel: sim.painel, modo: 'medida', largura_m: sim.largura_m, altura_m: sim.altura_m, montagem: sim.montagem };
    const com = M.calcularSugestoes([tela], ctx.est.catalogo, outras.concat([t]));
    const alvo = t.item === '@painel' ? sim.painel : t.item;
    const o = (com.itens.get(alvo) || { origens: [] }).origens.find(x => x.regra === t.id);
    p.innerHTML = `No simulador (${B.num(sim.largura_m)} × ${B.num(sim.altura_m)} m, ${B.esc((ctx.nomeItem(sim.painel) || '').replace('Case de Led ', ''))}): ` +
      (o ? `<b>${B.esc(B.fraseOrigem(Object.assign({}, o, { tela_nome: '', tela: 'x' }), ctx.catIdx()))}</b>` : '<b>esta regra não gera nada</b>') +
      (com.erros.some(e => e.regra === t.id) ? ' <span class="vermelho">— regra em ciclo!</span>' : '');
  };

  const botoes = [{ txt: 'Cancelar', valor: null }];
  if (!nova) botoes.push({ txt: 'Excluir', cls: 'danger', valor: 'excluir' }, { txt: 'Duplicar', valor: 'duplicar' });
  botoes.push({
    txt: 'Salvar', cls: 'pri',
    validar: el => { const t = ler(el); if (!t.base) { B.toast('Escolha a base (de onde a conta parte).'); return false; } if (t.fator == null) { el.querySelector('.f-fator').classList.add('erro'); return false; } return true; },
    valor: el => ler(el)
  });
  const res = await B.modal({
    titulo: nova ? 'Nova regra' : 'Editar regra', largo: true, corpo: corpo(), botoes,
    aoAbrir: el => {
      el.querySelectorAll('.chip').forEach(c => { c.onclick = () => { c.classList.toggle('on'); previa(el); }; });
      el.querySelector('.f-esc').onchange = () => {
        reg.escopo = el.querySelector('.f-esc').value;
        el.querySelector('.f-base').innerHTML = baseOpts(reg.escopo);
        el.querySelector('.f-filtros').hidden = reg.escopo === 'lista';
        previa(el);
      };
      el.querySelector('.f-base').onchange = () => { el.querySelector('.f-itens-box').hidden = el.querySelector('.f-base').value !== '__item'; if (el.querySelector('.f-base').value === '__item' && !ehBaseItem(reg.base)) el.querySelector('.f-itens').click(); previa(el); };
      el.querySelector('.f-itens').onclick = async () => {
        const id = await B.escolherItem(ctx.est.catalogo, { titulo: 'Contar a partir da quantidade de…', categorias: ctx.CATEGORIAS });
        if (!id) return;
        reg.base = 'item:' + id;
        el.querySelector('.f-itens-txt').textContent = ctx.nomeItem(id);
        el.querySelector('.f-itens-box').hidden = false;
        previa(el);
      };
      el.querySelectorAll('input,select,textarea').forEach(i => i.addEventListener('input', () => previa(el)));
      previa(el);
    }
  });
  if (!res) return;
  if (res === 'excluir') {
    if (!(await B.confirmar('Excluir a regra?', 'As listas abertas sem separação se atualizam sozinhas.', { sim: 'Excluir', perigo: true }))) return;
    await ctx.D.excluir('regras', reg.id, { silencioso: true });
    await ctx.D.registrar('regra', `excluiu uma regra de ${reg.item === '@painel' ? 'cases do painel' : ctx.nomeItem(reg.item)}`, reg.id);
  } else if (res === 'duplicar') {
    await ctx.D.salvar('regras', Object.assign({}, reg, { id: ctx.novoId(), obs: (reg.obs || '') + ' (cópia)' }), { silencioso: true });
  } else {
    await ctx.D.salvar('regras', res, { silencioso: true });
    await ctx.D.registrar('regra', `${nova ? 'criou' : 'alterou'} a regra de ${res.item === '@painel' ? 'cases do painel' : ctx.nomeItem(res.item)}: ${B.fraseRegra(res, ctx.catIdx()).conta}`, res.id);
  }
  ctx.atualizar();
}
