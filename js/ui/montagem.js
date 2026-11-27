/* Montagem da sala — o editor do projeto, no jeito do SmartLCT da NovaStar.
 *
 * 1 · Painéis: as telas da sala vistas de frente, em escala. Arraste uma tela para o lado e ela muda de
 *     lugar (tela.pos.x, em metros da esquerda); a ordem da esquerda para a direita vale para o desenho do
 *     projeto e para a divisão dos racks. Tocar numa tela mostra os dados dela.
 * 2 · Sinal: o padrão do cabo de cada tela (o canto onde começa e o sentido, como a NovaStar mostra) ou as
 *     portas desenhadas à mão — toque num gabinete e passe pelos outros na ordem do cabo. Mostra os pixels
 *     de cada porta e avisa quando passa do limite.
 * 3 · Energia: os circuitos de powercon (cores), as réguas Steck/Powercon e os racks da sala desenhados embaixo.
 *     Toque num circuito para escolher a régua dele, numa régua para escolher o rack, num rack para o tipo.
 *     O sistema sugere; na primeira mudança a sugestão vira a montagem da sala (lista.projeto.energia).
 * 4 · Processamento: cada porta numa saída de controladora (MCTRL660, Taurus) e as controladoras na
 *     processadora. Toque numa porta para escolher a controladora e a saída, numa controladora para o tipo.
 *     Também vira montagem da sala na primeira mudança (lista.projeto.processamento).
 * Cada mudança grava a sala: o desenho, o PDF e a lista (cabos, réguas, racks, controladoras) acompanham.
 * O desenho usa METROS como unidade (viewBox): x da esquerda da sala; o chão é y = 0 e para cima é negativo.
 */
import * as Cab from '../cabeamento.js';

// o que o editor lembra entre um redesenho da página e outro
export const est = { modo: 'paineis', sel: null, mao: false, desfazer: [], zoom: 1, selE: null, selP: null };
const ZOOMS = [1, 1.5, 2, 3, 4, 6];

const PADROES = [['inf-esq', 'vertical'], ['sup-esq', 'vertical'], ['inf-dir', 'vertical'], ['sup-dir', 'vertical'],
  ['inf-esq', 'horizontal'], ['sup-esq', 'horizontal'], ['inf-dir', 'horizontal'], ['sup-dir', 'horizontal']];
const NOME_CANTO = { 'inf-esq': 'embaixo à esquerda', 'sup-esq': 'em cima à esquerda', 'inf-dir': 'embaixo à direita', 'sup-dir': 'em cima à direita' };
const n2 = v => String(+(+v).toFixed(2)).replace('.', ',');
const fmt = v => String(Math.round(+v || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

/* as telas na sala: posição, tamanho e a altura do pé (palco) */
function cena(ps) {
  const pos = Cab.posicoesDaSala(ps);
  const its = ps.telas.filter(it => it.pl).map(it => {
    const t = it.tela, pal = t.palco || {};
    const base = (t.montagem || 'chao') === 'chao' && pal.sobre && +pal.altura_m > 0 ? +pal.altura_m : 0;
    return { it, t, pl: it.pl, x: pos.get(it), w: it.pl.largura_m, h: it.pl.altura_m, base };
  });
  return its;
}
function limites(its, modo) {
  const comPessoa = modo === 'paineis';
  const minX = Math.min(0, ...its.map(o => o.x)), maxX = Math.max(1, ...its.map(o => o.x + o.w)) + (comPessoa ? 1.6 : 0);
  const maxTop = Math.max(comPessoa ? 1.75 : 1, ...its.map(o => o.base + o.h));
  const u = Math.max(maxX - minX, maxTop * 2.2) / 100;   // unidade de traço e letra
  const mx = Math.max(0.6, u * 6);
  // o nome de cada tela fica em cima dela e não pode sair do quadro
  const rot = o => ((o.t.nome || 'Tela') + ' · ' + n2(o.w) + ' × ' + n2(o.h) + ' m').length * u * 2.6 * 0.58 / 2 + u * 2;
  const x0 = Math.min(minX - mx, ...its.map(o => o.x + o.w / 2 - rot(o)));
  const x1 = Math.max(maxX + mx, ...its.map(o => o.x + o.w / 2 + rot(o)));
  return { x0, x1, yT: -(maxTop + Math.max(0.9, u * 9)), yB: modo === 'energia' || modo === 'processamento' ? Math.max(3.2, u * 30) : Math.max(0.7, u * 7), u };
}

/* ícone de um padrão: 3 × 3 gabinetes com o caminho do cabo, como na NovaStar */
function iconePadrao(inicio, sentido) {
  const pl = Cab.planoTela({ colunas: 3, linhas: 3, painel: { px_l: 1, px_a: 1 }, cfg: { inicio, sentido, px_porta: 100 } });
  const cam = pl.dados.portas[0].caminho, c = q => 6 + q * 12;
  const pts = cam.map(([x, y]) => `${c(x)},${c(y)}`).join(' ');
  const [sx, sy] = cam[0], [ex, ey] = cam[cam.length - 1];
  return `<svg viewBox="0 0 36 36" aria-hidden="true"><rect x="0.5" y="0.5" width="35" height="35" rx="3" fill="none" stroke="currentColor" stroke-opacity=".35"/>
    <polyline points="${pts}" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/>
    <circle cx="${c(sx)}" cy="${c(sy)}" r="3.4" fill="#22c55e"/><circle cx="${c(ex)}" cy="${c(ey)}" r="3.4" fill="#ef4444"/></svg>`;
}


/* A pessoa de referência (1,70 m) — o mesmo boneco do Projetech Calculator: tudo sai da altura (cabeça 0,140,
 * ombro 0,202, quadril 0,486…), meio corpo desenhado e espelhado, a roupa recortada pelo contorno.
 * Em metros: pés no chão (y = 0), à esquerda em x. */
function pessoaSvg(x, H) {
  const f = n => +n.toFixed(4), PEL = '#c3cbe4', MAO = '#aab4d5', CAB = '#49527a', CAM = '#8e9ac4', CAL = '#5e6a93', SAP = '#414a6e', LOG = '#e8ecf8';
  const perW = H * 0.34, cx = x + perW / 2, topo = -H, U = u => cx + u * H, V = v => topo + v * H;
  const cbW = 0.051, cbH = 0.140, pesc = 0.030, om = 0.115, omY = 0.202, cint = 0.072, qd = 0.098, jl = 0.056, tz = 0.036, peF = 0.058, dQ = 0.007, dT = 0.018;
  const meio = [
    ['M', [0, 0]], ['C', [cbW * 0.58, 0], [cbW, cbH * 0.22], [cbW, cbH * 0.48]], ['C', [cbW, cbH * 0.73], [cbW * 0.79, cbH * 0.93], [cbW * 0.54, cbH]],
    ['C', [pesc, cbH + 0.012], [pesc, cbH + 0.022], [pesc, cbH + 0.032]], ['C', [om * 0.45, cbH + 0.040], [om * 0.78, omY - 0.026], [om * 0.96, omY]],
    ['C', [om + 0.009, omY + 0.016], [om + 0.006, 0.292], [om - 0.001, 0.350]], ['C', [om - 0.005, 0.398], [om - 0.011, 0.432], [om - 0.015, 0.452]],
    ['C', [om - 0.013, 0.482], [om - 0.035, 0.486], [om - 0.037, 0.456]], ['C', [om - 0.039, 0.420], [om - 0.035, 0.382], [om - 0.033, 0.344]],
    ['C', [om - 0.031, 0.302], [om - 0.033, 0.268], [om - 0.036, 0.246]], ['C', [cint + 0.002, 0.290], [cint - 0.002, 0.330], [cint, 0.364]],
    ['C', [cint + 0.006, 0.412], [qd - 0.004, 0.444], [qd, 0.486]], ['C', [qd - 0.002, 0.548], [jl + 0.026, 0.618], [jl + 0.016, 0.688]],
    ['C', [jl + 0.009, 0.726], [jl + 0.004, 0.760], [jl, 0.796]], ['C', [jl - 0.004, 0.848], [tz + 0.004, 0.900], [tz, 0.944]],
    ['L', [tz + 0.001, 0.976]], ['L', [peF, 0.990]], ['L', [peF, 0.998]], ['L', [dT - 0.002, 0.998]], ['L', [dT, 0.976]], ['L', [dT + 0.001, 0.944]],
    ['C', [dT, 0.880], [dQ + 0.005, 0.760], [dQ + 0.003, 0.650]], ['L', [dQ, 0.512]], ['L', [0, 0.504]]
  ];
  const lado = meio.map(g => g[0] + g.slice(1).map(p => f(cx + p[0] * H) + ' ' + f(V(p[1]))).join(' ')).join('');
  let volta = '';
  for (let i = meio.length - 1; i >= 1; i--) {
    const g = meio[i], ant = meio[i - 1][meio[i - 1].length - 1], P = p => f(cx - p[0] * H) + ' ' + f(V(p[1]));
    volta += g[0] === 'C' ? 'C' + P(g[2]) + ' ' + P(g[1]) + ' ' + P(ant) : 'L' + P(ant);
  }
  const faixa = (v1, v2, cor) => `<rect x="${f(U(-0.16))}" y="${f(V(v1))}" width="${f(0.32 * H)}" height="${f((v2 - v1) * H)}" fill="${cor}"/>`;
  const cw = cbW * 1.06;
  const cabelo = `M${f(U(-cw * 1.3))} ${f(V(-0.030))}L${f(U(cw * 1.3))} ${f(V(-0.030))}L${f(U(cw * 1.3))} ${f(V(0.090))}C${f(U(cw * 0.5))} ${f(V(0.030))} ${f(U(-cw * 0.5))} ${f(V(0.030))} ${f(U(-cw * 1.3))} ${f(V(0.090))}Z`;
  const camisa = `M${f(U(-0.16))} ${f(V(0.174))}L${f(U(-0.16))} ${f(V(0.452))}L${f(U(0.16))} ${f(V(0.452))}L${f(U(0.16))} ${f(V(0.174))}L${f(U(0.046))} ${f(V(0.174))}C${f(U(0.034))} ${f(V(0.216))} ${f(U(-0.034))} ${f(V(0.216))} ${f(U(-0.046))} ${f(V(0.174))}Z`;
  const lw = 0.055 * H, k = lw / 697, R = v => f(v * k), lx = u => f(cx + (u - 348.5) * k), ly = v => f(V(0.268) + (v - 417) * k);
  const logo = `<circle cx="${lx(350)}" cy="${ly(350)}" r="${R(285)}" fill="none" stroke="${LOG}" stroke-width="${R(90)}"/><circle cx="${lx(350)}" cy="${ly(350)}" r="${R(155)}" fill="${LOG}"/><circle cx="${lx(108)}" cy="${ly(725)}" r="${R(86)}" fill="${LOG}"/>`;
  return `<g class="mt-pessoa" pointer-events="none"><clipPath id="mtPessoaClip"><path d="${lado + volta}Z"/></clipPath><g clip-path="url(#mtPessoaClip)">`
    + faixa(0, 1, PEL) + `<path d="${cabelo}" fill="${CAB}"/><path d="${camisa}" fill="${CAM}"/>` + faixa(0.452, 0.5, CAM) + faixa(0.494, 0.95, CAL) + faixa(0.944, 1, SAP)
    + `<ellipse cx="${f(U(0.088))}" cy="${f(V(0.460))}" rx="${f(0.017 * H)}" ry="${f(0.022 * H)}" fill="${MAO}"/><ellipse cx="${f(U(-0.088))}" cy="${f(V(0.460))}" rx="${f(0.017 * H)}" ry="${f(0.022 * H)}" fill="${MAO}"/>`
    + logo + '</g></g>';
}
// cotas no jeito do Calculator: linha fina com os "tracinhos" nas pontas e o texto na cor das cotas
const COTA = '#93a0c7';
function cotaH(y, x1, x2, txt, u) {
  const t = u * 0.9;
  return `<g class="mt-cota" pointer-events="none"><line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="${COTA}" stroke-width="${u * 0.16}"/><line x1="${x1}" y1="${y - t}" x2="${x1}" y2="${y + t}" stroke="${COTA}" stroke-width="${u * 0.16}"/><line x1="${x2}" y1="${y - t}" x2="${x2}" y2="${y + t}" stroke="${COTA}" stroke-width="${u * 0.16}"/><text x="${(x1 + x2) / 2}" y="${y - u * 0.9}" font-size="${u * 2}" text-anchor="middle" fill="${COTA}">${txt}</text></g>`;
}
function cotaV(x, y1, y2, txt, u, lado = -1) {
  const t = u * 0.9, my = (y1 + y2) / 2, tx = x + lado * u * 1.1;
  return `<g class="mt-cota" pointer-events="none"><line x1="${x}" y1="${y1}" x2="${x}" y2="${y2}" stroke="${COTA}" stroke-width="${u * 0.16}"/><line x1="${x - t}" y1="${y1}" x2="${x + t}" y2="${y1}" stroke="${COTA}" stroke-width="${u * 0.16}"/><line x1="${x - t}" y1="${y2}" x2="${x + t}" y2="${y2}" stroke="${COTA}" stroke-width="${u * 0.16}"/><text x="${tx}" y="${my}" font-size="${u * 2}" text-anchor="middle" fill="${COTA}" transform="rotate(-90 ${tx} ${my})">${txt}</text></g>`;
}

/* o desenho da sala; temp: { id → plano provisório } enquanto se desenha à mão */
function svgSala(its, modo, temp, fixo, ps) {
  if (!its.length) return '<div class="mt-vazio">Ponha uma tela com painel e medida (L × A) para montar a sala.</div>';
  const L = fixo || limites(its, modo), u = L.u, out = [];   // fixo: o enquadramento não muda no meio de um arrasto
  // chão e régua em metros
  out.push(`<line x1="${L.x0}" y1="0" x2="${L.x1}" y2="0" stroke="#3a4670" stroke-width="${u * 0.35}"/>`);
  const passo = L.x1 - L.x0 > 40 ? 5 : L.x1 - L.x0 > 16 ? 2 : 1;
  for (let m = Math.ceil(L.x0 / passo) * passo; m <= L.x1; m += passo) {
    out.push(`<line x1="${m}" y1="0" x2="${m}" y2="${u * 1.6}" stroke="#3a4670" stroke-width="${u * 0.2}"/>`);
    out.push(`<text x="${m}" y="${u * 4.6}" font-size="${u * 2.4}" text-anchor="middle" fill="#5f6b93">${m} m</text>`);
  }
  for (const o of its) {
    const pl = (temp && temp[o.t.id]) || o.pl;
    const cw = o.w / pl.colunas, ch = o.h / pl.linhas, m = Math.min(cw, ch), y0 = -(o.base + o.h);
    const sel = est.sel === o.t.id;
    out.push(`<g data-tela="${o.t.id}">`);
    if (o.base > 0) {
      const sx = o.x - 0.3, sw = o.w + 0.6, deck = Math.min(o.base * 0.45, Math.max(u * 0.8, 0.1)), legW = Math.max(u * 0.3, 0.09);
      out.push(`<rect x="${sx}" y="${-o.base}" width="${sw}" height="${deck}" rx="${u * 0.3}" fill="#4a5578" stroke="#5f6b93" stroke-width="${u * 0.15}"/>`);
      const passo = [1, 2, 5, 10].find(p => p / (L.x1 - L.x0) > 0.015) || 10;
      for (let m = 0; m <= sw + 1e-6; m += passo) out.push(`<rect x="${Math.min(sx + m, sx + sw - legW)}" y="${-o.base + deck}" width="${legW}" height="${o.base - deck}" fill="#39425f"/>`);
      out.push(cotaV(o.x - u * 1.8, -o.base, 0, n2(o.base) + ' m', u));
    }
    const sinal = modo === 'sinal' || modo === 'processamento', energia = modo === 'energia', colorido = sinal || energia;
    const cor = new Map();
    (sinal ? pl.dados.portas : energia ? pl.energia.circuitos : []).forEach((p, i) => p.caminho.forEach(([c, r]) => cor.set(c + ',' + r, i)));
    for (let c = 0; c < pl.colunas; c++) for (let r = 0; r < pl.linhas; r++) {
      const i = cor.get(c + ',' + r);
      const fill = !colorido ? 'rgba(61,123,255,.16)' : i == null ? '#2a3557' : Cab.CORES_PORTA[i % Cab.CORES_PORTA.length];
      out.push(`<rect x="${o.x + c * cw}" y="${y0 + r * ch}" width="${cw}" height="${ch}" fill="${fill}" stroke="${colorido ? '#121a30' : 'rgba(61,123,255,.38)'}" stroke-width="${m * 0.03}"/>`);
    }
    if (energia) {
      // o caminho do powercon de cada circuito (amarelo) e o número dele
      const X = c => o.x + (c + 0.5) * cw, Y = r => y0 + (r + 0.5) * ch, tr = m * 0.12;
      for (const ci of pl.energia.circuitos) {
        const pts = ci.caminho.map(([c, r]) => [X(c), Y(r)]);
        const marcado = est.selE && est.selE.tipo === 'circuito' && est.selE.chave === Cab.chaveCircuito(o.it, ci.n);
        out.push(`<polyline points="${pts.map(q => q.join(',')).join(' ')}" fill="none" stroke="${marcado ? '#0ea5e9' : '#a16207'}" stroke-width="${m * (marcado ? 0.14 : 0.05)}" stroke-linejoin="round"/>`);
        for (let k = 1; k < pts.length; k++) {
          const [ax, ay] = pts[k - 1], [bx, by] = pts[k], mx = (ax + bx) / 2, my = (ay + by) / 2, a = Math.atan2(by - ay, bx - ax);
          out.push(`<polygon points="${[0, 2.5, -2.5].map(d => `${mx + Math.cos(a + d) * tr},${my + Math.sin(a + d) * tr}`).join(' ')}" fill="#a16207"/>`);
        }
        const [sx, sy] = pts[0], rr = m * 0.27;
        out.push(`<circle cx="${sx}" cy="${sy}" r="${rr}" fill="#facc15" stroke="#000000" stroke-width="${rr * 0.16}"/>`);
        out.push(`<text x="${sx}" y="${sy + rr * 0.38}" font-size="${rr * 1.05}" font-weight="700" text-anchor="middle" fill="#000000">${ci.n}</text>`);
      }
    }
    if (sinal) {
      const X = c => o.x + (c + 0.5) * cw, Y = r => y0 + (r + 0.5) * ch, tr = m * 0.12;
      for (const p of pl.dados.portas) {
        const pts = p.caminho.map(([c, r]) => [X(c), Y(r)]);
        const marcada = modo === 'processamento' && est.selP && est.selP.tipo === 'porta' && est.selP.chave === Cab.chaveCircuito(o.it, p.n);
        out.push(`<polyline points="${pts.map(q => q.join(',')).join(' ')}" fill="none" stroke="${marcada ? '#0ea5e9' : '#1e3a8a'}" stroke-width="${m * (marcada ? 0.14 : 0.05)}" stroke-linejoin="round"/>`);
        for (let k = 1; k < pts.length; k++) {
          const [ax, ay] = pts[k - 1], [bx, by] = pts[k], mx = (ax + bx) / 2, my = (ay + by) / 2, a = Math.atan2(by - ay, bx - ax);
          out.push(`<polygon points="${[0, 2.5, -2.5].map(d => `${mx + Math.cos(a + d) * tr},${my + Math.sin(a + d) * tr}`).join(' ')}" fill="#1e3a8a"/>`);
        }
        const [sx, sy] = pts[0], rr = m * 0.27;
        if (o.it.cfg && o.it.cfg.backup && pts.length > 1) {
          const [ex, ey] = pts[pts.length - 1];
          out.push(`<circle cx="${ex}" cy="${ey}" r="${rr}" fill="#dc2626" stroke="#7f1d1d" stroke-width="${rr * 0.16}"/>`);
          out.push(`<text x="${ex}" y="${ey + rr * 0.34}" font-size="${rr * 0.92}" font-weight="700" text-anchor="middle" fill="#ffffff">${p.n}B</text>`);
        }
        out.push(`<circle cx="${sx}" cy="${sy}" r="${rr}" fill="#ffffff" stroke="${p.pixels > pl.dados.px_porta ? '#dc2626' : '#000000'}" stroke-width="${rr * 0.16}"/>`);
        out.push(`<text x="${sx}" y="${sy + rr * 0.38}" font-size="${rr * 1.05}" font-weight="700" text-anchor="middle" fill="#000000">${p.n}</text>`);
      }
    }
    out.push(`<rect x="${o.x}" y="${y0}" width="${o.w}" height="${o.h}" rx="${u * 0.4}" fill="none" stroke="${sel ? '#9db8ff' : '#3d7bff'}" stroke-width="${sel ? u * 0.7 : u * 0.35}"/>`);
    const pxW = pl.colunas * (pl.px_l || 0), pxH = pl.linhas * (pl.px_a || 0);
    out.push(cotaH(y0 - u * 1.6, o.x, o.x + o.w, `${n2(o.w)} m${pxW ? ' — ' + fmt(pxW) + ' px' : ''}`, u));
    out.push(`<text x="${o.x + o.w / 2}" y="${y0 - u * 5.4}" font-size="${u * 2.5}" font-weight="700" text-anchor="middle" fill="${sel ? '#cfe0ff' : '#e5e9f5'}">${esc(o.t.nome || 'Tela')}</text>`);
    // altura à esquerda (se o vizinho deixa espaço)
    const viz = its.some(q => q !== o && q.x + q.w > o.x - u * 4.5 && q.x < o.x);
    if (!viz) out.push(cotaV(o.x - u * 1.8, y0, y0 + o.h, `${n2(o.h)} m${pxH ? ' — ' + fmt(pxH) + ' px' : ''}`, u));
    out.push('</g>');
  }
  if (modo === 'paineis') {
    const xP = Math.max(...its.map(o => o.x + o.w)) + 0.8;
    out.push(pessoaSvg(xP, 1.7));
    out.push(cotaV(xP + 1.7 * 0.34 + u * 1.8, -1.7, 0, '1,70 m', u, 1));
  }
  if (modo === 'energia' && ps) out.push(energiaSvg(its, ps, L));
  if (modo === 'processamento' && ps) out.push(processamentoSvg(its, ps, L));
  const vw = L.x1 - L.x0, vh = L.yB - L.yT;
  return `<svg class="mt-svg ${modo === 'sinal' && est.mao ? 'pintando' : modo === 'paineis' ? 'paineis' : ''}" style="width:${est.zoom * 100}%;aspect-ratio:${vw.toFixed(3)} / ${vh.toFixed(3)}" viewBox="${L.x0} ${L.yT} ${vw} ${vh}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Montagem da sala">${out.join('')}</svg>`;
}
/* embaixo do chão: as réguas (azuis) ligadas aos circuitos e os racks ligados às réguas */
function energiaSvg(its, ps, L) {
  const u = L.u, out = [];
  const daTela = new Map(its.map(o => [o.it, o]));
  const yR = u * 9, hR = u * 3.6, wR = u * 7.5, yK = u * 19, hK = u * 6, wK = u * 15;
  const xr = new Map();
  for (const r of ps.reguasSala) {
    const saidas = (r.refs || []).map(({ ti, n }) => {
      const o = daTela.get(ps.telas[ti]), c = o && o.pl.energia.circuitos[n - 1];
      return c ? [o.x + (c.caminho[0][0] + 0.5) * (o.w / o.pl.colunas), -o.base] : null;
    }).filter(Boolean);
    if (!saidas.length) continue;
    const x = (Math.min(...saidas.map(q => q[0])) + Math.max(...saidas.map(q => q[0]))) / 2;
    xr.set(r.n, x);
    const marcada = est.selE && est.selE.tipo === 'regua' && est.selE.id === r.id;
    const kw = r.w / 1000, lim = (ps.telas[r.tela] ? +ps.telas[r.tela].cfg.kw_regua || 7.5 : 7.5);
    for (const [sx, sy] of saidas) out.push(`<line x1="${sx}" y1="${sy}" x2="${x}" y2="${yR}" stroke="${marcada ? '#0ea5e9' : '#93a0c7'}" stroke-width="${u * (marcada ? 0.45 : 0.22)}"/>`);
    out.push(`<g data-regua="${esc(r.id)}" style="cursor:pointer"><rect x="${x - wR / 2}" y="${yR}" width="${wR}" height="${hR}" rx="${u * 0.6}" fill="${kw > lim + 1e-9 ? '#dc2626' : '#2563eb'}" stroke="${marcada ? '#0ea5e9' : '#1e3a8a'}" stroke-width="${u * (marcada ? 0.7 : 0.25)}"/>`
      + `<text x="${x}" y="${yR + hR * 0.68}" font-size="${u * 2.3}" font-weight="700" text-anchor="middle" fill="#ffffff">R${r.n}</text></g>`);
  }
  // racks: no meio das réguas dele, sem encostar um no outro
  const ks = ps.racks.map(k => {
    const xs = k.reguas.map(q => xr.get(q.rg)).filter(v => v != null);
    return { k, x: xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : (L.x0 + L.x1) / 2 };
  }).sort((a, b) => a.x - b.x);
  for (let i = 1; i < ks.length; i++) if (ks[i].x - ks[i - 1].x < wK * 1.2) ks[i].x = ks[i - 1].x + wK * 1.2;
  const sobra = ks.length ? ks[ks.length - 1].x + wK / 2 - L.x1 : 0;
  if (sobra > 0) ks.forEach(q => { q.x -= sobra; });
  for (const { k, x } of ks) {
    const marcado = est.selE && est.selE.tipo === 'rack' && est.selE.id === k.id;
    for (const q of k.reguas) { const rx = xr.get(q.rg); if (rx != null) out.push(`<line x1="${rx}" y1="${yR + hR}" x2="${x}" y2="${yK}" stroke="#93a0c7" stroke-width="${u * 0.35}"/>`); }
    const saidasK = Cab.RACKS[k.tipo] || 9, cheio = k.reguas.length > saidasK;
    out.push(`<g data-rack="${esc(k.id)}" style="cursor:pointer"><rect x="${x - wK / 2}" y="${yK}" width="${wK}" height="${hK}" rx="${u * 0.8}" fill="#3f4652" stroke="${marcado ? '#0ea5e9' : cheio ? '#dc2626' : '#7c88b0'}" stroke-width="${u * (marcado ? 0.8 : 0.3)}"/>`
      + `<text x="${x}" y="${yK + hK * 0.45}" font-size="${u * 2.4}" font-weight="700" text-anchor="middle" fill="#ffffff">Rack ${k.n}</text>`
      + `<text x="${x}" y="${yK + hK * 0.8}" font-size="${u * 1.9}" text-anchor="middle" fill="#cbd5e1">${saidasK} saídas · ${k.reguas.length} régua${k.reguas.length === 1 ? '' : 's'}</text></g>`);
  }
  return out.join('');
}
/* embaixo do chão: as controladoras (cada porta ligada na sua) e a processadora */
function processamentoSvg(its, ps, L) {
  const u = L.u, out = [];
  const daTela = new Map(its.map(o => [o.it, o]));
  const yC = u * 9.5, hC = u * 4.6, wC = u * 15, yP = u * 21, hP = u * 6.4, wP = u * 20;
  const lista = ps.processamento.ctrls;
  const pos = lista.map(c => {
    const sa = c.saidas.map(p => {
      const o = p && daTela.get(ps.telas[p.ti]), pt = o && o.pl.dados.portas[p.n - 1];
      return pt ? [o.x + (pt.caminho[0][0] + 0.5) * (o.w / o.pl.colunas), -o.base] : null;
    }).filter(Boolean);
    return { c, sa, x: sa.length ? (Math.min(...sa.map(q => q[0])) + Math.max(...sa.map(q => q[0]))) / 2 : (L.x0 + L.x1) / 2 };
  }).sort((a, b) => a.x - b.x);
  for (let i = 1; i < pos.length; i++) if (pos[i].x - pos[i - 1].x < wC * 1.15) pos[i].x = pos[i - 1].x + wC * 1.15;
  const sobra = pos.length ? pos[pos.length - 1].x + wC / 2 - L.x1 : 0;
  if (sobra > 0) pos.forEach(q => { q.x -= sobra; });
  const xP = pos.length ? (pos[0].x + pos[pos.length - 1].x) / 2 : (L.x0 + L.x1) / 2;
  for (const { c, sa, x } of pos) {
    const C = Cab.CONTROLADORAS[c.tipo], marcada = est.selP && est.selP.tipo === 'ctrl' && est.selP.id === c.id;
    const passa = c.px > C.px || c.usadas > C.portas;
    for (const [sx, sy] of sa) out.push(`<line x1="${sx}" y1="${sy}" x2="${x}" y2="${yC}" stroke="${marcada ? '#0ea5e9' : '#93a0c7'}" stroke-width="${u * (marcada ? 0.45 : 0.22)}"/>`);
    out.push(`<line x1="${x}" y1="${yC + hC}" x2="${xP}" y2="${yP}" stroke="#93a0c7" stroke-width="${u * 0.3}"/>`);
    out.push(`<g data-ctrl="${esc(c.id)}" style="cursor:pointer"><rect x="${x - wC / 2}" y="${yC}" width="${wC}" height="${hC}" rx="${u * 0.6}" fill="#1f2937" stroke="${marcada ? '#0ea5e9' : passa ? '#dc2626' : '#7c88b0'}" stroke-width="${u * (marcada || passa ? 0.7 : 0.25)}"/>`
      + `<text x="${x}" y="${yC + hC * 0.48}" font-size="${u * 2.1}" font-weight="700" text-anchor="middle" fill="#ffffff">${esc(C.nome)} ${c.n}</text>`
      + `<text x="${x}" y="${yC + hC * 0.85}" font-size="${u * 1.45}" text-anchor="middle" fill="${passa ? '#fca5a5' : '#93c5fd'}">${c.usadas}/${C.portas} saídas · ${n2(c.px / 1e6)} Mpx</text></g>`);
  }
  const marcadaP = est.selP && est.selP.tipo === 'proc';
  out.push(`<g data-proc="1" style="cursor:pointer"><rect x="${xP - wP / 2}" y="${yP}" width="${wP}" height="${hP}" rx="${u * 0.9}" fill="#374151" stroke="${marcadaP ? '#0ea5e9' : '#7c88b0'}" stroke-width="${u * (marcadaP ? 0.7 : 0.3)}"/>`
    + `<rect x="${xP - wP * 0.36}" y="${yP + hP * 0.2}" width="${wP * 0.34}" height="${hP * 0.55}" fill="#60a5fa"/>`
    + `<text x="${xP + wP * 0.2}" y="${yP + hP * 0.6}" font-size="${u * 2.1}" font-weight="700" text-anchor="middle" fill="#ffffff">${esc(ps.cfg.processadora || 'Processadora')}</text></g>`);
  return out.join('');
}
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* o painel de baixo: os dados da tela escolhida (Painéis) ou o cabeamento dela (Sinal) */
/* Energia: o que está escolhido (circuito, régua ou rack) e para onde ele vai */
function energiaHtml(ctx, ps, pode) {
  const { B } = ctx;
  const ro = pode ? '' : 'disabled';
  const kw = w => n2((w / 1000).toFixed(2)) + ' kW';
  const nomeTela = ti => (ps.telas[ti] && ps.telas[ti].nome) || 'Tela';
  const limReg = r => (ps.telas[r.tela] ? +ps.telas[r.tela].cfg.kw_regua || 7.5 : 7.5) * 1000;
  const opReguas = atual => ps.reguasSala.filter(r => !r.estimada).map(r => `<option value="${B.esc(r.id)}" ${r.id === atual ? 'selected' : ''}>R${r.n} · ${kw(r.w)} · ${B.esc(nomeTela(r.tela))}</option>`).join('') + '<option value="__nova">+ Nova régua</option>';
  const opRacks = atual => ps.racks.map(k => `<option value="${B.esc(k.id)}" ${k.id === atual ? 'selected' : ''}>Rack ${k.n} · ${Cab.RACKS[k.tipo] || 9} saídas</option>`).join('') + '<option value="__novo">+ Novo rack</option>';
  const resumo = `<p class="peq mut2" style="margin:0 0 8px">${ps.circuitos} circuito${ps.circuitos === 1 ? '' : 's'} · ${ps.reguas} régua${ps.reguas === 1 ? '' : 's'} · ${ps.racks.length} rack${ps.racks.length === 1 ? '' : 's'}${ps.energia_manual ? ' · <b>montagem sua</b>' : ' · sugestão do sistema'}</p>`;
  const voltar = ps.energia_manual && pode ? '<button class="btn sm mt-e-auto">Voltar ao automático</button>' : '';
  const sel = est.selE;
  let corpo = '<p class="dica" style="margin:0">Toque num circuito (na tela) para escolher a régua dele, numa régua azul para escolher o rack, ou num rack para mudar o tipo.</p>';
  if (sel && sel.tipo === 'circuito') {
    const r = ps.reguasSala.find(q => q.circuitos.includes(sel.chave));
    const [, n] = sel.chave.split(':');
    const ref = r && r.refs[r.circuitos.indexOf(sel.chave)];
    const it = ref ? ps.telas[ref.ti] : ps.telas.find(t => Cab.chaveCircuito(t, +n) === sel.chave);
    const c = it && it.pl && it.pl.energia.circuitos[+n - 1];
    if (c) corpo = `<div class="grade g2 m1"><div><b>Circuito ${c.n}</b> — ${B.esc(it.nome || 'Tela')}<div class="peq mut2">${c.gabinetes} gabinetes · ${kw(c.w)} no máximo</div></div>
      <label class="campo"><span>Entra na régua</span><select data-e="circ-regua" ${ro}>${opReguas(r && r.id)}</select></label></div>`;
  } else if (sel && sel.tipo === 'regua') {
    const r = ps.reguasSala.find(q => q.id === sel.id);
    if (r) {
      const lim = limReg(r), pct = Math.round(r.w / lim * 100), k = ps.racks.find(q => q.n === r.rack);
      corpo = `<div class="grade g2 m1"><div><b>Régua R${r.n}</b> <span class="${r.w > lim ? 'vermelho' : 'mut2'}">· ${kw(r.w)} de ${n2(lim / 1000)} kW (${pct}%)${r.w > lim ? ' — passa do limite' : ''}</span>
          <div class="peq mut2">${r.circuitos.length} circuito${r.circuitos.length === 1 ? '' : 's'}: ${r.refs.map(q => B.esc(nomeTela(q.ti)) + ' C' + q.n).join(', ')}</div></div>
        <label class="campo"><span>Liga no rack</span><select data-e="regua-rack" ${ro}>${opRacks(k && k.id)}</select></label></div>
        ${pode ? '<button class="btn sm mt-e-tirar-regua" style="margin-top:8px">Tirar a régua</button>' : ''}`;
    }
  } else if (sel && sel.tipo === 'rack') {
    const k = ps.racks.find(q => q.id === sel.id);
    if (k) {
      const saidas = Cab.RACKS[k.tipo] || 9;
      corpo = `<div class="grade g2 m1"><div><b>Rack ${k.n}</b> <span class="${k.reguas.length > saidas ? 'vermelho' : 'mut2'}">· ${k.reguas.length} régua${k.reguas.length === 1 ? '' : 's'} em ${saidas} saídas · ${kw(k.w)}</span>
          <div class="peq mut2">${k.reguas.map(q => 'R' + q.rg).join(', ') || 'sem régua ainda'}</div></div>
        <label class="campo"><span>Tipo</span><select data-e="rack-tipo" ${ro}>${Object.entries(Cab.RACKS).map(([id, n]) => `<option value="${id}" ${id === k.tipo ? 'selected' : ''}>${n} saídas</option>`).join('')}</select></label></div>
        ${pode ? '<button class="btn sm mt-e-tirar-rack" style="margin-top:8px">Tirar o rack</button>' : ''}`;
    }
  }
  return resumo + corpo + (voltar ? `<div style="margin-top:10px">${voltar}</div>` : '');
}

/* Processamento: a porta escolhida (controladora e saída), a controladora (tipo e saídas) e a processadora */
function processamentoHtml(ctx, ps, pode) {
  const { B } = ctx;
  const ro = pode ? '' : 'disabled';
  const lista = ps.processamento.ctrls;
  const nomeTela = ti => (ps.telas[ti] && ps.telas[ti].nome) || 'Tela';
  const tot = Object.entries(ps.controladoras).map(([t, q]) => q + ' × ' + Cab.CONTROLADORAS[t].nome).join(' + ') || 'nenhuma';
  const resumo = `<p class="peq mut2" style="margin:0 0 8px">${ps.portas} porta${ps.portas === 1 ? '' : 's'} · ${tot}${ps.processamento.manual ? ' · <b>montagem sua</b>' : ' · sugestão do sistema'}</p>`;
  const pa = ps.cfg.processadora || '', hs = ['H2', 'H5', 'H9', 'H15'];
  const procIn = `<label class="campo" style="max-width:320px"><span>Processadora</span><select data-p="processadora" ${ro}>${[['', '— sem processadora —']].concat(hs.map(h => [h, 'Novastar ' + h])).concat(pa && !hs.includes(pa) ? [[pa, pa + ' (escrita antes)']] : [])
    .map(([v, t]) => `<option value="${B.esc(v)}" ${v === pa ? 'selected' : ''}>${B.esc(t)}</option>`).join('')}</select></label>`;
  const opCtrls = atual => lista.map(c => `<option value="${B.esc(c.id)}" ${c.id === atual ? 'selected' : ''}>${Cab.CONTROLADORAS[c.tipo].nome} ${c.n} · ${c.usadas}/${Cab.CONTROLADORAS[c.tipo].portas}</option>`).join('')
    + Object.entries(Cab.CONTROLADORAS).map(([t, C]) => `<option value="__nova:${t}">+ Nova ${C.nome}</option>`).join('');
  const sel = est.selP;
  let corpo = '<p class="dica" style="margin:0">Toque numa porta (na tela) para escolher a controladora e a saída, numa controladora para o tipo, ou na processadora.</p>';
  if (sel && sel.tipo === 'porta') {
    const c = lista.find(q => q.saidas.some(p => p && p.chave === sel.chave));
    const k = c ? c.saidas.findIndex(p => p && p.chave === sel.chave) : -1;
    const p = ps.processamento.portas.find(q => q.chave === sel.chave);
    if (p) {
      const cap = c ? Cab.CONTROLADORAS[c.tipo].portas : 0;
      const opS = c ? Array.from({ length: cap }, (_, i) => { const q = c.saidas[i]; return `<option value="${i + 1}" ${i === k ? 'selected' : ''}>Saída ${i + 1}${q && q.chave !== sel.chave ? ' — ocupada: ' + B.esc(nomeTela(q.ti)) + ' P' + q.n : ''}</option>`; }).join('') : '';
      corpo = `<div class="grade g3 m1"><div><b>Porta P${p.n}</b> — ${B.esc(nomeTela(p.ti))}<div class="peq mut2">${fmt(p.px)} px</div></div>
        <label class="campo"><span>Controladora</span><select data-pp="ctrl" ${ro}>${opCtrls(c && c.id)}</select></label>
        ${c ? `<label class="campo"><span>Saída</span><select data-pp="saida" ${ro}>${opS}</select></label>` : ''}</div>`;
    }
  } else if (sel && sel.tipo === 'ctrl') {
    const c = lista.find(q => q.id === sel.id);
    if (c) {
      const C = Cab.CONTROLADORAS[c.tipo], pct = Math.round(c.px / C.px * 100), passa = c.px > C.px || c.usadas > C.portas;
      corpo = `<div class="grade g2 m1"><div><b>${C.nome} ${c.n}</b> <span class="${passa ? 'vermelho' : 'mut2'}">· ${c.usadas} de ${C.portas} saídas · ${fmt(c.px)} de ${fmt(C.px)} px (${pct}%)${passa ? ' — passa da capacidade' : ''}</span>
          <div class="peq mut2">${c.saidas.map((p, i) => p ? `Saída ${i + 1}: ${B.esc(nomeTela(p.ti))} P${p.n}` : null).filter(Boolean).join(' · ') || 'sem porta ainda'}</div></div>
        <label class="campo"><span>Tipo</span><select data-pp="tipo" ${ro}>${Object.entries(Cab.CONTROLADORAS).map(([t, X]) => `<option value="${t}" ${t === c.tipo ? 'selected' : ''}>${X.nome} (${X.portas} saídas)</option>`).join('')}</select></label></div>
        ${pode ? '<button class="btn sm mt-p-tirar" style="margin-top:8px">Tirar a controladora</button>' : ''}`;
    }
  } else if (sel && sel.tipo === 'proc') {
    corpo = `<p class="peq" style="margin:0 0 6px">${lista.length} controladora${lista.length === 1 ? '' : 's'} ligada${lista.length === 1 ? '' : 's'} na processadora.</p>`;
  }
  const voltar = ps.processamento.manual && pode ? '<div style="margin-top:10px"><button class="btn sm mt-p-auto">Voltar ao automático</button></div>' : '';
  return resumo + corpo + `<div style="margin-top:10px">${procIn}</div>` + voltar;
}

function ladoHtml(ctx, its, ps, pode) {
  if (est.modo === 'energia') return energiaHtml(ctx, ps, pode);
  if (est.modo === 'processamento') return processamentoHtml(ctx, ps, pode);
  const { B } = ctx;
  const o = its.find(x => x.t.id === est.sel);
  const ro = pode ? '' : 'disabled';
  if (est.modo === 'paineis') {
    if (!o) return `<p class="dica">Toque numa tela para ver os dados dela. Arraste as telas para o lado para posicionar — a ordem da esquerda para a direita vale para o projeto e para os racks.</p>`;
    return `<div class="grade g4 m1">
        <label class="campo"><span>Nome</span><input data-mf="nome" value="${B.esc(o.t.nome || '')}" ${ro}></label>
        <label class="campo"><span>Largura (m)</span><input inputmode="decimal" data-mf="largura_m" value="${n2(o.t.largura_m != null ? o.t.largura_m : o.w)}" ${ro}></label>
        <label class="campo"><span>Altura (m)</span><input inputmode="decimal" data-mf="altura_m" value="${n2(o.t.altura_m != null ? o.t.altura_m : o.h)}" ${ro}></label>
        <label class="campo"><span>Posição (m da esquerda)</span><input inputmode="decimal" data-mf="pos" value="${n2(o.x)}" ${ro}></label>
      </div>
      <div class="linha-flex" style="margin-top:8px;flex-wrap:wrap;gap:8px">
        <span class="peq mut2 cresce">${o.pl.colunas} × ${o.pl.linhas} = ${o.pl.gabinetes} gabinetes · ${B.esc((o.it.painel.modelo || ''))}</span>
        ${pode ? '<button class="btn sm mt-dup">Duplicar</button><button class="btn sm mt-tirar">Tirar da sala</button>' : ''}
      </div>`;
  }
  if (!o) return '<p class="dica">Toque numa tela para escolher o cabeamento dela.</p>';
  const pl = o.pl, d = pl.dados, cfg = o.it.cfg;
  const manual = d.manual;
  const pads = PADROES.map(([ini, sen]) => {
    const on = !manual && d.modo !== 'cheia' && cfg.inicio === ini && (cfg.sentido === sen || (cfg.sentido === 'auto' && d.sentido === sen));
    return `<button class="mt-pad ${on ? 'on' : ''}" data-pad="${ini}|${sen}" title="Começa ${NOME_CANTO[ini]}, ${sen}" ${ro}>${iconePadrao(ini, sen)}</button>`;
  }).join('');
  const lim = d.px_porta;
  const linhas = d.portas.map(p => {
    const pct = Math.round(p.pixels / lim * 100), passa = p.pixels > lim;
    return `<tr class="${passa ? 'passa' : ''}"><td><span class="mt-cor" style="background:${Cab.CORES_PORTA[(p.n - 1) % Cab.CORES_PORTA.length]}"></span>P${p.n}</td><td class="n">${p.gabinetes} gab</td><td class="n">${fmt(p.pixels)} px</td><td class="n">${pct}%${passa ? ' · passa do limite' : ''}</td></tr>`;
  }).join('');
  const ctrl = o.it.ctrl, nomeC = ctrl.item ? Cab.CONTROLADORAS[ctrl.item].nome : '';
  const porC = ctrl.item ? Cab.CONTROLADORAS[ctrl.item].portas : 0;
  const ligacao = ctrl.qtd ? Array.from({ length: ctrl.qtd }, (_, k) => {
    const a = k * porC + 1, b = Math.min(d.portas.length, (k + 1) * porC);
    return a <= b ? `${nomeC} ${k + 1}: P${a}${b > a ? '–P' + b : ''}` : `${nomeC} ${k + 1}: pelos pixels`;
  }).join(' · ') : 'sem controladora';
  return `<div class="mt-sinal">
    <div>
      <div class="peq mut2" style="margin-bottom:6px">Padrão do cabo — <b>${B.esc(o.t.nome || 'Tela')}</b></div>
      <div class="mt-pads">${pads}</div>
      <div class="linha-flex peq" style="margin-top:8px;gap:12px;flex-wrap:wrap">
        <label class="linha-flex"><input type="checkbox" data-mc="serpentina" ${cfg.serpentina !== false ? 'checked' : ''} ${ro} style="width:18px;height:18px"> Serpentina</label>
        <label class="linha-flex">Cada porta <select data-mc="portas" ${ro}><option value="colunas">linhas inteiras</option><option value="cheia" ${cfg.portas === 'cheia' ? 'selected' : ''}>enche a porta</option></select></label>
        <label class="linha-flex">Limite <input class="inp curto" inputmode="numeric" data-mc="px_porta" value="${lim}" ${ro} style="width:96px"> px</label>
      </div>
    </div>
    <div>
      <div class="linha-flex" style="gap:8px;flex-wrap:wrap;margin-bottom:6px">
        <button class="btn sm mt-mao ${est.mao ? 'on' : ''}" ${ro}>${est.mao ? 'Desenhando à mão' : 'Desenhar as portas à mão'}</button>
        ${est.mao && pode ? '<button class="btn sm mt-desfazer">Desfazer</button><button class="btn sm mt-limpar">Limpar</button>' : ''}
        ${manual && pode ? '<button class="btn sm mt-auto">Voltar ao automático</button>' : ''}
      </div>
      ${est.mao ? '<p class="dica" style="margin:0 0 6px">Toque num gabinete e passe pelos outros na ordem do cabo. Tocar num gabinete de uma porta continua dali; num livre, abre uma porta nova.</p>' : ''}
      ${d.manual_invalido ? '<p class="dica amarelo" style="margin:0 0 6px">O desenho à mão não serve mais (a tela mudou de tamanho): voltou ao automático.</p>' : ''}
      ${d.sem_porta ? `<p class="dica amarelo" style="margin:0 0 6px">${d.sem_porta} gabinete${d.sem_porta === 1 ? '' : 's'} sem porta.</p>` : ''}
      <table class="mt-portas"><tbody>${linhas}</tbody></table>
      <p class="peq mut2" style="margin:6px 0 0">${d.portas.length} porta${d.portas.length === 1 ? '' : 's'} · ${B.esc(ligacao)}</p>
    </div>
  </div>`;
}

export function htmlMontagem(ctx, lista, ps, pode) {
  const its = cena(ps);
  if (est.sel && !its.some(o => o.t.id === est.sel)) est.sel = null;
  if (!est.sel && its.length) est.sel = its[0].t.id;
  if (est.modo !== 'sinal') est.mao = false;
  return `<div class="card mt-card">
    <div class="linha-flex" style="flex-wrap:wrap;gap:8px;margin-bottom:10px">
      <h2 style="margin:0" class="cresce">Montagem da sala</h2>
      <div class="abas mt-modos"><button data-mm="paineis" class="${est.modo === 'paineis' ? 'on' : ''}">1 · Painéis</button><button data-mm="sinal" class="${est.modo === 'sinal' ? 'on' : ''}">2 · Sinal</button><button data-mm="energia" class="${est.modo === 'energia' ? 'on' : ''}">3 · Energia</button><button data-mm="processamento" class="${est.modo === 'processamento' ? 'on' : ''}">4 · Processamento</button></div>
      ${(() => { const on = typeof document !== 'undefined' && document.body.classList.contains('cheio-mt'); return `<button class="btn sm tela-cheia-btn" data-cheio="mt" title="${on ? 'Sair da tela cheia (Esc)' : 'Tela cheia'}">${ctx.B.ico(on ? 'cheia_sair' : 'cheia')} ${on ? 'Sair' : 'Tela cheia'}</button>`; })()}
      <div class="linha-flex mt-zoom" style="gap:4px"><button class="btn sm" data-z="-1" title="Afastar">−</button><span class="peq mut2" style="min-width:42px;text-align:center">${Math.round(est.zoom * 100)}%</span><button class="btn sm" data-z="1" title="Aproximar">+</button></div>
      ${pode && est.modo === 'paineis' ? `<button class="btn sm mt-add">${ctx.B.ico('add')} Tela</button>` : ''}
    </div>
    <div class="mt-quadro">${svgSala(its, est.modo, null, null, ps)}</div>
    <div class="mt-lado">${ladoHtml(ctx, its, ps, pode)}</div>
  </div>`;
}

/* liga o editor; salvar(campos, {recalc}) grava a sala (e a lista acompanha) */
export function ligarMontagem(el, ctx, lista, ps, salvar, pode) {
  const card = el.querySelector('.mt-card');
  if (!card) return;
  const { B } = ctx;
  card.querySelectorAll('[data-mm]').forEach(b => { b.onclick = () => { est.modo = b.dataset.mm; est.mao = false; ctx.atualizar(); }; });
  card.querySelectorAll('[data-z]').forEach(b => { b.onclick = () => {
    const i = Math.max(0, Math.min(ZOOMS.length - 1, ZOOMS.indexOf(est.zoom) + +b.dataset.z));
    est.zoom = ZOOMS[i] || 1; ctx.atualizar();
  }; });
  const its = cena(ps);
  const quadro = card.querySelector('.mt-quadro');
  const svg = () => quadro.querySelector('svg');
  const telaDe = id => (lista.telas || []).find(t => t.id === id);
  const salvarTelas = (o) => salvar({ telas: lista.telas }, o);

  // ---------- desenho e toque ----------
  const ponto = e => { const s = svg(); const p = s.createSVGPoint(); p.x = e.clientX; p.y = e.clientY; return p.matrixTransform(s.getScreenCTM().inverse()); };
  const telaEm = p => its.find(o => p.x >= o.x && p.x <= o.x + o.w && p.y >= -(o.base + o.h) && p.y <= -o.base);
  const celulaEm = (o, p) => {
    const c = Math.floor((p.x - o.x) / (o.w / o.pl.colunas)), r = Math.floor((p.y + o.base + o.h) / (o.h / o.pl.linhas));
    return c >= 0 && c < o.pl.colunas && r >= 0 && r < o.pl.linhas ? [c, r] : null;
  };
  let temp = null, fixo = null;
  const redesenha = () => { quadro.innerHTML = svgSala(its, est.modo, temp, fixo, ps); ligarToque(); };
  let arrasto = null, pintura = null;
  const planoCom = (o, man) => Cab.planoTela({ colunas: o.pl.colunas, linhas: o.pl.linhas, painel: o.it.painel, cfg: Object.assign({}, o.it.cfg, { portas_manual: man }) });
  const manualAtual = o => (o.pl.dados.manual ? o.pl.dados.portas.map(p => p.caminho.map(q => q.slice())) : o.pl.dados.portas.map(p => p.caminho.map(q => q.slice())));

  function ligarToque() {
    const s = svg();
    if (!s || !pode) {
      if (s) s.addEventListener('click', e => { const o = telaEm(ponto(e)); if (o && est.sel !== o.t.id) { est.sel = o.t.id; ctx.atualizar(); } });
      return;
    }
    s.addEventListener('pointerdown', e => {
      const p = ponto(e), o = telaEm(p);
      if (est.modo === 'processamento') {
        const gc = e.target.closest && e.target.closest('[data-ctrl]'), gp = e.target.closest && e.target.closest('[data-proc]');
        if (gc) est.selP = { tipo: 'ctrl', id: gc.dataset.ctrl };
        else if (gp) est.selP = { tipo: 'proc' };
        else if (o) {
          const cel = celulaEm(o, p), pt = cel && o.pl.dados.portas.find(q => q.caminho.some(z => z[0] === cel[0] && z[1] === cel[1]));
          if (pt) { est.selP = { tipo: 'porta', chave: Cab.chaveCircuito(o.it, pt.n) }; est.sel = o.t.id; }
        } else return;
        ctx.atualizar();
        return;
      }
      if (est.modo === 'energia') {
        const gr = e.target.closest && e.target.closest('[data-regua]'), gk = e.target.closest && e.target.closest('[data-rack]');
        if (gr) est.selE = { tipo: 'regua', id: gr.dataset.regua };
        else if (gk) est.selE = { tipo: 'rack', id: gk.dataset.rack };
        else if (o) {
          const cel = celulaEm(o, p), ci = cel && o.pl.energia.circuitos.find(c => c.caminho.some(q => q[0] === cel[0] && q[1] === cel[1]));
          if (ci) { est.selE = { tipo: 'circuito', chave: Cab.chaveCircuito(o.it, ci.n) }; est.sel = o.t.id; }
        } else return;
        ctx.atualizar();
        return;
      }
      if (est.modo === 'paineis') {
        if (!o) return;
        arrasto = { o, dx: p.x - o.x, x0: o.x, moveu: false, nova: est.sel !== o.t.id };
        fixo = limites(its, est.modo);
        est.sel = o.t.id;
        quadro.setPointerCapture(e.pointerId);   // no quadro: o svg é refeito a cada passo
        return;
      }
      if (!o) return;
      if (!est.mao || est.sel !== o.t.id) { if (est.sel !== o.t.id) { est.sel = o.t.id; est.mao = false; ctx.atualizar(); } return; }
      const cel = celulaEm(o, p);
      if (!cel) return;
      const man = (temp && temp[o.t.id]) ? temp[o.t.id].dados.portas.map(q => q.caminho.map(x => x.slice())) : manualAtual(o);
      est.desfazer.push({ id: o.t.id, man: JSON.stringify(manualAtual(o)) });
      let pi = -1, ci = -1;
      man.forEach((cam, i) => { const k = cam.findIndex(q => q[0] === cel[0] && q[1] === cel[1]); if (k >= 0) { pi = i; ci = k; } });
      if (pi >= 0) man[pi] = man[pi].slice(0, ci + 1); else { man.push([cel]); pi = man.length - 1; }
      pintura = { o, man, pi };
      fixo = limites(its, est.modo);
      temp = { [o.t.id]: planoCom(o, man) };
      quadro.setPointerCapture(e.pointerId);
      redesenha();
    });
  }
  // os movimentos ficam no quadro (o svg é refeito a cada passo do desenho)
  quadro.addEventListener('pointermove', e => {
    if (arrasto) {
      const p = ponto(e);
      const nx = Math.round((p.x - arrasto.dx) * 10) / 10;
      if (Math.abs(nx - arrasto.o.x) >= 0.05) { arrasto.o.x = nx; arrasto.moveu = true; redesenha(); }
    } else if (pintura) {
      const p = ponto(e), cel = celulaEm(pintura.o, p);
      if (!cel) return;
      const usado = pintura.man.some(cam => cam.some(q => q[0] === cel[0] && q[1] === cel[1]));
      if (usado) return;
      pintura.man[pintura.pi].push(cel);
      temp = { [pintura.o.t.id]: planoCom(pintura.o, pintura.man) };
      redesenha();
    }
  });
  const solta = () => {
    fixo = null;
    if (arrasto) {
      const a = arrasto; arrasto = null;
      if (!a.moveu) { if (a.nova) ctx.atualizar(); return; }
      // grava a posição de todas (as outras ficam onde estão) e a ordem da esquerda para a direita
      for (const o of its) o.t.pos = { x: +o.x.toFixed(2) };
      lista.telas.sort((p, q) => ((p.pos && Number.isFinite(+p.pos.x)) ? +p.pos.x : 1e9) - ((q.pos && Number.isFinite(+q.pos.x)) ? +q.pos.x : 1e9));
      salvarTelas({ recalc: true });
    } else if (pintura) {
      const pz = pintura; pintura = null; temp = null;
      const t = telaDe(pz.o.t.id);
      t.projeto = Object.assign({}, t.projeto || {}, { portas_manual: pz.man.filter(c => c.length) });
      salvarTelas({ recalc: true });
    }
  };
  quadro.addEventListener('pointerup', solta);
  quadro.addEventListener('pointercancel', solta);
  ligarToque();
  if (est.zoom > 1 && est.sel) {
    const g = quadro.querySelector(`g[data-tela="${est.sel}"]`);
    if (g) { const r = g.getBoundingClientRect(), q = quadro.getBoundingClientRect(); quadro.scrollLeft += (r.left + r.width / 2) - (q.left + q.width / 2); quadro.scrollTop += (r.top + r.height / 2) - (q.top + q.height / 2); }
  }

  if (!pode) return;
  // ---------- Painéis ----------
  const add = card.querySelector('.mt-add');
  if (add) add.onclick = async () => {
    const { novaTela } = await import('./listas.js');
    const fim = its.length ? Math.max(...its.map(o => o.x + o.w)) + 1 : 0;
    const t = novaTela(ctx, { nome: 'Tela ' + ((lista.telas || []).length + 1), largura_m: 3, altura_m: 2, pos: { x: +fim.toFixed(2) } });
    for (const o of its) if (!o.t.pos) o.t.pos = { x: +o.x.toFixed(2) };
    lista.telas = (lista.telas || []).concat([t]);
    est.sel = t.id;
    salvarTelas({ recalc: true });
  };
  const o = its.find(x => x.t.id === est.sel);
  card.querySelectorAll('[data-mf]').forEach(inp => inp.addEventListener('change', () => {
    if (!o) return;
    const t = telaDe(o.t.id), campo = inp.dataset.mf;
    if (campo === 'nome') { t.nome = inp.value.trim(); return salvarTelas({ recalc: false }); }
    const v = B.lerNum(inp.value);
    if (v == null || !(v >= 0)) { inp.classList.add('erro'); return; }
    if (campo === 'pos') { for (const x of its) if (!x.t.pos) x.t.pos = { x: +x.x.toFixed(2) }; t.pos = { x: v }; lista.telas.sort((p, q) => (+((p.pos || {}).x) || 0) - (+((q.pos || {}).x) || 0)); }
    else { t.modo = 'medida'; t[campo] = v; }
    salvarTelas({ recalc: true });
  }));
  const dup = card.querySelector('.mt-dup');
  if (dup && o) dup.onclick = () => {
    const t = telaDe(o.t.id), c = JSON.parse(JSON.stringify(t));
    c.id = ctx.novoId(); c.nome = (t.nome || 'Tela') + ' (cópia)'; delete c.calc_uid;
    const fim = Math.max(...its.map(x => x.x + x.w)) + 1;
    for (const x of its) if (!x.t.pos) x.t.pos = { x: +x.x.toFixed(2) };
    c.pos = { x: +fim.toFixed(2) };
    lista.telas = lista.telas.concat([c]);
    est.sel = c.id;
    salvarTelas({ recalc: true });
  };
  const tirar = card.querySelector('.mt-tirar');
  if (tirar && o) tirar.onclick = async () => {
    if (!(await B.confirmar('Tirar esta tela da sala?', 'Os itens que vieram só dela saem da lista.', { sim: 'Tirar', perigo: true }))) return;
    lista.telas = lista.telas.filter(t => t.id !== o.t.id);
    est.sel = null;
    salvarTelas({ recalc: true });
  };

  // ---------- Energia ----------
  /* a sugestão do sistema vira a montagem da sala (na primeira mudança), com ids novos */
  const montagemDeEnergia = () => {
    const ids = new Map(), novo = id => { if (!ids.has(id)) ids.set(id, /^(auto|sobra|est)-/.test(id) ? ctx.novoId() : id); return ids.get(id); };
    const racks = ps.racks.map(k => ({ id: novo(k.id), tipo: k.tipo }));
    const reguas = ps.reguasSala.filter(r => !r.estimada).map(r => {
      const k = ps.racks.find(q => q.n === r.rack);
      return { id: novo(r.id), circuitos: r.circuitos.slice(), rack: k ? novo(k.id) : null };
    });
    return { energia: { reguas, racks }, novo };
  };
  const gravaEnergia = (energia, sel) => {
    if (sel) est.selE = sel;
    salvar({ projeto: Object.assign({}, lista.projeto || {}, { energia }) }, { recalc: true });
  };
  const sE = est.selE;
  card.querySelectorAll('[data-e]').forEach(inp => inp.addEventListener('change', () => {
    const { energia: en, novo } = montagemDeEnergia();
    const qual = inp.dataset.e, v = inp.value;
    if (qual === 'circ-regua' && sE) {
      const antiga = en.reguas.find(r => r.circuitos.includes(sE.chave));
      en.reguas.forEach(r => { r.circuitos = r.circuitos.filter(k => k !== sE.chave); });
      if (v === '__nova') en.reguas.push({ id: ctx.novoId(), circuitos: [sE.chave], rack: antiga ? antiga.rack : null });
      else { const r = en.reguas.find(q => q.id === novo(v)); if (r) r.circuitos.push(sE.chave); }
      en.reguas = en.reguas.filter(r => r.circuitos.length);
      return gravaEnergia(en);
    }
    if (qual === 'regua-rack' && sE) {
      const r = en.reguas.find(q => q.id === novo(sE.id));
      if (!r) return;
      if (v === '__novo') { const k = { id: ctx.novoId(), tipo: (en.racks[0] || {}).tipo || 'rack-9' }; en.racks.push(k); r.rack = k.id; }
      else r.rack = novo(v);
      return gravaEnergia(en, { tipo: 'regua', id: r.id });
    }
    if (qual === 'rack-tipo' && sE) {
      const k = en.racks.find(q => q.id === novo(sE.id));
      if (k) k.tipo = v;
      return gravaEnergia(en, k ? { tipo: 'rack', id: k.id } : null);
    }
  }));
  const tiraR = card.querySelector('.mt-e-tirar-regua');
  if (tiraR && sE) tiraR.onclick = () => {
    const { energia: en, novo } = montagemDeEnergia();
    en.reguas = en.reguas.filter(r => r.id !== novo(sE.id));   // os circuitos dela vão para uma régua nova, sozinhos
    gravaEnergia(en, { tipo: null });
  };
  const tiraK = card.querySelector('.mt-e-tirar-rack');
  if (tiraK && sE) tiraK.onclick = () => {
    const { energia: en, novo } = montagemDeEnergia();
    const id = novo(sE.id);
    en.racks = en.racks.filter(k => k.id !== id);
    en.reguas.forEach(r => { if (r.rack === id) r.rack = null; });   // as réguas dele vão para os racks automáticos
    gravaEnergia(en, { tipo: null });
  };
  const eAuto = card.querySelector('.mt-e-auto');
  if (eAuto) eAuto.onclick = () => { est.selE = null; salvar({ projeto: Object.assign({}, lista.projeto || {}, { energia: null }) }, { recalc: true }); };

  // ---------- Processamento ----------
  const montagemDoProcessamento = () => {
    const ids = new Map(), novo = id => { if (!ids.has(id)) ids.set(id, /^auto-/.test(id) ? ctx.novoId() : id); return ids.get(id); };
    const ctrls = ps.processamento.ctrls.map(c => ({ id: novo(c.id), tipo: c.tipo }));
    const ligacoes = {};
    ps.processamento.ctrls.forEach(c => c.saidas.forEach((p, i) => { if (p && !p.estimada) ligacoes[p.chave] = { ctrl: novo(c.id), saida: i + 1 }; }));
    for (const p of ps.processamento.soltas || []) ligacoes[p.chave] = { solta: true };   // as desligadas na prancha continuam soltas
    return { pr: { ctrls, ligacoes }, novo };
  };
  const gravaProc = (pr, sel) => { if (sel !== undefined) est.selP = sel; salvar({ projeto: Object.assign({}, lista.projeto || {}, { processamento: pr }) }, { recalc: true }); };
  const livreEm = (pr, ctrlId, cap, menos) => { for (let i = 1; i <= cap; i++) if (!Object.entries(pr.ligacoes).some(([k, l]) => k !== menos && l.ctrl === ctrlId && l.saida === i)) return i; return null; };
  const sP = est.selP;
  card.querySelectorAll('[data-pp]').forEach(inp => inp.addEventListener('change', () => {
    const { pr, novo } = montagemDoProcessamento();
    const qual = inp.dataset.pp, v = inp.value;
    if (qual === 'ctrl' && sP) {
      let id;
      if (v.startsWith('__nova:')) { id = ctx.novoId(); pr.ctrls.push({ id, tipo: v.slice(7) }); }
      else id = novo(v);
      const c = pr.ctrls.find(q => q.id === id), cap = Cab.CONTROLADORAS[c.tipo].portas;
      const saida = livreEm(pr, id, cap, sP.chave);
      if (saida == null) { B.toast('Essa controladora está com as saídas cheias.'); return ctx.atualizar(); }
      pr.ligacoes[sP.chave] = { ctrl: id, saida };
      return gravaProc(pr);
    }
    if (qual === 'saida' && sP) {
      const atual = pr.ligacoes[sP.chave];
      if (!atual) return;
      const nova = +v, outra = Object.keys(pr.ligacoes).find(k => k !== sP.chave && pr.ligacoes[k].ctrl === atual.ctrl && pr.ligacoes[k].saida === nova);
      if (outra) pr.ligacoes[outra] = { ctrl: atual.ctrl, saida: atual.saida };   // troca de lugar com a que estava lá
      pr.ligacoes[sP.chave] = { ctrl: atual.ctrl, saida: nova };
      return gravaProc(pr);
    }
    if (qual === 'tipo' && sP) {
      const id = novo(sP.id), c = pr.ctrls.find(q => q.id === id);
      if (!c) return;
      c.tipo = v;
      const cap = Cab.CONTROLADORAS[v].portas;
      for (const [k, l] of Object.entries(pr.ligacoes)) if (l.ctrl === id && l.saida > cap) delete pr.ligacoes[k];   // não cabe: vai para a automática
      return gravaProc(pr, { tipo: 'ctrl', id });
    }
  }));
  const procIn = card.querySelector('[data-p="processadora"]');
  if (procIn) procIn.addEventListener('change', () => salvar({ projeto: Object.assign({}, lista.projeto || {}, { processadora: procIn.value.trim() }) }, { recalc: false }));
  const tiraC = card.querySelector('.mt-p-tirar');
  if (tiraC && sP) tiraC.onclick = () => {
    const { pr, novo } = montagemDoProcessamento(), id = novo(sP.id);
    pr.ctrls = pr.ctrls.filter(c => c.id !== id);
    for (const [k, l] of Object.entries(pr.ligacoes)) if (l.ctrl === id) delete pr.ligacoes[k];
    gravaProc(pr, null);
  };
  const pAuto = card.querySelector('.mt-p-auto');
  if (pAuto) pAuto.onclick = () => { est.selP = null; salvar({ projeto: Object.assign({}, lista.projeto || {}, { processamento: null }) }, { recalc: true }); };

  // ---------- Sinal ----------
  const muda = (campos) => { const t = telaDe(o.t.id); t.projeto = Object.assign({}, t.projeto || {}, campos); salvarTelas({ recalc: true }); };
  card.querySelectorAll('[data-pad]').forEach(b => { b.onclick = () => {
    if (!o) return;
    const [inicio, sentido] = b.dataset.pad.split('|');
    est.mao = false;
    muda({ inicio, sentido, portas_manual: null, portas: o.it.cfg.portas === 'cheia' ? 'cheia' : 'colunas' });
  }; });
  card.querySelectorAll('[data-mc]').forEach(inp => inp.addEventListener('change', () => {
    if (!o) return;
    const campo = inp.dataset.mc;
    if (campo === 'serpentina') return muda({ serpentina: inp.checked, portas_manual: null });
    if (campo === 'portas') return muda({ portas: inp.value, portas_manual: null });
    const v = B.lerNum(inp.value);
    if (!(v >= 10000)) { inp.classList.add('erro'); return; }
    muda({ px_porta: v });
  }));
  const mao = card.querySelector('.mt-mao');
  if (mao) mao.onclick = () => {
    est.mao = !est.mao;
    // começa do que o sistema sugeriu: você ajusta em vez de desenhar tudo do zero
    if (est.mao && o && !o.pl.dados.manual) { est.desfazer = []; return muda({ portas_manual: manualAtual(o) }); }
    ctx.atualizar();
  };
  const desf = card.querySelector('.mt-desfazer');
  if (desf) desf.onclick = () => {
    const u = est.desfazer.pop();
    if (!u) return B.toast('Nada para desfazer.');
    const t = telaDe(u.id);
    if (t) { t.projeto = Object.assign({}, t.projeto || {}, { portas_manual: JSON.parse(u.man) }); salvarTelas({ recalc: true }); }
  };
  const limpar = card.querySelector('.mt-limpar');
  if (limpar && o) limpar.onclick = () => { est.desfazer.push({ id: o.t.id, man: JSON.stringify(manualAtual(o)) }); muda({ portas_manual: [] }); };
  const auto = card.querySelector('.mt-auto');
  if (auto) auto.onclick = () => { est.mao = false; est.desfazer = []; muda({ portas_manual: null }); };
}
