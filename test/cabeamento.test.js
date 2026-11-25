// Testes do cabeamento.js — o arquivo compartilhado com o Projetech Calculator
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import * as Cab from '../js/cabeamento.js';
import * as M from '../js/motor.js';
import { catalogoInicial } from '../js/seed.js';

const V10 = catalogoInicial().find(c => c.id === 'led-v10').painel;
const tela = (colunas, linhas, cfg, painel = V10) => ({ colunas, linhas, painel, cfg });

test('é o mesmo arquivo do Calculator (quando a pasta dele está ao lado)', { skip: !existsSync(new URL('../../projetech/cabeamento.js', import.meta.url)) }, () => {
  const aqui = readFileSync(new URL('../js/cabeamento.js', import.meta.url), 'utf8');
  const la = readFileSync(new URL('../../projetech/cabeamento.js', import.meta.url), 'utf8');
  assert.equal(la, aqui, 'copie js/cabeamento.js para projetech/cabeamento.js');
});

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

test('folhas no estilo do Calculator: Pixel map, Sinal e AC, com o carimbo e a escala', () => {
  const ps = M.planoSala([{ id: 'h', nome: 'Painel', painel: 'led-v10', modo: 'medida', largura_m: 6, altura_m: 3.5, montagem: 'chao' }], catalogoInicial(), {});
  const meta = { projeto: '', local: 'Royal Palm Plaza', sala: 'Plenária', responsavel: 'Caio', montagem: '2026-05-12', emissao: '2026-11-25', cliente: 'Syngenta', agencia: '', os: '32465' };
  const fs = Cab.folhasDoProjeto(ps, meta, { formato: 'a3' });
  assert.deepEqual(fs.map(f => f.tipo), ['teste', 'sinal', 'ac']);
  assert.equal(Math.round(1000 / fs[0].escala), 16);      // 6 × 3,5 m no A3 = 1:16, como no Calculator
  const textos = f => f.prims.filter(p => p.t === 'text').map(p => p.txt);
  assert.ok(textos(fs[0]).includes('6 m — 2.016 px'));
  assert.ok(textos(fs[0]).includes('Painel de LED P2.9'));  // projeto em branco: o nome do Calculator
  assert.ok(textos(fs[1]).includes('2/3'));
  assert.ok(textos(fs[2]).some(t => /^Rack 1 · 9 saídas/.test(t)));
  assert.match(Cab.svg(fs[1]), /^<svg [^>]*viewBox="0 0 420 297"/);
  // 16:9 e numeração corrida (o Calculator põe as folhas de sinal e AC depois das dele)
  const ex = Cab.folhasDoProjeto(ps, meta, { formato: '169', paginas: ['sinal', 'ac'], inicio: 3, total: 5 });
  assert.equal(ex[0].formato.w, 528);
  assert.ok(textos(ex[1]).includes('5/5'));
});

test('larguraTexto mede como a Helvetica do jsPDF', () => {
  assert.ok(Math.abs(Cab.larguraTexto('Projeto: ', 10, false) - 13.14) < 0.05);
  assert.ok(Cab.larguraTexto('ABC', 10, true) > Cab.larguraTexto('ABC', 10, false));
});
