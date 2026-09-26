---
name: emma-tutorial-writing
description: How to write the Emma's Librarian tutorials (landing_page/tutoriais.html) and any other user-facing prose in João Pedro's own voice, in Portuguese, without the tells of AI-generated text. Use this whenever you write or revise a tutorial chapter, landing page copy, release notes, help text or README prose meant for users, even if the user only said "escreve o capítulo X". Pair with the humanizer skill when it is installed.
---

# Escrever os tutoriais na voz do autor

Os tutoriais precisam soar como o João escrevendo, não como um folheto de produto.
A referência de estilo está em `writing_style_reference/` (dois PDFs e os posts
listados em `posts.txt`). Este arquivo resume o que foi extraído deles. Quando o
autor corrigir um rascunho, registre a correção na seção **Correções do autor**
no fim deste arquivo, porque elas valem mais do que qualquer inferência feita aqui.

## Fluxo de trabalho

1. O autor explica como uma parte do sistema funciona. Não invente comportamento:
   se algo não foi explicado e não está claro no código, pergunte ou marque
   `[CONFIRMAR: ...]` no texto.
2. Escreva o rascunho do capítulo seguindo as seções abaixo.
3. Antes de entregar, passe o checklist do fim do arquivo (e o humanizer, se instalado).
4. Aplique as correções do autor e registre o padrão por trás delas aqui.

## A voz

O registro dos posts do dev.to é o alvo. É didático, conversado e honesto.

**Fala com o leitor.** "você" para o leitor, "vamos" para o que fazemos juntos,
"eu" quando é opinião ou experiência do autor.
- "Vamos entender como funciona cada uma delas."
- "Vamos supor que queremos, com a filtragem colaborativa, descobrir..."
- "Para entender melhor a diferença, vamos ver o que elas **realmente** são."

**Pergunta e responde.** Perguntas retóricas curtas quebram a explicação e
antecipam a dúvida do leitor. Às vezes viram título de seção.
- "Faz sentido, não? Afinal nesse caso apenas uma classe pode estar correta..."
- "Agora temos um problema... E agora?"
- Títulos como "Mas por que?", "Ok, mas e o Polimorfismo?", "Entendi, mas pra que serve isso?"
- A objeção do leitor aparece como citação: `> "Ué, mas se tem o objeto na memória, por que...?"`

**Mostra com exemplo concreto, passo a passo.** Valores reais, estado antes e
depois de cada passo, nomes de pessoas nos exemplos (Alice, Fábio, Nathan). Nos
tutoriais, isso vira um projeto de exemplo que atravessa o capítulo (por exemplo,
o projeto "Previsão Climática de Precipitação" do artigo do WorCAP), com números
e cliques de verdade.

**Usa analogia caseira e avisa quando inventou algo.** O "abacate" para explicar
fatiamento de objeto; o "grau de sublista" com a ressalva: "O termo 'grau' de
sublista não é algo que realmente existe, estou usando esse termo só para fins de
explicação".

**É honesto sobre limites.** Diz o que o texto não cobre e por quê ("aqui não vai
ter código de fato... escolhi fazer dessa forma pois o objetivo não é..."), admite
incerteza ("Eu não sei se é tecnicamente correto, mas o modelo mental que eu tenho
é..."), e aponta problemas da própria abordagem ("Entretanto, esse modelo tem um
problema já conhecido."). Nos tutoriais: dizer quando um recurso depende de API
key, quando a busca pode falhar por limite de API, o que a IA pode errar.

**Explica o porquê, não só o como.** O artigo do WorCAP conta as decisões com as
razões reais, inclusive as pouco glamourosas ("por motivos de conhecimentos
prévios da equipe disponível"). Em um tutorial, cada recurso vem com o problema
que ele resolve ("Conforme o sistema é utilizado, itens mais antigos acumulam
interações de modo que...").

**Retoma o que já foi dito.** "Lembra quando eu disse que...", "Lembra que no
exemplo do abacate...", "como observado anteriormente".

### Marcas de linguagem

- Conectivos que ele usa: "Entretanto", "Apesar disso", "Ou seja", "Isto é",
  "Em outras palavras", "afinal", "Por fim", "Agora", "Logo", "Note que",
  "Observe", "Como você pode ver", "Nesse caso", "Por exemplo".
- Coloquialismo leve e pontual: "pra", "tipo", "Bom,", "a grosso modo", "entende?",
  "tudo certo!", "Perfeito,". Um ou dois por seção, não em toda frase.
- Parênteses para esclarecer na hora: "(no nosso caso, o número 1)",
  "(avaliar bem, por exemplo)".
- Termos técnicos em inglês ficam em inglês, em itálico na primeira aparição, com
  a tradução ao lado: "mergear (mesclar)", "_Selection Sort_ (Ordenação por
  Seleção)". Nomes de botões e telas aparecem exatamente como na interface.
- **Negrito** para o conceito-chave da frase, com moderação.
- Apartes em citação começando com "Observação:" para desvios que não cabem no
  fluxo principal.
- Frases longas encadeadas por vírgulas são normais nele; não picote tudo em
  frases curtas de efeito.

### Abertura e fechamento

- Abre com o contexto e a motivação, às vezes pessoal: "Recentemente estava
  tentando fazer...", "Hoje pretendo escrever um pouco sobre...", "Nesta seção
  vamos estudar...".
- Fecha com "E é isso!" (ou "E por agora é isso."), uma frase de esperança de que
  ajudou e um convite para dúvidas e correções. No último capítulo cabe o
  "Bons estudos, e até mais o/". Nos capítulos intermediários, prefira uma ponte
  curta para o próximo capítulo.

### Registro formal (só quando pedido)

No texto acadêmico ele usa voz impessoal ("aplicou-se", "observaram-se",
"acreditava-se"), números exatos (772 testes, 17 artigos, 96 trabalhos) e
narrativa cronológica das decisões. Os tutoriais **não** usam esse registro, mas
herdam dele a precisão: números concretos em vez de "diversos", "vários".

## O que não fazer (marcas de texto gerado por IA)

O texto atual de `tutoriais.html` é o contraexemplo: "estação de trabalho completa",
"leitura acadêmica imersiva e sem distrações", "poupando horas de buscas manuais".

- **Vocabulário de folheto**: robusto, poderoso, completo, intuitivo, perfeito,
  imersivo, sem esforço, fluido, "de ponta", "leve sua pesquisa ao próximo nível",
  "tudo em um só lugar". Se a frase serviria para qualquer produto, apague.
- **Promessas absolutas**: "garantindo que", "total privacidade", "estritamente".
  Diga o que o sistema faz ("os PDFs ficam salvos só no seu computador") e deixe o
  leitor concluir.
- **Trios de adjetivos ou benefícios** ("rápido, simples e seguro") e o molde
  "não apenas X, mas também Y".
- **Travessão (—) como pontuação principal.** O autor usa vírgula e parênteses.
- **Listas com rótulo em negrito + dois-pontos** em toda seção. Ele escreve em
  parágrafos; lista só para itens realmente paralelos (passos, opções de um menu).
- **Emoji em títulos ou bullets.** O único "emoji" dele é ";)" ou "o/" no final.
- **Resumo no fim** ("Em resumo...", "Com isso, você aprendeu a..."). Ele fecha com
  "E é isso!", não recapitula.
- **Imperativo seco em sequência** ("Clique. Defina. Exporte."). Prefira "Para
  criar um projeto, clique em **Novo Projeto**..." e explique o que acontece depois.
- **"Basta..."/"simplesmente"**: minimiza a dificuldade do leitor.
- **Sinônimos rodando** para não repetir palavra (artigo/publicação/trabalho/
  documento para a mesma coisa). Escolha um termo e mantenha.
- **Voz passiva vaga e sujeito oculto genérico** nos tutoriais ("é possível
  realizar a configuração"). Use "você pode configurar".
- **Frases de efeito curtas** para dar ritmo ("E o melhor: é grátis.").
- **Afirmações sem exemplo.** Toda afirmação sobre um recurso ganha um exemplo
  concreto ou é cortada.

## Estrutura de um capítulo

Não é um molde rígido; é o esqueleto que os posts dele seguem.

1. Um ou dois parágrafos de contexto: que problema da rotina de pesquisa isso resolve.
2. O conceito, explicado antes dos cliques quando houver um (ex.: o que é busca
   federada, o que é RAG), com analogia se ajudar.
3. O passo a passo no projeto de exemplo, mostrando o estado da tela e os números
   em cada etapa. Marque onde entra imagem com `[Captura: ...]` descrevendo o que
   deve aparecer.
4. Perguntas que o leitor provavelmente terá ("E se o artigo não tiver PDF?").
5. Limitações e cuidados, sem rodeio.
6. "E é isso!" + ponte para o próximo capítulo.

## Capturas de tela

As imagens ficam em `landing_page/assets/tutoriais/capN-<assunto>.png` e entram na
página como `<img class="tutorial-img" ... width=".." height=".." loading="lazy">`
(com largura e altura reais, senão os atalhos `#ancora` param no lugar errado).

Para tirar as capturas, rode o app real numa pasta de dados descartável, nunca na
biblioteca do autor:

1. `npm run rebuild:electron && npx tsc -p tsconfig.electron.json` e o Vite em
   segundo plano (`npx vite --port 5173 --strictPort`), dentro de `emmas_librarian/`.
2. Um script Playwright (`_electron.launch`) com `E2E_USER_DATA_DIR` apontando para
   uma pasta temporária e `E2E_SKIP_RELAUNCH=true`; janela em 1440x900.
3. Dados de exemplo: importe o projeto do autor com
   `window.electronAPI.invoke('sync:importProject', caminho)` (o arquivo de
   exemplo fica em `writing_style_reference/`, que não é versionado) e crie prazos
   genéricos via `scientificVenue:create`. Não use nomes reais de eventos com datas
   inventadas.
4. Não use `fullPage`: aparece um indicador de tamanho da janela. Role até o
   elemento e desconte a altura do cabeçalho fixo (~130px).
5. No fim: pare o Vite, apague a pasta temporária e rode `npm run rebuild:node`
   (senão os testes unitários quebram). Parar a tarefa em segundo plano não mata
   o `node vite.js` filho: confira quem escuta a porta 5173 e encerre pelo PID.
6. Confira cada imagem antes de usar: elas já revelaram texto errado no rascunho
   (botão que era só ícone, botão que ficava em outro canto da tela).

## Checklist antes de entregar

- [ ] Nenhuma palavra da lista de folheto; nenhuma promessa absoluta.
- [ ] Nenhum travessão usado como pontuação; nenhum emoji; nenhum resumo final.
- [ ] Há pelo menos uma pergunta retórica respondida e um exemplo com valores reais.
- [ ] Cada recurso tem o "por quê" além do "como".
- [ ] Termos da interface batem com o que aparece no app (conferir no código em
      `emmas_librarian/src` se houver dúvida).
- [ ] Nada foi inventado: comportamento não explicado está marcado `[CONFIRMAR: ...]`.
- [ ] Lido em voz alta, soa como os posts do dev.to e não como um site de SaaS.

## Correções do autor

Registre aqui cada correção feita pelo autor nos rascunhos, com o antes, o depois
e a regra por trás. Estas regras têm prioridade sobre as seções acima.

<!-- Ex.: - Antes: "..." / Depois: "..." / Regra: ... -->

Capítulo zero (Introdução), 2026-09-24. O autor aprovou o tom do rascunho e pediu:

- **Ferramenta externa citada vira link para o site oficial**, pelo menos na
  primeira menção (ex.: `<a href="https://www.bibliometrix.org/">bibliometrix</a>`).
- **Não suponha que o leitor conhece a ferramenta, mesmo sendo da área acadêmica.**
  Explique em uma citação com o título em pergunta ("Você sabe o que é o
  bibliometrix?"), dizendo o que ela é e pra que serve na prática, com perguntas
  concretas que ela ajuda a responder e a ligação com o Emma's Librarian.
- **Atalho para a parte prática.** Quando o capítulo abre com contexto ou teoria,
  ofereça logo no primeiro parágrafo um link para pular direto aos passos
  ("pode pular direto para a instalação"). O `<h3>` de destino ganha um `id`, e o
  script da página já resolve âncoras que ficam dentro de um capítulo.
- **Atalho só quando alguém chegaria só por aquela parte** (capítulo 3, 2026-09-26).
  O atalho do capítulo 3 ("se você só quer saber como marcar lidos/arquivados...")
  foi chamado de forçado e inútil. Vale para: instalação, criar o primeiro projeto,
  gerar chave de API, configurar provedor de IA (coisas que alguém procura
  isoladamente, em capítulos longos). Não vale para pular uma seção curta até a
  seguinte. Na dúvida, não coloque.
- **Não invente dificuldade ou confusão pro leitor** (capítulo 3). "Um detalhe que
  confunde no começo" sobre algo óbvio soa forçado. Pergunta retórica e aviso de
  confusão só onde a dúvida é real (ex.: por que o total encontrado é maior que o
  salvo); caso contrário, afirme direto, com o porquê em meia frase.
- **Expressões que ele não usa:** "em que pé estão as coisas" foi vetado. Não
  invente coloquialismos que não aparecem nos textos de referência; o coloquial
  permitido é o da seção "Marcas de linguagem".
- **Verifique no código antes de perguntar.** `[CONFIRMAR]` é só para o que o código
  não responde (comportamento do Windows, planos futuros, intenção). O que está no
  código (ex.: o que vai dentro de um `.emmapcarc`, em
  `electron/database/backup/projectRows.ts`) deve ser lido, não perguntado.
- **Processos externos longos (ex.: gerar chave de API):** pesquise, resuma em
  poucos passos e deixe os links oficiais, em vez de descrever tela por tela.
- **Não repita o mesmo fechamento em todo capítulo.** "E é isso!" é a marca dele,
  mas usado igual no fim de todos os capítulos fica robótico. Guarde o "E é
  isso!" pra poucos capítulos (o primeiro e o último) e varie nos outros: uma
  ponte direta pro próximo assunto, uma retomada do exemplo, um "Por agora é
  isso.", uma pergunta que o próximo capítulo responde.
- **Visual da página:** links do texto com estilo próprio (rosa, sublinhado).
  Cantos arredondados ficam (o autor voltou atrás na remoção), mas o sumário e
  os botões de capítulo anterior/próximo não têm fundo nem borda de cartão: o
  sumário é uma lista solta e os botões são links rosa simples.
