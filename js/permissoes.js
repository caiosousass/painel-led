/* Projetech · Painel de LED — quem pode o quê.
 *
 * Só o administrador tem acesso total e gerencia a equipe. Para cada outra pessoa ele escolhe,
 * módulo por módulo: sem acesso, ver ou editar. O app esconde e trava pela mesma tabela que o
 * banco (supabase-led.sql) usa para recusar gravação — os dois precisam andar juntos.
 * Puro: sem DOM, sem storage (roda no Node com `node --test`).
 */

export const NIVEIS = ['nao', 'ver', 'editar'];
export const NOME_NIVEL = { nao: 'Sem acesso', ver: 'Ver', editar: 'Editar' };

// [chave, nome, o que libera, níveis possíveis]
export const MODULOS = [
  ['inicio', 'Início e alertas', 'Painel com alertas, próximas cargas e atividade da equipe', ['nao', 'ver']],
  ['listas', 'Listas', 'Criar e montar listas, telas, projeto técnico, importar OS', NIVEIS],
  ['separacao', 'Separação', 'Ticar itens no galpão, fechar a separação, conferência e saída', NIVEIS],
  ['retorno', 'Retorno', 'Conferir o que voltou do evento (falta sai do inventário)', NIVEIS],
  ['estoque', 'Estoque', 'Ver disponibilidade; editar = ajustar inventário', NIVEIS],
  ['manutencao', 'Manutenção', 'Controle semanal dos módulos e fila de conserto', NIVEIS],
  ['bancada', 'Bancada', 'Registro do trabalho de galpão', NIVEIS],
  ['regras', 'Regras', 'As regras que montam a lista sozinha', NIVEIS],
  ['catalogo', 'Catálogo', 'Itens do setor e quantidades do inventário', NIVEIS]
];
export const CHAVES = MODULOS.map(m => m[0]);

const todos = n => Object.fromEntries(MODULOS.map(([k, , , niveis]) => [k, niveis.includes(n) ? n : niveis[niveis.length - 1]]));

/* Modelos prontos — o administrador escolhe um e ajusta o que quiser. */
export const PERFIS = {
  tecnico: {
    nome: 'Técnico do galpão',
    permissoes: { inicio: 'ver', listas: 'editar', separacao: 'editar', retorno: 'editar', estoque: 'ver', manutencao: 'editar', bancada: 'editar', regras: 'ver', catalogo: 'ver' }
  },
  separacao: {
    nome: 'Só separação e retorno',
    permissoes: { inicio: 'nao', listas: 'ver', separacao: 'editar', retorno: 'editar', estoque: 'nao', manutencao: 'editar', bancada: 'editar', regras: 'nao', catalogo: 'nao' }
  },
  consulta: { nome: 'Só consulta', permissoes: todos('ver') }
};

export function ehAdmin(u) {
  return !!u && (u.papel === 'admin' || u.papel === 'supervisor'); // "supervisor" = nome antigo do admin
}

/* Permissões efetivas: admin pode tudo; quem ainda não tem nada configurado cai no modelo de técnico. */
export function permissoesDe(u) {
  if (!u) return Object.fromEntries(CHAVES.map(k => [k, 'nao']));
  if (ehAdmin(u)) return Object.fromEntries(MODULOS.map(([k, , , n]) => [k, n[n.length - 1]]));
  const p = u.permissoes && Object.keys(u.permissoes).length ? u.permissoes : PERFIS.tecnico.permissoes;
  return Object.fromEntries(MODULOS.map(([k, , , niveis]) => [k, niveis.includes(p[k]) ? p[k] : 'nao']));
}

export const nivel = (u, modulo) => permissoesDe(u)[modulo] || 'nao';
export const podeVer = (u, modulo) => nivel(u, modulo) !== 'nao';
export const podeEditar = (u, modulo) => nivel(u, modulo) === 'editar';

/* Que tela usa qual permissão. A lista abre para quem separa ou confere retorno também
 * (é por ela que se chega na separação), mas só edita quem tem "Listas: editar". */
export const MODULO_DA_ROTA = {
  inicio: ['inicio'], listas: ['listas', 'separacao', 'retorno'], lista: ['listas', 'separacao', 'retorno'], evento: ['listas', 'separacao', 'retorno'], projeto: ['listas', 'separacao', 'retorno'], receber: ['listas'],
  separar: ['separacao'], retorno: ['retorno'], estoque: ['estoque'], item: ['estoque'],
  manutencao: ['manutencao'], bancada: ['bancada'], regras: ['regras'], catalogo: ['catalogo']
};
export function podeAbrir(u, rota) {
  if (rota === 'ajustes') return true;
  if (rota === 'equipe') return ehAdmin(u);
  const ms = MODULO_DA_ROTA[rota];
  return !ms || ms.some(m => podeVer(u, m));
}
/* Primeira tela que a pessoa pode abrir (para quem não vê o Início). */
export function telaInicial(u) {
  return ['inicio', 'listas', 'separar', 'manutencao', 'bancada', 'estoque', 'regras', 'catalogo'].find(r => r !== 'separar' && podeAbrir(u, r)) || 'ajustes';
}

/* Gravação por tabela — espelho exato da função led_pode_gravar() do banco. */
export const GRAVA = {
  catalogo: ['catalogo'], regras: ['regras'],
  listas: ['listas', 'separacao', 'retorno'], linhas: ['listas', 'separacao', 'retorno'],
  manutencoes: ['manutencao', 'retorno'], manutlog: ['manutencao'], producao: ['bancada', 'manutencao'],
  movimentos: ['estoque', 'retorno', 'manutencao']
};
export function podeGravar(u, tabela) {
  if (ehAdmin(u)) return true;
  if (tabela === 'atividade') return !!u;
  return (GRAVA[tabela] || []).some(m => podeEditar(u, m));
}
