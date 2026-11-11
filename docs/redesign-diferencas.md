# Redesign (Arca 134): onde a implementação difere do canvas

Documento vivo para a validação final. Cada tela lista **o que o board mostra e o app não faz (ou faz de outro jeito)**,
com o motivo e o que escolhi. Marque ao validar: `[ ]` aberto, `[x]` aceito, `[~]` ajustar.

Canvas: https://claude.ai/artifact/G25cnpQB7hxdQrMkLCdYjf (boards 150–181). PRs em pilha, #150 a #174 até aqui.

## Decisões que ficaram para o autor julgar

- [ ] **Tecla de "marcar como lido" (L)** e a abreviação **"OA"** para OpenAlex: escolhi uma, conferir no resultado.
- [ ] **Teclas da auditoria**: o board mostra 1/2/3 (Correta/Corrigida/Incorreta); o app mantém A/E/R e P, as mesmas da aba Respostas.
- [ ] **Interruptor "Ordenar por relevância prevista"** da triagem guiada: o board o põe na barra; ficou na faixa abaixo, junto dos avisos da ordem.

## 151 · Início (#170, #171)

Seguiu a versão "copy" e depois o esclarecimento do autor: projeto com interação com a revisão mostra a triagem; os demais, a leitura.

- [ ] "Buscar em acesso aberto" no bloco "Sem PDF": o app mostra "sem arquivo vinculado"; essa busca não parte da Início.
- [ ] "Recentes" usa `last_opened_at` (novo); um projeto nunca aberto conta a partir da criação.
- [ ] "Próximos prazos" reaproveita o componente de prazos de antes (cartões em coluna), não o desenho de linhas do board.
- [ ] "Triagem por título e resumo N de M": M é o total de artigos do projeto (o board não diz se desconta arquivados).

## 152 · Novo projeto (#172)

- [ ] Sem diferenças conhecidas além do estilo do campo (usa o `input-field` do app).

## 153 a 157 · Projeto (#151 a #158)

- [ ] **Artigos (153)**: filtro por categoria fora do popover de filtros (ficou o que existia: a coluna de categorias saiu da tabela).
- [ ] **Painel do artigo (inspetor)**: seções de origem e resumo ainda no estilo antigo; faltam os chips "+ categoria" e "Resumir com IA" do board.
- [ ] **Visão geral (154)**: falta "Exportar gráficos".
- [ ] **Diário (155)**: o board não tem cabeçalho de página; o app mantém o título da seção.
- [ ] **Histórico (157)**: a seção "Resultados por base" mantém o desenho antigo.

## 158 · Nova busca (#159)

- [ ] Sem diferenças conhecidas além das decisões abertas acima (OA).

## 159 a 163 · Investigação (#160 a #164)

- [ ] **159 Nova investigação**: ficaram de fora o tipo de resposta por pergunta, "Vira categoria" e "Começar das categorias do projeto" (o app não tem esses conceitos).
- [ ] **159 Lista na barra lateral**: o board mostra data e contagem; status, modelo e tamanho foram para o tooltip.
- [ ] **160 Em andamento**: a etapa "Indexar os PDFs" aparece sempre como feita (o app não reporta o progresso da indexação nessa tela); "Agora:" mostra o título sem "· P3".
- [ ] **161 Chamadas**: o rótulo de status na lista é curto ("ok", "erro"); o tempo "N s" por chamada não existe.
- [ ] **162 Respostas**: confiança, evidências e botões como no board; o progresso "Revisadas" fica na barra de filtros.
- [ ] **163 Auditoria**: teclas (ver acima); o modo "revisar em sequência" virou o comportamento normal (a tela abre no primeiro pendente).

## 164 a 167 · Revisão sistemática (#165 a #169)

- [ ] **164 Triagem**: a decisão rápida (Incluir/Dúvida/Excluir) aparece ao passar o mouse na linha, usando o primeiro rótulo de cada tipo; o menu "Rótulo" continua ao lado.
- [ ] **165 Triagem guiada**: interruptor da ordem (ver acima); "Só pendentes" e etapa na barra como no board.
- [ ] **166 PRISMA**: falta o X para fechar o painel "De onde vem o número" (ele sempre mostra uma caixa); "Exportar" e "Tabela de dados" ficam acima do diagrama, não no cabeçalho.
- [ ] **167 Avaliar sugestões**: o checklist foi acrescentado, mas o parágrafo e o restante da aba (classificador, simulação) mantêm o texto de antes; o motor aparece como "provedor/modelo" do app.

## 168 · Perguntar aos projetos (#173)

- [ ] Faltam o nome do modelo da resposta ("gemini-2.5-flash") e "3 fontes" na lista de conversas: o app não guarda isso.
- [ ] O botão de enviar fica fora da caixa de texto (validado no épico #44: caixa e botão têm a mesma altura).

## 169 · Leitor (#174)

- [ ] O título do artigo fica na barra do leitor; no board ele está no caminho da barra de título, que não conhece o artigo.
- [ ] O cartão de categorias do board (chips de valores, Sim/Não nas teclas 1/2) não foi refeito: o painel usa os editores da matriz de categorias.
- [ ] As abas do painel lateral (Anotações, Pesquisar, Insights IA) mantêm o estilo de antes; o board as mostra como controle segmentado.
- [ ] O botão de ajuda mantém o texto "Ajuda" (o board não o mostra na barra).

## 170 · Configurações (#175)

Feito: lista de seções à esquerda (Aparência, Chaves das bases com "2/4", Inteligência artificial, Backup e segurança, Atualizações, Lixeira com contagem) e uma tela por seção, com título e subtítulo; a rota passou a `/settings/:seção`.

- [ ] **Dentro de "Inteligência artificial"**: os provedores continuam como campos empilhados (sem a linha "nome · campo · selo"), sem os selos "sem chave / configurada / respondendo"; "Por tarefa" continua como cartões, não como a tabela Tarefa · Provedor · Modelo; o bloco RAG não é um "Avançado" recolhível com o resumo "trecho 1000 · sobreposição 200 · 10 trechos".
- [ ] **Chaves das bases**: sem selos de estado por chave.
- [ ] **Aviso de nuvem** da IA: mantém o texto e o desenho antigos (o board o põe como aviso âmbar de uma linha).
- [ ] A lista de seções é desenhada dentro da página, não na coluna lateral do shell; visualmente é igual.
- [ ] As outras seções (Aparência, Backup, Atualizações, Lixeira) mantêm o conteúdo de antes, só sem a moldura de cartão e com o título da seção no cabeçalho.

## Próximas telas (este documento ganha uma seção por PR)

171 Biblioteca de PDFs · 172–173 Agenda · 174 Termos · 175–181 Janelas
