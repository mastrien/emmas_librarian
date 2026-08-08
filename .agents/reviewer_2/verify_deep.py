import os
import re
import sys

# Ensure UTF-8 output encoding for Windows stdout
sys.stdout.reconfigure(encoding='utf-8')

DIARY_PATH = r"c:\root_lab\antigravity\emmas_librarian\development_diary.md"
AGENTS_DIR = r"c:\root_lab\antigravity\emmas_librarian\.agents"

def parse_diary():
    with open(DIARY_PATH, "r", encoding="utf-8") as f:
        content = f.read()

    print(f"Total document length: {len(content)} characters, {len(content.splitlines())} lines.")

    # Find position of each phase heading
    phase_pattern = re.compile(r"^(#+\s*Fase\s+(\d+)\b.*)$", re.MULTILINE | re.IGNORECASE)
    matches = list(phase_pattern.finditer(content))

    print(f"\nFound {len(matches)} main phase headers:")
    for m in matches:
        print(f"  Line pos {m.start()}: '{m.group(1)}'")

    phases = {}
    for i in range(len(matches)):
        start = matches[i].start()
        end = matches[i+1].start() if i + 1 < len(matches) else len(content)
        phase_num = int(matches[i].group(2))
        phase_text = content[start:end]
        phases[phase_num] = {
            "header": matches[i].group(1),
            "text": phase_text
        }

    return content, phases

def inspect_phase_details(phases):
    print("\n================ DETAILED PHASE INSPECTION ================")
    for p_num in range(11):
        if p_num not in phases:
            print(f"FASE {p_num}: NOT FOUND!")
            continue
            
        p_data = phases[p_num]
        p_text = p_data["text"]
        header = p_data["header"]
        
        print(f"\n--- FASE {p_num} ---")
        print(f"Header: {header}")
        
        # Print all markdown headings inside this phase text
        headings = re.findall(r"^(#+\s+.*)", p_text, re.MULTILINE)
        print("  Headings inside phase:")
        for h in headings:
            print(f"    {h}")
        
        # Check mandatory elements
        # 1. Título da Fase
        title_match = re.search(r"^(#+\s*Fase\s+\d+[:\s\–\-]+[^\n]+)", p_text, re.MULTILINE)
        print(f"  1. Título da Fase: {'FOUND' if title_match else 'MISSING'} -> '{title_match.group(1) if title_match else ''}'")
        
        # 2. Posição
        pos_match = re.search(r"(Posi[çc][ãa]o[:\s]|Position:|\bPosi[çc][ãa]o\b)", p_text, re.IGNORECASE)
        print(f"  2. Posição: {'FOUND' if pos_match else 'MISSING'} -> '{pos_match.group(0) if pos_match else ''}'")
        
        # 3. Resumo Executivo
        resumo_match = re.search(r"Resumo\s+Executivo", p_text, re.IGNORECASE)
        print(f"  3. Resumo Executivo: {'FOUND' if resumo_match else 'MISSING'}")
        
        # 4. Detalhamento Profundo
        detalhe_match = re.search(r"Detalhamento\s+Profundo", p_text, re.IGNORECASE)
        print(f"  4. Detalhamento Profundo: {'FOUND' if detalhe_match else 'MISSING'}")
        
        # Sub-elements of Detalhamento Profundo
        mermaid_blocks = re.findall(r"```mermaid\s*\n(.*?)\n```", p_text, re.DOTALL)
        tables = re.findall(r"(\|[^\n]+\|\n\|[\s\-:|]+\|\n(?:\|[^\n]+\|\n?)+)", p_text)
        code_blocks = re.findall(r"```(?:typescript|js|javascript|json|bash|sh|txt|diff|html|css|yaml|yml|ts|python|py)\s*\n(.*?)\n```", p_text, re.DOTALL | re.IGNORECASE)
        
        print(f"     - Mermaid diagrams: {len(mermaid_blocks)}")
        print(f"     - Tables: {len(tables)}")
        print(f"     - Code snippets: {len(code_blocks)}")
        
        # Check for English "Position:" in this phase
        eng_pos = re.findall(r"Position:", p_text, re.IGNORECASE)
        if eng_pos:
            print(f"  WARNING: English 'Position:' found {len(eng_pos)} time(s)!")

def check_english_and_placeholders(content):
    print("\n================ ENGLISH & PLACEHOLDERS CHECK ================")
    
    pos_matches = [m.start() for m in re.finditer(r"Position:", content)]
    print(f"'Position:' matches at char offsets: {pos_matches}")
    for pos in pos_matches:
        snippet = content[max(0, pos-40):min(len(content), pos+40)].replace("\n", " ")
        print(f"  Context: ...{snippet}...")

    todo_matches = list(re.finditer(r"\bTODO\b", content))
    print(f"\n'TODO' matches: {len(todo_matches)}")
    for idx, m in enumerate(todo_matches):
        snippet = content[max(0, m.start()-40):min(len(content), m.end()+40)].replace("\n", " ")
        print(f"  [{idx+1}] ...{snippet}...")

if __name__ == "__main__":
    content, phases = parse_diary()
    inspect_phase_details(phases)
    check_english_and_placeholders(content)
