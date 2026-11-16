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
