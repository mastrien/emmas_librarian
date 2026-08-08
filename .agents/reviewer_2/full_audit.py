import os
import re
import sys

# Ensure UTF-8 output
sys.stdout.reconfigure(encoding='utf-8')

DIARY_PATH = r"c:\root_lab\antigravity\emmas_librarian\development_diary.md"
AGENTS_DIR = r"c:\root_lab\antigravity\emmas_librarian\.agents"

def full_audit():
    with open(DIARY_PATH, "r", encoding="utf-8") as f:
        content = f.read()

    print(f"=== FULL AUDIT OF DEVELOPMENT_DIARY.MD ===")
    print(f"File Size: {len(content.encode('utf-8'))} bytes")
    print(f"Total Lines: {len(content.splitlines())}")

    # Split document by main phase headings `# Fase X:`
    phase_matches = list(re.finditer(r"^(#\s+Fase\s+(\d+)[:\s\–\-]+.*)$", content, re.MULTILINE))
    print(f"\nMain Phase Headings Found: {len(phase_matches)}")

    phases = {}
    for i in range(len(phase_matches)):
        start = phase_matches[i].start()
        end = phase_matches[i+1].start() if i + 1 < len(phase_matches) else len(content)
        p_num = int(phase_matches[i].group(2))
        p_text = content[start:end]
        phases[p_num] = {
            "header": phase_matches[i].group(1),
            "text": p_text
        }

    # Verify all 11 phases (0 to 10) are present
    missing_phase_nums = [n for n in range(11) if n not in phases]
    if missing_phase_nums:
        print(f"CRITICAL ERROR: Missing phases: {missing_phase_nums}")
    else:
        print("PASS: All 11 phases (Fase 0 through Fase 10) are present.")

    print("\n--- CHECKING MANDATORY ELEMENTS FOR EACH PHASE ---")
    
    phase_audit_results = {}
    
    for p_num in range(11):
        if p_num not in phases:
            continue
            
        p_text = phases[p_num]["text"]
        header = phases[p_num]["header"]
        
        # Check mandatory elements:
        # 1. Título da Fase
        has_titulo = bool(re.search(r"^#\s+Fase\s+\d+[:\s\–\-]+.+", p_text, re.MULTILINE))
        
        # 2. Posição
        # Should be Portuguese "Posição" or "Posição:"
        pos_match = re.search(r"(\*\*Posi[çc][ãa]o\*\*:?|\bPosi[çc][ãa]o\b|Position:)", p_text)
        has_posicao = bool(pos_match)
        is_english_pos = bool(re.search(r"\bPosition:\b", p_text))
        
        # 3. Resumo Executivo
        has_resumo = bool(re.search(r"#+\s+.*Resumo\s+Executivo", p_text, re.IGNORECASE))
        
        # 4. Detalhamento Profundo
        has_detalhamento = bool(re.search(r"#+\s+.*Detalhamento\s+Profundo", p_text, re.IGNORECASE))
        
        # Check sub-elements inside Detalhamento Profundo
        mermaid_blocks = re.findall(r"```mermaid\s*\n(.*?)\n```", p_text, re.DOTALL)
        tables = re.findall(r"(\|[^\n]+\|\n\|[\s\-:|]+\|\n(?:\|[^\n]+\|\n?)+)", p_text)
        code_blocks = re.findall(r"```(?:typescript|js|javascript|json|bash|sh|txt|diff|html|css|yaml|yml|ts|python|py|sql)\s*\n(.*?)\n```", p_text, re.DOTALL | re.IGNORECASE)
        
        phase_audit_results[p_num] = {
            "header": header,
            "has_titulo": has_titulo,
            "has_posicao": has_posicao,
            "is_english_pos": is_english_pos,
            "has_resumo": has_resumo,
            "has_detalhamento": has_detalhamento,
            "mermaid_count": len(mermaid_blocks),
            "table_count": len(tables),
            "code_block_count": len(code_blocks)
        }
        
        print(f"\n[Fase {p_num}]: {header[:60]}...")
        print(f"  - Título da Fase: {'OK' if has_titulo else 'MISSING'}")
        print(f"  - Posição: {'OK' if has_posicao and not is_english_pos else ('ENGLISH Position:' if is_english_pos else 'MISSING')}")
        print(f"  - Resumo Executivo: {'OK' if has_resumo else 'MISSING'}")
        print(f"  - Detalhamento Profundo: {'OK' if has_detalhamento else 'MISSING'}")
        print(f"  - Diagramas Mermaid: {len(mermaid_blocks)}")
        print(f"  - Tabelas: {len(tables)}")
        print(f"  - Code Snippets: {len(code_blocks)}")

    print("\n--- CHECKING ENGLISH TERMS AND PLACEHOLDERS ---")
    
    # Check English headers or placeholders
    english_headers = [
        "Executive Summary", "Deep Dive", "Phase Title", "Position:",
        "TODO", "FIXME", "TBD", "INSERT_HERE", "Lorem ipsum", "[Draft]"
    ]
    
    eng_found = []
    for term in english_headers:
        matches = list(re.finditer(r"\b" + re.escape(term) + r"\b", content))
        if matches:
            eng_found.append((term, len(matches)))
            print(f"  Found '{term}': {len(matches)} time(s)")
            for m in matches[:5]:
                snippet = content[max(0, m.start()-30):min(len(content), m.end()+30)].replace("\n", " ")
                print(f"    Context: ...{snippet}...")
                
    if eng_found:
        print(f"\nEnglish/Placeholder terms detected: {eng_found}")
    else:
        print("PASS: No English headers or placeholders detected.")

    print("\n--- MERMAID DIAGRAM SYNTAX VERIFICATION ---")
    mermaid_blocks = re.findall(r"```mermaid\s*\n(.*?)\n```", content, re.DOTALL)
    print(f"Total Mermaid diagrams in file: {len(mermaid_blocks)}")
    
    mermaid_errors = []
    for idx, block in enumerate(mermaid_blocks):
        lines = [line.strip() for line in block.strip().splitlines() if line.strip() and not line.strip().startswith("%%")]
        if not lines:
            mermaid_errors.append((idx+1, "Empty diagram"))
            continue
        header = lines[0]
        # Check standard mermaid types
        known = ["graph", "flowchart", "sequenceDiagram", "classDiagram", "stateDiagram", "erDiagram", "gantt", "pie", "mindmap", "timeline", "C4Context", "architecture"]
        if not any(header.startswith(k) for k in known):
            mermaid_errors.append((idx+1, f"Unknown header '{header}'"))
        
        # Check for unclosed quotes
        for line_no, line in enumerate(lines, 1):
            if line.count('"') % 2 != 0:
                mermaid_errors.append((idx+1, f"Line {line_no} unbalanced quotes: '{line}'"))
                
    if mermaid_errors:
        print(f"FAIL: Mermaid diagram errors found: {mermaid_errors}")
    else:
        print(f"PASS: All {len(mermaid_blocks)} Mermaid diagrams are syntactically valid.")

if __name__ == "__main__":
    full_audit()
