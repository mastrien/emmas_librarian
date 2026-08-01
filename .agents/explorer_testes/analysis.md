# Relatório de Análise Técnica — Testes e Resiliência (R2)

**Projeto:** `emmas_librarian`  
**Data:** 2026-07-30  
**Agente:** `explorer_testes`  
**Escopo:** Auditoria completa da infraestrutura de testes, cobertura de código, conformidade com regras do projeto (`AGENTS.md`) e resiliência a caminhos infelizes (unhappy paths).

---

## 1. Visão Geral da Infraestrutura de Testes

O projeto utiliza **Vitest** (v3.2.4) como executor principal de testes de unidade e integração, **Playwright** para testes E2E com Electron, **Stryker** para testes de mutação e **k6** para testes de carga e desempenho.

### 1.1 Scripts de Teste (`package.json`)
- `npm run test`: Executa `npm run rebuild:node && vitest run`.  
  *Observação de Auditoria:* A etapa `rebuild:node` (`npm rebuild better-sqlite3`) falha com `EPERM` se o arquivo binário `.node` estiver bloqueado por outro processo (ex.: Electron ou IDE em execução). A execução direta de `npx vitest run` roda perfeitamente sem necessidade de recompilação nativa a cada rodada.
- `npm run coverage`: Executa `vitest run --coverage` via provedor `@vitest/coverage-v8`.
- `npm run test:e2e` / `npm run test:playwright`: Suíte Playwright em `./e2e-tests` (configurada com `workers: 1` para evitar travamentos de lock no SQLite).
- `npm run test:mutate`: Testes de mutação com Stryker (`stryker.config.json`).
- `npm run test:performance:*`: Testes de carga via k6 (`smoke`, `load`, `stress`, `soak`).

---

## 2. Resultado da Execução do Test Runner & Cobertura

### 2.1 Resultado da Suíte Vitest (`npx vitest run`)
- **Arquivos de Teste Passed:** 54 / 54 (100% sucesso)
- **Total de Testes Passed:** 528 / 528 (0 falhas)
- **Tempo de Execução:** ~47-59s

### 2.2 Diagnóstico Global de Cobertura (`v8`)
| Métrica | Cobertura Global | Limiar Configurado (`vitest.config.mts`) |
| :--- | :---: | :---: |
| **Statements** | 92.95% | 30% global / 80% electron |
| **Branches** | 84.45% | 50% global / 80% electron |
| **Functions** | 91.30% | 30% global / 80% electron |
| **Lines** | 92.95% | 30% global / 80% electron |

### 2.3 Detalhamento por Módulo

#### Backend (`electron/`)
- `electron/database`: 97.50% Stmts | 88.35% Branch | 97.50% Funcs
  - `AIModelConfigRepository.ts` (94.50%)
  - `DatabaseAdapter.ts` (97.43%)
  - `InvestigationResultRepository.ts` (100.00%)
  - `QuestionSetRepository.ts` (98.92%)
  - `ScientificVenueRepository.ts` (97.52%)
- `electron/ipc`: 93.18% Stmts | 88.09% Branch | 90.90% Funcs
  - `aiIpcHandlers.ts` (87.11%) — linhas não cobertas: 338-348
  - `errorHandler.ts` (100.00%)
  - `ipcRegistries.ts` (97.71%) — linhas não cobertas: 215, 223, 313-314
- `electron/services`: 85.66% Stmts | 75.87% Branch | 80.68% Funcs
  - `ApiIntegrator.ts` (79.88% Stmts | 75.86% Branch) — faltam testes para ramos de erro de API (OpenAlex, Crossref, Scopus, WoS)
  - `AIService.ts` (82.52% Stmts | 69.23% Branch) — faltam testes para respostas malformadas do LLM
  - `BackupService.ts` (96.06%)
  - `EmbeddingService.ts` (96.94%)
  - `ExportService.ts` (96.22%)
  - `PdfExtractor.ts` (90.26% Stmts | 79.54% Branch)
  - `QueryTranslator.ts` (96.11%)
  - `SearchOrchestrator.ts` (95.12%)
  - `SyncService.ts` (87.69%)
  - `VectorStore.ts` (91.13%)
- `electron/services/llm`: 97.87% Stmts | 90.69% Branch | 100.00% Funcs
  - `AnthropicGateway.ts` (100%) | `GeminiGateway.ts` (100%) | `OpenAIGateway.ts` (100%)
  - `LLMProviderGateway.ts` (90.32%) | `OllamaGateway.ts` (98.00%)

#### Frontend (`src/`)
- `src/components/reader`: 84.30% Stmts | 76.71% Branch | 76.92% Funcs
  - `AnnotationsTab.tsx` (72.00% Stmts | 55.55% Branch | 42.85% Funcs) — **menor cobertura em componentes de UI**
  - `SearchTab.tsx` (71.87% Stmts | 60.00% Branch | 60.00% Funcs)
  - `PdfPlaceholderView.tsx` (88.00%)
- `src/contexts`: 74.22% Stmts | 53.84% Branch | 70.00% Funcs
  - `GlobalErrorContext.tsx` (77.77% Stmts | 60.00% Branch)
  - `ServicesContext.tsx` (71.42% Stmts | 50.00% Branch | 57.14% Funcs)
- `src/utils`: 89.06% Stmts | 77.41% Branch | 83.33% Funcs
  - `logger.ts` (73.91% Stmts | 50.00% Branch)
  - `pdfTextSearch.ts` (79.16% Stmts | 60.00% Branch)
- `src/hooks`: 90.65% Stmts | 84.78% Branch | 91.66% Funcs
  - `useProjectMetrics.ts` (80.00% Stmts | 66.66% Branch)

---

## 3. Avaliação da Qualidade dos Testes & Regras `AGENTS.md`

### 3.1 Conformidade com F.I.R.S.T
- **Fast:** A suíte completa de unit/integration (528 testes) roda em ~47s.
- **Independent:** Testes usam `beforeEach` e banco de dados SQLite em memória/isolado (`:memory:` ou temp DB), evitando dependências entre testes.
- **Repeatable:** Todos os testes executam de forma determinística sem flaky tests identificados.
- **Self-Validating:** Testes contêm asserções explícitas.

### 3.2 Utilização de Named Fakes (Regra `AGENTS.md`)
- **Regra do Projeto:** *"Mock external I/O (API, DB, filesystem) with named fake classes, not inline stubs."*
- **Diagnóstico:**
  - Foi encontrado **apenas 1 Named Fake** em todo o repositório: `src/services/__tests__/fakes/FakeProjectService.ts`.
  - Os testes de backend (`AIService.test.ts`, `SearchOrchestrator.test.ts`, `SyncService.test.ts`, `BackupService.test.ts`, `ExportService.test.ts`, `ApiIntegrator.test.ts`) utilizam extensivamente stubs genéricos inline (`vi.mock(...)` e objetos anônimos).
  - *Violação identificada:* Falta de Named Fakes reutilizáveis para `DatabaseAdapter`, `ApiIntegrator`, `EmbeddingService`, `VectorStore` e gateways de LLM.

---

## 4. Auditoria de Resiliência & Unhappy Paths (Caminhos Infelizes)

### 4.1 Operações de Banco de Dados (`DatabaseAdapter.ts`)
1. **Configuração de Lock Timeout:** O construtor não define `busy_timeout = 5000`. Sob operações simultâneas de leitura/escrita via IPC, o `better-sqlite3` pode lançar imediatamente `SqliteError: database is locked`.
2. **Engolimento de Erros de Migração:** Em `initSchema()`, as migrações usam `try { this.db.exec(sql); } catch (e) { /* column already exists */ }`. Essa captura genérica silencia erros graves de integridade ou sintaxe no SQLite.
3. **Persistência em Lote de Artigos (`SearchOrchestrator.ts`):** No método `searchAndPersist`, os artigos desduplicados são salvos em um laço sem transação explícita e sem bloco try-catch individual por artigo. Se 1 artigo falhar (ex.: violação de integridade), toda a inserção do lote é interrompida.

### 4.2 Propagação de Erros IPC (`ipcRegistries.ts` vs `errorHandler.ts`)
1. Em `aiIpcHandlers.ts`, os handlers utilizam o wrapper `withErrorHandling(...)`, que serializa erros na estrutura `AppError` (JSON).
2. Em `ipcRegistries.ts`, a maioria dos handlers IPC padrão (projetos, artigos, configurações, anotações, documentos, backup, sync) **não utilizam `withErrorHandling(...)`**.
3. *Consequência:* Quando um erro de banco de dados ou filesystem ocorre nesses handlers, uma mensagem bruta de erro é enviada ao frontend. A função `parseIpcError` no frontend não consegue extrair o JSON de `AppError`, impedindo que a `ErrorModal` exiba a categoria e código corretos do erro.

### 4.3 Redes e Integração de APIs (`ApiIntegrator.ts`)
1. **Ausência de Timeout em Requisições HTTP:** As chamadas `fetch()` para OpenAlex, Crossref, Scopus e Web of Science não possuem `AbortController` ou signal de timeout. Se a API externa travar ou não responder, a thread do Electron fica aguardando indefinidamente.
2. **Falta de Mecanismo de Retry:** Não há suporte a tentativas com backoff exponencial para erros transitórios como HTTP 429 (Rate Limit Exceeded) ou HTTP 503 (Service Unavailable).

### 4.4 Extração e Leitura de PDFs (`PdfExtractor.ts`)
1. **PDFs Protegidos/Criptografados:** O método `pdfjsLib.getDocument` lança `PasswordException` não tratada quando o PDF possui senha.
2. **PDFs Corrompidos ou Zerados:** Arquivos de 0 bytes passam na checagem `fs.existsSync()`, mas lançam exceção bruta do PDF.js.
3. **PDFs Digitalizados (Apenas Imagem / Sem Camada de Texto):** Se o PDF não tiver texto extraível (`totalCharacters === 0`), a função retorna um array de chunks vazio sem nenhum sinalizador de aviso (`isScanned: true`), levando o `AIService` a gerar prompts RAG vazios sem notificar o usuário de que é necessário OCR.
4. **Dependência de Fontes Remotas:** A constante `standardFontDataUrl` aponta para CDN externo (`unpkg.com`). Em ambientes totalmente offline, a renderização de fontes do PDF.js pode falhar.

### 4.5 Provedores de IA & Respostas de LLM (`OllamaGateway.ts`, `AIService.ts`)
1. **Ollama Offline/Indisponível:** Se o serviço local do Ollama não estiver em execução, `fetch` lança erro genérico de conexão sem mensagem amigável ao usuário.
2. **Respostas LLM Fora do Formato JSON:** Em `AIService.massiveExtraction()`, se a IA retornar um JSON inválido ou malformado para 1 pergunta entre 10, o bloco `catch` lança uma exceção que aborta todo o processo de extração dos artigos restantes, em vez de registrar a falha na pergunta específica e preservar os demais resultados.

---

## 5. Recomendações e Plano de Ação

1. **Infraestrutura:** Ajustar o script `npm run test` para evitar falha por lock no arquivo `.node` do `better-sqlite3`.
2. **Conformidade de Mocks (AGENTS.md):** Criar a pasta `electron/test/fakes/` e implementar classes Named Fakes para `DatabaseAdapter`, `ApiIntegrator`, `EmbeddingService`, `VectorStore` e gateways LLM.
3. **Padronização de Erros IPC:** Envolver todos os handlers de `ipcRegistries.ts` com o wrapper `withErrorHandling(...)`.
4. **Resiliência de Rede:** Adicionar timeout de 15-30s com `AbortController` e suporte a retries em `ApiIntegrator.ts` e gateways LLM.
5. **Hardening de Banco e PDF:**
   - Adicionar `busy_timeout = 5000` em `DatabaseAdapter.ts`.
   - Adicionar transações e tratamentos individuais no salvar artigos em lote.
   - Tratar PDFs com senha, zerados e escaneados em `PdfExtractor.ts`.
6. **Ampliação da Cobertura de Testes:** Criar testes para os módulos de menor cobertura (`AnnotationsTab.tsx`, `SearchTab.tsx`, `ServicesContext.tsx`, `GlobalErrorContext.tsx`, `logger.ts`).
