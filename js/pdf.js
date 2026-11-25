/* Projetech · Painel de LED — ler o texto de um PDF (a OS que o sistema da empresa gera em PDF).
 *
 * Sem biblioteca: abre os objetos do PDF, descomprime as páginas (FlateDecode, com DecompressionStream),
 * traduz as fontes pelo /ToUnicode e devolve cada pedaço de texto com a posição na página.
 * Feito para o PDF do sistema (PDFKit: xref simples, fontes Type0 Identity-H); outros PDFs simples
 * (fonte com WinAnsi, texto em (parênteses)) também passam. PDF escaneado (imagem) não tem texto.
 */

// Tolerante: PDF com bytes sobrando depois dos dados comprimidos (comum) devolve o que deu para ler
async function inflarZlib(bytes) {
  const leitor = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate')).getReader();
  const partes = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await leitor.read();
      if (done) break;
      partes.push(value);
      total += value.length;
    }
  } catch (e) {
    if (!total) throw e;
  }
  const out = new Uint8Array(total);
  let p = 0;
  for (const v of partes) { out.set(v, p); p += v.length; }
  return out;
}
const latin1 = u8 => { let s = ''; for (let i = 0; i < u8.length; i += 8192) s += String.fromCharCode.apply(null, u8.subarray(i, i + 8192)); return s; };

/* ---------------- objetos ---------------- */

function lerObjetos(u8) {
  const s = latin1(u8);
  const objs = new Map();
  // "/Length 5 0 R": o tamanho está em outro objeto ("5 0 obj 1234 endobj")
  const tamanhoRef = n => +((s.match(new RegExp('(?:^|[\\r\\n\\s])' + n + '\\s+0\\s+obj\\s*(\\d+)\\s*endobj')) || [])[1]) || null;
  const re = /(\d+)\s+(\d+)\s+obj\b/g;
  let m;
  while ((m = re.exec(s))) {
    const ini = m.index + m[0].length;
    let corpo, dados = null, prox;
    const st = s.slice(ini, ini + 4096).search(/\bstream\r?\n/);
    const fimSemStream = s.indexOf('endobj', ini);
    if (fimSemStream < 0) break;
    if (st >= 0 && ini + st < fimSemStream) {
      const dict = s.slice(ini, ini + st);
      let a = ini + st + 6;
      if (s[a] === '\r') a++;
      if (s[a] === '\n') a++;
      const direto = (dict.match(/\/Length\s+(\d+)\b(?!\s+\d+\s+R)/) || [])[1];
      const indireto = (dict.match(/\/Length\s+(\d+)\s+\d+\s+R/) || [])[1];
      let len = direto != null ? +direto : (indireto ? tamanhoRef(indireto) : null);
      if (len == null || a + len > s.length) len = s.indexOf('endstream', a) - a;
      dados = { bytes: u8.subarray(a, a + len), dict };
      corpo = dict;
      const fe = s.indexOf('endobj', a + len);
      prox = fe < 0 ? s.length : fe + 6;
    } else {
      corpo = s.slice(ini, fimSemStream);
      prox = fimSemStream + 6;
    }
    objs.set(+m[1], { corpo: corpo.trim(), dados });
    re.lastIndex = prox;
  }
  return objs;
}

// PDF 1.5+ (Excel/Word "Salvar como PDF"): objetos guardados dentro de /ObjStm comprimidos
async function abrirPacotes(objs) {
  for (const [, o] of [...objs]) {
    if (!/\/Type\s*\/ObjStm/.test(o.corpo)) continue;
    let txt;
    try { txt = await conteudoStream(o); } catch (e) { continue; }
    const n = +((o.corpo.match(/\/N\s+(\d+)/) || [])[1] || 0), first = +((o.corpo.match(/\/First\s+(\d+)/) || [])[1] || 0);
    const nums = txt.slice(0, first).trim().split(/\s+/).map(Number);
    for (let i = 0; i < n; i++) {
      const id = nums[2 * i], ini = first + nums[2 * i + 1], fim = i + 1 < n ? first + nums[2 * i + 3] : txt.length;
      if (!objs.has(id)) objs.set(id, { corpo: txt.slice(ini, fim).trim(), dados: null });
    }
  }
}

const ref = (txt, chave) => { const m = String(txt || '').match(new RegExp('/' + chave + '\\s+(\\d+)\\s+\\d+\\s+R')); return m ? +m[1] : null; };

async function conteudoStream(obj) {
  if (!obj || !obj.dados) return '';
  const { bytes, dict } = obj.dados;
  if (/\/Filter\s*\/FlateDecode|\/Filter\s*\[\s*\/FlateDecode\s*\]/.test(dict)) return latin1(await inflarZlib(bytes));
  if (/\/Filter/.test(dict)) return ''; // outro filtro (imagem etc.) — não é texto
  return latin1(bytes);
}

/* ---------------- fontes ---------------- */

// "<0074 0069>" = ligadura "ti" (dois caracteres no mesmo glifo)
const utf16 = hex => { hex = hex.replace(/\s+/g, ''); let out = ''; for (let i = 0; i + 4 <= hex.length; i += 4) out += String.fromCharCode(parseInt(hex.slice(i, i + 4), 16)); return out; };

function lerCMap(txt) {
  const mapa = new Map();
  for (const bloco of txt.matchAll(/beginbfchar([\s\S]*?)endbfchar/g))
    for (const m of bloco[1].matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F\s]+)>/g)) mapa.set(parseInt(m[1], 16), utf16(m[2]));
  for (const bloco of txt.matchAll(/beginbfrange([\s\S]*?)endbfrange/g)) {
    for (const m of bloco[1].matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*(\[[^\]]*\]|<[0-9a-fA-F\s]+>)/g)) {
      const lo = parseInt(m[1], 16), hi = parseInt(m[2], 16);
      if (m[3].startsWith('[')) {
        const lista = [...m[3].matchAll(/<([0-9a-fA-F\s]+)>/g)].map(x => utf16(x[1]));
        for (let c = lo; c <= hi && c - lo < lista.length; c++) mapa.set(c, lista[c - lo]);
      } else {
        const base = m[3].slice(1, -1).replace(/\s+/g, '');
        const ini = parseInt(base.slice(-4), 16), pre = utf16(base.slice(0, -4));
        for (let c = lo; c <= hi; c++) mapa.set(c, pre + String.fromCharCode(ini + c - lo));
      }
    }
  }
  return mapa;
}

// WinAnsi nos códigos 128–159 (o resto do latin1 bate com o Unicode)
const WIN = { 128: '€', 130: '‚', 131: 'ƒ', 132: '„', 133: '…', 134: '†', 135: '‡', 136: 'ˆ', 137: '‰', 138: 'Š', 139: '‹', 140: 'Œ', 142: 'Ž', 145: '‘', 146: '’', 147: '“', 148: '”', 149: '•', 150: '–', 151: '—', 152: '˜', 153: '™', 154: 'š', 155: '›', 156: 'œ', 158: 'ž', 159: 'Ÿ' };

async function lerFonte(objs, id) {
  const f = objs.get(id);
  const corpo = f ? f.corpo : '';
  const dois = /\/Type0/.test(corpo) || /Identity-H/.test(corpo);
  const tu = ref(corpo, 'ToUnicode');
  const mapa = tu ? lerCMap(await conteudoStream(objs.get(tu))) : null;
  return {
    bytes: dois ? 2 : 1,
    texto(bin) {
      let out = '';
      const n = dois ? 2 : 1;
      for (let i = 0; i + n <= bin.length; i += n) {
        const c = n === 2 ? (bin.charCodeAt(i) << 8) | bin.charCodeAt(i + 1) : bin.charCodeAt(i);
        out += mapa && mapa.has(c) ? mapa.get(c) : (n === 1 ? (WIN[c] || String.fromCharCode(c)) : '');
      }
      return out;
    }
  };
}

/* ---------------- conteúdo da página ---------------- */

function* tokens(s) {
  let i = 0;
  const n = s.length;
  while (i < n) {
    const c = s[i];
    if (/\s/.test(c)) { i++; continue; }
    if (c === '%') { while (i < n && s[i] !== '\n' && s[i] !== '\r') i++; continue; }
    if (c === '(') { // string literal com escapes e parênteses aninhados
      let prof = 1, out = '';
      i++;
      while (i < n && prof > 0) {
        const d = s[i];
        if (d === '\\') {
          const e = s[i + 1];
          const esc = { n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', '(': '(', ')': ')', '\\': '\\' };
          if (e in esc) { out += esc[e]; i += 2; }
          else if (/[0-7]/.test(e)) { const oct = s.slice(i + 1, i + 4).match(/^[0-7]{1,3}/)[0]; out += String.fromCharCode(parseInt(oct, 8)); i += 1 + oct.length; }
          else { i += 2; }
          continue;
        }
        if (d === '(') prof++;
        if (d === ')') { prof--; if (!prof) { i++; break; } }
        out += d;
        i++;
      }
      yield { tipo: 'str', v: out };
      continue;
    }
    if (c === '<' && s[i + 1] === '<') { yield { tipo: 'op', v: '<<' }; i += 2; continue; }
    if (c === '>' && s[i + 1] === '>') { yield { tipo: 'op', v: '>>' }; i += 2; continue; }
    if (c === '<') {
      const f = s.indexOf('>', i);
      let hex = s.slice(i + 1, f).replace(/\s+/g, '');
      if (hex.length % 2) hex += '0';
      let bin = '';
      for (let k = 0; k < hex.length; k += 2) bin += String.fromCharCode(parseInt(hex.slice(k, k + 2), 16));
      yield { tipo: 'str', v: bin };
      i = f + 1;
      continue;
    }
    if (c === '[') { yield { tipo: 'ini' }; i++; continue; }
    if (c === ']') { yield { tipo: 'fim' }; i++; continue; }
    if (c === '/') { let j = i + 1; while (j < n && !/[\s\/\[\]<>(){}%]/.test(s[j])) j++; yield { tipo: 'nome', v: s.slice(i + 1, j) }; i = j; continue; }
    let j = i;
    while (j < n && !/[\s\/\[\]<>(){}%]/.test(s[j])) j++;
    if (j === i) { i++; continue; }
    const p = s.slice(i, j);
    i = j;
    if (/^[+-]?(\d+\.?\d*|\.\d+)$/.test(p)) { yield { tipo: 'num', v: +p }; continue; }
    if (p === 'BI') { // imagem embutida: pula até EI
      const ei = s.indexOf('EI', i);
      i = ei < 0 ? n : ei + 2;
      continue;
    }
    yield { tipo: 'op', v: p };
  }
}

const mult = (a, b) => [a[0] * b[0] + a[1] * b[2], a[0] * b[1] + a[1] * b[3], a[2] * b[0] + a[3] * b[2], a[2] * b[1] + a[3] * b[3],
  a[4] * b[0] + a[5] * b[2] + b[4], a[4] * b[1] + a[5] * b[3] + b[5]];

function textoDaPagina(conteudo, fontes, pag) {
  const runs = [];
  let ctm = [1, 0, 0, 1, 0, 0];
  const pilha = [];
  let tm = [1, 0, 0, 1, 0, 0], tlm = tm, lead = 0, fonte = null, tam = 0;
  let ops = [], arr = null;
  const emite = txt => {
    if (!txt || !txt.trim()) return;
    const m = mult(tm, ctm);
    runs.push({ pag, x: m[4], y: m[5], t: txt, tam: tam * Math.hypot(m[2], m[3]) });
  };
  const decod = bin => (fonte ? fonte.texto(bin) : bin);
  const pula = (tx, ty) => { tlm = mult([1, 0, 0, 1, tx, ty], tlm); tm = tlm; };
  for (const tk of tokens(conteudo)) {
    if (tk.tipo === 'ini') { arr = []; continue; }
    if (tk.tipo === 'fim') { ops.push({ tipo: 'arr', v: arr }); arr = null; continue; }
    if (arr) { arr.push(tk); continue; }
    if (tk.tipo !== 'op') { ops.push(tk); continue; }
    const num = k => (ops[ops.length - k] || {}).v;
    switch (tk.v) {
      case 'q': pilha.push(ctm); break;
      case 'Q': ctm = pilha.pop() || [1, 0, 0, 1, 0, 0]; break;
      case 'cm': ctm = mult(ops.slice(-6).map(o => o.v), ctm); break;
      case 'BT': tm = tlm = [1, 0, 0, 1, 0, 0]; break;
      case 'Tm': tm = tlm = ops.slice(-6).map(o => o.v); break;
      case 'Td': pula(num(2), num(1)); break;
      case 'TD': lead = -num(1); pula(num(2), num(1)); break;
      case 'TL': lead = num(1); break;
      case 'T*': pula(0, -lead); break;
      case 'Tf': fonte = fontes[num(2)] || null; tam = num(1); break;
      case 'Tj': emite(decod(num(1) || '')); break;
      case "'": pula(0, -lead); emite(decod(num(1) || '')); break;
      case '"': pula(0, -lead); emite(decod(num(1) || '')); break;
      case 'TJ': {
        const a = (ops[ops.length - 1] || {}).v || [];
        // espaçamento grande no meio do TJ (< -200 milésimos) vira espaço
        emite(a.map(o => (o.tipo === 'str' ? decod(o.v) : (o.v < -200 ? ' ' : ''))).join(''));
        break;
      }
    }
    ops = [];
  }
  return runs;
}

/* Devolve todos os pedaços de texto: [{ pag, x, y, t, tam }] (y cresce para cima, como no PDF) */
export async function textoDoPdf(buf) {
  const u8 = new Uint8Array(buf);
  if (latin1(u8.subarray(0, 8)).indexOf('%PDF') < 0) throw new Error('Arquivo não é um PDF.');
  const objs = lerObjetos(u8);
  await abrirPacotes(objs);
  if (!objs.size) throw new Error('Não consegui abrir este PDF (talvez esteja protegido ou comprimido de um jeito diferente). Use o .xlsx da OS.');
  // páginas na ordem do /Kids (com páginas aninhadas); se não achar, na ordem dos objetos
  const paginas = [];
  const raiz = [...objs.entries()].find(([, o]) => /\/Type\s*\/Catalog/.test(o.corpo));
  const visita = id => {
    const o = objs.get(id);
    if (!o) return;
    if (/\/Type\s*\/Pages\b/.test(o.corpo)) for (const k of (o.corpo.match(/\/Kids\s*\[([^\]]*)\]/) || [, ''])[1].matchAll(/(\d+)\s+\d+\s+R/g)) visita(+k[1]);
    else if (/\/Type\s*\/Page\b/.test(o.corpo)) paginas.push(id);
  };
  if (raiz) visita(ref(raiz[1].corpo, 'Pages'));
  if (!paginas.length) for (const [id, o] of objs) if (/\/Type\s*\/Page\b/.test(o.corpo)) paginas.push(id);
  const cacheFonte = new Map();
  const runs = [];
  for (let p = 0; p < paginas.length; p++) {
    const pg = objs.get(paginas[p]).corpo;
    let res = (pg.match(/\/Resources\s*(<<[\s\S]*>>)/) || [])[1] || '';
    const resRef = ref(pg, 'Resources');
    if (resRef) res = objs.get(resRef)?.corpo || '';
    let fontesDict = (res.match(/\/Font\s*<<([\s\S]*?)>>/) || [])[1] || '';
    const fRef = ref(res, 'Font');
    if (!fontesDict && fRef) fontesDict = objs.get(fRef)?.corpo || '';
    const fontes = {};
    for (const m of fontesDict.matchAll(/\/([^\s\/]+)\s+(\d+)\s+\d+\s+R/g)) {
      if (!cacheFonte.has(+m[2])) cacheFonte.set(+m[2], await lerFonte(objs, +m[2]));
      fontes[m[1]] = cacheFonte.get(+m[2]);
    }
    const cont = pg.match(/\/Contents\s*(\[[^\]]*\]|\d+\s+\d+\s+R)/);
    const ids = cont ? [...cont[1].matchAll(/(\d+)\s+\d+\s+R/g)].map(m => +m[1]) : [];
    let conteudo = '';
    for (const id of ids) conteudo += (await conteudoStream(objs.get(id))) + '\n';
    runs.push(...textoDaPagina(conteudo, fontes, p + 1));
  }
  return runs;
}
