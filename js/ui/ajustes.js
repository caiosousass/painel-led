/* Tela: Ajustes — quem está usando, sincronização, equipe, backup. */
import { catalogoInicial, regrasIniciais } from '../seed.js';

export function render(ctx) {
  const { B } = ctx;
  const D = ctx.D;
  const u = ctx.usuario || {};
  const nuvem = D.modo === 'nuvem';
  return `
  <div class="cab"><div><h1>Ajustes</h1></div></div>
  <div class="card"><h2>Você</h2>
    <p style="margin:0 0 10px"><b>${B.esc(u.nome || '—')}</b> ${u.email ? '<span class="muted">· ' + B.esc(u.email) + '</span>' : ''} · ${ctx.admin() ? B.pill('acesso total', 'verde') : B.pill('acesso definido pelo administrador', '')}</p>
    ${nuvem ? `<button class="btn sair">${B.ico('sair')} Sair</button>` : `<button class="btn trocar">Trocar o nome deste aparelho</button>`}
  </div>
  <div class="card"><h2>${B.ico(B.temaEfetivo() === 'claro' ? 'sol' : 'lua')} Aparência</h2>
    <div class="abas">${[['escuro', 'Escuro'], ['claro', 'Claro'], ['auto', 'Automático']].map(([k, t]) => `<button data-tema="${k}" class="${B.temaEscolhido() === k ? 'on' : ''}">${t}</button>`).join('')}</div>
    <p class="dica">Fundo do app neste aparelho. "Automático" segue o celular/computador. O botão de sol/lua no topo troca rápido.</p>
  </div>
  <div class="card"><h2>${B.ico('nuvem')} Dados</h2>
    ${nuvem ? `<p class="peq" style="margin:0 0 6px">Conectado ao Supabase — a equipe vê tudo em tempo real.</p>
      <p class="peq muted" style="margin:0 0 10px">${D.sync.online ? 'Com internet' : '<span class="amarelo">Sem internet — tudo fica salvo aqui e sobe sozinho quando o sinal voltar</span>'} ·
        ${D.pendentes() ? `<b class="amarelo">${D.pendentes()} alteração(ões) esperando envio</b>` : 'nada pendente'}${D.sync.ultima ? ' · último envio ' + B.quando(D.sync.ultima, ctx.hoje()) : ''}
        ${D.sync.erro ? `<br><span class="vermelho">Erro: ${B.esc(D.sync.erro)}</span>` : ''}</p>
      <button class="btn enviar">Enviar agora</button>`
    : `<p class="peq" style="margin:0 0 6px"><b>Modo local:</b> os dados ficam só neste aparelho${D.persistente ? '' : ' <span class="vermelho">(e este navegador não guarda — feche e perde!)</span>'}.</p>
      <p class="dica" style="margin:0">Para a equipe usar junto e o supervisor acompanhar de qualquer lugar, ligue o Supabase (passo a passo no README).</p>`}
  </div>
  ${nuvem && ctx.admin() ? '<div class="modo-local-antigo"></div>' : ''}
  ${ctx.admin() ? `<div class="card"><h2>${B.ico('equipe')} Equipe</h2><p class="peq muted" style="margin:0 0 10px">Quem entra no sistema e o que cada um pode ver e editar.</p><button class="btn" data-ir="equipe">Abrir a Equipe</button></div>` : ''}
  ${ctx.admin() ? `<div class="card"><h2>Backup</h2>
    <div class="linha-flex"><button class="btn exportar">Baixar backup (.json)</button><button class="btn importar">Restaurar backup</button></div>
    <input type="file" class="arq" accept=".json" hidden>
    <p class="dica">O backup leva listas, catálogo, regras, manutenção, bancada e histórico.</p>
  </div>` : ''}
  ${ctx.admin() ? `<div class="card"><h2>Catálogo e regras padrão</h2>
    ${D.regrasNovas ? '<p class="peq amarelo" style="margin:0 0 10px"><b>Há regras padrão novas</b> (réguas, racks e cabos de dados pelo projeto da tela). Como as regras daqui foram editadas, elas não foram trocadas sozinhas — use "Voltar as regras ao padrão".</p>' : ''}
    <p class="peq muted" style="margin:0 0 10px">Traz de volta itens e regras do padrão que tenham sido apagados. Não mexe no que você editou.</p>
    <div class="linha-flex"><button class="btn completar">Completar com o padrão</button><button class="btn danger regras-padrao">Voltar as regras ao padrão</button></div>
    <p class="dica">"Voltar as regras ao padrão" troca TODAS as regras pelas originais (as suas alterações em regras se perdem; listas e estoque não mudam).</p></div>` : ''}
  ${!nuvem && ctx.admin() ? `<div class="card alerta"><h2>Apagar dados deste aparelho</h2><button class="btn danger apagar">Apagar tudo e começar de novo</button></div>` : ''}
  <p class="dica" style="text-align:center">Projetech · Painel de LED</p>`;
}

export function ligar(el, ctx) {
  const { B } = ctx;
  const D = ctx.D;
  const q = s => el.querySelector(s);
  el.querySelectorAll('[data-tema]').forEach(b => {
    b.onclick = () => {
      B.aplicarTema(b.dataset.tema);
      const tb = document.querySelector('.tema-btn');
      if (tb) tb.innerHTML = B.ico(B.temaEfetivo() === 'claro' ? 'lua' : 'sol');
      ctx.atualizar();
    };
  });
  if (q('.sair')) q('.sair').onclick = async () => {
    try { await D.sair(); location.reload(); } catch (e) { B.toast(e.message, { tipo: 'erro', tempo: 8000 }); }
  };
  if (q('.trocar')) q('.trocar').onclick = async () => {
    const n = await B.pedirTexto('Quem está usando este aparelho?', { rotulo: 'Nome', valor: ctx.quem(), obrigatorio: true });
    if (!n) return;
    D.usuario = { id: 'local', nome: n, papel: 'supervisor' };
    await D.setMeta('usuario_local', D.usuario);
    location.reload();
  };
  if (q('.enviar')) q('.enviar').onclick = async () => { await D.enviarAgora(); try { await D.puxar(); } catch (e) { B.toast(e.message, { tipo: 'erro' }); } ctx.atualizar(); };

  // modo online recém-ligado: o que este aparelho tinha no modo local pode subir para a nuvem
  const caixaLocal = q('.modo-local-antigo');
  if (caixaLocal && D.lerModoLocal) D.lerModoLocal().then(dados => {
    if (!dados || !caixaLocal.isConnected) return;
    const ids = t => new Set(ctx.est[t].map(x => x.id));
    const novos = Object.fromEntries(Object.entries(dados).map(([t, docs]) => [t, docs.filter(d => !ids(t).has(d.id))]));
    const conta = t => novos[t].length;
    if (!['listas', 'linhas', 'manutlog', 'manutencoes', 'producao', 'movimentos', 'catalogo', 'regras'].some(t => conta(t))) return;
    const partes = [['listas', 'lista', 'listas'], ['manutlog', 'registro de manutenção', 'registros de manutenção'], ['manutencoes', 'peça na fila de conserto', 'peças na fila de conserto'],
      ['producao', 'registro de bancada', 'registros de bancada'], ['movimentos', 'movimento de estoque', 'movimentos de estoque']]
      .filter(([t]) => conta(t)).map(([t, um, varios]) => `${conta(t)} ${conta(t) === 1 ? um : varios}`);
    caixaLocal.innerHTML = `<div class="card aviso"><h2>${B.ico('nuvem')} Dados do modo local deste aparelho</h2>
      <p class="peq" style="margin:0 0 8px">Antes de ligar o online, este aparelho guardou ${partes.length ? '<b>' + partes.join(', ') + '</b>' : 'catálogo e regras'} no modo local. Eles ainda não estão na nuvem.</p>
      <button class="btn pri levar-local">${B.ico('nuvem')} Levar para a nuvem</button>
      <p class="dica">Sobe só o que ainda não existe na nuvem (nada daqui é apagado ou trocado). ${conta('catalogo') || conta('regras') ? 'Catálogo e regras do modo local também sobem, com as quantidades contadas.' : ''}</p></div>`;
    caixaLocal.querySelector('.levar-local').onclick = async () => {
      if (!(await B.confirmar('Levar os dados do modo local para a nuvem?', `${partes.join(', ') || 'Catálogo e regras'} — a equipe passa a ver.`, { sim: 'Levar para a nuvem' }))) return;
      await D.importar({ dados: novos });
      await D.registrar('backup', `levou para a nuvem os dados do modo local deste aparelho (${partes.join(', ') || 'catálogo e regras'})`);
      B.toast('Enviando para a nuvem…');
      ctx.atualizar();
    };
  });
  el.querySelectorAll('[data-ir]').forEach(b => { b.onclick = () => ctx.ir(b.dataset.ir); });
  if (q('.exportar')) q('.exportar').onclick = () => B.baixarArquivo(`setor-led-backup-${ctx.hoje()}.json`, JSON.stringify(D.exportar()));
  const arq = q('.arq');
  if (q('.importar')) q('.importar').onclick = () => arq.click();
  if (arq) arq.onchange = async () => {
    const f = arq.files[0]; arq.value = '';
    if (!f) return;
    try {
      const json = JSON.parse(await f.text());
      if (!(await B.confirmar('Restaurar backup?', `Backup de ${B.esc(json.exportado_em || '?')}. Os registros do arquivo substituem os iguais daqui; o que só existe aqui continua.`, { sim: 'Restaurar' }))) return;
      await D.importar(json);
      await D.registrar('backup', 'restaurou um backup');
      B.toast('Backup restaurado.');
      ctx.atualizar();
    } catch (e) { B.toast('Arquivo inválido: ' + e.message, { tipo: 'erro' }); }
  };
  if (q('.completar')) q('.completar').onclick = async () => {
    const temC = new Set(ctx.est.catalogo.map(c => c.id)), temR = new Set(ctx.est.regras.map(r => r.id));
    const c = catalogoInicial().filter(x => !temC.has(x.id)), r = regrasIniciais().filter(x => !temR.has(x.id));
    if (c.length) await D.salvar('catalogo', c, { silencioso: true });
    if (r.length) await D.salvar('regras', r, { silencioso: true });
    B.toast(`${c.length} itens e ${r.length} regras adicionados.`);
    ctx.atualizar();
  };
  if (q('.regras-padrao')) q('.regras-padrao').onclick = async () => {
    if (!(await B.confirmar('Voltar as regras ao padrão?', 'Todas as regras atuais são trocadas pelas originais. Listas abertas sem separação se atualizam sozinhas.', { sim: 'Trocar as regras', perigo: true }))) return;
    await D.excluir('regras', ctx.est.regras.map(r => r.id), { silencioso: true });
    await D.salvar('regras', regrasIniciais(), { silencioso: true });
    await D.registrar('regra', 'voltou todas as regras ao padrão');
    D.regrasNovas = false;
    B.toast('Regras trocadas pelas do padrão.');
    ctx.atualizar();
  };
  if (q('.apagar')) q('.apagar').onclick = async () => {
    if (!(await B.confirmar('Apagar tudo deste aparelho?', 'Listas, catálogo, regras, manutenção e bancada. <b>Não tem volta</b> — baixe um backup antes.', { sim: 'Apagar tudo', perigo: true }))) return;
    await D.apagarAparelho();
    location.reload();
  };
}
