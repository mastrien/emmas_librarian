# Development Log - Emma's Librarian

## [2026-05-18 00:30] Cycle 3: API Integration and CSL-JSON Normalization
- **Objective:** Integrate with OpenAlex and Crossref APIs and implement a normalization layer to CSL-JSON.
- **Changes:**
    - Created `backend/app/services/api_integrator.py`.
    - Implemented `fetch_openalex` and `fetch_crossref` using `httpx`.
    - Implemented normalization methods for both APIs.
    - Created `backend/tests/test_api_integrator.py` with mocked API tests and normalization validation.
- **TDD Status:** Success (4 tests passing).
- **Decisions:** 
    - Used `httpx.AsyncClient` for non-blocking API calls.
    - Standardized normalization to CSL-JSON to ensure internal data consistency.
    - Added basic author name splitting (Given/Family) for OpenAlex display names.
- **Difficulties:** Mocking async HTTP responses required careful handling of the `json()` method in `AsyncMock`.

## [2026-05-18 00:10] Cycle 2: Query Translation Module
- **Objective:** Implement the translation of "Visual Blocks" from the frontend into the specific syntaxes of OpenAlex and Crossref.
- **Changes:**
    - Created `backend/app/services/query_translator.py`.
    - Created `backend/tests/test_query_translator.py` with validation for both APIs.
- **TDD Status:** Success (4 tests passing).
- **Decisions:** 
    - Standardized a JSON input format for filters (`field`, `value`, `type`).
    - OpenAlex uses the `filter` query parameter with `.search` and operators like `:>`.
    - Crossref uses a mix of query parameters (e.g., `query.title`) and the `filter` parameter (e.g., `from-pub-date`).
- **Difficulties:** None. The logic is extensible for more fields in the future.

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
