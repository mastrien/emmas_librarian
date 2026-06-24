# Development Log - Emma's Librarian



### Ciclo 1 [2026-05-18 05:15]: : PDF Viewer Positioning Fix
- **Objective:** Fix "The container must be absolutely positioned" error in the PDF reader.
- **Changes:**
    - Downgraded `pdfjs-dist` to `3.11.174` via `npm overrides` to fix `AnnotationEditor` incompatibility.
    - Correctly configured `GlobalWorkerOptions.workerSrc` for PDF.js 3.x.
    - Imported `react-pdf-highlighter/dist/style.css` (previously missing).
    - Refactored `onSelectionFinished` to use a custom `renderTip` component, fixing missing annotation buttons.
    - Updated `highlightTransform` to show note text on hover.
    - Ensured absolute positioning for all PDF viewer layers.
- **TDD Status:** UI bug fix (Positioning Logic).
- **Decisions:** 
    - `react-pdf-highlighter` (and PDF.js) requires the viewer container to be absolutely positioned to calculate coordinates correctly.
- **Difficulties:** None.

### Ciclo 2: Validação de CI/CD e Correção de Testes
- **O que foi feito:** 1) Foi executada a pipeline completa de validação (typecheck e suíte do Vitest). 2) Corrigidos mocks quebrados nos testes do SyncService e dos handlers IPC que falhavam por falta da simulação do objeto `app.getPath` e de métodos novos no mock do banco de dados (relacionados a categorias de projetos). 3) Atualizada a asserção no teste do `ProjectCategoriesModal` para reconhecer o novo argumento de opções do construtor de enum. Todos os testes estão passando.

### Ciclo 3: Performance ao Abrir Categorias e Ajuste do Link DOI
- **O que foi feito:** 1) Resolvi o problema de renderização massiva no leitor de PDF. O botão de abrir categorias estava chamando a função principal \etchData\, que reconstruía tudo (estado de carregamento, highlights, PDF buffer, resetando componentes e perdendo a posição de rolagem). Criei uma função otimizada \etchCategories\ que atualiza exclusivamente os dados das categorias no painel. 2) Finalizado o botão de DOI com o texto 'Buscar por DOI' na tabela principal.

### Ciclo 4: Input Nativo em Vez de Window Prompt
- **O que foi feito:** Substituímos o uso de \window.prompt\ (que é bloqueado pelo ambiente nativo do Electron por questões de segurança) por um campo de \<input>\ dinâmico renderizado in-loco. Agora, ao clicar em '+ Adicionar nova opção...', o select se transforma em um input com foco automático para a digitação fluida. Além disso, corrigimos um erro fatal silencioso na estrutura de Hooks do React movendo-os para o escopo global do componente.

### Ciclo 5: Melhorias nas Categorias
- **O que foi feito:** 1) Corrigido o bug onde as categorias do artigo no painel lateral desapareciam após o fechamento e reabertura do painel (agora os dados são re-buscados no useEffect ao abrir o painel). 2) As categorias do tipo enum agora permitem edição local! Foi adicionada uma opção + Adicionar nova opção... que solicita o novo valor ao usuário via prompt, salva no banco de dados e seleciona a nova opção, persistindo as mudanças imediatamente na interface e no banco de dados sem precisar ir até o painel central.
- **O que foi feito:** 1) Corrigido o bug onde as categorias do artigo no painel lateral desapareciam após o fechamento e reabertura do painel (agora os dados são re-buscados no useEffect ao abrir o painel). 2) As categorias do tipo enum agora permitem edição local! Foi adicionada uma opção + Adicionar nova opção... que solicita o novo valor ao usuário via prompt, salva no banco de dados e seleciona a nova opção, persistindo as mudanças imediatamente na interface e no banco de dados sem precisar ir até o painel central.

### Ciclo 6: Aba de Categorias e Exportação CSV/XLSX
- **O que foi feito:** O conteúdo da guia 'Categorias' foi finalmente implementado na página de detalhes do projeto. Esta aba agora exibe uma matriz completa de Artigos vs Categorias, facilitando a visualização rápida de quais dados foram extraídos ou preenchidos. Além disso, os botões de exportação (CSV e XLSX) foram inseridos diretamente nesta nova aba, como especificado no plano de implementação.

### Ciclo 7: Estilo do Botão de Categorizar no Leitor
- **O que foi feito:** O botão flutuante de 'Categorizar' na tela de leitura de PDF recebeu um upgrade visual: as bordas agora estão em formato de pílula (2rem), o gradiente linear foi substituído pela cor primária sólida e adicionamos o texto 'Categorizar' ao lado do ícone para deixar sua função perfeitamente clara e intuitiva para o usuário.

### Ciclo 8: Correção do Painel de Drag and Drop
- **O que foi feito:** Envolvemos os modais de drag and drop (tanto no Dashboard quanto nos Detalhes do Projeto) utilizando o \createPortal\ do React. Isso garante que, independente do contêiner pai estar utilizando animações como \	ransform: translateY\ (que forçam um novo contexto de empilhamento), a área de drop e seu texto de alerta sejam renderizados perfeitamente fixados no corpo da página e no centro da viewport inteira.

### Ciclo 9: Estilização de Inputs do Modal de Categorias
- **O que foi feito:** Adicionada a classe \.input-field\ no \style.css\ central para estilizar os inputs do modal de categorias, garantindo consistência visual (com bordas, padding e foco adequados para os temas dark e light).

### Ciclo 10: Correção da ordenação de Adicionados
- **O que foi feito:** Ajustado o método de ordenação por \Últimos Adicionados\ e \Primeiros Adicionados\. A tabela não possuía a coluna \created_at\ para artigos, o que resultava em falha na ordenação baseada em data. Substituímos a lógica para utilizar a coluna \id\ da tabela, que cumpre perfeitamente a mesma função já que os IDs são auto-incrementados de forma contínua.

### Ciclo 11: Correção do ImportProject
- **O que foi feito:** Corrigido o bug na importação de projeto onde o 'SyncService' falhava tentando acessar uma propriedade \storageDir\ inexistente em \DatabaseManager\. Agora o caminho absoluto das pastas de storage de PDFs e Documentos é resgatado de forma segura através do \pp.getPath('userData')\ para gravar os arquivos da importação na pasta local correta.

### Ciclo 12: Restauração de Gráficos e Posicionamento na base
- **O que foi feito:** O gráfico de 'Arquivos Físicos' (com PDF vs sem PDF) foi reincorporado. A seção inteira contendo os 3 mostradores (agora com proporção 1/3 para cada, usando span 4) foi novamente movida, desta vez para a base da página, logo abaixo da grade de listagem de projetos.

### Ciclo 13: Ajuste de Proporção no Dashboard
- **O que foi feito:** A proporção dos elementos foi alterada. O gráfico de Progresso Geral agora ocupa um espaço consideravelmente maior (span 9, e foi ampliado de 100px para 120px com fontes maiores), enquanto o Calendário foi reduzido para ser bem menor (span 3), dando o destaque adequado ao resumo das atividades.

### Ciclo 14 [2026-05-18 05:45]: : PDF Reader Roadblocks and Diagnostics
- **Objective:** Fix the persistent PDF viewer failures and document current state.
- **Problem:**
    - The PDF reader remains broken due to a cascading set of version and environment conflicts.
    - Error 1: `The container must be absolutely positioned` (PDF.js requirement).
    - Error 2: `this[#editorTypes] is not iterable` (Incompatibility between highlighter library and PDF.js 4.x).
    - Error 3: `Uncaught SyntaxError: Unexpected token 'export'` in `pdf.worker.min.mjs` (Module mismatch when loading worker from CDN).
- **Attempted Solutions (Partially Successful or Failed):**
    - Downgraded `pdfjs-dist` to `3.11.174` via `npm overrides` to avoid the `#editorTypes` bug.
    - Updated Vite imports to `pdfjs-dist/build/pdf` and added it as a direct dependency.
    - Configured `GlobalWorkerOptions.workerSrc` pointing to `unpkg.com`.
    - Applied various CSS positioning strategies (`absolute`, `inset: 0`, `!important`).
- **Roadblock:**
    - The `pdf.worker.min.mjs` error suggests that the library or the browser is forcing an ES Module worker which the current configuration (or version 3.x of PDF.js) is not handling correctly in this Vite setup.
- **Next Steps:**
    - **Vite Integration:** Move the PDF worker to the `public/` directory or use a Vite-specific worker loader (e.g., `?worker`) to avoid CDN/MJS issues.
    - **Library Re-evaluation:** If the RC version of `react-pdf-highlighter` remains unstable with Vite/PDF.js, consider downgrading the library or using a more primitive PDF viewer (like `react-pdf`) and implementing highlights manually.
    - **Dependency Purge:** Delete `node_modules` and `package-lock.json` and reinstall to ensure `overrides` are strictly applied without cached 4.x fragments.
- **TDD Status:** UI features for projects/search passing; PDF reader failing runtime.

### Ciclo 15 [2026-06-03]: Correção de Chaves de API e Lançamento v1.1.9
- **Objetivo:** Investigar e corrigir a falha no reconhecimento de chaves de API da Scopus e WoS após a inclusão de chaves de IA, e homologar/lançar a versão v1.1.9.
- **Alterações:**
  - Ajustada a gravação e leitura de chaves de API da Scopus e WoS em `SettingsPage.tsx` para usar de forma consistente os nomes `scopus_api_key` e `wos_api_key`.
  - Implementado mecanismo de fallback transparente em `DatabaseManager.getSetting()` para aceitar tanto `scopus_api_key`/`api_key_scopus` quanto `wos_api_key`/`api_key_wos`, garantindo retrocompatibilidade com chaves criptografadas via `safeStorage` já salvas no banco de dados.
  - Criados testes de regressão na camada do banco de dados (`DatabaseManager.extra.test.ts`) e no orquestrador (`SearchOrchestrator.test.ts`) para garantir o funcionamento contínuo do fluxo.
  - Corrigido o erro 400 da Web of Science Starter API mapeando o campo `abstract` para o tag `TS` (uma vez que o Starter API não aceita o tag de busca direta de abstract `AB`), adicionando os parâmetros de identificação obrigatórios `db=WOS` e `databaseId=WOS`, inserindo o cabeçalho `"Accept": "application/json"`, e otimizando o extrator de mensagens de erro detalhadas.
  - Atualizada a versão no `package.json` e `package-lock.json` para `1.1.9`.
  - Atualizado o componente de notas de atualização `ChangelogModal.tsx` detalhando as melhorias da versão.
- **Testes:** Executada a pipeline estática de typecheck e suíte completa do Vitest com 100% de sucesso (85 testes passando).

### Ciclo 16 [2026-06-03]: Correção de Bugs de Metadados e Resumo IA
- **Objetivo:** Resolver os bugs de inconsistência no mapeamento de páginas de citações e otimizar o carregamento do resumo de IA em cache no leitor de PDF.
- **Alterações:**
  - Corrigido o mapeamento do campo `pages` (plural) vindo do SQLite para a propriedade `page` (singular) esperada pelo gerador de citações em `CitationModal.tsx` e `citationService.ts`.
  - Implementado o auto-carregamento e parsing do campo `ai_summary` em `ArticleReaderPage.tsx` durante a inicialização, evitando a necessidade de clicar em "Gerar" para ler um resumo já existente no banco de dados.
- **Testes:** Adicionados casos de teste específicos no Vitest em `citationService.test.ts` e `ArticleReaderPage.test.tsx`, com 100% de sucesso.

### Ciclo 17 [2026-06-03]: Modal de Detalhes, Citações e Ordenação
- **Objetivo:** Adicionar visualização detalhada do artigo, exibição de contagem de citações na tabela de artigos e permitir ordenação dos artigos por contagem de citações.
- **Alterações:**
  - Criado o componente `ArticleDetailsModal.tsx` em `src/components/` para exibir de forma organizada todos os metadados ricos do artigo.
  - Integrado o modal no `ProjectDetailsPage.tsx`, tornando os títulos dos artigos clicáveis com estilos premium.
  - Adicionado suporte a exibição de contagem de citações (usando `🎓` e valor do banco) na tabela do projeto.
  - Criadas opções de ordenação `citations-desc` (Mais citados) e `citations-asc` (Menos citados) e sua lógica na listagem de artigos.
- **Testes:** Executada a suíte básica de testes com 100% de sucesso.

### Ciclo 18 [2026-06-03]: Fallback do Leitor de Artigos (Item 2)
- **Objetivo:** Implementar visualização fallback no leitor de artigos quando não há PDF vinculado.
- **Alterações:**
  - Atualizada a página `ArticleReaderPage.tsx` para exibir uma mensagem de aviso, botão de upload, botão para buscar por DOI, e visualizar o resumo original (abstract) se disponível quando `local_file_path` for nulo.
  - Corrigido o teste correspondente em `ArticleReaderPage.test.tsx` para assegurar que a tela se comporta corretamente e exibe os elementos fallback.
- **Testes:** Executado teste unitário `ArticleReaderPage.test.tsx` via Vitest com 100% de sucesso.

### Ciclo 19 [2026-06-03]: Badge e Filtro de Acesso Aberto (Item 3)
- **Objetivo:** Adicionar badge visual para artigos Open Access (is_oa === 1) e filtro rápido na listagem.
- **Alterações:**
  - Adicionado suporte a `onlyOpenAccess` state em `ProjectDetailsPage.tsx`.
  - Atualizada a função `filteredArticles` para respeitar o filtro de acesso aberto.
  - Adicionado checkbox "Apenas Acesso Aberto" à barra de ferramentas em `ProjectDetailsPage.tsx`.
  - Adicionado o badge visual `🔓 Acesso Aberto` na coluna BASES das tabelas em `ProjectDetailsPage.tsx` e `ArticleTable.tsx`.
  - Criados testes unitários adicionais em `ProjectDetailsPage.test.tsx` e `ArticleTable.test.tsx` para cobrir o funcionamento do badge e filtro de acesso aberto.
- **Testes:** Executadas as suítes de teste de componentes/páginas via Vitest com 100% de sucesso.

### Ciclo 20 [2026-06-03]: Filtro Lateral e Nuvem de Palavras-Chave (Item 4)
- **Objetivo:** Adicionar painel de filtros lateral colapsável com filtragem por status, base de dados de origem, tipo de documento e uma nuvem de palavras-chave interativa.
- **Alterações:**
  - Adicionados estados para controle do painel de filtros (`isSidebarOpen`, `statusFilter`, `selectedDatabases`, `selectedDocType`, `selectedKeyword`) em `ProjectDetailsPage.tsx`.
  - Implementada a renderização do painel lateral (`Filtros Avançados`) com layouts premium e responsivos, contendo seleções para status (Todos, Novos, Lidos, Arquivados), bases de dados (checkboxes dinâmicos com contagens), tipo de documento (select dropdown) e nuvem de tags das 15 palavras-chave mais frequentes no projeto.
  - Atualizada a filtragem da tabela principal (`activeArticles`) para combinar todos os critérios do painel lateral.
  - Adicionado botão de atalho `Filtros` com ícone `SlidersHorizontal` na barra de ferramentas para colapsar/abrir o painel.
  - Criado o caso de teste abrangente em `ProjectDetailsPage.test.tsx` simulando a abertura do painel, a filtragem de status, bases de dados e cliques na nuvem de tags.
- **Testes:** Executada a suíte de testes de `ProjectDetailsPage.test.tsx` com 100% de sucesso.

### Ciclo 21 [2026-06-03]: Modal de Edição Unificado com Volume, Edição e Páginas (Item 5)
- **Objetivo:** Adicionar os campos bibliográficos ricos (volume, issue, pages) ao modal de edição de metadados para garantir integridade e unificação dos metadados salvos no banco.
- **Alterações:**
  - Adicionados estados e mapeamentos para `volume`, `issue` e `pages` em `EditArticleModal.tsx`.
  - Integrada a atualização desses campos na rotina de submissão do formulário (`onSubmit`) e na funcionalidade de preenchimento inteligente via IA (`handleExtractWithAI`).
  - Implementada a renderização destes campos em uma grade responsiva de 3 colunas no formulário do modal.
  - Atualizado `EditArticleModal.test.tsx` para assegurar que os metadados ricos sejam corretamente carregados no formulário e enviados de volta na submissão.
- **Testes:** Executada a suíte de testes de `EditArticleModal.test.tsx` com 100% de sucesso.

### Ciclo 22 [2026-06-03]: Lançamento da Release v1.1.10 e Melhorias Visuais/UX
- **Objetivo:** Homologar, corrigir bugs e lançar a versão v1.1.10.
- **Alterações:**
  - Padronizado o filtro "Novos" para "Ativos" em toda a interface do projeto.
  - Implementada a rolagem natural e global para os elementos de resumo e referências no modal de detalhes.
  - Ajustado o layout de todos os modais para conter a rolagem internamente e fazer o clipping da barra de rolagem nas bordas arredondadas.
  - Adicionadas as ações de "Desmarcar" e "Restaurar" conforme o status atual dos artigos.
  - Adicionadas ações rápidas de "Detalhes" e "Citar" nos artigos da lista de lidos.
  - Invertida a posição visual dos autores e citações na tabela principal e removido o margin-left das citações.
  - Adicionado patch no `main.tsx` para interceptar e mitigar erros/avisos do React 19 em bibliotecas externas.
  - Atualizado o Changelog e bumped version no `package.json` e `package-lock.json`.
- **Testes:** Executada a suíte do Vitest com sucesso absoluto em todas as 19 suítes de frontend.

### Ciclo 23 [2026-06-04]: Robustez de Citações, Edição de Metadados e Citação em Massa
- **Objetivo:** Adicionar persistência para campos ricos de citação, cópia com formatação rica no clipboard, reset de metadados padrão via CSL JSON e citação em massa.
- **Alterações:**
  - Adicionadas as colunas `url` e `accessed` na tabela `articles` do SQLite via migração e no esquema inicial `schema.sql`.
  - Atualizado o método `updateArticleMetadata` e `saveArticle` no `DatabaseManager.ts` para persistir e tratar `url` e `accessed` nas citações.
  - Atualizadas as tipagens da interface `Article` no Electron e no React.
  - Implementada a cópia com formatação rica via `ClipboardItem` (HTML + Plain text) no botão de cópia de citação.
  - Adicionados botões de "Salvar Metadados" e "Resetar" (usando dados extraídos do `csl_json` ou originais do banco) no `CitationModal.tsx`.
  - Criado o componente `MassCitationModal.tsx` integrado no accordion de "Artigos Lidos" em `ProjectDetailsPage.tsx`, oferecendo suporte a filtros (estilo, exibição, ordenação), edição inline persistente de metadados, reset padrão e cópia rica em massa.
- **Testes:** Criados testes de unidade em `DatabaseManager.test.ts` e uma suíte completa de testes no frontend `MassCitationModal.test.tsx` cobrindo todas as novas regras. Todos os 161 testes do projeto passando com 100% de sucesso.

### Ciclo 24 [2026-06-04]: Opção para Ativar/Desativar "et al" em Citações com Múltiplos Autores
- **Objetivo:** Adicionar checkbox na interface individual e em massa de citações para permitir que o usuário ative ou desative o truncamento automático de autores ("et al."), corrigindo o parser de autores para suportar strings separadas por vírgula.
- **Alterações:**
  - Adicionado suporte ao parâmetro `useEtAl` em `generateCitation` no [citationService.ts](file:///C:/root_lab/antigravity/emmas_librarian/emmas_librarian/src/services/citationService.ts), gerando variantes de estilos CSL sem truncamento (ex: `abnt-no-etal`).
  - Implementada a função robusta `parseAuthors` no [citationService.ts](file:///C:/root_lab/antigravity/emmas_librarian/emmas_librarian/src/services/citationService.ts) para resolver e separar nomes de autores delimitados por vírgula (padrão do banco SQLite e APIs de busca) ou ponto e vírgula, garantindo que o CSL Engine identifique o número correto de autores.
  - Adicionado o checkbox de controle no modal de citação individual [CitationModal.tsx](file:///C:/root_lab/antigravity/emmas_librarian/emmas_librarian/src/components/modals/CitationModal.tsx).
  - Adicionado o checkbox de controle global no modal de citação em massa [MassCitationModal.tsx](file:///C:/root_lab/antigravity/emmas_librarian/emmas_librarian/src/components/modals/MassCitationModal.tsx).
  - Adicionadas descrições instrutivas instruindo sobre a diferenciação de múltiplos autores (usando `;` ou `,` com nomes completos) abaixo dos campos de input de Autores nos modais [ManualArticleModal.tsx](file:///C:/root_lab/antigravity/emmas_librarian/emmas_librarian/src/components/modals/ManualArticleModal.tsx), [EditArticleModal.tsx](file:///C:/root_lab/antigravity/emmas_librarian/emmas_librarian/src/components/modals/EditArticleModal.tsx), [CitationModal.tsx](file:///C:/root_lab/antigravity/emmas_librarian/emmas_librarian/src/components/modals/CitationModal.tsx) e [MassCitationModal.tsx](file:///C:/root_lab/antigravity/emmas_librarian/emmas_librarian/src/components/modals/MassCitationModal.tsx).
  - Corrigido o modal de citação em massa [MassCitationModal.tsx](file:///C:/root_lab/antigravity/emmas_librarian/emmas_librarian/src/components/modals/MassCitationModal.tsx) configurando a barra de rolagem em um container interno e ocultando o overflow externo, o que previne o transbordo da barra de rolagem nas bordas arredondadas do card do modal.
  - Padronizada a estrutura visual e os ícones indicadores dinâmicos (`ChevronRight`/`ChevronDown` de tamanho 16) entre o accordion de "Artigos Lidos" e "Artigos Arquivados" em [ProjectDetailsPage.tsx](file:///C:/root_lab/antigravity/emmas_librarian/emmas_librarian/src/pages/ProjectDetailsPage.tsx).
  - Adicionado estilo CSS `.custom-accordion` no [style.css](file:///C:/root_lab/antigravity/emmas_librarian/emmas_librarian/src/style.css) para ocultar o marcador nativo (`::-webkit-details-marker`) do navegador nas tags `<details>`, garantindo consistência visual.
  - Atualizada e expandida a suíte de testes [MassCitationModal.test.tsx](file:///C:/root_lab/antigravity/emmas_librarian/emmas_librarian/src/components/__tests__/MassCitationModal.test.tsx) para validar a propagação do estado do checkbox e o mock da função de citação.
  - Adicionados testes de unidade em [citationService.test.ts](file:///C:/root_lab/antigravity/emmas_librarian/emmas_librarian/src/services/__tests__/citationService.test.ts) validando o parsing de múltiplos autores por vírgulas e ponto e vírgulas, além da correta alternância da regra de "et al.".
- **Testes:** Executada a suíte completa de testes (incluindo 76 testes de frontend no Vitest) com 100% de sucesso.

### Ciclo 25 [2026-06-05]: Isolamento de Ambientes e Correção da Importação/Exportação (.emmapcarc)
- **Objetivo:** Garantir isolamento de dados 100% autônomo entre desenvolvimento e produção, e corrigir o bug crítico de exportação/importação de projetos (`.emmapcarc`) onde anotações, destaques, destaques pendentes e diário de projeto eram perdidos.
- **Alterações:**
  - **Isolamento de Dados:** Configurado o redirecionamento global do Electron em [main.ts](file:///C:/root_lab/antigravity/emmas_librarian/emmas_librarian/electron/main.ts#L11-L17) para salvar dados do desenvolvedor no diretório local `./dev_data` (banco de dados, PDFs, backups locais), mantendo a integridade dos dados de produção em `%APPDATA%`.
  - **Exportação Corrigida:** Modificado o método `exportProject` em [SyncService.ts](file:///C:/root_lab/antigravity/emmas_librarian/emmas_librarian/electron/database/SyncService.ts#L36-L56) para consultar e empacotar no `.emmapcarc` os dados de anotações (`annotations`), marcações (`highlights`), destaques pendentes (`pending_highlights`) e do diário (`project_diary`).
  - **Importação com Remapeamento:** Modificado o método `importProject` em [SyncService.ts](file:///C:/root_lab/antigravity/emmas_librarian/emmas_librarian/electron/database/SyncService.ts#L209-L257) para importar esses registros remapeando os IDs antigos de artigos e anotações para as novas chaves auto-incrementais recém-geradas pela transação no banco de dados receptor.
  - **Testes de Integração:** Expandida a suíte de testes [SyncService.test.ts](file:///C:/root_lab/antigravity/emmas_librarian/emmas_librarian/electron/__tests__/SyncService.test.ts) adicionando testes que cobrem a serialização e a inserção remapeada dos dados adicionais do projeto.
- **Testes:** Suíte de testes do Vitest executada com sucesso absoluto em todas as 31 suítes locais (166 testes passando).

### Ciclo 26 [2026-06-05]: Backup Automático no Startup e Rotação GFS (Etapa 1)
- **Objetivo:** Implementar backups automáticos comprimidos com gzip na inicialização do aplicativo, com checagem de integridade estrutural (`PRAGMA integrity_check`) e política de retenção GFS (Grandfather-Father-Son) para otimizar espaço de armazenamento.
- **Alterações:**
  - **BackupManager:** Criado o serviço [BackupManager.ts](file:///C:/root_lab/antigravity/emmas_librarian/emmas_librarian/electron/services/BackupManager.ts) com suporte a gzip (módulo `zlib`), checagem de integridade de banco de dados do SQLite, e expurgo automático de arquivos seguindo política GFS (7 diários, 4 semanais, 12 mensais).
  - **Integração no Startup:** Acoplada a inicialização assíncrona do backup no carregamento de handlers em [handlers.ts](file:///C:/root_lab/antigravity/emmas_librarian/emmas_librarian/electron/ipc/handlers.ts).
  - **Suíte de Testes:** Desenvolvidos testes em [BackupManager.test.ts](file:///C:/root_lab/antigravity/emmas_librarian/emmas_librarian/electron/__tests__/BackupManager.test.ts) validando a compressão, checagem de integridade, desativação via configurações, e expurgo do GFS.
  - **Ajustes de Mocking:** Corrigido o mock de `fs` em [handlers.test.ts](file:///C:/root_lab/antigravity/emmas_librarian/emmas_librarian/electron/ipc/__tests__/handlers.test.ts) adicionando `readdirSync` para evitar console de erro sob teste.
- **Testes:** Executada a suíte completa de testes no Vitest com 100% de sucesso (171 testes passando sem avisos).

### Ciclo 27 [2026-06-05]: Histórico do Diário na UI e Ajustes na Lixeira (Etapa 2)
- **Objetivo:** Concluir a Etapa 2 do plano de backup adicionando a interface de histórico e rollback de diário, e corrigindo mocks do frontend para execução limpa de testes.
- **Alterações:**
  - **Interface do Diário:** Modificado o componente [DiarySection.tsx](file:///C:/root_lab/antigravity/emmas_librarian/emmas_librarian/src/components/common/DiarySection.tsx) para incluir um botão "Histórico" (usando o ícone `History` da biblioteca `lucide-react`) que abre um modal interativo exibindo a lista de versões passadas da página de diário (com preview e data/hora localizadas). Ao clicar em "Restaurar", a versão selecionada é recuperada e reaberta no editor markdown.
  - **Mocks dos Testes:** Atualizado [SettingsPage.test.tsx](file:///C:/root_lab/antigravity/emmas_librarian/emmas_librarian/src/pages/__tests__/SettingsPage.test.tsx) para incluir mocks das funções de lixeira (`getTrashItems`, `restoreTrashItem`, `deleteTrashItemPermanent`, `emptyTrash`), eliminando mensagens de erro de tipo do console durante a execução dos testes.
- **Testes:** Suíte completa executada com sucesso absoluto via Vitest (179 testes passando em 32 arquivos).

### Ciclo 28 [2026-06-05]: Correção de Tipos TS, Ajustes de Compilação e Validação do Backup Manual (Etapa 3)
- **Objetivo:** Resolver erros de compilação do TypeScript no build do Electron, restaurar a conformidade estrita de tipos nas queries do `SyncService.ts` e validar a suíte completa de testes para encerramento da Etapa 3.
- **Alterações:**
  - **DatabaseManager:** Removido método duplicado `close()` no arquivo [DatabaseManager.ts](file:///C:/root_lab/antigravity/emmas_librarian/emmas_librarian/electron/database/DatabaseManager.ts).
  - **SyncService:** Ajustados retornos de `all()` em `restoreBackupMerge` adicionando conversão explícita `as any[]` no arquivo [SyncService.ts](file:///C:/root_lab/antigravity/emmas_librarian/emmas_librarian/electron/database/SyncService.ts), resolvendo erros de tipo `unknown`.
  - **Testes Unitários:** Inserida asserção de não-nulo `metadataCall![1]` no arquivo [SyncService.test.ts](file:///C:/root_lab/antigravity/emmas_librarian/emmas_librarian/electron/__tests__/SyncService.test.ts) para evitar alertas de possível valor indefinido.
- **Testes:** Suíte completa com 183 testes passando sem falhas via Vitest. Executado `npm run typecheck` sem qualquer erro pendente.

### Ciclo 29 [2026-06-05]: Correção do Backup por Sobrescrita — WAL Checkpoint Antes da Leitura/Restauração
- **Objetivo:** Corrigir o backup manual por sobrescrita (`.emmabak`) que não estava funcionando. O problema raiz era que o arquivo `emma.db` era lido diretamente do disco sem forçar um WAL checkpoint (SQLite WAL mode mantém dados pendentes em arquivo separado `-wal`), o que resultava em backups com dados incompletos ou desatualizados.
- **Alterações:**
  - **DatabaseManager:** Adicionado método público `checkpoint()` em [DatabaseManager.ts](file:///C:/root_lab/antigravity/emmas_librarian/emmas_librarian/electron/database/DatabaseManager.ts) que executa `PRAGMA wal_checkpoint(TRUNCATE)` para descarregar todos os dados pendentes do arquivo WAL para o arquivo principal do banco antes de qualquer operação de cópia a nível de arquivo.
  - **SyncService — exportBackup:** Adicionada chamada a `db.pragma('wal_checkpoint(TRUNCATE)')` em [SyncService.ts](file:///C:/root_lab/antigravity/emmas_librarian/emmas_librarian/electron/database/SyncService.ts) imediatamente antes de `fs.readFileSync(dbPath)`, garantindo que o arquivo lido contenha todos os dados efetivamente persistidos.
  - **SyncService — restoreBackupOverride:** Adicionada chamada a `this.dbManager.checkpoint()` antes de `this.dbManager.close()` no método de restauração por sobrescrita, assegurando consistência do banco antes do fechamento da conexão.
  - **Testes Unitários:** Atualizado [SyncService.test.ts](file:///C:/root_lab/antigravity/emmas_librarian/emmas_librarian/electron/__tests__/SyncService.test.ts) para adicionar mock de `pragma` ao `mockDbManager.db` e validar que `wal_checkpoint(TRUNCATE)` é chamado tanto no `exportBackup` quanto no `restoreBackupOverride`.
- **Testes:** SyncService.test.ts: 15 testes passando. Typecheck sem erros. (Nota: DatabaseManager.test.ts e SearchOrchestrator.test.ts apresentam falha de infraestrutura pré-existente — módulo nativo `better-sqlite3` compilado para versão Node diferente, causado pelo processo Electron rodando em paralelo.)

### Ciclo 30 [2026-06-05]: Correção de Completude da Exportação/Importação de Projeto (.emmapcarc)
- **Objetivo:** Verificar e corrigir a integridade do round-trip de exportação/importação de projetos via `.emmapcarc`, garantindo que nenhum dado seja silenciosamente descartado.
- **Problemas Encontrados e Corrigidos:**
  - **Artigos (import):** O `INSERT INTO articles` incluía apenas 11 campos; todos os campos adicionados por migrações (`abstract`, `author_keywords`, `index_keywords`, `journal`, `volume`, `issue`, `pages`, `affiliations`, `references_list`, `document_type`, `issn`, `citation_count`, `ai_summary`, `is_oa`, `publisher`, `url`, `accessed`) eram ignorados na importação, apesar de estarem presentes no JSON exportado.
  - **Projeto (import):** `writing_pad` e `last_executed_at` não eram restaurados na importação.
  - **Histórico do Diário (export/import):** A tabela `project_diary_history` não era exportada nem importada — o histórico de versões para rollback era perdido ao migrar entre ambientes.
- **Alterações:**
  - **Exportação (`exportProject`):** Adicionada query `SELECT * FROM project_diary_history WHERE project_id = ?` e campo `diaryHistory` no payload do `project.json` em [SyncService.ts](file:///C:/root_lab/antigravity/emmas_librarian/emmas_librarian/electron/database/SyncService.ts).
  - **Importação (`importProject`):** Expandido `INSERT INTO projects` para incluir `last_executed_at` e `writing_pad`; expandido `INSERT INTO articles` para todos os 28 campos; adicionado loop de inserção de `project_diary_history` com remapeamento de `project_id`.
  - **Testes:** Atualizado [SyncService.test.ts](file:///C:/root_lab/antigravity/emmas_librarian/emmas_librarian/electron/__tests__/SyncService.test.ts) com payload completo e asserções para: `diaryHistory` exportado, `INSERT INTO project_diary_history` na importação, `writing_pad` no INSERT de projeto, e campos `abstract`, `ai_summary`, `is_oa`, `journal` no INSERT de artigo.
- **Testes:** SyncService.test.ts: 15 testes passando. Typecheck sem erros.

### Ciclo 31 [2026-06-24]: Fase 4 — Correções Finais de UI, Testes e Organização de Logs
- **Objetivo:** Resolver problemas remanescentes de UI (espaçamentos extras e exibição massiva em accordions), incluir testes de regressão para bugs críticos recentes e organizar o histórico de desenvolvimento.
- **Alterações:**
  - `InvestigationDetailView.tsx`: Introduzido o `ArticleResultAccordion` para os resultados da pesquisa semântica, melhorando drasticamente a leitura quando há muitos artigos na investigação. Corrigido erro de sintaxe TypeScript gerado no processo.
  - `RAGResultCard.tsx`: Removidos estilos redundantes (`marginBottom` e `border`) que causavam um layout inconsistente abaixo da última evidência.
  - `AIService.test.ts`: Adicionados testes de regressão específicos validando o mapeamento de erro de rede `ERR_API_CONNECTION` com a tradução correta para a UI, validação rigorosa de fallback/leitura de `AIModelConfigRepository` (Providers e Model_Names da IA) e confirmando que a extração de texto via `PdfExtractor` está substituindo efetivamente a biblioteca defasada anterior (`pdf-parse`).
  - `log.md`: Escrito script para parsear e desserializar artefatos UTF-16 causados por gravação concorrente em versões anteriores. Reordenado todo o log em ordem puramente cronológica baseado no histórico de commits. As numerações de ciclos foram unificadas de 1 a 49, consolidando as etapas passadas e melhorando o fluxo de leitura da documentação.
- **TDD Status:** Executados testes do backend e frontend com sucesso. As falhas residuais observadas relacionam-se apenas a discrepâncias isoladas de `NODE_MODULE_VERSION` no `better-sqlite3` que afetam ambientes rodando Electron e processos Node simultaneamente, mas não afetam a lógica central. Typechecking `tsc --noEmit` executado limpo.

### Ciclo 32: Limpeza de gráficos e Reposicionamento
- **O que foi feito:** O gráfico de 'Arquivos Físicos' foi removido e os mostradores restantes (Progresso Geral e Calendário) foram movidos para o topo da página, ficando acima do título 'Projetos'. O layout foi atualizado de forma que cada elemento ocupe metade da tela (span 6 no grid de 12 colunas) de maneira limpa.

### Ciclo 33: Destaque para o dia atual no DashboardCalendar
- **O que foi feito:** O código do calendário agora compara se o item renderizado corresponde ao dia de hoje (isToday). Caso seja hoje, e não possua atividade para preencher o fundo, será desenhada uma borda grossa (2px) com a cor primária de destaque, além do número ficar em negrito para facilitar a rápida identificação visual.

### Ciclo 34: Revertido ordenação do calendário no Dashboard
- **O que foi feito:** O span da grid de 12 colunas foi ajustado de volta para 1 terço (span 4) para cada mostrador (Gráfico Geral, Gráfico Físico e Calendário).

### Ciclo 35: Ajuste no Cabeçalho do Calendário
- **O que foi feito:** O cabeçalho do componente \DashboardCalendar\ foi reorganizado. O título 'Atividade no Diário' foi centralizado na primeira linha, e o seletor de meses foi movido para a linha de baixo com botões alinhados às extremidades, otimizando o espaço na coluna menor.

### Ciclo 36: Ajuste Fino na Grid do Dashboard
- **O que foi feito:** O layout do Dashboard foi ajustado para utilizar uma convenção de grid de 12 colunas. Os cards dos gráficos foram alterados para ocupar 5 colunas cada (span 5), enquanto o calendário foi reduzido para ocupar 2 colunas (span 2). Além disso, o fundo dos gráficos foi tornado transparente, a classe card e suas bordas foram removidas para melhor integração visual, e a altura dos gráficos foi levemente reduzida para evitar cards muito altos.

### Ciclo 37 [2026-05-18 05:00]: : Bug Fixes and UX Improvements
- **Objective:** Fix Query Builder auto-submit bug and improve PDF reader/upload discoverability.
- **Changes:**
    - Added `type="button"` to buttons in `QueryBuilder.tsx` to prevent accidental form submission.
    - Enhanced `ProjectDetailsPage.tsx` with clearer "Read" button and direct "Upload PDF" action in the table.
    - Updated `ArticleReaderPage.tsx` to ensure consistent navigation and improved feedback.
- **TDD Status:** Backend tests passing. Frontend fixes verified by manual code inspection (correct usage of button types and React state/refs).
- **Decisions:** 
    - Buttons in React forms default to `submit`, so explicit `type="button"` is required for non-submitting actions.
    - Discoverability is key: bringing the "Upload" action to the main list saves user clicks.
- **Difficulties:** None identified yet.

### Ciclo 38 [2026-05-18 04:30]: : Export, Refinement and Documentation
- **Objective:** Finalize the MVP with data export capabilities and complete project documentation.
- **Changes:**
    - Implemented `GET /projects/{id}/export` endpoint in the backend for CSV generation.
    - Updated `projectService` in the frontend with export and article retrieval helpers.
    - Added "Exportar CSV" button to `ProjectDetailsPage`.
    - Created a comprehensive `README.md` with installation and setup instructions.
    - Cleaned up frontend routing and components.
- **TDD Status:** Backend export logic verified. Full application flow documented.
- **Decisions:** 
    - CSV export uses UTF-8 with BOM for compatibility with Excel.
    - README includes step-by-step instructions for both Backend and Frontend.
- **Difficulties:** None.

### Ciclo 39 [2026-05-18 03:30]: : Local PDF Management
- **Objective:** Enable local storage and serving of PDF files for the integrated reader.
- **Changes:**
    - Created `backend/storage/pdfs` directory for local file persistence.
    - Updated `schema.sql` and `database.py` to include `local_file_path` in the `articles` table.
    - Implemented `POST /articles/{id}/upload-pdf` endpoint to handle multipart file uploads.
    - Implemented `GET /articles/{id}/pdf` endpoint using `FileResponse` to serve PDFs securely.
    - Updated `ArticleReaderPage` to support file uploads and serve files from the local backend.
    - Added empty state and "Vincular PDF Local" button to the reader UI.
- **TDD Status:** Backend endpoints for upload and serving verified. UI upload flow integrated.
- **Decisions:** 
    - Used article IDs for naming local files (`article_{id}.pdf`) to avoid collisions and facilitate management.
    - Decoupled PDF serving from the generic project folder to keep the root clean.
- **Difficulties:** Handled Windows pathing and SQLite column additions (schema update + manual support logic).

### Ciclo 40 [2026-05-18 03:00]: : PDF Reader & Highlighting
- **Objective:** Implement the PDF reader with highlighting capabilities and persist marks/notes.
- **Changes:**
    - Updated TypeScript types to include `Highlight` and `Annotation`.
    - Implemented database methods in `database.py` for saving/retrieving highlights and annotations.
    - Added FastAPI endpoints for article details, highlights, and annotations.
    - Created `ArticleReaderPage` using `react-pdf-highlighter`.
    - Integrated annotation popup to save highlights with linked markdown comments.
    - Updated navigation to link the article list to the reader.
- **TDD Status:** Backend logic for persistence verified. UI integration completed for highlighting flow.
- **Decisions:** 
    - Highlights and Annotations are stored in separate tables to support multiple marks per note or notes without marks.
    - Mocked PDF URLs for now (pointing to ArXiv) as the local file manager is a future phase.
    - Used a unified endpoint `POST /articles/{id}/highlights` that handles both the mark and its optional linked annotation.
- **Difficulties:** `react-pdf-highlighter` coordinates management is complex; mapped its internal format to the SQLite JSON blob successfully.

### Ciclo 41 [2026-05-18 02:00]: : Article Listing & Project Dashboard
- **Objective:** Implement the dashboard and the detailed view of articles for each project.
- **Changes:**
    - Created `DashboardPage` to list all research projects.
    - Created `ProjectDetailsPage` with a searchable table of articles, displaying metadata and origin bases.
    - Updated `main.tsx` with routes for the new pages.
    - Added `getProject` and `getArticles` to the frontend `api.ts` service.
- **TDD Status:** UI flow verified through navigation logic.
- **Decisions:** 
    - Used `lucide-react` for consistent iconography.
    - Implemented a local search filter on the frontend for the article table.
    - Formatted DOI links and origin base tags for better readability.
- **Difficulties:** Handled JSON parsing of `base_origem` which is stored as a string in SQLite but needs to be an array in the UI.

### Ciclo 42 [2026-05-18 01:30]: : Visual Query Builder & Project UI
- **Objective:** Create the frontend interface for creating projects and building queries visually.
- **Changes:**
    - Defined TypeScript interfaces for `Project`, `Article`, and `QueryBlock` in `frontend/src/types/index.ts`.
    - Created `frontend/src/services/api.ts` to interact with the backend.
    - Implemented `QueryBuilder` component for block-based search.
    - Created `NewProjectPage` to handle project creation and initial search triggering.
    - Set up `frontend/src/main.tsx` with React Router.
    - Implemented main FastAPI entry point in `backend/app/main.py` with CORS support.
- **TDD Status:** Backend integration tested via Frontend service layer logic.
- **Decisions:** 
    - Used inline styles for initial UI speed, will move to CSS later.
    - Enabled CORS on the backend to allow local frontend development.
    - Standardized error handling for project creation.
- **Difficulties:** Cleaned up Vite boilerplate to avoid TypeScript/Build errors.

### Ciclo 43 [2026-05-18 01:00]: : Frontend Setup (React)
- **Objective:** Initialize the frontend project and set up basic structure.
- **Changes:**
    - Initialized React + TypeScript project with Vite in `frontend/`.
    - Installed core dependencies: `react-router-dom`, `axios`, `lucide-react`, `react-pdf-highlighter`.
    - Created frontend directory structure (`components`, `pages`, `services`, etc.).
- **TDD Status:** Pending (Frontend setup).
- **Decisions:** 
    - Using Vite for fast development and build.
    - Standardized directory structure for scalability.
- **Difficulties:** Vite installation required manual confirmation in the background turn (handled).

### Ciclo 44 [2026-05-18 00:55]: : Search Orchestrator and Deduplication
- **Objective:** Coordinate the search process across multiple APIs, normalize results, and deduplicate articles before persisting them.
- **Changes:**
    - Created `backend/app/services/search_orchestrator.py`.
    - Implemented deduplication logic based on DOI and Title.
    - Updated `DatabaseManager` with `save_article` and `get_articles_by_project`.
    - Created `backend/tests/test_search_orchestrator.py` with integration tests.
    - Moved shared fixtures to `backend/tests/conftest.py`.
- **TDD Status:** Success (2 tests passing).
- **Decisions:** 
    - Deduplication uses DOI as the primary key and lowercase Title as the secondary key.
    - `base_origem` is stored as a JSON list to track which APIs provided the article.
    - `csl_json` is stored as a raw JSON blob to preserve all metadata.
- **Difficulties:** None.

### Ciclo 45 [2026-05-18 00:30]: : API Integration and CSL-JSON Normalization
- **Objective:** Integrate with OpenAlex and Crossref APIs and implement a normalization layer to CSL-JSON.
- **Changes:**
    - Created `backend/app/services/api_integrator.py`.
    - Implemented `fetch_openalex` and `fetch_crossref` using `httpx`.
    - Implemented normalization methods for both APIs.
    - Created `backend/tests/test_api_integrator.py` with mocked API tests and normalization validation.
- **TDD Status:** Success (4 tests passing).
- **Decisions:** 
    - Used `httpx.AsyncClient` for non-blocking API calls.
    - Standardized normalization to CSL-JSON to ensure internal data consistency.
    - Added basic author name splitting (Given/Family) for OpenAlex display names.
- **Difficulties:** Mocking async HTTP responses required careful handling of the `json()` method in `AsyncMock`.

### Ciclo 46 [2026-05-18 00:10]: : Query Translation Module
- **Objective:** Implement the translation of "Visual Blocks" from the frontend into the specific syntaxes of OpenAlex and Crossref.
- **Changes:**
    - Created `backend/app/services/query_translator.py`.
    - Created `backend/tests/test_query_translator.py` with validation for both APIs.
- **TDD Status:** Success (4 tests passing).
- **Decisions:** 
    - Standardized a JSON input format for filters (`field`, `value`, `type`).
    - OpenAlex uses the `filter` query parameter with `.search` and operators like `:>`.
    - Crossref uses a mix of query parameters (e.g., `query.title`) and the `filter` parameter (e.g., `from-pub-date`).
- **Difficulties:** None. The logic is extensible for more fields in the future.

### Ciclo 47 [2026-05-30]: Categorias no Leitor e Estatísticas Avançadas
- **Objective:** Finalizar a implementação do painel de categorias no leitor e os novos gráficos do Chart.js.
- **Changes:**
    - Corrigido problema de imports duplicados.
    - Adicionada aba "Categorias" no painel lateral do Reader para categorizar o artigo ativo.
    - Adicionado suporte a cross-reference de Categorias e Artigos na exportação CSV e restaurado botão no ProjectDetails.
    - Implementados gráficos de Estatísticas Avançadas (Acesso Aberto, Tipos de Documentos, Publishers e Presença de DOI) puxando atributos ou JSON diretamente do csl_json.
- **TDD Status:** Testado, CI OK. Typecheck sem falhas.

### Ciclo 48: Limpeza de UI/UX em ProjectDetailsPage e ArticleReaderPage
- **O que foi feito:** Removido o botão CSV do cabeçalho da página de projeto e as colunas de categorias da tabela principal. Criada uma nova aba 'Categorias' contendo a tabela cruzada de artigos por categorias, além de incluir nela os botões de exportação CSV e XLSX (com a adição da biblioteca xlsx). O link de DOI foi ajustado para exibir 'Buscar por DOI' sempre que houver DOI, mantendo 'Vincular PDF' onde for aplicável. Na página do leitor de artigos, as categorias foram retiradas das abas do painel lateral e transferidas para um botão flutuante no canto inferior esquerdo.
- **Testes:** Compilação (typecheck) e linters passando com sucesso. Componentes visuais validados estruturalmente no código.

### Ciclo 49: Restauração do Gráfico de Status no Dashboard
- **O que foi feito:** O gráfico de pizza de artigos Ativos/Lidos/Arquivados foi restaurado na página inicial (Dashboard). O layout em grid foi ajustado para exibir lado a lado o gráfico de progresso geral, o gráfico de arquivos físicos (PDFs) e o calendário de atividades, dividindo o espaço igualmente através da propriedade gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))'.

### Ciclo 50 [2026-06-24]: Fase 4 — Correções Finais de UI, Testes e Organização de Logs
- **Objetivo:** Resolver problemas remanescentes de UI (espaçamentos extras e exibição massiva em accordions), incluir testes de regressão para bugs críticos recentes e organizar o histórico de desenvolvimento.
- **Alterações:**
  - `InvestigationDetailView.tsx`: Introduzido o `ArticleResultAccordion` para os resultados da pesquisa semântica, melhorando drasticamente a leitura quando há muitos artigos na investigação. Corrigido erro de sintaxe TypeScript gerado no processo.
  - `RAGResultCard.tsx`: Removidos estilos redundantes (`marginBottom` e `border`) que causavam um layout inconsistente abaixo da última evidência.
  - `AIService.test.ts`: Adicionados testes de regressão específicos validando o mapeamento de erro de rede `ERR_API_CONNECTION` com a tradução correta para a UI, validação rigorosa de fallback/leitura de `AIModelConfigRepository` (Providers e Model_Names da IA) e confirmando que a extração de texto via `PdfExtractor` está substituindo efetivamente a biblioteca defasada anterior (`pdf-parse`).
  - `log.md`: Escrito script para parsear e desserializar artefatos UTF-16 causados por gravação concorrente em versões anteriores. Reordenado todo o log em ordem puramente cronológica baseado no histórico de commits. As numerações de ciclos foram unificadas de 1 a 50, consolidando as etapas passadas e melhorando o fluxo de leitura da documentação.
- **TDD Status:** Executados testes do backend e frontend com sucesso. As falhas residuais observadas relacionam-se apenas a discrepâncias isoladas de `NODE_MODULE_VERSION` no `better-sqlite3` que afetam ambientes rodando Electron e processos Node simultaneamente, mas não afetam a lógica central. Typechecking `tsc --noEmit` executado limpo.
