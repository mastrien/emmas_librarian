import subprocess

def run_cmd(cmd):
    result = subprocess.run(cmd, capture_output=True, text=True, shell=True, cwd=r"c:\root_lab\antigravity\emmas_librarian")
    return result.stdout.strip()

commits_raw = run_cmd('git log --reverse --format="%h %H %s"').splitlines()

print("--- Real Git Commits 72 to 91 ---")
for idx in range(72, 92):
    c = commits_raw[idx-1]
    print(f"Index {idx:2d}: {c}")

