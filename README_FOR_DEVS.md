# Emma's Librarian 📚 — Guia para Desenvolvedores

**Emma's Librarian** é uma aplicação desktop para pesquisadores e acadêmicos que automatiza buscas bibliográficas estruturadas em múltiplas bases científicas e centraliza o restante do fluxo de uma revisão sistemática: gestão de projetos, desduplicação, leitura ativa de PDFs, categorização, extração de dados com IA, citações e exportação compatível com o **Biblioshiny** (Bibliometrix, no RStudio).

Tudo é executado localmente (Electron + SQLite), preservando a privacidade dos dados, das chaves de API e da biblioteca de pesquisa do usuário.

> Versão atual: veja o campo `version` em [`emmas_librarian/package.json`](emmas_librarian/package.json). O histórico de versões está nos *patch notes* do [README.md](README.md) e no `ChangelogModal.tsx` (exibido ao usuário após cada atualização).

---

## 💡 Ideia Principal e Filosofia

Revisões sistemáticas e de escopo esbarram em processos manuais exaustivos: formatar queries para dezenas de mecanismos de busca, baixar metadados fragmentados, lidar com duplicatas e gerenciar PDFs e anotações de forma desconexa.

A filosofia do projeto se apoia em três pilares:
1. **Transparência e Rastreabilidade:** o pesquisador controla suas buscas. A query visual é traduzida para a sintaxe nativa de cada base (OpenAlex, Crossref, Scopus, Web of Science) e cada execução fica registrada no histórico, com a query exata, a ordenação, o limite e a contagem por base.
2. **Privacidade (Local-First):** projetos, termos, anotações e PDFs nunca saem do computador. O armazenamento é um SQLite embutido. A única saída de dados é para os provedores de IA que o próprio usuário configurar, e existe um motor local de embeddings (ONNX) que dispensa qualquer serviço externo.
3. **Ergonomia Visual:** interface com design system próprio, tema claro/escuro, *skeletons* de carregamento e cores sólidas para reduzir a fadiga durante longas sessões de leitura.

---

## 🧱 Stack

| Camada | Tecnologia |
|---|---|
| Shell desktop | Electron 41 (processo principal em TypeScript) |
| Interface | React 19 + TypeScript + Vite + `react-router-dom` (`HashRouter`) |
| Banco de dados | SQLite via `better-sqlite3` (modo WAL) |
| Leitor de PDF | `pdfjs-dist` + `react-pdf-highlighter` |
| Citações | `citation-js` com estilo ABNT (CSL em `src/assets/csl/`) e BibTeX |
| Gráficos | `chart.js` + `react-chartjs-2` |
| Embeddings locais | `@xenova/transformers` (ONNX/WASM, modelo `all-MiniLM-L6-v2`) |
| Empacotamento e updates | `electron-builder` + `electron-updater` |
| Testes | Vitest, Testing Library, Playwright, k6, Stryker |

---

## 🗂️ Estrutura de Diretórios

O código da aplicação fica em `emmas_librarian/` (subpasta do repositório). O que segue é um mapa dos diretórios relevantes, não uma lista exaustiva de arquivos.

```
/                                   # Raiz do repositório
├── emmas_librarian/                # Aplicação Electron + React
│   ├── electron/                   # Processo principal (Node/Electron)
│   │   ├── main.ts                 # Janela, CSP, protocolo emma-pdf://, auto-update, ciclo de vida
│   │   ├── preload.ts              # Ponte segura (contextBridge) entre renderer e main
│   │   ├── database/               # Persistência
│   │   │   ├── schema.sql          # Schema completo do SQLite
│   │   │   ├── DatabaseAdapter.ts  # Conexão, migrações e fachada sobre os repositórios
│   │   │   ├── *Repository.ts      # Um repositório por agregado (Article, Project, Annotation,
│   │   │   │                       #   Document, History, QuestionSet, InvestigationResult,
│   │   │   │                       #   MassiveInvestigation, AIModelConfig, ScientificVenue,
│   │   │   │                       #   Settings, Trash)
│   │   │   ├── BackupService.ts    # Exportação/restauração de backups (.emmabak)
│   │   │   ├── SyncService.ts      # Serialização de projetos (.emmapcarc)
│   │   │   ├── ProjectSyncService.ts
│   │   │   └── __tests__/
│   │   ├── services/               # Regras de negócio
│   │   │   ├── ApiIntegrator.ts    # OpenAlex, Crossref, Scopus e Web of Science
│   │   │   ├── QueryTranslator.ts  # Query visual → sintaxe nativa de cada base
│   │   │   ├── SearchOrchestrator.ts # Busca multi-base, desduplicação e persistência
│   │   │   ├── AIService.ts        # Resumo, metadados e extração (habilidades de IA)
│   │   │   ├── EmbeddingService.ts # Embeddings (ONNX local, Ollama, OpenAI, Gemini…)
│   │   │   ├── VectorStore.ts      # Busca por similaridade sobre chunks de PDF (RAG)
│   │   │   ├── PdfExtractor.ts     # Extração de texto e chunking de PDFs
│   │   │   ├── ExportService.ts    # CSV Scopus/Biblioshiny e exportações do projeto
│   │   │   ├── BackupService.ts    # Backups automáticos com rotação GFS
│   │   │   └── llm/                # Gateways de LLM
│   │   │       ├── LLMProviderGateway.ts   # Interface comum
│   │   │       └── OpenAI/Anthropic/Gemini/Ollama/OllamaCloud Gateway + jsonRepair.ts
│   │   ├── ipc/                    # Registro dos canais IPC
│   │   │   ├── ipcRegistries.ts    # Canais de projetos, artigos, backup, agenda etc.
│   │   │   ├── aiIpcHandlers.ts    # Canais de IA
│   │   │   └── errorHandler.ts     # Padronização de erros (AppError)
│   │   └── utils/logger.ts
│   ├── src/                        # Renderer (React)
│   │   ├── main.tsx                # Rotas e providers
│   │   ├── pages/                  # Dashboard, NewProject, ProjectDetails, Search,
│   │   │                           #   ArticleReader, PdfLibrary, Agenda, Settings, TermsOfUse
│   │   │                           #   (as páginas maiores têm subpastas components/ e hooks/)
│   │   ├── components/             # common/, modals/, reader/, ai/
│   │   ├── contexts/               # Serviços injetados e contexto global de erros
│   │   ├── hooks/, utils/, types/
│   │   ├── services/               # api.ts, citationService.ts e interface de serviços
│   │   └── assets/csl/             # Estilo ABNT e locale pt-BR
│   ├── e2e-tests/                  # Playwright (Electron real)
│   ├── performance-tests/          # k6 + harness HTTP
│   ├── build/                      # Ícones e recursos do instalador
│   └── public/                     # Estáticos (worker do PDF.js, PrismJS)
├── landing_page/                   # Site estático (GitHub Pages)
├── docs/                           # Auditorias, planos, relatórios e visões arquiteturais
├── plans/                          # Roteiros de implementação e decisões de arquitetura
├── agent/, .gemini/, .agents/      # Skills e artefatos de agentes de IA
├── .github/workflows/              # release.yml e deploy-pages.yml
├── development_diary.md            # Diário de desenvolvimento gerado a partir do git
└── AGENTS.md                       # Convenções de código do projeto
```

Para diagramas de camadas, modelo ER, sequências e mapa de canais IPC, consulte [`docs/visoes_arquiteturais/`](docs/visoes_arquiteturais/). Esses documentos foram escritos em junho/2026 e podem não refletir módulos posteriores, como a agenda e os provedores de IA mais recentes.

---

## ✨ Funcionalidades

### 1. Busca multibase e tradução de queries
* Construtor visual de queries (`AND`/`OR`/`NOT`) sobre campos como título, resumo, autores e ano.
* O `QueryTranslator` gera a sintaxe de cada base (por exemplo, `TITLE-ABS-KEY` no Scopus e `title_and_abstract.search` no OpenAlex). O `SearchOrchestrator` consulta as bases em paralelo, aplicando o limite **por base**.
* Scopus e Web of Science usam as chaves de API do próprio usuário, guardadas criptografadas nas configurações.
* Cada busca gera uma entrada no histórico (query traduzida, ordenação, limite e contagem por base).

### 2. Projetos, artigos e desduplicação
* Desduplicação por **DOI** higienizado e **título** normalizado, mantendo em `source_databases` quais bases retornaram o registro.
* Artigos avulsos (manuais) com badge `⚠️ Manual` e upload de PDF no cadastro.
* Diário do projeto com **histórico de versões** e restauração.
* Documentos de **acesso rápido** (link, URL ou PDF), com grupos nomeados, edição e reordenação por arraste.
* Status de leitura (Ativos, Lidos, Arquivados), ordenação personalizada, dashboard com gráficos e heatmap de atividade do diário.

### 3. Categorização
* Matriz de categorias do projeto com tipos texto, seleção única (enum) e **seleção múltipla**.
* As opções são um modelo relacional (`project_category_options`, `article_category_selections`), o que permite renomear e reordenar sem perder dados.
* Exportação dedicada da matriz.

### 4. Leitor de PDF
* Destaques persistentes com notas em Markdown, anotações avulsas e bloco de escrita.
* Busca de termos no PDF, zoom de 50% a 250% e atalhos de teclado.
* PDFs são servidos ao renderer por um **protocolo customizado `emma-pdf://`**, que evita a serialização de buffers grandes pelo IPC.
* A desvinculação de um PDF remove o arquivo físico, mas preserva as anotações do artigo.
* **Biblioteca Global de PDFs** (`/pdfs`), independente de projetos, com importação para projetos (clonando artigo, PDF e embeddings).

### 5. IA e RAG
* **Provedores de LLM:** OpenAI, Anthropic, Gemini, Ollama e Ollama Cloud, atrás da interface `LLMProviderGateway`. O provedor/modelo é configurado **por habilidade** (`metadata`, `summary`, `extraction`, `embeddings`) em `ai_model_config`.
* **Embeddings:** motor local embutido (ONNX, sem configuração) ou provedores externos. O `EmbeddingService` faz retentativas em erros 429 do Gemini.
* **RAG:** o `PdfExtractor` divide os PDFs em chunks, armazenados em `pdf_chunks`, e o `VectorStore` recupera trechos por similaridade, com citação de trecho e página. A estratégia está descrita em `docs/planos/2026-06-23_07_estrategia_chunking_rag.md`.
* **Extração massiva:** investigações com **sets de perguntas** (globais ou por projeto), resultados armazenados por artigo e pergunta, e histórico completo, incluindo artigos ignorados ou com erro.
* Respostas de LLM passam por `jsonRepair.ts` antes de serem interpretadas.

### 6. Agenda científica
* Cadastro de eventos, conferências e periódicos com múltiplos prazos (pontuais ou em intervalo) em `scientific_venues` e `scientific_milestones`.
* Página `/agenda` com visualização por evento ou lista de prazos, calendário integrado e banner de próximos prazos no dashboard.

### 7. Citações e exportação
* Gerador de citações individual e em massa (ABNT e BibTeX), com opção de "et al." e ordenação pelo sobrenome do primeiro autor.
* Exportação em CSV padrão Scopus para o Biblioshiny. É gerado um `EID` único e estável (`2-s2.0-${id}`), sem o qual o Bibliometrix colapsa registros como duplicados. Autores, nomes completos e afiliações são convertidos para o formato Scopus.

### 8. Portabilidade, backup e lixeira
* **Projetos (`.emmapcarc`):** exportação/importação de projetos entre computadores, incluindo categorias, sets de perguntas, resultados de investigação, diário e histórico de buscas.
* **Backup completo (`.emmabak`):** exportação manual do banco e dos arquivos, com *checkpoint* do WAL antes da cópia.
* **Backups automáticos** com rotação GFS (Grandfather-Father-Son) e restauração pela interface, que reinicia o app ao concluir.
* **Lixeira** para projetos e artigos excluídos.

---

## 🛠️ Decisões Técnicas Relevantes

* **CSP e PDFs:** o Electron bloqueia `blob:` por padrão. A CSP em `main.ts` libera `blob:`, `emma-pdf:` e workers. O worker do PDF.js é servido localmente (`public/pdf.worker.min.mjs`) para evitar falhas de CORS com CDN.
* **Zoom do leitor:** `key={scale}` no `<PdfHighlighter>` força a remontagem quando a escala muda, para o PDF.js redesenhar os canvases.
* **Concorrência no SQLite:** modo WAL com *checkpoint* antes de backup e exportação, e ambiente de dados isolado durante o desenvolvimento e os testes E2E.
* **Injeção de dependências:** repositórios e serviços recebem suas dependências por construtor. No renderer, os serviços chegam via `ServicesContext`.
* **Erros padronizados:** o processo principal lança `AppError` com código (`ERR_*`) e tipo (`USER_ERROR`, `SYSTEM_ERROR`, `NETWORK_ERROR` ou `VALIDATION_ERROR`). O `errorHandler` do IPC os repassa para o renderer, que os exibe em modal global.
* **Embeddings locais:** o sidecar `llama.cpp` foi substituído pelo motor ONNX, para eliminar downloads pesados e a configuração manual.
* **Biblioshiny:** sem `EID` único o Bibliometrix descarta registros legítimos, por isso ele é sempre gerado na exportação.

O histórico completo das decisões, fase a fase, está em [`development_diary.md`](development_diary.md).

---

## 💻 Como Executar

### Pré-requisitos
* **Node.js** 18 ou superior (o CI usa a versão 22)
* **npm**

### Instalação e desenvolvimento
```bash
cd emmas_librarian
npm install
npm run electron:dev
```
O `electron:dev` recompila os módulos nativos para o Electron (`better-sqlite3`), compila o processo principal e sobe o Vite junto com o Electron. Em desenvolvimento os dados ficam em `emmas_librarian/dev_data/`, isolados da instalação real. Em produção ficam em `userData` (`emma.db` mais a pasta `storage/`).

### Build de produção
```bash
npm run electron:build
```
O instalador (`.exe`, NSIS) é gerado em `emmas_librarian/release/`.

---

## ✅ Testes e Qualidade

Todos os comandos rodam dentro de `emmas_librarian/`:

| Comando | Finalidade |
|---|---|
| `npm test` | Testes unitários e de integração (Vitest). Recompila `better-sqlite3` para o Node antes de rodar. |
| `npm run coverage` | Cobertura (v8) |
| `npm run typecheck` | Checagem de tipos do renderer e do processo principal |
| `npm run lint` / `npm run format` | ESLint / Prettier |
| `npm run test:e2e` | Playwright contra o Electron real (janela visível, 1 worker) |
| `npm run test:performance` | Testes de carga com k6 (`:smoke`, `:load`, `:stress`, `:soak`) |
| `npm run test:mutate` | Testes de mutação com Stryker |

Um hook do Husky executa `npm test` no pre-commit.

> ⚠️ `better-sqlite3` é compilado para um único runtime por vez. Os scripts de teste e de desenvolvimento já cuidam do `rebuild`, mas se alternar entre `npm test` e `electron:dev` manualmente, use `npm run rebuild:node` ou `npm run rebuild:electron`.

### Convenções
As regras de código, testes, commits e logs estão em [`AGENTS.md`](AGENTS.md). Em resumo: funções curtas, arquivos com menos de 500 linhas, sem `any`, dependências injetadas, teste para toda função nova (e regressão para todo bug corrigido) e commits semânticos (`feat:`, `fix:`, `refactor:`…).

---

## 🚀 Release e CI/CD

1. Com typecheck e testes passando, atualize `version` em `emmas_librarian/package.json` e o `package-lock.json` (`npm install --package-lock-only`).
2. Adicione a nova versão ao `src/components/modals/ChangelogModal.tsx` e ao *patch notes* do `README.md`.
3. Commit `chore: release vX.Y.Z`, crie a tag `vX.Y.Z` e envie o commit e a tag.

O fluxo detalhado está na skill [`agent/release-manager/SKILL.md`](agent/release-manager/SKILL.md).

* **`release.yml`:** a tag `v*` dispara o build no Windows e publica o instalador nas Releases do GitHub. O app instalado baixa as atualizações automaticamente via `electron-updater`.
* **`deploy-pages.yml`:** alterações em `landing_page/` publicam o site no GitHub Pages.

---

## 🔮 Próximos Passos

* Extração automática de metadados (DOI, autores, título) a partir de PDFs importados.
* Busca e download automático de PDFs em bases abertas (por exemplo, Unpaywall) a partir do DOI.
* Exportação em RIS e EndNote, além do BibTeX já existente.
* Assinatura de código (*code signing*) do instalador, para remover o aviso do SmartScreen.

---
*Desenvolvido para tornar a ciência mais acessível, rastreável e focada na leitura ativa.* 🚀
