## 2026-07-29T21:42:03Z
Your working directory is: c:\root_lab\antigravity\emmas_librarian\.agents\explorer_qualidade
You are teamwork_preview_explorer investigating Code Quality & Clean Code (R3) for project emmas_librarian (at c:\root_lab\antigravity\emmas_librarian).

Task:
Perform a comprehensive code quality audit against the project rules in `c:\root_lab\antigravity\emmas_librarian\AGENTS.md`:
1. Check function length violations: functions > 20 lines or < 4 lines where inappropriate.
2. Check file size violations: files >= 500 lines.
3. Single Responsibility Principle (SRP): god files, mixed concerns (e.g. DB logic inside UI, IPC logic mixed with business rules).
4. Naming conventions: non-specific/generic names (`data`, `handler`, `Manager`), or names with > 5 grep hits.
5. Strict typing: check for `any`, `Dict`, untyped functions/parameters/return types, incomplete type definitions.
6. Code duplication: repeated patterns, un-extracted shared logic.
7. Nested conditionals: > 2 levels of indentation, lack of early returns.
8. Dead code: unused functions, unused imports, unused variables/types.

Document your findings thoroughly in:
- `c:\root_lab\antigravity\emmas_librarian\.agents\explorer_qualidade\analysis.md`
- `c:\root_lab\antigravity\emmas_librarian\.agents\explorer_qualidade\handoff.md`

Your handoff must include clear structured sections:
- Estado Atual (Overall code metrics, clean code compliance overview)
- Pontos Críticos (Specific lists of files, functions, lines violating rules with exact file:line references)
- Mudanças Propostas (Refactoring plan, SRP splits, typing fixes, cleanup steps)

Update progress.md in your working directory as you work. When finished, send a message to parent with your handoff path.
