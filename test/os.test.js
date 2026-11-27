// Importar OS: só painel de LED entra; iluminação, áudio, equipe e acessórios ficam de fora.
// Todas as linhas abaixo são descrições reais de OS da Projetech (com a seção em que apareciam).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ehPainel, adivinharPainel, datasDoTexto } from '../js/os.js';
import { catalogoInicial } from '../js/seed.js';

const PAINEL = [
  ['Painel de LED - P2 de 17m x 4m (0,50m x0,50m)', 'Painel de LED'],
  ['Painel de LED indoor P3 Absen - para Fundo de palco na medida total de 8m x 4,5m', 'Vídeo'],
  ['Painel de LED Absen Indoor P2.9 mm - 15m x 2m', 'Vídeo'],
  ['Painel LED Absen P2 2,9mm medindo 6m x 3m (18m²)', 'Vídeo'],
  ['Painel em LED P2 medindo 10m x 3m (30m² cada)', 'Vídeo'],
  ['Paineis de LED P2 de 7m x 4m (0,50m x 0,50m)', 'Vídeo'],
  ['Painel de P3 indoor na medida de ( 4m x 3m)', 'LED'],                 // sem a palavra LED, mas a seção é de LED
  ['Totem de LED 1m x 2m', 'Vídeo'],
  ['Toten digital de led na medida de ( 0,5m x 2m) + com interface Taurus (agenda)', 'Descrição'],
  ['Balcão digital em LED P2 inddor na medida de 2x1 + notebook resolume', 'Balcão digital'],
  ['Balcão de LED na medida de ( 4,00m x 1,00m) Frontal + Tampa', 'Credenciamento'],
  ['Portico de LED 2m x 2,50m A x 2m P + Sistema de gerenciamento', 'Vídeo'],
  ['Testeira frontal de pailnel de led - P2 6m L x 0,5m A', 'Pórtico'],
  ['Colunas laterais de painel de led - P2 0,5m L x 3m A', 'Pórtico'],
  ['Cubo de LED nas medidas de 0,5m x 0,5m - 4 cubos de altura (2m)', 'Cubos de Led'],
  ['Túnel de LED construído nas medidas de 6m P x 3m L', 'Led'],
  ['Piso de LED painel de LED - P3 com proteção de vidro', 'Led'],
  ['Tira de LED 2,5m alt x 0,5m larg', 'LED'],
  ['Tela de LED P2.9 de 5m x 3m', ''],
  ['Backdrop de LED P2 6m x 3m', 'Cenografia']                         // painel de LED dentro da cenografia continua sendo nosso
];

const NAO = [
  ['Refletor Fresnel LED com bandoor (branco frio e branco quente) - 200 W', 'Iluminação'],
  ['Fresnel em LED 200w com bandoor - iluminação de palco central', 'Iluminação'],
  ['Spot par LED de 18w para ambientação', 'Iluminação'],
  ['Strobo LED', 'Iluminação'],
  ['Ribalta LED 18w RGBW - para iluminação KV fundo de palco', 'Iluminação'],
  ['Moving head wash LED - 19 x 15 w', 'Iluminação'],
  ['Soft box de LED', 'Iluminação'],
  ['Ribaltas para iluminar o painel', 'Recepção'],
  ['LED up lights PAR RGBWA / ambiance lighting', 'Audio'],
  ['Técnico de LED', 'Equipe Técnica'],
  ['Técnico de painel de LED full time', 'Descrição'],
  ['Montadores de LED', 'Descrição'],
  ['Rack para painel de LED', 'Painel de LED'],
  ['Rack digital de energia estabilizada - 220v/380v - 60kva para energizar painel de LED', 'Vídeo'],
  ['Mão francesa + berço de sutentação para painel de led', 'Berço'],
  ['Estrutura autoportante metálica para sutentação do painel de led', 'Estrutura prévia'],
  ['Tapadeiras para painel', 'Cenografia'],
  ['Tapadeiras laterais para o painel de led', 'Cenografia prévia'],
  ['Painel em box truss para recepção com 3m x 2m + lona impressa', 'Recepção'],
  ['Painel cenográfico de fotos em box truss 3m x 2m com lona impressa de 3m x 2m', 'Cenografia'],
  ['Painel de lona impressa 4m x 2m', 'Cenografia'],
  ['Switcher 4K Magnimage LED-780H', 'Vídeo'],
  ['Elevação do painel de LED Abssen 2.9 nas medidas de 6m x 3m', 'Vídeo'],
  ['Linha de LED em contorno ao palco e escada', 'Cenografia'],
  ['Fita de LED RGB para o balcão', 'Cenografia'],
  ['Totem touch screen bem vindos e agenda', 'Recepção'],
  ['TV Smart 4K 65" de delay no pedestal', 'Vídeo'],
  ['Painel de LED do Local', 'Vídeo']
];

test('reconhece todas as formas de painel de LED das OS', () => {
  for (const [txt, sec] of PAINEL) assert.equal(ehPainel(txt, sec), true, `deveria ser painel: "${txt}" (${sec})`);
});

test('deixa de fora iluminação, áudio, equipe, estrutura, cenografia e acessórios', () => {
  for (const [txt, sec] of NAO) assert.equal(ehPainel(txt, sec), false, `não é painel: "${txt}" (${sec})`);
});

test('qual case do catálogo: P1 → P1.9, P2 → V10, P3 → P3.9; P1.5 não existe na casa', () => {
  const cat = catalogoInicial();
  assert.equal(adivinharPainel('Painel de LED - P2 de 17m x 4m', cat), 'led-v10');
  assert.equal(adivinharPainel('Painel de LED indoor P3 Absen', cat), 'led-p39-l1');
  assert.equal(adivinharPainel('Painel de LED indoor P2 Absen (Quina) - Pórtico', cat), 'led-v10-q1');
  assert.equal(adivinharPainel('Painel de LED P2 em curva', cat), 'led-nt-flex');
  assert.equal(adivinharPainel('Totem de Painel de LED P1', cat), 'led-p19');           // na casa "P1" é o P1.9
  assert.equal(adivinharPainel('Totem de LED Absen P1.9 mm com player Taurus integrado', cat), 'led-p19');
  assert.equal(adivinharPainel('Painel de LED Absen Indoor QUINA P1.9 mm - 9 x 3 m', cat), 'led-p19-q');
  assert.equal(adivinharPainel('Painel de LED Absen P1.5 - 4 x 2 m', cat), null);            // P1.5 a casa não tem
});

test('datas da OS em vários formatos', () => {
  assert.deepEqual(datasDoTexto('05 e 06/08/2026').sort(), ['2026-08-05', '2026-08-06']);
  assert.deepEqual(datasDoTexto('12 de Agosto de 2024'), ['2024-08-12']);
});

const osFalsa = cab => [{ nome: 'Proposta', linhas: [
  ...cab.map(([a, b]) => ({ c: { A: a, B: b } })),
  { c: { A: 'Descrição de equipamentos' } },
  { c: { A: 'Quantidade', B: 'Vídeo' } },
  { c: { A: '1', B: 'Painel de LED P2.9 de 6m x 3m' } }
] }];

test('ida = véspera da montagem; volta = dia seguinte ao último dia (o horário não muda nada)', async () => {
  const { interpretarOS } = await import('../js/os.js');
  const r = interpretarOS(osFalsa([
    ['Montagem:', '14/10/2026 às 20h00'],
    ['Evento:', '15 e 16/10/2026'],
    ['Desmontagem:', '16/10/2026 - 22h00']
  ]), catalogoInicial());
  assert.equal(r.montagem, '2026-10-14');
  assert.equal(r.fim, '2026-10-16');
  assert.equal(r.ida, '2026-10-13');
  assert.equal(r.volta, '2026-10-17');
  assert.equal(r.telas.length, 1);
});

test('datas da OS virando o mês e sem linha de montagem', async () => {
  const { interpretarOS, somaDias } = await import('../js/os.js');
  assert.equal(somaDias('2026-11-01', -1), '2026-10-31');
  assert.equal(somaDias('2026-12-31', 1), '2027-01-01');
  const r = interpretarOS(osFalsa([['Data do evento:', '01/11/2026']]), catalogoInicial());
  assert.equal(r.ida, '2026-10-31');
  assert.equal(r.volta, '2026-11-02');
});

test('OS com data sem ano pega o ano das outras datas (inclusive da data serial do Excel)', async () => {
  const { interpretarOS } = await import('../js/os.js');
  // Sanofi 34278: "Montagem: 46240" (= 06/08/2026) e o evento escrito sem ano
  const r = interpretarOS(osFalsa([
    ['Data Evento:', '07/08 das 17h00 ás 23h00 e dia 08/08 das 8h00 ás 14h00'],
    ['Montagem:', '46240']
  ]), catalogoInicial());
  assert.equal(r.montagem, '2026-08-06');
  assert.equal(r.fim, '2026-08-08');
  assert.equal(r.ida, '2026-08-05');
  assert.equal(r.volta, '2026-08-09');
  // "Data da Montagem" conta como montagem; sem nenhum ano na OS vale o ano mais perto de hoje
  const v = interpretarOS(osFalsa([['Data da Montagem:', '30/12 - 20h00'], ['Data do Evento:', '02/01']]), catalogoInicial(), { hoje: '2026-12-10' });
  assert.equal(v.ida, '2026-12-29');
  assert.equal(v.volta, '2027-01-03');
  assert.deepEqual(datasDoTexto('25 e 27/08', '2026-08-01'), ['2026-08-27', '2026-08-25']);
  assert.deepEqual(datasDoTexto('16/10/26'), ['2026-10-16']);
});

test('formatos de data das OS de 2025: ponto, traço, "A", mês por extenso e carga', () => {
  const ord = a => a.slice().sort();
  assert.deepEqual(ord(datasDoTexto('Montagem 25.07.2025')), ['2025-07-25']);
  assert.deepEqual(ord(datasDoTexto('Evento: 17 A 20.02.2025')), ['2025-02-17', '2025-02-20']);
  assert.deepEqual(ord(datasDoTexto('Evento: 14 e 15.11.2025')), ['2025-11-14', '2025-11-15']);
  assert.deepEqual(ord(datasDoTexto('Data Evento: 26 e 27-03-18 as 08h00')), ['2018-03-26', '2018-03-27']);
  assert.deepEqual(ord(datasDoTexto('Montagem 22.02 | ensaio 23.02', '2025-02-24')), ['2025-02-22', '2025-02-23']);
  assert.deepEqual(ord(datasDoTexto('04 de Maio das 20h as 00h e 05 Maio 2018', '2018-05-03')), ['2018-05-04', '2018-05-05']);
  assert.deepEqual(ord(datasDoTexto('Projetor de 12.000 ansilumes, lente 1.19 - 1.63, das 8.30h')), []); // números que não são data
  // Galderma 34263: o "30" de "13h30" não é dia 30
  assert.deepEqual(ord(datasDoTexto('04/08/2026 - 13h30 as 18h00 / 05/08 - 09h00 as 13h30 e 06/08/2026 - 08h00 as 18h00', '2026-08-04')),
    ['2026-08-04', '2026-08-05', '2026-08-06']);
  // Biolab: "13/03 a 16/03/2026" — o "03" do primeiro não é dia 3
  assert.deepEqual(ord(datasDoTexto('Montagem: 13/03 a 16/03/2026', '2026-03-16')), ['2026-03-13', '2026-03-16']);
});

test('ano digitado errado na OS não estica a ida/volta; "primeira carga" conta como saída', async () => {
  const { interpretarOS } = await import('../js/os.js');
  // Align: montagem e ensaio em janeiro, evento "14 a 16.08.2025" (era 01) — o arquivo diz janeiro
  const a = interpretarOS(osFalsa([['Montagem:', '12.01.2025'], ['Ensaio:', '13.01.2025'], ['Evento:', '14 a 16.08.2025']]), catalogoInicial(),
    { nome: 'OS v8 - 27071 - Align - Convenção 2024 - 12 a 17.01.2025.xlsx' });
  assert.equal(a.ida, '2025-01-11');
  assert.equal(a.volta, '2025-01-18'); // o nome do arquivo diz até 17/01
  assert.deepEqual(a.datas_ignoradas.sort(), ['2025-08-14', '2025-08-16']);
  // Amgen 27512: "24.02 a 27.02.2024" numa OS de 2025 (outra linha e o arquivo dizem 2025) → corrigido para 2025
  const b = interpretarOS(osFalsa([['Montagem', '22.02'], ['Data do evento', '24.02 a 27.02.2024'], ['Montagem: 22.02 // Ensaio: 23.02 as 14h00 // Evento 24.02 e 27.02.2025', '']]), catalogoInicial(),
    { nome: 'OS v6 - 27512 - Amgen - Convenção 2025 - 23 a 27.02.2025.xlsx' });
  assert.equal(b.ida, '2025-02-21');
  assert.equal(b.volta, '2025-02-28');
  // Sanofi 32473: montagem e evento em julho na OS, arquivo diz agosto → vale a OS
  const s = interpretarOS(osFalsa([['Data Evento:', '31/07'], ['Montagem:', '46233']]), catalogoInicial(),
    { nome: 'OS 32473-5 - Sanofi Type - Access - São Paulo - 31-08-2026.xlsx' });
  assert.equal(s.ida, '2026-07-29');
  assert.equal(s.volta, '2026-08-01');
  // Projeção mapeada 31806: o NOME do arquivo diz 2026 por engano; as datas da OS concordam entre si → vale a OS
  const p = interpretarOS(osFalsa([['Montagem:', '46003'], ['Evento:', '12/12/2025 á 01/01/2026']]), catalogoInicial(),
    { nome: 'OS 31806-1 - Projeção mapeada POÁ-SP -012 á 24-12-26.xlsx' });
  assert.equal(p.ida, '2025-12-11'); // 46003 = 12/12/2025
  assert.equal(p.volta, '2026-01-02');
  const d = interpretarOS(osFalsa([['Data:', '29/06/2017 - 20h00 as 23h00'], ['Montagem:', 'No mesmo dia do Evento - em horário a definir']]), catalogoInicial());
  assert.equal(d.ida, '2017-06-28');
  assert.equal(d.volta, '2017-06-30');
  const c = interpretarOS(osFalsa([['Primeira Carga 29.05 - Somente equipamentos das salas menores', ''], ['Evento:', '30 e 31.05.2025']]), catalogoInicial());
  assert.equal(c.ida, '2025-05-28');
  assert.equal(c.volta, '2025-06-01');
});

test('pitch que a casa não tem (P1.5) fica sem painel — nunca vira o primeiro case do catálogo (P3.9); P1 vira P1.9', async () => {
  const { interpretarOS } = await import('../js/os.js');
  const r = interpretarOS([{ nome: 'Proposta', linhas: [
    { c: { A: 'Montagem:', B: '12/10/2026' } }, { c: { A: 'Evento:', B: '13 e 14/10/2026' } },
    { c: { A: 'Descrição de equipamentos' } },
    { c: { A: 'BALLROOM 01 E 04 - Obs: Itens já duplicados · 13/10/2026' } },
    { c: { A: 'Quantidade', B: 'Painel de LED' } },
    { c: { A: '2', B: 'Painel de LED - P2 de 7m x 4m (0,50m x0,50m)' } },
    { c: { A: 'OUTROS' } },
    { c: { A: 'Quantidade', B: 'Painel de LED' } },
    { c: { A: '6', B: 'Totem de Painel de LED P1 na medida de 1,00 x 2,00 m' } },
    { c: { A: '1', B: 'Totem de LED Absen P1.5 1 x 2 m' } }
  ] }], catalogoInicial());
  assert.deepEqual(r.telas.map(t => [t.nome, t.painel, t.pitch_os]), [
    ['Ballroom 01 e 04 1', 'led-v10', null], ['Ballroom 01 e 04 2', 'led-v10', null],
    ...Array.from({ length: 6 }, (_, i) => ['Outros ' + (i + 1), 'led-p19', null]),
    ['Outros 7', null, 'P1.5']
  ]);
});

test('cada painel sabe a sala e o nome curto (para a sublista da sala)', async () => {
  const { interpretarOS } = await import('../js/os.js');
  const r = interpretarOS([{ nome: 'Proposta', linhas: [
    { c: { A: 'Descrição de equipamentos' } },
    { c: { A: 'AUDITÓRIO FACE (PRINCIPAL) · 30/10/2026 – 01/11/2026' } }, { c: { A: 'Quantidade', B: 'Vídeo' } },
    { c: { A: '21', B: 'Painel de LED Absen Indoor P2.9 mm - m² — 6 x 3,5 m · 2.016 x 1.176 px - horizontal central' } },
    { c: { A: '20', B: 'Painel de LED Absen Indoor P2.9 mm - m² — 2,5 x 4 m · 840 x 1.344 px (02 painéis) - verticais laterais' } },
    { c: { A: 'FOYER · 30/10/2026' } }, { c: { A: 'Quantidade', B: 'Vídeo' } },
    { c: { A: '3', B: 'Totem de LED P2 1m x 2m' } }
  ] }], catalogoInicial());
  assert.deepEqual(r.telas.map(t => [t.sala, t.nome_curto]), [
    ['Auditório Face (Principal)', 'Horizontal central'], ['Auditório Face (Principal)', 'Verticais laterais 1'], ['Auditório Face (Principal)', 'Verticais laterais 2'],
    ['Foyer', 'Totem 1'], ['Foyer', 'Totem 2'], ['Foyer', 'Totem 3']
  ]);
});

test('OS padrão novo (TMA 34568): todas as abas confirmadas entram; "3 × painel m² 5 x 3,5" são 3 painéis', async () => {
  const { interpretarOS } = await import('../js/os.js');
  const cab = [
    { c: { A: 'Proposta de Orçamento', D: '34568-16' } }, { c: { A: 'Nome do evento:', B: 'TMA Brasil - XVIII Congresso' } },
    { c: { A: 'Solicitante:', B: 'Fulana', C: 'Empresa:', D: 'TMA' } }, { c: { A: 'Local:', B: 'Grand Hyatt São Paulo', C: 'Cidade:', D: 'São Paulo' } },
    { c: { A: 'Montagem:', B: '01/11/2026 a 02/11/2026' } }, { c: { A: 'Ensaio:', B: '03/11/2026' } }, { c: { A: 'Evento:', B: '04/11/2026' } },
    { c: { A: 'Observação:' } }, { c: { A: 'Descrição de Equipamentos' } }
  ];
  const r = interpretarOS([
    { nome: 'Colméia + DNA Opção confirmada', linhas: [...cab,
      { c: { A: 'Plenária' } }, { c: { A: 'Quantidade', B: 'Vídeo' } },
      { c: { A: '116', B: 'Painel de LED Absen Indoor P2.9 mm - 29 x 4 m' } },
      { c: { A: 'Almoço VIP - 04 salas' } }, { c: { A: 'Quantidade', B: 'Vídeo' } },
      { c: { A: '3', B: 'Painel de LED Absen Indoor P2.9 mm - m² — 5 x 3,5 m · 1680 x 1176 px' } },
      { c: { A: '1', B: 'Painel de LED Absen Indoor P2.9 mm - m² — 4 x 2,5 m · 1344 x 840 px' } }] },
    { nome: 'Extras - Foyer e Café', linhas: [...cab,
      { c: { A: 'Painel ao lado da escada' } }, { c: { A: 'Quantidade', B: 'Vídeo' } },
      { c: { A: '17.5', B: 'Painel de LED Absen Indoor P1.9 mm - m² — 6 x 2,5 m · 3.072 x 1.280 px' } },
      { c: { A: '2.5', B: 'Painel de LED Absen Indoor QUINA P1.9 mm - 1 x 2,5 m' } }] }
  ], catalogoInicial());
  assert.equal(r.os, '34568-16');
  assert.equal(r.ida, '2026-10-31');
  assert.equal(r.volta, '2026-11-05');
  assert.deepEqual(r.abas, ['Colméia + DNA Opção confirmada', 'Extras - Foyer e Café']);
  assert.deepEqual(r.telas.map(t => [t.sala, t.nome_curto, t.largura_m, t.altura_m, t.painel, t.pitch_os]), [
    ['Plenária', 'Painel', 29, 4, 'led-v10', null],
    ['Almoço VIP - 04 salas', 'Painel 1', 5, 3.5, 'led-v10', null], ['Almoço VIP - 04 salas', 'Painel 2', 5, 3.5, 'led-v10', null],
    ['Almoço VIP - 04 salas', 'Painel 3', 5, 3.5, 'led-v10', null], ['Almoço VIP - 04 salas', 'Painel 4', 4, 2.5, 'led-v10', null],
    ['Painel ao lado da escada', 'Painel 1', 6, 2.5, 'led-p19', null], ['Painel ao lado da escada', 'Painel 2', 1, 2.5, 'led-p19-q', null]
  ]);
});

test('abas: alternativas ("Opção 01 | Opção 02") só a confirmada ou a primeira; complementares todas; repetida uma vez', async () => {
  const { abasDaOS } = await import('../js/os.js');
  const aba = (nome, itens = 4) => ({ nome, linhas: [{ c: { A: 'Descrição de equipamentos' } }, ...Array.from({ length: itens }, (_, i) => ({ c: { A: String(i + 1), B: 'Item ' + nome + i } }))] });
  const nomes = abas => abasDaOS(abas).map(a => a.nome);
  assert.deepEqual(nomes([aba('Colméia + DNA Opção confirmada'), aba('Extras - Foyer e Café')]), ['Colméia + DNA Opção confirmada', 'Extras - Foyer e Café']);
  assert.deepEqual(nomes([aba('Opção 01'), aba('Opção 02')]), ['Opção 01']);
  assert.deepEqual(nomes([aba('Opção 1'), aba('Opção 2 - aprovada'), aba('Extras')]), ['Opção 2 - aprovada', 'Extras']);
  assert.deepEqual(nomes([aba('1 dia'), aba('30 dias')]), ['1 dia']);
  assert.deepEqual(nomes([aba('Plenária'), aba('Salas de WKS'), { nome: 'logo', linhas: [] }]), ['Plenária', 'Salas de WKS']);
  const rep = aba('Extras - A&C - RX');
  assert.deepEqual(nomes([rep, { ...rep }]), ['Extras - A&C - RX']);
  assert.deepEqual(abasDaOS([aba('Opção 01'), aba('Opção 02')], ['Opção 02']).map(a => a.nome), ['Opção 02']); // escolha à mão manda
});

test('palco na OS: "sobre o palco de 0,60 m" já vem marcado na importação', async () => {
  const { palcoDoTexto } = await import('../js/os.js');
  assert.deepEqual(palcoDoTexto('Painel de LED P2.9 6 x 3,5 m sobre palco de 0,60 m'), { altura_m: 0.6 });
  assert.deepEqual(palcoDoTexto('Painel em cima do palco 80cm'), { altura_m: 0.8 });
  assert.deepEqual(palcoDoTexto('Painel de LED sobre o palco'), { altura_m: null });
  assert.equal(palcoDoTexto('Painel de LED Absen Indoor P2.9 mm - 15m x 2m'), null);
  assert.equal(palcoDoTexto('Painel de LED para fundo de palco 8 x 4 m'), null);   // "fundo de palco" não é "sobre o palco"
});
