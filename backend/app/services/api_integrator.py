import httpx
from typing import List, Dict, Any

class ApiIntegrator:
    OPENALEX_URL = "https://api.openalex.org/works"
    CROSSREF_URL = "https://api.crossref.org/works"

    async def fetch_openalex(self, filter_str: str) -> List[Dict[str, Any]]:
        async with httpx.AsyncClient() as client:
            response = await client.get(self.OPENALEX_URL, params={"filter": filter_str})
            if response.status_code == 200:
                return response.json().get("results", [])
            return []

    async def fetch_crossref(self, params: Dict[str, Any]) -> List[Dict[str, Any]]:
        async with httpx.AsyncClient() as client:
            response = await client.get(self.CROSSREF_URL, params=params)
            if response.status_code == 200:
                return response.json().get("message", {}).get("items", [])
            return []

    def normalize_openalex(self, raw: Dict[str, Any]) -> Dict[str, Any]:
        doi = raw.get("doi", "")
        if doi and "doi.org/" in doi:
            doi = doi.split("doi.org/")[-1]
            
        authors = []
        for auth in raw.get("authorships", []):
            name = auth.get("author", {}).get("display_name", "")
            if name:
                parts = name.split(" ")
                if len(parts) > 1:
                    authors.append({"given": " ".join(parts[:-1]), "family": parts[-1]})
                else:
                    authors.append({"family": name})
        
        return {
            "id": raw.get("id"),
            "type": "article-journal", # Default for now
            "title": raw.get("title"),
            "DOI": doi,
            "issued": {"date-parts": [[raw.get("publication_year")]]},
            "author": authors
        }

    def normalize_crossref(self, raw: Dict[str, Any]) -> Dict[str, Any]:
        title = raw.get("title", [""])[0]
        
        return {
            "id": raw.get("DOI"), # Use DOI as ID for Crossref
            "type": "article-journal",
            "title": title,
            "DOI": raw.get("DOI"),
            "issued": raw.get("issued"),
            "author": raw.get("author", [])
        }
