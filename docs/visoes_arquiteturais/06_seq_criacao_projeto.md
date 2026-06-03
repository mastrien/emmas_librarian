# Visão 6 — Caso de Uso: Criação de um Projeto

> Diagrama de sequência mostrando o fluxo completo de criação de um novo projeto, desde o formulário até a persistência.

## Diagrama de Sequência

```mermaid
sequenceDiagram
    actor User as 👤 Usuário
    participant NP as NewProjectPage
    participant API as api.ts (projectService)
    participant PRE as preload.ts
    participant IPC as ipcMain (handlers.ts)
    participant DB as DatabaseManager
    participant SQLite as emma.db

    User->>NP: Preenche nome do projeto
    User->>NP: Clica em "Criar Projeto"
    
    NP->>API: projectService.createProject(name)
    API->>PRE: window.electronAPI.invoke('projects:create', name)
    PRE->>IPC: ipcRenderer.invoke('projects:create', name)
    
    IPC->>DB: db.createProject(name)
    DB->>SQLite: INSERT INTO projects (name) VALUES (?)
    SQLite-->>DB: { id, name, created_at }
    DB-->>IPC: project object
    
    IPC-->>PRE: project object
    PRE-->>API: project object
    API-->>NP: project object
    
    NP->>NP: navigate('/') via react-router
    
    Note over NP: DashboardPage carrega e exibe o novo projeto na lista
```

## Camadas Envolvidas

| Camada | Arquivo | Ação |
|---|---|---|
| UI | `NewProjectPage.tsx` | Formulário com campo de nome |
| Serviço Frontend | `api.ts` → `projectService.createProject()` | Encapsula IPC em Promise |
| IPC Bridge | `preload.ts` | `contextBridge` encaminha invoke |
| Handler | `handlers.ts` → `PROJECTS_CREATE` | Delega para DatabaseManager |
| Persistência | `DatabaseManager.createProject()` | INSERT no SQLite |
