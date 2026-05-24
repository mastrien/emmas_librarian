# Tópicos para Estudar Depois

Este arquivo contém resumos sobre tecnologias e conceitos que podem aprimorar o Emma's Librarian no futuro, especialmente em relação à segurança e integração com Inteligência Artificial.

## 1. Electron `safeStorage` API

**O que é:**
Uma API nativa do Electron projetada especificamente para armazenar dados sensíveis (como chaves de API, senhas ou tokens de autenticação) de forma segura no disco local.

**Como funciona:**
Em vez de gravar strings puras em arquivos locais (o que permitiria a qualquer programa malicioso no computador do usuário roubar a chave da LLM ou da Scopus), o `safeStorage` criptografa e descriptografa a string usando a chave de segurança gerada pelo próprio sistema operacional.
- **Windows:** Usa a DPAPI (Data Protection API) ou o Windows Credential Manager.
- **macOS:** Usa o Keychain (Acesso a Chaves).
- **Linux:** Usa a libsecret (ex: GNOME Keyring ou KWallet).

**Como usar no código:**
```typescript
import { safeStorage } from 'electron';

// Para criptografar antes de salvar no banco SQLite
if (safeStorage.isEncryptionAvailable()) {
  const bufferCriptografado = safeStorage.encryptString('sk-minha-chave-api');
  // Salva o buffer no banco de dados (geralmente como string base64 ou blob)
}

// Para descriptografar ao ler do banco
const chave = safeStorage.decryptString(bufferCriptografado);
```
Isso garante que, mesmo se alguém roubar o arquivo `emma.db` do computador, não conseguirá ler as chaves, pois elas só podem ser descriptografadas na máquina e pelo usuário logado que as criou.

---

## 2. MCP (Model Context Protocol)

**O que é:**
O Model Context Protocol (MCP) é um padrão aberto lançado pela Anthropic (criadora do Claude) para padronizar como Assistentes de IA se conectam a fontes de dados locais e remotas. 

**Para que serve:**
Imagine que você queira que a LLM leia diretamente do seu banco `emma.db` ou pesquise no seu sistema de arquivos sem que você precise programar todas as pontes manualmente no backend do Emma's Librarian. O MCP permite criar "Servidores" locais que expõem ferramentas, recursos e prompts padronizados.
Se integrarmos um Servidor MCP ao Emma's Librarian, clientes compatíveis com MCP (como o próprio app Claude Desktop, Cursor, etc) poderiam interagir diretamente com a biblioteca do usuário. Alternativamente, podemos construir o Emma's Librarian como um *Cliente MCP* que pode se plugar em outras ferramentas locais do pesquisador (como o Zotero ou arquivos do Word).

---

## 3. Agent Skills (Habilidades de Agentes)

**O que é:**
"Agent Skills" (Habilidades de Agentes) ou Tools (Ferramentas) é o conceito que permite a uma LLM tomar ações, em vez de apenas gerar texto. É a base da IA Agentiva.

**Como funciona:**
Ao invés de apenas pedir para a LLM: *"Resuma este artigo"*, nós enviamos junto um catálogo de funções estruturadas. Exemplo de *Skills* que poderíamos dar à IA dentro do Emma's Librarian:
- `search_article(title)`
- `add_highlight(article_id, position)`
- `fetch_openalex_data(doi)`

Quando a IA decide que precisa dessas ferramentas, ela gera uma resposta especial (um Tool Call). O Emma's Librarian (no Node.js) intercepta essa resposta, executa a função de fato, e devolve o resultado para a IA continuar pensando.
Isso abre portas para darmos tarefas complexas à IA: *"Busque o artigo X, leia a metodologia, ache as referências, faça queries no OpenAlex para essas referências e crie um novo projeto com os resultados"*.

---

## 4. Fine-Tuning (Ajuste Fino)

**O que é:**
Fine-tuning é o processo de treinar ainda mais um modelo já existente (como um Llama 3 local ou GPT-4o-mini remoto) usando um conjunto de dados específico (dataset) com milhares de exemplos.

**Quando usar:**
- Quando o prompt não for o suficiente para que a LLM aprenda a responder ou estruturar dados no formato exato que o seu banco de dados precisa.
- Quando você deseja ensinar à LLM um "tom de voz" estrito, como jargões acadêmicos hiper-específicos.
- Quando você quer que a LLM extraia dados muito precisos (como tabelas matemáticas de PDFs) e os modelos base (zero-shot) continuam falhando mesmo com prompts bons.

**No contexto do Emma's Librarian:**
Se o recurso de Extração Massiva com IA crescer muito, você pode pegar 500 resumos e metadados corrigidos manualmente por você, criar um dataset no formato pergunta-resposta e fazer o fine-tuning de um modelo menor (para que ele seja rápido e barato) ensinando a ele o seu padrão ouro de extração de referências.
