/* Montagem da sala — o editor do projeto, no jeito do SmartLCT da NovaStar.
 *
 * 1 · Painéis: as telas da sala vistas de frente, em escala. Arraste uma tela para o lado e ela muda de
 *     lugar (tela.pos.x, em metros da esquerda); a ordem da esquerda para a direita vale para o desenho do
 *     projeto e para a divisão dos racks. Tocar numa tela mostra os dados dela.
 * 2 · Sinal: o padrão do cabo de cada tela (o canto onde começa e o sentido, como a NovaStar mostra) ou as
 *     portas desenhadas à mão — toque num gabinete e passe pelos outros na ordem do cabo. Mostra os pixels
 *     de cada porta e avisa quando passa do limite.
 * 3 · Energia: os circuitos de powercon (cores), as réguas Steck/Powercon e os racks da sala desenhados embaixo.
 *     Toque num circuito para escolher a régua dele, numa régua para escolher o rack, num rack para o tipo.
 *     O sistema sugere; na primeira mudança a sugestão vira a montagem da sala (lista.projeto.energia).
 * Cada mudança grava a sala: o desenho, o PDF e a lista (cabos, réguas, racks, controladoras) acompanham.
 * O desenho usa METROS como unidade (viewBox): x da esquerda da sala; o chão é y = 0 e para cima é negativo.
 */
import * as Cab from '../cabeamento.js';

// o que o editor lembra entre um redesenho da página e outro
export const est = { modo: 'paineis', sel: null, mao: false, desfazer: [], zoom: 1, selE: null };
const ZOOMS = [1, 1.5, 2, 3, 4, 6];

const PADROES = [['inf-esq', 'vertical'], ['sup-esq', 'vertical'], ['inf-dir', 'vertical'], ['sup-dir', 'vertical'],
  ['inf-esq', 'horizontal'], ['sup-esq', 'horizontal'], ['inf-dir', 'horizontal'], ['sup-dir', 'horizontal']];
const NOME_CANTO = { 'inf-esq': 'embaixo à esquerda', 'sup-esq': 'em cima à esquerda', 'inf-dir': 'embaixo à direita', 'sup-dir': 'em cima à direita' };
const n2 = v => String(+(+v).toFixed(2)).replace('.', ',');
const fmt = v => String(Math.round(+v || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

/* as telas na sala: posição, tamanho e a altura do pé (palco) */
function cena(ps) {
  const pos = Cab.posicoesDaSala(ps);
  const its = ps.telas.filter(it => it.pl).map(it => {
    const t = it.tela, pal = t.palco || {};
    const base = (t.montagem || 'chao') === 'chao' && pal.sobre && +pal.altura_m > 0 ? +pal.altura_m : 0;
    return { it, t, pl: it.pl, x: pos.get(it), w: it.pl.largura_m, h: it.pl.altura_m, base };
  });
  return its;
}
function limites(its, modo) {
  const minX = Math.min(0, ...its.map(o => o.x)), maxX = Math.max(1, ...its.map(o => o.x + o.w));
  const maxTop = Math.max(1, ...its.map(o => o.base + o.h));
  const u = Math.max(maxX - minX, maxTop * 2.2) / 100;   // unidade de traço e letra
  const mx = Math.max(0.6, u * 6);
  // o nome de cada tela fica em cima dela e não pode sair do quadro
  const rot = o => ((o.t.nome || 'Tela') + ' · ' + n2(o.w) + ' × ' + n2(o.h) + ' m').length * u * 2.6 * 0.58 / 2 + u * 2;
  const x0 = Math.min(minX - mx, ...its.map(o => o.x + o.w / 2 - rot(o)));
  const x1 = Math.max(maxX + mx, ...its.map(o => o.x + o.w / 2 + rot(o)));
  return { x0, x1, yT: -(maxTop + Math.max(0.9, u * 9)), yB: modo === 'energia' ? Math.max(3.2, u * 29) : Math.max(0.7, u * 7), u };
}

/* ícone de um padrão: 3 × 3 gabinetes com o caminho do cabo, como na NovaStar */
function iconePadrao(inicio, sentido) {
  const pl = Cab.planoTela({ colunas: 3, linhas: 3, painel: { px_l: 1, px_a: 1 }, cfg: { inicio, sentido, px_porta: 100 } });
  const cam = pl.dados.portas[0].caminho, c = q => 6 + q * 12;
  const pts = cam.map(([x, y]) => `${c(x)},${c(y)}`).join(' ');
  const [sx, sy] = cam[0], [ex, ey] = cam[cam.length - 1];
  return `<svg viewBox="0 0 36 36" aria-hidden="true"><rect x="0.5" y="0.5" width="35" height="35" rx="3" fill="none" stroke="currentColor" stroke-opacity=".35"/>
    <polyline points="${pts}" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/>
    <circle cx="${c(sx)}" cy="${c(sy)}" r="3.4" fill="#22c55e"/><circle cx="${c(ex)}" cy="${c(ey)}" r="3.4" fill="#ef4444"/></svg>`;
}

/* o desenho da sala; temp: { id → plano provisório } enquanto se desenha à mão */
function svgSala(its, modo, temp, fixo, ps) {
  if (!its.length) return '<div class="mt-vazio">Ponha uma tela com painel e medida (L × A) para montar a sala.</div>';
  const L = fixo || limites(its, modo), u = L.u, out = [];   // fixo: o enquadramento não muda no meio de um arrasto
  // chão e régua em metros
  out.push(`<line x1="${L.x0}" y1="0" x2="${L.x1}" y2="0" stroke="#94a3b8" stroke-width="${u * 0.35}"/>`);
  const passo = L.x1 - L.x0 > 40 ? 5 : L.x1 - L.x0 > 16 ? 2 : 1;
  for (let m = Math.ceil(L.x0 / passo) * passo; m <= L.x1; m += passo) {
    out.push(`<line x1="${m}" y1="0" x2="${m}" y2="${u * 1.6}" stroke="#94a3b8" stroke-width="${u * 0.2}"/>`);
    out.push(`<text x="${m}" y="${u * 4.6}" font-size="${u * 2.4}" text-anchor="middle" fill="#64748b">${m} m</text>`);
  }
  for (const o of its) {
    const pl = (temp && temp[o.t.id]) || o.pl;
    const cw = o.w / pl.colunas, ch = o.h / pl.linhas, m = Math.min(cw, ch), y0 = -(o.base + o.h);
    const sel = est.sel === o.t.id;
    out.push(`<g data-tela="${o.t.id}">`);
    if (o.base > 0) {
      out.push(`<rect x="${o.x - u * 2}" y="${-o.base}" width="${o.w + u * 4}" height="${o.base}" fill="#cbd5e1"/>`);
      out.push(`<text x="${o.x + o.w / 2}" y="${-o.base / 2 + u}" font-size="${Math.min(u * 2.2, o.base * 0.6)}" text-anchor="middle" fill="#475569">palco ${n2(o.base)} m</text>`);
    }
    const sinal = modo === 'sinal', energia = modo === 'energia', colorido = sinal || energia;
    const cor = new Map();
    (sinal ? pl.dados.portas : energia ? pl.energia.circuitos : []).forEach((p, i) => p.caminho.forEach(([c, r]) => cor.set(c + ',' + r, i)));
    for (let c = 0; c < pl.colunas; c++) for (let r = 0; r < pl.linhas; r++) {
      const i = cor.get(c + ',' + r);
      const fill = !colorido ? '#1f2937' : i == null ? '#e5e7eb' : Cab.CORES_PORTA[i % Cab.CORES_PORTA.length];
      out.push(`<rect x="${o.x + c * cw}" y="${y0 + r * ch}" width="${cw}" height="${ch}" fill="${fill}" stroke="${colorido ? '#ffffff' : '#4b5563'}" stroke-width="${m * 0.03}"/>`);
    }
    if (energia) {
      // o caminho do powercon de cada circuito (amarelo) e o número dele
      const X = c => o.x + (c + 0.5) * cw, Y = r => y0 + (r + 0.5) * ch, tr = m * 0.12;
      for (const ci of pl.energia.circuitos) {
        const pts = ci.caminho.map(([c, r]) => [X(c), Y(r)]);
        const marcado = est.selE && est.selE.tipo === 'circuito' && est.selE.chave === Cab.chaveCircuito(o.it, ci.n);
        out.push(`<polyline points="${pts.map(q => q.join(',')).join(' ')}" fill="none" stroke="${marcado ? '#0ea5e9' : '#a16207'}" stroke-width="${m * (marcado ? 0.14 : 0.05)}" stroke-linejoin="round"/>`);
        for (let k = 1; k < pts.length; k++) {
          const [ax, ay] = pts[k - 1], [bx, by] = pts[k], mx = (ax + bx) / 2, my = (ay + by) / 2, a = Math.atan2(by - ay, bx - ax);
          out.push(`<polygon points="${[0, 2.5, -2.5].map(d => `${mx + Math.cos(a + d) * tr},${my + Math.sin(a + d) * tr}`).join(' ')}" fill="#a16207"/>`);
        }
        const [sx, sy] = pts[0], rr = m * 0.27;
        out.push(`<circle cx="${sx}" cy="${sy}" r="${rr}" fill="#facc15" stroke="#000000" stroke-width="${rr * 0.16}"/>`);
        out.push(`<text x="${sx}" y="${sy + rr * 0.38}" font-size="${rr * 1.05}" font-weight="700" text-anchor="middle" fill="#000000">${ci.n}</text>`);
      }
    }
    if (sinal) {
      const X = c => o.x + (c + 0.5) * cw, Y = r => y0 + (r + 0.5) * ch, tr = m * 0.12;
      for (const p of pl.dados.portas) {
        const pts = p.caminho.map(([c, r]) => [X(c), Y(r)]);
        out.push(`<polyline points="${pts.map(q => q.join(',')).join(' ')}" fill="none" stroke="#1e3a8a" stroke-width="${m * 0.05}" stroke-linejoin="round"/>`);
        for (let k = 1; k < pts.length; k++) {
          const [ax, ay] = pts[k - 1], [bx, by] = pts[k], mx = (ax + bx) / 2, my = (ay + by) / 2, a = Math.atan2(by - ay, bx - ax);
          out.push(`<polygon points="${[0, 2.5, -2.5].map(d => `${mx + Math.cos(a + d) * tr},${my + Math.sin(a + d) * tr}`).join(' ')}" fill="#1e3a8a"/>`);
        }
        const [sx, sy] = pts[0], rr = m * 0.27;
        out.push(`<circle cx="${sx}" cy="${sy}" r="${rr}" fill="#ffffff" stroke="${p.pixels > pl.dados.px_porta ? '#dc2626' : '#000000'}" stroke-width="${rr * 0.16}"/>`);
        out.push(`<text x="${sx}" y="${sy + rr * 0.38}" font-size="${rr * 1.05}" font-weight="700" text-anchor="middle" fill="#000000">${p.n}</text>`);
      }
    }
    out.push(`<rect x="${o.x}" y="${y0}" width="${o.w}" height="${o.h}" fill="none" stroke="${sel ? '#0ea5e9' : '#64748b'}" stroke-width="${sel ? u * 0.6 : u * 0.2}"/>`);
    out.push(`<text x="${o.x + o.w / 2}" y="${y0 - u * 1.8}" font-size="${u * 2.6}" font-weight="700" text-anchor="middle" fill="${sel ? '#0369a1' : '#334155'}">${esc(o.t.nome || 'Tela')} · ${n2(o.w)} × ${n2(o.h)} m</text>`);
    out.push('</g>');
  }
  if (modo === 'energia' && ps) out.push(energiaSvg(its, ps, L));
  const vw = L.x1 - L.x0, vh = L.yB - L.yT;
  return `<svg class="mt-svg ${modo === 'sinal' && est.mao ? 'pintando' : modo === 'paineis' ? 'paineis' : ''}" style="width:${est.zoom * 100}%;aspect-ratio:${vw.toFixed(3)} / ${vh.toFixed(3)}" viewBox="${L.x0} ${L.yT} ${vw} ${vh}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Montagem da sala">${out.join('')}</svg>`;
}
/* embaixo do chão: as réguas (azuis) ligadas aos circuitos e os racks ligados às réguas */
function energiaSvg(its, ps, L) {
  const u = L.u, out = [];
  const daTela = new Map(its.map(o => [o.it, o]));
  const yR = u * 9, hR = u * 3.6, wR = u * 7.5, yK = u * 19, hK = u * 6, wK = u * 15;
  const xr = new Map();
  for (const r of ps.reguasSala) {
    const saidas = (r.refs || []).map(({ ti, n }) => {
      const o = daTela.get(ps.telas[ti]), c = o && o.pl.energia.circuitos[n - 1];
      return c ? [o.x + (c.caminho[0][0] + 0.5) * (o.w / o.pl.colunas), -o.base] : null;
    }).filter(Boolean);
    if (!saidas.length) continue;
    const x = (Math.min(...saidas.map(q => q[0])) + Math.max(...saidas.map(q => q[0]))) / 2;
    xr.set(r.n, x);
    const marcada = est.selE && est.selE.tipo === 'regua' && est.selE.id === r.id;
    const kw = r.w / 1000, lim = (ps.telas[r.tela] ? +ps.telas[r.tela].cfg.kw_regua || 7.5 : 7.5);
    for (const [sx, sy] of saidas) out.push(`<line x1="${sx}" y1="${sy}" x2="${x}" y2="${yR}" stroke="${marcada ? '#0ea5e9' : '#475569'}" stroke-width="${u * (marcada ? 0.45 : 0.22)}"/>`);
    out.push(`<g data-regua="${esc(r.id)}" style="cursor:pointer"><rect x="${x - wR / 2}" y="${yR}" width="${wR}" height="${hR}" rx="${u * 0.6}" fill="${kw > lim + 1e-9 ? '#dc2626' : '#2563eb'}" stroke="${marcada ? '#0ea5e9' : '#1e3a8a'}" stroke-width="${u * (marcada ? 0.7 : 0.25)}"/>`
      + `<text x="${x}" y="${yR + hR * 0.68}" font-size="${u * 2.3}" font-weight="700" text-anchor="middle" fill="#ffffff">R${r.n}</text></g>`);
  }
  // racks: no meio das réguas dele, sem encostar um no outro
  const ks = ps.racks.map(k => {
    const xs = k.reguas.map(q => xr.get(q.rg)).filter(v => v != null);
    return { k, x: xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : (L.x0 + L.x1) / 2 };
  }).sort((a, b) => a.x - b.x);
  for (let i = 1; i < ks.length; i++) if (ks[i].x - ks[i - 1].x < wK * 1.2) ks[i].x = ks[i - 1].x + wK * 1.2;
  const sobra = ks.length ? ks[ks.length - 1].x + wK / 2 - L.x1 : 0;
  if (sobra > 0) ks.forEach(q => { q.x -= sobra; });
  for (const { k, x } of ks) {
    const marcado = est.selE && est.selE.tipo === 'rack' && est.selE.id === k.id;
    for (const q of k.reguas) { const rx = xr.get(q.rg); if (rx != null) out.push(`<line x1="${rx}" y1="${yR + hR}" x2="${x}" y2="${yK}" stroke="#1f2937" stroke-width="${u * 0.35}"/>`); }
    const saidasK = Cab.RACKS[k.tipo] || 9, cheio = k.reguas.length > saidasK;
    out.push(`<g data-rack="${esc(k.id)}" style="cursor:pointer"><rect x="${x - wK / 2}" y="${yK}" width="${wK}" height="${hK}" rx="${u * 0.8}" fill="#3f4652" stroke="${marcado ? '#0ea5e9' : cheio ? '#dc2626' : '#111827'}" stroke-width="${u * (marcado ? 0.8 : 0.3)}"/>`
      + `<text x="${x}" y="${yK + hK * 0.45}" font-size="${u * 2.4}" font-weight="700" text-anchor="middle" fill="#ffffff">Rack ${k.n}</text>`
      + `<text x="${x}" y="${yK + hK * 0.8}" font-size="${u * 1.9}" text-anchor="middle" fill="#cbd5e1">${saidasK} saídas · ${k.reguas.length} régua${k.reguas.length === 1 ? '' : 's'}</text></g>`);
  }
  return out.join('');
}
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* o painel de baixo: os dados da tela escolhida (Painéis) ou o cabeamento dela (Sinal) */
/* Energia: o que está escolhido (circuito, régua ou rack) e para onde ele vai */
function energiaHtml(ctx, ps, pode) {
  const { B } = ctx;
  const ro = pode ? '' : 'disabled';
  const kw = w => n2((w / 1000).toFixed(2)) + ' kW';
  const nomeTela = ti => (ps.telas[ti] && ps.telas[ti].nome) || 'Tela';
  const limReg = r => (ps.telas[r.tela] ? +ps.telas[r.tela].cfg.kw_regua || 7.5 : 7.5) * 1000;
  const opReguas = atual => ps.reguasSala.filter(r => !r.estimada).map(r => `<option value="${B.esc(r.id)}" ${r.id === atual ? 'selected' : ''}>R${r.n} · ${kw(r.w)} · ${B.esc(nomeTela(r.tela))}</option>`).join('') + '<option value="__nova">+ Nova régua</option>';
  const opRacks = atual => ps.racks.map(k => `<option value="${B.esc(k.id)}" ${k.id === atual ? 'selected' : ''}>Rack ${k.n} · ${Cab.RACKS[k.tipo] || 9} saídas</option>`).join('') + '<option value="__novo">+ Novo rack</option>';
  const resumo = `<p class="peq mut2" style="margin:0 0 8px">${ps.circuitos} circuito${ps.circuitos === 1 ? '' : 's'} · ${ps.reguas} régua${ps.reguas === 1 ? '' : 's'} · ${ps.racks.length} rack${ps.racks.length === 1 ? '' : 's'}${ps.energia_manual ? ' · <b>montagem sua</b>' : ' · sugestão do sistema'}</p>`;
  const voltar = ps.energia_manual && pode ? '<button class="btn sm mt-e-auto">Voltar ao automático</button>' : '';
  const sel = est.selE;
  let corpo = '<p class="dica" style="margin:0">Toque num circuito (na tela) para escolher a régua dele, numa régua azul para escolher o rack, ou num rack para mudar o tipo.</p>';
  if (sel && sel.tipo === 'circuito') {
    const r = ps.reguasSala.find(q => q.circuitos.includes(sel.chave));
    const [, n] = sel.chave.split(':');
    const ref = r && r.refs[r.circuitos.indexOf(sel.chave)];
    const it = ref ? ps.telas[ref.ti] : ps.telas.find(t => Cab.chaveCircuito(t, +n) === sel.chave);
    const c = it && it.pl && it.pl.energia.circuitos[+n - 1];
    if (c) corpo = `<div class="grade g2 m1"><div><b>Circuito ${c.n}</b> — ${B.esc(it.nome || 'Tela')}<div class="peq mut2">${c.gabinetes} gabinetes · ${kw(c.w)} no máximo</div></div>
      <label class="campo"><span>Entra na régua</span><select data-e="circ-regua" ${ro}>${opReguas(r && r.id)}</select></label></div>`;
  } else if (sel && sel.tipo === 'regua') {
    const r = ps.reguasSala.find(q => q.id === sel.id);
    if (r) {
      const lim = limReg(r), pct = Math.round(r.w / lim * 100), k = ps.racks.find(q => q.n === r.rack);
      corpo = `<div class="grade g2 m1"><div><b>Régua R${r.n}</b> <span class="${r.w > lim ? 'vermelho' : 'mut2'}">· ${kw(r.w)} de ${n2(lim / 1000)} kW (${pct}%)${r.w > lim ? ' — passa do limite' : ''}</span>
          <div class="peq mut2">${r.circuitos.length} circuito${r.circuitos.length === 1 ? '' : 's'}: ${r.refs.map(q => B.esc(nomeTela(q.ti)) + ' C' + q.n).join(', ')}</div></div>
        <label class="campo"><span>Liga no rack</span><select data-e="regua-rack" ${ro}>${opRacks(k && k.id)}</select></label></div>
        ${pode ? '<button class="btn sm mt-e-tirar-regua" style="margin-top:8px">Tirar a régua</button>' : ''}`;
    }
  } else if (sel && sel.tipo === 'rack') {
    const k = ps.racks.find(q => q.id === sel.id);
    if (k) {
      const saidas = Cab.RACKS[k.tipo] || 9;
      corpo = `<div class="grade g2 m1"><div><b>Rack ${k.n}</b> <span class="${k.reguas.length > saidas ? 'vermelho' : 'mut2'}">· ${k.reguas.length} régua${k.reguas.length === 1 ? '' : 's'} em ${saidas} saídas · ${kw(k.w)}</span>
          <div class="peq mut2">${k.reguas.map(q => 'R' + q.rg).join(', ') || 'sem régua ainda'}</div></div>
        <label class="campo"><span>Tipo</span><select data-e="rack-tipo" ${ro}>${Object.entries(Cab.RACKS).map(([id, n]) => `<option value="${id}" ${id === k.tipo ? 'selected' : ''}>${n} saídas</option>`).join('')}</select></label></div>
        ${pode ? '<button class="btn sm mt-e-tirar-rack" style="margin-top:8px">Tirar o rack</button>' : ''}`;
    }
  }
  return resumo + corpo + (voltar ? `<div style="margin-top:10px">${voltar}</div>` : '');
}

function ladoHtml(ctx, its, ps, pode) {
  if (est.modo === 'energia') return energiaHtml(ctx, ps, pode);
  const { B } = ctx;
  const o = its.find(x => x.t.id === est.sel);
  const ro = pode ? '' : 'disabled';
  if (est.modo === 'paineis') {
    if (!o) return `<p class="dica">Toque numa tela para ver os dados dela. Arraste as telas para o lado para posicionar — a ordem da esquerda para a direita vale para o projeto e para os racks.</p>`;
    return `<div class="grade g4 m1">
        <label class="campo"><span>Nome</span><input data-mf="nome" value="${B.esc(o.t.nome || '')}" ${ro}></label>
        <label class="campo"><span>Largura (m)</span><input inputmode="decimal" data-mf="largura_m" value="${n2(o.t.largura_m != null ? o.t.largura_m : o.w)}" ${ro}></label>
        <label class="campo"><span>Altura (m)</span><input inputmode="decimal" data-mf="altura_m" value="${n2(o.t.altura_m != null ? o.t.altura_m : o.h)}" ${ro}></label>
        <label class="campo"><span>Posição (m da esquerda)</span><input inputmode="decimal" data-mf="pos" value="${n2(o.x)}" ${ro}></label>
      </div>
      <div class="linha-flex" style="margin-top:8px;flex-wrap:wrap;gap:8px">
        <span class="peq mut2 cresce">${o.pl.colunas} × ${o.pl.linhas} = ${o.pl.gabinetes} gabinetes · ${B.esc((o.it.painel.modelo || ''))}</span>
        ${pode ? '<button class="btn sm mt-dup">Duplicar</button><button class="btn sm mt-tirar">Tirar da sala</button>' : ''}
      </div>`;
  }
  if (!o) return '<p class="dica">Toque numa tela para escolher o cabeamento dela.</p>';
  const pl = o.pl, d = pl.dados, cfg = o.it.cfg;
  const manual = d.manual;
  const pads = PADROES.map(([ini, sen]) => {
    const on = !manual && d.modo !== 'cheia' && cfg.inicio === ini && (cfg.sentido === sen || (cfg.sentido === 'auto' && d.sentido === sen));
    return `<button class="mt-pad ${on ? 'on' : ''}" data-pad="${ini}|${sen}" title="Começa ${NOME_CANTO[ini]}, ${sen}" ${ro}>${iconePadrao(ini, sen)}</button>`;
  }).join('');
  const lim = d.px_porta;
  const linhas = d.portas.map(p => {
    const pct = Math.round(p.pixels / lim * 100), passa = p.pixels > lim;
    return `<tr class="${passa ? 'passa' : ''}"><td><span class="mt-cor" style="background:${Cab.CORES_PORTA[(p.n - 1) % Cab.CORES_PORTA.length]}"></span>P${p.n}</td><td class="n">${p.gabinetes} gab</td><td class="n">${fmt(p.pixels)} px</td><td class="n">${pct}%${passa ? ' · passa do limite' : ''}</td></tr>`;
  }).join('');
  const ctrl = o.it.ctrl, nomeC = ctrl.item ? Cab.CONTROLADORAS[ctrl.item].nome : '';
  const porC = ctrl.item ? Cab.CONTROLADORAS[ctrl.item].portas : 0;
  const ligacao = ctrl.qtd ? Array.from({ length: ctrl.qtd }, (_, k) => {
    const a = k * porC + 1, b = Math.min(d.portas.length, (k + 1) * porC);
    return a <= b ? `${nomeC} ${k + 1}: P${a}${b > a ? '–P' + b : ''}` : `${nomeC} ${k + 1}: pelos pixels`;
  }).join(' · ') : 'sem controladora';
  return `<div class="mt-sinal">
    <div>
      <div class="peq mut2" style="margin-bottom:6px">Padrão do cabo — <b>${B.esc(o.t.nome || 'Tela')}</b></div>
      <div class="mt-pads">${pads}</div>
      <div class="linha-flex peq" style="margin-top:8px;gap:12px;flex-wrap:wrap">
        <label class="linha-flex"><input type="checkbox" data-mc="serpentina" ${cfg.serpentina !== false ? 'checked' : ''} ${ro} style="width:18px;height:18px"> Serpentina</label>
        <label class="linha-flex">Cada porta <select data-mc="portas" ${ro}><option value="colunas">linhas inteiras</option><option value="cheia" ${cfg.portas === 'cheia' ? 'selected' : ''}>enche a porta</option></select></label>
        <label class="linha-flex">Limite <input class="inp curto" inputmode="numeric" data-mc="px_porta" value="${lim}" ${ro} style="width:96px"> px</label>
      </div>
    </div>
    <div>
      <div class="linha-flex" style="gap:8px;flex-wrap:wrap;margin-bottom:6px">
        <button class="btn sm mt-mao ${est.mao ? 'on' : ''}" ${ro}>${est.mao ? 'Desenhando à mão' : 'Desenhar as portas à mão'}</button>
        ${est.mao && pode ? '<button class="btn sm mt-desfazer">Desfazer</button><button class="btn sm mt-limpar">Limpar</button>' : ''}
        ${manual && pode ? '<button class="btn sm mt-auto">Voltar ao automático</button>' : ''}
      </div>
      ${est.mao ? '<p class="dica" style="margin:0 0 6px">Toque num gabinete e passe pelos outros na ordem do cabo. Tocar num gabinete de uma porta continua dali; num livre, abre uma porta nova.</p>' : ''}
      ${d.manual_invalido ? '<p class="dica amarelo" style="margin:0 0 6px">O desenho à mão não serve mais (a tela mudou de tamanho): voltou ao automático.</p>' : ''}
      ${d.sem_porta ? `<p class="dica amarelo" style="margin:0 0 6px">${d.sem_porta} gabinete${d.sem_porta === 1 ? '' : 's'} sem porta.</p>` : ''}
      <table class="mt-portas"><tbody>${linhas}</tbody></table>
      <p class="peq mut2" style="margin:6px 0 0">${d.portas.length} porta${d.portas.length === 1 ? '' : 's'} · ${B.esc(ligacao)}</p>
    </div>
  </div>`;
}

export function htmlMontagem(ctx, lista, ps, pode) {
  const its = cena(ps);
  if (est.sel && !its.some(o => o.t.id === est.sel)) est.sel = null;
  if (!est.sel && its.length) est.sel = its[0].t.id;
  if (est.modo !== 'sinal') est.mao = false;
  return `<div class="card mt-card">
    <div class="linha-flex" style="flex-wrap:wrap;gap:8px;margin-bottom:10px">
      <h2 style="margin:0" class="cresce">Montagem da sala</h2>
      <div class="abas mt-modos"><button data-mm="paineis" class="${est.modo === 'paineis' ? 'on' : ''}">1 · Painéis</button><button data-mm="sinal" class="${est.modo === 'sinal' ? 'on' : ''}">2 · Sinal</button><button data-mm="energia" class="${est.modo === 'energia' ? 'on' : ''}">3 · Energia</button></div>
      <div class="linha-flex mt-zoom" style="gap:4px"><button class="btn sm" data-z="-1" title="Afastar">−</button><span class="peq mut2" style="min-width:42px;text-align:center">${Math.round(est.zoom * 100)}%</span><button class="btn sm" data-z="1" title="Aproximar">+</button></div>
      ${pode && est.modo === 'paineis' ? `<button class="btn sm mt-add">${ctx.B.ico('add')} Tela</button>` : ''}
    </div>
    <div class="mt-quadro">${svgSala(its, est.modo, null, null, ps)}</div>
    <div class="mt-lado">${ladoHtml(ctx, its, ps, pode)}</div>
  </div>`;
}

/* liga o editor; salvar(campos, {recalc}) grava a sala (e a lista acompanha) */
export function ligarMontagem(el, ctx, lista, ps, salvar, pode) {
  const card = el.querySelector('.mt-card');
  if (!card) return;
  const { B } = ctx;
  card.querySelectorAll('[data-mm]').forEach(b => { b.onclick = () => { est.modo = b.dataset.mm; est.mao = false; ctx.atualizar(); }; });
  card.querySelectorAll('[data-z]').forEach(b => { b.onclick = () => {
    const i = Math.max(0, Math.min(ZOOMS.length - 1, ZOOMS.indexOf(est.zoom) + +b.dataset.z));
    est.zoom = ZOOMS[i] || 1; ctx.atualizar();
  }; });
  const its = cena(ps);
  const quadro = card.querySelector('.mt-quadro');
  const svg = () => quadro.querySelector('svg');
  const telaDe = id => (lista.telas || []).find(t => t.id === id);
  const salvarTelas = (o) => salvar({ telas: lista.telas }, o);

  // ---------- desenho e toque ----------
  const ponto = e => { const s = svg(); const p = s.createSVGPoint(); p.x = e.clientX; p.y = e.clientY; return p.matrixTransform(s.getScreenCTM().inverse()); };
  const telaEm = p => its.find(o => p.x >= o.x && p.x <= o.x + o.w && p.y >= -(o.base + o.h) && p.y <= -o.base);
  const celulaEm = (o, p) => {
    const c = Math.floor((p.x - o.x) / (o.w / o.pl.colunas)), r = Math.floor((p.y + o.base + o.h) / (o.h / o.pl.linhas));
    return c >= 0 && c < o.pl.colunas && r >= 0 && r < o.pl.linhas ? [c, r] : null;
  };
  let temp = null, fixo = null;
  const redesenha = () => { quadro.innerHTML = svgSala(its, est.modo, temp, fixo, ps); ligarToque(); };
  let arrasto = null, pintura = null;
  const planoCom = (o, man) => Cab.planoTela({ colunas: o.pl.colunas, linhas: o.pl.linhas, painel: o.it.painel, cfg: Object.assign({}, o.it.cfg, { portas_manual: man }) });
  const manualAtual = o => (o.pl.dados.manual ? o.pl.dados.portas.map(p => p.caminho.map(q => q.slice())) : o.pl.dados.portas.map(p => p.caminho.map(q => q.slice())));

  function ligarToque() {
    const s = svg();
    if (!s || !pode) {
      if (s) s.addEventListener('click', e => { const o = telaEm(ponto(e)); if (o && est.sel !== o.t.id) { est.sel = o.t.id; ctx.atualizar(); } });
      return;
    }
    s.addEventListener('pointerdown', e => {
      const p = ponto(e), o = telaEm(p);
      if (est.modo === 'energia') {
        const gr = e.target.closest && e.target.closest('[data-regua]'), gk = e.target.closest && e.target.closest('[data-rack]');
        if (gr) est.selE = { tipo: 'regua', id: gr.dataset.regua };
        else if (gk) est.selE = { tipo: 'rack', id: gk.dataset.rack };
        else if (o) {
          const cel = celulaEm(o, p), ci = cel && o.pl.energia.circuitos.find(c => c.caminho.some(q => q[0] === cel[0] && q[1] === cel[1]));
          if (ci) { est.selE = { tipo: 'circuito', chave: Cab.chaveCircuito(o.it, ci.n) }; est.sel = o.t.id; }
        } else return;
        ctx.atualizar();
        return;
      }
      if (est.modo === 'paineis') {
        if (!o) return;
        arrasto = { o, dx: p.x - o.x, x0: o.x, moveu: false, nova: est.sel !== o.t.id };
        fixo = limites(its, est.modo);
        est.sel = o.t.id;
        quadro.setPointerCapture(e.pointerId);   // no quadro: o svg é refeito a cada passo
        return;
      }
      if (!o) return;
      if (!est.mao || est.sel !== o.t.id) { if (est.sel !== o.t.id) { est.sel = o.t.id; est.mao = false; ctx.atualizar(); } return; }
      const cel = celulaEm(o, p);
      if (!cel) return;
      const man = (temp && temp[o.t.id]) ? temp[o.t.id].dados.portas.map(q => q.caminho.map(x => x.slice())) : manualAtual(o);
      est.desfazer.push({ id: o.t.id, man: JSON.stringify(manualAtual(o)) });
      let pi = -1, ci = -1;
      man.forEach((cam, i) => { const k = cam.findIndex(q => q[0] === cel[0] && q[1] === cel[1]); if (k >= 0) { pi = i; ci = k; } });
      if (pi >= 0) man[pi] = man[pi].slice(0, ci + 1); else { man.push([cel]); pi = man.length - 1; }
      pintura = { o, man, pi };
      fixo = limites(its, est.modo);
      temp = { [o.t.id]: planoCom(o, man) };
      quadro.setPointerCapture(e.pointerId);
      redesenha();
    });
  }
  // os movimentos ficam no quadro (o svg é refeito a cada passo do desenho)
  quadro.addEventListener('pointermove', e => {
    if (arrasto) {
      const p = ponto(e);
      const nx = Math.round((p.x - arrasto.dx) * 10) / 10;
      if (Math.abs(nx - arrasto.o.x) >= 0.05) { arrasto.o.x = nx; arrasto.moveu = true; redesenha(); }
    } else if (pintura) {
      const p = ponto(e), cel = celulaEm(pintura.o, p);
      if (!cel) return;
      const usado = pintura.man.some(cam => cam.some(q => q[0] === cel[0] && q[1] === cel[1]));
      if (usado) return;
      pintura.man[pintura.pi].push(cel);
      temp = { [pintura.o.t.id]: planoCom(pintura.o, pintura.man) };
      redesenha();
    }
  });
  const solta = () => {
    fixo = null;
    if (arrasto) {
      const a = arrasto; arrasto = null;
      if (!a.moveu) { if (a.nova) ctx.atualizar(); return; }
      // grava a posição de todas (as outras ficam onde estão) e a ordem da esquerda para a direita
      for (const o of its) o.t.pos = { x: +o.x.toFixed(2) };
      lista.telas.sort((p, q) => ((p.pos && Number.isFinite(+p.pos.x)) ? +p.pos.x : 1e9) - ((q.pos && Number.isFinite(+q.pos.x)) ? +q.pos.x : 1e9));
      salvarTelas({ recalc: true });
    } else if (pintura) {
      const pz = pintura; pintura = null; temp = null;
      const t = telaDe(pz.o.t.id);
      t.projeto = Object.assign({}, t.projeto || {}, { portas_manual: pz.man.filter(c => c.length) });
      salvarTelas({ recalc: true });
    }
  };
  quadro.addEventListener('pointerup', solta);
  quadro.addEventListener('pointercancel', solta);
  ligarToque();
  if (est.zoom > 1 && est.sel) {
    const g = quadro.querySelector(`g[data-tela="${est.sel}"]`);
    if (g) { const r = g.getBoundingClientRect(), q = quadro.getBoundingClientRect(); quadro.scrollLeft += (r.left + r.width / 2) - (q.left + q.width / 2); quadro.scrollTop += (r.top + r.height / 2) - (q.top + q.height / 2); }
  }

  if (!pode) return;
  // ---------- Painéis ----------
  const add = card.querySelector('.mt-add');
  if (add) add.onclick = async () => {
    const { novaTela } = await import('./listas.js');
    const fim = its.length ? Math.max(...its.map(o => o.x + o.w)) + 1 : 0;
    const t = novaTela(ctx, { nome: 'Tela ' + ((lista.telas || []).length + 1), largura_m: 3, altura_m: 2, pos: { x: +fim.toFixed(2) } });
    for (const o of its) if (!o.t.pos) o.t.pos = { x: +o.x.toFixed(2) };
    lista.telas = (lista.telas || []).concat([t]);
    est.sel = t.id;
    salvarTelas({ recalc: true });
  };
  const o = its.find(x => x.t.id === est.sel);
  card.querySelectorAll('[data-mf]').forEach(inp => inp.addEventListener('change', () => {
    if (!o) return;
    const t = telaDe(o.t.id), campo = inp.dataset.mf;
    if (campo === 'nome') { t.nome = inp.value.trim(); return salvarTelas({ recalc: false }); }
    const v = B.lerNum(inp.value);
    if (v == null || !(v >= 0)) { inp.classList.add('erro'); return; }
    if (campo === 'pos') { for (const x of its) if (!x.t.pos) x.t.pos = { x: +x.x.toFixed(2) }; t.pos = { x: v }; lista.telas.sort((p, q) => (+((p.pos || {}).x) || 0) - (+((q.pos || {}).x) || 0)); }
    else { t.modo = 'medida'; t[campo] = v; }
    salvarTelas({ recalc: true });
  }));
  const dup = card.querySelector('.mt-dup');
  if (dup && o) dup.onclick = () => {
    const t = telaDe(o.t.id), c = JSON.parse(JSON.stringify(t));
    c.id = ctx.novoId(); c.nome = (t.nome || 'Tela') + ' (cópia)'; delete c.calc_uid;
    const fim = Math.max(...its.map(x => x.x + x.w)) + 1;
    for (const x of its) if (!x.t.pos) x.t.pos = { x: +x.x.toFixed(2) };
    c.pos = { x: +fim.toFixed(2) };
    lista.telas = lista.telas.concat([c]);
    est.sel = c.id;
    salvarTelas({ recalc: true });
  };
  const tirar = card.querySelector('.mt-tirar');
  if (tirar && o) tirar.onclick = async () => {
    if (!(await B.confirmar('Tirar esta tela da sala?', 'Os itens que vieram só dela saem da lista.', { sim: 'Tirar', perigo: true }))) return;
    lista.telas = lista.telas.filter(t => t.id !== o.t.id);
    est.sel = null;
    salvarTelas({ recalc: true });
  };

  // ---------- Energia ----------
  /* a sugestão do sistema vira a montagem da sala (na primeira mudança), com ids novos */
  const montagemDeEnergia = () => {
    const ids = new Map(), novo = id => { if (!ids.has(id)) ids.set(id, /^(auto|sobra|est)-/.test(id) ? ctx.novoId() : id); return ids.get(id); };
    const racks = ps.racks.map(k => ({ id: novo(k.id), tipo: k.tipo }));
    const reguas = ps.reguasSala.filter(r => !r.estimada).map(r => {
      const k = ps.racks.find(q => q.n === r.rack);
      return { id: novo(r.id), circuitos: r.circuitos.slice(), rack: k ? novo(k.id) : null };
    });
    return { energia: { reguas, racks }, novo };
  };
  const gravaEnergia = (energia, sel) => {
    if (sel) est.selE = sel;
    salvar({ projeto: Object.assign({}, lista.projeto || {}, { energia }) }, { recalc: true });
  };
  const sE = est.selE;
  card.querySelectorAll('[data-e]').forEach(inp => inp.addEventListener('change', () => {
    const { energia: en, novo } = montagemDeEnergia();
    const qual = inp.dataset.e, v = inp.value;
    if (qual === 'circ-regua' && sE) {
      const antiga = en.reguas.find(r => r.circuitos.includes(sE.chave));
      en.reguas.forEach(r => { r.circuitos = r.circuitos.filter(k => k !== sE.chave); });
      if (v === '__nova') en.reguas.push({ id: ctx.novoId(), circuitos: [sE.chave], rack: antiga ? antiga.rack : null });
      else { const r = en.reguas.find(q => q.id === novo(v)); if (r) r.circuitos.push(sE.chave); }
      en.reguas = en.reguas.filter(r => r.circuitos.length);
      return gravaEnergia(en);
    }
    if (qual === 'regua-rack' && sE) {
      const r = en.reguas.find(q => q.id === novo(sE.id));
      if (!r) return;
      if (v === '__novo') { const k = { id: ctx.novoId(), tipo: (en.racks[0] || {}).tipo || 'rack-9' }; en.racks.push(k); r.rack = k.id; }
      else r.rack = novo(v);
      return gravaEnergia(en, { tipo: 'regua', id: r.id });
    }
    if (qual === 'rack-tipo' && sE) {
      const k = en.racks.find(q => q.id === novo(sE.id));
      if (k) k.tipo = v;
      return gravaEnergia(en, k ? { tipo: 'rack', id: k.id } : null);
    }
  }));
  const tiraR = card.querySelector('.mt-e-tirar-regua');
  if (tiraR && sE) tiraR.onclick = () => {
    const { energia: en, novo } = montagemDeEnergia();
    en.reguas = en.reguas.filter(r => r.id !== novo(sE.id));   // os circuitos dela vão para uma régua nova, sozinhos
    gravaEnergia(en, { tipo: null });
  };
  const tiraK = card.querySelector('.mt-e-tirar-rack');
  if (tiraK && sE) tiraK.onclick = () => {
    const { energia: en, novo } = montagemDeEnergia();
    const id = novo(sE.id);
    en.racks = en.racks.filter(k => k.id !== id);
    en.reguas.forEach(r => { if (r.rack === id) r.rack = null; });   // as réguas dele vão para os racks automáticos
    gravaEnergia(en, { tipo: null });
  };
  const eAuto = card.querySelector('.mt-e-auto');
  if (eAuto) eAuto.onclick = () => { est.selE = null; salvar({ projeto: Object.assign({}, lista.projeto || {}, { energia: null }) }, { recalc: true }); };

  // ---------- Sinal ----------
  const muda = (campos) => { const t = telaDe(o.t.id); t.projeto = Object.assign({}, t.projeto || {}, campos); salvarTelas({ recalc: true }); };
  card.querySelectorAll('[data-pad]').forEach(b => { b.onclick = () => {
    if (!o) return;
    const [inicio, sentido] = b.dataset.pad.split('|');
    est.mao = false;
    muda({ inicio, sentido, portas_manual: null, portas: o.it.cfg.portas === 'cheia' ? 'cheia' : 'colunas' });
  }; });
  card.querySelectorAll('[data-mc]').forEach(inp => inp.addEventListener('change', () => {
    if (!o) return;
    const campo = inp.dataset.mc;
    if (campo === 'serpentina') return muda({ serpentina: inp.checked, portas_manual: null });
    if (campo === 'portas') return muda({ portas: inp.value, portas_manual: null });
    const v = B.lerNum(inp.value);
    if (!(v >= 10000)) { inp.classList.add('erro'); return; }
    muda({ px_porta: v });
  }));
  const mao = card.querySelector('.mt-mao');
  if (mao) mao.onclick = () => {
    est.mao = !est.mao;
    // começa do que o sistema sugeriu: você ajusta em vez de desenhar tudo do zero
    if (est.mao && o && !o.pl.dados.manual) { est.desfazer = []; return muda({ portas_manual: manualAtual(o) }); }
    ctx.atualizar();
  };
  const desf = card.querySelector('.mt-desfazer');
  if (desf) desf.onclick = () => {
    const u = est.desfazer.pop();
    if (!u) return B.toast('Nada para desfazer.');
    const t = telaDe(u.id);
    if (t) { t.projeto = Object.assign({}, t.projeto || {}, { portas_manual: JSON.parse(u.man) }); salvarTelas({ recalc: true }); }
  };
  const limpar = card.querySelector('.mt-limpar');
  if (limpar && o) limpar.onclick = () => { est.desfazer.push({ id: o.t.id, man: JSON.stringify(manualAtual(o)) }); muda({ portas_manual: [] }); };
  const auto = card.querySelector('.mt-auto');
  if (auto) auto.onclick = () => { est.mao = false; est.desfazer = []; muda({ portas_manual: null }); };
}
