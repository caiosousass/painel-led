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

Sem configurar nada roda em **modo local**: os dados ficam só naquele aparelho. Serve para testar. Para a
equipe usar junto — e o administrador ver de qualquer lugar — ligue o modo online (abaixo).

## O fluxo

1. **Lista** — *Nova lista*, *Importar OS (.xlsx ou .pdf)* ou *Duplicar uma anterior*. Informe o painel e a medida de
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
   - **Estrutura e palco (a mesma regra do Projetech Calculator)**: em cada tela no chão, marque se o painel
     está **em cima do palco** (altura, fundo e se a mão francesa apoia no palco ou sai do chão, atrás dele).
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

## Projeto técnico (sinal e energia) — no estilo do projeto da Abbvie (OS 30469)

Cada tela da lista tem uma seção **Projeto**. Com a medida (L × A ou colunas × linhas) o sistema desenha:

- **Sinal**: cada porta pega colunas inteiras até o limite de pixels (650 mil); uma cor por porta,
  serpentina vertical a partir do canto escolhido, início verde e fim vermelho, etiqueta Novastar
  (C · P · RV · WH) em cada gabinete. Cabo de dados: 1 por porta, ou 2 com **backup**.
- **Energia**: cada régua Steck/Powercon fecha colunas inteiras até o **limite de consumo máximo**
  (padrão 7,5 kW — reproduz o PDF da Abbvie) e desce até o rack; cada rack recebe até 4 réguas.

**Exportar projeto (PDF)** gera uma folha por tela (telas iguais na mesma folha, como "Girassol 1, 2 e 3"),
a folha de **Distribuição** (o material de cada tela) e o carimbo (projeto, local, tipo, responsável, data,
OS, cliente e número da folha). Folha 16:9, como a de vocês.

**Projeto e lista andam juntos**: cabos RJ45 20 m saem das portas, réguas Steck/Powercon e racks saem da
energia. Mudou a medida, o desenho muda; mudou o limite da régua, o backup ou o rack, a lista muda.

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
- **A confirmar**: gabinetes por circuito (**12**) e pixels por porta (**650.000**) — mudam os troncos de
  10 m / 20 m. Ficam em Catálogo → item do painel.

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
| `js/ui/projeto.js` | desenho do projeto técnico (sinal e energia) → prévia em SVG e PDF |
| `js/ui/*.js` | as telas |
| `js/permissoes.js` | quem pode o quê (módulos, níveis, modelos prontos) — o banco usa a mesma tabela |
| `supabase-led.sql` | banco, permissões por pessoa (RLS), tempo real e o administrador |
| `test/` | `node --test` dentro de `led/` — 40 testes (critérios de aceite, Honda 6 × 3,5 m, sincronização offline) |
