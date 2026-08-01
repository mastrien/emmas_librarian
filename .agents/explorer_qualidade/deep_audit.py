import os, re, json

REPO_ROOT = r"c:\root_lab\antigravity\emmas_librarian"

# Excluded folders
EXCLUDES = ['node_modules', 'dist', 'dist-electron', 'coverage', 'dev_data', '.git']

def get_all_project_files():
    files = []
    for root, dirs, fnames in os.walk(REPO_ROOT):
        dirs[:] = [d for d in dirs if d not in EXCLUDES]
        for f in fnames:
            if f.endswith(('.ts', '.tsx', '.js', '.jsx', '.py')):
                files.append(os.path.join(root, f))
    return files

all_files = get_all_project_files()

print(f"Total source/script files found in repo: {len(all_files)}")

# Audit Rule 4: Grep hits for common variable/class/function names
generic_names = ['data', 'handler', 'Manager', 'manager', 'item', 'info', 'res', 'req']
grep_counts = {}
for name in ['data', 'handler', 'Manager', 'SyncService', 'DatabaseAdapter', 'api']:
    count = 0
    pattern = re.compile(r'\b' + re.escape(name) + r'\b')
    for f in all_files:
        with open(f, 'r', encoding='utf-8', errors='ignore') as fp:
            for line in fp:
                if pattern.search(line):
                    count += 1
    grep_counts[name] = count

print("\n=== GREP COUNTS FOR NAMES ===")
for name, cnt in grep_counts.items():
    print(f"Name '{name}': {cnt} occurrences across codebase")

# Audit Rule 8: Dead Code & Orphan Scripts
orphan_scripts = []
for f in all_files:
    rel = os.path.relpath(f, REPO_ROOT).replace("\\", "/")
    if rel.startswith("docs/sqlite_recovery_process/") or rel == "untranspile.py" or rel.startswith("analysis_outputs/convert_to_excel.py"):
        orphan_scripts.append(rel)

print("\n=== POTENTIAL ORPHAN / LEGACY SCRIPTS ===")
for s in orphan_scripts:
    print(f"Orphan script: {s}")

