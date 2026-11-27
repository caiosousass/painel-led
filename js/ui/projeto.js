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
export const NOME_FOLHA = { titulo: 'Título', ac: 'AC', sinal: 'Sinal', ambos: 'AC e Sinal' };
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
export function folhasDaLista(ctx, lista, { hoje, inicio, total } = {}) {
  const ps = ctx.M.planoSala(lista.telas || [], ctx.catIdx(), lista.projeto);
  return Cab.folhasTecnicas(ps, metaDaLista(ctx, lista, hoje || ctx.hoje()), { inicio, total, razaoLogo: RAZAO_LOGO, formato: formatoDaLista(lista), capa: (lista.projeto || {}).capa !== '0' });
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
  const contas = listas.map(l => folhasDaLista(ctx, l, { hoje }).filter(f => f.tipo !== 'titulo').length);   // a folha de título não conta
  const total = contas.reduce((a, b) => a + b, 0);
  if (!total) throw new Error('Nenhuma tela com painel e medida (L × A) para desenhar.');
  const folhas = [];
  let n = 0;
  listas.forEach((l, i) => { folhas.push(...folhasDaLista(ctx, l, { hoje, inicio: n, total })); n += contas[i]; });
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
