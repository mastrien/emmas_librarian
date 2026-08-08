import os
import re
import sys
import subprocess

DIARY_PATH = r'c:\root_lab\antigravity\emmas_librarian\development_diary.md'
REPO_PATH = r'c:\root_lab\antigravity\emmas_librarian'

def run_audit():
    results = {}
    print("=== STARTING VICTORY AUDIT CHECKS ===")
    
    # -------------------------------------------------------------
    # REQUIREMENT 1: File exists and is non-empty
    # -------------------------------------------------------------
    if not os.path.exists(DIARY_PATH):
        results['req1'] = (False, "File development_diary.md does not exist.")
    else:
        size = os.path.getsize(DIARY_PATH)
        if size == 0:
            results['req1'] = (False, "File development_diary.md is empty.")
        else:
            results['req1'] = (True, f"File exists, size = {size} bytes.")
    print(f"Req 1 (File exists and non-empty): {results['req1']}")

    with open(DIARY_PATH, 'r', encoding='utf-8') as f:
        text = f.read()

    lines = text.splitlines()

    # -------------------------------------------------------------
    # REQUIREMENT 3: Contains all 11 phases (Fase 0 to Fase 10) in exact chronological order, covering all ~182 commits
    # -------------------------------------------------------------
    phase_matches = list(re.finditer(r'^# Fase (\d+):[ \t]*(.*)$', text, re.MULTILINE))
    found_phase_nums = [int(m.group(1)) for m in phase_matches]
    expected_phase_nums = list(range(11))
    
    phase_order_ok = (found_phase_nums == expected_phase_nums)
    
    # Check commit coverage
    # Get total commits in repo
    git_commits = []
    try:
        res = subprocess.run(["git", "log", "--oneline"], cwd=REPO_PATH, capture_output=True, text=True, check=True)
        git_commits = res.stdout.strip().splitlines()
    except Exception as e:
        print("Git log error:", e)

    total_git_commits = len(git_commits)
    print(f"Total Git commits in repo: {total_git_commits}")

    # Check commit references in diary
    commit_hashes_in_diary = set(re.findall(r'\b[0-9a-f]{7,40}\b', text, re.IGNORECASE))
    print(f"Unique commit hashes found in diary: {len(commit_hashes_in_diary)}")

    # Check commit tables across all phases
    commits_mentioned_in_tables = re.findall(r'\|\s*([0-9a-f]{7})\s*\|', text, re.IGNORECASE)
    print(f"Commit hashes in summary tables: {len(set(commits_mentioned_in_tables))}")

    results['req3'] = (phase_order_ok, f"Phases found: {found_phase_nums}, Total git commits in repo: {total_git_commits}, Commit hashes referenced: {len(set(commits_mentioned_in_tables))}")
    print(f"Req 3 (11 phases chronological + ~182 commits): {results['req3']}")

    # -------------------------------------------------------------
    # REQUIREMENT 4: Mandatory elements per phase
    # (Título, Posição, Resumo Executivo, Detalhamento profundo com diagramas Mermaid, tabelas de estrutura e trechos de código)
    # -------------------------------------------------------------
    # Slice text by phase
    phase_sections = []
    for i in range(len(phase_matches)):
        start = phase_matches[i].start()
        end = phase_matches[i+1].start() if i+1 < len(phase_matches) else len(text)
        phase_sections.append((i, phase_matches[i].group(0), text[start:end]))

    phase_element_checks = []
    for p_num, header, p_text in phase_sections:
        # Elements check:
        # 1. Título
        has_title = bool(re.search(r'^# Fase \d+:\s*.+', p_text, re.MULTILINE))
        # 2. Posição
        has_position = f"Fase {p_num}" in header or f"Posição: Fase {p_num}" in p_text or f"Fase {p_num}" in p_text
        # 3. Resumo Executivo
        has_resumo = bool(re.search(r'Resumo Executivo', p_text, re.IGNORECASE))
        # 4. Detalhamento profundo:
        has_detalhamento = bool(re.search(r'Detalhamento Profundo', p_text, re.IGNORECASE))
        has_mermaid = "```mermaid" in p_text
        has_tables = "|" in p_text and "-|-" in p_text or "| ---" in p_text or "|---" in p_text
        has_code_snippets = bool(re.search(r'```(?:js|ts|javascript|typescript|sql|py|python|bash|json|sh|html|css|yaml|dockerfile|toml|xml|json5)', p_text, re.IGNORECASE))

        p_ok = has_title and has_position and has_resumo and has_detalhamento and has_mermaid and has_tables and has_code_snippets
        phase_element_checks.append({
            'phase': p_num,
            'ok': p_ok,
            'title': has_title,
            'position': has_position,
            'resumo': has_resumo,
            'detalhamento': has_detalhamento,
            'mermaid': has_mermaid,
            'tables': has_tables,
            'code': has_code_snippets
        })
        print(f"Phase {p_num} check: OK={p_ok} | Title={has_title}, Pos={has_position}, Resumo={has_resumo}, Detail={has_detalhamento}, Mermaid={has_mermaid}, Tables={has_tables}, Code={has_code_snippets}")

    all_phases_elements_ok = all(item['ok'] for item in phase_element_checks)
    results['req4'] = (all_phases_elements_ok, phase_element_checks)

    # -------------------------------------------------------------
    # REQUIREMENT 5: Valid Markdown formatting (code blocks, Mermaid syntax)
    # -------------------------------------------------------------
    # Check 5a: Unclosed code blocks
    code_block_fences = [i+1 for i, line in enumerate(lines) if line.strip().startswith('```')]
    unclosed_fences = len(code_block_fences) % 2 != 0
    print(f"Total ``` fence lines: {len(code_block_fences)} (even = valid: {not unclosed_fences})")

    # Check 5b: Extract and validate Mermaid blocks
    mermaid_blocks = re.findall(r'```mermaid\s*\n([\s\S]*?)\n```', text)
    print(f"Total Mermaid diagrams found: {len(mermaid_blocks)}")

    mermaid_syntax_errors = []
    for idx, block in enumerate(mermaid_blocks):
        block_lines = [l.strip() for l in block.strip().splitlines() if l.strip() and not l.strip().startswith('%%')]
        if not block_lines:
            mermaid_syntax_errors.append((idx, "Empty mermaid diagram"))
            continue
        first_word = block_lines[0].split()[0]
        valid_types = ['graph', 'flowchart', 'sequenceDiagram', 'classDiagram', 'stateDiagram', 'erDiagram', 'gantt', 'pie', 'gitGraph', 'C4Context']
        if not any(block_lines[0].startswith(vt) for vt in valid_types):
            mermaid_syntax_errors.append((idx, f"Unknown diagram type: {block_lines[0]}"))

    results['req5'] = (not unclosed_fences and len(mermaid_syntax_errors) == 0, {
        'unclosed_fences': unclosed_fences,
        'fence_count': len(code_block_fences),
        'mermaid_count': len(mermaid_blocks),
        'mermaid_errors': mermaid_syntax_errors
    })
    print(f"Req 5 (Valid Markdown & Mermaid): {results['req5']}")

    # -------------------------------------------------------------
    # REQUIREMENT 2: Written 100% in Portuguese
    # -------------------------------------------------------------
    # We will search for English prose indicators outside code blocks
    # Let's strip out code blocks first
    text_no_code = re.sub(r'```[\s\S]*?```', '', text)
    
    # Check for English headings, English executive summary phrases, etc.
    english_phrase_patterns = [
        r'\bExecutive Summary\b',
        r'\bDeep Detail\b',
        r'\bTable of Contents\b',
        r'\bArchitecture Diagram\b',
        r'\bDirectory Structure\b',
        r'\bKey Code Snippets\b',
        r'\bCommit Table\b',
        r'\bOverview\b',
        r'\bIntroduction\b',
        r'\bPhase \d+\b'
    ]
    english_matches = []
    for pat in english_phrase_patterns:
        m = re.findall(pat, text_no_code, re.IGNORECASE)
        if m:
            english_matches.extend(m)
            
    print(f"English heading matches outside code blocks: {english_matches}")
    results['req2'] = (len(english_matches) == 0, f"English heading matches: {english_matches}")

    return results

if __name__ == '__main__':
    run_audit()
