/* Projetech · Cabeamento — arquivo COMPARTILHADO: é o mesmo no Painel de LED (js/cabeamento.js) e no
 * Projetech Calculator (cabeamento.js). Mudou aqui, copia igual para lá — assim o projeto técnico sai
 * idêntico de qualquer um dos dois apps.
 *
 * 1) As contas do cabeamento de uma sala (as telas lado a lado, esquerda → direita):
 *    - sinal: cada porta pega linhas inteiras (colunas na vertical, fileiras na horizontal) até o limite
 *      de pixels (e de gabinetes, se houver), repartidas por igual (9 colunas, até 4 por porta → 3, 3, 3);
 *      se nem uma linha cabe, a tela vira faixas iguais no sentido da linha (fileira de 40 com limite 23 →
 *      2 de 20), como no Calculator; "encher a porta" = uma corrente só, cortada a cada N gabinetes;
 *    - AC: cada bloco de porta é um circuito de powercon (dividido se passar do limite por circuito); a
 *      régua Steck/Powercon junta circuitos até o limite dela; as réguas da sala vão para os racks;
 *    - controladoras (MCTRL660, Taurus) por tela.
 * 2) As folhas do projeto técnico no estilo do Calculator (moldura, cotas, painel em degradê com a grade,
 *    setas do cabo na passagem entre os gabinetes, portas numeradas em círculo, carimbo Projetech):
 *    Pixel map · Cabeamento de sinal · Cabeamento de AC. Saem como primitivas em mm → svg() ou pdf().
 *
 * Puro: não toca DOM, rede nem relógio. */

const num = v => {
  if (v == null || v === '') return 0;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};

/* ============================================================
 * Contas
 * ============================================================ */

/* Por tela. inicio: canto onde o cabo começa · sentido: auto | vertical | horizontal · serpentina ·
 * portas: 'colunas' (linhas inteiras, padrão) | 'cheia' (enche a porta, quebra a linha) · px_porta ·
 * max_gab_porta · kw_circuito · kw_regua · reguas_rack · rack · controladora */
export const PROJETO_PADRAO = {
  inicio: 'inf-esq', sentido: 'auto', serpentina: true, portas: 'colunas', px_porta: 0, max_gab_porta: 0,
  backup: false, kw_circuito: 3.5, kw_regua: 7.5, reguas_rack: 4, rack: 'rack-9', processadora: '', controladora: 'auto'
};
export const RACKS = { 'rack-5': 5, 'rack-9': 9, 'rack-12': 12 };
export const CONTROLADORAS = {
  'send-660': { nome: 'MCTRL660', portas: 4, px: 2300000 },
  'taurus-tb60': { nome: 'Taurus TB60', portas: 4, px: 2300000 },
  'taurus-tb1': { nome: 'Taurus TB1', portas: 1, px: 650000 }
};
/* Da sala: racks repartidos na sala inteira ou por tela, a processadora e o formato da folha */
export const SALA_PADRAO = { racks: 'sala', processadora: '', folha: 'a3' };

export function configTela(cfg) { return Object.assign({}, PROJETO_PADRAO, cfg || {}); }

/* n itens em k grupos o mais iguais possível, na ordem: 70 em 12 → 6,6,…,6,5,5 */
export function dividir(n, k) {
  k = Math.max(1, k);
  const base = Math.floor(n / k), extra = n % k, out = [];
  for (let i = 0; i < k; i++) out.push(base + (i < extra ? 1 : 0));
  return out;
}

/* As "linhas" que o cabo percorre numa faixa da tela: colunas (vertical) ou fileiras (horizontal), na ordem
 * a partir do canto de início. faixa = [a, b): o trecho de cada linha (fileiras a..b-1 de cada coluna, na
 * vertical). celulas(li, j): os gabinetes da linha li no sentido do cabo; j = posição da linha dentro da
 * porta (com serpentina a 1ª sai do canto e a 2ª volta). Linha 0 = de cima; coluna 0 = esquerda. */
function percurso(C, L, sentido, inicio, serp, faixa) {
  const daDireita = /dir$/.test(inicio), deBaixo = /^inf/.test(inicio);
  const volta = j => serp !== false && j % 2 === 1;
  if (sentido === 'horizontal') {
    const [a, b] = faixa || [0, C];
    const ordem = Array.from({ length: L }, (_, i) => (deBaixo ? L - 1 - i : i));
    return {
      n: L, tam: b - a,
      celulas: (li, j) => {
        const r = ordem[li], praEsq = daDireita !== volta(j);
        return Array.from({ length: b - a }, (_, k) => [praEsq ? b - 1 - k : a + k, r]);
      }
    };
  }
  const [a, b] = faixa || [0, L];
  const ordem = Array.from({ length: C }, (_, i) => (daDireita ? C - 1 - i : i));
  return {
    n: C, tam: b - a,
    celulas: (li, j) => {
      const c = ordem[li], sobe = deBaixo !== volta(j);
      return Array.from({ length: b - a }, (_, k) => [c, sobe ? b - 1 - k : a + k]);
    }
  };
}

/* gabinetes que cabem numa porta: pelo limite de pixels e, se houver, pelo de gabinetes */
function cabeNaPorta(pxGab, pxPorta, maxGab, total) {
  let cabe = pxGab > 0 && pxPorta > 0 ? Math.floor(pxPorta / pxGab) : total;
  if (maxGab > 0) cabe = Math.min(cabe || maxGab, maxGab);
  return Math.max(1, cabe || 1);
}

/* Linhas inteiras por porta num sentido: blocos repartidos por igual; se nem uma linha cabe, faixas iguais */
function opcaoSentido(sentido, C, L, cabe) {
  const n = sentido === 'horizontal' ? L : C, tam = sentido === 'horizontal' ? C : L;
  if (tam <= cabe) {
    const cap = Math.min(Math.floor(cabe / tam), n);
    const blocos = dividir(n, Math.ceil(n / cap));
    return { sentido, faixas: [tam], blocos, portas: blocos.length, igual: blocos.every(x => x === blocos[0]) };
  }
  const faixas = dividir(tam, Math.ceil(tam / cabe));
  return { sentido, faixas, blocos: Array(n).fill(1), portas: n * faixas.length, igual: faixas.every(x => x === faixas[0]), excede: true };
}

/* Sentido "auto": o que usa menos portas; empatou, o que reparte por igual; empatou de novo, vertical.
 * (Foyer 4 × 3 m: vertical 3, 3, 2 colunas × horizontal 2, 2, 2 fileiras → horizontal, como no desenho.) */
export function escolherSentido(cfgSentido, C, L, cabe) {
  const v = opcaoSentido('vertical', C, L, cabe), h = opcaoSentido('horizontal', C, L, cabe);
  if (cfgSentido === 'vertical') return v;
  if (cfgSentido === 'horizontal') return h;
  // no automático, a tela inteira em faixas (linha que não cabe na porta) só entra se não tiver outro jeito
  const ops = [v, h].filter(o => !o.excede);
  return (ops.length ? ops : [v, h]).sort((a, b) => a.portas - b.portas || (b.igual - a.igual) || (a.sentido === 'vertical' ? -1 : 1))[0];
}

/* O plano de UMA tela: t = { colunas, linhas, painel: { px_l, px_a, w_max, px_porta, por_circuito }, cfg } */
export function planoTela(t) {
  const C = Math.round(num(t.colunas)), L = Math.round(num(t.linhas));
  if (!(C > 0 && L > 0)) return null;
  const p = t.painel || {};
  const cfg = configTela(t.cfg);
  const pxGab = num(p.px_l) * num(p.px_a);
  const pxPorta = num(cfg.px_porta) || num(p.px_porta) || 650000;
  const cabe = cabeNaPorta(pxGab, pxPorta, num(cfg.max_gab_porta), C * L);
  const cheia = cfg.portas === 'cheia';
  const serp = cfg.serpentina !== false;
  const op = cheia ? { sentido: cfg.sentido === 'horizontal' ? 'horizontal' : 'vertical', faixas: [cfg.sentido === 'horizontal' ? C : L] }
    : escolherSentido(cfg.sentido, C, L, cabe);
  const sentido = op.sentido;
  const deBaixo = /^inf/.test(cfg.inicio), daDireita = /dir$/.test(cfg.inicio);

  // as faixas (normalmente uma só, a tela inteira); a 1ª é a do lado onde o cabo começa
  const tamLinha = sentido === 'horizontal' ? C : L;
  const doFim = sentido === 'vertical' ? deBaixo : daDireita;
  const faixas = [];
  let feito = 0;
  for (const tam of op.faixas) {
    faixas.push(doFim ? [tamLinha - feito - tam, tamLinha - feito] : [feito, feito + tam]);
    feito += tam;
  }

  const portas = [], blocosLinhas = [];
  for (const fx of faixas) {
    const pc = percurso(C, L, sentido, cfg.inicio, serp, fx);
    if (cheia) {
      const tudo = [];
      for (let li = 0; li < pc.n; li++) tudo.push(...pc.celulas(li, li));
      for (let i = 0; i < tudo.length; i += cabe) {
        const caminho = tudo.slice(i, i + cabe);
        portas.push({ n: portas.length + 1, gabinetes: caminho.length, pixels: caminho.length * pxGab, caminho });
      }
      blocosLinhas.push({ pc, li0: 0, n: pc.n, global: true, porta: portas.length });
    } else {
      let li0 = 0;
      for (const nl of op.blocos) {
        const caminho = [];
        for (let j = 0; j < nl; j++) caminho.push(...pc.celulas(li0 + j, j));
        portas.push({ n: portas.length + 1, linhas: nl, gabinetes: caminho.length, pixels: caminho.length * pxGab, caminho });
        blocosLinhas.push({ pc, li0, n: nl, porta: portas.length });
        li0 += nl;
      }
    }
  }
  portas.forEach(pt => { pt.cols = [...new Set(pt.caminho.map(([c]) => c))]; });

  // ---- circuitos de energia: cada bloco de porta é um circuito, dividido se passar do limite ----
  const wGab = num(p.w_max);
  const limW = Math.max(0.1, num(cfg.kw_circuito) || 3.5) * 1000;
  const limGab = num(p.por_circuito) > 0 ? num(p.por_circuito) : Infinity;
  const maxGab = Math.max(1, Math.min(limGab, wGab ? Math.floor(limW / wGab) : Infinity));
  const circuitos = [];
  for (const b of blocosLinhas) {
    const { pc } = b;
    const linhaDe = j => pc.celulas(b.li0 + j, b.global ? b.li0 + j : j);
    const todo = [];
    for (let j = 0; j < b.n; j++) todo.push(...linhaDe(j));
    let pedacos;
    if (todo.length <= maxGab) pedacos = [todo];
    else {
      const linhasPor = Math.floor(maxGab / pc.tam);
      pedacos = [];
      if (linhasPor >= 1) {
        let a = 0;
        for (const nl of dividir(b.n, Math.ceil(b.n / linhasPor))) {
          const cam = [];
          for (let j = 0; j < nl; j++) cam.push(...pc.celulas(b.li0 + a + j, j));
          pedacos.push(cam); a += nl;
        }
      } else {
        let a = 0;
        for (const q of dividir(todo.length, Math.ceil(todo.length / maxGab))) { pedacos.push(todo.slice(a, a + q)); a += q; }
      }
    }
    for (const cam of pedacos) circuitos.push({ n: circuitos.length + 1, porta: b.porta, gabinetes: cam.length, w: cam.length * wGab, caminho: cam });
  }

  // ---- réguas: juntam circuitos vizinhos até o limite de consumo ----
  const limR = Math.max(0.1, num(cfg.kw_regua) || 7.5) * 1000;
  const maiorCirc = circuitos.reduce((m, c) => Math.max(m, c.w), 0);
  const porRegua = maiorCirc ? Math.max(1, Math.floor(limR / maiorCirc)) : circuitos.length;
  const nReguas = Math.ceil(circuitos.length / porRegua);
  const reguas = [];
  let c0 = 0;
  for (const qtd of dividir(circuitos.length, nReguas)) {
    const cs = circuitos.slice(c0, c0 + qtd), cels = cs.flatMap(c => c.caminho);
    const xs = cels.map(([c]) => c), ys = cels.map(([, r]) => r);
    cs.forEach(c => { c.regua = reguas.length + 1; });
    reguas.push({
      n: reguas.length + 1, circuitos: cs.map(c => c.n), w: cs.reduce((s, c) => s + c.w, 0), gabinetes: cels.length,
      col_ini: Math.min(...xs), col_fim: Math.max(...xs), lin_ini: Math.min(...ys), lin_fim: Math.max(...ys),
      colunas: Math.max(...xs) - Math.min(...xs) + 1, rack: 0
    });
    c0 += qtd;
  }
  // racks da tela sozinha (na sala, planoSala reparte as réguas de todas as telas)
  const porRack = Math.max(1, Math.round(num(cfg.reguas_rack) || 4));
  const racks = [];
  let r0 = 0;
  for (const qtd of dividir(nReguas, Math.ceil(nReguas / porRack))) {
    if (!qtd) continue;
    const rs = reguas.slice(r0, r0 + qtd);
    rs.forEach(r => { r.rack = racks.length + 1; });
    racks.push({ n: racks.length + 1, tipo: RACKS[cfg.rack] ? cfg.rack : 'rack-9', reguas: rs.map(r => r.n), w: rs.reduce((s, r) => s + r.w, 0) });
    r0 += qtd;
  }

  const maiorBloco = cheia ? 0 : Math.max(...op.blocos);
  return {
    colunas: C, linhas: L, gabinetes: C * L,
    largura_m: +(C * (num(p.larg_m) || 0.5)).toFixed(3), altura_m: +(L * (num(p.alt_m) || 0.5)).toFixed(3),
    px_l: num(p.px_l), px_a: num(p.px_a), cfg,
    dados: {
      modo: cheia ? 'cheia' : 'colunas', sentido, faixas: faixas.length, coluna_excede: !!op.excede && !cheia,
      linhas_por_porta: maiorBloco, cols_por_porta: cheia ? 0 : sentido === 'vertical' ? maiorBloco : C,
      gab_por_porta: cheia ? cabe : maiorBloco * (faixas.length > 1 ? Math.max(...op.faixas) : tamLinha),
      px_porta: pxPorta, cabe, portas, cabos: portas.length * (cfg.backup ? 2 : 1)
    },
    energia: { w_gab: wGab, w_coluna: L * wGab, limite_w: limR, limite_circuito_w: limW, max_gab_circuito: maxGab, circuitos, reguas, racks, w_total: C * L * wGab }
  };
}

/* Quantas controladoras a tela pede: cabe nas portas E nos pixels de cada uma */
export function controladorasDaTela(cfg, portas, pixels) {
  if (!portas) return { item: null, qtd: 0 };
  const c = cfg && cfg.controladora;
  if (c === 'nenhuma') return { item: null, qtd: 0 };
  const id = CONTROLADORAS[c] ? c : 'send-660';
  const k = CONTROLADORAS[id];
  return { item: id, qtd: Math.max(Math.ceil(portas / k.portas), Math.ceil((pixels || 0) / k.px)) };
}

/* O projeto da SALA: telas = [{ tela, nome, colunas, linhas, painel, cfg, estimativa? }] na ordem da folha.
 * estimativa ({ gabinetes, pixels, portas, circuitos }) = tela sem desenho (m², nº de gabinetes).
 * As réguas de todas as telas vão para os racks da sala (Syngenta, Plenária: 8 réguas → 2 racks de 4). */
export function planoSala(telas, sala) {
  const sc = Object.assign({}, SALA_PADRAO, sala || {});
  const out = [];
  for (const t of telas || []) {
    const p = t.painel || {};
    const cfg = configTela(t.cfg);
    const pl = planoTela(t);
    const e = t.estimativa || {};
    const gab = pl ? pl.gabinetes : num(e.gabinetes);
    if (!gab) continue;
    const g = {
      gabinetes: gab, pixels: pl ? gab * pl.px_l * pl.px_a : num(e.pixels),
      potencia_max_w: gab * num(p.w_max), potencia_med_w: gab * num(p.w_med), peso_kg: +(gab * num(p.kg)).toFixed(1),
      cases: num(p.por_case) ? Math.ceil(gab / num(p.por_case)) : 0,
      largura_m: pl ? pl.largura_m : 0, altura_m: pl ? pl.altura_m : 0
    };
    let portas, circuitos, reguas;
    if (pl) { portas = pl.dados.portas.length; circuitos = pl.energia.circuitos.length; reguas = pl.energia.reguas.length; }
    else {
      portas = num(e.portas); circuitos = num(e.circuitos);
      reguas = g.potencia_max_w ? Math.ceil(g.potencia_max_w / ((num(cfg.kw_regua) || 7.5) * 1000)) : 0;
    }
    out.push({ tela: t.tela || t, nome: t.nome || '', painel: p, cfg, pl, g, portas, cabos_dados: portas * (cfg.backup ? 2 : 1), circuitos, reguas, ctrl: controladorasDaTela(cfg, portas, g.pixels) });
  }
  const t0 = out[0];
  const tipo = RACKS[sc.rack] ? sc.rack : t0 && RACKS[t0.cfg.rack] ? t0.cfg.rack : 'rack-9';
  const porRack = Math.max(1, Math.round(num(sc.reguas_rack) || (t0 ? num(t0.cfg.reguas_rack) : 0) || 4));
  const racks = [];
  if (sc.racks === 'tela') {
    out.forEach((it, ti) => {
      const pr = Math.max(1, Math.round(num(it.cfg.reguas_rack) || 4)), tp = RACKS[it.cfg.rack] ? it.cfg.rack : 'rack-9';
      let r0 = 0;
      for (const q of dividir(it.reguas, Math.ceil(it.reguas / pr))) {
        if (!q) continue;
        racks.push({ n: racks.length + 1, tipo: tp, reguas: Array.from({ length: q }, (_, k) => ({ tela: ti, n: r0 + k + 1 })) });
        r0 += q;
      }
    });
  } else {
    const todas = out.flatMap((it, ti) => Array.from({ length: it.reguas }, (_, k) => ({ tela: ti, n: k + 1 })));
    let r0 = 0;
    if (todas.length) for (const q of dividir(todas.length, Math.ceil(todas.length / porRack))) {
      racks.push({ n: racks.length + 1, tipo, reguas: todas.slice(r0, r0 + q) });
      r0 += q;
    }
  }
  const ctrl = {};
  for (const it of out) if (it.ctrl.item) ctrl[it.ctrl.item] = (ctrl[it.ctrl.item] || 0) + it.ctrl.qtd;
  const soma = k => out.reduce((s, it) => s + it[k], 0);
  return {
    cfg: sc, telas: out, racks, controladoras: ctrl,
    portas: soma('portas'), circuitos: soma('circuitos'), reguas: soma('reguas'),
    w_total: out.reduce((s, it) => s + it.g.potencia_max_w, 0)
  };
}

/* ============================================================
 * Folhas do projeto técnico — o estilo do Calculator
 * ============================================================ */

export const FORMATOS = { a3: { w: 420, h: 297, nome: 'A3' }, '169': { w: 528, h: 297, nome: '16:9' }, a4: { w: 297, h: 210, nome: 'A4' } };
const MM_PT = 25.4 / 72;
// larguras da Helvetica (1/1000 em) dos caracteres 32–126 — as mesmas que o jsPDF usa para medir
const W_REG = [278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584];
const W_BOLD = [278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611, 975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556, 333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584];
const W_EXTRA = { '×': 584, '—': 1000, '–': 556, '·': 278, '°': 400, 'º': 365, 'ª': 370, '²': 333, '…': 1000 };
/* largura de um texto em mm (pt = corpo da letra; cs = espaço entre letras em mm) */
export function larguraTexto(txt, pt, bold, cs) {
  const s = String(txt == null ? '' : txt);
  const tab = bold ? W_BOLD : W_REG;
  let u = 0;
  for (const ch of s) {
    const base = ch.normalize('NFD')[0];
    const c = base.charCodeAt(0);
    u += W_EXTRA[ch] || (c >= 32 && c <= 126 ? tab[c - 32] : 556);
  }
  return u / 1000 * pt * MM_PT + (cs || 0) * Math.max(0, s.length - 1);
}
const corta = (txt, maxMm, pt, bold) => {
  let s = String(txt == null ? '' : txt);
  while (s.length > 1 && larguraTexto(s, pt, bold) > maxMm) s = s.slice(0, -1);
  return s;
};

const pad2 = n => String(n).padStart(2, '0');
export const fmtNum = (n, casas = 0) => {
  const v = (+n || 0).toFixed(casas).split('.');
  return v[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.') + (v[1] ? ',' + v[1] : '');
};
const m2 = v => fmtNum(v, 2);
const mInt = v => m2(v).replace(/,00$/, '');
const kw = w => fmtNum(w / 1000, 2) + ' kW';
const mdc = (a, b) => (b ? mdc(b, a % b) : a);
const proporcao = (w, h) => (w && h ? `${w / mdc(w, h)}:${h / mdc(w, h)}` : '—');
export const dataCurta = iso => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || '').trim()); return m ? `${m[3]}/${m[2]}/${m[1].slice(2)}` : String(iso || ''); };

/* a moldura e as medidas fixas da folha — as mesmas do Calculator (U: o A4 vira a unidade) */
function quadro(F) {
  const PW = F.w, PH = F.h, MG = 8, U = Math.max(1, PH / 210);
  const blockH = 23 * U, blockTop = PH - MG - blockH;
  return { PW, PH, MG, U, blockH, blockTop, drawTop: MG + 8 * U, drawBottom: blockTop - 4 * U, areaL: MG + 20 * U, areaR: PW - MG - 8 * U };
}

/* ---------------- carimbo Projetech (o do Calculator: dados | logo | identificação | folha) ---------------- */
function carimbo(P, Q, { grupos, esq, dir, com, numero, total, razaoLogo }) {
  const { MG, U, PW } = Q;
  const cbY = Q.blockTop, cbH = Q.blockH, cbW = PW - 2 * MG, LOGO_MIN = (U > 1 ? 52 : 42) * U, PAD = 3.6 * U;
  const LBL = 0.70, CS = 0.13 * U, BUL = 2.2 * U, SEP = 1.8 * U;
  const largRotulo = (fs, rot) => BUL + larguraTexto(rot.toUpperCase(), fs * LBL, false, CS);
  const largDado = (fs, rot, val) => largRotulo(fs, rot) + SEP + larguraTexto(String(val || '—'), fs, true) + PAD;
  const largPar = (fs, r, v) => larguraTexto(r + ': ', fs, false) + larguraTexto(String(v || '—'), fs, true) + PAD;
  const medir = fs => {
    const g = grupos.map(col => col.reduce((mx, r) => Math.max(mx, largDado(fs, r[0], r[1])), 0));
    const e = esq.reduce((mx, r) => Math.max(mx, largPar(fs, r[0], r[1])), 0);
    const d = dir.reduce((mx, r) => Math.max(mx, largPar(fs, r[0], r[1])), 0);
    const c = Math.max(largPar(fs, com[0], com[1]), 15 * U);
    return { g, e, d, c, total: g[0] + g[1] + g[2] + e + d + c + LOGO_MIN };
  };
  let FS = 6.8 * U, med = medir(FS);
  while (FS > 4.8 * U && med.total > cbW) { FS -= 0.1; med = medir(FS); }
  grupos = grupos.map(col => col.slice().sort((a, b) => largDado(FS, a[0], a[1]) - largDado(FS, b[0], b[1])));
  const wD = med.g, wE = med.e, wDi = med.d, wF = med.c;
  const wLogo = cbW - (wD[0] + wD[1] + wD[2]) - wE - wDi - wF;
  const xLogo = MG, x0d = MG + wLogo;
  const xD = [x0d, x0d + wD[0], x0d + wD[0] + wD[1]];
  const xIdent = xD[2] + wD[2], xMeio = xIdent + wE, xFolha = xMeio + wDi;
  const rh = cbH / 4;
  P.push({ t: 'rect', x: MG, y: cbY, w: cbW, h: cbH, stroke: '#191919', sw: 0.35 * U });
  [xD[0], xIdent, xFolha].forEach(x => P.push({ t: 'line', x1: x, y1: cbY, x2: x, y2: cbY + cbH, stroke: '#191919', sw: 0.25 * U }));
  P.push({ t: 'line', x1: xMeio, y1: cbY, x2: xMeio, y2: cbY + cbH, stroke: '#969696', sw: 0.15 * U });
  for (let i = 1; i < 4; i++) P.push({ t: 'line', x1: xIdent, y1: cbY + i * rh, x2: xFolha, y2: cbY + i * rh, stroke: '#969696', sw: 0.15 * U });
  P.push({ t: 'line', x1: xFolha, y1: cbY + rh, x2: PW - MG, y2: cbY + rh, stroke: '#969696', sw: 0.15 * U });
  const par = (rot, valor, x0, yb, maxW) => {
    const lw = larguraTexto(rot + ': ', FS, false);
    P.push({ t: 'text', x: x0, y: yb, txt: rot + ': ', size: FS, color: '#696969' });
    P.push({ t: 'text', x: x0 + lw, y: yb, txt: corta(valor || '—', maxW - lw, FS, true), size: FS, bold: true, color: '#191919' });
  };
  const parDado = (rot, valor, x0, yb, maxW) => {
    P.push({ t: 'circle', x: x0 + 0.75 * U, y: yb - 0.75 * U, r: 0.36 * U, fill: '#969696' });
    const tx = rot.toUpperCase();
    P.push({ t: 'text', x: x0 + BUL, y: yb, txt: tx, size: FS * LBL, color: '#8c8c8c', cs: CS });
    const lw = BUL + larguraTexto(tx, FS * LBL, false, CS);
    P.push({ t: 'text', x: x0 + lw + SEP, y: yb, txt: corta(valor || '—', maxW - lw - SEP, FS, true), size: FS, bold: true, color: '#191919' });
  };
  const passo = (cbH - 2.4 * U) / 5;
  grupos.forEach((col, i) => col.forEach((l, j) => parDado(l[0], l[1], xD[i] + 1.8 * U, cbY + 3.4 * U + j * passo, wD[i] - 2.6 * U)));
  // logo
  let lh = cbH - 5 * U, lw2 = lh * (razaoLogo || 3.5);
  if (lw2 > wLogo - 4 * U) { lw2 = wLogo - 4 * U; lh = lw2 / (razaoLogo || 3.5); }
  P.push({ t: 'img', src: 'logo', x: xLogo + (wLogo - lw2) / 2, y: cbY + (cbH - lh) / 2, w: lw2, h: lh });
  // identificação
  for (let i = 0; i < 4; i++) {
    const yb = cbY + i * rh + rh / 2 + 0.9 * U;
    par(esq[i][0], esq[i][1], xIdent + 1.8 * U, yb, wE - 2.6 * U);
    par(dir[i][0], dir[i][1], xMeio + 1.8 * U, yb, wDi - 2.6 * U);
  }
  // O.S. + folha ("1" sozinha, "1/5" quando há mais)
  par(com[0], com[1], xFolha + 1.8 * U, cbY + rh / 2 + 0.9 * U, wF - 2.6 * U);
  const nf = numero || 1, tf = total || 1, cxF = xFolha + wF / 2, texto = tf > 1 ? `${nf}/${tf}` : String(nf);
  const yRot = cbY + rh + 3.6 * U;
  P.push({ t: 'text', x: cxF, y: yRot, txt: 'Folha:', size: FS, color: '#696969', align: 'center' });
  let fsF = (tf > 1 ? 17 : 21) * U;
  while (fsF > 9 * U && larguraTexto(texto, fsF, true) > wF - 4 * U) fsF -= 1;
  P.push({ t: 'text', x: cxF, y: (cbY + cbH + yRot + fsF * 0.254) / 2, txt: texto, size: fsF, bold: true, color: '#0a0a0a', align: 'center' });
}

/* ---------------- uma tela no papel: degradê, grade, cabo e números ---------------- */
const COR_TOPO = '#000000', COR_BASE = '#0dcbfc';   // as cores padrão da imagem de teste do Calculator
const mistura = (a, b, k) => {
  const pa = [1, 3, 5].map(i => parseInt(a.slice(i, i + 2), 16)), pb = [1, 3, 5].map(i => parseInt(b.slice(i, i + 2), 16));
  return '#' + pa.map((v, i) => Math.round(v + (pb[i] - v) * k).toString(16).padStart(2, '0')).join('');
};

/* modo: 'teste' (a imagem de teste: números das colunas, X, círculo e logo) · 'sinal' (portas) · 'ac' (circuitos) */
function telaNoPapel(P, g, modo, U) {
  const pl = g.pl, { x0, y0, w, h } = g;
  const cw = w / pl.colunas, ch = h / pl.linhas, s = Math.min(cw, ch);
  const FAIXAS = 40;
  // cada faixa vai até o pé do painel (a próxima pinta por cima): sem fresta entre elas no SVG nem no PDF
  for (let i = 0; i < FAIXAS; i++) P.push({ t: 'rect', x: x0, y: y0 + i * h / FAIXAS, w, h: h - i * h / FAIXAS, fill: mistura(COR_TOPO, COR_BASE, (i + 0.5) / FAIXAS) });
  const gw = Math.max(0.06, s * 0.012);
  for (let c = 1; c < pl.colunas; c++) P.push({ t: 'line', x1: x0 + c * cw, y1: y0, x2: x0 + c * cw, y2: y0 + h, stroke: '#ffffff', sw: gw, op: 0.35 });
  for (let r = 1; r < pl.linhas; r++) P.push({ t: 'line', x1: x0, y1: y0 + r * ch, x2: x0 + w, y2: y0 + r * ch, stroke: '#ffffff', sw: gw, op: 0.35 });
  const X = c => x0 + (c + 0.5) * cw, Y = r => y0 + (r + 0.5) * ch;
  const rad = Math.max(0.8, Math.min(cw * 0.22, h * 0.06));
  const circulo = (cx, cy, txt, fundo) => {
    P.push({ t: 'circle', x: cx, y: cy, r: rad, fill: fundo || '#ffffff', stroke: '#000000', sw: Math.max(0.08, rad * 0.12) });
    const pt = rad * 1.1 / MM_PT;
    P.push({ t: 'text', x: cx, y: cy + pt * MM_PT * 0.36, txt: String(txt), size: pt, bold: true, color: '#000000', align: 'center' });
  };
  if (modo === 'teste') {
    const lw = Math.max(0.12, 0.18 * U);
    P.push({ t: 'line', x1: x0, y1: y0, x2: x0 + w, y2: y0 + h, stroke: '#ffffff', sw: lw });
    P.push({ t: 'line', x1: x0 + w, y1: y0, x2: x0, y2: y0 + h, stroke: '#ffffff', sw: lw });
    P.push({ t: 'circle', x: x0 + w / 2, y: y0 + h / 2, r: Math.min(w, h) * 0.48, stroke: '#ffffff', sw: lw });
    const lgW = Math.min(w * 0.5, h * 0.9 * 3.5), lgH = lgW / 3.5;
    P.push({ t: 'img', src: 'logo-branco', x: x0 + (w - lgW) / 2, y: y0 + (h - lgH) / 2, w: lgW, h: lgH });
    // os números das colunas, perto da borda de cima e da de baixo (como na imagem de teste do Calculator)
    for (let c = 0; c < pl.colunas; c++) {
      circulo(X(c), y0 + Math.max(rad * 1.25, ch * 0.29), c + 1);
      if (pl.linhas > 1) circulo(X(c), y0 + h - Math.max(rad * 1.25, ch * 0.29), c + 1);
    }
    return;
  }
  const ac = modo === 'ac';
  const grupos = ac ? pl.energia.circuitos : pl.dados.portas;
  const cor = ac ? '#facc15' : '#ffffff';
  const k = 0.75, lw = Math.max(0.1, s * 0.026 * k), len = s * 0.62 * k, hd = s * 0.15 * k, hw = s * 0.085 * k;
  for (const gp of grupos) {
    for (let i = 0; i < gp.caminho.length - 1; i++) {
      const [ac0, ar0] = gp.caminho[i], [bc, br] = gp.caminho[i + 1];
      const ax = X(ac0), ay = Y(ar0), bx = X(bc), by = Y(br);
      const mx = (ax + bx) / 2, my = (ay + by) / 2, ang = Math.atan2(by - ay, bx - ax), ux = Math.cos(ang), uy = Math.sin(ang);
      const x1 = mx - ux * len / 2, y1 = my - uy * len / 2, x2 = mx + ux * len / 2, y2 = my + uy * len / 2;
      P.push({ t: 'line', x1, y1, x2: x2 - ux * hd, y2: y2 - uy * hd, stroke: cor, sw: lw });
      P.push({ t: 'tri', fill: cor, pts: [[x2, y2], [x2 - ux * hd + uy * hw, y2 - uy * hd - ux * hw], [x2 - ux * hd - uy * hw, y2 - uy * hd + ux * hw]] });
    }
  }
  for (const gp of grupos) { const [c, r] = gp.caminho[0]; circulo(X(c), Y(r), gp.n, ac ? '#facc15' : '#ffffff'); }
}

/* onde o cabo sai de cada grupo (x da coluna do 1º gabinete; a mesma coluna repetida vai lado a lado) */
function saidas(g, caminhos) {
  const cw = g.w / g.pl.colunas, usados = new Map();
  return caminhos.map(cam => {
    const [c] = cam[0], k = usados.get(c) || 0;
    usados.set(c, k + 1);
    return g.x0 + (c + 0.5) * cw + k * Math.min(cw * 0.22, 1.6);
  });
}
function espalhar(caixas, w, xMin, xMax) {
  const gap = w * 1.3;
  for (let i = 1; i < caixas.length; i++) if (caixas[i].x - caixas[i - 1].x < gap) caixas[i].x = caixas[i - 1].x + gap;
  const sobra = caixas.length ? caixas[caixas.length - 1].x + w / 2 - xMax : 0;
  if (sobra > 0) caixas.forEach(c => { c.x -= sobra; });
  const falta = caixas.length ? xMin - (caixas[0].x - w / 2) : 0;
  if (falta > 0) caixas.forEach(c => { c.x += falta; });
}

/* ---------------- uma folha: as telas em escala, as cotas, o que fica embaixo e o carimbo ---------------- */
const TIPO_FOLHA = { teste: 'Pixel map', sinal: 'Cabeamento de sinal', ac: 'Cabeamento de AC' };

export function folhaDoProjeto(ps, tipo, meta, { formato, numero, total, razaoLogo } = {}) {
  const F = FORMATOS[formato] || FORMATOS.a3;
  const Q = quadro(F), { U, MG, PW, PH } = Q;
  const P = [];
  P.push({ t: 'rect', x: MG, y: MG, w: PW - 2 * MG, h: PH - 2 * MG, stroke: '#1e1e1e', sw: 0.4 * U });
  const its = ps.telas.map((it, ti) => ({ it, ti })).filter(o => o.it.pl);
  if (tipo !== 'teste') P.push({ t: 'text', x: MG + 4 * U, y: MG + 5.6 * U, txt: TIPO_FOLHA[tipo] + (meta.sala ? ' · ' + meta.sala : ''), size: 9 * U, bold: true, color: '#464646' });

  // a escala: as telas lado a lado (vão entre elas) e o espaço de baixo (réguas e racks, ou controladoras)
  const availW = Q.areaR - Q.areaL, availH = Q.drawBottom - Q.drawTop;
  const baixo = tipo === 'teste' ? 0 : Math.min(availH * 0.36, 70 * U);
  const largs = its.map(o => o.it.pl.largura_m), alts = its.map(o => o.it.pl.altura_m);
  const somaW = largs.reduce((a, b) => a + b, 0), maxH = Math.max(0.01, ...alts);
  const vaoMin = its.length > 1 ? 14 * U : 0;
  let esc = 0;
  if (its.length) {
    esc = Math.min((availW - vaoMin * (its.length - 1)) / somaW, (availH - baixo - 10 * U) / maxH);
    const vao = m => Math.max(vaoMin, 0.6 * m);
    for (let k = 0; k < 4; k++) esc = Math.min((availW - vao(esc) * (its.length - 1)) / somaW, (availH - baixo - 10 * U) / maxH);
  }
  const vao = its.length > 1 ? Math.max(vaoMin, 0.6 * esc) : 0;
  const totW = somaW * esc + vao * (its.length - 1);
  const yBase = Q.drawTop + 10 * U + maxH * esc + Math.max(0, (availH - baixo - 10 * U - maxH * esc) / 2);
  let x = Q.areaL + (availW - totW) / 2;
  const geo = its.map(({ it, ti }) => {
    const w = it.pl.largura_m * esc, h = it.pl.altura_m * esc;
    const g = { it, ti, pl: it.pl, x0: x, y0: yBase - h, w, h, xm: x + w / 2 };
    x += w + vao;
    return g;
  });
  for (const g of geo) {
    telaNoPapel(P, g, tipo, U);
    // cotas (como no Calculator: encostadas no painel, em metros e pixels)
    const v = 4 * U, pxW = g.pl.colunas * g.pl.px_l, pxH = g.pl.linhas * g.pl.px_a;
    const yC = g.y0 - v;
    P.push({ t: 'line', x1: g.x0, y1: yC, x2: g.x0 + g.w, y2: yC, stroke: '#787878', sw: 0.2 * U });
    P.push({ t: 'line', x1: g.x0, y1: yC - 1.5 * U, x2: g.x0, y2: yC + 1.5 * U, stroke: '#787878', sw: 0.2 * U });
    P.push({ t: 'line', x1: g.x0 + g.w, y1: yC - 1.5 * U, x2: g.x0 + g.w, y2: yC + 1.5 * U, stroke: '#787878', sw: 0.2 * U });
    const nome = geo.length > 1 && g.it.nome ? g.it.nome + ' · ' : '';
    P.push({ t: 'text', x: g.xm, y: yC - 1.3 * U, txt: corta(`${nome}${mInt(g.pl.largura_m)} m — ${fmtNum(pxW)} px`, Math.max(g.w + vao * 0.9, 30 * U), 8 * U), size: 8 * U, color: '#3c3c3c', align: 'center' });
    const xV = g.x0 - v;
    P.push({ t: 'line', x1: xV, y1: g.y0, x2: xV, y2: g.y0 + g.h, stroke: '#787878', sw: 0.2 * U });
    P.push({ t: 'line', x1: xV - 1.5 * U, y1: g.y0, x2: xV + 1.5 * U, y2: g.y0, stroke: '#787878', sw: 0.2 * U });
    P.push({ t: 'line', x1: xV - 1.5 * U, y1: g.y0 + g.h, x2: xV + 1.5 * U, y2: g.y0 + g.h, stroke: '#787878', sw: 0.2 * U });
    const vt = `${mInt(g.pl.altura_m)} m — ${fmtNum(pxH)} px`;
    P.push({ t: 'text', x: xV - 1.3 * U, y: g.y0 + g.h / 2 + larguraTexto(vt, 8 * U) / 2, txt: vt, size: 8 * U, color: '#3c3c3c', ang: 90 });
  }

  const xMin = Q.areaL - 12 * U, xMax = Q.areaR + 4 * U;
  if (tipo === 'ac' && geo.length) {
    // circuito → régua (triângulo azul) → descida até o rack da sala
    const yBus = yBase + Math.min(9 * U, baixo * 0.15);
    const rackH = Math.min(17 * U, baixo * 0.34), rackW = Math.min(24 * U, (xMax - xMin) / Math.max(1, ps.racks.length * 1.6));
    const yR = yBase + baixo * 0.42;
    const reg = new Map();
    for (const g of geo) {
      const en = g.pl.energia;
      for (const r of en.reguas) {
        const xs = saidas(g, r.circuitos.map(n => en.circuitos[n - 1].caminho));
        const xm = (Math.min(...xs) + Math.max(...xs)) / 2;
        xs.forEach(xx => P.push({ t: 'line', x1: xx, y1: yBase + 0.3 * U, x2: xx, y2: yBus, stroke: '#3c3c3c', sw: 0.22 * U }));
        if (xs.length > 1) P.push({ t: 'line', x1: Math.min(...xs), y1: yBus, x2: Math.max(...xs), y2: yBus, stroke: '#3c3c3c', sw: 0.22 * U });
        reg.set(g.ti + '.' + r.n, { xm, n: r.n, tela: g.it.nome });
      }
    }
    const racks = ps.racks.map(rk => {
      const rs = rk.reguas.map(q => reg.get(q.tela + '.' + q.n)).filter(Boolean);
      return Object.assign({}, rk, { rs, x: rs.length ? rs.reduce((a, r) => a + r.xm, 0) / rs.length : (xMin + xMax) / 2 });
    });
    espalhar(racks, rackW, xMin, xMax);
    for (const rk of racks) {
      const mm = rk.rs.length;
      rk.rs.forEach((r, j) => {
        const esq = rk.x - rackW / 2, dir = rk.x + rackW / 2;
        const yE = yR + rackH * (0.22 + 0.56 * (mm > 1 ? j / (mm - 1) : 0.5));
        const pts = r.xm < esq ? [[r.xm, yBus], [r.xm, yE], [esq, yE]] : r.xm > dir ? [[r.xm, yBus], [r.xm, yE], [dir, yE]] : [[r.xm, yBus], [r.xm, yR]];
        P.push({ t: 'poly', pts, stroke: '#191919', sw: 0.4 * U });
        const sz = 1.1 * U;
        P.push({ t: 'tri', fill: '#2563eb', pts: [[r.xm - sz, yBus - 0.2 * U], [r.xm + sz, yBus - 0.2 * U], [r.xm, yBus + sz * 1.4]] });
      });
      const nS = RACKS[rk.tipo] || 9, colsT = nS === 12 ? 4 : 3, linT = Math.ceil(nS / colsT);
      P.push({ t: 'rect', x: rk.x - rackW / 2, y: yR, w: rackW, h: rackH, fill: '#f4f6f8', stroke: '#191919', sw: 0.3 * U, r: 0.9 * U });
      const tw = rackW * 0.8 / colsT, th = rackH * 0.72 / linT;
      for (let k = 0; k < nS; k++) {
        const cx = rk.x - rackW * 0.4 + (k % colsT + 0.5) * tw, cy = yR + rackH * 0.14 + (Math.floor(k / colsT) + 0.5) * th;
        P.push({ t: 'circle', x: cx, y: cy, r: Math.min(tw, th) * 0.32, fill: '#ffffff', stroke: '#2563eb', sw: 0.18 * U });
      }
      P.push({ t: 'rect', x: rk.x - rackW / 2 + 1.2 * U, y: yR + rackH, w: 1.4 * U, h: 1.4 * U, fill: '#191919' });
      P.push({ t: 'rect', x: rk.x + rackW / 2 - 2.6 * U, y: yR + rackH, w: 1.4 * U, h: 1.4 * U, fill: '#191919' });
      P.push({ t: 'text', x: rk.x, y: yR + rackH + 5 * U, txt: `Rack ${rk.n} · ${nS} saídas · ${rk.reguas.length} régua${rk.reguas.length === 1 ? '' : 's'}`, size: 7 * U, color: '#3c3c3c', align: 'center' });
    }
  }
  if (tipo === 'sinal' && geo.length) {
    // portas → barramento → controladora de cada tela → processadora da sala
    const yBusS = yBase + Math.min(8 * U, baixo * 0.13);
    const cH = 5.2 * U, cW = Math.min(30 * U, Math.max(20 * U, (xMax - xMin) / Math.max(1, geo.length * 2.2)));
    const yC = yBase + baixo * 0.3;
    const ctrls = geo.map(g => {
      const xs = saidas(g, g.pl.dados.portas.map(p => p.caminho));
      xs.forEach(xx => P.push({ t: 'line', x1: xx, y1: yBase + 0.3 * U, x2: xx, y2: yBusS, stroke: '#3c3c3c', sw: 0.2 * U }));
      const a = Math.min(...xs), b = Math.max(...xs);
      if (xs.length > 1) P.push({ t: 'line', x1: a, y1: yBusS, x2: b, y2: yBusS, stroke: '#3c3c3c', sw: 0.2 * U });
      return { g, x: g.xm, xb: (a + b) / 2 };
    });
    espalhar(ctrls, cW, xMin, xMax);
    for (const c of ctrls) {
      const it = c.g.it, nome = (CONTROLADORAS[it.ctrl.item] || {}).nome || 'Controladora';
      P.push({ t: 'poly', pts: [[c.xb, yBusS], [c.xb, (yBusS + yC) / 2], [c.x, (yBusS + yC) / 2], [c.x, yC]], stroke: '#191919', sw: 0.3 * U });
      P.push({ t: 'rect', x: c.x - cW / 2, y: yC, w: cW, h: cH, fill: '#f4f6f8', stroke: '#191919', sw: 0.3 * U, r: 0.7 * U });
      P.push({ t: 'text', x: c.x, y: yC + cH * 0.66, txt: (it.ctrl.qtd > 1 ? it.ctrl.qtd + ' × ' : '') + nome, size: 6.5 * U, bold: true, color: '#191919', align: 'center' });
      P.push({ t: 'text', x: c.x + 1.2 * U, y: yC + cH + 3.6 * U, txt: `${it.portas} porta${it.portas === 1 ? '' : 's'}${it.cfg.backup ? ' + backup' : ''}`, size: 6 * U, color: '#3c3c3c' });
    }
    const proc = ps.cfg.processadora || (geo.length > 1 ? 'Processadora' : '');
    if (proc) {
      const pW = 36 * U, pH = 12 * U, yP = yBase + baixo * 0.62;
      const xP = Math.min(xMax - pW / 2, Math.max(xMin + pW / 2, (geo[0].x0 + geo[geo.length - 1].x0 + geo[geo.length - 1].w) / 2));
      const yJ = (yC + cH + 6 * U + yP) / 2;
      for (const c of ctrls) P.push({ t: 'poly', pts: [[c.x, yC + cH], [c.x, yJ], [xP, yJ]], stroke: '#191919', sw: 0.3 * U });
      P.push({ t: 'line', x1: xP, y1: yJ, x2: xP, y2: yP, stroke: '#191919', sw: 0.3 * U });
      P.push({ t: 'rect', x: xP - pW / 2, y: yP, w: pW, h: pH, fill: '#f4f6f8', stroke: '#191919', sw: 0.35 * U, r: 1 * U });
      P.push({ t: 'text', x: xP, y: yP + pH * 0.62, txt: proc, size: 7.5 * U, bold: true, color: '#191919', align: 'center' });
    }
  }
  const sem = ps.telas.filter(it => !it.pl).map(it => it.nome || 'tela');
  if (sem.length) P.push({ t: 'text', x: Q.areaL, y: Q.drawBottom - 1 * U, txt: `Sem desenho (informadas em m² ou nº de gabinetes): ${sem.join(', ')}`, size: 6.5 * U, color: '#92400e' });

  // carimbo: os dados da folha
  const g0 = geo[0];
  const tot = ps.telas.reduce((a, it) => ({ gab: a.gab + it.g.gabinetes, cases: a.cases + it.g.cases, kg: a.kg + it.g.peso_kg, med: a.med + it.g.potencia_med_w, max: a.max + it.g.potencia_max_w }), { gab: 0, cases: 0, kg: 0, med: 0, max: 0 });
  const pxW = geo.reduce((a, g) => a + g.pl.colunas * g.pl.px_l, 0), pxH = Math.max(0, ...geo.map(g => g.pl.linhas * g.pl.px_a));
  const modelos = [...new Set(ps.telas.map(it => it.painel.modelo).filter(Boolean))];
  const pitch = g0 && g0.pl.px_l ? (g0.pl.largura_m / g0.pl.colunas) * 1000 / g0.pl.px_l : 0;
  const dimensao = geo.length === 1 ? `${m2(g0.pl.largura_m)} × ${m2(g0.pl.altura_m)} m` : geo.length ? `${geo.length} telas · ${m2(somaW)} m` : '—';
  const escala = esc > 0 ? '1:' + fmtNum(Math.round(1000 / esc)) : '—';
  const fisico = [['Gabinetes', fmtNum(tot.gab) + ' un'], ['Cases', fmtNum(tot.cases) + ' un'], ['Peso total', fmtNum(tot.kg, 1) + ' kg'], ['Consumo médio', kw(tot.med)], ['Consumo máximo', kw(tot.max)]];
  const ctrls = Object.entries(ps.controladoras).map(([c, q]) => q + ' × ' + CONTROLADORAS[c].nome).join(' + ');
  const cfg0 = g0 ? g0.it.cfg : PROJETO_PADRAO;
  const grupos = tipo === 'teste'
    ? [fisico, [['Resolução', `${fmtNum(pxW)} × ${fmtNum(pxH)} px`], ['Pixel pitch', pitch ? m2(pitch) + ' mm' : '—'], ['Proporção', geo.length === 1 ? proporcao(pxW, pxH) : '—'], ['Dimensão', dimensao], ['Escala', escala]],
      [['Modelo', modelos.join(' + ') || '—'], ['Software', meta.software], ['Codec', meta.codec], ['Formato', meta.formatoVideo], ['Imagem estática', meta.imagem]]]
    : tipo === 'sinal'
      ? [fisico, [['Resolução', `${fmtNum(pxW)} × ${fmtNum(pxH)} px`], ['Pixel pitch', pitch ? m2(pitch) + ' mm' : '—'], ['Dimensão', dimensao], ['Escala', escala], ['Portas', fmtNum(ps.portas)]],
        [['Modelo', modelos.join(' + ') || '—'], ['Controladora', ctrls || '—'], ['Processadora', ps.cfg.processadora || '—'], ['Limite por porta', g0 ? fmtNum(g0.pl.dados.px_porta) + ' px' : '—'], ['Cabo de dados', cfg0.backup ? '2 por porta (backup)' : '1 por porta']]]
      : [fisico, [['Circuitos', fmtNum(ps.circuitos)], ['Réguas', fmtNum(ps.reguas)], ['Racks', ps.racks.length ? ps.racks.length + ' × ' + (RACKS[ps.racks[0].tipo] || 9) + ' saídas' : '—'], ['Dimensão', dimensao], ['Escala', escala]],
        [['Modelo', modelos.join(' + ') || '—'], ['Limite por circuito', fmtNum(cfg0.kw_circuito, 1) + ' kW'], ['Limite por régua', fmtNum(cfg0.kw_regua, 1) + ' kW'], ['Réguas por rack', String(cfg0.reguas_rack)], ['Racks', ps.cfg.racks === 'tela' ? 'um por tela' : 'da sala']]];
  carimbo(P, Q, {
    grupos,
    esq: [['Projeto', meta.projeto || 'Painel de LED ' + (((modelos[0] || '').match(/P\d+(?:[.,]\d+)?/i) || [''])[0].toUpperCase().replace(',', '.'))], ['Local', meta.local], ['Ambiente/Sala', meta.sala], ['Responsável Técnico(a)', meta.responsavel]],
    dir: [['Data de montagem', dataCurta(meta.montagem)], ['Data de emissão', dataCurta(meta.emissao)], ['Cliente', meta.cliente], ['Agência', meta.agencia]],
    com: ['Nº O.S', meta.os], numero, total, razaoLogo
  });
  return { tipo, prims: P, formato: F, escala: esc };
}

/* As folhas do projeto de uma sala: Pixel map (só no Painel de LED — o Calculator tem o dele), Sinal e AC */
export function folhasDoProjeto(ps, meta, { formato, paginas, inicio, total, razaoLogo } = {}) {
  const tipos = (paginas || ['teste', 'sinal', 'ac']).filter(t => ps.telas.some(it => it.pl));
  const n0 = inicio || 0, tot = total || n0 + tipos.length;
  return tipos.map((tp, i) => folhaDoProjeto(ps, tp, meta, { formato, numero: n0 + i + 1, total: tot, razaoLogo }));
}

/* ---------------- saída: SVG (prévia) e PDF (jsPDF) ---------------- */
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export function svg(folha, imagens = {}, { classe = '' } = {}) {
  const f = v => +(+v).toFixed(2);
  const F = folha.formato, out = [];
  for (const p of folha.prims) {
    const op = p.op != null ? ` opacity="${p.op}"` : '';
    const st = `${p.fill ? `fill="${p.fill}"` : 'fill="none"'}${p.stroke ? ` stroke="${p.stroke}" stroke-width="${f(p.sw || 0.2)}"` : ''}${op}`;
    if (p.t === 'rect') out.push(`<rect x="${f(p.x)}" y="${f(p.y)}" width="${f(p.w)}" height="${f(p.h)}"${p.r ? ` rx="${f(p.r)}"` : ''} ${st}/>`);
    else if (p.t === 'line') out.push(`<line x1="${f(p.x1)}" y1="${f(p.y1)}" x2="${f(p.x2)}" y2="${f(p.y2)}" stroke="${p.stroke}" stroke-width="${f(p.sw)}"${op}/>`);
    else if (p.t === 'poly') out.push(`<polyline points="${p.pts.map(([x, y]) => f(x) + ',' + f(y)).join(' ')}" fill="none" stroke="${p.stroke}" stroke-width="${f(p.sw)}" stroke-linejoin="round"/>`);
    else if (p.t === 'tri') out.push(`<polygon points="${p.pts.map(([x, y]) => f(x) + ',' + f(y)).join(' ')}" fill="${p.fill}"/>`);
    else if (p.t === 'circle') out.push(`<circle cx="${f(p.x)}" cy="${f(p.y)}" r="${f(p.r)}" ${st}/>`);
    else if (p.t === 'text') {
      const anc = p.align === 'center' ? 'middle' : p.align === 'right' ? 'end' : 'start';
      const rot = p.ang ? ` transform="rotate(${-p.ang} ${f(p.x)} ${f(p.y)})"` : '';
      out.push(`<text x="${f(p.x)}" y="${f(p.y)}" font-size="${f(p.size * MM_PT)}" font-family="Helvetica,Arial,sans-serif"${p.bold ? ' font-weight="700"' : ''}${p.cs ? ` letter-spacing="${f(p.cs)}"` : ''} fill="${p.color || '#000'}" text-anchor="${anc}"${rot}>${esc(p.txt)}</text>`);
    } else if (p.t === 'img' && imagens[p.src]) out.push(`<image href="${esc(imagens[p.src])}" x="${f(p.x)}" y="${f(p.y)}" width="${f(p.w)}" height="${f(p.h)}" preserveAspectRatio="xMidYMid meet"/>`);
  }
  return `<svg class="${classe}" viewBox="0 0 ${F.w} ${F.h}" xmlns="http://www.w3.org/2000/svg" role="img" style="background:#fff">${out.join('')}</svg>`;
}

/* imagens: { logo: {data, w, h}, 'logo-branco': {data, w, h} } (dataURL PNG) */
export function pdf(doc, folha, imagens = {}) {
  let gsOp = null;
  const opacidade = v => {
    if (typeof doc.GState !== 'function' || typeof doc.setGState !== 'function') return;
    if (v == null) { if (gsOp !== null) { doc.setGState(new doc.GState({ opacity: 1, 'stroke-opacity': 1 })); gsOp = null; } return; }
    if (gsOp !== v) { doc.setGState(new doc.GState({ opacity: v, 'stroke-opacity': v })); gsOp = v; }
  };
  for (const p of folha.prims) {
    opacidade(p.op);
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
      if (p.fill) doc.setFillColor(p.fill);
      if (p.stroke) { doc.setDrawColor(p.stroke); doc.setLineWidth(p.sw || 0.15); }
      doc.circle(p.x, p.y, p.r, p.fill && p.stroke ? 'FD' : p.fill ? 'F' : 'S');
    } else if (p.t === 'text') {
      doc.setFont('helvetica', p.bold ? 'bold' : 'normal'); doc.setFontSize(p.size); doc.setTextColor(p.color || '#000000');
      if (p.cs && doc.setCharSpace) doc.setCharSpace(p.cs);
      const o = {};
      if (p.align) o.align = p.align;
      if (p.ang) o.angle = p.ang;
      doc.text(String(p.txt), p.x, p.y, o);
      if (p.cs && doc.setCharSpace) doc.setCharSpace(0);
    } else if (p.t === 'img' && imagens[p.src]) {
      const im = imagens[p.src], k = Math.min(p.w / im.w, p.h / im.h), w = im.w * k, h = im.h * k;
      doc.addImage(im.data, 'PNG', p.x + (p.w - w) / 2, p.y + (p.h - h) / 2, w, h, 'pj-' + p.src, 'FAST');
    }
  }
  opacidade(null);
}
