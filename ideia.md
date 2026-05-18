# Emma's Librarian

## Objetivo

Automatizar buscas estruturadas em diferentes bases (Scopus, Web of Science, OpenAlex, Crossref, etc) para reunir dados de artigos científicos. Esses dados podem ser analisados no sistema ou unificados em um formato que possa ser usado no biblioshiny (aplicação de gráficos do bibliometrix).

## Funcionalidades

- Fazer requisições simultaneamente para múltiplas bases de dados com a mesma query.
- Analisar dados de diferentes bases.
- Facilitar a leitura de documentos científicos (talvez permitindo baixar o documento ou então só anexando o link com o DOI do artigo).
- Permitir realizar anotações vinculadas a artigos específicos, incluindo a persistência de marcações (destaques visuais) nos documentos. O usuário deve ser capaz de selecionar um texto, destacá-lo com uma cor específica e vincular uma nota em Markdown.
- Um módulo que normaliza sintaxe de querys para todas as bases.
- Será possível salvar "Projetos" de busca e acompanhá-los ao longo do tempo, mas essa funcionalidade não é prioritária.

## Decisões

1. A plataforma será local, assim o usuário pode usar as plataformas que ele tiver acesso (Scopus, Web of Science, etc.) sem precisar compartilhar dados com terceiros.
2. A interface será web, mas rodará localmente. Isso facilita o desenvolvimento e a manutenção.
3. MVP será apenas com OpenAlex e Crossref.
4. Desduplicação será feita, mas a informação de quais bases contêm o artigo deve ser mantida.
5. O leitor de PDF pode ser um link inicialmente, mas a intenção é que no futuro seja um leitor local integrado no sistema.
6. O acesso a bases pagas será gerenciado pela própria chave da API do usuário.

## Pontos a serem definidos

1. O formato de exportação ainda deve ser definido futuramente, as vezes tem alguns formatos que funcionam melhor com algumas bases, devemos estudar quais formatos integram melhor com o biblioshiny.
2. Como será o armazenamento dos dados? Temos os dados de busca e os dados de anotações dos artigos.