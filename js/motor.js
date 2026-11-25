/* Projetech · Painel de LED — o motor.
 *
 * Toda conta do sistema mora aqui e só aqui: sugestão de acessórios, mesclagem com o que o
 * técnico já editou, separação, retorno, estoque, manutenção e alertas da supervisão.
 *
 * Regras da casa:
 *  - Puro: não toca DOM, storage, rede nem relógio. Recebe dados, devolve dados.
 *    (por isso roda no Node: `node --test` na pasta led/)
 *  - Não escreve frase para gente. Devolve números e motivos estruturados; a tela redige.
 *  - Datas sempre 'YYYY-MM-DD' (string). Nada de new Date('2026-09-12') — em UTC-3 vira dia 11.
 */

const EPS = 1e-9;

/* ============================================================
 * Datas puras
 * ============================================================ */

export const D = {
  deObj(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  },
  // soma dias tratando a data como meio-dia local — imune a horário de verão
  mais(iso, n) {
    if (!iso) return iso;
    const p = iso.split('-');
    const d = new Date(+p[0], +p[1] - 1, +p[2], 12, 0, 0);
    d.setDate(d.getDate() + (n || 0));
    return D.deObj(d);
  },
  dif(a, b) {
    const pa = a.split('-'), pb = b.split('-');
    return Math.round((Date.UTC(+pb[0], +pb[1] - 1, +pb[2]) - Date.UTC(+pa[0], +pa[1] - 1, +pa[2])) / 86400000);
  },
  cruza(i1, f1, i2, f2) { return i1 <= f2 && i2 <= f1; },
  dias(ini, fim) {
    const out = [];
    if (!ini || !fim || fim < ini) return out;
    for (let d = ini; d <= fim && out.length < 400; d = D.mais(d, 1)) out.push(d);
    return out;
  },
  valida(iso) { return typeof iso === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(iso); },
  // 0 = domingo … 6 = sábado (calculado da própria data, sem relógio)
  diaSemana(iso) { const p = iso.split('-'); return new Date(+p[0], +p[1] - 1, +p[2], 12).getDay(); },
  // segunda-feira da semana (semana de segunda a domingo)
  inicioSemana(iso) { return D.mais(iso, -((D.diaSemana(iso) + 6) % 7)); }
};

/* ============================================================
 * Números
 * ============================================================ */

function num(v) {
  if (v == null || v === '') return 0;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

export function arredonda(v, modo) {
  if (modo === 'baixo') return Math.floor(v + EPS);
  if (modo === 'proximo') return Math.round(v);
  return Math.ceil(v - EPS); // 'cima' é o padrão: não existe "79,2 cabos"
}

/* Quantidade que uma regra gera a partir do valor da base.
 * qtd = arredonda(base × fator × (1 + reserva) + adicional) → múltiplo → mínimo/máximo
 * Mínimo só vale quando a regra dispara (base > 0): tela sem mão francesa não ganha peso.
 */
export function quantidadeDaRegra(regra, valorBase) {
  const base = num(valorBase);
  if (!(base > 0)) return { qtd: 0, bruto: 0 };
  const fator = regra.fator == null || regra.fator === '' ? 1 : num(regra.fator);
  const bruto = base * fator * (1 + num(regra.reserva)) + num(regra.adicional);
  let q = arredonda(bruto, regra.arred);
  const mult = num(regra.multiplo);
  if (mult > 1) q = Math.ceil(q / mult - EPS) * mult;
  if (num(regra.minimo) > 0 && q < num(regra.minimo)) q = num(regra.minimo);
  if (num(regra.maximo) > 0 && q > num(regra.maximo)) q = num(regra.maximo);
  if (q < 0) q = 0;
  return { qtd: q, bruto };
}

/* ============================================================
 * Geometria da tela (âncora) → bases
 * ============================================================ */

/* Mão francesa vem em peças de 1,92 / 1,44 / 0,96 m — 4, 3 e 2 "meios" (0,48 m).
 * Cada apoio empilha peças até cobrir a altura do painel: 3 m = 1,92 + 0,96; 3,5 m = 1,92 + 1,44;
 * 4,5 m = 1,92 + 1,44 + 0,96. É exatamente o que aparece nas listas conferidas.
 */
/* ============================================================
 * Estrutura de apoio: mão francesa e pesos — a regra da equipe, a MESMA do Projetech Calculator
 * (regraEstrutura / estruturaDaCena, v343), mais a segunda linha que a equipe põe em painel alto:
 *  - a mão francesa é um quadro de tubo com 0,60 m de fundo, de pé atrás do painel. Peças de 1,92 m
 *    (dois quadros de 0,96), 1,44 m e 0,96 m, empilhadas a partir de onde ela apoia, a maior embaixo,
 *    até chegar o mais perto possível do topo do painel sem passar dele; dando empate, menos peças;
 *  - fileiras: sempre na emenda das placas, nas duas pontas; da primeira emenda, de 1,5 em 1,5 m;
 *  - pesos: em cada fileira, 1 a cada 1 m da altura que ela alcança (de onde apoia até o topo do
 *    painel), arredondando normal (2,5 m → 3; 4,1 m → 4);
 *  - palco: painel sobre o palco com a mão francesa no CHÃO (atrás do palco) → a altura do palco entra
 *    na conta; com ela NO PALCO, o palco não conta, mas ele precisa de 0,80 m de fundo (senão vai no chão);
 *  - segunda linha: a partir de 4,5 m de altura alcançada, a 1,92 da base é dobrada para trás (mais um
 *    quadro de 1,92 por fileira, base com 1,20 m de fundo) — como no desenho do painel central 4 m sobre
 *    palco 0,60 e dos laterais de 4,5 m.
 * ============================================================ */
export const MF = { modulos: [1.92, 1.44, 0.96], vao: 1.5, prof: 0.6, folgaPalco: 0.1, pesoACada: 1, segundaLinha: 4.5 };
export const MF_PALCO_MIN = MF.prof + MF.folgaPalco + 0.1;   // 0,80 m de fundo para ela caber no palco

// a pilha (até 8 peças) que chega mais perto do topo sem passar; null se não cabe nem a menor (painel < 0,96 m)
export function pilhaMaoFrancesa(alto) {
  let melhor = null;
  const busca = (pilha, soma) => {
    if (pilha.length && (!melhor || soma > melhor.soma + 1e-9 || (Math.abs(soma - melhor.soma) < 1e-9 && pilha.length < melhor.pilha.length)))
      melhor = { pilha: pilha.slice(), soma };
    if (pilha.length >= 8) return;
    for (const h of MF.modulos) if ((!pilha.length || h <= pilha[pilha.length - 1]) && soma + h <= alto + 0.01) busca([...pilha, h], soma + h);
  };
  busca([], 0);
  return melhor ? { pilha: melhor.pilha, topo: +melhor.soma.toFixed(3) } : null;
}

// onde vai cada fileira, em metros a partir da ponta esquerda do painel (sempre numa emenda de placas)
export function fileirasMaoFrancesa(larguraM, placa) {
  const p = placa > 0 ? placa : 0.5, ult = larguraM - p, xs = [];
  if (!(larguraM > 0)) return xs;
  if (larguraM < 2 * p - 1e-6) return [larguraM / 2];         // uma placa só de largura: no meio dela
  for (let x0 = p; x0 <= ult + 1e-6; x0 += MF.vao) {
    const x = Math.min(Math.round(x0 / p) * p, ult);
    if (!xs.length || x > xs[xs.length - 1] + 1e-6) xs.push(+x.toFixed(3));
  }
  if (xs[xs.length - 1] < ult - 1e-6) xs.push(+ult.toFixed(3)); // a última emenda sempre leva uma
  return xs;
}

/* A estrutura de uma tela no chão (ou sobre o palco). tela.palco = { sobre, altura_m, fundo_m, mf: 'chao'|'palco' }.
 * Devolve null se a tela não leva mão francesa (aéreo, totem… ou painel mais baixo que 0,96 m). */
export function estruturaTela(tela, painel, dims) {
  if ((tela.montagem || 'chao') !== 'chao') return null;
  const p = painel || {};
  const gl = num(p.larg_m) || 0.5, ga = num(p.alt_m) || 0.5;
  const g = dims || geometria(Object.assign({}, tela, { montagem: 'outro' }), p);
  const wM = g.colunas * gl, hM = g.linhas * ga;
  if (!(wM > 0 && hM > 0)) return null;
  const pl = tela.palco || {};
  const sobre = !!pl.sobre && num(pl.altura_m) > 0;
  const altPalco = sobre ? num(pl.altura_m) : 0, fundo = sobre ? num(pl.fundo_m) : 0;
  const querPalco = sobre && pl.mf === 'palco';
  const raso = querPalco && fundo > 0 && fundo < MF_PALCO_MIN - 1e-9;   // não cabe no palco: vai no chão
  const noPalco = querPalco && !raso;
  const base = noPalco ? altPalco : 0;
  const alto = +(altPalco + hM - base).toFixed(3);
  const pilha = pilhaMaoFrancesa(alto);
  if (!pilha) return null;
  const xs = fileirasMaoFrancesa(wM, gl);
  const segunda = alto >= MF.segundaLinha - 1e-9 && pilha.pilha[0] === 1.92;
  const pesos = Math.max(1, Math.floor(alto / MF.pesoACada + 0.5 + 1e-6));
  return {
    fileiras: xs.length, posicoes: xs, pilha: pilha.pilha, topo: pilha.topo, alto, base, pesos,
    segunda_linha: segunda, sobre, noPalco, raso, altura_palco: altPalco, fundo_palco: fundo,
    largura_m: +wM.toFixed(3), altura_m: +hM.toFixed(3)
  };
}

export const MODOS_TELA = ['medida', 'grade', 'm2', 'gabinetes'];
export const MONTAGENS = ['chao', 'aereo', 'totem', 'balcao', 'outro'];

export function geometria(tela, painel) {
  const p = painel || {};
  const gl = num(p.larg_m) || 0.5, ga = num(p.alt_m) || 0.5;
  const area = gl * ga;
  let colunas = 0, linhas = 0, gabinetes = 0;
  const modo = tela.modo || 'medida';
  if (modo === 'grade') {
    colunas = Math.max(0, Math.round(num(tela.colunas)));
    linhas = Math.max(0, Math.round(num(tela.linhas)));
    gabinetes = colunas * linhas;
  } else if (modo === 'm2') {
    gabinetes = Math.max(0, arredonda(num(tela.m2) / area, 'cima'));
  } else if (modo === 'gabinetes') {
    gabinetes = Math.max(0, Math.round(num(tela.gabinetes)));
  } else {
    colunas = Math.max(0, Math.round(num(tela.largura_m) / gl + EPS));
    linhas = Math.max(0, Math.round(num(tela.altura_m) / ga + EPS));
    gabinetes = colunas * linhas;
  }
  const largura_m = colunas * gl, altura_m = linhas * ga;
  const pxPorGab = num(p.px_l) * num(p.px_a);
  const pixels = gabinetes * pxPorGab;
  const porCase = num(p.por_case) || 6;
  const porCirc = num(p.por_circuito) || 12;
  const pxPorta = num(p.px_porta) || 650000;
  const chao = (tela.montagem || 'chao') === 'chao' && colunas > 0 && linhas > 0;
  // mão francesa e pesos: a regra da equipe (a mesma do Calculator), com palco e segunda linha
  const est = chao ? estruturaTela(tela, p, { colunas, linhas }) : null;
  const apoios = est ? est.fileiras : 0;
  const nPilha = h => (est ? est.pilha.filter(x => x === h).length : 0);
  return {
    tela: 1,
    gabinetes, colunas, linhas,
    largura_m: +largura_m.toFixed(3), altura_m: +altura_m.toFixed(3),
    m2: +(gabinetes * area).toFixed(3),
    cases: gabinetes ? arredonda(gabinetes / porCase, 'cima') : 0,
    circuitos: gabinetes ? arredonda(gabinetes / porCirc, 'cima') : 0,
    pixels,
    portas: pixels ? arredonda(pixels / pxPorta, 'cima') : 0,
    gab_por_porta: pxPorGab ? Math.floor(pxPorta / pxPorGab) : 0,
    apoios,
    mf_192: apoios * (nPilha(1.92) + (est && est.segunda_linha ? 1 : 0)),
    mf_144: apoios * nPilha(1.44),
    mf_096: apoios * nPilha(0.96),
    pesos: est ? apoios * est.pesos : 0,
    mf_alto: est ? est.alto : 0,
    mf_segunda_linha: est && est.segunda_linha ? apoios : 0,
    peso_painel_kg: +(gabinetes * num(p.kg)).toFixed(1),
    potencia_max_w: gabinetes * num(p.w_max),
    potencia_med_w: gabinetes * num(p.w_med),
    chao: chao ? 1 : 0
  };
}

/* ============================================================
 * Projeto técnico da tela: cabeamento de dados (portas) e de energia (réguas e racks)
 * ============================================================ */

export const PROJETO_PADRAO = { inicio: 'inf-esq', backup: false, kw_regua: 7.5, reguas_rack: 4, rack: 'rack-9', processadora: '', portas: 'colunas' };
export const RACKS = { 'rack-5': 5, 'rack-9': 9, 'rack-12': 12 };

export function configProjeto(tela) {
  return Object.assign({}, PROJETO_PADRAO, (tela && tela.projeto) || {});
}

/* Divide n itens em k grupos o mais iguais possível, na ordem: 70 em 12 → 6,6,…,6,5,5. */
function dividir(n, k) {
  const base = Math.floor(n / k), extra = n % k, out = [];
  for (let i = 0; i < k; i++) out.push(base + (i < extra ? 1 : 0));
  return out;
}

/* O plano completo de uma tela com colunas × linhas conhecidas.
 * Dados: cada porta pega COLUNAS INTEIRAS até o limite de pixels (como no projeto da Abbvie:
 *   Girassol 7 linhas → 3 colunas por porta; Ipês 9 linhas → 2), e o caminho é uma serpentina
 *   vertical que nasce no canto escolhido.
 * Energia: cada régua Steck/Powercon fecha colunas inteiras até o limite de consumo MÁXIMO
 *   (padrão 7,5 kW), repartidas por igual; cada rack recebe até N réguas (padrão 4).
 * Linha 0 = de cima; coluna 0 = da esquerda.
 */
export function planoProjeto(tela, painel) {
  const g = geometria(tela, painel);
  const C = g.colunas, L = g.linhas;
  if (!C || !L) return null;
  const p = painel || {};
  const cfg = configProjeto(tela);
  const pxGab = num(p.px_l) * num(p.px_a);
  const pxPorta = num(cfg.px_porta) || num(p.px_porta) || 650000;
  let colsPorta = pxGab ? Math.floor(pxPorta / (L * pxGab)) : C;
  const colunaExcede = colsPorta < 1;
  if (colsPorta < 1) colsPorta = 1;
  colsPorta = Math.min(colsPorta, C);

  const daDireita = /dir$/.test(cfg.inicio);
  const deBaixo = /^inf/.test(cfg.inicio);
  const ordemCols = Array.from({ length: C }, (_, i) => (daDireita ? C - 1 - i : i));
  const portas = [];
  const cheia = cfg.portas === 'cheia';
  if (cheia) {
    // "Encher a porta": uma serpentina só pela tela inteira, cortada a cada N gabinetes (a porta pode
    // terminar no meio de uma coluna e a próxima continua dali) — P1.9 6 de altura: 10 por porta, não 6
    const porPorta = Math.max(1, pxGab ? Math.floor(pxPorta / pxGab) : C * L);
    const tudo = [];
    ordemCols.forEach((c, j) => {
      const sobe = deBaixo ? j % 2 === 0 : j % 2 === 1;
      for (let k = 0; k < L; k++) tudo.push([c, sobe ? L - 1 - k : k]);
    });
    for (let i = 0, n = 1; i < tudo.length; i += porPorta, n++) {
      const caminho = tudo.slice(i, i + porPorta);
      const cols = [...new Set(caminho.map(([c]) => c))];
      portas.push({ n, cols, gabinetes: caminho.length, pixels: caminho.length * pxGab, caminho });
    }
  } else {
    for (let i = 0, n = 1; i < C; i += colsPorta, n++) {
      const cols = ordemCols.slice(i, i + colsPorta);
      const caminho = [];
      cols.forEach((c, j) => {
        const sobe = deBaixo ? j % 2 === 0 : j % 2 === 1; // 1ª coluna sai do canto escolhido
        for (let k = 0; k < L; k++) caminho.push([c, sobe ? L - 1 - k : k]);
      });
      portas.push({ n, cols, gabinetes: cols.length * L, pixels: cols.length * L * pxGab, caminho });
    }
  }

  const wCol = L * num(p.w_max);
  const limite = Math.max(0.1, num(cfg.kw_regua) || 7.5) * 1000;
  const maxCols = wCol ? Math.max(1, Math.floor(limite / wCol)) : C;
  const nReguas = Math.ceil(C / maxCols);
  const reguas = [];
  let c0 = 0;
  dividir(C, nReguas).forEach((qtd, i) => {
    reguas.push({ n: i + 1, col_ini: c0, col_fim: c0 + qtd - 1, colunas: qtd, w: qtd * wCol, rack: 0 });
    c0 += qtd;
  });
  const porRack = Math.max(1, Math.round(num(cfg.reguas_rack) || 4));
  const nRacks = Math.ceil(nReguas / porRack);
  const racks = [];
  let r0 = 0;
  dividir(nReguas, nRacks).forEach((qtd, i) => {
    const rs = reguas.slice(r0, r0 + qtd);
    rs.forEach(r => { r.rack = i + 1; });
    racks.push({ n: i + 1, tipo: RACKS[cfg.rack] ? cfg.rack : 'rack-9', reguas: rs.map(r => r.n), w: rs.reduce((s, r) => s + r.w, 0) });
    r0 += qtd;
  });

  return {
    colunas: C, linhas: L, gabinetes: g.gabinetes, largura_m: g.largura_m, altura_m: g.altura_m,
    px_l: num(p.px_l), px_a: num(p.px_a), cfg,
    dados: { modo: cheia ? 'cheia' : 'colunas', cols_por_porta: colsPorta, gab_por_porta: cheia ? Math.max(1, Math.floor(pxPorta / (pxGab || 1))) : colsPorta * L,
      coluna_excede: colunaExcede && !cheia, px_porta: pxPorta, portas, cabos: portas.length * (cfg.backup ? 2 : 1) },
    energia: { w_coluna: wCol, limite_w: limite, reguas, racks, w_total: C * wCol }
  };
}

/* Folha de distribuição: quanto de cada item vai para cada tela. Vem das origens das linhas;
 * linha que o técnico mudou à mão é repartida na mesma proporção (maiores restos, sem fração). */
export function distribuicaoPorTela(telas, linhas) {
  const out = new Map((telas || []).map(t => [t.id, new Map()]));
  for (const l of linhas || []) {
    if (!linhaAtiva(l)) continue;
    const porTela = new Map();
    for (const o of l.origens || []) if (o.tela && out.has(o.tela)) porTela.set(o.tela, (porTela.get(o.tela) || 0) + num(o.qtd));
    const soma = [...porTela.values()].reduce((a, b) => a + b, 0);
    const q = num(l.qtd);
    if (!soma) {
      if ((telas || []).length === 1) out.get(telas[0].id).set(l.item, q);
      continue;
    }
    const partes = [...porTela.entries()].map(([t, v]) => { const exato = q * v / soma; return { t, base: Math.floor(exato), resto: exato - Math.floor(exato) }; });
    let falta = Math.round(q - partes.reduce((s, p) => s + p.base, 0));
    partes.sort((a, b) => b.resto - a.resto).forEach(p => { if (falta > 0) { p.base++; falta--; } });
    for (const p of partes) if (p.base) out.get(p.t).set(l.item, (out.get(p.t).get(l.item) || 0) + p.base);
  }
  return out;
}

/* Números do projeto que viram base das regras (é assim que o projeto mexe na lista). */
function basesDoProjeto(tela, painel, g) {
  const cfg = configProjeto(tela);
  const plano = planoProjeto(tela, painel);
  let portas, reguas, racks;
  if (plano) {
    portas = plano.dados.portas.length; reguas = plano.energia.reguas.length; racks = plano.energia.racks.length;
  } else { // m² / nº de gabinetes: sem desenho, estima pela potência total
    portas = g.portas;
    reguas = g.potencia_max_w ? Math.ceil(g.potencia_max_w / ((num(cfg.kw_regua) || 7.5) * 1000)) : 0;
    racks = reguas ? Math.ceil(reguas / (num(cfg.reguas_rack) || 4)) : 0;
  }
  const tipo = RACKS[cfg.rack] ? cfg.rack : 'rack-9';
  return {
    portas, cabos_dados: portas * (cfg.backup ? 2 : 1), reguas, racks,
    racks_5: tipo === 'rack-5' ? racks : 0, racks_9: tipo === 'rack-9' ? racks : 0, racks_12: tipo === 'rack-12' ? racks : 0
  };
}

// Bases que a tela de regras oferece (a tela é quem dá nome humano a elas).
export const BASES_TELA = ['gabinetes', 'cases', 'colunas', 'linhas', 'largura_m', 'altura_m', 'm2', 'circuitos', 'portas',
  'cabos_dados', 'reguas', 'racks', 'racks_5', 'racks_9', 'racks_12', 'apoios', 'mf_192', 'mf_144', 'mf_096', 'pesos', 'mf_segunda_linha', 'tela'];
export const BASES_LISTA = ['lista', 'gabinetes', 'gabinetes_chao', 'cases', 'circuitos', 'telas', 'telas_chao', 'm2'];

/* ============================================================
 * Motor de regras
 * ============================================================ */

function depsDaBase(base) {
  if (!base) return [];
  if (base.startsWith('item:')) return [base.slice(5)];
  if (base.startsWith('itens:')) return base.slice(6).split(',').map(s => s.trim()).filter(Boolean);
  return [];
}

function condicaoOk(cond, valores) {
  if (!cond || !cond.base) return true;
  const v = num(valores[cond.base]), alvo = num(cond.valor);
  switch (cond.op) {
    case '>': return v > alvo + EPS;
    case '<': return v < alvo - EPS;
    case '<=': return v <= alvo + EPS;
    case '=': return Math.abs(v - alvo) < EPS;
    case '!=': return Math.abs(v - alvo) >= EPS;
    default: return v >= alvo - EPS; // '>='
  }
}

function regraValeParaTela(r, tela) {
  if (r.escopo === 'lista') return false;
  if (Array.isArray(r.paineis) && r.paineis.length && !r.paineis.includes(tela.painel)) return false;
  if (Array.isArray(r.montagens) && r.montagens.length && !r.montagens.includes(tela.montagem || 'chao')) return false;
  return true;
}

/* Avalia um conjunto de regras em cascata (regra cuja base é a quantidade de outro item espera
 * aquele item ficar pronto). O que não consegue ficar pronto está num ciclo — vira erro, não trava.
 * valores: bases numéricas; somaInicial: quantidades de itens já conhecidas (ex.: soma das telas).
 */
function avaliar(regras, valores, somaInicial, resolveItem) {
  const qtd = new Map(Object.entries(somaInicial || {}));
  const origens = [];
  const produtores = new Map();
  for (const r of regras) {
    const it = resolveItem(r.item);
    if (!it) continue;
    if (!produtores.has(it)) produtores.set(it, []);
    produtores.get(it).push(r);
  }
  const feitas = new Set();
  const pendentes = regras.filter(r => resolveItem(r.item));
  const prontaItem = it => (produtores.get(it) || []).every(r => feitas.has(r.id));
  let andou = true;
  while (andou) {
    andou = false;
    for (const r of pendentes) {
      if (feitas.has(r.id)) continue;
      const deps = depsDaBase(r.base);
      if (!deps.every(prontaItem)) continue;
      feitas.add(r.id); andou = true;
      const vals = valores;
      let valorBase;
      if (deps.length) valorBase = deps.reduce((s, it) => s + (qtd.get(it) || 0), 0);
      else valorBase = num(vals[r.base]);
      if (!condicaoOk(r.cond, vals)) continue;
      let { qtd: q, bruto } = quantidadeDaRegra(r, valorBase);
      if (!q) continue;
      // Teto: "no máximo N por <base>" (ex.: 2 pesos por peça de mão francesa, mas no máximo 5 por apoio)
      let teto = null;
      if (r.teto && r.teto.base && vals[r.teto.base] != null) {
        const limite = arredonda(num(vals[r.teto.base]) * (r.teto.fator == null || r.teto.fator === '' ? 1 : num(r.teto.fator)), 'cima');
        if (q > limite) { q = limite; teto = { base: r.teto.base, valor: num(vals[r.teto.base]), fator: num(r.teto.fator), limite }; }
        if (!q) continue;
      }
      const it = resolveItem(r.item);
      qtd.set(it, (qtd.get(it) || 0) + q);
      origens.push({
        item: it, regra: r.id, base: r.base, valor_base: valorBase,
        fator: r.fator == null || r.fator === '' ? 1 : num(r.fator), reserva: num(r.reserva), adicional: num(r.adicional),
        multiplo: num(r.multiplo), minimo: num(r.minimo), maximo: num(r.maximo), arred: r.arred || 'cima',
        bruto: +bruto.toFixed(4), qtd: q, teto
      });
    }
  }
  const ciclo = pendentes.filter(r => !feitas.has(r.id)).map(r => r.id);
  return { qtd, origens, ciclo };
}

/* Telas + catálogo + regras → sugestões somadas por item.
 * Devolve { itens: Map(item → {qtd, origens[]}), telas: [{id, bases, erro}], erros: [] }
 * origens de cada item dizem tela, regra, base, fator e resultado — a tela escreve
 * "80 gabinetes × 1 = 80" a partir disso.
 */
export function calcularSugestoes(telas, catalogo, regras) {
  const cat = indexar(catalogo);
  const ativas = (regras || []).filter(r => r && r.ativa !== false && r.item);
  const itens = new Map();
  const erros = [];
  const infoTelas = [];
  const somaTelas = {};
  const totais = { lista: 1, gabinetes: 0, gabinetes_chao: 0, cases: 0, circuitos: 0, telas: 0, telas_chao: 0, m2: 0 };

  const juntar = (o, extra) => {
    if (!itens.has(o.item)) itens.set(o.item, { qtd: 0, origens: [] });
    const reg = itens.get(o.item);
    reg.qtd += o.qtd;
    reg.origens.push(Object.assign({}, o, extra));
  };

  for (const tela of telas || []) {
    const painelItem = cat.get(tela.painel);
    if (!painelItem || !painelItem.painel) {
      infoTelas.push({ id: tela.id, bases: null, erro: 'sem_painel' });
      erros.push({ tipo: 'tela_sem_painel', tela: tela.id });
      continue;
    }
    const bases = geometria(tela, painelItem.painel);
    if (bases.gabinetes) Object.assign(bases, basesDoProjeto(tela, painelItem.painel, bases));
    infoTelas.push({ id: tela.id, bases, erro: bases.gabinetes ? null : 'sem_medida' });
    if (!bases.gabinetes) continue;
    totais.telas++; totais.gabinetes += bases.gabinetes; totais.cases += bases.cases;
    totais.circuitos += bases.circuitos; totais.m2 += bases.m2;
    if (bases.chao) { totais.telas_chao++; totais.gabinetes_chao += bases.gabinetes; }

    const daTela = ativas.filter(r => regraValeParaTela(r, tela));
    const resolve = id => (id === '@painel' ? tela.painel : (cat.has(id) ? id : null));
    const res = avaliar(daTela, bases, null, resolve);
    for (const id of res.ciclo) erros.push({ tipo: 'ciclo', regra: id, tela: tela.id });
    for (const o of res.origens) {
      juntar(o, { tela: tela.id, tela_nome: tela.nome || '' });
      somaTelas[o.item] = (somaTelas[o.item] || 0) + o.qtd;
    }
  }

  if (totais.telas) {
    const daLista = ativas.filter(r => r.escopo === 'lista');
    const resolve = id => (id !== '@painel' && cat.has(id) ? id : null);
    const res = avaliar(daLista, totais, somaTelas, resolve);
    for (const id of res.ciclo) erros.push({ tipo: 'ciclo', regra: id, tela: null });
    for (const o of res.origens) juntar(o, { tela: null, tela_nome: '' });
  }

  for (const [id, it] of itens) if (!it.qtd) itens.delete(id);
  return { itens, telas: infoTelas, totais, erros };
}

/* ============================================================
 * Linhas da lista: mesclar sugestões sem perder edição nem check
 * ============================================================ */

export function temSeparacao(l) { return num(l.sep_qtd) > 0 || !!l.sep_marca; }

/* Aplica as sugestões sobre as linhas atuais.
 *  - linha travada (o técnico mudou a quantidade): mantém a quantidade dele, só atualiza o "sugerido"
 *  - linha recusada (o técnico removeu): continua fora, não volta sozinha
 *  - linha manual: nunca é mexida pela regra
 *  - linha que a regra parou de sugerir: some, a não ser que esteja travada ou já separada
 * Nada aqui apaga check de separação: os campos sep_* são copiados como estão.
 * Devolve { linhas, diff } — o diff é o que a tela mostra antes de aplicar numa lista em separação.
 */
export function aplicarSugestoes(linhasAtuais, sugestoes, { novoId, listaId } = {}) {
  const sug = sugestoes instanceof Map ? sugestoes : new Map(Object.entries(sugestoes || {}));
  const linhas = [];
  const diff = [];
  const vistos = new Set();
  for (const l of linhasAtuais || []) {
    const s = sug.get(l.item);
    vistos.add(l.item);
    if (s) {
      const nl = Object.assign({}, l, { sug: s.qtd, origens: s.origens });
      if (l.origem === 'regra' && !l.travado && !l.recusado && num(l.qtd) !== s.qtd) {
        diff.push({ item: l.item, de: num(l.qtd), para: s.qtd, tipo: 'mudou' });
        nl.qtd = s.qtd;
      }
      linhas.push(nl);
    } else if (l.origem === 'regra') {
      if (l.travado || temSeparacao(l) || l.recusado) {
        linhas.push(Object.assign({}, l, { sug: 0, origens: [] }));
      } else {
        diff.push({ item: l.item, de: num(l.qtd), para: 0, tipo: 'saiu' });
      }
    } else {
      linhas.push(Object.assign({}, l));
    }
  }
  for (const [item, s] of sug) {
    if (vistos.has(item)) continue;
    linhas.push({
      id: novoId ? novoId() : undefined, lista: listaId, item, qtd: s.qtd, sug: s.qtd, origem: 'regra',
      travado: false, recusado: false, origens: s.origens, obs: '',
      sep_qtd: null, sep_marca: null, sep_por: null, sep_em: null,
      ret_ok: null, ret_avaria: null, ret_por: null, ret_em: null
    });
    diff.push({ item, de: 0, para: s.qtd, tipo: 'entrou' });
  }
  return { linhas, diff };
}

/* O técnico mudou a quantidade na mão → trava. Voltar ao valor sugerido destrava. */
export function editarQuantidade(linha, qtd) {
  const q = Math.max(0, num(qtd));
  const nl = Object.assign({}, linha, { qtd: q });
  if (linha.origem === 'regra') nl.travado = linha.sug == null ? true : q !== num(linha.sug);
  return nl;
}

export function linhaAtiva(l) { return !l.recusado && num(l.qtd) > 0; }

/* Linhas travadas cuja regra hoje sugere outra coisa — a tela avisa "a regra sugere 80, você fixou 60". */
export function divergencias(linhas) {
  return (linhas || []).filter(l => l.origem === 'regra' && l.travado && !l.recusado && l.sug != null && num(l.sug) !== num(l.qtd))
    .map(l => ({ id: l.id, item: l.item, qtd: num(l.qtd), sug: num(l.sug) }));
}

/* ============================================================
 * Totais da lista (caminhão e gerador)
 * ============================================================ */

export function totaisLista(lista, linhas, catalogo) {
  const cat = indexar(catalogo);
  let volumesLed = 0, pecas = 0, pesoItens = 0, itensSemPeso = 0, nLinhas = 0;
  let gabinetes = 0, pesoPainel = 0, potMax = 0, potMed = 0, m2 = 0;
  for (const t of (lista && lista.telas) || []) {
    const c = cat.get(t.painel);
    if (!c || !c.painel) continue;
    const g = geometria(t, c.painel);
    gabinetes += g.gabinetes; pesoPainel += g.peso_painel_kg; potMax += g.potencia_max_w; potMed += g.potencia_med_w; m2 += g.m2;
  }
  for (const l of linhas || []) {
    if (!linhaAtiva(l)) continue;
    nLinhas++;
    const c = cat.get(l.item);
    const q = num(l.qtd);
    pecas += q;
    if (c && c.cat === 'led') { volumesLed += q; continue; }
    if (c && num(c.peso_kg) > 0) pesoItens += q * num(c.peso_kg);
    else itensSemPeso++;
  }
  return {
    linhas: nLinhas, pecas, cases_led: volumesLed, gabinetes, m2: +m2.toFixed(2),
    peso_painel_kg: +pesoPainel.toFixed(1), peso_itens_kg: +pesoItens.toFixed(1),
    peso_total_kg: +(pesoPainel + pesoItens).toFixed(1), itens_sem_peso: itensSemPeso,
    potencia_max_w: potMax, potencia_med_w: potMed
  };
}

/* ============================================================
 * Separação (checklist do galpão)
 * ============================================================ */

export function statusSeparacao(l) {
  if (l.sep_marca === 'na') return 'na';
  if (l.sep_marca === 'faltou') return 'faltou';
  const s = num(l.sep_qtd), q = num(l.qtd);
  if (!s) return 'pendente';
  if (s >= q) return 'ok';
  return 'parcial';
}

export function marcarSeparado(linha, { qtd, por, em }) {
  const q = qtd == null ? num(linha.qtd) : Math.max(0, num(qtd));
  return Object.assign({}, linha, { sep_qtd: q, sep_marca: null, sep_por: por || null, sep_em: em || null });
}
export function marcarFalta(linha, { por, em, obs }) {
  return Object.assign({}, linha, { sep_marca: 'faltou', sep_por: por || null, sep_em: em || null, obs: obs != null ? obs : linha.obs });
}
export function marcarNaoAplica(linha, { por, em }) {
  return Object.assign({}, linha, { sep_marca: 'na', sep_por: por || null, sep_em: em || null });
}
export function desmarcar(linha) {
  return Object.assign({}, linha, { sep_qtd: null, sep_marca: null, sep_por: null, sep_em: null });
}

export function progressoSeparacao(linhas) {
  const r = { total: 0, ok: 0, parcial: 0, pendente: 0, faltou: 0, na: 0, resolvidos: 0, pct: 0 };
  for (const l of linhas || []) {
    if (!linhaAtiva(l)) continue;
    const s = statusSeparacao(l);
    r[s]++;
    if (s === 'na') continue;
    r.total++;
    if (s === 'ok') r.resolvidos++;
  }
  r.pct = r.total ? Math.round((r.resolvidos / r.total) * 100) : 0;
  return r;
}

/* Fechar a separação: o que não está ok precisa de justificativa (a tela cobra o texto). */
export function pendenciasSeparacao(linhas) {
  return (linhas || []).filter(l => linhaAtiva(l)).map(l => ({ l, s: statusSeparacao(l) }))
    .filter(x => x.s === 'pendente' || x.s === 'parcial' || x.s === 'faltou')
    .map(x => ({ id: x.l.id, item: x.l.item, status: x.s, qtd: num(x.l.qtd), separado: num(x.l.sep_qtd) }));
}

/* Ordem de separação: segue a ordem do galpão (ordem do catálogo), não a ordem em que a lista foi montada. */
export function ordenarParaSeparar(linhas, catalogo) {
  const cat = indexar(catalogo);
  return (linhas || []).slice().sort((a, b) => {
    const ca = cat.get(a.item), cb = cat.get(b.item);
    return (num(ca && ca.ordem) - num(cb && cb.ordem)) || String(ca ? ca.nome : '').localeCompare(String(cb ? cb.nome : ''));
  });
}

/* ============================================================
 * Retorno do evento
 * ============================================================ */

// O que efetivamente saiu: o que foi separado; sem separação registrada, o que está na lista.
export function quantidadeEnviada(l) {
  const s = statusSeparacao(l);
  if (s === 'na') return 0;
  if (s === 'pendente') return num(l.qtd);
  return num(l.sep_qtd);
}

export function linhaRetorno(l) {
  const enviado = quantidadeEnviada(l);
  const respondido = l.ret_ok != null;
  const ok = num(l.ret_ok), avaria = num(l.ret_avaria);
  const falta = respondido ? Math.max(0, enviado - ok - avaria) : null;
  const sobra = respondido ? Math.max(0, ok + avaria - enviado) : 0;
  return { id: l.id, item: l.item, enviado, respondido, ok, avaria, falta, sobra };
}

export function resumoRetorno(linhas) {
  const r = { linhas: 0, respondidas: 0, enviado: 0, ok: 0, avaria: 0, falta: 0, itens_falta: 0, itens_avaria: 0 };
  for (const l of linhas || []) {
    if (!linhaAtiva(l)) continue;
    const x = linhaRetorno(l);
    if (!x.enviado) continue;
    r.linhas++; r.enviado += x.enviado;
    if (!x.respondido) continue;
    r.respondidas++; r.ok += x.ok; r.avaria += x.avaria; r.falta += x.falta;
    if (x.falta) r.itens_falta++;
    if (x.avaria) r.itens_avaria++;
  }
  r.pct = r.linhas ? Math.round((r.respondidas / r.linhas) * 100) : 0;
  return r;
}

/* Fechar o retorno: o que faltou sai do inventário (movimento de perda, reversível) e o que voltou
 * com avaria abre manutenção. Linha sem resposta impede o fechamento.
 */
export function fecharRetorno(lista, linhas, { novoId, hoje, por }) {
  const semResposta = [];
  const movimentos = [];
  const manutencoes = [];
  for (const l of linhas || []) {
    if (!linhaAtiva(l)) continue;
    const x = linhaRetorno(l);
    if (!x.enviado) continue;
    if (!x.respondido) { semResposta.push(l.id); continue; }
    if (x.falta > 0) movimentos.push({
      id: novoId(), item: l.item, qtd: -x.falta, tipo: 'perda', lista: lista.id, linha: l.id, data: hoje, por: por || null, obs: ''
    });
    if (x.avaria > 0) manutencoes.push({
      id: novoId(), item: l.item, qtd: x.avaria, status: 'aberta', defeito: '', origem_lista: lista.id,
      aberta_em: hoje, aberta_por: por || null, previsao: null, concluida_em: null, consertadas: 0, descartadas: 0, solucao: ''
    });
  }
  return { ok: semResposta.length === 0, semResposta, movimentos, manutencoes };
}

/* Item que "sumiu" e apareceu depois: devolve ao inventário sem apagar o registro da perda. */
export function recuperarPerda(perda, { novoId, hoje, por, qtd }) {
  const q = Math.min(Math.abs(num(perda.qtd)), qtd == null ? Math.abs(num(perda.qtd)) : Math.max(0, num(qtd)));
  return { id: novoId(), item: perda.item, qtd: q, tipo: 'recuperado', ref: perda.id, lista: perda.lista || null, data: hoje, por: por || null, obs: '' };
}

/* ============================================================
 * Estoque e disponibilidade
 * ============================================================ */

export const STATUS_BLOQUEIA = ['pronta', 'separando', 'separada', 'em_evento'];
export const STATUS_MANUT_ABERTA = ['aberta', 'em_reparo', 'aguardando_peca'];

export function estoqueAtual(catalogo, movimentos) {
  const m = new Map();
  for (const c of catalogo || []) m.set(c.id, c.qtd == null || c.qtd === '' ? null : num(c.qtd));
  for (const mv of movimentos || []) {
    if (!m.has(mv.item) || m.get(mv.item) == null) continue;
    m.set(mv.item, m.get(mv.item) + num(mv.qtd));
  }
  return m;
}

export function emManutencao(manutencoes) {
  const m = new Map();
  for (const x of manutencoes || []) {
    if (!STATUS_MANUT_ABERTA.includes(x.status)) continue;
    const resta = Math.max(0, num(x.qtd) - num(x.consertadas) - num(x.descartadas));
    m.set(x.item, (m.get(x.item) || 0) + resta);
  }
  return m;
}

/* Janela em que uma lista prende o material: da ida até a volta. Se a volta passou e o retorno
 * não foi fechado, o material ainda não está em casa — a janela estica até hoje.
 */
export function janelaLista(lista, hoje) {
  if (!lista || !D.valida(lista.ida)) return null;
  let fim = D.valida(lista.volta) && lista.volta >= lista.ida ? lista.volta : lista.ida;
  if (hoje && fim < hoje && STATUS_BLOQUEIA.includes(lista.status)) fim = hoje;
  return { ini: lista.ida, fim };
}

export function bloqueiaEstoque(lista, { comRascunhos } = {}) {
  if (!lista) return false;
  if (STATUS_BLOQUEIA.includes(lista.status)) return true;
  return !!comRascunhos && lista.status === 'rascunho';
}

/* Quanto de cada item cada lista ocupa (o que foi separado, ou a quantidade da lista). */
function usoPorLista(linhas) {
  const m = new Map();
  for (const l of linhas || []) {
    if (!linhaAtiva(l)) continue;
    const q = quantidadeEnviada(l);
    if (!q) continue;
    if (!m.has(l.lista)) m.set(l.lista, new Map());
    const u = m.get(l.lista);
    u.set(l.item, (u.get(l.item) || 0) + q);
  }
  return m;
}

/* Disponível de cada item em cada dia de [ini, fim], descontando manutenção e as outras listas.
 * estado = { catalogo, listas, linhas, movimentos, manutencoes }
 * Devolve Map(item → { total, manut, dias: [{dia, uso, livre}] , minimo })
 */
export function disponibilidade(estado, { ini, fim, hoje, ignorarLista, comRascunhos, itens } = {}) {
  const est = estoqueAtual(estado.catalogo, estado.movimentos);
  const man = emManutencao(estado.manutencoes);
  const uso = usoPorLista(estado.linhas);
  const dias = D.dias(ini, fim);
  const listas = (estado.listas || []).filter(l => l.id !== ignorarLista && bloqueiaEstoque(l, { comRascunhos }))
    .map(l => ({ l, j: janelaLista(l, hoje) })).filter(x => x.j && D.cruza(x.j.ini, x.j.fim, ini, fim));
  const out = new Map();
  const alvo = itens ? new Set(itens) : null;
  for (const c of estado.catalogo || []) {
    if (alvo && !alvo.has(c.id)) continue;
    const total = est.get(c.id);
    const manut = man.get(c.id) || 0;
    const porDia = dias.map(dia => {
      let u = 0;
      const quem = [];
      for (const { l, j } of listas) {
        if (dia < j.ini || dia > j.fim) continue;
        const q = (uso.get(l.id) && uso.get(l.id).get(c.id)) || 0;
        if (q) { u += q; quem.push({ lista: l.id, qtd: q }); }
      }
      return { dia, uso: u, quem, livre: total == null ? null : +(total - manut - u).toFixed(3) };
    });
    const minimo = total == null ? null : porDia.reduce((m, d) => Math.min(m, d.livre), Infinity);
    out.set(c.id, { total, manut, dias: porDia, minimo: minimo === Infinity ? total - manut : minimo });
  }
  return out;
}

/* Para uma lista: em quais itens o estoque não cobre o período dela (contando as outras listas). */
export function faltasDeEstoque(lista, linhasDaLista, estado, { hoje } = {}) {
  const j = janelaLista(lista, hoje);
  if (!j) return [];
  const precisa = new Map();
  for (const l of linhasDaLista || []) {
    if (!linhaAtiva(l)) continue;
    precisa.set(l.item, (precisa.get(l.item) || 0) + num(l.qtd));
  }
  if (!precisa.size) return [];
  const disp = disponibilidade(estado, { ini: j.ini, fim: j.fim, hoje, ignorarLista: lista.id, itens: [...precisa.keys()] });
  const out = [];
  for (const [item, q] of precisa) {
    const d = disp.get(item);
    if (!d || d.minimo == null) continue;
    if (q > d.minimo + EPS) {
      const pior = d.dias.reduce((a, b) => (b.livre < a.livre ? b : a), d.dias[0] || { livre: d.minimo, dia: j.ini, quem: [] });
      out.push({ item, precisa: q, livre: Math.max(0, d.minimo), falta: +(q - Math.max(0, d.minimo)).toFixed(3), dia: pior.dia, outras: pior.quem, manut: d.manut, total: d.total });
    }
  }
  return out;
}

/* ============================================================
 * Manutenção (por item + quantidade)
 * ============================================================ */

export const STATUS_MANUT = ['aberta', 'em_reparo', 'aguardando_peca', 'concluida'];

/* Concluir: parte consertada volta a ficar disponível; parte descartada sai do inventário. */
export function concluirManutencao(m, { consertadas, descartadas, hoje, por, novoId, solucao }) {
  const total = num(m.qtd);
  let c = Math.max(0, num(consertadas)), d = Math.max(0, num(descartadas));
  if (c + d > total) c = Math.max(0, total - d);
  const nova = Object.assign({}, m, {
    consertadas: c, descartadas: d, status: 'concluida', concluida_em: hoje, concluida_por: por || null,
    solucao: solucao != null ? solucao : m.solucao
  });
  const movimentos = d > 0 ? [{ id: novoId(), item: m.item, qtd: -d, tipo: 'descarte', manutencao: m.id, data: hoje, por: por || null, obs: '' }] : [];
  // Sobra (nem consertado nem descartado) volta ao estoque como estava — a tela avisa se c + d < qtd.
  return { manutencao: nova, movimentos, sobra: Math.max(0, total - c - d) };
}

/* ============================================================
 * "Costuma ir": itens frequentes nas listas que não estão nesta
 * ============================================================ */

/* historico: [{ itens: { itemId: qtd } , chao: bool }] */
export function frequencias(historico, { soChao } = {}) {
  const conta = new Map();
  let n = 0;
  for (const h of historico || []) {
    if (soChao && !h.chao) continue;
    n++;
    for (const [id, q] of Object.entries(h.itens || {})) if (num(q) > 0) conta.set(id, (conta.get(id) || 0) + 1);
  }
  const f = new Map();
  for (const [id, c] of conta) f.set(id, n ? c / n : 0);
  return { freq: f, n };
}

export function esquecidos(linhas, freq, { limiar = 0.6, catalogo } = {}) {
  const tem = new Set((linhas || []).map(l => l.item)); // recusado também conta: o técnico já decidiu
  const ativos = catalogo ? new Set(catalogo.filter(c => c.ativo !== false).map(c => c.id)) : null;
  const out = [];
  for (const [id, f] of (freq instanceof Map ? freq : new Map(Object.entries(freq || {})))) {
    if (f < limiar || tem.has(id)) continue;
    if (ativos && !ativos.has(id)) continue;
    out.push({ item: id, freq: f });
  }
  return out.sort((a, b) => b.freq - a.freq);
}

/* Lista fechada no sistema vira histórico para o "costuma ir" aprender com o uso. */
export function historicoDasListas(listas, linhas, catalogo) {
  const cat = indexar(catalogo);
  const porLista = new Map();
  for (const l of linhas || []) {
    if (!linhaAtiva(l)) continue;
    if (!porLista.has(l.lista)) porLista.set(l.lista, {});
    porLista.get(l.lista)[l.item] = num(l.qtd);
  }
  return (listas || []).filter(l => ['separada', 'em_evento', 'retornada'].includes(l.status) && porLista.has(l.id))
    .map(l => ({
      itens: porLista.get(l.id),
      chao: (l.telas || []).some(t => (t.montagem || 'chao') === 'chao' && cat.get(t.painel))
    }));
}

/* ============================================================
 * Supervisão
 * ============================================================ */

/* Alertas estruturados para o painel do supervisor. A tela escreve as frases. */
export function alertas(estado, { hoje, diasAntes = 2, diasManut = 7 }) {
  const out = [];
  const linhasPorLista = agrupar(estado.linhas, 'lista');
  for (const l of estado.listas || []) {
    if (l.status === 'cancelada' || l.status === 'retornada') continue;
    const ls = linhasPorLista.get(l.id) || [];
    const prog = progressoSeparacao(ls);
    if (D.valida(l.ida) && ['rascunho', 'pronta', 'separando'].includes(l.status) && D.dif(hoje, l.ida) <= diasAntes) {
      out.push({ tipo: 'carga_proxima', nivel: D.dif(hoje, l.ida) <= 0 ? 'alto' : 'medio', lista: l.id, dias: D.dif(hoje, l.ida), pct: prog.pct, status: l.status });
    }
    if (l.status === 'separada' && !(l.conf && l.conf.por)) out.push({ tipo: 'sem_conferencia', nivel: 'medio', lista: l.id });
    if (['separada', 'em_evento'].includes(l.status) && D.valida(l.volta) && l.volta < hoje) {
      out.push({ tipo: 'retorno_atrasado', nivel: D.dif(l.volta, hoje) > 2 ? 'alto' : 'medio', lista: l.id, dias: D.dif(l.volta, hoje) });
    }
    if (l.sep && l.sep.justificativa && ['separada', 'em_evento'].includes(l.status)) {
      out.push({ tipo: 'saiu_incompleta', nivel: 'medio', lista: l.id, pendencias: pendenciasSeparacao(ls).length });
    }
  }
  for (const m of estado.manutencoes || []) {
    if (!STATUS_MANUT_ABERTA.includes(m.status) || !D.valida(m.aberta_em)) continue;
    const dias = D.dif(m.aberta_em, hoje);
    if (dias >= diasManut) out.push({ tipo: 'manutencao_parada', nivel: dias >= diasManut * 2 ? 'alto' : 'medio', manutencao: m.id, item: m.item, dias });
  }
  const desde = D.mais(hoje, -30);
  const perdas = (estado.movimentos || []).filter(mv => mv.tipo === 'perda' && D.valida(mv.data) && mv.data >= desde);
  const recuperado = new Map();
  for (const mv of estado.movimentos || []) if (mv.tipo === 'recuperado' && mv.ref) recuperado.set(mv.ref, (recuperado.get(mv.ref) || 0) + num(mv.qtd));
  for (const p of perdas) {
    const resta = Math.abs(num(p.qtd)) - (recuperado.get(p.id) || 0);
    if (resta > 0) out.push({ tipo: 'perda', nivel: 'alto', movimento: p.id, item: p.item, qtd: resta, lista: p.lista, data: p.data });
  }
  // Fiscalização da manutenção semanal: chegou quinta e ninguém registrou nada na semana
  if (estado.manutlog) {
    const ds = D.diaSemana(hoje);
    if (ds >= 4 || ds === 0) {
      const ini = D.inicioSemana(hoje);
      if (!estado.manutlog.some(e => e.data >= ini && e.data <= hoje)) out.push({ tipo: 'manutencao_semana_vazia', nivel: 'medio', desde: ini });
    }
  }
  const peso = { alto: 0, medio: 1, baixo: 2 };
  return out.sort((a, b) => peso[a.nivel] - peso[b.nivel]);
}

/* Manutenção semanal de módulos: o que foi feito no período, por ação, painel, pessoa e defeito. */
export function resumoManutencao(registros, { de, ate } = {}) {
  const r = { registros: 0, minutos: 0, modulos: 0, cases: 0, gabinetes: 0, diasComRegistro: 0,
    porAcao: new Map(), porPainel: new Map(), porPessoa: new Map(), porDefeito: new Map() };
  const dias = new Set();
  const soma = (m, k, campos) => {
    if (!m.has(k)) m.set(k, { registros: 0, modulos: 0, cases: 0, gabinetes: 0, minutos: 0 });
    const x = m.get(k);
    for (const [c, v] of Object.entries(campos)) x[c] += v;
  };
  for (const e of registros || []) {
    if (de && e.data < de) continue;
    if (ate && e.data > ate) continue;
    const q = num(e.qtd), mi = num(e.minutos);
    const un = ['modulos', 'cases', 'gabinetes'].includes(e.unidade) ? e.unidade : 'modulos';
    const c = { registros: 1, minutos: mi, [un]: q };
    r.registros++; r.minutos += mi; r[un] += q; dias.add(e.data);
    soma(r.porAcao, e.acao || 'outro', c);
    soma(r.porPainel, e.painel || '—', c);
    soma(r.porPessoa, e.tecnico || '—', c);
    if (un === 'modulos' && e.defeito) soma(r.porDefeito, e.defeito, c);
  }
  r.diasComRegistro = dias.size;
  return r;
}

/* Relatório de manutenção de um período (semana, mês, o que for): o resumo dos registros, a evolução
 * (por dia, semana ou mês), a comparação com o período anterior, a fila de conserto (avarias que voltaram
 * dos eventos) e as semanas em que ninguém registrou nada — para fiscalizar.
 * `tecnico`: o relatório de uma pessoa (os registros dela, a parte dela no total da equipe e os consertos
 * que ela concluiu). */
export function relatorioManutencao({ manutlog, manutencoes }, { de, ate, hoje, tecnico }) {
  const doPeriodo = (a, b) => (manutlog || []).filter(e => e.data >= a && e.data <= b);
  const daPessoa = es => (tecnico ? es.filter(e => (e.tecnico || '—') === tecnico) : es);
  const equipe = doPeriodo(de, ate);
  const regs = daPessoa(equipe).sort((a, b) => (a.data + (a.criado_em || '')).localeCompare(b.data + (b.criado_em || '')));
  const res = resumoManutencao(regs);
  const trocados = (res.porAcao.get('troca_modulo') || { modulos: 0 }).modulos;
  const fim = hoje && hoje < ate ? hoje : ate;            // o período pode terminar no futuro
  const totais = es => {
    const r = resumoManutencao(es);
    const t = (r.porAcao.get('troca_modulo') || { modulos: 0 }).modulos;
    return { trocados: t, reparados: r.modulos - t, modulos: r.modulos, cases: r.cases, horas: r.minutos / 60, registros: r.registros };
  };
  // período anterior do mesmo tamanho (para comparar)
  const dur = D.dif(de, ate) + 1;
  const anterior = Object.assign({ de: D.mais(de, -dur), ate: D.mais(de, -1) }, totais(daPessoa(doPeriodo(D.mais(de, -dur), D.mais(de, -1)))));
  // evolução: por dia (até 2 semanas), por semana (até ~6 meses) ou por mês
  const escala = dur <= 14 ? 'dia' : dur <= 186 ? 'semana' : 'mes';
  const evolucao = [];
  const proximo = s => (escala === 'dia' ? D.mais(s, 1) : escala === 'semana' ? D.mais(s, 7)
    : (() => { const [y, m] = s.split('-').map(Number); return new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10); })());
  const inicio = escala === 'dia' ? de : escala === 'semana' ? D.inicioSemana(de) : de.slice(0, 8) + '01';
  for (let s = inicio; s <= ate && evolucao.length < 400; s = proximo(s)) {
    const a = s < de ? de : s, b0 = D.mais(proximo(s), -1), b = b0 > ate ? ate : b0;
    evolucao.push(Object.assign({ de: a, ate: b, futuro: hoje ? a > hoje : false }, totais(regs.filter(e => e.data >= a && e.data <= b))));
  }
  // semanas (seg–dom) do período sem nenhum registro. Pedaço de semana com menos de 4 dias no período
  // (um domingo solto no começo do mês, a semana corrente antes de quinta) não conta.
  const semanasSemRegistro = [];
  let semanasContadas = 0;
  for (let s = D.inicioSemana(de); s <= fim; s = D.mais(s, 7)) {
    const a = s < de ? de : s, b = D.mais(s, 6) > fim ? fim : D.mais(s, 6);
    if (D.dif(a, b) + 1 < 4) continue;
    semanasContadas++;
    if (!regs.some(e => e.data >= a && e.data <= b)) semanasSemRegistro.push({ de: a, ate: b });
  }
  const dia = x => String(x || '').slice(0, 10);
  const fila = manutencoes || [];
  const entraram = tecnico ? [] : fila.filter(m => dia(m.aberta_em) >= de && dia(m.aberta_em) <= ate);
  const concluidas = fila.filter(m => m.status === 'concluida' && dia(m.concluida_em) >= de && dia(m.concluida_em) <= ate && (!tecnico || m.concluida_por === tecnico));
  // paradas no fim do período: abertas até lá e não concluídas até lá (é da equipe, não de uma pessoa)
  const paradas = tecnico ? [] : fila.filter(m => dia(m.aberta_em) && dia(m.aberta_em) <= fim && !(m.status === 'concluida' && dia(m.concluida_em) <= fim))
    .map(m => Object.assign({}, m, { dias_parado: D.dif(dia(m.aberta_em), fim) }))
    .sort((a, b) => b.dias_parado - a.dias_parado);
  const tot = totais(regs), totEquipe = totais(equipe);
  const parte = (x, y) => (y ? x / y : 0);
  return {
    de, ate, tecnico: tecnico || null, registros: regs, resumo: res, trocados, reparados: res.modulos - trocados,
    horas: res.minutos / 60, tecnicos: res.porPessoa.size, semanasSemRegistro, semanasContadas, escala, evolucao, anterior,
    participacao: tecnico ? { modulos: parte(tot.modulos, totEquipe.modulos), cases: parte(tot.cases, totEquipe.cases), registros: parte(tot.registros, totEquipe.registros), equipe: totEquipe } : null,
    fila: {
      entraram, concluidas, paradas,
      pecasEntraram: entraram.reduce((s, m) => s + num(m.qtd), 0),
      consertadas: concluidas.reduce((s, m) => s + num(m.consertadas), 0),
      descartadas: concluidas.reduce((s, m) => s + num(m.descartadas), 0),
      // concluída depois do fim do período: naquele dia ainda estava toda parada
      pecasParadas: paradas.reduce((s, m) => s + num(m.qtd) - (m.status === 'concluida' ? 0 : num(m.consertadas) + num(m.descartadas)), 0)
    }
  };
}

/* Quem já registrou manutenção (para o administrador escolher o relatório de cada um), do mais ativo ao menos */
export function tecnicosDaManutencao(manutlog) {
  const n = new Map();
  for (const e of manutlog || []) if (e.tecnico) n.set(e.tecnico, (n.get(e.tecnico) || 0) + 1);
  return [...n.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([t]) => t);
}

/* Períodos prontos para o relatório (a semana vai de segunda a domingo) */
export function periodoRelatorio(tipo, hoje) {
  const ini = D.inicioSemana(hoje);
  const mes = (iso, k) => { const [a, m] = iso.split('-').map(Number); const d = new Date(Date.UTC(a, m - 1 + k, 1)); return d.toISOString().slice(0, 10); };
  const m0 = hoje.slice(0, 8) + '01';
  if (tipo === 'semana') return { de: ini, ate: D.mais(ini, 6) };
  if (tipo === 'semana_passada') return { de: D.mais(ini, -7), ate: D.mais(ini, -1) };
  if (tipo === 'mes') return { de: m0, ate: D.mais(mes(m0, 1), -1) };
  if (tipo === 'mes_passado') return { de: mes(m0, -1), ate: D.mais(m0, -1) };
  if (tipo === 'tres_meses') return { de: mes(m0, -2), ate: D.mais(mes(m0, 1), -1) };
  return null;
}

/* Produção da bancada num período: por pessoa e por tipo. */
export function resumoProducao(entradas, { de, ate } = {}) {
  const porPessoa = new Map(), porTipo = new Map();
  let registros = 0, pecas = 0, minutos = 0;
  for (const e of entradas || []) {
    if (de && e.data < de) continue;
    if (ate && e.data > ate) continue;
    registros++;
    const q = num(e.qtd), mi = num(e.minutos);
    pecas += q; minutos += mi;
    const p = e.tecnico || '—';
    if (!porPessoa.has(p)) porPessoa.set(p, { registros: 0, pecas: 0, minutos: 0 });
    const pp = porPessoa.get(p); pp.registros++; pp.pecas += q; pp.minutos += mi;
    const t = e.tipo || 'outro';
    if (!porTipo.has(t)) porTipo.set(t, { registros: 0, pecas: 0 });
    const tt = porTipo.get(t); tt.registros++; tt.pecas += q;
  }
  return { registros, pecas, minutos, porPessoa, porTipo };
}

/* ============================================================
 * Utilidades
 * ============================================================ */

export function indexar(lista) {
  if (lista instanceof Map) return lista;
  const m = new Map();
  for (const x of lista || []) m.set(x.id, x);
  return m;
}

export function agrupar(lista, campo) {
  const m = new Map();
  for (const x of lista || []) {
    const k = x[campo];
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(x);
  }
  return m;
}

/* Duplicar uma lista: copia telas e linhas, zera separação/retorno e mantém travas e recusas
 * (o técnico já tinha decidido aquilo para um evento igual).
 */
export function duplicarLista(lista, linhas, { novoId, hoje, por }) {
  const id = novoId();
  const mapaTela = new Map();
  const telas = (lista.telas || []).map(t => { const nt = Object.assign({}, t, { id: novoId() }); mapaTela.set(t.id, nt.id); return nt; });
  const nova = Object.assign({}, lista, {
    id, status: 'rascunho', telas, criada_em: hoje, criada_por: por || null,
    ida: null, volta: null, os: '', evento: (lista.evento || '') + ' (cópia)',
    sep: null, conf: null, ret: null, origem: lista.id,
    grupo: null // a cópia é uma lista solta, não mais uma sala do evento de origem
  });
  const novas = (linhas || []).map(l => Object.assign({}, l, {
    id: novoId(), lista: id,
    origens: (l.origens || []).map(o => Object.assign({}, o, { tela: o.tela ? mapaTela.get(o.tela) || null : null })),
    sep_qtd: null, sep_marca: null, sep_por: null, sep_em: null,
    ret_ok: null, ret_avaria: null, ret_por: null, ret_em: null
  }));
  return { lista: nova, linhas: novas };
}

/* ---------------- evento com várias salas (sublistas) ----------------
 * Cada sala/hotel do evento é uma lista própria (separa, confere, carrega e volta à parte) e todas
 * têm o mesmo `grupo`. O evento é só o conjunto: não tem itens próprios.
 */
export function salasDoEvento(listas, grupo) {
  if (!grupo) return [];
  return (listas || []).filter(l => l.grupo === grupo)
    .sort((a, b) => (a.ordem_sala ?? 999) - (b.ordem_sala ?? 999) || String(a.criada_em || '').localeCompare(String(b.criada_em || '')) || String(a.sala || '').localeCompare(String(b.sala || '')));
}

/* Quanto o evento inteiro leva de cada item, e quanto vai para cada sala (canceladas não contam) */
export function totaisEvento(salas, linhas) {
  const ids = new Set(salas.filter(l => l.status !== 'cancelada').map(l => l.id));
  const porItem = new Map();
  for (const l of linhas || []) {
    if (!ids.has(l.lista) || !linhaAtiva(l)) continue;
    if (!porItem.has(l.item)) porItem.set(l.item, { item: l.item, total: 0, porSala: new Map() });
    const t = porItem.get(l.item);
    t.total += +l.qtd || 0;
    t.porSala.set(l.lista, (t.porSala.get(l.lista) || 0) + (+l.qtd || 0));
  }
  return porItem;
}

/* Status do evento a partir das salas: o mais atrasado manda ("ainda separando" se uma sala não terminou) */
const ORDEM_STATUS = ['rascunho', 'pronta', 'separando', 'separada', 'em_evento', 'retornada'];
export function statusEvento(salas) {
  const vivas = salas.filter(l => l.status !== 'cancelada');
  if (!vivas.length) return 'cancelada';
  return vivas.map(l => l.status).sort((a, b) => ORDEM_STATUS.indexOf(a) - ORDEM_STATUS.indexOf(b))[0];
}

/* Passa telas de uma sala para outra (as linhas de cada uma são recalculadas depois pelas regras) */
export function moverTelas(origem, destino, idsTelas) {
  const ids = new Set(idsTelas);
  const vao = (origem.telas || []).filter(t => ids.has(t.id));
  return {
    origem: Object.assign({}, origem, { telas: (origem.telas || []).filter(t => !ids.has(t.id)) }),
    destino: Object.assign({}, destino, { telas: (destino.telas || []).concat(vao) })
  };
}
