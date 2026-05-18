from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel
from typing import List, Optional
from backend.app.db.database import DatabaseManager
from backend.app.services.search_orchestrator import SearchOrchestrator
import os
import json
import io
import csv

app = FastAPI(title="Emma's Librarian API")

# CORS for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # For development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

STORAGE_DIR = "backend/storage/pdfs"
os.makedirs(STORAGE_DIR, exist_ok=True)

DB_PATH = "emma.db"
db = DatabaseManager(DB_PATH)
orchestrator = SearchOrchestrator(db)

class ProjectCreate(BaseModel):
    name: str

class SearchRequest(BaseModel):
    query_blocks: List[dict]
    limit: Optional[int] = 100

@app.get("/projects")
async def list_projects():
    with db._get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM projects ORDER BY data_criacao DESC")
        return [dict(row) for row in cursor.fetchall()]

@app.post("/projects")
async def create_project(project: ProjectCreate):
    project_id = db.create_project(project.name)
    return db.get_project(project_id)

@app.get("/projects/{project_id}")
async def get_project(project_id: int):
    p = db.get_project(project_id)
    if not p:
        raise HTTPException(status_code=404, detail="Projeto não encontrado")
    return p

@app.post("/projects/{project_id}/search")
async def search_articles(project_id: int, request: SearchRequest):
    p = db.get_project(project_id)
    if not p:
        raise HTTPException(status_code=404, detail="Projeto não encontrado")
    
    count = await orchestrator.search_and_persist(project_id, request.query_blocks, limit=request.limit)
    return {"count": count}

@app.get("/projects/{project_id}/articles")
async def list_articles(project_id: int):
    return db.get_articles_by_project(project_id)

@app.get("/projects/{project_id}/export")
async def export_project_csv(project_id: int):
    p = db.get_project(project_id)
    if not p:
        raise HTTPException(status_code=404, detail="Projeto não encontrado")
    
    articles = db.get_articles_by_project(project_id)
    
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["ID", "DOI", "Título", "Autores", "Ano", "Bases", "Status"])
    
    for a in articles:
        writer.writerow([
            a["id"],
            a["doi"],
            a["titulo"],
            a["autores"],
            a["ano"],
            a["base_origem"],
            a["status"]
        ])
    
    output.seek(0)
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode("utf-8-sig")),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=projeto_{project_id}_export.csv"}
    )

class AnnotationCreate(BaseModel):
    content: str

class HighlightCreate(BaseModel):
    color: str
    position_data: dict
    annotation_content: Optional[str] = None

@app.get("/articles/{article_id}")
async def get_article(article_id: int):
    a = db.get_article(article_id)
    if not a:
        raise HTTPException(status_code=404, detail="Artigo não encontrado")
    return a

@app.get("/articles/{article_id}/highlights")
async def list_highlights(article_id: int):
    highlights = db.get_highlights(article_id)
    for h in highlights:
        h["position_data"] = json.loads(h["position_data"])
    return highlights

@app.post("/articles/{article_id}/highlights")
async def create_highlight(article_id: int, highlight: HighlightCreate):
    annotation_id = None
    if highlight.annotation_content:
        annotation_id = db.save_annotation(article_id, highlight.annotation_content)
    
    h_id = db.save_highlight(
        article_id, 
        highlight.color, 
        json.dumps(highlight.position_data), 
        annotation_id
    )
    return {"id": h_id, "annotation_id": annotation_id}

@app.get("/articles/{article_id}/annotations")
async def list_annotations(article_id: int):
    return db.get_annotations(article_id)

@app.post("/articles/{article_id}/upload-pdf")
async def upload_pdf(article_id: int, file: UploadFile = File(...)):
    a = db.get_article(article_id)
    if not a:
        raise HTTPException(status_code=404, detail="Artigo não encontrado")
    
    file_extension = file.filename.split(".")[-1] if file.filename else "pdf"
    file_name = f"article_{article_id}.{file_extension}"
    file_path = os.path.join(STORAGE_DIR, file_name)
    
    with open(file_path, "wb") as buffer:
        buffer.write(await file.read())
        
    db.update_article_file_path(article_id, file_path)
    return {"message": "Upload concluído", "path": file_path}

@app.get("/articles/{article_id}/pdf")
async def serve_pdf(article_id: int):
    a = db.get_article(article_id)
    if not a or not a.get("local_file_path"):
        raise HTTPException(status_code=404, detail="Arquivo PDF não encontrado")
    
    return FileResponse(a["local_file_path"], media_type="application/pdf")
