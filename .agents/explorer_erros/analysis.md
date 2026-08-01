# Relatório de Auditoria Detalhada: Gerenciamento de Erros e UX de Exceções (R4)
**Projeto**: `emmas_librarian`  
**Data**: 2026-07-29  
**Auditor**: `teamwork_preview_explorer` (explorer_erros)  

---

## 1. Visão Geral da Investigação

Esta auditoria realizou uma análise técnica aprofundada da arquitetura de tratamento de erros e da experiência do usuário (UX) em exceções em todas as camadas do sistema `emmas_librarian` (Electron Main, IPC Bridge, Serviços Backend, SQLite Database e UI React).

---

## 2. Auditoria Detalhada por Domínio

### 2.1. Handlers IPC (Main <-> Renderer)

#### Arquivos Analisados
- `electron/ipc/errorHandler.ts`
- `electron/ipc/ipcRegistries.ts`
- `electron/ipc/aiIpcHandlers.ts`
- `electron/preload.ts`
- `electron/main.ts`
- `src/services/api.ts`
- `src/utils/AppError.ts`

#### Observações Exatas e Código Fonte
1. **Ausência da Wrapper `withErrorHandling` na maioria dos Handlers**:
   - Em `electron/ipc/ipcRegistries.ts`, há **mais de 60 IPC handlers registrados** via `ipcMain.handle(...)` cobrindo Projetos, Pesquisas, Artigos, PDFs, Exportação, Configurações, Anotações, Destaques, Diário, Lixeira, Sincronização, Eventos Científicos e Documentos do Projeto.
   - **Zero** handlers em `ipcRegistries.ts` utilizam o wrapper `withErrorHandling`.
   - Exemplo em `electron/ipc/ipcRegistries.ts` (linhas 61-67):
     ```typescript
     ipcMain.handle(IpcChannel.PROJECTS_CREATE, (event, name) => {
       const existing = db.getAllProjects().find((p) => p.name.trim().toLowerCase() === name.trim().toLowerCase());
       if (existing) {
         throw new Error('Já existe um projeto com este nome.');
       }
       return db.createProject(name);
     });
     ```
   - Quando `db.createProject` falha ou quando `throw new Error(...)` ocorre em um handler não envolvido por `withErrorHandling`, a exceção é serializada pelo Electron como um `Error` genérico contendo a string de mensagem bruta, sem a estrutura `AppError` (`{ isAppError: true, code, type, details }`).

2. **Uso Parcial de `withErrorHandling` em AI Handlers**:
   - Em `electron/ipc/aiIpcHandlers.ts`, apenas 3 handlers (`AI_GENERATE_SUMMARY`, `AI_MASSIVE_EXTRACTION`, `AI_EXTRACT_METADATA`, linhas 19-56) utilizam `withErrorHandling`.
   - Os outros 12 handlers em `aiIpcHandlers.ts` (`AI_MODEL_CONFIG_*`, `QUESTION_SETS_*`, `INVESTIGATION_RESULTS_*`, linhas 59-117) **NÃO** usam `withErrorHandling`.

3. **Falha de Desserialização no Renderer (`parseIpcError`)**:
   - Em `src/services/api.ts`, a função `safeInvoke` chama `parseIpcError(error)`:
     ```typescript
     async function safeInvoke(channel: IpcChannel, ...args: any[]): Promise<any> {
       try {
         return await window.electronAPI.invoke(channel, ...args);
       } catch (error) {
         throw parseIpcError(error);
       }
     }
     ```
   - Em `src/utils/AppError.ts` (linhas 30-49), `parseIpcError` busca o trecho JSON na mensagem de erro utilizando `/({.*})/`:
     ```typescript
     export function parseIpcError(error: any): Error {
       if (!error) return new Error('Unknown error');
       const message = error.message || String(error);
       const jsonMatch = message.match(/({.*})/);
       if (jsonMatch) {
         try {
           const parsed = JSON.parse(jsonMatch[1]);
           if (parsed.isAppError) {
             return new FrontendAppError(parsed.code, parsed.type, parsed.message, parsed.details);
           }
         } catch (e) {}
       }
       return error;
     }
     ```
   - Como 95%+ dos handlers IPC não formatam o erro como JSON via `AppError`, a Regex falha e o erro é retornado como `Error` genérico sem `code` nem `type`.

4. **Rejeições de Promise Não Tratadas no Processo Principal (`main.ts`)**:
   - Em `electron/main.ts` (linhas 98-112), existe apenas um escutador para `uncaughtException`:
     ```typescript
     process.on('uncaughtException', (error) => {
       console.error('Uncaught Exception:', error);
       ...
       dialog.showErrorBox('Main Process Error', error.message || String(error));
     });
     ```
   - **Não existe** escutador para `unhandledRejection` (`process.on('unhandledRejection', ...)`). Qualquer Promise rejeitada no Main (ex: tarefas de backup automático, rotação de backups em `ipcRegistries.ts:24-38`, chamadas assíncronas do vetor sqlite-vec) permanece sem tratamento no processo principal.

5. **Invocação Direta de IPC Sem `safeInvoke` na UI**:
   - Em `src/pages/SettingsPage.tsx` (linha 110):
     ```typescript
     (window as any).electronAPI.invoke('UPDATE_TITLE_BAR', newTheme);
     ```
     Invoca a API do Electron diretamente sem passar pelo wrapper `safeInvoke`, ignorando qualquer tratamento de erros do frontend.

---

### 2.2. Serviços de IA e Extração de PDF

#### Arquivos Analisados
- `electron/services/AIService.ts`
- `electron/services/PdfExtractor.ts`
- `electron/services/llm/AnthropicGateway.ts`
- `electron/services/llm/GeminiGateway.ts`
- `electron/services/llm/OpenAIGateway.ts`
- `electron/services/llm/OllamaGateway.ts`
- `electron/services/ApiIntegrator.ts`

#### Observações Exatas e Código Fonte
1. **Respostas JSON Malformadas de LLMs**:
   - Em `electron/services/AIService.ts` (linhas 218-221, 332-335, 370-372):
     ```typescript
     } catch (err) {
       console.error('Failed to parse LLM JSON:', result);
       throw new Error('A IA não retornou um formato JSON válido.');
     }
     ```
   - Ao lançar `new Error(...)` comum em vez de `AppError('ERR_INTERNAL', 'SYSTEM_ERROR', ...)`, o erro não possui código estruturado nem o valor/formato ofensivo (`result`).

2. **Tratamento de Rate Limits (HTTP 429) e Falhas de Rede**:
   - Em `AIService.ts` (linhas 57-62, 81-87), `callOpenAI` e `callGemini` lançam `new Error('QUOTA_EXCEEDED')` ou `new Error('OpenAI API Error: ...')`.
   - `generateCompletion` (linhas 162-168) captura `err.message.includes('fetch failed')` e lança `AppError('ERR_API_CONNECTION', ...)`. Contudo, erros de resolução DNS, timeouts, `ECONNREFUSED` no Ollama local ou respostas HTTP 401 (Unauthorized) / 500 (Internal Server Error) dos provedores de IA não são convertidos para `AppError` estruturado.
   - Em `electron/services/llm/AnthropicGateway.ts` (linhas 22-25):
     ```typescript
     if (!response.ok) {
       const err = await response.text();
       throw new Error(`Anthropic API Error: ${err}`);
     }
     ```
     Não verifica cota (429) nem credenciais inválidas (401), lançando erro genérico sem padronização.

3. **Falhas no Processamento de Arquivos PDF (PdfExtractor.ts)**:
   - Em `electron/services/PdfExtractor.ts` (linhas 26-33):
     ```typescript
     const dataBuffer = fs.readFileSync(pdfPath);
     const uint8Array = new Uint8Array(dataBuffer);
     const pdfDocument = await pdfjsLib.getDocument({ data: uint8Array, ... }).promise;
     ```
   - Se o arquivo PDF estiver corrompido, protegido por senha, vazio (0 bytes) ou bloqueado por outro processo do sistema operacional (`EBUSY` / `EACCES`), `fs.readFileSync` ou `pdfjsLib` lança exceções nativas do Node.js (`ENOENT`, `EBUSY`, `InvalidPDFException`).
   - Em `AIService.ts` (linhas 24-27):
     ```typescript
     } catch (err) {
       console.error('Error parsing PDF:', err);
       throw new AppError('ERR_INVALID_PDF', 'VALIDATION_ERROR', 'Falha ao ler o arquivo PDF');
     }
     ```
     O tratamento mascara a causa raiz (se foi arquivo bloqueado vs protegido por senha vs corrompido) e perde os detalhes do erro original (`err`), violando a regra de inclusão do valor ofensivo.

---

### 2.3. Operações de Banco de Dados (SQLite)

#### Arquivos Analisados
- `electron/database/DatabaseAdapter.ts`
- `electron/database/QuestionSetRepository.ts`
- `electron/database/InvestigationResultRepository.ts`
- `electron/database/AIModelConfigRepository.ts`
- `electron/database/ScientificVenueRepository.ts`
- `electron/database/SyncService.ts`

#### Observações Exatas e Código Fonte
1. **Exceções de Restrições SQLite Não Tratas**:
   - `DatabaseAdapter.ts` utiliza a biblioteca `better-sqlite3`, cujas operações são síncronas e lançam objetos `SqliteError` quando ocorrem violações de restrição (`UNIQUE constraint failed`), tabelas ausentes ou banco bloqueado (`SqliteError: database is locked`).
   - Nenhum dos métodos principais de escrita (`createProject`, `saveArticle`, `saveAnnotation`, `saveHighlight`, `createProjectCategory`, `saveMassiveInvestigation`) envolve as chamadas do SQLite em blocos `try/catch` para capturar e traduzir `SqliteError` para `AppError`.
   - Exemplo em `DatabaseAdapter.ts` (linhas 401-405):
     ```typescript
     createProject(name: string): Project {
       const stmt = this.db.prepare('INSERT INTO projects (name, created_at) VALUES (?, ?)');
       const info = stmt.run(name, new Date().toISOString());
       return this.getProject(Number(info.lastInsertRowid)) as Project;
     }
     ```
     Se houver concorrência ou falha de duplicidade no banco, o `SqliteError` é lançado diretamente sem formatação.

2. **Inicialização do Banco e Modo WAL**:
   - No construtor de `DatabaseAdapter.ts` (linhas 45-51):
     ```typescript
     constructor(dbPath: string) {
       this.db = new Database(dbPath);
       this.loadSqliteVec(this.db);
       this.db.pragma('journal_mode = WAL');
       this.db.pragma('foreign_keys = ON');
       this.initSchema();
     }
     ```
     Se o arquivo `emma.db` estiver corrompido ou bloqueado no momento da abertura do app, o construtor lança uma exceção não tratada durante o startup do Electron (`main.ts:117-128`), acionando a caixa de diálogo nativa do Windows (`dialog.showErrorBox('Startup Error', ...)`).

3. **Descriptografia de Chaves com `safeStorage`**:
   - Em `DatabaseAdapter.ts` (linhas 793-800), ao buscar uma configuração em `getSetting`, se a chave falhar ao ser descriptografada por alteração de credencial do SO, o código captura o erro com `console.error` e retorna a string codificada sem notificar a UI de que a credencial precisa ser re-configurada.

---

### 2.4. UX de Exceções na UI e Error Boundaries (React)

#### Arquivos Analisados
- `src/main.tsx`
- `src/contexts/GlobalErrorContext.tsx`
- `src/components/modals/ErrorModal.tsx`
- `src/components/` (todos os componentes de modal e visualização)
- `src/pages/` (todas as páginas do aplicativo)

#### Observações Exatas e Código Fonte
1. **Ausência Absoluta de React Error Boundaries**:
   - A busca por `ErrorBoundary`, `componentDidCatch` ou `getDerivedStateFromError` na pasta `src/` retornou **0 resultados**.
   - Se qualquer componente React lançar um erro durante a renderização (ex: tentar acessar propriedade de `undefined`, falha no parse de JSON na exibição de metadados, estrutura de objeto inesperada da IPC), o React 18 desmontará a árvore inteira de componentes, resultando na **tela branca da morte (blank white screen)** sem mensagem amigável para o usuário.

2. **Vazamento de 58 Chamadas do `alert()` Nativo no Frontend**:
   - Foram identificadas **58 chamadas de `alert(...)`** em diversos modais e páginas.
   - Exemplos críticos:
     - `src/components/modals/ImportArticlesModal.tsx:82`: `alert('Erro ao importar artigos: ' + err);`
     - `src/components/modals/EditArticleModal.tsx:87`: `alert(\`Erro ao editar artigo: ${errorMsg}\`);`
     - `src/components/modals/AttachPdfModal.tsx:65`: `alert('Erro ao realizar upload do PDF: ' + err);`
     - `src/components/ai/QuestionSetCatalog.tsx:95`: `alert('Erro ao criar conjunto de perguntas.');`
     - `src/pages/DashboardPage.tsx:321`: `alert('Erro ao importar projeto: ' + (err.message || err));`
     - `src/pages/PdfLibraryPage.tsx:153`: `alert('Erro ao excluir PDF: ' + err);`
     - `src/pages/ProjectDetailsPage.tsx:1793`: `alert('Erro ao exportar CSV: ' + err.message);`
   - O uso de `alert()` bloqueia a execução da thread da UI, degrada a experiência do usuário e impede que detalhes técnicos de suporte/logs sejam copiados de forma estruturada.

3. **Subutilização do `GlobalErrorContext` e `ErrorModal`**:
   - Embora exista uma infraestrutura amigável criada com `GlobalErrorProvider` e `ErrorModal.tsx` (que renderiza modal estilizado com opções "Ver detalhes técnicos" e "Copiar Logs"), **apenas 3 componentes** em todo o projeto utilizam o método `showError`:
     1. `src/components/modals/EditArticleModal.tsx:128`
     2. `src/pages/ArticleReaderPage.tsx:286`
     3. `src/pages/ProjectDetailsPage.tsx:516`
   - Todos os outros 40+ componentes utilizam `alert()` ou engolem o erro silenciosamente no `console.error`.

4. **Caixas de Diálogo Nativas do Sistema Operacional (`main.ts`)**:
   - Em `electron/main.ts` (linhas 110, 127, 136), erros não capturados do processo principal abrem a janela modal nativa do SO (`dialog.showErrorBox`), exibindo mensagens brutas em inglês ou rastros de pilha feios para o usuário final.

---

### 2.5. Formatação de Mensagens de Exceção (Conformidade com `AGENTS.md`)

#### Regra do `AGENTS.md`
> *"Exception messages must include the offending value and expected shape."*  
> (Mensagens de exceção devem incluir o valor ofensivo e o formato/forma esperada).

#### Observações Exatas e Violações
Varredura nas mensagens de erro em `electron/` e `src/`:

| Arquivo e Linha | Mensagem Atual (Não Conforme) | Problema Identificado |
|---|---|---|
| `electron/ipc/ipcRegistries.ts:64` | `throw new Error('Já existe um projeto com este nome.');` | Oculta o valor ofensivo (qual nome?) e o formato esperado (string de nome único). |
| `electron/ipc/ipcRegistries.ts:196` | `throw new Error('PDF not found');` | Oculta o ID do artigo e o caminho procurado. |
| `electron/ipc/ipcRegistries.ts:335` | `throw new Error('Project not found');` | Oculta o `projectId` fornecido e o formato de ID numérico válido. |
| `electron/database/QuestionSetRepository.ts:88` | `throw new Error('QuestionSet not found');` | Oculta o `id` da pergunta e o formato esperado. |
| `electron/services/AIService.ts:220` | `throw new Error('A IA não retornou um formato JSON válido.');` | Oculta o texto retornado pela IA (`result`) e o schema JSON esperado. |
| `electron/services/AIService.ts:26` | `throw new AppError('ERR_INVALID_PDF', 'VALIDATION_ERROR', 'Falha ao ler o arquivo PDF');` | Oculta o `pdfPath` ofensivo e o motivo (arquivo corrompido, 0 bytes, ou bloqueado). |
| `electron/services/ApiIntegrator.ts:108` | `throw new Error('Chave de API inválida ou expirada');` | Oculta o nome do provedor (`Scopus`/`WoS`) e a chave utilizada. |

---

## 3. Matriz de Avaliação de Riscos

| Áreas Auditadas | Nível de Risco | Impacto no Usuário | Probabilidade |
|---|---|---|---|
| **Error Boundaries (React)** | **CRÍTICO** | Tela branca da morte e perda de dados não salvos | Alta |
| **Handlers IPC não envelopados** | **ALTO** | Perda de contexto do erro, mensagens ilegíveis | Alta |
| **58 chamadas de `alert()` nativo** | **MÉDIO/ALTO** | UX ruim, bloqueio da thread UI, sem logs legíveis | Alta |
| **Erros de Parse JSON e PDF** | **MÉDIO** | Falhas silenciosas ou genéricas na IA | Média |
| **Formatos de Exceção (`AGENTS.md`)** | **MÉDIO** | Dificuldade de depuração e falta de rastreabilidade | Alta |
