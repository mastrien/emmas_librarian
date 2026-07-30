# Processo de Recuperação de Dados em SQLite (Unallocated Space Recovery)

Como você é estudante de Ciência da Computação, preparei este documento detalhando os fundamentos técnicos e os scripts exatos criados durante a recuperação das páginas do seu diário. Esse é um excelente estudo de caso prático de forense de banco de dados e manipulação de bytes.

## 1. Entendendo o Problema

A primeira coisa que fiz foi usar Python para mapear o schema do banco e ler as linhas atuais da tabela `project_diary`. O resultado foi:
- ID 106 (`2026-05-27`): Tinha uma cópia exata de grande parte do ID 104 (`2026-05-26`).
- ID 109 (`2026-05-25`): Tinha uma cópia exata do ID 20 (`2026-05-23`).

Em bancos de dados relacionais padrão, as consultas (queries `SELECT`) enxergam apenas as estruturas ativas. O SQLite gerencia as tabelas através de B-Trees armazenadas em *Pages* de um tamanho fixo (geralmente 4096 bytes).

## 2. O Conceito Físico do SQLite

Quando você sobrescreve uma string por outra no SQLite (um `UPDATE`), se a nova string tiver um tamanho diferente, o SQLite muitas vezes marca a célula original da B-Tree (que continha o registro antigo) como *lixo* ("deleted/freed") e escreve o novo dado em outro lugar da *page*. O espaço antigo entra em uma *Freelist* (espaço não alocado).

Esse dado continua existindo fisicamente no disco no arquivo `.db` em bytes brutos até que o banco precise de espaço e o sobrescreva, ou até que um comando `VACUUM` seja executado (que desfragmenta o arquivo reconstruindo as B-Trees puramente do zero). Como a sobrescrita tinha ocorrido recentemente e o banco de dados tem 4MB com folgas, era estatisticamente provável que os textos do diário ainda estivessem preservados na sopa de bytes do arquivo.

## 3. O Passo a Passo da Extração (Carving)

Como não podíamos fazer um `SELECT` no dado apagado, a técnica foi fazer o *carving* dos bytes brutos.

### Passo 3.1: Dump de Strings
Escrevi o script `recover.py` e posteriormente `recover2.py`.
O script fazia a abertura do banco de forma binária:
```python
with open('emma.db', 'rb') as f:
    data = f.read()
decoded = data.decode('utf-8', errors='replace')
```
O SQLite armazena textos usando codificação UTF-8. No meio desse arquivo existem ponteiros, cabeçalhos de *pages* e metadados binários que obviamente não dão um texto válido. Usamos a seguinte expressão regular para dividir todo o conteúdo binário, usando caracteres de controle (`\x00` a `\x1f`, pulando o de quebra de linha `\x0a`) e o caractere de erro (`\ufffd`) como divisores lógicos:
```python
chunks = re.split(r'[\x00-\x09\x0b-\x1f\ufffd]+', decoded)
```
Isso resultou em milhares de *chunks* de texto legível.

### Passo 3.2: O Filtro do Conhecido (Complemento de Conjuntos)
O arquivo extraído teria quase todo o conteúdo do seu aplicativo: PDFs indexados em cache, abstracts, bibliotecas CSL JSON etc. O pulo do gato na forense de banco de dados para achar o que está excluído é fazer a diferença de conjuntos.

O script abria a conexão oficial com o `sqlite3`, rodava os `SELECT` de todo o banco atual legível e inseria num vetor de "textos conhecidos". 
Em seguida, para cada "chunk" de texto do arquivo binário, testávamos se ele era contido (`in`) em algum texto conhecido. Se *não* fosse contido nos dados ativos, era logicamente um trecho do espaço não alocado (dado órfão/excluído).

### Passo 3.3: Remoção de Ruído
O segundo script (`recover2.py`) aprimorou a coleta ignorando fragmentos que tivessem chaves `{` e `}` (muitos restos de metadados JSON do *OpenAlex*) e filtrando apenas trechos com espaçamentos suficientes que indicassem uma linguagem natural (diário).

### Passo 3.4: O Matching Final
Com uma lista refinada das strings "órfãs" (salva nos arquivos como `lost_diary_candidates.txt`), rodamos scripts curtos em Python com expressões regulares direcionadas às palavras de transição que você costumava escrever:

```python
re.search(r'(?i)\b(hoje|ontem|plano|emma|obsidian|resumo expandido|progredi|cobicet)\b', text)
```

**Resultado:**
1. O diário do dia `25` foi recuperado intacto na primeira varredura.
2. O diário do dia `27` também foi recuperado fazendo um grep simples por `2026-05-27`, mas como você pode ver, um caractere invisível que foi inserido perto da palavra "são" o separou na nossa extração Regex principal, porém a semântica da ideia e contexto estavam isolados.

### Resumo dos Arquivos na Pasta
- `dump_schema.py`: Primeiro teste para ver o esqueleto do banco.
- `recover.py` / `recover2.py`: Scripts core de extração que abriam o `.db` como file binário.
- Arquivos `.txt`: Resultados intermediários e as extrações onde pudemos encontrar o que precisávamos. 

Se por acaso desejar investigar ou aprofundar esse código, todos os scripts criados no processo continuam nessa pasta e podem ser reaproveitados em estudos futuros de SO/Bancos de Dados.
