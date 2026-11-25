/* Tela: Equipe — só o administrador vê. Cada pessoa da equipe tem o seu login; aqui ele escolhe,
 * módulo por módulo, se ela não acessa, só vê ou pode editar. O banco recusa o que não foi liberado. */

let membros = null;      // carregados do Supabase
let pedidos = null;      // contas criadas pelo app ("Primeiro acesso") esperando liberação
let erroPedidos = null;
let carregando = false;
let erro = null;
const abertos = new Set();

function modeloDe(ctx, perm) {
  const { Perm } = ctx;
  for (const [k, p] of Object.entries(Perm.PERFIS)) if (Perm.CHAVES.every(m => (perm || {})[m] === p.permissoes[m])) return k;
  return 'personalizado';
}

function grade(ctx, perm, ro) {
  const { B, Perm } = ctx;
  return Perm.MODULOS.map(([k, nome, desc, niveis]) => `<div class="perm-lin" data-mod="${k}">
      <div class="perm-nome"><b>${B.esc(nome)}</b><small>${B.esc(desc)}</small></div>
      <div class="abas perm-niveis">${niveis.map(n => `<button data-n="${n}" class="${(perm[k] || 'nao') === n ? 'on' : ''} n-${n}" ${ro ? 'disabled' : ''}>${Perm.NOME_NIVEL[n]}</button>`).join('')}</div>
    </div>`).join('');
}

export function render(ctx) {
  const { B, Perm } = ctx;
  const D = ctx.D;
  const cab = `<div class="cab"><div><h1>Equipe</h1><div class="sub">Só você vê esta tela. Escolha o que cada pessoa pode ver e editar.</div></div>
    ${D.modo === 'nuvem' ? `<div class="acoes"><button class="btn add">${B.ico('add')} Adicionar por e-mail</button></div>` : ''}</div>`;

  if (D.modo !== 'nuvem') {
    return cab + `<div class="card aviso"><h2>${B.ico('lock')} Os acessos por pessoa precisam do modo online</h2>
      <p class="peq" style="margin:0 0 8px">Hoje o sistema está no <b>modo local</b>: não tem login, e quem usa este aparelho entra com acesso total.
      Para cada pessoa ter o próprio login (e só ver o que você liberar), o sistema precisa estar ligado ao Supabase — o mesmo do Projetech Calculator.</p>
      <p class="peq" style="margin:0">Passo a passo no README (seção "Ligar o modo online"): rodar <b>supabase-led.sql</b> uma vez e preencher a configuração.</p></div>
      <div class="card"><h2>O que você vai poder controlar por pessoa</h2>${grade(ctx, Perm.PERFIS.tecnico.permissoes, true)}
      <p class="dica">Exemplo acima: o modelo "Técnico do galpão". Há também "Só separação e retorno" e "Só consulta", e dá para ajustar módulo por módulo.</p></div>`;
  }

  if (!membros && !carregando && !erro) carregar(ctx);
  if (erro) return cab + `<div class="card alerta"><h2>Não deu para carregar a equipe</h2><p class="peq">${B.esc(erro)}</p><button class="btn recarregar">Tentar de novo</button></div>`;
  if (!membros) return cab + `<div class="card vazio">Carregando a equipe…</div>`;

  const lista = membros.slice().sort((a, b) => (Perm.ehAdmin(b) - Perm.ehAdmin(a)) || (b.ativo !== false) - (a.ativo !== false) || String(a.nome || '').localeCompare(String(b.nome || '')));
  const blocoPedidos = erroPedidos
    ? `<div class="card aviso"><h2>Pedindo acesso</h2><p class="peq" style="margin:0">${B.esc(erroPedidos)}</p></div>`
    : `<div class="card ${pedidos && pedidos.length ? 'aviso' : ''}"><h2>${B.ico('equipe')} Pedindo acesso <span class="conta">${pedidos ? pedidos.length : '…'}</span></h2>
      ${pedidos && pedidos.length ? pedidos.map(p => `<div class="linha-flex pedido" data-p="${B.esc(p.user_id)}" style="padding:8px 0;border-bottom:1px solid var(--line)">
          <div class="cresce"><b>${B.esc(p.nome || p.email)}</b><div class="peq muted">${B.esc(p.email)} · criou a conta ${B.quando(p.criado_em, ctx.hoje())}</div></div>
          <button class="btn pri sm liberar">${B.ico('check')} Liberar</button><button class="btn sm recusar">Recusar</button></div>`).join('')
        : '<p class="peq muted" style="margin:0">Ninguém esperando. Para dar acesso a alguém: mande o link do app e peça para tocar <b>"Primeiro acesso? Criar minha conta"</b> — a pessoa aparece aqui.</p>'}
    </div>`;
  return cab + blocoPedidos + lista.map(m => {
    const admin = Perm.ehAdmin(m);
    const eu = ctx.usuario && m.user_id === ctx.usuario.id;
    const perm = Perm.permissoesDe(m);
    const modelo = modeloDe(ctx, perm);
    const aberto = abertos.has(m.user_id);
    return `<div class="card membro" data-u="${B.esc(m.user_id)}" style="${m.ativo === false ? 'opacity:.6' : ''}">
      <div class="linha-flex"><div class="cresce"><b style="font-size:15.5px">${B.esc(m.nome || m.email)}</b>${eu ? ' <span class="pill azul">você</span>' : ''}
        <div class="peq muted">${B.esc(m.email || '')}</div></div>
        ${admin ? B.pill('Acesso total', 'verde') : `<label class="linha-flex peq"><input type="checkbox" class="ativo" ${m.ativo !== false ? 'checked' : ''} style="width:20px;height:20px"> ativo</label>`}</div>
      ${!eu && !admin ? `<div style="margin-top:8px"><button class="btn sm senha">${B.ico('lock')} Trocar senha</button></div>` : ''}
      ${admin ? `<p class="dica" style="margin:8px 0 0">Administrador: vê e edita tudo e gerencia a equipe.</p>` : `
        <div class="linha-flex" style="margin-top:10px">
          <label class="campo cresce"><span>Modelo</span><select class="modelo">${Object.entries(Perm.PERFIS).map(([k, p]) => `<option value="${k}" ${k === modelo ? 'selected' : ''}>${B.esc(p.nome)}</option>`).join('')}${modelo === 'personalizado' ? '<option value="personalizado" selected>Personalizado</option>' : ''}</select></label>
          <button class="btn sm detalhe" style="align-self:flex-end">${aberto ? 'Fechar' : 'Ajustar módulo por módulo'}</button>
        </div>
        <div class="peq muted" style="margin-top:8px">${Perm.MODULOS.filter(([k]) => perm[k] !== 'nao').map(([k, n]) => `${n}: <b>${Perm.NOME_NIVEL[perm[k]].toLowerCase()}</b>`).join(' · ') || 'Sem acesso a nada.'}</div>
        ${aberto ? `<div class="perm-grade">${grade(ctx, perm, false)}</div>` : ''}`}
    </div>`;
  }).join('') + `<p class="dica">Esqueceram a senha: "Trocar senha" define uma provisória (a pessoa troca em Ajustes → Trocar minha senha). Mudou o acesso de alguém: vale quando ela voltar ao app.</p>`;
}

async function carregar(ctx) {
  carregando = true;
  try { membros = await ctx.D.membros(); erro = null; } catch (e) { erro = e.message || String(e); }
  try { pedidos = await ctx.D.pedidosAcesso(); erroPedidos = null; } catch (e) { pedidos = []; erroPedidos = e.message || String(e); }
  carregando = false;
  ctx.atualizar();
}

async function salvar(ctx, m, campos, texto) {
  try {
    await ctx.D.alterarMembro(m.user_id, campos);
    Object.assign(m, campos);
    await ctx.D.registrar('equipe', texto, m.user_id);
  } catch (e) { ctx.B.toast('Não salvou: ' + (e.message || e), { tipo: 'erro' }); }
  ctx.atualizar();
}

export function ligar(el, ctx) {
  const { B, Perm } = ctx;
  const rec = el.querySelector('.recarregar');
  if (rec) rec.onclick = () => { erro = null; membros = null; ctx.atualizar(); };
  const recarregar = () => { membros = null; pedidos = null; ctx.atualizar(); };

  // pedidos de acesso: liberar com um modelo de permissão, ou recusar
  el.querySelectorAll('.pedido[data-p]').forEach(lin => {
    const p = (pedidos || []).find(x => x.user_id === lin.dataset.p);
    if (!p) return;
    lin.querySelector('.liberar').onclick = async () => {
      const r = await B.modal({
        titulo: 'Liberar acesso',
        corpo: `<p class="peq" style="margin:0 0 10px">${B.esc(p.email)}</p>
          <label class="campo"><span>Nome</span><input class="m-n" value="${B.esc(p.nome || '')}"></label>
          <label class="campo" style="margin-top:10px"><span>O que a pessoa pode fazer</span><select class="m-p">${Object.entries(Perm.PERFIS).map(([k, x]) => `<option value="${k}">${B.esc(x.nome)}</option>`).join('')}</select></label>
          <p class="dica">Depois dá para ajustar módulo por módulo.</p>`,
        botoes: [{ txt: 'Cancelar', valor: null }, { txt: 'Liberar', cls: 'pri', valor: m => ({ n: m.querySelector('.m-n').value.trim() || p.nome || p.email, k: m.querySelector('.m-p').value }) }]
      });
      if (!r) return;
      try {
        await ctx.D.adicionarMembro(p.email, r.n, Perm.PERFIS[r.k].permissoes);
        await ctx.D.registrar('equipe', `liberou o acesso de ${r.n} (${Perm.PERFIS[r.k].nome})`, p.user_id);
        B.toast(`${r.n} liberado. Ele toca "Já fui liberado — entrar".`);
      } catch (e) { B.toast(e.message || String(e), { tipo: 'erro', tempo: 8000 }); }
      recarregar();
    };
    lin.querySelector('.recusar').onclick = async () => {
      if (!(await B.confirmar('Recusar o acesso?', `${B.esc(p.nome || p.email)} continua sem ver nada. Fica na lista da equipe como inativo — dá para reativar depois.`, { sim: 'Recusar' }))) return;
      try {
        await ctx.D.recusarAcesso(p.user_id);
        await ctx.D.registrar('equipe', `recusou o pedido de acesso de ${p.nome || p.email}`, p.user_id);
      } catch (e) { B.toast(e.message || String(e), { tipo: 'erro', tempo: 8000 }); }
      recarregar();
    };
  });
  const add = el.querySelector('.add');
  if (add) add.onclick = async () => {
    const r = await B.modal({
      titulo: 'Adicionar pessoa',
      corpo: `<label class="campo"><span>E-mail do login</span><input type="email" class="m-e" autofocus></label>
        <label class="campo" style="margin-top:10px"><span>Nome</span><input class="m-n"></label>
        <label class="campo" style="margin-top:10px"><span>Começa com o modelo</span><select class="m-p">${Object.entries(Perm.PERFIS).map(([k, p]) => `<option value="${k}">${B.esc(p.nome)}</option>`).join('')}</select></label>
        <p class="dica">Depois dá para ajustar módulo por módulo.</p>`,
      botoes: [{ txt: 'Cancelar', valor: null }, {
        txt: 'Adicionar', cls: 'pri',
        validar: m => { const e = m.querySelector('.m-e'); if (!/@/.test(e.value)) { e.classList.add('erro'); return false; } return true; },
        valor: m => ({ e: m.querySelector('.m-e').value.trim(), n: m.querySelector('.m-n').value.trim(), p: m.querySelector('.m-p').value })
      }]
    });
    if (!r) return;
    try {
      await ctx.D.adicionarMembro(r.e, r.n, Perm.PERFIS[r.p].permissoes);
      await ctx.D.registrar('equipe', `adicionou ${r.n || r.e} à equipe (${Perm.PERFIS[r.p].nome})`);
      membros = null; B.toast('Pessoa adicionada.');
    } catch (e) { B.toast(e.message || String(e), { tipo: 'erro', tempo: 8000 }); }
    ctx.atualizar();
  };
  el.querySelectorAll('.membro[data-u]').forEach(card => {
    const m = (membros || []).find(x => x.user_id === card.dataset.u);
    if (!m) return;
    const nome = m.nome || m.email;
    const se = card.querySelector('.senha');
    if (se) se.onclick = async () => {
      const r = await B.modal({
        titulo: 'Senha provisória',
        corpo: `<p class="peq" style="margin:0 0 10px">Para <b>${B.esc(nome)}</b>. Passe a senha para a pessoa; ela troca pela dela em Ajustes → Trocar minha senha.</p>
          <label class="campo"><span>Senha provisória (mínimo 6)</span><input class="m-s" autocomplete="off"></label>`,
        botoes: [{ txt: 'Cancelar', valor: null }, {
          txt: 'Definir senha', cls: 'pri',
          validar: m => { const i = m.querySelector('.m-s'); if (i.value.length < 6) { i.classList.add('erro'); return false; } return true; },
          valor: m => m.querySelector('.m-s').value
        }]
      });
      if (!r) return;
      try {
        await ctx.D.definirSenha(m.user_id, r);
        await ctx.D.registrar('equipe', `definiu uma senha provisória para ${nome}`, m.user_id);
        B.toast('Senha provisória definida.');
      } catch (e) { B.toast(e.message || String(e), { tipo: 'erro', tempo: 8000 }); }
    };
    const at = card.querySelector('.ativo');
    if (at) at.onchange = () => salvar(ctx, m, { ativo: at.checked }, `${at.checked ? 'reativou' : 'desativou'} o acesso de ${nome}`);
    const mo = card.querySelector('.modelo');
    if (mo) mo.onchange = () => { if (Perm.PERFIS[mo.value]) salvar(ctx, m, { permissoes: Object.assign({}, Perm.PERFIS[mo.value].permissoes) }, `aplicou o modelo "${Perm.PERFIS[mo.value].nome}" para ${nome}`); };
    const dt = card.querySelector('.detalhe');
    if (dt) dt.onclick = () => { abertos.has(m.user_id) ? abertos.delete(m.user_id) : abertos.add(m.user_id); ctx.atualizar(); };
    card.querySelectorAll('.perm-lin').forEach(lin => {
      lin.querySelectorAll('[data-n]').forEach(b => {
        b.onclick = () => {
          const perm = Object.assign({}, Perm.permissoesDe(m), { [lin.dataset.mod]: b.dataset.n });
          const modNome = (Perm.MODULOS.find(x => x[0] === lin.dataset.mod) || [])[1];
          salvar(ctx, m, { permissoes: perm }, `mudou o acesso de ${nome} em ${modNome}: ${Perm.NOME_NIVEL[b.dataset.n].toLowerCase()}`);
        };
      });
    });
  });
}
