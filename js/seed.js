/* Projetech · Painel de LED — dados iniciais.
 *
 * CATÁLOGO: a "LISTA ZERADA" da planilha "Lista - Painel de Led e Racks de energia - PROJETECH EVENTOS.xlsx"
 * (versão de 13/10/2026), na mesma ordem (é a ordem do galpão e é a que a equipe já conhece).
 * Quantidades: SÓ a aba "INVENTÁRIO (NOVO)". Em branco lá = null = "não contado" (o sistema não acusa
 * falta do que não sabe; quem contar preenche no Catálogo).
 *
 * PAINÉIS: medidas, pixels, peso e consumo vêm do Projetech Calculator (PANELS).
 * gabinetes por circuito (12) e pixels por porta (650.000) são PADRÃO A CONFIRMAR.
 *
 * REGRAS: tiradas de ~60 telas das listas conferidas (pasta "LISTAS (ATUALIZADO)").
 * Cada uma diz em obs de onde saiu. Tudo editável na tela de Regras.
 */

const V10 = { modelo: 'Absen Polaris V10 P2.9', larg_m: 0.5, alt_m: 0.5, px_l: 168, px_a: 168, kg: 8, w_max: 135, w_med: 45, por_case: 6, por_circuito: 12, px_porta: 650000 };
const V10Q = Object.assign({}, V10, { modelo: 'Absen Polaris V10 P2.9 · Quina', kg: 8.1 });
const NT = { modelo: 'Absen NT P2.9', larg_m: 0.5, alt_m: 0.5, px_l: 168, px_a: 168, kg: 7.8, w_max: 124.5, w_med: 41.5, por_case: 8, por_circuito: 12, px_porta: 650000 };
const NTF = Object.assign({}, NT, { modelo: 'Absen NT P2.9 · Flexível', kg: 7.7 });
const NTQ = Object.assign({}, NT, { modelo: 'Absen NT P2.9 · Quina', kg: 7.7 });
const NT2 = { modelo: 'Absen NT P2.9 · 0,5×1 m', larg_m: 0.5, alt_m: 1, px_l: 168, px_a: 336, kg: 13.2, w_max: 249, w_med: 83, por_case: 4, por_circuito: 3, px_porta: 650000 };
const LV = { modelo: 'LiteVision P2.9', larg_m: 0.5, alt_m: 0.5, px_l: 168, px_a: 168, kg: 7.8, w_max: 135, w_med: 45, por_case: 6, por_circuito: 12, px_porta: 650000 };
const P39 = { modelo: 'Absen D3V P3.9', larg_m: 0.5, alt_m: 0.5, px_l: 128, px_a: 128, kg: 9.2, w_max: 127.5, w_med: 42.5, por_case: 6, por_circuito: 12, px_porta: 650000 };
// P1.9 (03/11/2026): Absen NT V2, dados do Calculator v327 (PANELS: 256×256 px, 7,4 kg, 40/123,8 W, 8 por case)
// porta: 655.360 px = 10 placas de 256 × 256 (capacidade da porta Novastar de 1 Gbps)
const P19 = { modelo: 'Absen NT V2 P1.9', larg_m: 0.5, alt_m: 0.5, px_l: 256, px_a: 256, kg: 7.4, w_max: 123.8, w_med: 40, por_case: 8, por_circuito: 12, px_porta: 655360 };
const P19Q = Object.assign({}, P19, { modelo: 'Absen NT V2 P1.9 · Quina', kg: 8.1 });

// [id, nome, categoria, qtd, extra]
const ITENS = [
  // ---------- coluna da esquerda da lista zerada ----------
  ['led-p39-l1', 'Case de Led P3.9mm Absen Lote 1', 'led', 67, { painel: P39 }],
  ['led-p39-l2', 'Case de Led P3.9mm Absen Lote 2', 'led', 33, { painel: P39 }],
  ['led-v10', 'Case de Led P2.9mm Absen V10 Reto', 'led', 233.3, { painel: V10 }],
  ['led-v10-q1', 'Case de Led P2.9mm Absen V10 Quina Lote 1', 'led', 26.66, { painel: V10Q }],
  ['led-v10-q2', 'Case de Led P2.9mm Absen V10 Quina Lote 2', 'led', 17, { painel: V10Q }],
  ['led-nt', 'Case de Led P2.9mm Absen NT Reto', 'led', 25, { painel: NT }],
  ['led-nt-flex', 'Case de Led P2.9mm Absen NT Flexível', 'led', 50, { painel: NTF }],
  ['led-nt-q', 'Case de Led P2.9mm Absen NT Quina', 'led', 25, { painel: NTQ }],
  ['led-nt-50x100', 'Case de Led P2.9mm Absen NT 50x100', 'led', 75, { painel: NT2 }],
  ['led-lv', 'Case de Led P2.9mm LiteVision', 'led', 54, { painel: LV }],
  ['mf-192', 'Mão francesa 1,92 m', 'estrutura', 220],
  ['mf-144', 'Mão francesa 1,44 m', 'estrutura', 144],
  ['mf-096', 'Mão francesa 0,96 m', 'estrutura', 88],
  ['par-mf', 'Parafuso de mão francesa', 'estrutura', null],
  ['peso', 'Peso de sustentação', 'estrutura', 583],
  ['prancha', 'Prancha 1,5 m', 'estrutura', 53],
  ['barra-mf', 'Barra de apoio para mão francesa 1,5 m', 'estrutura', 46],
  ['linha-nivel', 'Linha para nivelar painel', 'ferramenta', null],
  ['pe-cabra', 'Pé de cabra', 'ferramenta', 5],
  ['cunha', 'Cunha plástica', 'estrutura', null],
  ['allen-lv', 'Chave Allen LiteVision', 'ferramenta', 3],
  ['chave-1415', 'Chave 14/15', 'ferramenta', null],
  ['parafusadeira', 'Parafusadeira elétrica', 'ferramenta', 5],
  ['cinta-1m', 'Cinta catraca 1 m', 'transporte', 187],
  ['cinta-10m', 'Cinta catraca 10 m', 'transporte', 33],
  ['chap-p39', 'Chapinha de P3.9', 'fixacao', null],
  ['chap-v10', 'Chapinha de P2.9 V10 Reto', 'fixacao', null],
  ['chap-v10q', 'Chapinha de P2.9 V10 Quina', 'fixacao', null],
  ['chap-nt', 'Chapinha de P2.9 NT Reto', 'fixacao', null],
  ['chap-nt-flex', 'Chapinha de P2.9 NT Flexível', 'fixacao', null],
  ['chap-nt-q', 'Chapinha de P2.9 NT Quina', 'fixacao', null],
  ['chap-lv', 'Chapinha de P2.9 LiteVision', 'fixacao', null],
  ['par-chap-v10', 'Parafuso de chapinha de P2.9 V10 Reto', 'fixacao', null],
  ['par-chap-v10q', 'Parafuso de chapinha de P2.9 V10 Quina', 'fixacao', null],
  ['par-chap-nt', 'Parafuso de chapinha de P2.9 NT Reto', 'fixacao', null],
  ['par-chap-nt-flex', 'Parafuso de chapinha de P2.9 NT Flexível', 'fixacao', null],
  ['par-chap-nt-q', 'Parafuso de chapinha de P2.9 NT Quina', 'fixacao', null],
  ['par-chap-lv', 'Parafuso de chapinha de P2.9 LiteVision', 'fixacao', null],
  ['madeira-apoio', 'Madeira para apoio do painel', 'estrutura', null, { un: 'm' }],
  ['vidro', 'Vidro 0,5 m x 1 m', 'acessorio', null],
  ['allen-vidro', 'Chave Allen para chapinha vidro', 'ferramenta', null],
  ['chap-vidro', 'Chapinha de elevação para vidro', 'acessorio', null],
  ['par-vidro', 'Parafuso para chapinha vidro', 'acessorio', null],
  ['silicone-vidro', 'Silicone anti-impacto para vidro', 'acessorio', null],
  ['saca-modulo', 'Saca módulos', 'ferramenta', null],
  ['escova', 'Escova anti-estática', 'ferramenta', null],
  ['rolo-mascara', 'Rolo de fixar máscara', 'consumivel', null],
  ['abracadeira', 'Abraçadeira plástica (pacote)', 'consumivel', null],
  // ---------- coluna da direita ----------
  ['regua-pc', 'Régua Steck/Powercon', 'energia', 95],
  ['pc-10m', 'Cabo powercon 10 m', 'energia', 265],
  ['pc-15', 'Cabo powercon 1,5 m', 'energia', 300],
  ['pc-1m', 'Cabo powercon 1 m', 'energia', 3440],
  ['pc-pial-m10', 'Cabo powercon/pial macho 10 m', 'energia', 80],
  ['pc-pial-m1', 'Cabo powercon/pial macho 1 m', 'energia', 8],
  ['pc-pial-f', 'Cabo powercon/pial fêmea', 'energia', 15],
  ['rj-20m', 'Cabo RJ45 20 m', 'dados', 270],
  ['rj-15', 'Cabo RJ45 1,5 m', 'dados', 300],
  ['rj-5m', 'Cabo RJ45 5 m', 'dados', null],
  ['rj-10m', 'Cabo RJ45 10 m', 'dados', 31],
  ['rj-1m', 'Cabo RJ45 1 m', 'dados', 3560],
  ['banheira', 'Banheira RJ45', 'dados', 5],
  ['send-660', 'Sending card 660', 'processamento', 14],
  ['taurus-tb1', 'Taurus TB1', 'processamento', 10],
  ['taurus-tb60', 'Taurus TB60', 'processamento', 2],
  ['bumper-p39-05', 'Bumper P3.9 0,5 m', 'estrutura', null],
  ['bumper-p39-1', 'Bumper P3.9 1 m', 'estrutura', null],
  ['totem-1x2', 'Estrutura Totem de Led 1 m x 2 m', 'acessorio', 6],
  ['totem-05x2', 'Estrutura Totem de Led 0,5 m x 2 m', 'acessorio', 6],
  ['usb-ab', 'Cabo USB Tipo AB', 'processamento', 10],
  ['spray', 'Spray preto fosco', 'consumivel', 2],
  ['rack-12', 'Rack de energia Steck (12 saídas)', 'energia', 1],
  ['rack-9', 'Rack de energia Steck (9 saídas)', 'energia', 15],
  ['rack-5', 'Rack de energia Steck (5 saídas)', 'energia', 8],
  ['camlock-150', 'Cabo Camlock 150A', 'energia', null],
  ['camlock-400', 'Cabo Camlock 400A', 'energia', 5],
  ['prol-curta', 'Prolonga Steck curta', 'energia', 36],
  ['prol-media', 'Prolonga Steck média', 'energia', 116],
  ['prol-longa', 'Prolonga Steck longa', 'energia', 35],
  ['regua-pial-sem', 'Régua Steck/pial — sem disjuntor', 'energia', 48],
  ['regua-pial-com', 'Régua Steck/pial — com disjuntor', 'energia', 28],
  ['rabicho', 'Rabicho Steck/pial fêmea', 'energia', 42],
  ['cabo-pv', 'Cabo terminal/ponta viva (p.v.)', 'energia', null],
  ['chap-q-preta-nova', 'Chapinha preta P2 Quina (NOVA)', 'fixacao', null],
  ['chap-q-preta-antiga', 'Chapinha preta P2 Quina (ANTIGA)', 'fixacao', null],
  ['chap-q-prata', 'Chapinha prata P2 Quina', 'fixacao', null],
  ['allen-q-preta', 'Chave Allen chapinha preta P2 Quina', 'ferramenta', null],
  ['allen-q-prata', 'Chave Allen chapinha prata P2 Quina', 'ferramenta', null],
  ['par-q-preta-nova', 'Parafuso de chapinha preta P2 Quina (NOVA)', 'fixacao', null],
  ['par-q-preta-antiga', 'Parafuso de chapinha preta P2 Quina (ANTIGA)', 'fixacao', null],
  ['par-q-prata', 'Parafuso de chapinha prata P2 Quina', 'fixacao', null],
  ['balcao-base', 'Base para balcão de led', 'acessorio', null],
  ['balcao-madeira', 'Madeira para estrutura interna do balcão', 'acessorio', null],
  ['balcao-prateleira', 'Madeira para apoio (prateleira) do balcão', 'acessorio', null],
  ['balcao-parafuso', 'Parafuso para fixação da madeira interna', 'acessorio', null],
  ['cubo-madeira', 'Madeira para apoio de base (cubo)', 'acessorio', null],
  ['cubo-folha', 'Madeira entre cubos (folha)', 'acessorio', null],
  ['fita-isolante', 'Fita isolante', 'consumivel', null],
  // fora da lista zerada nova, mas aparece nas listas conferidas
  ['fita-crepe', 'Fita crepe preta', 'consumivel', null, { obs: 'aparece em 1/3 das listas conferidas' }],
  ['pc-lv', 'Cabo powercon LiteVision', 'energia', 300, { obs: 'linha nova no fim do inventário novo' }],
  ['cabo-dc-lv', 'Cabo DC 5V LiteVision', 'energia', null],
  ['controle-rgb', 'Controle LED/RGB', 'acessorio', null],
  ['cvt10', 'Conversor de fibra CVT10-S Novastar', 'processamento', null],
  // P1.9 (pedido de 03/11/2026): entram logo depois do LiteVision (ordem 100). Estoque informado pelo Caio:
  // Reto 30 cases (240 placas, 60 m²), Quina 20 cases (160 placas, 40 m²)
  ['led-p19', 'Case de Led P1.9mm Absen NT V2 Reto', 'led', 30, { painel: P19, ordem: 101 }],
  ['led-p19-q', 'Case de Led P1.9mm Absen NT V2 Quina', 'led', 20, { painel: P19Q, ordem: 102 }]
];

/* Itens que entraram no catálogo depois da primeira versão: o app acrescenta os que faltam num catálogo
 * já gravado (sem mexer nos que existem). */
export const VERSAO_CATALOGO = 3; // 2: entram os P1.9 · 3: estoque dos P1.9 (30 e 20 cases)
export const ITENS_NOVOS = ['led-p19', 'led-p19-q']; // entraram depois da primeira versão do catálogo

export const CATEGORIAS = [
  ['led', 'Painel de LED'], ['estrutura', 'Estrutura'], ['fixacao', 'Chapinhas e parafusos'], ['energia', 'Energia'],
  ['dados', 'Dados'], ['processamento', 'Processamento'], ['acessorio', 'Acessórios'], ['ferramenta', 'Ferramentas'],
  ['transporte', 'Transporte'], ['consumivel', 'Consumíveis']
];

export function catalogoInicial() {
  return ITENS.map(([id, nome, cat, qtd, extra], i) => Object.assign(
    { id, nome, cat, un: cat === 'led' ? 'case' : 'un', qtd, peso_kg: null, ordem: i < 48 ? (i + 1) * 10 : 1000 + (i - 47) * 10, ativo: true, obs: '', painel: null },
    extra || {}
  ));
}

/* ---------- regras ---------- */
const slug = t => String(t).replace(/^@/, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();
const R = (o) => Object.assign({
  id: 'r-' + slug(o.item) + '-' + slug(o.base || 'gabinetes') + (o.cond ? '-se-' + slug(o.cond.base) : ''), ativa: true, escopo: 'tela', paineis: [], montagens: [], cond: null,
  base: 'gabinetes', fator: 1, reserva: 0, adicional: 0, arred: 'cima', multiplo: 0, minimo: 0, maximo: 0, obs: ''
}, o);

const CHAO = ['chao'];
const JUMPER_1M = ['led-p39-l1', 'led-p39-l2', 'led-v10', 'led-v10-q1', 'led-v10-q2', 'led-nt', 'led-nt-flex', 'led-nt-q', 'led-lv', 'led-p19', 'led-p19-q'];
const PAINEIS_CHAPINHA = [
  [['led-p39-l1', 'led-p39-l2'], 'chap-p39', null],
  [['led-v10'], 'chap-v10', 'par-chap-v10'],
  [['led-v10-q1', 'led-v10-q2'], 'chap-v10q', 'par-chap-v10q'],
  [['led-nt'], 'chap-nt', 'par-chap-nt'],
  [['led-nt-flex'], 'chap-nt-flex', 'par-chap-nt-flex'],
  [['led-nt-q'], 'chap-nt-q', 'par-chap-nt-q'],
  [['led-lv'], 'chap-lv', 'par-chap-lv']
];
// NT 50×100: gabinete de 1 m = duas fileiras de chapinha (L’Oréal 6 × 3 m, 36 gab: 30 chapinhas NT Reto + 60 parafusos)
const NT2_CHAPINHA = ['led-nt-50x100'];
const P19_CHAPINHA = ['led-p19', 'led-p19-q'];

/* Sobe a cada mudança nas regras padrão: aparelhos com as regras antigas (e não editadas) se atualizam sozinhos.
 * 3 = réguas, racks e cabos de dados vêm do projeto da tela (13/10/2026). */
export const VERSAO_REGRAS = 5; // 4: P1.9 usa jumper de 1 m · 5: P1.9 com chapinha do NT e parafuso do V10

export function regrasIniciais() {
  const r = [
    R({ item: '@painel', base: 'cases', adicional: 1, obs: 'Cases do painel + 1 de reserva. Nas listas conferidas a reserva variou de 1 a 3 cases.' }),
    R({ item: 'pc-1m', paineis: JUMPER_1M, base: 'gabinetes', reserva: 0.05, multiplo: 10, obs: 'Um jumper de energia por gabinete, +5%, em dezenas (Honda 84 gab → 90; Prati 168 → 180).' }),
    R({ item: 'rj-1m', paineis: JUMPER_1M, base: 'gabinetes', reserva: 0.05, multiplo: 10, obs: 'Um jumper de dados por gabinete, +5%, em dezenas — sempre igual ao powercon 1 m nas listas.' }),
    R({ item: 'pc-15', paineis: ['led-nt-50x100'], base: 'gabinetes', reserva: 0.05, multiplo: 10, obs: 'NT 50×100 (gabinete de 1 m de altura) usa jumper de 1,5 m — L’Oréal 6 × 3 m levou 50.' }),
    R({ item: 'rj-15', paineis: ['led-nt-50x100'], base: 'gabinetes', reserva: 0.05, multiplo: 10, obs: 'NT 50×100 usa jumper de dados de 1,5 m — L’Oréal 6 × 3 m levou 50.' }),
    R({ item: 'pc-10m', base: 'circuitos', adicional: 1, obs: 'Tronco de energia: 1 por circuito (12 gabinetes por circuito — confirmar) + 1 reserva.' }),
    R({ item: 'rj-20m', base: 'cabos_dados', adicional: 1, obs: 'Do projeto: 1 cabo de 20 m por porta de dados (2 com backup ligado na tela) + 1 reserva.' }),
    R({ item: 'regua-pc', base: 'reguas', obs: 'Do projeto: 1 régua Steck/Powercon por descida de energia (fecha colunas até 7,5 kW de consumo máximo — ajustável na tela).' }),
    R({ item: 'rack-9', base: 'racks_9', obs: 'Do projeto: racks de 9 saídas (até 4 réguas por rack — ajustável na tela).' }),
    R({ item: 'rack-12', base: 'racks_12', obs: 'Do projeto, quando a tela usa rack de 12 saídas.' }),
    R({ item: 'rack-5', base: 'racks_5', obs: 'Do projeto, quando a tela usa rack de 5 saídas.' }),
    R({ item: 'camlock-150', base: 'itens:rack-9,rack-12', fator: 5, obs: '5 camlocks por rack do painel (R, S, T, N e terra).' }),
    R({ item: 'prol-media', base: 'item:regua-pc', fator: 1.5, adicional: 2, maximo: 24, obs: 'Prolonga do rack até a régua: ≈ 1,5 por régua + 2, até 24.' }),
    R({ item: 'prol-longa', base: 'item:regua-pc', fator: 0.25, arred: 'baixo', maximo: 4, obs: '1 prolonga longa a cada 4 réguas, até 4.' }),

    R({ item: 'mf-192', base: 'mf_192', montagens: CHAO, obs: 'Peças de 1,92 m: cada apoio empilha peças até a altura do painel.' }),
    R({ item: 'mf-144', base: 'mf_144', montagens: CHAO, obs: 'Peças de 1,44 m (3,5 m = 1,92 + 1,44; 4,5 m = 1,92 + 1,44 + 0,96).' }),
    R({ item: 'mf-096', base: 'mf_096', montagens: CHAO, obs: 'Peças de 0,96 m (3 m = 1,92 + 0,96).' }),
    R({ item: 'mf-192', base: 'apoios', montagens: CHAO, cond: { base: 'altura_m', op: '>=', valor: 5 }, obs: 'Reforço em painel a partir de 5 m: +1 peça de 1,92 por apoio (Galderma 12×5, CAV 44×5,5).' }),
    R({ item: 'par-mf', base: 'itens:mf-192,mf-144,mf-096', fator: 2, multiplo: 10, montagens: CHAO, obs: '2 parafusos por peça de mão francesa, em dezenas.' }),
    R({ item: 'peso', base: 'itens:mf-192,mf-144,mf-096', fator: 2, teto: { base: 'apoios', fator: 5 }, montagens: CHAO, obs: '2 pesos por peça de mão francesa, no máximo 5 por apoio (Amgen 15×2 → 22; Honda 6×3,5 → 20; Galderma 12×5 → 45; Fico → 110).' }),
    R({ item: 'prancha', base: 'apoios', adicional: -2, minimo: 1, montagens: CHAO, obs: 'Pranchas de 1,5 m: apoios − 2 (Honda 6 m → 3; Prati 12 m → 7; Amgen 15 m → 9).' }),
    R({ item: 'barra-mf', base: 'apoios', adicional: -2, minimo: 1, montagens: CHAO, obs: 'Barra de apoio da mão francesa: nas listas de out/2026 vai junto com a prancha, mesma quantidade (Fico 11/11, SA+ 8/8). Confirmar.' }),
    R({ item: 'cunha', base: 'colunas', fator: 1.2, multiplo: 5, montagens: CHAO, obs: 'Cunha para nivelar: ≈ 1,2 por coluna, de 5 em 5 (Amgen 30 col. → 30; Lopes 28 → 30; Mulli 10 → 20).' })
  ];
  for (const [paineis, chap, par] of PAINEIS_CHAPINHA) {
    r.push(R({ item: chap, paineis, base: 'gabinetes', fator: 0.35, multiplo: 10, obs: '≈ 1 chapinha a cada 3 gabinetes (média das listas: 0,35), em dezenas.' }));
    if (par) r.push(R({ item: par, paineis, base: 'gabinetes', fator: 0.6, multiplo: 10, obs: '≈ 0,6 parafuso por gabinete (média das listas), em dezenas.' }));
  }
  r.push(
    R({ id: 'r-chap-nt-50x100', item: 'chap-nt', paineis: NT2_CHAPINHA, base: 'gabinetes', fator: 0.7, multiplo: 10, obs: 'NT 50×100 usa a chapinha do NT Reto, o dobro por gabinete (gabinete de 1 m): L’Oréal 36 gab → 30.' }),
    R({ id: 'r-par-chap-nt-50x100', item: 'par-chap-nt', paineis: NT2_CHAPINHA, base: 'gabinetes', fator: 1.4, multiplo: 10, obs: 'Parafusos da chapinha NT no 50×100: L’Oréal 36 gab → 60.' }),
    // P1.9 Absen NT V2 (Reto e Quina): chapinha do NT com o parafuso do V10 — informado pelo Caio em 03/11/2026
    R({ id: 'r-chap-nt-p19', item: 'chap-nt', paineis: P19_CHAPINHA, base: 'gabinetes', fator: 0.35, multiplo: 10, obs: 'P1.9 (NT V2) usa a chapinha do NT — ≈ 1 a cada 3 gabinetes, em dezenas, como os outros painéis.' }),
    R({ id: 'r-par-chap-v10-p19', item: 'par-chap-v10', paineis: P19_CHAPINHA, base: 'gabinetes', fator: 0.6, multiplo: 10, obs: 'P1.9 usa o parafuso da chapinha do V10 — ≈ 0,6 por gabinete, em dezenas.' })
  );
  // LiteVision: as 10 listas conferidas com LiteVision levaram cabo DC 5V de reserva e chave Allen
  r.push(
    R({ item: 'cabo-dc-lv', paineis: ['led-lv'], base: 'cases', fator: 0.4, multiplo: 5, minimo: 5, obs: 'Cabo DC de reserva: ≈ 1 a cada 2,5 cases, de 5 em 5 (listas LiteVision levaram de 5 a 20).' }),
    R({ item: 'allen-lv', paineis: ['led-lv'], base: 'cases', fator: 1 / 15, maximo: 3, obs: '1 chave Allen a cada 15 cases de LiteVision, até 3.' })
  );
  r.push(
    R({ escopo: 'lista', item: 'cinta-1m', base: 'cases', fator: 0.5, multiplo: 5, maximo: 45, obs: 'Cinta para amarrar a carga: 1 a cada 2 cases, de 5 em 5, até 45.' }),
    R({ escopo: 'lista', item: 'cinta-10m', base: 'cases', fator: 1 / 15, arred: 'baixo', maximo: 15, obs: '1 cinta de 10 m a cada 15 cases.' }),
    R({ escopo: 'lista', item: 'rack-5', base: 'lista', fator: 1, obs: '1 rack de 5 saídas por lista (processamento/backstage) — 5 das 6 listas de out/2026 levaram.' }),
    R({ escopo: 'lista', item: 'rabicho', base: 'item:regua-pial-sem', fator: 1.2, obs: 'Rabicho Steck/pial fêmea: ≈ 1 por régua pial sem disjuntor (todas as listas de out/2026 levaram: Amgen 4, Sandoz 4, Mulli 6).' }),
    R({ escopo: 'lista', item: 'pe-cabra', base: 'telas_chao', fator: 1, maximo: 1, obs: '1 pé de cabra por lista com painel no chão (todas as listas de outubro/2026 levaram).' }),
    R({ escopo: 'lista', item: 'chave-1415', base: 'gabinetes_chao', fator: 1 / 120, maximo: 4, obs: '1 chave 14/15 a cada 120 gabinetes no chão, até 4 (uma por montador).' }),
    R({ escopo: 'lista', item: 'prol-curta', base: 'lista', fator: 6, obs: '6 prolongas curtas por lista — as listas levaram de 4 a 8, sem relação com o tamanho.' }),
    R({ escopo: 'lista', item: 'fita-isolante', base: 'lista', fator: 3, obs: '3 fitas por lista…' }),
    R({ escopo: 'lista', item: 'fita-isolante', base: 'gabinetes', fator: 1 / 150, arred: 'baixo', maximo: 5, obs: '…+1 a cada 150 gabinetes (as listas levaram de 3 a 8).' }),
    R({ escopo: 'lista', item: 'abracadeira', base: 'lista', fator: 1, obs: '1 pacote por lista…' }),
    R({ escopo: 'lista', item: 'abracadeira', base: 'gabinetes', fator: 1 / 250, arred: 'baixo', maximo: 2, obs: '…+1 a cada 250 gabinetes.' }),
    R({ escopo: 'lista', item: 'pc-pial-f', base: 'lista', fator: 1, obs: '1 powercon/pial fêmea por lista…' }),
    R({ escopo: 'lista', item: 'pc-pial-f', base: 'gabinetes', fator: 1 / 200, arred: 'baixo', maximo: 4, obs: '…+1 a cada 200 gabinetes.' }),
    R({ escopo: 'lista', item: 'regua-pial-sem', base: 'lista', fator: 3, obs: '3 réguas pial sem disjuntor por lista (processamento/backstage)…' }),
    R({ escopo: 'lista', item: 'regua-pial-sem', base: 'gabinetes', fator: 1 / 100, arred: 'baixo', maximo: 5, obs: '…+1 a cada 100 gabinetes.' }),
    R({ escopo: 'lista', item: 'regua-pial-com', base: 'lista', fator: 3, obs: '3 réguas pial com disjuntor por lista…' }),
    R({ escopo: 'lista', item: 'regua-pial-com', base: 'gabinetes', fator: 1 / 150, arred: 'baixo', maximo: 3, obs: '…+1 a cada 150 gabinetes.' })
  );
  const vistos = new Set();
  for (const x of r) { if (vistos.has(x.id)) throw new Error('id de regra repetido: ' + x.id); vistos.add(x.id); }
  return r;
}

/* Tipos de trabalho de bancada (produção) — o que NÃO é manutenção de painel. */
export const TIPOS_PRODUCAO = [
  ['cabo_montado', 'Montagem de cabo'], ['cabo_reparo', 'Reparo de cabo'], ['case_organizado', 'Organização de case'],
  ['estrutura', 'Estrutura / mão francesa'], ['limpeza', 'Limpeza / organização do galpão'], ['contagem', 'Contagem / inventário'], ['outro', 'Outro']
];

/* Manutenção semanal de módulos: o que foi feito (ação), em quê (unidade) e por quê (defeito). */
export const ACOES_MANUT = [
  ['troca_modulo', 'Troca de módulo', 'modulos'], ['reparo_modulo', 'Reparo de módulo (LED/solda)', 'modulos'],
  ['fonte', 'Fonte', 'modulos'], ['receiving', 'Receiving card', 'modulos'], ['cabo_interno', 'Cabo interno / flat', 'modulos'],
  ['calibracao', 'Calibração / cor', 'modulos'], ['limpeza', 'Limpeza de módulos', 'cases'], ['revisao', 'Revisão / teste de case', 'cases'],
  ['outro', 'Outro', 'modulos']
];
export const DEFEITOS_MANUT = [
  ['pixel', 'Pixel / LED apagado'], ['faixa', 'Faixa ou linha'], ['cor', 'Cor errada / mancha'], ['apagado', 'Módulo apagado'],
  ['piscando', 'Piscando / sem sinal'], ['dano', 'Quebrado / amassado'], ['preventiva', 'Preventiva (sem defeito)'], ['outro', 'Outro']
];
export const UNIDADES_MANUT = [['modulos', 'módulos'], ['cases', 'cases'], ['gabinetes', 'gabinetes']];

// Defeitos da fila de conserto (o que voltou com avaria de um evento — qualquer item, não só painel).
export const DEFEITOS = ['Módulo queimado / pixel apagado', 'Módulo com faixa / cor errada', 'Fonte', 'Receiving card', 'Cabo rompido / conector', 'Gabinete amassado / trava', 'Outro'];
