# Relatório de Auditoria: Cobertura de Testes

## 1. Estado Atual
Foi executada a suíte de testes utilizando Vitest com V8 coverage. O resultado geral demonstra uma cobertura de cerca de **63.97%** das linhas de código.
- **O que está bem coberto:**
  - `ExportService.ts`: 100%
  - `SearchOrchestrator.ts`: 95.69%
  - `ApiIntegrator.ts`: 96.1%
- **O que está descoberto:**
  - `ipc/handlers.ts`: **0% de cobertura** (0 de 421 linhas testadas).
  - Componentes React no Frontend (nenhum relatório de teste para a pasta `src/`).

## 2. Pontos Críticos
- **Falha Completa em Testar a Camada IPC:** A camada `ipc/handlers.ts` atua como ponte entre a interface do usuário e o sistema (banco de dados, sistema de arquivos). Por não ter testes, mudanças nessa área podem quebrar toda a aplicação silenciosamente.
- **Baixa Cobertura em Serviços Chave:**
  - `AIService.ts` (57.8%): Funções vitais de inteligência artificial correm riscos de falhas silenciosas.
  - `DatabaseManager.ts` (60.18%): Consultas e migrações podem conter brechas não detectadas.
- **Falta de Testes no Frontend:** O comportamento do usuário, a renderização de estados complexos (como as abas de investigação em massa) e modais não possuem suíte de testes de interface.

## 3. Mudanças Propostas
- **Testes para a Camada IPC:** Escrever testes de unidade para `ipc/handlers.ts` utilizando mocks do objeto `ipcMain` do Electron, cobrindo sucesso e erros na comunicação interprocessual.
- **Testes de Integração e UI (React):** Introduzir o `React Testing Library` para simular interações de usuários nas páginas críticas (`ProjectDetailsPage`, `ArticleReaderPage`) e garantir que a interface responde corretamente a mudanças de estado.
- **Meta de Cobertura:** Configurar thresholds no arquivo `vitest.config.mts` exigindo no mínimo 80% de cobertura global para bloquear integrações (CI/CD) em caso de quebra dessa métrica.
- **Completar Testes Incompletos:** Melhorar a cobertura do `DatabaseManager.ts` incluindo fluxos de erro (ex: banco trancado) e aumentar a cobertura de fluxos complexos no `AIService.ts`.
