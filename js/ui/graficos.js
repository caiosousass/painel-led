/* Gráficos do relatório: SVG em texto, sem biblioteca (funciona impresso, no PDF e offline).
 * Regras: barras finas (≤ 24 px) com ponta arredondada de 4 px só do lado do valor; 2 px de fundo entre partes
 * empilhadas; grade em linha fina e clara; valor escrito na ponta (nunca em todo ponto); legenda quando há 2+
 * séries; texto sempre em cor de texto (a cor fica na marca). Paleta validada (cores 1–3 da paleta de referência,
 * daltonismo ok; a verde-água sempre vai com o número escrito). Cada marca tem <title> = dica ao passar o mouse. */

export const COR = {
  azul: '#2a78d6', laranja: '#eb6834', agua: '#1baf7a', violeta: '#6250d6',
  fundo: '#fcfcfb', grade: '#e1e0d9', base: '#c3c2b7', tinta: '#0b0b0b', tinta2: '#52514e', mudo: '#898781',
  critico: '#d03b3b', alerta: '#fab219', ok: '#0ca30c', trilhoAzul: '#cde2fb'
};
const FONTE = 'system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif';
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nf = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });
export const n = v => nf.format(+v || 0);
const r1 = v => Math.round(v * 10) / 10;

// escala "redonda" para o eixo: 0, 5, 10, 15… (~4 marcas)
function escalaRedonda(max, marcas = 4) {
  if (!(max > 0)) return { max: 1, passo: 1 };
  const bruto = max / marcas, p10 = Math.pow(10, Math.floor(Math.log10(bruto)));
  const passo = [1, 2, 2.5, 5, 10].map(k => k * p10).find(k => k >= bruto) || 10 * p10;
  return { max: Math.ceil(max / passo) * passo, passo };
}

// retângulo com a ponta (topo ou direita) arredondada e a base reta
function retPonta(x, y, w, h, lado, raio = 4) {
  if (w <= 0 || h <= 0) return '';
  const rr = Math.min(raio, lado === 'topo' ? w / 2 : h / 2, lado === 'topo' ? h : w);
  if (lado === 'topo') return `M${r1(x)},${r1(y + h)}V${r1(y + rr)}Q${r1(x)},${r1(y)} ${r1(x + rr)},${r1(y)}H${r1(x + w - rr)}Q${r1(x + w)},${r1(y)} ${r1(x + w)},${r1(y + rr)}V${r1(y + h)}Z`;
  return `M${r1(x)},${r1(y)}H${r1(x + w - rr)}Q${r1(x + w)},${r1(y)} ${r1(x + w)},${r1(y + rr)}V${r1(y + h - rr)}Q${r1(x + w)},${r1(y + h)} ${r1(x + w - rr)},${r1(y + h)}H${r1(x)}Z`;
}
const ret = (x, y, w, h) => (w > 0 && h > 0 ? `M${r1(x)},${r1(y)}h${r1(w)}v${r1(h)}h${r1(-w)}Z` : '');

export function legenda(series) {
  if (!series || series.length < 2) return '';
  return `<div class="g-leg">${series.map(s => `<span><i style="background:${s.cor}"></i>${esc(s.nome)}</span>`).join('')}</div>`;
}

/* Colunas (empilhadas quando há mais de uma série) ao longo do tempo.
 * rotulos: ['05/10', …]; series: [{ nome, cor, valores: [] }]; dicas: texto do período de cada coluna */
export function colunas({ rotulos, series, dicas = [], altura = 170, largura = 640, apagadas = [] }) {
  const N = rotulos.length;
  if (!N) return '';
  const totais = rotulos.map((_, i) => series.reduce((s, x) => s + (+x.valores[i] || 0), 0));
  const { max, passo } = escalaRedonda(Math.max(...totais));
  const m = { e: 34, d: 6, c: 18, b: 22 };
  const W = largura - m.e - m.d, H = altura - m.c - m.b;
  const banda = W / N, bw = Math.min(24, banda * 0.62);
  const y = v => m.c + H - (v / max) * H;
  let s = '';
  for (let v = 0; v <= max + 1e-9; v += passo) {
    s += `<line x1="${m.e}" x2="${largura - m.d}" y1="${r1(y(v))}" y2="${r1(y(v))}" stroke="${v === 0 ? COR.base : COR.grade}" stroke-width="1"/>`;
    s += `<text x="${m.e - 6}" y="${r1(y(v) + 3.5)}" text-anchor="end" font-size="10" fill="${COR.mudo}">${n(v)}</text>`;
  }
  const cadaRotulo = Math.max(1, Math.ceil(N / 14));
  const rotularTopo = N <= 14;
  rotulos.forEach((rot, i) => {
    const x = m.e + banda * i + (banda - bw) / 2;
    const segs = series.map(x2 => ({ v: +x2.valores[i] || 0, cor: x2.cor, nome: x2.nome })).filter(g => g.v > 0);
    let base = y(0);
    segs.forEach((g, k) => {
      const h = (g.v / max) * H;
      const topo = k === segs.length - 1;
      const gap = k > 0 ? 2 : 0;                                      // 2 px de fundo entre partes
      const yy = base - h, hh = h - gap;
      s += `<path d="${topo ? retPonta(x, yy, bw, hh, 'topo') : ret(x, yy, bw, hh)}" fill="${g.cor}"${apagadas[i] ? ' opacity=".35"' : ''}><title>${esc((dicas[i] || rot) + ': ' + n(g.v) + ' ' + g.nome.toLowerCase())}</title></path>`;
      base = yy;
    });
    if (totais[i] > 0 && (rotularTopo || totais[i] === Math.max(...totais)))
      s += `<text x="${r1(x + bw / 2)}" y="${r1(y(totais[i]) - 5)}" text-anchor="middle" font-size="10.5" font-weight="600" fill="${COR.tinta}">${n(totais[i])}</text>`;
    if (i % cadaRotulo === 0)
      s += `<text x="${r1(m.e + banda * i + banda / 2)}" y="${altura - 7}" text-anchor="middle" font-size="10" fill="${COR.mudo}">${esc(rot)}</text>`;
  });
  return `<svg class="g" viewBox="0 0 ${largura} ${altura}" role="img" font-family='${FONTE}' preserveAspectRatio="xMidYMid meet">${s}</svg>`;
}

/* Barras horizontais (empilhadas quando há mais de uma série), com o total na ponta.
 * linhas: [{ rotulo, valores: [] , extra: 'texto à direita' }] */
export function barras({ linhas, series, largura = 640, rotuloLarg = 170, extraLarg = 0 }) {
  if (!linhas.length) return '';
  const linhaH = 24, esp = 12;
  const altura = linhas.length * linhaH + 6;
  const totais = linhas.map(l => series.reduce((s, x, k) => s + (+l.valores[k] || 0), 0));
  const max = Math.max(...totais) || 1;
  const x0 = rotuloLarg, W = largura - rotuloLarg - extraLarg - 40;
  let s = `<line x1="${x0}" x2="${x0}" y1="0" y2="${altura - 4}" stroke="${COR.base}" stroke-width="1"/>`;
  linhas.forEach((l, i) => {
    const yc = i * linhaH + linhaH / 2 + 2;
    s += `<text x="${x0 - 8}" y="${r1(yc + 3.5)}" text-anchor="end" font-size="11" fill="${COR.tinta2}">${esc(l.rotulo)}</text>`;
    const segs = series.map((x, k) => ({ v: +l.valores[k] || 0, cor: x.cor, nome: x.nome })).filter(g => g.v > 0);
    let xx = x0 + 1;
    segs.forEach((g, k) => {
      const w = (g.v / max) * W;
      const ponta = k === segs.length - 1;
      const gap = k > 0 ? 2 : 0;
      s += `<path d="${ponta ? retPonta(xx + gap, yc - esp / 2, w - gap, esp, 'direita') : ret(xx + gap, yc - esp / 2, w - gap, esp)}" fill="${g.cor}"><title>${esc(l.rotulo + ': ' + n(g.v) + ' ' + g.nome.toLowerCase())}</title></path>`;
      xx += w;
    });
    // sem nada nesta medida (ex.: painel que só teve limpeza de cases): um traço apagado, não um "0"
    s += totais[i] > 0 ? `<text x="${r1(xx + 6)}" y="${r1(yc + 3.5)}" font-size="11" font-weight="600" fill="${COR.tinta}">${n(totais[i])}</text>`
      : `<text x="${r1(xx + 6)}" y="${r1(yc + 3.5)}" font-size="11" fill="${COR.mudo}">—</text>`;
    if (l.extra) s += `<text x="${largura - 4}" y="${r1(yc + 3.5)}" text-anchor="end" font-size="10.5" fill="${COR.mudo}">${esc(l.extra)}</text>`;
  });
  return `<svg class="g" viewBox="0 0 ${largura} ${altura}" role="img" font-family='${FONTE}' preserveAspectRatio="xMidYMid meet">${s}</svg>`;
}

/* Medidor: parte de um total (a trilha é um tom claro da mesma cor) */
export function medidor(frac, { cor = COR.azul, trilho = COR.trilhoAzul } = {}) {
  const p = Math.max(0, Math.min(1, +frac || 0)) * 100;
  return `<div class="g-med" style="background:${trilho}"><i style="width:${r1(p)}%;background:${cor}"></i></div>`;
}
