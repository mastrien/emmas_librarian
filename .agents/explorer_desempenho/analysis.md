# Relatório de Análise Técnica: Desempenho e Eficiência (R1) - Project emmas_librarian

## 1. Visão Geral e Resumo Executivo
Esta investigação realizou um auditoria completa de desempenho e eficiência no projeto **Emma's Librarian** (`c:\root_lab\antigravity\emmas_librarian`). O projeto é uma aplicação desktop baseada em **Electron**, **React**, **Vite** e **SQLite** (`better-sqlite3` com a extensão `sqlite-vec`).

A auditoria cobriu 4 eixos principais:
1. **Frontend (React/Vite)**: Renderização de componentes, estado global, re-renders, cálculos não memoizados e empacotamento de bundles.
2. **Backend & IPC (Node/Electron/SQLite)**: Modelagem do banco de dados, ausência de índices, I/O síncrono no processo principal, serialização de IPC e conexão/transações no SQLite.
3. **Operações de I/O & IA/RAG**: Extração e parse de documentos PDF com `pdfjs-dist`, loteamento de embeddings, pesquisas de vetores no `sqlite-vec` e gargalos na pipeline RAG.
4. **Vazamentos de Memória & Bloqueios do Event Loop**: Retenção de memória de documentos PDF, acoplamento no processo IPC, observadores de DOM e bloqueios no loop de eventos Node.js.

---

## 2. Auditoria Detalhada por Eixo

### Eixo 1: Frontend (React / Vite)

#### 1.1 Estado Monolítico e Re-renders em Cadeia
* **Localização**: `emmas_librarian/src/pages/ProjectDetailsPage.tsx` (Linhas 1-2133)
* **Observação**: O arquivo possui mais de 2.100 linhas (violando a diretriz de design de arquivos < 500 linhas) e gerencia dezenas de estados locais (artigos, documentos, histórico de busca, categorias, busca textual, modais e IA).
* **Evidência**: A função `fetchData()` (Linhas 181-227) executa 11 chamadas IPC em paralelo via `Promise.all`:
  - `getProject`, `getArticles`, `getSearchHistory`, 4x `getSetting`, `getProjectDocuments`, `getMassiveInvestigations`, `getProjectCategories`, `getAllProjectArticleCategories`.
* **Cadeia Lógica**: Qualquer alteração simples (como mudar o status de leitura de um único artigo ou desvincular um PDF) chama `fetchData()`, disparando novamente as 11 consultas IPC e reinicializando todos os estados do componente. Isso força a re-renderização completa da árvore de componentes da página.

#### 1.2 Tabela de Artigos Não Virtualizada
* **Localização**: `emmas_librarian/src/pages/ProjectDetails/components/ArticleTable.tsx` (Linhas 59-365)
* **Observação**: Uma versão da tabela de artigos renderiza uma tabela HTML convencional (`<table>`) usando `articles.map(...)` direto no DOM sem virtualização de lista.
* **Evidência**:
  ```tsx
  {articles.map((article) => (
    <tr key={article.id}> ... </tr>
  ))}
  ```
  Em projetos com 500 a 2.000 artigos, o React cria centenas de nós DOM `<tr>`, com botões de ação e manipuladores de eventos embutidos, travando a thread principal de renderização durante a rolagem e filtragem.
  Adicionalmente, na Linha 114:
  ```tsx
  {articleCategories[article.id].map((catId) => {
    const cat = projectCategories.find((c) => c.id === catId);
  ```
  Executa uma busca linear $O(N \times M)$ dentro do loop de renderização para cada categoria associada a cada artigo.

#### 1.3 Cálculos Pesados Não Memoizados em Loops de Renderização
* **Localização**: `emmas_librarian/src/components/modals/MassCitationModal.tsx` (Linha 764)
* **Evidência**:
  ```tsx
  sortedArticles.map((art, index) => {
    const citText = generateCitation(art, style, format, useEtAl);
  ```
* **Cadeia Lógica**: A função `generateCitation` instancia o motor CSL da biblioteca `citation-js` de forma síncrona. Quando o usuário altera um estado no modal (ex: marca/desmarca um checkbox ou alterna o formato), `sortedArticles.map` executa `generateCitation` repetidamente para cada artigo. Em listas com dezenas ou centenas de artigos, isso congela a interface do modal por múltiplos segundos.
* **Localização Secundaria**: `emmas_librarian/src/components/common/ArticleTable.tsx` (Linha 130)
  - `JSON.parse(article.source_databases || '[]')` é executado dentro do `itemContent` do Virtuoso para cada linha em cada renderização sem uso de `useMemo`.

#### 1.4 Estado de Filtro Sem Debounce e Métricas com Render Duplo
* **Localização**: `emmas_librarian/src/hooks/useArticleFilters.ts` (Linhas 11-52)
* **Evidência**: O estado `selectedKeyword` é atualizado a cada tecla digitada na barra de busca. Isso dispara `useMemo` instantaneamente, varrendo `title`, `abstract` e `authors` de todos os artigos sem qualquer técnica de *debounce* ou *throttle*.
* **Localização**: `emmas_librarian/src/hooks/useProjectMetrics.ts` (Linhas 13-21)
* **Evidência**:
  ```ts
  useEffect(() => {
    setMetrics({
      total: articles.length,
      read: articles.filter((a) => a.status === 'read').length,
      new: articles.filter((a) => a.status === 'new').length,
      archived: articles.filter((a) => a.status === 'archived').length,
      withPdf: articles.filter((a) => !!a.local_file_path).length,
    });
  }, [articles]);
  ```
  O uso de `useEffect` + `useState` força uma renderização inicial com métricas desatualizadas, seguida de um segundo re-render síncrono quando `setMetrics` é acionado. Além disso, executa 4 chamadas `.filter()` separadas sobre o array de artigos em vez de um único passe `.reduce()`.

#### 1.5 Importação de Bundles Pesados e Ausência de Code-Splitting
* **Localização**: `emmas_librarian/package.json` e `vite.config.mts`
* **Observação**: O projeto importa bibliotecas voluminosas na entrada principal: `@mdxeditor/editor`, `citation-js`, `pdfjs-dist`, `xlsx`, `chart.js`, `prismjs` e `lucide-react`.
* **Evidência**: Em `vite.config.mts` (Linha 57), foi definido `chunkSizeWarningLimit: 1000` para desativar os alertas do Vite sem configurar `build.rollupOptions.output.manualChunks` ou `React.lazy` para os modais pesados (`MassCitationModal`, `AIExtractionModal`, `QuestionSetCatalog`).

---

### Eixo 2: Backend & IPC (Node / Electron / SQLite)

#### 2.1 Ausência de Índices em Chaves Estrangeiras e Colunas de Consulta
* **Localização**: `emmas_librarian/electron/database/schema.sql`
* **Observação**: A tabela principal `articles` e diversas tabelas relacionais possuem chaves estrangeiras (`FOREIGN KEY`) sem índices no SQLite.
* **Tabelas e Colunas sem Índice**:
  - `articles`: `project_id`, `doi`, `status`, `search_id`, `deleted_at`
  - `annotations`: `article_id`, `deleted_at`
  - `highlights`: `article_id`
  - `pending_highlights`: `article_id`
  - `project_documents`: `project_id`
  - `pdf_chunks`: `article_id`, `(article_id, chunk_index)`
  - `search_history`: `project_id`
  - `project_categories`: `project_id`
  - `massive_investigations`: `project_id`
* **Cadeia Lógica**: Cada consulta de artigos por projeto (`SELECT * FROM articles WHERE project_id = ? AND deleted_at IS NULL`) obriga o SQLite a realizar um **Table Scan completo** em toda a tabela `articles`. À medida que o banco cresce para milhares de artigos, o tempo de resposta das consultas degrada de forma linear $O(N)$.

#### 2.2 Duplicação de Instruções no DDL de Esquema
* **Localização**: `emmas_librarian/electron/database/schema.sql` (Linhas 3-113 e 117-282)
* **Observação**: O arquivo `schema.sql` possui blocos duplicados de `CREATE TABLE IF NOT EXISTS` para `projects`, `articles`, `annotations`, `settings`, `search_history`, `highlights`, `project_diary`, `pending_highlights`, `project_documents` e `question_sets`. Embora o `IF NOT EXISTS` evite falhas graves, executar DDLs duplicados aumenta desnecessariamente o tempo de inicialização do banco.

#### 2.3 Verificação de Duplicatas com Complexidade $O(N^2)$
* **Localização**: `emmas_librarian/electron/database/DatabaseAdapter.ts` (Linhas 481-490)
* **Código**:
  ```ts
  findDuplicateArticle(projectId: number, doi: string | null | undefined, title: string): Article | undefined {
    if (doi) { ... }
    const normalizedTarget = this.normalizeTitleForDb(title);
    const stmt = this.db.prepare('SELECT * FROM articles WHERE project_id = ? AND deleted_at IS NULL');
    const articles = stmt.all(projectId) as Article[];
    return articles.find((art) => this.normalizeTitleForDb(art.title) === normalizedTarget);
  }
  ```
* **Cadeia Lógica**: Ao importar um lote de $N$ artigos (ex: importação de 500 resultados de busca), `saveArticle` chama `findDuplicateArticle` para cada item. Essa função executa `SELECT * FROM articles WHERE project_id = ?`, trazendo TODOS os artigos do projeto para a memória RAM e normalizando os títulos em JavaScript item por item. Para $N$ inserções, são realizadas $N$ consultas completas e $N \times M$ normalizações de string, resultando em complexidade $O(N^2)$.

#### 2.4 Subconsulta Correlacionada sem Índice em `getStoredPdfs()`
* **Localização**: `emmas_librarian/electron/database/DatabaseAdapter.ts` (Linhas 1420-1429)
* **Código**:
  ```sql
  SELECT p.id, p.file_path, p.file_hash, p.filename, p.file_size, p.created_at,
         (SELECT json_group_array(json_object('article_id', a.id, 'article_title', a.title, ...))
          FROM articles a
          JOIN projects pr ON a.project_id = pr.id
          WHERE LOWER(REPLACE(a.local_file_path, '/', '\')) = LOWER(REPLACE(p.file_path, '/', '\')) ...
         ) as articles_json
  FROM pdf_files p
  ```
* **Cadeia Lógica**: Para cada linha da tabela `pdf_files`, a subconsulta executa funções de manipulação de string (`LOWER(REPLACE(...))`) sobre cada linha da tabela `articles` sem a presença de um índice em `local_file_path`. Isso gera um *Table Scan* correlacionado para cada PDF da biblioteca.

#### 2.5 I/O Síncrono e Cálculo de Hash na Thread Principal
* **Localização**: `DatabaseAdapter.ts` (Linhas 1391-1394) e `ipcRegistries.ts` (Linhas 147-150)
* **Código**:
  ```ts
  private getFileHash(filePath: string): string {
    const fileBuffer = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(fileBuffer).digest('hex');
  }
  ```
* **Cadeia Lógica**: A leitura síncrona `fs.readFileSync(filePath)` carrega todo o arquivo PDF na memória RAM de uma só vez. A geração de hash SHA-256 para arquivos de 20MB a 100MB bloqueia totalmente o Event Loop do processo principal do Node/Electron.
* Em `ipcRegistries.ts` (`ARTICLES_CREATE_FROM_PDFS`, Linhas 307-327), a importação em lote de múltiplos PDFs copia arquivos e gera hashes de forma estritamente síncrona em um loop `for`, congelando a aplicação durante a importação.

#### 2.6 Serialização Pesada de Buffers IPC para Leitura de PDFs
* **Localização**: `emmas_librarian/electron/ipc/ipcRegistries.ts` (Linhas 193-200)
* **Código**:
  ```ts
  ipcMain.handle(IpcChannel.PDF_GET, async (event, articleId) => {
    const article = db.getArticle(articleId);
    ...
    const buffer = fs.readFileSync(article.local_file_path);
    return buffer;
  });
  ```
* **Cadeia Lógica**: A transferência de arquivos PDF binários inteiros através da ponte IPC do Electron (`ipcRenderer.invoke` -> `ipcMain.handle`) obriga a serialização V8 / clone estruturado do buffer. No processo Renderer (`ArticleReaderPage.tsx`), o buffer precisa ser convertido para `Uint8Array`, depois para `Blob` e depois para uma `BlobURL`. Esse processo duplica e triplica o uso de RAM (50MB de arquivo tornam-se 150MB em RAM) e trava a thread IPC.

---

### Eixo 3: Operações de I/O e IA / RAG

#### 3.1 Complexidade Cúbica $O(N^3)$ na Divisão de Chunks PDF
* **Localização**: `emmas_librarian/electron/services/PdfExtractor.ts` (Linhas 97-113)
* **Código**:
  ```ts
  for (let i = currentBboxes.length - 1; i >= 0; i--) {
    keepText = textContent.items
      .slice(
        Math.max(0, textContent.items.indexOf(item) - (currentBboxes.length - 1 - i)),
        textContent.items.indexOf(item) + 1,
      )
      .map((x) => ('str' in x ? x.str : ''))
      .join(' ');
  ```
* **Cadeia Lógica**: Dentro de um loop por item do PDF, a chamada `textContent.items.indexOf(item)` é executada repetidamente dentro de um segundo loop reverso para recalcular o *overlap* de texto dos chunks. O uso de `indexOf` sobre o array de itens gera varreduras aninhadas com complexidade $O(N^3)$, degradando gravemente a extração de texto em artigos longos.

#### 3.2 Dependência de Rede Externa no Worker do PDF.js
* **Localização**: `PdfExtractor.ts` (Linha 32) e `ArticleReaderPage.tsx` (Linha 49)
* **Código**: `standardFontDataUrl: 'https://unpkg.com/pdfjs-dist@4.10.38/standard_fonts/'`
* **Cadeia Lógica**: O PDF.js foi configurado para buscar fontes padrão via HTTP na CDN `unpkg.com`. Em ambientes offline ou com restrições de rede (modo CODE_ONLY), a extração de PDFs tenta realizar requisições externas, resultando em timeouts ou falhas de parse.

#### 3.3 Vazamento de Recursos do PDFDocument
* **Localização**: `emmas_librarian/electron/services/PdfExtractor.ts` (Linhas 30-33)
* **Observação**: O documento PDF é carregado via `pdfjsLib.getDocument(...)`. No entanto, o método `pdfDocument.destroy()` **nunca é chamado**. Em operações massivas de extração ou RAG sobre dezenas de PDFs, o contexto do worker C++ do PDF.js permanece alocado em memória.

#### 3.4 Loteamento Sequencial de Embeddings no RAG
* **Localização**: `emmas_librarian/electron/services/EmbeddingService.ts` (Linhas 95-101)
* **Código**:
  ```ts
  async embedBatch(texts: string[]): Promise<number[][]> {
    const results: number[][] = [];
    for (const text of texts) {
      results.push(await this.embed(text));
    }
    return results;
  }
  ```
* **Cadeia Lógica**: A função `embedBatch` envia requisições HTTP individuais e sequenciais para cada chunk (`for (const text of texts) await this.embed(text)`). Para um artigo com 50 chunks, são efetuadas 50 chamadas HTTP POST em fila para o Ollama ou OpenAI, acumulando uma latência enorme na indexação vetorial.

#### 3.5 Busca Vetorial Não Indexada (Brute Force) no `sqlite-vec`
* **Localização**: `emmas_librarian/electron/services/VectorStore.ts` (Linhas 88-103)
* **Código**:
  ```sql
  SELECT c.id as chunkId, ... vec_distance_L2(e.embedding, ?) as similarityScore
  FROM pdf_chunk_embeddings e
  JOIN pdf_chunks c ON c.id = e.rowid
  WHERE c.article_id = ?
  ORDER BY similarityScore ASC LIMIT ?
  ```
* **Cadeia Lógica**: A consulta realiza o cálculo da distância L2 (`vec_distance_L2`) sobre **TODOS os vetores da tabela virtual `pdf_chunk_embeddings`** antes de filtrar por `c.article_id = ?`. Como não utiliza o operador de busca k-NN do `sqlite-vec` (`WHERE embedding MATCH ? AND k = ?`), a busca vetorial torna-se um algoritmo *brute-force* $O(N_{\text{total}})$ que desacelera à medida que novos documentos são inseridos no banco.

---

### Eixo 4: Vazamentos de Memória e Bloqueios do Event Loop

#### 4.1 Bloqueio do Event Loop Node.js
- Leitura síncrona de arquivos pesados via `fs.readFileSync` no processo main do Electron durante geração de hash SHA-256 e clonagem de artigos.
- Processamento em lote de buscas e citações em loops síncronos na thread principal.

#### 4.2 Vazamentos de Memória e Manipulação de DOM
- Ausência de `pdfDocument.destroy()` no leitor de PDF e no extrator de texto.
- Em `ArticleReaderPage.tsx` (Linhas 565-587), o uso de `MutationObserver` para realce de busca altera o DOM nativamente com `span.innerHTML = safeText.replace(...)` sem controle refinado, causando relayouts constantes e potenciais conflitos com o ciclo de vida do React.
- Duplicação de buffers de dados ao carregar PDFs via IPC.

---

## 3. Matriz de Impacto e Severidade

| Problema | Componente / Arquivo | Severidade | Impacto |
|---|---|---|---|
| Ausência de Índices SQLite em FKs | `schema.sql` | **CRÍTICO** | Table scans contínuos em todas as buscas de artigos, anexos e notas |
| Leitura Síncrona e Hash na Thread Main | `DatabaseAdapter.ts` / `ipcRegistries.ts` | **CRÍTICO** | Trava a interface do Electron durante upload e verificação de PDFs |
| Transferência IPC de Buffers Binários | `ipcRegistries.ts` (`PDF_GET`) | **ALTO** | Pico de memória RAM (3x tamanho do PDF) e degradação IPC |
| $O(N^2)$ na Verificação de Duplicatas | `DatabaseAdapter.ts` | **ALTO** | Lentidão extrema ao importar centenas de artigos em lote |
| Generador CSL Citação Não Memoizado | `MassCitationModal.tsx` / `ArticleTable.tsx` | **ALTO** | Modal de citação em massa congela a UI a cada renderização |
| Chunking $O(N^3)$ em PDFExtractor | `PdfExtractor.ts` | **ALTO** | Latência excessiva na extração de texto para RAG |
| Batch de Embeddings Sequencial | `EmbeddingService.ts` | **MÉDIO** | 50+ chamadas HTTP em fila para indexar um único documento |
| Vector Search Brute-Force | `VectorStore.ts` | **MÉDIO** | Desaceleração da busca por similaridade à medida que o banco cresce |
| Re-render Monolítico da Página | `ProjectDetailsPage.tsx` | **MÉDIO** | 11 requisições IPC refecethed em qualquer ação do usuário |
| Dependência de Rede Externa no PDF.js | `PdfExtractor.ts` / `ArticleReaderPage.tsx` | **MÉDIO** | Timeout e falha em ambientes sem conexão externa |

---

## 4. Recomendações de Otimização

1. **Criar Índices no SQLite**:
   Adicionar índices explícitos no DDL para `articles(project_id)`, `articles(doi)`, `articles(status)`, `annotations(article_id)`, `highlights(article_id)`, `pdf_chunks(article_id)` e `project_documents(project_id)`.
2. **Substituir Transferência IPC de Buffer por Protocolo de Arquivo Local**:
   Servir arquivos PDF usando um protocolo customizado (`emma://`) ou via suporte a streams de arquivo, evitando serialização de buffers no IPC.
3. **Assincronismo no Hashing de Arquivos**:
   Utilizar `fs.createReadStream` com `crypto.createHash` ou mover o cálculo de hash para um Worker Thread.
4. **Otimização de Lote no Embeddings Service**:
   Implementar payload em lote (`input: string[]`) para provedores que suportam lote nativo (OpenAI / Ollama).
5. **Memoização e Virtualização no Frontend**:
   Memoizar a geração de citações com `useMemo` e virtualizar tabelas de artigos com `react-virtuoso`.
6. **Refatoração da Divisão de Chunks**:
   Eliminar `indexOf` e `.slice()` aninhados no `PdfExtractor.ts`, reduzindo a complexidade de $O(N^3)$ para $O(N)$.
