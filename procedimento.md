# Procedimentos de Desenvolvimento - Emma's Librarian

Este documento estabelece as diretrizes obrigatórias para o ciclo de vida de desenvolvimento do projeto.

---

## 1. Ciclo de TDD (Test-Driven Development)

Todo novo recurso ou correção de bug deve seguir rigorosamente o ciclo **Red-Green-Refactor**:

1.  **RED:** Escreva um teste unitário ou de integração que descreva a funcionalidade desejada. Execute o teste e certifique-se de que ele falha (visto que a implementação ainda não existe).
2.  **GREEN:** Escreva o código mínimo necessário para fazer o teste passar. Não se preocupe com a elegância do código neste estágio, apenas com a correção funcional.
3.  **REFACTOR:** Melhore a estrutura, legibilidade e performance do código implementado, garantindo que todos os testes continuem passando.

---

## 2. Manutenção do Log de Desenvolvimento (`log.md`)

O arquivo `log.md` na raiz do projeto serve como a memória viva da evolução do sistema.

-   **Política de Incremento:** Cada ciclo de desenvolvimento (uma tarefa, uma funcionalidade ou um dia de trabalho) deve ser registrado no topo do arquivo.
-   **Imutabilidade do Histórico:** **Nunca apague ou sobrescreva** os registros anteriores. O arquivo deve crescer acumulando o histórico completo do projeto.
-   **Estrutura de cada entrada:**
    -   Data e Hora.
    -   Objetivo do ciclo.
    -   Alterações realizadas (arquivos criados/modificados).
    -   Status dos testes (TDD).
    -   Dificuldades encontradas ou decisões técnicas tomadas.

---

## 3. Padrões de Código

-   **Backend (Python):** Seguir PEP 8. Utilizar tipagem estática (Type Hints).
-   **Frontend (React):** Componentes funcionais e Hooks. TypeScript obrigatório.
-   **Commits:** Mensagens claras e em inglês, descrevendo o *quê* e o *porquê* da mudança.
