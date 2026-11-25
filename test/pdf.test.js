// Importar OS em PDF: o leitor de PDF (js/pdf.js) e a conversão para as linhas da planilha (abasDoPdf).
// O PDF de teste é montado aqui, no mesmo formato do PDF do sistema da empresa (PDFKit: fonte Type0
// Identity-H com /ToUnicode, inclusive ligadura "ti", página comprimida, coordenadas com cm invertido).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import zlib from 'node:zlib';
import { textoDoPdf } from '../js/pdf.js';
import { abasDoPdf, interpretarOS, quantasTelas } from '../js/os.js';
import { catalogoInicial } from '../js/seed.js';

function montarPdf(linhas) {
  // glifos: cada caractere usado vira um código; "ti" vira um glifo só (ligadura), como no PDFKit
  const glifos = ['ti'];
  const cod = txt => {
    let hex = '', i = 0;
    while (i < txt.length) {
      const g = txt.startsWith('ti', i) ? 'ti' : txt[i];
      if (!glifos.includes(g)) glifos.push(g);
      hex += (glifos.indexOf(g) + 1).toString(16).padStart(4, '0');
      i += g.length;
    }
    return hex;
  };
  let conteudo = '1 0 0 -1 0 841.89 cm\n';
  for (const [x, y, txt, tam] of linhas)
    conteudo += `q\n1 0 0 -1 0 841.89 cm\nBT\n1 0 0 1 ${x} ${y} Tm\n/F2 ${tam || 7} Tf\n[<${cod(txt).slice(0, 8)}> 12.5 <${cod(txt).slice(8)}> 0] TJ\nET\nQ\n`;
  const u16 = s => [...s].map(c => c.charCodeAt(0).toString(16).padStart(4, '0')).join(' ');
  const cmap = `/CIDInit /ProcSet findresource begin\nbegincmap\n1 begincodespacerange\n<0000><ffff>\nendcodespacerange\n1 beginbfrange\n<0001> <${glifos.length.toString(16).padStart(4, '0')}> [${glifos.map(g => '<' + u16(g) + '>').join(' ')}]\nendbfrange\nendcmap\n`;
  const pag = zlib.deflateSync(Buffer.from(conteudo, 'latin1'));
  const cm = zlib.deflateSync(Buffer.from(cmap, 'latin1'));
  const partes = [
    Buffer.from('%PDF-1.3\n%\xff\xff\xff\xff\n', 'latin1'),
    Buffer.from('1 0 obj\n<< /Type /Pages /Count 1 /Kids [4 0 R] >>\nendobj\n'),
    Buffer.from('2 0 obj\n<< /Type /Catalog /Pages 1 0 R >>\nendobj\n'),
    Buffer.from(`3 0 obj\n<< /Length ${pag.length} /Filter /FlateDecode >>\nstream\n`), pag, Buffer.from('\nendstream\nendobj\n'),
    Buffer.from('4 0 obj\n<< /Type /Page /Parent 1 0 R /MediaBox [0 0 595.28 841.89] /Contents 3 0 R /Resources 5 0 R >>\nendobj\n'),
    Buffer.from('5 0 obj\n<< /ProcSet [/PDF /Text] /Font << /F2 6 0 R >> >>\nendobj\n'),
    Buffer.from('6 0 obj\n<< /Type /Font /Subtype /Type0 /BaseFont /AZZZZZ+Lato-Regular /Encoding /Identity-H /DescendantFonts [8 0 R] /ToUnicode 7 0 R >>\nendobj\n'),
    Buffer.from(`7 0 obj\n<< /Length ${cm.length} /Filter /FlateDecode >>\nstream\n`), cm, Buffer.from('\nendstream\nendobj\n'),
    Buffer.from('trailer\n<< /Root 2 0 R >>\n%%EOF\n')
  ];
  return Buffer.concat(partes);
}

test('lê o texto e a posição de um PDF do sistema (fonte Identity-H com ligadura)', async () => {
  const pdf = montarPdf([[38, 757.4, 'PROPOSTA TÉCNICA E COMERCIAL', 11.5], [86, 564.9, '- verticais laterais (solicitado P3)']]);
  const runs = await textoDoPdf(pdf);
  assert.deepEqual(runs.map(r => r.t), ['PROPOSTA TÉCNICA E COMERCIAL', '- verticais laterais (solicitado P3)']);
  assert.equal(Math.round(runs[0].x), 38);
  assert.equal(Math.round(runs[0].y * 10) / 10, 757.4); // o cm invertido duas vezes volta às coordenadas do PDF
  assert.equal(runs[0].tam, 11.5);
  await assert.rejects(textoDoPdf(Buffer.from('PK\x03\x04 isto é um zip')), /não é um PDF/);
});

// Posições como saem do PDF da proposta (A4, pontos; dados de cliente trocados)
const R = (pag, x, y, t, tam = 7) => ({ pag, x, y, t, tam });
const RUNS = [
  R(1, 38, 757.4, 'PROPOSTA TÉCNICA E COMERCIAL', 11.5), R(1, 508.9, 756.9, '34000-1', 13),
  R(1, 53, 743.7, 'Nome do evento:'), R(1, 112, 740.5, 'Congresso Exemplo 2026', 10),
  R(1, 72.1, 728.2, 'Solicitante:'), R(1, 112, 727.4, 'Fulano', 9), R(1, 425, 728.2, 'Empresa:'), R(1, 460, 727.4, 'Agência Exemplo', 9),
  R(1, 88.5, 705.7, 'Local:'), R(1, 112, 704.5, 'Centro de Convenções', 8), R(1, 429.9, 705.7, 'Cidade:'), R(1, 460, 705.3, 'São Paulo', 8),
  R(1, 71, 680.5, 'Montagem:'), R(1, 112, 680.1, '28/10/2026 a 29/10/2026', 8), R(1, 420.2, 680.5, 'Criada em:'), R(1, 460, 680.1, '08/10/2026', 8),
  R(1, 82.8, 669.5, 'Evento:'), R(1, 112, 669.1, '30/10/2026 a 01/11/2026', 8),
  R(1, 216, 631, 'DESCRIÇÃO DE EQUIPAMENTOS', 9),
  R(1, 155.8, 617.7, 'AUDITÓRIO PRINCIPAL · 30/10/2026 – 01/11/2026', 8.5),
  R(1, 50.9, 606, 'Qtd'), R(1, 202.1, 605.6, 'Vídeo', 8), R(1, 391.6, 606, 'Unitário'), R(1, 539.8, 606, 'Total'),
  R(1, 52.9, 589.9, '21'), R(1, 86, 594.1, 'Painel de LED Absen Indoor P2.9 mm - m² — 6 x 3,5 m · 2.016 x 1.176 px - '),
  R(1, 86, 585.7, 'horizontal central (solicitado P3)'), R(1, 384.9, 589.9, 'R$ 650,00'), R(1, 448, 590.1, '1 diária', 6.5), R(1, 513, 589.9, 'R$ 13.650,00'),
  R(1, 52.9, 569.1, '20'), R(1, 86, 573.3, 'Painel de LED Absen Indoor P2.9 mm - m² — 2,5 x 4 m · 840 x 1.344 px (02 painéis) '),
  R(1, 86, 564.9, '- verticais laterais (solicitado P3)'), R(1, 513, 569.1, 'R$ 13.000,00'),
  R(1, 55, 527.5, '2'), R(1, 86, 531.7, 'Processadora de vídeo - NovaStar H5 Vídeo Wall Splicer - 1 principal + 1 backup '), R(1, 86, 523.3, 'redundante'),
  R(1, 55, 486.1, '4'), R(1, 86, 486.1, 'TV Smart 4K 50" - com suporte de parede'),
  R(1, 50.9, 474.1, 'Qtd'), R(1, 201.9, 473.7, 'Iluminação', 8),
  R(1, 55, 450, '8'), R(1, 86, 454.2, 'Refletor Fresnel LED com bandoor (branco frio e branco quente) - 200 W - '), R(1, 86, 445.8, '(no lugar do COB LED)'),
  R(1, 281, 9, 'Página 1/2'),
  R(2, 155.8, 760, 'PRAÇA DE ALIMENTAÇÃO - SHOW · 31/10/2026', 8.5),
  R(2, 50.9, 748, 'Qtd'), R(2, 202.1, 747.6, 'Vídeo', 8),
  R(2, 52.9, 735, '21'), R(2, 86, 735, 'Painel de LED Absen Indoor P2.9 mm - m² — 6 x 3,5 m · 2.016 x 1.176 px')
];

test('PDF da proposta vira lista: cabeçalho, datas, salas e só os painéis de LED', () => {
  const r = interpretarOS(abasDoPdf(RUNS), catalogoInicial(), { nome: '34000-1 - Agência Exemplo - Congresso - 28-10 á 01-11-2026.pdf' });
  assert.equal(r.os, '34000-1');
  assert.equal(r.evento, 'Congresso Exemplo 2026');
  assert.equal(r.cliente, 'Agência Exemplo');
  assert.equal(r.local, 'Centro de Convenções');
  assert.equal(r.cidade, 'São Paulo');
  assert.equal(r.ida, '2026-10-27');   // véspera da montagem (28/10)
  assert.equal(r.volta, '2026-11-02'); // dia seguinte ao último dia (01/11)
  assert.deepEqual(r.telas.map(t => [t.nome, t.painel, t.largura_m, t.altura_m]), [
    ['Auditório Principal · Horizontal central', 'led-v10', 6, 3.5],     // P2.9 — o "(solicitado P3)" não manda
    ['Auditório Principal · Verticais laterais 1', 'led-v10', 2.5, 4],   // 20 m² "(02 painéis)" = 2 telas
    ['Auditório Principal · Verticais laterais 2', 'led-v10', 2.5, 4],
    ['Praça de Alimentação - Show', 'led-v10', 6, 3.5]
  ]);
  assert.deepEqual(r.outros.map(o => o.texto), ['Processadora de vídeo - NovaStar H5 Vídeo Wall Splicer - 1 principal + 1 backup redundante']);
});

test('quantas telas: escrito na OS, por m² no formato novo, por unidade no antigo', () => {
  assert.equal(quantasTelas('Painel … - m² — 3,5 x 2 m · 1.176 x 672 px (03 painéis)', 21, { largura_m: 3.5, altura_m: 2 }), 3);
  assert.equal(quantasTelas('Painel de LED - m² — 2,5 x 4 m', 20, { largura_m: 2.5, altura_m: 4 }), 2);
  assert.equal(quantasTelas('Painel de LED Absen Indoor P2.9 mm - 15m x 2m', 30, { largura_m: 15, altura_m: 2 }), 1);
  assert.equal(quantasTelas('Totens de LED P1 1m x 2m', 6, { largura_m: 1, altura_m: 2 }), 6); // formato antigo: 6 totens
});
