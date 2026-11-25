/* Tela: Listas (início do fluxo) — três portas que dão no mesmo lugar: começar pelo PROJETO (desenha a sala e a
 * lista sai sozinha), pela LISTA (o projeto da sala já existe) ou IMPORTAR a OS (cria as duas de uma vez).
 * Mais duplicar uma anterior. */
import { lerXlsx, abasDoPdf, interpretarOS } from '../os.js';
import { textoDoPdf } from '../pdf.js';
import { recalcularLista } from './lista.js';

let filtro = 'abertas';
let busca = '';

export function cartaoLista(ctx, l, { soSala } = {}) {
  const { B, M } = ctx;
  const linhas = ctx.linhasDa(l.id);
  const prog = M.progressoSeparacao(linhas);
  const hoje = ctx.hoje();
  const cat = ctx.catIdx();
  let gab = 0;
  for (const t of l.telas || []) { const c = cat.get(t.painel); if (c && c.painel) gab += M.geometria(t, c.painel).gabinetes; }
  const dias = l.ida ? M.D.dif(hoje, l.ida) : null;
  const quando = l.ida ? `${B.dataSemana(l.ida)}${l.volta && l.volta !== l.ida ? ' → ' + B.dataSemana(l.volta) : ''}` : 'sem data';
  let rodape;
  if (l.status === 'retornada') {
    const r = M.resumoRetorno(linhas);
    rodape = r.falta || r.avaria ? `<span class="vermelho">${r.falta ? B.num(r.falta) + ' faltaram' : ''}${r.falta && r.avaria ? ' · ' : ''}${r.avaria ? B.num(r.avaria) + ' com avaria' : ''}</span>` : '<span class="verde">Tudo voltou</span>';
  } else if (['separando', 'separada', 'pronta', 'em_evento'].includes(l.status) && prog.total) {
    rodape = `${B.barra(prog.pct, prog.pct === 100 ? 'verde' : '')}<span class="num">${prog.resolvidos}/${prog.total} · ${prog.pct}%</span>`;
  } else rodape = `<span>${linhas.filter(M.linhaAtiva).length} itens</span>`;
  return `<button class="lcard" data-lista="${B.esc(l.id)}">
    <div class="l1"><b>${B.esc(soSala ? l.sala || B.nomeLista(l) : B.nomeLista(l))}</b>${B.pillStatus(l.status)}</div>
    <div class="l2"><span>${l.os ? 'OS ' + B.esc(l.os) : 'sem OS'}</span><span>${quando}${dias != null && dias >= 0 && dias <= 7 && !['retornada', 'em_evento', 'cancelada'].includes(l.status) ? ' · <b class="' + (dias <= 1 ? 'vermelho' : 'amarelo') + '">' + B.emDias(dias) + '</b>' : ''}</span>
      <span>${(l.telas || []).length} tela${(l.telas || []).length === 1 ? '' : 's'}${gab ? ' · ' + gab + ' gab' : ''}</span></div>
    <div class="l3">${rodape}</div>
  </button>`;
}

export function ligarCartoes(el, ctx) {
  el.querySelectorAll('[data-lista]').forEach(b => { b.onclick = () => ctx.ir('lista/' + b.dataset.lista); });
  el.querySelectorAll('[data-evento]').forEach(b => { b.onclick = () => ctx.ir('evento/' + b.dataset.evento); });
}

/* Evento com várias salas na lista de Listas: um cabeçalho (abre o evento) e as salas embaixo */
export function cartaoEvento(ctx, salas) {
  const { B, M } = ctx;
  const l0 = salas[0];
  const vivas = salas.filter(l => l.status !== 'cancelada');
  const idas = vivas.map(l => l.ida).filter(Boolean).sort(), voltas = vivas.map(l => l.volta).filter(Boolean).sort();
  const quando = idas.length ? `${B.dataSemana(idas[0])}${voltas.length ? ' → ' + B.dataSemana(voltas[voltas.length - 1]) : ''}` : 'sem data';
  return `<div class="ecard">
    <button class="ecab" data-evento="${B.esc(l0.grupo)}"><div class="l1"><b>${B.esc(l0.evento || 'Evento sem nome')}</b>${B.pillStatus(M.statusEvento(salas))}</div>
      <div class="l2"><span>${l0.os ? 'OS ' + B.esc(l0.os) : 'sem OS'}</span><span>${quando}</span><span>${salas.length} sala${salas.length === 1 ? '' : 's'}</span></div></button>
    <div class="lcards">${salas.map(l => cartaoLista(ctx, l, { soSala: true })).join('')}</div>
  </div>`;
}

export function render(ctx) {
  const { B } = ctx;
  const todas = ctx.est.listas.slice();
  const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const q = norm(busca);
  const grupos = {
    abertas: l => ['rascunho', 'pronta', 'separando', 'separada'].includes(l.status),
    evento: l => l.status === 'em_evento',
    retornadas: l => l.status === 'retornada',
    todas: () => true
  };
  const conta = k => todas.filter(grupos[k]).length;
  let ls = todas.filter(grupos[filtro]).filter(l => !q || norm([l.evento, l.sala, l.os, l.cliente, l.local].join(' ')).includes(q));
  ls.sort((a, b) => (filtro === 'retornadas' ? String(b.ida || '').localeCompare(String(a.ida || '')) : String(a.ida || '9999').localeCompare(String(b.ida || '9999'))));
  // salas do mesmo evento aparecem juntas, debaixo do evento (todas as salas, mesmo as de outro filtro)
  const vistos = new Set();
  const blocos = [];
  for (const l of ls) {
    if (!l.grupo) { blocos.push(cartaoLista(ctx, l)); continue; }
    if (vistos.has(l.grupo)) continue;
    vistos.add(l.grupo);
    blocos.push(cartaoEvento(ctx, ctx.M.salasDoEvento(todas, l.grupo)));
  }
  return `
  <div class="cab"><div><h1>Listas</h1><div class="sub">Uma lista por evento — ou uma por sala, quando o evento tem salas ou hotéis separados. Monta, separa no galpão e confere a volta.</div></div></div>
  ${ctx.pode('listas') ? `<div class="grade g4 m1" style="margin-bottom:6px">
    <button class="btn pri grande novo-projeto">${B.ico('painel')} Novo projeto</button>
    <button class="btn grande nova">${B.ico('add')} Nova lista</button>
    <button class="btn grande importar">${B.ico('upload')} Importar OS (.xlsx ou .pdf)</button>
    <button class="btn grande duplicar">${B.ico('copy')} Duplicar uma anterior</button>
  </div>
  <p class="dica" style="margin:0 0 14px">Projeto e lista andam juntos: comece pelo desenho da sala e a lista sai pronta — ou pela lista, e o projeto já está lá. Importando a OS, sai tudo de uma vez.</p>` : ''}
  <input type="file" accept=".xlsx,.pdf,application/pdf" class="arq-os" hidden>
  <div class="abas" style="margin-bottom:10px">
    ${[['abertas', 'Abertas'], ['evento', 'No evento'], ['retornadas', 'Retornadas'], ['todas', 'Todas']].map(([k, t]) => `<button data-f="${k}" class="${filtro === k ? 'on' : ''}">${t} (${conta(k)})</button>`).join('')}
  </div>
  <div class="busca-linha"><input type="search" class="buscar" placeholder="Buscar por evento, OS, cliente…" value="${B.esc(busca)}"></div>
  ${ls.length ? `<div class="lcards">${blocos.join('')}</div>`
    : `<div class="card vazio">${B.ico('listas')}<div>${q ? 'Nada encontrado.' : 'Nenhuma lista aqui.'}</div></div>`}`;
}

export function ligar(el, ctx) {
  ligarCartoes(el, ctx);
  el.querySelectorAll('[data-f]').forEach(b => { b.onclick = () => { filtro = b.dataset.f; ctx.atualizar(); }; });
  const bus = el.querySelector('.buscar');
  bus.addEventListener('input', () => {
    busca = bus.value;
    clearTimeout(bus._t);
    bus._t = setTimeout(() => { ctx.atualizar(); const b2 = document.querySelector('.buscar'); if (b2) { b2.focus(); b2.setSelectionRange(b2.value.length, b2.value.length); } }, 250);
  });
  if (!ctx.pode('listas')) return;
  el.querySelector('.nova').onclick = () => novaLista(ctx);
  el.querySelector('.novo-projeto').onclick = () => novaLista(ctx, null, { abrir: 'projeto' });
  el.querySelector('.duplicar').onclick = () => duplicarAnterior(ctx);
  const arq = el.querySelector('.arq-os');
  el.querySelector('.importar').onclick = () => arq.click();
  arq.onchange = () => { if (arq.files[0]) importarOS(ctx, arq.files[0]); arq.value = ''; };
}

export function novaTela(ctx, extra) {
  const led = ctx.est.catalogo.filter(c => c.cat === 'led' && c.ativo !== false);
  const padrao = led.find(c => c.id === 'led-v10') || led[0];
  return Object.assign({ id: ctx.novoId(), nome: '', painel: padrao ? padrao.id : null, modo: 'medida', largura_m: null, altura_m: null, colunas: null, linhas: null, m2: null, gabinetes: null, montagem: 'chao' }, extra || {});
}

export async function novaLista(ctx, dados, { abrir } = {}) {
  const lista = Object.assign({
    id: ctx.novoId(), os: '', evento: '', cliente: '', local: '', ida: null, volta: null, obs: '',
    status: 'rascunho', telas: [novaTela(ctx)], criada_em: ctx.agora(), criada_por: ctx.quem(), sep: null, conf: null, ret: null
  }, dados || {});
  await ctx.D.salvar('listas', lista);
  await ctx.D.registrar('lista_criada', lista.evento ? `criou a lista ${ctx.B.nomeLista(lista)}` : 'criou uma lista nova', lista.id);
  if (lista.telas.some(t => t.largura_m || t.gabinetes || t.colunas || t.m2)) await recalcularLista(ctx, lista, { forcar: true });
  ctx.ir((abrir === 'projeto' ? 'projeto/' : 'lista/') + lista.id);
}

async function duplicarAnterior(ctx) {
  const { B, M } = ctx;
  const ls = ctx.est.listas.filter(l => l.status !== 'cancelada').sort((a, b) => String(b.ida || b.criada_em || '').localeCompare(String(a.ida || a.criada_em || ''))).slice(0, 40);
  if (!ls.length) return B.toast('Ainda não há lista para duplicar.');
  const id = await B.modal({
    titulo: 'Duplicar qual lista?',
    corpo: `<p class="dica">Copia as telas e os itens (com as suas edições). Separação e retorno começam zerados.</p>
      <div class="lista-escolha">${ls.map(l => `<button class="escolha" data-id="${B.esc(l.id)}"><b>${B.esc(B.nomeLista(l))}</b><small>${l.os ? 'OS ' + B.esc(l.os) + ' · ' : ''}${l.ida ? B.dataBR(l.ida, true) : 'sem data'} · ${(l.telas || []).length} tela(s)</small></button>`).join('')}</div>`,
    botoes: [{ txt: 'Cancelar', valor: null }],
    aoAbrir: (el, fechar) => el.querySelectorAll('[data-id]').forEach(b => { b.onclick = () => fechar(b.dataset.id); })
  });
  if (!id) return;
  const orig = ctx.lista(id);
  const r = M.duplicarLista(orig, ctx.linhasDa(id), { novoId: ctx.novoId, hoje: ctx.agora(), por: ctx.quem() });
  await ctx.D.salvar('listas', r.lista);
  await ctx.D.salvar('linhas', r.linhas);
  await ctx.D.registrar('lista_duplicada', `duplicou a lista ${B.nomeLista(orig)}`, r.lista.id);
  B.toast('Lista duplicada. Ajuste o nome, a OS e as datas.');
  ctx.ir('lista/' + r.lista.id);
}

async function importarOS(ctx, arquivo, { abasEscolhidas, abasLidas } = {}) {
  const { B } = ctx;
  let info, abas;
  try {
    const buf = abasLidas ? null : await arquivo.arrayBuffer();
    const ehPdf = !abasLidas && (/\.pdf$/i.test(arquivo.name) || new TextDecoder().decode(new Uint8Array(buf, 0, Math.min(5, buf.byteLength))) === '%PDF-');
    abas = abasLidas || (ehPdf ? abasDoPdf(await textoDoPdf(buf)) : await lerXlsx(buf));
    info = interpretarOS(abas, ctx.est.catalogo, { nome: arquivo.name, hoje: ctx.agora().slice(0, 10), abas: abasEscolhidas });
    if (ehPdf && !info.os && !info.evento && !info.telas.length)
      throw new Error('Não achei texto de OS neste PDF. Se ele é escaneado (foto), não dá para ler — use o PDF ou o .xlsx gerado pelo sistema.');
  } catch (e) {
    return B.modal({ titulo: 'Não consegui ler a OS', corpo: `<p class="modal-txt">${B.esc(e.message)}</p><p class="dica">Use a OS gerada pelo sistema da empresa: o .xlsx (aba "Proposta") ou o PDF da proposta.</p>` });
  }
  const led = ctx.est.catalogo.filter(c => c.cat === 'led' && c.ativo !== false);
  // Sem painel identificado: a primeira opção é "escolher" — nunca cair calado no primeiro case do catálogo
  const opc = sel => (sel ? '' : '<option value="" selected>— escolher o painel —</option>')
    + led.map(c => `<option value="${B.esc(c.id)}" ${c.id === sel ? 'selected' : ''}>${B.esc(c.nome.replace('Case de Led ', ''))}</option>`).join('');
  const avisoTela = t => !t.painel
    ? `<div class="aviso-tela">${t.pitch_os ? `A OS pede <b>${B.esc(t.pitch_os)}</b> e a casa não tem esse painel (sublocado?).` : 'Não deu para saber o painel pela OS.'} Ficou de fora — se for nosso, marque e escolha o painel.</div>`
    : t.suposto ? '<div class="aviso-tela">A OS não diz o pitch: supus P2.9 V10. Confira.</div>' : '';
  const dup = ctx.est.listas.find(l => info.os && l.os === info.os && l.status !== 'cancelada');
  const salasOS = [...new Set(info.telas.map(t => t.sala || ''))];
  const variasSalas = salasOS.length > 1;
  const res = await B.modal({
    titulo: 'Importar OS ' + (info.os || ''),
    largo: true,
    corpo: `${dup ? `<div class="card aviso" style="margin:0 0 10px"><b>Já existe uma lista com a OS ${B.esc(info.os)}</b> (${B.esc(dup.evento || '')}). Importar de novo cria outra lista.</div>` : ''}
      <div class="grade g2 m1">
        <label class="campo"><span>OS</span><input class="f-os" value="${B.esc(info.os)}"></label>
        <label class="campo"><span>Evento</span><input class="f-evento" value="${B.esc(info.evento)}"></label>
        <label class="campo"><span>Cliente / agência</span><input class="f-cliente" value="${B.esc(info.cliente)}"></label>
        <label class="campo"><span>Local</span><input class="f-local" value="${B.esc([info.local, info.cidade].filter(Boolean).join(' · '))}"></label>
        <label class="campo"><span>Ida (sai do galpão)</span><input type="date" class="f-ida" value="${info.ida || ''}"></label>
        <label class="campo"><span>Volta (chega no galpão)</span><input type="date" class="f-volta" value="${info.volta || ''}"></label>
      </div>
      ${info.montagem || info.fim ? `<p class="dica" style="margin:6px 0 0">Na OS: ${info.montagem ? 'montagem ' + B.dataBR(info.montagem, true) : ''}${info.montagem && info.fim ? ' · ' : ''}${info.fim ? 'último dia ' + B.dataBR(info.fim, true) : ''}. A ida ficou 1 dia antes e a volta 1 dia depois, para reservar o material com folga. Dá para mudar.</p>` : ''}
      ${info.datas_ignoradas.length ? `<div class="card aviso" style="margin:8px 0 0">A OS também cita ${info.datas_ignoradas.map(d => B.dataBR(d, true)).join(', ')}, longe das outras datas (ano digitado errado?). Deixei de fora — confira a ida e a volta.</div>` : ''}
      ${variasSalas ? `<div class="card dica" style="margin:14px 0 0"><b>A OS tem ${salasOS.length} salas</b> <span class="peq">(${salasOS.map(x => B.esc(x || 'sem sala')).join(', ')})</span>
        <label class="linha-flex" style="margin:8px 0 4px"><input type="radio" name="modo-os" value="salas" checked style="width:18px;height:18px"> <span><b>Uma lista por sala</b> — cada sala é separada, conferida e carregada à parte (evento com sublistas)</span></label>
        <label class="linha-flex"><input type="radio" name="modo-os" value="uma" style="width:18px;height:18px"> <span>Tudo em uma lista só</span></label></div>` : ''}
      ${info.abas.length + info.abas_fora.length > 1 ? `<div class="card" style="margin:14px 0 0"><b>Abas da planilha</b>
        <div class="peq mut2" style="margin:2px 0 6px">Entram as abas marcadas. Aba de opção ("Opção 1 / Opção 2", "Cenário…") só entra a confirmada — confira.</div>
        ${info.abas.concat(info.abas_fora).map(n => `<label class="linha-flex" style="margin:4px 0"><input type="checkbox" class="f-aba" value="${B.esc(n)}" ${info.abas.includes(n) ? 'checked' : ''} style="width:18px;height:18px"> <span>${B.esc(n.trim())}</span>${info.abas_fora.includes(n) ? ' <span class="pill amarelo">ficou de fora</span>' : ''}</label>`).join('')}
        <button class="btn sm refazer-abas" style="margin-top:6px">Refazer com estas abas</button></div>` : ''}
      <h3 style="margin:16px 0 6px;font-size:14px">Painéis encontrados na OS (${info.telas.length})</h3>
      ${info.telas.length ? info.telas.map((t, i) => `${variasSalas && (i === 0 || info.telas[i - 1].sala !== t.sala) ? `<div class="sala-h"><span class="sala-tag">SALA</span>${B.esc(t.sala || 'sem sala')}</div>` : ''}<div class="tela" data-i="${i}">
        <label class="linha-flex"><input type="checkbox" class="f-usa" ${t.painel ? 'checked' : ''} style="width:20px;height:20px"> <b class="cresce">${B.esc(variasSalas ? t.nome_curto : t.nome)}</b>
          <span class="muted num">${t.largura_m ? B.num(t.largura_m) + ' × ' + B.num(t.altura_m) + ' m' : 'medida não encontrada'}</span></label>
        <div class="peq mut2" style="margin:4px 0 8px">${B.esc(t.texto)}</div>
        ${avisoTela(t)}
        <div class="grade g2 m1"><label class="campo"><span>Painel</span><select class="f-painel">${opc(t.painel)}</select></label>
        <label class="campo"><span>Montagem</span><select class="f-mont">${Object.entries(B.MONTAGEM).map(([k, v]) => `<option value="${k}" ${k === t.montagem ? 'selected' : ''}>${v}</option>`).join('')}</select></label></div>
      </div>`).join('') : '<p class="muted">Nenhuma linha de painel de LED com medida. A lista é criada só com o cabeçalho.</p>'}
      ${info.outros.length ? `<h3 style="margin:16px 0 6px;font-size:14px">Outros itens de vídeo da OS (conferir)</h3><div class="peq muted">${info.outros.map(o => `• ${B.num(o.qtd)} × ${B.esc(o.texto)}${o.sala ? ' <span class="mut2">(' + B.esc(o.sala) + ')</span>' : ''}`).join('<br>')}</div>` : ''}`,
    aoAbrir: (el, fechar) => {
      el.querySelectorAll('.tela[data-i]').forEach(d => {
        // escolheu o painel numa tela que estava de fora → entra na lista
        d.querySelector('.f-painel').addEventListener('change', e => { if (e.target.value) { d.querySelector('.f-usa').checked = true; e.target.classList.remove('erro'); } });
      });
      const refazer = el.querySelector('.refazer-abas');
      if (refazer) refazer.onclick = () => {
        const marcadas = [...el.querySelectorAll('.f-aba:checked')].map(i => i.value);
        if (!marcadas.length) return B.toast('Marque ao menos uma aba.');
        fechar({ refazerAbas: marcadas });
      };
    },
    botoes: [{ txt: 'Cancelar', valor: null }, {
      txt: 'Criar lista e projeto', cls: 'pri',
      validar: el => {
        const semPainel = [...el.querySelectorAll('.tela[data-i]')].filter(d => d.querySelector('.f-usa').checked && !d.querySelector('.f-painel').value);
        semPainel.forEach(d => d.querySelector('.f-painel').classList.add('erro'));
        if (semPainel.length) { semPainel[0].scrollIntoView({ block: 'center', behavior: 'smooth' }); B.toast('Escolha o painel das telas marcadas (ou desmarque).'); }
        return !semPainel.length;
      },
      valor: el => ({
        os: el.querySelector('.f-os').value.trim(), evento: el.querySelector('.f-evento').value.trim(),
        cliente: el.querySelector('.f-cliente').value.trim(), local: el.querySelector('.f-local').value.trim(),
        ida: el.querySelector('.f-ida').value || null, volta: el.querySelector('.f-volta').value || null,
        porSala: variasSalas && (el.querySelector('[name="modo-os"]:checked') || {}).value === 'salas',
        escolhidas: [...el.querySelectorAll('.tela[data-i]')].filter(d => d.querySelector('.f-usa').checked)
          .map(d => ({ t: info.telas[+d.dataset.i], painel: d.querySelector('.f-painel').value, montagem: d.querySelector('.f-mont').value }))
      })
    }]
  });
  if (!res) return;
  if (res.refazerAbas) return importarOS(ctx, arquivo, { abasEscolhidas: res.refazerAbas, abasLidas: abas });
  const { porSala, escolhidas } = res;
  delete res.porSala; delete res.escolhidas;
  const tela = (e, nome) => novaTela(ctx, { nome, painel: e.painel, montagem: e.montagem, modo: e.t.modo, largura_m: e.t.largura_m, altura_m: e.t.altura_m });
  // anotações: outros itens de vídeo e o que a OS pede de painel e não entrou (P1 sublocado, desmarcado)
  const usadas = new Set(escolhidas.map(e => e.t));
  const fora = info.telas.filter(t => !usadas.has(t));
  // salaAtual: o nome da sala de origem só aparece quando o item é de outra sala
  const deOutra = (deSala, salaAtual) => (salaAtual != null && deSala && normSala(deSala) !== normSala(salaAtual) ? ' (' + deSala + ')' : '');
  const obsDe = (outros, foraDaqui, salaAtual) => [
    outros.length ? 'Da OS: ' + outros.map(o => o.qtd + ' × ' + o.texto + deOutra(o.sala, salaAtual)).join('; ') : '',
    foraDaqui.length ? 'Painéis da OS que ficaram fora da lista: ' + [...new Set(foraDaqui.map(t => (t.qtd_os ? B.num(t.qtd_os) + ' × ' : '') + t.texto + deOutra(t.sala, salaAtual)))].join('; ') : ''
  ].filter(Boolean).join('\n');

  if (!porSala) {
    res.telas = escolhidas.length ? escolhidas.map(e => tela(e, e.t.nome)) : [novaTela(ctx)];
    res.obs = obsDe(info.outros, fora, null);
    // tudo numa sala só: ela vira o título do projeto ("Plenária"), e as telas ficam com o nome curto
    const salasEsc = [...new Set(escolhidas.map(e => normSala(e.t.sala)).filter(Boolean))];
    if (salasEsc.length === 1) {
      res.sala = escolhidas.find(e => e.t.sala).t.sala;
      res.telas.forEach((t, i) => { if (escolhidas[i].t.nome_curto) t.nome = escolhidas[i].t.nome_curto; });
    }
    return novaLista(ctx, res, { abrir: escolhidas.length ? 'projeto' : 'lista' });
  }
  // evento: uma lista por sala que tem tela marcada; outros itens e painéis de fora vão para a sala deles
  // (ou para a primeira sala, com o nome da sala de origem, quando a sala deles não virou lista)
  const comTela = salasOS.filter(sala => escolhidas.some(e => (e.t.sala || '') === sala));
  if (!comTela.length) return B.toast('Marque ao menos uma tela.');
  const grupo = ctx.novoId();
  const mesma = (a, b) => normSala(a) === normSala(b);
  const listas = comTela.map((sala, k) => ({
    id: ctx.novoId(), grupo, sala: sala || 'Sala sem nome', ordem_sala: k,
    os: res.os, evento: res.evento, cliente: res.cliente, local: res.local, ida: res.ida, volta: res.volta,
    telas: escolhidas.filter(e => (e.t.sala || '') === sala).map(e => tela(e, e.t.nome_curto)),
    obs: obsDe(
      info.outros.filter(o => mesma(o.sala, sala) || (k === 0 && !comTela.some(s => mesma(s, o.sala)))),
      fora.filter(t => (t.sala || '') === sala || (k === 0 && !comTela.includes(t.sala || ''))), sala),
    status: 'rascunho', criada_em: ctx.agora(), criada_por: ctx.quem(), sep: null, conf: null, ret: null
  }));
  for (const l of listas) await ctx.D.salvar('listas', l, { silencioso: true });
  await ctx.D.registrar('lista_criada', `importou a OS ${res.os || ''} como evento ${res.evento || ''} com ${listas.length} salas (${listas.map(l => l.sala).join(', ')})`, listas[0].id);
  for (const l of listas) await recalcularLista(ctx, l, { forcar: true });
  B.toast(`Evento criado com ${listas.length} sala${listas.length === 1 ? '' : 's'}.`);
  ctx.ir('evento/' + grupo);
}

// "AUDITÓRIO FACE" (como a OS escreve) e "Auditório Face" (nome da sala na lista) são a mesma sala
const normSala = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
