# Plano: Múltiplas Interfaces (App, CLI e Mobile)

Análise de viabilidade e plano em etapas para que a plataforma seja usada pelo app desktop, por um CLI e por um app mobile, usando princípios de Clean Architecture sem reescrever o projeto.

## 1. Objetivo
Separar o núcleo (regras e dados da biblioteca) do shell Electron, de modo que o mesmo núcleo atenda várias interfaces:
- **App desktop** (atual, Electron + React).
- **CLI** (comandos como `emma search`, `emma export`).
- **Mobile**, inicialmente como controle remoto / leitura do desktop pela rede local.

## 2. Conclusão
Viável em etapas. O CLI é barato depois da extração do núcleo. O mobile como cliente remoto é razoável. O mobile com dados próprios e sincronização é o ponto caro, por causa do schema.

## 3. Estado atual (o que ajuda)
- Os handlers em `electron/ipc/handlers/` são finos: chamam `db.método()` ou um service. O registrador é injetável (`IpcRegistrar = Pick<IpcMain,'handle'>`).
- A lógica fica em repositories e services sem UI (`SearchOrchestrator`, `QueryTranslator`, `ExportService`, `AIService`, `EmbeddingService`, `PdfExtractor`, `VectorStore`).
- Há uma raiz de composição única, `setupIpcRegistries` (`electron/ipc/ipcRegistries.ts`).
- O contrato está centralizado em `IpcChannel` (cerca de 259 usos). O renderer fala com o backend só por `window.electronAPI.invoke`, via `src/services/api.ts` e `IProjectService`.
- O formato `.emmapcarc` e o backup com merge já funcionam como troca de dados por arquivo.

## 4. Obstáculos
1. **Acoplamento ao Electron no núcleo.** Cerca de 19 arquivos importam `electron`. Parte é UI legítima (`dialog`, `shell`, `clipboard`, `BrowserWindow`). Parte é domínio: `SettingsRepository` usa `safeStorage`; `ProjectSyncService` e `BackupService` usam `dialog` e `app`; o `userData` vem de `app.getPath`.
2. **I/O dentro dos handlers.** `articleHandlers` e `pdfHandlers` fazem `fs`, caminhos e armazenamento de PDF. Precisa descer para services.
3. **`better-sqlite3` com dois ABIs** (Node e Electron). Um CLI em Node puro funciona, mas complica o empacotamento.
4. **Schema sem suporte a sync.** IDs `INTEGER AUTOINCREMENT` (sem UUID), `updated_at` em poucas tabelas, `deleted_at` em algumas.
5. **Trabalho pesado fica no desktop:** PDF, embeddings, extração por IA e busca nas APIs não devem rodar no celular.

## 5. Arquitetura-alvo

```
core/  (TypeScript puro, sem import 'electron')
  domínio + casos de uso → repositories, services
  portas: SecretStore, FilePicker, AppPaths, Clock
adapters/
  electron/ → ipcMain + safeStorage + dialog   (app atual)
  cli/      → Node; SecretStore em arquivo/keyring
  http/     → servidor na LAN (REST/WebSocket) para o mobile
```

Peça central: um **registro de comandos neutro de transporte** (`canal → função(args)`). O `handle()` atual já é quase isso. Cada transporte (IPC, CLI, HTTP) expõe o mesmo registro.

## 6. Etapas
1. **Extrair as portas** (`SecretStore`, `FilePicker`, `AppPaths`) e fazer o núcleo não importar `electron`. Travar com regra de lint ou teste.
2. **Mover o I/O dos handlers para services** e criar o registro de comandos neutro.
3. **CLI** sobre o núcleo, com poucos comandos de leitura para validar a arquitetura. Se o app estiver aberto, o CLI deve falar com ele via servidor local, para evitar conflito de acesso ao SQLite.
4. **Servidor HTTP na LAN** com pareamento, expondo um subconjunto (leitura e anotação).
5. **Decidir sobre offline** só depois de usar a etapa 4.

Cada etapa deve manter os testes verdes e seguir a ordem do projeto: testes antes do refactor, commits semânticos.

## 7. Mobile

### 7.1 Telas
As telas do desktop não se reaproveitam: o mobile é um controle remoto com outra navegação. O que se reaproveita é o pacote compartilhado: tipos (`src/types`), cliente de API, `IProjectService`, contextos e hooks sem DOM, utilitários como `citationService` e o contrato `IpcChannel`.

### 7.2 Tecnologia
- **PWA servida pelo desktop:** a mais barata, sem loja. Limites de armazenamento (iOS) e de acesso a arquivos.
- **Capacitor:** passo seguinte se a PWA ficar curta; reaproveita tudo.
- **React Native ou nativo:** só se a experiência com PDF exigir.
- **Leitura de PDF é requisito** do mobile (autor, 2026-10-10). Escrita de anotações e marca-texto em PDF fica **fora de escopo**: `react-pdf-highlighter` foi feito para mouse e a seleção de texto por toque é difícil. Basta um visualizador de PDF (pdf.js) somente leitura, que exibe as marcações já existentes.

### 7.3 Modelos de dados
| | Cliente remoto | Leitura offline | Offline com sync |
|---|---|---|---|
| Dados | só no desktop | cópia somente leitura no celular | cópia editável nos dois lados |
| Sem o desktop | não funciona | lê | lê, anota e cria |
| Edições | direto no desktop | anotações novas voltam como itens acrescentados | mescladas com regra de conflito |
| Custo | baixo | médio (reaproveita o pacote `.emmapcarc`) | alto (migração de schema) |

Sync completo exige UUIDs, `updated_at` em todas as tabelas, marcadores de exclusão (tombstones) e política de conflito. Recomendação: começar por cliente remoto, com leitura ampla e escritas pontuais (ver 7.5). Leitura offline e sync completo só entram se aparecer necessidade de usar o mobile sem o desktop.

### 7.4 Segurança do servidor na LAN
- Desligado por padrão; ativado pelo usuário.
- Pareamento por QR code com token de uso único; depois, token por dispositivo.
- TLS com certificado autoassinado e *pinning* no pareamento.
- Chaves de API nunca saem do desktop; o mobile só envia comandos.
- Descoberta por mDNS ou IP digitado. Acesso fora da LAN (VPN, túnel) fica fora do escopo.

### 7.5 Escopo do mobile (decidido 2026-10-10)
- **Leitura:** quase tudo: projetos, artigos, status, categorias, diário, agenda, resultados de investigação e os PDFs.
- **Escrita:** diário, acesso rápido e categorização de artigos/PDFs. Nenhuma delas depende do leitor de PDF.
- **Fora de escopo:** anotações e marca-texto em PDF.
- Consequência: as escritas são poucas e de baixo conflito, o que reforça a recomendação de adiar o sync completo. O servidor HTTP precisa expor mais leitura que escrita, com as escritas numa lista explícita de canais permitidos.

### 7.6 Futuro distante: IA com tool calling sobre o CLI
Uma IA que chame o CLI da aplicação como ferramenta (tool calling) poderia dar ao mobile consultas em linguagem natural. Não é escopo atual, mas orienta o desenho do CLI desde já: comandos com saída estruturada (JSON), códigos de saída claros e erros com o valor e o formato esperado, o que também serve para scripts.

### 7.7 Versão inicial: visualizador de `.emmapcarc` + controle remoto (decidido 2026-10-10)
Resumo: o mobile v1 tem dois modos que compartilham o mesmo modelo de leitura.
1. **Controle remoto:** conectado ao desktop pela LAN (7.4), lê os dados ao vivo e faz as poucas escritas de 7.5.
2. **Visualizador de arquivo:** abre um `.emmapcarc` exportado pelo desktop e o navega somente leitura, sem o desktop por perto. É o "baixar para ler offline" sem migração de schema, e reaproveita o formato que já existe.

Pontos técnicos:
- O leitor de `.emmapcarc` no celular precisa descompactar o zip no navegador (a lib atual, `adm-zip`, é de Node), ler `project.json` e servir os PDFs e documentos do pacote.
- Os dois modos devem ler da mesma interface (por exemplo `ProjectReader`), com duas implementações: HTTP e arquivo. A UI mobile não sabe qual está usando.
- `project.json` hoje **não tem campo de versão** (confirmado em `ProjectSyncService.ts`). Como o celular vai ler arquivos gerados por versões diferentes do desktop, convém adicionar um `formatVersion` ao exportar e tratar a ausência como versão 1.
- Pacotes com muitos PDFs podem ser grandes; a exportação poderia permitir omitir PDFs.

## 8. Decisões registradas
- **Tauri: adiado.** O ganho de desempenho é incerto (o tempo provavelmente está em SQLite, PDF, embeddings, rede e pdf.js, que o Tauri não acelera). O custo seria alto: backend reescrito em Rust, webviews diferentes por plataforma (risco para o pdf.js e para o Linux, issue #17) e perda da infraestrutura de E2E (Playwright), do updater e dos testes de upgrade (#19, #20). A extração do núcleo mantém essa porta aberta sem custo.
- **Medir antes de trocar de shell.** Se houver queixa de desempenho, perfilar o app em um projeto grande e otimizar dentro do Electron (processo utilitário ou worker para embeddings e extração, carregamento sob demanda).
- **Sync offline completo: adiado** e provavelmente desnecessário: a v1 do mobile é visualizador de `.emmapcarc` + controle remoto (7.7).

## 9. Riscos
- A migração de schema para sync pode virar um projeto próprio.
- O release 1.2.0 foi retirado por falha na inicialização (issue #22). Mexer na composição e no acesso ao banco exige cuidado; os testes de upgrade de release são a rede de segurança.
- O servidor na LAN amplia a superfície de ataque; a segurança do item 7.4 é requisito, não opcional.

## 10. Respostas do autor e perguntas em aberto

**Respondido:**
- **Mobile (2026-10-10, corrige a resposta de 2026-10-09):** a leitura de PDF é importante e entra. A escrita de anotações em PDF é descartada. O mobile faz a esmagadora maioria das **leituras**; as **escritas** ficam restritas ao que não depende do leitor (ver 7.5).
- **CLI (2026-10-09): o máximo de comandos possível**, exceto o que não funciona bem em terminal, como marcar ou abrir um PDF. Implicação: o registro de comandos (seção 5) deve cobrir todos os canais de `IpcChannel`, e cada canal deve ser classificado como `cli` ou `somente-gui`. Diálogo, janela e leitor de PDF são `somente-gui`; onde um canal pedir um arquivo (`FilePicker`), o CLI recebe o caminho como argumento.
- **Desempenho (2026-10-09): nada urgente.** Só um desejo de otimizar memória no futuro. Não é pré-requisito da etapa 1 e não justifica trocar de shell.

- **Independência do mobile (2026-10-10):** não é objetivo. A versão inicial é só **outro cliente para ver no celular o que está no computador**: um visualizador de `.emmapcarc` que serve também como controle remoto. Independência só seria considerada se o agente com tool calling (7.6) der muito certo. "Acessar os dados" sem o desktop, no sentido de abrir um snapshot, é desejável (ver 7.7).

**Em aberto:**
- Nenhuma pergunta de escopo pendente. Pendências técnicas estão na seção 11.

## 11. Itens a verificar
- Adicionar `formatVersion` ao `project.json` do `.emmapcarc` (ver 7.7), com teste de leitura de arquivos antigos sem o campo.
- Escolher a biblioteca de zip para o navegador no mobile.
- `performance-tests/performance-harness.js` já sobe algo em `localhost:3001`; conferir o que ele faz e se serve de base para o servidor HTTP.
- Contagem exata e classificação dos imports de `electron` (UI legítima x domínio).
