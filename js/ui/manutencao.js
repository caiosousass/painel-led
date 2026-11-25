/* Tela: Manutenção — controle semanal do que foi feito nos módulos dos painéis de LED.
 * Em cima o registro rápido; no meio o resumo da semana (para o supervisor); embaixo a fila do que
 * voltou com avaria dos eventos e ainda espera conserto (essas peças ficam fora do estoque). */
import { abrirRelatorio } from './relatorio.js';

let semana = 0;           // 0 = esta semana, -1 = anterior…
let acaoSel = 'troca_modulo';
let defeitoSel = 'pixel';
let painelSel = null;
let verConcluidas = false;

const unidadeDaAcao = (ctx, a) => (ctx.ACOES_MANUT.find(x => x[0] === a) || [])[2] || 'modulos';
const nomeAcao = (ctx, a) => (ctx.ACOES_MANUT.find(x => x[0] === a) || [a, a])[1];
const curto = n => String(n || '').replace('Case de Led ', '');

function periodo(ctx) {
  const { M } = ctx;
  const de = M.D.mais(M.D.inicioSemana(ctx.hoje()), semana * 7);
  return { de, ate: M.D.mais(de, 6) };
}

export function render(ctx) {
  const { B, M } = ctx;
  const leds = ctx.est.catalogo.filter(c => c.cat === 'led' && c.ativo !== false);
  if (!painelSel || !leds.some(c => c.id === painelSel)) painelSel = (leds.find(c => c.id === 'led-v10') || leds[0] || {}).id;
  const { de, ate } = periodo(ctx);
  const regs = ctx.est.manutlog.filter(e => e.data >= de && e.data <= ate)
    .sort((a, b) => (b.data + (b.criado_em || '')).localeCompare(a.data + (a.criado_em || '')));
  const res = M.resumoManutencao(regs);
  const trocados = (res.porAcao.get('troca_modulo') || { modulos: 0 }).modulos;
  const reparados = res.modulos - trocados;
  const porDia = M.agrupar(regs, 'data');
  const un = unidadeDaAcao(ctx, acaoSel);

  // fila de conserto (avarias do retorno + o que for aberto à mão)
  const abertas = ctx.est.manutencoes.filter(m => M.STATUS_MANUT_ABERTA.includes(m.status)).sort((a, b) => String(a.aberta_em).localeCompare(String(b.aberta_em)));
  const concluidas = ctx.est.manutencoes.filter(m => !M.STATUS_MANUT_ABERTA.includes(m.status)).sort((a, b) => String(b.concluida_em || '').localeCompare(String(a.concluida_em || ''))).slice(0, 30);

  return `
  <div class="cab"><div class="cresce"><h1>Manutenção</h1><div class="sub">O que foi feito nos módulos dos painéis — semana a semana.</div></div>
    <div class="acoes"><button class="btn relatorio">${B.ico('print')} Gerar relatório</button></div></div>

  ${ctx.pode('manutencao') ? `<div class="card"><h2>${B.ico('manut')} Registrar manutenção</h2>
    <div class="grade g2 m1">
      <label class="campo"><span>Painel</span><select class="f-painel">${leds.map(c => `<option value="${B.esc(c.id)}" ${c.id === painelSel ? 'selected' : ''}>${B.esc(curto(c.nome))}</option>`).join('')}</select></label>
      <label class="campo"><span>Case nº (opcional)</span><input class="f-case" data-k="m-case" placeholder="Ex.: 12, ou 12 e 15"></label>
    </div>
    <p class="peq muted" style="margin:12px 0 6px">O que foi feito</p>
    <div class="chips">${ctx.ACOES_MANUT.map(([k, t]) => `<button class="chip ${k === acaoSel ? 'on' : ''}" data-acao="${k}">${B.esc(t)}</button>`).join('')}</div>
    <p class="peq muted" style="margin:12px 0 6px">Defeito encontrado</p>
    <div class="chips">${Object.entries(ctx.DEFEITOS_MANUT).map(([k, t]) => `<button class="chip ${k === defeitoSel ? 'on' : ''}" data-def="${k}">${B.esc(t)}</button>`).join('')}</div>
    <div class="grade g3 m1" style="margin-top:12px">
      <label class="campo"><span>Quantidade</span><input class="f-q" inputmode="numeric" data-k="m-q" placeholder="Ex.: 3"></label>
      <label class="campo"><span>De quê</span><select class="f-un">${Object.entries(ctx.UNIDADES_MANUT).map(([k, t]) => `<option value="${k}" ${k === un ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
      <label class="campo"><span>Tempo (min, opcional)</span><input class="f-min" inputmode="numeric" data-k="m-min" placeholder="Ex.: 40"></label>
    </div>
    <label class="campo" style="margin-top:10px"><span>Observação</span><input class="f-obs" data-k="m-obs" placeholder="Ex.: módulo do canto superior direito, 2 LEDs vermelhos"></label>
    <div class="grade g2 m1" style="margin-top:10px">
      <label class="campo"><span>Data</span><input type="date" class="f-data" value="${ctx.hoje()}"></label>
      <div class="campo"><span>&nbsp;</span><button class="btn pri grande registrar">${B.ico('check')} Registrar</button></div>
    </div>
  </div>
` : ''}
  <div class="card"><h2>Semana de ${B.dataBR(de)} a ${B.dataBR(ate)}
    <span class="dir"><button class="btn sm sem" data-d="-1">‹ anterior</button>${semana < 0 ? ' <button class="btn sm sem" data-d="1">próxima ›</button>' : ''} <button class="btn sm imprimir">${B.ico('print')}</button></span></h2>
    <div class="stats">
      <div class="stat"><div class="rot">Módulos trocados</div><b>${B.num(trocados)}</b></div>
      <div class="stat"><div class="rot">Módulos reparados</div><b>${B.num(reparados)}</b><div class="sub">LED, fonte, receiving, cabo, cor</div></div>
      <div class="stat"><div class="rot">Cases revisados / limpos</div><b>${B.num(res.cases)}</b></div>
      <div class="stat ${regs.length ? '' : 'vermelho'}"><div class="rot">Dias com registro</div><b>${res.diasComRegistro}</b><div class="sub">${res.minutos ? B.num(res.minutos / 60, 1) + ' h registradas' : res.registros + ' registro(s)'}</div></div>
    </div>
    ${regs.length ? `
      <table class="tab" style="margin-bottom:10px"><thead><tr><th>Painel</th><th class="n">Módulos</th><th class="n">Cases</th><th class="n">Registros</th></tr></thead><tbody>
        ${[...res.porPainel.entries()].sort((a, b) => b[1].modulos - a[1].modulos).map(([p, v]) => `<tr><td>${B.esc(curto(ctx.nomeItem(p)))}</td><td class="n">${B.num(v.modulos)}</td><td class="n">${B.num(v.cases)}</td><td class="n">${v.registros}</td></tr>`).join('')}</tbody></table>
      ${res.porDefeito.size ? `<div class="chips" style="margin-bottom:6px">${[...res.porDefeito.entries()].sort((a, b) => b[1].modulos - a[1].modulos).map(([d, v]) => `<span class="pill">${B.esc(ctx.DEFEITOS_MANUT[d] || d)}: ${B.num(v.modulos)}</span>`).join('')}</div>` : ''}
      ${res.porPessoa.size > 1 ? `<div class="chips" style="margin-bottom:6px">${[...res.porPessoa.entries()].map(([p, v]) => `<span class="pill azul">${B.esc(p)}: ${v.registros} reg.${v.modulos ? ' · ' + B.num(v.modulos) + ' módulos' : ''}</span>`).join('')}</div>` : ''}
      ${[...porDia.entries()].map(([d, es]) => `<h3 class="ck-cat" style="margin:12px 0 4px">${B.dataSemana(d)}</h3>${es.map(e => `
        <div class="linha-flex" style="padding:8px 0;border-bottom:1px solid var(--line)" data-e="${B.esc(e.id)}">
          <span class="cresce"><b>${B.esc(nomeAcao(ctx, e.acao))}</b> · ${B.esc(curto(ctx.nomeItem(e.painel)))}${e.case ? ' · case ' + B.esc(e.case) : ''} · <b>${B.num(e.qtd)} ${B.esc(ctx.UNIDADES_MANUT[e.unidade] || e.unidade || '')}</b>
            <br><span class="peq muted">${B.esc(ctx.DEFEITOS_MANUT[e.defeito] || '')}${e.obs ? ' — ' + B.esc(e.obs) : ''}</span> <span class="peq mut2">· ${B.esc(e.tecnico || '')}${e.minutos ? ' · ' + e.minutos + ' min' : ''}</span></span>
          ${ctx.admin() || (e.tecnico === ctx.quem() && ctx.pode('manutencao')) ? `<button class="icon-btn sm apagar" title="Apagar">${B.ico('trash')}</button>` : ''}
        </div>`).join('')}`).join('')}`
    : `<p class="muted" style="margin:0">Nenhuma manutenção registrada nesta semana.</p>`}
  </div>

  <div class="card ${abertas.length ? 'aviso' : ''}"><h2>Aguardando conserto <span class="conta">${abertas.length}</span>
    ${ctx.pode('manutencao') ? `<span class="dir"><button class="btn sm nova-pend">${B.ico('add')} Peça para consertar</button></span>` : ''}</h2>
    <p class="dica" style="margin:0 0 8px">O que voltou com avaria dos eventos cai aqui sozinho. Enquanto está aqui, a peça fica fora do estoque.</p>
    ${abertas.length ? abertas.map(m => cartaoPendencia(ctx, m)).join('') : '<p class="muted" style="margin:0">Nada esperando conserto.</p>'}
    ${concluidas.length ? `<button class="link ver-concl" style="margin-top:8px">${verConcluidas ? 'Esconder' : 'Ver'} consertos concluídos (${concluidas.length})</button>
      ${verConcluidas ? concluidas.map(m => cartaoPendencia(ctx, m)).join('') : ''}` : ''}
  </div>`;
}

function cartaoPendencia(ctx, m) {
  const { B, M } = ctx;
  const pode = ctx.pode('manutencao');
  const dias = m.aberta_em ? M.D.dif(m.aberta_em, ctx.hoje()) : 0;
  const lista = m.origem_lista ? ctx.lista(m.origem_lista) : null;
  const st = B.STATUS_MANUT[m.status] || [m.status, ''];
  const resta = +m.qtd - (+m.consertadas || 0) - (+m.descartadas || 0);
  return `<div class="tela" data-m="${B.esc(m.id)}">
    <div class="linha-flex"><b class="cresce">${B.num(m.qtd)} × ${B.esc(ctx.nomeItem(m.item))}</b>${B.pill(st[0], st[1])}</div>
    <div class="peq muted" style="margin:4px 0">${B.esc(m.defeito || 'sem descrição')}</div>
    <div class="peq mut2">${B.dataBR(m.aberta_em, true)} · ${B.esc(m.aberta_por || '—')}${lista ? ' · voltou de <b>' + B.esc(B.nomeLista(lista)) + '</b>' : ''}
      ${m.status !== 'concluida' ? ` · <span class="${dias >= 14 ? 'vermelho' : dias >= 7 ? 'amarelo' : ''}">há ${dias} dia${dias === 1 ? '' : 's'}</span>` : ''}</div>
    ${m.status === 'concluida' ? `<div class="peq" style="margin-top:6px"><span class="verde">${B.num(m.consertadas || 0)} consertadas</span>${+m.descartadas ? ` · <span class="vermelho">${B.num(m.descartadas)} descartadas</span>` : ''} · ${B.dataBR(m.concluida_em, true)} · ${B.esc(m.concluida_por || '—')}${m.solucao ? '<br>' + B.esc(m.solucao) : ''}</div>`
      : !pode ? '' : `<div class="linha-flex" style="margin-top:8px">
        <select class="inp st" style="flex:1;min-width:140px">${['aberta', 'em_reparo', 'aguardando_peca'].map(s => `<option value="${s}" ${s === m.status ? 'selected' : ''}>${B.STATUS_MANUT[s][0]}</option>`).join('')}</select>
        <button class="btn ok sm concluir">${B.ico('check')} Concluir</button><button class="btn sm editar">Editar</button></div>
        ${resta !== +m.qtd ? `<p class="dica">Restam ${B.num(resta)}.</p>` : ''}`}
  </div>`;
}

export function ligar(el, ctx) {
  const { B } = ctx;
  const q = s => el.querySelector(s);
  el.querySelectorAll('[data-acao]').forEach(b => {
    b.onclick = () => {
      acaoSel = b.dataset.acao;
      el.querySelectorAll('[data-acao]').forEach(x => x.classList.toggle('on', x === b));
      q('.f-un').value = unidadeDaAcao(ctx, acaoSel);
      if (['limpeza', 'revisao'].includes(acaoSel)) { defeitoSel = 'preventiva'; el.querySelectorAll('[data-def]').forEach(x => x.classList.toggle('on', x.dataset.def === 'preventiva')); }
    };
  });
  el.querySelectorAll('[data-def]').forEach(b => { b.onclick = () => { defeitoSel = b.dataset.def; el.querySelectorAll('[data-def]').forEach(x => x.classList.toggle('on', x === b)); }; });
  if (q('.f-painel')) q('.f-painel').onchange = e => { painelSel = e.target.value; };
  if (q('.registrar')) q('.registrar').onclick = async () => {
    const qtd = B.lerNum(q('.f-q').value);
    if (!(qtd > 0)) { q('.f-q').classList.add('erro'); q('.f-q').focus(); return B.toast('Informe a quantidade.'); }
    const e = {
      id: ctx.novoId(), data: q('.f-data').value || ctx.hoje(), tecnico: ctx.quem(), painel: q('.f-painel').value, case: q('.f-case').value.trim(),
      acao: acaoSel, defeito: defeitoSel, qtd, unidade: q('.f-un').value, minutos: B.lerNum(q('.f-min').value), obs: q('.f-obs').value.trim(), criado_em: ctx.agora()
    };
    await ctx.D.salvar('manutlog', e, { silencioso: true });
    await ctx.D.registrar('manutencao_semana', `registrou manutenção: ${nomeAcao(ctx, e.acao)} — ${qtd} ${ctx.UNIDADES_MANUT[e.unidade]} de ${curto(ctx.nomeItem(e.painel))}${e.case ? ' (case ' + e.case + ')' : ''}${e.defeito ? ', ' + (ctx.DEFEITOS_MANUT[e.defeito] || '').toLowerCase() : ''}`, e.id);
    B.toast('Manutenção registrada.');
    ctx.atualizar();
  };
  el.querySelectorAll('.sem').forEach(b => { b.onclick = () => { semana = Math.min(0, semana + +b.dataset.d); ctx.atualizar(); }; });
  // relatório da semana que está na tela: geral para o administrador; para os outros, o próprio
  q('.imprimir').onclick = () => { const p = periodo(ctx); abrirRelatorio(ctx, { de: p.de, ate: p.ate, titulo: 'Semana', tecnico: ctx.admin() ? null : ctx.quem() }); };
  q('.relatorio').onclick = () => escolherRelatorio(ctx);
  el.querySelectorAll('[data-e] .apagar').forEach(b => {
    b.onclick = async () => {
      const id = b.closest('[data-e]').dataset.e;
      if (!(await B.confirmar('Apagar este registro?', 'Some do controle da semana. Fica anotado no registro de atividade quem apagou.', { sim: 'Apagar', perigo: true }))) return;
      const reg = ctx.est.manutlog.find(x => x.id === id);
      await ctx.D.excluir('manutlog', id, { silencioso: true });
      await ctx.D.registrar('manutencao_semana', `apagou um registro de manutenção (${reg ? nomeAcao(ctx, reg.acao) + ', ' + reg.qtd + ' ' + (ctx.UNIDADES_MANUT[reg.unidade] || '') : ''})`, id);
      ctx.atualizar();
    };
  });

  // fila de conserto
  if (q('.nova-pend')) q('.nova-pend').onclick = () => editarPendencia(ctx, null);
  const vc = q('.ver-concl');
  if (vc) vc.onclick = () => { verConcluidas = !verConcluidas; ctx.atualizar(); };
  el.querySelectorAll('[data-m]').forEach(card => {
    const m = ctx.est.manutencoes.find(x => x.id === card.dataset.m);
    if (!m) return;
    const st = card.querySelector('.st');
    if (st) st.onchange = async () => {
      await ctx.D.salvar('manutencoes', Object.assign({}, m, { status: st.value }), { silencioso: true });
      await ctx.D.registrar('manutencao_status', `mudou ${ctx.nomeItem(m.item)} (conserto) para "${B.STATUS_MANUT[st.value][0]}"`, m.id);
      ctx.atualizar();
    };
    const ed = card.querySelector('.editar');
    if (ed) ed.onclick = () => editarPendencia(ctx, m);
    const co = card.querySelector('.concluir');
    if (co) co.onclick = () => concluir(ctx, m);
  });
}

async function editarPendencia(ctx, m) {
  const { B } = ctx;
  const item = m ? m.item : await B.escolherItem(ctx.est.catalogo, { titulo: 'O que está esperando conserto?', categorias: ctx.CATEGORIAS });
  if (!item) return;
  const r = await B.modal({
    titulo: (m ? 'Editar · ' : 'Conserto · ') + ctx.nomeItem(item),
    corpo: `<div class="grade g2">
        <label class="campo"><span>Quantidade</span><input inputmode="decimal" class="f-q" value="${m ? m.qtd : 1}"></label>
        <label class="campo"><span>Previsão de volta</span><input type="date" class="f-p" value="${m && m.previsao ? m.previsao : ''}"></label></div>
      <label class="campo" style="margin-top:10px"><span>Defeito</span><select class="f-t">${ctx.DEFEITOS.map(d => `<option>${B.esc(d)}</option>`).join('')}</select></label>
      <label class="campo" style="margin-top:10px"><span>Descrição</span><textarea class="f-d" rows="3">${B.esc(m ? m.defeito || '' : '')}</textarea></label>
      <p class="dica">Enquanto estiver aqui, a quantidade fica fora do estoque disponível.</p>`,
    botoes: [{ txt: 'Cancelar', valor: null }, {
      txt: 'Salvar', cls: 'pri',
      validar: el => { const qq = B.lerNum(el.querySelector('.f-q').value); if (!(qq > 0)) { el.querySelector('.f-q').classList.add('erro'); return false; } return true; },
      valor: el => {
        const tipo = el.querySelector('.f-t').value, desc = el.querySelector('.f-d').value.trim();
        return { qtd: B.lerNum(el.querySelector('.f-q').value), previsao: el.querySelector('.f-p').value || null, defeito: desc && !m ? tipo + ' — ' + desc : (desc || tipo) };
      }
    }],
    aoAbrir: el => { if (m) el.querySelector('.f-t').value = ctx.DEFEITOS[ctx.DEFEITOS.length - 1]; }
  });
  if (!r) return;
  if (m) await ctx.D.salvar('manutencoes', Object.assign({}, m, r), { silencioso: true });
  else {
    const nova = Object.assign({ id: ctx.novoId(), item, status: 'aberta', aberta_em: ctx.hoje(), aberta_por: ctx.quem(), origem_lista: null, consertadas: 0, descartadas: 0, solucao: '', concluida_em: null }, r);
    await ctx.D.salvar('manutencoes', nova, { silencioso: true });
    await ctx.D.registrar('manutencao_aberta', `mandou ${B.num(r.qtd)} × ${ctx.nomeItem(item)} para conserto (${r.defeito})`, nova.id);
  }
  ctx.atualizar();
}

async function concluir(ctx, m) {
  const { B, M } = ctx;
  const resta = +m.qtd - (+m.consertadas || 0) - (+m.descartadas || 0);
  const ehPainel = (ctx.item(m.item) || {}).cat === 'led';
  const r = await B.modal({
    titulo: 'Concluir · ' + ctx.nomeItem(m.item),
    corpo: `<p class="modal-txt">${B.num(resta)} esperando conserto.</p>
      <div class="grade g2"><label class="campo"><span>Consertadas</span><input inputmode="decimal" class="f-c" value="${resta}"></label>
      <label class="campo"><span>Descartadas</span><input inputmode="decimal" class="f-x" value="0"></label></div>
      ${ehPainel ? `<div class="grade g2" style="margin-top:10px"><label class="campo"><span>O que foi feito</span><select class="f-a">${ctx.ACOES_MANUT.filter(a => a[2] === 'modulos').map(([k, t]) => `<option value="${k}">${B.esc(t)}</option>`).join('')}</select></label>
        <label class="campo"><span>Módulos mexidos</span><input inputmode="numeric" class="f-mod" placeholder="Ex.: 3"></label></div>` : ''}
      <label class="campo" style="margin-top:10px"><span>Observação</span><textarea class="f-s" rows="2" placeholder="Ex.: troquei 2 módulos e a fonte">${B.esc(m.solucao || '')}</textarea></label>
      <p class="dica">Consertadas voltam ao estoque. Descartadas saem do inventário. ${ehPainel ? 'Entra também no controle semanal de manutenção.' : 'Entra também na bancada.'}</p>`,
    botoes: [{ txt: 'Cancelar', valor: null }, {
      txt: 'Concluir', cls: 'ok',
      validar: el => { const c = B.lerNum(el.querySelector('.f-c').value) || 0, x = B.lerNum(el.querySelector('.f-x').value) || 0; if (c + x > resta || c < 0 || x < 0) { el.querySelector('.f-c').classList.add('erro'); return false; } return true; },
      valor: el => ({
        c: B.lerNum(el.querySelector('.f-c').value) || 0, x: B.lerNum(el.querySelector('.f-x').value) || 0, s: el.querySelector('.f-s').value.trim(),
        a: el.querySelector('.f-a') ? el.querySelector('.f-a').value : null, mod: el.querySelector('.f-mod') ? B.lerNum(el.querySelector('.f-mod').value) : null
      })
    }]
  });
  if (!r) return;
  const res = M.concluirManutencao(Object.assign({}, m, { qtd: resta, consertadas: 0, descartadas: 0 }), { consertadas: r.c, descartadas: r.x, hoje: ctx.hoje(), por: ctx.quem(), novoId: ctx.novoId, solucao: r.s });
  const final = Object.assign({}, res.manutencao, { qtd: m.qtd, consertadas: (+m.consertadas || 0) + r.c, descartadas: (+m.descartadas || 0) + r.x });
  if (res.sobra > 0) final.obs = `${res.sobra} voltaram ao estoque sem conserto registrado`;
  await ctx.D.salvar('manutencoes', final, { silencioso: true });
  if (res.movimentos.length) await ctx.D.salvar('movimentos', res.movimentos, { silencioso: true });
  if (r.c > 0 && ehPainel) {
    await ctx.D.salvar('manutlog', {
      id: ctx.novoId(), data: ctx.hoje(), tecnico: ctx.quem(), painel: m.item, case: '', acao: r.a || 'reparo_modulo', defeito: 'outro',
      qtd: r.mod || r.c, unidade: r.mod ? 'modulos' : 'cases', minutos: null, obs: (r.s || 'conserto de avaria') + (m.origem_lista ? ' (voltou de evento)' : ''), pendencia: m.id, criado_em: ctx.agora()
    }, { silencioso: true });
  } else if (r.c > 0) {
    await ctx.D.salvar('producao', {
      id: ctx.novoId(), data: ctx.hoje(), tecnico: ctx.quem(), tipo: 'cabo_reparo', item: m.item, qtd: r.c, minutos: null,
      descricao: r.s || 'Conserto', manutencao: m.id, criado_em: ctx.agora()
    }, { silencioso: true });
  }
  await ctx.D.registrar('manutencao_concluida', `concluiu conserto de ${ctx.nomeItem(m.item)}: ${r.c} consertadas${r.x ? ', ' + r.x + ' descartadas' : ''}`, m.id);
  ctx.atualizar();
}

/* Relatório: escolhe o período e imprime (ou "Salvar como PDF" no navegador) */
async function escolherRelatorio(ctx) {
  const { B, M } = ctx;
  const hoje = ctx.hoje();
  const tipos = [['semana', 'Esta semana'], ['semana_passada', 'Semana passada'], ['mes', 'Este mês'], ['mes_passado', 'Mês passado'], ['tres_meses', 'Últimos 3 meses']];
  const per = Object.fromEntries(tipos.map(([k]) => [k, M.periodoRelatorio(k, hoje)]));
  // o administrador gera o geral e o de qualquer técnico; os outros, só o próprio
  const admin = ctx.admin();
  const pessoas = admin ? [...new Set(M.tecnicosDaManutencao(ctx.est.manutlog).concat([ctx.quem()]))] : [ctx.quem()];
  const res = await B.modal({
    titulo: 'Relatório de manutenção',
    corpo: `<label class="campo"><span>Relatório de</span><select class="f-quem">${admin ? '<option value="">Equipe toda (geral)</option>' : ''}${pessoas.map(p => `<option value="${B.esc(p)}">${B.esc(p)}</option>`).join('')}</select></label>
      <p class="dica">Indicadores, gráficos por semana, por painel, defeitos, ${admin ? 'por técnico, ' : ''}semanas sem registro, fila de conserto e os registros. Abre na tela; dali imprime ou salva em PDF.</p>
      <div class="lista-escolha">${tipos.map(([k, t], i) => `<label class="escolha linha-flex"><input type="radio" name="per" value="${k}" ${i === 2 ? 'checked' : ''} style="width:18px;height:18px">
        <span class="cresce"><b>${t}</b><small>${B.dataBR(per[k].de, true)} a ${B.dataBR(per[k].ate, true)}</small></span></label>`).join('')}
        <label class="escolha linha-flex"><input type="radio" name="per" value="datas" style="width:18px;height:18px"> <span class="cresce"><b>Escolher as datas</b></span></label></div>
      <div class="grade g2 m1" style="margin-top:8px"><label class="campo"><span>De</span><input type="date" class="f-de" value="${per.mes.de}"></label>
        <label class="campo"><span>Até</span><input type="date" class="f-ate" value="${hoje}"></label></div>`,
    aoAbrir: el => el.querySelectorAll('.f-de,.f-ate').forEach(i => { i.onfocus = () => { el.querySelector('[value="datas"]').checked = true; }; }),
    botoes: [{ txt: 'Cancelar', valor: null }, {
      txt: 'Gerar relatório', cls: 'pri',
      validar: el => {
        if (el.querySelector('[name="per"]:checked').value !== 'datas') return true;
        const de = el.querySelector('.f-de').value, ate = el.querySelector('.f-ate').value;
        if (!de || !ate || ate < de) { B.toast('Confira as datas: "até" depois de "de".'); return false; }
        return true;
      },
      valor: el => {
        const k = el.querySelector('[name="per"]:checked').value;
        const tecnico = el.querySelector('.f-quem').value || null;
        if (k === 'datas') return { de: el.querySelector('.f-de').value, ate: el.querySelector('.f-ate').value, titulo: '', tecnico };
        return Object.assign({ titulo: tipos.find(t => t[0] === k)[1], tecnico }, per[k]);
      }
    }]
  });
  if (!res) return;
  abrirRelatorio(ctx, res);
  await ctx.D.registrar('relatorio', `gerou o relatório de manutenção ${res.tecnico ? 'de ' + res.tecnico : 'geral'} de ${B.dataBR(res.de, true)} a ${B.dataBR(res.ate, true)}`, null);
}
