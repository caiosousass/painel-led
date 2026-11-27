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
  'taurus-tb1': { nome: 'Taurus TB1', portas: 1, px: 650000 },
  // extensores de fibra da série H: perto da tela, recebem a fibra da processadora e soltam as portas de rede
  'cvt10': { nome: 'CVT10', portas: 10, px: 6500000, fibra: true },
  'cvt4k-s': { nome: 'CVT4K-S', portas: 16, px: 8847360, fibra: true }
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

/* a chave de um circuito na sala: "<id da tela>:<número do circuito>" */
export const chaveCircuito = (it, n) => String((it.tela && it.tela.id) || it.nome || "tela") + ":" + n;

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
  // ---- energia da sala: réguas (uma régua pode pegar circuitos de mais de uma tela) e racks ----
  // sc.energia (do editor) = { reguas: [{ id, circuitos: ['<tela>:<n>', …], rack: '<id do rack>' }], racks: [{ id, tipo }] }
  // O que o editor não diz (circuito sem régua, régua sem rack) o sistema completa sozinho.
  const t0 = out[0];
  const tipo = RACKS[sc.rack] ? sc.rack : t0 && RACKS[t0.cfg.rack] ? t0.cfg.rack : 'rack-9';
  const porRack = Math.max(1, Math.round(num(sc.reguas_rack) || (t0 ? num(t0.cfg.reguas_rack) : 0) || 4));
  const circs = new Map();
  out.forEach((it, ti) => { if (it.pl) for (const c of it.pl.energia.circuitos) circs.set(chaveCircuito(it, c.n), { ti, n: c.n, w: c.w, gabinetes: c.gabinetes }); });
  const man = sc.energia && Array.isArray(sc.energia.reguas) ? sc.energia : null;
  const reguasSala = [], usados = new Set();
  if (man) for (const r of man.reguas) {
    const cs = (Array.isArray(r.circuitos) ? r.circuitos : []).filter(k => circs.has(k) && !usados.has(k));
    cs.forEach(k => usados.add(k));
    reguasSala.push({ id: String(r.id || 'r' + (reguasSala.length + 1)), circuitos: cs, rackId: r.rack || null, manual: true });
  }
  out.forEach((it, ti) => {
    if (!it.pl) {   // sem desenho: as réguas estimadas pela potência
      for (let k = 0; k < it.reguas; k++) reguasSala.push({ id: `est-${ti}-${k + 1}`, circuitos: [], tela: ti, estimada: true });
      return;
    }
    if (!man) {     // automático: as réguas que a própria tela montou
      for (const r of it.pl.energia.reguas) reguasSala.push({ id: `auto-${ti}-${r.n}`, circuitos: r.circuitos.map(n => chaveCircuito(it, n)), auto: true });
      return;
    }
    // com o editor: os circuitos que ficaram sem régua vão para réguas novas (até o limite da régua)
    const sobra = it.pl.energia.circuitos.filter(c => !usados.has(chaveCircuito(it, c.n)));
    if (!sobra.length) return;
    const limR = Math.max(0.1, num(it.cfg.kw_regua) || 7.5) * 1000, maior = Math.max(...sobra.map(c => c.w));
    const por = maior ? Math.max(1, Math.floor(limR / maior)) : sobra.length;
    let a = 0;
    for (const q of dividir(sobra.length, Math.ceil(sobra.length / por))) {
      reguasSala.push({ id: `sobra-${ti}-${a}`, circuitos: sobra.slice(a, a + q).map(c => chaveCircuito(it, c.n)), auto: true });
      a += q;
    }
  });
  // a régua conta para a tela do 1º circuito dela (é assim que a lista soma as réguas); vazia não conta
  const vivas = reguasSala.filter(r => r.estimada || r.circuitos.length);
  vivas.forEach((r, i) => {
    r.n = i + 1;
    if (!r.estimada) r.tela = circs.get(r.circuitos[0]).ti;
    r.refs = r.circuitos.map(k => ({ ti: circs.get(k).ti, n: circs.get(k).n }));
    r.w = r.circuitos.reduce((s, k) => s + circs.get(k).w, 0);
    r.gabinetes = r.circuitos.reduce((s, k) => s + circs.get(k).gabinetes, 0);
  });
  const locais = new Map();
  for (const r of vivas) { const k = (locais.get(r.tela) || 0) + 1; locais.set(r.tela, k); r.local = k; }
  out.forEach((it, ti) => { it.reguas = locais.get(ti) || 0; });
  const ref = r => ({ tela: r.tela, n: r.local, rg: r.n, id: r.id });

  // racks: os que o editor fixou e, para o resto, a divisão automática (sala inteira ou por tela)
  const racks = [];
  const fixos = man && Array.isArray(man.racks) ? man.racks.filter(k => k && k.id) : [];
  for (const k of fixos) {
    const rs = vivas.filter(r => r.rackId === k.id);
    racks.push({ id: String(k.id), tipo: RACKS[k.tipo] ? k.tipo : tipo, reguas: rs.map(ref), manual: true });
  }
  const livres = vivas.filter(r => !fixos.some(k => k.id === r.rackId));
  if (sc.racks === 'tela') {
    out.forEach((it, ti) => {
      const rs = livres.filter(r => r.tela === ti);
      const pr = Math.max(1, Math.round(num(it.cfg.reguas_rack) || 4)), tp = RACKS[it.cfg.rack] ? it.cfg.rack : 'rack-9';
      let a = 0;
      if (rs.length) for (const q of dividir(rs.length, Math.ceil(rs.length / pr))) {
        racks.push({ id: `auto-k${racks.length + 1}`, tipo: tp, reguas: rs.slice(a, a + q).map(ref), auto: true });
        a += q;
      }
    });
  } else if (livres.length) {
    let a = 0;
    for (const q of dividir(livres.length, Math.ceil(livres.length / porRack))) {
      racks.push({ id: `auto-k${racks.length + 1}`, tipo, reguas: livres.slice(a, a + q).map(ref), auto: true });
      a += q;
    }
  }
  racks.forEach((k, i) => {
    k.n = i + 1;
    k.w = k.reguas.reduce((s, q) => s + vivas[q.rg - 1].w, 0);
    k.reguas.forEach(q => { vivas[q.rg - 1].rack = k.n; });
  });
  // ---- processamento: cada porta numa saída de controladora; as controladoras vão para a processadora ----
  // sc.processamento (do editor) = { ctrls: [{ id, tipo }], ligacoes: { '<tela>:<porta>': { ctrl: '<id>', saida: 1… } } }
  // Porta sem ligação vai para as controladoras automáticas da tela dela (enche cada uma até as saídas
  // ou os pixels dela acabarem: 12 portas de 592 mil px → 3 por MCTRL660 → 4 controladoras).
  const portasSala = [], porPorta = new Map();
  out.forEach((it, ti) => {
    if (it.pl) for (const p of it.pl.dados.portas) portasSala.push({ chave: chaveCircuito(it, p.n), ti, n: p.n, px: p.pixels });
    else for (let k = 0; k < it.portas; k++) portasSala.push({ chave: `est-${ti}-${k + 1}`, ti, n: k + 1, px: it.portas ? it.g.pixels / it.portas : 0, estimada: true });
  });
  portasSala.forEach(p => porPorta.set(p.chave, p));
  const proc = sc.processamento && Array.isArray(sc.processamento.ctrls) ? sc.processamento : null;
  const ctrls = [], ligadas = new Set();
  if (proc) {
    for (const c of proc.ctrls) if (c && c.id) ctrls.push({ id: String(c.id), tipo: CONTROLADORAS[c.tipo] ? c.tipo : 'send-660', saidas: [], manual: true });
    for (const [chave, l] of Object.entries(proc.ligacoes || {})) {
      const p = porPorta.get(chave), c = l && ctrls.find(x => x.id === l.ctrl);
      if (!p || !c || ligadas.has(chave)) continue;
      const cap = CONTROLADORAS[c.tipo].portas;
      let k = Math.round(num(l.saida)) - 1;
      if (!(k >= 0 && k < cap) || c.saidas[k]) { k = -1; for (let j = 0; j < cap; j++) if (!c.saidas[j]) { k = j; break; } }
      if (k < 0) continue;                       // controladora cheia: a porta vai para a automática
      c.saidas[k] = p; ligadas.add(chave);
    }
  }
  out.forEach((it, ti) => {
    const resto = portasSala.filter(p => p.ti === ti && !ligadas.has(p.chave));
    const tipoC = it.cfg.controladora === 'nenhuma' ? null : CONTROLADORAS[it.cfg.controladora] ? it.cfg.controladora : 'send-660';
    if (!resto.length || !tipoC) return;
    const C = CONTROLADORAS[tipoC];
    let cur = null;
    for (const p of resto) {
      if (!cur || cur.saidas.length >= C.portas || (cur.saidas.length && cur.px + p.px > C.px)) {
        cur = { id: `auto-c-${ti}-${ctrls.length + 1}`, tipo: tipoC, saidas: [], px: 0, auto: true };
        ctrls.push(cur);
      }
      cur.saidas.push(p); cur.px += p.px;
    }
  });
  ctrls.forEach((c, i) => {
    c.n = i + 1;
    const ps_ = c.saidas.filter(Boolean);
    c.px = ps_.reduce((s, p) => s + p.px, 0);
    c.usadas = ps_.length;
    c.tela = ps_.length ? ps_[0].ti : (out.length ? 0 : null);   // a lista conta a controladora na tela da 1ª porta dela
  });
  // por tela (é assim que a lista soma as controladoras): quantas de cada tipo
  out.forEach((it, ti) => {
    const mine = ctrls.filter(c => c.tela === ti), por = {};
    mine.forEach(c => { por[c.tipo] = (por[c.tipo] || 0) + 1; });
    it.ctrls = por;
    const tipos = Object.keys(por);
    it.ctrl = { item: tipos.length ? tipos[0] : null, qtd: mine.length };
  });
  const ctrl = {};
  for (const c of ctrls) ctrl[c.tipo] = (ctrl[c.tipo] || 0) + 1;
  const soma = k => out.reduce((s, it) => s + it[k], 0);
  return {
    cfg: sc, telas: out, racks, reguasSala: vivas, controladoras: ctrl, energia_manual: !!man,
    processamento: { ctrls, manual: !!proc, portas: portasSala },
    portas: soma('portas'), circuitos: soma('circuitos'), reguas: vivas.length,
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

// bolinha com texto no meio (o número do cabo), do tamanho que cabe nela
function bolinha(P, x, y, r, fill, stroke, txt) {
  P.push({ t: 'circle', x, y, r, fill, stroke, sw: 0.15 });
  if (!txt) return;
  const mm = r * (txt.length >= 3 ? 0.88 : txt.length === 2 ? 1.08 : 1.3);
  P.push({ t: 'text', x, y: y + mm * 0.36, txt, size: mm / MM_PT, bold: true, align: 'center', color: '#ffffff' });
}

function gradeTecnica(P, g, modo, ondeLiga) {
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
  // Com a etiqueta Novastar, as letras ficam em cima à esquerda do gabinete e o cabo (linha, setas e
  // bolinhas) corre no canto de baixo à direita: nada passa por cima das letras. Gabinete pequeno demais
  // na folha (sem etiqueta) e AC: o cabo passa pelo meio.
  const pt = m * 0.1 / MM_PT, etiqueta = sinal && pt >= 1.6;
  const cx = etiqueta ? c => g.x0 + (c + 1) * cw - m * 0.18 : c => g.x0 + (c + 0.5) * cw;
  const cy = etiqueta ? r => g.y0 + (r + 1) * ch - m * 0.18 : r => g.y0 + (r + 0.5) * ch;
  g.cx = cx;   // a descida até a controladora sai do mesmo ponto
  if (etiqueta) {
    // C = qual controladora da sala (MCTRL660 1, 2…) e P = a saída dela onde entra o cabo desta porta;
    // sem controladora (Nenhuma), C-1 e a ordem do cabo
    for (const p of pl.dados.portas) {
      const lg = (ondeLiga && ondeLiga.get(g.ti + ':' + p.n)) || { c: 1, p: p.n };
      p.caminho.forEach(([c, r], k) => {
        ['C-' + lg.c, 'P-' + lg.p, 'RV-' + (k + 1), 'A-0°', 'WH-' + pl.px_l + 'x' + pl.px_a]
          .forEach((t, j) => P.push({ t: 'text', x: g.x0 + c * cw + m * 0.06, y: g.y0 + r * ch + m * (0.14 + j * 0.12), txt: t, size: pt, color: '#1f2937' }));
      });
    }
  }
  const tr = Math.max(0.4, m * 0.11), azul = '#1d4ed8';
  for (const gp of grupos) {
    const pts = gp.caminho.map(([c, r]) => [cx(c), cy(r)]);
    P.push({ t: 'poly', pts, stroke: azul, sw: Math.max(0.12, m * 0.035) });
    for (let k = 1; k < pts.length; k++) {
      const [ax, ay] = pts[k - 1], [bx, by] = pts[k], mx = (ax + bx) / 2, my = (ay + by) / 2, ang = Math.atan2(by - ay, bx - ax);
      P.push({ t: 'tri', fill: azul, pts: [[mx + Math.cos(ang) * tr, my + Math.sin(ang) * tr], [mx + Math.cos(ang + 2.5) * tr, my + Math.sin(ang + 2.5) * tr], [mx + Math.cos(ang - 2.5) * tr, my + Math.sin(ang - 2.5) * tr]] });
    }
    // bolinhas com a ordem do cabo: verde = onde o cabo entra (1, 2…); vermelha = fim da corrente, onde entra
    // o cabo da redundância (1B, 2B…) quando ela está ligada. No AC, a verde leva o número do circuito.
    const rr = Math.max(0.55, m * 0.13);
    const ini = String(gp.n), fim = sinal && g.it.cfg && g.it.cfg.backup ? gp.n + 'B' : '';
    bolinha(P, pts[0][0], pts[0][1], rr, '#16a34a', '#14532d', ini);
    bolinha(P, pts[pts.length - 1][0], pts[pts.length - 1][1], rr, '#dc2626', '#7f1d1d', fim);
  }
  P.push({ t: 'rect', x: g.x0, y: g.y0, w: g.w, h: g.h, stroke: '#64748b', sw: 0.2 });
}

/* O rack de energia no padrão da Projetech: caixa escura, painel cinza arredondado e, em cada saída, a tomada
 * Steck (cinza, com o círculo azul e o encaixe em cima), o disjuntor (branco, alavancas vermelhas) e o LED verde.
 * Devolve onde fica cada tomada, para o cabo da prolonga entrar nela. */
function rackTecnico(P, x, y, w, h, tipo, rotulo, k) {
  const nS = RACKS[tipo] || 9, cols = nS === 12 ? 4 : 3, lins = Math.ceil(nS / cols);
  const tr = w * 0.006, x0 = x - w / 2;
  P.push({ t: 'rect', x: x0, y, w, h, fill: '#3a3838', stroke: '#111111', sw: tr });
  const pad = w * 0.022;
  P.push({ t: 'rect', x: x0 + pad, y: y + pad, w: w - 2 * pad, h: h - 2 * pad, fill: '#767171', stroke: '#111111', sw: tr, r: h * 0.12 });
  const gx = x0 + w * 0.08, gw = w * 0.86, gy = y + h * 0.08, gh = h * 0.84;
  const cw = gw / cols, ch = gh / lins, s = Math.min(cw * 0.5, ch * 0.68);
  const socks = [];
  for (let i = 0; i < nS; i++) {
    const col = i % cols, row = Math.floor(i / cols);
    const sx = gx + col * cw + cw * 0.3, sy = gy + row * ch + ch * 0.5;
    // a tomada
    P.push({ t: 'rect', x: sx - s / 2, y: sy - s / 2, w: s, h: s, fill: '#d0cece', stroke: '#111111', sw: s * 0.05, r: s * 0.16 });
    P.push({ t: 'circle', x: sx, y: sy + s * 0.04, r: s * 0.37, fill: '#0070c0' });
    P.push({ t: 'rect', x: sx - s * 0.13, y: sy - s * 0.43, w: s * 0.26, h: s * 0.2, fill: '#0070c0' });
    // o disjuntor e o LED
    const bx = sx + s * 0.74, bw = s * 0.5, bh = s * 0.66, by = sy - s * 0.16;
    P.push({ t: 'rect', x: bx, y: by, w: bw, h: bh, fill: '#f8f8f8' });
    P.push({ t: 'rect', x: bx + bw * 0.12, y: by + bh * 0.5, w: bw * 0.76, h: bh * 0.32, fill: '#c00000' });
    P.push({ t: 'rect', x: bx + bw * 0.24, y: by + bh * 0.24, w: bw * 0.16, h: bh * 0.3, fill: '#c00000' });
    P.push({ t: 'rect', x: bx + bw * 0.6, y: by + bh * 0.24, w: bw * 0.16, h: bh * 0.3, fill: '#c00000' });
    P.push({ t: 'circle', x: bx + bw / 2, y: by - s * 0.2, r: s * 0.08, fill: '#00b050' });
    socks.push({ x: sx, y: sy, m: s, col, row, cols });
  }
  // os pés
  const pw = w * 0.075, ph = h * 0.14;
  P.push({ t: 'rect', x: x0 + w * 0.035, y: y + h, w: pw, h: ph, fill: '#3a3838', stroke: '#111111', sw: tr, r: pw * 0.2 });
  P.push({ t: 'rect', x: x0 + w - w * 0.035 - pw, y: y + h, w: pw, h: ph, fill: '#3a3838', stroke: '#111111', sw: tr, r: pw * 0.2 });
  P.push({ t: 'text', x, y: y + h + ph + 3.6 * k, txt: rotulo, size: 6.5 * k, align: 'center', color: '#111827' });
  return socks;
}

/* A ponta da prolonga Steck (azul): o corpo quadrado na linha das réguas e a ponta afunilando para baixo,
 * de onde sai o cabo grosso até o rack. Devolve o y da ponta. */
function plugueSteck(P, x, y, pw) {
  P.push({ t: 'rect', x: x - pw / 2, y: y - pw / 2, w: pw, h: pw, fill: '#0070c0' });
  const yA = y + pw / 2, yB = y + pw * 1.12, a = pw / 2, b = pw * 0.27;
  P.push({ t: 'tri', fill: '#0070c0', pts: [[x - a, yA - pw * 0.02], [x + a, yA - pw * 0.02], [x + b, yB], [x - b, yB]] });   // um polígono só (sem emenda)
  return yB;
}

/* Qual tomada do rack cada prolonga pega: quem vem da esquerda entra pela coluna da esquerda (a mais perto
 * na tomada de cima), da direita pela coluna da direita, e quem vem de cima (ou sobrou) desce nas tomadas do
 * meio — sempre na mesma ordem da esquerda para a direita, para os cabos não se cruzarem. */
function tomadasDoRack(rs, socks, xr, w) {
  const esqL = xr - w / 2, dirL = xr + w / 2, cols = socks.length ? socks[0].cols : 3;
  const usadas = new Set(), out = [];
  const coluna = c => socks.filter(s => s.col === c).sort((a, b) => a.row - b.row);
  const lado = (lista, col, nome) => {
    const sobra = [];
    lista.forEach((r, i) => { const s = coluna(col)[i]; if (s) { usadas.add(s); out.push({ r, s, lado: nome }); } else sobra.push(r); });
    return sobra;
  };
  const cima = rs.filter(r => r.xm >= esqL && r.xm <= dirL)
    .concat(lado(rs.filter(r => r.xm < esqL).sort((a, b) => b.xm - a.xm), 0, 'esq'))
    .concat(lado(rs.filter(r => r.xm > dirL).sort((a, b) => a.xm - b.xm), cols - 1, 'dir'));
  const meio = (cols - 1) / 2;
  const livres = socks.filter(s => !usadas.has(s)).sort((a, b) => a.row - b.row || Math.abs(a.col - meio) - Math.abs(b.col - meio));
  const escolhidas = livres.slice(0, cima.length).sort((a, b) => a.x - b.x);
  cima.sort((a, b) => a.xm - b.xm).forEach((r, i) => { if (escolhidas[i]) out.push({ r, s: escolhidas[i], lado: 'cima' }); });
  return out;
}

/* ---------------- os aparelhos Novastar, desenhados pela frente real de cada um ----------------
 * Mesmo traço do rack: chapas escuras, portas claras, nome do modelo na frente. Cada função desenha com o
 * topo em y, centrada em cx, na largura w, e devolve { w, h } do que desenhou. */
const ptMM = mm => mm / MM_PT;
function orelhasRack(P, x0, y, w, h, e, furos) {
  for (const x of [x0, x0 + w - e]) {
    P.push({ t: 'rect', x, y, w: e, h, fill: '#0d0d0d', stroke: '#000000', sw: h * 0.02 });
    for (let i = 0; i < furos; i++) P.push({ t: 'circle', x: x + e / 2, y: y + h * (i + 0.5) / furos, r: Math.min(e * 0.2, h * 0.08), fill: '#6b7280' });
  }
}
function portaRJ45(P, x, y, s) {
  P.push({ t: 'rect', x, y, w: s, h: s * 0.82, fill: '#d1d5db', stroke: '#111111', sw: s * 0.05, r: s * 0.08 });
  P.push({ t: 'rect', x: x + s * 0.18, y: y + s * 0.14, w: s * 0.64, h: s * 0.4, fill: '#1f2937' });
  P.push({ t: 'rect', x: x + s * 0.36, y: y + s * 0.54, w: s * 0.28, h: s * 0.14, fill: '#1f2937' });
}
function portaFibra(P, x, y, s) {
  P.push({ t: 'rect', x, y, w: s, h: s * 0.72, fill: '#a7f3d0', stroke: '#065f46', sw: s * 0.05, r: s * 0.06 });
  P.push({ t: 'rect', x: x + s * 0.16, y: y + s * 0.18, w: s * 0.26, h: s * 0.36, fill: '#064e3b' });
  P.push({ t: 'rect', x: x + s * 0.58, y: y + s * 0.18, w: s * 0.26, h: s * 0.36, fill: '#064e3b' });
}
function etherCON(P, cx, cy, r) {
  P.push({ t: 'circle', x: cx, y: cy, r, fill: '#9ca3af', stroke: '#111111', sw: r * 0.1 });
  P.push({ t: 'circle', x: cx, y: cy, r: r * 0.6, fill: '#111111' });
  P.push({ t: 'rect', x: cx - r * 0.16, y: cy - r * 0.98, w: r * 0.32, h: r * 0.3, fill: '#d1d5db' });
}
// fileira de n portas iguais, alinhada à direita em [xa, xb], centrada na altura yc
function fileira(P, n, xa, xb, yc, sMax, desenha) {
  const s = Math.min(sMax, (xb - xa) / (n * 1.2));
  for (let i = 0; i < n; i++) desenha(xb - (n - i) * s * 1.2 + s * 0.1, yc, s);
  return s;
}

/* MCTRL660 e CVT10: 1U de rack (orelhas, nome, portas de rede na frente; a 660 tem o visor e o botão) */
function aparelho1U(P, cx, y, w, nome, op) {
  const h = w / 6.2, x0 = cx - w / 2, e = h * 0.32;
  P.push({ t: 'rect', x: x0, y, w, h, fill: '#1a1a1a', stroke: '#000000', sw: h * 0.03, r: h * 0.05 });
  orelhasRack(P, x0, y, w, h, e, 1);
  const xi = x0 + e + h * 0.22;
  P.push({ t: 'text', x: xi, y: y + h * 0.36, txt: nome, size: ptMM(h * 0.24), bold: true, color: '#ffffff' });
  let xa = x0 + w * 0.36;
  if (op.visor) {
    P.push({ t: 'rect', x: xi, y: y + h * 0.48, w: w * 0.13, h: h * 0.34, fill: '#0284c7', stroke: '#0c4a6e', sw: h * 0.02 });
    P.push({ t: 'circle', x: xi + w * 0.13 + h * 0.42, y: y + h * 0.62, r: h * 0.2, fill: '#9ca3af', stroke: '#111111', sw: h * 0.02 });
    P.push({ t: 'rect', x: xi + w * 0.13 + h * 0.78, y: y + h * 0.54, w: h * 0.22, h: h * 0.16, fill: '#9ca3af' });
  }
  if (op.fibras) {
    const s = h * 0.42;
    for (let i = 0; i < op.fibras; i++) portaFibra(P, xi + i * s * 1.2, y + h * 0.5, s);
    xa = Math.max(xa, xi + op.fibras * s * 1.2 + h * 0.3);
  }
  fileira(P, op.portas, xa, x0 + w - e - h * 0.2, 0, h * 0.46, (x, _, s) => {
    P.push({ t: 'circle', x: x + s / 2, y: y + h * 0.2, r: s * 0.08, fill: '#22c55e' });
    portaRJ45(P, x, y + h * 0.55 - s * 0.41, s);
  });
  return { w, h };
}

/* CVT4K-S: 2U, faixa verde em cima, 16 etherCON na fileira de cima; embaixo a fibra (4), USB e a energia */
function aparelhoCVT4K(P, cx, y, w) {
  const h = w / 5, x0 = cx - w / 2, e = h * 0.2;
  P.push({ t: 'rect', x: x0, y, w, h, fill: '#141414', stroke: '#000000', sw: h * 0.02, r: h * 0.04 });
  orelhasRack(P, x0, y, w, h, e, 2);
  P.push({ t: 'rect', x: x0 + e, y: y + h * 0.05, w: w - 2 * e, h: h * 0.03, fill: '#22c55e' });
  const xa = x0 + e + h * 0.12, xb = x0 + w - e - h * 0.12, passo = (xb - xa) / 16, r = Math.min(passo * 0.38, h * 0.15);
  for (let i = 0; i < 16; i++) etherCON(P, xa + passo * (i + 0.5), y + h * 0.32, r);
  const yb = y + h * 0.72;
  P.push({ t: 'circle', x: xa + h * 0.16, y: yb, r: h * 0.12, fill: '#9ca3af', stroke: '#111111', sw: h * 0.015 });
  P.push({ t: 'rect', x: xa + h * 0.36, y: yb - h * 0.07, w: h * 0.14, h: h * 0.14, fill: '#d1d5db' });
  const gx = x0 + w * 0.28, gw = w * 0.2;
  P.push({ t: 'rect', x: gx, y: yb - h * 0.17, w: gw, h: h * 0.34, stroke: '#9ca3af', sw: h * 0.012 });
  for (let i = 0; i < 4; i++) portaFibra(P, gx + gw * 0.06 + i * gw * 0.235, yb - h * 0.09, gw * 0.2);
  P.push({ t: 'text', x: x0 + w * 0.52, y: yb + h * 0.06, txt: 'CVT4K-S', size: ptMM(h * 0.15), bold: true, color: '#ffffff' });
  P.push({ t: 'rect', x: x0 + w * 0.73, y: yb - h * 0.12, w: h * 0.36, h: h * 0.24, fill: '#2563eb', stroke: '#111111', sw: h * 0.012, r: h * 0.04 });
  P.push({ t: 'rect', x: x0 + w * 0.73 + h * 0.46, y: yb - h * 0.08, w: h * 0.08, h: h * 0.16, fill: '#6b7280' });
  P.push({ t: 'rect', x: xb - h * 0.3, y: yb - h * 0.15, w: h * 0.3, h: h * 0.3, fill: '#1d4ed8', r: h * 0.04 });
  P.push({ t: 'circle', x: xb - h * 0.15, y: yb, r: h * 0.1, fill: '#dbeafe' });
  return { w, h };
}

/* Taurus TB60 e TB1: caixa compacta de cantos arredondados (não é de rack) */
function aparelhoTaurus(P, cx, y, w, nome, portas) {
  const h = w / (portas > 1 ? 3.6 : 2.6), x0 = cx - w / 2;
  P.push({ t: 'rect', x: x0, y, w, h, fill: '#262626', stroke: '#000000', sw: h * 0.025, r: h * 0.16 });
  P.push({ t: 'text', x: x0 + h * 0.18, y: y + h * 0.34, txt: nome, size: ptMM(h * 0.24), bold: true, color: '#ffffff' });
  P.push({ t: 'circle', x: x0 + h * 0.26, y: y + h * 0.62, r: h * 0.06, fill: '#22c55e' });
  P.push({ t: 'rect', x: x0 + h * 0.42, y: y + h * 0.53, w: h * 0.42, h: h * 0.2, fill: '#d1d5db', stroke: '#111111', sw: h * 0.015 });   // HDMI
  P.push({ t: 'rect', x: x0 + h * 0.92, y: y + h * 0.55, w: h * 0.2, h: h * 0.16, fill: '#d1d5db' });   // USB
  fileira(P, portas, x0 + h * 1.25, x0 + w - h * 0.16, 0, h * 0.42, (x, _, s) => portaRJ45(P, x, y + h * 0.58 - s * 0.41, s));
  return { w, h };
}

export function desenhaControladora(P, tipo, cx, y, w) {
  if (tipo === 'taurus-tb1') return aparelhoTaurus(P, cx, y, w * 0.48, 'TB1', 1);
  if (tipo === 'taurus-tb60') return aparelhoTaurus(P, cx, y, w * 0.72, 'TB60', 4);
  if (tipo === 'cvt4k-s') return aparelhoCVT4K(P, cx, y, w);
  if (tipo === 'cvt10') return aparelho1U(P, cx, y, w, 'CVT10', { portas: 10, fibras: 2 });
  return aparelho1U(P, cx, y, w, (CONTROLADORAS[tipo] || {}).nome || 'MCTRL660', { portas: 4, visor: true });
}

/* Processadoras H (H2, H5, H9, H15): a frente da série H — chapas com as listras na diagonal, a faixa cinza
 * com a tela touch no meio, o selo com o modelo, alças nas laterais. A altura cresce com o modelo. */
export const PROCESSADORAS = {
  H2: { nome: 'H2', alt: 0.27, faixa: [0.12, 0.88] },
  H5: { nome: 'H5', alt: 0.5, faixa: [0.2, 0.6] },
  H9: { nome: 'H9', alt: 0.83, faixa: [0.22, 0.52] },
  H15: { nome: 'H15', alt: 1.25, faixa: [0.2, 0.42] }
};
export function modeloProcessadora(txt) {
  const m = /(^|[^a-z0-9])h\s?-?(15|2|5|9)(?![0-9])/i.exec(String(txt || ''));
  return m ? 'H' + m[2] : null;
}
export function desenhaProcessadoraH(P, mod, cx, y, w) {
  const M = PROCESSADORAS[mod], h = w * M.alt, x0 = cx - w / 2, e = w * 0.045, lw = w * 0.0032;
  const yf0 = y + h * M.faixa[0], yf1 = y + h * M.faixa[1], fh = yf1 - yf0;
  if (mod !== 'H2') for (const x of [x0 - w * 0.03, x0 + w - w * 0.01]) {
    P.push({ t: 'rect', x, y: yf0 + fh * 0.05, w: w * 0.04, h: Math.max(fh * 0.9, h * 0.3), fill: '#2b2b2b', stroke: '#111111', sw: lw * 1.5, r: w * 0.012 });
  }
  P.push({ t: 'rect', x: x0 + e, y, w: w - 2 * e, h, fill: '#3d3d3d', stroke: '#111111', sw: lw * 1.5 });
  const furos = Math.max(1, Math.min(8, Math.round(h / (w * 0.09))));
  for (const x of [x0, x0 + w - e]) {
    P.push({ t: 'rect', x, y, w: e, h, fill: '#2e2e2e', stroke: '#111111', sw: lw * 1.5, r: e * 0.15 });
    for (let i = 0; i < furos; i++) P.push({ t: 'circle', x: x + e / 2, y: y + h * (i + 0.5) / furos, r: e * 0.13, fill: '#e5e7eb' });
  }
  // as listras na diagonal (em cima à esquerda, embaixo no meio)
  const listras = (xIni, yIni, alto) => {
    for (let i = 0; i < 12; i++) {
      const xs = xIni + i * w * 0.012, d = Math.min(alto, x0 + w - e - xs);
      if (d > 0) P.push({ t: 'line', x1: xs, y1: yIni, x2: xs + d, y2: yIni + d, stroke: '#5a5a5a', sw: lw });
    }
  };
  if (yf0 - y > h * 0.06) listras(x0 + e + w * 0.04, y + h * 0.01, yf0 - y - h * 0.02);
  if (y + h - yf1 > h * 0.06) listras(x0 + w * 0.42, yf1 + h * 0.01, y + h - yf1 - h * 0.02);
  // a faixa cinza com o "X" e a tela
  P.push({ t: 'rect', x: x0 + e, y: yf0, w: w - 2 * e, h: fh, fill: '#8a8f98', stroke: '#2b2b2b', sw: lw * 1.5 });
  const sw_ = w * (mod === 'H2' ? 0.2 : 0.3), sx = cx - sw_ / 2, sh = Math.min(fh * 0.86, sw_ * 0.62), sy = yf0 + (fh - sh) / 2, ym = yf0 + fh / 2;
  if (mod !== 'H2') {
    P.push({ t: 'tri', fill: '#6b7079', pts: [[sx - w * 0.12, yf0], [sx - w * 0.07, yf0], [sx - w * 0.01, ym], [sx - w * 0.07, yf1], [sx - w * 0.12, yf1], [sx - w * 0.06, ym]] });
    P.push({ t: 'tri', fill: '#6b7079', pts: [[sx + sw_ + w * 0.12, yf0], [sx + sw_ + w * 0.07, yf0], [sx + sw_ + w * 0.01, ym], [sx + sw_ + w * 0.07, yf1], [sx + sw_ + w * 0.12, yf1], [sx + sw_ + w * 0.06, ym]] });
  }
  P.push({ t: 'rect', x: sx, y: sy, w: sw_, h: sh, fill: '#111111', r: sh * 0.05 });
  const ix = sx + sw_ * 0.05, iy = sy + sh * 0.1, iw = sw_ * 0.9, ih = sh * 0.82;
  P.push({ t: 'rect', x: ix, y: iy, w: iw, h: ih, fill: '#1e1b4b' });
  P.push({ t: 'rect', x: ix + iw * 0.04, y: iy + ih * 0.2, w: iw * 0.27, h: ih * 0.72, fill: '#312e81' });
  P.push({ t: 'rect', x: ix + iw * 0.33, y: iy + ih * 0.2, w: iw * 0.27, h: ih * 0.72, fill: '#312e81' });
  P.push({ t: 'circle', x: ix + iw * 0.175, y: iy + ih * 0.5, r: ih * 0.06, fill: '#ef4444' });
  P.push({ t: 'circle', x: ix + iw * 0.465, y: iy + ih * 0.5, r: ih * 0.06, fill: '#10b981' });
  for (let i = 0; i < 3; i++) P.push({ t: 'rect', x: ix + iw * 0.63, y: iy + ih * (0.2 + i * 0.25), w: iw * 0.33, h: ih * 0.21, fill: '#3730a3' });
  // o selo com o modelo
  const bw = w * 0.11, bh = Math.min(fh * 0.22, bw * 0.4), bx = x0 + e + w * 0.03, by = yf0 + fh * 0.12;
  P.push({ t: 'rect', x: bx, y: by, w: bw, h: bh, stroke: '#ffffff', sw: lw * 1.5, r: bh * 0.45 });
  P.push({ t: 'text', x: bx + bw / 2, y: by + bh * 0.74, txt: M.nome, size: ptMM(bh * 0.72), bold: true, align: 'center', color: '#ffffff' });
  P.push({ t: 'text', x: bx + bw / 2, y: by + bh + bh * 0.55, txt: 'VIDEO WALL SPLICER', size: ptMM(bh * 0.32), align: 'center', color: '#f3f4f6' });
  // pés
  for (const x of [x0 + w * 0.14, x0 + w * 0.86 - w * 0.04]) P.push({ t: 'rect', x, y: y + h, w: w * 0.04, h: w * 0.012, fill: '#111111', r: w * 0.004 });
  return { w, h };
}

/* desenha a sala na área; k = tamanho dos aparelhos e letras (o U da prancha). Devolve a escala (mm por m). */
function salaTecnica(P, ps, area, modo, k) {
  const its = ps.telas.map((it, ti) => ({ it, ti })).filter(o => o.it.pl);
  if (!its.length) return 0;
  const comAC = modo !== 'sinal', comSinal = modo === 'sinal';
  // processadora alta (H9, H15) ganha mais espaço embaixo das telas
  const mProc = comSinal ? modeloProcessadora(ps.cfg.processadora) : null, alta = mProc && PROCESSADORAS[mProc].alt > 0.6 ? 12 * k : 0;
  const hBaixo = Math.min(area.h * (alta ? 0.54 : 0.46), (modo === 'ambos' ? 44 : 58) * k + alta);
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
  // onde cada porta liga: "ti:n" → { c: nº da controladora na sala, p: saída dela }
  const ondeLiga = new Map();
  for (const c of (ps.processamento && ps.processamento.ctrls) || []) c.saidas.forEach((p, k) => { if (p) ondeLiga.set(p.ti + ':' + p.n, { c: c.n, p: k + 1 }); });
  for (const g of geo) {
    gradeTecnica(P, g, modo, ondeLiga);
    if (geo.length > 1) P.push({ t: 'text', x: g.xm, y: g.y0 - 1.6 * k, txt: corta(`${g.it.nome || 'Tela'} · ${n2t(g.pl.largura_m)} x ${n2t(g.pl.altura_m)} m`, Math.max(g.w * 1.2, 24 * k), 6.5 * k, true), size: 6.5 * k, bold: true, align: 'center', color: '#111827' });
  }
  const xMin = area.x, xMax = area.x + area.w;
  if (comAC) {
    // fino: o powercon de cada circuito descendo do painel até a prolonga Steck; grosso: a prolonga até o rack
    const fino = 0.24 * k, grosso = 0.6 * k, pw = 1.9 * k;
    const yBus = yBase + Math.min(8 * k, hBaixo * 0.15);
    const larg = rk => ((RACKS[rk.tipo] || 9) === 12 ? 1.75 : 1.36);   // rack de 12 é mais largo (4 colunas)
    const propMax = Math.max(1.36, ...ps.racks.map(larg));
    const caber = area.w / Math.max(1, ps.racks.length * 1.6);
    const rackH = Math.min(17 * k, hBaixo * 0.36, caber / propMax), rackW = rackH * propMax;
    const yR = yBase + hBaixo * 0.42;
    // as réguas da sala (uma régua pode juntar circuitos de mais de uma tela)
    const reg = new Map(), geoDe = new Map(geo.map(g => [g.ti, g])), repetida = new Map();
    for (const r of ps.reguasSala || []) {
      const xs = [];
      for (const { ti, n } of r.refs || []) {
        const g = geoDe.get(ti), c = g && g.pl.energia.circuitos[n - 1];
        if (!c) continue;
        const col = c.caminho[0][0], cw = g.w / g.pl.colunas, chave = ti + ':' + col, q = repetida.get(chave) || 0;
        repetida.set(chave, q + 1);
        xs.push((g.cx ? g.cx(col) : g.x0 + (col + 0.5) * cw) - q * Math.min(cw * 0.22, 1.6));
      }
      if (!xs.length) continue;
      const xm = (Math.min(...xs) + Math.max(...xs)) / 2;
      xs.forEach(xx => P.push({ t: 'line', x1: xx, y1: yBase + 0.4, x2: xx, y2: yBus, stroke: '#111111', sw: fino }));
      if (xs.length > 1) P.push({ t: 'line', x1: Math.min(...xs), y1: yBus, x2: Math.max(...xs), y2: yBus, stroke: '#111111', sw: fino });
      reg.set(r.n, { xm });
    }
    const racks = ps.racks.map(rk => {
      const rs = rk.reguas.map(q => reg.get(q.rg)).filter(Boolean);
      return Object.assign({}, rk, { rs, x: rs.length ? rs.reduce((a, r) => a + r.xm, 0) / rs.length : (xMin + xMax) / 2 });
    });
    espalhar(racks, rackW, xMin, xMax);
    const yTip = yBus + pw * 1.12;
    for (const rk of racks) {
      const nS = RACKS[rk.tipo] || 9, w = rackH * larg(rk);
      const socks = rackTecnico(P, rk.x, yR, w, rackH, rk.tipo, `Rack ${rk.n} · ${nS} saídas · ${rk.reguas.length} régua${rk.reguas.length === 1 ? '' : 's'}`, k);
      const lig = tomadasDoRack(rk.rs, socks, rk.x, w);
      // quem desce por cima: um nível de passagem para cada um, sem cruzar (o que vai mais longe passa mais alto)
      const dir = lig.filter(l => l.lado === 'cima' && l.s.x > l.r.xm + 0.3).sort((a, b) => a.r.xm - b.r.xm);
      const esq = lig.filter(l => l.lado === 'cima' && l.s.x < l.r.xm - 0.3).sort((a, b) => b.r.xm - a.r.xm);
      const niveis = Math.max(dir.length, esq.length);
      const passo = Math.min(2 * k, (yR - yTip) / (niveis + 2));
      dir.forEach((l, i) => { l.y = yR - passo * (1 + i); });
      esq.forEach((l, i) => { l.y = yR - passo * (1 + i); });
      for (const l of lig) {
        const { r, s: t } = l, m2 = t.m / 2;
        const pts = l.lado === 'esq' ? [[r.xm, yTip], [r.xm, t.y], [t.x - m2, t.y]]
          : l.lado === 'dir' ? [[r.xm, yTip], [r.xm, t.y], [t.x + m2, t.y]]
          : l.y != null ? [[r.xm, yTip], [r.xm, l.y], [t.x, l.y], [t.x, t.y - m2]]
          : [[r.xm, yTip], [r.xm, l.y = (yTip + yR) / 2], [t.x, l.y], [t.x, t.y - m2]];
        P.push({ t: 'poly', pts, stroke: '#111111', sw: grosso });
      }
      // prolonga sem tomada livre (rack cheio): desce até o rack
      for (const r of rk.rs) if (!lig.some(l => l.r === r)) P.push({ t: 'poly', pts: [[r.xm, yTip], [r.xm, yR]], stroke: '#111111', sw: grosso });
      for (const r of rk.rs) plugueSteck(P, r.xm, yBus, pw);
    }
  }
  if (comSinal) {
    const yBusS = yBase + Math.min(7 * k, hBaixo * 0.13);
    const lista = (ps.processamento && ps.processamento.ctrls) || [];
    const cW = Math.min(30 * k, Math.max(18 * k, area.w / Math.max(1, lista.length * 1.6)));
    const yC = yBase + hBaixo * 0.3;
    // cada controladora: as portas ligadas nela descem até um barramento e dele até a controladora
    const geoDe = new Map(geo.map(g => [g.ti, g])), repetida = new Map();
    const ctrls = lista.map(c => {
      const xs = [];
      for (const p of c.saidas) {
        const g = p && geoDe.get(p.ti), pt = g && g.pl.dados.portas[p.n - 1];
        if (!pt) continue;
        const col = pt.caminho[0][0], cw = g.w / g.pl.colunas, chave = p.ti + ':' + col, q = repetida.get(chave) || 0;
        repetida.set(chave, q + 1);
        xs.push((g.cx ? g.cx(col) : g.x0 + (col + 0.5) * cw) - q * Math.min(cw * 0.22, 1.6));
      }
      const g0 = c.tela != null ? geoDe.get(c.tela) : null;
      if (!xs.length) return { c, x: g0 ? g0.xm : (xMin + xMax) / 2, xb: null };
      xs.forEach(xx => P.push({ t: 'line', x1: xx, y1: yBase + 0.4, x2: xx, y2: yBusS, stroke: '#111827', sw: 0.25 * k }));
      const a = Math.min(...xs), b = Math.max(...xs);
      if (xs.length > 1) P.push({ t: 'line', x1: a, y1: yBusS, x2: b, y2: yBusS, stroke: '#111827', sw: 0.25 * k });
      return { c, x: (a + b) / 2, xb: (a + b) / 2 };
    });
    espalhar(ctrls, cW, xMin, xMax);
    let baixoC = yC;   // onde acabam as controladoras e as legendas delas
    for (const cc of ctrls) {
      const c = cc, ct = cc.c, nome = (CONTROLADORAS[ct.tipo] || {}).nome || 'Controladora';
      // legenda: saída da controladora → tela e nº do cabo (a bolinha). Tudo de uma tela, em sequência:
      // "P1–P4: Central cabos 5–8"; misturado: "P1: Lateral 1 · P2: Central 3"
      const nomeT = ti => (ps.telas[ti] && ps.telas[ti].nome) || 'Tela';
      const ligs = ct.saidas.map((p, i) => (p ? { i, p } : null)).filter(Boolean);
      const seguidos = ligs.length > 1 && ligs.every((x, j) => x.p.ti === ligs[0].p.ti && x.i === ligs[0].i + j && x.p.n === ligs[0].p.n + j);
      const ult = ligs[ligs.length - 1];
      const nomes = seguidos ? [`P${ligs[0].i + 1}–P${ult.i + 1}: ${nomeT(ligs[0].p.ti)} cabos ${ligs[0].p.n}–${ult.p.n}`]
        : ligs.map(x => `P${x.i + 1}: ${nomeT(x.p.ti)} ${x.p.n}`);
      if (c.xb != null) P.push({ t: 'poly', pts: [[c.xb, yBusS], [c.xb, (yBusS + yC) / 2], [c.x, (yBusS + yC) / 2], [c.x, yC]], stroke: '#111827', sw: 0.3 * k });
      // o aparelho (MCTRL660, Taurus, CVT…) desenhado pela frente real dele
      const d = desenhaControladora(P, ct.tipo, c.x, yC, cW);
      c.w = d.w; c.h = d.h;
      // as legendas ficam na largura da caixa: o cabo até a processadora sai pelo lado, sem passar por cima delas
      P.push({ t: 'text', x: c.x, y: yC + d.h + 3.2 * k, txt: corta(`${nome} ${ct.n} · ${ct.usadas} porta${ct.usadas === 1 ? '' : 's'}`, cW * 0.95, 5.5 * k), size: 5.5 * k, align: 'center', color: '#111827' });
      if (nomes.length) P.push({ t: 'text', x: c.x, y: yC + d.h + 6 * k, txt: corta(nomes.join(' · '), cW * 0.95, 4.4 * k), size: 4.4 * k, align: 'center', color: '#475569' });
      baixoC = Math.max(baixoC, yC + d.h + (nomes.length ? 7 : 4.4) * k);
    }
    const proc = ps.cfg.processadora || (geo.length > 1 ? 'Processadora' : '');
    if (proc) {
      // processadora H: o desenho da série H, na altura do modelo (encolhe se não couber até o carimbo)
      const mod = modeloProcessadora(proc), alt = mod ? PROCESSADORAS[mod].alt : 13 / 34;
      const yP = baixoC + 5 * k, livre = Math.max(8 * k, yBase + hBaixo - yP - 6 * k);
      const pW = Math.max(12 * k, Math.min(34 * k, livre / alt)), pH = pW * alt;
      const xP = Math.min(xMax - pW / 2, Math.max(xMin + pW / 2, (geo[0].x0 + geo[geo.length - 1].x0 + geo[geo.length - 1].w) / 2));
      const yJ = (baixoC + yP) / 2;
      // cada controladora liga pelo lado (o cabo não passa por cima das legendas); a fibra (CVT) é preta e
      // mais grossa, com "fibra" escrito ao lado
      for (const c of ctrls) {
        const fib = !!(CONTROLADORAS[c.c.tipo] || {}).fibra, ym = yC + c.h / 2, xl = c.x + cW * 0.5 + 0.8 * k;
        P.push({ t: 'poly', pts: [[c.x + c.w / 2, ym], [xl, ym], [xl, yJ], [xP, yJ]], stroke: '#111111', sw: (fib ? 0.75 : 0.3) * k });
        if (fib) P.push({ t: 'text', x: xl + 0.9 * k, y: (ym + yJ) / 2 + 1.2 * k, txt: 'fibra', size: 4.4 * k, bold: true, color: '#111111' });
      }
      P.push({ t: 'line', x1: xP, y1: yJ, x2: xP, y2: yP, stroke: '#111111', sw: (ctrls.some(c => (CONTROLADORAS[c.c.tipo] || {}).fibra) ? 0.75 : 0.3) * k });
      if (mod) {
        desenhaProcessadoraH(P, mod, xP, yP, pW);
        P.push({ t: 'text', x: xP, y: yP + pH + pW * 0.012 + 4.2 * k, txt: 'Processadora ' + mod, size: 6.5 * k, bold: true, align: 'center', color: '#111827' });
      } else {
        // outra processadora: a caixa genérica, com a tela azul e os botões
        P.push({ t: 'rect', x: xP - pW / 2, y: yP, w: pW, h: pH, fill: '#374151', stroke: '#111827', sw: 0.35 * k, r: 1 * k });
        P.push({ t: 'rect', x: xP - pW * 0.32, y: yP + pH * 0.22, w: pW * 0.34, h: pH * 0.5, fill: '#60a5fa' });
        for (let i = 0; i < 3; i++) P.push({ t: 'rect', x: xP + pW * 0.1 + i * pW * 0.09, y: yP + pH * 0.3, w: pW * 0.06, h: pH * 0.12, fill: '#d1d5db' });
        P.push({ t: 'rect', x: xP - pW / 2 + 1.2 * k, y: yP + pH, w: 1.6 * k, h: 1.2 * k, fill: '#111827' });
        P.push({ t: 'rect', x: xP + pW / 2 - 2.8 * k, y: yP + pH, w: 1.6 * k, h: 1.2 * k, fill: '#111827' });
        P.push({ t: 'text', x: xP, y: yP + pH + 4.6 * k, txt: proc, size: 6.5 * k, bold: true, align: 'center', color: '#111827' });
      }
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
      doc.setFillColor(p.fill);
      if (p.pts.length === 3) doc.triangle(p.pts[0][0], p.pts[0][1], p.pts[1][0], p.pts[1][1], p.pts[2][0], p.pts[2][1], 'F');
      else doc.lines(p.pts.slice(1).map((q, i) => [q[0] - p.pts[i][0], q[1] - p.pts[i][1]]), p.pts[0][0], p.pts[0][1], [1, 1], 'F', true);   // polígono
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
