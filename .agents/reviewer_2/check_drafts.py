import os
import re
import sys

sys.stdout.reconfigure(encoding='utf-8')

AGENTS_DIR = r"c:\root_lab\antigravity\emmas_librarian\.agents"

def check_all_drafts():
    print("=== INSPECTING WORKER DRAFTS (FASE 0 TO 10) ===")
    
    for p in range(11):
        draft_path = os.path.join(AGENTS_DIR, f"phase_{p}_worker", "draft.md")
        if not os.path.exists(draft_path):
            print(f"Fase {p}: draft.md NOT FOUND at {draft_path}")
            continue
            
        with open(draft_path, "r", encoding="utf-8") as f:
            text = f.read()
            
        lines = text.splitlines()
        size = len(text.encode("utf-8"))
        
        # Check mandatory elements in draft
        has_titulo = bool(re.search(r"^#+\s*Fase\s+\d+", text, re.MULTILINE))
        has_posicao = bool(re.search(r"Posi[çc][ãa]o", text, re.IGNORECASE))
        has_resumo = bool(re.search(r"Resumo\s+Executivo", text, re.IGNORECASE))
        has_detalhamento = bool(re.search(r"Detalhamento\s+Profundo", text, re.IGNORECASE))
        mermaid_count = len(re.findall(r"```mermaid\s*\n(.*?)\n```", text, re.DOTALL))
        table_count = len(re.findall(r"(\|[^\n]+\|\n\|[\s\-:|]+\|\n(?:\|[^\n]+\|\n?)+)", text))
        code_count = len(re.findall(r"```(?:typescript|js|javascript|json|bash|sh|txt|diff|html|css|yaml|yml|ts|python|py|sql)\s*\n(.*?)\n```", text, re.DOTALL | re.IGNORECASE))
        
        print(f"\nDraft Fase {p} ({size} bytes, {len(lines)} lines):")
        print(f"  - Título da Fase: {'OK' if has_titulo else 'MISSING'}")
        print(f"  - Posição: {'OK' if has_posicao else 'MISSING'}")
        print(f"  - Resumo Executivo: {'OK' if has_resumo else 'MISSING'}")
        print(f"  - Detalhamento Profundo: {'OK' if has_detalhamento else 'MISSING'}")
        print(f"  - Mermaid diagrams: {mermaid_count}")
        print(f"  - Tables: {table_count}")
        print(f"  - Code Snippets: {code_count}")

if __name__ == "__main__":
    check_all_drafts()
