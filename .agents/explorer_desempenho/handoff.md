# Relatório de Handoff: Auditoria de Desempenho e Eficiência (R1)

**Projeto**: Emma's Librarian (`c:\root_lab\antigravity\emmas_librarian`)  
**Agente Explorador**: `teamwork_preview_explorer` (`.agents/explorer_desempenho`)  
**Data**: 2026-07-29  

---

## 1. Estado Atual

### Resumo do Estado do Código
O projeto Emma's Librarian é uma aplicação desktop Electron/React/Vite/SQLite (`better-sqlite3` + `sqlite-vec`). A arquitetura atual apresenta funcionalidades robustas, mas acumula gargalos significativos de desempenho e eficiência em quatro áreas operacionais:

1. **Camada de Banco de Dados (SQLite)**: O esquema SQL em `electron/database/schema.sql` carece de índices em chaves estrangeiras cruciais (`project_id`, `article_id`, `search_id`). As consultas realizam varreduras completas (*table scans*).
2. **Transferência e I/O de Arquivos (IPC & Node)**: Arquivos PDF físicos são lidos de forma síncrona na thread principal (`fs.readFileSync`) para cálculo de hash SHA-256 e transmitidos como `Buffer` brutos de até dezenas de megabytes através da ponte IPC do Electron (`PDF_GET`), sobrecarregando a memória RAM.
3. **Pipeline de RAG e Extração de PDF**: A divisão de texto de PDFs em `electron/services/PdfExtractor.ts` utiliza loops aninhados com `Array.indexOf` e `.slice()`, resultando em complexidade $O(N^3)$. A geração de embeddings em `EmbeddingService.ts` dispara requisições HTTP estritamente sequenciais. A busca vetorial no `VectorStore.ts` efetua distância L2 em força bruta sobre toda a tabela de vetores.
4. **Interface do Usuário (React)**: O componente `ProjectDetailsPage.tsx` atinge 2.133 linhas e centraliza um estado monolítico que re-executa 11 chamadas IPC em paralelo (`fetchData`) ao menor evento. Modais pesados como `MassCitationModal.tsx` executam o parser CSL do `citation-js` de forma síncrona dentro de loops de renderização sem memoização (`useMemo`).

---

## 2. Pontos Críticos

### A. Banco de Dados e Queries Lentass
* **Ausência de Índices Estruturais**:
  - `articles`: sem índice em `project_id`, `doi`, `status`, `search_id`, `deleted_at`.
  - `annotations` & `highlights`: sem índice em `article_id`.
  - `pdf_chunks`: sem índice em `article_id` nem em `(article_id, chunk_index)`.
  - `project_documents`, `search_history`, `project_categories`, `massive_investigations`: sem índice em `project_id`.
  - *Impacto*: `SELECT * FROM articles WHERE project_id = ?` realiza varredura em 100% dos registros.
* **Verificação de Duplicatas $O(N^2)$**:
  - `DatabaseAdapter.ts` (linhas 481-490): Ao salvar cada artigo de um lote, consulta toda a tabela do projeto (`SELECT * FROM articles WHERE project_id = ?`) e normaliza títulos em JavaScript item por item.
* **Subconsulta Correlacionada em `getStoredPdfs()`**:
  - `DatabaseAdapter.ts` (linhas 1420-1429): Executa `LOWER(REPLACE(a.local_file_path, '/', '\'))` em cada linha de `articles` para cada PDF cadastrado.

### B. Bloqueios do Event Loop e I/O Síncrono
* **Geração de Hash Síncrona na Thread Main**:
  - `DatabaseAdapter.ts` (linhas 1391-1394) e `ipcRegistries.ts` (linha 148): `fs.readFileSync(filePath)` bloqueia a thread do Node.js ao ler arquivos grandes para calcular o hash SHA-256.
* **IPC Buffer Payload**:
  - `ipcRegistries.ts` (linhas 193-200): O canal `PDF_GET` retorna um `Buffer` lido via `fs.readFileSync`. Para um PDF de 50MB, a serialização IPC duplica o buffer na memória do Renderer, gerando picos de RAM e congelando a resposta da interface.

### C. Gargalos em IA, PDF e Pipeline RAG
* **Complexidade $O(N^3)$ em `PdfExtractor.ts`**:
  - `PdfExtractor.ts` (linhas 97-113): Busca de índices via `textContent.items.indexOf(item)` dentro do loop de janela deslizante de overlap.
* **Embeddings Sequenciais**:
  - `EmbeddingService.ts` (linhas 95-101): `embedBatch` faz chamadas `await this.embed(text)` individuais em fila. 50 chunks geram 50 requisições HTTP seriais.
* **Vector Search sem Filtro de Vetores Indexado**:
  - `VectorStore.ts` (linhas 88-103): Calcula `vec_distance_L2` para todos os vetores da tabela antes de filtrar por `article_id`.
* **Vazamento de Memória do PDF.js**:
  - `PdfExtractor.ts`: `pdfDocument.destroy()` nunca é chamado.

### D. Riscos de Re-renderização e Front-end
* **Monólito `ProjectDetailsPage.tsx`**:
  - Qualquer alteração pontual chama `fetchData()`, trazendo 11 respostas IPC simultâneas e recriando os estados da página inteira.
* **Citação em Massa sem Memoização**:
  - `MassCitationModal.tsx` (linha 764): Instancia o parser `citation-js` no render loop de `sortedArticles.map`.
* **Tabela sem Virtualização**:
  - `pages/ProjectDetails/components/ArticleTable.tsx`: Renderiza `<tr>` diretamente no DOM sem virtualização.
* **Busca sem Debounce**:
  - `useArticleFilters.ts`: Filtra `title`, `abstract` e `authors` a cada caractere digitado na busca.

---

## 3. Mudanças Propostas

### 1. Otimizações de Banco de Dados (SQLite)
* **Adicionar Índices no DDL (`schema.sql`)**:
  ```sql
  CREATE INDEX IF NOT EXISTS idx_articles_project_id ON articles(project_id) WHERE deleted_at IS NULL;
  CREATE INDEX IF NOT EXISTS idx_articles_doi ON articles(doi);
  CREATE INDEX IF NOT EXISTS idx_articles_local_file_path ON articles(local_file_path);
  CREATE INDEX IF NOT EXISTS idx_annotations_article_id ON annotations(article_id) WHERE deleted_at IS NULL;
  CREATE INDEX IF NOT EXISTS idx_highlights_article_id ON highlights(article_id);
  CREATE INDEX IF NOT EXISTS idx_pdf_chunks_article_id ON pdf_chunks(article_id);
  CREATE INDEX IF NOT EXISTS idx_project_documents_project_id ON project_documents(project_id);
  CREATE INDEX IF NOT EXISTS idx_search_history_project_id ON search_history(project_id);
  ```
* **Otimizar `findDuplicateArticle`**:
  - Realizar busca direta no banco via SQL (`WHERE project_id = ? AND (doi = ? OR LOWER(title) = ?)`).
* **Limpar DDL Duplicado em `schema.sql`**:
  - Remover blocos repetidos de `CREATE TABLE IF NOT EXISTS`.

### 2. Otimizações de I/O e Comunicação IPC
* **Substituir Leitura Síncrona de PDF por Protocolo Customizado ou Streaming**:
  - Registrar um protocolo `emma://` no Electron para servir PDFs locais diretamente do disco para o Renderer sem trafegar buffers no IPC.
* **Cálculo de Hash Assíncrono / Worker Thread**:
  - Substituir `fs.readFileSync` por `fs.createReadStream` com `crypto.createHash` assíncrono.

### 3. Otimizações em Operações de IA e PDF
* **Refatorar Algoritmo de Overlap no `PdfExtractor.ts`**:
  - Manter ponteiros/índices numéricos simples para evitar `indexOf` e `.slice()` aninhados, reduzindo o tempo de chunking de $O(N^3)$ para $O(N)$.
* **Adicionar `pdfDocument.destroy()`**:
  - Garantir o fechamento de instâncias do PDFDocument no bloco `finally`.
* **Loteamento Nativo no `EmbeddingService.ts`**:
  - Enviar payload em lote (`input: string[]`) em uma única requisição POST quando suportado pelo provedor.
* **Corrigir Busca Vetorial no `VectorStore.ts`**:
  - Utilizar o operador `MATCH` do `sqlite-vec` para aproveitar o índice vetorial k-NN.

### 4. Otimizações no Frontend (React)
* **Memoizar Citações e Filtros**:
  - Envolver `generateCitation` em `useMemo` com chave baseada em `[article.id, article.updated_at, style, format]`.
  - Aplicar `useDebounce` (300ms) no input de texto de `useArticleFilters.ts`.
* **Virtualizar Tabelas e Modularizar `ProjectDetailsPage.tsx`**:
  - Substituir a tabela HTML estática por `TableVirtuoso`.
  - Dividir `ProjectDetailsPage.tsx` em submódulos isolados por aba.

---

## 4. Componentes Obrigatórios do Protocolo de Handoff

### 1. Observação (Observation)
* **Arquivos Examinados**:
  - `emmas_librarian/electron/database/schema.sql` (Linhas 1-359)
  - `emmas_librarian/electron/database/DatabaseAdapter.ts` (Linhas 1-1570)
  - `emmas_librarian/electron/ipc/ipcRegistries.ts` (Linhas 1-623)
  - `emmas_librarian/electron/ipc/aiIpcHandlers.ts` (Linhas 1-118)
  - `emmas_librarian/electron/services/PdfExtractor.ts` (Linhas 1-139)
  - `emmas_librarian/electron/services/EmbeddingService.ts` (Linhas 1-103)
  - `emmas_librarian/electron/services/VectorStore.ts` (Linhas 1-147)
  - `emmas_librarian/electron/services/AIService.ts` (Linhas 1-375)
  - `emmas_librarian/src/pages/ProjectDetailsPage.tsx` (Linhas 1-2133)
  - `emmas_librarian/src/pages/ProjectDetails/components/ArticleTable.tsx` (Linhas 1-369)
  - `emmas_librarian/src/components/common/ArticleTable.tsx` (Linhas 1-261)
  - `emmas_librarian/src/components/modals/MassCitationModal.tsx` (Linhas 1-844)
  - `emmas_librarian/src/services/citationService.ts` (Linhas 1-175)
  - `emmas_librarian/src/hooks/useArticleFilters.ts` (Linhas 1-68)
  - `emmas_librarian/src/hooks/useProjectMetrics.ts` (Linhas 1-25)

### 2. Cadeia Lógica (Logic Chain)
1. **Das observações no `schema.sql`**: A falta de índices nas chaves estrangeiras obriga o mecanismo do SQLite a realizar varreduras completas na tabela `articles` para cada consulta por projeto.
2. **Das observações em `DatabaseAdapter.ts` e `ipcRegistries.ts`**: O uso de `fs.readFileSync` no processo principal interrompe o Event Loop do Node.js durante o processamento de PDFs pesados.
3. **Das observações no `PdfExtractor.ts`**: O uso de `Array.indexOf` dentro da iteração de chunks gera complexidade $O(N^3)$, aumentando o tempo de processamento de texto.
4. **Das observações em `MassCitationModal.tsx`**: A chamada de `generateCitation` sem `useMemo` forçou a execução síncrona do motor CSL a cada ciclo de renderização do React.

### 3. Ressalvas (Caveats)
* O teste de carga de estresse com milhares de registros foi inferido através de análise estática e profiling de complexidade algorítmica ($O(N^2)$, $O(N^3)$), pois o ambiente de execução atual é de investigação somente leitura (Read-only).
* Algumas alterações no protocolo de transferência de arquivo PDF (como trocar IPC Buffer por protocolo de arquivo customizado) exigem alinhamento com os testes Playwright End-to-End existentes.

### 4. Conclusão (Conclusion)
A aplicação Emma's Librarian apresenta pontos críticos bem definidos de lentidão e consumo ineficiente de recursos. A implementação dos índices no SQLite, a eliminação do I/O síncrono no processo principal, o loteamento de requisições na pipeline RAG e a memoização/virtualização de componentes React resolverão gargalos de desempenho sem alterar a lógica de negócios da aplicação.

### 5. Método de Verificação (Verification Method)
1. **Verificação de Tipagem e Testes**:
   - Executar `npm --prefix emmas_librarian run typecheck`
   - Executar `npm --prefix emmas_librarian run test`
2. **Verificação dos Índices do SQLite**:
   - Abrir o banco `emma.db` via `sqlite3` e executar `EXPLAIN QUERY PLAN SELECT * FROM articles WHERE project_id = 1 AND deleted_at IS NULL;` para confirmar que a busca utiliza `USING INDEX`.
3. **Verificação de Desempenho de Citação e Tabela**:
   - Abrir o modal de citação em massa em um projeto com 100+ artigos lidos e medir o tempo de renderização com a ferramenta React Profiler.
