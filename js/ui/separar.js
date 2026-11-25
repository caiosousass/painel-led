/* Tela: separação no galpão — checklist de um toque, na ordem do galpão, funciona sem sinal. */

let filtro = 'pendentes';
let busca = '';
const desfazer = [];   // pilha de { antes: linha }

export function render(ctx, [id]) {
  const { B, M } = ctx;
  const lista = ctx.lista(id);
  if (!lista) return `<div class="card vazio">Lista não encontrada.</div>`;
  const cat = ctx.catIdx();
  const todas = M.ordenarParaSeparar(ctx.linhasDa(id).filter(M.linhaAtiva), ctx.est.catalogo);
  const prog = M.progressoSeparacao(todas);
  const fechada = !['pronta', 'separando'].includes(lista.status) || !ctx.pode('separacao');
  const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const q = norm(busca);
  const visiveis = todas.filter(l => {
    const s = M.statusSeparacao(l);
    if (filtro === 'pendentes' && (s === 'ok' || s === 'na')) return false;
    if (q && !norm(ctx.nomeItem(l.item)).includes(q)) return false;
    return true;
  });
  let grupo = null;
  const rows = visiveis.map(l => {
    const c = cat.get(l.item);
    const s = M.statusSeparacao(l);
    let cab = '';
    const g = c ? c.cat : 'outros';
    if (g !== grupo) { grupo = g; cab = `<div class="ck-cat">${B.esc(ctx.CATEGORIAS[g] || 'Outros')}</div>`; }
    const txtStatus = { faltou: '<b class="vermelho">faltou no galpão</b>', na: 'não se aplica', parcial: `<b class="amarelo">faltam ${B.num(+l.qtd - +l.sep_qtd)}</b>` }[s] || '';
    return cab + `<div class="ck ${s}" data-id="${B.esc(l.id)}">
      <button class="marca-btn" aria-label="${s === 'ok' ? 'Desmarcar' : 'Marcar como separado'}" ${fechada ? 'disabled' : ''}>${B.ico('check')}</button>
      <div class="info"><b>${B.esc(c ? c.nome : l.item)}</b><small>${B.num(l.qtd)} ${B.unidade(c, l.qtd)}${txtStatus ? ' · ' + txtStatus : ''}${l.obs ? ' · ' + B.esc(l.obs) : ''}</small>
        ${l.sep_por ? `<span class="quem">${B.esc(l.sep_por)} · ${B.quando(l.sep_em, ctx.hoje())}</span>` : ''}</div>
      <button class="qbtn num" ${fechada ? 'disabled' : ''}>${l.sep_qtd != null ? B.num(l.sep_qtd) : '0'}<small>de ${B.num(l.qtd)}</small></button>
      <button class="icon-btn mais-op" aria-label="Mais opções" ${fechada ? 'disabled' : ''}>${B.ico('mais')}</button>
    </div>`;
  }).join('');
  return `
  <button class="voltar" data-ir="lista/${B.esc(id)}">${B.ico('back')} Lista</button>
  <div class="fixo-topo">
    <div class="linha-flex" style="margin-bottom:6px"><b class="cresce" style="font-size:16px">${B.esc(B.nomeLista(lista))}</b>${B.pillStatus(lista.status)}</div>
    <div class="prog-txt"><span>${prog.faltou ? `<span class="vermelho">${prog.faltou} faltaram</span> · ` : ''}${prog.parcial ? `<span class="amarelo">${prog.parcial} parcia${prog.parcial === 1 ? "l" : "is"}</span>` : 'Separação'}</span><b>${prog.resolvidos} de ${prog.total} · ${prog.pct}%</b></div>
    ${B.barra(prog.pct, prog.pct === 100 ? 'verde grossa' : 'grossa')}
    <div class="linha-flex" style="margin-top:10px">
      <div class="chips"><button class="chip ${filtro === 'pendentes' ? 'on' : ''}" data-f="pendentes">Falta separar (${prog.total - prog.resolvidos})</button><button class="chip ${filtro === 'todos' ? 'on' : ''}" data-f="todos">Todos (${todas.length})</button></div>
      ${desfazer.length && !fechada ? `<button class="btn sm desfazer">${B.ico('undo')} Desfazer</button>` : ''}
    </div>
    <input type="search" class="buscar" placeholder="Buscar item…" value="${B.esc(busca)}" style="margin-top:8px">
  </div>
  ${fechada ? `<div class="card dica">Separação fechada${lista.sep && lista.sep.por ? ' por <b>' + B.esc(lista.sep.por) + '</b> ' + B.quando(lista.sep.em, ctx.hoje()) : ''}. ${lista.sep && lista.sep.justificativa ? '<br><b>Pendência justificada:</b> ' + B.esc(lista.sep.justificativa) : ''}</div>` : ''}
  <div class="checklist">${rows || `<div class="card vazio">${filtro === 'pendentes' && todas.length ? '🎉 Tudo separado! Feche a separação abaixo.' : 'Nenhum item.'}</div>`}</div>
  ${!fechada ? `<div style="height:16px"></div><button class="btn ${prog.pct === 100 ? 'ok' : 'pri'} grande cheio fechar">${B.ico('check')} Fechar separação</button>
    <p class="dica" style="text-align:center">Tudo é salvo no aparelho na hora — pode separar sem sinal.</p>` : ''}`;
}

export function ligar(el, ctx, [id]) {
  const { B, M } = ctx;
  el.querySelectorAll('[data-ir]').forEach(b => { b.onclick = () => ctx.ir(b.dataset.ir); });
  const lista = ctx.lista(id);
  if (!lista) return;
  el.querySelectorAll('[data-f]').forEach(b => { b.onclick = () => { filtro = b.dataset.f; ctx.atualizar(); }; });
  const bus = el.querySelector('.buscar');
  bus.addEventListener('input', () => { busca = bus.value; clearTimeout(bus._t); bus._t = setTimeout(ctx.atualizar, 250); });

  const gravar = async (nova, antes) => {
    desfazer.push({ antes });
    if (desfazer.length > 50) desfazer.shift();
    await ctx.D.salvar('linhas', nova, { silencioso: true });
    if (lista.status === 'pronta') {
      lista.status = 'separando';
      lista.sep_inicio = ctx.agora();
      await ctx.D.salvar('listas', lista, { silencioso: true });
      await ctx.D.registrar('separacao_iniciada', `começou a separar a lista ${B.nomeLista(lista)}`, lista.id);
    }
    ctx.atualizar();
  };
  const quem = () => ({ por: ctx.quem(), em: ctx.agora() });

  el.querySelectorAll('.ck[data-id]').forEach(row => {
    const l = ctx.est.linhas.find(x => x.id === row.dataset.id);
    if (!l) return;
    const antes = Object.assign({}, l);
    row.querySelector('.marca-btn').onclick = () => {
      const s = M.statusSeparacao(l);
      if (s === 'ok') gravar(M.desmarcar(l), antes);
      else gravar(M.marcarSeparado(l, quem()), antes);
      if (navigator.vibrate) navigator.vibrate(15);
    };
    row.querySelector('.qbtn').onclick = async () => {
      const v = await B.pedirNumero(ctx.nomeItem(l.item), { rotulo: 'Quantos foram separados?', valor: l.sep_qtd != null ? l.sep_qtd : '', max: +l.qtd });
      if (v == null) return;
      gravar(v === 0 ? M.desmarcar(l) : M.marcarSeparado(l, Object.assign({ qtd: v }, quem())), antes);
    };
    row.querySelector('.mais-op').onclick = async () => {
      const op = await B.modal({
        titulo: ctx.nomeItem(l.item),
        corpo: `<div class="lista-escolha">
          <button class="escolha" data-v="faltou"><b class="vermelho">Faltou no galpão</b><small>Não tem a quantidade toda — registra quanto foi</small></button>
          <button class="escolha" data-v="na"><b>Não se aplica neste evento</b><small>Sai da contagem, fica registrado quem decidiu</small></button>
          <button class="escolha" data-v="obs"><b>Escrever observação</b><small>Ex.: "2 cabos com conector frouxo"</small></button>
          <button class="escolha" data-v="limpar"><b>Desmarcar</b></button></div>`,
        botoes: [{ txt: 'Fechar', valor: null }],
        aoAbrir: (m, fechar) => m.querySelectorAll('[data-v]').forEach(b => { b.onclick = () => fechar(b.dataset.v); })
      });
      if (op === 'faltou') {
        const v = await B.pedirNumero('Quantos foram separados?', { rotulo: `De ${B.num(l.qtd)} pedidos`, valor: l.sep_qtd || 0, max: +l.qtd });
        if (v == null) return;
        const obs = await B.pedirTexto('O que aconteceu?', { rotulo: 'Motivo (vai para o supervisor)', valor: l.obs || '', dica: 'Ex.: "só tinha 70 no galpão", "8 estão na manutenção".' });
        gravar(Object.assign(M.marcarFalta(l, Object.assign({ obs: obs || l.obs }, quem())), { sep_qtd: v }), antes);
      } else if (op === 'na') gravar(M.marcarNaoAplica(l, quem()), antes);
      else if (op === 'obs') {
        const t = await B.pedirTexto('Observação', { rotulo: ctx.nomeItem(l.item), valor: l.obs || '', multilinha: true });
        if (t != null) gravar(Object.assign({}, l, { obs: t }), antes);
      } else if (op === 'limpar') gravar(M.desmarcar(l), antes);
    };
  });

  const d = el.querySelector('.desfazer');
  if (d) d.onclick = async () => {
    const u = desfazer.pop();
    if (!u) return;
    await ctx.D.salvar('linhas', Object.assign({}, u.antes), { silencioso: true });
    ctx.atualizar();
  };

  const f = el.querySelector('.fechar');
  if (f) f.onclick = async () => {
    const linhas = M.ordenarParaSeparar(ctx.linhasDa(id), ctx.est.catalogo);
    const pend = M.pendenciasSeparacao(linhas);
    let justificativa = '';
    if (pend.length) {
      const lista2 = pend.map(p => `<div class="vermelho peq">• ${B.esc(ctx.nomeItem(p.item))}: ${p.status === 'pendente' ? 'não separado' : `${B.num(p.separado)} de ${B.num(p.qtd)}`}${p.status === 'faltou' ? ' (faltou)' : ''}</div>`).join('');
      justificativa = await B.modal({
        titulo: `Fechar com ${pend.length} pendência${pend.length === 1 ? '' : 's'}?`,
        corpo: `${lista2}<label class="campo" style="margin-top:12px"><span>Justificativa (obrigatória)</span><textarea rows="3" autofocus placeholder="Ex.: faltaram 10 powercon no galpão, vão no 2º caminhão amanhã"></textarea></label>
          <p class="dica">O supervisor vê esta justificativa no painel.</p>`,
        botoes: [{ txt: 'Voltar', valor: null }, {
          txt: 'Fechar mesmo assim', cls: 'danger',
          validar: m => { const t = m.querySelector('textarea'); if (t.value.trim().length < 5) { t.classList.add('erro'); return false; } return true; },
          valor: m => m.querySelector('textarea').value.trim()
        }]
      });
      if (!justificativa) return;
    } else if (!(await B.confirmar('Fechar a separação?', 'Tudo separado. Depois de fechar, falta a conferência e marcar a saída.', { sim: 'Fechar separação' }))) return;
    // o que nem chegou a ser separado não saiu do galpão: vira "faltou" com 0 (no retorno conta 0 enviado)
    const naoSeparados = linhas.filter(l => M.linhaAtiva(l) && M.statusSeparacao(l) === 'pendente')
      .map(l => Object.assign({}, l, { sep_qtd: 0, sep_marca: 'faltou', sep_por: ctx.quem(), sep_em: ctx.agora(), obs: l.obs || 'não separado ao fechar' }));
    if (naoSeparados.length) await ctx.D.salvar('linhas', naoSeparados, { silencioso: true });
    lista.status = 'separada';
    lista.sep = { por: ctx.quem(), em: ctx.agora(), justificativa: justificativa || '', pendencias: pend.length };
    await ctx.D.salvar('listas', lista, { silencioso: true });
    const ativas = linhas.filter(M.linhaAtiva).length;
    await ctx.D.registrar('separacao_fechada', `fechou a separação da lista ${B.nomeLista(lista)} (${ativas} itens${pend.length ? ', ' + pend.length + ' com pendência' : ''})`, lista.id);
    desfazer.length = 0;
    B.toast('Separação fechada. Agora: conferência e saída.');
    ctx.ir('lista/' + id);
  };
}
