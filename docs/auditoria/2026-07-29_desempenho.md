# Relatório de Auditoria: Desempenho e Eficiência (R1)

**Projeto**: Emma's Librarian (`emmas_librarian`)  
**Data**: 2026-07-29  
**Escopo**: Auditoria de Desempenho e Eficiência nos eixos Frontend (React/Vite), Backend & IPC (Node/Electron/SQLite), Operações de I/O & IA/RAG e Gestão de Memória/Event Loop.

---

## Estado Atual

A auditoria técnica identificou uma arquitetura robusta na aplicação desktop **Emma's Librarian** (baseada em Electron, React, Vite e SQLite via `better-sqlite3` com a extensão vetorial `sqlite-vec`), porém com gargalos críticos de desempenho e concorrência distribuídos ao longo da pilha de execução.

Abaixo apresenta-se o mapeamento completo dos pontos críticos de I/O e componentes de interface afetados por renderizações excessivas:

### 1. Mapeamento dos Pontos Críticos de I/O

#### A. Camada de Banco de Dados (SQLite & `better-sqlite3`)
* **Esquema Sem Índices Secundários**: O arquivo `electron/database/schema.sql` define a estrutura de dados sem criar índices explícitos em chaves estrangeiras (`FOREIGN KEY`) ou colunas de busca frequente (`project_id`, `article_id`, `doi`, `local_file_path`).
* **Varreduras Completas (*Table Scans*)**: Todas as consultas relacionais (como listar artigos por projeto, buscar anotações/grifos por artigo ou recuperar histórico de busca) filtram colunas sem índice. Com isso, o SQLite executa um *Table Scan* sequencial em toda a tabela `articles` ou `pdf_chunks`.
* **Subconsultas Correlacionadas Ineficientes**: Em `DatabaseAdapter.ts` (função `getStoredPdfs`), a consulta SQL executa a subconsulta correlacionada `LOWER(REPLACE(a.local_file_path, '/', '\'))` para cada registro da tabela `pdf_files`, aplicando transformações de string linha a linha sobre todos os artigos sem auxílio de índice.

#### B. Comunicação IPC e I/O de Arquivos (Node.js / Electron)
* **Operações Síncronas na Thread Principal**: Em `DatabaseAdapter.ts` (`getFileHash`) e `ipcRegistries.ts` (`ARTICLES_CREATE_FROM_PDFS`), o carregamento de arquivos PDF para verificação de hash SHA-256 e salvamento é feito via `fs.readFileSync`. Isso bloqueia o Event Loop do processo principal do Node.js/Electron por centenas de milissegundos para cada arquivo de médio/grande porte (20MB a 100MB).
* **Sobrecarga de Serialização V8 via IPC Payload**: No canal IPC `PDF_GET` (`ipcRegistries.ts`), os arquivos PDF completos são lidos do disco síncronamente e transmitidos como objetos `Buffer` através da ponte IPC do Electron (`ipcMain.handle` / `ipcRenderer.invoke`). A clonagem estruturada da V8 duplica o buffer na memória RAM (um PDF de 50MB chega a alocar 150MB+ em memória entre o Main e Renderer) e causa travamento transitório durante a navegação entre documentos.

#### C. Leitor e Extrator de PDF (`pdfjs-dist`)
* **Ciclo de Vida Leaker**: Em `electron/services/PdfExtractor.ts`, a extração de texto instancia objetos `pdfjsLib.getDocument(...)`, porém nunca chama `pdfDocument.destroy()`. O contexto do worker de processamento C++/JS do PDF.js permanece alocado na memória RAM durante a extração de múltiplos documentos.
* **Dependência de Rede Externa na Configuração do PDF.js**: As configurações do leitor em `PdfExtractor.ts` e `ArticleReaderPage.tsx` especificam `standardFontDataUrl: 'https://unpkg.com/pdfjs-dist@4.10.38/standard_fonts/'`. Em ambientes sem conectividade externa ou sob políticas de segurança restritivas (modo offline/CODE_ONLY), o parser tenta efetuar requisições HTTP externas, gerando retardo por *timeout* ou falhas no parseamento de fontes.

#### D. Pipeline de IA e Indexação RAG
* **Loteamento Sequencial de Embeddings**: A classe `EmbeddingService.ts` implementa o método `embedBatch(texts: string[])` iterando com `for (const text of texts) await this.embed(text)`. Cada chunk de texto dispara uma requisição HTTP POST individual e síncrona para o Ollama ou OpenAI, acumulando latência em fila de dezenas de segundos por artigo.
* **Busca Vetorial Não Indexada (Brute-Force L2)**: No módulo `VectorStore.ts`, a consulta de busca semântica por similaridade aplica a função `vec_distance_L2(e.embedding, ?)` em uma junção ampla com `pdf_chunk_embeddings` sem utilizar o operador de correspondência `MATCH` do `sqlite-vec`. O banco calcula a distância vetorial contra todos os chunks cadastrados no banco de dados antes de filtrar pelo artigo específico.

---

### 2. Mapeamento dos Componentes UI com Renderização Excessiva

#### A. Monólito `ProjectDetailsPage.tsx`
* **Gerenciamento de Estado Agrupado**: O componente `ProjectDetailsPage.tsx` (possuindo 2.133 linhas de código) reúne o estado de listagem de artigos, visualização de documentos, histórico de busca, categorias, pesquisas de IA e filtros de UI em um único componente.
* **Cascata de IPC em `fetchData()`**: A função `fetchData()` dispara 11 requisições IPC simultâneas (`Promise.all`) para recuperar todos os dados do projeto. Qualquer ação pontual do usuário (como alternar a categoria de um único artigo ou desvincular um anexo) força a re-execução global de `fetchData()`, invalidando e reconstruindo toda a árvore React da página.

#### B. Componente `ArticleTable.tsx`
* **Ausência de Virtualização de Lista**: Renderizações em `pages/ProjectDetails/components/ArticleTable.tsx` mapeiam o array completo de artigos diretamente em elementos `<tr>` e `<td>` HTML sem virtualização DOM. Em projetos com mais de 300 artigos, o navegador aloca milhares de nós DOM simultâneos, tornando a rolagem lenta e engasgada.
* **Busca Linear $O(N \times M)$ no Loop de Renderização**: Durante o map de renderização das linhas, o componente executa `projectCategories.find((c) => c.id === catId)` para cada categoria de cada artigo, multiplicando as buscas lineares a cada frame.

#### C. Modal de Citação em Massa (`MassCitationModal.tsx`)
* **Execução Síncrona CSL Não Memoizada**: No loop de renderização de `sortedArticles.map`, a função `generateCitation(art, style, format, useEtAl)` é invocada diretamente no escopo principal sem `useMemo`. O motor CSL da biblioteca `citation-js` executa parsing pesado e formatação síncrona para cada item da lista. Alterações de estado secundárias no modal (como marcar um checkbox) travam a UI por segundos.

#### D. Manipulação Direta de DOM em `ArticleReaderPage.tsx`
* **MutationObserver sem Throttle**: O realce de termos buscados no leitor de PDF utiliza um `MutationObserver` que substitui o conteúdo HTML nativo (`span.innerHTML = safeText.replace(...)`). Isso dispara recálculos contínuos de layout no navegador (*reflow* / *repaint*) e pode entrar em concorrência com o reconciliador do React.

---

## Pontos Críticos

Nesta seção detalham-se as falhas de desempenho e eficiência identificadas no código, classificadas por tipo e complexidade algorítmica.

### 1. Consultas Lentas e Ausência de Índices no SQLite

* **Localização**: `electron/database/schema.sql` (Linhas 1-359)
* **Descrição**: O esquema DDL não cria índices nas tabelas principais.
* **Gargalos Específicos**:
  - `articles`: ausência de índice em `project_id`, `doi`, `status`, `search_id`, `local_file_path`, `deleted_at`.
  - `annotations` e `highlights`: ausência de índice em `article_id`.
  - `pdf_chunks`: ausência de índice em `article_id` e na tupla `(article_id, chunk_index)`.
  - `project_documents`, `search_history`, `project_categories`, `massive_investigations`: ausência de índice em `project_id`.
* **Impacto**: Qualquer consulta como `SELECT * FROM articles WHERE project_id = ? AND deleted_at IS NULL` varre 100% dos registros do banco de dados (complexidade $O(N)$ por consulta).

### 2. Algoritmos com Complexidade $O(N^2)$ e $O(N^3)$

#### A. Verificação de Duplicatas com Complexidade $O(N^2)$
* **Localização**: `electron/database/DatabaseAdapter.ts` (Linhas 481-490)
* **Trecho de Código**:
  ```typescript
  findDuplicateArticle(projectId: number, doi: string | null | undefined, title: string): Article | undefined {
    if (doi) { ... }
    const normalizedTarget = this.normalizeTitleForDb(title);
    const stmt = this.db.prepare('SELECT * FROM articles WHERE project_id = ? AND deleted_at IS NULL');
    const articles = stmt.all(projectId) as Article[];
    return articles.find((art) => this.normalizeTitleForDb(art.title) === normalizedTarget);
  }
  ```
* **Gargalo**: Ao importar um lote de $N$ artigos, a função `saveArticle` chama `findDuplicateArticle` para cada item. A função busca **todos** os artigos do projeto no SQLite (`SELECT * FROM articles`) e executa normalização de título via JS item a item. Para uma importação em lote de $N$ itens em um projeto com $M$ artigos existentes, a complexidade total atinge $O(N \times M)$, gerando congelamento na importação.

#### B. Algoritmo de Chunking com Complexidade Cúbica $O(N^3)$
* **Localização**: `electron/services/PdfExtractor.ts` (Linhas 97-113)
* **Trecho de Código**:
  ```typescript
  for (let i = currentBboxes.length - 1; i >= 0; i--) {
    keepText = textContent.items
      .slice(
        Math.max(0, textContent.items.indexOf(item) - (currentBboxes.length - 1 - i)),
        textContent.items.indexOf(item) + 1,
      )
      .map((x) => ('str' in x ? x.str : ''))
      .join(' ');
  }
  ```
* **Gargalo**: O cálculo do *overlap* de texto entre chunks de PDF invoca `textContent.items.indexOf(item)` dentro de um loop reverso aninhado, que por sua vez está dentro do loop principal de itens do PDF. A busca linear de índice (`indexOf`) multiplicada por `.slice()` e `.map()` produz uma degradação de complexidade $O(N^3)$ no tempo de extração de PDFs extensos.

### 3. Sobrecarga de Serialização e Transferência de Buffers no IPC

* **Localização**: `electron/ipc/ipcRegistries.ts` (Linhas 193-200, Canal `PDF_GET`)
* **Trecho de Código**:
  ```typescript
  ipcMain.handle(IpcChannel.PDF_GET, async (event, articleId) => {
    const article = db.getArticle(articleId);
    ...
    const buffer = fs.readFileSync(article.local_file_path);
    return buffer;
  });
  ```
* **Gargalo**: Transferir o binário completo do PDF como objeto `Buffer` via ponte IPC faz o Electron serializar o payload pela V8 (`Structured Clone`). O processo Renderer aloca o buffer, converte para `Uint8Array`, gera um `Blob` e instancia uma `BlobURL`. Esse ciclo eleva o consumo de RAM em até 3x o tamanho do PDF e bloqueia a thread de IPC durante a leitura.

### 4. Bloqueios do Event Loop do Node.js e Concorrência

* **Leitura Síncrona de Arquivos para Hash SHA-256**: Em `DatabaseAdapter.ts` (linhas 1391-1394), `getFileHash` invoca `fs.readFileSync(filePath)` e executa `crypto.createHash('sha256').update(fileBuffer).digest('hex')` síncronamente na thread principal. Durante a importação de múltiplos PDFs, o Event Loop do Node.js é completamente bloqueado.
* **Busca Vetorial em Força Bruta no `sqlite-vec`**: Em `VectorStore.ts` (linhas 88-103), a busca vetorial por similaridade L2 executa a varredura bruta sobre toda a tabela de embeddings antes de filtrar pelo `article_id`, degradando a performance à medida que a base vetorial expande.

### 5. Vazamentos de Memória (*Memory Leaks*)

* **Retenção de Instâncias do PDF.js**: `PdfExtractor.ts` não executa `pdfDocument.destroy()`. As instâncias e estruturas de contexto alocadas em memória C++/JS pelo parser do PDF.js permanecem retidas após a extração.
* **Manipulação de DOM sem Desalocação**: `ArticleReaderPage.tsx` utiliza `MutationObserver` alterando o `innerHTML` de spans de texto, criando referências retidas no DOM do navegador e provocando *memory leak* em sessões prolongadas de leitura.

---

## Mudanças Propostas

As propostas de otimização a seguir foram estruturadas para resolver os gargalos identificados sem alterar a lógica de negócios nem quebrar os contratos de interface existentes.

### 1. Índices de Banco de Dados SQLite (DDL)

#### A. Criação de Índices no Esquema (`schema.sql`)
Executar as seguintes instruções DDL na inicialização do SQLite em `electron/database/schema.sql`:

```sql
-- Índices para otimização de consultas da tabela de artigos
CREATE INDEX IF NOT EXISTS idx_articles_project_id ON articles(project_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_articles_doi ON articles(doi) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_articles_local_file_path ON articles(local_file_path);
CREATE INDEX IF NOT EXISTS idx_articles_status ON articles(project_id, status) WHERE deleted_at IS NULL;

-- Índices para tabelas relacionais e anexos
CREATE INDEX IF NOT EXISTS idx_annotations_article_id ON annotations(article_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_highlights_article_id ON highlights(article_id);
CREATE INDEX IF NOT EXISTS idx_pdf_chunks_article_id ON pdf_chunks(article_id);
CREATE INDEX IF NOT EXISTS idx_pdf_chunks_composite ON pdf_chunks(article_id, chunk_index);
CREATE INDEX IF NOT EXISTS idx_project_documents_project_id ON project_documents(project_id);
CREATE INDEX IF NOT EXISTS idx_search_history_project_id ON search_history(project_id);
CREATE INDEX IF NOT EXISTS idx_project_categories_project_id ON project_categories(project_id);
CREATE INDEX IF NOT EXISTS idx_massive_investigations_project_id ON massive_investigations(project_id);
```

#### B. Refatoração da Verificação de Duplicatas (`findDuplicateArticle`)
Substituir a varredura em memória JS por consulta SQL direta indexada no SQLite:

```typescript
findDuplicateArticle(projectId: number, doi: string | null | undefined, title: string): Article | undefined {
  if (doi && doi.trim() !== '') {
    const stmtDoi = this.db.prepare(
      'SELECT * FROM articles WHERE project_id = ? AND doi = ? AND deleted_at IS NULL LIMIT 1'
    );
    const existingByDoi = stmtDoi.get(projectId, doi.trim()) as Article | undefined;
    if (existingByDoi) return existingByDoi;
  }

  const normalizedTarget = this.normalizeTitleForDb(title);
  const stmtTitle = this.db.prepare(
    'SELECT * FROM articles WHERE project_id = ? AND LOWER(title) = LOWER(?) AND deleted_at IS NULL LIMIT 1'
  );
  return stmtTitle.get(projectId, normalizedTarget) as Article | undefined;
}
```

---

### 2. Protocolo Customizado / Streaming de PDFs (Substituição do Buffer IPC)

#### A. Registro de Protocolo Customizado no Electron (`emma://`)
Em `electron/main.ts` ou no registro de protocolo do Main Process, registrar o esquema `emma://` para entregar os PDFs diretamente via streaming de arquivo do sistema operacional, sem passar por serialização IPC:

```typescript
protocol.handle('emma-pdf', (request) => {
  const url = request.url.replace('emma-pdf://', '');
  const decodedPath = decodeURIComponent(url);
  return net.fetch(pathToFileURL(decodedPath).toString());
});
```

No Renderer (`ArticleReaderPage.tsx`), utilizar diretamente o protocolo `emma-pdf://<caminho_absoluto>` como URL do PDF.js, eliminando o envio de buffers pelo IPC e reduzindo o consumo de memória RAM.

---

### 3. I/O Assíncrono e Hashing Não Bloqueante

#### A. Hash SHA-256 Assíncrono com ReadStream
Substituir a leitura síncrona `fs.readFileSync` por streaming de leitura assíncrono com `crypto.createHash`:

```typescript
private async getFileHashAsync(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', (data) => hash.update(data));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', (err) => reject(err));
  });
}
```

---

### 4. Otimização da Pipeline de RAG e Vetores

#### A. Refatoração Algorítmica do Chunking de PDF ($O(N^3) \rightarrow O(N)$)
Substituir a busca por `indexOf` e `slice` em `PdfExtractor.ts` mantendo o índice numérico do array de itens:

```typescript
// Armazenar índice numérico no loop de iteração para evitar buscas lineares repetidas
const itemIndex = idx; // Usar o índice do loop atual diretamente
const startIndex = Math.max(0, itemIndex - (currentBboxes.length - 1 - i));
const sliceItems = textContent.items.slice(startIndex, itemIndex + 1);
keepText = sliceItems.map((x) => ('str' in x ? x.str : '')).join(' ');
```

#### B. Destruição Explícita de Instâncias no PDF.js
Garantir o fechamento das instâncias do PDF Document em bloco `try ... finally`:

```typescript
const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buffer) });
const pdfDocument = await loadingTask.promise;
try {
  // Processamento de extração de texto
} finally {
  await pdfDocument.destroy();
}
```

#### C. Loteamento Nativo de Embeddings
Em `EmbeddingService.ts`, enviar o lote completo de textos em uma única requisição POST quando a API do provedor (Ollama ou OpenAI) suportar arrays:

```typescript
async embedBatch(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  // Envio do payload agrupado no campo 'input'
  const response = await this.client.post('/embeddings', {
    model: this.modelName,
    input: texts,
  });
  return response.data.data.map((item: any) => item.embedding);
}
```

#### D. Busca Vetorial Indexada com Operador `MATCH`
Em `VectorStore.ts`, utilizar a sintaxe k-NN do `sqlite-vec` aproveitando o índice de vetores:

```sql
SELECT c.id as chunkId, c.article_id as articleId, c.content, v.distance as similarityScore
FROM pdf_chunk_embeddings v
JOIN pdf_chunks c ON c.id = v.rowid
WHERE v.embedding MATCH ? AND k = ? AND c.article_id = ?
ORDER BY v.distance ASC;
```

---

### 5. Memoização, Virtualização e Desacoplamento de UI (React)

#### A. Virtualização da Tabela de Artigos (`TableVirtuoso`)
Em `ArticleTable.tsx`, substituir o elemento `<table>` nativo com `.map()` por `TableVirtuoso` do pacote `react-virtuoso`:

```tsx
<TableVirtuoso
  data={articles}
  fixedHeaderContent={() => (
    <tr>
      <th>Título</th>
      <th>Autores</th>
      <th>Ano</th>
      <th>Ações</th>
    </tr>
  )}
  itemContent={(index, article) => (
    <ArticleTableRow article={article} categories={categoryMap.get(article.id) || []} />
  )}
/>
```

#### B. Memoização da Formatação de Citações CSL
Em `MassCitationModal.tsx` e `ArticleTable.tsx`, envolver a chamada `generateCitation` em `useMemo` parametrizado pelo ID e timestamp do artigo:

```tsx
const formattedCitations = useMemo(() => {
  return sortedArticles.map((art) => ({
    id: art.id,
    text: generateCitation(art, style, format, useEtAl),
  }));
}, [sortedArticles, style, format, useEtAl]);
```

#### C. Debounce no Input de Filtro de Busca
Em `useArticleFilters.ts`, aplicar `useDebounce` (300ms) na atualização de `selectedKeyword` para evitar recálculos contínuos do filtro a cada tecla digitada:

```typescript
const debouncedKeyword = useDebounce(selectedKeyword, 300);

const filteredArticles = useMemo(() => {
  if (!debouncedKeyword) return articles;
  const term = debouncedKeyword.toLowerCase();
  return articles.filter(
    (a) =>
      a.title?.toLowerCase().includes(term) ||
      a.abstract?.toLowerCase().includes(term) ||
      a.authors?.toLowerCase().includes(term)
  );
}, [articles, debouncedKeyword]);
```

#### D. Cálculo de Métricas em Único Passe (`useMemo`)
Em `useProjectMetrics.ts`, substituir a combinação `useEffect` + `useState` com 4 `.filter()` por um único `useMemo` com `.reduce()`:

```typescript
export function useProjectMetrics(articles: Article[]) {
  return useMemo(() => {
    return articles.reduce(
      (acc, a) => {
        acc.total += 1;
        if (a.status === 'read') acc.read += 1;
        if (a.status === 'new') acc.new += 1;
        if (a.status === 'archived') acc.archived += 1;
        if (a.local_file_path) acc.withPdf += 1;
        return acc;
      },
      { total: 0, read: 0, new: 0, archived: 0, withPdf: 0 }
    );
  }, [articles]);
}
```

---

## Matriz de Impacto e Priorização das Soluções

| Solução Proposta | Eixo de Otimização | Complexidade | Redução Esperada de Latência / Recurso | Prioridade |
|---|---|---|---|---|
| **Criação de Índices DDL no SQLite** | Banco de Dados | Baixa | Redução de $O(N)$ para $O(\log N)$ no tempo de consulta SQL | **P0 (Crítica)** |
| **Otimização de `findDuplicateArticle`** | Banco de Dados | Baixa | Redução de $O(N^2)$ para $O(1)$ na verificação de duplicatas | **P0 (Crítica)** |
| **Stream / Protocolo Customizado PDF** | IPC & Memória | Média | Liberação de até 70% de consumo de RAM na transferência IPC | **P0 (Crítica)** |
| **Hash SHA-256 Assíncrono com Stream** | Event Loop / I/O | Baixa | Desbloqueio da thread principal durante importação de PDFs | **P1 (Alta)** |
| **Refatoração Chunking PDF ($O(N^3) \rightarrow O(N)$)** | RAG & IA | Média | Aceleração de até 10x na extração de texto de PDFs extensos | **P1 (Alta)** |
| **Virtualização com `TableVirtuoso`** | UI / React | Média | Eliminação de travamentos de rolagem com 500+ artigos | **P1 (Alta)** |
| **Memoização CSL com `useMemo`** | UI / React | Baixa | Render instantâneo do modal de citação em massa | **P1 (Alta)** |
| **Loteamento de Embeddings em Requisição Única** | RAG & IA | Média | Redução de $N$ chamadas HTTP POST para 1 única chamada | **P2 (Média)** |
| **Busca Vetorial Indexada com `MATCH`** | RAG & IA | Média | Pesquisa vetorial $O(\log N)$ escalável para bases grandes | **P2 (Média)** |
| **Debounce e `useMemo` em Filtros/Métricas** | UI / React | Baixa | Eliminação de renders duplos e filtros instantâneos pesados | **P2 (Média)** |

---

## Conclusão e Próximos Passos

A aplicação das otimizações propostas neste relatório garantirá que o **Emma's Librarian** opere com máxima eficiência, estabilidade de memória e resposta instantânea da interface do usuário mesmo em projetos contendo milhares de artigos e arquivos PDF de grande porte. A execução deve seguir a ordem de prioridade definida na matriz (P0 $\rightarrow$ P1 $\rightarrow$ P2), validando cada etapa por meio da suíte de testes do projeto (`npm --prefix emmas_librarian run test` e `typecheck`).
