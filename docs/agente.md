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

## Decisão proposta (aguarda confirmação do autor)

**Baixar no primeiro uso, com consentimento, e não empacotar.**

- Cada arquivo pesa cerca de 1,1 GB: empacotar dobraria o instalador por um recurso que nem todos usarão.
- Baixar de `huggingface.co` direto para a máquina da pessoa evita que o Emma's Librarian seja o distribuidor do modelo; o
  aplicativo mostra a licença e o tamanho e só baixa depois do "sim".
- O download confere `sha256` e é retomável (issue #198). Nada é baixado sem a pessoa aceitar.
- Se o aplicativo vier a ter receita acima do limite, ou se a licença mudar, a escolha do modelo padrão se reavalia. O
  Qwen3.5-4B (Apache-2.0, sem limite de receita) é a alternativa já medida no Colab (63 de 72 casos com todas as
  ferramentas), mas nunca foi medido nesta máquina (issue #201).

## O que fica por conferir

- O texto da licença acompanha o arquivo do modelo no Hugging Face? Hoje o cartão só mostra a sigla `lfm1.0`.
- Se o aplicativo for distribuído por uma instituição ou empresa, a regra de receita se aplica a ela.
