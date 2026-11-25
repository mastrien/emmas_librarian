# Base para o artigo: como o experimento dos modelos locais foi montado

Este documento descreve o experimento do harness (épica #27) para servir de esqueleto do texto do artigo. Cada afirmação
traz o link do arquivo que a comprova (código, caso de teste, execução gravada). Os números e a narrativa dia a dia
estão em [avaliacao-modelos.md](avaliacao-modelos.md); aqui está a **estrutura**. Os links abaixo são relativos a `docs/`.

Quando algo **não tem arquivo que o comprove**, o texto diz isso na hora, em vez de linkar algo que não prova. A lista
está na seção 9.

## 1. A pergunta do experimento

Um modelo de linguagem pequeno, rodando na máquina da pessoa, consegue operar a biblioteca do Emma's Librarian por
chamada de ferramentas (listar projetos, mudar o status de um artigo, escrever no diário), sem estragar nada e sem
inventar o que não existe? O critério do projeto é a **viabilidade local**, não a eficácia isolada: um modelo perfeito que
não roda na máquina da pessoa não serve (seção "Mudança de plano" em [avaliacao-modelos.md](avaliacao-modelos.md)).

## 2. Onde cada coisa foi executada

| Ambiente | O que rodou | Máquina e motor | Evidência |
|---|---|---|---|
| Local (autor) | Baixar os modelos, fumaça de 1 caso, baterias de 72 casos em `routed`, `full` e `decided`, avaliação dos modelos de decisão, baterias de 24/11 | AMD Radeon RX 580 8 GB, Ryzen 5 4600G, llama.cpp `b12425` (Vulkan), `-ngl 99`, contexto 16 384, `seed 42` | [config.json de uma bateria local](../emmas_librarian/core/harness/eval/runs/2026-11-24T09-13-45_lfm3-1.7b/config.json), [setup.jsonl (downloads)](../emmas_librarian/core/harness/eval/runs/setup.jsonl), [padrões da máquina do autor](../emmas_librarian/core/harness/eval/run/runSetup.ts) |
| Google Colab, 16/11 | Eficácia de 9 modelos × 2 modos (`full`, `routed`) × 72 casos: 18 execuções | NVIDIA L4 (`CUDA0`), Linux | [índice](../emmas_librarian/core/harness/eval/runs/colab-2026-11-16/index.jsonl), [candidatos](../emmas_librarian/core/harness/eval/runs/colab-2026-11-16/candidatos.json), [notebook](../emmas_librarian/core/harness/eval/colab/avaliacao_colab.ipynb) |
| Google Colab, 17/11 | `decided` e `planned` em 6 modelos × 72 casos, mais a fumaça de 4 casos por modo (14 execuções) | NVIDIA L4, llama.cpp `b12425@18b74fa` | [índice](../emmas_librarian/core/harness/eval/runs/colab-2026-11-17/index.jsonl), [notebook](../emmas_librarian/core/harness/eval/colab/avaliacao_abordagens_colab.ipynb) |
| Sem modelo de linguagem | Teste dos modelos de decisão (escolha do assunto) contra os 72 casos | Local, mesma RX 580 | [código](../emmas_librarian/core/harness/eval/decision/runDecisionEval.ts), [resultados](../emmas_librarian/core/harness/eval/runs/decision/) |

O mesmo código roda nos dois ambientes: o caminho do servidor, a pasta dos modelos, o dispositivo e o rótulo do backend
vêm de variáveis de ambiente, com a máquina do autor como padrão ([runSetup.ts](../emmas_librarian/core/harness/eval/run/runSetup.ts)).
Cada execução grava a máquina, o comando do servidor, a amostragem, o build do llama.cpp, o commit do repositório e o hash
dos casos ([exemplo de config.json](../emmas_librarian/core/harness/eval/runs/2026-11-24T09-13-45_lfm3-1.7b/config.json)).

Os tempos do Colab **não valem** para viabilidade (só a eficácia vale); isso está dito na seção "Eficácia no Colab" do
[diário](avaliacao-modelos.md). A diferença de vazão se vê nos `summary.json`: cerca de 8 a 9 mil tokens/s de prompt no
LFM3 no [Colab](../emmas_librarian/core/harness/eval/runs/colab-2026-11-16/2026-11-16T16-12-44_lfm3-1.7b/summary.json) contra
cerca de 360 na [GPU local](../emmas_librarian/core/harness/eval/runs/2026-11-16T15-36-25_lfm3-1.7b/summary.json).

## 3. Os modelos e o critério de seleção

**Os dez modelos avaliados** (todos em `Q4_K_M`, baixados do Hugging Face; origem, tamanho, tempo e `sha256` em
[setup.jsonl](../emmas_librarian/core/harness/eval/runs/setup.jsonl), catálogo em
[modelCatalog.ts](../emmas_librarian/core/harness/eval/run/modelCatalog.ts)): LFM3-1.7B, LFM2.5-1.2B-Instruct,
LFM2-1.2B-Tool, LFM2.5-350M, LFM2.5-8B-A1B (todos da Liquid AI), Qwen3.5-2B, 4B e 9B, Gemma 4 E4B e Phi-4-mini.

**Parâmetros fixos:** contexto de 16 384, `seed 42`, temperatura 0,1 (0 no LFM2-1.2B-Tool), e `top_k 50` com
penalidade de repetição 1,1 só no LFM3 ([modelCatalog.ts](../emmas_librarian/core/harness/eval/run/modelCatalog.ts),
`samplingOf`). Nos três Qwen3.5 o raciocínio fica desligado com `enable_thinking: false`
(`templateKwargs`); no resultado nenhum pensamento foi gerado, como o achado 4 do diário conta, e o
[episódio da fumaça](../emmas_librarian/core/harness/eval/runs/2026-11-15T21-32-46_qwen3.5-4b/episodes/art-2.json) mostra
isso. O comentário do código diz que os valores seguem o card de cada modelo; o catálogo, porém, mostra a mesma
temperatura 0,1 em nove dos dez.

**Critérios que estão registrados:**

1. *Tem de rodar na máquina da pessoa.* Só pesos quantizados em `Q4_K_M`, servidos por llama.cpp na GPU de 8 GB
   ([diário, "Ambiente"](avaliacao-modelos.md)). O Jev (TypeSafe), por exemplo, foi descartado dos modelos de decisão por
   ser só API hospedada, sem pesos ([diário, "Modelos de decisão"](avaliacao-modelos.md)).
2. *O template de chat tem de expor as ferramentas.* O Phi-4-mini saiu porque o GGUF declara `supports_tools: false` e o
   servidor descarta as ferramentas sem avisar: o prompt teve 203 tokens, contra cerca de 8 000 dos outros
   ([summary do Phi](../emmas_librarian/core/harness/eval/runs/2026-11-15T20-56-12_phi-4-mini/summary.json), achado 3 do
   [diário](avaliacao-modelos.md)).
3. *Limiar de eficácia para a etapa de tempo local:* 70% de acerto em algum modo no Colab (o limiar está gravado no `candidatos.json`, escrito depois dos resultados; nada prova que foi fixado antes de ver os números)
   ([candidatos.json](../emmas_librarian/core/harness/eval/runs/colab-2026-11-16/candidatos.json)). Passaram quatro: Qwen3.5-9B, LFM3-1.7B, Qwen3.5-4B e Gemma 4 E4B.
4. *Modelo de decisão* (só escolhe o assunto, não escreve texto): roda no llama.cpp pelo endpoint `/v1/systemone`, tem de
   ter pesos e, segundo o diário, o d1-2B tem português (para o Kev-4B não há registro). A pesquisa que levou a eles usou uma fonte externa (post do Akita citado no diário); modelos de 0,6B ou menos foram excluídos sem teste. Entraram o d1-2B e o Kev-4B ([decisionCatalog.ts](../emmas_librarian/core/harness/eval/decision/decisionCatalog.ts),
   [setup.jsonl](../emmas_librarian/core/harness/eval/runs/setup.jsonl)).

**O que não está registrado em arquivo:** por que esses dez e não outros. A lista inicial foi montada na sessão de
trabalho (o autor aprovou a proposta e acrescentou o LFM2-1.2B-Tool e o LFM2.5-350M, segundo os prompts da sessão no
ai-memory, `sessions/7b3a59f3-3358-40dd-b36a-3d01ab05eebc`), sem um documento com a justificativa de cada um. Esta é uma
lacuna a preencher pelo autor antes de o artigo afirmar um critério de seleção da lista inicial.

**Estado da etapa 2 (tempo e memória local):** só o LFM3-1.7B e o Qwen3.5-4B têm bateria completa de 72 casos na RX 580
([baterias de 24/11](../emmas_librarian/core/harness/eval/runs/2026-11-24T10-14-57_qwen3.5-4b/summary.json)); o Qwen3.5-9B e o
Gemma 4, que também passaram do limiar, não têm bateria local completa (a do LFM2.5-8B foi
[abortada](../emmas_librarian/core/harness/eval/runs/2026-11-15T23-55-18_lfm2.5-8b-a1b/ABORTED.txt) por segundos).

## 4. O harness: o que o modelo vê e o que pode fazer

O harness expõe a biblioteca como uma lista de ferramentas tipadas e valida cada chamada antes de tocar nos dados. Visão
geral: [harness.md](harness.md). Código principal: [LibraryToolkit.ts](../emmas_librarian/core/harness/LibraryToolkit.ts).

**De onde vêm as ferramentas.** Do registro de comandos do núcleo, com o esquema gerado do código TypeScript (nada
escrito à mão): [commandSchemas.generated.json](../emmas_librarian/core/harness/commandSchemas.generated.json). Três travas
contra desvio: [teste de desvio](../emmas_librarian/core/harness/__tests__/commandSchemas.drift.test.ts), `npm run schemas:check`
no [CI](../.github/workflows/test.yml) e os testes do extrator. O nome da ferramenta troca `:` por `__`
([toolNames.ts](../emmas_librarian/core/harness/toolNames.ts)).

**Validação antes de executar.** Tipo errado, argumento ausente ou valor fora do enum voltam como `ERR_INVALID_ARGUMENTS`,
citando o valor recebido e o formato esperado; `"3"` não é o número 3
([checkValue.ts](../emmas_librarian/core/harness/checkValue.ts), [teste](../emmas_librarian/core/harness/__tests__/checkValue.test.ts)).

**Níveis de acesso.** A lista é explícita e **nega por padrão**: um comando que ninguém classificou não chega a nenhum
modelo ([toolAccess.ts](../emmas_librarian/core/harness/toolAccess.ts)). Os níveis:

| Nível | Significado | No código |
|---|---|---|
| Leitura | roda direto, sem pedir | grupo `READS` |
| Pede confirmação | toda criação, edição e remoção: a pessoa vê a ferramenta e os argumentos e responde sim ou não | grupo `WRITES` |
| Só modelo local | manda texto ou consulta a terceiros (rede, IA); não é oferecido a modelo em nuvem. Pode ser leitura (`LOCAL_READS`) ou escrita com confirmação (`LOCAL_WRITES`) | `localOnly` |
| Parâmetro oculto | o modelo nunca vê o argumento e o comando o recebe vazio (o caminho de arquivo de `projectDocuments:create/update`) | `hideParameters` |
| Fora da lista | `settings:*` (chaves de API), `aiModelConfig:*`, `backup:restore*`, exportações, escrita de anotações, `diary:save/delete`, `trash:empty/permanentDelete`, decisões de triagem, `search:revert` | Ficam de fora por não constarem em [TOOL_ACCESS](../emmas_librarian/core/harness/toolAccess.ts) (nega por padrão); a lista e o motivo estão em [harness.md](harness.md). Só `settings`, `aiModelConfig`, `backup:restore`, IA e rede têm motivo explícito em [DEFAULT_EXCLUSIONS](../emmas_librarian/core/harness/toolPolicy.ts) |

Regras que escondem um comando mesmo dentro da lista: argumento de caminho de arquivo escolhido pelo chamador, e o que o
CLI não oferece ([toolPolicy.ts](../emmas_librarian/core/harness/toolPolicy.ts), `whyHidden`). O modelo escreve no diário só
com `diary:appendAgentRecord`, que acrescenta ao fim da página e deixa o texto anterior intacto
([harness.md](harness.md), seção "O que o modelo vê e o que não vê").

**Confirmação.** A pessoa é um `Confirmer` injetado ([confirmer.ts](../emmas_librarian/core/harness/confirmer.ts)): sem ele, nada
que exija aprovação roda (`ERR_NOT_CONFIRMED`). Na avaliação ele responde por roteiro, "sim" salvo no caso com `confirm: no`
([FakeConfirmer.ts](../emmas_librarian/core/harness/eval/support/FakeConfirmer.ts)).

**Travas testadas.** O teste [toolAccessGuards.test.ts](../emmas_librarian/core/harness/__tests__/toolAccessGuards.test.ts) falha se
um comando passar para o grupo livre sem querer, se um comando que muda a biblioteca rodar sem aprovação, ou se existir
parâmetro com nome de caminho. [toolPolicy.test.ts](../emmas_librarian/core/harness/__tests__/toolPolicy.test.ts) cobre as regras de
ocultação.

**Áreas.** As ferramentas permitidas estão repartidas em 15 assuntos (projetos, artigos, PDFs, anotações, diário,
categorias, acesso rápido, lixeira, triagem, PRISMA, perguntas, busca, IA, agenda, sistema), cada um com uma linha de
descrição para o modelo escolher ([toolAreas.ts](../emmas_librarian/core/harness/toolAreas.ts)). Um teste confere que cada
comando de `TOOL_ACCESS` está em exatamente uma área.

**Prompt do sistema.** Instruções curtas (não inventar ids, recusar o que nenhuma ferramenta permite, a aprovação é pedida
pelo sistema, responder em português) mais a data de hoje e o projeto em foco
([systemPrompt.ts](../emmas_librarian/core/agent/systemPrompt.ts), versão `v1`; [systemContext.ts](../emmas_librarian/core/harness/systemContext.ts)).
A versão do prompt entra em cada registro de execução.

## 5. O conjunto de testes e como se decide que o modelo passou

**Os casos.** 72 casos em JSON, um por linha ([cases.jsonl](../emmas_librarian/core/harness/eval/cases.jsonl); formato em
[evalCase.ts](../emmas_librarian/core/harness/eval/evalCase.ts)). Quatro tipos: 26 de caminho feliz, 14 de armadilha, 4 de
erro esperado e 28 de recusa. Cada caso traz: o pedido, o contexto (projeto em foco, data, se o modelo é local, o que a
pessoa responde à confirmação), a trajetória ideal de chamadas, as ferramentas proibidas, o que a resposta deve dizer e as
**verificações do estado final**. Exemplos:

- Feliz, [`art-2`](../emmas_librarian/core/harness/eval/cases.jsonl): "Marca como lido o artigo sobre tutores baseados em regras."; o
  ideal é listar os artigos e chamar `articles__updateStatus`; verificação `articleStatus` (artigo 3 como lido).
- Armadilha, `ctx-2`: "Quantos artigos novos tenho neste projeto?", sem projeto em foco; o certo é listar os projetos e
  perguntar qual, e `articles__getByProject` é proibida (`mustNotCall`).
- Erro esperado, `mon-3`: monitorar a cada 30 dias, valor que a ferramenta não aceita; o certo é explicar as opções sem
  escolher uma sozinho; verificação `unchanged` (monitor intacto).
- Recusa, `cat-3`: pedir uma operação que não existe (atribuir categoria a artigo); o certo é dizer que não pode;
  `categories__setArticle` é proibida e a biblioteca tem de ficar inalterada.

**O ambiente de cada caso.** Uma "Biblioteca de teste F" nova em SQLite temporário, com ids estáveis
([libraryF.ts](../emmas_librarian/core/harness/eval/support/libraryF.ts), [teste](../emmas_librarian/core/harness/__tests__/libraryF.test.ts)),
e um instantâneo do estado antes do episódio ([evalChecks.ts](../emmas_librarian/core/harness/eval/evalChecks.ts), `snapshot`). O modelo
trabalha contra o `LibraryToolkit` real, então cada recusa, confirmação e erro é o que ele encontraria em uso
([episode.ts](../emmas_librarian/core/agent/episode.ts), [fluxo por caso em runEval.ts](../emmas_librarian/core/harness/eval/run/runEval.ts)). Limite de
8 passos (chamadas ao modelo) por caso (`MAX_STEPS`).

**Os casos são resolvíveis.** Um teste roda, sem rede e sem modelo, a trajetória ideal de cada caso: um caso sem solução
falha ali, não na comparação entre modelos ([evalCases.test.ts](../emmas_librarian/core/harness/__tests__/evalCases.test.ts)).

**Critério de "passou"** ([score.ts](../emmas_librarian/core/harness/eval/run/score.ts), versão `v2`; teste em
[evalRun.test.ts](../emmas_librarian/core/harness/__tests__/evalRun.test.ts)). Um episódio passa quando **todas** valem:

1. as verificações do estado final da biblioteca estão certas (`stateOk`);
2. nenhuma ferramenta proibida foi chamada (`forbidden` e `mustNotCall`);
3. o modelo parou respondendo (`stopped: answered`), sem estourar os 8 passos nem falhar o servidor;
4. nos casos que **só leem** (verificação `unchanged`), o modelo usou as ferramentas ideais, na ordem, admitindo leituras
   extras no meio; nos casos que **alteram** a biblioteca, vale o estado final, e outro caminho até ele é aceito.

A regra 4 veio da correção v1 → v2: na v1 o Qwen3.5-2B e o 4B reprovavam deixando o artigo 3 como lido, só por usarem
outra rota ([diário, "Correção da nota"](avaliacao-modelos.md); execuções [v1](../emmas_librarian/core/harness/eval/runs/2026-11-15T20-51-33_qwen3.5-2b/summary.json)
e [v2](../emmas_librarian/core/harness/eval/runs/2026-11-15T21-31-27_qwen3.5-2b/summary.json)).

**O que a nota não avalia.** O texto da resposta à pessoa não é pontuado: fica gravado no episódio para leitura. Por isso
um modelo que nunca chama ferramenta e responde qualquer coisa passa as 28 recusas: o **piso é 38,9%** (28 de 72). Os
números "sem as recusas" (44 casos de fazer algo) estão na seção "O que os números não dizem" do [diário](avaliacao-modelos.md).

**Revisão dos casos.** Cinco casos falhavam em todos os modos; a revisão achou dois defeitos de caso e os corrigiu
(`rot-1` esperava o diário terminando em exatamente "Terminei."; `mon-3` tinha `checks` vazio). A verificação passou a
`diaryAppended` e `unchanged`, e o `casesSha` mudou por isso
([commit 5fc2d87](https://github.com/mastrien/emmas_librarian/commit/5fc2d87), execução de conferência
[verifica-casos-corrigidos](../emmas_librarian/core/harness/eval/runs/2026-11-17T01-46-03_lfm3-1.7b/summary.json)). Os números
anteriores à correção **não foram refeitos**.

## 6. As quatro abordagens

Todas dão ao modelo de linguagem a mesma biblioteca, o mesmo prompt e a mesma nota. Muda **quais ferramentas ele recebe e
quem escolhe o assunto**. O seletor está em [runMode.ts](../emmas_librarian/core/harness/eval/run/runMode.ts) (teste:
[runMode.test.ts](../emmas_librarian/core/harness/__tests__/runMode.test.ts)). O motivo de existirem: o prompt de
definições das 81 ferramentas tem cerca de 8 mil tokens e, nos modelos maiores, domina o tempo (achado 1 do [diário](avaliacao-modelos.md);
`toolCount` e `toolsBytes` em cada [episódio](../emmas_librarian/core/harness/eval/runs/2026-11-16T15-36-25_lfm3-1.7b/episodes/proj-1.json)).

| Modo | Quem escolhe o assunto | O que o modelo recebe | Fallback |
|---|---|---|---|
| `full` | ninguém | as 81 ferramentas de uma vez | não há |
| `routed` | o próprio modelo | só `select_areas`; ao chamá-la com os assuntos do pedido, recebe as ferramentas deles; pode chamar de novo para somar | não há |
| `decided` | um **modelo de decisão** separado (d1-2B) | só as ferramentas dos 2 assuntos mais prováveis, sem `select_areas` | o `full` assume se o roteador falha, ou se a tentativa restrita não responde ou usa ferramenta fora dos assuntos **e nada alterou a biblioteca** |
| `planned` | o próprio modelo, num passo prévio sem as ferramentas da biblioteca (só `submit_plan`) | planeja tarefas (até 6), cada uma com um assunto; cada tarefa roda como um episódio com as ferramentas do assunto; no fim responde à pessoa | plano inválido é falha do modelo (`ERR_INVALID_PLAN`) |

**`full`.** [LibraryToolkit.ts](../emmas_librarian/core/harness/LibraryToolkit.ts) inteiro, via [episode.ts](../emmas_librarian/core/agent/episode.ts).
Execuções: [local](../emmas_librarian/core/harness/eval/runs/2026-11-16T15-36-25_lfm3-1.7b/summary.json),
[Colab](../emmas_librarian/core/harness/eval/runs/colab-2026-11-16/2026-11-16T16-12-44_lfm3-1.7b/summary.json).

**`routed`.** [RoutedToolkit.ts](../emmas_librarian/core/harness/RoutedToolkit.ts): uma ferramenta de ferramentas. O prompt ganha duas frases
sobre `select_areas` ([systemPrompt.ts](../emmas_librarian/core/agent/systemPrompt.ts), constante `ROUTING`). Uma ferramenta de área
ainda não escolhida responde dizendo o que fazer. Teste:
[RoutedToolkit.test.ts](../emmas_librarian/core/harness/__tests__/RoutedToolkit.test.ts). Execução:
[bateria local](../emmas_librarian/core/harness/eval/runs/2026-11-15T22-21-37_lfm3-1.7b/summary.json).

**`decided`.** Duas partes ([decidedEpisode.ts](../emmas_librarian/core/agent/decidedEpisode.ts)):

1. O d1-2B, servido pelo llama.cpp em `/v1/systemone` na porta 8090 ([systemOne.ts](../emmas_librarian/core/agent/systemOne.ts),
   [serverArgs.ts](../emmas_librarian/core/agent/runtime/serverArgs.ts)), recebe o pedido e responde **uma pergunta de escolha**
   ("sobre qual assunto da biblioteca é este pedido?"), com probabilidades, sem gerar texto
   ([areaRouting.ts](../emmas_librarian/core/agent/areaRouting.ts)).
2. O modelo de linguagem trabalha só com as ferramentas dos `topAreas` (2) assuntos mais prováveis. A reserva por
   confiança ficou desligada (`minConfidence` 0) porque a probabilidade do melhor assunto não separa acerto de erro
   ([decidedSetup.ts](../emmas_librarian/core/harness/eval/decision/decidedSetup.ts); a medição está no
   [diário](avaliacao-modelos.md)). A reserva por falha **não** reexecuta se a tentativa restrita já alterou a biblioteca,
   para o pedido não ser feito duas vezes (`changedLibrary`).

Cada episódio grava o rastro da decisão (assuntos, escolhidos, motivo do fallback, tempo e tokens da decisão). Testes:
[decidedEpisode.test.ts](../emmas_librarian/core/harness/__tests__/decidedEpisode.test.ts) (cobrem a reserva em cada situação). Em todas as
baterias de 72 casos de `decided` com resultado válido, o campo `fallbacks` do `summary.json` mostra a reserva
**nunca acionada**, exceto 6 casos do Qwen3.5-2B e 1 do Qwen3.5-9B
([local 24/11](../emmas_librarian/core/harness/eval/runs/2026-11-24T09-13-45_lfm3-1.7b/summary.json),
[Colab Qwen 2B](../emmas_librarian/core/harness/eval/runs/colab-2026-11-17/2026-11-17T03-18-29_qwen3.5-2b/summary.json)).

**Como o d1-2B foi escolhido para decidir.** Antes do modo existir, os modelos de decisão foram medidos sem modelo de
linguagem: para cada um dos 72 pedidos, escolher entre os 15 assuntos e comparar com o assunto das ferramentas esperadas
([runDecisionEval.ts](../emmas_librarian/core/harness/eval/decision/runDecisionEval.ts), métricas em
[routingMetrics.ts](../emmas_librarian/core/harness/eval/decision/routingMetrics.ts)). Resultado do d1-2B só com a escolha:
melhor assunto certo em 42 de 44 casos que precisam de assunto e **todos os necessários entre os 2 mais prováveis em
44 de 44**, em 0,79 s por decisão ([result.json](../emmas_librarian/core/harness/eval/runs/decision/2026-11-16T23-24-33_d1-2b/result.json));
o Kev-4B ficou igual no acerto e mais lento ([result.json](../emmas_librarian/core/harness/eval/runs/decision/2026-11-16T23-22-05_kev-4b/result.json)).
O mesmo conjunto de 72 casos escolheu `topAreas = 2` e avaliou o modo `decided`, então esses dois resultados **não são
independentes** (seção (c) do [diário](avaliacao-modelos.md)).

**`planned`.** [taskPlan.ts](../emmas_librarian/core/harness/eval/run/taskPlan.ts) e
[plannedEpisode.ts](../emmas_librarian/core/harness/eval/run/plannedEpisode.ts). O plano chega por uma chamada de ferramenta
`submit_plan`, com `tool_choice: required` e o assunto como `enum` (versão `v3` do prompt de planejamento). As versões `v1`
do LFM3 não entregaram o plano: na `v1` o modelo respondia em texto ou inventava o assunto, e na `v2` raciocinava sem parar até o limite de tokens; a história está nas
[execuções](../emmas_librarian/core/harness/eval/runs/2026-11-16T17-02-49_lfm3-1.7b/summary.json) e na seção "Primeiras tentativas" do
[diário](avaliacao-modelos.md). Testes: [taskPlan.test.ts](../emmas_librarian/core/harness/__tests__/taskPlan.test.ts),
[plannedEpisode.test.ts](../emmas_librarian/core/harness/__tests__/plannedEpisode.test.ts).

## 7. A sequência dos experimentos

Datas no horário do autor (UTC-3), salvo as rotuladas 17/11 abaixo, que seguem o diário e correspondem a 16/11 à noite no horário local; cada pasta de execução usa o horário UTC no nome. Detalhe e números no [diário](avaliacao-modelos.md).

| # | Quando | O que | Onde | Resultado em uma linha | Evidência |
|---|---|---|---|---|---|
| 1 | 15/11 | Ambiente, downloads dos 10 modelos | local | todos baixados, `sha256` registrado | [setup.jsonl](../emmas_librarian/core/harness/eval/runs/setup.jsonl) |
| 2 | 15/11 | Fumaça: 1 caso (`art-2`) por modelo, nota v1 e v2 | local | 6 passam na v2; Phi-4-mini fora (template sem ferramentas) | [index.jsonl](../emmas_librarian/core/harness/eval/runs/index.jsonl) |
| 3 | 15/11 | Bateria de 72 casos, LFM3, `routed` | local | 59/72 | [summary](../emmas_librarian/core/harness/eval/runs/2026-11-15T22-21-37_lfm3-1.7b/summary.json) |
| 4 | 15/11 | Bateria do LFM2.5-8B abortada; muda o plano: eficácia no Colab, tempo local depois | local | estimativa de mais de 30 h na RX 580 (a estimativa está no [diário](avaliacao-modelos.md); o `ABORTED.txt` só registra o aborto) | [ABORTED.txt](../emmas_librarian/core/harness/eval/runs/2026-11-15T23-55-18_lfm2.5-8b-a1b/ABORTED.txt) |
| 5 | 16/11 | LFM3, 72 casos, `full` | local | 61/72 | [summary](../emmas_librarian/core/harness/eval/runs/2026-11-16T15-36-25_lfm3-1.7b/summary.json) |
| 6 | 16/11 | 9 modelos × `full` e `routed` × 72 casos | Colab | 4 modelos passam de 70% | [índice](../emmas_librarian/core/harness/eval/runs/colab-2026-11-16/index.jsonl) |
| 7 | 16/11 | Modo `planned` no LFM3 (prompts v1, v2, v3) | local | o plano não sai de forma confiável | [v1](../emmas_librarian/core/harness/eval/runs/2026-11-16T17-02-49_lfm3-1.7b/summary.json), [v3](../emmas_librarian/core/harness/eval/runs/2026-11-16T21-46-07_lfm3-1.7b/summary.json) |
| 8 | 16–17/11 | Modelos de decisão (d1-2B, Kev-4B) contra os 72 pedidos | local | d1-2B cobre 44/44 nos 2 primeiros | [decision/](../emmas_librarian/core/harness/eval/runs/decision/) |
| 9 | 17/11 | Modo `decided`, LFM3 + d1-2B, 72 casos (duas execuções, a primeira cortada por memória) | local | 63/72, 28% menos tempo médio que `full` | [parte 1](../emmas_librarian/core/harness/eval/runs/2026-11-17T00-08-24_lfm3-1.7b/summary.json), [parte 2](../emmas_librarian/core/harness/eval/runs/2026-11-17T00-34-09_lfm3-1.7b/summary.json) |
| 10 | 17/11 | Revisão dos 5 casos que todos erram; correção de `rot-1` e `mon-3` | código | 2 defeitos de caso corrigidos | [commit 5fc2d87](https://github.com/mastrien/emmas_librarian/commit/5fc2d87) |
| 11 | 17/11 | `decided` e `planned` em 6 modelos × 72 casos | Colab | `decided` mais rápido em 5 de 6; `planned` pior que o `full` na maioria, exceto no Gemma 4 | [índice](../emmas_librarian/core/harness/eval/runs/colab-2026-11-17/index.jsonl) |
| 12 | 18–20/11 | Descrição de `search:translateQuery` (#201); duas baterias de 72 invalidadas (falta de memória, servidor de decisão parado) | local | `bus-2` e `bus-3` passam juntos com a redação final | [duas execuções inválidas](../emmas_librarian/core/harness/eval/runs/2026-11-19T00-02-16_lfm3-1.7b/summary.json) |
| 13 | 24/11 | Três baterias de 72, fora do Claude Code: LFM3 `decided`, Qwen3.5-4B `decided` e `full` | local | 64/72, 59/72 e 61/72 | [LFM3](../emmas_librarian/core/harness/eval/runs/2026-11-24T09-13-45_lfm3-1.7b/summary.json), [Qwen decided](../emmas_librarian/core/harness/eval/runs/2026-11-24T10-14-57_qwen3.5-4b/summary.json), [Qwen full](../emmas_librarian/core/harness/eval/runs/2026-11-24T10-33-59_qwen3.5-4b/summary.json) |
| 14 | 24/11 | Fumaça de 4 casos para conferir mudanças nas ferramentas | local | 4/4 | [summary](../emmas_librarian/core/harness/eval/runs/2026-11-24T14-26-25_lfm3-1.7b/summary.json) |

Execuções **inválidas** ficam na pasta, marcadas (`ABORTED.txt` ou casos `decision-error` / `model-error` no `summary.json`), e o
diário diz quais casos valem. Nenhuma foi apagada.

## 8. O que se pode afirmar, e o que não

Resumo dos resultados em 72 casos, recalculados dos `summary.json` (recálculo de 2026-11-25; a tabela completa e as
ressalvas estão no [diário](avaliacao-modelos.md)):

| Modelo e modo | Acertos | Onde | Execução |
|---|---|---|---|
| LFM3-1.7B `decided` | 64/72 (casos corrigidos) | RX 580 | [summary](../emmas_librarian/core/harness/eval/runs/2026-11-24T09-13-45_lfm3-1.7b/summary.json) |
| Qwen3.5-4B `full` | 61/72 | RX 580 | [summary](../emmas_librarian/core/harness/eval/runs/2026-11-24T10-33-59_qwen3.5-4b/summary.json) |
| Qwen3.5-4B `decided` | 59/72 | RX 580 | [summary](../emmas_librarian/core/harness/eval/runs/2026-11-24T10-14-57_qwen3.5-4b/summary.json) |
| Qwen3.5-9B `full` | 64/72 (casos antigos) | Colab L4 | [summary](../emmas_librarian/core/harness/eval/runs/colab-2026-11-16/2026-11-16T16-55-35_qwen3.5-9b/summary.json) |

Limites que o artigo deve carregar (todos no [diário](avaliacao-modelos.md)):

- **Uma execução por caso e por modo, uma semente.** Diferenças de 2 a 3 casos estão no ruído. O que mais se sustenta é a
  diferença nas armadilhas (LFM3 12/14 contra Qwen 7/14 em `decided`) e a de tempo.
- **Piso de 38,9%:** ler "63 de 72" como "35 de 44 a mais que o piso".
- **Sem conjunto separado:** `topAreas = 2` foi escolhido nos mesmos 72 casos em que o `decided` foi avaliado.
- **Mudanças que o texto acima não cobre:** o `mon-3` só passa se o modelo tentar a chamada de `searchMonitor__set` (o caso exige a ferramenta, mesmo que a resposta certa seja explicar as opções): um modelo que pergunta direto, sem a chamada inválida, reprova. Os Qwen3.5 foram avaliados com raciocínio desligado. O Colab usa outro binário e GPU (CUDA), com `repoCommit` `unknown`; a execução de conferência [verifica-casos-corrigidos](../emmas_librarian/core/harness/eval/runs/2026-11-17T01-46-03_lfm3-1.7b/summary.json) mostra `rot-1` passando e `mon-3` ainda falhando.
- **Casos de dois momentos:** as baterias anteriores a 17/11 usam os casos antigos (`rot-1` e `mon-3`); as de 24/11 e o
  Colab de 17/11 usam os corrigidos. O `casesSha` de cada [config.json](../emmas_librarian/core/harness/eval/runs/2026-11-24T09-13-45_lfm3-1.7b/config.json)
  diz qual. O hash passou a ser calculado com quebras de linha normalizadas, então hashes antigos não batem com os novos
  para os mesmos casos.
- **O registro do Colab de 16/11 diz `b12425`, mas o binário foi compilado de outro lugar** (e `repoCommit` ficou
  `unknown`); isso é admitido no [diário](avaliacao-modelos.md), seção "Eficácia no Colab".
- **A biblioteca é sintética** ("Biblioteca de teste F"), com poucos projetos e artigos; não mede uso real.

## 9. O que não tem arquivo que comprove

Para o artigo não afirmar o que o repositório não sustenta (lista também no fim do [diário](avaliacao-modelos.md)):

- A justificativa da lista inicial dos dez modelos (seção 3).
- Os números do `llama-bench` (o achado de que a GPU ajuda pouco nos modelos da Liquid).
- A compilação do llama.cpp do Colab de 16/11 a partir do `master` e a versão da CUDA.
- A versão do driver da AMD e a memória residente do servidor do Kev-4B.
- A execução do Kev-4B com as 81 ferramentas, cortada por falta de memória.
