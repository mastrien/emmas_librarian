# Plano de Implementação: Aprimoramento do Acesso Rápido (v1.1.18) 🚀

Este documento detalha o plano de implementação para a versão **v1.1.18** do **Emma's Librarian**, com foco no aprimoramento completo da funcionalidade de **Acesso Rápido** (*Quick Access*), trazendo três capacidades chave: **edição de itens existentes**, **reordenação via drag-and-drop com alça de arraste (seis pontos)** e **agrupamento/categorização opcional de itens ("grupos nomeados")**.

---

## 1. Diretrizes e Princípios Arquiteturais

1. **Adesão Estrita ao AGENTS.md**:
   - Manutenção de funções curtas (4 a 20 linhas).
   - Manutenção de arquivos focados e modulares (< 500 linhas).
   - Nomes únicos e expressivos, sem abstrações genéricas.
   - Tipagem explícita em TypeScript (sem `any`, sem tipos soltos).
   - Retornos precoces (*early returns*) para legibilidade.
   - Testabilidade em primeiro lugar (cada nova função/funcionalidade com testes dedicados usando `FakeProjectService` e mocks nomeados).
2. **Usabilidade e UX Premium**:
   - Alça visual de drag-and-drop explícita com o padrão universal de seis pontos (`<GripVertical />`).
   - Edição no próprio modal de gerenciamento sem perda de dados ou necessidade de excluir/recriar.
   - Categorização flexível e opcional (se o usuário não preencher a categoria, o item permanece acessível na visão geral comum ou no grupo padrão "Geral").

---

## 2. Modelagem do Banco de Dados (SQLite)

### 2.1 Alterações no Schema (`project_documents`)

Atualmente, a tabela `project_documents` no SQLite é definida como:
```sql
CREATE TABLE IF NOT EXISTS project_documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    url TEXT,
    local_file_path TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
);
```

Adicionaremos duas novas colunas via migração automática em [DatabaseAdapter.ts](file:///C:/root_lab/antigravity/emmas_librarian/emmas_librarian/electron/database/DatabaseAdapter.ts):
- `position`: `INTEGER DEFAULT 0` (guarda o índice de ordenação do item dentro do projeto).
- `category`: `TEXT DEFAULT NULL` (nome da categoria/grupo nomeado opcional).

### 2.2 Migrações e Inicialização Retroativa (*Backfill*)

```typescript
const migrations = [
  // ... migrações existentes
  'ALTER TABLE project_documents ADD COLUMN position INTEGER DEFAULT 0',
  'ALTER TABLE project_documents ADD COLUMN category TEXT DEFAULT NULL',
];
```

Além disso, adicionaremos um script de inicialização retroativa para atribuir posições ordenadas aos registros legados de cada projeto:
```typescript
// Backfill de posição inicial para project_documents legados sem posição atribuída
const unpositionedProjects = this.db
  .prepare('SELECT DISTINCT project_id FROM project_documents WHERE position IS NULL OR position = 0')
  .all() as { project_id: number }[];

for (const { project_id } of unpositionedProjects) {
  const docs = this.db
    .prepare('SELECT id FROM project_documents WHERE project_id = ? ORDER BY id ASC')
    .all(project_id) as { id: number }[];
  
  const updateStmt = this.db.prepare('UPDATE project_documents SET position = ? WHERE id = ?');
  docs.forEach((doc, index) => {
    updateStmt.run(index, doc.id);
  });
}
```

---

## 3. Tipos e Contratos de Dados (TypeScript & IPC)

### 3.1 Interfaces TypeScript (`electron/types.ts` e `src/types/index.ts`)

```typescript
export interface ProjectDocument {
  id: number;
  project_id: number;
  title: string;
  url?: string;
  local_file_path?: string;
  created_at: string;
  position?: number;
  category?: string;
}
```

### 3.2 Canais IPC (`electron/ipc/ipcRegistries.ts` e `IpcChannel`)

Definição dos novos canais IPC para manipular as operações estendidas:
- `IpcChannel.PROJECT_DOCUMENT_UPDATE` (`project:documents:update`): Atualiza os dados de um atalho existente.
- `IpcChannel.PROJECT_DOCUMENTS_REORDER` (`project:documents:reorder`): Atualiza em lote a ordenação dos atalhos de um projeto.

### 3.3 Interface do Serviço de Projetos (`ProjectServiceInterface.ts`)

Novos métodos adicionados à interface de contrato:
```typescript
export interface ProjectServiceInterface {
  // ... métodos existentes
  getProjectDocuments(projectId: number): Promise<ProjectDocument[]>;
  createProjectDocument(projectId: number, title: string, url?: string, sourceFilePath?: string, category?: string): Promise<number>;
  updateProjectDocument(id: number, title: string, url?: string, sourceFilePath?: string, category?: string): Promise<void>;
  reorderProjectDocuments(projectId: number, orderedIds: number[]): Promise<void>;
  deleteProjectDocument(id: number): Promise<void>;
}
```

---

## 4. Camada Backend (Electron & SQLite)

### 4.1 Atualização de `DatabaseAdapter.ts`

1. **`getProjectDocuments(projectId: number)`**:
   - Ajustar a ordenação da consulta SQL para respeitar a posição personalizada:
   ```sql
   SELECT * FROM project_documents 
   WHERE project_id = ? 
   ORDER BY position ASC, id ASC
   ```

2. **`saveProjectDocument(projectId: number, title: string, url?: string, localFilePath?: string, category?: string)`**:
   - Ao criar um novo item, definir `position` automaticamente como o maior índice atual + 1 (`SELECT COALESCE(MAX(position), -1) + 1 FROM project_documents WHERE project_id = ?`).
   - Salvar a categoria informada (ou `null` se vazia).

3. **`updateProjectDocument(id: number, title: string, url?: string, localFilePath?: string, category?: string)`**:
   - Atualiza `title`, `url`, `local_file_path` e `category` do item.
   - Caso o arquivo PDF físico seja substituído ou removido, executa a verificação e limpeza do arquivo físico antigo sem deixar órfãos.

4. **`reorderProjectDocuments(projectId: number, orderedIds: number[])`**:
   - Executa uma transação atômica SQLite em loop atualizando `position = index` para cada ID do array recebido:
   ```typescript
   const updateStmt = this.db.prepare('UPDATE project_documents SET position = ? WHERE id = ? AND project_id = ?');
   const transaction = this.db.transaction((ids: number[]) => {
     ids.forEach((id, index) => {
       updateStmt.run(index, id, projectId);
     });
   });
   transaction(orderedIds);
   ```

### 4.2 Registro dos Handlers IPC (`ipcRegistries.ts`)

Registrar no dispatcher principal do Electron:
- Handler para `PROJECT_DOCUMENT_UPDATE`: chama `db.updateProjectDocument(...)`.
- Handler para `PROJECT_DOCUMENTS_REORDER`: chama `db.reorderProjectDocuments(...)`.

---

## 5. Interface do Usuário (Frontend React)

### 5.1 Modal de Gerenciamento (`ManageQuickAccessModal.tsx`)

O modal de gerenciamento passará por melhorias significativas:

#### A. Formulário Inteligente (Criação + Edição)
- Estado de edição `editingDoc: ProjectDocument | null`.
- Quando `editingDoc` for nulo: o formulário exibe o título **"Adicionar Novo Acesso Rápido"** com o botão **"Adicionar"**.
- Quando um usuário clica no botão de edição (ícone `<Pencil size={16} />`) de um item da lista:
  - O formulário entra no modo **"Editar Acesso Rápido"**.
  - Os campos (Título, URL, Arquivo PDF e Categoria) são preenchidos com os valores atuais.
  - O botão principal muda para **"Salvar Alterações"** e surge um botão **"Cancelar Edição"**.
- Campo de **Grupo / Categoria**:
  - Input com sugestão automática baseada nas categorias já utilizadas nos atalhos do projeto (`datalist`).

#### B. Reordenação por Arraste (Drag & Drop com Alça de 6 Pontos)
- Cada item da lista no modal exibirá no lado esquerdo a alça de arraste: `<GripVertical size={16} className="drag-handle" />`.
- **Mecanismo HTML5 Drag & Drop Nativo**:
  - Atributo `draggable` habilitado no container do item.
  - Manipuladores de eventos: `onDragStart`, `onDragOver`, `onDragEnd`, `onDrop`.
  - Indicadores visuais: o item sendo arrastado recebe classe com opacidade reduzida e borda pontilhada primária; a área de soltura recebe destaque.
  - Ao soltar (`onDrop`), reordena o array `documents` localmente e envia a nova sequência de IDs para `projectService.reorderProjectDocuments(projectId, newOrderedIds)`.

### 5.2 Exibição por Grupos no Painel do Projeto (`ProjectDetailsPage.tsx`)

Na seção **Acesso Rápido** da página de detalhes do projeto:
- Agrupamento dos itens por categoria (`category`).
- Se houver categorias cadastradas:
  - Exibe seções com cabeçalhos sutis e elegantes (ex: 🏷️ *Reuniões*, 🏷️ *Modelos de Artigo*, 🏷️ *Links Úteis*).
  - Atalhos sem categoria são exibidos no grupo inicial/padrão.
- Mantém estilo minimalista e dinâmico, compatível com o tema visual do Emma's Librarian.

---

## 6. Plano de Testes & Garantia de Qualidade (F.I.R.S.T.)

Para atender rigorosamente aos critérios do `AGENTS.md`:

### 6.1 Testes de Unidade do Banco de Dados (`electron/database/__tests__/DatabaseAdapter.test.ts`)
- `updateProjectDocument`: verifica alteração correta de título, URL e categoria.
- `reorderProjectDocuments`: verifica se a consulta `getProjectDocuments` retorna os itens na nova ordem exata definida por `position`.
- `category`: verifica inserção e filtro por categoria.

### 6.2 Testes da Camada IPC (`electron/ipc/__tests__/ipcRegistries.test.ts`)
- Teste dos endpoints `project:documents:update` e `project:documents:reorder`.

### 6.3 Testes dos Fakes do Frontend (`src/services/__tests__/fakes/FakeProjectService.ts`)
- Implementar as funções `updateProjectDocument` e `reorderProjectDocuments` na classe `FakeProjectService` mantendo sincronização de estado em memória para que os testes de componentes funcionem com fidelidade.

### 6.4 Testes de Componentes React (`src/components/__tests__/ManageQuickAccessModal.test.tsx`)
- Renderização inicial da lista de acessos rápidos com os ícones de alça (`GripVertical`).
- Teste do fluxo de edição: clicar no botão de editar, modificar o título e salvar.
- Teste de criação de um item com grupo/categoria.
- Teste do evento de drag and drop simulando a reordenação de dois itens.

---

## 7. Roteiro de Execução Passo a Passo

| Etapa | Descrição | Arquivos Envolvidos |
| :--- | :--- | :--- |
| **Etapa 1** | Atualização dos Schemas e Migrações SQLite | `electron/types.ts`<br>`src/types/index.ts`<br>`electron/database/DatabaseAdapter.ts` |
| **Etapa 2** | Implementação dos Métodos CRUD e Transação de Reordenação | `DatabaseAdapter.ts`<br>`DatabaseAdapter.test.ts` |
| **Etapa 3** | Expansão dos Canais IPC e Serviços do Frontend | `ipcRegistries.ts`<br>`ipcRegistries.test.ts`<br>`ProjectServiceInterface.ts`<br>`api.ts`<br>`FakeProjectService.ts` |
| **Etapa 4** | Refatoração do Modal com Edição, Drag & Drop e Categorias | `ManageQuickAccessModal.tsx`<br>`ManageQuickAccessModal.test.tsx` |
| **Etapa 5** | Atualização da Exibição na Página do Projeto | `ProjectDetailsPage.tsx`<br>`ProjectDetailsPage.test.tsx` |
| **Etapa 6** | Atualização do Changelog e Incremento de Versão (v1.1.18) | `package.json`<br>`ChangelogModal.tsx` |
| **Etapa 7** | Validação com Suíte Completa de Testes (`npm run test`) | Suíte total de testes |

---

## 8. Considerações de Usabilidade e Estética Visual

- **Ícone Drag Handle**: Utilizar o ícone de seis pontos `<GripVertical size={16} />` da biblioteca `lucide-react`, estilizado com `cursor: grab`, alterando para `cursor: grabbing` durante a interação.
- **Categorias Personalizadas**: Suporte a digitação livre de nome de categoria com auto-completar inteligente baseado nos grupos já existentes no mesmo projeto.
- **Animações e Transições**: Transição suave ao reordenar e alternar entre o modo de criação e o modo de edição no modal.
