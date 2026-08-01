# Original User Request

## Initial Request — 2026-07-29T21:41:18Z

Auditoria abrangente no projeto `emmas_librarian` dividida em quatro pilares principais (Desempenho, Testes, Qualidade de Código e Gestão de Erros), gerando relatórios detalhados na pasta `docs/auditoria`.

Working directory: c:\root_lab\antigravity\emmas_librarian
Integrity mode: development

## Requirements

### R1. Auditoria de Desempenho e Eficiência
Analisar gargalos de performance no frontend (React/Vite), backend (Node/Electron IPC/SQLite) e operações de IO/IA. Identificar queries lentas, re-renderizações desnecessárias, vazamentos de memória ou bloqueios no event loop.

### R2. Auditoria de Testes
Avaliar a suíte de testes (Vitest/Jest/Playwright se houver), cobertura de código, representatividade dos cenários de teste, presença de testes de regressão e cobertura de caminhos infelizes (operações com falha, inconsistência de rede/DB/APIs externas).

### R3. Auditoria de Qualidade de Código (Clean Code)
Avaliar legibilidade, adesão às regras do projeto (funções de 4-20 linhas, arquivos < 500 linhas, SRP), presença de código morto/não utilizado (dead code), duplicação de lógica e violação de tipagem (`any`, tipos genéricos e incompletos).

### R4. Auditoria de Gestão de Erros e UX de Exceções
Verificar se todas as exceções e rejeições de promessas são capturadas adequadamente no frontend e backend IPC, garantindo que erros sejam apresentados de forma amigável ao usuário na UI e que nenhum erro nativo/diálogo não tratado vaze para o usuário.

### R5. Elaboração dos Relatórios na Pasta `docs/auditoria`
Criar ou atualizar 4 relatórios completos na pasta `docs/auditoria` (um para cada um dos pilares acima: Desempenho, Cobertura/Testes, Qualidade de Código e Gestão de Erros), nomeados no formato `YYYY-MM-DD_<aspecto>.md`, cobrindo estado atual, pontos críticos e plano de mudanças propostas.

## Acceptance Criteria

### Desempenho e Eficiência
- [ ] Mapeamento completo dos pontos críticos de IO (SQLite, chamadas de API, leitor de PDF, RAG) e componentes UI com re-renders excessivos.
- [ ] Propostas claras e acionáveis de otimização de performance.

### Testes e Resiliência
- [ ] Diagnóstico da taxa de cobertura real e identificação de áreas/módulos sem cobertura ou com testes superficiais.
- [ ] Levantamento de caminhos infelizes (unhappy paths) não testados.

### Qualidade de Código
- [ ] Identificação de violações das regras do projeto (funções longas, arquivos > 500 linhas, SRP, duplicações).
- [ ] Mapeamento de imports/funções/variáveis não utilizadas.

### Gestão de Erros
- [ ] Verificação do tratamento de erros em IPC handlers, chamadas de IA e serviços de banco de dados.
- [ ] Confirmação de ausência de diálogos nativos/crash desorganizado vaziado para a UI.

### Relatórios em `docs/auditoria`
- [ ] 4 relatórios independentes e detalhados gerados na pasta `docs/auditoria` com prefixo `yyyy-mm-dd_`.
- [ ] Cada relatório deve conter: Estado Atual, Pontos Críticos e Mudanças Propostas.
