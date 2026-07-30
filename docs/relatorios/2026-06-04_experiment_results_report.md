# Relatório de Resultados: Consistência do Algoritmo "Preencher com IA"

Este relatório documenta as conclusões obtidas na execução do experimento de consistência do algoritmo **"Preencher com IA"**, realizado com o modelo **`gpt-oss:20b-cloud`** conectado através do **Ollama**.

---

## 1. Visão Geral do Experimento
* **Modelo Utilizado:** `gpt-oss:20b-cloud`
* **Artigo Científico:** [s41598-025-08147-3.pdf](../../analysis_outputs/papers/s41598-025-08147-3.pdf)
* **Quantidade de Rodadas:** 30
* **Taxa de Sucesso de Execução:** 100% (30/30 rodadas completas)
* **Taxa de Parse de JSON:** 100% (30/30 respostas parseadas com sucesso)
* **Tempo Médio de Resposta:** 4.01 segundos (modelo em nuvem)
* **Parâmetro de Temperatura:** `0.2`

---

## 2. Tabela de Consistência por Campo

| Campo de Metadado | Valores Únicos Encontrados | Taxa de Consistência | Valor(es) Identificado(s) |
| :--- | :---: | :---: | :--- |
| **title** (Título) | 1 | **100%** | "The analysis of artificial intelligence-based mobile learning in students’ open teaching recommendation system based on deep learning" |
| **authors** (Autores) | 1 | **100%** | "Yongli Zhu, Wenxia Dai, Qinqing Kang" |
| **year** (Ano) | 1 | **100%** | "2025" |
| **doi** (DOI) | 1 | **100%** | "10.1038/s41598-025-08147-3" |
| **journal** (Revista) | 1 | **100%** | "Scientific Reports" |
| **abstract** (Resumo) | 5 | **83.3%** | *Variantes textuais de tradução/sintaxe (veja detalhes abaixo)* |

> [!NOTE]
> Todos os campos estruturados de metadados curtos (Título, Autores, Ano, DOI e Revista) alcançaram **100% de consistência**. A IA não introduziu qualquer tipo de ruído, variação de maiúsculas/minúsculas ou alternação de ordem de autores nas 30 iterações.

---

## 3. Análise das Variações no Campo `abstract`

Diferente dos demais campos, o `abstract` é um campo de texto longo e livre, o que propicia maior liberdade de escrita ao modelo. Encontramos **5 variações únicas** do abstract nas 30 rodadas:

### Distribuição das Variantes:
* **Variante 1:** Ocorreu em 12 rodadas.
* **Variante 2:** Ocorreu em 12 rodadas.
* **Variante 3:** Ocorreu em 3 rodadas.
* **Variante 4:** Ocorreu em 2 rodadas.
* **Variante 5:** Ocorreu em 1 rodada.

### Principais Diferenças Gramaticais e Estilísticas:

1. **Uso de Artigos Definidos/Indefinidos:**
   * *Variante 1:* "...use **AI** mobile platform..."
   * *Variante 2:* "...use **an AI** mobile platform..." (Adicionado artigo "an").
   * *Variante 5:* "...use **the AI** mobile platform..." (Adicionado artigo "the").

2. **Hifenização (Compound Nouns):**
   * *Variante 1, 2, 4:* "...improve the **time use** efficiency..."
   * *Variante 3, 5:* "...improve the **time-use** efficiency..." (Introdução de hífen).

3. **Escolha Lexical (Sinônimos):**
   * *Variante 1:* "...the number of **people** is relatively small..."
   * *Variante 4:* "...the number of **users** is relatively small..." (Substituição de "people" por "users").

4. **Espaçamento e Caracteres Especiais:**
   * *Variante 3:* "...proportion (**~70%**)..."
   * *Variante 5:* "...proportion (**~70 %**)..." (Nota-se um espaço fino unicode `\u202f` precedendo o caractere de porcentagem).

---

## 4. Recomendações para a Aplicação Principal

Com base nas observações deste experimento e das etapas de depuração, recomendamos realizar as seguintes correções no projeto principal:

1. **Substituição de `fetch` por `axios`:**
   No arquivo `AIService.ts` (em `electron/services/AIService.ts`), as chamadas para APIs locais devem usar `axios` com `{ timeout: 0 }` em vez do `fetch` nativo do Node. Isso impede que modelos locais rodando em CPU falhem por timeout após 5 minutos (limite padrão do `undici`).
   
2. **Definição de Janela de Contexto no Ollama:**
   O Ollama trunca o contexto em 4.096 tokens por padrão. Ao extrair metadados (onde enviamos 40k caracteres do PDF), a instrução no início do prompt é cortada e o modelo passa a responder em formato de conversa livre. Deve-se adotar o endpoint nativo `/api/chat` passando a opção `num_ctx: 16384` nas requisições.
