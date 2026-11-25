/* Relatório de manutenção — geral (a equipe toda) ou de um técnico.
 * Abre na tela como uma folha (com "Imprimir / Salvar PDF"); a mesma folha vai para a impressão.
 * Indicadores no topo, evolução no tempo, por painel, defeitos, por técnico (ou a parte do técnico na equipe),
 * cobertura semana a semana (fiscalização), fila de conserto e os registros um a um. */
import { COR, colunas, barras, medidor, legenda, n } from './graficos.js';

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const curto = s => String(s || '').replace('Case de Led ', '');
const ICO_ALERTA = '<svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path d="M8 1.5 15 14H1z" fill="currentColor"/><path d="M8 6v3.6M8 11.4v.1" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/></svg>';
const ICO_OK = '<svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><circle cx="8" cy="8" r="7" fill="currentColor"/><path d="m4.8 8.2 2.2 2.2 4.2-4.6" stroke="#fff" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>';

export function htmlRelatorioManutencao(ctx, { de, ate, titulo, tecnico } = {}) {
  const { B, M } = ctx;
  const esc = B.esc;
  const r = M.relatorioManutencao({ manutlog: ctx.est.manutlog, manutencoes: ctx.est.manutencoes }, { de, ate, hoje: ctx.hoje(), tecnico });
  const res = r.resumo;
  const acao = a => (ctx.ACOES_MANUT.find(x => x[0] === a) || [a, a])[1];
  const ddmm = iso => iso.slice(8, 10) + '/' + iso.slice(5, 7);
  const S_TROCA = { nome: 'Trocados', cor: COR.azul }, S_REPARO = { nome: 'Reparados', cor: COR.laranja };

  // ---- indicadores ----
  const vsAnterior = (v, ant) => {
    if (!ant && !v) return '<span>igual ao período anterior</span>';
    const d = v - ant;
    return `<span>${d === 0 ? '=' : d > 0 ? '▲ ' + n(d) : '▼ ' + n(-d)} vs período anterior (${n(ant)})</span>`;
  };
  const semRegistro = r.semanasSemRegistro.length;
  const tiles = [
    { rot: 'Módulos trocados', val: n(r.trocados), sub: vsAnterior(r.trocados, r.anterior.trocados), cor: COR.azul },
    { rot: 'Módulos reparados', val: n(r.reparados), sub: vsAnterior(r.reparados, r.anterior.reparados), cor: COR.laranja },
    { rot: 'Cases revisados / limpos', val: n(res.cases), sub: vsAnterior(res.cases, r.anterior.cases), cor: COR.agua },
    { rot: 'Horas registradas', val: r.horas ? n(r.horas) + ' h' : '—', sub: `<span>${res.registros} registro${res.registros === 1 ? '' : 's'} em ${res.diasComRegistro} dia${res.diasComRegistro === 1 ? '' : 's'}</span>` },
    { rot: 'Semanas com registro', val: r.semanasContadas ? `${r.semanasContadas - semRegistro} de ${r.semanasContadas}` : '—',
      sub: semRegistro ? `<span class="st critico">${ICO_ALERTA} ${semRegistro} sem nenhum registro</span>` : r.semanasContadas ? `<span class="st ok">${ICO_OK} todas com registro</span>` : '<span>período ainda no começo</span>' },
    tecnico
      ? { rot: 'Parte do trabalho da equipe', val: Math.round(r.participacao.modulos * 100) + '%', sub: `<span>dos módulos (${n(r.trocados + r.reparados)} de ${n(r.participacao.equipe.modulos)})</span>` }
      : { rot: 'Peças paradas no conserto', val: n(r.fila.pecasParadas),
          sub: r.fila.paradas.some(m => m.dias_parado >= 14) ? `<span class="st critico">${ICO_ALERTA} há peça parada há mais de 14 dias</span>` : r.fila.pecasParadas ? '<span>esperando conserto</span>' : `<span class="st ok">${ICO_OK} nada parado</span>` }
  ];

  // ---- evolução ----
  const ev = r.evolucao;
  const rotEv = ev.map(p => (r.escala === 'mes' ? MESES[+p.de.slice(5, 7) - 1] : ddmm(p.de)));
  const dicaEv = ev.map(p => (r.escala === 'dia' ? B.dataSemana(p.de) : r.escala === 'semana' ? `semana de ${ddmm(p.de)} a ${ddmm(p.ate)}` : MESES[+p.de.slice(5, 7) - 1]));
  const porQuando = { dia: 'por dia', semana: 'por semana', mes: 'por mês' }[r.escala];
  const graficoModulos = colunas({ rotulos: rotEv, dicas: dicaEv, apagadas: ev.map(p => p.futuro),
    series: [Object.assign({ valores: ev.map(p => p.trocados) }, S_TROCA), Object.assign({ valores: ev.map(p => p.reparados) }, S_REPARO)] });
  const graficoCases = colunas({ rotulos: rotEv, dicas: dicaEv, apagadas: ev.map(p => p.futuro), altura: 150, largura: 400,
    series: [{ nome: 'Cases', cor: COR.agua, valores: ev.map(p => p.cases) }] });

  // ---- por painel / defeitos / por técnico ----
  const trocaDe = mapa => k => { const x = mapa.get(k); return x ? x.modulos : 0; };
  const porPainelTroca = new Map();
  for (const e of r.registros) if (e.acao === 'troca_modulo' && (e.unidade || 'modulos') === 'modulos') porPainelTroca.set(e.painel || '—', (porPainelTroca.get(e.painel || '—') || 0) + (+e.qtd || 0));
  const paineis = [...res.porPainel.entries()].sort((a, b) => (b[1].modulos + b[1].cases) - (a[1].modulos + a[1].cases));
  const graficoPainel = barras({
    linhas: paineis.map(([p, v]) => ({ rotulo: curto(ctx.nomeItem(p)), valores: [porPainelTroca.get(p) || 0, v.modulos - (porPainelTroca.get(p) || 0)], extra: v.cases ? n(v.cases) + ' cases' : '' })),
    series: [S_TROCA, S_REPARO], rotuloLarg: 190, extraLarg: 60
  });
  const defeitos = [...res.porDefeito.entries()].sort((a, b) => b[1].modulos - a[1].modulos);
  const graficoDefeitos = barras({ linhas: defeitos.map(([d, v]) => ({ rotulo: ctx.DEFEITOS_MANUT[d] || d, valores: [v.modulos] })), series: [{ nome: 'Módulos', cor: COR.violeta }], largura: 400, rotuloLarg: 150 });
  let blocoPessoas = '';
  if (!tecnico) {
    const trocaPessoa = new Map();
    for (const e of r.registros) if (e.acao === 'troca_modulo' && (e.unidade || 'modulos') === 'modulos') trocaPessoa.set(e.tecnico || '—', (trocaPessoa.get(e.tecnico || '—') || 0) + (+e.qtd || 0));
    const pessoas = [...res.porPessoa.entries()].sort((a, b) => (b[1].modulos + b[1].cases) - (a[1].modulos + a[1].cases));
    blocoPessoas = `<section class="rel-sec"><h2>Por técnico</h2>${legenda([S_TROCA, S_REPARO])}
      ${pessoas.length ? barras({ linhas: pessoas.map(([p, v]) => ({ rotulo: p, valores: [trocaPessoa.get(p) || 0, v.modulos - (trocaPessoa.get(p) || 0)], extra: [v.cases ? n(v.cases) + ' cases' : '', v.minutos ? n(v.minutos / 60) + ' h' : '', v.registros + ' reg.'].filter(Boolean).join(' · ') })), series: [S_TROCA, S_REPARO], rotuloLarg: 150, extraLarg: 150 }) : '<p class="vazio">Ninguém registrou manutenção no período.</p>'}
      <p class="nota">O relatório de cada técnico sai em Manutenção → Gerar relatório → escolha o nome.</p></section>`;
  } else {
    const p = r.participacao, eq = p.equipe;
    const linha = (rot, frac, a, b, cor, trilho) => `<div class="part"><div class="part-r"><b>${rot}</b><span>${Math.round(frac * 100)}% · ${n(a)} de ${n(b)}</span></div>${medidor(frac, { cor, trilho })}</div>`;
    blocoPessoas = `<section class="rel-sec"><h2>Parte de ${esc(tecnico)} no trabalho da equipe</h2>
      ${linha('Módulos (trocados + reparados)', p.modulos, r.trocados + r.reparados, eq.modulos, COR.azul, COR.trilhoAzul)}
      ${linha('Cases revisados / limpos', p.cases, res.cases, eq.cases, COR.agua, '#c6efdf')}
      ${linha('Registros', p.registros, res.registros, eq.registros, COR.tinta2, '#e1e0d9')}</section>`;
  }

  // ---- cobertura semana a semana (fiscalização) ----
  let cobertura = '';
  if (r.escala !== 'mes') {
    const faltando = new Set(r.semanasSemRegistro.map(s => s.de));
    const cel = ev.map(p => {
      const futuro = p.futuro, falta = r.escala === 'semana' ? faltando.has(p.de) : (!futuro && !p.registros && M.D.diaSemana(p.de) >= 1 && M.D.diaSemana(p.de) <= 5);
      const cls = futuro ? 'futuro' : falta ? 'falta' : p.registros ? 'tem' : 'vazio-c';
      return `<div class="cob ${cls}" title="${esc(r.escala === 'semana' ? 'semana de ' + ddmm(p.de) + ' a ' + ddmm(p.ate) : B.dataSemana(p.de))}: ${p.registros} registro(s)">
        <small>${r.escala === 'semana' ? ddmm(p.de) : B.dataSemana(p.de)}</small>
        <b>${futuro ? '—' : p.registros}</b>${falta ? `<span>${ICO_ALERTA} sem registro</span>` : `<span>${futuro ? 'ainda não' : 'registro' + (p.registros === 1 ? '' : 's')}</span>`}</div>`;
    }).join('');
    cobertura = `<section class="rel-sec"><h2>Registro ${r.escala === 'semana' ? 'semana a semana' : 'dia a dia'}</h2>
      <div class="cobs">${cel}</div>
      <p class="nota">${r.escala === 'semana' ? 'Semana sem nenhum registro de manutenção fica em vermelho (pedaço de semana com menos de 4 dias no período não conta).' : 'Dia útil sem registro fica em vermelho.'}</p></section>`;
  } else if (semRegistro) {
    cobertura = `<section class="rel-sec"><h2>Semanas sem nenhum registro (${semRegistro})</h2><p class="st critico">${ICO_ALERTA} ${r.semanasSemRegistro.map(s => ddmm(s.de) + ' a ' + ddmm(s.ate)).join(' · ')}</p></section>`;
  }

  // ---- fila de conserto ----
  const pill = d => (d >= 14 ? `<span class="st critico">${ICO_ALERTA} ${d} dias</span>` : d >= 7 ? `<span class="st alerta">${ICO_ALERTA} ${d} dias</span>` : `<span>${d} dia${d === 1 ? '' : 's'}</span>`);
  const fila = tecnico
    ? `<section class="rel-sec"><h2>Consertos que ${esc(tecnico)} concluiu</h2>
        ${r.fila.concluidas.length ? `<table class="t"><thead><tr><th class="n">Qtd</th><th>Item</th><th>Defeito</th><th>Concluído</th><th>Resultado</th></tr></thead><tbody>
          ${r.fila.concluidas.map(m => `<tr><td class="n">${n(m.qtd)}</td><td>${esc(ctx.nomeItem(m.item))}</td><td>${esc(m.defeito || '')}</td><td>${B.dataBR(String(m.concluida_em).slice(0, 10), true)}</td><td>${n(m.consertadas || 0)} consertadas${+m.descartadas ? ' · ' + n(m.descartadas) + ' descartadas' : ''}</td></tr>`).join('')}</tbody></table>`
          : '<p class="vazio">Nenhum conserto da fila concluído por ele no período.</p>'}</section>`
    : `<section class="rel-sec"><h2>Fila de conserto <small>avarias que voltaram dos eventos</small></h2>
        <div class="mini">
          <div><small>Entraram</small><b>${n(r.fila.pecasEntraram)}</b><span>peças</span></div>
          <div><small>Consertadas</small><b>${n(r.fila.consertadas)}</b><span>peças</span></div>
          <div><small>Descartadas</small><b>${n(r.fila.descartadas)}</b><span>peças</span></div>
          <div><small>Paradas no fim do período</small><b>${n(r.fila.pecasParadas)}</b><span>peças</span></div></div>
        ${r.fila.paradas.length ? `<table class="t"><thead><tr><th class="n">Qtd</th><th>Item parado</th><th>Defeito</th><th>Entrou</th><th>Parado há</th></tr></thead><tbody>
          ${r.fila.paradas.map(m => `<tr><td class="n">${n(+m.qtd - (m.status === 'concluida' ? 0 : (+m.consertadas || 0) + (+m.descartadas || 0)))}</td><td>${esc(ctx.nomeItem(m.item))}</td><td>${esc(m.defeito || '')}</td><td>${B.dataBR(String(m.aberta_em).slice(0, 10), true)}</td><td>${pill(m.dias_parado)}</td></tr>`).join('')}</tbody></table>` : ''}</section>`;

  // ---- registros ----
  const registros = `<section class="rel-sec quebra-ok"><h2>Registros <small>${r.registros.length}</small></h2>
    ${r.registros.length ? `<table class="t"><thead><tr><th>Dia</th><th>O que foi feito</th><th>Painel / case</th><th class="n">Qtd</th><th>Defeito</th><th>Obs.</th>${tecnico ? '' : '<th>Quem</th>'}</tr></thead><tbody>
      ${r.registros.map(e => `<tr><td>${B.dataSemana(e.data)}</td><td>${esc(acao(e.acao))}</td><td>${esc(curto(ctx.nomeItem(e.painel)))}${e.case ? ' · case ' + esc(e.case) : ''}</td>
        <td class="n">${n(e.qtd)} <small>${esc(ctx.UNIDADES_MANUT[e.unidade] || '')}</small></td><td>${esc(ctx.DEFEITOS_MANUT[e.defeito] || '')}</td><td>${esc(e.obs || '')}</td>${tecnico ? '' : `<td>${esc(e.tecnico || '')}${e.minutos ? ' · ' + e.minutos + ' min' : ''}</td>`}</tr>`).join('')}</tbody></table>`
      : '<p class="vazio">Nenhum registro no período.</p>'}</section>`;

  return `<div class="rel">${ESTILO}
  <header class="rel-cab"><img src="logo.png" alt="Projetech">
    <div class="cresce"><div class="kicker">Relatório de manutenção · painéis de LED</div>
      <h1>${tecnico ? esc(tecnico) : 'Equipe toda'}</h1>
      <div class="sub">${titulo ? esc(titulo) + ' · ' : ''}${B.dataBR(de, true)} a ${B.dataBR(ate, true)}${tecnico ? ' · relatório do técnico' : ' · relatório geral'}</div></div>
    <div class="quando">Gerado em ${B.dataBR(ctx.hoje(), true)}<br>por ${esc(ctx.quem())}</div></header>

  <div class="tiles">${tiles.map(t => `<div class="tile">${t.cor ? `<i style="background:${t.cor}"></i>` : ''}<small>${t.rot}</small><b>${t.val}</b>${t.sub}</div>`).join('')}</div>

  <section class="rel-sec"><h2>Módulos ${porQuando}</h2>${legenda([S_TROCA, S_REPARO])}${graficoModulos}</section>

  <div class="duas">
    <section class="rel-sec"><h2>Cases revisados / limpos ${porQuando}</h2>${graficoCases}</section>
    <section class="rel-sec"><h2>Defeitos <small>módulos</small></h2>${graficoDefeitos || '<p class="vazio">Nenhum defeito registrado.</p>'}</section>
  </div>

  <section class="rel-sec"><h2>Por painel</h2>${paineis.length ? legenda([S_TROCA, S_REPARO]) + graficoPainel : '<p class="vazio">Nada registrado.</p>'}</section>

  ${blocoPessoas}
  ${cobertura}
  ${fila}
  ${registros}

  <div class="ass"><div>${tecnico ? esc(tecnico) : 'Técnico'}</div><div>Supervisor</div><div>Data</div></div>
  <p class="rodape">Projetech · Painel de LED — ${tecnico ? 'relatório do técnico' : 'relatório geral'} · impresso em ${new Date().toLocaleString('pt-BR')} por ${esc(ctx.quem())}</p>
  </div>`;
}

/* A folha na tela, com os botões; "Imprimir" manda a mesma folha para a impressão (ou PDF) */
export function abrirRelatorio(ctx, opts, { aoImprimir } = {}) {
  const html = htmlRelatorioManutencao(ctx, opts);
  const fundo = document.createElement('div');
  fundo.className = 'rel-tela';
  fundo.innerHTML = `<div class="rel-barra"><b class="cresce">${ctx.B.esc(opts.tecnico ? 'Relatório de ' + opts.tecnico : 'Relatório geral')}</b>
    <button class="btn pri rel-imprimir">${ctx.B.ico('print')} Imprimir / Salvar PDF</button><button class="btn rel-fechar">Fechar</button></div>
    <div class="rel-papel">${html}</div>`;
  document.body.appendChild(fundo);
  const fechar = () => { fundo.remove(); document.removeEventListener('keydown', tecla); };
  const tecla = e => { if (e.key === 'Escape') fechar(); };
  document.addEventListener('keydown', tecla);
  fundo.querySelector('.rel-fechar').onclick = fechar;
  fundo.querySelector('.rel-imprimir').onclick = () => {
    const el = document.getElementById('impressao');
    el.innerHTML = html;
    const img = el.querySelector('img');
    const ir = () => { window.print(); if (aoImprimir) aoImprimir(); };
    if (img && !img.complete) { img.onload = img.onerror = ir; } else ir();
  };
}

const ESTILO = `<style>
.rel{--tinta:${COR.tinta};--tinta2:${COR.tinta2};--mudo:${COR.mudo};--linha:${COR.grade};--fundo:${COR.fundo};
  color:var(--tinta);background:#fff;font:12px/1.4 system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.rel .cresce{flex:1;min-width:0}
.rel .rel-cab{display:flex;align-items:center;gap:16px;padding-bottom:12px;border-bottom:2px solid var(--tinta);margin-bottom:14px}
.rel .rel-cab img{height:40px}
.rel .kicker{font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--mudo);font-weight:700}
.rel h1{font-size:24px;line-height:1.15;margin:2px 0;font-weight:700}
.rel .sub{color:var(--tinta2);font-size:12px}
.rel .quando{text-align:right;color:var(--mudo);font-size:10.5px}
.rel .tiles{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:14px}
.rel .tile{position:relative;border:1px solid var(--linha);border-radius:10px;padding:9px 11px 10px 14px;background:var(--fundo);break-inside:avoid}
.rel .tile>i{position:absolute;left:0;top:10px;bottom:10px;width:4px;border-radius:0 3px 3px 0}
.rel .tile small{display:block;color:var(--tinta2);font-size:10.5px}
.rel .tile b{display:block;font-size:24px;font-weight:650;line-height:1.2;margin:2px 0}
.rel .tile span{color:var(--mudo);font-size:10.5px}
.rel .st{display:inline-flex;align-items:center;gap:4px;font-weight:600}
.rel .st.critico{color:${COR.critico}}.rel .st.alerta{color:#9a6700}.rel .st.ok{color:#006300}
.rel .rel-sec{margin:0 0 14px;break-inside:avoid}
.rel .rel-sec.quebra-ok{break-inside:auto}
.rel h2{font-size:13px;font-weight:700;margin:0 0 6px;padding-bottom:4px;border-bottom:1px solid var(--linha)}
.rel h2 small{font-weight:500;color:var(--mudo);margin-left:6px}
.rel .duas{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.rel svg.g{display:block;width:100%;height:auto}
.rel .g-leg{display:flex;gap:14px;font-size:10.5px;color:var(--tinta2);margin:0 0 4px}
.rel .g-leg span{display:inline-flex;align-items:center;gap:5px}
.rel .g-leg i{width:10px;height:10px;border-radius:3px;display:inline-block}
.rel .part{margin:6px 0 10px}
.rel .part-r{display:flex;justify-content:space-between;font-size:11.5px;margin-bottom:4px}
.rel .part-r span{color:var(--tinta2)}
.rel .g-med{height:10px;border-radius:5px;overflow:hidden}
.rel .g-med i{display:block;height:100%;border-radius:5px}
.rel .cobs{display:grid;grid-template-columns:repeat(auto-fill,minmax(74px,1fr));gap:6px}
.rel .cob{border:1px solid var(--linha);border-radius:8px;padding:5px 7px;background:var(--fundo)}
.rel .cob small{display:block;color:var(--mudo);font-size:10px}
.rel .cob b{display:block;font-size:16px;font-weight:650}
.rel .cob span{font-size:9.5px;color:var(--mudo);display:inline-flex;align-items:center;gap:3px}
.rel .cob.tem{border-color:#9ec5f4;background:#f3f8fe}
.rel .cob.falta{border:1.5px solid ${COR.critico};background:#fdf2f2}
.rel .cob.falta span{color:${COR.critico};font-weight:700}
.rel .cob.futuro{opacity:.45}
.rel .mini{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:8px}
.rel .mini div{border:1px solid var(--linha);border-radius:8px;padding:6px 9px}
.rel .mini small{display:block;color:var(--tinta2);font-size:10px}
.rel .mini b{font-size:18px;font-weight:650;margin-right:4px}
.rel .mini span{color:var(--mudo);font-size:10px}
.rel table.t{width:100%;border-collapse:collapse;font-size:11px}
.rel table.t th{text-align:left;font-size:9.5px;text-transform:uppercase;letter-spacing:.04em;color:var(--mudo);font-weight:700;border:0;border-bottom:1px solid var(--tinta2);padding:4px 6px;background:none}
.rel table.t td{border:0;border-bottom:1px solid var(--linha);padding:4px 6px;vertical-align:top}
.rel table.t .n{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
.rel table.t td small{color:var(--mudo)}
.rel table.t tr{break-inside:avoid}
.rel .vazio{color:var(--mudo);margin:4px 0}
.rel .nota{color:var(--mudo);font-size:10px;margin:6px 0 0}
.rel .ass{display:grid;grid-template-columns:repeat(3,1fr);gap:24px;margin-top:30px;break-inside:avoid}
.rel .ass div{border-top:1px solid var(--tinta);padding-top:4px;text-align:center;color:var(--tinta2);font-size:11px}
.rel .rodape{margin-top:14px;font-size:9px;color:var(--mudo)}
</style>`;
