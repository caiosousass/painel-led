# Projetech · Painel de LED

Sistema do setor de painel de LED: **listas de separação** que se montam sozinhas a partir do painel e
da medida, **checklist de separação** no celular, **conferência do retorno** (o que falta sai do
inventário), **estoque por data**, **manutenção** e **bancada** (o que foi feito no galpão) — com um
**painel de supervisão** para acompanhar tudo de longe.

HTML/CSS/JS puro, sem build. Funciona no celular, instala como app e **funciona sem sinal** (no galpão o
sinal cai e a separação não pode parar).

## Como abrir

Dois cliques em **`Abrir Painel de LED.bat`** (na pasta `pixel-map`) → abre em http://localhost:5505.

Fundo **escuro, claro ou automático** (igual ao aparelho): botão de sol/lua no topo ou em Ajustes → Aparência; vale por aparelho.

**Versão à vista** (igual ao Calculator): "Painel de LED · v32" no rodapé do menu (no celular, em *Mais*). O número
sai do `sw.js` (`painel-led-v32`) — suba ele a cada publicação. Quando sai versão nova com o app aberto, aparece
**Atualizar para vNN** no topo; abrir o app de novo já traz a nova (sem Ctrl+F5).

Sem configurar nada roda em **modo local**: os dados ficam só naquele aparelho. Serve para testar. Para a
equipe usar junto — e o administrador ver de qualquer lugar — ligue o modo online (abaixo).

## O fluxo

1. **Projeto ou lista** — pelo *Projetech Calculator*, *Novo projeto*, *Nova lista*, *Importar OS (.xlsx ou .pdf)* ou *Duplicar uma anterior* (veja "Projeto e lista: quatro portas"). Informe o painel e a medida de
   cada tela (Plenária 12 × 4 m, Foyer 3 × 2 m…). O sistema monta a lista inteira. Cada item mostra o
   **por quê** ("84 gabinetes + 5% = 88,2 → 90"). Mudou a quantidade? Ela fica **fixa** e o recálculo não
   mexe mais. Tirou um item? Ele não volta sozinho.
   - **Importar OS** (.xlsx ou o PDF da proposta — o PDF é lido no próprio navegador, sem biblioteca): só entram as linhas de painel de LED (iluminação, áudio, estrutura e acessórios ficam de
     fora). A **ida** fica **1 dia antes** da montagem e a **volta 1 dia depois** do último dia do evento — o
     material sai na véspera e chega no dia seguinte, e o estoque fica reservado com folga. O horário da OS
     não mexe nisso; dá para mudar as datas na hora de importar. Data sem ano ("31/07") pega o ano das
     outras datas da OS.
   - **Evento com várias salas (sublistas)**: hotel grande ou mais de um hotel → **uma lista por sala**, todas
     no mesmo evento. Cada sala é separada, conferida, carregada e volta à parte (romaneio com "SALA" em
     destaque). Ao importar uma OS com mais de uma sala, o padrão é "Uma lista por sala". A tela do **evento**
     mostra o andamento de cada sala, o **total do evento** por item (o que sai do galpão), imprime todas as
     salas (uma por página) e exporta o projeto do evento inteiro num PDF. Numa sala: *Mover telas para outra
     sala*, *Nova sala neste evento*; numa lista solta: *Dividir em salas*. OS, nome e cliente mudam em todas
     as salas; datas e local podem ser diferentes por sala (o app pergunta). Itens "por lista" (ferramentas,
     fita, cinta, rack 5…) vão para **cada sala**, porque cada uma é carregada à parte.
   - **Cartão da lista** (Listas, Início, evento): mostra as telas (painel e medida), cliente e local, um botão
     **Projeto** e o **⋯** com as ações sem precisar entrar na lista — abrir a lista ou o projeto, imprimir,
     exportar o projeto, **fixar no topo**, dividir em salas, duplicar, cancelar e excluir. As fixadas vêm
     primeiro em Listas, com o alfinete, para a equipe toda (um evento sobe se alguma sala dele estiver fixada).
   - **Estrutura e palco (a mesma regra do Projetech Calculator)**: em cada tela no chão, marque se o painel
     está **em cima do palco** (altura, fundo e se a mão francesa apoia no palco ou sai do chão, atrás dele).
     Já dá para escolher ao **importar a OS**: *No chão*, *Sobre o palco · mão francesa no chão* ou *Sobre o palco ·
     mão francesa no palco*, com a altura do palco (se a OS diz "sobre palco de 0,60 m", já vem marcado).
     A mão francesa empilha 1,92 / 1,44 / 0,96 até o mais perto do topo sem passar; fileiras nas emendas, de
     1,5 em 1,5 m e nas pontas; **1 peso por metro** de altura por fileira; a partir de **4,5 m** a 1,92 da
     base vai em **segunda linha** (dobrada para trás).
   - **Ver em 3D**: o visor do Calculator (`vendor/ar.js`) mostra a tela com as placas, o palco, a mão
     francesa, os pesos, uma pessoa de referência e o **mapa do cabeamento** pintado na frente (cada porta
     com a sua cor). Vistas de frente, trás, lado e topo, medidas e AR no iPhone.
   - **Costuma ir e não está aqui**: compara com as listas antigas do mesmo painel.
   - **Falta no estoque**: cruza com as outras listas nas mesmas datas e com o que está na manutenção.
2. **Liberar para separação** — o sistema avisa antes o que parece esquecido.
3. **Separação** (celular, no galpão) — um toque = separado; toque no número = parcial; ⋯ = faltou / não se
   aplica / observação; *Desfazer*. Ordem do galpão. Fechar com pendência exige justificativa.
4. **Conferência** — outra pessoa confere; fica registrado quem.
5. **Saiu para o evento.**
6. **Retorno** — ✓ voltou tudo, ou quanto voltou e quanto com avaria. Ao fechar: **o que faltou sai do
   inventário** (com botão *Apareceu* se surgir depois) e **o que voltou quebrado abre manutenção**.

Tudo o que acontece vai para o **registro de atividade** (quem, o quê, quando) que aparece no Início.

## Projeto e lista: quatro portas, o mesmo lugar

Antes: olhar a OS e a implantação → fazer a lista → fazer o projeto de AC e de sinal. Agora projeto e lista são
**o mesmo registro** (a sala e as telas dela): mexeu num, o outro já está pronto.

- **Pelo Projetech Calculator**: monte a sala lá (screen única ou Múltiplas screens, palco, mão francesa,
  cabeamento) e toque **Gerar lista no Painel de LED** (no card do projeto técnico). O Painel de LED abre com a
  sala: confere os cases (o modelo do Calculator vira o case do catálogo) e escolhe **criar uma sala nova** ou
  **atualizar** a que veio de lá antes. Os dados vão no endereço, depois do `#` — não passam por servidor.
- **Novo projeto** (em Listas): desenha a sala aqui mesmo — as telas lado a lado, na ordem da folha.
- **Nova lista**: o projeto da sala já existe — botão **Projeto da sala** na lista.
- **Importar OS**: cria a lista e o projeto de uma vez e abre o projeto (OS com várias salas: abre o evento).

## Montagem da sala (o editor, no jeito do SmartLCT da NovaStar)

No **Projeto da sala**, em cima, a sala vista de frente, em escala (zoom − / +):

1. **Painéis** — arraste as telas para o lado para posicionar (fica gravado em metros da esquerda); a ordem da
   esquerda para a direita vale para o desenho do projeto e para a divisão dos racks. Tocar numa tela mostra nome,
   largura, altura e posição; *+ Tela*, *Duplicar* e *Tirar da sala*.
2. **Sinal** — escolha o padrão do cabo de cada tela pelos desenhos (o canto onde começa e o sentido, como a NovaStar
   mostra), serpentina, "linhas inteiras" ou "enche a porta" e o limite de pixels; ou **desenhe as portas à mão**:
   toque num gabinete e passe pelos outros na ordem do cabo (tocar no meio de uma porta continua dali; num gabinete
   livre, abre uma porta nova; *Desfazer*, *Limpar*, *Voltar ao automático*). A tabela mostra os pixels de cada porta
   e avisa quando passa do limite ou quando sobra gabinete sem porta. O desenho à mão começa do que o sistema sugeriu.

3. **Energia** — os circuitos de powercon (cores e números amarelos), as **réguas** (azuis; vermelha quando passa do
   limite) e os **racks** da sala desenhados embaixo, com os fios. Toque num circuito para escolher em qual régua ele
   entra (ou numa régua nova — dá para juntar circuitos de telas diferentes), numa régua para escolher o rack (ou um
   rack novo), num rack para o tipo (5, 9 ou 12 saídas) ou para tirá-lo. O sistema sugere; na primeira mudança a
   sugestão vira a montagem da sala. Circuito sem régua e régua sem rack o sistema completa sozinho; *Voltar ao
   automático* desfaz tudo.
4. **Processamento** — embaixo do chão, as **controladoras** (cada porta ligada na sua, com saídas usadas e pixels;
   vermelha quando passa) e a **processadora**. Toque numa porta para escolher a controladora (ou uma nova: MCTRL660,
   Taurus TB60 ou TB1) e a saída (ocupada troca de lugar), numa controladora para o tipo ou para tirá-la, e dê o nome
   da processadora. No automático cada tela enche as controladoras dela até as saídas ou os pixels acabarem (12 portas
   de 592 mil px → 3 por MCTRL660). A folha de Sinal desenha uma caixa por controladora com as portas dela.

Cada mudança grava a sala: o projeto (PDF) e a lista (cabos de 20 m, powercon 10 m, réguas, racks, camlocks,
controladoras) acompanham.

## Projeto técnico (AC e sinal) — no modelo da Projetech (Syngenta, OS 32465)

O projeto técnico de cabeamento sai **daqui** (Projeto da sala → *Exportar PDF*; no evento, *Projeto do evento*).
A sala inteira numa folha 16:9, com o nome da sala, as telas e as medidas no alto e o carimbo da Projetech (nome do
projeto, local, tipo de projeto, engenheiro(a) responsável, data, escala, OS, cliente e número da folha).

- **Cabeamento de AC** — cada circuito de powercon com a sua cor e o caminho do cabo (início verde, fim
  vermelho); os circuitos descem (cabo **fino**) até a ponta azul da **prolonga Steck** da régua e as prolongas
  descem (cabo **grosso**) até uma **tomada do rack de energia** da sala (as réguas da sala inteira repartidas
  nos racks). O rack é o do padrão da Projetech: caixa escura, painel cinza, tomadas Steck com disjuntor e LED,
  pés. Quem vem da esquerda entra pela coluna da esquerda, da direita pela da direita, e de cima pelo meio — os
  cabos não se cruzam.
- **Cabeamento de Sinal** — cada porta com a sua cor e a etiqueta Novastar (C · P · RV · A · WH) em cada
  gabinete; as portas de cada tela descem até a **controladora** dela (MCTRL660: 4 portas e 2,3 milhões de
  pixels; ou Taurus TB60 / TB1) e as controladoras até a **processadora** da sala (Novastar H2, H5, H9 ou H15,
  escolhida em *Energia e processamento da sala*). Com a série H, a tela pode usar um **extensor de fibra** no
  lugar da controladora: **CVT10** (10 portas) ou **CVT4K-S** (16 portas) — o cabo até a H sai preto e mais
  grosso, escrito "fibra". Cada aparelho é desenhado pela frente real dele (MCTRL660, TB60, TB1, CVT10, CVT4K-S
  e a frente da série H, na altura de cada modelo), no mesmo traço do rack.
  As bolinhas levam a **ordem do cabo**: verde onde o cabo entra (1, 2…) e, com **redundância** (Cabo de dados:
  2 por porta), a vermelha do fim da corrente vira **1B, 2B…** (onde entra o cabo reserva). No AC, a verde leva
  o número do circuito. A etiqueta fica em cima à esquerda do gabinete e o cabo corre no canto de baixo à direita
  (nada passa por cima das letras). O que cada letra quer dizer:
  **C** = qual controladora da sala (MCTRL660 1, 2…) · **P** = a saída dessa controladora onde o cabo liga ·
  **RV** = a receptora: a posição do gabinete na corrente (RV-1 é o primeiro) · **A** = ângulo (rotação) ·
  **WH** = largura × altura do gabinete em pixels. Embaixo de cada controladora: "P1–P4: Central cabos 5–8".
- Sala pequena (1 tela, 1 régua): uma folha só, **AC e Sinal**, como o Foyer — embaixo do painel, a prolonga e o
  rack na metade da esquerda e a controladora → processadora (desenhadas) na da direita. Dá para pedir sempre
  separadas ou sempre juntas em *Energia e processamento da sala*.
- **Prancha editável** (na prévia das *Folhas do PDF*; tudo vem no padrão e o que você muda fica gravado na sala
  e vale no PDF):
  - **arrastar** telas, racks, controladoras/CVT e a processadora — os cabos se refazem sozinhos;
  - **ligar um cabo**: arraste a bolinha verde da porta até uma controladora/CVT. Tocando na porta: trocar a
    controladora e a saída, *Toda a tela aqui* (leva todos os cabos daquela tela) ou *Desligar* (a porta fica
    **solta**, em vermelho, até você ligar de novo);
  - **aparelhos**: *Pôr: + CVT4K-S / + CVT10 / + MCTRL660…*; tocando num aparelho, trocar o tipo, desligar os
    cabos dele ou tirar. A controladora que o sistema sugeriu e ficou sem cabo some sozinha;
  - **textos**: toque no título, na descrição, no nome de uma tela ou aparelho, ou num campo do carimbo
    (projeto, local, sala, responsável, datas, cliente, agência, O.S.) e escreva por cima — vazio volta ao padrão;
  - **Desfazer / Refazer** (Ctrl+Z / Ctrl+Y ou Ctrl+Shift+Z): vale para tudo da tela do projeto (campos, editor
    e prancha), enquanto ela está aberta; e *Lugares automáticos*, *Ligações automáticas*, *Textos padrão*;
  - **atalhos** com algo selecionado na prancha (toque numa tela, aparelho ou porta): **Ctrl+C / Ctrl+V** copia e
    cola (tela duplicada, ou outro aparelho igual — dá para colar em outra sala), **Ctrl+X** recorta, **Delete**
    tira (porta: desliga), **Esc** solta a seleção. Nos campos de texto, os atalhos são os normais.
  Um CVT4K-S para várias telas: ponha o CVT4K-S e arraste para ele as portas (ou *Toda a tela aqui*) de cada tela.

O Projetech Calculator não faz este projeto: ele manda a sala para cá pelo *Gerar lista no Painel de LED*.

**As contas**: cada porta pega **linhas inteiras** (colunas na vertical, fileiras na horizontal) até o limite de
pixels — e de gabinetes, se houver —, **repartidas por igual** (9 colunas com até 4 por porta → 3, 3, 3 — o pixel
map do Calculator reparte igual). Linha que não cabe numa porta: a tela vira faixas iguais (fileira
de 40 com limite 23 → 2 de 20). *Encher a porta* (o "Livre" do Calculator) = uma corrente só. O canto, o sentido e
a serpentina vêm do Calculator; aqui, o automático escolhe o sentido que usa menos portas (empate: o que reparte
por igual). Cada bloco de porta é um **circuito** (dividido se passar de 3,5 kW ou do máximo de gabinetes do
painel — o NT 50×100 usa 3); a régua junta circuitos até **7,5 kW**; até 4 réguas por rack.

**O que o projeto põe na lista**: RJ45 20 m (1 por porta, 2 com backup, + 1), powercon 10 m (1 por circuito, + 1),
réguas Steck/Powercon, racks da sala, camlocks (5 por rack trifásico, 3 por rack de 5), controladoras (+ 1 de
reserva por lista) e o cabo USB AB. Mão francesa e pesos vêm da estrutura (palco).

## Manutenção (controle semanal dos módulos)

O técnico registra o que fez nos painéis: **painel, case (opcional), o que foi feito** (troca de módulo,
reparo, fonte, receiving card, cabo interno, calibração, limpeza, revisão de case), **defeito** e
**quantidade**. A tela mostra a semana (segunda a domingo): módulos trocados, reparados, cases revisados,
dias com registro, por painel e por defeito — e imprime o relatório da semana. Se chegar quinta-feira
sem nenhum registro, o Início avisa.

Embaixo fica a fila **Aguardando conserto**: o que voltou com avaria de um evento cai ali sozinho e fica
fora do estoque até ser concluído (o conserto de painel entra também no controle da semana).

## De onde vieram os números

- **Catálogo** = a "LISTA ZERADA" de `Desktop\Lista - Painel de Led e Racks de energia - PROJETECH EVENTOS.xlsx`,
  (versão de 13/10/2026), na mesma ordem. Quantidades: **só a aba "INVENTÁRIO (NOVO)"**. O que está em
  branco nela fica "não contado" — o sistema não acusa falta do que não sabe; quem contar preenche no Catálogo.
- **Regras** = calibradas em ~30 telas das listas conferidas (`Desktop\Bagun\LISTAS (ATUALIZADO)`). Nas
  telas simples (e conferido contra as listas de outubro/2026: Amgen, Fico, L’Oréal, Sandoz, Vertex, Mulli) o sistema acerta os cases em 97% dos casos (±15%), réguas e pranchas em 100%/97%, jumpers em 87%.
  O Honda 6 × 3,5 m sai idêntico à lista conferida (é um dos testes automáticos).
- **A confirmar**: pixels por porta (**650.000**) e o limite por circuito (**3,5 kW**) — mudam os cabos de 20 m e
  de 10 m. Ficam em Catálogo → item do painel e no Projeto da sala.

Tudo é editável: **Regras** (com simulador) e **Catálogo**.

## Ligar o modo online (equipe + logins + permissões)

Usa o **mesmo Supabase do Projetech Calculator** — o login é o mesmo.

1. Supabase → **SQL Editor** → New query → cole **`supabase-led.sql`** → **Run**.
   (Cria só tabelas novas `led_*`. O administrador do Calculator vira o **administrador** daqui: acesso total.)
2. **`js/config.js`** já está preenchido (05/11/2026) com o endereço e a chave pública do Supabase do Calculator.
   Com ele preenchido o app pede login; para voltar ao modo local, esvazie os dois campos.
3. Para cada pessoa: Supabase → **Authentication → Users → Add user** (marque *Auto Confirm User*); depois,
   no app, menu **Equipe → Adicionar pessoa** com o e-mail dela e o que ela pode acessar.

O modo local e o online usam bancos separados no aparelho. Ao ligar o online, o administrador vê em
*Ajustes* o cartão **"Dados do modo local deste aparelho" → Levar para a nuvem**: sobe as listas,
manutenção, bancada, catálogo e regras que estavam só no aparelho (só o que ainda não existe na nuvem; nada é
apagado). No primeiro acesso com a nuvem vazia, o administrador também pode tocar *Carregar catálogo e regras
iniciais* no Início.

## Equipe e permissões

Só o **administrador** tem acesso total, vê a tela **Equipe** e gerencia os logins. Para cada pessoa ele
escolhe, módulo por módulo, **sem acesso / ver / editar**: Início e alertas, Listas, Separação, Retorno,
Estoque, Manutenção, Bancada, Regras e Catálogo. Há modelos prontos — *Técnico do galpão*, *Só separação e
retorno*, *Só consulta* — e dá para ajustar um por um. Quem não tem acesso não vê a tela no menu; quem só
vê não encontra os botões de editar. O banco confere a mesma tabela (`js/permissoes.js` ↔ `supabase-led.sql`,
um teste garante que os dois batem) e recusa o que não foi liberado. Backup, regras padrão e apagar dados:
só o administrador.

No **modo local** não existe login: quem usa o aparelho entra com acesso total. Os acessos por pessoa valem
com o modo online ligado.

O registro de atividade não pode ser editado por ninguém (é a base da fiscalização). Nada é apagado do
banco de verdade — exclusão vira marcação, para todos os aparelhos ficarem sabendo.

## Arquivos

| arquivo | o que é |
|---|---|
| `js/motor.js` | **todas as contas** — regras, mesclagem com edição manual, separação, retorno, estoque por dia, alertas. Puro, sem tela |
| `js/seed.js` | catálogo (lista zerada), dados dos painéis e regras iniciais |
| `js/historico.js` | as listas conferidas, anônimas (só itens) — base do "costuma ir" |
| `js/dados.js` | IndexedDB no aparelho + fila de envio + sincronização em tempo real com o Supabase |
| `js/os.js` | lê o .xlsx da OS no navegador e tira cabeçalho, salas e painéis com medida |
| `js/cabeamento.js` | contas do cabeamento (as mesmas do pixel map do Calculator) e as folhas do projeto técnico (SVG e PDF) |
| `js/ui/projeto.js` | monta as folhas da sala com o que a lista sabe e exporta o PDF |
| `js/ui/receber.js` | recebe a sala do Calculator ("Gerar lista no Painel de LED") |
| `js/ui/projsala.js` | a tela Projeto da sala (começar pelo projeto) |
| `js/ui/montagem.js` | o editor da sala: Painéis, Sinal (portas à mão), Energia (réguas e racks) e Processamento |
| `js/ui/*.js` | as telas |
| `js/permissoes.js` | quem pode o quê (módulos, níveis, modelos prontos) — o banco usa a mesma tabela |
| `supabase-led.sql` | banco, permissões por pessoa (RLS), tempo real e o administrador |
| `test/` | `node --test` dentro de `led/` — 75 testes (cabeamento, portas à mão, energia, processamento e projeto técnico, critérios de aceite, Honda 6 × 3,5 m, Syngenta, Borges e Costa, sincronização offline) |
