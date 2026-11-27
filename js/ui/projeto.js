/* Projetech · Painel de LED — projeto técnico da sala.
 *
 * O desenho é o do modelo da Projetech (projeto da Syngenta, OS 32465) e a prancha é a do Projetech
 * Calculator (moldura e carimbo iguais; A3, 16:9 ou A4), tudo em js/cabeamento.js: Cabeamento de AC
 * (circuitos, réguas e o rack de energia), Cabeamento de Sinal (portas, controladoras e a processadora) — ou
 * uma folha só, "AC e Sinal", na sala pequena. Aqui só se monta o que a lista sabe e se exporta o PDF.
 */
import * as Cab from '../cabeamento.js';

// cores das portas (as do projeto) — também no 3D
export const CORES = Cab.CORES_PORTA;
export const NOME_FOLHA = { titulo: 'Título', ac: 'AC', sinal: 'Sinal', ambos: 'AC e Sinal', lista: 'Lista' };
export const FORMATOS = Cab.FORMATOS;
export function formatoDaLista(lista) { const f = (lista.projeto || {}).folha; return Cab.FORMATOS[f] ? f : 'a3'; }
const RAZAO_LOGO = 2946 / 842;          // logo.png
const IMAGENS_SVG = { logo: 'logo.png' };

/* o que vai no carimbo: o que a lista sabe da sala e do evento */
function metaDaLista(ctx, lista, hoje) {
  return {
    projeto: lista.evento || '', local: lista.local || '', sala: lista.sala || '',
    responsavel: lista.responsavel_projeto || ctx.quem(), emissao: hoje || '',
    montagem: lista.ida ? ctx.M.D.mais(lista.ida, 1) : '',   // a ida é 1 dia antes da montagem
    cliente: lista.cliente || '', agencia: '', os: lista.os || ''
  };
}

/* as folhas de uma sala: [{ tipo: 'ac'|'sinal'|'ambos', prims, formato }] */
/* A lista de material da sala, do jeito que vai na folha (mesma ordem e categorias do romaneio impresso) */
function dadosDaListaMaterial(ctx, lista) {
  const { B, M } = ctx, cat = ctx.catIdx();
  const linhas = M.ordenarParaSeparar(ctx.linhasDa(lista.id).filter(M.linhaAtiva), ctx.est.catalogo);
  const tot = M.totaisLista(lista, linhas, ctx.est.catalogo);
  const grupos = [];
  for (const l of linhas) {
    const c = cat.get(l.item), g = c ? c.cat : 'outros', nome = ctx.CATEGORIAS[g] || 'Outros';
    if (!grupos.length || grupos[grupos.length - 1].chave !== g) grupos.push({ chave: g, nome, itens: [] });
    grupos[grupos.length - 1].itens.push({ qtd: l.qtd, nome: c ? c.nome : l.item, obs: l.obs || '' });
  }
  const telasTxt = (lista.telas || []).map(t => {
    const c = cat.get(t.painel), g = c && c.painel ? M.geometria(t, c.painel) : null;
    return `${t.nome || 'Tela'}: ${c ? c.nome.replace('Case de Led ', '') : '?'}${g && g.gabinetes ? ` — ${g.largura_m ? B.num(g.largura_m) + ' × ' + B.num(g.altura_m) + ' m, ' : ''}${g.gabinetes} gab.` : ''}`;
  }).join(' · ');
  const nItens = linhas.length;
  return {
    telasTxt,
    info: [lista.evento || '', lista.os ? 'OS ' + lista.os : '', 'Ida ' + B.dataBR(lista.ida, true), 'Volta ' + B.dataBR(lista.volta, true)].filter(Boolean),
    grupos,
    carimbo: [[['Itens', String(nItens)], ['Cases de LED', B.num(tot.cases_led)]], [['Peso dos painéis', B.num(tot.peso_painel_kg, 1) + ' kg'], ['Potência', B.num(tot.potencia_max_w / 1000, 1) + ' kW máx']],
      [['Ida', B.dataBR(lista.ida, true)], ['Volta', B.dataBR(lista.volta, true)]]],
    ass: [(lista.sep && lista.sep.por) || '', (lista.conf && lista.conf.por) || '', (lista.ret && lista.ret.por) || '']
  };
}
const listaNoPdf = lista => (lista.projeto || {}).listas_pdf !== '0';
function folhasDaListaMaterial(ctx, lista, { hoje, inicio, total } = {}) {
  const ps = ctx.M.planoSala(lista.telas || [], ctx.catIdx(), lista.projeto);
  return Cab.folhasListaMaterial(ps, metaDaLista(ctx, lista, hoje || ctx.hoje()), dadosDaListaMaterial(ctx, lista), { inicio, total, razaoLogo: RAZAO_LOGO, formato: formatoDaLista(lista) });
}
/* As folhas da sala: título (sem número), as técnicas e, no fim, a lista de material (semListas: só as técnicas) */
export function folhasDaLista(ctx, lista, { hoje, inicio = 0, total, semListas } = {}) {
  const ps = ctx.M.planoSala(lista.telas || [], ctx.catIdx(), lista.projeto);
  const meta = metaDaLista(ctx, lista, hoje || ctx.hoje()), op = { razaoLogo: RAZAO_LOGO, formato: formatoDaLista(lista), capa: (lista.projeto || {}).capa !== '0' };
  const comLista = !semListas && listaNoPdf(lista);
  const nTec = Cab.folhasTecnicas(ps, meta, op).filter(f => f.tipo !== 'titulo').length;
  const nLis = comLista ? folhasDaListaMaterial(ctx, lista, { hoje }).length : 0;
  const tot = total || inicio + nTec + nLis;
  const tec = Cab.folhasTecnicas(ps, meta, Object.assign({ inicio, total: tot }, op));
  return comLista ? tec.concat(folhasDaListaMaterial(ctx, lista, { hoje, inicio: inicio + nTec, total: tot })) : tec;
}

export function svgDaFolha(ctx, lista, folha, op) { return Cab.svg(folha, IMAGENS_SVG, op); }

/* ---------------- PDF ---------------- */
function carregarScript(src) {
  return new Promise((ok, erro) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => erro(new Error('Não carregou ' + src)); document.head.appendChild(s); });
}
async function carregarImagem(url, largMax) {
  const blob = await (await fetch(url)).blob();
  const data = await new Promise(ok => { const r = new FileReader(); r.onload = () => ok(r.result); r.readAsDataURL(blob); });
  const img = await new Promise((ok, erro) => { const i = new Image(); i.onload = () => ok(i); i.onerror = erro; i.src = data; });
  const k = Math.min(1, largMax / img.naturalWidth);
  const cv = document.createElement('canvas');
  cv.width = Math.round(img.naturalWidth * k); cv.height = Math.round(img.naturalHeight * k);
  cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
  return { data: cv.toDataURL('image/png'), w: cv.width, h: cv.height };
}

export async function exportarProjeto(ctx, lista) {
  return exportarProjetoDe(ctx, [lista], ['Projeto', lista.os, lista.evento, lista.sala]);
}

/* Evento com várias salas: um PDF só, as salas em sequência e a numeração das folhas corrida */
export async function exportarProjetoEvento(ctx, listas) {
  const l0 = listas[0] || {};
  return exportarProjetoDe(ctx, listas, ['Projeto', l0.os, l0.evento]);
}

async function exportarProjetoDe(ctx, listas, partesNome) {
  if (!window.jspdf) await carregarScript('vendor/jspdf.umd.min.js');
  const imagens = {};
  try { imagens.logo = await carregarImagem('logo.png', 1000); } catch (e) { /* sai sem logo */ }
  const hoje = ctx.hoje();
  const contas = listas.map(l => folhasDaLista(ctx, l, { hoje, semListas: true }).filter(f => f.tipo !== 'titulo').length);   // a folha de título não conta
  if (!contas.reduce((a, b) => a + b, 0)) throw new Error('Nenhuma tela com painel e medida (L × A) para desenhar.');
  const comLista = listas.filter(listaNoPdf), contasL = comLista.map(l => folhasDaListaMaterial(ctx, l, { hoje }).length);
  const total = contas.reduce((a, b) => a + b, 0) + contasL.reduce((a, b) => a + b, 0);
  const folhas = [];
  let n = 0;
  listas.forEach((l, i) => { folhas.push(...folhasDaLista(ctx, l, { hoje, inicio: n, total, semListas: true })); n += contas[i]; });
  // no fim do projeto, as listas de todas as salas (cada uma nas suas folhas)
  comLista.forEach((l, i) => { folhas.push(...folhasDaListaMaterial(ctx, l, { hoje, inicio: n, total })); n += contasL[i]; });
  if (!folhas.length) throw new Error('Nenhuma folha para exportar.');
  const { jsPDF } = window.jspdf;
  const F0 = folhas[0].formato;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [F0.w, F0.h], compress: true });
  folhas.forEach((f, i) => {
    if (i) doc.addPage([f.formato.w, f.formato.h], 'landscape');
    Cab.pdf(doc, f, imagens);
  });
  const nome = partesNome.filter(Boolean).join(' - ').replace(/[\\/:*?"<>|]/g, '');
  doc.save(nome + '.pdf');
  return folhas.length;
}
