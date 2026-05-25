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
