/* Projetech · Painel de LED — dados.
 *
 * Local-first: tudo é gravado primeiro no aparelho (IndexedDB) e a tela responde na hora,
 * com ou sem sinal. Com o Supabase ligado, cada gravação entra numa fila que sobe quando há
 * internet, e o que os outros fazem desce em tempo real. No galpão o sinal cai — a separação
 * não pode parar por isso.
 *
 * No Supabase é uma tabela só (led_docs: tabela, id, dados jsonb). Simples de sincronizar,
 * de proteger (RLS) e de evoluir sem migração a cada campo novo.
 */

export const TABELAS = ['catalogo', 'regras', 'listas', 'linhas', 'manutencoes', 'manutlog', 'producao', 'movimentos', 'atividade'];

// Banco do aparelho separado por modo: dados de teste do modo local nunca se misturam com os da equipe.
const NOME_DB_LOCAL = 'projetech-led';
const NOME_DB_NUVEM = 'projetech-led-nuvem';
const ESPERA_REENVIO = 15000;

/* ---------------- IndexedDB mínimo ---------------- */

function idbAbrir(nome) {
  return new Promise((ok, erro) => {
    const r = indexedDB.open(nome, 1);
    r.onupgradeneeded = () => {
      const db = r.result;
      if (!db.objectStoreNames.contains('docs')) db.createObjectStore('docs', { keyPath: 'k' });
      if (!db.objectStoreNames.contains('fila')) db.createObjectStore('fila', { keyPath: 'k' });
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'k' });
    };
    r.onsuccess = () => ok(r.result);
    r.onerror = () => erro(r.error);
  });
}
function req(r) { return new Promise((ok, erro) => { r.onsuccess = () => ok(r.result); r.onerror = () => erro(r.error); }); }
function tx(db, lojas, modo, fn) {
  return new Promise((ok, erro) => {
    const t = db.transaction(lojas, modo);
    let res;
    Promise.resolve(fn(t)).then(v => { res = v; });
    t.oncomplete = () => ok(res);
    t.onerror = () => erro(t.error);
    t.onabort = () => erro(t.error);
  });
}

/* Fallback para navegador sem IndexedDB (modo privado antigo): memória pura. */
function lojaMemoria() {
  const m = { docs: new Map(), fila: new Map(), meta: new Map() };
  return {
    async todos(l) { return [...m[l].values()]; },
    async gravar(l, vs) { for (const v of vs) m[l].set(v.k, v); },
    async apagar(l, ks) { for (const k of ks) m[l].delete(k); },
    async limpar() { m.docs.clear(); m.fila.clear(); m.meta.clear(); },
    persistente: false
  };
}
async function lojaIdb(nome) {
  const db = await idbAbrir(nome);
  return {
    async todos(l) { return tx(db, [l], 'readonly', t => req(t.objectStore(l).getAll())); },
    async gravar(l, vs) { return tx(db, [l], 'readwrite', t => { const s = t.objectStore(l); for (const v of vs) s.put(v); }); },
    async apagar(l, ks) { return tx(db, [l], 'readwrite', t => { const s = t.objectStore(l); for (const k of ks) s.delete(k); }); },
    async limpar() { return tx(db, ['docs', 'fila', 'meta'], 'readwrite', t => { for (const l of ['docs', 'fila', 'meta']) t.objectStore(l).clear(); }); },
    persistente: true
  };
}

/* ---------------- ids e horas ---------------- */

export function novoId() {
  if (globalThis.crypto && crypto.randomUUID) return crypto.randomUUID();
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}
export function agora() { return new Date().toISOString(); }
export function hoje() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

/* ---------------- a base ---------------- */

export async function abrirDados({ supabaseUrl, supabaseKey, supabase } = {}) {
  let loja;
  try { loja = await lojaIdb(supabaseUrl && supabaseKey && supabase ? NOME_DB_NUVEM : NOME_DB_LOCAL); } catch (e) { loja = lojaMemoria(); }

  const estado = Object.fromEntries(TABELAS.map(t => [t, []]));
  const ouvintes = new Set();
  const meta = new Map();
  const pendentes = new Map(); // k → registro da fila

  const D = {
    estado, novoId, agora, hoje,
    modo: supabaseUrl && supabaseKey && supabase ? 'nuvem' : 'local',
    persistente: loja.persistente,
    usuario: null,           // { id, nome, papel, email }
    sync: { online: typeof navigator === 'undefined' || navigator.onLine !== false, enviando: false, ultima: null, erro: null },
    sb: null
  };

  const k = (t, id) => t + ':' + id;
  const avisar = (origem, tabelas) => { for (const fn of ouvintes) { try { fn(origem, tabelas); } catch (e) { console.error(e); } } };
  D.aoMudar = fn => { ouvintes.add(fn); return () => ouvintes.delete(fn); };

  function aplicarNaMemoria(t, doc, excluido) {
    const lista = estado[t];
    if (!lista) return;
    const i = lista.findIndex(x => x.id === doc.id);
    if (excluido) { if (i >= 0) lista.splice(i, 1); return; }
    if (i >= 0) lista[i] = doc; else lista.push(doc);
    // catálogo sempre na ordem do galpão (é a ordem de todos os seletores e da separação)
    if (t === 'catalogo') lista.sort((a, b) => (+a.ordem || 0) - (+b.ordem || 0));
  }

  /* carga inicial do aparelho */
  for (const r of await loja.todos('docs')) if (!r.del) aplicarNaMemoria(r.t, r.d, false);
  for (const r of await loja.todos('fila')) pendentes.set(r.k, r);
  for (const r of await loja.todos('meta')) meta.set(r.k, r.v);

  D.meta = key => meta.get(key);
  D.setMeta = async (key, v) => { meta.set(key, v); await loja.gravar('meta', [{ k: key, v }]); };

  /* Gravar: memória → aparelho → fila. Aceita um doc ou vários (em lote, um round-trip só). */
  const semPermissao = t => { const e = new Error('Seu acesso não permite gravar isso (' + t + '). Fale com o administrador.'); e.semPermissao = true; return e; };
  D.salvar = async (t, docs, { silencioso } = {}) => {
    const arr = Array.isArray(docs) ? docs : [docs];
    if (!arr.length) return arr;
    if (D.podeGravar && !D.podeGravar(t)) throw semPermissao(t);
    const quem = D.usuario ? D.usuario.nome : null;
    const regs = arr.map(d => {
      if (!d.id) d.id = novoId();
      d.atualizado_em = agora();
      if (quem) d.atualizado_por = quem;
      aplicarNaMemoria(t, d, false);
      return { k: k(t, d.id), t, id: d.id, d, del: false };
    });
    await loja.gravar('docs', regs);
    if (D.modo === 'nuvem') {
      await loja.gravar('fila', regs);
      for (const r of regs) pendentes.set(r.k, r);
      agendarEnvio();
    }
    if (!silencioso) avisar('eu', [t]);
    return arr;
  };

  D.excluir = async (t, ids, { silencioso } = {}) => {
    const arr = Array.isArray(ids) ? ids : [ids];
    if (!arr.length) return;
    if (D.podeGravar && !D.podeGravar(t)) throw semPermissao(t);
    const regs = [];
    for (const id of arr) {
      const doc = estado[t].find(x => x.id === id) || { id };
      aplicarNaMemoria(t, doc, true);
      regs.push({ k: k(t, id), t, id, d: Object.assign({}, doc, { atualizado_em: agora() }), del: true });
    }
    await loja.gravar('docs', regs);
    if (D.modo === 'nuvem') {
      await loja.gravar('fila', regs);
      for (const r of regs) pendentes.set(r.k, r);
      agendarEnvio();
    }
    if (!silencioso) avisar('eu', [t]);
  };

  /* Registro de atividade — é o que o supervisor lê para saber quem fez o quê. */
  D.registrar = async (acao, texto, ref) => {
    const doc = { id: novoId(), em: agora(), por: D.usuario ? D.usuario.nome : '—', acao, texto, ref: ref || null };
    await D.salvar('atividade', doc, { silencioso: true });
    return doc;
  };

  D.pendentes = () => pendentes.size;

  D.exportar = () => ({ app: 'projetech-led', versao: 1, exportado_em: agora(), dados: estado });
  D.importar = async (json, { substituir } = {}) => {
    const dados = json && json.dados;
    if (!dados) throw new Error('Arquivo não é um backup do Painel de LED.');
    for (const t of TABELAS) {
      const docs = Array.isArray(dados[t]) ? dados[t] : [];
      if (substituir) await D.excluir(t, estado[t].map(x => x.id).filter(id => !docs.some(d => d.id === id)), { silencioso: true });
      await D.salvar(t, docs.map(d => Object.assign({}, d)), { silencioso: true });
    }
    avisar('eu', TABELAS);
  };
  D.apagarAparelho = async () => { await loja.limpar(); };

  /* O que ficou do MODO LOCAL neste aparelho (antes de ligar a nuvem), para levar para a nuvem.
   * O modo local usa outro banco no aparelho ('projetech-led'); nada é apagado de lá. */
  D.lerModoLocal = async () => {
    if (D.modo !== 'nuvem' || typeof indexedDB === 'undefined') return null;
    try {
      if (indexedDB.databases) {
        const dbs = await indexedDB.databases();
        if (!dbs.some(d => d.name === NOME_DB_LOCAL)) return null;
      }
      const antiga = await lojaIdb(NOME_DB_LOCAL);
      const dados = Object.fromEntries(TABELAS.map(t => [t, []]));
      for (const r of await antiga.todos('docs')) if (!r.del && r.d && dados[r.t]) dados[r.t].push(r.d);
      return dados;
    } catch (e) { return null; }
  };

  /* ======================= nuvem (Supabase) ======================= */

  let timerEnvio = null;
  function agendarEnvio(ms) {
    if (D.modo !== 'nuvem') return;
    clearTimeout(timerEnvio);
    timerEnvio = setTimeout(enviar, ms == null ? 400 : ms);
  }

  async function enviar() {
    if (!D.sb || !D.usuario || D.sync.enviando || !pendentes.size) return;
    if (!D.sync.online) return;
    D.sync.enviando = true; avisar('sync', []);
    try {
      const lote = [...pendentes.values()].slice(0, 400);
      const linha = r => ({ tabela: r.t, id: r.id, dados: r.d, excluido: !!r.del });
      // atividade é só-inserção no banco: reenviar a mesma (resposta perdida no galpão) não pode travar a fila
      const grupos = [
        [lote.filter(r => r.t === 'atividade'), { onConflict: 'tabela,id', ignoreDuplicates: true }],
        [lote.filter(r => r.t !== 'atividade'), { onConflict: 'tabela,id' }]
      ];
      const tirar = [];
      let negado = null;
      for (const [regs, opc] of grupos) {
        if (!regs.length) continue;
        const { error } = await D.sb.from('led_docs').upsert(regs.map(linha), opc);
        if (error && error.code === '42501') { negado = regs; tirar.push(...regs); continue; } // sem permissão: não adianta repetir
        if (error) throw error;
        tirar.push(...regs);
      }
      // só tira da fila o que não mudou de novo enquanto subia
      const enviados = tirar.filter(r => pendentes.get(r.k) === r).map(r => r.k);
      await loja.apagar('fila', enviados);
      for (const kk of enviados) pendentes.delete(kk);
      D.sync.erro = negado ? 'Sem permissão para gravar ' + [...new Set(negado.map(r => r.t))].join(', ') + ' (só o supervisor).' : null;
      D.sync.ultima = agora();
      if (pendentes.size) agendarEnvio(50);
    } catch (e) {
      D.sync.erro = e.message || String(e);
      agendarEnvio(ESPERA_REENVIO);
    } finally {
      D.sync.enviando = false; avisar('sync', []);
    }
  }
  D.enviarAgora = () => enviar();

  function receber(row) {
    if (!row || !TABELAS.includes(row.tabela)) return false;
    const kk = k(row.tabela, row.id);
    if (pendentes.has(kk)) return false; // a minha versão ainda vai subir e vence
    const doc = row.dados || { id: row.id };
    doc.id = row.id;
    aplicarNaMemoria(row.tabela, doc, row.excluido);
    return { k: kk, t: row.tabela, id: row.id, d: doc, del: !!row.excluido };
  }

  async function puxar() {
    if (!D.sb) return;
    let desde = meta.get('ultimo_servidor') || '1970-01-01T00:00:00Z';
    // 5 s de sobreposição: transação que comitou fora de ordem não escapa (reaplicar é inofensivo)
    const desdeSeguro = new Date(new Date(desde).getTime() - 5000).toISOString();
    let pagina = 0, maior = desde;
    const mudou = new Set();
    for (;;) {
      const { data, error } = await D.sb.from('led_docs').select('*').gt('atualizado_em', desdeSeguro)
        .order('atualizado_em', { ascending: true }).range(pagina * 1000, pagina * 1000 + 999);
      if (error) throw error;
      const regs = [];
      for (const row of data) {
        const r = receber(row);
        if (r) { regs.push(r); mudou.add(row.tabela); }
        if (row.atualizado_em > maior) maior = row.atualizado_em;
      }
      if (regs.length) await loja.gravar('docs', regs);
      if (data.length < 1000) break;
      pagina++;
    }
    await D.setMeta('ultimo_servidor', maior);
    if (mudou.size) avisar('outro', [...mudou]);
  }
  D.puxar = puxar;

  D.conectar = async () => {
    if (D.modo !== 'nuvem') return D;
    D.sb = supabase.createClient(supabaseUrl, supabaseKey, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'projetech-led-auth' } });
    const { data } = await D.sb.auth.getSession();
    if (data && data.session) await carregarMembro(data.session.user);
    return D;
  };

  async function carregarMembro(user) {
    const { data, error } = await D.sb.from('led_membros').select('*').eq('user_id', user.id).maybeSingle();
    if (error) {
      if (['42P01', 'PGRST205', 'PGRST202'].includes(error.code) || /led_membros|does not exist|schema cache/i.test(error.message || ''))
        throw new Error('O banco do Painel de LED ainda não foi criado no Supabase. Rode o arquivo supabase-led.sql no SQL Editor (passo a passo no README) e entre de novo.');
      throw error;
    }
    // projeto novo, sem nenhum administrador ainda: quem entra primeiro vira o administrador (função do SQL)
    if (!data && !carregarMembro.tentouPrimeiro) {
      carregarMembro.tentouPrimeiro = true;
      try {
        const { data: virou } = await D.sb.rpc('led_primeiro_admin');
        if (virou) return carregarMembro(user);
      } catch (e) { /* SQL antigo, sem a função: segue como "sem acesso" */ }
    }
    if (!data || data.ativo === false) {
      D.usuario = null;
      D.semAcesso = { email: user.email };
      return null;
    }
    D.semAcesso = null;
    D.usuario = { id: user.id, email: user.email, nome: data.nome || user.email, papel: data.papel || 'membro', permissoes: data.permissoes || {} };
    await D.setMeta('usuario', D.usuario);
    return D.usuario;
  }

  /* O administrador mudou o acesso de alguém: vale quando a pessoa volta ao app. */
  async function recarregarPerfil() {
    if (!D.sb || !D.usuario || !D.sync.online) return;
    const antes = JSON.stringify([D.usuario.papel, D.usuario.permissoes]);
    try {
      const { data } = await D.sb.auth.getSession();
      if (!data || !data.session) return;
      await carregarMembro(data.session.user);
      if (!D.usuario) return location.reload(); // foi desativado
      if (JSON.stringify([D.usuario.papel, D.usuario.permissoes]) !== antes) avisar('perfil', []);
    } catch (e) { /* sem sinal: segue com o que tem */ }
  }
  D.recarregarPerfil = recarregarPerfil;

  D.entrar = async (email, senha) => {
    const { data, error } = await D.sb.auth.signInWithPassword({ email, password: senha });
    if (error) throw error;
    return carregarMembro(data.user);
  };

  D.sair = async () => {
    if (pendentes.size) throw new Error(`Há ${pendentes.size} alteração(ões) deste aparelho que ainda não subiram. Conecte à internet e espere "Sincronizado" antes de sair.`);
    if (D.sb) { try { await D.sb.auth.signOut(); } catch (e) { /* offline: sai local */ } }
    D.usuario = null;
    // quem sai não deixa os dados do setor no aparelho
    await loja.limpar();
  };

  /* Sem sinal ao abrir o app: entra com o último usuário que logou neste aparelho. */
  D.usuarioOffline = () => meta.get('usuario') || null;

  D.iniciarSync = async () => {
    if (D.modo !== 'nuvem' || !D.sb) return;
    try { await puxar(); } catch (e) { D.sync.erro = e.message || String(e); }
    agendarEnvio(0);
    D.sb.channel('led-docs').on('postgres_changes', { event: '*', schema: 'public', table: 'led_docs' }, async payload => {
      const r = receber(payload.new);
      if (!r) return;
      await loja.gravar('docs', [r]);
      if (payload.new.atualizado_em > (meta.get('ultimo_servidor') || '')) await D.setMeta('ultimo_servidor', payload.new.atualizado_em);
      avisar('outro', [payload.new.tabela]);
    }).subscribe();
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => { D.sync.online = true; avisar('sync', []); puxar().catch(() => {}); agendarEnvio(0); });
      window.addEventListener('offline', () => { D.sync.online = false; avisar('sync', []); });
      document.addEventListener('visibilitychange', () => { if (!document.hidden) { puxar().catch(() => {}); agendarEnvio(0); recarregarPerfil(); } });
    }
  };

  /* Membros (só supervisor, via função segura no banco). */
  D.membros = async () => {
    const { data, error } = await D.sb.from('led_membros').select('*').order('nome');
    if (error) throw error;
    return data;
  };
  D.adicionarMembro = async (email, nome, permissoes) => {
    const { error } = await D.sb.rpc('led_adicionar_membro', { p_email: email, p_nome: nome, p_permissoes: permissoes || {} });
    if (error) throw error;
  };
  D.alterarMembro = async (userId, campos) => {
    const { error } = await D.sb.from('led_membros').update(campos).eq('user_id', userId);
    if (error) throw error;
  };

  return D;
}
