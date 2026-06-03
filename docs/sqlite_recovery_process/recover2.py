import sqlite3
import re

def extract_strings(filename, min_length=20):
    with open(filename, 'rb') as f:
        data = f.read()
    
    decoded = data.decode('utf-8', errors='replace')
    chunks = re.split(r'[\x00-\x09\x0b-\x1f\ufffd]+', decoded)
    return list(set(c.strip() for c in chunks if len(c.strip()) >= min_length))

def get_diary_texts():
    conn = sqlite3.connect('emma.db')
    cursor = conn.cursor()
    cursor.execute("SELECT content FROM project_diary")
    known = [row[0] for row in cursor.fetchall() if row[0]]
    conn.close()
    return known

def main():
    strings = extract_strings('emma.db', 30)
    diary_texts = get_diary_texts()
    
    # We are looking for text that resembles a diary entry.
    # It should not contain '{' or '}' (json)
    # It should not be an exact substring of the known diary texts.
    # It should not be an article metadata or abstract.
    
    candidates = []
    for s in strings:
        if '{' in s or '}' in s or 'openalex' in s:
            continue
            
        # exclude if it's a known diary text
        if any(s in kt for kt in diary_texts) or any(kt in s for kt in diary_texts):
            continue
            
        # ensure it has a good amount of spaces and letters (like a normal text)
        spaces = s.count(' ')
        if spaces < 5:
            continue
            
        # check if it sounds like a diary or project update
        # We'll just collect anything that looks like normal text
        candidates.append(s)
        
    candidates.sort(key=len, reverse=True)
    
    with open('lost_diary_candidates.txt', 'w', encoding='utf-8') as f:
        for c in candidates:
            f.write(c + "\n\n" + "="*50 + "\n\n")

if __name__ == "__main__":
    main()
