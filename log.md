# Development Log - Emma's Librarian

## [2026-05-17 23:35] Cycle 1: Project Setup and Database Schema
- **Objective:** Initialize the backend project structure and create the SQLite database schema.
- **Changes:**
    - Created `backend/` directory.
    - Created `log.md` to track progress.
    - Initialized `backend/requirements.txt`.
    - Created `backend/app/db/schema.sql` with the finalized database structure.
    - Implemented `backend/app/db/database.py` for SQLite management.
    - Created `backend/tests/test_db.py` for database validation.
- **TDD Status:** Success (Tests passing for initialization and basic project creation).
- **Decisions:** 
    - Using FastAPI for the backend.
    - Raw SQL used for schema initialization to ensure exact matching with the requested structure.
    - DatabaseManager implemented with context managers for safe connection handling.
- **Difficulties:** PermissionError on Windows during test teardown (handled with explicit connection closing and minor delay).
