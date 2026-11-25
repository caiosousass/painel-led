/* 3D da tela — o mesmo visor do Projetech Calculator (vendor/ar.js, v343): painel com as placas, palco,
 * mão francesa e pesos (a mesma conta da lista: motor.estruturaTela) e uma pessoa de referência.
 * Na frente do painel vai o mapa do cabeamento (cada porta com a sua cor e o número no começo dela).
 * Girar: arrastar · mover: botão direito (dois dedos) · zoom: roda (pinça). */
import { CORES } from './projeto.js';

let carregando = null;
function carregarVisor() {
  if (window.ProjetechAR) return Promise.resolve(window.ProjetechAR);
  if (!carregando) carregando = new Promise((ok, erro) => {
    const s = document.createElement('script');
    s.src = 'vendor/ar.js';
    s.onload = () => (window.ProjetechAR ? ok(window.ProjetechAR) : erro(new Error('O 3D não carregou.')));
    s.onerror = () => { carregando = null; erro(new Error('Não deu para carregar o 3D (sem internet na primeira vez?).')); };
    document.head.appendChild(s);
  });
  return carregando;
}

// a frente do painel: o mapa do cabeamento (portas coloridas, número da porta no gabinete onde ela começa)
function texturaCabeamento(pl, nome) {
  const C = pl.colunas, L = pl.linhas;
  const lado = Math.max(C, L), cel = Math.max(8, Math.min(96, Math.floor(2048 / lado)));
  const cv = document.createElement('canvas');
  cv.width = C * cel; cv.height = L * cel;
  const g = cv.getContext('2d');
  g.fillStyle = '#111'; g.fillRect(0, 0, cv.width, cv.height);
  pl.dados.portas.forEach((p, i) => {
    g.fillStyle = CORES[i % CORES.length];
    p.caminho.forEach(([c, r]) => g.fillRect(c * cel + 1, r * cel + 1, cel - 2, cel - 2));
  });
  // número da porta no primeiro gabinete dela
  g.textAlign = 'center'; g.textBaseline = 'middle';
  pl.dados.portas.forEach(p => {
    const [c, r] = p.caminho[0];
    const x = c * cel + cel / 2, y = r * cel + cel / 2, rr = cel * 0.36;
    g.fillStyle = '#0b0b0b'; g.beginPath(); g.arc(x, y, rr, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#fff'; g.font = `700 ${Math.round(cel * 0.36)}px system-ui,Arial`; g.fillText(String(p.n), x, y + 1);
  });
  if (nome && cv.width > 300) {
    const t = Math.round(Math.min(cv.height * 0.12, cv.width / Math.max(8, nome.length) * 1.4));
    g.font = `800 ${t}px system-ui,Arial`;
    g.lineWidth = Math.max(2, t / 10); g.strokeStyle = 'rgba(0,0,0,.65)'; g.fillStyle = 'rgba(255,255,255,.92)';
    g.strokeText(nome, cv.width / 2, cv.height / 2); g.fillText(nome, cv.width / 2, cv.height / 2);
  }
  return cv;
}

/* A cena no formato do ar.js (ver o comentário "a cena" lá dentro) */
export function cenaDaTela(ctx, tela) {
  const { M } = ctx;
  const item = ctx.item(tela.painel);
  if (!item || !item.painel) return { erro: 'Escolha o painel da tela.' };
  const pl = M.planoProjeto(tela, item.painel);
  if (!pl) return { erro: 'O 3D precisa da largura × altura (ou colunas × linhas) da tela.' };
  const est = M.estruturaTela(tela, item.painel);
  const pal = tela.palco || {};
  const sobre = !!pal.sobre && +pal.altura_m > 0 && (tela.montagem || 'chao') === 'chao';
  const altPalco = sobre ? +pal.altura_m : 0;
  const wM = pl.largura_m, hM = pl.altura_m;
  const recuo = est && est.noPalco ? 0.7 : sobre ? 0 : 0.4;   // como no Calculator (palcoRecuo)
  const palco = sobre ? { w: +(wM + 2).toFixed(2), h: altPalco, prof: +pal.fundo_m > 0 ? +pal.fundo_m : +(recuo + 1.6).toFixed(2), recuo, x: 0, fechado: false, painelEmCima: true } : null;
  const aereo = (tela.montagem || 'chao') === 'aereo';
  return {
    cena: {
      painel: { w: wM, h: hM, base: sobre ? altPalco : aereo ? 2.5 : 0, x: 0, img: texturaCabeamento(pl, tela.nome || ''),
        placa: { w: +item.painel.larg_m || 0.5, h: +item.painel.alt_m || 0.5, d: 0.08 }, curva: null, alinha: null },
      palco,
      pessoa: { h: 1.75, x: +(wM / 2 + 0.9).toFixed(2), emCima: false },
      apoio: true,
      estrutura: est ? {
        modulos: est.pilha.map(h => ({ h, quadros: h >= 1.9 ? 2 : 1 })), topo: est.topo,
        apoios: est.posicoes.map(x => +(x - wM / 2).toFixed(3)), prof: 0.6, pesos: est.pesos, base: est.base, segunda: est.segunda_linha
      } : null
    },
    est, pl
  };
}

export async function abrir3D(ctx, lista, tela) {
  const { B } = ctx;
  const r = cenaDaTela(ctx, tela);
  if (r.erro) return B.toast(r.erro);
  let AR;
  try { AR = await carregarVisor(); } catch (e) { return B.toast(e.message, { tipo: 'erro' }); }
  const est = r.est;
  const resumo = est
    ? `${est.fileiras} fileiras de mão francesa (${est.pilha.map(h => B.num(h)).join(' + ')} m${est.segunda_linha ? ' + segunda linha' : ''}) · ${est.fileiras * est.pesos} pesos · ${r.pl.dados.portas.length} portas`
    : `${r.pl.dados.portas.length} portas · sem mão francesa`;
  const fundo = document.createElement('div');
  fundo.className = 'tres-tela';
  fundo.innerHTML = `<div class="tres-barra">
      <div class="cresce"><b>${B.esc(tela.nome || 'Tela')}</b> <span class="peq">${B.esc(B.nomeLista(lista))}</span><div class="peq tres-resumo">${B.esc(resumo)}</div></div>
      <div class="abas tres-vistas">${[['', 'Livre'], ['frente', 'Frente'], ['tras', 'Trás'], ['esq', 'Lado'], ['topo', 'Topo']].map(([v, t]) => `<button data-v="${v}">${t}</button>`).join('')}</div>
      <button class="btn sm tres-cotas">Medidas</button>
      ${AR.temAR && AR.temAR() ? '<button class="btn sm tres-ar">Ver no espaço (AR)</button>' : ''}
      <button class="btn sm tres-fechar">Fechar</button></div>
    <canvas class="tres-cv"></canvas>
    <div class="tres-dica">Arraste: girar · botão direito ou dois dedos: mover · roda ou pinça: zoom</div>`;
  document.body.appendChild(fundo);
  const cv = fundo.querySelector('.tres-cv');
  const visor = AR.visor(cv);
  if (!visor) { fundo.remove(); return B.toast('Este aparelho não mostra 3D (sem WebGL).', { tipo: 'erro' }); }
  const ajusta = () => { const rr = cv.getBoundingClientRect(); visor.tamanho(Math.max(200, rr.width), Math.max(200, rr.height)); visor.desenha(); };
  ajusta();
  visor.textura(r.cena.painel.img);
  visor.cena(r.cena, true);
  const marcaVista = v => fundo.querySelectorAll('.tres-vistas [data-v]').forEach(b => b.classList.toggle('on', b.dataset.v === (v || '')));
  if (visor.vista) { visor.vista('frente'); marcaVista('frente'); }
  fundo.querySelectorAll('.tres-vistas [data-v]').forEach(b => {
    b.onclick = () => { if (b.dataset.v) visor.vista(b.dataset.v); else visor.inicial(); marcaVista(b.dataset.v); };
  });
  const cotas = fundo.querySelector('.tres-cotas');
  cotas.onclick = () => { const on = visor.cotas(visor.cotas() ? false : 'm'); cotas.classList.toggle('on', !!on); };
  const arb = fundo.querySelector('.tres-ar');
  if (arb) arb.onclick = async () => {
    try {
      const nome = (tela.nome || 'Painel').replace(/[\\/:*?"<>|]/g, '');
      const blob = await AR.usdz(r.cena);
      if (!AR.abreNoIphone(blob, nome + '.usdz')) B.toast('O AR abre no iPhone (Safari). Neste aparelho, use o 3D aqui na tela.');
    } catch (e) { B.toast('Não deu para abrir o AR: ' + e.message, { tipo: 'erro' }); }
  };
  const fechar = () => { window.removeEventListener('resize', ajusta); document.removeEventListener('keydown', tecla); fundo.remove(); };
  const tecla = e => { if (e.key === 'Escape') fechar(); };
  window.addEventListener('resize', ajusta);
  document.addEventListener('keydown', tecla);
  fundo.querySelector('.tres-fechar').onclick = fechar;
}
