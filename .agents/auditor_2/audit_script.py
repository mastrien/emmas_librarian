import re
import subprocess

def run_cmd(cmd):
    result = subprocess.run(cmd, capture_output=True, text=True, shell=True, cwd=r"c:\root_lab\antigravity\emmas_librarian")
    return result.stdout.strip()

commits_raw = run_cmd('git log --reverse --format="%h %H %s"').splitlines()
real_commits = []
real_short_hashes = set()
real_full_hashes = set()

for idx, line in enumerate(commits_raw, 1):
    parts = line.split(' ', 2)
    short_hash = parts[0]
    full_hash = parts[1]
    subject = parts[2] if len(parts) > 2 else ""
    real_commits.append({
        'index': idx,
        'short': short_hash,
        'full': full_hash,
        'subject': subject
    })
    real_short_hashes.add(short_hash.lower())
    real_full_hashes.add(full_hash.lower())

with open(r"c:\root_lab\antigravity\emmas_librarian\development_diary.md", "r", encoding="utf-8") as f:
    lines = f.readlines()

hex_tokens = []
for line_num, line in enumerate(lines, 1):
    matches = re.findall(r'\b[0-9a-fA-F]{7,40}\b', line)
    for m in matches:
        m_lower = m.lower()
        # check if it matches any prefix of real commit hashes or exact real commit hash
        is_real = any(c['full'].startswith(m_lower) or c['short'].startswith(m_lower) for c in real_commits)
        if not is_real:
            # exclude hex color codes if preceeded by # (regex \b handles boundaries, but let's check)
            if not re.search(r'#' + m, line):
                hex_tokens.append((line_num, m, line.strip()))

print(f"Total invalid commit hash references found: {len(hex_tokens)}")
for line_num, token, line_text in hex_tokens[:40]:
    print(f"Line {line_num}: Token '{token}' -> {line_text[:100]}")

