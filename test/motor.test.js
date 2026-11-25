// Testes do motor — `node --test test/` dentro de led/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as M from '../js/motor.js';
import { catalogoInicial, regrasIniciais } from '../js/seed.js';

let n = 0;
const novoId = () => 'id' + (++n);

// Painel de exemplo da spec: P3.9 500×500 (128×128 px)
const P39 = { larg_m: 0.5, alt_m: 0.5, px_l: 128, px_a: 128, kg: 9.2, w_max: 127.5, w_med: 42.5, por_case: 6, por_circuito: 8, px_porta: 650000 };
const CAT = [
  { id: 'p39', nome: 'Case P3.9', cat: 'led', qtd: 100, ordem: 1, painel: P39 },
  { id: 'pc', nome: 'Powercon link', cat: 'energia', qtd: 2000, ordem: 3 },
  { id: 'rj', nome: 'RJ45 link', cat: 'dados', qtd: 2000, ordem: 2 },
  { id: 'tronco', nome: 'Powercon 10 m', cat: 'energia', qtd: 50, ordem: 4 },
  { id: 'dados', nome: 'RJ45 20 m', cat: 'dados', qtd: 50, ordem: 5 },
  { id: 'proc', nome: 'Processadora', cat: 'processamento', qtd: 3, ordem: 6 },
  { id: 'reserva', nome: 'Gabinete reserva', cat: 'led', qtd: 10, ordem: 7 },
  { id: 'saco', nome: 'Cabo em saco de 10', cat: 'energia', qtd: 500, ordem: 8 }
];
const REGRAS = [
  { id: 'r-pc', item: 'pc', base: 'gabinetes', fator: 1 },
  { id: 'r-rj', item: 'rj', base: 'gabinetes', fator: 1 },
  { id: 'r-tronco', item: 'tronco', base: 'circuitos', fator: 1 },
  { id: 'r-dados', item: 'dados', base: 'portas', fator: 1 },
  { id: 'r-proc', item: 'proc', base: 'portas', fator: 1 / 4 } // 1 processadora atende até 4 portas
];
const tela = (o) => Object.assign({ id: 't1', nome: 'Plenária', painel: 'p39', montagem: 'aereo' }, o);
const qtd = (r, item) => (r.itens.get(item) || { qtd: 0 }).qtd;

test('20 m² de P3.9 → 80 gabinetes → 80 powercon e 80 RJ45', () => {
  const r = M.calcularSugestoes([tela({ modo: 'm2', m2: 20 })], CAT, REGRAS);
  assert.equal(r.telas[0].bases.gabinetes, 80);
  assert.equal(qtd(r, 'pc'), 80);
  assert.equal(qtd(r, 'rj'), 80);
  const o = r.itens.get('pc').origens[0];
  assert.deepEqual([o.base, o.valor_base, o.fator, o.qtd], ['gabinetes', 80, 1, 80]); // justificativa estruturada
});

test('16 colunas × 5 linhas produz exatamente a mesma lista de 20 m²', () => {
  const a = M.calcularSugestoes([tela({ modo: 'm2', m2: 20 })], CAT, REGRAS);
  const b = M.calcularSugestoes([tela({ modo: 'grade', colunas: 16, linhas: 5 })], CAT, REGRAS);
  const c = M.calcularSugestoes([tela({ modo: 'medida', largura_m: 8, altura_m: 2.5 })], CAT, REGRAS);
  const lista = r => [...r.itens].map(([k, v]) => k + '=' + v.qtd).sort().join(',');
  assert.equal(lista(a), lista(b));
  assert.equal(lista(b), lista(c));
});

test('8 gabinetes por circuito → 10 circuitos → 10 troncos de energia', () => {
  const r = M.calcularSugestoes([tela({ modo: 'm2', m2: 20 })], CAT, REGRAS);
  assert.equal(r.telas[0].bases.circuitos, 10);
  assert.equal(qtd(r, 'tronco'), 10);
});

test('650.000 px por porta e 16.384 px por gabinete → 39 gab/porta → 3 portas, 3 troncos de dados, 1 processadora', () => {
  const r = M.calcularSugestoes([tela({ modo: 'm2', m2: 20 })], CAT, REGRAS);
  assert.equal(r.telas[0].bases.gab_por_porta, 39);
  assert.equal(r.telas[0].bases.portas, 3);
  assert.equal(qtd(r, 'dados'), 3);
  assert.equal(qtd(r, 'proc'), 1);
});

test('reserva de 5% em gabinetes → 4 (arredonda para cima)', () => {
  assert.equal(M.quantidadeDaRegra({ fator: 0.05 }, 80).qtd, 4);
  assert.equal(M.quantidadeDaRegra({ fator: 1, reserva: 0.05 }, 79).qtd, 83); // 82,95 → 83
});

test('cabo em saco de 10: regra que calcula 43 sugere 50', () => {
  assert.equal(M.quantidadeDaRegra({ fator: 1, multiplo: 10 }, 43).qtd, 50);
  assert.equal(M.quantidadeDaRegra({ fator: 1, multiplo: 10 }, 40).qtd, 40);
});

test('mínimo só vale quando a regra dispara; máximo corta', () => {
  assert.equal(M.quantidadeDaRegra({ fator: 1, minimo: 4 }, 0).qtd, 0);
  assert.equal(M.quantidadeDaRegra({ fator: 1, minimo: 4 }, 1).qtd, 4);
  assert.equal(M.quantidadeDaRegra({ fator: 1, maximo: 10 }, 30).qtd, 10);
  assert.equal(M.quantidadeDaRegra({ fator: 1 / 3 }, 9).qtd, 3); // 9 × 0,333… não pode virar 4
});

test('editar 80 powercon para 60 trava; recalcular mantém 60 e avisa que a regra sugeria 80', () => {
  const s = M.calcularSugestoes([tela({ modo: 'm2', m2: 20 })], CAT, REGRAS);
  let { linhas } = M.aplicarSugestoes([], s.itens, { novoId, listaId: 'L' });
  linhas = linhas.map(l => (l.item === 'pc' ? M.editarQuantidade(l, 60) : l));
  assert.equal(linhas.find(l => l.item === 'pc').travado, true);
  ({ linhas } = M.aplicarSugestoes(linhas, s.itens, { novoId, listaId: 'L' }));
  assert.equal(linhas.find(l => l.item === 'pc').qtd, 60);
  assert.deepEqual(M.divergencias(linhas).map(d => [d.item, d.qtd, d.sug]), [['pc', 60, 80]]);
});

test('segunda tela de 10 m²: travado continua 60 e o aviso passa a mostrar 120 — nunca perde a edição em silêncio', () => {
  const s1 = M.calcularSugestoes([tela({ modo: 'm2', m2: 20 })], CAT, REGRAS);
  let { linhas } = M.aplicarSugestoes([], s1.itens, { novoId, listaId: 'L' });
  linhas = linhas.map(l => (l.item === 'pc' ? M.editarQuantidade(l, 60) : l));
  const s2 = M.calcularSugestoes([tela({ modo: 'm2', m2: 20 }), tela({ id: 't2', nome: 'Foyer', modo: 'm2', m2: 10 })], CAT, REGRAS);
  ({ linhas } = M.aplicarSugestoes(linhas, s2.itens, { novoId, listaId: 'L' }));
  const pc = linhas.find(l => l.item === 'pc');
  assert.equal(pc.qtd, 60);
  assert.equal(pc.sug, 120);
  assert.equal(linhas.find(l => l.item === 'rj').qtd, 120); // a não travada soma normalmente
  // voltar ao sugerido destrava
  assert.equal(M.editarQuantidade(pc, 120).travado, false);
});

test('duas telas que geram o mesmo item somam numa linha só, com as duas origens', () => {
  const s = M.calcularSugestoes([tela({ modo: 'm2', m2: 20 }), tela({ id: 't2', nome: 'Foyer', modo: 'm2', m2: 10 })], CAT, REGRAS);
  const { linhas } = M.aplicarSugestoes([], s.itens, { novoId, listaId: 'L' });
  const pcs = linhas.filter(l => l.item === 'pc');
  assert.equal(pcs.length, 1);
  assert.equal(pcs[0].qtd, 120);
  assert.deepEqual(pcs[0].origens.map(o => o.tela_nome), ['Plenária', 'Foyer']);
});

test('sugestão removida fica recusada e não volta no recálculo', () => {
  const s = M.calcularSugestoes([tela({ modo: 'm2', m2: 20 })], CAT, REGRAS);
  let { linhas } = M.aplicarSugestoes([], s.itens, { novoId, listaId: 'L' });
  linhas = linhas.map(l => (l.item === 'proc' ? Object.assign({}, l, { recusado: true }) : l));
  ({ linhas } = M.aplicarSugestoes(linhas, s.itens, { novoId, listaId: 'L' }));
  assert.equal(linhas.find(l => l.item === 'proc').recusado, true);
  assert.equal(M.linhaAtiva(linhas.find(l => l.item === 'proc')), false);
});

test('mudar de 20 para 25 m² com a lista em separação: diff aparece e nenhum check some', () => {
  const s20 = M.calcularSugestoes([tela({ modo: 'm2', m2: 20 })], CAT, REGRAS);
  let { linhas } = M.aplicarSugestoes([], s20.itens, { novoId, listaId: 'L' });
  linhas = linhas.map(l => M.marcarSeparado(l, { por: 'Zé', em: '2026-10-13T10:00' }));
  const antes = M.progressoSeparacao(linhas);
  assert.equal(antes.pct, 100);
  const s25 = M.calcularSugestoes([tela({ modo: 'm2', m2: 25 })], CAT, REGRAS);
  const r = M.aplicarSugestoes(linhas, s25.itens, { novoId, listaId: 'L' });
  assert.ok(r.diff.some(d => d.item === 'pc' && d.de === 80 && d.para === 100));
  const pc = r.linhas.find(l => l.item === 'pc');
  assert.equal(pc.sep_qtd, 80); // o que foi ticado continua ticado
  assert.equal(pc.sep_por, 'Zé');
  assert.equal(M.statusSeparacao(pc), 'parcial'); // falta separar +20, mas nada foi desmarcado
});

test('regra em ciclo é detectada e reportada, sem travar', () => {
  const regras = REGRAS.concat([
    { id: 'ciclo-a', item: 'saco', base: 'item:reserva', fator: 1 },
    { id: 'ciclo-b', item: 'reserva', base: 'item:saco', fator: 1 }
  ]);
  const r = M.calcularSugestoes([tela({ modo: 'm2', m2: 20 })], CAT, regras);
  assert.deepEqual(r.erros.filter(e => e.tipo === 'ciclo').map(e => e.regra).sort(), ['ciclo-a', 'ciclo-b']);
  assert.equal(qtd(r, 'pc'), 80); // o resto continua funcionando
});

test('regra encadeada: item derivado dispara outra regra', () => {
  const regras = REGRAS.concat([{ id: 'saco', item: 'saco', base: 'item:tronco', fator: 4.3 }]);
  const r = M.calcularSugestoes([tela({ modo: 'm2', m2: 20 })], CAT, regras);
  assert.equal(qtd(r, 'saco'), 43);
});

test('mão francesa: a pilha do Calculator (mais perto do topo sem passar, a maior embaixo)', () => {
  const p = h => M.pilhaMaoFrancesa(h).pilha.join(' + ');
  assert.equal(p(3), '1.92 + 0.96');
  assert.equal(p(3.5), '1.92 + 1.44');
  assert.equal(p(4), '1.92 + 1.92');
  assert.equal(p(4.6), '1.92 + 1.44 + 0.96');   // painel central do desenho: 4 m sobre palco de 0,60
  assert.equal(p(5), '1.92 + 1.92 + 0.96');
  assert.equal(M.pilhaMaoFrancesa(0.9), null);    // mais baixo que 0,96: sem mão francesa
  // fileiras: emenda a emenda, de 1,5 em 1,5 m, as duas pontas sempre
  assert.deepEqual(M.fileirasMaoFrancesa(6, 0.5), [0.5, 2, 3.5, 5, 5.5]);
  assert.equal(M.fileirasMaoFrancesa(8, 0.5).length, 6);
  assert.equal(M.fileirasMaoFrancesa(20, 0.5).length, 14);
});

test('estrutura com palco e segunda linha (desenho da equipe: central 4 m sobre palco 0,60; laterais 4,5 m)', () => {
  const V10 = { larg_m: 0.5, alt_m: 0.5 };
  const est = (palco, h = 4) => M.estruturaTela({ montagem: 'chao', modo: 'medida', largura_m: 6, altura_m: h, palco }, V10);
  // central: mão francesa sai do chão, atrás do palco → alcança 4,60 m: 1,92 + 1,44 + 0,96, segunda linha, 5 pesos
  const c = est({ sobre: true, altura_m: 0.6, mf: 'chao' });
  assert.equal(c.alto, 4.6);
  assert.deepEqual(c.pilha, [1.92, 1.44, 0.96]);
  assert.equal(c.segunda_linha, true);
  assert.equal(c.pesos, 5);
  // a mesma, apoiada no palco (fundo de 2 m): o palco não conta → 4 m, sem segunda linha, 4 pesos
  const p = est({ sobre: true, altura_m: 0.6, fundo_m: 2, mf: 'palco' });
  assert.equal(p.alto, 4);
  assert.equal(p.noPalco, true);
  assert.equal(p.segunda_linha, false);
  assert.equal(p.pesos, 4);
  // palco raso (0,70 m de fundo): não cabe, ela vai no chão
  const r = est({ sobre: true, altura_m: 0.6, fundo_m: 0.7, mf: 'palco' });
  assert.equal(r.raso, true);
  assert.equal(r.alto, 4.6);
  // lateral de 4,5 m no chão: segunda linha também
  assert.equal(est(null, 4.5).segunda_linha, true);
  assert.equal(M.estruturaTela({ montagem: 'aereo', modo: 'medida', largura_m: 6, altura_m: 3 }, V10), null);
});
test('regras da casa no Honda 6 × 3,5 m reproduzem a lista conferida', () => {
  const cat = catalogoInicial(), regras = regrasIniciais();
  const r = M.calcularSugestoes([{ id: 't', nome: 'Plenária', painel: 'led-v10', modo: 'medida', largura_m: 6, altura_m: 3.5, montagem: 'chao' }], cat, regras);
  assert.deepEqual(r.erros, []);
  const q = id => (r.itens.get(id) || { qtd: 0 }).qtd;
  // Lista "Honda - 26140": 15 cases, 90 powercon 1 m, 90 RJ45 1 m, 5 + 5 mão francesa, 20 parafusos, 3 pranchas, 1 rack 9, 5 camlocks.
  // Réguas agora vêm do projeto: o projeto da Abbvie desenha 2 descidas num painel 6 × 3,5 m (a lista antiga levou 4).
  assert.equal(q('led-v10'), 15);
  assert.equal(q('pc-1m'), 90);
  assert.equal(q('rj-1m'), 90);
  assert.equal(q('mf-192'), 5);
  assert.equal(q('mf-144'), 5);
  assert.equal(q('par-mf'), 20);
  assert.equal(q('prancha'), 3);
  assert.equal(q('regua-pc'), 2);
  assert.equal(q('rj-20m'), 5); // 4 portas + 1 reserva
  assert.equal(q('rack-9'), 1);
  // a lista antiga levou 5 (só o rack 9); hoje vai também o rack 5 do processamento, com 3 camlocks (Borges e Costa, nov/2026: 8)
  assert.equal(q('camlock-150'), 8);
  assert.equal(q('peso'), 20);
});

test('regras da casa: totem (fora do chão) não ganha mão francesa nem peso', () => {
  const r = M.calcularSugestoes([{ id: 't', painel: 'led-v10', modo: 'medida', largura_m: 1, altura_m: 2, montagem: 'totem' }], catalogoInicial(), regrasIniciais());
  assert.equal(r.itens.has('mf-192'), false);
  assert.equal(r.itens.has('peso'), false);
  assert.equal(r.itens.get('led-v10').qtd, 3); // 8 gabinetes → 2 cases + 1
});

test('retorno: o que faltou vira baixa (reversível) e o que voltou quebrado vira manutenção', () => {
  const lista = { id: 'L' };
  let linhas = [
    { id: 'a', lista: 'L', item: 'pc', qtd: 90, origem: 'regra' },
    { id: 'b', lista: 'L', item: 'rj', qtd: 90, origem: 'regra' },
    { id: 'c', lista: 'L', item: 'tronco', qtd: 9, origem: 'regra' }
  ].map(l => M.marcarSeparado(l, {}));
  linhas[0] = Object.assign({}, linhas[0], { ret_ok: 84, ret_avaria: 0 });
  linhas[1] = Object.assign({}, linhas[1], { ret_ok: 88, ret_avaria: 2 });
  let r = M.fecharRetorno(lista, linhas, { novoId, hoje: '2026-10-20', por: 'Zé' });
  assert.equal(r.ok, false); // linha c sem resposta
  assert.deepEqual(r.semResposta, ['c']);
  linhas[2] = Object.assign({}, linhas[2], { ret_ok: 9 });
  r = M.fecharRetorno(lista, linhas, { novoId, hoje: '2026-10-20', por: 'Zé' });
  assert.equal(r.ok, true);
  assert.deepEqual(r.movimentos.map(m => [m.item, m.qtd, m.tipo]), [['pc', -6, 'perda']]);
  assert.deepEqual(r.manutencoes.map(m => [m.item, m.qtd]), [['rj', 2]]);
  const est = M.estoqueAtual(CAT, r.movimentos);
  assert.equal(est.get('pc'), 1994);
  const volta = M.recuperarPerda(r.movimentos[0], { novoId, hoje: '2026-10-25', por: 'Caio', qtd: 4 });
  assert.equal(M.estoqueAtual(CAT, r.movimentos.concat([volta])).get('pc'), 1998);
});

test('estoque: outra lista no mesmo período + manutenção → falta acusada no dia certo', () => {
  const estado = {
    catalogo: CAT,
    movimentos: [{ item: 'tronco', qtd: -5 }],
    manutencoes: [{ id: 'm', item: 'tronco', qtd: 10, status: 'aberta' }, { id: 'm2', item: 'tronco', qtd: 30, status: 'concluida' }],
    listas: [
      { id: 'A', status: 'pronta', ida: '2026-10-10', volta: '2026-10-12' },
      { id: 'B', status: 'pronta', ida: '2026-10-12', volta: '2026-10-14' },
      { id: 'C', status: 'retornada', ida: '2026-10-12', volta: '2026-10-14' },
      { id: 'D', status: 'rascunho', ida: '2026-10-12', volta: '2026-10-14' }
    ],
    linhas: [
      { id: 1, lista: 'A', item: 'tronco', qtd: 20 },
      { id: 2, lista: 'B', item: 'tronco', qtd: 20 },
      { id: 3, lista: 'C', item: 'tronco', qtd: 30 },
      { id: 4, lista: 'D', item: 'tronco', qtd: 30 }
    ]
  };
  // 50 − 5 perdidos − 10 em manutenção = 35. Dia 12: A (20) + B (20) = 40 → falta 5.
  const f = M.faltasDeEstoque(estado.listas[1], [estado.linhas[1]], estado, { hoje: '2026-10-01' });
  assert.equal(f.length, 1);
  assert.equal(f[0].item, 'tronco');
  assert.equal(f[0].falta, 5);
  assert.equal(f[0].dia, '2026-10-12');
  // rascunho só pesa no cenário "com rascunhos"; retornada nunca
  const d = M.disponibilidade(estado, { ini: '2026-10-13', fim: '2026-10-13', comRascunhos: true }).get('tronco');
  assert.equal(d.dias[0].livre, 35 - 20 - 30);
});

test('lista com volta vencida e sem retorno continua prendendo o material até hoje', () => {
  const j = M.janelaLista({ status: 'em_evento', ida: '2026-10-01', volta: '2026-10-03' }, '2026-10-09');
  assert.deepEqual(j, { ini: '2026-10-01', fim: '2026-10-09' });
  assert.deepEqual(M.janelaLista({ status: 'retornada', ida: '2026-10-01', volta: '2026-10-03' }, '2026-10-09'), { ini: '2026-10-01', fim: '2026-10-03' });
});

test('manutenção: consertadas voltam, descartadas saem do inventário', () => {
  const m = { id: 'm1', item: 'pc', qtd: 5, status: 'aberta' };
  assert.equal(M.emManutencao([m]).get('pc'), 5);
  const r = M.concluirManutencao(m, { consertadas: 3, descartadas: 2, hoje: '2026-10-20', por: 'Zé', novoId });
  assert.equal(r.manutencao.status, 'concluida');
  assert.deepEqual(r.movimentos.map(x => [x.item, x.qtd, x.tipo]), [['pc', -2, 'descarte']]);
  assert.equal(M.emManutencao([r.manutencao]).get('pc'), undefined);
});

test('"costuma ir": item frequente que não está na lista é apontado; recusado não', () => {
  const hist = [
    { chao: true, itens: { fita: 3, pc: 90 } }, { chao: true, itens: { fita: 4, pc: 80 } },
    { chao: true, itens: { fita: 2 } }, { chao: true, itens: { pc: 10, chave: 1 } }
  ];
  const { freq } = M.frequencias(hist);
  assert.equal(freq.get('fita'), 0.75);
  const e = M.esquecidos([{ item: 'pc', qtd: 1 }], freq, { limiar: 0.6 });
  assert.deepEqual(e.map(x => x.item), ['fita']);
  assert.deepEqual(M.esquecidos([{ item: 'pc', qtd: 1 }, { item: 'fita', recusado: true }], freq, { limiar: 0.6 }), []);
});

test('separação: um toque marca tudo, parcial, falta, não se aplica, progresso e pendências', () => {
  const ls = [
    { id: 1, item: 'a', qtd: 10 }, { id: 2, item: 'b', qtd: 10 }, { id: 3, item: 'c', qtd: 5 }, { id: 4, item: 'd', qtd: 1 }, { id: 5, item: 'e', qtd: 0 }
  ];
  ls[0] = M.marcarSeparado(ls[0], { por: 'Zé' });
  ls[1] = M.marcarSeparado(ls[1], { qtd: 6 });
  ls[2] = M.marcarFalta(ls[2], {});
  ls[3] = M.marcarNaoAplica(ls[3], {});
  const p = M.progressoSeparacao(ls);
  assert.deepEqual([p.total, p.ok, p.parcial, p.faltou, p.na, p.pct], [3, 1, 1, 1, 1, 33]);
  assert.deepEqual(M.pendenciasSeparacao(ls).map(x => x.status), ['parcial', 'faltou']);
  assert.equal(M.statusSeparacao(M.desmarcar(ls[0])), 'pendente');
});

test('duplicar lista: copia telas e linhas, zera separação e retorno', () => {
  const lista = { id: 'L', evento: 'Takeda', status: 'retornada', ida: '2026-10-01', volta: '2026-10-02', telas: [{ id: 't1', painel: 'p39' }] };
  const linhas = [M.marcarSeparado({ id: 'x', lista: 'L', item: 'pc', qtd: 80, origens: [{ tela: 't1' }] }, { por: 'Zé' })];
  const d = M.duplicarLista(lista, linhas, { novoId, hoje: '2026-10-13', por: 'Caio' });
  assert.equal(d.lista.status, 'rascunho');
  assert.notEqual(d.lista.telas[0].id, 't1');
  assert.equal(d.linhas[0].sep_qtd, null);
  assert.equal(d.linhas[0].lista, d.lista.id);
  assert.equal(d.linhas[0].origens[0].tela, d.lista.telas[0].id);
});

test('datas puras não escorregam de dia', () => {
  assert.equal(M.D.mais('2026-10-31', 1), '2026-11-01');
  assert.equal(M.D.mais('2026-02-28', 1), '2026-03-01');
  assert.equal(M.D.dif('2026-10-10', '2026-10-13'), 3);
  assert.deepEqual(M.D.dias('2026-10-10', '2026-10-12'), ['2026-10-10', '2026-10-11', '2026-10-12']);
});

test('alertas da supervisão: carga próxima, sem conferência, retorno atrasado, manutenção parada, perda', () => {
  const estado = {
    listas: [
      { id: 'A', status: 'pronta', ida: '2026-10-14', volta: '2026-10-15' },
      { id: 'B', status: 'separada', ida: '2026-10-20', volta: '2026-10-21' },
      { id: 'C', status: 'em_evento', ida: '2026-10-01', volta: '2026-10-05', conf: { por: 'Caio' } }
    ],
    linhas: [],
    manutencoes: [{ id: 'm', item: 'pc', qtd: 2, status: 'aberta', aberta_em: '2026-09-20' }],
    movimentos: [{ id: 'p', item: 'pc', qtd: -6, tipo: 'perda', lista: 'C', data: '2026-10-06' }]
  };
  const a = M.alertas(estado, { hoje: '2026-10-13' });
  const tipos = a.map(x => x.tipo).sort();
  assert.deepEqual(tipos, ['carga_proxima', 'manutencao_parada', 'perda', 'retorno_atrasado', 'sem_conferencia']);
});

test('listas com a estrutura do Calculator: pesos por metro, segunda linha e palco', () => {
  const cat = catalogoInicial(), regras = regrasIniciais();
  const q = (w, h, painel = 'led-v10', extra = {}) => {
    const r = M.calcularSugestoes([Object.assign({ id: 't', painel, modo: 'medida', largura_m: w, altura_m: h, montagem: 'chao' }, extra)], cat, regras);
    return id => (r.itens.get(id) || { qtd: 0, origens: [] });
  };
  const amgen = q(15, 2);          // OS 34367: 11 fileiras de 1,92, 2 pesos cada → 22 (igual à lista)
  assert.equal(amgen('mf-192').qtd, 11);
  assert.equal(amgen('peso').qtd, 22);
  const galderma = q(12, 5);       // 9 fileiras × (1,92 + 1,92 + 0,96) + segunda linha → 27 de 1,92; 5 pesos cada → 45
  assert.equal(galderma('mf-192').qtd, 27);
  assert.equal(galderma('mf-096').qtd, 9);
  assert.equal(galderma('peso').qtd, 45);
  // painel de 4 m sobre palco de 0,60 com a mão francesa no chão: alcança 4,60 → pilha maior, segunda linha
  const central = q(6, 4, 'led-v10', { palco: { sobre: true, altura_m: 0.6, mf: 'chao' } });
  assert.equal(central('mf-192').qtd, 10);   // 5 fileiras × (1 + segunda linha)
  assert.equal(central('mf-144').qtd, 5);
  assert.equal(central('mf-096').qtd, 5);
  assert.equal(central('peso').qtd, 25);
  const loreal = q(6, 3, 'led-nt-50x100'); // NT 50×100: jumper de 1,5 m, 1 tronco por coluna
  assert.equal(loreal('pc-15').qtd, 40);
  assert.equal(loreal('pc-1m').qtd, 0);
  assert.equal(loreal('pc-10m').qtd, 13);
});
test('manutenção semanal: resumo por ação, painel e defeito; alerta se chega quinta sem registro', () => {
  assert.equal(M.D.inicioSemana('2026-10-13'), '2026-10-12'); // terça → segunda
  assert.equal(M.D.inicioSemana('2026-10-18'), '2026-10-12'); // domingo ainda é a mesma semana
  assert.equal(M.D.diaSemana('2026-10-15'), 4);               // quinta
  const regs = [
    { id: 1, data: '2026-10-12', tecnico: 'Zé', painel: 'led-v10', acao: 'troca_modulo', defeito: 'faixa', qtd: 3, unidade: 'modulos', minutos: 30 },
    { id: 2, data: '2026-10-13', tecnico: 'Zé', painel: 'led-v10', acao: 'reparo_modulo', defeito: 'pixel', qtd: 2, unidade: 'modulos', minutos: 60 },
    { id: 3, data: '2026-10-13', tecnico: 'Zé', painel: 'led-nt', acao: 'revisao', defeito: 'preventiva', qtd: 5, unidade: 'cases' },
    { id: 4, data: '2026-10-05', tecnico: 'Zé', painel: 'led-v10', acao: 'troca_modulo', qtd: 9, unidade: 'modulos' } // semana anterior
  ];
  const r = M.resumoManutencao(regs, { de: '2026-10-12', ate: '2026-10-18' });
  assert.deepEqual([r.registros, r.modulos, r.cases, r.minutos, r.diasComRegistro], [3, 5, 5, 90, 2]);
  assert.equal(r.porAcao.get('troca_modulo').modulos, 3);
  assert.equal(r.porPainel.get('led-v10').modulos, 5);
  assert.equal(r.porDefeito.get('faixa').modulos, 3);
  const base = { listas: [], linhas: [], manutencoes: [], movimentos: [] };
  const tipos = (hoje, log) => M.alertas(Object.assign({}, base, { manutlog: log }), { hoje }).map(a => a.tipo);
  assert.deepEqual(tipos('2026-10-13', []), []);                                  // terça: ainda cedo
  assert.deepEqual(tipos('2026-10-15', []), ['manutencao_semana_vazia']);         // quinta sem nada
  assert.deepEqual(tipos('2026-10-15', regs.slice(0, 1)), []);                    // quinta com registro
  assert.deepEqual(tipos('2026-10-15', regs.slice(3)), ['manutencao_semana_vazia']); // só da semana passada
});

test('projeto: Girassol 6 × 3,5 m e Ipês 35 × 4,5 m como no PDF da Abbvie (OS 30469)', () => {
  const cat = catalogoInicial();
  const V10 = cat.find(c => c.id === 'led-v10').painel;
  const gira = M.planoProjeto({ painel: 'led-v10', modo: 'medida', largura_m: 6, altura_m: 3.5, montagem: 'chao' }, V10);
  // dados: 3 colunas por porta (21 gabinetes), 4 portas, serpentina que nasce embaixo à esquerda
  assert.equal(gira.dados.cols_por_porta, 3);
  assert.deepEqual(gira.dados.portas.map(p => p.gabinetes), [21, 21, 21, 21]);
  assert.deepEqual(gira.dados.portas[0].caminho.slice(0, 2), [[0, 6], [0, 5]]); // sobe a 1ª coluna
  assert.deepEqual(gira.dados.portas[0].caminho.slice(6, 9), [[0, 0], [1, 0], [1, 1]]); // desce a 2ª
  // energia: 2 réguas de 6 colunas (945 W/coluna, limite 7,5 kW), 1 rack
  assert.deepEqual(gira.energia.reguas.map(r => r.colunas), [6, 6]);
  assert.equal(gira.energia.racks.length, 1);
  const ipes = M.planoProjeto({ painel: 'led-v10', modo: 'medida', largura_m: 35, altura_m: 4.5, montagem: 'chao' }, V10);
  assert.equal(ipes.dados.cols_por_porta, 2);
  assert.equal(ipes.dados.portas.length, 35);
  assert.equal(ipes.energia.reguas.length, 12);
  assert.deepEqual(ipes.energia.racks.map(r => r.reguas.length), [4, 4, 4]);
  // começando pela direita, de cima
  const dir = M.planoProjeto({ painel: 'led-v10', modo: 'medida', largura_m: 6, altura_m: 3.5, projeto: { inicio: 'sup-dir' } }, V10);
  assert.deepEqual(dir.dados.portas[0].caminho[0], [11, 0]);
  // backup dobra os cabos de dados na lista
  const r = M.calcularSugestoes([{ id: 't', painel: 'led-v10', modo: 'medida', largura_m: 6, altura_m: 3.5, montagem: 'chao', projeto: { backup: true } }], cat, regrasIniciais());
  assert.equal(r.itens.get('rj-20m').qtd, 9); // 4 portas × 2 + 1
  // mexer no limite da régua muda a lista
  const r2 = M.calcularSugestoes([{ id: 't', painel: 'led-v10', modo: 'medida', largura_m: 6, altura_m: 3.5, montagem: 'chao', projeto: { kw_regua: 4 } }], cat, regrasIniciais());
  assert.equal(r2.itens.get('regua-pc').qtd, 4); // cada circuito (bloco de 3 colunas, 2,8 kW) numa régua
});

test('distribuição por tela: segue as origens e reparte a quantidade editada na mesma proporção', () => {
  const telas = [{ id: 'a' }, { id: 'b' }];
  const linhas = [
    { id: 1, item: 'peso', qtd: 30, origens: [{ tela: 'a', qtd: 20 }, { tela: 'b', qtd: 10 }] },
    { id: 2, item: 'mf', qtd: 10, travado: true, origens: [{ tela: 'a', qtd: 5 }, { tela: 'b', qtd: 10 }] }, // editado 15 → 10
    { id: 3, item: 'fita', qtd: 3, origens: [{ tela: null, qtd: 3 }] } // da lista toda: não vai para tela nenhuma
  ];
  const d = M.distribuicaoPorTela(telas, linhas);
  assert.equal(d.get('a').get('peso'), 20);
  assert.equal(d.get('b').get('peso'), 10);
  assert.equal(d.get('a').get('mf') + d.get('b').get('mf'), 10);
  assert.equal(d.get('b').get('mf'), 7); // 6,67 → 7
  assert.equal(d.get('a').has('fita'), false);
});

test('evento com salas: ordem das salas, total por item, status e mover telas', () => {
  const salas = [
    { id: 'b', grupo: 'g', sala: 'Ballroom 02+03', ordem_sala: 1, status: 'pronta', telas: [{ id: 't2' }, { id: 't3' }] },
    { id: 'a', grupo: 'g', sala: 'Foyer', ordem_sala: 0, status: 'separada', telas: [{ id: 't1' }] },
    { id: 'c', grupo: 'g', sala: 'Hotel B', ordem_sala: 2, status: 'cancelada', telas: [] },
    { id: 'x', grupo: null, sala: '', status: 'pronta', telas: [] }
  ];
  assert.deepEqual(M.salasDoEvento(salas, 'g').map(l => l.id), ['a', 'b', 'c']);
  assert.deepEqual(M.salasDoEvento(salas, null), []);
  const linhas = [
    { lista: 'a', item: 'rj-20m', qtd: 4 }, { lista: 'b', item: 'rj-20m', qtd: 6 }, { lista: 'b', item: 'pe-cabra', qtd: 1 },
    { lista: 'b', item: 'fita', qtd: 2, recusado: true }, { lista: 'c', item: 'rj-20m', qtd: 9 }, { lista: 'x', item: 'rj-20m', qtd: 50 }
  ];
  const tot = M.totaisEvento(M.salasDoEvento(salas, 'g'), linhas);
  assert.equal(tot.get('rj-20m').total, 10);                 // a cancelada e a lista de fora não entram
  assert.deepEqual([...tot.get('rj-20m').porSala], [['a', 4], ['b', 6]]);
  assert.equal(tot.has('fita'), false);                      // tirada da lista
  assert.equal(M.statusEvento(M.salasDoEvento(salas, 'g')), 'pronta'); // a sala mais atrasada manda
  const r = M.moverTelas(salas[0], salas[1], ['t3']);
  assert.deepEqual(r.origem.telas.map(t => t.id), ['t2']);
  assert.deepEqual(r.destino.telas.map(t => t.id), ['t1', 't3']);
  assert.deepEqual(salas[0].telas.map(t => t.id), ['t2', 't3']); // não mexe no original
  // duplicar uma sala gera uma lista solta, fora do evento
  const d = M.duplicarLista(salas[1], [], { novoId: (() => { let n = 0; return () => 'n' + n++; })(), hoje: '2026-10-16' });
  assert.equal(d.lista.grupo, null);
});

test('P1.9 NT V2: chapinha do NT + parafuso do V10, jumper de 1 m; porta "cheia" quebra coluna (10 placas por porta)', () => {
  const cat = catalogoInicial(), idx = M.indexar(cat);
  assert.equal(idx.get('led-p19').qtd, 30);
  assert.equal(idx.get('led-p19-q').qtd, 20);
  const tela = projeto => ({ id: 'q', nome: 'Leilão', painel: 'led-p19-q', modo: 'medida', largura_m: 9, altura_m: 3, montagem: 'chao', projeto });
  const s = M.calcularSugestoes([tela()], cat, regrasIniciais());
  const q = id => { const it = s.itens instanceof Map ? s.itens.get(id) : s.itens[id]; return it ? it.qtd : undefined; };
  assert.equal(q('led-p19-q'), 15);           // 108 gabinetes / 8 = 13,5 → 14 + 1
  assert.equal(q('chap-nt'), 40);             // 108 × 0,35 em dezenas
  assert.equal(q('par-chap-v10'), 70);        // 108 × 0,6 em dezenas
  assert.equal(q('pc-1m'), 120);
  assert.equal(q('par-chap-nt'), undefined);  // o parafuso é o do V10, não o do NT
  const col = M.planoProjeto(tela(), idx.get('led-p19-q').painel);
  assert.equal(col.dados.portas.length, 18);  // 6 placas de altura: 1 coluna por porta
  const cheia = M.planoProjeto(tela({ portas: 'cheia' }), idx.get('led-p19-q').painel);
  assert.deepEqual(cheia.dados.portas.map(p => p.gabinetes), [10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 8]);
  assert.deepEqual(cheia.dados.portas[1].caminho[0], [1, 4]);   // a 2ª porta continua no meio da coluna 2
  assert.equal(cheia.dados.portas.reduce((n, p) => n + p.caminho.length, 0), 108);
});

test('relatório de manutenção: período, semanas sem registro e fila de conserto (entrou, saiu, parada)', () => {
  const manutlog = [
    { id: 1, data: '2026-10-05', acao: 'troca_modulo', painel: 'led-v10', qtd: 4, unidade: 'modulos', defeito: 'pixel', tecnico: 'Zé', minutos: 60 },
    { id: 2, data: '2026-10-07', acao: 'reparo_led', painel: 'led-v10', qtd: 3, unidade: 'modulos', defeito: 'pixel', tecnico: 'Ana' },
    { id: 3, data: '2026-10-21', acao: 'limpeza', painel: 'led-p19', qtd: 6, unidade: 'cases', defeito: 'preventiva', tecnico: 'Zé', minutos: 90 },
    { id: 4, data: '2026-11-02', acao: 'troca_modulo', painel: 'led-v10', qtd: 9, unidade: 'modulos', tecnico: 'Zé' } // fora do período
  ];
  const manutencoes = [
    { id: 'a', item: 'led-v10', qtd: 2, status: 'concluida', aberta_em: '2026-09-28T10:00:00Z', concluida_em: '2026-10-09T15:00:00Z', consertadas: 2 },
    { id: 'b', item: 'pc-1m', qtd: 5, status: 'aberta', aberta_em: '2026-10-15T10:00:00Z' },
    { id: 'c', item: 'led-nt', qtd: 1, status: 'concluida', aberta_em: '2026-10-20', concluida_em: '2026-11-03', consertadas: 0, descartadas: 1 }
  ];
  const p = M.periodoRelatorio('mes', '2026-10-16');
  assert.deepEqual(p, { de: '2026-10-01', ate: '2026-10-31' });
  const r = M.relatorioManutencao({ manutlog, manutencoes }, { ...p, hoje: '2026-11-03' });
  assert.equal(r.registros.length, 3);
  assert.equal(r.trocados, 4);
  assert.equal(r.reparados, 3);
  assert.equal(r.resumo.cases, 6);
  assert.equal(r.tecnicos, 2);
  // semanas de outubro sem nada: 12–18 e 26–31 (1–4 é só o começo da semana de 28/09 → também conta)
  assert.deepEqual(r.semanasSemRegistro, [{ de: '2026-10-01', ate: '2026-10-04' }, { de: '2026-10-12', ate: '2026-10-18' }, { de: '2026-10-26', ate: '2026-10-31' }]);
  assert.deepEqual(r.fila.entraram.map(m => m.id), ['b', 'c']);
  assert.deepEqual(r.fila.concluidas.map(m => m.id), ['a']);
  assert.equal(r.fila.consertadas, 2);
  assert.deepEqual(r.fila.paradas.map(m => [m.id, m.dias_parado]), [['b', 16], ['c', 11]]); // no fim de outubro
  assert.equal(r.fila.pecasParadas, 6);
  assert.deepEqual(M.periodoRelatorio('mes_passado', '2026-01-10'), { de: '2025-12-01', ate: '2025-12-31' });
  assert.deepEqual(M.periodoRelatorio('semana', '2026-11-03'), { de: '2026-11-02', ate: '2026-11-08' });
});

test('relatório: pedaço de semana com menos de 4 dias não conta como "semana sem registro"', () => {
  const r = M.relatorioManutencao({ manutlog: [{ data: '2026-11-03', acao: 'limpeza', qtd: 1, unidade: 'cases' }], manutencoes: [] },
    { de: '2026-11-01', ate: '2026-11-30', hoje: '2026-11-03' });
  assert.deepEqual(r.semanasSemRegistro, []); // domingo 01/11 sozinho e a semana corrente (até terça) ficam de fora
});

test('relatório: evolução por semana, período anterior e relatório de um técnico (parte dele na equipe)', () => {
  const manutlog = [
    { data: '2026-09-22', acao: 'troca_modulo', qtd: 2, unidade: 'modulos', tecnico: 'Zé' },             // período anterior
    { data: '2026-10-05', acao: 'troca_modulo', qtd: 4, unidade: 'modulos', tecnico: 'Zé', minutos: 60 },
    { data: '2026-10-07', acao: 'reparo_led', qtd: 6, unidade: 'modulos', tecnico: 'Ana' },
    { data: '2026-10-21', acao: 'limpeza', qtd: 6, unidade: 'cases', tecnico: 'Zé', minutos: 90 }
  ];
  const manutencoes = [{ id: 'a', item: 'led-v10', qtd: 2, status: 'concluida', aberta_em: '2026-10-01', concluida_em: '2026-10-09', concluida_por: 'Ana', consertadas: 2 }];
  const g = M.relatorioManutencao({ manutlog, manutencoes }, { de: '2026-10-01', ate: '2026-10-31', hoje: '2026-11-03' });
  assert.equal(g.escala, 'semana');
  assert.deepEqual(g.evolucao.map(s => [s.de, s.modulos, s.cases]), [
    ['2026-10-01', 0, 0], ['2026-10-05', 10, 0], ['2026-10-12', 0, 0], ['2026-10-19', 0, 6], ['2026-10-26', 0, 0]]);
  assert.equal(g.anterior.de, '2026-08-31');
  assert.equal(g.anterior.trocados, 2);
  assert.deepEqual(M.tecnicosDaManutencao(manutlog), ['Zé', 'Ana']);
  const ze = M.relatorioManutencao({ manutlog, manutencoes }, { de: '2026-10-01', ate: '2026-10-31', hoje: '2026-11-03', tecnico: 'Zé' });
  assert.equal(ze.registros.length, 2);
  assert.equal(ze.trocados, 4);
  assert.equal(ze.horas, 2.5);
  assert.equal(Math.round(ze.participacao.modulos * 100), 40); // 4 de 10 módulos da equipe
  assert.equal(ze.participacao.cases, 1);                       // os 6 cases foram dele
  assert.equal(ze.fila.concluidas.length, 0);                   // o conserto foi a Ana que concluiu
  assert.deepEqual(ze.semanasSemRegistro.map(s => s.de), ['2026-10-01', '2026-10-12', '2026-10-26']);
  assert.equal(M.relatorioManutencao({ manutlog, manutencoes }, { de: '2026-10-01', ate: '2026-10-31', tecnico: 'Ana' }).fila.concluidas.length, 1);
  assert.equal(M.relatorioManutencao({ manutlog }, { de: '2026-10-01', ate: '2026-10-07' }).escala, 'dia');
});

test('projeto da sala: Plenária da Syngenta (laterais 4,5 × 2,5 m + central 18 × 3,5 m, V10)', () => {
  const cat = catalogoInicial();
  const telas = [
    { id: 'le', nome: 'Lateral esq.', painel: 'led-v10', modo: 'medida', largura_m: 4.5, altura_m: 2.5, montagem: 'chao' },
    { id: 'c', nome: 'Central', painel: 'led-v10', modo: 'medida', largura_m: 18, altura_m: 3.5, montagem: 'chao' },
    { id: 'ld', nome: 'Lateral dir.', painel: 'led-v10', modo: 'medida', largura_m: 4.5, altura_m: 2.5, montagem: 'chao' }
  ];
  const ps = M.planoSala(telas, cat);
  const [le, c] = ps.telas;
  // sinal: laterais 9 colunas → 3 portas de 3 colunas (repartido por igual, não 4 + 4 + 1); central 36 → 12 de 3
  assert.equal(le.pl.dados.sentido, 'vertical');
  assert.deepEqual(le.pl.dados.portas.map(p => p.cols.length), [3, 3, 3]);
  assert.deepEqual(c.pl.dados.portas.map(p => p.gabinetes), Array(12).fill(21));
  // energia: cada bloco é um circuito; a lateral fecha 1 régua (3 circuitos), a central 6 réguas de 2
  assert.equal(le.pl.energia.circuitos.length, 3);
  assert.deepEqual(le.pl.energia.reguas.map(r => r.circuitos.length), [3]);
  assert.deepEqual(c.pl.energia.reguas.map(r => r.circuitos.length), [2, 2, 2, 2, 2, 2]);
  // racks da sala: 8 réguas → 2 racks de 4 (lateral esq. + metade da central | metade + lateral dir.)
  assert.deepEqual(ps.racks.map(r => r.reguas.map(x => x.tela + '.' + x.n).join(' ')), ['0.1 1.1 1.2 1.3', '1.4 1.5 1.6 2.1']);
  // a lista sai do projeto: 2 racks (não 4); 18 circuitos e 18 portas, + 1 de reserva por tela
  const r = M.calcularSugestoes(telas, cat, regrasIniciais());
  const q = id => (r.itens.get(id) || { qtd: 0 }).qtd;
  assert.equal(q('rack-9'), 2);
  assert.equal(q('regua-pc'), 8);
  assert.equal(q('pc-10m'), 21);
  assert.equal(q('rj-20m'), 21);
  assert.equal(q('send-660'), 4 + 1 + 1 + 1); // central: 12 portas, mas 7,1 milhões de px → 4 (2,3 mi cada); laterais 1 cada; + 1 reserva
  // um rack por tela, se a sala pedir
  const r2 = M.calcularSugestoes(telas, cat, regrasIniciais(), { sala: { racks: 'tela' } });
  assert.equal((r2.itens.get('rack-9') || {}).qtd, 4);
});

test('projeto: Foyer 4 × 3 m sai na horizontal (3 portas de 2 fileiras), como no desenho da Syngenta', () => {
  const V10 = catalogoInicial().find(c => c.id === 'led-v10').painel;
  const pl = M.planoProjeto({ painel: 'led-v10', modo: 'medida', largura_m: 4, altura_m: 3 }, V10);
  assert.equal(pl.dados.sentido, 'horizontal');
  assert.deepEqual(pl.dados.portas.map(p => p.gabinetes), [16, 16, 16]);
  // a 1ª porta sai embaixo à esquerda, vai para a direita e volta pela fileira de cima
  assert.deepEqual(pl.dados.portas[0].caminho.slice(0, 2), [[0, 5], [1, 5]]);
  assert.deepEqual(pl.dados.portas[0].caminho.slice(7, 10), [[7, 5], [7, 4], [6, 4]]);
  // forçar vertical: 3, 3 e 2 colunas
  const v = M.planoProjeto({ painel: 'led-v10', modo: 'medida', largura_m: 4, altura_m: 3, projeto: { sentido: 'vertical' } }, V10);
  assert.deepEqual(v.dados.portas.map(p => p.cols.length), [3, 3, 2]);
});

test('lista Borges e Costa (3,5 × 2 m V10): controladora + reserva, USB, rack 9 + rack 5 com 8 camlocks', () => {
  const r = M.calcularSugestoes([{ id: 't', painel: 'led-v10', modo: 'medida', largura_m: 3.5, altura_m: 2, montagem: 'chao', palco: { sobre: true, altura_m: 0.5, mf: 'chao' } }], catalogoInicial(), regrasIniciais());
  const q = id => (r.itens.get(id) || { qtd: 0 }).qtd;
  assert.equal(q('send-660'), 2);
  assert.equal(q('usb-ab'), 1);
  assert.equal(q('rack-9'), 1);
  assert.equal(q('rack-5'), 1);
  assert.equal(q('camlock-150'), 8);
  assert.equal(q('mf-144') + q('mf-096'), 6);
  assert.equal(q('peso'), 9);
});

test('circuito: bloco que passa do limite se divide em colunas inteiras (P3.9 39 gab/porta; NT 50×100 1 por coluna)', () => {
  const cat = catalogoInicial();
  const p39 = cat.find(c => c.id === 'led-p39-l1').painel;
  const pl = M.planoProjeto({ painel: 'led-p39-l1', modo: 'grade', colunas: 6, linhas: 6 }, p39);
  // 650.000 px ÷ (6 × 16.384) → 6 colunas numa porta (36 gab, 4,6 kW) → 2 circuitos de 3 colunas
  assert.equal(pl.dados.portas.length, 1);
  assert.deepEqual(pl.energia.circuitos.map(c => c.gabinetes), [18, 18]);
  const nt2 = cat.find(c => c.id === 'led-nt-50x100').painel;
  const lo = M.planoProjeto({ painel: 'led-nt-50x100', modo: 'medida', largura_m: 6, altura_m: 3 }, nt2);
  assert.equal(lo.energia.circuitos.length, 12);
});
