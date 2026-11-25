/* Projetech · Cabeamento — as contas do cabeamento de uma sala e o projeto técnico (Painel de LED).
 *
 * 1) As contas (as telas lado a lado, esquerda → direita):
 *    - sinal: cada porta pega linhas inteiras (colunas na vertical, fileiras na horizontal) até o limite
 *      de pixels (e de gabinetes, se houver), repartidas por igual (9 colunas, até 4 por porta → 3, 3, 3) —
 *      a mesma conta do cabeamento do pixel map do Projetech Calculator; se nem uma linha cabe, a tela vira
 *      faixas iguais no sentido da linha; "encher a porta" = uma corrente só, cortada a cada N gabinetes;
 *    - AC: cada bloco de porta é um circuito de powercon (dividido se passar do limite por circuito); a
 *      régua Steck/Powercon junta circuitos até o limite dela; as réguas da sala vão para os racks;
 *    - controladoras (MCTRL660, Taurus) por tela.
 * 2) As folhas do projeto técnico no modelo da Projetech (Syngenta, OS 32465): AC (réguas e rack de
 *    energia) e Sinal (controladoras e processadora) — primitivas em mm → svg() ou pdf().
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
/* Da sala: racks repartidos na sala inteira ou por tela, a processadora e as folhas (auto | separadas | juntas) */
export const SALA_PADRAO = { racks: 'sala', processadora: '', folhas: 'auto', folha: 'a3' };

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

/* As portas desenhadas à mão no editor (cfg.portas_manual): [[ [coluna, linha], … ], …] na ordem do cabo.
 * Lista vazia = desenho à mão sem nenhuma porta ainda ("Limpar"); null/ausente = automático.
 * Fora da tela ou gabinete repetido = o desenho não serve mais (a tela mudou de tamanho) → null. */
export function portasManuais(m, C, L) {
  if (!Array.isArray(m)) return null;
  const vistos = new Set(), out = [];
  for (const cam of m) {
    if (!Array.isArray(cam)) return null;
    const p = [];
    for (const q of cam) {
      const c = Math.round(num(q && q[0])), r = Math.round(num(q && q[1]));
      if (!Array.isArray(q) || !(c >= 0 && c < C && r >= 0 && r < L)) return null;
      const k = c + ',' + r;
      if (vistos.has(k)) return null;
      vistos.add(k); p.push([c, r]);
    }
    if (p.length) out.push(p);
  }
  return out;
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
  const manual = portasManuais(cfg.portas_manual, C, L);
  if (manual) manual.forEach(cam => portas.push({ n: portas.length + 1, gabinetes: cam.length, pixels: cam.length * pxGab, caminho: cam, manual: true }));
  else for (const fx of faixas) {
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
  if (manual) for (const pt of portas) {
    let a = 0;
    for (const q of dividir(pt.caminho.length, Math.ceil(pt.caminho.length / maxGab))) {
      const cam = pt.caminho.slice(a, a + q);
      circuitos.push({ n: circuitos.length + 1, porta: pt.n, gabinetes: cam.length, w: cam.length * wGab, caminho: cam });
      a += q;
    }
  }
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
  const nReguas = circuitos.length ? Math.ceil(circuitos.length / porRegua) : 0;
  const reguas = [];
  let c0 = 0;
  if (nReguas) for (const qtd of dividir(circuitos.length, nReguas)) {
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

  const maiorBloco = cheia || manual ? 0 : Math.max(...op.blocos);
  const usados = portas.reduce((a, pt) => a + pt.caminho.length, 0);
  return {
    colunas: C, linhas: L, gabinetes: C * L,
    largura_m: +(C * (num(p.larg_m) || 0.5)).toFixed(3), altura_m: +(L * (num(p.alt_m) || 0.5)).toFixed(3),
    px_l: num(p.px_l), px_a: num(p.px_a), cfg,
    dados: {
      modo: manual ? 'manual' : cheia ? 'cheia' : 'colunas', sentido: manual ? 'manual' : sentido, faixas: manual ? 0 : faixas.length,
      coluna_excede: !manual && !!op.excede && !cheia, manual: !!manual,
      manual_invalido: !manual && Array.isArray(cfg.portas_manual),
      sem_porta: C * L - usados, portas_excedem: portas.filter(pt => pt.pixels > pxPorta).length,
      linhas_por_porta: maiorBloco, cols_por_porta: cheia ? 0 : sentido === 'vertical' ? maiorBloco : C,
      gab_por_porta: manual ? Math.max(0, ...portas.map(pt => pt.gabinetes)) : cheia ? cabe : maiorBloco * (faixas.length > 1 ? Math.max(...op.faixas) : tamLinha),
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
 * Desenho: medida de texto (a Helvetica do jsPDF) e posição das caixas
 * ============================================================ */

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

/* ============================================================
 * Projeto técnico de cabeamento
 * O desenho é o do modelo da Projetech (projeto da Syngenta, OS 32465) e a PRANCHA é a do Projetech
 * Calculator, igual (moldura, carimbo de dados | logo | identificação | folha; A3, 16:9 ou A4):
 *  - AC: cada circuito com a sua cor e o caminho do powercon; os circuitos descem até a régua
 *    Steck/Powercon (triângulo azul) e as réguas até o rack de energia da sala;
 *  - Sinal: cada porta com a sua cor, a etiqueta Novastar (C · P · RV · A · WH) em cada gabinete; as portas
 *    de cada tela descem até a controladora dela e as controladoras até a processadora;
 *  - sala pequena (1 tela, 1 régua): uma folha só, "AC e Sinal", como o Foyer.
 * As telas ficam lado a lado na ordem da sala; com posição (tela.pos.x, em metros, do editor) ficam onde
 * foram postas.
 * ============================================================ */

export const FORMATOS = { a3: { w: 420, h: 297, nome: 'A3' }, '169': { w: 528, h: 297, nome: '16:9' }, a4: { w: 297, h: 210, nome: 'A4' } };
// a ordem de cores do projeto da Syngenta: ciano, rosa, verde, azul, amarelo, laranja, salmão, azul claro…
export const CORES_PORTA = ['#5fd8ca', '#e290ea', '#7fd17f', '#8b8ff2', '#f2e35c', '#f3a862', '#f29191', '#90baf2', '#c9baf6', '#f8c9d7', '#dceef8', '#a6d873'];
export const TIPOS_TECNICO = { ac: 'Cabeamento de AC', sinal: 'Cabeamento de Sinal', ambos: 'Cabeamento de AC e Sinal' };
const n2t = v => String(+(+v).toFixed(2)).replace('.', ',');
const fmtNum = (n, casas = 0) => { const v = (+n || 0).toFixed(casas).split('.'); return v[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.') + (v[1] ? ',' + v[1] : ''); };
const dataCurta = iso => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || '').trim()); return m ? `${m[3]}/${m[2]}/${m[1].slice(2)}` : String(iso || ''); };

/* Onde cada tela fica na sala, em metros a partir da esquerda: a posição que o editor gravou (tela.pos.x)
 * ou, sem ela, lado a lado depois da anterior, com um vão. */
export function posicoesDaSala(ps) {
  const its = ps.telas.filter(it => it.pl);
  const media = its.length ? its.reduce((a, it) => a + it.pl.largura_m, 0) / its.length : 0;
  const vao = its.length > 1 ? Math.min(3, Math.max(0.6, media * 0.3)) : 0;
  const out = new Map();
  let cursor = 0;
  for (const it of its) {
    const p = it.tela && it.tela.pos, x = p && Number.isFinite(+p.x) ? +p.x : cursor;
    out.set(it, x);
    cursor = Math.max(cursor, x + it.pl.largura_m + vao);
  }
  return out;
}

function gradeTecnica(P, g, modo) {
  const pl = g.pl, sinal = modo !== 'ac';
  const grupos = sinal ? pl.dados.portas : pl.energia.circuitos;
  const cor = new Map();
  grupos.forEach((gp, i) => gp.caminho.forEach(([c, r]) => cor.set(c + ',' + r, i)));
  const cw = g.w / pl.colunas, ch = g.h / pl.linhas, m = Math.min(cw, ch);
  const sw = Math.max(0.05, m * 0.018);
  for (let c = 0; c < pl.colunas; c++) for (let r = 0; r < pl.linhas; r++) {
    const i = cor.get(c + ',' + r);
    P.push({ t: 'rect', x: g.x0 + c * cw, y: g.y0 + r * ch, w: cw, h: ch, fill: i == null ? '#d1d5db' : CORES_PORTA[i % CORES_PORTA.length], stroke: '#ffffff', sw });
  }
  const cx = c => g.x0 + (c + 0.5) * cw, cy = r => g.y0 + (r + 0.5) * ch;
  const pt = m / 7.6 / MM_PT;
  if (sinal && pt >= 2.1) {
    for (const p of pl.dados.portas) p.caminho.forEach(([c, r], k) => {
      ['C-1', 'P-' + p.n, 'RV-' + (k + 1), 'A-0°', 'WH-' + pl.px_l + 'x' + pl.px_a]
        .forEach((t, j) => P.push({ t: 'text', x: g.x0 + c * cw + m * 0.06, y: g.y0 + r * ch + m * (0.17 + j * 0.155), txt: t, size: pt, color: '#1f2937' }));
    });
  }
  const tr = Math.max(0.4, m * 0.11), azul = '#1d4ed8';
  for (const gp of grupos) {
    const pts = gp.caminho.map(([c, r]) => [cx(c), cy(r)]);
    P.push({ t: 'poly', pts, stroke: azul, sw: Math.max(0.12, m * 0.035) });
    for (let k = 1; k < pts.length; k++) {
      const [ax, ay] = pts[k - 1], [bx, by] = pts[k], mx = (ax + bx) / 2, my = (ay + by) / 2, ang = Math.atan2(by - ay, bx - ax);
      P.push({ t: 'tri', fill: azul, pts: [[mx + Math.cos(ang) * tr, my + Math.sin(ang) * tr], [mx + Math.cos(ang + 2.5) * tr, my + Math.sin(ang + 2.5) * tr], [mx + Math.cos(ang - 2.5) * tr, my + Math.sin(ang - 2.5) * tr]] });
    }
    const rr = Math.max(0.5, m * 0.12);
    P.push({ t: 'circle', x: pts[0][0], y: pts[0][1], r: rr, fill: '#22c55e', stroke: '#14532d', sw: 0.15 });
    P.push({ t: 'circle', x: pts[pts.length - 1][0], y: pts[pts.length - 1][1], r: rr, fill: '#ef4444', stroke: '#7f1d1d', sw: 0.15 });
  }
  if (sinal && pt >= 2.1) {
    const ctrl = (CONTROLADORAS[g.it.ctrl.item] || {}).nome || '';
    for (const p of pl.dados.portas) {
      const [c, r] = p.caminho[0];
      P.push({ t: 'text', x: g.x0 + c * cw + m * 0.06, y: g.y0 + (r + 1) * ch - m * 0.05, txt: (ctrl ? ctrl + ' · ' : '') + 'P' + p.n, size: pt, bold: true, color: '#111827' });
    }
  }
  P.push({ t: 'rect', x: g.x0, y: g.y0, w: g.w, h: g.h, stroke: '#64748b', sw: 0.2 });
}

function rackTecnico(P, x, y, w, h, tipo, rotulo, k) {
  const nS = RACKS[tipo] || 9, colsT = nS === 12 ? 4 : 3, linT = Math.ceil(nS / colsT);
  P.push({ t: 'rect', x: x - w / 2, y, w, h, fill: '#3f4652', stroke: '#111827', sw: 0.35 * k, r: 1.2 * k });
  const tw = w * 0.8 / colsT, th = h * 0.78 / linT;
  for (let i = 0; i < nS; i++) {
    const tx = x - w * 0.4 + (i % colsT) * tw, ty = y + h * 0.11 + Math.floor(i / colsT) * th;
    P.push({ t: 'rect', x: tx + tw * 0.08, y: ty + th * 0.1, w: tw * 0.55, h: th * 0.78, fill: '#3b82f6', stroke: '#dbeafe', sw: 0.12 * k, r: 0.5 * k });
    P.push({ t: 'circle', x: tx + tw * 0.355, y: ty + th * 0.49, r: Math.min(tw, th) * 0.16, fill: '#1e3a8a' });
    P.push({ t: 'rect', x: tx + tw * 0.7, y: ty + th * 0.3, w: tw * 0.2, h: th * 0.4, fill: '#ef4444', r: 0.2 * k });
  }
  P.push({ t: 'rect', x: x - w / 2 + 1 * k, y: y + h, w: 1.4 * k, h: 1.6 * k, fill: '#111827' });
  P.push({ t: 'rect', x: x + w / 2 - 2.4 * k, y: y + h, w: 1.4 * k, h: 1.6 * k, fill: '#111827' });
  P.push({ t: 'text', x, y: y + h + 5 * k, txt: rotulo, size: 6.5 * k, align: 'center', color: '#111827' });
}

/* desenha a sala na área; k = tamanho dos aparelhos e letras (o U da prancha). Devolve a escala (mm por m). */
function salaTecnica(P, ps, area, modo, k) {
  const its = ps.telas.map((it, ti) => ({ it, ti })).filter(o => o.it.pl);
  if (!its.length) return 0;
  const comAC = modo !== 'sinal', comSinal = modo === 'sinal';
  const hBaixo = Math.min(area.h * 0.46, (modo === 'ambos' ? 44 : 58) * k);
  const pos = posicoesDaSala(ps);
  const x0m = Math.min(...its.map(o => pos.get(o.it)));
  const x1m = Math.max(...its.map(o => pos.get(o.it) + o.it.pl.largura_m));
  const totW = Math.max(0.5, x1m - x0m);
  const maxH = Math.max(...its.map(o => o.it.pl.altura_m));
  const hNome = its.length > 1 ? 5 * k : 0;
  const s = Math.min(area.w / totW, (area.h - hBaixo - hNome) / maxH);
  const yTop = area.y + Math.max(0, (area.h - (hNome + maxH * s + hBaixo)) / 2);
  const yBase = yTop + hNome + maxH * s;
  const xIni = area.x + (area.w - totW * s) / 2;
  const geo = its.map(({ it, ti }) => {
    const w = it.pl.largura_m * s, h = it.pl.altura_m * s, x = xIni + (pos.get(it) - x0m) * s;
    return { it, ti, pl: it.pl, x0: x, y0: yBase - h, w, h, xm: x + w / 2 };
  });
  for (const g of geo) {
    gradeTecnica(P, g, modo);
    if (geo.length > 1) P.push({ t: 'text', x: g.xm, y: g.y0 - 1.6 * k, txt: corta(`${g.it.nome || 'Tela'} · ${n2t(g.pl.largura_m)} x ${n2t(g.pl.altura_m)} m`, Math.max(g.w * 1.2, 24 * k), 6.5 * k, true), size: 6.5 * k, bold: true, align: 'center', color: '#111827' });
  }
  const xMin = area.x, xMax = area.x + area.w;
  if (comAC) {
    const yBus = yBase + Math.min(8 * k, hBaixo * 0.15);
    const rackH = Math.min(15 * k, hBaixo * 0.3), rackW = Math.min(24 * k, area.w / Math.max(1, ps.racks.length * 1.6));
    const yR = yBase + hBaixo * 0.42;
    const reg = new Map();
    for (const g of geo) {
      const en = g.pl.energia;
      for (const r of en.reguas) {
        const xs = saidas(g, r.circuitos.map(n => en.circuitos[n - 1].caminho));
        const xm = (Math.min(...xs) + Math.max(...xs)) / 2;
        xs.forEach(xx => P.push({ t: 'line', x1: xx, y1: yBase + 0.4, x2: xx, y2: yBus, stroke: '#111827', sw: 0.3 * k }));
        if (xs.length > 1) P.push({ t: 'line', x1: Math.min(...xs), y1: yBus, x2: Math.max(...xs), y2: yBus, stroke: '#111827', sw: 0.3 * k });
        reg.set(g.ti + '.' + r.n, { xm });
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
        P.push({ t: 'poly', pts, stroke: '#111827', sw: 0.55 * k });
        P.push({ t: 'tri', fill: '#2563eb', pts: [[r.xm - 1.1 * k, yBus - 0.2 * k], [r.xm + 1.1 * k, yBus - 0.2 * k], [r.xm, yBus + 1.54 * k]] });
      });
      const nS = RACKS[rk.tipo] || 9;
      rackTecnico(P, rk.x, yR, rackW, rackH, rk.tipo, `Rack ${rk.n} · ${nS} saídas · ${rk.reguas.length} régua${rk.reguas.length === 1 ? '' : 's'}`, k);
    }
  }
  if (comSinal) {
    const yBusS = yBase + Math.min(7 * k, hBaixo * 0.13);
    const cH = 4.6 * k, cW = Math.min(30 * k, Math.max(18 * k, area.w / Math.max(1, geo.length * 2.2)));
    const yC = yBase + hBaixo * 0.3;
    const ctrls = geo.map(g => {
      const xs = saidas(g, g.pl.dados.portas.map(p => p.caminho));
      if (!xs.length) return { g, x: g.xm, xb: g.xm };
      xs.forEach(xx => P.push({ t: 'line', x1: xx, y1: yBase + 0.4, x2: xx, y2: yBusS, stroke: '#111827', sw: 0.25 * k }));
      const a = Math.min(...xs), b = Math.max(...xs);
      if (xs.length > 1) P.push({ t: 'line', x1: a, y1: yBusS, x2: b, y2: yBusS, stroke: '#111827', sw: 0.25 * k });
      return { g, x: g.xm, xb: (a + b) / 2 };
    });
    espalhar(ctrls, cW, xMin, xMax);
    for (const c of ctrls) {
      const it = c.g.it, nome = (CONTROLADORAS[it.ctrl.item] || {}).nome || 'Controladora';
      P.push({ t: 'poly', pts: [[c.xb, yBusS], [c.xb, (yBusS + yC) / 2], [c.x, (yBusS + yC) / 2], [c.x, yC]], stroke: '#111827', sw: 0.3 * k });
      // a controladora: aparelho de 1U preto, com o display e as portas
      P.push({ t: 'rect', x: c.x - cW / 2, y: yC, w: cW, h: cH, fill: '#1f2937', stroke: '#0b0f17', sw: 0.3 * k, r: 0.6 * k });
      P.push({ t: 'rect', x: c.x - cW * 0.44, y: yC + cH * 0.25, w: cW * 0.2, h: cH * 0.5, fill: '#0ea5e9' });
      for (let i = 0; i < 4; i++) P.push({ t: 'rect', x: c.x + cW * 0.14 + i * cW * 0.075, y: yC + cH * 0.32, w: cW * 0.05, h: cH * 0.36, fill: '#93c5fd' });
      P.push({ t: 'text', x: c.x - cW * 0.04, y: yC + cH * 0.66, txt: nome, size: 4.6 * k, bold: true, align: 'center', color: '#ffffff' });
      P.push({ t: 'text', x: c.x + 1.2 * k, y: yC + cH + 3.2 * k, txt: `${it.ctrl.qtd > 1 ? it.ctrl.qtd + ' × ' + nome + ' · ' : ''}${it.portas} porta${it.portas === 1 ? '' : 's'}${it.cfg.backup ? ' + backup' : ''}`, size: 5.5 * k, color: '#111827' });
    }
    const proc = ps.cfg.processadora || (geo.length > 1 ? 'Processadora' : '');
    if (proc) {
      const pW = 34 * k, pH = 13 * k, yP = yBase + hBaixo * 0.62;
      const xP = Math.min(xMax - pW / 2, Math.max(xMin + pW / 2, (geo[0].x0 + geo[geo.length - 1].x0 + geo[geo.length - 1].w) / 2));
      const yJ = (yC + cH + 5 * k + yP) / 2;
      for (const c of ctrls) P.push({ t: 'poly', pts: [[c.x, yC + cH], [c.x, yJ], [xP, yJ]], stroke: '#111827', sw: 0.3 * k });
      P.push({ t: 'line', x1: xP, y1: yJ, x2: xP, y2: yP, stroke: '#111827', sw: 0.3 * k });
      // a processadora: aparelho maior, com a tela azul e os botões
      P.push({ t: 'rect', x: xP - pW / 2, y: yP, w: pW, h: pH, fill: '#374151', stroke: '#111827', sw: 0.35 * k, r: 1 * k });
      P.push({ t: 'rect', x: xP - pW * 0.32, y: yP + pH * 0.22, w: pW * 0.34, h: pH * 0.5, fill: '#60a5fa' });
      for (let i = 0; i < 3; i++) P.push({ t: 'rect', x: xP + pW * 0.1 + i * pW * 0.09, y: yP + pH * 0.3, w: pW * 0.06, h: pH * 0.12, fill: '#d1d5db' });
      P.push({ t: 'rect', x: xP - pW / 2 + 1.2 * k, y: yP + pH, w: 1.6 * k, h: 1.2 * k, fill: '#111827' });
      P.push({ t: 'rect', x: xP + pW / 2 - 2.8 * k, y: yP + pH, w: 1.6 * k, h: 1.2 * k, fill: '#111827' });
      P.push({ t: 'text', x: xP, y: yP + pH + 4.6 * k, txt: proc, size: 6.5 * k, bold: true, align: 'center', color: '#111827' });
    }
  }
  if (modo === 'ambos') {
    const nomes = [...new Set(geo.map(g => (g.it.ctrl.qtd > 1 ? g.it.ctrl.qtd + ' × ' : '') + ((CONTROLADORAS[g.it.ctrl.item] || {}).nome || '')).filter(Boolean))];
    const txt = 'Processamento: ' + ([ps.cfg.processadora].concat(nomes).filter(Boolean).join(' + ') || '—');
    const w = larguraTexto(txt, 6.5 * k, false) + 6 * k;
    P.push({ t: 'rect', x: area.x, y: area.y + area.h - 7 * k, w, h: 6 * k, fill: '#ffffff', stroke: '#111827', sw: 0.25 * k });
    P.push({ t: 'text', x: area.x + 3 * k, y: area.y + area.h - 2.9 * k, txt, size: 6.5 * k, color: '#111827' });
  }
  return s;
}

function juntarNomes(nomes) {
  const ns = nomes.filter(Boolean);
  if (ns.length <= 1) return ns[0] || '';
  const pal = ns.map(n => n.split(' '));
  let k = 0;
  while (pal.every(p => p.length > k + 1 && p[k] === pal[0][k])) k++;
  const pre = k ? pal[0].slice(0, k).join(' ') + ' ' : '';
  const fins = ns.map((n, i) => (k ? pal[i].slice(k).join(' ') : n));
  return pre + fins.slice(0, -1).join(', ') + ' e ' + fins[fins.length - 1];
}
/* "2 Painéis de Led (Lateral esq. e dir.) – 4,5 x 2,5 m + Painel de Led (Central) – 18 x 3,5 m" */
export function descricaoDasTelas(ps, titulo) {
  const norm = x => String(x || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  const util = n => n && norm(n) !== norm(titulo) && !/^(painel|tela|screen)( de led)?( \d+)?$/i.test(String(n).trim());
  const grupos = [];
  for (const it of ps.telas.filter(t => t.pl)) {
    const med = `${n2t(it.pl.largura_m)} x ${n2t(it.pl.altura_m)} m`;
    const g = grupos.find(x => x.med === med);
    if (g) g.nomes.push(it.nome); else grupos.push({ med, nomes: [it.nome] });
  }
  return grupos.map(g => {
    const nomes = juntarNomes(g.nomes.filter(util));
    return `${g.nomes.length > 1 ? g.nomes.length + ' Painéis de Led' : 'Painel de Led'}${nomes ? ' (' + nomes + ')' : ''} – ${g.med}`;
  }).join(' + ');
}

/* ---------------- a prancha do Projetech Calculator (igual) ---------------- */
/* a moldura e as medidas fixas da folha — as do Calculator (U: o A4 vira a unidade) */
function quadro(F) {
  const PW = F.w, PH = F.h, MG = 8, U = Math.max(1, PH / 210);
  const blockH = 23 * U, blockTop = PH - MG - blockH;
  return { PW, PH, MG, U, blockH, blockTop, drawTop: MG + 8 * U, drawBottom: blockTop - 4 * U };
}

/* o carimbo do Calculator: logo | três colunas de dados | identificação | O.S. e folha */
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
  let lh = cbH - 5 * U, lw2 = lh * (razaoLogo || 3.5);
  if (lw2 > wLogo - 4 * U) { lw2 = wLogo - 4 * U; lh = lw2 / (razaoLogo || 3.5); }
  P.push({ t: 'img', src: 'logo', x: xLogo + (wLogo - lw2) / 2, y: cbY + (cbH - lh) / 2, w: lw2, h: lh });
  for (let i = 0; i < 4; i++) {
    const yb = cbY + i * rh + rh / 2 + 0.9 * U;
    par(esq[i][0], esq[i][1], xIdent + 1.8 * U, yb, wE - 2.6 * U);
    par(dir[i][0], dir[i][1], xMeio + 1.8 * U, yb, wDi - 2.6 * U);
  }
  par(com[0], com[1], xFolha + 1.8 * U, cbY + rh / 2 + 0.9 * U, wF - 2.6 * U);
  const nf = numero || 1, tf = total || 1, cxF = xFolha + wF / 2, texto = tf > 1 ? `${nf}/${tf}` : String(nf);
  const yRot = cbY + rh + 3.6 * U;
  P.push({ t: 'text', x: cxF, y: yRot, txt: 'Folha:', size: FS, color: '#696969', align: 'center' });
  let fsF = (tf > 1 ? 17 : 21) * U;
  while (fsF > 9 * U && larguraTexto(texto, fsF, true) > wF - 4 * U) fsF -= 1;
  P.push({ t: 'text', x: cxF, y: (cbY + cbH + yRot + fsF * 0.254) / 2, txt: texto, size: fsF, bold: true, color: '#0a0a0a', align: 'center' });
}

/* uma folha do projeto técnico: modo 'ac' | 'sinal' | 'ambos'; formato 'a3' | '169' | 'a4' */
export function folhaTecnica(ps, modo, meta, { numero, total, razaoLogo, formato } = {}) {
  const F = FORMATOS[formato] || FORMATOS.a3;
  const Q = quadro(F), { U, MG, PW } = Q;
  const P = [];
  P.push({ t: 'rect', x: MG, y: MG, w: PW - 2 * MG, h: F.h - 2 * MG, stroke: '#1e1e1e', sw: 0.4 * U });
  const its = ps.telas.filter(it => it.pl);
  const sala = meta.sala || (its.length === 1 ? its[0].nome : '') || '';
  // o que é a folha, como as legendas das páginas de vista do Calculator
  P.push({ t: 'text', x: MG + 4 * U, y: MG + 5.6 * U, txt: TIPOS_TECNICO[modo] + (sala ? ' · ' + sala : ''), size: 9 * U, bold: true, color: '#464646' });
  const sub = descricaoDasTelas(ps, sala);
  if (sub) P.push({ t: 'text', x: MG + 4 * U, y: MG + 9.8 * U, txt: corta(sub, PW - 2 * MG - 8 * U, 7 * U), size: 7 * U, color: '#787878' });
  const area = { x: MG + 6 * U, y: MG + 13 * U, w: PW - 2 * MG - 12 * U, h: Q.drawBottom - (MG + 13 * U) };
  const esc = salaTecnica(P, ps, area, modo, U);
  const sem = ps.telas.filter(it => !it.pl).map(it => it.nome || 'tela');
  if (sem.length) P.push({ t: 'text', x: area.x, y: Q.drawBottom - 1 * U, txt: `Sem desenho (informadas em m² ou nº de gabinetes): ${sem.join(', ')}`, size: 6.5 * U, color: '#92400e' });

  // os dados do carimbo
  const g0 = its[0];
  const tot = ps.telas.reduce((a, it) => ({ gab: a.gab + it.g.gabinetes, cases: a.cases + it.g.cases, kg: a.kg + it.g.peso_kg, med: a.med + it.g.potencia_med_w, max: a.max + it.g.potencia_max_w }), { gab: 0, cases: 0, kg: 0, med: 0, max: 0 });
  const pxW = its.reduce((a, it) => a + it.pl.colunas * it.pl.px_l, 0), pxH = Math.max(0, ...its.map(it => it.pl.linhas * it.pl.px_a));
  const modelos = [...new Set(ps.telas.map(it => it.painel.modelo).filter(Boolean))];
  const pitch = g0 && g0.pl.px_l ? (g0.pl.largura_m / g0.pl.colunas) * 1000 / g0.pl.px_l : 0;
  const dimensao = its.length === 1 ? `${fmtNum(g0.pl.largura_m, 2)} × ${fmtNum(g0.pl.altura_m, 2)} m` : its.length ? `${its.length} telas` : '—';
  const escala = esc > 0 ? '1:' + fmtNum(Math.round(1000 / esc)) : '—';
  const kw = w => fmtNum(w / 1000, 2) + ' kW';
  const fisico = [['Gabinetes', fmtNum(tot.gab) + ' un'], ['Cases', fmtNum(tot.cases) + ' un'], ['Peso total', fmtNum(tot.kg, 1) + ' kg'], ['Consumo médio', kw(tot.med)], ['Consumo máximo', kw(tot.max)]];
  const ctrls = Object.entries(ps.controladoras).map(([c, q]) => q + ' × ' + CONTROLADORAS[c].nome).join(' + ');
  const cfg0 = g0 ? g0.cfg : PROJETO_PADRAO;
  const racksTxt = ps.racks.length ? ps.racks.length + ' × ' + (RACKS[ps.racks[0].tipo] || 9) + ' saídas' : '—';
  const sinal = [['Resolução', `${fmtNum(pxW)} × ${fmtNum(pxH)} px`], ['Pixel pitch', pitch ? fmtNum(pitch, 2) + ' mm' : '—'], ['Portas', fmtNum(ps.portas)], ['Dimensão', dimensao], ['Escala', escala]];
  const grupos = modo === 'ac'
    ? [fisico, [['Circuitos', fmtNum(ps.circuitos)], ['Réguas', fmtNum(ps.reguas)], ['Racks', racksTxt], ['Dimensão', dimensao], ['Escala', escala]],
      [['Modelo', modelos.join(' + ') || '—'], ['Limite por circuito', fmtNum(cfg0.kw_circuito, 1) + ' kW'], ['Limite por régua', fmtNum(cfg0.kw_regua, 1) + ' kW'], ['Réguas por rack', String(cfg0.reguas_rack)], ['Processadora', ps.cfg.processadora || '—']]]
    : modo === 'sinal'
      ? [fisico, sinal, [['Modelo', modelos.join(' + ') || '—'], ['Controladora', ctrls || '—'], ['Processadora', ps.cfg.processadora || '—'], ['Limite por porta', g0 ? fmtNum(g0.pl.dados.px_porta) + ' px' : '—'], ['Cabo de dados', cfg0.backup ? '2 por porta' : '1 por porta']]]
      : [fisico, sinal, [['Modelo', modelos.join(' + ') || '—'], ['Controladora', ctrls || '—'], ['Circuitos', fmtNum(ps.circuitos)], ['Réguas', fmtNum(ps.reguas)], ['Racks', racksTxt]]];
  const tag = ((modelos[0] || '').match(/P\d+(?:[.,]\d+)?/i) || [''])[0].toUpperCase().replace(',', '.');
  carimbo(P, Q, {
    grupos,
    esq: [['Projeto', meta.projeto || 'Painel de LED ' + tag], ['Local', meta.local], ['Ambiente/Sala', sala], ['Responsável Técnico(a)', meta.responsavel]],
    dir: [['Data de montagem', dataCurta(meta.montagem)], ['Data de emissão', dataCurta(meta.emissao)], ['Cliente', meta.cliente], ['Agência', meta.agencia]],
    com: ['Nº O.S', meta.os], numero, total, razaoLogo
  });
  return { tipo: modo, prims: P, formato: F, escala: esc };
}

/* As folhas do projeto técnico de uma sala: AC e Sinal (ou uma só, "AC e Sinal", na sala pequena) */
export function folhasTecnicas(ps, meta, { inicio, total, razaoLogo, folhas, formato } = {}) {
  const desenhaveis = ps.telas.filter(it => it.pl);
  if (!desenhaveis.length) return [];
  const f = folhas || ps.cfg.folhas;
  const modos = f === 'juntas' ? ['ambos'] : f === 'separadas' ? ['ac', 'sinal'] : (desenhaveis.length === 1 && ps.reguas <= 1 ? ['ambos'] : ['ac', 'sinal']);
  const n0 = inicio || 0;
  return modos.map((m, i) => folhaTecnica(ps, m, meta, { numero: n0 + i + 1, total: total || n0 + modos.length, razaoLogo, formato: formato || ps.cfg.folha }));
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

/* imagens: { logo: {data, w, h} } (dataURL PNG) */
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
