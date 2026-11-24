# Avaliação de modelos locais no harness: diário

Registro de tudo o que foi feito para comparar modelos locais usando as ferramentas do harness (épica #27). Os dados
brutos de cada execução estão em `emmas_librarian/core/harness/eval/runs/`: uma pasta por execução (`config.json`,
`episodes/<caso>.json`, `summary.json`, `server.log`), mais `index.jsonl` (uma linha por execução) e `setup.jsonl`
(downloads). Este documento é o resumo; em caso de dúvida, vale o JSON.

## Ambiente (15/11/2026)

| Item | Valor |
|---|---|
| GPU | AMD Radeon RX 580 2048SP, 8 GB (Vulkan reporta 8192 MiB, 7367 livres), driver AMD 31.0.21923.11000 |
| CPU / RAM | Ryzen 5 4600G (6 núcleos), 15,9 GB |
| Motor | llama.cpp `b12425` (commit `18b74fa41`), binário Windows `win-vulkan-x64`, 38 MB, sha256 `1e63997a…` |
| Onde | `F:\llm-lab` (SSD, 30,7 GB livres antes; os dez modelos ocupam cerca de 25 GB). Cache do Docker não foi tocado. |
| Dispositivo | `--device Vulkan0 -ngl 99` (todas as camadas na GPU). `llama-server --list-devices` lista a RX 580. |
| Prompt | versão `v1` (`eval/run/systemPrompt.ts`): instruções curtas + data de hoje + projeto em foco |
| Ferramentas | 81 oferecidas a modelo local, 29 105 bytes de definições (cerca de 7 900 tokens), todas de uma vez |
| Amostragem | a do card de cada modelo (ver `modelCatalog.ts`), `seed 42`, contexto 16 384 |
| Confirmação | `FakeConfirmer` responde "sim" (exceto casos com `confirm: no`) |
| Biblioteca | "Biblioteca de teste F", nova em SQLite temporário a cada caso |
| Nota | `scorer v2` (`eval/run/score.ts`) |

## Downloads

Todos de `huggingface.co`, quantização `Q4_K_M`. Tamanho, tempo e sha256 completos em `runs/setup.jsonl`.

| Modelo | Origem | MB | s |
|---|---|---:|---:|
| LFM3-1.7B | LiquidAI/LFM3-1.7B-GGUF | 1 100 | 46 |
| LFM2.5-1.2B-Instruct | LiquidAI/LFM2.5-1.2B-Instruct-GGUF | 731 | 30 |
| LFM2-1.2B-Tool | LiquidAI/LFM2-1.2B-Tool-GGUF | 731 | 151 |
| LFM2.5-350M | LiquidAI/LFM2.5-350M-GGUF | 229 | 452 |
| Qwen3.5-2B | unsloth/Qwen3.5-2B-GGUF | 1 281 | 39 |
| Qwen3.5-4B | unsloth/Qwen3.5-4B-GGUF | 2 741 | 94 |
| Phi-4-mini | unsloth/Phi-4-mini-instruct-GGUF | 2 492 | 82 |
| Gemma 4 E4B | unsloth/gemma-4-E4B-it-GGUF | 4 977 | 164 |
| LFM2.5-8B-A1B | LiquidAI/LFM2.5-8B-A1B-GGUF | 5 156 | 168 |
| Qwen3.5-9B | unsloth/Qwen3.5-9B-GGUF | 5 681 | 200 |

Incidente: o download do LFM2.5-8B ficou 19 minutos em 0 bytes (CDN fria, com um `curl` retomando sobre o arquivo
vazio). Matei os processos, apaguei o arquivo e baixei de novo sem retomar; a segunda tentativa levou 168 s.

## Teste de fumaça: um caso por modelo (`art-2`)

Pedido: "Marca como lido o artigo sobre tutores baseados em regras." Projeto A em foco. A rota ideal é listar os
artigos e chamar `articles__updateStatus({ id: 3, status: "read" })`. **Um só caso por modelo: serve para ver se o
executor funciona e como cada modelo se comporta, não para ordenar os modelos.**

Segunda rodada (nota v2). Tempos medidos pelo `llama-server`; "pp" é o processamento do prompt, "tg" é a geração.

| Modelo | Resultado | Passos | Tempo | pp tok/s | tg tok/s | Início do servidor |
|---|---|---:|---:|---:|---:|---:|
| LFM3-1.7B | passou | 3 | 56,0 s | 403 | 23,1 | 5,7 s |
| LFM2.5-1.2B-Instruct | falhou | 1 | 19,0 s | 536 | 44,0 | 3,6 s |
| LFM2-1.2B-Tool | falhou | 2 | 19,4 s | 531 | 44,7 | 3,1 s |
| LFM2.5-350M | falhou | 8 | 21,1 s | 1 264 | 51,5 | 1,6 s |
| Qwen3.5-2B | passou | 5 | 66,5 s | 167 | 23,0 | 5,2 s |
| Qwen3.5-4B | passou | 5 | 154,9 s | 64 | 14,7 | 8,7 s |
| Gemma 4 E4B | passou | 3 | 188,1 s | 65 | 11,4 | 13,3 s |
| LFM2.5-8B-A1B | passou | 3 | 61,1 s | 295 | 22,7 | 13,4 s |
| Qwen3.5-9B | passou | 3 | 207,4 s | 50 | 12,0 | 14,9 s |
| Phi-4-mini | **fora** | | | | | |

O que cada falha foi (episódios completos em `runs/<execução>/episodes/art-2.json`):

- **LFM2.5-1.2B-Instruct:** respondeu em inglês que não tinha ferramenta para marcar como lido, sem chamar nenhuma.
- **LFM2-1.2B-Tool:** chamou `ai__markAsRead({ articleId: 12345 })`, ferramenta que não existe, e depois explicou o erro
  em vez de corrigir.
- **LFM2.5-350M:** encadeou chamadas até o limite de 8 passos e não chegou a responder.
- **Qwen3.5-2B e 4B:** deixaram o estado certo, mas chegaram lá chamando `articles__getOne` em 1, 2 e 3 em vez de listar o
  projeto (5 passos em vez de 3). Ver "Correção da nota".

## Achados

1. **O prompt de ferramentas domina o tempo.** São cerca de 8 mil tokens de definições em cada episódio. No Qwen3.5-4B,
   no Qwen3.5-9B e no Gemma a GPU processa só 50 a 65 tokens/s de prompt (2,5 a 3,5 minutos por episódio); no Qwen3.5-2B,
   167; nos modelos da Liquid, 295 a 1 264. A mesma máquina, a mesma quantização. Isso reforça a abordagem de roteamento por assunto e as ferramentas
   "deferred" do LFM3: oferecer menos ferramentas por vez é o ganho de tempo mais barato.
2. **A GPU ajuda pouco nos modelos Liquid.** `llama-bench` no LFM3-1.7B: Vulkan 497 tok/s (pp512) e 27,5 (tg64); com
   `-ngl 0`, 358 e 25,9. A geração quase não muda. Não investiguei o motivo (as camadas de convolução do LFM talvez
   caiam para a CPU).
3. **Phi-4-mini está fora, por configuração, não por capacidade.** O template de chat do GGUF declara
   `supports_tools: false` (`/props`) e o `llama-server` descarta as ferramentas sem avisar: o prompt teve 203 tokens
   (contra cerca de 8 000), e o modelo só pediu confirmação em texto. O template oficial da Microsoft
   (`tokenizer_config.json`, 423 caracteres) também não renderiza `tools`, e o `llama.cpp` não saberia ler as chamadas
   do formato dele. Para avaliá-lo seria preciso um template e um parser próprios, ou chamada de ferramentas por
   texto. Ficou como pendência.
4. **Os dois Qwen3.5 passaram a pensar só porque eu desliguei.** Usei `enable_thinking: false`
   (`--chat-template-kwargs`), como o card manda para desligar. Nenhum pensamento foi gerado (`reasoning` vazio).

## Correção da nota (v1 para v2)

Na primeira rodada o Qwen3.5-2B e o 4B foram reprovados mesmo deixando o artigo 3 como lido, porque a nota exigia as
ferramentas da rota ideal. Isso penalizava uma rota válida e mais lenta. A v2 julga os casos que **alteram** a
biblioteca pelo estado final (`usedExpectedTools` fica só como informação) e mantém a exigência das ferramentas ideais
nos casos de leitura, onde responder sem consultar passaria sem merecer. A v1 está nas execuções de `fumaca-art-2`; a
v2 em `art-2-scorer-v2`. Só as duas execuções Qwen mudaram de resultado.

## Limites

- **Um caso por modelo.** Nenhuma conclusão sobre qual modelo é melhor: falta rodar os 72 casos.
- **Uma amostra por caso** (temperatura baixa, `seed 42`). Não medi variação entre repetições.
- **Tempo inclui o prompt de ferramentas inteiro.** Os números mudam com roteamento ou menos ferramentas.
- A resposta final em texto não é avaliada automaticamente; fica gravada no episódio para leitura.
- A repetição por modelo usou a mesma biblioteca e o mesmo `seed`, então o resultado de cada modelo foi igual nas duas
  rodadas (mesmos tokens), o que confirma que o executor é determinístico, mas não mede variação do modelo.

## Como repetir

```
npm --prefix emmas_librarian run rebuild:node
cd emmas_librarian
npx vite-node core/harness/eval/run/runEval.ts -- --model qwen3.5-4b --cases art-2 --label meu-teste
npx vite-node core/harness/eval/run/runEval.ts -- --model lfm3-1.7b --cases all      # os 72 casos
```

Modelos disponíveis: `core/harness/eval/run/modelCatalog.ts`. Cada execução grava uma pasta nova em `runs/`.

## Bateria de 72 casos: LFM3-1.7B, modo roteado (15/11/2026, 22h21 UTC)

Primeira bateria completa, com roteamento por assunto (`--mode routed`: o modelo começa só com `select_areas` e recebe
as ferramentas dos assuntos que escolher).

| | |
|---|---|
| Resultado | **59 de 72 (82%)** |
| Por tipo | caminho feliz 23/26, armadilha 10/14, erro esperado 2/4, recusa 24/28 |
| Tempo | 5 608 s (93 min); mediana de 70 s por caso |
| Chamadas ao modelo | 263; 197 399 tokens de prompt (397 tok/s) e 126 221 gerados (24,7 tok/s) |
| Falharam | mon-3, age-3, cat-3, doc-2, lix-2, lix-3, tri-1, tri-4, tri-5, tri-6, bus-2, rot-1, ctx-2 |

Observação: neste modo a **geração** domina o tempo (126 mil tokens a 24,7 tok/s são 85 dos 93 minutos), não o prompt.
No modo completo o prompt de ferramentas era o gargalo. Cada modo tem seu gargalo.

Registro: `runs/2026-11-15T22-21-37_lfm3-1.7b/`. O teste de fumaça do roteamento (`proj-1` 24 s e `art-2` 50 s, contra
35 s e 56 s no modo completo) está em `runs/2026-11-15T22-20-00_lfm3-1.7b/`.

## Mudança de plano (a pedido do autor)

A bateria seguiu para o LFM2.5-8B-A1B por segundos, e eu a abortei (`runs/2026-11-15T23-55-18_lfm2.5-8b-a1b/ABORTED.txt`).
Estimativa de continuar na RX 580: mais de 30 horas, com Qwen3.5-4B e Gemma 4 levando 5 a 6 horas por bloco.

Novo plano, em duas etapas, porque o critério do projeto é **viabilidade local**, não eficácia isolada (um modelo
perfeito que não roda na máquina da pessoa não serve):

1. **Eficácia no Google Colab** (GPU T4, bem mais rápida): os 72 casos em todos os modelos, nos dois modos. Os tempos de
   lá não valem. Notebook: `emmas_librarian/core/harness/eval/colab/avaliacao_colab.ipynb`.
2. **Tempo e memória na RX 580**: só nos modelos que passarem de um limiar de acerto no Colab (70% por padrão, mudável
   na célula de configuração). Modelos ineficazes não gastam hora de GPU local.

Para o notebook, o executor ficou portátil: caminho do servidor, pasta dos modelos, dispositivo, rótulo do backend e
pasta de saída vêm de variáveis de ambiente (`LLAMA_SERVER`, `LLAMA_MODELS_DIR`, `LLAMA_DEVICE`, `LLAMA_BACKEND`,
`LLAMA_BUILD`, `EVAL_RUNS_DIR`), com a máquina do autor como padrão. O encerramento do servidor funciona em Windows e em
Linux, e a configuração de cada execução passa a registrar o backend e o tamanho do arquivo do modelo.

**O notebook não foi executado**: não há Linux nem GPU CUDA nesta máquina. Foram verificados só a sintaxe de cada célula
Python e o executor localmente com os mesmos padrões. A célula 5 (a biblioteca F em SQLite real) e a célula 6 (o
`llama-server` CUDA listando a T4) são as que mais provavelmente precisarão de ajuste na primeira execução.

## Terceira abordagem: plano em tarefas (`--mode planned`)

Implementada em 2026-11-16, ainda sem nenhuma bateria rodada. O modelo trabalha em três etapas:

1. **Planejar**, sem ferramentas: recebe o pedido e a lista de assuntos e responde só com uma lista JSON
   `[{"assunto": "<id>", "tarefa": "<texto>"}]` (até 6 tarefas; `[]` se nada a fazer). Uma resposta que não é um plano
   válido é falha do modelo (`[ERR_INVALID_PLAN]`, com o texto que ele escreveu), sem tentativa de adivinhar.
2. **Executar uma tarefa por vez**: o assunto da tarefa é aberto para o modelo (ele não escolhe assuntos) e a tarefa roda
   como um episódio comum, com o resumo do que as anteriores encontraram. O limite de 8 passos vale para cada tarefa.
3. **Responder à pessoa** a partir dos resultados das tarefas, sem ferramentas.

A nota é a mesma (v2), calculada sobre as chamadas de todas as tarefas e o estado final da biblioteca. Diferenças em
relação ao roteado: o plano e a resposta final são chamadas a mais, e quem escolhe o assunto é o plano. O registro da
execução guarda `planPromptVersion` (`v1`) e, em cada episódio, o plano escrito pelo modelo.

Código: `core/harness/eval/run/taskPlan.ts` e `plannedEpisode.ts`. Uso:
`npx vite-node core/harness/eval/run/runEval.ts -- --model lfm3-1.7b --cases all --mode planned --label bateria-72-planned`.

## Eficácia no Colab (2026-11-16)

18 execuções completas (9 modelos x 2 modos x 72 casos), numa NVIDIA L4 (CUDA 13), registradas em
`emmas_librarian/core/harness/eval/runs/colab-2026-11-16/` (`index.jsonl`, `candidatos.json`, um diretório por execução,
`logs/` com a saída de cada uma). Mesmo código, prompt (v1), seed 42, casos e nota (v2) da máquina local.

| Modelo | Roteado | Completo |
|---|---|---|
| qwen3.5-9b | 61 (85%) | **64 (89%)** |
| lfm3-1.7b | 61 (85%) | 63 (88%) |
| qwen3.5-4b | 56 (78%) | 63 (88%) |
| gemma-4-e4b | 59 (82%) | 49 (68%) |
| qwen3.5-2b | 44 (61%) | 41 (57%) |
| lfm2.5-8b-a1b | 42 (58%) | 36 (50%) |
| lfm2.5-350m | 30 (42%) | 30 (42%) |
| lfm2-1.2b-tool | 28 (39%) | 29 (40%) |
| lfm2.5-1.2b-instruct | 28 (39%) | 29 (40%) |

Com o limiar de 70% em algum modo, passam ao teste de tempo local: **qwen3.5-9b, lfm3-1.7b, qwen3.5-4b e gemma-4-e4b**.

**Ressalvas do ambiente (o registro das execuções está errado nestes pontos):**
- O llama.cpp foi **compilado do `master`** no Colab (o agente do Colab trocou o binário `b12425` por `git clone`, por
  causa da CUDA 13), mas o `config.json` de cada execução diz `llamaCpp: b12425`. O commit real não foi gravado.
  `repoCommit` também ficou `unknown` (o código veio de um zip).
- Dispositivo `cuda0` e backend `cuda`. O `server.log` não traz a linha de offload da GPU neste formato de log; a prova
  de que rodou na GPU é a vazão: 8 a 9 mil tokens/s de prompt no LFM3, contra 360 na CPU local.
- Instalação com `npm install --legacy-peer-deps` em vez de `npm ci`, e modelos baixados depois sem hash (`sha256`
  `verificacao-rapida`). Nenhuma dessas mudanças altera o que o modelo recebe ou como a nota é calculada.
- Os tempos daqui (por exemplo, LFM3 completo em 17 min contra 86 min local) **não valem** para viabilidade.

**Calibração contra a máquina local (build b12425):** o LFM3 fez 61/63 no Colab (roteado/completo) contra 59/61 local,
dois casos a mais em cada modo. A diferença de versão do llama.cpp não parece pesar.

**Casos que quase todos os candidatos erram**, nas 8 configurações (4 modelos x 2 modos): `rot-1` em 8/8, `lix-2` e
`inv-2` em 6/8, `proj-5`, `proj-6`, `age-3`, `cat-3` e `doc-1` em 5/8. Em `rot-1` o Qwen3.5-9B fez o certo (marcou o
artigo como lido e escreveu no diário), mas a verificação exige que o diário termine com exatamente "Terminei.", e o
modelo escreveu "Terminei de ler o artigo 3.". É defeito do caso, não do modelo. Os demais precisam do mesmo exame.

### Primeiras tentativas do modo `planned` com o LFM3 (2026-11-16): o plano não sai

- **Prompt v1** (`runs/2026-11-16T17-02-49_lfm3-1.7b`, interrompida em 57/72, 24 acertos): o planejador recebia as regras do
  sistema ("se nenhuma ferramenta permite, diga que não tem acesso") sem ter ferramentas, e respondia em texto ("Não tenho
  acesso...") ou inventava o assunto (`"listar"`). Defeito do prompt; a execução ficou marcada com `ABORTED.txt`.
- **Prompt v2** (o planejador recebe só o contexto do dia e a lista de assuntos, e é proibido de responder em texto):
  o LFM3 **raciocina sem parar** antes de escrever a lista. O template dele não tem chave para desligar o raciocínio
  (não há `enable_thinking` no GGUF). Com limite de 512 tokens a resposta veio vazia; com 2048 estourou o limite nos 4
  casos da fumaça (`proj-1`, `art-1`, `proj-5`, `ia-1`), em 85 s cada. No fim do raciocínio ele já tinha o plano certo
  (`[{"assunto": "projetos", ...}]`), mas ainda conferindo a grafia dos ids. Nos modos completo e roteado, com ferramentas,
  o mesmo modelo não deliberava assim.
- Conclusão provisória: para o LFM3 o passo de planejar sem ferramentas custa de 1,5 a 5 minutos por pedido e, com o
  limite atual, falha. A abordagem só é justa se o planejamento puder ser limitado sem cortar a resposta.

- **Prompt v3** (o plano é entregue chamando a ferramenta `submit_plan`, com `tool_choice: required` e o assunto como
  `enum` dos ids): a saída passou a ter forma, mas o raciocínio continuou. Fumaça nos mesmos 4 casos
  (`fumaca-planned-v3`): 2 de 4. Planos de 1150 a 2048 tokens (47 a 85 s por plano). `proj-1` ("Quais projetos eu
  tenho?") veio com plano **vazio** e o modelo respondeu sem consultar; `art-1` bateu no limite de 2048 sem entregar o
  plano; `proj-5` e `ia-1` entregaram plano certo e passaram. A bateria de 72 não foi rodada: planejar custa mais de um
  minuto por pedido no LFM3 e ainda erra o plano em parte dos casos.

## Modelos de decisão para escolher o assunto (2026-11-16)

Pesquisa: "modelos de decisão" respondem perguntas fechadas (escolha, sim/não, nota) com probabilidades, sem gerar texto.
O Jev (TypeSafe) é só API hospedada, sem pesos, então não roda local
([post do Akita](https://akitaonrails.com/2026/10/03/entendendo-o-hype-do-jev-pra-que-serve/)). Os que rodam local no
llama.cpp (endpoint `/v1/systemone`, já presente no b12425): **LiquidAI d1-2B** (1,9B, português suportado) e **Kev-4B**
(Apache-2.0), os dois baixados em 2026-11-16 (`setup.jsonl`, com hash). O benchmark do Akita deu 87,5% ao Kev-4B em
tarefas que não são as nossas; os modelos de 0,6B e menores ficam perto do acaso e não foram testados.

Teste (sem modelo de linguagem, `core/harness/eval/decision/`, resultados em `runs/decision/`): para cada um dos 72
pedidos, o modelo de decisão escolhe entre os 15 assuntos, e se compara com o assunto das ferramentas que o caso espera.
44 casos precisam de pelo menos um assunto (3 precisam de dois); os 28 restantes são recusas.

| Configuração | Melhor assunto | Todos os necessários entre os 2 mais prováveis | Tempo por decisão | Tokens de entrada |
|---|---|---|---|---|
| d1-2B, só a escolha do assunto | 95,5% (42/44) | **100% (44/44)** | **0,79 s** | 366 |
| d1-2B, + 15 perguntas sim/não | 95,5% | 100% | 4,3 s | 1266 |
| d1-2B, + escolha entre as 81 ferramentas | 95,5% | 100% | 7,6 s | 2874 |
| Kev-4B, + 15 perguntas sim/não | 95,5% | 100% | 7,6 s | 1057 |

- **O melhor assunto erra em 2 de 44 casos** (d1-2B: `age-3`, `ctx-2`; Kev: `bus-3`, `ctx-1`), todos cobertos pelo
  segundo mais provável. Os 3 casos de dois assuntos (`art-1`, `art-3`, `rot-1`) só são cobertos com os 2 primeiros.
- **As perguntas sim/não por assunto não calibram**: nenhum limiar dá bom resultado. No d1-2B, com 0,5 acerta todos os
  assuntos em 75% dos casos mas sobram 2,2 assuntos por caso e 79% das recusas ganham algum; com 0,7 só 36%. Sem uso.
- **Escolher a ferramenta entre as 81 é fraco**: a primeira ferramenta esperada fica em 1º lugar em 59%, entre as 3
  primeiras em 70,5% e entre as 5 primeiras em 75%. Serve para o assunto, não para a ferramenta.
- O Kev-4B não ganha do d1-2B e é 2 a 7 vezes mais lento; o d1-2B ocupa 1,1 GB.
- Amostra pequena (44 casos, 3 de dois assuntos): o resultado indica a direção, não fixa o número.
- A execução do Kev-4B com as 81 ferramentas foi interrompida pelo sistema por falta de memória (o servidor do Kev
  chega a 5,7 GB residentes) e não foi repetida.

### Modo `decided`, LFM3 + d1-2B (2026-11-17): bateria parcial

Implementado (`--mode decided`): o d1-2B (porta 8090) escolhe os 2 assuntos mais prováveis do pedido, o LFM3 recebe só as
ferramentas deles (sem `select_areas`), e o completo assume se o roteador falha, ou se a tentativa restrita não responde
ou chama ferramenta fora dos assuntos **e nada alterou a biblioteca** (senão o pedido seria feito duas vezes). A reserva
por confiança ficou desligada (`--min-confidence 0`): a probabilidade do melhor assunto não separa acerto de erro (os 2
erros têm 0,57 e 0,77; há acertos em 0,61), e o segundo assunto já cobre os erros.

**A bateria foi interrompida pelo sistema por falta de memória** (`runs/2026-11-17T00-08-24_lfm3-1.7b`, com
`ABORTED.txt`), com os dois servidores abertos (LFM3 e d1-2B). **Só os primeiros 37 casos, até `ano-2`, são válidos**: nos
35 seguintes os dois servidores já não respondiam (`decision-error`, `model-error`), e esses episódios não contam.

Nos 37 casos válidos, mesmos casos nos três modos (LFM3-1.7B, RX 580):

| | Decided | Completo | Roteado |
|---|---|---|---|
| Acertos | **35/37** | 34/37 | 35/37 |
| Tempo médio por caso | **35,1 s** | 54,7 s | 72,4 s |
| Mediana | **26,8 s** | 52,8 s | 62,7 s |
| Ferramentas oferecidas (média) | 12,9 | 81 | 1 + as do assunto |

- Falhas do decided: `mon-3` (falha em todos os modos) e `ano-2`. Nenhuma reserva foi necessária nos 37.
- Decisão do d1-2B: 0,79 s por pedido.
- Amostra de 37 casos e diferença de 1 acerto: não dá para dizer que o decided acerta mais; dá para dizer que não acerta
  menos e que leva cerca de 36% menos tempo que o completo (e a metade da mediana). A bateria completa ainda não existe.

### Modo `decided`, LFM3 + d1-2B: os 72 casos (2026-11-17)

Os 35 casos que faltavam rodaram à parte (`runs/2026-11-17T00-34-09_lfm3-1.7b`, com o Chrome fechado e 9,8 GB livres, sem
interrupção). Junto com os 37 válidos da primeira execução, são os 72 casos, em duas execuções do mesmo código e da mesma
configuração (seed 42). A reserva no completo **não foi acionada em nenhum dos 72 casos**.

| LFM3-1.7B, RX 580 | Decided | Completo | Roteado |
|---|---|---|---|
| Acertos | **63/72 (87,5%)** | 61/72 (84,7%) | 59/72 (81,9%) |
| Caminho feliz | 24/26 | 23/26 | 23/26 |
| Armadilha | 10/14 | 10/14 | 10/14 |
| Erro esperado | 3/4 | 2/4 | 2/4 |
| Recusa | 26/28 | 26/28 | 24/28 |
| Tempo médio por caso | **51,6 s** | 71,6 s | 77,9 s |
| Mediana | **35,0 s** | 56,7 s | 69,8 s |

- **Falhas do decided (9):** `mon-3`, `cat-3`, `bus-2`, `rot-1`, `ctx-2` (falham também no completo e no roteado),
  `ano-2`, `tri-1`, `tri-6`, `pri-1`.
- **Só o decided falha (2):** `ano-2` e `pri-1`. **O decided acerta e o completo erra (6):** `age-2`, `age-3`, `doc-1`,
  `lix-2`, `tri-2`, `inv-1`.
- **Tempo:** 28% a menos de média que o completo e 38% a menos de mediana. A decisão do d1-2B leva 0,79 s; o resto é o
  LFM3 com 13 ferramentas em média no prompt em vez de 81.
- **Ressalva de ruído:** a diferença para o completo (2 casos de 72) está dentro do que a amostragem pode mudar, e cada
  modo foi rodado uma vez. Não afirmo que o decided acerta mais; afirmo que não acerta menos e que é mais rápido.
- **Cobertura da reserva:** como nunca disparou, a regra de reserva só foi exercitada nos testes unitários, não numa
  falha real do roteador.

## Revisão dos 5 casos que o LFM3 erra nos três modos (2026-11-17)

`mon-3`, `cat-3`, `bus-2`, `rot-1` e `ctx-2` falham no LFM3 completo, roteado e decided. Li a especificação de cada um e o
que os modelos fizeram, no LFM3 e nos modelos do Colab (Qwen3.5 4B/9B, Gemma 4):

| Caso | Veredito | O que se vê |
|---|---|---|
| `rot-1` | **defeito do caso, corrigido** | Todos os modelos marcam o artigo 3 como lido e escrevem no diário, mas a verificação exigia que o diário terminasse em exatamente "Terminei.". "Terminei o artigo 3.", "terminei" e "Terminei de ler o artigo 3." reprovavam. Trocada por `diaryAppended` (a entrada adicionada contém "terminei", sem diferenciar maiúsculas, e o que havia antes fica). |
| `mon-3` | **verificação fraca, corrigida; falha do LFM3 mantida** | O caso esperava que o modelo explicasse as opções "e não escolhesse 14 sem perguntar", mas `checks` estava vazio, então Qwen 4B/9B, que gravaram 14 dias em silêncio, passavam. Agora `unchanged` (e o snapshot passou a cobrir o monitor de buscas). O LFM3 repete `searchMonitor__set` com 1, 7 e 14 dias até estourar o limite de passos: falha real do modelo. |
| `cat-3` | falha do modelo, caso correto | A recusa é o certo: não há ferramenta que atribua categoria a artigo. LFM3 e Qwen criam uma categoria "Metodologia" para contornar, o que muda a biblioteca. Só o Gemma 4 recusa. |
| `ctx-2` | falha do modelo, caso correto | Sem projeto em foco e com dois projetos, o certo é perguntar qual. LFM3 listou os projetos, escolheu o 1 e consultou os artigos. Qwen 4B/9B e Gemma perguntam. |
| `bus-2` | falha do modelo; achado sobre a ferramenta | LFM3 e Qwen não chamam `search__translateQuery`: pedem informação extra (artigo, projeto). Só o Gemma chama, depois de errar a forma do argumento. O esquema da ferramenta é uma `anyOf` aninhada e **a ferramenta não traz descrição em linguagem natural do que faz**. Não alterei o caso: o ponto a melhorar está na ferramenta, não na avaliação. |

Efeito estimado das duas correções nos resultados já gravados (re-pontuação offline pelas chamadas gravadas, não
repetição): `rot-1` passa a ser acertado em quase todas as configurações que já escreviam no diário, e `mon-3` deixa de
ser acertado por Qwen3.5 2B/4B/9B (ficam só Gemma 4, que pergunta). Para os quatro candidatos o saldo é de mais um e
menos um caso. Verificação de ponta a ponta no LFM3 decided: `rot-1` passa; `mon-3` continua falhando.

**Os números das tabelas anteriores não foram refeitos e usam os casos antigos** (`casesSha` diferente nas execuções
novas). Execuções novas com este conjunto não são comparáveis caso a caso nesses dois pontos com as anteriores.

## `decided` e `planned` no Colab, seis modelos (2026-11-17)

Notebook `avaliacao_abordagens_colab.ipynb`, L4 (CUDA0), llama.cpp `b12425@18b74fa`, d1-2B como modelo de decisão
(`--top-areas 2`), 72 casos por modo, uma execução e uma semente. Execuções em `runs/colab-2026-11-17/`. A fumaça (4 casos
por modo, LFM3) passou antes da bateria.

Acertos em 72 casos (tempo médio por caso). `full` e `routed` vêm do Colab de 2026-11-16, com os casos antigos.

| Modelo | decided | planned | full | routed |
|---|---|---|---|---|
| lfm3-1.7b | 62 (10,6 s) | 30 (21,8 s) | 63 (14,1 s) | 61 (15,4 s) |
| qwen3.5-9b | 59 (3,0 s) | 56 (4,9 s) | 64 (4,1 s) | 61 (4,4 s) |
| qwen3.5-4b | 59 (1,6 s) | 60 (3,4 s) | 63 (2,2 s) | 56 (2,2 s) |
| gemma-4-e4b | 58 (8,0 s) | 63 (17,3 s) | 49 (12,6 s) | 59 (8,4 s) |
| qwen3.5-2b | 54 (2,2 s) | 31 (2,5 s) | 41 (2,1 s) | 44 (1,7 s) |
| lfm2.5-8b-a1b | 41 (3,4 s) | 17 (10,4 s) | 36 (4,1 s) | 42 (3,7 s) |

Comparação limpa (70 casos, sem `rot-1` e `mon-3`, que mudaram), `decided` contra `full`: LFM3 61 contra 63; Qwen 9B 58
contra 63; Qwen 4B 58 contra 62; Gemma 56 contra 48; Qwen 2B 54 contra 40; LFM2.5-8B 41 contra 36.

- **decided** ficou mais rápido que o `full` em 5 dos 6 modelos (de 25% a 36% nos que melhoram; LFM3 14,1 s para
  10,6 s). A decisão custa 36 ms por caso. Empata no LFM3, perde 4 a 5 casos nos Qwen 4B/9B e ganha muito no Qwen 2B e no
  Gemma.
- **planned** é pior ou mais lento na maioria (LFM3 29, LFM2.5-8B 17), como no local. Exceção: Gemma 4 E4B, 62 contra 48
  do `full`, a 17 s por caso. Qwen 4B chega perto do `full` (59 contra 62).
- **Fallback para o `full`:** raro. Qwen 2B 6 vezes e Qwen 9B 1 vez, sempre "unanswered"; nos outros nunca. A regra de
  segurança quase não foi exercitada.
- Os números do LFM3 batem com o local (62 no Colab contra 63 no Vulkan).
- Ressalva: uma execução por modo; diferenças de 2 a 3 casos estão no ruído.
- **Alteração no notebook durante a rodada:** o clone do llama.cpp falhou por SSL no Colab e a célula 6 passou a rodar
  `git config --global http.sslVerify false` e, se o clone falhar, tenta de novo por `http://`. A tag é a mesma
  (`b12425`) e as 14 execuções gravaram `b12425@18b74fa`, o commit do binário local (`build 12425, commit 18b74fa41`),
  então os resultados não são afetados. O notebook do repositório agora tem essa alteração e um `assert` que confere o
  commit `18b74fa` depois do clone, para que a replicação não dependa da confiança na rede.

## Descrição de `search:translateQuery` (2026-11-19, #201)

O caso `bus-2` falhava em todos os modos porque a ferramenta só tinha o esquema do argumento. Agora ela diz em linguagem
natural que converte uma busca para o formato de cada base e que não busca artigos.

- Primeira redação ("só traduz, não busca"): `bus-2` passou, mas `bus-3` (buscar de verdade no OpenAlex e no Scopus)
  virou uma tradução e falhou.
- Redação atual, com "para buscar artigos use search__preview": `bus-2` e `bus-3` passam juntos (LFM3-1.7B, `decided`).
- Uma execução por caso, uma semente: não prova que não haja efeito colateral em outros casos.
- A bateria completa foi iniciada duas vezes e **não valeu** (`2026-11-19T00-02-16_lfm3-1.7b`, interrompida pelo sistema
  por falta de memória; `2026-11-20T20-14-18_lfm3-1.7b`, com o servidor de decisão parado em 25 casos). Refeita fora do
  Claude Code em 2026-11-24, abaixo.

### Baterias de 72 casos com a ferramenta nova (2026-11-24, RX 580, Vulkan, `seed 42`)

Três execuções, uma por vez, fora do Claude Code. Nas duas em modo `decided` o d1-2B respondeu nos 72 casos, sem nenhuma
reserva acionada (`fallbacks: none 72`), então elas medem a combinação de fato.

| | LFM3-1.7B `decided` | Qwen3.5-4B `decided` | Qwen3.5-4B `full` |
|---|---|---|---|
| Acertos | **64/72 (88,9%)** | 59/72 (81,9%) | 61/72 (84,7%) |
| Caminho feliz | 24/26 | 21/26 | 22/26 |
| Armadilha | 12/14 | 7/14 | 9/14 |
| Erro esperado | 3/4 | 3/4 | 3/4 |
| Recusa | 25/28 | 28/28 | 27/28 |
| Mediana por caso | 33,7 s | **13,3 s** | **10,8 s** |
| Tempo total | 60,7 min | **18,6 min** | 31,7 min |
| Execução | `2026-11-24T09-13-45_lfm3-1.7b` | `2026-11-24T10-14-57_qwen3.5-4b` | `2026-11-24T10-33-59_qwen3.5-4b` |

- **Falhas do LFM3 `decided` (8):** `mon-3`, `ano-2`, `cat-3`, `tri-1`, `tri-3`, `tri-6`, `pri-1`, `ctx-2`. `bus-2` e
  `bus-3` passam, e `rot-1` também (as correções de `rot-1` e da descrição de `translateQuery` valeram nesta bateria).
  `ctx-2` quebrou uma regra (chamou `articles__getByProject`) e `mon-3` parou por `max-steps`.
- **Falhas do Qwen `decided` (13):** `proj-3`, `proj-5`, `proj-6`, `art-2`, `mon-3`, `lix-2`, `tri-1`, `tri-6`, `pri-1`,
  `inv-2`, `bus-3`, `ctx-1`, `ctx-2`. **Do Qwen `full` (11):** `proj-3`, `proj-5`, `proj-6`, `art-2`, `mon-3`, `cat-3`,
  `doc-1`, `lix-2`, `inv-2`, `bus-3`, `rot-1`.
- **Só o `decided` do Qwen falha (5):** `ctx-1`, `ctx-2`, `pri-1`, `tri-1`, `tri-6`. **Só o `full` falha (3):** `cat-3`,
  `doc-1`, `rot-1`. `mon-3` falha nas três.
- **Qwen e as armadilhas:** os dois modos do Qwen erram `proj-3`, `proj-5` e `proj-6` (armadilhas), onde o LFM3 acerta.
  Ele recusa melhor (28/28 no `decided`), mas cai em armadilhas (7/14 no `decided`, contra 12/14 do LFM3). Não li os
  episódios para dizer por quê.
- **Tempo:** o Qwen é de 2,5 a 3 vezes mais rápido que o LFM3 por caso na mediana, porque gera muito menos texto (6,5 a
  7,7 mil tokens contra 80 mil do LFM3). O `decided` do Qwen não foi mais rápido que o `full` na mediana (13,3 s contra
  10,8 s), mas foi no total (18,6 min contra 31,7 min).
- **`bus-3` do Qwen** terminou por `max-steps` no `decided` e por `model-error` no `full`. É o caso que a primeira
  redação da descrição de `translateQuery` quebrava; com a redação atual o LFM3 passa, o Qwen não.
- **Ressalva:** uma execução por caso e por modo, com uma semente. A diferença entre o `decided` e o `full` do Qwen (2
  casos de 72) está dentro do ruído, e comparar o Qwen com o LFM3 em armadilhas (7/14 contra 12/14) é o que mais se
  sustenta. A pergunta de ter o Qwen3.5-4B como alternativa ao LFM3 fica: ele é bem mais rápido, mas acerta menos.

