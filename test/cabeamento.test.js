// Testes do cabeamento.js — contas do cabeamento (as mesmas do pixel map do Calculator) e o projeto técnico
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as Cab from '../js/cabeamento.js';
import * as M from '../js/motor.js';
import { catalogoInicial, regrasIniciais } from '../js/seed.js';

const V10 = catalogoInicial().find(c => c.id === 'led-v10').painel;
const tela = (colunas, linhas, cfg, painel = V10) => ({ colunas, linhas, painel, cfg });

test('padrões do Calculator: canto, sentido, sem serpentina, limite de gabinetes por porta', () => {
  // começa em cima à direita, vertical: a 1ª porta desce a última coluna e sobe a penúltima
  const a = Cab.planoTela(tela(6, 4, { inicio: 'sup-dir', sentido: 'vertical' }));
  assert.deepEqual(a.dados.portas[0].caminho.slice(0, 5), [[5, 0], [5, 1], [5, 2], [5, 3], [4, 3]]);
  // sem serpentina: toda coluna anda no mesmo sentido
  const b = Cab.planoTela(tela(6, 4, { inicio: 'inf-esq', sentido: 'vertical', serpentina: false }));
  assert.deepEqual(b.dados.portas[0].caminho.slice(3, 6), [[0, 0], [1, 3], [1, 2]]);
  // limite de gabinetes por porta (o "Máx. gabinetes / porta" do Calculator): 10 → 2 colunas de 4
  const c = Cab.planoTela(tela(12, 4, { sentido: 'vertical', max_gab_porta: 10 }));
  assert.deepEqual(c.dados.portas.map(p => p.gabinetes), [8, 8, 8, 8, 8, 8]);
});

test('linha que não cabe na porta: a tela vira faixas iguais (fileira de 40 com limite 23 → 2 de 20)', () => {
  const pl = Cab.planoTela(tela(40, 3, { sentido: 'horizontal', max_gab_porta: 23 }));
  assert.equal(pl.dados.faixas, 2);
  assert.deepEqual(pl.dados.portas.map(p => p.gabinetes), [20, 20, 20, 20, 20, 20]);
  // começa embaixo à esquerda: a 1ª faixa é a da esquerda, a 1ª porta é a fileira de baixo
  assert.deepEqual(pl.dados.portas[0].caminho[0], [0, 2]);
  assert.deepEqual(pl.dados.portas[0].caminho[19], [19, 2]);
  // no automático, faixa só se não tiver outro jeito: aqui a vertical cabe (3 por coluna)
  assert.equal(Cab.planoTela(tela(40, 3, { max_gab_porta: 23 })).dados.sentido, 'vertical');
});

test('"Livre" do Calculator (enche a porta) = uma corrente só, cortada a cada N gabinetes', () => {
  const pl = Cab.planoTela(tela(9, 5, { portas: 'cheia', sentido: 'vertical' }));
  assert.deepEqual(pl.dados.portas.map(p => p.gabinetes), [23, 22]);   // 650.000 ÷ 28.224 = 23
  assert.deepEqual(pl.dados.portas[1].caminho[0], [4, 1]);              // continua no meio da 5ª coluna (que sobe)
});

test('projeto técnico: desenho da Syngenta (AC com rack, Sinal com processadora) na prancha do Calculator', () => {
  const telas = [
    { id: 'le', nome: 'Lateral esq.', painel: 'led-v10', modo: 'medida', largura_m: 4.5, altura_m: 2.5 },
    { id: 'c', nome: 'Central', painel: 'led-v10', modo: 'medida', largura_m: 18, altura_m: 3.5 },
    { id: 'ld', nome: 'Lateral dir.', painel: 'led-v10', modo: 'medida', largura_m: 4.5, altura_m: 2.5 }];
  const ps = M.planoSala(telas, catalogoInicial(), { processadora: 'VX1000' });
  const meta = { projeto: 'Syngenta - Red Coop', local: 'Royal Palm Plaza', sala: 'Plenária', responsavel: 'Caio de Sousa Santos', emissao: '2026-05-11', cliente: 'Syngenta', os: '32465' };
  const fs = Cab.folhasTecnicas(ps, meta, {});
  assert.deepEqual(fs.map(f => f.tipo), ['ac', 'sinal']);
  const textos = f => f.prims.filter(p => p.t === 'text').map(p => p.txt);
  assert.ok(textos(fs[0]).includes('Cabeamento de AC · Plenária'));
  assert.ok(textos(fs[0]).includes('2 Painéis de Led (Lateral esq. e dir.) – 4,5 x 2,5 m + Painel de Led (Central) – 18 x 3,5 m'));
  assert.equal(textos(fs[0]).filter(t => /^Rack [12] · 9 saídas · 4 réguas$/.test(t)).length, 2);   // 2 racks de 4 réguas
  assert.ok(textos(fs[0]).includes('Plenária'));                                  // Ambiente/Sala no carimbo
  assert.ok(textos(fs[1]).includes('VX1000'));                                           // a processadora
  assert.ok(textos(fs[1]).includes('Cabeamento de Sinal · Plenária'));
  assert.ok(textos(fs[1]).includes('11/05/26'));                                         // data de emissão, como no Calculator
  assert.ok(textos(fs[1]).includes('2/2'));                                              // folha
  assert.ok(Math.round(1000 / fs[0].escala) > 0);                                        // em escala (1:N no carimbo)
  assert.match(Cab.svg(fs[1]), /^<svg [^>]*viewBox="0 0 420 297"/);                     // A3, o padrão do Calculator
  assert.equal(Cab.folhasTecnicas(ps, meta, { formato: '169' })[0].formato.w, 528);      // ou 16:9
  // sala pequena (Foyer 4 × 3 m, 1 régua): uma folha só, "AC e Sinal"; dá para pedir separadas
  const foyer = M.planoSala([{ id: 'f', nome: 'Foyer', painel: 'led-v10', modo: 'medida', largura_m: 4, altura_m: 3 }], catalogoInicial(), {});
  assert.deepEqual(Cab.folhasTecnicas(foyer, { sala: 'Foyer' }).map(f => f.tipo), ['ambos']);
  assert.deepEqual(Cab.folhasTecnicas(foyer, { sala: 'Foyer' }, { folhas: 'separadas', inicio: 3 }).map(f => f.tipo), ['ac', 'sinal']);
});

test('larguraTexto mede como a Helvetica do jsPDF', () => {
  assert.ok(Math.abs(Cab.larguraTexto('Projeto: ', 10, false) - 13.14) < 0.05);
  assert.ok(Cab.larguraTexto('ABC', 10, true) > Cab.larguraTexto('ABC', 10, false));
});

test('portas desenhadas à mão (editor): viram as portas e os circuitos; tela que mudou de tamanho volta ao automático', () => {
  const cam = (c0, n) => Array.from({ length: n }, (_, k) => [c0 + Math.floor(k / 5), k % 5]);
  const pl = Cab.planoTela(tela(9, 5, { portas_manual: [cam(0, 15), cam(3, 30)] }));
  assert.equal(pl.dados.modo, 'manual');
  assert.deepEqual(pl.dados.portas.map(p => p.gabinetes), [15, 30]);
  assert.equal(pl.dados.sem_porta, 0);
  assert.equal(pl.dados.portas_excedem, 1);                       // 30 × 28.224 px passa de 650 mil
  assert.deepEqual(pl.energia.circuitos.map(c => c.gabinetes), [15, 15, 15]);   // 30 gab de V10 (4 kW) = 2 circuitos
  // "Limpar": desenho à mão sem porta nenhuma
  const vazio = Cab.planoTela(tela(9, 5, { portas_manual: [] }));
  assert.equal(vazio.dados.portas.length, 0);
  assert.equal(vazio.dados.sem_porta, 45);
  assert.equal(vazio.energia.reguas.length, 0);
  // a tela encolheu: o desenho não serve mais
  const fora = Cab.planoTela(tela(4, 5, { portas_manual: [cam(0, 15), cam(3, 30)] }));
  assert.equal(fora.dados.manual, false);
  assert.equal(fora.dados.manual_invalido, true);
  // gabinete repetido também não vale
  assert.equal(Cab.portasManuais([[[0, 0], [0, 1]], [[0, 1]]], 9, 5), null);
});

test('posição das telas na sala: a que o editor gravou; sem ela, depois da anterior', () => {
  const telas = [
    { id: 'a', nome: 'A', painel: 'led-v10', modo: 'medida', largura_m: 4, altura_m: 2, pos: { x: 10 } },
    { id: 'b', nome: 'B', painel: 'led-v10', modo: 'medida', largura_m: 4, altura_m: 2 }];
  const ps = M.planoSala(telas, catalogoInicial(), {});
  const pos = Cab.posicoesDaSala(ps);
  assert.equal(pos.get(ps.telas[0]), 10);
  assert.ok(pos.get(ps.telas[1]) >= 14);   // depois da A, com vão
});

test('energia montada no editor: régua com circuitos de duas telas, racks escolhidos, o resto automático', () => {
  const telas = [
    { id: 'le', nome: 'Lateral esq.', painel: 'led-v10', modo: 'medida', largura_m: 4.5, altura_m: 2.5 },
    { id: 'c', nome: 'Central', painel: 'led-v10', modo: 'medida', largura_m: 18, altura_m: 3.5 },
    { id: 'ld', nome: 'Lateral dir.', painel: 'led-v10', modo: 'medida', largura_m: 4.5, altura_m: 2.5 }];
  const cat = catalogoInicial();
  // a régua A junta os 3 circuitos da lateral esq. com o 1º da central; ela vai num rack de 12 só dela
  const energia = { reguas: [{ id: 'A', circuitos: ['le:1', 'le:2', 'le:3', 'c:1'], rack: 'K' }], racks: [{ id: 'K', tipo: 'rack-12' }] };
  const ps = M.planoSala(telas, cat, { energia });
  assert.equal(ps.energia_manual, true);
  const A = ps.reguasSala.find(r => r.id === 'A');
  assert.deepEqual(A.refs.map(q => q.ti + ':' + q.n), ['0:1', '0:2', '0:3', '1:1']);
  assert.equal(ps.racks[0].tipo, 'rack-12');
  assert.deepEqual(ps.racks[0].reguas.map(q => q.rg), [A.n]);
  // os 11 circuitos que sobraram da central viram réguas sozinhos (até 7,5 kW) e o resto vai para racks automáticos
  const sobra = ps.reguasSala.filter(r => r.id !== 'A');
  assert.equal(sobra.reduce((s, r) => s + r.circuitos.length, 0), 11 + 3);
  assert.ok(ps.racks.slice(1).every(k => k.auto));
  // a lista acompanha: um rack de 12 e os de 9 para o resto
  const r = M.calcularSugestoes(telas, cat, regrasIniciais(), { sala: { energia } });
  assert.equal(r.itens.get('rack-12').qtd, 1);
  assert.equal(r.itens.get('regua-pc').qtd, ps.reguas);
  // circuito que não existe mais (a tela mudou) é ignorado; voltar ao automático = sem energia
  const ps2 = M.planoSala(telas, cat, { energia: { reguas: [{ id: 'X', circuitos: ['c:99'] }], racks: [] } });
  assert.ok(!ps2.reguasSala.some(r => r.id === 'X'));
  const auto = M.planoSala(telas, cat, {});
  assert.equal(auto.reguas, 8);
});

test('processamento: portas nas controladoras (automático enche saídas e pixels; editor liga à mão)', () => {
  const telas = [
    { id: 'le', nome: 'Lateral esq.', painel: 'led-v10', modo: 'medida', largura_m: 4.5, altura_m: 2.5 },
    { id: 'c', nome: 'Central', painel: 'led-v10', modo: 'medida', largura_m: 18, altura_m: 3.5 },
    { id: 'ld', nome: 'Lateral dir.', painel: 'led-v10', modo: 'medida', largura_m: 4.5, altura_m: 2.5 }];
  const cat = catalogoInicial();
  const auto = M.planoSala(telas, cat, {});
  // central: 12 portas de 592.704 px → 3 por MCTRL660 (a 4ª passaria de 2,3 milhões) → 4 controladoras
  assert.deepEqual(auto.processamento.ctrls.map(c => c.usadas), [3, 3, 3, 3, 3, 3]);
  assert.equal(auto.controladoras['send-660'], 6);
  // à mão: uma TB60 só para as laterais (saídas 1–3 a esq., 4 a dir. P1); o resto continua automático
  const processamento = {
    ctrls: [{ id: 'T', tipo: 'taurus-tb60' }],
    ligacoes: { 'le:1': { ctrl: 'T', saida: 1 }, 'le:2': { ctrl: 'T', saida: 2 }, 'le:3': { ctrl: 'T', saida: 3 }, 'ld:1': { ctrl: 'T', saida: 4 }, 'ld:2': { ctrl: 'T', saida: 4 } } };
  const ps = M.planoSala(telas, cat, { processamento });
  const T = ps.processamento.ctrls[0];
  assert.equal(T.tipo, 'taurus-tb60');
  assert.deepEqual(T.saidas.map(p => p.chave), ['le:1', 'le:2', 'le:3', 'ld:1']);   // saída 4 já ocupada: ld:2 vai para a automática
  assert.equal(ps.controladoras['taurus-tb60'], 1);
  assert.equal(ps.controladoras['send-660'], 4 + 1);   // central 4 + lateral dir. (P2 e P3)
  const r = M.calcularSugestoes(telas, cat, regrasIniciais(), { sala: { processamento } });
  assert.equal(r.itens.get('taurus-tb60').qtd, 1);
  assert.equal(r.itens.get('send-660').qtd, 5 + 1);   // + 1 de reserva
});

test('série H: CVT10 / CVT4K-S como extensor de fibra, processadora H desenhada pelo modelo', () => {
  const cat = catalogoInicial();
  const T = (id, l, a, ctrl) => ({ id, nome: id, painel: 'led-v10', modo: 'medida', largura_m: l, altura_m: a, projeto: { controladora: ctrl } });
  // Central 10 x 4 m = 8 portas: cabe num CVT4K-S (16) ou num CVT10 (10); com MCTRL660 seriam 2
  for (const [ctrl, tipo] of [['cvt4k-s', 'cvt4k-s'], ['cvt10', 'cvt10'], ['auto', 'send-660']]) {
    const ps = M.planoSala([T('c', 10, 4, ctrl)], cat, { processadora: 'H9' });
    assert.deepEqual(Object.keys(ps.controladoras), [tipo]);
    assert.equal(ps.controladoras[tipo], tipo === 'send-660' ? 2 : 1);
  }
  assert.deepEqual(['H9', 'Novastar H15', 'h 5', 'H2', 'VX1000', 'H19'].map(Cab.modeloProcessadora), ['H9', 'H15', 'H5', 'H2', null, null]);
  const ps = M.planoSala([T('c', 10, 4, 'cvt4k-s')], cat, { processadora: 'H9' });
  const sinal = Cab.folhasTecnicas(ps, { sala: 'Plenária' }, { folhas: 'separadas' }).find(f => f.tipo === 'sinal');
  const textos = sinal.prims.filter(p => p.t === 'text').map(p => p.txt);
  assert.ok(textos.includes('Processadora H9') && textos.includes('fibra') && textos.includes('CVT4K-S'));
  // a lista conta o CVT4K-S (e não MCTRL660)
  const r = M.calcularSugestoes([T('c', 10, 4, 'cvt4k-s')], cat, regrasIniciais(), { sala: { processadora: 'H9' } });
  const q = id => (r.itens.get(id) || { qtd: 0 }).qtd;
  assert.equal(q('cvt4k-s'), 1);
  assert.equal(q('send-660'), 0);
});

test('prancha: aparelhos arrastados ficam onde o usuário pôs (frações da área), e os cabos vão junto', () => {
  const cat = catalogoInicial();
  const telas = [{ id: 'c', nome: 'Central', painel: 'led-v10', modo: 'medida', largura_m: 6, altura_m: 3 }];
  const auto = Cab.folhasTecnicas(M.planoSala(telas, cat, { processadora: 'H9', folhas: 'separadas' }), { sala: 'S' }, {});
  const sinal = auto.find(f => f.tipo === 'sinal');
  assert.deepEqual(sinal.alvos.map(a => a.chave), ['ctrl:c:1', 'proc']);
  assert.ok(auto.find(f => f.tipo === 'ac').alvos.every(a => a.chave.startsWith('rack:')));
  const layout = { sinal: { proc: { fx: 0.1, fy: 0.75 } } };
  const mov = Cab.folhasTecnicas(M.planoSala(telas, cat, { processadora: 'H9', folhas: 'separadas', layout }), { sala: 'S' }, {}).find(f => f.tipo === 'sinal');
  const p = mov.alvos.find(a => a.chave === 'proc'), A = mov.area;
  assert.ok(Math.abs(p.x + p.w / 2 - (A.x + 0.1 * A.w)) < 0.01);   // o centro onde foi posto
  assert.ok(Math.abs(p.y - (A.y + 0.75 * A.h)) < 0.01);
  // arrastada para fora: fica dentro da área de desenho
  const fora = Cab.folhasTecnicas(M.planoSala(telas, cat, { processadora: 'H9', folhas: 'separadas', layout: { sinal: { proc: { fx: 1.4, fy: 0.99 } } } }), { sala: 'S' }, {}).find(f => f.tipo === 'sinal').alvos.find(a => a.chave === 'proc');
  assert.ok(fora.x + fora.w <= A.x + A.w + 0.01 && fora.y + fora.h <= A.y + A.h + 0.01);
  // a controladora não mexida continua no automático
  assert.deepEqual(mov.alvos.find(a => a.chave === 'ctrl:c:1'), sinal.alvos.find(a => a.chave === 'ctrl:c:1'));
});
