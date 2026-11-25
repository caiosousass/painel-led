/* Projetech · Painel de LED — projeto técnico da sala.
 *
 * As folhas são as do Projetech Calculator (o mesmo js/cabeamento.js dos dois apps): Pixel map,
 * Cabeamento de sinal e Cabeamento de AC, com a moldura, as cotas e o carimbo de lá. Aqui só se monta
 * o que a lista sabe (evento, sala, OS, datas) e se exporta o PDF (jsPDF).
 */
import * as Cab from '../cabeamento.js';

// cores das portas no 3D (textura do painel)
export const CORES = ['#5fd8ca', '#e290ea', '#7fd17f', '#8b8ff2', '#f2e35c', '#f3a862', '#f29191', '#90baf2', '#c9baf6', '#f8c9d7', '#dceef8', '#a6d873'];
export const NOME_FOLHA = { teste: 'Pixel map', sinal: 'Sinal', ac: 'AC' };
export const FORMATOS = Cab.FORMATOS;
const RAZAO_LOGO = 2946 / 842;          // logo.png
const IMAGENS_SVG = { logo: 'logo.png', 'logo-branco': 'logo-branco.png' };

/* o que vai no carimbo: o que a lista sabe da sala e do evento */
function metaDaLista(ctx, lista, hoje) {
  const { M } = ctx;
  const ps = M.planoSala(lista.telas || [], ctx.catIdx(), lista.projeto);
  const desenhaveis = ps.telas.filter(it => it.pl);
  return {
    ps,
    meta: {
      projeto: lista.evento || '', local: lista.local || '',
      sala: lista.sala || (desenhaveis.length === 1 ? desenhaveis[0].nome : '') || '',
      responsavel: lista.responsavel_projeto || ctx.quem(),
      montagem: lista.ida ? M.D.mais(lista.ida, 1) : '', emissao: hoje || '',
      cliente: lista.cliente || '', agencia: '', os: lista.os || ''
    }
  };
}

export function formatoDaLista(lista) { const f = (lista.projeto || {}).folha; return Cab.FORMATOS[f] ? f : 'a3'; }

/* as folhas de uma sala: [{ tipo, prims, formato, escala }] */
export function folhasDaLista(ctx, lista, { hoje, inicio, total } = {}) {
  const { ps, meta } = metaDaLista(ctx, lista, hoje || ctx.hoje());
  return Cab.folhasDoProjeto(ps, meta, { formato: formatoDaLista(lista), inicio, total, razaoLogo: RAZAO_LOGO });
}

export function svgDaFolha(ctx, lista, folha) { return Cab.svg(folha, IMAGENS_SVG); }

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
  try { imagens['logo-branco'] = await carregarImagem('logo-branco.png', 900); } catch (e) { /* sai sem logo */ }
  const hoje = ctx.hoje();
  const contas = listas.map(l => folhasDaLista(ctx, l, { hoje }).length);
  const total = contas.reduce((a, b) => a + b, 0);
  if (!total) throw new Error('Nenhuma tela com painel e medida (L × A) para desenhar.');
  const folhas = [];
  let n = 0;
  listas.forEach((l, i) => { folhas.push(...folhasDaLista(ctx, l, { hoje, inicio: n, total })); n += contas[i]; });
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
