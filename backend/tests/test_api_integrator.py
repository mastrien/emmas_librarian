import pytest
from unittest.mock import AsyncMock, patch
from backend.app.services.api_integrator import ApiIntegrator

@pytest.mark.asyncio
async def test_fetch_openalex():
    integrator = ApiIntegrator()
    mock_response = AsyncMock()
    mock_response.json = lambda: {"results": [{"id": "W1", "title": "T1"}]}
    mock_response.status_code = 200
    
    with patch("httpx.AsyncClient.get", return_value=mock_response):
        results = await integrator.fetch_openalex("title.search:test")
        assert len(results) == 1
        assert results[0]["id"] == "W1"

@pytest.mark.asyncio
async def test_fetch_crossref():
    integrator = ApiIntegrator()
    mock_response = AsyncMock()
    mock_response.json = lambda: {"message": {"items": [{"DOI": "D1", "title": ["T1"]}]}}
    mock_response.status_code = 200
    
    with patch("httpx.AsyncClient.get", return_value=mock_response):
        results = await integrator.fetch_crossref({"query.title": "test"})
        assert len(results) == 1
        assert results[0]["DOI"] == "D1"

def test_normalize_openalex_to_csl():
    integrator = ApiIntegrator()
    raw_data = {
        "id": "https://openalex.org/W123",
        "doi": "https://doi.org/10.1000/123",
        "title": "Test Paper",
        "publication_year": 2021,
        "authorships": [
            {"author": {"display_name": "John Doe"}}
        ]
    }
    normalized = integrator.normalize_openalex(raw_data)
    
    assert normalized["title"] == "Test Paper"
    assert normalized["DOI"] == "10.1000/123"
    assert normalized["issued"]["date-parts"][0][0] == 2021
    assert normalized["author"][0]["family"] == "Doe"
    assert normalized["author"][0]["given"] == "John"

def test_normalize_crossref_to_csl():
    integrator = ApiIntegrator()
    raw_data = {
        "DOI": "10.1000/456",
        "title": ["Crossref Paper"],
        "issued": {"date-parts": [[2022, 5, 10]]},
        "author": [
            {"given": "Jane", "family": "Smith"}
        ]
    }
    normalized = integrator.normalize_crossref(raw_data)
    
    assert normalized["title"] == "Crossref Paper"
    assert normalized["DOI"] == "10.1000/456"
    assert normalized["issued"]["date-parts"][0][0] == 2022
    assert normalized["author"][0]["family"] == "Smith"
