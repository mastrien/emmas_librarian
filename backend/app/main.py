from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from backend.app.db.database import DatabaseManager
from backend.app.services.search_orchestrator import SearchOrchestrator
import os

app = FastAPI(title="Emma's Librarian API")

# CORS for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # For development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
    # We need a get_all_projects method in DB manager
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
    # Parse position_data back to dict
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
