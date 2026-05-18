# Emma's Librarian 📚

Emma's Librarian is a local tool designed to automate structured searches across multiple scientific databases (OpenAlex, Crossref) and facilitate paper reading with integrated visual highlighting and annotations.

## 🚀 Features

- **Multi-API Search:** Simultaneous search on OpenAlex and Crossref using a Visual Query Builder.
- **Smart Deduplication:** Automatically merges results found in multiple bases.
- **Local PDF Reader:** Integrated reader using `react-pdf-highlighter`.
- **Persistent Annotations:** Highlight text or areas in PDFs and save markdown notes locally.
- **Data Privacy:** All data (projects, articles, notes, PDFs) stays on your machine in a SQLite database.
- **Export:** Export your findings and metadata to CSV.

---

## 🛠️ Getting Started

### Prerequisites

- [Python 3.10+](https://www.python.org/downloads/)
- [Node.js 18+](https://nodejs.org/)

### 1. Setup the Backend

```bash
cd backend
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8000
```
The backend will automatically create a `emma.db` SQLite file and a `storage/pdfs` folder.

### 2. Setup the Frontend

Open a new terminal:
```bash
cd frontend
npm install
npm run dev
```
The application will be available at `http://localhost:5173`.

---

## 📂 Project Structure

- `backend/`: FastAPI application, SQLite database management, and API integrations.
- `frontend/`: React + TypeScript (Vite) application.
- `analysis_outputs/`: (Ignored by Git) Local storage for PDFs and research artifacts.
- `plans/`: Implementation roadmaps and architectural decisions.

## 📜 Procedures

This project follows strict development procedures:
- **TDD:** Mandatory Red-Green-Refactor cycle for new features.
- **Logging:** All progress is recorded in `log.md`.
- **Standards:** Check `procedimento.md` for more details.

---
*Created with care for researchers. Happy reading!*
