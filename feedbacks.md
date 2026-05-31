# Feedbacks do Emma's Librarian

Este documento contém alguns bugs encontrados e sugestões de features novas após alguns dias de uso do sistema.Emma

> Legenda dos emojis:
> ✅ = Testado e aceitável
> ⚠️ = Testado e requer ajuste
> ❌ = Testado e não funcional
> Sem emoji = Não testado

## Bugs encontrados

- Os destaques da busca não funcionam quando o termo da busca tem espaços ✅
- Zoom do pdf reader não está funcionando ✅
- "Preencher com IA" deve preencher apenas campos vazios ✅
- Caracteres de controle como "\n" não estão sendo corretamente renderizados, estão aparecendo com o texto ✅
- Erro ao excluir projeto ✅
- Reverter inserções de artigos em lote pelo histórico não está funcional ✅

## Features novas

- Adicionar gráficos nos dashboards e páginas iniciais de projetos ⚠️
- Modal de primeira inicialização após update para explicar mudanças e dar avisos importantes ✅
- Incluir sistema de categorização (cada projeto teria uma listinha de características que se aplicaria para cada artigo. Com essa listinha configurada, você pode ir em cada artigo e inserir através de um modal aberto por um botão flutuante no canto inferior esquerdo, as informações de categorização desse artigo, o ponto é que eventualmente teremos dados suficientes para montar uma exibição de tabela com as categorias que são úteis para o usuário. sim, teria a nova visão de tabelas para os artigos não arquivados) ⚠️
- Funcionalidade de exportar projeto (permite escolher entre exportar com ou sem os pdfs). A exportação tem como motivação principal tornar o projeto portável para ser aberto no mesmo programa em outra máquina, portanto deve ser possível importar um projeto a partir dos dados de uma exportação (reconstruindo o projeto na nova máquina)❌
- Clicar em destaques com o botão direito permite copiar o texto destacado ⚠️
- Guia pra escrita de artigo com lembretes sobre a estrutura e formatação (essa feature você pode deixar ela com conteúdo de placeholder ou "em breve", eu ainda vou coletar os dados das orientações e normas pra gerar esse guia)
- Gerador de referências a partir dos artigos ⚠️


## Correções

Alterações Emma's Librarian

- Permitir drag and drop de PDFs. Quando adicionados dessa forma, são adicionados da mesma forma que "Adicionar PDFs em Lote"
- Erro ao importar projeto: DashboardPage.tsx:77 Uncaught (in promise) Error: Error invoking remote method 'sync:importProject': SqliteError: table projects has no column named description
- Sobre os gráficos visuais do dashboard, inclua um gráfico que mostra a razão da quantidade de PDFs vinculados em relação a quantidade de artigos salvos nos projetos. Também acrescente um gráfico de atividade nos últimos dias (quais dias o usuário progrediu na pesquisa com base no diário, simplesmente marque os dias que tem alguma nota no diário para saber se ele progrediu naquele dia ou não)
- Na página de projeto, remova o botão "CSV" e funcionalidade do sistema.
- Na lista de artigos em cada projeto, vamos fazer algumas alterações em como os botões aparecem. O botão de "Ler" só fica disponível para artigos com PDF vinculado, assim como o botão "Desvincular PDF". O botão de buscar no navegador agora tem um texto explicativo "Buscar por DOI".
- Ao clicar no botão "Citar" em qualquer tela que tiver ele, ele deve aparecer como um modal centralizado verticalmente e horizontalmente com campos editáveis para TODOS os dados usados pela biblioteca de citações, os campos que já tiverem dados no sistema já aparecem preenchidos. Logo abaixo tem um seletor para o formato da seleção que deve incluir, além dos formatos já incluidos, formatos compatíveis com referências para LaTeX. Abaixo do seletor, deve haver o preview e logo abaixo do preview o botão para copiar.
- O seletor de ordenação "últimos adicionados" e "primeiros adicionados" parecem não fazer nada.
- Sobre a categorização, você entendeu corretamente como devem ser organizadas as categorias, mas não como elas são utilizadas. A ideia é que você possa, dentro do leitor de PDF, abrir um modal de "Categorizar" através de um botão no canto inferior esquerdo (position fixed). Nesse modal você faz a categorização, e não na tela de detalhes do projeto. Além disso a visualização dos artigos na tabela que exibe também os dados da categorização de cada um deve ser diferente da tela com ações disponíveis sobre os artigos, deve ser uma aba exclusiva pra visualizar a categorização dos artigos, permitindo também a exportação dessa tabela dos artigos categorizados para uma planilha.
- Sobre as estatísticas, adicione estatísticas extras com os dados fornecidos pelas buscas (publisher, base de origem, idioma, tipo de documento, acesso aberto, DOI disponível, e outras informações que tiverem disponíveis)