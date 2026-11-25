// Sincronização com um Supabase de mentira: dois aparelhos, fila offline, reenvio e exclusão.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { abrirDados } from '../js/dados.js';

function servidorFalso() {
  const linhas = new Map(); // 'tabela:id' → row
  let relogio = Date.parse('2026-10-13T10:00:00Z');
  const canais = [];
  const srv = {
    online: true, linhas,
    criar(userId) {
      const cliente = {
        auth: {
          getSession: async () => ({ data: { session: { user: { id: userId, email: userId + '@x' } } } }),
          signOut: async () => ({})
        },
        from(tabela) {
          if (tabela === 'led_membros') return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { user_id: userId, nome: userId, papel: 'tecnico', ativo: true } }) }) }) };
          return {
            upsert: async (rows, opc) => {
              if (!srv.online) return { error: { message: 'offline', code: 'net' } };
              for (const r of rows) {
                const k = r.tabela + ':' + r.id;
                if (opc && opc.ignoreDuplicates && linhas.has(k)) continue;
                if (r.tabela === 'atividade' && linhas.has(k)) return { error: { message: 'RLS', code: '42501' } };
                relogio += 1000;
                const row = Object.assign({}, r, { atualizado_em: new Date(relogio).toISOString(), atualizado_por: userId });
                linhas.set(k, row);
                for (const c of canais) c(row);
              }
              return { error: null };
            },
            select: () => {
              let desde = '';
              const q = {
                gt: (_c, v) => { desde = v; return q; },
                order: () => q,
                range: async (a, b) => ({ data: [...linhas.values()].filter(r => r.atualizado_em > desde).sort((x, y) => x.atualizado_em.localeCompare(y.atualizado_em)).slice(a, b + 1), error: null })
              };
              return q;
            }
          };
        },
        channel: () => ({ on: (_e, _f, fn) => { canais.push(row => fn({ new: row })); return { subscribe: () => ({}) }; } })
      };
      return { createClient: () => cliente };
    }
  };
  return srv;
}

const espera = ms => new Promise(r => setTimeout(r, ms));

test('o que o técnico tica aparece no aparelho do supervisor; sem sinal fica na fila e sobe depois', async () => {
  const srv = servidorFalso();
  const tec = await abrirDados({ supabaseUrl: 'x', supabaseKey: 'y', supabase: srv.criar('tecnico') });
  const sup = await abrirDados({ supabaseUrl: 'x', supabaseKey: 'y', supabase: srv.criar('supervisor') });
  assert.equal(tec.modo, 'nuvem');
  await tec.conectar(); await sup.conectar();
  assert.equal(tec.usuario.nome, 'tecnico');
  await tec.iniciarSync(); await sup.iniciarSync();

  await tec.salvar('listas', { id: 'L1', evento: 'Honda', status: 'separando' });
  await tec.salvar('linhas', { id: 'a', lista: 'L1', item: 'pc-1m', qtd: 90, sep_qtd: 90 });
  await espera(600);
  assert.equal(tec.pendentes(), 0);
  assert.equal(sup.estado.linhas.find(l => l.id === 'a').sep_qtd, 90); // chegou em tempo real

  // galpão sem sinal: grava no aparelho, fica na fila
  srv.online = false;
  await tec.salvar('linhas', { id: 'b', lista: 'L1', item: 'rj-1m', qtd: 90, sep_qtd: 90 });
  await tec.registrar('separou', 'separou rj', 'L1');
  await espera(600);
  assert.equal(tec.estado.linhas.length, 2);
  assert.ok(tec.pendentes() >= 2);
  assert.equal(sup.estado.linhas.some(l => l.id === 'b'), false);

  // sinal voltou
  srv.online = true;
  await tec.enviarAgora();
  await espera(100);
  assert.equal(tec.pendentes(), 0);
  assert.ok(sup.estado.linhas.some(l => l.id === 'b'));
  assert.ok(sup.estado.atividade.some(a => a.texto === 'separou rj'));

  // atividade reenviada (resposta perdida) não trava a fila
  const ativ = tec.estado.atividade[0];
  await tec.salvar('atividade', Object.assign({}, ativ));
  await espera(600);
  assert.equal(tec.pendentes(), 0);
  assert.equal(tec.sync.erro, null);

  // exclusão chega no outro aparelho
  await sup.excluir('linhas', 'a');
  await espera(600);
  assert.equal(tec.estado.linhas.some(l => l.id === 'a'), false);

  // aparelho novo puxa tudo do servidor
  const novo = await abrirDados({ supabaseUrl: 'x', supabaseKey: 'y', supabase: srv.criar('outro') });
  await novo.conectar();
  await novo.puxar();
  assert.deepEqual(novo.estado.linhas.map(l => l.id), ['b']);
  assert.equal(novo.estado.listas[0].evento, 'Honda');
});
