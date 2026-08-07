# Orientações dos testes do Ollama

Para verificar como a API está funcionando, utilize a seguinte chave de API:

a7dae34b50a94fb995d33c134b6fab33.ptfvW3Gk4Lse-tCXjeSzQa7U

Não se preocupe, isso não é uma falha de segurança, eu criei uma chave temporária descartável, pode usar ela hardcoded nos experimentos aqui. Caso futuramente os testes criados aqui sirvam de base para testes unitários reais na aplicação real, certifique-se de NÃO USA-LOS.

Dentro dessa pasta, você vai encontrar um PDF de um artigo de **acesso aberto**, use ele para validar com o "novo provedor" ollama cloud:

- Extração de metadados do artigo com o modelo `gpt-oss:120b-cloud`
- Geração de resumos com o modelo `gpt-oss:120b-cloud`
- Vetorização com `nomic-embed-text` e investigação massiva com `gpt-oss:120b-cloud`