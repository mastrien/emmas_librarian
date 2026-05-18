import sqlite3
import os
import pytest
import time
from backend.app.db.database import DatabaseManager

DB_PATH = "test_emma.db"

@pytest.fixture
def db_manager():
    # Setup
    if os.path.exists(DB_PATH):
        try:
            os.remove(DB_PATH)
        except PermissionError:
            pass # Or handle retry
            
    manager = DatabaseManager(DB_PATH)
    yield manager
    
    # Teardown - Explicitly close any lingering connections if possible
    # In this case, manager doesn't hold a long-lived connection, 
    # but the test_database_initialization did.
    
    # Wait a tiny bit for SQLite to release the file handle
    time.sleep(0.1)
    if os.path.exists(DB_PATH):
        try:
            os.remove(DB_PATH)
        except PermissionError:
            print(f"Warning: Could not remove {DB_PATH}")

def test_database_initialization(db_manager):
    conn = sqlite3.connect(DB_PATH)
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
        tables = [row[0] for row in cursor.fetchall()]
        
        assert "projects" in tables
        assert "articles" in tables
        assert "annotations" in tables
        assert "highlights" in tables
    finally:
        conn.close()

def test_create_project(db_manager):
    project_id = db_manager.create_project("Test Project")
    assert project_id == 1
    
    project = db_manager.get_project(project_id)
    assert project["name"] == "Test Project"
