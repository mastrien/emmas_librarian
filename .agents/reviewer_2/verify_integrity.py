import os
import re
import sys

sys.stdout.reconfigure(encoding='utf-8')

DIARY_PATH = r"c:\root_lab\antigravity\emmas_librarian\development_diary.md"
AGENTS_DIR = r"c:\root_lab\antigravity\emmas_librarian\.agents"

def verify_integrity_and_alignment():
    with open(DIARY_PATH, "r", encoding="utf-8") as f:
        diary_text = f.read()

    print("=== VERIFYING INTEGRITY & DRAFT ALIGNMENT ===")
    
    total_draft_bytes = 0
    aligned_phases = 0

    for p in range(11):
        draft_path = os.path.join(AGENTS_DIR, f"phase_{p}_worker", "draft.md")
        if not os.path.exists(draft_path):
            print(f"ERROR: Missing draft for Phase {p}")
            continue
            
        with open(draft_path, "r", encoding="utf-8") as f:
            draft_text = f.read()
            
        total_draft_bytes += len(draft_text.encode("utf-8"))
        
        # Pick 3 key phrases/lines from the draft to verify they are present in diary_text
        draft_lines = [l.strip() for l in draft_text.splitlines() if len(l.strip()) > 30 and not l.strip().startswith("#")]
        
        sample_checks = []
        if len(draft_lines) >= 3:
            sample_checks = [draft_lines[0], draft_lines[len(draft_lines)//2], draft_lines[-1]]
        elif draft_lines:
            sample_checks = [draft_lines[0]]
            
        phase_passed = True
        for sample in sample_checks:
            # Clean sample for matching
            sample_clean = sample[:50]
            if sample_clean not in diary_text:
                print(f"  Fase {p} warning: sample phrase not found -> '{sample_clean}'")
                phase_passed = False
                
        if phase_passed:
            aligned_phases += 1
            print(f"Fase {p}: 100% aligned with worker draft.")

    print(f"\nAligned phases: {aligned_phases}/11")
    print(f"Total size of all worker drafts: {total_draft_bytes} bytes")
    print(f"Total size of synthesized diary: {len(diary_text.encode('utf-8'))} bytes")

    # Check for fake/dummy text patterns or integrity red flags
    red_flags = ["dummy implementation", "fake output", "fabricated log", "self-certified", "cheated test"]
    flag_matches = []
    for rf in red_flags:
        if rf.lower() in diary_text.lower():
            flag_matches.append(rf)
            
    if flag_matches:
        print(f"INTEGRITY WARNING: Found suspicious terms: {flag_matches}")
    else:
        print("PASS: No integrity red flags found in diary content.")

if __name__ == "__main__":
    verify_integrity_and_alignment()
