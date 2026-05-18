from typing import List, Dict, Any
from backend.app.services.query_translator import QueryTranslator
from backend.app.services.api_integrator import ApiIntegrator

class SearchOrchestrator:
    def __init__(self, db_manager):
        self.db_manager = db_manager
        self.translator = QueryTranslator()
        self.integrator = ApiIntegrator()

    async def search_and_persist(self, project_id: int, query_blocks: List[Dict], limit: int = 100) -> int:
        # 1. Translate Query
        openalex_filter = self.translator.to_openalex(query_blocks)
        crossref_params = self.translator.to_crossref(query_blocks)
        
        # 2. Fetch results
        oa_raw = await self.integrator.fetch_openalex(openalex_filter)
        cr_raw = await self.integrator.fetch_crossref(crossref_params)
        
        # 3. Normalize
        normalized_results = []
        for item in oa_raw[:limit]:
            norm = self.integrator.normalize_openalex(item)
            norm["base_origem"] = "OpenAlex"
            normalized_results.append(norm)
            
        for item in cr_raw[:limit]:
            norm = self.integrator.normalize_crossref(item)
            norm["base_origem"] = "Crossref"
            normalized_results.append(norm)
            
        # 4. Deduplicate
        deduplicated = self._deduplicate(normalized_results)
        
        # 5. Persist
        count = 0
        for article in deduplicated:
            # Map CSL-JSON to DB fields
            article_db = {
                "projeto_id": project_id,
                "doi": article.get("DOI"),
                "titulo": article.get("title"),
                "autores": ", ".join([f"{a.get('given', '')} {a.get('family', '')}".strip() for a in article.get("author", [])]),
                "ano": article.get("issued", {}).get("date-parts", [[None]])[0][0],
                "query_origem": str(query_blocks),
                "base_origem": article["base_origem"], # This is a list from _deduplicate
                "csl_json": article
            }
            self.db_manager.save_article(article_db)
            count += 1
            
        return count

    def _deduplicate(self, results: List[Dict]) -> List[Dict]:
        seen_doi = {} # DOI -> index in deduplicated
        seen_title = {} # Title.lower() -> index in deduplicated
        deduplicated = []
        
        for item in results:
            doi = item.get("DOI")
            title = item.get("title", "").lower().strip()
            
            existing_idx = None
            if doi and doi in seen_doi:
                existing_idx = seen_doi[doi]
            elif title and title in seen_title:
                existing_idx = seen_title[title]
            
            if existing_idx is not None:
                # Merge base_origem
                current_bases = deduplicated[existing_idx]["base_origem"]
                if isinstance(current_bases, str):
                    current_bases = [current_bases]
                
                new_base = item["base_origem"]
                if new_base not in current_bases:
                    current_bases.append(new_base)
                
                deduplicated[existing_idx]["base_origem"] = current_bases
            else:
                idx = len(deduplicated)
                item["base_origem"] = [item["base_origem"]]
                deduplicated.append(item)
                if doi:
                    seen_doi[doi] = idx
                if title:
                    seen_title[title] = idx
                    
        return deduplicated
