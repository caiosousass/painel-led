/* Tela: receber uma sala do Projetech Calculator.
 *
 * O botão "Gerar lista no Painel de LED" do Calculator abre #/receber/<dados> (a cena em JSON, base64url,
 * depois do # — não vai a servidor nenhum). Aqui a pessoa confere as telas (o modelo do Calculator vira o
 * case do catálogo) e escolhe: criar uma sala nova ou atualizar a que veio do Calculator antes. A lista e o
 * projeto saem na hora. Atualizar uma sala que já começou a ser separada não desmarca nada: a lista mostra
 * as mudanças para aplicar (como qualquer mudança de tela). */
import { recalcularLista, editavel } from './lista.js';

export function lerDados(txt) {
  try {
    const b64 = String(txt || '').replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(b64 + '==='.slice((b64.length + 3) % 4));
    const json = decodeURIComponent(Array.from(bin, c => '%' + c.charCodeAt(0).toString(16).padStart(2, '0')).join(''));
    const d = JSON.parse(json);
    if (!d || d.v !== 1 || !Array.isArray(d.telas) || !d.telas.length) return null;
    return d;
  } catch (e) { return null; }
}

const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/* o case do catálogo que tem o mesmo modelo do Calculator ("Absen Polaris V10 P2.9") */
function caseDoModelo(ctx, modelo) {
  const leds = ctx.est.catalogo.filter(c => c.cat === 'led' && c.painel && c.ativo !== false).sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
  return leds.find(c => norm(c.painel.modelo) === norm(modelo)) || null;
}

/* as salas que essa cena pode atualizar: a que veio do mesmo Calculator antes e as da mesma OS + sala */
function candidatas(ctx, d) {
  const vivas = ctx.est.listas.filter(l => editavel(l) || l.status === 'separada');
  const mesmaOS = l => d.os && norm(l.os) === norm(d.os);
  const out = vivas.filter(l => (d.id && l.calc_id === d.id) || (mesmaOS(l) && (!d.sala || norm(l.sala) === norm(d.sala))));
  return out.sort((a, b) => ((b.calc_id === d.id) - (a.calc_id === d.id)) || String(b.criada_em || '').localeCompare(String(a.criada_em || '')));
}

let dadosAtuais = null;

export function render(ctx, [txt]) {
  const { B, M } = ctx;
  const d = lerDados(txt);
  dadosAtuais = d;
  if (!d) return `<button class="voltar" data-ir="listas">${B.ico('back')} Listas</button><div class="card vazio">Não deu para ler a sala que veio do Calculator. Gere de novo por lá.</div>`;
  if (!ctx.pode('listas')) return `<div class="card vazio">${B.ico('lock')}<div>Para criar a lista você precisa de "Listas: editar". Peça ao administrador.</div></div>`;
  const leds = ctx.est.catalogo.filter(c => c.cat === 'led' && c.ativo !== false);
  const cand = candidatas(ctx, d);
  const padrao = cand.find(l => l.calc_id === d.id && (!d.os || norm(l.os) === norm(d.os))) || null;
  const v = x => (x == null ? '' : String(x).replace('.', ','));
  const telas = d.telas.map((t, i) => {
    const c = caseDoModelo(ctx, t.modelo);
    const larg = (+t.larg_m || 0.5) * t.colunas, alt = (+t.alt_m || 0.5) * t.linhas;
    const pal = t.palco || {};
    return `<div class="tela" data-i="${i}">
      <div class="linha-flex" style="margin-bottom:6px"><b class="cresce">${B.esc(t.nome || 'Tela ' + (i + 1))}</b><span class="peq mut2">${t.colunas} × ${t.linhas} = ${t.colunas * t.linhas} gab · ${B.num(larg)} × ${B.num(alt)} m</span></div>
      <div class="grade g2 m1">
        <label class="campo"><span>Case (no Calculator: ${B.esc(t.modelo || '—')})</span><select class="r-painel ${c ? '' : 'erro'}">${c ? '' : '<option value="" selected>— escolher o case —</option>'}${leds.map(x => `<option value="${B.esc(x.id)}" ${c && x.id === c.id ? 'selected' : ''}>${B.esc(x.nome.replace('Case de Led ', ''))}</option>`).join('')}</select></label>
        <div class="campo"><span>Estrutura</span><div class="peq" style="padding-top:8px">${B.esc(B.MONTAGEM[t.montagem] || t.montagem || '—')}${pal.sobre ? ` · sobre ${B.num(pal.altura_m)} m${pal.mf === 'palco' ? ' (mão francesa no palco)' : ''}` : ''}</div></div>
      </div>
      ${c ? '' : '<p class="dica amarelo" style="margin:6px 0 0">Esse modelo não está no catálogo (sublocado?). Escolha o case ou ele fica de fora.</p>'}
    </div>`;
  }).join('');
  return `
  <button class="voltar" data-ir="listas">${B.ico('back')} Listas</button>
  <div class="cab"><div class="cresce"><h1><span class="sala-tag">CALCULATOR</span>${B.esc(d.sala || d.evento || 'Sala do Calculator')}</h1>
    <div class="sub">${[d.evento, d.os ? 'OS ' + d.os : '', d.cliente].filter(Boolean).map(B.esc).join(' · ') || 'veio do Projetech Calculator'}</div></div></div>
  <div class="card"><h2>Telas <span class="conta">${d.telas.length}</span><span class="dir peq mut2">da esquerda para a direita</span></h2>${telas}
    <p class="dica">O cabeamento (canto, sentido, limite por porta) vem do Calculator; o projeto e a lista saem iguais aos de lá.</p></div>
  <div class="card"><h2>Para onde vai</h2>
    <label class="linha-flex" style="margin:6px 0"><input type="radio" name="r-destino" value="nova" ${padrao ? '' : 'checked'}> <b>Criar uma sala nova</b></label>
    ${cand.map(l => `<label class="linha-flex" style="margin:6px 0"><input type="radio" name="r-destino" value="${B.esc(l.id)}" ${padrao && padrao.id === l.id ? 'checked' : ''}> Atualizar <b>${B.esc(l.sala || B.nomeLista(l))}</b> <span class="peq mut2">${B.esc([l.evento, l.os ? 'OS ' + l.os : ''].filter(Boolean).join(' · '))} · ${B.pillStatus(l.status)}${l.calc_id === d.id ? ' · veio deste Calculator' : ''}</span></label>`).join('')}
    <div class="grade g3 m1 r-nova" style="margin-top:10px">
      <label class="campo"><span>Evento</span><input class="r-evento" value="${B.esc(d.evento || '')}"></label>
      <label class="campo"><span>Sala / local</span><input class="r-sala" value="${B.esc(d.sala || '')}" placeholder="Ex.: Plenária"></label>
      <label class="campo"><span>OS</span><input class="r-os" value="${B.esc(d.os || '')}"></label>
      <label class="campo"><span>Cliente</span><input class="r-cliente" value="${B.esc(d.cliente || '')}"></label>
      <label class="campo"><span>Local</span><input class="r-local" value="${B.esc(d.local || '')}"></label>
      <label class="campo"><span>Ida (sai do galpão)</span><input type="date" class="r-ida" value="${d.montagem ? M.D.mais(d.montagem, -1) : ''}"></label>
    </div>
    ${d.montagem ? `<p class="dica">Montagem no Calculator: ${B.dataBR(d.montagem)} — a ida fica 1 dia antes.</p>` : ''}
    <button class="btn pri grande cheio r-ok" style="margin-top:12px">${B.ico('check')} ${padrao ? 'Atualizar a sala' : 'Criar a sala'} — lista e projeto</button>
  </div>`;
}

export function ligar(el, ctx) {
  const { B, M } = ctx;
  el.querySelectorAll('[data-ir]').forEach(b => { b.onclick = () => ctx.ir(b.dataset.ir); });
  const d = dadosAtuais;
  if (!d || !ctx.pode('listas')) return;
  const ok = el.querySelector('.r-ok');
  const destino = () => (el.querySelector('[name="r-destino"]:checked') || {}).value || 'nova';
  const marca = () => {
    const nova = destino() === 'nova';
    el.querySelector('.r-nova').style.display = nova ? '' : 'none';
    ok.innerHTML = `${B.ico('check')} ${nova ? 'Criar a sala' : 'Atualizar a sala'} — lista e projeto`;
  };
  el.querySelectorAll('[name="r-destino"]').forEach(r => { r.onchange = marca; });
  marca();
  el.querySelectorAll('.r-painel').forEach(s => s.addEventListener('change', () => s.classList.toggle('erro', !s.value)));
  ok.onclick = async () => {
    ok.disabled = true;
    try {
      const casos = [...el.querySelectorAll('.tela[data-i]')].map(b => b.querySelector('.r-painel').value);
      const alvo = destino() === 'nova' ? null : ctx.lista(destino());
      const antigas = new Map(((alvo && alvo.telas) || []).filter(t => t.calc_uid).map(t => [t.calc_uid, t]));
      const telas = [];
      // o lugar de cada tela no palco do Calculator (borda esquerda, em metros): a mais à esquerda vira o 0
      const xs = d.telas.map(t => +t.pos_x).filter(Number.isFinite), x0 = xs.length ? Math.min(...xs) : 0;
      d.telas.forEach((t, i) => {
        if (!casos[i]) return;
        const item = ctx.item(casos[i]);
        const pl = (item && item.painel) || {};
        const velha = antigas.get(t.uid);
        telas.push({
          id: velha ? velha.id : ctx.novoId(), calc_uid: t.uid || null, nome: t.nome || '', painel: casos[i],
          modo: 'medida', largura_m: +(t.colunas * (+pl.larg_m || +t.larg_m || 0.5)).toFixed(3), altura_m: +(t.linhas * (+pl.alt_m || +t.alt_m || 0.5)).toFixed(3),
          colunas: null, linhas: null, m2: null, gabinetes: null,
          ...(Number.isFinite(+t.pos_x) && t.pos_x !== null ? { pos: { x: +(+t.pos_x - x0).toFixed(2) } } : velha && velha.pos ? { pos: velha.pos } : {}),
          montagem: t.montagem || 'chao',
          palco: t.palco && t.palco.sobre ? { sobre: true, altura_m: t.palco.altura_m, fundo_m: t.palco.fundo_m || null, mf: t.palco.mf === 'palco' ? 'palco' : 'chao' } : { sobre: false, altura_m: null, fundo_m: null, mf: 'chao' },
          // o cabeamento é o do Calculator; o resto (backup, controladora, limites) continua o que a sala tinha
          projeto: Object.assign({}, velha && velha.projeto, t.cfg || {})
        });
      });
      if (!telas.length) { ok.disabled = false; return B.toast('Escolha o case de ao menos uma tela.'); }
      let lista;
      if (alvo) {
        lista = alvo;
        Object.assign(lista, { telas, calc_id: d.id || lista.calc_id || null });
        for (const [k, val] of [['evento', d.evento], ['sala', d.sala], ['os', d.os], ['cliente', d.cliente], ['local', d.local]]) if (val) lista[k] = val;
        await ctx.D.salvar('listas', lista, { silencioso: true });
        const r = await recalcularLista(ctx, lista);
        await ctx.D.registrar('projeto', `atualizou a sala ${B.nomeLista(lista)} pelo Projetech Calculator (${telas.length} tela${telas.length === 1 ? '' : 's'})`, lista.id);
        if (r.pendente) B.toast('A separação já começou: confira as mudanças na lista (aviso amarelo).');
      } else {
        const q = s => el.querySelector(s).value.trim();
        const ida = el.querySelector('.r-ida').value || null;
        lista = {
          id: ctx.novoId(), os: q('.r-os'), evento: q('.r-evento'), sala: q('.r-sala'), cliente: q('.r-cliente'), local: q('.r-local'),
          ida, volta: null, obs: '', responsavel_projeto: d.responsavel || '', calc_id: d.id || null,
          status: 'rascunho', telas, criada_em: ctx.agora(), criada_por: ctx.quem(), sep: null, conf: null, ret: null
        };
        await ctx.D.salvar('listas', lista, { silencioso: true });
        await recalcularLista(ctx, lista, { forcar: true });
        await ctx.D.registrar('lista_criada', `criou a sala ${B.nomeLista(lista)} pelo Projetech Calculator`, lista.id);
      }
      location.replace('#/projeto/' + lista.id);   // sem voltar para cá (não importa duas vezes)
    } catch (e) {
      ok.disabled = false;
      B.toast('Não deu para criar: ' + e.message, { tipo: 'erro' });
    }
  };
}
