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

## 171 · Biblioteca de PDFs (#176)

Feito: título e subtítulo do board, "Adicionar PDF" no cabeçalho, quatro cartões (Arquivos, Espaço usado, Reutilizados, Órfãos, com a nota do que significam), busca "Nome do arquivo ou título do artigo", filtro Todos/Reutilizados/Órfãos com contagem, "Ordenar" (Tamanho ↓ por padrão; também Mais recentes e Nome), tabela Arquivo (mono) · Tamanho · Adicionado (dd/mm/aaaa) · Artigo vinculado, "Abrir" e o menu "⋯" (Vincular a outro artigo, Excluir PDF). Sem link de voltar.

- [ ] **Artigo vinculado**: o app mostra "Utilizado em N artigos" e a lista de artigos com o projeto, não só o primeiro título com o projeto em cinza como no board.
- [ ] **"Abrir"** só aparece quando há artigo; abre o leitor do primeiro artigo ligado. Para um PDF órfão o board não diz o que "Abrir" faria.
- [ ] A coluna "Adicionado" perdeu a hora (o board mostra só a data).
- [ ] O link "Voltar aos projetos" saiu; o teste E2E de aparência dos links de voltar passou a conferir só a página de Termos (até o board 174).

## 172 · Agenda, calendário (#177)

Feito: título com navegação do mês (anterior, mês, próximo, "Hoje"), seletor Calendário / Lista de prazos, "Novo evento", grade do mês com uma pílula por prazo na cor do evento (um intervalo repete a sigla em cada dia), o dia de hoje marcado, e à direita "Eventos e revistas" com contagem, busca "Evento ou sigla" e um cartão por evento (categoria, "SIGLA · Título", prazos com caixa de marcar, data ou "venceu há N d").

- [ ] **Menu "⋯"** do cartão: o board tem "Abrir site" e "Mais ações"; o app mantém os três ícones (abrir URL, editar, excluir), porque os testes e a E2E os usam pelo título. Dá para trocar por um menu se preferir.
- [ ] **Selo de vencido no cartão**: mostra "venceu há N d" (o board mostra "venceu 01/02", a data).
- [ ] **Busca** do painel também filtra a grade (o board não diz).
- [ ] Clicar num dia vazio abre "Novo evento" com aquela data (comportamento de antes, mantido).
- [ ] Os pontinhos do calendário pequeno da Início continuam como antes; só a Agenda ganhou a grade com pílulas.

## 173 · Agenda, lista de prazos (#177)

Feito: subtítulo "Eventos, prazos e chamadas de periódicos", barra com busca, Pendentes / Feitos / Todos com contagem, categoria e o interruptor "Mostrar vencidos há mais de 60 dias"; tabela agrupada por mês (Prazo, Evento ou revista com ponto colorido, Tipo, Data, Situação) e o aviso "Os N prazos venceram há mais de 60 dias" com "Marcar os N como feitos".

- [ ] **Ordem dos meses**: crescente (o mais próximo primeiro). O board mostra abril acima de fevereiro; achei crescente mais útil para prazos futuros.
- [ ] **Padrão do interruptor**: ligado (como no board), então nada some sem o autor desligar; o aviso aparece sempre que há prazo vencido há mais de 60 dias, com o interruptor ligado ou não.
- [ ] **Filtro padrão**: "Pendentes" (o board também o mostra selecionado).
- [ ] **Situação** além de "venceu há N d": "hoje", "em N d" e "feito".
- [ ] Os nomes dos botões mudaram de "Novo Evento" e "Lista de Prazos" para "Novo evento" e "Lista de prazos" (E2E ajustado); a janela "Novo Evento / Periódico" fica para os boards 175–181.

## 174 · Termos de uso e IA (#178)

Feito: coluna de leitura com "Nesta página" ao lado (sumário que rola até a seção e marca a que está sendo lida), "Atualizado na versão 1.3.1", texto de abertura em serifada, "O que cada base permite" com uma linha por base (nome, selo Livre/Metadados livres/Restritivo, texto e link da política) e a isenção de responsabilidade em aviso âmbar. Sem link de voltar; a página deixou de ser um cartão.

- [ ] **Texto das bases encurtado** como no board (o texto antigo era mais longo; por exemplo, o do Scopus perdeu a menção a "OpenAI" e o do Web of Science o "Totalmente restritivo"). Confira se o resumo basta juridicamente.
- [ ] **"IA e as suas chaves"** não tem título próprio no board: o item do sumário aponta para o segundo parágrafo de abertura.
- [ ] **"Atualizado na versão"** é uma constante (`TERMS_VERSION`) que precisa ser mudada à mão quando os termos mudarem; não acompanha a versão do app.
- [ ] **E2E de links de voltar**: sem links de voltar restantes além do leitor, o teste passou a conferir o do leitor (importa um PDF de teste).

## 175–181 · Janelas: a base e as perguntas do app (#179)

Feito: a janela padrão (`Modal`) ganhou o desenho do board (cantos 14px, sombra, título 15px, descrição pequena, X em quadrado de 28px), um ícone em quadrado colorido antes do título (`icon` e `tone`) e a barra de baixo `ModalFooter` (fundo cinza, linha em cima, dica à esquerda e botões à direita, colada ao fim quando a janela rola). As perguntas e avisos do app (`confirm`/`inform`) usam o ícone e a barra sem fundo do board 181: lixeira vermelha para perguntas destrutivas.

As janelas de cada board entram nos PRs seguintes, uma seção por PR.

- [ ] **Avisos (`inform`)** mostram sempre o ícone neutro (i). O board usa um visto verde para "PDFs importados"; o app usa o mesmo aviso para sucessos e erros, e não sei qual é qual sem mexer em cada chamada.
- [ ] A barra de baixo só está nas perguntas do app por enquanto; as demais janelas ganham quando cada board for refeito.

## 175 · Janelas de busca (#180)

Feito: resumo da busca com os números em cartões (Novos em verde), uma linha por base com o resultado na cor do desfecho, "Descartar" à esquerda na barra de baixo e "Salvar N novos no projeto" à direita; janela "chave necessária" com o ícone de chave no título e a barra de baixo.

- [ ] **Resumo da busca**: mantive os quatro números (Encontrados, Repetidos, Já no projeto, Novos), que fecham a conta validada no épico #44; o board tem três (Retornados, Novos, Repetidos).
- [ ] **Lista de artigos** continua dentro da janela (com o filtro "só o que não está no projeto"); no board ela fica atrás de "Ver a lista".
- [ ] **Tabela por base**: sem a coluna "Novos" por base (o app não sabe quantos novos vieram de cada base) e sem o selo "completa"/"parou no limite"; o desfecho aparece na cor e no texto da linha.
- [ ] **Subtítulo** da janela: o app mantém "Nada foi salvo ainda…"; o board mostra a consulta ("título contém …"), que a janela não recebe.
- [ ] **Chave necessária**: o board pede a chave ali mesmo (campo, "Salvar e buscar", "Buscar sem a Scopus"); o app só leva para as Configurações. Fazer o campo inline é trabalho novo (salvar chave e retomar a busca), não só visual.

## 176 · Janelas de artigo (#181)

Feito: **Editar metadados** (grupos Identificação, Publicação e Resumo, Ctrl Enter salva e aparece como dica na barra de baixo, "Cancelar" e "Salvar"); **Arquivar** ("Arquivar este artigo?", "Ele sai da lista de ativos e volta quando você quiser.", campo "Motivo (opcional)" com "ex.: fora do escopo", "Cancelar" e "Arquivar"); **Importar de outro projeto** (barra com "N escolhidos" e "Importar N").

- [ ] **Anexar PDF** ficou como estava: o board tem uma área "Solte o PDF aqui", "Buscar em acesso aberto" e "Usar um PDF da biblioteca". Arrastar e soltar e a busca em acesso aberto a partir da janela são recursos novos, não só visuais.
- [ ] **Importar de outro projeto**: falta o selo "já está neste projeto" e o campo "Filtrar" continua com o nome antigo; o app não sabe, ao listar, quais artigos o projeto de destino já tem.
- [ ] **Editar metadados**: o autor do board é um campo de chips ("Hersbach, H." etc., "+38"); o app mantém um campo de texto com ";" entre os nomes. "Preencher com IA" continua no alto da janela.
- [ ] O texto "Por que este artigo não é relevante?" do campo de motivo virou "ex.: fora do escopo", como no board, e o rótulo "Motivo (opcional)" ficou só para leitores de tela.

## 177 · Janelas de citação (#182)

Feito: **Citar artigo** (título "Citar artigo" com o título do artigo embaixo; "Copiar" na barra de baixo, que fica verde com "Copiado!"); **Citar N artigos** (título com a contagem, "Copiar tudo" na barra de baixo); **Explorar citações** com a barra de baixo ("Cancelar", "Buscar").

- [ ] **Estilos**: o board tem um controle ABNT / APA / BibTeX / RIS; o app mantém o seletor de estilo com todos os estilos que já tinha, e a forma de exibição (HTML, texto, BibTeX) como botões. Trocar pelos quatro do board tiraria estilos que o app oferece.
- [ ] **"Lembra o último formato"** (dica do board) não existe no app: ele não guarda a escolha.
- [ ] **Baixar .bib** (citação em massa) não existe; é recurso novo.
- [ ] **Citação em massa** cita os artigos lidos do projeto, não "os selecionados na lista"; o subtítulo diz isso. A ordem tem seletor (autor ou ano), não só a alfabética do board.
- [ ] **Explorar citações** no board mostra a lista de referências/quem cita dentro da janela, com "Adicionar" por artigo; o app mostra o volume e passa pelo resumo da busca (decisão do #51: nada entra sem revisão). Só a barra de baixo foi refeita.
- [ ] O bloco da citação continua com o estilo de antes (sem a fonte serifada do board); o metadado editável segue no acordeão.

## 178 · Janelas do projeto (#183)

Feito: **PDFs em acesso aberto** (título e "N artigos sem PDF procurados", três números Baixados / Sem versão aberta / Falharam e "Concluir" na barra de baixo; os grupos detalhados continuam embaixo); **Categorias** (título "Categorias", subtítulo, "Concluir" na barra de baixo); **Acesso rápido** (título).

- [ ] **Categorias**: o board mostra uma lista com alça para arrastar, tipo como selo e "⋯"; o app mantém as linhas de antes (tipo como selo, lápis e lixeira, edição na própria linha) e não reordena por arrastar. O subtítulo do board diz que as categorias "viram perguntas na investigação", o que o app ainda não faz; o texto só fala da aba Categorias.
- [ ] **Acesso rápido**: o board agrupa por nome do grupo ("WorCAP", "Reuniões"), com alças e "⋯" por item, e botões "Link ou arquivo" e "Novo grupo". O app mantém a lista com arrastar para reordenar e o formulário embaixo; só o título mudou.
- [ ] **PDFs em acesso aberto**: "Falharam" soma as falhas e as cópias abertas que o download automático não conseguiu baixar (o exemplo do board, "o link aberto devolveu uma página, não um PDF", é desse caso). O botão "Abrir link" do board é o "Abrir a página" que já existia.

## 179 · Janelas da revisão e da investigação (#184)

Feito: **Critérios do projeto** (título e subtítulo do board, "Incluir quando" com visto verde e "Excluir quando" com X vermelho, "Concluir" na barra de baixo com a dica "Salvos ao sair de cada campo"); **Rótulos de triagem** ("Concluir" na barra de baixo); **Refazer o índice antes de rodar?** (pergunta do board, número de PDFs na barra, "Cancelar" e o botão de confirmar); **A cota acabou** (ícone vermelho ao lado do título e "Entendi" sem fundo na barra).

- [ ] **Critérios**: falta o campo "Pergunta da revisão" (o app não guarda a pergunta da revisão). Os critérios continuam salvando sozinhos, então não há "Cancelar"/"Salvar critérios"; o botão é "Concluir".
- [ ] **Rótulos**: o board mostra um seletor Título e resumo / Texto completo, uma lista simples com a tecla de cada rótulo (1 a 4) e o botão "Motivo de exclusão". O app mantém a janela de antes (rótulos por tipo, renomear, mover, apagar, modelo PRISMA 2020); só ganhou a barra de baixo.
- [ ] **Cota**: o board diz o nome do provedor ("A cota do Gemini acabou"), quantas chamadas já foram feitas, "Detalhes técnicos" e os botões "Trocar modelo" e "Tentar de novo". O app mantém "Limite de Cota Atingido" e o texto geral; retomar as chamadas que faltam é recurso novo.
- [ ] **Como ler a auditoria** ficou como estava (o board mostra só o texto curto e um exemplo; o app tem o gráfico e as explicações mais longas).
- [ ] O nome acessível das janelas não mudou ("Recalcular os PDFs", "Critérios de inclusão e exclusão"), só o título que aparece na tela.

## 180 · Janelas da agenda e do diário (#185)

Feito: **Novo evento / Editar evento** (título do board, grupos "Evento ou revista" e "Prazos", barra de baixo com "Cancelar" e "Criar evento", que vira "Salvar" ao editar). O nome acessível da janela continua "Novo Evento / Periódico".

- [ ] **Tipo do evento**: o board usa um seletor de quatro opções (Periódico, Simpósio, Congresso, Outro); o app mantém a lista de categorias (com Workshop) e o seletor de cor do emblema, que o board não mostra.
- [ ] **Prazos**: o board mostra uma linha por prazo (nome, data e hora, X para remover) e "+ Prazo"; o app mantém os cartões com tipo "Pontual/Intervalo", data, hora opcional e "Criar Novo Campo".
- [ ] **Site (opcional)** do board se chama "Link / URL da Chamada" no app.
- [ ] **Histórico de versões do diário** ficou como estava. O board mostra uma lista de versões à esquerda e, à direita, a comparação com o texto atual (verde o que entrou, vermelho o que saiu) e "Restaurar esta versão"; hoje o app lista as versões com "Restaurar" em cada uma, sem comparar. A comparação é recurso novo.

## 181 · Janelas de aviso e ajuda (#186)

Feito: **Erro** (ícone vermelho ou âmbar no título conforme o erro, "Ver detalhes técnicos" à esquerda da barra de baixo, "Copiar Logs" quando os detalhes estão abertos, "Entendi"); **Novidades** (título "Versão 1.3.1", linha "Novidades: o que mudou…", "Continuar" na barra de baixo, no lugar de "Entendido, vamos lá!"). A pergunta destrutiva e o aviso do board já vieram com a base das janelas (#179).

- [ ] **Erro**: o board termina com uma ação do contexto ("Anexar outro PDF") e "Copiar detalhes" sempre visível; o app só tem "Entendi" e mostra "Copiar Logs" depois de abrir os detalhes. As ações por contexto seriam recurso novo, uma por tipo de erro.
- [ ] **Novidades**: o board tem a etiqueta "NOVIDADES" em cima do título e o link "Ver todas as versões"; o app mostra a etiqueta como subtítulo e já lista todas as versões na própria janela, então não há link.
- [ ] **Chave de IA necessária**: o board pede a chave ali mesmo ("Salvar e continuar", "Usar outro provedor"); o app só leva às Configurações, como na janela de chave das bases (board 175).
- [ ] **Ajuda**: o board tem busca ("Como faço para…") e uma lista de tópicos que abre cada um; o app mantém a janela de ajuda que mostra o guia da tela atual. Busca e lista de tópicos são recurso novo.

## Rodada de correções (PR de correções, depois da primeira validação)

Regra que o autor fixou: a interface fica igual ao board; só se diverge quando o board pressupõe uma funcionalidade que o sistema não tem. Reaproveitar o desenho antigo não conta. Os itens abaixo foram refeitos nessa regra; marque `[x]` se ficou certo.

- [ ] **Base (150)**: cor e medidas da sidebar do projeto, botões de 32px/13px, fonte base de 13px, margem lateral de 28px e telas ocupando a largura toda (antes havia colunas centradas de 1200/1280px).
- [ ] **Início (151)**: "Próximos prazos" em linhas, calendário compacto com letras e linha sob os dias com prazo, cartões no tamanho do board, título de 30px, "Termos de uso" na cor de destaque. A triagem conta arquivados como progresso; o projeto só vira "Revisão sistemática" depois que um artigo recebe uma decisão.
- [ ] **Novo projeto (152)**: centralizado na vertical; "Importar um projeto" é link de texto.
- [ ] **Artigos (153)**: o botão "Filtros" mostra a quantidade em selo de destaque. **Painel do artigo**: resumo na fonte de leitura, palavras-chave em chips, origem numa linha discreta (sem os chips "+ categoria" e "Resumir com IA", por decisão do autor).
- [ ] **Visão geral (154)**: "Exportar gráficos" salva ano, bases e editoras num SVG. Um gráfico por tipo de categoria fica no Arca (#201).
- [ ] **Histórico (157)**: "Resultados por base" como tabela Base × Retornados, com "Salvos no projeto" e a nota de quantos já estavam no projeto.
- [ ] **Nova investigação (159)**: cartões de "Começar de um conjunto" com o escolhido marcado, perguntas em linhas P1…Pn, "+ Pergunta", barra de baixo com margem. Tipo de resposta, "Vira categoria" e "das categorias do projeto" ficam no Arca (#200).
- [ ] **Em andamento (160)**: "Investigação" com o selo "Rodando" e "Iniciada às HH:MM · modelo · N artigos · M perguntas"; "Indexar os PDFs" só aparece feita quando todos os artigos já passaram por ela.
- [ ] **Configurações › IA (170)**: provedores em linhas com selo "sem chave"/"configurada" ("respondendo" precisaria de uma chamada ao provedor e não existe), "Por tarefa" em tabela com o modelo sugerido por provedor e o selo "rec.", RAG recolhível com o resumo dos números.
- [ ] **Ctrl+K**: ações das telas (nova entrada do diário e histórico, novo evento e navegação da agenda, ordenar e filtrar artigos, categorias, acesso rápido, critérios e rótulos, importar) e mais destinos (seções das Configurações, nova investigação, avaliação, novidades, ajuda).

- [ ] **Biblioteca de PDFs (171)**: cartões com etiqueta em maiúsculas, tabela com colunas e cabeçalho do board, sem moldura de cartão.
- [ ] **Configurações › Chaves das bases**: mesmo desenho de linhas dos provedores (nome, campo, selo), com as dicas embaixo. O board não mostra essa seção; segui o padrão da IA.
- [ ] **Leitor (169)**: abas do painel lateral (Anotações, Insights IA, Pesquisar) como controle segmentado, na ordem do board. O cartão de categorias do artigo continua com os editores da matriz.
- [ ] **Termos (174)**: aviso de responsabilidade sem borda, só o fundo âmbar. **Artigos (153)**: tabela direto na página, cabeçalho e linhas nas medidas do board.

- [ ] **Investigação (161, 162)**: filtros de Respostas e Chamadas como controle segmentado; o selo de uma investigação sem erros diz "Concluída". A coluna "Trechos" da lista de chamadas e "Prompt completo e resposta bruta" ficam de fora: o app não guarda esses dados por chamada.
- [ ] **Avaliar sugestões (167)**: comparação e simulação lado a lado (3 para 2), sem os botões da triagem no topo. Os resultados da medição (tabelas de motores, calibração) continuam como estavam, porque o board só mostra o estado inicial.
- [ ] **Perguntar (168)**: o botão de enviar fica dentro da caixa, num botão de ícone, e a caixa cresce com o texto. Troca a decisão antiga de manter o botão fora da caixa; o teste E2E agora confere que ele está dentro.
- [ ] **Início (151)**: as datas do prazo na lista seguem a Agenda ("02 a 05/12/2026"); a tela não rola mais sem necessidade.
- [ ] **Triagem guiada (165)**: margens do modo de foco ajustadas ao novo espaçamento (sumiu a barra de rolagem horizontal).

- [ ] **Novo evento (180)**: um prazo por linha (nome, data, X) e "+ Prazo"; o tipo do evento é controle segmentado com as cinco categorias do app (o board mostra quatro; Workshop existe no app); "Nome do evento", "Sigla" e "Site (opcional)" no desenho do board. Mantive a cor do emblema, que o board não mostra. Um prazo "Pontual" ou "Intervalo" ainda se escolhe ao adicionar.
- [ ] **Ctrl+K (150)**: linha de busca com lupa e Esc, grupos e barra com as teclas, sem título nem X; "Nesta tela" vem antes dos destinos.
- [ ] **Campos dos formulários e do acesso rápido**: rótulo de 12,5px em peso médio, como no board. O desenho do Acesso rápido (grupos com alça, "Link ou arquivo", "Novo grupo") continua como antes, só com os campos novos.

- [ ] **Citar artigo (177)**: um seletor só com ABNT, APA, Vancouver, Harvard, IEEE e BibTeX; a citação numa caixa afundada; "Copiar" fica verde com "Copiado!"; o rodapé diz "Lembra o último formato" e o app passa a lembrar de verdade. Fora do board e mantidos: "Usar et al." (abaixo da caixa) e "Editar metadados" (segunda vista na mesma janela, com Restaurar, Voltar e Salvar; salvar volta à citação). Sem o RIS do board (o app não gera RIS) e sem o botão "Texto simples" (a cópia em HTML já leva o texto puro junto).
- [ ] **Citação em massa (177)**: mesmo seletor, a lista numerada dentro de uma caixa, "Ordenar por" e "Usar et al."; com BibTeX aparece "Baixar .bib" (novo, salva todas as referências num arquivo). A edição de uma referência continua trocando a lista pelo formulário.
- [ ] **Arquivar (176)**: pergunta de uma linha, motivo em campo de uma linha (era uma caixa de texto grande), rodapé padrão.
- [ ] **PDF do artigo (176)**: área tracejada para soltar o PDF (novo: o arquivo solto é anexado), "ou escolha um arquivo", "Buscar em acesso aberto" (novo neste lugar: usa a busca de cópia aberta que já existia na tabela) e "Usar um PDF da biblioteca" (lista com filtro e "Vincular"). O título do artigo saiu do cabeçalho, como no board.
- [ ] **Categorias (178)**: janela estreita (470 px) com uma linha por categoria: nome, selo do tipo ("Texto", "Sim ou não", "Lista", "Múltipla escolha") e "⋯" com Editar e Excluir (a confirmação continua dentro da linha). "Nova categoria" e "Conjuntos e JSON" (os modelos prontos e a importação, que o board não mostra) abrem embaixo da lista. Sem a alça de arrastar: o app não guarda a ordem das categorias (Arca).
- [ ] **Acesso rápido (178)**: itens agrupados pelo grupo (a categoria que o app já tinha), cada um com alça, nome, "link externo" ou "arquivo local · nome", e "⋯" (Editar, Remover); lápis para renomear o grupo (renomeia em todos os itens); "+ Link ou arquivo" e "Novo grupo". O formulário de adicionar/editar virou uma segunda vista da janela, com os rótulos do restante do app. Um grupo só existe enquanto tem item: "Novo grupo" abre o formulário já pedindo o nome do grupo.

- [ ] **Triagem (164)**: linhas sem cartão, com o título e a linha de autores cortados numa só linha; cada linha sem decisão mostra o selo "sem decisão" e, sob o ponteiro, Incluir, Dúvida e Excluir com as teclas 1, 2 e 3 (novo: as teclas decidem a linha sob o ponteiro). "Selecionar vários" foi para a barra dos status, com uma barra de progresso embaixo; o rodapé ganhou o ícone e o intervalo ("1–50 de 96"). Ficaram de fora: o seletor "Título e resumo | Texto completo" na lista (o texto completo só existe na triagem guiada) e o botão de ver o resumo num painel ao lado (o "Ver" abre o leitor).
- [ ] **Triagem guiada (165)**: a decisão virou uma coluna de 380 px à direita, colada à borda, com os botões coloridos por tipo (ícone redondo, nome e tecla), a nota com a tecla N, "É duplicado…" e a sugestão da IA como cartão roxo; "Anterior", "Desfazer" e "Pular" foram para o rodapé da coluna, com "Decidir já leva ao próximo pendente.". A chave "Ordenar por relevância prevista" com a etiqueta Experimental foi para a direita da barra; a faixa de baixo só aparece quando a ordem tem algo a dizer (erro, vetores a gerar, o que falta). O título da coluna é "Sua decisão" nas duas etapas (a etapa está na barra).
- [ ] **Chamadas da investigação (161)**: "Copiar" no inspetor vira "Copiado!" por dois segundos (novo; só avisa se a área de transferência aceitou).

- [ ] **Perguntar aos projetos (168)**: três linhas esmaecidas sob o texto da página vazia dizem qual modelo responde, qual busca nos PDFs (lidos das configurações, com o padrão quando nada foi escolhido) e levam às configurações de IA; o board não mostra isso. Os anéis da Emma (GyroscopeCanvas, do projeto rings) ficam grandes acima de "O que você quer saber?" e somem quando a primeira pergunta é enviada; ao lado das respostas ficam pequenos (28 px), vivos na última resposta e girando mais rápido enquanto a IA lê, parados (SVG) nas anteriores para ter um só canvas WebGL por vez. Adicionei as dependências three e @react-three/fiber. Os anéis são só um contorno: a face externa e as laterais finas da face interna têm o tom da barra de módulos (--bg-sunken) e o interior tem a cor do fundo (--bg-main), lidos do app, então acompanham modo e tom. As chamadas de IA (perguntas, investigação, sugestões, resumos) deixaram de ter limite de 30 segundos: esperam a resposta.

Corrigidos depois do teste no app: a primeira seção das Configurações (Aparência) não aparecia destacada na barra lateral ao entrar pela primeira vez.

Ainda abertos desta rodada: confirmações e erros (não conferi ainda); acesso rápido e investigações da sidebar com muitos itens (proposta: mostrar os mais recentes e "Ver todos"); o PDF que sumiu do leitor depois de dois destaques (não reproduzi, ver o PR).

## Fim do redesign

Todas as telas do canvas (150 a 181) têm PR. Os itens `[ ]` acima são o que escolhi diferente ou deixei de fora e dependem do seu julgamento.
