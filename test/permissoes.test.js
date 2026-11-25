// Quem pode o quê — o app e o banco usam esta mesma tabela.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as P from '../js/permissoes.js';

test('admin pode tudo, inclusive a equipe', () => {
  const admin = { papel: 'admin' };
  assert.equal(P.podeEditar(admin, 'regras'), true);
  assert.equal(P.podeAbrir(admin, 'equipe'), true);
  assert.equal(P.podeGravar(admin, 'catalogo'), true);
  assert.equal(P.ehAdmin({ papel: 'supervisor' }), true); // nome antigo
});

test('membro só faz o que o admin marcou', () => {
  const ze = { papel: 'membro', permissoes: { listas: 'ver', separacao: 'editar', retorno: 'editar', estoque: 'nao', regras: 'ver' } };
  assert.equal(P.podeVer(ze, 'listas'), true);
  assert.equal(P.podeEditar(ze, 'listas'), false);
  assert.equal(P.podeEditar(ze, 'separacao'), true);
  assert.equal(P.podeAbrir(ze, 'lista'), true);     // abre a lista para chegar na separação
  assert.equal(P.podeAbrir(ze, 'estoque'), false);
  assert.equal(P.podeAbrir(ze, 'equipe'), false);
  assert.equal(P.podeAbrir(ze, 'inicio'), false);   // não marcado = sem acesso
  assert.equal(P.telaInicial(ze), 'listas');
  // gravação: separação grava linhas; não grava catálogo nem regras
  assert.equal(P.podeGravar(ze, 'linhas'), true);
  assert.equal(P.podeGravar(ze, 'catalogo'), false);
  assert.equal(P.podeGravar(ze, 'regras'), false);
  assert.equal(P.podeGravar(ze, 'movimentos'), true); // fechar retorno tira do inventário o que faltou
  assert.equal(P.podeGravar(ze, 'atividade'), true);
});

test('nível inválido para o módulo vira "sem acesso"; sem configuração vale o modelo de técnico', () => {
  assert.equal(P.nivel({ papel: 'membro', permissoes: { inicio: 'editar' } }, 'inicio'), 'nao'); // início só tem "ver"
  const novo = { papel: 'membro', permissoes: {} };
  assert.deepEqual(P.permissoesDe(novo), P.PERFIS.tecnico.permissoes);
  assert.equal(P.podeAbrir(null, 'listas'), false);
});

test('os modelos prontos só usam níveis válidos', () => {
  for (const perfil of Object.values(P.PERFIS)) {
    for (const [k, , , niveis] of P.MODULOS) assert.ok(niveis.includes(perfil.permissoes[k]), perfil.nome + ' / ' + k);
  }
});

test('o banco (supabase-led.sql) usa o mesmo modelo de técnico e as mesmas tabelas que o app', async () => {
  const fs = await import('node:fs');
  const sql = fs.readFileSync(new URL('../supabase-led.sql', import.meta.url), 'utf8');
  const json = JSON.parse(sql.match(/'(\{"inicio"[^']+\})'::jsonb/)[1]);
  assert.deepEqual(json, P.PERFIS.tecnico.permissoes);
  for (const [tabela, modulos] of Object.entries(P.GRAVA)) {
    const linha = sql.split('\n').find(l => l.includes(`when '${tabela}'`));
    assert.ok(linha, 'falta a tabela ' + tabela + ' no SQL');
    for (const m of modulos) assert.ok(linha.includes(`led_pode('${m}')`), `${tabela}: falta ${m} no SQL`);
  }
});
