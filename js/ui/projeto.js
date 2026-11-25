/* Projetech · Painel de LED — criador de projeto técnico.
 *
 * Desenha, no estilo do projeto da Abbvie (OS 30469), cada tela com o cabeamento de SINAL (uma cor por
 * porta, serpentina com início verde e fim vermelho, etiqueta Novastar em cada gabinete) e de ENERGIA
 * (réguas Steck/Powercon agrupando colunas e descendo até os racks), mais a folha de distribuição.
 *
 * O desenho é uma lista de primitivas em milímetros; o mesmo desenho vira SVG (prévia no app) e PDF
 * (jsPDF). As contas (portas, réguas, racks) vêm do motor — aqui só se posiciona.
 */

export const FOLHA = { w: 406.4, h: 228.6 }; // 16:9, como o projeto da Abbvie
const MM_PT = 0.3528;
export const CORES = ['#7fd17f', '#8b8ff2', '#f2e35c', '#f3a862', '#f29191', '#90baf2', '#c9baf6', '#f8c9d7', '#dceef8', '#5fd8ca', '#e290ea', '#a6d873'];

const n2 = v => String(+(+v).toFixed(2)).replace('.', ',');
const larguraTexto = (txt, pt, bold) => String(txt).length * pt * MM_PT * (bold ? 0.56 : 0.5);
function cortar(txt, maxMm, pt, bold) {
  const s = String(txt || '');
  if (larguraTexto(s, pt, bold) <= maxMm) return s;
  const n = Math.max(1, Math.floor(maxMm / (pt * MM_PT * (bold ? 0.56 : 0.5))) - 1);
  return s.slice(0, n) + '…';
}

/* ---------------- desenho de uma tela ---------------- */
export function desenhoTela(pl, area) {
  const P = [];
  const temEnergia = pl.energia.reguas.length > 0;
  const hEnergia = temEnergia ? Math.min(46, area.h * 0.38) : 0;
  const maxH = area.h - hEnergia - 2;
  const cell = Math.min(area.w / pl.colunas, maxH / pl.linhas);
  const pw = cell * pl.colunas, ph = cell * pl.linhas;
  const x0 = area.x + (area.w - pw) / 2;
  const y0 = area.y + (temEnergia ? Math.max(0, (maxH - ph) * 0.5) : (area.h - ph) / 2);
  const cx = c => x0 + (c + 0.5) * cell, cy = r => y0 + (r + 0.5) * cell;

  // gabinetes coloridos por porta
  const onde = new Map();
  pl.dados.portas.forEach((p, i) => p.caminho.forEach(([c, r], k) => onde.set(c + ',' + r, { i, n: p.n, k: k + 1 })));
  const sw = Math.max(0.06, cell * 0.018);
  for (let c = 0; c < pl.colunas; c++) for (let r = 0; r < pl.linhas; r++) {
    const o = onde.get(c + ',' + r) || { i: 0 };
    P.push({ t: 'rect', x: x0 + c * cell, y: y0 + r * cell, w: cell, h: cell, fill: CORES[o.i % CORES.length], stroke: '#ffffff', sw });
  }
  // etiqueta Novastar (só quando cabe de ler)
  const pt = cell / 6.4 / MM_PT;
  if (pt >= 2.1) {
    for (const [chave, o] of onde) {
      const [c, r] = chave.split(',').map(Number);
      const linhas = ['C-1', 'P-' + o.n, 'RV-' + o.k, 'A-0°', 'WH-' + pl.px_l + 'x' + pl.px_a];
      linhas.forEach((t, j) => P.push({ t: 'text', x: x0 + c * cell + cell * 0.06, y: y0 + r * cell + cell * (0.17 + j * 0.155), txt: t, size: pt, color: '#1f2937' }));
    }
  }
  // caminho do sinal: serpentina com setas, início verde e fim vermelho
  const tr = Math.max(0.45, cell * 0.12);
  for (const p of pl.dados.portas) {
    const pts = p.caminho.map(([c, r]) => [cx(c), cy(r)]);
    P.push({ t: 'poly', pts, stroke: '#1e3a8a', sw: Math.max(0.12, cell * 0.035) });
    for (let k = 1; k < pts.length; k++) {
      const [ax, ay] = pts[k - 1], [bx, by] = pts[k];
      const mx = (ax + bx) / 2, my = (ay + by) / 2, ang = Math.atan2(by - ay, bx - ax);
      P.push({ t: 'tri', fill: '#1e3a8a', pts: [[mx + Math.cos(ang) * tr, my + Math.sin(ang) * tr], [mx + Math.cos(ang + 2.5) * tr, my + Math.sin(ang + 2.5) * tr], [mx + Math.cos(ang - 2.5) * tr, my + Math.sin(ang - 2.5) * tr]] });
    }
    const rr = Math.max(0.55, cell * 0.13);
    P.push({ t: 'circle', x: pts[0][0], y: pts[0][1], r: rr, fill: '#22c55e', stroke: '#14532d', sw: 0.15 });
    P.push({ t: 'circle', x: pts[pts.length - 1][0], y: pts[pts.length - 1][1], r: rr, fill: '#ef4444', stroke: '#7f1d1d', sw: 0.15 });
    if (pl.cfg.processadora && pt >= 2.1) P.push({ t: 'text', x: x0 + p.caminho[0][0] * cell + cell * 0.06, y: y0 + (p.caminho[0][1] + 1) * cell - cell * 0.06, txt: pl.cfg.processadora + '-' + p.n, size: pt, bold: true, color: '#111827' });
  }
  P.push({ t: 'rect', x: x0, y: y0, w: pw, h: ph, stroke: '#64748b', sw: 0.2 });

  // energia: réguas (chaves) descendo até os racks
  if (temEnergia) {
    const yB = y0 + ph + Math.max(3, hEnergia * 0.14);
    const rackH = Math.min(15, hEnergia * 0.42);
    const yR = y0 + ph + hEnergia * 0.5;
    const nR = pl.energia.racks.length;
    const rackW = Math.min(24, area.w / Math.max(1, nR * 1.6));
    const reg = pl.energia.reguas.map(r => {
      const xL = x0 + (r.col_ini + 0.5) * cell, xR = x0 + (r.col_fim + 0.5) * cell;
      return Object.assign({}, r, { xL, xR, xm: (xL + xR) / 2 });
    });
    // racks centrados sob as suas réguas, sem encostar um no outro
    const racks = pl.energia.racks.map(rk => {
      const rs = reg.filter(r => r.rack === rk.n);
      return Object.assign({}, rk, { x: rs.reduce((s, r) => s + r.xm, 0) / rs.length, rs });
    });
    const gap = rackW * 1.35;
    for (let i = 1; i < racks.length; i++) if (racks[i].x - racks[i - 1].x < gap) racks[i].x = racks[i - 1].x + gap;
    const sobra = racks.length ? racks[racks.length - 1].x + rackW / 2 - (area.x + area.w) : 0;
    if (sobra > 0) racks.forEach(rk => { rk.x -= sobra; });
    for (const r of reg) {
      P.push({ t: 'line', x1: r.xL, y1: y0 + ph + 0.6, x2: r.xL, y2: yB, stroke: '#111827', sw: 0.3 });
      P.push({ t: 'line', x1: r.xR, y1: y0 + ph + 0.6, x2: r.xR, y2: yB, stroke: '#111827', sw: 0.3 });
      P.push({ t: 'line', x1: r.xL, y1: yB, x2: r.xR, y2: yB, stroke: '#111827', sw: 0.3 });
    }
    for (const rk of racks) {
      const m = rk.rs.length;
      rk.rs.forEach((r, j) => {
        const esq = rk.x - rackW / 2, dir = rk.x + rackW / 2;
        const yE = yR + rackH * (0.22 + 0.56 * (m > 1 ? j / (m - 1) : 0.5));
        let pts;
        if (r.xm < esq) pts = [[r.xm, yB], [r.xm, yE], [esq, yE]];
        else if (r.xm > dir) pts = [[r.xm, yB], [r.xm, yE], [dir, yE]];
        else pts = [[r.xm, yB], [r.xm, yR]];
        P.push({ t: 'poly', pts, stroke: '#111827', sw: 0.55 });
        const s = 1.1;
        P.push({ t: 'tri', fill: '#2563eb', pts: [[r.xm - s, yB - 0.2], [r.xm + s, yB - 0.2], [r.xm, yB + s * 1.4]] });
      });
      // o rack (caixa com as tomadas, como no desenho de vocês)
      const saidas = { 'rack-5': 5, 'rack-9': 9, 'rack-12': 12 }[rk.tipo] || 9;
      const colsT = saidas === 12 ? 4 : 3, linT = Math.ceil(saidas / colsT);
      P.push({ t: 'rect', x: rk.x - rackW / 2, y: yR, w: rackW, h: rackH, fill: '#3f4652', stroke: '#111827', sw: 0.35, r: 1.2 });
      const tw = rackW * 0.8 / colsT, th = rackH * 0.78 / linT;
      for (let k = 0; k < saidas; k++) {
        const ci = k % colsT, li = Math.floor(k / colsT);
        const tx = rk.x - rackW * 0.4 + ci * tw, ty = yR + rackH * 0.11 + li * th;
        P.push({ t: 'rect', x: tx + tw * 0.08, y: ty + th * 0.1, w: tw * 0.55, h: th * 0.78, fill: '#3b82f6', stroke: '#dbeafe', sw: 0.12, r: 0.5 });
        P.push({ t: 'rect', x: tx + tw * 0.7, y: ty + th * 0.3, w: tw * 0.2, h: th * 0.4, fill: '#ef4444', r: 0.2 });
      }
      P.push({ t: 'rect', x: rk.x - rackW / 2 + 1, y: yR + rackH, w: 1.4, h: 1.6, fill: '#111827' });
      P.push({ t: 'rect', x: rk.x + rackW / 2 - 2.4, y: yR + rackH, w: 1.4, h: 1.6, fill: '#111827' });
      P.push({ t: 'text', x: rk.x, y: yR + rackH + 5, txt: `Rack ${rk.n} · ${saidas} saídas · ${rk.rs.length} régua${rk.rs.length === 1 ? '' : 's'}`, size: 6.5, align: 'center', color: '#111827' });
    }
  }
  return P;
}

/* ---------------- folha (moldura + carimbo) ---------------- */
export function folhaPrims(meta, miolo) {
  const { w: W, h: H } = FOLHA;
  const P = [];
  P.push({ t: 'rect', x: 5, y: 5, w: W - 10, h: H - 10, stroke: '#000000', sw: 0.35 });
  if (meta.titulo) P.push({ t: 'text', x: W / 2, y: 15, txt: meta.titulo, size: 15, bold: true, align: 'center' });
  if (meta.subtitulo) P.push({ t: 'text', x: W / 2, y: 22, txt: meta.subtitulo, size: 12, bold: true, align: 'center' });
  P.push(...miolo);
  // carimbo
  const yC = H - 40, alt = 35 / 4;
  const x1 = W * 0.497, w1 = W * 0.29, w2 = W * 0.118, x3 = x1 + w1 + w2;
  P.push({ t: 'line', x1: 5, y1: yC, x2: W - 5, y2: yC, stroke: '#000000', sw: 0.35 });
  P.push({ t: 'img', src: 'logo', x: (5 + x1) / 2 - 36, y: yC + 7.5, w: 72, h: 72 / 3.5 });
  const pt = 8.5;
  const c1 = [['Nome do Projeto: ', meta.projeto], ['Local: ', meta.local], ['Tipo de Projeto: ', meta.tipo], ['Engenheiro(a) Responsável: ', meta.responsavel]];
  const c2 = [['Data: ', meta.data], ['Escala: ', 'Sem escala'], ['Ordem de Serviço: ', meta.os], ['Cliente: ', meta.cliente]];
  for (let i = 0; i < 4; i++) {
    const y = yC + i * alt;
    P.push({ t: 'rect', x: x1, y, w: w1, h: alt, stroke: '#000000', sw: 0.3 });
    P.push({ t: 'rect', x: x1 + w1, y, w: w2, h: alt, stroke: '#000000', sw: 0.3 });
    P.push({ t: 'rich', x: x1 + 2, y: y + alt * 0.66, size: pt, partes: [{ txt: c1[i][0] }, { txt: cortar(c1[i][1] || '—', w1 - 4 - larguraTexto(c1[i][0], pt), pt, true), bold: true }] });
    P.push({ t: 'rich', x: x1 + w1 + 2, y: y + alt * 0.66, size: pt, partes: [{ txt: c2[i][0] }, { txt: cortar(c2[i][1] || '—', w2 - 4 - larguraTexto(c2[i][0], pt), pt, true), bold: true }] });
  }
  P.push({ t: 'rect', x: x3, y: yC, w: W - 5 - x3, h: 35, stroke: '#000000', sw: 0.3 });
  P.push({ t: 'text', x: (x3 + W - 5) / 2, y: yC + 23, txt: meta.numero, size: 34, bold: true, align: 'center' });
  return P;
}

/* ---------------- folha de distribuição ---------------- */
export function distribuicaoPrims(colunas, linhasItens, area) {
  // colunas: [{ titulo, sub, qtd: Map(item → n) }]   linhasItens: [{ id, nome }]
  const P = [];
  const n = colunas.length;
  const gapX = 6;
  const cw = Math.min(62, (area.w - gapX * (n - 1)) / n);
  const total = cw * n + gapX * (n - 1);
  let x = area.x + (area.w - total) / 2;
  const rh = Math.min(5.2, (area.h - 10.4) / Math.max(1, linhasItens.length));
  const pt = Math.min(6.2, rh / MM_PT * 0.62);
  const yTop = area.y + Math.max(0, (area.h - (10.4 + rh * linhasItens.length)) / 2);
  const wq = 9;
  for (const col of colunas) {
    P.push({ t: 'rect', x, y: yTop, w: cw, h: 5.2, fill: '#b4c6e7', stroke: '#1f2937', sw: 0.2 });
    P.push({ t: 'text', x: x + cw / 2, y: yTop + 3.7, txt: cortar(col.titulo, cw - 2, 7.5, true), size: 7.5, bold: true, align: 'center' });
    P.push({ t: 'rect', x, y: yTop + 5.2, w: cw, h: 5.2, fill: '#d6dcea', stroke: '#1f2937', sw: 0.2 });
    P.push({ t: 'text', x: x + cw / 2, y: yTop + 8.9, txt: cortar(col.sub, cw - 2, 6.5, true), size: 6.5, bold: true, align: 'center' });
    linhasItens.forEach((it, i) => {
      const y = yTop + 10.4 + i * rh;
      P.push({ t: 'rect', x, y, w: cw - wq, h: rh, fill: '#e9edf5', stroke: '#1f2937', sw: 0.15 });
      P.push({ t: 'rect', x: x + cw - wq, y, w: wq, h: rh, fill: '#ffffff', stroke: '#1f2937', sw: 0.15 });
      P.push({ t: 'text', x: x + 1, y: y + rh * 0.72, txt: cortar(it.nome, cw - wq - 2, pt, true), size: pt, bold: true });
      const q = col.qtd.get(it.id);
      if (q) P.push({ t: 'text', x: x + cw - 1.2, y: y + rh * 0.72, txt: String(+(+q).toFixed(2)).replace('.', ','), size: pt, align: 'right' });
    });
    x += cw + gapX;
  }
  return P;
}

/* ---------------- SVG (prévia no app) ---------------- */
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export function svg(prims, box, { logoUrl = 'logo.png', classe = '' } = {}) {
  const f = v => +(+v).toFixed(2);
  const out = [];
  for (const p of prims) {
    const st = `${p.fill ? `fill="${p.fill}"` : 'fill="none"'} ${p.stroke ? `stroke="${p.stroke}" stroke-width="${f(p.sw || 0.2)}"` : ''}`;
    if (p.t === 'rect') out.push(`<rect x="${f(p.x)}" y="${f(p.y)}" width="${f(p.w)}" height="${f(p.h)}" ${p.r ? `rx="${f(p.r)}"` : ''} ${st}/>`);
    else if (p.t === 'line') out.push(`<line x1="${f(p.x1)}" y1="${f(p.y1)}" x2="${f(p.x2)}" y2="${f(p.y2)}" stroke="${p.stroke}" stroke-width="${f(p.sw)}"/>`);
    else if (p.t === 'poly') out.push(`<polyline points="${p.pts.map(([x, y]) => f(x) + ',' + f(y)).join(' ')}" fill="none" stroke="${p.stroke}" stroke-width="${f(p.sw)}" stroke-linejoin="round"/>`);
    else if (p.t === 'tri') out.push(`<polygon points="${p.pts.map(([x, y]) => f(x) + ',' + f(y)).join(' ')}" fill="${p.fill}"/>`);
    else if (p.t === 'circle') out.push(`<circle cx="${f(p.x)}" cy="${f(p.y)}" r="${f(p.r)}" ${st}/>`);
    else if (p.t === 'text') out.push(`<text x="${f(p.x)}" y="${f(p.y)}" font-size="${f(p.size * MM_PT)}" font-family="Arial,Helvetica,sans-serif" ${p.bold ? 'font-weight="700"' : ''} fill="${p.color || '#000'}" text-anchor="${p.align === 'center' ? 'middle' : p.align === 'right' ? 'end' : 'start'}">${esc(p.txt)}</text>`);
    else if (p.t === 'rich') out.push(`<text x="${f(p.x)}" y="${f(p.y)}" font-size="${f(p.size * MM_PT)}" font-family="Arial,Helvetica,sans-serif" fill="#000">${p.partes.map(q => `<tspan ${q.bold ? 'font-weight="700"' : ''}>${esc(q.txt)}</tspan>`).join('')}</text>`);
    else if (p.t === 'img') out.push(`<image href="${esc(logoUrl)}" x="${f(p.x)}" y="${f(p.y)}" width="${f(p.w)}" height="${f(p.h)}" preserveAspectRatio="xMidYMid meet"/>`);
  }
  return `<svg class="${classe}" viewBox="${f(box.x)} ${f(box.y)} ${f(box.w)} ${f(box.h)}" xmlns="http://www.w3.org/2000/svg" role="img">${out.join('')}</svg>`;
}

/* ---------------- PDF (jsPDF) ---------------- */
export function pdfPrims(doc, prims, logo) {
  for (const p of prims) {
    if (p.t === 'rect') {
      if (p.fill) doc.setFillColor(p.fill);
      if (p.stroke) { doc.setDrawColor(p.stroke); doc.setLineWidth(p.sw || 0.2); }
      const modo = p.fill && p.stroke ? 'FD' : p.fill ? 'F' : 'S';
      if (p.r) doc.roundedRect(p.x, p.y, p.w, p.h, p.r, p.r, modo); else doc.rect(p.x, p.y, p.w, p.h, modo);
    } else if (p.t === 'line') {
      doc.setDrawColor(p.stroke); doc.setLineWidth(p.sw); doc.line(p.x1, p.y1, p.x2, p.y2);
    } else if (p.t === 'poly') {
      doc.setDrawColor(p.stroke); doc.setLineWidth(p.sw);
      for (let i = 1; i < p.pts.length; i++) doc.line(p.pts[i - 1][0], p.pts[i - 1][1], p.pts[i][0], p.pts[i][1]);
    } else if (p.t === 'tri') {
      doc.setFillColor(p.fill); doc.triangle(p.pts[0][0], p.pts[0][1], p.pts[1][0], p.pts[1][1], p.pts[2][0], p.pts[2][1], 'F');
    } else if (p.t === 'circle') {
      doc.setFillColor(p.fill); doc.setDrawColor(p.stroke || p.fill); doc.setLineWidth(p.sw || 0.15); doc.circle(p.x, p.y, p.r, 'FD');
    } else if (p.t === 'text') {
      doc.setFont('helvetica', p.bold ? 'bold' : 'normal'); doc.setFontSize(p.size); doc.setTextColor(p.color || '#000000');
      doc.text(String(p.txt), p.x, p.y, { align: p.align || 'left' });
    } else if (p.t === 'rich') {
      let x = p.x;
      doc.setFontSize(p.size); doc.setTextColor('#000000');
      for (const q of p.partes) { doc.setFont('helvetica', q.bold ? 'bold' : 'normal'); doc.text(String(q.txt), x, p.y); x += doc.getTextWidth(String(q.txt)); }
    } else if (p.t === 'img' && logo) {
      // mantém a proporção do logo dentro da caixa
      const k = Math.min(p.w / logo.w, p.h / logo.h);
      const w = logo.w * k, h = logo.h * k;
      doc.addImage(logo.data, 'PNG', p.x + (p.w - w) / 2, p.y + (p.h - h) / 2, w, h, 'logo-projetech', 'FAST');
    }
  }
}

function carregarScript(src) {
  return new Promise((ok, erro) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => erro(new Error('Não carregou ' + src)); document.head.appendChild(s); });
}
async function carregarLogo() {
  const blob = await (await fetch('logo.png')).blob();
  const data = await new Promise(ok => { const r = new FileReader(); r.onload = () => ok(r.result); r.readAsDataURL(blob); });
  const img = await new Promise((ok, erro) => { const i = new Image(); i.onload = () => ok(i); i.onerror = erro; i.src = data; });
  // 900 px de largura bastam para 72 mm impressos (≈ 300 DPI)
  const k = Math.min(1, 900 / img.naturalWidth);
  const cv = document.createElement('canvas');
  cv.width = Math.round(img.naturalWidth * k); cv.height = Math.round(img.naturalHeight * k);
  cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
  return { data: cv.toDataURL('image/png'), w: cv.width, h: cv.height };
}

/* ---------------- montar o projeto de uma lista ---------------- */
const AREA = { x: 12, y: 27, w: FOLHA.w - 24, h: FOLHA.h - 27 - 45 };

function juntarNomes(nomes, maiusculas) {
  const ns = nomes.filter(Boolean);
  const up = s => (maiusculas ? s.toUpperCase() : s);
  if (ns.length <= 1) return up(ns[0] || '');
  // nomes com o mesmo começo ("Girassol 1", "Girassol 2") → "Girassol 1, 2 e 3"
  const pal = ns.map(n => n.split(' '));
  let k = 0;
  while (pal.every(p => p.length > k + 1 && p[k] === pal[0][k])) k++;
  const pre = k ? pal[0].slice(0, k).join(' ') + ' ' : '';
  const fins = ns.map((n, i) => (k ? pal[i].slice(k).join(' ') : n)).map(up);
  return up(pre) + fins.slice(0, -1).join(', ') + ' e ' + fins[fins.length - 1];
}

/* Telas iguais (mesmo painel, medida e projeto) dividem a mesma folha, como "Girassóis 1, 2 e 3". */
export function folhasDaLista(ctx, lista, { hoje } = {}) {
  const { M } = ctx;
  const grupos = [];
  for (const t of lista.telas || []) {
    const c = ctx.item(t.painel);
    if (!c || !c.painel) continue;
    const pl = M.planoProjeto(t, c.painel);
    if (!pl) continue;
    const chave = [t.painel, pl.colunas, pl.linhas, JSON.stringify(pl.cfg)].join('|');
    const g = grupos.find(x => x.chave === chave);
    if (g) g.telas.push(t); else grupos.push({ chave, telas: [t], pl, painel: c });
  }
  const dataBR = (hoje || '').split('-').reverse().join('/');
  const base = { projeto: lista.evento, local: [lista.sala, lista.local].filter(Boolean).join(' – '), responsavel: lista.responsavel_projeto || ctx.quem(), data: dataBR, os: lista.os, cliente: lista.cliente };
  const folhas = grupos.map((g, i) => {
    const varias = g.telas.length > 1;
    const med = `${n2(g.pl.largura_m)} x ${n2(g.pl.altura_m)} m`;
    const nomes = g.telas.map(t => t.nome).filter(Boolean);
    return {
      tipo: 'tela', grupo: g,
      meta: Object.assign({}, base, {
        numero: String(i + 1).padStart(2, '0'),
        titulo: (varias ? 'Painéis de Led – ' : 'Painel de Led – ') + med,
        subtitulo: juntarNomes(nomes, true),
        tipo: (varias ? `Painéis de Led – ${g.telas.length} * ${med}` : `Painel de Led – ${med}`) + (nomes.length ? ` (${juntarNomes(nomes)})` : '')
      })
    };
  });
  // distribuição: até 5 telas por folha
  const todas = (lista.telas || []).filter(t => ctx.item(t.painel));
  if (todas.length) {
    for (let i = 0; i < todas.length; i += 5) {
      folhas.push({ tipo: 'distribuicao', telas: todas.slice(i, i + 5), meta: Object.assign({}, base, { numero: String(folhas.length + 1).padStart(2, '0'), titulo: '', subtitulo: '', tipo: 'Distribuição de Painéis de Led' }) });
    }
  }
  return folhas;
}

export function primsDaFolha(ctx, lista, folha) {
  const { M } = ctx;
  if (folha.tipo === 'tela') return folhaPrims(folha.meta, desenhoTela(folha.grupo.pl, AREA));
  const dist = M.distribuicaoPorTela(lista.telas || [], ctx.linhasDa(lista.id));
  const cat = ctx.catIdx();
  const mostrar = c => c && (['led', 'estrutura', 'processamento'].includes(c.cat) || /^rack-/.test(c.id));
  const ids = new Set();
  for (const t of folha.telas) for (const [id] of dist.get(t.id) || []) if (mostrar(cat.get(id))) ids.add(id);
  const itens = [...ids].map(id => cat.get(id)).sort((a, b) => (a.ordem || 0) - (b.ordem || 0)).map(c => ({ id: c.id, nome: c.nome }));
  const colunas = folha.telas.map(t => {
    const c = cat.get(t.painel);
    const g = c && c.painel ? M.geometria(t, c.painel) : null;
    const sub = g && g.largura_m ? `Painel de Led - ${n2(g.largura_m)} x ${n2(g.altura_m)} m` : (g ? `${g.gabinetes} gabinetes` : '');
    return { titulo: (t.nome || 'Tela').toUpperCase(), sub, qtd: dist.get(t.id) || new Map() };
  });
  return folhaPrims(folha.meta, distribuicaoPrims(colunas, itens, { x: AREA.x, y: 22, w: AREA.w, h: AREA.h + 2 }));
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
  const logo = await carregarLogo().catch(() => null);
  const folhas = [];
  for (const lista of listas) for (const f of folhasDaLista(ctx, lista, { hoje: ctx.hoje() })) folhas.push({ lista, f });
  if (!folhas.length) throw new Error('Nenhuma tela com painel e medida para desenhar.');
  folhas.forEach(({ f }, i) => { f.meta.numero = String(i + 1).padStart(2, '0'); });
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [FOLHA.w, FOLHA.h] });
  folhas.forEach(({ lista, f }, i) => {
    if (i) doc.addPage([FOLHA.w, FOLHA.h], 'landscape');
    pdfPrims(doc, primsDaFolha(ctx, lista, f), logo);
  });
  const nome = partesNome.filter(Boolean).join(' - ').replace(/[\\/:*?"<>|]/g, '');
  doc.save(nome + '.pdf');
  return folhas.length;
}
