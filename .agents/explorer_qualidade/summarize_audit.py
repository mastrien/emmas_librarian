import json, os, re

REPO_ROOT = r"c:\root_lab\antigravity\emmas_librarian"

with open(os.path.join(REPO_ROOT, ".agents", "explorer_qualidade", "audit_details.json"), "r", encoding="utf-8") as fp:
    data = json.load(fp)

print("=== TYPING VIOLATIONS SAMPLE (FIRST 25) ===")
for item in data["typing_violations"][:25]:
    print(f"{item['file']}:{item['line']} -> {item['code']}")

print("\n=== GENERIC NAME VIOLATIONS SAMPLE ===")
for item in data["generic_name_violations"][:25]:
    print(f"{item['file']}:{item['line']} -> Name: '{item['name']}' in code: {item['code']}")

print("\n=== TOP 25 LONGEST FUNCTIONS ===")
long_funcs = [f for f in data["function_violations"] if f["type"] == "TOO_LONG (>20 lines)"]
long_funcs.sort(key=lambda x: x["length"], reverse=True)
for item in long_funcs[:25]:
    print(f"{item['file']}:{item['start_line']}-{item['end_line']} -> Function: '{item['function']}' ({item['length']} lines)")

print("\n=== NESTED CONDITIONALS SAMPLE (FIRST 25) ===")
for item in data["nested_conditional_violations"][:25]:
    print(f"{item['file']}:{item['line']} (indent spaces: {item['indent_spaces']}) -> {item['code']}")

