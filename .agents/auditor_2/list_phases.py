import re

with open(r"c:\root_lab\antigravity\emmas_librarian\development_diary.md", "r", encoding="utf-8") as f:
    text = f.read()

# Find all lines starting with # Fase
phase_headers = [(i+1, line) for i, line in enumerate(text.splitlines()) if line.startswith('# Fase')]
print("Phase H1 headers:")
for line_num, header in phase_headers:
    print(f"Line {line_num}: {header}")

