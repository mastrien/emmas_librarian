import re
import subprocess

def run_cmd(cmd):
    result = subprocess.run(cmd, capture_output=True, text=True, shell=True, cwd=r"c:\root_lab\antigravity\emmas_librarian")
    return result.stdout.strip()

# Fetch git commits 1 to 182
commits_raw = run_cmd('git log --reverse --format="%h|%H|%s|%an|%ad" --date=iso').splitlines()
real_commits = {}
for idx, line in enumerate(commits_raw, 1):
    parts = line.split('|')
    real_commits[idx] = {
        'short': parts[0],
        'full': parts[1],
        'subject': parts[2],
        'author': parts[3] if len(parts) > 3 else "",
        'date': parts[4] if len(parts) > 4 else ""
    }

print(f"Total git commits loaded: {len(real_commits)}")

with open(r"c:\root_lab\antigravity\emmas_librarian\development_diary.md", "r", encoding="utf-8") as f:
    diary_text = f.read()
    diary_lines = diary_text.splitlines()

# ----------------------------------------------------
# CHECK 1: Commit Table Parsing & Hash Mismatches
# ----------------------------------------------------
print("\n--- CHECK 1: COMMIT HASH & MESSAGE INTEGRITY IN TABLES ---")

# Regex to match commit table rows like:
# | 74 | `0145cb4d` | João Pedro V | ... | `feat: ...` |
# | 1 | `9a7b2c3` | ...
table_row_pattern = re.compile(r'\|\s*(\d+)\s*\|\s*[`"]?([0-9a-fA-F]{7,40})[`"]?\s*\|\s*([^|]*)\|\s*([^|]*)\|\s*([^|]*)')

mismatches = []
table_commits_found = set()

for line_num, line in enumerate(diary_lines, 1):
    m = table_row_pattern.search(line)
    if m:
        c_num = int(m.group(1))
        c_hash = m.group(2).lower()
        c_author = m.group(3).strip()
        c_date = m.group(4).strip()
        c_msg = m.group(5).strip().strip('`')

        table_commits_found.add(c_num)

        if c_num in real_commits:
            real = real_commits[c_num]
            hash_match = real['full'].startswith(c_hash) or real['short'].startswith(c_hash)
            # compare commit subject similarity or start
            msg_match = c_msg.lower() in real['subject'].lower() or real['subject'].lower() in c_msg.lower()

            if not hash_match:
                mismatches.append({
                    'line': line_num,
                    'commit_num': c_num,
                    'type': 'FABRICATED_HASH',
                    'diary_hash': c_hash,
                    'real_hash': real['short'],
                    'diary_msg': c_msg,
                    'real_msg': real['subject']
                })
            elif not msg_match:
                mismatches.append({
                    'line': line_num,
                    'commit_num': c_num,
                    'type': 'FABRICATED_MESSAGE',
                    'diary_hash': c_hash,
                    'real_hash': real['short'],
                    'diary_msg': c_msg,
                    'real_msg': real['subject']
                })

print(f"Total commit table rows parsed: {len(table_commits_found)}")
print(f"Total mismatches (fabricated hash or message) found: {len(mismatches)}")
for m in mismatches[:20]:
    print(f"Line {m['line']} (Commit {m['commit_num']}): [{m['type']}] Diary hash `{m['diary_hash']}` vs Real `{m['real_hash']}` | Diary msg: '{m['diary_msg'][:40]}' vs Real: '{m['real_msg'][:40]}'")

# ----------------------------------------------------
# CHECK 2: Coverage 1 to 182
# ----------------------------------------------------
print("\n--- CHECK 2: COMMIT COVERAGE (1 TO 182) ---")
missing_commits = set(range(1, 183)) - table_commits_found
print(f"Total commits (1-182) listed in tables: {len(table_commits_found)}")
print(f"Missing commits from tables: {len(missing_commits)}")
if missing_commits:
    print(f"Missing commit IDs sample: {sorted(list(missing_commits))[:30]}")

# Also check for phase commit ranges mentioned in section headings
phase_sections = re.split(r'\n(?=# Fase \d+:)', diary_text)
print(f"\nTotal phase blocks split: {len(phase_sections)}")

# ----------------------------------------------------
# CHECK 3: 4 Mandatory Elements in Every Phase
# ----------------------------------------------------
print("\n--- CHECK 3: MANDATORY ELEMENTS PER PHASE ---")

for idx, sec in enumerate(phase_sections):
    if not sec.strip().startswith("# Fase"):
        continue
    first_line = sec.strip().splitlines()[0]

    has_title = bool(re.search(r'# Fase \d+:\s*(.+)', sec))
    has_position = bool(re.search(r'Fase \d+', first_line))
    has_resumo = "Resumo Executivo" in sec
    has_detalhamento = "Detalhamento Profundo" in sec or "Detalhamento profundo" in sec or "2. Detalhamento" in sec
    has_mermaid = "```mermaid" in sec
    has_table = "| " in sec and "---" in sec
    has_code_snippet = "```ts" in sec or "```typescript" in sec or "```python" in sec or "```sql" in sec or "```javascript" in sec or "```tsx" in sec or "```bash" in sec or "```json" in sec

    all_4_present = has_title and has_position and has_resumo and (has_detalhamento and has_mermaid and has_table and has_code_snippet)

    print(f"\n{first_line[:70]}")
    print(f"  - Title: {has_title}")
    print(f"  - Position: {has_position}")
    print(f"  - Resumo Executivo: {has_resumo}")
    print(f"  - Detalhamento Profundo: {has_detalhamento}")
    print(f"    * Mermaid Diagram: {has_mermaid}")
    print(f"    * Table: {has_table}")
    print(f"    * Code Snippet: {has_code_snippet}")
    print(f"  => PASS ALL 4 ELEMENTS: {all_4_present}")

