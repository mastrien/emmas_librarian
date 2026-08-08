import re
import sys

sys.stdout.reconfigure(encoding='utf-8')

with open(r"c:\root_lab\antigravity\emmas_librarian\development_diary.md", "r", encoding="utf-8") as f:
    text = f.read()

mermaid_blocks = re.findall(r"```mermaid\s*\n(.*?)\n```", text, re.DOTALL)
print(f"Total Mermaid diagrams in development_diary.md: {len(mermaid_blocks)}")

for idx, block in enumerate(mermaid_blocks):
    print(f"\n================ MERMAID DIAGRAM #{idx+1} ================")
    print(block.strip())
