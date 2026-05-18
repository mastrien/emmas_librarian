import pytest
from unittest.mock import AsyncMock, patch
from backend.app.services.search_orchestrator import SearchOrchestrator

@pytest.mark.asyncio
async def test_deduplication_logic():
    orchestrator = SearchOrchestrator(None) # No DB manager for this test
    
    results = [
        {"DOI": "10.1/abc", "title": "Paper 1", "author": [], "issued": {"date-parts": [[2021]]}, "base_origem": "OpenAlex"},
        {"DOI": "10.1/abc", "title": "Paper 1 (Diff Title)", "author": [], "issued": {"date-parts": [[2021]]}, "base_origem": "Crossref"},
        {"DOI": None, "title": "Paper 2", "author": [], "issued": {"date-parts": [[2022]]}, "base_origem": "OpenAlex"},
        {"DOI": "10.1/xyz", "title": "Paper 2", "author": [], "issued": {"date-parts": [[2022]]}, "base_origem": "Crossref"}
    ]
    
    deduplicated = orchestrator._deduplicate(results)
    
    # Paper 1 should be merged (DOI match)
    # Paper 2 should be merged (Title match)
    assert len(deduplicated) == 2
    
    # Check if base_origem is a list
    p1 = next(r for r in deduplicated if r["DOI"] == "10.1/abc")
    assert "OpenAlex" in p1["base_origem"]
    assert "Crossref" in p1["base_origem"]

@pytest.mark.asyncio
async def test_search_and_persist(db_manager):
    # This test will use a real (test) database
    from backend.app.services.query_translator import QueryTranslator
    from backend.app.services.api_integrator import ApiIntegrator
    
    orchestrator = SearchOrchestrator(db_manager)
    
    project_id = db_manager.create_project("Test Search")
    query_blocks = [{"field": "title", "value": "test", "type": "contains"}]
    
    # Mock API calls
    with patch("backend.app.services.api_integrator.ApiIntegrator.fetch_openalex", return_value=[{"id": "W1", "title": "T1", "doi": "D1", "publication_year": 2021}]), \
         patch("backend.app.services.api_integrator.ApiIntegrator.fetch_crossref", return_value=[{"DOI": "D1", "title": ["T1"], "issued": {"date-parts": [[2021]]}}]):
        
        count = await orchestrator.search_and_persist(project_id, query_blocks, limit=10)
        
        assert count == 1 # Only 1 unique article
        
        # Verify persistence
        articles = db_manager.get_articles_by_project(project_id)
        assert len(articles) == 1
        assert articles[0]["doi"] == "D1"
        assert "OpenAlex" in articles[0]["base_origem"]
        assert "Crossref" in articles[0]["base_origem"]
