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

## Distribuição: baixar no primeiro uso (implementado, issue #198; a decisão de distribuição ainda é para o autor confirmar)

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

## Leitura dos textos das licenças (2026-11-24)

Lidos no site da Liquid AI, nos repositórios do Hugging Face e no GitHub. Não é aconselhamento jurídico.

**LFM Open License v1.0** (`https://www.liquid.ai/lfm-license`; o mesmo texto está no arquivo `LICENSE` de `LiquidAI/LFM3-1.7B-GGUF` e de
`LiquidAI/d1-2B-GGUF`):

- O limite de receita só condiciona o **uso comercial**: a Seção 5(a) diz que os direitos de uso comercial dependem de "You or
  Your Legal Entity" não ultrapassar o limite (`annual revenue of 10 million United States dollars`). "Commercial Use" é "any use of
  the Work for direct or indirect commercial advantage or monetary compensation". Passado o limite, o uso comercial "is not licensed".
- **Quem é o licenciado é quem usa o modelo**: "You" é "an individual or Legal Entity exercising permissions granted by this
  License". Como o aplicativo baixa o modelo na máquina de cada pessoa, a licença vale entre a Liquid AI e quem usa, não só
  entre a Liquid AI e o autor do aplicativo. A receita do autor ser zero não resolve o caso de um usuário institucional.
- Não há definição de uso pessoal. A isenção expressa do limite é só para "Qualified Non-Profit Organization" (entidade
  organizada e operada exclusivamente para fins religiosos, de caridade, científicos etc., isenta pela Seção 501(c)(3) dos Estados
  Unidos "or foreign equivalent"). O resumo da página diz que pesquisa e uso sem fins lucrativos não têm limite, mas esse texto é
  mais amplo que a cláusula. Se uma universidade pública brasileira é "equivalente estrangeiro" não está dito.
- O texto principal escreve "Non-Commercial or Research Purposes" e o quadro de diferenças escreve "and": divergência de redação.
- Redistribuição (Seção 4): permitida, entregando cópia da licença, marcando arquivos modificados e mantendo os avisos. O FAQ
  trata a hospedagem em plataformas como canal de distribuição, que não é uso comercial. A página não diz se um aplicativo que
  baixa direto do Hugging Face para o usuário final conta como distribuição feita pelo autor do aplicativo.
- Rescisão automática se qualquer condição for descumprida (Seção 11). Não encontrei cláusula de lei aplicável nem de foro.
- Não está esclarecido: o ano fiscal de referência da receita, se conta a receita de qualquer produto ou só do modelo, e as
  condições da licença comercial acima do limite (o FAQ manda escrever a `sales@liquid.ai`).
- O cartão de cada modelo mostra só a sigla `lfm1.0`; o texto da licença acompanha os arquivos do repositório (`LICENSE`, 10,6 kB).
  O cartão do d1-2B diz que o modelo é "built on LFM3-VL-2B", e a licença desse modelo base não foi verificada.

**Qwen3.5-4B**: Apache-2.0 nos metadados de `Qwen/Qwen3.5-4B` e de `unsloth/Qwen3.5-4B-GGUF`, e o `LICENSE` do repositório da Qwen é o
texto completo da Apache 2.0. Não encontrei limite de receita, de usuários, política de uso aceitável nem exigência de atribuição
além da Seção 4 da Apache. O repositório da unsloth, de onde baixamos o arquivo, **não tem arquivo `LICENSE` nem `NOTICE`**: a
licença aparece só nos metadados.

**llama.cpp**: MIT, "Copyright (c) 2023-2026 The ggml authors".

**O que isso significa para o aplicativo** (a decisão de distribuição é do autor):

- Para quem usa o aplicativo por conta própria, para pesquisa, ou numa instituição sem fins lucrativos reconhecida, o LFM não
  traz limite. O ponto de atenção é o uso comercial por quem tem receita de US$ 10 milhões ou mais, inclusive empresas que
  adotem o aplicativo: para elas o LFM3 não está licenciado, e o Qwen3.5-4B (Apache-2.0) está.
- O aplicativo já mostra a licença e pede o "sim" antes de baixar. Para o LFM, vale mostrar também o aviso de que o limite é de
  quem usa.
- O texto da licença do Qwen deveria vir da fonte oficial (`Qwen/Qwen3.5-4B`), já que a cópia da unsloth não o traz.

## O que fica por conferir

- A licença do modelo base do d1-2B (`LFM3-VL-2B`) e se há `NOTICE`.
- Se o aplicativo for distribuído por uma instituição ou empresa, a regra de receita se aplica a ela.
