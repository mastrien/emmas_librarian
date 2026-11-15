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
