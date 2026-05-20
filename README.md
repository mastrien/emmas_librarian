# Emma's Librarian 📚

Emma's Librarian is a powerful local Desktop application designed to automate structured searches across multiple scientific databases and facilitate paper reading with integrated visual highlighting and annotations. It's built for researchers who need transparency, speed, and privacy in their systematic reviews.

## 🚀 Key Features

- **Multi-API Orchestration:** Simultaneous search across **OpenAlex**, **Crossref**, **Scopus**, and **Web of Science**.
- **Advanced Visual Query Builder:** Create complex queries using logical operators (AND/OR) and field filters (Title, Abstract, Authors) without writing syntax.
- **Project Search History:** Complete traceability of your research. Every search is saved with its unified query, translated syntax for each base, and detailed result breakdown.
- **Smart Deduplication:** Automatically merges results found in multiple databases using DOI and Title normalization.
- **Premium Local PDF Reader:** Integrated reader with visual highlighting (colors) and persistent markdown annotations.
- **Smart Result Summary:** Real-time feedback after searches, including base-specific error reporting (e.g., invalid API keys).
- **Data Privacy & Control:** All projects, articles, notes, and PDFs stay on your machine in a SQLite database.
- **Customization:** Support for Light/Dark themes and secure API key management for paid databases.
- **Export:** Export your project metadata and systematic findings to CSV.

---

## 🛠️ Getting Started

### Prerequisites

- [Node.js 18+](https://nodejs.org/)

### 1. Setup the Application

```bash
cd frontend
npm install
```

### 2. Run in Development Mode

```bash
npm run electron:dev
```
The application will open an Electron window and connect to the local Vite dev server.

### 3. Build for Production

```bash
npm run electron:build
```
This will compile the TypeScript code, bundle the React frontend, and generate an executable installer in the `release` folder.

---

## 📂 Project Structure

- `frontend/src/`: React + TypeScript (Vite) application for the UI.
- `frontend/electron/`: Electron main process, IPC handlers, and services:
  - `database/`: SQLite management with `better-sqlite3`.
  - `services/`: API integration (normalization, translation) and Search Orchestration.
- `plans/`: Implementation roadmaps and architectural decisions.

## 📜 Development Philosophy

This project follows strict development procedures to ensure research reliability:
- **Consistency:** Unified search translation ensures results are comparable across bases.
- **Transparency:** The user always sees exactly how their query was interpreted by each external service.
- **Privacy:** Local-first approach for all sensitive bibliographic data.

---
*Created with care for researchers. Happy reading!*
