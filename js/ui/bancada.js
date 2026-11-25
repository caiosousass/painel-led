/* Tela: Bancada (produção) — o técnico registra o que fez no galpão; o supervisor vê por semana. */

let tipoSel = 'cabo_montado';
let semana = 0; // 0 = esta semana, -1 = anterior…

function inicioSemana(ctx, desloc) {
  const { M } = ctx;
  const h = ctx.hoje();
  const p = h.split('-');
  const dow = new Date(+p[0], +p[1] - 1, +p[2], 12).getDay(); // 0 = domingo
  const seg = M.D.mais(h, -((dow + 6) % 7));
  return M.D.mais(seg, desloc * 7);
}

export function render(ctx) {
  const { B, M } = ctx;
  const de = inicioSemana(ctx, semana);
  const ate = M.D.mais(de, 6);
  const entradas = ctx.est.producao.filter(e => e.data >= de && e.data <= ate).sort((a, b) => (b.data + (b.criado_em || '')).localeCompare(a.data + (a.criado_em || '')));
  const res = M.resumoProducao(entradas);
  const porDia = M.agrupar(entradas, 'data');
  return `
  <div class="cab"><div><h1>Bancada</h1><div class="sub">O que foi feito no galpão: cabos, módulos, cases, testes, limpeza.</div></div></div>

  ${ctx.pode('bancada') ? `<div class="card"><h2>Registrar trabalho</h2>
    <div class="chips" style="margin-bottom:12px">${Object.entries(ctx.TIPOS_PRODUCAO).map(([k, v]) => `<button class="chip ${k === tipoSel ? 'on' : ''}" data-tipo="${k}">${B.esc(v)}</button>`).join('')}</div>
    <div class="grade g3 m1">
      <label class="campo"><span>Item (opcional)</span><button class="btn f-item" data-item="" style="justify-content:flex-start">Escolher item…</button></label>
      <label class="campo"><span>Quantidade</span><input inputmode="decimal" class="f-q" data-k="b-q" placeholder="Ex.: 12"></label>
      <label class="campo"><span>Tempo (min, opcional)</span><input inputmode="numeric" class="f-min" data-k="b-m" placeholder="Ex.: 90"></label>
    </div>
    <label class="campo" style="margin-top:10px"><span>O que foi feito</span><input class="f-d" data-k="b-d" placeholder="Ex.: crimpei 12 cabos RJ45 de 20 m"></label>
    <div class="grade g2 m1" style="margin-top:10px"><label class="campo"><span>Data</span><input type="date" class="f-data" value="${ctx.hoje()}"></label>
      <div class="campo"><span>&nbsp;</span><button class="btn pri grande salvar">${B.ico('check')} Registrar</button></div></div>
  </div>
` : ''}
  <div class="card"><h2>Semana de ${B.dataBR(de)} a ${B.dataBR(ate)}
    <span class="dir"><button class="btn sm sem" data-d="-1">‹ anterior</button> ${semana < 0 ? '<button class="btn sm sem" data-d="1">próxima ›</button>' : ''}</span></h2>
    ${res.registros ? `<div class="stats">${[...res.porPessoa.entries()].map(([p, v]) => `<div class="stat"><div class="rot">${B.esc(p)}</div><b>${v.registros}</b><div class="sub">registros · ${B.num(v.pecas)} peças${v.minutos ? ' · ' + B.num(v.minutos / 60, 1) + ' h' : ''}</div></div>`).join('')}</div>
      <div class="chips" style="margin-bottom:8px">${[...res.porTipo.entries()].map(([t, v]) => `<span class="pill">${B.esc(ctx.TIPOS_PRODUCAO[t] || t)}: ${v.registros}${v.pecas ? ' · ' + B.num(v.pecas) + ' pç' : ''}</span>`).join('')}</div>` : ''}
    ${entradas.length ? [...porDia.entries()].map(([d, es]) => `<h3 class="ck-cat" style="margin:12px 0 4px">${B.dataSemana(d)}</h3>${es.map(e => `
      <div class="linha-flex" style="padding:8px 0;border-bottom:1px solid var(--line)" data-e="${B.esc(e.id)}">
        <span class="cresce"><b>${B.esc(ctx.TIPOS_PRODUCAO[e.tipo] || e.tipo)}</b>${e.item ? ' · ' + B.esc(ctx.nomeItem(e.item)) : ''}${e.qtd ? ' · <b>' + B.num(e.qtd) + '</b>' : ''}
          <br><span class="peq muted">${B.esc(e.descricao || '')}</span> <span class="peq mut2">— ${B.esc(e.tecnico || '')}${e.minutos ? ' · ' + e.minutos + ' min' : ''}</span></span>
        ${ctx.admin() || (e.tecnico === ctx.quem() && ctx.pode('bancada')) ? `<button class="icon-btn sm apagar" title="Apagar">${B.ico('trash')}</button>` : ''}
      </div>`).join('')}`).join('') : '<p class="muted" style="margin:0">Nada registrado nesta semana.</p>'}
  </div>`;
}

export function ligar(el, ctx) {
  const { B } = ctx;
  el.querySelectorAll('[data-tipo]').forEach(b => { b.onclick = () => { tipoSel = b.dataset.tipo; el.querySelectorAll('[data-tipo]').forEach(x => x.classList.toggle('on', x === b)); }; });
  el.querySelectorAll('.sem').forEach(b => { b.onclick = () => { semana = Math.min(0, semana + +b.dataset.d); ctx.atualizar(); }; });
  const fi = el.querySelector('.f-item');
  if (fi) fi.onclick = async () => {
    const id = await B.escolherItem(ctx.est.catalogo, { titulo: 'Item trabalhado', categorias: ctx.CATEGORIAS });
    if (!id) return;
    fi.dataset.item = id;
    fi.textContent = ctx.nomeItem(id);
  };
  const sv = el.querySelector('.salvar');
  if (sv) sv.onclick = async () => {
    const desc = el.querySelector('.f-d').value.trim();
    const qtd = B.lerNum(el.querySelector('.f-q').value);
    if (!desc && !qtd) { el.querySelector('.f-d').classList.add('erro'); return B.toast('Escreva o que foi feito.'); }
    const e = {
      id: ctx.novoId(), data: el.querySelector('.f-data').value || ctx.hoje(), tecnico: ctx.quem(), tipo: tipoSel,
      item: fi.dataset.item || null, qtd: qtd || null, minutos: B.lerNum(el.querySelector('.f-min').value), descricao: desc, criado_em: ctx.agora()
    };
    await ctx.D.salvar('producao', e, { silencioso: true });
    await ctx.D.registrar('bancada', `registrou na bancada: ${ctx.TIPOS_PRODUCAO[tipoSel]}${qtd ? ' (' + qtd + ')' : ''}${desc ? ' — ' + desc : ''}`, e.id);
    B.toast('Registrado.');
    ctx.atualizar();
  };
  el.querySelectorAll('[data-e] .apagar').forEach(b => {
    b.onclick = async () => {
      const id = b.closest('[data-e]').dataset.e;
      if (!(await B.confirmar('Apagar registro?', 'Some da produção da semana.', { sim: 'Apagar', perigo: true }))) return;
      await ctx.D.excluir('producao', id, { silencioso: true });
      ctx.atualizar();
    };
  });
}
