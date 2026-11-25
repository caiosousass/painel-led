/* Tela: Início — o painel do supervisor. O que precisa de atenção, o que sai, o que voltou, quem fez o quê. */
import { cartaoLista, ligarCartoes } from './listas.js';

export function render(ctx) {
  const { B, M } = ctx;
  const hoje = ctx.hoje();
  const est = ctx.est;
  const nome = (ctx.quem() || '').split(' ')[0];
  const h = new Date().getHours();
  const saud = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';

  if (!est.catalogo.length) {
    return `<div class="cab"><div><h1>${saud}${nome ? ', ' + B.esc(nome) : ''}</h1></div></div>
    <div class="card dica"><h2>Primeiro acesso</h2>
      ${ctx.admin() ? `<p>O sistema ainda não tem catálogo nem regras. Carregue os itens da "lista zerada" e as regras tiradas das listas conferidas.</p>
        <button class="btn pri grande semear">Carregar catálogo e regras iniciais</button>`
        : '<p>Aguardando o supervisor carregar o catálogo do setor.</p>'}</div>`;
  }

  const alertas = M.alertas(ctx.estadoEstoque(), { hoje });
  // faltas de estoque nas listas que saem nos próximos 14 dias
  const prox = est.listas.filter(l => l.ida && !['retornada', 'cancelada'].includes(l.status) && M.D.dif(hoje, l.ida) >= -1 && M.D.dif(hoje, l.ida) <= 14);
  for (const l of prox) {
    for (const f of M.faltasDeEstoque(l, ctx.linhasDa(l.id), ctx.estadoEstoque(), { hoje })) alertas.push({ tipo: 'falta_estoque', nivel: 'alto', lista: l.id, f });
  }
  const nl = id => (ctx.lista(id) ? B.esc(B.nomeLista(ctx.lista(id))) : 'lista');
  const frase = a => {
    switch (a.tipo) {
      case 'carga_proxima': return [`Carga ${B.emDias(a.dias)}: ${nl(a.lista)}`, `${(B.STATUS_LISTA[a.status] || [a.status])[0]} · separação ${a.pct}%`, 'lista/' + a.lista];
      case 'sem_conferencia': return [`${nl(a.lista)}: separada e ninguém conferiu`, 'Conferência = outra pessoa olhar antes de carregar', 'lista/' + a.lista];
      case 'retorno_atrasado': return [`${nl(a.lista)}: retorno não conferido`, `Volta era ${B.emDias(-a.dias)} — o material conta como fora de casa`, 'retorno/' + a.lista];
      case 'saiu_incompleta': return [`${nl(a.lista)}: saiu com ${a.pendencias} pendência(s)`, B.esc(((ctx.lista(a.lista) || {}).sep || {}).justificativa || ''), 'lista/' + a.lista];
      case 'manutencao_parada': return [`${B.esc(ctx.nomeItem(a.item))} esperando conserto`, `Há ${a.dias} dias na fila`, 'manutencao'];
      case 'manutencao_semana_vazia': return ['Nenhuma manutenção de módulos registrada nesta semana', `Desde segunda ${B.dataBR(a.desde)} — cobre o registro`, 'manutencao'];
      case 'perda': return [`${B.num(a.qtd)} × ${B.esc(ctx.nomeItem(a.item))} não voltaram`, `${a.lista ? nl(a.lista) + ' · ' : ''}${B.dataBR(a.data)}`, a.lista ? 'retorno/' + a.lista : 'estoque'];
      case 'falta_estoque': return [`Falta no estoque: ${B.esc(ctx.nomeItem(a.f.item))}`, `${nl(a.lista)} precisa ${B.num(a.f.precisa)}, livres ${B.num(a.f.livre)} em ${B.dataSemana(a.f.dia)}`, 'lista/' + a.lista];
      default: return [a.tipo, '', 'inicio'];
    }
  };

  const abertas = est.listas.filter(l => ['rascunho', 'pronta', 'separando', 'separada'].includes(l.status));
  const proximas = abertas.filter(l => l.ida).sort((a, b) => a.ida.localeCompare(b.ida)).slice(0, 6);
  const semData = abertas.filter(l => !l.ida);
  const noEvento = est.listas.filter(l => l.status === 'em_evento').sort((a, b) => String(a.volta || '').localeCompare(String(b.volta || '')));
  const manutAb = est.manutencoes.filter(m => M.STATUS_MANUT_ABERTA.includes(m.status));
  const semIni = M.D.inicioSemana(hoje);
  const manSem = M.resumoManutencao(est.manutlog, { de: semIni, ate: hoje });
  const trocSem = (manSem.porAcao.get('troca_modulo') || { modulos: 0 }).modulos;
  const desde30 = M.D.mais(hoje, -30);
  const perdas30 = est.movimentos.filter(m => m.tipo === 'perda' && m.data >= desde30).reduce((s, m) => s + Math.abs(+m.qtd), 0);
  const ini7 = M.D.mais(hoje, -6);
  const prod = M.resumoProducao(est.producao, { de: ini7, ate: hoje });
  const ativ = est.atividade.slice().sort((a, b) => String(b.em).localeCompare(String(a.em))).slice(0, 14);

  return `
  <div class="cab"><div><h1>${saud}${nome ? ', ' + B.esc(nome) : ''}</h1>
    <div class="sub">${B.dataSemana(hoje)}</div></div>
    ${ctx.pode('listas') ? `<div class="acoes"><button class="btn pri nova">${B.ico('add')} Nova lista</button></div>` : ''}</div>

  <div class="stats">
    <div class="stat clic" data-ir="listas"><div class="rot">Listas abertas</div><b>${abertas.length}</b><div class="sub">${proximas.filter(l => M.D.dif(hoje, l.ida) <= 7).length} saem em 7 dias</div></div>
    <div class="stat clic" data-ir="listas"><div class="rot">No evento</div><b>${noEvento.length}</b><div class="sub">aguardando retorno</div></div>
    <div class="stat clic" data-ir="manutencao"><div class="rot">Manutenção na semana</div><b>${B.num(manSem.modulos)}</b><div class="sub">módulos (${B.num(trocSem)} trocados)${manutAb.length ? ' · ' + manutAb.length + ' esperando conserto' : ''}</div></div>
    <div class="stat clic ${perdas30 ? 'vermelho' : ''}" data-ir="estoque"><div class="rot">Perdas 30 dias</div><b>${B.num(perdas30)}</b><div class="sub">peças que não voltaram</div></div>
  </div>

  <div class="card ${alertas.some(a => a.nivel === 'alto') ? 'alerta' : alertas.length ? 'aviso' : ''}"><h2>${B.ico('alerta')} Atenção <span class="conta">${alertas.length}</span></h2>
    ${alertas.length ? `<div class="alertas">${alertas.slice(0, 12).map(a => { const [t, s, r] = frase(a); return `<button class="alerta-it ${a.nivel}" data-ir="${r}">${B.ico('alerta')}<span>${t}<small>${s}</small></span></button>`; }).join('')}</div>` : '<p class="muted" style="margin:0">Nada pendente. 👍</p>'}
  </div>

  <div class="card"><h2>${B.ico('truck')} Próximas cargas <button class="link dir" data-ir="listas">ver todas</button></h2>
    ${proximas.length ? `<div class="lcards">${proximas.map(l => cartaoLista(ctx, l)).join('')}</div>` : '<p class="muted" style="margin:0">Nenhuma lista aberta com data.</p>'}
    ${semData.length ? `<p class="dica">${semData.length} lista(s) sem data de ida — não entram na conta do estoque.</p>` : ''}
  </div>

  ${noEvento.length ? `<div class="card"><h2>${B.ico('undo')} No evento</h2><div class="lcards">${noEvento.map(l => cartaoLista(ctx, l)).join('')}</div></div>` : ''}

  <div class="card"><h2>${B.ico('manut')} Manutenção — esta semana <button class="link dir" data-ir="manutencao">abrir</button></h2>
    ${manSem.registros ? `<p class="peq" style="margin:0 0 8px"><b>${B.num(trocSem)}</b> módulos trocados · <b>${B.num(manSem.modulos - trocSem)}</b> reparados · <b>${B.num(manSem.cases)}</b> cases revisados/limpos · ${manSem.diasComRegistro} dia(s) com registro</p>
      <div class="chips">${[...manSem.porPainel.entries()].map(([p, v]) => `<span class="pill">${B.esc(ctx.nomeItem(p).replace('Case de Led ', ''))}: ${B.num(v.modulos)} mód.${v.cases ? ' · ' + B.num(v.cases) + ' cases' : ''}</span>`).join('')}</div>`
      : '<p class="muted" style="margin:0">Nada registrado desde segunda.</p>'}
  </div>

  <div class="card"><h2>${B.ico('bancada')} Bancada — últimos 7 dias <button class="link dir" data-ir="bancada">abrir</button></h2>
    ${prod.registros ? `<table class="tab"><thead><tr><th>Quem</th><th class="n">Registros</th><th class="n">Peças</th><th class="n">Tempo</th></tr></thead><tbody>
      ${[...prod.porPessoa.entries()].map(([p, v]) => `<tr><td>${B.esc(p)}</td><td class="n">${v.registros}</td><td class="n">${B.num(v.pecas)}</td><td class="n">${v.minutos ? B.num(v.minutos / 60, 1) + ' h' : '—'}</td></tr>`).join('')}</tbody></table>`
      : '<p class="muted" style="margin:0">Nenhum trabalho de bancada registrado na semana.</p>'}
  </div>

  <div class="card"><h2>${B.ico('info')} Atividade recente</h2>
    ${ativ.length ? `<div class="feed">${ativ.map(a => `<div class="ev"><span class="h">${B.quando(a.em, hoje)}</span><span><b>${B.esc(a.por)}</b> ${B.esc(a.texto)}</span></div>`).join('')}</div>` : '<p class="muted" style="margin:0">Ainda nada.</p>'}
  </div>`;
}

export function ligar(el, ctx) {
  el.querySelectorAll('[data-ir]').forEach(b => { b.onclick = () => ctx.ir(b.dataset.ir); });
  ligarCartoes(el, ctx);
  const n = el.querySelector('.nova');
  if (n) n.onclick = () => import('./listas.js').then(m => m.novaLista(ctx));
  const s = el.querySelector('.semear');
  if (s) s.onclick = async () => { s.disabled = true; await ctx.painelSemente(); ctx.atualizar(); };
}
