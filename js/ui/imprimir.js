/* Impressão (ou "Salvar como PDF" do navegador): romaneio com colunas em branco para conferência
 * à caneta, cabeçalho do evento e linhas de assinatura — não é print de tela. */

export function imprimirLista(ctx, lista, { retorno } = {}) {
  imprimir(htmlRomaneio(ctx, lista, { retorno }));
}

/* Evento com várias salas: um romaneio por sala, cada um na sua página (cada sala é carregada à parte) */
export function imprimirEvento(ctx, listas) {
  imprimir(listas.map((l, i) => (i ? '<div class="quebra-pag"></div>' : '') + htmlRomaneio(ctx, l)).join(''));
}

function imprimir(html) {
  const el = document.getElementById('impressao');
  el.innerHTML = html;
  const imgs = [...el.querySelectorAll('img')].filter(i => !i.complete);
  let falta = imgs.length;
  const ir = () => window.print();
  if (!falta) return ir();
  imgs.forEach(i => { i.onload = i.onerror = () => { if (!--falta) ir(); }; });
}

function htmlRomaneio(ctx, lista, { retorno } = {}) {
  const { B, M } = ctx;
  const cat = ctx.catIdx();
  const linhas = M.ordenarParaSeparar(ctx.linhasDa(lista.id).filter(M.linhaAtiva), ctx.est.catalogo);
  const tot = M.totaisLista(lista, linhas, ctx.est.catalogo);
  const telas = (lista.telas || []).map(t => {
    const c = cat.get(t.painel);
    const g = c && c.painel ? M.geometria(t, c.painel) : null;
    return `${B.esc(t.nome || 'Tela')}: ${c ? B.esc(c.nome.replace('Case de Led ', '')) : '?'}${g && g.gabinetes ? ` — ${g.largura_m ? B.num(g.largura_m) + ' × ' + B.num(g.altura_m) + ' m, ' : ''}${g.gabinetes} gab.` : ''}`;
  }).join(' · ');
  let grupoAtual = null;
  const corpo = linhas.map(l => {
    const c = cat.get(l.item);
    const g = c ? c.cat : 'outros';
    let cab = '';
    if (g !== grupoAtual) { grupoAtual = g; cab = `<tr class="cat"><td colspan="${retorno ? 6 : 5}">${B.esc(ctx.CATEGORIAS[g] || 'Outros')}</td></tr>`; }
    if (retorno) {
      const r = M.linhaRetorno(l);
      return cab + `<tr><td class="n">${B.num(r.enviado)}</td><td>${B.esc(c ? c.nome : l.item)}</td><td class="n">${r.respondido ? B.num(r.ok) : ''}</td>
        <td class="n">${r.avaria ? B.num(r.avaria) : ''}</td><td class="n ${r.falta ? 'falta' : ''}">${r.falta ? B.num(r.falta) : ''}</td><td>${B.esc(l.obs || '')}</td></tr>`;
    }
    return cab + `<tr><td class="n">${B.num(l.qtd)}</td><td>${B.esc(c ? c.nome : l.item)}</td><td class="v"></td><td class="v"></td><td>${B.esc(l.obs || '')}</td></tr>`;
  }).join('');
  return `
    <div class="cab-imp"><img src="logo.png" alt="Projetech"><div><h1>${retorno ? 'Retorno do evento' : 'Lista de separação'} — Painel de LED</h1>
      <div>${B.esc(lista.evento || '')}${lista.os ? ' · OS ' + B.esc(lista.os) : ''}</div></div>
      ${lista.sala ? `<div class="sala-imp"><small>SALA</small>${B.esc(lista.sala)}</div>` : ''}</div>
    <div class="meta">
      <div><b>Cliente:</b> ${B.esc(lista.cliente || '—')}</div><div><b>Local:</b> ${B.esc(lista.local || '—')}</div>
      <div><b>Ida:</b> ${B.dataBR(lista.ida, true)} &nbsp; <b>Volta:</b> ${B.dataBR(lista.volta, true)}</div>
      <div style="grid-column:1/-1"><b>Telas:</b> ${telas || '—'}</div>
      <div><b>Cases de LED:</b> ${B.num(tot.cases_led)}</div><div><b>Peso dos painéis:</b> ${B.num(tot.peso_painel_kg, 1)} kg</div>
      <div><b>Potência:</b> ${B.num(tot.potencia_max_w / 1000, 1)} kW máx</div>
      ${lista.obs ? `<div style="grid-column:1/-1"><b>Obs.:</b> ${B.esc(lista.obs)}</div>` : ''}
    </div>
    <table><thead><tr>${retorno
      ? '<th>Foi</th><th>Equipamento</th><th>Voltou</th><th>Avaria</th><th>Faltou</th><th>Obs.</th>'
      : '<th>Qtd</th><th>Equipamento</th><th>Separado</th><th>Retorno</th><th>Obs.</th>'}</tr></thead><tbody>${corpo}</tbody></table>
    <div class="ass">${retorno
      ? `<div>Retorno conferido por<br>${B.esc((lista.ret && lista.ret.por) || '')}</div><div>Data</div><div>Supervisor</div>`
      : `<div>Separado por<br>${B.esc((lista.sep && lista.sep.por) || '')}</div><div>Conferido por<br>${B.esc((lista.conf && lista.conf.por) || '')}</div><div>Retorno conferido por</div>`}</div>
    <p style="margin-top:14px;font-size:9px;color:#555">Projetech · Painel de LED — impresso em ${new Date().toLocaleString('pt-BR')} por ${B.esc(ctx.quem())}</p>`;
}
