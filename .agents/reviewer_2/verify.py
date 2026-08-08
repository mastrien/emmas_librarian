import os
import re
import sys

DIARY_PATH = r"c:\root_lab\antigravity\emmas_librarian\development_diary.md"
AGENTS_DIR = r"c:\root_lab\antigravity\emmas_librarian\.agents"

def verify_file_exists():
    if not os.path.exists(DIARY_PATH):
        print("FAIL: development_diary.md does not exist.")
        return False
    size = os.path.getsize(DIARY_PATH)
    print(f"PASS: development_diary.md exists ({size} bytes).")
    return True

def analyze_phases(text):
    print("\n--- ANALYZING PHASES ---")
    phases_found = []
    
    # Let's search for Phase headings
    # Expecting Fase 0 through Fase 10
    for i in range(11):
        pattern = re.compile(rf"#+.*Fase\s+{i}\b", re.IGNORECASE)
        matches = list(pattern.finditer(text))
        if matches:
            phases_found.append(i)
            print(f"Found Fase {i}: '{matches[0].group(0)}'")
        else:
            print(f"MISSING: Fase {i}")
            
    print(f"Phases found ({len(phases_found)}/11): {phases_found}")
    return len(phases_found) == 11

def check_mandatory_elements(text):
    print("\n--- CHECKING MANDATORY ELEMENTS FOR EACH PHASE ---")
    
    # Split document by Phase headings
    phase_splits = re.split(r"(?=(?:^|\n)#+\s+.*Fase\s+\d+)", text, flags=re.IGNORECASE)
    
    # Keep sections corresponding to phases
    phase_sections = []
    for section in phase_splits:
        if re.search(r"Fase\s+\d+", section, re.IGNORECASE):
            phase_sections.append(section)
            
    print(f"Total phase sections extracted: {len(phase_sections)}")
    
    all_valid = True
    for idx, section in enumerate(phase_sections):
        phase_num_match = re.search(r"Fase\s+(\d+)", section, re.IGNORECASE)
        phase_num = phase_num_match.group(1) if phase_num_match else str(idx)
        
        has_titulo = bool(re.search(r"#+\s+.*", section)) # Header line
        has_posicao = bool(re.search(r"Posi[çc][ãa]o|Fase\s+\d+", section, re.IGNORECASE))
        has_resumo = bool(re.search(r"Resumo\s+Executivo", section, re.IGNORECASE))
        has_detalhamento = bool(re.search(r"Detalhamento\s+Profundo", section, re.IGNORECASE))
        
        has_mermaid = "```mermaid" in section
        has_tabela = "|" in section # Markdown table indicator
        has_code_snippet = bool(re.search(r"```(?:typescript|js|javascript|json|bash|sh|txt|diff|html|css|yaml|yml)", section, re.IGNORECASE))
        
        status = []
        if not has_titulo: status.append("MISSING Título")
        if not has_posicao: status.append("MISSING Posição")
        if not has_resumo: status.append("MISSING Resumo Executivo")
        if not has_detalhamento: status.append("MISSING Detalhamento Profundo")
        if not has_mermaid: status.append("MISSING Diagrama Mermaid")
        if not has_tabela: status.append("MISSING Tabela de Estrutura")
        if not has_code_snippet: status.append("MISSING Snippet de Código")
        
        if status:
            print(f"Fase {phase_num}: ISSUES FOUND -> {', '.join(status)}")
            all_valid = False
        else:
            print(f"Fase {phase_num}: OK (All mandatory elements present)")
            
    return all_valid

def check_mermaid_diagrams(text):
    print("\n--- CHECKING MERMAID DIAGRAMS ---")
    mermaid_blocks = re.findall(r"```mermaid\s*\n(.*?)\n```", text, re.DOTALL)
    print(f"Found {len(mermaid_blocks)} Mermaid blocks in total.")
    
    valid_count = 0
    invalid_blocks = []
    
    for idx, block in enumerate(mermaid_blocks):
        lines = [line.strip() for line in block.strip().splitlines() if line.strip() and not line.strip().startswith("%%")]
        if not lines:
            print(f"Mermaid block #{idx+1} is EMPTY!")
            invalid_blocks.append((idx+1, "Empty diagram"))
            continue
            
        header = lines[0]
        # Check standard diagram types
        known_types = ["graph", "flowchart", "sequenceDiagram", "classDiagram", "stateDiagram", "erDiagram", "gantt", "pie", "mindmap", "timeline", "C4Context", "architecture"]
        if not any(header.startswith(kt) for kt in known_types):
            print(f"Mermaid block #{idx+1} unknown/invalid header: '{header}'")
            invalid_blocks.append((idx+1, f"Unknown header: '{header}'"))
            continue
            
        # Basic check for unclosed quotes or syntax errors
        quotes_count = block.count('"')
        if quotes_count % 2 != 0:
            print(f"Mermaid block #{idx+1} has odd number of double quotes!")
            invalid_blocks.append((idx+1, "Unbalanced double quotes"))
            continue
            
        valid_count += 1
        
    print(f"Valid Mermaid blocks: {valid_count}/{len(mermaid_blocks)}")
    return len(invalid_blocks) == 0

def check_language_and_placeholders(text):
    print("\n--- CHECKING LANGUAGE & UNTRANSLATED PLACEHOLDERS ---")
    
    placeholders = [
        "Executive Summary", "Deep Dive", "Phase Title", "Position:", 
        "TODO", "FIXME", "TBD", "INSERT_HERE", "Lorem ipsum", "[Draft]"
    ]
    
    found_placeholders = []
    for ph in placeholders:
        matches = list(re.finditer(re.escape(ph), text, re.IGNORECASE))
        if matches:
            found_placeholders.append((ph, len(matches)))
            print(f"FOUND PLACEHOLDER/ENGLISH TERM: '{ph}' ({len(matches)} occurrences)")
            
    if found_placeholders:
        print(f"FAIL: Untranslated or placeholder terms found: {found_placeholders}")
        return False
    else:
        print("PASS: No untranslated English section headers or placeholder terms found.")
        return True

def compare_with_worker_drafts(text):
    print("\n--- COMPARING WITH WORKER DRAFTS ---")
    missing_drafts = []
    divergent_drafts = []
    
    for i in range(11):
        draft_path = os.path.join(AGENTS_DIR, f"phase_{i}_worker", "draft.md")
        if not os.path.exists(draft_path):
            print(f"Warning: Worker draft file does not exist: {draft_path}")
            missing_drafts.append(draft_path)
            continue
            
        with open(draft_path, "r", encoding="utf-8") as f:
            draft_text = f.read()
            
        # Check key phrases or head of draft in consolidated document
        draft_lines = [l.strip() for l in draft_text.splitlines() if l.strip() and not l.startswith("#")]
        if draft_lines:
            sample_phrase = draft_lines[0][:50]
            if sample_phrase not in text:
                print(f"Fase {i} draft snippet not found in synthesized diary!")
                print(f"  Sample phrase looked for: '{sample_phrase}'")
                divergent_drafts.append(i)
            else:
                print(f"Fase {i} draft snippet verified present in diary.")
                
    if missing_drafts or divergent_drafts:
        print(f"Draft verification issues: missing={missing_drafts}, divergent={divergent_drafts}")
        return False
    return True

def run_all_checks():
    if not verify_file_exists():
        return
        
    with open(DIARY_PATH, "r", encoding="utf-8") as f:
        text = f.read()
        
    p_ok = analyze_phases(text)
    m_ok = check_mandatory_elements(text)
    d_ok = check_mermaid_diagrams(text)
    l_ok = check_language_and_placeholders(text)
    c_ok = compare_with_worker_drafts(text)
    
    print("\n================ VERIFICATION SUMMARY ================")
    print(f"All 11 Phases Present: {'YES' if p_ok else 'NO'}")
    print(f"Mandatory Elements Present: {'YES' if m_ok else 'NO'}")
    print(f"Mermaid Diagrams Valid: {'YES' if d_ok else 'NO'}")
    print(f"Language & Placeholders OK: {'YES' if l_ok else 'NO'}")
    print(f"Worker Draft Alignment OK: {'YES' if c_ok else 'NO'}")
    print("======================================================")

if __name__ == "__main__":
    run_all_checks()
