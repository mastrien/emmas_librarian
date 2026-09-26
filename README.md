# Emma's Librarian 📚

Bem-vindo ao **Emma's Librarian**, sua assistente pessoal para gerenciamento e análise bibliométrica de artigos acadêmicos.

Este aplicativo foi criado para ajudar pesquisadores e estudantes a organizar seus PDFs, extrair metadados e analisar o conteúdo com facilidade.

---

## 📥 Como Instalar (Guia Rápido)

A maneira mais fácil de instalar o Emma's Librarian no seu computador é baixar o instalador oficial:

1. Acesse a nossa aba de **Releases** aqui no GitHub.
2. Na versão mais recente, baixe o arquivo com a extensão **`.exe`** (ex: `Emma's Librarian Setup 1.0.0.exe`).
3. Dê um duplo clique no arquivo baixado para iniciar a instalação.

### ⚠️ Aviso Importante: "O Windows protegeu o seu computador"

Como o Emma's Librarian é um projeto de código aberto e independente, ainda não possuímos um **Certificado Digital Pago** (Code Signing Certificate), que custa algumas centenas de dólares anualmente. 

Por causa disso, ao tentar executar o instalador pela primeira vez, o Windows exibirá uma tela azul do **Microsoft Defender SmartScreen** com a mensagem *"O Windows protegeu o seu computador"*.

**Isso é normal e seguro.** Para continuar a instalação:
1. Clique em **"Mais informações"** no texto da tela azul.
2. Em seguida, clique no botão **"Executar assim mesmo"** que aparecerá na parte inferior.

O aplicativo é 100% de código aberto, e você pode verificar todo o código-fonte aqui mesmo neste repositório!

---

## 🔄 Atualizações Automáticas

Uma vez instalado, o Emma's Librarian procura por novas atualizações automaticamente sempre que você abre o aplicativo. 

Quando uma nova atualização estiver disponível, ela será baixada silenciosamente no fundo. Na próxima vez que você fechar e abrir o aplicativo, a nova versão já estará instalada e pronta para uso!

Você pode verificar qual a versão atual do seu aplicativo na tela de **Configurações** dentro do próprio Emma's Librarian.

---

## 🛠️ Para Desenvolvedores

Se você é um desenvolvedor e deseja rodar o projeto localmente, contribuir com o código, ou entender a arquitetura (Electron + React + Vite + SQLite), consulte o nosso documento técnico:

👉 [**README_FOR_DEVS.md**](README_FOR_DEVS.md)

---

## 📝 Patch Notes (Histórico de Atualizações)

Acompanhe as últimas novidades, melhorias e correções recentes do **Emma's Librarian**:

### v1.1.23
- **Leitor de PDF:** Tratamento aprimorado de erros e carregamento seguro dos arquivos dos artigos.
- **Categorias e Lidos:** Correção no salvamento de textos de categorias e exibição consistente de artigos não arquivados.
- **Investigação com IA:** Ajustes nos botões de ação e no fluxo de conclusão do modal de extração.

### v1.1.22
- **Leitor de PDF Instantâneo:** Novo protocolo customizado `emma-pdf://` que evita a lentidão do IPC do Electron ao abrir PDFs grandes.
- **Categorias:** Painel de categorias do projeto refeito, sem inputs editáveis ocultos, para não pesar na renderização.
- **Acesso Rápido:** Corrigido um loop silencioso no modal que atrapalhava a digitação.
- **Extração com IA:** Corrigida a perda de dados quando mais de um campo era salvo de uma só vez.

### v1.1.21
- **Estabilidade:** Correções na navegação pelo menu "Mais opções" e no escopo dos seletores do modal de extração massiva, que causavam seleções indevidas de artigos.

### v1.1.20
- **UI/UX:** Animações *skeleton* no lugar dos avisos textuais de carregamento e adoção global de cores sólidas (sem botões em gradiente).
- **Backups:** A restauração automática agora reinicia o aplicativo e reconecta a ponte de IPC corretamente.
- **Embeddings Locais:** Motor local embutido baseado em ONNX (`@xenova/transformers`), sem instalação extra. Também há suporte ao provedor Ollama Cloud e retentativas automáticas em limites de taxa (429) do Gemini.

### v1.1.19
- **Agenda e Prazos:** Novo módulo global para eventos, conferências e periódicos, com múltiplos prazos (pontuais ou em intervalo), modos "Por Evento/Revista" e "Lista de Prazos" e calendário integrado.
- **Dashboard:** Relógio em cores neutras e banner com os próximos prazos.

### v1.1.18
- **Acesso Rápido:** Edição de atalhos existentes, reordenação por arraste e grupos nomeados.

### v1.1.17
- **Interface:** Menu principal e ações do projeto agrupados em dropdowns.
- **Importação de PDFs entre Projetos:** Corrigido o erro ao clonar artigos com PDFs e embeddings vetoriais.
- **Biblioteca Global de PDFs:** Arquivos salvos com data e nome original (`YYYYMMDD_HHMMSS_nome.pdf`) e tabela melhor adaptada a telas menores.

### v1.1.16
- **Histórico de Buscas:** Critério de ordenação e limite de resultados passam a ser persistidos, exibidos e preservados na exportação/importação de projetos.

### v1.1.15
- **Extração Massiva:** Artigos cancelados, ignorados ou com falha agora constam no histórico com o status correspondente.
- **Modelo de IA:** Provedor e modelo registrados no histórico refletem o modelo ativo da habilidade de extração.

### v1.1.14
- **Correção de Build:** Corrigido o erro `Not allowed to load local resource` ao abrir o app empacotado.

### v1.1.13
- **Categorias Relacionais:** Opções de categorias de seleção única e múltipla renomeáveis e reordenáveis sem perder o histórico dos artigos.
- **IA:** Sets de perguntas reutilizáveis (globais ou por projeto), resultados de investigação por artigo e pergunta, e painel para escolher provedor e modelo por habilidade (OpenAI, Gemini, Anthropic e Ollama).
- **RAG e Busca Semântica:** Chunks de PDF e embeddings vetoriais para respostas com citação de trecho e página.
- **Exportação/Importação:** O `.emmapcarc` passa a incluir seleções de categorias, sets de perguntas e resultados de investigação.

### v1.1.12
- **Sistema de Backup e Lixeira:** Implementação do BackupManager com rotação GFS (Grandfather-Father-Son) e lixeira para recuperação de projetos e artigos excluídos.
- **Histórico do Diário:** Adicionado suporte a histórico de versões para o diário do projeto, permitindo visualizar e restaurar alterações passadas.
- **Importação e Exportação:** Correções críticas na persistência de dados durante o ciclo de exportação e importação de projetos (`.emmapcarc`), garantindo a integridade de todos os metadados.
- **Estabilidade:** Melhorias no tratamento de concorrência do banco de dados (WAL checkpointing) e isolamento de ambiente para evitar conflitos de arquivos.

### v1.1.11
- **Controle de "et al." em Citações:** Adicionado suporte para ativar/desativar o uso de "et al." nos modais de citação individual e em massa.
- **Melhorias de Parser:** Correção na leitura de autores separados por vírgula em metadados importados e novas instruções de preenchimento.
- **UI/UX:** Padronização completa dos ícones de accordions (`ChevronRight`/`ChevronDown`) e correções de transbordo de rolagem.

### v1.1.10
- **Ações Contextuais:** Botões inteligentes (abrir detalhes, gerar citação, restaurar) adicionados diretamente na lista de artigos lidos e ativos.
- **Correções de Layout:** Remoção de barras de rolagem redundantes e melhoria no clipping de scrollbars em modais arredondados.
- **Nomenclatura:** Unificação do termo "Novos" para "Ativos" em todo o sistema.

### v1.1.9
- **Segurança de API:** Resolução de inconsistências em chaves do Scopus/WoS e adição de suporte a retrocompatibilidade de credenciais criptografadas.
- **Integridade:** Novos testes de regressão para o motor de busca e banco de dados.

### v1.1.8
- **Categorias e Lidos:** Correção na tabela de categorias para exibir corretamente artigos marcados como lidos.

### v1.1.7
- **Leitor de PDF:** Melhoria na ancoragem de destaques e suporte a quebras de linha em anotações.
- **Sincronização:** Resolução de condições de corrida na persistência do diário do projeto.

### v1.1.6
- **Multi-select:** Suporte a categorias de seleção múltipla para classificação flexível de artigos.

### v1.1.5
- **Matriz de Categorias:** Nova visualização em matriz para gerenciar categorias do projeto e exportação dedicada.
- **Edição Inline:** Possibilidade de editar opções de categorias diretamente na tabela.
- **UI Dinâmica:** Substituição de prompts nativos por modais de input para criação de opções de categorias.

### v1.1.4
- **Dashboard Avançado:** Inclusão de novos gráficos de estatísticas (distribuição por ano, tipo e periódicos).
- **Heatmap do Diário:** Adicionado mapa de calor de atividade do diário no dashboard global.
- **Arrastar e Soltar:** Suporte a importação de projetos (`.emmapcarc`) e adição em massa de PDFs via drag-and-drop.

### v1.1.3
- **Gestão de Referências:** Implementação de gerador de citações completo com suporte a BibTeX e prévia HTML (ABNT padrão).
- **Guia de Escrita:** Adicionado bloco de notas (writing pad) integrado ao leitor de artigos.
- **Contexto de Destaques:** Opção de copiar texto destacado via menu de contexto (botão direito).

### v1.1.2
- **Importação/Exportação:** Lançamento inicial da funcionalidade de portabilidade de projetos entre dispositivos.
- **Estatísticas Iniciais:** Gráficos de pizza para contagem de PDFs e status de leitura.

### v1.1.1
- **Correções de Build:** Estabilização de ícones no Windows e atalhos do instalador NSIS.
- **Ordenação:** Adicionada ordenação personalizada de artigos (por data de adição, título, etc).

### v1.1.0
- **Integração com IA:** Adicionado Resumo Mágico, Extração em Massa de dados e histórico de extrações.
- **Interface (UI):** Nova barra de título nativa customizada e novo logotipo SVG.
- **Novas Funcionalidades:** Adicionada funcionalidade de documentos de acesso rápido.
- **Correções (Fixes):**
  - Resolução de problemas de layout (*overflows*) e melhorias na ancoragem de destaques em PDFs.
  - Correção na importação e resolução da biblioteca `pdf-parse` e erros de compilação TypeScript relacionados.
  - Correção na exibição da barra de título nativa na página do leitor.

### v1.0.2
- **Gestão de Acervo:** Adicionada a capacidade de adicionar e editar artigos avulsos manualmente.

### v1.0.1
- **Leitor de PDF:** Correções na exibição e comportamento de destaques nas pesquisas do leitor.
- **Estrutura:** Renomeação do pacote interno do frontend para `emmas_librarian`.

### v1.0.0
- **Lançamento Inicial:** Primeira versão (MVP) contendo o construtor visual de queries, busca avançada e suporte a múltiplos projetos.
- **Funcionalidades Principais:** 
  - Pesquisas reversíveis e controle de zoom reativo.
  - Alternância de modo escuro (Dark Mode) e modo editor do diário.
  - Exportação de dados formatada para CSV padrão Biblioshiny (Scopus).
- **Correções Técnicas:** Diversas estabilizações do ambiente de produção Electron, incluindo a correção de erros do PrismJS, efeitos *glassmorphism* e builds de banco de dados nativos (better-sqlite3).
