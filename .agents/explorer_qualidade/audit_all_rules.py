import os, sys, re, json

REPO_ROOT = r"c:\root_lab\antigravity\emmas_librarian"

target_dirs = [
    os.path.join(REPO_ROOT, "emmas_librarian", "electron"),
    os.path.join(REPO_ROOT, "emmas_librarian", "src"),
]

source_files = []
for td in target_dirs:
    for root, dirs, files in os.walk(td):
        dirs[:] = [d for d in dirs if d not in ['node_modules', 'dist', 'dist-electron', 'coverage', 'dev_data']]
        for f in files:
            if f.endswith(('.ts', '.tsx', '.js', '.jsx')):
                source_files.append(os.path.join(root, f))

# 1. Rule 5: Strict Typing violations (any, Dict, untyped)
typing_violations = []
for f in source_files:
    rel = os.path.relpath(f, REPO_ROOT).replace("\\", "/")
    if "__tests__" in rel or ".test." in rel:
        continue
    with open(f, 'r', encoding='utf-8', errors='ignore') as fp:
        lines = fp.readlines()
    for idx, line in enumerate(lines, 1):
        s = line.strip()
        if s.startswith("//") or s.startswith("*") or s.startswith("/*"):
            continue
        # check explicit any, Dict, dict, Object, Function, as any
        if re.search(r'(:\s*any\b|\bas\s+any\b|<any>|:\s*Dict\b|:\s*dict\b|any\[\]|:\s*Object\b|:\s*Function\b)', line):
            typing_violations.append({
                "file": rel,
                "line": idx,
                "code": s
            })

# 2. Rule 4: Generic names (data, handler, Manager, etc.)
generic_name_violations = []
for f in source_files:
    rel = os.path.relpath(f, REPO_ROOT).replace("\\", "/")
    if "__tests__" in rel or ".test." in rel:
        continue
    with open(f, 'r', encoding='utf-8', errors='ignore') as fp:
        lines = fp.readlines()
    for idx, line in enumerate(lines, 1):
        s = line.strip()
        if s.startswith("//") or s.startswith("*"):
            continue
        # Search declarations of variables, parameters, functions, classes
        m = re.search(r'\b(const|let|var|function|class|interface|type)\s+([a-zA-Z0-9_]*)\b', line)
        if m:
            var_name = m.group(2)
            if var_name.lower() in ['data', 'handler', 'manager', 'mgr', 'info', 'item', 'res', 'req', 'obj']:
                generic_name_violations.append({
                    "file": rel,
                    "line": idx,
                    "name": var_name,
                    "code": s
                })

# 3. Rule 1: Functions > 20 lines or < 4 lines
function_violations = []
for f in source_files:
    rel = os.path.relpath(f, REPO_ROOT).replace("\\", "/")
    if "__tests__" in rel or ".test." in rel:
        continue
    with open(f, 'r', encoding='utf-8', errors='ignore') as fp:
        lines = fp.readlines()
    
    # Simple brace parsing to locate functions
    i = 0
    while i < len(lines):
        line = lines[i]
        # Match function definition patterns
        m = re.search(r'(async\s+)?(function\s+([a-zA-Z0-9_]+)|const\s+([a-zA-Z0-9_]+)\s*=\s*(async\s*)?\([^)]*\)|([a-zA-Z0-9_]+)\s*\([^)]*\)\s*(:\s*[^={]+)?\s*\{)', line)
        if m and '{' in line and not line.strip().startswith('//'):
            func_name = m.group(3) or m.group(4) or m.group(6) or "anonymous"
            start_line = i + 1
            depth = line.count('{') - line.count('}')
            j = i + 1
            while j < len(lines) and depth > 0:
                depth += lines[j].count('{') - lines[j].count('}')
                j += 1
            end_line = j
            func_len = end_line - start_line + 1
            
            if func_len > 20:
                function_violations.append({
                    "file": rel,
                    "function": func_name,
                    "start_line": start_line,
                    "end_line": end_line,
                    "length": func_len,
                    "type": "TOO_LONG (>20 lines)"
                })
            elif func_len < 4 and not ("=>" in line or "interface" in line or "type " in line or "get " in line or "set " in line):
                function_violations.append({
                    "file": rel,
                    "function": func_name,
                    "start_line": start_line,
                    "end_line": end_line,
                    "length": func_len,
                    "type": "TOO_SHORT (<4 lines)"
                })
            i = max(i + 1, j)
        else:
            i += 1

# 4. Rule 7: Nested conditionals (> 2 levels of indentation)
nested_conditional_violations = []
for f in source_files:
    rel = os.path.relpath(f, REPO_ROOT).replace("\\", "/")
    if "__tests__" in rel or ".test." in rel:
        continue
    with open(f, 'r', encoding='utf-8', errors='ignore') as fp:
        lines = fp.readlines()
    for idx, line in enumerate(lines, 1):
        s = line.strip()
        if s.startswith("//") or s.startswith("*"):
            continue
        # Count leading spaces
        indent = len(line) - len(line.lstrip(' '))
        # If line starts with if, else if, for, while, switch and indent >= 6 spaces (3 levels of 2-space indent or > 2 nested blocks)
        if re.match(r'^(if|else if|for|while|switch)\b', s) and indent >= 6:
            nested_conditional_violations.append({
                "file": rel,
                "line": idx,
                "indent_spaces": indent,
                "code": s
            })

print(f"Typing violations: {len(typing_violations)}")
print(f"Generic name declarations: {len(generic_name_violations)}")
print(f"Function length violations: {len(function_violations)}")
print(f"Nested conditionals violations: {len(nested_conditional_violations)}")

results = {
    "typing_violations": typing_violations,
    "generic_name_violations": generic_name_violations,
    "function_violations": function_violations,
    "nested_conditional_violations": nested_conditional_violations
}

with open(os.path.join(REPO_ROOT, ".agents", "explorer_qualidade", "audit_details.json"), "w", encoding="utf-8") as fp:
    json.dump(results, fp, indent=2)

print("Saved audit_details.json")
