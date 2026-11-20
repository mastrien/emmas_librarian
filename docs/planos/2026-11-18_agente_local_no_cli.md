# Agente local no CLI: LFM3-1.7B + `decided`

Plano para levar ao produto a combinação que a avaliação da épica #27 indicou, em passos pequenos e na ordem em que
cada um depende do anterior. Os números e o método estão em `docs/avaliacao-modelos.md`; o harness, em
`docs/harness.md`. Este plano não altera código.

## Decisões já tomadas (2026-11-18)

- **Combinação padrão:** LFM3-1.7B (Q4_K_M) com o modo `decided`: o d1-2B escolhe até 2 assuntos, o LFM3 trabalha só com
  as ferramentas deles e, se não responder e não tiver mudado a biblioteca, o conjunto completo assume.
- **Por quê esta:** é a única medida na máquina do autor (RX 580 8 GB, Vulkan): 63 de 72 casos (87,5%) contra 61 do
  `full`, 28% mais rápida. No Colab, 62 de 72 e 25% mais rápida. O d1-2B acerta o assunto em 95,5% e o assunto
  necessário está sempre entre os 2 escolhidos.
- **Primeira superfície:** o CLI (`cli ask "..."`). Reaproveita a confirmação por terminal e não exige interface nova.
- **Não decidido:** outros modelos (Qwen3.5-4B/9B, Gemma 4) ficam como configuração futura; Qwen 4B nunca foi medido
  localmente.

## Passos

Cada passo é um commit semântico (ou uma PR pequena), com teste e sem depender de rede.

1. **Licenças e distribuição.** Ler e registrar as licenças do LFM3-1.7B e do d1-2B (LFM Open License) e do llama.cpp
   (MIT): o que permitem para um app distribuído, e se o modelo é baixado no primeiro uso, com consentimento, ou
   empacotado. Nada é baixado sem o consentimento da pessoa. Saída: seção em `docs/agente.md`.
2. **Núcleo do agente fora do `eval/`.** Mover para `core/agent/` o que não é avaliação: o laço de episódio, o cliente de
   chat, o cliente do modelo de decisão (`/v1/systemone`), o `RoutedToolkit`, a regra `changedLibrary` e a escolha de
   assuntos. O `eval/` passa a importar de lá. Interfaces injetadas: `ChatModel`, `DecisionModel`, `Confirmer`.
   Testes existentes passam sem mudança de comportamento.
3. **Runtime dos modelos.** Um gerenciador que sobe e derruba o `llama-server` (versão fixada em `b12425`): escolhe o
   dispositivo (Vulkan, CUDA ou CPU), porta livre, espera ficar pronto, encerra com o comando. Download com `sha256`
   conferido e arquivo parcial recomeçável. Testado com um servidor falso nomeado, nunca com o real.
4. **Confirmação e acesso.** Ligar o `Confirmer` ao terminal: toda ferramenta com `confirm` pergunta antes e mostra o que
   vai mudar; as `localOnly` não rodam se a rede não for permitida; os parâmetros escondidos não aparecem ao modelo. Sem
   `--yes`: quem quiser automatizar usa os comandos do CLI diretamente.
5. **`cli ask`.** Comando que junta 2, 3 e 4: pergunta em linguagem natural, resposta em texto (ou `--json`), códigos de
   saída claros, `--data-dir` como nos demais comandos, e um registro do que o agente chamou. Documentar em
   `docs/cli.md`.
6. **Qualidade e regressão.** Melhorar a descrição de `search:translateQuery` (sem descrição em linguagem natural hoje),
   refazer as tabelas com os casos corrigidos (`rot-1`, `mon-3`) e deixar uma bateria curta (os 4 casos de fumaça) que
   rode sob demanda, não no CI. Medir o Qwen3.5-4B localmente para decidir se vira alternativa.

## Dependências

`1` antes de empacotar ou baixar qualquer coisa; `2` antes de `3`, `4` e `5`; `3` e `4` antes de `5`; `6` pode andar em
paralelo a partir do `2`.

## Fora do escopo

Painel de chat no aplicativo, mobile e agente com acesso à rede ficam para depois do CLI estar em uso. O `planned` não
entra: só compensou no Gemma 4 E4B, a 17 s por caso no Colab.

## Riscos

- O LFM3 pode escrever na biblioteca sem a pessoa perceber se a confirmação falhar: o passo 4 tem teste de que nenhuma
  ferramenta com `confirm` roda sem resposta afirmativa.
- Um modelo de 1,7 B erra: 9 dos 72 casos falham mesmo assim (`cat-3`, `ctx-2`, `bus-2` e outros). A resposta do agente
  deve mostrar as chamadas feitas, para a pessoa conferir.
- Uma execução por configuração, uma semente: diferenças de 2 a 3 casos estão no ruído.
