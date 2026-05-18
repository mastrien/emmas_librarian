import pytest
import os
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
            pass
            
    manager = DatabaseManager(DB_PATH)
    yield manager
    
    # Teardown
    time.sleep(0.1)
    if os.path.exists(DB_PATH):
        try:
            os.remove(DB_PATH)
        except PermissionError:
            print(f"Warning: Could not remove {DB_PATH}")
