# Emma's Librarian 📚

Emma's Librarian is a local Desktop application designed to automate structured searches across multiple scientific databases (OpenAlex, Crossref) and facilitate paper reading with integrated visual highlighting and annotations.

## 🚀 Features

- **Multi-API Search:** Simultaneous search on OpenAlex and Crossref using a Visual Query Builder.
- **Smart Deduplication:** Automatically merges results found in multiple bases.
- **Local PDF Reader:** Integrated reader using `react-pdf-highlighter`.
- **Persistent Annotations:** Highlight text or areas in PDFs and save markdown notes locally.
- **Data Privacy:** All data (projects, articles, notes, PDFs) stays on your machine in a SQLite database inside the app's `userData` folder.
- **Export:** Export your findings and metadata to CSV.

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
- `frontend/electron/`: Electron main process, IPC handlers, and SQLite database management (`better-sqlite3`).
- `plans/`: Implementation roadmaps and architectural decisions.

## 📜 Procedures

This project follows strict development procedures:
- **TDD:** Mandatory Red-Green-Refactor cycle for new features.
- **Logging:** All progress is recorded in `log.md`.
- **Standards:** Check `procedimento.md` for more details.

---
*Created with care for researchers. Happy reading!*
