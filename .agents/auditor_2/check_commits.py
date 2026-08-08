import subprocess

def run_cmd(cmd):
    result = subprocess.run(cmd, capture_output=True, text=True, shell=True, cwd=r"c:\root_lab\antigravity\emmas_librarian")
    return result.stdout.strip()

commits_raw = run_cmd('git log --reverse --format="%h %H %s"').splitlines()

for idx in [74, 75, 76, 77, 78, 85]:
    c = commits_raw[idx-1]
    print(f"Commit {idx}: {c}")

