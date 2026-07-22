# Plano de Implementação: Gerenciamento Global de PDFs e Compartilhamento de Artigos (v1.1.17) 📚

Este plano descreve a implementação da nova funcionalidade para o **Emma's Librarian**, permitindo que o usuário gerencie de forma transparente seus arquivos PDF locais, compartilhe PDFs e artigos entre projetos distintos, e rastreie a origem exata de cada artigo com links diretos e IDs únicos para pesquisas ou importações.

---

## 1. Decisões Arquiteturais e de Design

### Filosofia da Feature
* **Local-First & Deduplicação Fidedigna**: A aplicação continuará 100% offline. Para evitar cópias duplicadas de PDFs no disco rígido do usuário, usaremos hashes (SHA-256) dos arquivos. Dois artigos iguais (mesmo com nomes ou projetos distintos) compartilharão o mesmo arquivo físico.
* **Transparência e Controle**: O usuário terá uma tela central ("Biblioteca Global de PDFs") onde verá todos os arquivos armazenados, o tamanho em disco, o hash e a lista de projetos/artigos que fazem uso daquele arquivo. Ele terá poder total para desvincular ou apagar permanentemente arquivos do sistema.
* **Garantia de Integridade Referencial**: Para evitar anotações, destaques, chunks ou embeddings órfãos, a deleção física de um PDF da Biblioteca Global (ou sua remoção completa de um artigo) removerá em cascata qualquer marcação espacial ou chunk vetorial associado àquele arquivo nos artigos correspondentes.
* **Rastreabilidade**: Ao compartilhar um artigo de um projeto para outro, o sistema registrará um evento no histórico de buscas do projeto destino com a tag `Importação entre projetos`.

---

## 2. Modelagem do Banco de Dados (SQLite)

Para manter a compatibilidade com o código frontend existente e evitar refatorações complexas que poderiam quebrar o app, manteremos a coluna `local_file_path` na tabela `articles`. Ela apontará para o caminho físico do arquivo na pasta de armazenamento (`storage/pdfs/${hash}.pdf`). 

Criaremos uma nova tabela `pdf_files` para atuar como o catálogo central de metadados dos PDFs gravados.

### Nova Tabela: `pdf_files`
```sql
CREATE TABLE IF NOT EXISTS pdf_files (
    file_path TEXT PRIMARY KEY,
    file_hash TEXT UNIQUE NOT NULL,
    filename TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Migrações no Banco de Dados
Adicionaremos as seguintes etapas de migração no inicializador de tabelas do [DatabaseAdapter.ts](file:///C:/root_lab/antigravity/emmas_librarian/emmas_librarian/electron/database/DatabaseAdapter.ts):

1. **Criação da tabela `pdf_files`**.
2. **Retrocompatibilidade (Backfill)**:
   * Varrer a tabela `articles` existente buscando todos os registros com `local_file_path` não nulo.
   * Para cada caminho físico que realmente existir no disco:
     * Calcular o hash SHA-256 do arquivo.
     * Obter o tamanho do arquivo via `fs.statSync`.
     * Inserir o registro em `pdf_files` (caso não exista com o mesmo hash).
     * Renomear o arquivo no disco para `storage/pdfs/${hash}.pdf` e atualizar a coluna `local_file_path` nas tabelas `articles` e `pdf_files` correspondentes. (Isso unificará PDFs idênticos automaticamente na primeira execução).

---

## 3. Serviços do Processo Principal (Electron Backend)

As novas operações serão expostas por novos canais IPC e funções utilitárias em [DatabaseAdapter.ts](file:///C:/root_lab/antigravity/emmas_librarian/emmas_librarian/electron/database/DatabaseAdapter.ts) e [ipcRegistries.ts](file:///C:/root_lab/antigravity/emmas_librarian/emmas_librarian/electron/ipc/ipcRegistries.ts).

### Funções no Backend para Deduplicação de PDFs

1. **Cálculo de Hash SHA-256 (`calculateFileHash`)**:
   ```typescript
   // Retorna a representação hexadecimal do hash SHA-256 do arquivo
   import * as crypto from 'crypto';
   import * as fs from 'fs';

   function calculateFileHash(filePath: string): string {
     const fileBuffer = fs.readFileSync(filePath);
     return crypto.createHash('sha256').update(fileBuffer).digest('hex');
   }
   ```

2. **Registro/Upload de PDF na Biblioteca (`registerPdfInLibrary`)**:
   * Calcula o SHA-256 do arquivo PDF de origem.
   * Se o hash já existir na tabela `pdf_files`, reutiliza o `file_path` existente (não copia nada no disco).
   * Se não existir:
     * Copia o arquivo físico para a pasta `storage/pdfs/${hash}.pdf`.
     * Registra os metadados (nome original, tamanho, hash, caminho final) na tabela `pdf_files`.
   * Associa o `file_path` ao artigo desejado na tabela `articles`.

3. **Exclusão Segura e Limpeza de Órfãos (`deletePdfSafely`)**:
   * Quando um PDF é excluído permanentemente da Biblioteca Global ou desvinculado de um artigo:
     * O backend executa `UPDATE articles SET local_file_path = NULL WHERE id = ?`.
     * Para os artigos desvinculados, limpa em cascata no SQLite todos os `pdf_chunks` e as marcações associadas (`pdf_chunk_embeddings`) para evitar inconsistências no mecanismo de busca vetorial (IA RAG).
     * Apaga também os destaques (`highlights`) e as anotações espaciais vinculadas a esses destaques (`annotations`), pois dependiam das coordenadas das páginas físicas removidas. Anotações puramente textuais avulsas podem ser mantidas, desde que não tenham vínculos com coordenadas.
     * Realiza a verificação: `SELECT COUNT(*) as count FROM articles WHERE local_file_path = ?`.
     * Se `count === 0`, o arquivo físico correspondente e seu registro em `pdf_files` são deletados permanentemente do disco e do banco.

### Compartilhamento de Artigos entre Projetos
Criaremos o canal IPC `IpcChannel.ARTICLES_IMPORT_FROM_PROJECT` para realizar o clone.

* **Fluxo de Trabalho**:
  1. Cria uma entrada em `search_history` no projeto destino:
     * `unified_query`: `"Importação de artigos do projeto '${nomeProjetoOrigem}'"`
     * `translated_queries`: `JSON.stringify({ import: "Origem: Projeto ID " + sourceProjectId })`
     * `results_breakdown`: `JSON.stringify({ import: selectedArticles.length })`
     * Obtém o `search_id` resultante.
  2. Clona a linha do artigo na tabela `articles` alterando o `project_id` para o projeto destino e o `search_id` para o recém-criado.
  3. Copia a referência de `local_file_path` (reaproveitando o mesmo PDF sem criar duplicatas).
  4. Clona os registros associados em `pdf_chunks` e as marcações de vetor em `pdf_chunk_embeddings` (para que as capacidades de IA/RAG fiquem prontas de imediato no projeto destino sem a necessidade de reprocessamento do PDF).

---

## 4. Roteiro do Frontend (React Process)

### A. Criação da Biblioteca Global de PDFs (`PdfWarehousePage.tsx`)
Adicionaremos uma nova rota `/pdfs` no router principal em [main.tsx](file:///C:/root_lab/antigravity/emmas_librarian/emmas_librarian/src/main.tsx) e um link no cabeçalho em [Layout.tsx](file:///C:/root_lab/antigravity/emmas_librarian/emmas_librarian/src/components/common/Layout.tsx).

* **Interface Visual**:
  * Adota o tema *Glassmorphism* do Emma's Librarian com cards translúcidos, blur e efeitos de hover.
  * **Painel de Métricas**:
    * Total de PDFs salvos.
    * Espaço em disco utilizado (ex: `1.24 GB`).
    * PDFs Compartilhados (vinculados a múltiplos projetos).
    * PDFs Órfãos (não vinculados a nenhum artigo).
  * **Lista e Tabela de Arquivos**:
    * Barra de busca por nome de arquivo ou nome de artigo vinculado.
    * Coluna **Nome do Arquivo**, **Tamanho** e **Hash (SHA-256)**.
    * Coluna **Projetos Vinculados**: Exibe badges com o nome do projeto e artigo. Clicar no badge do projeto redireciona o usuário diretamente para a página de detalhes daquele projeto (`/projects/:id`).
  * **Ações por Arquivo**:
    * `Visualizar`: Abre o leitor de PDF integrado.
    * `Vincular Artigo`: Abre um modal com a lista de projetos e artigos que não possuem PDF anexado para associar o arquivo atual de forma imediata.
    * `Excluir`: Remove a referência física e limpa a coluna de PDF dos artigos que utilizam esse arquivo (com aviso explícito de que os destaques e chunks vetoriais desses artigos também serão apagados para evitar dados órfãos).

### B. Vinculação Flexível no Projeto
Nas telas [ProjectDetailsPage.tsx](file:///C:/root_lab/antigravity/emmas_librarian/emmas_librarian/src/pages/ProjectDetailsPage.tsx) e [ArticleReaderPage.tsx](file:///C:/root_lab/antigravity/emmas_librarian/emmas_librarian/src/pages/ArticleReaderPage.tsx), ao clicar em "Anexar PDF", o usuário terá duas opções:
1. `Upload Local`: Selecionar um arquivo local do computador.
2. `Selecionar da Biblioteca`: Abre um modal interativo para escolher um PDF já existente no sistema-wide catalog, economizando armazenamento.

### C. Importação Direta entre Projetos
Na página [ProjectDetailsPage.tsx](file:///C:/root_lab/antigravity/emmas_librarian/emmas_librarian/src/pages/ProjectDetailsPage.tsx), adicionaremos uma ação no painel lateral de ações chamada `Importar de outro projeto`.
* **Fluxo do Modal**:
  1. O usuário escolhe um projeto de origem em um seletor dropdown.
  2. Apresenta uma tabela paginada com os artigos do projeto de origem, contendo barra de pesquisa.
  3. O usuário seleciona os artigos que deseja copiar por meio de checkboxes.
  4. Executa a importação enviando os dados ao IPC do Electron.
  5. Recarrega os dados do projeto automaticamente.

### D. Transparência de ID Único e Link de Origem
1. **Exibição do ID na Busca**:
   * No [SearchHistoryModal.tsx](file:///C:/root_lab/antigravity/emmas_librarian/emmas_librarian/src/components/modals/SearchHistoryModal.tsx), cada item do histórico passará a exibir explicitamente um badge de identificador exclusivo (ex: `Busca #12` ou `Importação #15`).
2. **Link Direto no Modal do Artigo**:
   * No [ArticleDetailsModal.tsx](file:///C:/root_lab/antigravity/emmas_librarian/emmas_librarian/src/components/modals/ArticleDetailsModal.tsx), adicionaremos um campo chamado `Origem no Projeto`.
   * Se o artigo tiver `search_id`, exibiremos um link estilizado:
     * Para buscas normais: `🔍 Busca #12 ("machine learning")`
     * Para importações: `📦 Importação #15 (Do projeto 'Marketing')`
   * Ao clicar no link, o modal de detalhes do artigo é fechado, a tab de histórico (`history`) do projeto é selecionada automaticamente no [ProjectDetailsPage.tsx](file:///C:/root_lab/antigravity/emmas_librarian/emmas_librarian/src/pages/ProjectDetailsPage.tsx), e a busca correspondente ganha um foco visual temporário (animação de pulsação/highlight amarelo).

---

## 5. Respeito às Regras de Código (AGENTS.md)

1. **Responsabilidade Única (SRP)**:
   * Não inflar o `DatabaseAdapter.ts` com lógica pesada de arquivo. Criaremos um utilitário exclusivo para operações físicas com arquivos de PDF.
   * Criar subcomponentes focados e pequenos para a página `PdfLibraryPage` (ex: `PdfMetricsCard.tsx`, `PdfTable.tsx`).
2. **Tamanho Máximo de Funções (4-20 linhas)**:
   * Toda função adicionada no backend or frontend deve ter de 4 a 20 linhas de código. Funções de clonagem ou cálculo de hash que passem desse limite devem ser quebradas em subfunções menores.
3. **TypeScript Restrito**:
   * Sem uso de `any` ou tipos implícitos nas assinaturas das novas APIs IPC e das propriedades dos componentes.
4. **Tratamento de Exceções Informátivo**:
   * Mensagens de erro de banco ou arquivos devem incluir o valor ofensivo e formato esperado. Exemplo:
     `throw new Error(\`Hash de PDF inválido. Recebido: "${hash}" (esperado: string hexadecimal de 64 caracteres)\`);`

---

## 6. Plano de Testes (F.I.R.S.T.)

* **Testes de Integração do SQLite (`DatabaseAdapter.test.ts`)**:
  * Validar a inserção de metadados em `pdf_files`.
  * Validar que a contagem de referências funciona corretamente ao excluir artigos ou projetos compartilhados.
  * Validar o fluxo de importação clonando artigos entre projetos e gerando o histórico correto.
  * Validar a limpeza em cascata automática de chunks, embeddings e destaques associados aos PDFs deletados.
* **Testes unitários dos handlers IPC (`ipcRegistries.test.ts`)**:
  * Mocar chamadas de arquivos e certificar-se de que os canais de compartilhamento e deduplicação retornam os dados estruturados corretos.
* **Testes de Componente React (`ArticleDetailsModal.test.tsx`)**:
  * Garantir que o link de origem é exibido com base no `search_id`.
  * Validar o disparo do callback de navegação para a busca quando clicado.
* **Testes End-to-End (E2E) com Playwright (`e2e-tests/sharing_and_pdf_library.spec.js`)**:
  * Criamos o arquivo [sharing_and_pdf_library.spec.js](file:///C:/root_lab/antigravity/emmas_librarian/emmas_librarian/e2e-tests/sharing_and_pdf_library.spec.js) contendo:
    1. **Fluxo de Compartilhamento de Artigos**: Cria dois projetos (Origem e Destino), insere um artigo manualmente no primeiro, executa a ação de importação selecionando-o, e valida que o artigo foi replicado no destino e gerou um ID de histórico representativo (`Importação #ID`).
    2. **Fluxo da Biblioteca de PDFs e Deduplicação**: Cria o primeiro projeto, faz o upload de um PDF dummy, navega até a Biblioteca de PDFs global (`/pdfs`) para conferir o registro e tamanho. Cria o segundo projeto, cria outro artigo e o vincula ao PDF já existente selecionando-o da biblioteca global. Valida que ambos os artigos reutilizam a mesma referência e que o contador de referências na biblioteca subiu para 2, economizando espaço em disco de forma transparente.
