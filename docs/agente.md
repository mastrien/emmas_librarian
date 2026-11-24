# Agente local: modelos, licenças e distribuição

Registro do que cada peça do agente local permite (issue #196, plano em `docs/planos/2026-11-18_agente_local_no_cli.md`).
Lido em 2026-11-18 nas páginas oficiais; confira de novo antes de publicar uma versão com o agente.

## Peças e licenças

| Peça | Arquivo | Licença | Observação |
|---|---|---|---|
| LFM3-1.7B (modelo de linguagem) | `LFM3-1.7B-Q4_K_M.gguf`, 1,1 GB | LFM Open License v1.0 (`lfm1.0`) | Ver abaixo. |
| d1-2B (modelo de decisão) | `d1-2B-Q4_K_M.gguf`, 1,10 GB | LFM Open License v1.0 (`lfm1.0`) | Mesma licença. A página do modelo não traz o texto. |
| llama.cpp `b12425` (servidor) | binário ou compilação própria | MIT | Pede manter o aviso de copyright. |

## LFM Open License v1.0, o que importa

Fonte: https://www.liquid.ai/lfm-license (resumo, não é aconselhamento jurídico).

- **Uso comercial só até US$ 10 milhões de receita anual** da empresa (incluindo as controladas). Acima disso o direito
  comercial termina e é preciso licença da Liquid AI. Pesquisa e sem fins lucrativos não têm esse limite.
- **Redistribuir** exige: entregar uma cópia da licença, marcar arquivos modificados, manter os avisos de copyright e
  atribuição e incluir o arquivo NOTICE, se houver.
- **Marcas** só para dizer a origem do trabalho. Sem garantia. Processar por patente sobre o trabalho encerra as licenças de
  patente. Descumprir a licença a encerra, e então é preciso apagar todas as cópias.
- **Sem copyleft:** não obriga a abrir o código do que se constrói por cima.

## Distribuição: baixar no primeiro uso (implementado, issue #198)

**Baixar no primeiro uso, com consentimento, e não empacotar.**

- Cada arquivo pesa cerca de 1,1 GB: empacotar dobraria o instalador por um recurso que nem todos usarão.
- Baixar de `huggingface.co` direto para a máquina da pessoa evita que o Emma's Librarian seja o distribuidor do modelo; o
  aplicativo mostra a licença e o tamanho e só baixa depois do "sim".
- O download confere `sha256` e é retomável (issue #198). Nada é baixado sem a pessoa aceitar.
- Se o aplicativo vier a ter receita acima do limite, ou se a licença mudar, a escolha do modelo padrão se reavalia.

## Qual modelo de linguagem (issue #201)

O Qwen3.5-4B (Apache-2.0, sem limite de receita) foi medido nesta máquina (RX 580, Vulkan) em 2026-11-24, nos mesmos 72
casos do LFM3-1.7B (detalhes em `docs/avaliacao-modelos.md`, seção das baterias de 2026-11-24):

- LFM3-1.7B `decided`: 64/72, mediana de 33,2 s por caso. Qwen3.5-4B `decided`: 59/72 (`full`: 61/72), mediana de 13,1 s
  (`full`: 10,8 s).
- O Qwen é mais rápido, porém menos preciso nas armadilhas (7/14 no `decided`, contra 12/14 do LFM3): ele pergunta em
  texto em vez de chamar a ferramenta que dispara a confirmação do sistema.
- Decisão do autor: manter os dois como opção final e avaliar no uso real. Nenhuma troca de modelo padrão foi decidida.

## Limitações conhecidas

- Ctrl+C durante o `cli ask` pode deixar os servidores llama-server vivos (não há tratamento de SIGINT/SIGTERM).
- As portas dos dois servidores são escolhidas sem reserva: outro processo pode ocupar uma entre a escolha e a subida.
- O diálogo de confirmação mostra só os primeiros 200 caracteres de cada chamada.
- O `cli ask` não mostra o progresso do download no Windows, porque o stderr do executável do Electron não aparece.

## O que fica por conferir

- O texto da licença acompanha o arquivo do modelo no Hugging Face? Hoje o cartão só mostra a sigla `lfm1.0`.
- Se o aplicativo for distribuído por uma instituição ou empresa, a regra de receita se aplica a ela.
