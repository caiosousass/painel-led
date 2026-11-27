/* Projetech · Painel de LED — casca do app: login, navegação, contexto compartilhado pelas telas. */
import * as M from './motor.js';
import { abrirDados } from './dados.js';
import { catalogoInicial, regrasIniciais, VERSAO_REGRAS, VERSAO_CATALOGO, ITENS_NOVOS, CATEGORIAS, TIPOS_PRODUCAO, DEFEITOS, ACOES_MANUT, DEFEITOS_MANUT, UNIDADES_MANUT } from './seed.js';
import { HISTORICO } from './historico.js';
import { CONFIG } from './config.js';
import * as B from './ui/base.js';
import * as Inicio from './ui/inicio.js';
import * as Listas from './ui/listas.js';
import * as Lista from './ui/lista.js';
import * as Evento from './ui/evento.js';
import * as Projsala from './ui/projsala.js';
import * as Receber from './ui/receber.js';
import * as Separar from './ui/separar.js';
import * as Retorno from './ui/retorno.js';
import * as Estoque from './ui/estoque.js';
import * as Manutencao from './ui/manutencao.js';
import * as Bancada from './ui/bancada.js';
import * as Regras from './ui/regras.js';
import * as Catalogo from './ui/catalogo.js';
import * as Ajustes from './ui/ajustes.js';
import * as Equipe from './ui/equipe.js';
import * as Perm from './permissoes.js';

const { esc, ico } = B;
const raiz = document.getElementById('raiz');

const ROTAS = {
  inicio: Inicio, listas: Listas, lista: Lista, evento: Evento, projeto: Projsala, receber: Receber, separar: Separar, retorno: Retorno,
  estoque: Estoque, item: Estoque, manutencao: Manutencao, bancada: Bancada,
  regras: Regras, catalogo: Catalogo, ajustes: Ajustes, equipe: Equipe
};
const NAV = [
  ['inicio', 'Início', 'inicio'], ['listas', 'Listas', 'listas'], ['estoque', 'Estoque', 'estoque'],
  ['manutencao', 'Manutenção', 'manut'], ['bancada', 'Bancada', 'bancada'],
  ['regras', 'Regras', 'regras'], ['catalogo', 'Catálogo', 'catalogo'], ['equipe', 'Equipe', 'equipe'], ['ajustes', 'Ajustes', 'ajustes']
];
const NAV_BAIXO = ['inicio', 'listas', 'estoque', 'manutencao', 'bancada'];

/* ---------------- carregar o supabase só quando a nuvem está ligada ---------------- */
function carregarScript(src) {
  return new Promise((ok, erro) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => erro(new Error('Não carregou ' + src)); document.head.appendChild(s); });
}

let D;
const ctx = {
  M, B,
  CATEGORIAS: Object.fromEntries(CATEGORIAS), ORDEM_CAT: CATEGORIAS.map(c => c[0]),
  TIPOS_PRODUCAO: Object.fromEntries(TIPOS_PRODUCAO), DEFEITOS,
  ACOES_MANUT, DEFEITOS_MANUT: Object.fromEntries(DEFEITOS_MANUT), UNIDADES_MANUT: Object.fromEntries(UNIDADES_MANUT),
  get D() { return D; },
  get est() { return D.estado; },
  get usuario() { return D.usuario; },
  hoje: () => D.hoje(),
  agora: () => D.agora(),
  novoId: () => D.novoId(),
  // quem pode o quê (permissoes.js): o administrador pode tudo; os outros, o que ele marcou
  admin: () => Perm.ehAdmin(D.usuario),
  supervisor: () => Perm.ehAdmin(D.usuario),
  pode: modulo => Perm.podeEditar(D.usuario, modulo),
  ve: modulo => Perm.podeVer(D.usuario, modulo),
  Perm,
  quem: () => (D.usuario ? D.usuario.nome : '—'),
  catIdx: () => M.indexar(D.estado.catalogo),
  item: id => D.estado.catalogo.find(c => c.id === id) || null,
  nomeItem: id => { const c = D.estado.catalogo.find(x => x.id === id); return c ? c.nome : '(item removido)'; },
  lista: id => D.estado.listas.find(l => l.id === id) || null,
  linhasDa: id => D.estado.linhas.filter(l => l.lista === id),
  estadoEstoque: () => ({ catalogo: D.estado.catalogo, listas: D.estado.listas, linhas: D.estado.linhas, movimentos: D.estado.movimentos, manutencoes: D.estado.manutencoes, manutlog: D.estado.manutlog }),
  /* "Costuma ir": compara com listas que usaram o mesmo painel (LiteVision leva cabo DC, P3.9 não);
   * com pouco histórico daquele painel, compara com todas as de painel no chão. */
  frequencias: lista => {
    const proprio = M.historicoDasListas(D.estado.listas, D.estado.linhas, D.estado.catalogo);
    const hist = HISTORICO.concat(proprio);
    const paineis = new Set(((lista && lista.telas) || []).map(t => t.painel).filter(Boolean));
    if (paineis.size) {
      const mesmo = hist.filter(h => Object.keys(h.itens).some(k => paineis.has(k)));
      if (mesmo.length >= 5) return M.frequencias(mesmo);
    }
    return M.frequencias(hist, { soChao: true });
  },
  regrasAtivas: () => D.estado.regras.filter(r => r.ativa !== false),
  ir: rota => { if (location.hash !== '#/' + rota) location.hash = '#/' + rota; else renderizar(); },
  atualizar: () => renderizar({ manterRolagem: true }),
  painelSemente: semear
};

/* ---------------- boot ---------------- */
async function iniciar() {
  B.definirRaiz(document.body);
  const nuvem = !!(CONFIG.supabaseUrl && CONFIG.supabaseKey);
  let supabase = null;
  if (nuvem) {
    try { await carregarScript('vendor/supabase.min.js'); supabase = window.supabase; } catch (e) { console.warn(e); }
  }
  D = await abrirDados({ supabaseUrl: CONFIG.supabaseUrl, supabaseKey: CONFIG.supabaseKey, supabase });

  if (D.modo === 'nuvem') {
    try { await D.conectar(); } catch (e) {
      // sem sinal: segue com o último usuário deste aparelho
      const u = D.usuarioOffline();
      if (u) D.usuario = u;
    }
    if (!D.usuario) return telaLogin();
    await entrarNoApp();
  } else {
    D.usuario = D.meta('usuario_local') || null;
    if (!D.usuario) return telaQuemSou();
    if (!D.estado.catalogo.length && !D.meta('semeado')) await semear();
    await entrarNoApp();
  }
}

/* Regras padrão novas: troca sozinho se ninguém editou regra à mão; se editou, só avisa (Ajustes). */
async function atualizarRegrasPadrao() {
  if (!D.estado.regras.length || (D.meta('regras_versao') || 1) >= VERSAO_REGRAS) return;
  const novas = regrasIniciais();
  // compara o conteúdo (não só o id: a versão 4 só pôs o P1.9 na lista de painéis da regra do jumper)
  const chave = r => JSON.stringify([r.id, r.item, r.escopo, r.base, r.fator, r.reserva, r.adicional, r.arred, r.multiplo, r.minimo, r.maximo, r.teto || 0,
    [...(r.paineis || [])].sort(), [...(r.montagens || [])].sort(), r.cond || null, r.ativa !== false]);
  const atuais = new Set(D.estado.regras.map(chave));
  if (novas.every(r => atuais.has(chave(r)))) { await D.setMeta('regras_versao', VERSAO_REGRAS); return; } // outro aparelho já atualizou
  const mexeu = D.estado.atividade.some(x => ['regra', 'regra_criada'].includes(x.acao) && !/ao padrão/.test(x.texto || ''));
  if (mexeu || !ctx.admin()) { D.regrasNovas = true; return; }
  await D.excluir('regras', D.estado.regras.map(r => r.id), { silencioso: true });
  await D.salvar('regras', novas, { silencioso: true });
  await D.setMeta('regras_versao', VERSAO_REGRAS);
  await D.registrar('sistema', `atualizou as regras padrão (versão ${VERSAO_REGRAS})`);
}

/* Itens novos no catálogo (ex.: P1.9, 03/11/2026): acrescenta os que faltam, sem mexer nos que já existem;
 * item novo que entrou como "não contado" recebe a quantidade informada depois (nunca por cima de uma contagem).
 * Quem não pode editar o catálogo recebe pela nuvem quando o administrador abrir o app. */
async function atualizarCatalogo() {
  if (!D.estado.catalogo.length || (D.meta('catalogo_versao') || 1) >= VERSAO_CATALOGO) return;
  const atual = new Map(D.estado.catalogo.map(c => [c.id, c]));
  const base = catalogoInicial();
  const faltam = base.filter(c => !atual.has(c.id));
  const contar = base.filter(c => ITENS_NOVOS.includes(c.id) && c.qtd != null && atual.has(c.id) && atual.get(c.id).qtd == null)
    .map(c => Object.assign({}, atual.get(c.id), { qtd: c.qtd }));
  // v4: "12 gabinetes por circuito" era o padrão chutado — vira "pelo consumo" (3,5 kW por circuito), como no projeto
  const circ = D.estado.catalogo.filter(c => c.painel && +c.painel.por_circuito === 12)
    .map(c => Object.assign({}, c, { painel: Object.assign({}, c.painel, { por_circuito: null }) }));
  if (faltam.length || contar.length || circ.length) {
    if (!ctx.pode('catalogo')) return;
    if (circ.length) {
      await D.salvar('catalogo', circ, { silencioso: true });
      await D.registrar('sistema', `gabinetes por circuito agora pelo consumo (até 3,5 kW por circuito): ${circ.map(c => c.nome).join(', ')}`);
    }
    if (faltam.length) {
      await D.salvar('catalogo', faltam, { silencioso: true });
      await D.registrar('sistema', `acrescentou ao catálogo: ${faltam.map(c => c.nome + (c.qtd != null ? ' (' + c.qtd + ')' : '')).join(', ')}`);
    }
    if (contar.length) {
      await D.salvar('catalogo', contar, { silencioso: true });
      await D.registrar('sistema', `preencheu o estoque: ${contar.map(c => c.nome + ' = ' + c.qtd).join(', ')}`);
    }
  }
  await D.setMeta('catalogo_versao', VERSAO_CATALOGO);
}

async function semear() {
  await D.salvar('catalogo', catalogoInicial(), { silencioso: true });
  await D.salvar('regras', regrasIniciais(), { silencioso: true });
  await D.setMeta('semeado', true);
  await D.setMeta('regras_versao', VERSAO_REGRAS);
  await D.setMeta('catalogo_versao', VERSAO_CATALOGO);
  await D.registrar('sistema', 'carregou o catálogo (lista zerada) e as regras iniciais');
}

function telaQuemSou() {
  raiz.innerHTML = `<div class="login"><div class="caixa card">
    <img class="logo" src="logo.png" alt="Projetech">
    <h1>Painel de LED</h1>
    <p>Modo local — os dados ficam neste aparelho.<br>Quem está usando?</p>
    <label class="campo"><span>Seu nome</span><input type="text" class="nome-local" autocomplete="name" autofocus></label>
    <div style="height:12px"></div>
    <button class="btn pri grande cheio entrar">Entrar</button>
  </div></div>`;
  const ir = async () => {
    const nome = raiz.querySelector('.nome-local').value.trim();
    if (!nome) { raiz.querySelector('.nome-local').classList.add('erro'); return; }
    D.usuario = { id: 'local', nome, papel: 'supervisor' };
    await D.setMeta('usuario_local', D.usuario);
    if (!D.estado.catalogo.length && !D.meta('semeado')) await semear();
    await entrarNoApp();
  };
  raiz.querySelector('.entrar').onclick = ir;
  raiz.querySelector('.nome-local').addEventListener('keydown', e => { if (e.key === 'Enter') ir(); });
}

function telaLogin(msg) {
  const semAcesso = D.semAcesso;
  raiz.innerHTML = `<div class="login"><div class="caixa card">
    <img class="logo" src="logo.png" alt="Projetech">
    <h1>Painel de LED</h1>
    ${semAcesso
      ? `<p>Você entrou como <b>${esc(semAcesso.email)}</b>. Seu acesso ainda <b>não foi liberado</b>.<br>Avise o supervisor: ele libera em <b>Equipe → Pedindo acesso</b>.</p>
         <p class="dica erro-msg vermelho">${esc(msg || '')}</p>
         <button class="btn pri grande cheio conferir">Já fui liberado — entrar</button>
         <div style="height:8px"></div>
         <button class="btn cheio sair">Sair e entrar com outra conta</button>`
      : `<p>Entre com o seu e-mail e senha.</p>
         <label class="campo"><span>E-mail</span><input type="email" class="email" autocomplete="username" autofocus></label>
         <div style="height:10px"></div>
         <label class="campo"><span>Senha</span><input type="password" class="senha" autocomplete="current-password"></label>
         <p class="dica erro-msg vermelho">${esc(msg || '')}</p>
         <button class="btn pri grande cheio entrar">Entrar</button>
         <div class="login-links"><button class="link cadastrar">Primeiro acesso? Criar minha conta</button>
           <button class="link esqueci">Esqueci minha senha</button></div>`}
  </div></div>`;
  if (semAcesso) {
    raiz.querySelector('.sair').onclick = async () => { await D.sair(); D.semAcesso = null; telaLogin(); };
    raiz.querySelector('.conferir').onclick = async () => {
      try { const u = await D.conferirAcesso(); if (u) return entrarNoApp(); telaLogin('Ainda não foi liberado. Confira com o supervisor.'); }
      catch (e) { telaLogin('Não deu para conferir: ' + e.message); }
    };
    return;
  }
  raiz.querySelector('.cadastrar').onclick = () => telaCadastro();
  raiz.querySelector('.esqueci').onclick = () => B.modal({ titulo: 'Esqueci minha senha',
    corpo: '<p class="modal-txt">Peça ao supervisor uma <b>senha provisória</b> — ele define em <b>Equipe → Trocar senha</b>, no próprio app. Depois de entrar, troque pela sua em <b>Ajustes → Trocar minha senha</b>.</p>' });
  const ir = async () => {
    const b = raiz.querySelector('.entrar');
    b.disabled = true; b.textContent = 'Entrando…';
    try {
      const u = await D.entrar(raiz.querySelector('.email').value.trim(), raiz.querySelector('.senha').value);
      if (!u) return telaLogin();
      await entrarNoApp();
    } catch (e) {
      telaLogin(/invalid/i.test(e.message) ? 'E-mail ou senha incorretos.' : 'Não deu para entrar: ' + e.message);
    }
  };
  raiz.querySelector('.entrar').onclick = ir;
  raiz.querySelector('.senha').addEventListener('keydown', e => { if (e.key === 'Enter') ir(); });
}

/* Primeiro acesso: a pessoa cria a própria conta; fica "pedindo acesso" até o supervisor liberar em Equipe */
function telaCadastro(msg, valores = {}) {
  raiz.innerHTML = `<div class="login"><div class="caixa card">
    <img class="logo" src="logo.png" alt="Projetech">
    <h1>Criar minha conta</h1>
    <p>Depois de criar, avise o supervisor para liberar o seu acesso.</p>
    <label class="campo"><span>Seu nome</span><input class="c-nome" autocomplete="name" value="${esc(valores.nome || '')}" autofocus></label>
    <div style="height:10px"></div>
    <label class="campo"><span>E-mail</span><input type="email" class="c-email" autocomplete="username" value="${esc(valores.email || '')}"></label>
    <div style="height:10px"></div>
    <label class="campo"><span>Senha (mínimo 6)</span><input type="password" class="c-senha" autocomplete="new-password"></label>
    <div style="height:10px"></div>
    <label class="campo"><span>Repita a senha</span><input type="password" class="c-senha2" autocomplete="new-password"></label>
    <p class="dica erro-msg vermelho">${esc(msg || '')}</p>
    <button class="btn pri grande cheio criar">Criar minha conta</button>
    <div class="login-links"><button class="link voltar-login">Já tenho conta — entrar</button></div>
  </div></div>`;
  raiz.querySelector('.voltar-login').onclick = () => telaLogin();
  const criar = async () => {
    const nome = raiz.querySelector('.c-nome').value.trim(), email = raiz.querySelector('.c-email').value.trim();
    const s1 = raiz.querySelector('.c-senha').value, s2 = raiz.querySelector('.c-senha2').value;
    if (nome.length < 2) return telaCadastro('Escreva o seu nome (é assim que o supervisor vai te reconhecer).', { nome, email });
    if (!/^\S+@\S+\.\S+$/.test(email)) return telaCadastro('E-mail inválido.', { nome, email });
    if (s1.length < 6) return telaCadastro('A senha precisa de pelo menos 6 caracteres.', { nome, email });
    if (s1 !== s2) return telaCadastro('As duas senhas não são iguais.', { nome, email });
    const b = raiz.querySelector('.criar');
    b.disabled = true; b.textContent = 'Criando…';
    try {
      const u = await D.cadastrar(nome, email, s1);
      if (u) return entrarNoApp();            // (só acontece se já estava liberado)
      telaLogin();                             // mostra "seu acesso ainda não foi liberado"
    } catch (e) { telaCadastro(e.message, { nome, email }); }
  };
  raiz.querySelector('.criar').onclick = criar;
  raiz.querySelector('.c-senha2').addEventListener('keydown', e => { if (e.key === 'Enter') criar(); });
}

/* ---------------- casca ---------------- */
async function entrarNoApp() {
  D.podeGravar = t => Perm.podeGravar(D.usuario, t);
  await atualizarCatalogo();
  await atualizarRegrasPadrao();
  montarCasca();
  D.aoMudar((origem) => {
    if (origem === 'sync') return atualizarSync();
    if (origem === 'perfil') { montarCasca(); return renderizar(); }
    atualizarBadges();
    if (origem === 'outro') agendarRender();
  });
  window.addEventListener('hashchange', () => renderizar());
  renderizar();
  if (D.modo === 'nuvem') {
    await D.iniciarSync();
    atualizarSync();
  }
}

function montarCasca() {
  const quem = D.usuario ? D.usuario.nome : '';
  raiz.innerHTML = `<div class="app">
    <nav class="lateral" aria-label="Menu">
      <img class="logo logo-cheio" src="logo.png" alt="Projetech">
      <img class="logo logo-marca" src="logo-mark.png" alt="Projetech">
      <div class="sub">Painel de LED</div>
      ${navVisivel().map(([r, t, i]) => `<button data-r="${r}" title="${t}">${ico(i)}<span class="rot">${t}</span><span class="badge" data-badge="${r}" hidden></span></button>`).join('')}
      <div class="rodape"><div class="quem">${esc(quem)}${D.usuario && D.usuario.papel ? ' · ' + (D.usuario.papel === 'supervisor' ? 'supervisor' : 'técnico') : ''}</div>
        <div class="versao" data-versao>${esc(textoVersao())}</div>
        <button class="recolher" title="Recolher menu" aria-label="Recolher ou abrir o menu">${ico('back')}</button></div>
    </nav>
    <div class="conteudo">
      <header class="topo"><img class="logo" src="logo-mark.png" alt=""><span class="tit">Painel de LED</span>
        <button class="sync" title="Sincronização"><i></i><span></span></button>
        <button class="atualizar-app" title="Saiu uma versão nova: toque para carregar" ${VERSAO.nova ? '' : 'hidden'}>${ico('refresh')}<span>${esc(textoAtualizar())}</span></button>
        <button class="tema-btn" title="Fundo claro / escuro" aria-label="Trocar fundo claro ou escuro"></button></header>
      <main id="principal"></main>
    </div>
    <nav class="navbaixo" aria-label="Menu">
      ${navBaixo().map(r => { const n = NAV.find(x => x[0] === r); return `<button data-r="${r}">${ico(n[2])}<span>${n[1] === 'Manutenção' ? 'Manut.' : n[1]}</span><span class="badge" data-badge="${r}" hidden></span></button>`; }).join('')}
      <button data-r="mais">${ico('mais')}<span>Mais</span></button>
    </nav>
    <div class="toasts"></div>
  </div>`;
  raiz.querySelectorAll('[data-r]').forEach(b => {
    b.onclick = () => (b.dataset.r === 'mais' ? menuMais() : ctx.ir(b.dataset.r));
  });
  raiz.querySelector('.sync').onclick = () => ctx.ir('ajustes');
  // menu lateral recolhível (computador): lembra a escolha neste aparelho
  const recolhido = () => { try { return localStorage.getItem('led-menu') === 'recolhido'; } catch (e) { return false; } };
  document.body.classList.toggle('menu-recolhido', recolhido());
  raiz.querySelector('.recolher').onclick = () => {
    const r = !document.body.classList.contains('menu-recolhido');
    document.body.classList.toggle('menu-recolhido', r);
    try { localStorage.setItem('led-menu', r ? 'recolhido' : 'aberto'); } catch (e) { /* sem storage: vale até recarregar */ }
  };
  const tb = raiz.querySelector('.tema-btn');
  const pintaTema = () => { tb.innerHTML = ico(B.temaEfetivo() === 'claro' ? 'lua' : 'sol'); };
  tb.onclick = () => { B.aplicarTema(B.temaEfetivo() === 'claro' ? 'escuro' : 'claro'); pintaTema(); if (rotaAtual().nome === 'ajustes') renderizar({ manterRolagem: true }); };
  pintaTema();
  B.aplicarTema(B.temaEscolhido()); // acerta a cor da barra do celular
  atualizarSync();
  atualizarBadges();
}

async function menuMais() {
  const v = await B.modal({
    titulo: 'Mais',
    corpo: `<div class="lista-escolha">${navVisivel().filter(n => !navBaixo().includes(n[0])).map(([r, t, i]) => `<button class="escolha" data-r="${r}"><b>${t}</b></button>`).join('')}</div>
      <p class="versao-mais" data-versao>${esc(textoVersao())}</p>`,
    botoes: [{ txt: 'Fechar', valor: null }],
    aoAbrir: (el, fechar) => el.querySelectorAll('[data-r]').forEach(b => { b.onclick = () => fechar(b.dataset.r); })
  });
  if (v) ctx.ir(v);
}

function atualizarSync() {
  const el = raiz.querySelector('.sync');
  if (!el) return;
  let cls = '', txt = '';
  if (D.modo === 'local') { cls = 'local'; txt = 'Neste aparelho'; }
  else if (!D.sync.online) { cls = 'off'; txt = D.pendentes() ? `Sem sinal · ${D.pendentes()} p/ enviar` : 'Sem sinal · salvo aqui'; }
  else if (D.sync.erro) { cls = 'erro'; txt = 'Erro ao enviar'; }
  else if (D.pendentes() || D.sync.enviando) { cls = 'off'; txt = 'Enviando…'; }
  else { txt = 'Sincronizado'; }
  el.className = 'sync ' + cls;
  el.querySelector('span').textContent = txt;
}

function atualizarBadges() {
  if (!raiz.querySelector('[data-badge]')) return;
  const hoje = D.hoje();
  const ab = D.estado.manutencoes.filter(m => M.STATUS_MANUT_ABERTA.includes(m.status)).length;
  const urg = D.estado.listas.filter(l => ['rascunho', 'pronta', 'separando'].includes(l.status) && l.ida && M.D.dif(hoje, l.ida) <= 2).length;
  const set = (r, n) => raiz.querySelectorAll(`[data-badge="${r}"]`).forEach(b => { b.hidden = !n; b.textContent = n; });
  set('manutencao', ab);
  set('listas', urg);
}

/* ---------------- roteador ---------------- */
let renderPendente = false;
function agendarRender() {
  if (ROTAS[rotaAtual().nome] && ROTAS[rotaAtual().nome].naoRedesenhar) return;
  const main = document.getElementById('principal');
  const ativo = document.activeElement;
  if (main && ativo && main.contains(ativo) && /INPUT|TEXTAREA|SELECT/.test(ativo.tagName)) {
    if (renderPendente) return;
    renderPendente = true;
    ativo.addEventListener('blur', () => { renderPendente = false; setTimeout(() => renderizar({ manterRolagem: true }), 50); }, { once: true });
    return;
  }
  if (document.querySelector('.modal-fundo')) { setTimeout(agendarRender, 800); return; }
  renderizar({ manterRolagem: true });
}

function navVisivel() { return NAV.filter(([r]) => Perm.podeAbrir(D.usuario, r)); }
function navBaixo() {
  const vis = navVisivel().map(n => n[0]).filter(r => r !== 'ajustes' && r !== 'equipe');
  const preferidas = NAV_BAIXO.filter(r => vis.includes(r));
  return preferidas.concat(vis.filter(r => !preferidas.includes(r))).slice(0, 5);
}

function rotaAtual() {
  const h = location.hash.replace(/^#\/?/, '');
  const [nome, ...resto] = h.split('/');
  return { nome: ROTAS[nome] ? nome : Perm.telaInicial(D.usuario), params: resto.map(decodeURIComponent) };
}

let ultimaRota = '';
function renderizar({ manterRolagem } = {}) {
  const main = document.getElementById('principal');
  if (!main) return;
  const { nome, params } = rotaAtual();
  const chave = nome + '/' + params.join('/');
  const mudouRota = chave !== ultimaRota;
  ultimaRota = chave;
  const y = window.scrollY;
  // guarda o foco (campo de quantidade) para devolver depois de redesenhar
  const ativo = document.activeElement;
  const focoK = ativo && main.contains(ativo) ? ativo.dataset.k : null;
  const sel = focoK && ativo.selectionStart != null ? [ativo.selectionStart, ativo.selectionEnd] : null;

  const mod = ROTAS[nome];
  raiz.querySelectorAll('[data-r]').forEach(b => b.classList.toggle('on', b.dataset.r === (nome === 'lista' || nome === 'evento' || nome === 'projeto' || nome === 'receber' || nome === 'separar' || nome === 'retorno' ? 'listas' : nome === 'item' ? 'estoque' : nome)));
  try {
    if (!Perm.podeAbrir(D.usuario, nome)) {
      main.innerHTML = `<div class="card vazio">${ico('lock')}<div><b>Sem acesso a esta tela.</b><br>Peça ao administrador para liberar.</div><button class="btn" style="margin-top:12px" onclick="location.hash='#/${Perm.telaInicial(D.usuario)}'">Voltar</button></div>`;
    } else {
      main.innerHTML = mod.render(ctx, params, nome);
      if (mod.ligar) mod.ligar(main, ctx, params, nome);
    }
  } catch (e) {
    console.error(e);
    main.innerHTML = `<div class="card alerta"><h2>Algo deu errado nesta tela</h2><p class="muted">${esc(e.message)}</p><button class="btn" onclick="location.hash='#/inicio'">Voltar ao início</button></div>`;
  }
  if (focoK) {
    const el = main.querySelector(`[data-k="${CSS.escape(focoK)}"]`);
    if (el) { el.focus(); if (sel && el.setSelectionRange) try { el.setSelectionRange(sel[0], sel[1]); } catch (e) { /* tipo sem seleção */ } }
  }
  if (mudouRota && !manterRolagem) window.scrollTo(0, 0); else window.scrollTo(0, y);
  atualizarBadges();
}

const VERSAO = { atual: '', nova: '' };   // a versão à vista (lá embaixo)
window.addEventListener('unhandledrejection', ev => {
  if (ev.reason && ev.reason.semPermissao) { ev.preventDefault(); B.toast(ev.reason.message, { tipo: 'erro' }); }
});

iniciar().catch(e => {
  console.error(e);
  raiz.innerHTML = `<div class="login"><div class="caixa card"><h1>Não foi possível abrir</h1><p class="muted">${esc(e.message)}</p></div></div>`;
});

/* Versão à vista (igual ao Calculator): sai do próprio sw.js ("painel-led-v32"), então não tem um segundo
 * lugar para esquecer de mudar. Fica no rodapé do menu (no celular, em "Mais"). Quando sai uma versão nova
 * enquanto o app está aberto, aparece "Atualizar" no topo. */
function textoVersao() { return VERSAO.atual ? 'Painel de LED · ' + VERSAO.atual : ''; }
function textoAtualizar() { return VERSAO.nova && VERSAO.nova !== VERSAO.atual ? 'Atualizar para ' + VERSAO.nova : 'Atualizar'; }
async function lerVersao() {
  try { const m = /painel-led-(v\d+)/.exec(await (await fetch('sw.js', { cache: 'no-store' })).text()); return m ? m[1] : ''; } catch (e) { return ''; }
}
function mostrarVersao() {
  document.querySelectorAll('[data-versao]').forEach(e => { e.textContent = textoVersao(); });
  document.querySelectorAll('.atualizar-app').forEach(b => {
    b.hidden = !VERSAO.nova;
    b.querySelector('span').textContent = textoAtualizar();
    b.onclick = () => location.reload();
  });
}
// a versão que está RODANDO: a do cache do service worker que abriu a página (na primeira visita, a do servidor)
async function versaoRodando() {
  try {
    if (navigator.serviceWorker && navigator.serviceWorker.controller && window.caches) {
      const vs = (await caches.keys()).map(k => /^painel-led-(v\d+)$/.exec(k)).filter(Boolean).map(m => m[1]).sort((a, b) => parseInt(a.slice(1), 10) - parseInt(b.slice(1), 10));
      if (vs.length) return vs[vs.length - 1];   // logo depois de atualizar, o cache velho ainda pode estar saindo
    }
  } catch (e) { /* sem cache: vale a do servidor */ }
  return lerVersao();
}
if (location.protocol !== 'file:') versaoRodando().then(v => { VERSAO.atual = v; mostrarVersao(); });

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').then(reg => {
    const avisa = async () => { VERSAO.nova = (await lerVersao()) || 'nova'; mostrarVersao(); };
    reg.addEventListener('updatefound', () => {
      const novo = reg.installing;
      if (novo) novo.addEventListener('statechange', () => { if (novo.state === 'installed' && navigator.serviceWorker.controller) avisa(); });
    });
    setInterval(() => reg.update().catch(() => {}), 60000);   // procura versão nova de minuto em minuto
  }).catch(() => {});
}
