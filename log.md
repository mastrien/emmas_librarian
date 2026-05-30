# Development Log - Emma's Librarian

## [2026-05-18 05:45] Cycle 13: PDF Reader Roadblocks and Diagnostics
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

## [2026-05-18 05:15] Cycle 12: PDF Viewer Positioning Fix
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

## [2026-05-18 05:00] Cycle 11: Bug Fixes and UX Improvements
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

## [2026-05-18 04:30] Cycle 10: Export, Refinement and Documentation
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

## [2026-05-18 03:30] Cycle 9: Local PDF Management
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

## [2026-05-18 03:00] Cycle 8: PDF Reader & Highlighting
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

## [2026-05-18 02:00] Cycle 7: Article Listing & Project Dashboard
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

## [2026-05-18 01:30] Cycle 6: Visual Query Builder & Project UI
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

## [2026-05-18 01:00] Cycle 5: Frontend Setup (React)
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

## [2026-05-18 00:55] Cycle 4: Search Orchestrator and Deduplication
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

## [2026-05-18 00:30] Cycle 3: API Integration and CSL-JSON Normalization
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

## [2026-05-18 00:10] Cycle 2: Query Translation Module
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

## [2026-05-17 23:35] Cycle 1: Project Setup and Database Schema
- **Objective:** Initialize the backend project structure and create the SQLite database schema.
- **Changes:**
    - Created `backend/` directory.
    - Created `log.md` to track progress.
    - Initialized `backend/requirements.txt`.
    - Created `backend/app/db/schema.sql` with the finalized database structure.
    - Implemented `backend/app/db/database.py` for SQLite management.
    - Created `backend/tests/test_db.py` for database validation.
- **TDD Status:** Success (Tests passing for initialization and basic project creation).
- **Decisions:** 
    - Using FastAPI for the backend.
    - Raw SQL used for schema initialization to ensure exact matching with the requested structure.
    - DatabaseManager implemented with context managers for safe connection handling.
- **Difficulties:** PermissionError on Windows during test teardown (handled with explicit connection closing and minor delay).

 
 # #   [ 2 0 2 6 - 0 5 - 3 0 ]   C y c l e   1 0 :   C a t e g o r i a s   n o   L e i t o r   e   E s t a t í s t i c a s   A v a n ç a d a s 
 -   * * O b j e c t i v e : * *   F i n a l i z a r   a   i m p l e m e n t a ç ã o   d o   p a i n e l   d e   c a t e g o r i a s   n o   l e i t o r   e   o s   n o v o s   g r á f i c o s   d o   C h a r t . j s . 
 -   * * C h a n g e s : * * 
         -   C o r r i g i d o   p r o b l e m a   d e   i m p o r t s   d u p l i c a d o s . 
         -   A d i c i o n a d a   a b a   " C a t e g o r i a s "   n o   p a i n e l   l a t e r a l   d o   R e a d e r   p a r a   c a t e g o r i z a r   o   a r t i g o   a t i v o . 
         -   A d i c i o n a d o   s u p o r t e   a   c r o s s - r e f e r e n c e   d e   C a t e g o r i a s   e   A r t i g o s   n a   e x p o r t a ç ã o   C S V   e   r e s t a u r a d o   b o t ã o   n o   P r o j e c t D e t a i l s . 
         -   I m p l e m e n t a d o s   g r á f i c o s   d e   E s t a t í s t i c a s   A v a n ç a d a s   ( A c e s s o   A b e r t o ,   T i p o s   d e   D o c u m e n t o s ,   P u b l i s h e r s   e   P r e s e n ç a   d e   D O I )   p u x a n d o   a t r i b u t o s   o u   J S O N   d i r e t a m e n t e   d o   c s l _ j s o n . 
 -   * * T D D   S t a t u s : * *   T e s t a d o ,   C I   O K .   T y p e c h e c k   s e m   f a l h a s .  
 
### Ciclo 4: Limpeza de UI/UX em ProjectDetailsPage e ArticleReaderPage
- **O que foi feito:** Removido o botão CSV do cabeçalho da página de projeto e as colunas de categorias da tabela principal. Criada uma nova aba 'Categorias' contendo a tabela cruzada de artigos por categorias, além de incluir nela os botões de exportação CSV e XLSX (com a adição da biblioteca xlsx). O link de DOI foi ajustado para exibir 'Buscar por DOI' sempre que houver DOI, mantendo 'Vincular PDF' onde for aplicável. Na página do leitor de artigos, as categorias foram retiradas das abas do painel lateral e transferidas para um botão flutuante no canto inferior esquerdo.
- **Testes:** Compilação (typecheck) e linters passando com sucesso. Componentes visuais validados estruturalmente no código.

### Ciclo 5: Restauração do Gráfico de Status no Dashboard
- **O que foi feito:** O gráfico de pizza de artigos Ativos/Lidos/Arquivados foi restaurado na página inicial (Dashboard). O layout em grid foi ajustado para exibir lado a lado o gráfico de progresso geral, o gráfico de arquivos físicos (PDFs) e o calendário de atividades, dividindo o espaço igualmente através da propriedade gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))'.

### Ciclo 6: Ajuste Fino na Grid do Dashboard
- **O que foi feito:** O layout do Dashboard foi ajustado para utilizar uma convenção de grid de 12 colunas. Os cards dos gráficos foram alterados para ocupar 5 colunas cada (span 5), enquanto o calendário foi reduzido para ocupar 2 colunas (span 2). Além disso, o fundo dos gráficos foi tornado transparente, a classe card e suas bordas foram removidas para melhor integração visual, e a altura dos gráficos foi levemente reduzida para evitar cards muito altos.

### Ciclo 7: Ajuste no Cabeçalho do Calendário
- **O que foi feito:** O cabeçalho do componente \DashboardCalendar\ foi reorganizado. O título 'Atividade no Diário' foi centralizado na primeira linha, e o seletor de meses foi movido para a linha de baixo com botões alinhados às extremidades, otimizando o espaço na coluna menor.

### Ciclo 8: Revertido ordenação do calendário no Dashboard
- **O que foi feito:** O span da grid de 12 colunas foi ajustado de volta para 1 terço (span 4) para cada mostrador (Gráfico Geral, Gráfico Físico e Calendário).

### Ciclo 9: Destaque para o dia atual no DashboardCalendar
- **O que foi feito:** O código do calendário agora compara se o item renderizado corresponde ao dia de hoje (isToday). Caso seja hoje, e não possua atividade para preencher o fundo, será desenhada uma borda grossa (2px) com a cor primária de destaque, além do número ficar em negrito para facilitar a rápida identificação visual.

### Ciclo 10: Limpeza de gráficos e Reposicionamento
- **O que foi feito:** O gráfico de 'Arquivos Físicos' foi removido e os mostradores restantes (Progresso Geral e Calendário) foram movidos para o topo da página, ficando acima do título 'Projetos'. O layout foi atualizado de forma que cada elemento ocupe metade da tela (span 6 no grid de 12 colunas) de maneira limpa.

### Ciclo 11: Ajuste de Proporção no Dashboard
- **O que foi feito:** A proporção dos elementos foi alterada. O gráfico de Progresso Geral agora ocupa um espaço consideravelmente maior (span 9, e foi ampliado de 100px para 120px com fontes maiores), enquanto o Calendário foi reduzido para ser bem menor (span 3), dando o destaque adequado ao resumo das atividades.

### Ciclo 12: Restauração de Gráficos e Posicionamento na base
- **O que foi feito:** O gráfico de 'Arquivos Físicos' (com PDF vs sem PDF) foi reincorporado. A seção inteira contendo os 3 mostradores (agora com proporção 1/3 para cada, usando span 4) foi novamente movida, desta vez para a base da página, logo abaixo da grade de listagem de projetos.

### Ciclo 13: Correção do ImportProject
- **O que foi feito:** Corrigido o bug na importação de projeto onde o 'SyncService' falhava tentando acessar uma propriedade \storageDir\ inexistente em \DatabaseManager\. Agora o caminho absoluto das pastas de storage de PDFs e Documentos é resgatado de forma segura através do \pp.getPath('userData')\ para gravar os arquivos da importação na pasta local correta.

### Ciclo 14: Correção da ordenação de Adicionados
- **O que foi feito:** Ajustado o método de ordenação por \Últimos Adicionados\ e \Primeiros Adicionados\. A tabela não possuía a coluna \created_at\ para artigos, o que resultava em falha na ordenação baseada em data. Substituímos a lógica para utilizar a coluna \id\ da tabela, que cumpre perfeitamente a mesma função já que os IDs são auto-incrementados de forma contínua.

### Ciclo 15: Estilização de Inputs do Modal de Categorias
- **O que foi feito:** Adicionada a classe \.input-field\ no \style.css\ central para estilizar os inputs do modal de categorias, garantindo consistência visual (com bordas, padding e foco adequados para os temas dark e light).

### Ciclo 16: Correção do Painel de Drag and Drop
- **O que foi feito:** Envolvemos os modais de drag and drop (tanto no Dashboard quanto nos Detalhes do Projeto) utilizando o \createPortal\ do React. Isso garante que, independente do contêiner pai estar utilizando animações como \	ransform: translateY\ (que forçam um novo contexto de empilhamento), a área de drop e seu texto de alerta sejam renderizados perfeitamente fixados no corpo da página e no centro da viewport inteira.
