# Proposta de Refatoração Arquitetural: Migração para Electron + React/Vite

## 1. Contexto Atual do Projeto
O estado atual do sistema **Emma's Librarian** baseia-se em uma arquitetura cliente-servidor desacoplada que opera inteiramente em ambiente local. O frontend é construído em React com TypeScript e Vite, enquanto o backend é estruturado em Python utilizando o framework FastAPI, persistindo dados em um banco SQLite3 local. 

Embora essa divisão resolva o escopo inicial do MVP, ela introduz complexidades artificiais de rede e severas barreiras de usabilidade para o usuário final, que precisa gerenciar múltiplos ambientes de execução em sua máquina local.

## 2. Motivações Principais para a Mudança

### 2.1. Eliminação do Desacoplamento Excessivo
Manter uma API REST (FastAPI) comunicando-se via requisições HTTP (`localhost`) com uma interface local (Vite) gera uma sobrecarga arquitetural desnecessária para um software cujo propósito é puramente local. A migração para o Electron elimina a necessidade de expor portas de rede locais e elimina o tráfego HTTP artificial, substituindo-o por comunicação direta em memória via IPC (Inter-Process Communication).

### 2.2. Redução Drástica da Fricção de Instalação (Melhoria de UX)
Atualmente, para executar o sistema, o pesquisador precisa:
1. Ter o Python 3.10+ e o Node.js 18+ previamente instalados no sistema operacional.
2. Instalar dependências em terminais separados (`pip install` e `npm install`).
3. Iniciar manualmente ambos os servidores em processos concorrentes.

Essa dinâmica limita a adoção do software por usuários leigos. Com o Electron, a aplicação é empacotada em um executável nativo único (.exe, .dmg ou .AppImage). O usuário instala e abre o programa com um duplo clique, sem jamais ver uma linha de comando.

### 2.3. Otimização do Tamanho do Aplicativo (Bundle Size)
O planejamento futuro do projeto prevê o uso de bibliotecas de ciência de dados em Python (como Pandas e Record Linkage Toolkit) para desduplicação avançada. O empacotamento dessas ferramentas (via PyInstaller) arrasta binários robustos compilados (NumPy, SciPy), o que inflaria o tamanho do instalador de ~150MB para algo entre 350MB e 500MB.
Ao adotar uma arquitetura baseada 100% em TypeScript no ecossistema do Node.js, remove-se completamente o interpretador Python e suas dependências pesadas, mantendo o instalador final otimizado em torno de 100MB a 130MB.

### 2.4. Desempenho e Eliminação de Latências (Zero Cold Start)
Chamar scripts ou servidores Python em segundo plano sob demanda adicionaria uma latência de inicialização do interpretador (*cold start*) a cada busca. No Electron, o processo principal (*Main Process*) em Node.js está permanentemente ativo e responsivo, oferecendo comunicação instantânea com a interface de visualização.

### 2.5. Centralização e Redução da Carga Cognitiva de Manutenção
Ao unificar a base de código em uma única linguagem (TypeScript), reduz-se a complexidade do projeto. O mesmo desenvolvedor passa a ser capaz de manter o ciclo completo da informação: desde a construção do componente visual no React até o gerenciamento de consultas SQL diretas no SQLite e a integração com APIs externas.

## 3. Sugestão de Implementação (Caminho de Migração)

A transição da arquitetura atual para o modelo consolidado do Electron pode ser realizada de forma incremental em 5 fases distintas:

### Fase 1: Integração do Electron com React/Vite
O projeto frontend atual deve ser mantido. O Electron deve ser adicionado como uma dependência de desenvolvimento no `package.json`.
* Estruturar o processo principal (`main.ts`) para gerenciar o ciclo de vida das janelas nativas (`BrowserWindow`).
* Configurar o script de inicialização do Vite para alimentar a janela de renderização do Electron durante o modo de desenvolvimento.
* Implementar o script de `preload.ts` utilizando `contextBridge` para expor APIs seguras ao frontend sem violar as diretrizes de segurança do Electron.

### Fase 2: Migração da Camada de Persistência (SQLite)
A responsabilidade pelo banco de dados passa do Python (`database.py`) diretamente para o processo principal do Electron.
* Substituir o driver do Python por uma biblioteca nativa ultrarápida de Node.js, como o `better-sqlite3`.
* Aproveitar integralmente o arquivo `schema.sql` existente para inicializar as tabelas (`projects`, `articles`, `annotations`, `highlights`) localmente no diretório de dados do usuário (ex: `app.getPath('userData')`).

### Fase 3: Reescrever os Clientes de API em TypeScript
Toda a lógica contida no módulo `query_translator.py` e `api_integrator.py` deve ser porta para TypeScript.
* Criar tradutores estruturados para converter os blocos visuais de busca em strings de consulta compatíveis com WebOfScience, Scopus, OpenAlex e Crossref (a sintaxe unificada que já estava previamente planejada para ser fácilmente traduzida para diferentes bases).
* Implementar as chamadas HTTP diretamente no processo principal usando o cliente nativo do Node.js ou bibliotecas leves como `axios`.
* **Expansão para Scopus e Web of Science:** Como não existem wrappers prontos tão específicos em TypeScript quanto o `pybliometrics`, as integrações futuras com as APIs REST da Scopus (Elsevier) e Web of Science (Clarivate) serão escritas do zero consumindo os endpoints HTTP nativos, garantindo controle total sobre paginação e limites de taxa sem dependências externas.

### Fase 4: Substituição de Chamadas HTTP por Comunicação IPC
Substituir o arquivo de serviço frontend (`api.ts`), eliminando as requisições baseadas em URLs de rede local (`http://localhost:8000`).
* Mapear cada função (ex: `getProjects`, `searchAndPersist`, `createHighlight`) para invocar canais IPC do Electron via `window.electronAPI.invoke('canal', dados)`.
* No processo principal do Electron, registrar os ouvintes correspondentes (`ipcMain.handle`) para processar as requisições, interagir com o SQLite e retornar os dados diretamente em memória para o React.

### Fase 5: Empacotamento e Distribuição Nativa
Configurar o ferramental de build para empacotar o software de forma profissional.
* Utilizar o `electron-builder` para automatizar a geração de instaladores.
* Configurar compilações direcionadas para os sistemas operacionais alvo (Windows, macOS e Linux), gerando artefatos enxutos e prontos para consumo pelo usuário final.

## 4. Regras de desenvolvimento (incrementar em procedimento.md)

O desenvolvimento dessa nova versão deve seguir princípios essenciais de boas práticas de programação.

1. **TDD**: Usar *Test Driven Development* durante o desenvolvimento, sempre desenvolvendo os testes de uma funcionalidade antes de implementá-la.
2. **SOLID**: Aproveitar ao máximo a Orientação a Objetos, seguindo sempre que possível os princípios SOLID para garantir um código de qualidade, legível e com poucas repetições.
3. **Clean Code**: Respeitar princípios do código limpo como definir bem as responsabilidades, bons nomes para classes e métodos, etc.

## 5. Experiência do usuário

Para facilitar o uso do sistema, vamos repensar alguns detalhes da interface.

1. Um usuário entra no sistema e vê um botão de "criar novo projeto", e todos os seus projetos logo abaixo. Se decidir por criar um novo projeto, ele é levado para uma página dedicada a isso. Se clicar em um projeto já existente, ele vai direto para a página do projeto.
2. Usuário escolhe um nome para o projeto e é levado para a página desse projeto recém criado, onde tem a opção para fazer uma nova busca, uma seção recolhível (accordion) com a tabela de artigos arquivados e uma seção de artigos vinculados ao projeto.
3. Usuário aperta um botão para "fazer nova busca" e é levado para uma página de busca.
4. Na página de busca, usuário marca (botões do estilo *toggle*) quais bases vão ser usadas na busca. Usuário também usa o construtor visual de querys para construir a query da sua busca. Quando estiver tudo pronto, usuário aperta "fazer busca"
5. Sistema leva usuário devolta para a página do projeto, porém dessa vez, a região destinada aos artigos vinculados ao projeto agora é coberta por um loader, informando o usuário que o sistema está fazendo a busca que ele pediu. Quando a busca termina, o loader desaparece e a lista de artigos obtidos é adicionada na página do projeto. Para cada elemento da lista (artigo encontrado) é exibido o título e DOI do artigo, os nomes dos autores, a data de publicação, as bases que continham aquele artigo, e alguns botões de ações que o usuário pode tomar, essas ações incluem (Ler e anotar, para artigos que tem um arquivo PDF vinculado; Ver no navegador, que abre o link para o DOI do artigo; Vincular PDF, que permite que o usuário vincule um arquivo salvo localmente no sistema, possibilitando por exemplo a leitura e anotações; e arquivar, que move o artigo para a seção de arquivados, permitindo ao usuário adicionar uma nota detalhando o motivo do arquivamento).
6. Se o usuário decidir ler um artigo a partir de um arquivo local, o leitor de pdfs integrado do sistema é aberto, permitindo que o usuário faça marcações (highlights), anotações sobre o artigo e anotações individuais para cada marcação que fizer.
7. A navegação (de volta para a página de projetos, para a página de um projeto específico, para a página de configurações ou quaisquer outras páginas) ocorre através de um painel lateral recolhível.