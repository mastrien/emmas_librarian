import pytest
from backend.app.services.query_translator import QueryTranslator

def test_translate_to_openalex_simple_title():
    translator = QueryTranslator()
    query_blocks = [
        {"field": "title", "value": "machine learning", "type": "contains"}
    ]
    # Expected OpenAlex filter syntax: title.search:machine learning
    translated = translator.to_openalex(query_blocks)
    assert "title.search:machine learning" in translated

def test_translate_to_openalex_year_range():
    translator = QueryTranslator()
    query_blocks = [
        {"field": "year", "value": "2020", "type": "greater_than"}
    ]
    translated = translator.to_openalex(query_blocks)
    assert "publication_year:>2020" in translated

def test_translate_to_crossref_simple_title():
    translator = QueryTranslator()
    query_blocks = [
        {"field": "title", "value": "machine learning", "type": "contains"}
    ]
    # Crossref uses query parameters for some things and filters for others
    # query.title=machine+learning
    params = translator.to_crossref(query_blocks)
    assert params["query.title"] == "machine learning"

def test_translate_to_crossref_year():
    translator = QueryTranslator()
    query_blocks = [
        {"field": "year", "value": "2022", "type": "equals"}
    ]
    # Crossref filter: from-pub-date:2022,until-pub-date:2022
    params = translator.to_crossref(query_blocks)
    assert "from-pub-date:2022" in params["filter"]
    assert "until-pub-date:2022" in params["filter"]
