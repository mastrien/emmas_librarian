import sqlite3
import re

def extract_strings(filename, min_length=20):
    with open(filename, 'rb') as f:
        data = f.read()
    
    decoded = data.decode('utf-8', errors='replace')
    chunks = re.split(r'[\x00-\x09\x0b-\x1f\ufffd]+', decoded)
    return list(set(c.strip() for c in chunks if len(c.strip()) >= min_length))

def get_known_texts():
    conn = sqlite3.connect('emma.db')
    cursor = conn.cursor()
    known = []
    
    tables_cols = [
        ('project_diary', 'content'),
        ('annotations', 'content_markdown'),
        ('highlights', 'content_text'),
        ('articles', 'title'),
        ('articles', 'abstract'),
        ('articles', 'ai_summary'),
        ('projects', 'writing_pad')
    ]
    
    for t, c in tables_cols:
        try:
            cursor.execute(f"SELECT {c} FROM {t}")
            for row in cursor.fetchall():
                if row[0]: known.append(row[0])
        except Exception as e:
            print(f"Skipping {t}.{c}: {e}")
            
    conn.close()
    return known

def main():
    strings = extract_strings('emma.db', 20)
    known_texts = get_known_texts()
    
    unknown = []
    for s in strings:
        # Check if s is a substring of any known text
        # We also check if s is mostly digits or non-alphabetical to reduce noise
        alpha_chars = sum(c.isalpha() for c in s)
        if alpha_chars < len(s) * 0.5:
            continue
            
        found = False
        for kt in known_texts:
            if s in kt:
                found = True
                break
        if not found:
            unknown.append(s)
            
    # sort by length descending to see the biggest chunks of lost text
    unknown.sort(key=len, reverse=True)
    
    with open('recovered.txt', 'w', encoding='utf-8') as f:
        for s in unknown:
            f.write(s + "\n" + "="*80 + "\n")
    print(f"Wrote {len(unknown)} recovered string candidates to recovered.txt")

if __name__ == "__main__":
    main()
