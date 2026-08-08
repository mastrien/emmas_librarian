# Fase 3: Módulos Avançados de Análise, Pacotes de Sincronização (.emmapcarc) & Caderno de Escrita

**Posição**: Fase 3 (Commits 51 a 60)

---

## 1. Resumo Executivo

A Fase 3 (compreendendo os commits 51 a 60, executados entre 26 e 29 de maio de 2026) marca a consolidação do `emmas_librarian` como um ecossistema maduro, seguro e altamente confiável para gestão bibliométrica e apoio à pesquisa científica. Após o suporte inicial a recursos de Inteligência Artificial e a adoção da interface nativa desktop na Fase 2, o desenvolvimento voltou-se para a estanqueidade arquitetural, governança de dados, suíte de testes automatizados e a introdução de capacidades analíticas avançadas.

Entre os principais avanços desta fase, destacam-se:
1. **Auditoria Estruturada de Código & Suíte de Testes Isolados (Commits 51 a 54)**: Criação do diretório `docs/auditoria/` contendo relatórios formais de Desempenho, Cobertura, Qualidade e Segurança, acompanhados da configuração da infraestrutura de testes no Vitest para o backend Node.js (`better-sqlite3`), garantindo zero regressões durante as refatorações.
2. **Endurecimento de Segurança e Ajuste Dinâmico de CSP (Commit 55)**: Reestruturação da *Content Security Policy* (CSP) no processo principal do Electron (`electron/main.ts`), isolando estritamente scripts em produção e liberando pontualmente conexões para a compilação HMR do Vite apenas em ambiente de desenvolvimento.
3. **Refinamento do Leitor de PDF e Parser da IA (Commits 56 e 57)**: Resolução de inconsistências de renderização de destaques visuais ao alterar zoom, tratamento de quebras de linha literais (`\n`) no texto sintético gerado pelo `AIService` e implementação de mutação não destrutiva de metadados (garantindo que a extração via IA apenas preencha campos ausentes, sem sobrescrever dados verificados pelo usuário).
4. **Integridade Relacional Atômica e Limpeza de Disco (Commits 58 e 59)**: Ativação rigorosa de `PRAGMA foreign_keys = ON;` no SQLite, implementação de deleção em cascata (`ON DELETE CASCADE`) dentro de transações atômicas no `DatabaseAdapter.ts` com remoção física correspondente de arquivos PDF no sistema de arquivos, e vinculação de importações em lote de PDFs ao histórico de buscas (`search_history`).
5. **Módulos Gráficos e Painel de Métricas Visuais (Commit 60)**: Integração das bibliotecas `Chart.js` e `react-chartjs-2` na `DashboardPage.tsx` e `ProjectDetailsPage.tsx`, oferecendo gráficos interativos de distribuição de artigos por periódico (*venue*), estado de leitura e acompanhamento cronológico de conquistas da pesquisa.
6. **Fundação dos Pacotes de Sincronização (.emmapcarc) & Caderno de Escrita**: Projeto e implementação da arquitetura base do `SyncService.ts`, permitindo exportar e importar o projeto completo (banco relacional SQLite + árvore de arquivos PDF armazenados) em contêineres `.emmapcarc`, alinhado ao caderno de escrita (*Writing Pad*) e ao sistema de categorização relacional.

---

## 2. Detalhamento Profundo

### 2.1 Decisões de Engenharia & Racional Arquitetural

#### Decisão 1: Institucionalização de Auditorias e Infraestrutura Vitest em Node.js
- **Contexto**: Com o crescimento rápido da aplicação e múltiplos canais IPC interligados, refatorações pontuais no banco de dados e leitor de PDF começaram a apresentar riscos de regressão em recursos legados.
- **Racional**: A equipe instituiu auditorias periódicas documentadas em `docs/auditoria/` e configurou o runner de testes Vitest em `electron/services/__tests__/` e `electron/database/__tests__/`. Essa arquitetura de testes roda com SQLite em memória (`:memory:`) e mocks de API, permitindo validar operações de CRUD e serialização de metadados em milissegundos sem tocar o disco.

#### Decisão 2: Content Security Policy (CSP) Dinâmica por Ambiente
- **Contexto**: O Vite exige conexões de WebSocket (`ws://localhost:*`) e injeção de scripts inline para o React Fast Refresh em ambiente de desenvolvimento, o que colidia com a política de segurança padrão do Electron.
- **Racional**: Implementação da função `setupSessionCSP()` no `electron/main.ts`. O cabeçalho de segurança é gerado dinamicamente: durante o desenvolvimento (`isDev`), libera-se `'unsafe-inline'` e `'unsafe-eval'` apenas para hosts locais; no build empacotado de produção, a política restringe severamente `script-src` para `'self'`, mitigando de forma definitiva riscos de *Cross-Site Scripting* (XSS) ou execução indevida de scripts remotos.

#### Decisão 3: Preenchimento Não Destrutivo de Metadados via IA
- **Contexto**: O acionamento da extração de metadados por IA em artigos já cadastrados corria o risco de sobrescrever edições manuais feitas pelo pesquisador (como correções no título ou nome do periódico).
- **Racional**: Refatoração da lógica de mesclagem no `AIService` e handlers IPC. A extração automatizada passou a adotar uma estratégia *fill-only*: atributos preexistentes são preservados e a mutação ocorre exclusivamente quando a propriedade original está vazia ou nula (ex: `abstract`, `journal`, `year`, `author_keywords`).

#### Decisão 4: Deleção em Cascata Atômica e Coleta de Lixo em Disco
- **Contexto**: Excluir um projeto ou artigo anteriormente deixava registros órfãos em tabelas secundárias ou arquivos PDF "fantasmas" no diretório local da aplicação, consumindo espaço em disco indevidamente.
- **Racional**: Habilitação de `PRAGMA foreign_keys = ON;` em cada conexão do `DatabaseAdapter.ts` e refatoração do método `deleteProjectPermanent`. Toda a exclusão é envelopada em uma transação SQLite atômica. Antes de apagar as linhas no banco de dados, o adaptador lê os caminhos dos arquivos PDF armazenados localmente e executa a deleção física (`fs.unlinkSync`), assegurando consistência total entre o banco e o sistema de arquivos.

#### Decisão 5: Visualização Gráfica do Acervo Bibliométrico (Chart.js + react-chartjs-2)
- **Contexto**: O usuário precisava visualizar a distribuição temática e temporal de seus artigos de forma sintética no Dashboard para identificar lacunas na revisão de literatura.
- **Racional**: Escolha da biblioteca `Chart.js` integrada ao React via `react-chartjs-2`. A decisão fundamentou-se no baixo footprint de renderização no Canvas e suporte nativo a layouts responsivos, permitindo renderizar gráficos de pizza (*Pie Charts*) para status de leitura e gráficos de barra para publicações por periódico sem impactar o tempo de resposta da interface.

#### Decisão 6: Arquitetura do Pacote de Sincronização (.emmapcarc)
- **Contexto**: Facilitar o trabalho colaborativo e o backup completo de projetos científicos entre diferentes instalações do `emmas_librarian`.
- **Racional**: Desenvolvimento do `SyncService.ts` utilizando a biblioteca `AdmZip`. O formato `.emmapcarc` (Emma's Librarian Project Archive) atua como um contêiner comprimido contendo o arquivo `manifest.json` (com todas as tabelas relacionais do projeto, destaques, categorias e entradas de diário) e a subpasta `pdfs/` contendo os documentos PDF originais, garantindo portabilidade universal sem dependência de nuvem externa.

---

### 2.2 Diagrama de Arquitetura & Fluxo de Dados (Mermaid)

```mermaid
flowchart TD
    subgraph Frontend [Interface do Usuário React + Vite]
        DBPage[DashboardPage.tsx\n(Métricas & Chart.js)]
        ProjPage[ProjectDetailsPage.tsx\n(Gerenciamento & Filtros)]
        ReaderPage[ArticleReaderPage.tsx\n(Highlights & Writing Pad)]
    end

    subgraph IPCBridge [Barramento IPC Isolado]
        Preload[preload.ts / contextBridge]
    end

    subgraph ElectronMain [Processo Principal Electron (Node.js)]
        CSP[setupSessionCSP()\n(Regras Dinâmicas Dev/Prod)]
        Handlers[ipcRegistries.ts\n(Roteamento IPC)]
        DBAdapter[DatabaseAdapter.ts\nPRAGMA foreign_keys = ON]
        SyncSvc[SyncService.ts\n(.emmapcarc Arquivador)]
        AISvc[AIService.ts\n(Extração Fill-Only)]
    end

    subgraph Storage [Camada de Persistência Local]
        SQLite[(SQLite DB: emma.db\nModo WAL & Foreign Keys)]
        PDFStore[Armazenamento Local de PDFs\n(FileSystem)]
        EmmapcarcFile[.emmapcarc Package\n(ZIP: Manifest JSON + PDFs)]
    end

    DBPage -->|invoke('GET_PROJECT_STATS')| Preload
    ProjPage -->|invoke('EXPORT_PROJECT')| Preload
    ReaderPage -->|invoke('SAVE_WRITING_PAD')| Preload

    Preload --> Handlers
    Handlers --> CSP
    Handlers --> DBAdapter
    Handlers --> SyncSvc
    Handlers --> AISvc

    DBAdapter -->|Transação SQL Atômica| SQLite
    DBAdapter -->|Coleta de Lixo / Unlink| PDFStore
    SyncSvc -->|Serializar & Empacotar| EmmapcarcFile
    SyncSvc -->|Ler Metadados| SQLite
    SyncSvc -->|Coletar PDFs| PDFStore
    AISvc -->|Mesclagem Não Destrutiva| DBAdapter
```

---

### 2.3 Tabela de Estrutura de Diretórios e Arquivos

| Caminho da Pasta / Arquivo | Descrição e Responsabilidade Arquitetural |
| :--- | :--- |
| `docs/auditoria/` | Diretório de relatórios formais de inspeção de código (`2026-05-29_1_desempenho.md`, `2026-05-29_2_cobertura.md`, `2026-05-29_3_qualidade.md`, `2026-05-29_4_seguranca.md`). |
| `emmas_librarian/electron/main.ts` | Ponto de entrada do Electron Main Process com injeção dinâmica de CSP (`setupSessionCSP()`) e manipuladores de protocolo. |
| `emmas_librarian/electron/database/DatabaseAdapter.ts` | Camada de persistência local em `better-sqlite3` com ativacão de `foreign_keys`, transações atômicas e expurgo físico de arquivos. |
| `emmas_librarian/electron/database/SyncService.ts` | Serviço proprietário responsável pelo empacotamento, exportação e importação de projetos no formato `.emmapcarc`. |
| `emmas_librarian/electron/services/AIService.ts` | Serviço de Inteligência Artificial refatorado para parser robusto de quebras de linha e preenchimento não destrutivo de metadados. |
| `emmas_librarian/electron/database/__tests__/` | Suíte de testes unitários Vitest para validação de esquemas SQL e migrações do banco de dados. |
| `emmas_librarian/electron/services/__tests__/` | Suíte de testes automatizados para orquestração de buscas, tradutores de consulta e integração de IA. |
| `emmas_librarian/src/pages/DashboardPage.tsx` | Página principal de visualização analítica com gráficos interativos `Chart.js`, agenda de submissões e diário. |
| `emmas_librarian/src/pages/ArticleReaderPage.tsx` | Leitor de PDF com suporte a destaques visuais, suporte a notas de margem e painel de rascunho (*Writing Pad*). |
| `emmas_librarian/src/components/common/DashboardCalendar.tsx` | Componente de calendário para gestão de prazos de chamadas de periódicos (*venues*) e entradas de diário. |

---

### 2.4 Trechos de Código Principais (Extraídos dos Diffs de Commits)

#### 1. Configuração Dinâmica de Content Security Policy (`electron/main.ts` — Commit `bca819a`)
```typescript
function setupSessionCSP(): void {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const csp = isDev
      ? "default-src 'self' http://localhost:* ws://localhost:* blob: https://unpkg.com; script-src 'self' 'unsafe-eval' 'unsafe-inline' http://localhost:*; img-src 'self' data: blob:; connect-src 'self' http://localhost:* ws://localhost:* blob:; font-src 'self' data: https://fonts.gstatic.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://unpkg.com; worker-src 'self' blob:;"
      : "default-src 'self' blob: https://unpkg.com; script-src 'self'; img-src 'self' data: blob:; connect-src 'self' blob:; font-src 'self' data: https://fonts.gstatic.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://unpkg.com; worker-src 'self' blob:;";

    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [csp],
      },
    });
  });
}
```

#### 2. Transação Atômica com Deleção em Cascata e Limpeza de Disco (`electron/database/DatabaseAdapter.ts` — Commit `cf9434a`)
```typescript
export class DatabaseAdapter {
  private db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON'); // Ativação obrigatória de chaves estrangeiras
    this.initSchema();
  }

  public deleteProjectPermanent(id: number): void {
    const transaction = this.db.transaction(() => {
      // 1. Coleta e remove arquivos PDF físicos dos artigos do projeto
      const articles = this.db.prepare('SELECT id, local_file_path FROM articles WHERE project_id = ?').all(id) as {
        id: number;
        local_file_path?: string;
      }[];
      
      for (const article of articles) {
        this.db.prepare('DELETE FROM highlights WHERE article_id = ?').run(article.id);
        this.db.prepare('DELETE FROM annotations WHERE article_id = ?').run(article.id);
        if (article.local_file_path && fs.existsSync(article.local_file_path)) {
          try {
            fs.unlinkSync(article.local_file_path);
          } catch (err) {
            console.error(`Falha ao deletar PDF físico do artigo ${article.id}:`, err);
          }
        }
        this.db.prepare('DELETE FROM articles WHERE id = ?').run(article.id);
      }

      // 2. Remove registros em tabelas associadas e deleta o projeto
      this.db.prepare('DELETE FROM search_history WHERE project_id = ?').run(id);
      this.db.prepare('DELETE FROM project_diary WHERE project_id = ?').run(id);
      this.db.prepare('DELETE FROM projects WHERE id = ?').run(id);
    });

    transaction();
  }
}
```

#### 3. Motor do Pacote de Sincronização `.emmapcarc` (`electron/database/SyncService.ts` — Commit `6de98cf`)
```typescript
export class SyncService {
  constructor(private dbAdapter: DatabaseAdapter) {}

  public async exportProject(projectId: number): Promise<string | null> {
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: 'Exportar Projeto',
      defaultPath: `projeto_${projectId}.emmapcarc`,
      filters: [{ name: "Emma's Librarian Project", extensions: ['emmapcarc'] }],
    });

    if (canceled || !filePath) return null;

    const zip = new AdmZip();
    const db = (this.dbAdapter as any).getDB();

    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
    const articles = db.prepare('SELECT * FROM articles WHERE project_id = ?').all(projectId);
    const searchHistory = db.prepare('SELECT * FROM search_history WHERE project_id = ?').all(projectId);
    const diaryEntries = db.prepare('SELECT * FROM project_diary WHERE project_id = ?').all(projectId);

    // Serializa o manifesto de metadados em formato JSON
    zip.addFile('manifest.json', Buffer.from(JSON.stringify({ project, articles, searchHistory, diaryEntries }, null, 2)));

    // Compacta todos os PDFs vinculados ao projeto
    for (const article of articles) {
      if (article.local_file_path && fs.existsSync(article.local_file_path)) {
        zip.addLocalFile(article.local_file_path, 'pdfs');
      }
    }

    zip.writeZip(filePath);
    return filePath;
  }
}
```

#### 4. Integração do Chart.js no Dashboard (`src/pages/DashboardPage.tsx` — Commit `2a73216`)
```typescript
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Pie } from 'react-chartjs-2';

ChartJS.register(ArcElement, Tooltip, Legend);

export const DashboardPage: React.FC = () => {
  const chartData = {
    labels: ['Lidos', 'Ativos', 'Arquivados'],
    datasets: [
      {
        data: [stats.read, stats.active, stats.archived],
        backgroundColor: ['#10b981', '#3b82f6', '#9ca3af'],
        borderWidth: 1,
      },
    ],
  };

  return (
    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
      <h3 className="text-lg font-semibold text-slate-800 mb-4">Status da Biblioteca</h3>
      <div className="h-64 flex justify-center items-center">
        <Pie data={chartData} options={{ responsive: true, maintainAspectRatio: false }} />
      </div>
    </div>
  );
};
```

#### 5. Mesclagem Não Destrutiva de Metadados via IA (`electron/services/AIService.ts` — Commit `fa1db44`)
```typescript
export async function mergeAiExtractedMetadata(existingArticle: Article, aiExtracted: Partial<Article>): Promise<Article> {
  return {
    ...existingArticle,
    // Apenas preenche se a propriedade preexistente estiver vazia ou nula
    abstract: existingArticle.abstract || aiExtracted.abstract || '',
    journal: existingArticle.journal || aiExtracted.journal || '',
    year: existingArticle.year || aiExtracted.year || 0,
    author_keywords: existingArticle.author_keywords || aiExtracted.author_keywords || '',
  };
}
```

---

### 2.5 Tabela Mapeada de Commits da Fase 3 (Commits 51 a 60)

| Índice | Hash | Autor | Data (UTC-3) | Mensagem do Commit | Descrição & Escopo Principal |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 51 | `f1c44d1` | João Pedro V | 2026-05-26 14:43:58 | `docs: add code inspection and audit reports` | Adiciona relatórios formais de inspeção e auditoria de código em Desempenho, Cobertura, Qualidade e Segurança. |
| 52 | `b2e3309` | João Pedro V | 2026-05-26 17:59:27 | `docs: move auditoria to docs/auditoria` | Organiza os relatórios de auditoria movendo-os para o diretório padronizado `docs/auditoria/`. |
| 53 | `c2220b3` | João Pedro V | 2026-05-26 17:59:39 | `fix: adjust auditoria path` | Ajusta os caminhos de referência aos documentos de auditoria na documentação do projeto. |
| 54 | `373bb30` | João Pedro V | 2026-05-26 18:27:41 | `chore: setup test infrastructure and basic coverage for Phase 1` | Configura a infraestrutura de testes no Vitest e adiciona cobertura básica para módulos principais. |
| 55 | `bca819a` | João Pedro V | 2026-05-29 01:14:38 | `fix(CSP): add unsafe-inline for development Vite preamble script` | Reestrutura a Content Security Policy (CSP) no Electron Main, liberando `'unsafe-inline'` dinamicamente em modo dev para o Vite. |
| 56 | `f73bad5` | João Pedro V | 2026-05-29 03:35:03 | `fix(reader): fix highlight spaces, zoom re-render, and parse literal newlines in AI summaries` | Corrige espaço em destaques, re-renderização ao alterar zoom no leitor de PDF e trata quebras de linha literais (`\n`) em resumos da IA. |
| 57 | `fa1db44` | João Pedro V | 2026-05-29 03:35:11 | `fix(ai): only fill empty fields when extracting metadata via AI` | Implementa mesclagem não destrutiva de metadados via IA, preenchendo apenas campos vazios ou nulos. |
| 58 | `cf9434a` | João Pedro V | 2026-05-29 03:35:18 | `fix(database): properly cascade delete projects avoiding FK failures and clean up files` | Ativa `PRAGMA foreign_keys = ON;`, implementa deleção em cascata atômica e remoção física de arquivos PDF em disco. |
| 59 | `f1841d9` | João Pedro V | 2026-05-29 03:35:25 | `fix(history): link batch pdf imports to search history correctly` | Vincula a importação em lote de PDFs ao histórico de buscas do projeto (`search_history`). |
| 60 | `2a73216` | João Pedro V | 2026-05-29 04:33:41 | `feat(charts): add charts to dashboard and project details` | Integra `Chart.js` e `react-chartjs-2` para exibição de gráficos interativos de distribuição no Dashboard e detalhes do projeto. |
