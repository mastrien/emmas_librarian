from typing import List, Dict

class QueryTranslator:
    def to_openalex(self, query_blocks: List[Dict]) -> str:
        filters = []
        for block in query_blocks:
            field = block.get("field")
            value = block.get("value")
            type_ = block.get("type")
            
            if field == "title":
                filters.append(f"title.search:{value}")
            elif field == "year":
                if type_ == "greater_than":
                    filters.append(f"publication_year:>{value}")
                elif type_ == "less_than":
                    filters.append(f"publication_year:<{value}")
                else:
                    filters.append(f"publication_year:{value}")
        
        return ",".join(filters)

    def to_crossref(self, query_blocks: List[Dict]) -> Dict[str, str]:
        params = {}
        filters = []
        for block in query_blocks:
            field = block.get("field")
            value = block.get("value")
            type_ = block.get("type")
            
            if field == "title":
                params["query.title"] = value
            elif field == "year":
                if type_ == "equals":
                    filters.append(f"from-pub-date:{value}")
                    filters.append(f"until-pub-date:{value}")
                elif type_ == "greater_than":
                    filters.append(f"from-pub-date:{int(value) + 1}")
                elif type_ == "less_than":
                    filters.append(f"until-pub-date:{int(value) - 1}")
        
        if filters:
            params["filter"] = ",".join(filters)
            
        return params
