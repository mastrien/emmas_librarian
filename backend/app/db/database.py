import sqlite3
import os
import json

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

    def save_article(self, article_data: dict):
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO articles 
                (projeto_id, doi, titulo, autores, ano, query_origem, base_origem, csl_json)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                article_data["projeto_id"],
                article_data.get("doi"),
                article_data["titulo"],
                article_data.get("autores"),
                article_data.get("ano"),
                article_data.get("query_origem"),
                json.dumps(article_data.get("base_origem", [])),
                json.dumps(article_data.get("csl_json", {}))
            ))
            return cursor.lastrowid

    def get_articles_by_project(self, project_id: int):
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM articles WHERE projeto_id = ?", (project_id,))
            return [dict(row) for row in cursor.fetchall()]
