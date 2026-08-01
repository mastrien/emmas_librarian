# Relatório de Auditoria: Gestão de Erros e UX de Exceções (R4)

**Projeto**: `emmas_librarian`  
**Data**: 2026-07-29  
**Auditor**: `teamwork_preview_worker` (Relatório de Auditoria de Erros R4)  

---

## Estado Atual

A auditoria da arquitetura de tratamento de erros do sistema `emmas_librarian` avaliou o fluxo de exceções e rejeições de promises em todas as camadas: Processo Principal do Electron, Ponte IPC, Chamadas de IA, Extrator de PDF, Serviços de Banco de Dados (SQLite) e Interface do Usuário (React).

### 1. Handlers IPC (Main <-> Renderer)
- **Infraestrutura Existente**: O arquivo `electron/ipc/errorHandler.ts` define a classe `AppError` e a função wrapper `withErrorHandling` para serializar erros estruturados no formato JSON `{ isAppError: true, code, type, message, details }`.
- **Envelopamento de Handlers**:
  - Em `electron/ipc/ipcRegistries.ts`, há cerca de 60 handlers IPC registrados (`ipcMain.handle(...)`) cobrindo Projetos, Pesquisas, Artigos, PDFs, Exportações, Configurações, Anotações, Destaques, Diário, Lixeira, Sincronização, Eventos Científicos e Documentos. **Nenhum (0)** desses handlers utiliza a função wrapper `withErrorHandling`.
  - Em `electron/ipc/aiIpcHandlers.ts`, dos 15 handlers IPC de IA, **apenas 3** (`AI_GENERATE_SUMMARY`, `AI_MASSIVE_EXTRACTION`, `AI_EXTRACT_METADATA`) usam `withErrorHandling`. Os outros 12 handlers (`AI_MODEL_CONFIG_*`, `QUESTION_SETS_*`, `INVESTIGATION_RESULTS_*`) estão desenvelopados.
- **Falha de Desserialização no Renderer**: Em `src/services/api.ts`, a função `safeInvoke` chama `parseIpcError(error)` (`src/utils/AppError.ts`). O método `parseIpcError` tenta extrair o JSON via regex `/({.*})/`. Como 95%+ dos handlers IPC lançam erros brutos (`throw new Error(...)`), a extração por regex falha e o erro é convertido em uma instância genérica de `Error` sem código nem tipo.

### 2. Chamadas de IA e Serviços de PDF
- **Integração com LLMs**: Em `electron/services/AIService.ts` e nos gateways (`AnthropicGateway`, `GeminiGateway`, `OpenAIGateway`, `OllamaGateway`), exceções por cotas excedidas (HTTP 429), credenciais inválidas (HTTP 401), timeouts ou falhas de parse de JSON são lançadas como strings ou erros genéricos (ex: `throw new Error('QUOTA_EXCEEDED')` ou `throw new Error('A IA não retornou um formato JSON válido.')`).
- **Extração de Texto de PDF**: Em `electron/services/PdfExtractor.ts`, a leitura de PDFs utiliza `fs.readFileSync` e `pdfjsLib.getDocument`. Exceções de sistema de arquivos (ex: `ENOENT`, `EBUSY` por arquivo bloqueado) ou PDFs corrompidos/protegidos sobem como exceções nativas. Ao ser capturado em `AIService.extractTextFromPdf`, o erro original é mascarado por um `AppError('ERR_INVALID_PDF', ...)` genérico, ocultando o caminho do arquivo e a causa raiz.

### 3. Serviços de Banco de Dados (SQLite)
- **Operações Síncronas**: `DatabaseAdapter.ts` e os repositórios (`QuestionSetRepository`, `InvestigationResultRepository`, `AIModelConfigRepository`, `ScientificVenueRepository`, `SyncService`) utilizam a biblioteca `better-sqlite3`. Quando ocorrem violações de restrição (`UNIQUE constraint failed`), o `better-sqlite3` lança exceções `SqliteError`. As chamadas de banco não possuem captura em blocos `try/catch` para tradução de `SqliteError` em `AppError`.
- **Inicialização e WAL Mode**: No construtor de `DatabaseAdapter.ts`, a abertura do banco `emma.db`, o carregamento do `sqlite-vec`, a execução dos pragmas (`journal_mode = WAL`, `foreign_keys = ON`) e a execução do schema ocorrem sem isolamento de erro durante a inicialização da aplicação (`main.ts`).
- **Falhas de Descriptografia**: Em `DatabaseAdapter.ts` (`getSetting`), falhas de descriptografia via `safeStorage` são apenas registradas no console com `console.error`, sem notificar o frontend sobre a necessidade de reconfiguração de credenciais.

### 4. UX de Exceções na Interface do Usuário (UI)
- **Error Boundaries no React**: A aplicação React (`src/`) possui **zero React Error Boundaries** (`componentDidCatch` ou `getDerivedStateFromError`).
- **Subutilização da Infraestrutura de Erro**: O projeto contém `GlobalErrorProvider` e `ErrorModal.tsx` para apresentar erros estruturados ao usuário com suporte a cópia de logs. No entanto, apenas **3 componentes** (`EditArticleModal.tsx`, `ArticleReaderPage.tsx`, `ProjectDetailsPage.tsx`) invocam a função `showError`.
- **Chamadas a `alert()` Nativo**: Foram identificadas **58 chamadas diretas a `alert()`** espalhadas por modais e páginas em `src/`, que travam a thread de renderização da interface e degradam a experiência do usuário.
- **Caixas de Diálogo Nativas do SO**: Erros não capturados no processo principal (`main.ts`) disparam `dialog.showErrorBox`, exibindo caixas nativas do sistema com rastros de pilha não formatados.

---

## Pontos Críticos

1. **Unwrapped IPC Handlers (0 em `ipcRegistries`, 3/15 em `aiIpcHandlers`)**:
   - Dos ~75 handlers IPC do sistema, ~72 registram funções assíncronas puras sem o wrapper `withErrorHandling`.
   - **Impacto**: Qualquer exceção lançada no processo principal perde o objeto `AppError` estruturado, resultando na falha de desserialização em `parseIpcError` no renderer e impedindo que a UI categorize o erro corretamente.

2. **Ausência de Listener para `unhandledRejection` em `main.ts`**:
   - `electron/main.ts` possui apenas o ouvinte `process.on('uncaughtException', ...)`.
   - **Impacto**: Rejeições de Promises não tratadas no processo principal (ex: rotação de backups automáticos, operações assíncronas do vetor sqlite-vec, tarefas de sincronização em segundo plano) ocorrem sem tratamento, registro estruturado ou notificação.

3. **Erros Não Capturados do SQLite (Uncaught SQLite Errors)**:
   - Exceções `SqliteError` de restrição `UNIQUE`, tabelas ausentes ou banco de dados bloqueado (`database is locked`) são lançadas diretamente pelas chamadas síncronas do `better-sqlite3`.
   - **Impacto**: Erros de banco no Main Process sobem como exceções não tratadas, podendo derrubar a comunicação IPC ou exibir caixas de erro genéricas do SO.

4. **Zero React Error Boundaries (Risco de Tela Branca / White-Screen Crash)**:
   - Não há nenhum Error Boundary implementado na árvore de componentes do React (`src/`).
   - **Impacto**: Qualquer erro de renderização (ex: propriedade `undefined` em objeto de artigo, erro de parse JSON ao exibir metadados) faz com que o React 18 desmonte a árvore inteira de componentes, resultando em uma **tela branca da morte (white-screen crash)** e perda de dados não salvos pelo usuário.

5. **58 Chamadas ao `alert()` Nativo da Window**:
   - Identificadas 58 ocorrências da função nativa `alert(...)` em modais e páginas (ex: `ImportArticlesModal.tsx`, `EditArticleModal.tsx`, `AttachPdfModal.tsx`, `QuestionSetCatalog.tsx`, `DashboardPage.tsx`, `PdfLibraryPage.tsx`, `ProjectDetailsPage.tsx`).
   - **Impacto**: Congela a thread de renderização da UI no Chromium, desrespeita o design system da aplicação, impede a cópia estruturada de logs técnicos pelo pesquisador e dificulta o suporte.

6. **Mensagens de Exceção Não Conformes com o `AGENTS.md`**:
   - A diretriz em `AGENTS.md` exige: *"Exception messages must include the offending value and expected shape."*
   - O código contém diversas mensagens genéricas que ocultam o valor que causou a falha e o formato esperado, tais como:
     - `electron/ipc/ipcRegistries.ts:64`: `throw new Error('Já existe um projeto com este nome.');` (Oculta o nome informado `${name}` e a regra de unicidade).
     - `electron/ipc/ipcRegistries.ts:196`: `throw new Error('PDF not found');` (Oculta o ID do artigo e o caminho esperado).
     - `electron/ipc/ipcRegistries.ts:335`: `throw new Error('Project not found');` (Oculta o `projectId` fornecido e o formato esperado de ID numérico).
     - `electron/database/QuestionSetRepository.ts:88`: `throw new Error('QuestionSet not found');` (Oculta o ID e a expectativa).
     - `electron/services/AIService.ts:220`: `throw new Error('A IA não retornou um formato JSON válido.');` (Oculta a string bruta retornada pela IA e o schema esperado).
     - `electron/services/ApiIntegrator.ts:108`: `throw new Error('Chave de API inválida ou expirada');` (Oculta o nome da API de destino e a chave configurada).

---

## Mudanças Propostas

### 1. Estratégia de Padronização dos Handlers IPC (`withErrorHandling`)
- **Envelopamento Total**: Aplicar a função wrapper `withErrorHandling` em **100% dos handlers IPC** registrados em `electron/ipc/ipcRegistries.ts` e `electron/ipc/aiIpcHandlers.ts`.
- **Tradução Automática de Erros do Banco**: Atualizar o `withErrorHandling` em `electron/ipc/errorHandler.ts` para interceptar instâncias de `SqliteError` e convertê-las automaticamente para `AppError`:
  - Se `error.code === 'SQLITE_CONSTRAINT_UNIQUE'`, converter em `AppError('ERR_DUPLICATE', 'USER_ERROR', ...)` com o valor duplicado.
  - Outros erros SQLite convertidos em `AppError('ERR_DATABASE', 'SYSTEM_ERROR', ...)`.
- **Desserialização no Renderer**: Garantir que `parseIpcError` em `src/utils/AppError.ts` consiga extrair e reinstanciar o `FrontendAppError` com código, tipo, mensagem legível e detalhes técnicos.

### 2. Implementação do Listener `unhandledRejection` no Processo Principal (`main.ts`)
- Adicionar o manipulador de evento global de promise rejeitada em `electron/main.ts`:
  ```typescript
  process.on('unhandledRejection', (reason: unknown) => {
    console.error('Unhandled Promise Rejection in Main Process:', reason);
    // Registrar em arquivo de log estruturado JSON
    // Se crítico, notificar a janela principal via IPC sem derrubar o processo
  });
  ```

### 3. Tratamento Resiliente de Operações de Banco, PDF e Serviços de IA
- **Banco de Dados (SQLite)**: Envelopar métodos de inserção e atualização nos repositórios para tratar violações de restrição e concorrência antes de repassar a exceção à camada IPC.
- **Leitura de PDF (`PdfExtractor.ts` & `AIService.ts`)**: Distinguir erros de permissão (`EACCES`), arquivo bloqueado (`EBUSY`), arquivo inexistente (`ENOENT`), PDF com senha e PDF corrompido. Incluir o caminho exato do arquivo (`pdfPath`) e a causa raiz na mensagem de erro do `AppError`.
- **Gateways de IA (`AIService.ts`)**: Mapear códigos de status HTTP (401 Unauthorized, 429 Rate Limit/Quota Exceeded, 500 Internal Server Error) em erros tipados de `AppError` (`ERR_API_KEY_INVALID`, `ERR_API_QUOTA_EXCEEDED`, `ERR_API_SERVER_ERROR`), incluindo o provedor e a resposta de erro recebida.

### 4. Implementação de React Error Boundaries & Eliminação do `alert()`
- **React Error Boundary**: Criar o componente `ReactErrorBoundary` em `src/components/common/ErrorBoundary.tsx` para capturar exceções da árvore do React, registrá-las no logger e exibir uma tela de recuperação graciosa com opção de recarregar a interface ou copiar detalhes técnicos.
- **Envelopamento do App**: Envelopar o componente raiz em `src/main.tsx` e as áreas principais (Leitor de PDF, Pesquisa, Projetos) com o `ReactErrorBoundary`.
- **Eliminação do `alert()`**: Refatorar todas as 58 ocorrências de `alert()` no código frontend, substituindo-as por:
  - `showError` do `GlobalErrorContext` para erros de operação e exceções com modal detalhado;
  - Notificações leves do tipo Toast para avisos e validações simples de formulário.

### 5. Padronização de Mensagens de Exceção conforme `AGENTS.md`
- Reformular todas as exceções no código backend e frontend para respeitar rigorosamente a regra do `AGENTS.md`: *"Exception messages must include the offending value and expected shape."*
- **Padrão de Mensagem de Exceção**:
  `[ERR_CODE] Descrição do erro. Offending value: <valor>. Expected shape: <formato_esperado>.`
- **Exemplos de Refatoração**:
  - *Antes*: `throw new Error('Project not found');`  
    *Depois*: `throw new AppError('ERR_NOT_FOUND', 'VALIDATION_ERROR', `Projeto com ID "${projectId}" não foi encontrado. Valor fornecido: ${projectId}. Formato esperado: número inteiro positivo de um projeto existente.`);`
  - *Antes*: `throw new Error('Já existe um projeto com este nome.');`  
    *Depois*: `throw new AppError('ERR_DUPLICATE_NAME', 'USER_ERROR', `Já existe um projeto cadastrado com o nome "${name}". Valor fornecido: "${name}". Formato esperado: string de nome único entre os projetos cadastrados.`);`
  - *Antes*: `throw new Error('A IA não retornou um formato JSON válido.');`  
    *Depois*: `throw new AppError('ERR_INVALID_AI_RESPONSE', 'SYSTEM_ERROR', `A resposta da IA não pôde ser parseada como JSON. Valor retornado: "${result.slice(0, 100)}...". Formato esperado: objeto JSON válido compatível com o schema definido.`);`
