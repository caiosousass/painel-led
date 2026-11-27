/* Projetech · Painel de LED — importar a OS (.xlsx exportado do sistema da empresa).
 *
 * Lê o arquivo no próprio navegador (xlsx = zip de XML; o zip é aberto com DecompressionStream,
 * sem biblioteca) e tira dele o cabeçalho do evento e cada painel de LED com a medida.
 * O técnico não digita nada que a OS já diz — e não esquece a tela do foyer.
 */

/* ---------------- zip + xml ---------------- */

async function inflar(bytes) {
  const ds = new DecompressionStream('deflate-raw');
  const stream = new Blob([bytes]).stream().pipeThrough(ds);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function unzip(buf) {
  const u8 = new Uint8Array(buf);
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  let eocd = u8.length - 22;
  while (eocd >= 0 && dv.getUint32(eocd, true) !== 0x06054b50) eocd--;
  if (eocd < 0) throw new Error('Arquivo não é um .xlsx válido.');
  const n = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);
  const dec = new TextDecoder();
  const files = {};
  for (let i = 0; i < n; i++) {
    const metodo = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true);
    const nlen = dv.getUint16(p + 28, true), xlen = dv.getUint16(p + 30, true), clen = dv.getUint16(p + 32, true);
    const lho = dv.getUint32(p + 42, true);
    const nome = dec.decode(u8.subarray(p + 46, p + 46 + nlen));
    const lnlen = dv.getUint16(lho + 26, true), lxlen = dv.getUint16(lho + 28, true);
    const ini = lho + 30 + lnlen + lxlen;
    const dado = u8.subarray(ini, ini + csize);
    files[nome] = { metodo, dado };
    p += 46 + nlen + xlen + clen;
  }
  const ler = async nome => {
    const f = files[nome];
    if (!f) return null;
    return dec.decode(f.metodo === 8 ? await inflar(f.dado) : f.dado);
  };
  return { ler, nomes: Object.keys(files) };
}

const desesc = s => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
  .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d)).replace(/&amp;/g, '&');

/* Devolve [{ nome, linhas: [{ n, c: { A: 'texto', B: ... } }] }] */
export async function lerXlsx(buf) {
  const z = await unzip(buf);
  const sst = [];
  const ss = await z.ler('xl/sharedStrings.xml');
  if (ss) for (const si of ss.match(/<si>[\s\S]*?<\/si>/g) || [])
    sst.push(desesc((si.match(/<t[^>]*>([\s\S]*?)<\/t>/g) || []).map(t => t.replace(/<[^>]+>/g, '')).join('')));
  const wb = await z.ler('xl/workbook.xml');
  const rels = await z.ler('xl/_rels/workbook.xml.rels');
  const abas = [];
  for (const m of wb.matchAll(/<sheet [^>]*?name="([^"]+)"[^>]*?r:id="([^"]+)"/g)) {
    const alvo = (rels.match(new RegExp('Id="' + m[2] + '"[^>]*Target="([^"]+)"')) || rels.match(new RegExp('Target="([^"]+)"[^>]*Id="' + m[2] + '"')) || [])[1];
    if (!alvo) continue;
    const xml = await z.ler('xl/' + alvo.replace(/^\/?xl\//, ''));
    const linhas = [];
    for (const row of (xml || '').match(/<row[^>]*>[\s\S]*?<\/row>/g) || []) {
      const c = {};
      for (const cel of row.match(/<c [^>]*?(\/>|>[\s\S]*?<\/c>)/g) || []) {
        const ref = (cel.match(/r="([A-Z]+)\d+"/) || [])[1];
        if (!ref) continue;
        const t = (cel.match(/ t="([^"]+)"/) || [])[1];
        let v = (cel.match(/<v>([\s\S]*?)<\/v>/) || [])[1];
        if (t === 's' && v != null) v = sst[+v];
        else if (t === 'inlineStr') v = desesc((cel.match(/<t[^>]*>([\s\S]*?)<\/t>/) || [])[1] || '');
        else if (v != null) v = desesc(v);
        if (v != null && String(v).trim() !== '') c[ref] = String(v).replace(/\s+/g, ' ').trim();
      }
      if (Object.keys(c).length) linhas.push({ n: +(row.match(/ r="(\d+)"/) || [])[1], c });
    }
    abas.push({ nome: desesc(m[1]), linhas });
  }
  return abas;
}

/* ---------------- OS em PDF → as mesmas linhas da planilha ---------------- */

/* Recebe o texto do PDF com posição ([{ pag, x, y, t, tam }], de pdf.js) e devolve [{ nome, linhas }] no mesmo
 * formato de lerXlsx — assim o resto do importador é um só. Layout do PDF do sistema (A4, em pontos):
 *  - cabeçalho: "Rótulo:" à esquerda e o valor ao lado ("Montagem:" "28/10/2026 a 29/10/2026"; "Empresa:" …);
 *  - depois de "DESCRIÇÃO DE EQUIPAMENTOS": sala ("AUDITÓRIO FACE · 30/10/2026 – 01/11/2026"), seção
 *    ("Qtd | Vídeo | Unitário…") e itens: quantidade na margem e a descrição (às vezes em 2–3 linhas) ao lado.
 *  Preço, diárias e totais (à direita) ficam de fora. */
export function abasDoPdf(runs) {
  // rodapé "Página 1/5" ou "OS 34568-16 · Página 1/4"
  const xs = runs.filter(r => !/(^|·\s*)P[aá]gina\s+\d+\s*\/\s*\d+$/i.test(r.t.trim()))
    .map(r => ({ ...r, t: r.t.replace(/\s+/g, ' ').trim() }))
    .sort((a, b) => a.pag - b.pag || b.y - a.y || a.x - b.x);
  const linhas = [];
  const fimCab = xs.findIndex(r => /descri[cç][aã]o de equipamentos/i.test(r.t));
  const cab = fimCab < 0 ? xs : xs.slice(0, fimCab);
  const corpo = fimCab < 0 ? [] : xs.slice(fimCab + 1);

  // Cabeçalho: agrupa por altura (rótulo e valor têm fontes diferentes: até 4 pt de diferença)
  const grupos = [];
  for (const r of cab) {
    const g = grupos.find(g => g.pag === r.pag && Math.abs(g.y - r.y) <= 4);
    if (g) g.rs.push(r); else grupos.push({ pag: r.pag, y: r.y, rs: [r] });
  }
  const COLS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
  for (const g of grupos) {
    const rs = g.rs.sort((a, b) => a.x - b.x);
    const c = {};
    if (!rs.some(r => /:$/.test(r.t))) { // título: "PROPOSTA TÉCNICA E COMERCIAL      34795-3"
      c.A = rs.map(r => r.t).slice(0, Math.max(1, rs.length - 1)).join(' ');
      if (rs.length > 1) c.D = rs[rs.length - 1].t;
    } else { // pares rótulo/valor → A/B, C/D, E/F ("Local:" "Distrito Anhembi" "Cidade:" "São Paulo")
      const pares = [];
      for (const r of rs) {
        if (/:$/.test(r.t) || !pares.length) pares.push({ rot: /:$/.test(r.t) ? r.t : '', val: /:$/.test(r.t) ? '' : r.t });
        else pares[pares.length - 1].val = (pares[pares.length - 1].val + ' ' + r.t).trim();
      }
      pares.slice(0, 4).forEach((p, i) => { if (p.rot) c[COLS[2 * i]] = p.rot; if (p.val) c[COLS[2 * i + 1]] = p.val; });
    }
    linhas.push({ n: linhas.length + 1, c });
  }
  if (fimCab < 0) return [{ nome: 'Proposta', linhas }];
  linhas.push({ n: linhas.length + 1, c: { A: 'Descrição de equipamentos' } });

  // Corpo: âncoras (quantidade e "Qtd" na margem esquerda); a descrição vai para a âncora mais perto
  const MARGEM = 78, DIREITA = 370;
  const ancoras = corpo.filter(r => r.x < MARGEM && /^(\d+(?:[.,]\d+)?|qtd\.?|quant\w*)$/i.test(r.t))
    .map(r => ({ ...r, secao: !/^\d/.test(r.t), desc: [] }));
  const soltos = [];
  for (const r of corpo) {
    if (r.x < MARGEM || r.x >= DIREITA) continue;
    let melhor = null;
    for (const a of ancoras) if (a.pag === r.pag && Math.abs(a.y - r.y) <= 9 && (!melhor || Math.abs(a.y - r.y) < Math.abs(melhor.y - r.y))) melhor = a;
    if (melhor && (!melhor.secao || Math.abs(melhor.y - r.y) <= 2)) melhor.desc.push(r);
    else soltos.push(r);
  }
  const saida = [];
  for (const a of ancoras) {
    const txt = a.desc.sort((p, q) => q.y - p.y || p.x - q.x).map(r => r.t).join(' ').replace(/\s+/g, ' ').trim();
    if (a.secao) saida.push({ pag: a.pag, y: a.y, c: { A: 'Quantidade', B: txt } });
    else if (txt) saida.push({ pag: a.pag, y: a.y, c: { A: a.t.replace(',', '.'), B: txt } });
  }
  // Sala: linha sozinha (sem quantidade), em geral com "· data"
  for (const r of soltos) if (/·\s*\d{1,2}\/\d{1,2}\/\d{4}/.test(r.t) || r.tam >= 8.3) saida.push({ pag: r.pag, y: r.y + 0.01, c: { A: r.t } });
  saida.sort((p, q) => p.pag - q.pag || q.y - p.y);
  for (const s of saida) linhas.push({ n: linhas.length + 1, c: s.c });
  return [{ nome: 'Proposta', linhas }];
}

/* ---------------- interpretar a OS ---------------- */

const temItens = a => a.linhas.some(l => /descri[cç][aã]o de equipamentos/i.test(l.c.A || ''))
  || a.linhas.filter(l => /^\d+([.,]\d+)?$/.test(String(l.c.A || '').trim()) && l.c.B).length >= 3;

/* Quais abas da planilha entram (nas 1.397 OS do arquivo, 41 têm mais de uma aba com itens):
 *  - abas que se somam entram todas: "Opção confirmada" + "Extras - Foyer e Café" (padrão novo, igual ao PDF),
 *    "Plenária" + "Salas de WKS", uma aba por cidade ou por stand;
 *  - abas que são ALTERNATIVAS ("Opção 01 | Opção 02", "Cenário 01 | 02", "1 dia | 30 dias"): só a confirmada
 *    ("… Opção confirmada"); sem confirmação, só a primeira — o resto fica em `abas_fora` e o técnico marca;
 *  - aba repetida (mesmo nome e mesmos itens) entra uma vez.
 * `escolhidas` (nomes) é a escolha feita à mão na tela de importar e manda. */
const ALTERNATIVA = /\b(op[cç][aã]o|opcao|cen[aá]rio|alternativa|vers[aã]o)\b|^\s*\d+\s*dias?\s*$/i;
const CONFIRMADA = /confirmad|aprovad|escolhid|fechad|final/i;
export function abasDaOS(abas, escolhidas) {
  if (escolhidas && escolhidas.length) return abas.filter(a => escolhidas.includes(a.nome));
  const comItens = abas.filter(temItens);
  if (!comItens.length) return abas.slice(0, 1);
  const vistas = new Set();
  const unicas = comItens.filter(a => {
    const chave = a.nome.trim().toLowerCase() + '|' + JSON.stringify(a.linhas.map(l => [l.c.A, l.c.B]));
    if (vistas.has(chave)) return false;
    vistas.add(chave);
    return true;
  });
  const alternativas = unicas.filter(a => ALTERNATIVA.test(a.nome));
  if (alternativas.length < 2) return unicas;
  const confirmadas = alternativas.filter(a => CONFIRMADA.test(a.nome));
  const fica = new Set(confirmadas.length ? confirmadas : alternativas.slice(0, 1));
  return unicas.filter(a => !alternativas.includes(a) || fica.has(a));
}

const isoDe = (d, m, a) => a + '-' + String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0');
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

/* Todas as datas de um texto de OS: "16/10/2026", "16/10/26", "25.07.2025", "26-03-18", "05 e 06/08/2026",
 * "11, 12, 13 e 15/08/2026", "17 A 20.02.2025", "12 de Agosto de 2024", "05 Maio 2018" e, sem o ano, "31/07",
 * "22.02", "25 e 27/08", "04 de Maio". Sem ano, vale o ano que deixa a data mais perto de `ref` (outra data
 * da mesma OS; sem ela, hoje). ref === false: só as datas com ano. */
// "05 e 06", "11, 12, 13 e", "17 a 20" antes da data — mas não o "03" de "13/03 a 16/03/2026"
// nem o "30" de "13h30 e 06/08/2026"
const LISTA_DIAS = '(?<![\\d\\/.\\-h:])((?:\\d{1,2}\\s*(?:,|e|a|à|á|ao|até)\\s*)*)';
const MESES_SA = MESES.map(m => m.normalize('NFD').replace(/[̀-ͯ]/g, ''));
const mesDoNome = w => {
  const s = String(w).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  return MESES_SA.findIndex(m => s === m || s === m.slice(0, 3)) + 1;
};
export function datasDoTexto(txt, ref) {
  const out = [];
  const empurra = (lista, d, mes, ano) => {
    out.push(isoDe(+d, mes, ano));
    for (const x of (lista.match(/\d{1,2}/g) || [])) out.push(isoDe(+x, mes, ano));
  };
  const base = ref || new Date().toISOString().slice(0, 10);
  const anoPerto = (d, mes) => [-1, 0, 1].map(k => +base.slice(0, 4) + k)
    .sort((x, y) => Math.abs(diasEntre(isoDe(+d, mes, x), base)) - Math.abs(diasEntre(isoDe(+d, mes, y), base)))[0];
  let t = String(txt || '');
  t = t.replace(new RegExp(LISTA_DIAS + '(\\d{1,2})([\\/.\\-])(\\d{1,2})\\3(\\d{4}|\\d{2})(?!\\d)', 'gi'), (_, lista, d, sep, m, a) => {
    empurra(lista, d, +m, a.length === 2 ? 2000 + +a : +a);
    return ' ';
  });
  t = t.replace(new RegExp(LISTA_DIAS + '(\\d{1,2})\\s+(?:de\\s+)?([a-zçãé]+)\\.?(?:\\s+(?:de\\s+)?(\\d{4}))?', 'gi'), (tudo, lista, d, nome, a) => {
    const mes = mesDoNome(nome);
    if (!mes || (!a && ref === false)) return tudo;
    empurra(lista, d, mes, a ? +a : anoPerto(d, mes));
    return ' ';
  });
  if (ref !== false) {
    for (const m of t.matchAll(new RegExp(LISTA_DIAS + '(\\d{1,2})[\\/.](\\d{1,2})(?![\\d\\/.h])', 'gi'))) {
      empurra(m[1], m[2], +m[3], anoPerto(m[2], +m[3]));
    }
  }
  return out.filter(d => +d.slice(5, 7) >= 1 && +d.slice(5, 7) <= 12 && +d.slice(8) >= 1 && +d.slice(8) <= 31);
}
const diasEntre = (a, b) => (Date.parse(a + 'T12:00:00Z') - Date.parse(b + 'T12:00:00Z')) / 86400000;
const numBR = s => parseFloat(String(s).replace(',', '.'));

// Data serial do Excel (45799) → ISO
function isoDeSerial(v) {
  const n = +v;
  if (!(n > 30000 && n < 80000)) return null;
  const d = new Date(Date.UTC(1899, 11, 30) + n * 86400000);
  return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') + '-' + String(d.getUTCDate()).padStart(2, '0');
}

/* Qual case do catálogo corresponde ao texto da OS. Na casa "P1" = P1.9, "P2" = P2.9 e "P3" = P3.9. */
export function adivinharPainel(texto, catalogo) {
  // "P2.9 mm … (solicitado P3)": vale o que a Projetech ofereceu, não o que o cliente pediu
  const t = texto.toLowerCase().replace(/\(\s*(solicitad|no lugar)[^)]*\)/g, '');
  const tem = id => (catalogo || []).some(c => c.id === id && c.ativo !== false);
  const escolha = id => (tem(id) ? id : null);
  // P1.9 Absen NT V2 (no catálogo desde 03/11/2026). Outro P1.x (P1.2, P1.5) a casa não tem: não supõe nada.
  if (/\bp\s?1(?:[.,]9\d?)?\b(?![.,]\d)|\b1[.,]9\d?\s*mm/.test(t)) return /quina/.test(t) ? escolha('led-p19-q') : escolha('led-p19');
  if (/\bp\s?1[.,]\d/.test(t)) return null;
  if (/litevision/.test(t)) return escolha('led-lv');
  if (/flex|curv/.test(t)) return escolha('led-nt-flex');
  if (/50\s*x\s*100|0,5\s*x\s*1\s*m/.test(t)) return escolha('led-nt-50x100');
  if (/\bnt\b/.test(t)) return /quina/.test(t) ? escolha('led-nt-q') : escolha('led-nt');
  if (/p\s*3(?![\d,.]*\d\s*m)|p3[.,]9|3[.,]9\s*mm/.test(t)) return escolha('led-p39-l1');
  if (/quina/.test(t)) return escolha('led-v10-q1');
  if (/p\s*2(?!\d)|p2[.,]9|2[.,]9\s*mm/.test(t)) return escolha('led-v10');
  return null;
}

function medidaDoTexto(texto) {
  // "17m x 4m", "15m x 2m", "7 x 4 m", "3,5 x 2m" — ignora a medida do gabinete "(0,50m x0,50m)"
  const semGab = texto.replace(/\(\s*0[,.]5\d*\s*m?\s*x\s*0[,.]5\d*\s*m?\s*\)/gi, '').replace(/\(\s*0[,.]5\d*\s*m?\s*x\s*1[,.]?0*\s*m?\s*\)/gi, '');
  const m = semGab.match(/(\d+(?:[.,]\d+)?)\s*m?\s*x\s*(\d+(?:[.,]\d+)?)\s*m\b/i) || semGab.match(/(\d+(?:[.,]\d+)?)\s*m\s*x\s*(\d+(?:[.,]\d+)?)/i);
  if (!m) return null;
  const w = numBR(m[1]), h = numBR(m[2]);
  if (!(w > 0 && h > 0) || w > 200 || h > 50) return null;
  return { largura_m: w, altura_m: h };
}

/* "Painel sobre o palco", "em cima do palco de 0,60 m", "palco 60 cm" → { altura_m } (null se não diz) */
export function palcoDoTexto(texto) {
  const t = semAcento(texto);
  if (!/(sobre|em cima d)[oa]? ?(o |do )?palco|\bno palco\b/.test(t)) return null;
  const m = t.match(/palco[^\d]{0,12}(\d+(?:[.,]\d+)?)\s*(cm|m)\b/);
  let h = m ? numBR(m[1]) : null;
  if (h != null && m[2] === 'cm') h = h / 100;
  return { altura_m: h > 0 && h < 3 ? +h.toFixed(2) : null };
}

function montagemDoTexto(texto) {
  const t = semAcento(texto);
  if (/^(\S+\s+)?tote[mn]/.test(t)) return 'totem';
  if (/^(\S+\s+)?(balca|cubo)/.test(t)) return 'balcao';
  if (/aereo|bumper|suspens|\bvoo\b|testeira/.test(t)) return 'aereo';
  if (/^(\S+\s+)?(portico|coluna|tunel|piso|tira|letreiro)/.test(t)) return 'outro';
  return 'chao';
}

// A linha É um painel (e não "estrutura para painel", "bagum para painel", "painel do local").
/* Esta linha da OS é um PAINEL DE LED (do nosso setor)? Três filtros, nesta ordem:
 *  1. Seção da OS: o que está em Iluminação, Áudio, Equipe técnica, Filmagem… nunca é painel
 *     ("Fresnel em LED com bandoor", "Strobo LED", "Técnico de LED").
 *  2. Palavras de outro setor ou de acessório: refletor, par, ribalta, moving, fita de LED, TV,
 *     rack, estrutura, tapadeira, lona, switcher… ("Rack para painel de LED" não é painel).
 *  3. Forma de painel no começo da descrição (painel, totem, balcão, pórtico, testeira, cubo,
 *     coluna, piso, túnel, tira, tela, backdrop, letreiro…) E sinal de LED: a palavra "LED", o pitch
 *     (P2, P3.9, 2,9 mm) ou a seção da OS ser de LED/painel ("Painel de P3 indoor" numa seção "LED").
 * Os casos de teste (test/os.test.js) são linhas reais de OS da Projetech.
 */
const semAcento = t => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const SECAO_OUTRA = /ilumina|audio|\bsom\b|sonoriza|equipe|tecnic|filmage|transmiss|secretaria|interac|catering|mobili|recepcionist|traducao|rider/;
const OUTRO_SETOR = new RegExp([
  'refletor', 'fresnel', '\\bpar\\b', '\\bspots?\\b', 'strob', 'ribalta', 'moving', '\\bwash\\b', '\\bbeam\\b', 'elipsoidal', '\\bcob\\b',
  'soft ?box', 'mini ?bru', 'fita', 'linha de led', 'mangueira', 'lampada', 'up ?light', 'gobo',
  '\\btv\\b', 'televis', 'monitor', 'touch', 'switcher', 'processador', 'conversor', 'fibra',
  'tecnic', 'montador', 'operador', 'rack', 'energia', 'estrutura', 'truss', '\\bgrid\\b', 'berco', 'mao francesa', 'elevacao',
  'tapadeira', 'bagum', 'barrado', 'fechamento', '\\blona\\b', 'adesivad', 'cenografic', 'conteudo', 'criacao', 'edicao', 'do local', 'da casa'
].join('|'));
const FORMA = /^(\(?\d+\)?\s*(x|un\.?|unid\.?)?\s*)?(paineis|painel|painei|pailnel|telao|tela|totens|totem|toten|balcoes|balcao|porticos|portico|testeiras|testeira|cubos|cubo|colunas|coluna|piso|tunel|tiras|tira|parede|backdrop|letreiro|led ?wall|video ?wall)\b/;
const SINAL_LED = /\bled\b|\bp\s?[1-6](?:[.,]\d{1,2})?\b|\b\d[.,]\d{1,2}\s?mm\b/;

export function ehPainel(b, secao) {
  const t = semAcento(b), sec = semAcento(secao);
  if (sec && SECAO_OUTRA.test(sec)) return false;
  if (OUTRO_SETOR.test(t)) return false;
  if (!FORMA.test(t)) return false;
  return SINAL_LED.test(t) || /led|painel/.test(sec);
}

/* Quantas telas iguais a linha da OS pede:
 *  - "(02 painéis)" escrito na linha → 2;
 *  - preço por m² ("Painel de LED … - m² — 2,5 x 4 m", formato novo): a quantidade é m² → 20 m² de 2,5 × 4 = 2 telas;
 *  - senão (formato antigo): "30 × Painel 15m × 2m" é 30 m² (uma tela); "2 × Painel 7m × 4m" / "6 Totens 1m x 2m"
 *    são 2 telas / 6 totens. */
export function quantasTelas(b, qtd, med) {
  const t = semAcento(b);
  const escrito = (t.match(/\(\s*0*(\d{1,2})\s*(paineis|telas|totens|unidades)\s*\)/) || [])[1];
  if (escrito) return +escrito;
  if (!med) return 1;
  const area = med.largura_m * med.altura_m;
  if (/\bm²|\bm2\b/.test(t)) {
    const k = Math.round(qtd / area);
    if (k >= 1 && k <= 20 && Math.abs(qtd - k * area) / (k * area) <= 0.05) return k;
    // "3 × Painel … m² — 5 x 3,5 m" (Almoço VIP, 4 salas): 3 não é área de nada — são 3 painéis
    return Number.isInteger(qtd) && qtd <= 20 && qtd < area ? qtd : 1;
  }
  return Math.abs(qtd - area) / area > 0.05 && Number.isInteger(qtd) && qtd <= 20 ? qtd : 1;
}

/* "… 840 x 1.344 px (02 painéis) - verticais laterais (solicitado P3)" → "Verticais laterais" (o PDF/xlsx novo do
 * sistema descreve a função da tela depois da resolução) */
function descritorDoTexto(b) {
  const m = String(b).replace(/\(\s*(solicitad|no lugar)[^)]*\)/gi, '').match(/\bpx\b\s*(?:\(\s*\d+\s*[^)]*\))?\s*[-–—]\s*(.+)$/i);
  if (!m) return '';
  const d = m[1].replace(/\([^)]*\)/g, '').replace(/\s+/g, ' ').replace(/[\s\-–—·]+$/, '').trim();
  return d.length > 2 && d.length <= 40 ? d[0].toUpperCase() + d.slice(1) : '';
}
// "AUDITÓRIO FACE (PRINCIPAL)" → "Auditório Face (Principal)" (o PDF escreve a sala toda em maiúsculas)
function nomeSala(sala) {
  if (!sala) return 'Tela';
  if (sala !== sala.toUpperCase()) return sala;
  return sala.toLowerCase().replace(/(^|[\s(\-\/])(\p{L})/gu, (_, a, l) => a + l.toUpperCase()).replace(/\b(De|Da|Do|Das|Dos|E)\b/g, s => s.toLowerCase());
}

const RELEVANTES =/processador|novastar|sending|taurus|cvt|fibra|rack.*(painel|energia)|conversor|switcher|vx\d|h\d\b|h series|nova ?star/i;

export function interpretarOS(abas, catalogo, opts = {}) {
  const usadas = abasDaOS(abas, opts.abas);
  if (!usadas.length) throw new Error('Planilha vazia.');
  const out = { os: '', evento: '', cliente: '', local: '', cidade: '', montagem: null, fim: null, ida: null, volta: null, datas_ignoradas: [], telas: [], outros: [], avisos: [],
    abas: usadas.map(a => a.nome), abas_fora: abas.filter(a => !usadas.includes(a) && temItens(a)).map(a => a.nome) };
  const linhasData = [];
  let sala = '';
  let secao = '';          // "Vídeo", "Iluminação", "Painel de LED"… (linha "Quantidade | <seção>")
  let cabecalhoAcabou = false;

  // cada aba repete o cabeçalho e tem as suas salas (as datas valem as da primeira: no padrão novo são iguais)
  for (const aba of usadas) { sala = ''; secao = ''; cabecalhoAcabou = false; for (const { c } of aba.linhas) {
    const a = c.A || '', b = c.B || '';
    const chaves = Object.keys(c);

    if (!out.os && /proposta|ordem de servi/i.test(a) && c.D) out.os = c.D;
    if (/^nome do evento/i.test(a)) out.evento = b;
    if (/^cliente/i.test(a) && !out.evento) out.evento = b; // formato antigo: "Cliente:" traz o nome do evento
    if (/^(empresa|ag[eê]ncia)/i.test(c.C || '') && c.D && !/cliente direto/i.test(c.D)) out.cliente = out.cliente || c.D;
    if (/^local/i.test(a)) { out.local = b; if (/^cidade/i.test(c.C || '')) out.cidade = c.D || ''; }

    // "Montagem:", "Data da Montagem:", "Data Evento:", "Desmontagem:"… (a data pode estar na coluna A ou B)
    // "Primeira carga 29.05" também é saída de material (conta como montagem); "Data: 26/02/2018" sozinho é o evento
    const rotulo = semAcento(a).replace(/^data\s*:?\s*(?=\d|$)/, 'evento ').replace(/^data\s+(d[aoe]s?\s+)?/, '');
    if (!cabecalhoAcabou && aba === usadas[0] && /^(desa?carregar|descarregar|montagem|(\S+\s+)?carga|ensaio|evento|desmontagem|integra|realiza|coquetel|premia)/.test(rotulo)) {
      linhasData.push({ montagem: /^(desa?carregar|descarregar|montagem|(\S+\s+)?carga)/.test(rotulo), texto: a + ' ' + b, serial: isoDeSerial(b) });
    }
    if (/descri[cç][aã]o de equipamentos/i.test(a)) { cabecalhoAcabou = true; continue; }
    if (!cabecalhoAcabou && /^observa/i.test(a)) { cabecalhoAcabou = true; continue; }
    if (!cabecalhoAcabou && /^quant/i.test(a)) cabecalhoAcabou = true;
    if (!cabecalhoAcabou) continue;

    // Linha só com texto na coluna A, sem quantidade = nome da sala
    if (chaves.length === 1 && a && !/^\d/.test(a) && !/^quant/i.test(a) && !a.startsWith('*')) {
      // "BALLROOM 01 E 04 - Obs: Itens já duplicados · 13/10/2026" → "BALLROOM 01 E 04"
      sala = a.replace(/\s*·\s*\d{2}\/\d{2}\/\d{4}.*/, '').replace(/\s*[-–—]\s*obs\.?\s*:.*$/i, '').trim();
      secao = '';
      continue;
    }
    if (/^quant/i.test(a)) { secao = b; continue; }
    const qtd = numBR(a);
    if (!(qtd > 0) || !b) continue;

    if (ehPainel(b, secao)) {
      if (/outra empresa|terceiriz|sublocad/i.test(b)) { out.outros.push({ sala, qtd, texto: b }); continue; }
      const med = medidaDoTexto(b);
      let painel = adivinharPainel(b, catalogo);
      // Totem/balcão/pórtico sem pitch escrito: na casa é P2.9 V10 — vai marcado para o técnico conferir
      // (se a OS diz um pitch que a casa não tem, como P1.9, não supõe nada: o técnico escolhe)
      const temPitch = /\bp\s?\d|\d[.,]\d\s?mm/i.test(b);
      let suposto = false;
      if (!painel && !temPitch && (catalogo || []).some(c => c.id === 'led-v10')) { painel = 'led-v10'; suposto = true; out.avisos.push({ tipo: 'painel_suposto', texto: b, sala }); }
      // o pitch que a OS pede quando a casa não tem (P1, P1.9…): a tela vem desmarcada no importar
      const pitch = painel ? null : ((b.replace(/\(\s*(solicitad|no lugar)[^)]*\)/gi, '').match(/\bp\s?(\d(?:[.,]\d{1,2})?)\b/i) || [])[1] || null);
      const montagem = montagemDoTexto(b);
      const palco = montagem === 'chao' ? palcoDoTexto(b) : null;
      const copias = quantasTelas(b, qtd, med);
      for (let i = 0; i < copias; i++) {
        out.telas.push({
          nome: nomeSala(sala) + (descritorDoTexto(b) ? ' · ' + descritorDoTexto(b) : ''),
          sala: sala ? nomeSala(sala) : '',
          // nome dentro da sublista da sala ("Totem 1", "Verticais laterais 2")
          nome_curto: descritorDoTexto(b) || ({ totem: 'Totem', balcao: 'Balcão', aereo: 'Painel aéreo' }[montagem] || 'Painel'),
          painel, montagem, palco, suposto, pitch_os: pitch ? 'P' + pitch.replace(',', '.') : null,
          modo: med ? 'medida' : 'gabinetes',
          largura_m: med ? med.largura_m : null, altura_m: med ? med.altura_m : null,
          texto: b, qtd_os: qtd
        });
      }
      if (!med) out.avisos.push({ tipo: 'sem_medida', texto: b, sala });
      if (!painel) out.avisos.push({ tipo: 'sem_painel', texto: b, sala });
      continue;
    }
    if (RELEVANTES.test(b)) out.outros.push({ sala, qtd, texto: b });
  } }

  // A OS traz as datas do EVENTO; o material sai do galpão na véspera da montagem e volta no dia
  // seguinte ao último dia (desmontagem à noite, chega no outro dia). Reservar um dia a mais dos dois
  // lados é o lado seguro: o estoque não promete o mesmo painel para outro evento no dia da carga.
  const ord = arr => arr.slice().sort();
  // Âncora = a data com que mais datas da OS concordam (até 60 dias); a do nome do arquivo ("… - 16-10-2026.xlsx")
  // desempata, mas não vence a OS quando ela mesma está errada. Datas sem ano ("31/07") pegam o ano da âncora.
  // Ano digitado errado ("14 a 16.08.2025" numa convenção de janeiro, "2917") fica de fora — ou é corrigido
  // em ±1 ano quando assim cai perto das outras datas.
  const PERTO = 60;
  const completas = ord(linhasData.flatMap(l => datasDoTexto(l.texto, false).concat(l.serial || [])));
  const doNome = ord(datasDoTexto(opts.nome || '', false));
  let ancora = opts.hoje || null, melhor = -1;
  for (const [c, bonus] of doNome.map(d => [d, 0.5]).concat(completas.map(d => [d, 0]))) {
    const nota = completas.filter(d => Math.abs(diasEntre(d, c)) <= PERTO).length + bonus;
    if (nota > melhor) { melhor = nota; ancora = c; }
  }
  const ajusta = d => {
    if (!ancora || Math.abs(diasEntre(d, ancora)) <= PERTO) return d;
    for (const k of [-1, 1]) {
      const outra = (+d.slice(0, 4) + k) + d.slice(4);
      if (Math.abs(diasEntre(outra, ancora)) <= PERTO) return outra;
    }
    out.datas_ignoradas.push(d);
    return null;
  };
  const datasMontagem = [], datasTodas = [];
  for (const l of linhasData) {
    const ds = datasDoTexto(l.texto, ancora);
    if (l.serial) ds.push(l.serial);
    const boas = ds.map(ajusta).filter(Boolean);
    if (l.montagem) datasMontagem.push(...boas);
    datasTodas.push(...boas);
  }
  // O nome do arquivo costuma trazer o período do evento ("12 a 17.01.2025"): conta quando fica a até 7 dias
  // das datas da OS (ou quando a OS não tem data nenhuma) — se a OS diz julho e o arquivo agosto, vale a OS
  const daOS = datasTodas.slice();
  for (const d of doNome) if (!daOS.length || daOS.some(x => Math.abs(diasEntre(d, x)) <= 7)) datasTodas.push(d);
  if (datasMontagem.length) out.montagem = ord(datasMontagem)[0];
  else if (datasTodas.length) out.montagem = ord(datasTodas)[0];
  if (datasTodas.length) out.fim = ord(datasTodas)[datasTodas.length - 1];
  // Nomes repetidos na mesma OS viram "… 1", "… 2" (duas laterais iguais, dois painéis na mesma sala)
  const vezes = {};
  for (const t of out.telas) vezes[t.nome] = (vezes[t.nome] || 0) + 1;
  const conta = {};
  for (const t of out.telas) if (vezes[t.nome] > 1) { const base = t.nome; conta[base] = (conta[base] || 0) + 1; t.nome = base + ' ' + conta[base]; }
  const vezesCurto = {}, contaCurto = {};
  for (const t of out.telas) { const k = t.sala + '|' + t.nome_curto; vezesCurto[k] = (vezesCurto[k] || 0) + 1; }
  for (const t of out.telas) { const k = t.sala + '|' + t.nome_curto; if (vezesCurto[k] > 1) { contaCurto[k] = (contaCurto[k] || 0) + 1; t.nome_curto += ' ' + contaCurto[k]; } }

  if (out.montagem) out.ida = somaDias(out.montagem, -DIAS_ANTES);
  if (out.fim) out.volta = somaDias(out.fim, DIAS_DEPOIS);
  return out;
}

export const DIAS_ANTES = 1, DIAS_DEPOIS = 1;
export function somaDias(iso, n) {
  const d = new Date(iso + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
