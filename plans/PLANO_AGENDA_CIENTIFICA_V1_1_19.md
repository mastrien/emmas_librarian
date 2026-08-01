# Plano de Implementação: Agenda Científica Aprimorada (v1.1.19) 📅🔬

Este documento especifica o plano de implementação ajustado para a versão **v1.1.19** do **Emma's Librarian**. A principal funcionalidade desta versão é a transformação do calendário atual (que apenas indica atividade de diário) em uma **Agenda Científica Aprimorada**, focada no **registro e gerenciamento manual** de eventos científicos como prazos de submissão (*Call for Papers*), inscrições em congressos, *camera-ready*, datas de conferências e edições especiais de periódicos.

---

## 1. Escopo e Diretrizes da Versão v1.1.19

Em acordo com o direcionamento do projeto, a versão **v1.1.19** focará estritamente no **cadastro e gerenciamento manual** de eventos pelo usuário. Avaliações de integrações com APIs externas ou importações automáticas de feeds iCal (.ics) foram postergadas para versões futuras.

### 1.1 Funcionalidades Chave (Inserção Manual)
- **Gerenciamento Completo (CRUD Manual)**: Criar, visualizar, editar, alterar status (*Pendente*, *Concluído*, *Cancelado*) e excluir eventos científicos.
- **Vínculo Flexível de Projeto**: Possibilidade de associar o evento a um projeto específico da biblioteca ou mantê-lo como um evento global/geral.
- **Categorização por Tipo de Evento**:
  - `submission` (Submissão de Trabalho / Call for Papers)
  - `abstract` (Envio de Resumo)
  - `registration` (Inscrição no Evento / Congresso)
  - `camera_ready` (Versão Final / Camera-Ready)
  - `conference` (Data do Congresso / Evento)
  - `journal_special_issue` (Edição Especial de Periódico)
  - `other` (Outros Prazos Acadêmicos)
- **Lembretes e Antecedência**: Notificações visuais e banners de alerta no Dashboard com antecedência configurável (ex: 3 dias antes do prazo).

---

## 2. Modelagem do Banco de Dados (SQLite)

### 2.1 Tabela `scientific_events`
Tabela focada no armazenamento dos eventos cadastrados manualmente.

```sql
CREATE TABLE IF NOT EXISTS scientific_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    venue TEXT,               -- Nome da Conferência ou Periódico (ex: "NeurIPS 2026", "Revista X")
    event_type TEXT NOT NULL CHECK(event_type IN ('submission', 'abstract', 'registration', 'camera_ready', 'conference', 'journal_special_issue', 'other')),
    event_date TEXT NOT NULL, -- Formato YYYY-MM-DD
    event_time TEXT,          -- Formato HH:MM (opcional)
    description TEXT,
    url TEXT,                 -- Link para a chamada / site do evento
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'completed', 'cancelled')),
    reminder_days_before INTEGER DEFAULT 3,
    color TEXT DEFAULT '#3b82f6',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_events_date ON scientific_events(event_date);
CREATE INDEX IF NOT EXISTS idx_events_project ON scientific_events(project_id);
```

---

## 3. Arquitetura e Contratos TypeScript

### 3.1 Interfaces de Tipos (`src/types/index.ts` e `electron/types.ts`)

```typescript
export type EventType =
  | 'submission'
  | 'abstract'
  | 'registration'
  | 'camera_ready'
  | 'conference'
  | 'journal_special_issue'
  | 'other';

export type EventStatus = 'pending' | 'completed' | 'cancelled';

export interface ScientificEvent {
  id: number;
  project_id?: number | null;
  title: string;
  venue?: string;
  event_type: EventType;
  event_date: string; // YYYY-MM-DD
  event_time?: string;
  description?: string;
  url?: string;
  status: EventStatus;
  reminder_days_before: number;
  color?: string;
  created_at?: string;
  updated_at?: string;
}
```

### 3.2 Interface do Serviço (`ScientificEventServiceInterface.ts`)

Conforme estipulado no `AGENTS.md`, o serviço deve ser injetado através de uma interface isolada.

```typescript
export interface ScientificEventFilter {
  project_id?: number | null;
  start_date?: string;
  end_date?: string;
  event_type?: EventType;
  status?: EventStatus;
}

export interface ScientificEventServiceInterface {
  createEvent(event: Omit<ScientificEvent, 'id' | 'created_at' | 'updated_at'>): Promise<ScientificEvent>;
  updateEvent(id: number, patch: Partial<ScientificEvent>): Promise<ScientificEvent>;
  deleteEvent(id: number): Promise<boolean>;
  getEvents(filter?: ScientificEventFilter): Promise<ScientificEvent[]>;
}
```

---

## 4. Canais IPC e Comunicação

Definição dos canais em `electron/ipc/ipcRegistries.ts`:

- `IpcChannel.SCIENTIFIC_EVENT_CREATE` (`scientific_event:create`): Cria um novo evento.
- `IpcChannel.SCIENTIFIC_EVENT_UPDATE` (`scientific_event:update`): Atualiza dados/status de um evento existente.
- `IpcChannel.SCIENTIFIC_EVENT_DELETE` (`scientific_event:delete`): Remove um evento.
- `IpcChannel.SCIENTIFIC_EVENT_LIST` (`scientific_event:list`): Consulta eventos com filtros.

---

## 5. Interface do Usuário (UI/UX)

### 5.1 Componentes Modulares (< 500 linhas cada)

1. **`DashboardCalendar.tsx` (Atualizado)**:
   - Integração das marcas de diário (ponto verde) com as etiquetas coloridas dos eventos manuais.
   - Indicadores visuais de contagem de eventos por dia.
   - Popover / Modal ao clicar em um dia específico para visualizar e adicionar diários/eventos daquela data.

2. **`ScientificAgendaView.tsx` (Novo Componente / Visualização)**:
   - Visualização expandida da agenda com modos **Mês**, **Semana** e **Lista de Prazos**.
   - Filtro por Projeto, por Tipo de Evento e por Status (*Pendente / Concluído*).

3. **`EventFormModal.tsx` (Novo Componente)**:
   - Formulário limpo para inclusão e edição manual de eventos.
   - Campos: Título, Evento/Revista, Tipo, Data/Hora, Vínculo de Projeto, URL, Cor e Lembrete.

4. **`DeadlineBanner.tsx` / Alertas de Lembrete**:
   - Card no Dashboard destacando os prazos que vencem nos próximos 7 a 14 dias.

---

## 6. Estratégia de Testes (F.I.R.S.T & AGENTS.md)

1. **Testes Unitários de Serviço (`ScientificEventService.test.ts`)**:
   - CRUD completo usando SQLite em memória.
   - Filtragem por datas, status e projeto.
2. **Mocks Nomeados (`FakeScientificEventService.ts`)**:
   - Injeção da classe fake nos testes de interface gráfica.
3. **Testes de Componentes React (`DashboardCalendar.test.tsx`, `EventFormModal.test.tsx`)**:
   - Verificação da renderização de emblemas de evento no calendário.
   - Teste de inclusão, edição e exclusão via modal.

---

## 7. Cronograma de Execução e Checkpoints

- **Fase 1**: Atualização da tabela `scientific_events` no SQLite.
- **Fase 2**: Implementação do `ScientificEventService` + `FakeScientificEventService` com testes unitários.
- **Fase 3**: Implementação dos handlers IPC no Electron.
- **Fase 4**: Atualização do `DashboardCalendar` e criação dos componentes `EventFormModal` e `ScientificAgendaView`.
- **Fase 5**: Banners de lembrete no Dashboard, verificação final com `npm test` e `npm run typecheck`.

---
*Plano reajustado com foco exclusivo na entrada manual de eventos científicos.*
