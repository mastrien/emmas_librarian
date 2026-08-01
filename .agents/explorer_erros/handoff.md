# Relatório de Handoff: Auditoria de Gerenciamento de Erros e UX de Exceções (R4)

**Projeto**: `emmas_librarian`  
**Agente Auditor**: `teamwork_preview_explorer` (explorer_erros)  
**Data**: 2026-07-29  
**Caminho do Relatório de Análise**: `c:\root_lab\antigravity\emmas_librarian\.agents\explorer_erros\analysis.md`  

---

## 1. Estado Atual (Current Exception Handling Architecture)

- **IPC Main-to-Renderer**:
  - `electron/ipc/errorHandler.ts` define a classe `AppError` e a função wrapper `withErrorHandling`.
  - Em `electron/ipc/ipcRegistries.ts`, **nenhum dos ~60 handlers IPC** utiliza `withErrorHandling`.
  - Em `electron/ipc/aiIpcHandlers.ts`, apenas 3 handlers (`AI_GENERATE_SUMMARY`, `AI_MASSIVE_EXTRACTION`, `AI_EXTRACT_METADATA`) utilizam `withErrorHandling`. Os outros 12 handlers em `aiIpcHandlers.ts` registram funções assíncronas puras sem o wrapper.
  - No frontend (`src/services/api.ts`), a função `safeInvoke` chama `parseIpcError(error)` (`src/utils/AppError.ts`). Como os handlers IPC lançam erros brutos sem payload JSON do `AppError`, `parseIpcError` não consegue extrair código nem tipo de erro, retornando instâncias genéricas de `Error`.

- **Serviços de IA e PDF**:
  - Chamadas de API de IA em `electron/services/AIService.ts` e gateways (`OpenAI`, `Gemini`, `Anthropic`, `Ollama`) lançam strings ou erros genéricos (ex: `throw new Error('QUOTA_EXCEEDED')`, `throw new Error('A IA não retornou um formato JSON válido.')`).
  - Extração de texto de PDF (`electron/services/PdfExtractor.ts`) usa `fs.readFileSync` e `pdfjsLib.getDocument`. Exceções de leitura de arquivo (ex: `ENOENT`, `EBUSY`/arquivo bloqueado) ou PDFs corrompidos/protegidos sobem como erros nativos do Node/pdfjs. `AIService.extractTextFromPdf` converte todos em `AppError('ERR_INVALID_PDF', ...)`, mas perde a causa raiz e o motivo exato.

- **Operações de Banco de Dados (SQLite)**:
  - `DatabaseAdapter.ts` executa comandos síncronos com `better-sqlite3`. Exceções de banco (`SqliteError`, ex: `UNIQUE constraint failed`) não são capturadas nem convertidas para `AppError` dentro das camadas de repositório.
  - A inicialização do banco (`DatabaseAdapter` constructor) e execução de migrações ocorrem no startup sem isolamento. Se o banco estiver corrompido ou bloqueado, o aplicativo falha no boot via `main.ts`.

- **UI Exception UX & Error Boundaries**:
  - A aplicação em React (`src/`) possui **zero Error Boundaries** (`componentDidCatch` ou `getDerivedStateFromError`).
  - Há uma infraestrutura parcial com `GlobalErrorProvider` e `ErrorModal.tsx`, porém apenas **3 componentes** (`EditArticleModal.tsx`, `ArticleReaderPage.tsx`, `ProjectDetailsPage.tsx`) invocam `showError`.
  - Identificou-se o uso ostensivo de **58 chamadas de `alert()` nativo** espalhadas por páginas e modais da UI (`ImportArticlesModal.tsx`, `EditArticleModal.tsx`, `AttachPdfModal.tsx`, `QuestionSetCatalog.tsx`, etc.).

---

## 2. Pontos Críticos (Critical Flaws & Vulnerabilities)

1. **Risco de Crash e Tela Branca (Ausência de Error Boundaries em React)**:
   - Se ocorrer qualquer exceção não tratada na renderização de um componente (ex: tentar ler propriedade de `undefined` ou parse de JSON inválido nos dados do artigo), o React 18 desmontará toda a árvore visual, travando o aplicativo em uma **tela branca (blank screen)**.

2. **Vazamento de Mensagens em Popups Nativos e Bloqueio de UI (`58x alert()`)**:
   - As 58 ocorrências de `alert()` nativo congelam a thread de renderização do Chromium/Electron, impedem o usuário de copiar relatórios/detalhes de suporte e desrespeitam o design system da aplicação.

3. **Incapacidade de Identificar Códigos Estruturados de Erro na IPC**:
   - Como os handlers de `ipcRegistries.ts` e `aiIpcHandlers.ts` não usam `withErrorHandling`, todas as exceções chegam ao frontend como mensagens brutas `Error: ...`. O `ErrorModal` falha em categorizar os erros (ex: `ERR_MISSING_API_KEY`, `ERR_API_QUOTA_EXCEEDED`, `ERR_NOT_FOUND`), caindo sempre no genérico `ERR_INTERNAL`.

4. **Ausência de Listener para `unhandledRejection` no Processo Principal**:
   - Em `electron/main.ts:98-112`, o Node.js trata `uncaughtException`, mas **NÃO possui handler para `unhandledRejection`**. Promises rejeitadas no backend (ex: backups assíncronos no boot) rodam sem tratamento ou monitoramento.

5. **Não Conformidade com a Regra do `AGENTS.md` para Mensagens de Exceção**:
   - Regra: *"Exception messages must include the offending value and expected shape."*
   - O projeto possui dezenas de mensagens genéricas como:
     - `throw new Error('Project not found');` (Falta valor ofensivo `${projectId}` e forma esperada).
     - `throw new Error('PDF not found');` (Falta valor ofensivo do caminho/artigo e forma esperada).
     - `throw new Error('Já existe um projeto com este nome.');` (Falta valor ofensivo `${name}` e forma esperada).
     - `throw new Error('A IA não retornou um formato JSON válido.');` (Falta o texto de saída retornado pela IA).

---

## 3. Mudanças Propostas (Proposed Refactoring Strategy)

### 3.1. Envelopamento Padronizado dos Handlers IPC
- Aplicar `withErrorHandling` em **todos** os handlers IPC registrados em `electron/ipc/ipcRegistries.ts` e `electron/ipc/aiIpcHandlers.ts`.
- Atualizar `withErrorHandling` para capturar `SqliteError` e mapeá-los para `AppError('ERR_DATABASE', 'SYSTEM_ERROR', ...)` ou `AppError('ERR_DUPLICATE', 'USER_ERROR', ...)` de forma automática.

### 3.2. Implementação de React Error Boundaries & Eliminação do `alert()`
- Criar o componente `ReactErrorBoundary` em `src/components/common/ErrorBoundary.tsx` e envelopar a aplicação no `src/main.tsx` e em torno dos módulos principais (ex: Reader, Agenda, Projetos).
- Refatorar todas as **58 chamadas de `alert()`** para utilizarem o `showError` do `GlobalErrorContext` ou um sistema de Notificação Toast amigável.

### 3.3. Tratamento Resiliente de PDF, IA e Rejeição de Promises
- Adicionar `process.on('unhandledRejection')` em `electron/main.ts` registrando no logger e notificando o usuário sem travar o processo principal.
- Em `PdfExtractor.ts` e `AIService.ts`, diferenciar erros de I/O (`EBUSY` / arquivo bloqueado), permissão (`EACCES`), PDF com senha e PDF corrompido, incluindo o caminho do arquivo e o erro original.
- Em `AIService.ts` e gateways LLM (`Anthropic`, `Gemini`, `OpenAI`, `Ollama`), traduzir todas as respostas com status HTTP 429/401/500 em `AppError` estruturado.

### 3.4. Refatoração de Mensagens de Exceção de Acordo com `AGENTS.md`
- Atualizar todas as mensagens de exceção para incluírem o valor do parâmetro que falhou e o formato/faixa esperada.
- Exemplo de Refatoração:
  - *Antes*: `throw new Error('Project not found');`
  - *Depois*: `throw new AppError('ERR_NOT_FOUND', 'VALIDATION_ERROR', `Project with ID ${projectId} was not found. Expected a valid non-deleted project ID number.`);`

---

## 4. Estrutura Padrão de Handoff (5 Componentes)

### 4.1. Observation (Observações Diretas)
- **Arquivo `electron/ipc/ipcRegistries.ts`**: Registra ~60 handlers `ipcMain.handle(...)` sem envolvimento de `withErrorHandling`.
- **Arquivo `electron/ipc/aiIpcHandlers.ts`**: Linhas 59-117 (handlers de `AI_MODEL_CONFIG`, `QUESTION_SETS`, `INVESTIGATION_RESULTS`) não utilizam `withErrorHandling`.
- **Arquivo `electron/main.ts`**: Linha 98 tem `process.on('uncaughtException')`, mas falta `process.on('unhandledRejection')`.
- **Pesquisa de `alert(` no código `src/`**: Retornou 58 chamadas diretas ao método nativo da window em modais e páginas.
- **Pesquisa de `ErrorBoundary` em `src/`**: Retornou 0 resultados.
- **Arquivo `AGENTS.md`**: Regra estipula: *"Exception messages must include the offending value and expected shape."*

### 4.2. Logic Chain (Cadeia de Raciocínio)
1. *Observação*: Handlers IPC não usam `withErrorHandling` -> *Conclusão*: Exceções no backend chegam como strings genéricas ao renderer -> `parseIpcError` não extrai JSON do `AppError` -> `ErrorModal` categoriza tudo como `ERR_INTERNAL`.
2. *Observação*: 0 Error Boundaries em React -> *Conclusão*: Qualquer exceção de renderização desmonta a árvore de componentes -> Tela branca para o usuário.
3. *Observação*: 58 chamadas de `alert()` na UI -> *Conclusão*: UX inconsistente, bloqueio de thread e incapacidade de copiar logs técnicos de erro.
4. *Observação*: Exceções como `throw new Error('Project not found')` -> *Conclusão*: Violação da norma `AGENTS.md` por não especificar o valor ofensivo nem a forma esperada.

### 4.3. Caveats (Ressalvas)
- Não foram executados testes E2E com drivers nativos de automação de interface gráfica para simular falhas de GPU ou queda do processo Chromium.
- A auditoria não alterou códigos-fonte em `src/` ou `electron/` por se tratar de uma investigação read-only.

### 4.4. Conclusion (Conclusão)
A arquitetura de erro do `emmas_librarian` apresenta mecanismos modernos parciais (como `AppError` e `ErrorModal`), porém a integração está interrompida por falta de envelopamento nos handlers IPC, falta de Error Boundaries no React, uso excessivo de `alert()` e mensagens não conformes com o `AGENTS.md`. A implementação do plano de refatoração proposto garantirá 100% de estabilidade da interface, resiliência contra crashes e excelente UX.

### 4.5. Verification Method (Método de Verificação)
1. **Comandos de Teste**:
   - `npm --prefix emmas_librarian run test` (Executa vitest).
2. **Inspeção de Código**:
   - Verificar se `ipcRegistries.ts` possui `withErrorHandling` em todas as rotas.
   - Verificar a criação de `src/components/common/ErrorBoundary.tsx`.
   - Garantir que a busca por `alert(` em `src/` retorne 0 resultados.
   - Verificar se mensagens de erro possuem a estrutura `${offendingValue} (Expected: ${expectedShape})`.
