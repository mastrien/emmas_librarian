import sqlite3
import os

class DatabaseManager:
    def __init__(self, db_path: str):
        self.db_path = db_path
        self._initialize_db()

    def _get_connection(self):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _initialize_db(self):
        # Path to schema.sql relative to this file
        schema_path = os.path.join(os.path.dirname(__file__), "schema.sql")
        with open(schema_path, "r") as f:
            schema_script = f.read()

        with self._get_connection() as conn:
            conn.executescript(schema_script)

    def create_project(self, name: str) -> int:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("INSERT INTO projects (name) VALUES (?)", (name,))
            return cursor.lastrowid

    def get_project(self, project_id: int):
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM projects WHERE id = ?", (project_id,))
            row = cursor.fetchone()
            return dict(row) if row else None
