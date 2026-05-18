# Development Log - Emma's Librarian

## [2026-05-18 02:00] Cycle 7: Article Listing & Project Dashboard
- **Objective:** Implement the dashboard and the detailed view of articles for each project.
- **Changes:**
    - Created `DashboardPage` to list all research projects.
    - Created `ProjectDetailsPage` with a searchable table of articles, displaying metadata and origin bases.
    - Updated `main.tsx` with routes for the new pages.
    - Added `getProject` and `getArticles` to the frontend `api.ts` service.
- **TDD Status:** UI flow verified through navigation logic.
- **Decisions:** 
    - Used `lucide-react` for consistent iconography.
    - Implemented a local search filter on the frontend for the article table.
    - Formatted DOI links and origin base tags for better readability.
- **Difficulties:** Handled JSON parsing of `base_origem` which is stored as a string in SQLite but needs to be an array in the UI.

## [2026-05-18 01:30] Cycle 6: Visual Query Builder & Project UI
- **Objective:** Create the frontend interface for creating projects and building queries visually.
- **Changes:**
    - Defined TypeScript interfaces for `Project`, `Article`, and `QueryBlock` in `frontend/src/types/index.ts`.
    - Created `frontend/src/services/api.ts` to interact with the backend.
    - Implemented `QueryBuilder` component for block-based search.
    - Created `NewProjectPage` to handle project creation and initial search triggering.
    - Set up `frontend/src/main.tsx` with React Router.
    - Implemented main FastAPI entry point in `backend/app/main.py` with CORS support.
- **TDD Status:** Backend integration tested via Frontend service layer logic.
- **Decisions:** 
    - Used inline styles for initial UI speed, will move to CSS later.
    - Enabled CORS on the backend to allow local frontend development.
    - Standardized error handling for project creation.
- **Difficulties:** Cleaned up Vite boilerplate to avoid TypeScript/Build errors.

## [2026-05-18 01:00] Cycle 5: Frontend Setup (React)
- **Objective:** Initialize the frontend project and set up basic structure.
- **Changes:**
    - Initialized React + TypeScript project with Vite in `frontend/`.
    - Installed core dependencies: `react-router-dom`, `axios`, `lucide-react`, `react-pdf-highlighter`.
    - Created frontend directory structure (`components`, `pages`, `services`, etc.).
- **TDD Status:** Pending (Frontend setup).
- **Decisions:** 
    - Using Vite for fast development and build.
    - Standardized directory structure for scalability.
- **Difficulties:** Vite installation required manual confirmation in the background turn (handled).

## [2026-05-18 00:55] Cycle 4: Search Orchestrator and Deduplication
- **Objective:** Coordinate the search process across multiple APIs, normalize results, and deduplicate articles before persisting them.
- **Changes:**
    - Created `backend/app/services/search_orchestrator.py`.
    - Implemented deduplication logic based on DOI and Title.
    - Updated `DatabaseManager` with `save_article` and `get_articles_by_project`.
    - Created `backend/tests/test_search_orchestrator.py` with integration tests.
    - Moved shared fixtures to `backend/tests/conftest.py`.
- **TDD Status:** Success (2 tests passing).
- **Decisions:** 
    - Deduplication uses DOI as the primary key and lowercase Title as the secondary key.
    - `base_origem` is stored as a JSON list to track which APIs provided the article.
    - `csl_json` is stored as a raw JSON blob to preserve all metadata.
- **Difficulties:** None.

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
