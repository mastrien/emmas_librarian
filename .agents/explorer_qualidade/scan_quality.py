import os
import re
import json

REPO_ROOT = r"c:\root_lab\antigravity\emmas_librarian"

def get_source_files():
    files = []
    search_dirs = [
        os.path.join(REPO_ROOT, "emmas_librarian", "electron"),
        os.path.join(REPO_ROOT, "emmas_librarian", "src"),
        os.path.join(REPO_ROOT, "agent"),
        os.path.join(REPO_ROOT, "analysis_outputs"),
        os.path.join(REPO_ROOT, "docs", "sqlite_recovery_process"),
    ]
    for d in search_dirs:
        if not os.path.exists(d):
            continue
        for root, dirs, filenames in os.walk(d):
            # Include test files or evaluate source code separately
            dirs[:] = [d for d in dirs if d not in ['node_modules', 'dist', 'dist-electron', 'coverage', 'dev_data', '.git']]
            for f in filenames:
                if f.endswith(('.ts', '.tsx', '.js', '.jsx', '.py')):
                    files.append(os.path.join(root, f))
    return files

def analyze_files():
    files = get_source_files()
    
    file_lengths = []
    large_files = []
    typing_issues = []
    generic_name_declarations = []
    function_length_violations = []
    nested_conditionals = []
    srp_issues = []

    func_start_regex = re.compile(
        r'^\s*(export\s+)?(async\s+)?(function\b|const\s+[a-zA-Z0-9_]+\s*=\s*(async\s*)?\(|([a-zA-Z0-9_]+)\s*\([^)]*\)\s*:\s*[^={]+\s*\{)'
    )

    for f in files:
        rel_path = os.path.relpath(f, REPO_ROOT).replace("\\", "/")
        is_test = "__tests__" in rel_path or ".test." in rel_path or ".spec." in rel_path
        
        with open(f, 'r', encoding='utf-8', errors='ignore') as fp:
            lines = fp.readlines()
        
        total_lines = len(lines)
        file_lengths.append({"file": rel_path, "lines": total_lines, "is_test": is_test})
        
        if total_lines >= 500:
            large_files.append({"file": rel_path, "lines": total_lines})

        # Track indentation & functions
        in_func = False
        func_name = ""
        func_start_line = 0
        func_brace_depth = 0
        
        for idx, line in enumerate(lines, start=1):
            stripped = line.strip()
            
            # Rule 5: Strict typing check
            if not stripped.startswith('//') and not stripped.startswith('*') and not stripped.startswith('/*'):
                if re.search(r'(:\s*any\b|\bas\s+any\b|<any>|:\s*Dict\b|:\s*dict\b|any\[\]|:\s*Object\b|:\s*Function\b)', line):
                    typing_issues.append({"file": rel_path, "line": idx, "code": stripped})
                
                # Untyped parameter/function checks in TS/TSX
                if f.endswith(('.ts', '.tsx')) and not is_test:
                    # check for function parameters without types, e.g. (req, res) => or function foo(a, b)
                    if re.search(r'function\s+[a-zA-Z0-9_]+\s*\(\s*[a-zA-Z0-9_]+\s*,\s*[a-zA-Z0-9_]+\s*\)', line) or \
                       re.search(r'\(\s*[a-zA-Z0-9_]+\s*\)\s*=>', line):
                        pass # keep eye on explicit untyped params

            # Rule 4: Generic names declaration
            if re.search(r'\b(const|let|var|function|class|interface|type)\s+([a-zA-Z0-9_]*(data|handler|Manager|manager)[a-zA-Z0-9_]*)\b', line):
                generic_name_declarations.append({"file": rel_path, "line": idx, "code": stripped})

            # Rule 7: Nested conditionals (>2 levels of indent inside logic block)
            # Count indent spaces (assuming 2 or 4 spaces per indent level)
            if not stripped.startswith('//') and not stripped.startswith('*') and not is_test:
                # Check nested control structures (if / else if / for / while / switch)
                indent_level = (len(line) - len(line.lstrip(' '))) // 2
                # If indent level > 4 (equivalent to > 2 nested blocks of 2 spaces or > 2 nested if statements)
                if (stripped.startswith('if ') or stripped.startswith('else if') or stripped.startswith('for ') or stripped.startswith('while ')) and indent_level >= 6:
                    nested_conditionals.append({"file": rel_path, "line": idx, "code": stripped, "indent_level": indent_level})

            # Rule 3: SRP checks (e.g. electron IPC or DB in UI components, or DB adapter having UI logic)
            if "src/components" in rel_path or "src/pages" in rel_path:
                if re.search(r'\b(better-sqlite3|DatabaseAdapter|knex|pg|prisma|sqlite3)\b', line):
                    srp_issues.append({"file": rel_path, "line": idx, "issue": "Direct database access or DB adapter in UI component", "code": stripped})
            if "electron/ipc" in rel_path:
                if re.search(r'SELECT\s+.*FROM|INSERT\s+INTO|UPDATE\s+.*SET|DELETE\s+FROM', line, re.IGNORECASE):
                    srp_issues.append({"file": rel_path, "line": idx, "issue": "Raw SQL query in IPC handler layer (should be in Repository)", "code": stripped})

    # Detailed function parse for line counts
    for f in files:
        rel_path = os.path.relpath(f, REPO_ROOT).replace("\\", "/")
        with open(f, 'r', encoding='utf-8', errors='ignore') as fp:
            content = fp.read()
            lines = content.split('\n')

        # Simple bracket-matching function boundary detector
        # Or parse block scopes
        i = 0
        while i < len(lines):
            line = lines[i]
            # match function decl or arrow function declaration
            m = re.search(r'(async\s+)?(function\s+([a-zA-Z0-9_]+)|const\s+([a-zA-Z0-9_]+)\s*=\s*(async\s*)?\([^)]*\)\s*(:\s*[^={]+)?\s*=>|([a-zA-Z0-9_]+)\s*\([^)]*\)\s*(:\s*[^={]+)?\s*\{)', line)
            if m and '{' in line:
                name = m.group(3) or m.group(4) or m.group(7) or "anonymous"
                start_line = i + 1
                open_braces = line.count('{') - line.count('}')
                j = i + 1
                while j < len(lines) and open_braces > 0:
                    open_braces += lines[j].count('{') - lines[j].count('}')
                    j += 1
                end_line = j
                length = end_line - start_line + 1
                
                # Check rule: 4-20 lines
                if length > 20 or (length < 4 and not ("get " in line or "set " in line or "=>" in line or "interface" in line)):
                    # exclude test files if desired, or mark them
                    function_length_violations.append({
                        "file": rel_path,
                        "function": name,
                        "start_line": start_line,
                        "end_line": end_line,
                        "length": length,
                        "is_test": "__tests__" in rel_path or ".test." in rel_path
                    })
                i = j - 1
            i += 1

    report = {
        "file_lengths": file_lengths,
        "large_files": large_files,
        "typing_issues": typing_issues,
        "generic_name_declarations": generic_name_declarations,
        "function_length_violations": function_length_violations,
        "nested_conditionals": nested_conditionals,
        "srp_issues": srp_issues
    }

    with open(os.path.join(REPO_ROOT, ".agents", "explorer_qualidade", "scan_report.json"), "w", encoding="utf-8") as out:
        json.dump(report, out, indent=2)

    print("Quality analysis report generated.")

if __name__ == "__main__":
    analyze_files()
