import os, sys

REPO_ROOT = r"c:\root_lab\antigravity\emmas_librarian"

target_dirs = [
    os.path.join(REPO_ROOT, "emmas_librarian", "electron"),
    os.path.join(REPO_ROOT, "emmas_librarian", "src"),
]

large_files = []
all_files = []

for td in target_dirs:
    for root, dirs, files in os.walk(td):
        dirs[:] = [d for d in dirs if d not in ['node_modules', 'dist', 'dist-electron', 'coverage', 'dev_data']]
        for f in files:
            if f.endswith(('.ts', '.tsx', '.js', '.jsx')):
                path = os.path.join(root, f)
                rel = os.path.relpath(path, REPO_ROOT).replace("\\", "/")
                with open(path, 'r', encoding='utf-8', errors='ignore') as fp:
                    lines = fp.readlines()
                count = len(lines)
                all_files.append((rel, count))
                if count >= 500:
                    large_files.append((rel, count))

all_files.sort(key=lambda x: x[1], reverse=True)

print("=== ALL FILES BY LINE COUNT (TOP 30) ===")
for rel, count in all_files[:30]:
    print(f"{count:4d} lines: {rel}")

print("\n=== FILES >= 500 LINES ===")
if not large_files:
    print("None found!")
for rel, count in large_files:
    print(f"VIOLATION: {rel} ({count} lines)")

