/* Tela: retorno do evento — o que voltou bom, o que voltou com avaria e o que faltou.
 * Ao fechar: falta sai do inventário (reversível) e avaria abre manutenção. */
import { imprimirLista } from './imprimir.js';

let filtro = 'pendentes';

export function render(ctx, [id]) {
  const { B, M } = ctx;
  const lista = ctx.lista(id);
  if (!lista) return `<div class="card vazio">Lista não encontrada.</div>`;
  const cat = ctx.catIdx();
  const linhas = M.ordenarParaSeparar(ctx.linhasDa(id).filter(M.linhaAtiva), ctx.est.catalogo).filter(l => M.quantidadeEnviada(l) > 0);
  const res = M.resumoRetorno(linhas);
  const fechado = lista.status === 'retornada';
  const podeConferir = ['separada', 'em_evento'].includes(lista.status) && ctx.pode('retorno');

  if (fechado) return renderFechado(ctx, lista, linhas, res);

  const vis = linhas.filter(l => filtro === 'todos' || !M.linhaRetorno(l).respondido);
  let grupo = null;
  const rows = vis.map(l => {
    const c = cat.get(l.item);
    const r = M.linhaRetorno(l);
    let cab = '';
    const g = c ? c.cat : 'outros';
    if (g !== grupo) { grupo = g; cab = `<div class="ck-cat">${B.esc(ctx.CATEGORIAS[g] || 'Outros')}</div>`; }
    const cls = !r.respondido ? '' : r.falta ? 'falta' : r.avaria ? 'avaria' : 'ok';
    const st = !r.respondido ? '' : r.falta ? `<b class="vermelho">faltam ${B.num(r.falta)}</b>` : r.avaria ? `<b class="amarelo">${B.num(r.avaria)} com avaria</b>` : '<b class="verde">voltou tudo</b>';
    return cab + `<div class="rt ${cls}" data-id="${B.esc(l.id)}">
      <div><b>${B.esc(c ? c.nome : l.item)}</b><div class="peq muted">foram <b>${B.num(r.enviado)}</b>${st ? ' · ' + st : ''}${l.ret_por ? ` <span class="mut2">· ${B.esc(l.ret_por)}</span>` : ''}</div></div>
      <div class="rt-b">
        <button class="btn ok sm tudo" ${podeConferir ? '' : 'disabled'} title="Voltou tudo">${B.ico('check')}</button>
        <button class="qbtn num voltou" ${podeConferir ? '' : 'disabled'}>${r.respondido ? B.num(r.ok) : '—'}<small>voltou</small></button>
        <button class="qbtn num avaria" ${podeConferir ? '' : 'disabled'}>${r.avaria ? B.num(r.avaria) : '0'}<small>avaria</small></button>
      </div></div>`;
  }).join('');

  return `
  <button class="voltar" data-ir="lista/${B.esc(id)}">${B.ico('back')} Lista</button>
  <div class="fixo-topo">
    <div class="linha-flex" style="margin-bottom:6px"><b class="cresce" style="font-size:16px">Retorno · ${B.esc(B.nomeLista(lista))}</b>${B.pillStatus(lista.status)}</div>
    <div class="prog-txt"><span>${res.falta ? `<span class="vermelho">${B.num(res.falta)} faltando</span>` : 'Conferidos'}${res.avaria ? ` · <span class="amarelo">${B.num(res.avaria)} avaria</span>` : ''}</span><b>${res.respondidas} de ${res.linhas}</b></div>
    ${B.barra(res.pct, res.pct === 100 ? 'verde grossa' : 'grossa')}
    <div class="chips" style="margin-top:10px"><button class="chip ${filtro === 'pendentes' ? 'on' : ''}" data-f="pendentes">Falta conferir (${res.linhas - res.respondidas})</button><button class="chip ${filtro === 'todos' ? 'on' : ''}" data-f="todos">Todos (${res.linhas})</button></div>
  </div>
  ${!podeConferir ? `<div class="card aviso">${ctx.pode('retorno') ? 'O retorno só pode ser conferido depois que a lista sai para o evento.' : 'Você pode ver o retorno, mas não conferir.'}</div>` : ''}
  <p class="dica" style="margin:0 0 10px">✓ = voltou tudo bom. Toque em <b>voltou</b> para informar menos, ou em <b>avaria</b> para o que voltou quebrado (vai para a manutenção).</p>
  <div class="checklist">${rows || `<div class="card vazio">Tudo conferido. Feche o retorno abaixo.</div>`}</div>
  ${podeConferir ? `<div style="height:14px"></div>
    ${res.linhas - res.respondidas ? `<button class="btn cheio resto">Marcar os ${res.linhas - res.respondidas} que faltam como "voltou tudo"</button><div style="height:8px"></div>` : ''}
    <button class="btn pri grande cheio fechar">${B.ico('check')} Fechar retorno</button>
    <p class="dica" style="text-align:center">O que faltar sai do inventário na hora (e volta se aparecer depois).</p>` : ''}`;
}

function renderFechado(ctx, lista, linhas, res) {
  const { B, M } = ctx;
  const perdas = ctx.est.movimentos.filter(m => m.lista === lista.id && m.tipo === 'perda');
  const recup = new Map();
  for (const m of ctx.est.movimentos) if (m.tipo === 'recuperado' && m.ref) recup.set(m.ref, (recup.get(m.ref) || 0) + +m.qtd);
  const mans = ctx.est.manutencoes.filter(m => m.origem_lista === lista.id);
  return `
  <button class="voltar" data-ir="lista/${B.esc(lista.id)}">${B.ico('back')} Lista</button>
  <div class="cab"><div><h1>Retorno · ${B.esc(B.nomeLista(lista))}</h1><div class="sub">Fechado por ${B.esc((lista.ret && lista.ret.por) || '—')} ${lista.ret && lista.ret.em ? B.quando(lista.ret.em, ctx.hoje()) : ''}</div></div>
    <div class="acoes"><button class="btn imprimir">${B.ico('print')} Relatório</button></div></div>
  <div class="stats">
    <div class="stat"><div class="rot">Foram</div><b>${B.num(res.enviado)}</b><div class="sub">${res.linhas} itens</div></div>
    <div class="stat verde"><div class="rot">Voltaram bons</div><b>${B.num(res.ok)}</b></div>
    <div class="stat ${res.avaria ? 'vermelho' : ''}"><div class="rot">Com avaria</div><b>${B.num(res.avaria)}</b><div class="sub">foram para a manutenção</div></div>
    <div class="stat ${res.falta ? 'vermelho' : ''}"><div class="rot">Faltaram</div><b>${B.num(res.falta)}</b><div class="sub">saíram do inventário</div></div>
  </div>
  ${perdas.length ? `<div class="card alerta"><h2>Não voltaram</h2>${perdas.map(p => {
    const volta = recup.get(p.id) || 0;
    const resta = Math.abs(+p.qtd) - volta;
    return `<div class="linha-flex" style="margin:6px 0"><span class="cresce"><b>${B.num(Math.abs(+p.qtd))} × ${B.esc(ctx.nomeItem(p.item))}</b>${volta ? ` <span class="verde peq">· ${B.num(volta)} apareceram</span>` : ''}</span>
      ${resta > 0 && (ctx.pode('retorno') || ctx.pode('estoque')) ? `<button class="btn sm apareceu" data-id="${B.esc(p.id)}" data-resta="${resta}">Apareceu</button>` : '<span class="pill verde">recuperado</span>'}</div>`;
  }).join('')}<p class="dica">"Apareceu" devolve ao inventário e fica registrado quem fez.</p></div>` : `<div class="card dica">Nada faltou neste evento. 👏</div>`}
  ${mans.length ? `<div class="card"><h2>Avarias enviadas à manutenção</h2>${mans.map(m => `<div class="linha-flex peq" style="margin:4px 0"><span class="cresce">${B.num(m.qtd)} × ${B.esc(ctx.nomeItem(m.item))}</span>${pillManut(B, m.status)}</div>`).join('')}
    <button class="btn sm" data-ir="manutencao" style="margin-top:8px">Abrir manutenção</button></div>` : ''}`;
}

function pillManut(B, s) { const x = B.STATUS_MANUT[s] || [s, '']; return B.pill(x[0], x[1]); }

export function ligar(el, ctx, [id]) {
  const { B, M } = ctx;
  el.querySelectorAll('[data-ir]').forEach(b => { b.onclick = () => ctx.ir(b.dataset.ir); });
  const lista = ctx.lista(id);
  if (!lista) return;
  el.querySelectorAll('[data-f]').forEach(b => { b.onclick = () => { filtro = b.dataset.f; ctx.atualizar(); }; });
  const imp = el.querySelector('.imprimir');
  if (imp) imp.onclick = () => imprimirLista(ctx, lista, { retorno: true });

  const grava = async (l, campos) => {
    await ctx.D.salvar('linhas', Object.assign({}, l, campos, { ret_por: ctx.quem(), ret_em: ctx.agora() }), { silencioso: true });
    ctx.atualizar();
  };
  el.querySelectorAll('.rt[data-id]').forEach(row => {
    const l = ctx.est.linhas.find(x => x.id === row.dataset.id);
    if (!l) return;
    const env = M.quantidadeEnviada(l);
    row.querySelector('.tudo').onclick = () => grava(l, { ret_ok: env, ret_avaria: 0 });
    row.querySelector('.voltou').onclick = async () => {
      const v = await B.pedirNumero(ctx.nomeItem(l.item), { rotulo: `Quantos voltaram bons? (foram ${B.num(env)})`, valor: l.ret_ok != null ? l.ret_ok : '', max: env });
      if (v == null) return;
      grava(l, { ret_ok: v, ret_avaria: Math.min(+l.ret_avaria || 0, Math.max(0, env - v)) });
    };
    row.querySelector('.avaria').onclick = async () => {
      const v = await B.pedirNumero(ctx.nomeItem(l.item), { rotulo: 'Quantos voltaram com avaria?', valor: l.ret_avaria || '', dica: 'Vão para a manutenção ao fechar o retorno.' });
      if (v == null) return;
      const ok = l.ret_ok != null ? Math.min(+l.ret_ok, Math.max(0, env - v)) : Math.max(0, env - v);
      const obs = v > 0 ? await B.pedirTexto('Qual o defeito?', { rotulo: 'Descreva (opcional)', valor: l.ret_defeito || '' }) : '';
      grava(l, { ret_avaria: v, ret_ok: ok, ret_defeito: obs || '' });
    };
  });

  const resto = el.querySelector('.resto');
  if (resto) resto.onclick = async () => {
    const pend = ctx.linhasDa(id).filter(M.linhaAtiva).filter(l => M.quantidadeEnviada(l) > 0 && l.ret_ok == null);
    if (!(await B.confirmar('Marcar o restante?', `${pend.length} itens ficam como "voltou tudo bom". Só faça isso depois de olhar.`, { sim: 'Marcar' }))) return;
    await ctx.D.salvar('linhas', pend.map(l => Object.assign({}, l, { ret_ok: M.quantidadeEnviada(l), ret_avaria: 0, ret_por: ctx.quem(), ret_em: ctx.agora() })), { silencioso: true });
    ctx.atualizar();
  };

  const fechar = el.querySelector('.fechar');
  if (fechar) fechar.onclick = async () => {
    const linhas = ctx.linhasDa(id);
    const r = M.fecharRetorno(lista, linhas, { novoId: ctx.novoId, hoje: ctx.hoje(), por: ctx.quem() });
    if (!r.ok) { filtro = 'pendentes'; ctx.atualizar(); return B.toast(`Faltam ${r.semResposta.length} itens para conferir.`, { tipo: 'erro' }); }
    const txtF = r.movimentos.map(m => `<div class="vermelho">• ${B.num(-m.qtd)} × ${B.esc(ctx.nomeItem(m.item))}</div>`).join('');
    const txtA = r.manutencoes.map(m => `<div class="amarelo">• ${B.num(m.qtd)} × ${B.esc(ctx.nomeItem(m.item))}</div>`).join('');
    const ok = await B.confirmar('Fechar o retorno?',
      (txtF ? `<b>Não voltaram — saem do inventário:</b>${txtF}<br>` : '<b class="verde">Nada faltou.</b><br><br>') +
      (txtA ? `<b>Voltaram com avaria — vão para a manutenção:</b>${txtA}` : ''), { sim: 'Fechar retorno', perigo: !!txtF });
    if (!ok) return;
    // defeito informado na conferência vai junto para a manutenção
    for (const m of r.manutencoes) {
      const l = linhas.find(x => x.item === m.item && x.ret_avaria);
      m.defeito = (l && l.ret_defeito) || 'Voltou com avaria do evento ' + B.nomeLista(lista);
    }
    if (r.movimentos.length) await ctx.D.salvar('movimentos', r.movimentos, { silencioso: true });
    if (r.manutencoes.length) await ctx.D.salvar('manutencoes', r.manutencoes, { silencioso: true });
    const res = M.resumoRetorno(linhas);
    lista.status = 'retornada';
    lista.ret = { por: ctx.quem(), em: ctx.agora(), faltas: res.falta, avarias: res.avaria };
    await ctx.D.salvar('listas', lista, { silencioso: true });
    await ctx.D.registrar('retorno_fechado', `fechou o retorno de ${B.nomeLista(lista)}: ${res.falta ? res.falta + ' peças faltaram' : 'nada faltou'}${res.avaria ? ', ' + res.avaria + ' com avaria' : ''}`, lista.id);
    ctx.atualizar();
  };

  el.querySelectorAll('.apareceu').forEach(b => {
    b.onclick = async () => {
      const perda = ctx.est.movimentos.find(m => m.id === b.dataset.id);
      const v = await B.pedirNumero('Quantos apareceram?', { rotulo: ctx.nomeItem(perda.item), valor: b.dataset.resta, max: +b.dataset.resta });
      if (!v) return;
      const mv = M.recuperarPerda(perda, { novoId: ctx.novoId, hoje: ctx.hoje(), por: ctx.quem(), qtd: Math.min(v, +b.dataset.resta) });
      await ctx.D.salvar('movimentos', mv, { silencioso: true });
      await ctx.D.registrar('perda_recuperada', `registrou que ${mv.qtd} × ${ctx.nomeItem(perda.item)} apareceram (lista ${B.nomeLista(lista)})`, lista.id);
      ctx.atualizar();
    };
  });
}
