# Emma's Librarian 📚

**Emma's Librarian** é uma aplicação desktop de alta performance desenvolvida para pesquisadores e acadêmicos. O sistema automatiza a realização de buscas bibliográficas estruturadas e simultâneas em múltiplas bases científicas, centralizando a gestão de projetos, desduplicação de resultados, leitura ativa de PDFs e exportação de metadados compatíveis com ferramentas analíticas avançadas como o **Biblioshiny** (Bibliometrix no RStudio).

Tudo isso é executado localmente, garantindo total privacidade de dados, segurança de chaves de API e controle absoluto sobre sua biblioteca de pesquisa.

---

## 💡 Ideia Principal e Filosofia

O desenvolvimento de revisões sistemáticas e revisões de escopo frequentemente esbarra em processos manuais exaustivos: formatar queries para dezenas de mecanismos de busca diferentes, baixar metadados fragmentados, lidar com centenas de arquivos duplicados e gerenciar PDFs e anotações de forma desconexa.

A filosofia do **Emma's Librarian** baseia-se em três pilares:
1. **Transparência e Rastreabilidade:** O pesquisador deve ter controle absoluto sobre suas buscas. O sistema traduz automaticamente a query visual construída para a sintaxe nativa de cada base de dados externa (OpenAlex, Crossref, Scopus, Web of Science) e documenta esse histórico detalhadamente.
2. **Privacidade Absoluta (Local-First):** Seus projetos, termos de pesquisa, anotações de leitura e arquivos PDF nunca saem do seu computador. O armazenamento é feito em um banco SQLite embutido de alta performance.
3. **Estética Premium e Ergonomia Visual:** A interface adota um design moderno com efeito *Glassmorphism*, transições fluidas e um tema visual focado em reduzir a fadiga cognitiva durante longas sessões de leitura científica.

---

## 📂 Estrutura de Pastas e Arquivos

O projeto está estruturado em uma arquitetura limpa de aplicação Desktop utilizando **Electron** no processo principal (backend local) e **React + TypeScript + Vite** no processo de renderização (frontend).

```text
emmas_librarian/
├── backend/                        # Histórico: protótipos de serviços auxiliares (FastAPI/Python)
├── frontend/                       # Código principal da aplicação Desktop
│   ├── dist/                       # Build final da aplicação React (Vite)
│   ├── dist-electron/              # Transpilação de TypeScript para Electron Main Process
│   ├── public/                     # Arquivos públicos estáticos (ex: workers do PDFJS)
│   ├── electron/                   # Camada de Processo Principal do Electron
│   │   ├── database/               # Gerenciador do Banco SQLite
│   │   │   └── DatabaseManager.ts  # Gerencia as conexões, tabelas e transações via better-sqlite3
│   │   ├── services/               # Serviços de negócio integrados
│   │   │   ├── ApiIntegrator.ts    # Conexão, busca e normalização (OpenAlex, Crossref, Scopus, WoS)
│   │   │   ├── QueryTranslator.ts  # Tradutor da Query Visual para a sintaxe nativa de cada API
│   │   │   ├── SearchOrchestrator.ts # Coordenação assíncrona da busca multi-base
│   │   │   └── types.ts            # Interfaces e definições de dados de API e normalização
│   │   ├── handlers.ts             # Registra as rotas de IPC (Comunicação Inter-Processo) do Electron
│   │   ├── main.ts                 # Arquivo de inicialização, janelas, CSP e ciclo de vida do Electron
│   │   └── tsconfig.json           # Configuração TypeScript do processo main
│   ├── src/                        # Camada de Renderização do Frontend (React + TS)
│   │   ├── components/             # Componentes reutilizáveis (Layout, Modais, Cards)
│   │   ├── pages/                  # Telas completas da aplicação
│   │   │   ├── Dashboard.tsx       # Visão geral de projetos com "Empty States" e estatísticas
│   │   │   ├── NewProjectPage.tsx  # Criação de projetos e parametrização
│   │   │   ├── ProjectDetailsPage.tsx # Listagem de artigos, histórico, filtros e inserção manual
│   │   │   └── ArticleReaderPage.tsx # Leitor premium de PDF com anotações, zoom e busca integrada
│   │   ├── services/               # Camada de comunicação com o Electron
│   │   │   └── api.ts              # Abstração de chamadas IPC encapsuladas em Promises simples
│   │   ├── types/                  # Tipagem compartilhada do frontend
│   │   ├── index.css               # Folha de estilos global (Design System, Tokens, Variáveis CSS)
│   │   ├── main.tsx                # Ponto de entrada do React
│   │   └── App.tsx                 # Rotas e envelopamento da aplicação
│   ├── tsconfig.json               # Configurações de tipos do frontend
│   ├── tsconfig.electron.json      # Configurações de tipos do processo principal
│   └── vite.config.ts              # Parametrização do empacotador Vite
├── plans/                          # Roteiros de implementação e registros de decisões de arquitetura
├── emma.db                         # Banco de dados SQLite local
└── README.md                       # Documentação principal
```

---

## ✨ Funcionalidades Principais

### 1. Orquestração Multibases & Tradução de Queries
* **Busca Simultânea:** Insira uma query uma única vez e o sistema faz a requisição em background de forma assíncrona nas bases **OpenAlex**, **Crossref**, **Scopus** e **Web of Science**.
* **Query Builder Visual Avançado:** Esqueça a memorização de operadores booleanos complexos e chaves de filtro. Construa sua árvore de pesquisa (`AND`/`OR`/`NOT`) usando blocos visuais intuitivos aplicados a campos específicos (Título, Resumo, Autores, Ano).
* **Tradução Nativa:** O motor traduz o modelo visual para as sintaxes específicas e complexas de cada API (ex: queries formatadas com parênteses aninhados, aspas e códigos de campo como `TITLE-ABS-KEY` para Scopus ou `title_and_abstract.search` no OpenAlex).

### 2. Gestão de Projetos e Desduplicação Inteligente
* **Histórico com Auditoria:** Todas as pesquisas executadas são eternizadas no histórico do projeto, guardando o timestamp, a contagem de resultados por base, o limite de artigos estipulado e a query exata traduzida.
* **Deduplicação Automática:** O sistema mescla de forma inteligente registros duplicados retornados por bases diferentes com base no **DOI** (higienizado) e no **Título** (normalizado sem caracteres especiais e caixa baixa), mantendo a rastreabilidade de quais bases originais retornaram o registro (`source_databases`).
* **Filtros Dinâmicos:** A tela de detalhes do projeto permite pesquisar termos nos metadados locais e filtrar a tabela ativamente com o seletor **"Apenas com PDF vinculado"**, ajudando a focar na leitura dos artigos salvos.

### 3. Cadastro de Artigos Avulsos (Manuais)
* **Cadastro Independente:** Permite incluir produções relevantes que não constam nas buscas automatizadas (teses, livros físicos, artigos de anais).
* **Alerta Visual Estrito (`⚠️ Manual`):** Artigos criados manualmente são destacados com um badge chamativo no grid e na tabela, alertando sobre a autodeclaração dos metadados.
* **Upload Integrado & Registro:** Você pode anexar o PDF correspondente no próprio modal de criação, registrando a operação de forma clara no histórico/logs de atividades do projeto.

### 4. Leitor Premium de PDF Integrado
* **Destaques e Notas Visuais:** Selecione textos diretamente no PDF, escolha notas associadas em Markdown e crie marcadores persistentes de forma simples.
* **Anotações Avulsas:** Crie anotações gerais associadas ao artigo que não dependam de marcações no texto, perfeitas para resumos e fichamentos.
* **Busca Avançada de Termos:** Um painel lateral integrado escaneia assincronamente as páginas do PDF sob demanda. Apresenta snippets contextuais inteligentes em tempo real com realce em tag `<mark>` e fornece navegação por rolagem suave (`scrollIntoView`) ao clicar no resultado.
* **Controle de Zoom Preciso:** Painel de escala integrado que permite Zoom In (`+`), Zoom Out (`-`) de **50%** a **250%** e botão **Reset** para 100%.
* **Desvinculação Segura de PDF:** Permite desvincular um arquivo PDF associado incorretamente por engano. O sistema apaga fisicamente o arquivo local e limpa a coluna `local_file_path` no SQLite, mas **preserva intactas** todas as anotações e históricos criados para aquele artigo.

### 5. Exportação Fidedigna para o Biblioshiny (Scopus CSV)
* **Identificadores Únicos Garantidos:** Gera identificadores de registro estáveis e exclusivos (`EID` no formato `2-s2.0-${id}`) evitando que o algoritmo de importação do RStudio/Bibliometrix descarte registros legítimos como duplicados (corrigindo o colapso clássico da biblioteca).
* **Formatador de Autoria Avançado:** Converte strings fragmentadas de autores no banco de dados para o formato estrito exigido pelo Scopus:
  * **Authors:** Nomes abreviados separados por ponto e vírgula (`Singh Thakur A.; Verma A.`).
  * **Author Full Names:** Nomes completos separados por ponto e vírgula (`Singh Thakur, Agrimaa; Verma, Amit`).
* **Afiliações e Vínculos (AU_UN):** Une autores com seus respectivos metadados de afiliação (`a.affiliations`), preenchendo a coluna `Authors with affiliations` perfeitamente para extração de indicadores geo-acadêmicos no Bibliometrix.

---

## 🛠️ Problemas Superados & Soluções Aplicadas

Durante o desenvolvimento da aplicação, superamos desafios técnicos complexos de integração:

* **CSP & Renderização de PDF via Streams de Dados:** O Electron, por questões estritas de segurança (Content Security Policy), bloqueia requisições a URLs de objetos dinâmicos `blob:`. Ajustamos a tag CSP em `index.html` permitindo conexões seguras de blobs de mídia e workers. Criamos uma rotina no leitor para reconstituir os buffers serializados vindos do IPC do Electron de volta para arrays binários puros estruturados.
* **Deduplicação Crítica no RStudio (Biblioshiny):** Descobrimos que o Biblioshiny colapsava a coleção exportada por falta da coluna `EID` (tratada por ele como chave primária de banco). O desenvolvimento de geradores de ID exclusivos e normalizados resolveu o problema completamente.
* **Bloqueio de CORS do PDFJS Worker:** A dependência padrão do PDF.js tentava carregar o script de worker remotamente via CDN unpkg, gerando falhas intermitentes de CORS. Resolvemos isso salvando o worker localmente na pasta pública (`/pdf.worker.min.mjs`) e apontando a biblioteca para servir o arquivo estático diretamente do próprio executável local.
* **Reatividade Estática de Zoom no Leitor:** O leitor de PDFs não reagia de forma fluida à alteração da propriedade `pdfScaleValue`. Solucionamos injetando a propriedade dinâmica `key={scale}` no `<PdfHighlighter>`. Isso força a remontagem cirúrgica do componente React no DOM sempre que a escala de visualização é atualizada, forçando o PDF.js a redesenhar os canvases nas novas dimensões perfeitamente.

---

## 💻 Como Executar a Aplicação

### Pré-requisitos
* **Node.js** (versão 18 ou superior)
* **npm** (gerenciador de pacotes)

### Passo 1: Instalação de Dependências
Navegue até a pasta do frontend e instale todas as dependências requeridas do ecossistema Electron e React:
```bash
cd frontend
npm install
```

### Passo 2: Execução em Desenvolvimento
Para rodar a aplicação em tempo real com hot-reload ativo na interface React e logs completos no terminal do Electron:
```bash
npm run electron:dev
```
A janela nativa do **Emma's Librarian** abrirá imediatamente.

### Passo 3: Empacotamento para Produção (Build)
Para gerar um instalador portátil autônomo (`.exe` no Windows) otimizado e compilado:
```bash
npm run electron:build
```
Os arquivos gerados para distribuição serão salvos na pasta `/frontend/release/`.

---

## 🔮 Próximos Passos e Melhorias Futuras

* **Extração Automática de Metadados via PDF (OCR local):** Integrar um parser local de metadados capaz de extrair o DOI, autores e título diretamente de PDFs arrastados pelo usuário para acelerar o processo manual.
* **Busca e Download Automatizado de PDFs (Web Scraper integrado):** Implementar um buscador em background que varra bases abertas (como Unpaywall) para tentar baixar o PDF do artigo de forma 100% automatizada a partir do DOI retornado na busca científica.
* **Exportação para Múltiplos Formatos:** Inserir suporte de exportação para arquivos BibTeX (`.bib`), RIS (`.ris`) e EndNote, ampliando a compatibilidade nativa com gerenciadores de referências como Mendeley, Zotero e JabRef.
* **Filtros Bibliométricos Avançados no Frontend:** Exibição de gráficos locais de frequência de publicações por ano, bases mais produtivas e nuvem de palavras-chave antes mesmo de exportar os dados.

---
*Desenvolvido com carinho para tornar a ciência mais acessível, rastreável e focada na leitura ativa. Bons estudos e ótimas pesquisas!* 🚀
