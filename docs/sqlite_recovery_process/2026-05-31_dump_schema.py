import sqlite3
import json

def get_schema():
    conn = sqlite3.connect('emma.db')
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
    tables = [row['name'] for row in cursor.fetchall()]
    
    schema = {}
    for table in tables:
        cursor.execute(f"PRAGMA table_info({table});")
        columns = [row['name'] for row in cursor.fetchall()]
        schema[table] = columns
        
        try:
            cursor.execute(f"SELECT COUNT(*) FROM {table};")
            count = cursor.fetchone()[0]
            schema[table + "_count"] = count
        except:
            pass
            
    print("=== SCHEMA ===")
    print(json.dumps(schema, indent=2))
    conn.close()

if __name__ == "__main__":
    get_schema()
