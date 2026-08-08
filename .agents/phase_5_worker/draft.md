# Fase 5: Expansão da Produtividade Acadêmica, Portabilidade e Motor de Citações (ABNT/BibTeX)

## 1. Posição no Projeto
- **Título da Fase**: Fase 5: Expansão da Produtividade Acadêmica, Portabilidade e Motor de Citações (ABNT/BibTeX)
- **Posição**: Fase 5 (Commits 72 a 91)
- **Intervalo de Commits**: Commit 72 (`0cfd45e`) até Commit 91 (`8e72c9e`) (Total: 20 commits)

---

## 2. Resumo Executivo

A **Fase 5** marca o momento em que a aplicação **Emma's Librarian** deixou de ser um gerenciador e leitor de artigos convencional para se transformar em uma **Estação de Trabalho Acadêmica Local-First (*Local-First Academic Workspace*)**. Durante este ciclo de 20 commits (commits 72 a 91), o foco da engenharia esteve direcionado para a portabilidade soberana de dados de pesquisa, automação de tarefas bibliográficas e aprimoramento da ergonomia de leitura e escrita.

O grande marco da fase foi a introdução do formato proprietário de arquivo empacotado **`.emmapcarc`** (*Emma's Project Archive*). Por meio deste padrão comprimido, um pesquisador pode exportar e importar projetos completos contendo não apenas as linhas do banco de dados SQLite (artigos, buscas, investigações RAG, categorias customizadas, diários de bordo e anotações), mas também todos os arquivos PDFs físicos associados, permitindo a migração perfeita de pesquisas entre múltiplos computadores sem dependência de serviços em nuvem.

Outro pilar fundamental foi a criação do **Motor Naitvo de Citações Bibliográficas**, alimentado pela biblioteca `citation-js` e estilizado com regras ABNT locais (`assets/csl/abnt.csl` e `locales-pt-BR.xml`) e exportação BibTeX. Foi desenvolvida a interface de **Citação em Massa** (`MassCitationModal.tsx`), que permite formatar e copiar referências de artigos lidos em lote com prévia HTML e suporte a regramento dinâmico de *"et al."*.

Adicionalmente, o ambiente de leitura de PDF recebeu melhorias ergonômicas de destaque: o bloco de notas de escrita (*writing pad*) foi acoplado à sessão do leitor com salvamento automático em background, e foi adicionada a funcionalidade de cópia rápida de textos destacados através de menu suspenso de contexto no botão direito. No Dashboard global, foram introduzidos portais *Drag-and-Drop* para importação instantânea de arquivos, mapa de calor (*heatmap*) de produtividade do diário e gráficos de análise estatística bibliométrica (distribuição por ano, periódico, tipo de documento e acervo físico). Por fim, a comunicação IPC entre Electron Main e React Renderer foi blindada com tipagem estrita no TypeScript e introdução do script automatizado `npm run typecheck`.

---

## 3. Detalhamento Profundo

### 3.1 Decisões de Engenharia & Racional Arquitetural

#### 1. Portabilidade Soberana de Dados via Arquivos `.emmapcarc`
- **Contexto e Problema**: Pesquisadores acadêmicos frequentemente trocam de ambiente de trabalho (notebook pessoal, desktop do laboratório, computadores institucionais). Depender de sincronização em nuvem proprietária exigiria infraestrutura de servidores, autenticação remota e risco de privacidade sobre acervos científicos confidenciais.
- **Decisão Arquitetural**: Criação do serviço `SyncService.ts` no processo Main do Electron, responsável por gerar e ler arquivos com extensão `.emmapcarc`. O arquivo `.emmapcarc` é um contêiner ZIP codificado (`AdmZip`) estruturado da seguinte forma:
  - `project.json`: Dump JSON estruturado com o manifesto relacional completo do projeto (metadados do projeto, artigos, histórico de buscas traduzidas, categorias customizadas, seleções de opções, marcações, anotações, histórico do diário de bordo e resultados do motor de investigação massiva RAG).
  - Subpasta `pdfs/`: Cópia binária dos arquivos PDF físicos vinculados aos artigos do projeto.
  - Subpasta `docs/`: Documentos de apoio do projeto.
- **Tolerância a Falhas na Reimportação**: Na importação, uma transação SQL atômica no SQLite gera um novo ID de projeto, descompacta os PDFs no diretório local de dados do aplicativo (`app.getPath('userData')/storage/pdfs`) renomeando-os com UUIDs (`uuidv4()`) para evitar sobrescrita de arquivos existentes com nomes idênticos, e remapeia todas as chaves estrangeiras (`articleMap`, `categoryMap`, `optionMap`, `annotationMap`).

#### 2. Motor de Citações Descentralizado com CSL (Citation Style Language)
- **Contexto e Problema**: A construção manual de listas de referências acadêmicas é uma tarefa repetitiva e propensa a erros de formatação ABNT (letras maiúsculas no sobrenome, itálico no título, pontuação estrita).
- **Decisão Arquitetural**: Integração da biblioteca `@citation-js/core` e plugins CSL no frontend React (`citationService.ts`). Em vez de depender de APIs externas de citação, os arquivos de estilo CSL ABNT (`abnt.csl`) e localização em português (`locales-pt-BR.xml`) foram incorporados diretamente nos assets da aplicação.
- **Recursos Principais**:
  - Suporte a estilos ABNT, APA, Vancouver, Harvard e IEEE.
  - Alternância dinâmica da regra *"et al."*: caso desativada, a engine intercepta a CSL e substitui os atributos `et-al-min` e `et-al-use-first` dinamicamente para listar todos os coautores.
  - Exportação em 3 formatos: HTML formatado (pronto para colar em editores rich-text como MS Word/Google Docs com suporte a Clipboard API rich text), Texto Puro e sintaxe BibTeX estruturada (`@article{...}`).
  - Parser inteligente de nomes de autores (`parseAuthors`), capaz de tratar divergências de entrada (vírgula vs. ponto e vírgula, prenomes simples e compostos).

#### 3. Ambiente Integrado de Leitura e Escrita (*Writing Pad* & Context Menu)
- **Contexto e Problema**: Durante a revisão sistemática da literatura, o pesquisador precisava alternar entre o leitor de PDF e um editor de texto externo para sintetizar suas ideias.
- **Decisão Arquitetural**: 
  - Adição da coluna `writing_pad TEXT` na tabela `projects` do SQLite.
  - Criação do componente de rascunho de escrita acoplado à página de leitura (`ArticleReaderPage.tsx`), que persiste alterações em tempo real via debounce de 1 segundo (`saveTimeoutRef`), garantindo salvamento em background sem travar a digitação do usuário.
  - Implementação de tratamento de eventos `onContextMenu` nos destaques de PDF (`PdfHighlighter`), permitindo que ao clicar com o botão direito sobre um texto grifado, a string extraída seja automaticamente copiada para a área de transferência do sistema operacional com feedback visual via *Toast*.

#### 4. Interface Drag-and-Drop Global via React Portal
- **Contexto e Problema**: A importação de projetos `.emmapcarc` ou lotes de PDFs exigia navegar por diálogos de seleção de arquivos do sistema operacional.
- **Decisão Arquitetural**: Implementação de ouvintes globais de arrasto (`onDragOver`, `onDragLeave`, `onDrop`) nas páginas principais (`DashboardPage.tsx` e `Layout.tsx`). Quando um arquivo `.emmapcarc` é arrastado para a janela do aplicativo, um portal React (`createPortal`) renderiza uma camada visual semi-transparente em tela cheia (`zIndex: 99999`) com animação responsiva. Ao soltar o arquivo, o `SyncService.importProject` é invocado e redireciona automaticamente a navegação para o projeto recém-importado.

#### 5. Painel Bibliométrico e Estatísticas no Dashboard
- **Contexto e Problema**: O pesquisador necessitava de uma visão panorâmica da maturidade do seu acervo bibliográfico e da sua constância de trabalho.
- **Decisão Arquitetural**: Incorporação do Chart.js para renderizar visões estatísticas no Dashboard:
  - Gráficos de Rosca (*Pie Chart*) para contagem de status dos artigos (Ativos, Lidos, Arquivados) e acervo de PDFs físicos.
  - Gráficos de Barras para distribuição cronológica de publicações por Ano, Periódicos (*Journals*) e Tipos de Documento (*Article, Review, Conference*).
  - Calendário com Mapa de Calor (*Heatmap*) do Diário do Projeto, marcando os dias com registros de diário para incentivar a rotina de pesquisa.

#### 6. Blindagem de Tipos no Bridge IPC (`api.ts` & `npm run typecheck`)
- **Contexto e Problema**: Com a expansão dos canais IPC entre Main e Renderer, divergências silenciosas nos nomes das mensagens ou assinaturas de parâmetros causavam erros em tempo de execução que não eram capturados pelo bundler Vite.
- **Decisão Arquitetural**: Padronização estrita do enum `IpcChannel` e interfaces TypeScript em `src/services/api.ts`. Ajuste nas importações para evitar que enums do Electron causem falhas na compilação do Vite no navegador, e criação do script `npm run typecheck` (`tsc --noEmit`) no `package.json` para validação estática nos testes.

---

### 3.2 Diagrama de Arquitetura e Fluxo de Dados (Mermaid)

```mermaid
graph TD
    subgraph Frontend React Renderer Process
        UI_Dash[DashboardPage.tsx] -->|Drag & Drop .emmapcarc / PDFs| Portal[DragDropOverlay React Portal]
        UI_Reader[ArticleReaderPage.tsx] -->|Notas de Leitura| WP[WritingPad Auto-Save Debounce 1s]
        UI_Reader -->|Botão Direito no Destaque| CM[Context Menu: Copy Text to Clipboard]
        UI_Cite[MassCitationModal.tsx] -->|Seleção de Formato| CS[citationService.ts]
        CS -->|Carrega Assets CSL| CSL_Files[abnt.csl & locales-pt-BR.xml]
        CS -->|Biblioteca| CiteJS[@citation-js/core Engine]
        UI_Dash -->|Estatísticas Bibliométricas| Charts[Chart.js: Year, Status, Journal, Heatmap]
    end

    subgraph Typed IPC Communication Layer
        API_Bridge[src/services/api.ts] -->|IpcChannel Enum & Strongly Typed Handlers| Electron_IPC[Electron ipcRenderer / ipcMain]
    end

    subgraph Electron Main Process & Services
        Electron_IPC -->|PROJECT_EXPORT / IMPORT| SyncService[SyncService.ts]
        Electron_IPC -->|EXPORT_BIBLIOSHINY / CSV / XLSX| ExportService[ExportService.ts]
        Electron_IPC -->|SQL Queries| DB_Adapter[DatabaseAdapter.ts]
    end

    subgraph Persistence & File Storage
        SyncService -->|Zip Compression / Decompression| ZIP_File[Arquivo Portátil .emmapcarc]
        ZIP_File -->|Contém| JSON_Manifest[project.json]
        ZIP_File -->|Contém| PDF_Files[Subpastas pdfs/ e docs/]
        SyncService -->|Unzip PDFs com UUID| PDF_Storage[dev_data/storage/pdfs/]
        DB_Adapter -->|Transação Atômica SQL| SQLite_DB[(emma.db SQLite)]
    end

    Portal -->|Aciona Importação| API_Bridge
    WP -->|Atualiza writing_pad| API_Bridge
    CiteJS -->|Gera HTML / BibTeX / ABNT| UI_Cite
```

---

### 3.3 Evolução da Estrutura de Diretórios e Arquivos

A tabela a seguir apresenta os principais arquivos criados ou significativamente modificados durante a Fase 5:

| Caminho do Arquivo | Status | Responsabilidade Arquitetural Principal |
|---|---|---|
| `emmas_librarian/src/assets/csl/abnt.csl` | **Novo** | Definição XML do estilo de citação ABNT (Associação Brasileira de Normas Técnicas) para o `citation-js`. |
| `emmas_librarian/src/assets/csl/locales-pt-BR.xml` | **Novo** | Arquivo de localização em Português do Brasil para tradução de termos bibliográficos (*et al.*, vol., p., ed.). |
| `emmas_librarian/src/services/citationService.ts` | **Novo** | Serviço central de geração de citações, integração com `citation-js`, parser de autores e modificador dinâmico de regras CSL. |
| `emmas_librarian/src/components/modals/MassCitationModal.tsx` | **Novo** | Modal interativo de geração de citações em massa para artigos lidos, edição de metadados inline e cópia rich-text. |
| `emmas_librarian/src/components/modals/ProjectCategoriesModal.tsx` | **Novo** | Interface modal para gerenciamento e criação de categorias customizadas por projeto. |
| `emmas_librarian/src/components/modals/ChangelogModal.tsx` | **Novo** | Modal de registro de atualizações do aplicativo, rastreando versões e apresentando notas de lançamento ao usuário. |
| `emmas_librarian/electron/database/SyncService.ts` | **Atualizado** | Lógica completa de exportação/importação do formato portátil `.emmapcarc` usando `AdmZip` e transações do SQLite. |
| `emmas_librarian/electron/services/ExportService.ts` | **Atualizado** | Suporte expandido de exportação para formatos CSV, XLSX e layout Biblioshiny/Scopus (45 colunas). |
| `emmas_librarian/src/pages/ArticleReaderPage.tsx` | **Atualizado** | Integração do *Writing Pad* com salvamento automático, menu de contexto de cópia de texto e painel flutuante de categorias. |
| `emmas_librarian/src/pages/DashboardPage.tsx` | **Atualizado** | Incorporação de portal *Drag-and-Drop* para arquivos `.emmapcarc`, mapa de calor do diário e gráficos estatísticos avançados. |
| `emmas_librarian/src/services/api.ts` | **Atualizado** | Ponte IPC fortemente tipada entre o processo Renderer (React) e o Main process (Electron). |
| `emmas_librarian/package.json` | **Atualizado** | Adição das dependências `@citation-js/core`, `@citation-js/plugin-csl`, `@citation-js/plugin-bibtex` e script `npm run typecheck`. |

---

### 3.4 Trechos de Código Principais da Fase 5

#### A. Exportação e Importação de Projetos no Formato Portátil `.emmapcarc` (`electron/database/SyncService.ts`)

```typescript
// commit 8807a02
import AdmZip from 'adm-zip';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';

export class SyncService {
  // Exporta um projeto completo como um pacote comprimido .emmapcarc
  public async exportProject(projectId: number): Promise<string | null> {
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: 'Exportar Projeto',
      defaultPath: `projeto_${projectId}.emmapcarc`,
      filters: [{ name: "Emma's Librarian Project", extensions: ['emmapcarc'] }],
    });

    if (canceled || !filePath) return null;

    const db = this.dbAdapter.getDB();
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
    const articles = db.prepare('SELECT * FROM articles WHERE project_id = ?').all(projectId);
    const searchHistory = db.prepare('SELECT * FROM search_history WHERE project_id = ?').all(projectId);
    const projCategories = db.prepare('SELECT * FROM project_categories WHERE project_id = ?').all(projectId);
    const annotations = db.prepare(`
      SELECT a.* FROM annotations a JOIN articles art ON a.article_id = art.id WHERE art.project_id = ?
    `).all(projectId);
    const highlights = db.prepare(`
      SELECT h.* FROM highlights h JOIN articles art ON h.article_id = art.id WHERE art.project_id = ?
    `).all(projectId);
    const diaryEntries = db.prepare('SELECT * FROM project_diary WHERE project_id = ?').all(projectId);

    const exportData = { project, articles, searchHistory, projCategories, annotations, highlights, diaryEntries };
    const zip = new AdmZip();

    // Adiciona o manifesto relacional em formato JSON
    zip.addFile('project.json', Buffer.from(JSON.stringify(exportData, null, 2), 'utf-8'));

    // Adiciona todos os arquivos PDF físicos associados ao projeto
    for (const article of articles) {
      if (article.local_file_path && fs.existsSync(article.local_file_path)) {
        zip.addLocalFile(article.local_file_path, 'pdfs');
      }
    }

    zip.writeZip(filePath);
    return filePath;
  }

  // Importa um pacote .emmapcarc e reconstrói as entidades no SQLite dentro de uma transação
  public async importProject(providedPath?: string): Promise<number | null> {
    const zip = new AdmZip(providedPath);
    const jsonEntry = zip.getEntry('project.json');
    if (!jsonEntry) throw new Error('Arquivo de projeto inválido (.emmapcarc não contém project.json)');

    const data = JSON.parse(jsonEntry.getData().toString('utf8'));
    const db = this.dbAdapter.getDB();

    return db.transaction(() => {
      const projResult = db.prepare(
        'INSERT INTO projects (name, created_at, writing_pad) VALUES (?, ?, ?)'
      ).run(data.project.name + ' (Importado)', new Date().toISOString(), data.project.writing_pad || null);
      
      const pid = projResult.lastInsertRowid;
      const basePdfsDir = path.join(app.getPath('userData'), 'storage', 'pdfs');

      const articleMap = new Map<number, number>();
      for (const art of data.articles) {
        let newPdfPath = null;
        if (art.local_file_path) {
          const fileName = path.basename(art.local_file_path);
          const pdfEntry = zip.getEntry(`pdfs/${fileName}`);
          if (pdfEntry) {
            const destPath = path.join(basePdfsDir, `${uuidv4()}_${fileName}`);
            fs.writeFileSync(destPath, pdfEntry.getData());
            newPdfPath = destPath;
          }
        }

        const artRes = db.prepare(`
          INSERT INTO articles (project_id, doi, title, authors, year, local_file_path, status, ai_summary)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(pid, art.doi, art.title, art.authors, art.year, newPdfPath, art.status, art.ai_summary);
        
        articleMap.set(art.id, artRes.lastInsertRowid);
      }
      return pid;
    })();
  }
}
```

---

#### B. Motor de Citações ABNT e BibTeX com `citation-js` (`src/services/citationService.ts`)

```typescript
// commit 8929bcb
import Cite from 'citation-js';
import abntCsl from '../assets/csl/abnt.csl?raw';
import ptBrLocale from '../assets/csl/locales-pt-BR.xml?raw';

// Registra os templates CSL ABNT e o locale pt-BR diretamente na engine citation-js
const cslPlugin = (Cite.plugins.config.get as any)('@csl');
if (cslPlugin) {
  cslPlugin.templates?.add?.('abnt', abntCsl);
  cslPlugin.locales?.add?.('pt-BR', ptBrLocale);
}

export type CitationStyle = 'abnt' | 'apa' | 'vancouver' | 'harvard1' | 'ieee';
export type CitationOutputFormat = 'text' | 'html' | 'bibtex';

export function generateCitation(
  article: any,
  style: CitationStyle = 'abnt',
  format: CitationOutputFormat = 'text',
  useEtAl: boolean = true
): string {
  try {
    let finalStyle = style;
    // Modifica dinamicamente a regra CSL para desativar "et al." quando solicitado pelo usuário
    if (!useEtAl) {
      const targetStyleName = `${style}-no-etal`;
      const config = (Cite.plugins.config.get as any)('@csl');
      if (config && config.templates) {
        const baseXml = config.templates.get(style);
        if (baseXml) {
          const modifiedXml = baseXml
            .replace(/et-al-min="\d+"/g, 'et-al-min="99"')
            .replace(/et-al-use-first="\d+"/g, 'et-al-use-first="99"');
          config.templates.add(targetStyleName, modifiedXml);
          finalStyle = targetStyleName as any;
        }
      }
    }

    const data: any = {
      id: article.id,
      type: 'article-journal',
      title: article.title,
      author: parseAuthors(article.authors),
      issued: article.year ? { 'date-parts': [[article.year]] } : undefined,
      DOI: article.doi ? article.doi.trim() : undefined,
      'container-title': article.journal ? article.journal.trim() : undefined,
      volume: article.volume,
      issue: article.issue,
      page: article.pages
    };

    const cite = new Cite(data);

    if (format === 'bibtex') {
      return cite.format('bibtex');
    }

    return cite.format('bibliography', {
      format: format === 'html' ? 'html' : 'text',
      template: finalStyle,
      lang: style === 'abnt' ? 'pt-BR' : 'en-US',
    }).trim();
  } catch (error) {
    console.error('Erro ao gerar citação:', error);
    return `[Erro ao gerar citação: ${article?.title}]`;
  }
}
```

---

#### C. Cópia em Lote de Citações com Suporte a Rich-Text Clipboard (`src/components/modals/MassCitationModal.tsx`)

```typescript
// commit 8929bcb
const handleCopyAll = async () => {
  if (sortedArticles.length === 0) return;

  const citationTexts = sortedArticles.map((art) => generateCitation(art, style, format, useEtAl));

  if (format === 'html') {
    const mergedHtml = citationTexts.join('<br/><br/>');
    const plainText = citationTexts.map((txt) => txt.replace(/<[^>]+>/g, '')).join('\n\n');

    try {
      // Grava no Clipboard simultaneamente os formatos HTML (para Word/Docs) e Texto Puro
      const htmlBlob = new Blob([mergedHtml], { type: 'text/html' });
      const textBlob = new Blob([plainText], { type: 'text/plain' });
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': htmlBlob,
          'text/plain': textBlob,
        }),
      ]);
    } catch (err) {
      await navigator.clipboard.writeText(plainText);
    }
  } else {
    const mergedText = citationTexts.join('\n\n');
    await navigator.clipboard.writeText(mergedText);
  }

  setCopied(true);
  setTimeout(() => setCopied(false), 2000);
};
```

---

#### D. Bloco de Escrita (*Writing Pad*) com Salvamento Automático Debounced (`src/pages/ArticleReaderPage.tsx`)

```typescript
// commit 0cfd45e
const [writingPadContent, setWritingPadContent] = useState('');
const [isSavingPad, setIsSavingPad] = useState(false);
const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

const handlePadChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
  const val = e.target.value;
  setWritingPadContent(val);

  // Cancela o timeout anterior caso o usuário continue digitando
  if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

  setIsSavingPad(true);
  // Persiste no SQLite com debounce de 1000ms para evitar i/o excessivo no banco
  saveTimeoutRef.current = setTimeout(async () => {
    if (article?.project_id) {
      try {
        await projectService.updateProjectWritingPad(article.project_id, val);
      } catch (error) {
        console.error('Erro ao salvar rascunho:', error);
      }
    }
    setIsSavingPad(false);
  }, 1000);
};
```

---

#### E. Overlay Global Drag and Drop via React Portal (`src/pages/DashboardPage.tsx`)

```tsx
// commit 90f163d
const handleDrop = async (e: React.DragEvent) => {
  e.preventDefault();
  e.stopPropagation();
  setIsDragging(false);

  const files = Array.from(e.dataTransfer.files).filter((f) => f.name.endsWith('.emmapcarc'));
  if (files.length === 0) return;

  for (const file of files) {
    try {
      const pathToImport = (file as any).path || file.name;
      const newId = await projectService.importProject(pathToImport);
      if (newId) {
        window.location.href = `#/projects/${newId}`;
        break;
      }
    } catch (err: any) {
      alert(`Erro ao importar ${file.name}: ` + (err.message || err));
    }
  }
};

{isDragging && createPortal(
  <div style={{
    position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.75)',
    backdropFilter: 'blur(4px)', zIndex: 99999, display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', color: '#ffffff',
    border: '3px dashed var(--color-primary)', pointerEvents: 'none'
  }}>
    <Download size={64} color="var(--color-primary)" className="bounce-subtle" />
    <h2 style={{ marginTop: '1.5rem', fontSize: '1.8rem', fontWeight: 700 }}>
      Solte o arquivo do projeto (.emmapcarc) aqui
    </h2>
    <p style={{ color: 'var(--text-muted)', fontSize: '1rem', marginTop: '0.5rem' }}>
      O projeto será importado automaticamente para a sua biblioteca.
    </p>
  </div>,
  document.body
)}
```

---

### 3.5 Tabela Mapeada de Commits da Fase 5 (Commits 72 a 91)

| Índice | Hash | Autor | Data (UTC-3) | Mensagem do Commit | Mudança & Escopo Principal |
|---|---|---|---|---|---|
| 72 | `0cfd45e` | João Pedro V | 2026-05-30 02:13:44 | `feat: add global diary heatmap and pie chart pdf count to dashboard, remove csv export, conditional article buttons` | Adiciona mapa de calor do diário e gráfico de rosca de acervo físico no Dashboard, remove exportação CSV e ajusta botões condicionais de artigo. |
| 73 | `8929bcb` | João Pedro V | 2026-05-30 02:15:03 | `feat: add advanced citation modal with html preview and bibtex format` | Adiciona modal avançado de citação em massa com pré-visualização HTML, formato BibTeX e toggle de regra "et al.". |
| 74 | `cb15300` | João Pedro V | 2026-05-30 02:23:36 | `feat: complete categories and sorting logic adjustments` | Conclui os ajustes na ordenação cruzada e nos filtros de categorias customizadas do projeto. |
| 75 | `9b5889b` | João Pedro V | 2026-05-30 02:25:01 | `feat: add advanced statistics charts to dashboard overview` | Incorpora painéis de gráficos estatísticos bibliométricos na visão geral do Dashboard. |
| 76 | `5364bef` | João Pedro V | 2026-05-30 02:26:08 | `feat: complete advanced statistics charts for metadata` | Conclui a implementação dos gráficos estatísticos para distribuição de metadados (ano, periódico, tipo de documento). |
| 77 | `b55fa51` | João Pedro V | 2026-05-30 13:47:48 | `refactor(ui): apply UX cleanups for project details and article reader` | Refatora e aplica melhorias de UX nos detalhes do projeto e no leitor de artigos PDF. |
| 78 | `fe98b0e` | João Pedro V | 2026-05-30 15:00:07 | `feat(ui): restore active/read/archived status chart in dashboard` | Restaura o gráfico de rosca de distribuição de status (Ativos, Lidos, Arquivados) no Dashboard. |
| 79 | `2a5ccdf` | João Pedro V | 2026-05-30 15:03:52 | `style(ui): adjust dashboard grid to 12-columns and remove background from charts` | Ajusta o grid do Dashboard para layout de 12 colunas e remove fundo dos cartões de gráficos. |
| 80 | `5b56128` | João Pedro V | 2026-05-30 15:05:43 | `style(ui): reorder calendar header to put month selector on a new line` | Reorganiza o cabeçalho do calendário posicionando o seletor de mês em uma nova linha. |
| 81 | `e37f10f` | João Pedro V | 2026-05-30 15:07:37 | `style(ui): revert dashboard grid to 1/3 for each column` | Reverte o layout do grid do Dashboard para 3 colunas de largura idêntica (1/3 cada). |
| 82 | `87d5707` | João Pedro V | 2026-05-30 15:11:36 | `feat(ui): highlight current day with primary border color` | Destaca o dia atual no componente de calendário com borda na cor primária. |
| 83 | `0709043` | João Pedro V | 2026-05-30 15:16:57 | `refactor(ui): remove physical files chart and move remaining charts above projects title` | Remove o gráfico de arquivos físicos e reposiciona os gráficos restantes acima do título de projetos. |
| 84 | `f9333b3` | João Pedro V | 2026-05-30 15:18:25 | `style(ui): resize dashboard elements to make chart larger and calendar smaller` | Redimensiona elementos do Dashboard para expandir o gráfico e compactar o calendário. |
| 85 | `c371569` | João Pedro V | 2026-05-30 15:20:55 | `feat(ui): restore physical files chart and move charts section below projects list` | Restaura o gráfico de arquivos físicos e posiciona a seção de gráficos abaixo da lista de projetos. |
| 86 | `8807a02` | João Pedro V | 2026-05-30 15:26:05 | `fix(sync): resolve undefined storageDir error when importing project` | Corrige o erro de `storageDir` indefinido durante a importação de projetos no `SyncService`. |
| 87 | `6c7a704` | João Pedro V | 2026-05-30 15:33:17 | `fix(ui): use article id instead of created_at for added-asc and added-desc sorting` | Altera o critério de ordenação por data de adição para utilizar o ID do artigo em vez de `created_at`. |
| 88 | `d733199` | João Pedro V | 2026-05-30 15:42:32 | `style(ui): add input-field class to style project categories modal` | Adiciona a classe `input-field` para estilizar adequadamente os inputs no modal de categorias. |
| 89 | `90f163d` | João Pedro V | 2026-05-30 15:49:22 | `fix(ui): use React portal for drag and drop overlays to ensure full screen coverage` | Utiliza React Portal para renderizar overlays de Drag-and-Drop em tela cheia sem restrições de container. |
| 90 | `3067999` | João Pedro V | 2026-05-30 15:55:38 | `style(ui): update categorize button in pdf reader to be a pill with text and solid background` | Estiliza o botão de categorização no leitor de PDF em formato pill com fundo sólido e texto. |
| 91 | `8e72c9e` | João Pedro V | 2026-05-30 16:05:16 | `feat(ui): implement categories tab with matrix view and export buttons` | Implementa a aba de categorias com visualização em matriz e botões de exportação. |


---
