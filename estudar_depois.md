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

---

## 5. Customizando a Barra de Título Nativa no Electron

**O que é:**
Ao invés de usar a barra de título padrão do Windows ou macOS (que contém os menus "File", "Edit" e o título do app), podemos esconder a barra padrão, manter os botões nativos de "Minimizar/Maximizar/Fechar" (preservando o Snap Layout do Windows) e desenhar nossa própria barra em HTML/React.

**Como funciona no `main.ts`:**
```typescript
const mainWindow = new BrowserWindow({
  // ... outras configs ...
  titleBarStyle: 'hidden', // Esconde a barra nativa inteira
  titleBarOverlay: { // Habilita os botões de controle de janela sobrepostos ao HTML
    color: '#f8fafc', // Cor de fundo real da interface
    symbolColor: '#334155' // Cor do ícone (X, etc)
  }
});
```
**Dica de Ouro para o Windows:** O Windows precisa saber qual a cor real do fundo (`color`) para conseguir calcular corretamente as cores sutis de "hover" (ao passar o mouse por cima de minimizar/maximizar). Se definirmos o fundo como transparente (`rgba(0,0,0,0)`), o sistema perde a referência e os botões de minimizar/maximizar param de reagir ao mouse!

**Como habilitar o arraste (`Layout.tsx`):**
Sem a barra do SO, o usuário não consegue mais clicar no topo para arrastar a janela. Para corrigir isso, definimos uma `div` no topo da nossa interface React com a propriedade CSS `-webkit-app-region: drag`.
Tudo que estiver com `drag` passa a arrastar a janela. Se dentro dessa área houver algum botão ou link, precisamos colocar `-webkit-app-region: no-drag` para que o clique não seja engolido pelo arraste.

**Atualização dinâmica (Modo Claro/Escuro):**
Como o `titleBarOverlay` no Electron precisa das cores em formato HEX, e nossa interface troca de tema dinamicamente via React, criamos um evento IPC para o frontend enviar o tema atual para o Main Process atualizar a cor dos controles de janela nativos em tempo real:
```typescript
// No React (Frontend):
window.electronAPI.invoke('UPDATE_TITLE_BAR', 'dark');

// No Electron (Backend):
ipcMain.handle('UPDATE_TITLE_BAR', (event, theme) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  win.setTitleBarOverlay({
    color: theme === 'dark' ? '#0f172a' : '#f8fafc',
    symbolColor: theme === 'dark' ? '#e2e8f0' : '#334155'
  });
});
```

---

## 6. Configuração de Ícones e Instalador (NSIS) no electron-builder

**O que é:**
O `electron-builder` é a ferramenta responsável por empacotar a nossa aplicação web (construída com React e Vite) em um executável instalável (como um `.exe` para Windows). Para gerar os instaladores de Windows, ele utiliza por padrão o NSIS (Nullsoft Scriptable Install System).

**O problema que ocorria:**
Após o build, a aplicação não exibia o ícone correto na barra de tarefas e não ficava acessível através do Menu Iniciar ou do painel de aplicativos do Windows. Isso ocorria porque:
1. O `electron-builder` não possuía a indicação explícita de onde buscar o arquivo do ícone (o Windows exige arquivos `.ico` para lidar com a barra de tarefas, atalhos e painel de controle).
2. O instalador NSIS não estava configurado explicitamente para forçar a criação dos atalhos no Menu Iniciar e na Área de Trabalho.
3. A propriedade `productName` possuía aspas simples (`"Emma's Librarian"`). No ecossistema Windows, o uso de aspas e certos caracteres especiais no nome do produto pode interferir silenciosamente nos scripts do NSIS ao gerar atalhos e criar chaves de registro.

**Como foi resolvido no `package.json`:**
Ajustamos a configuração do objeto `build` para que ficasse clara e robusta:
```json
  "build": {
    "appId": "com.emma.librarian",
    "productName": "Emmas Librarian", // Aspas simples removidas
    "win": {
      "target": ["nsis"],
      "icon": "build/icon.ico" // Apontamento explícito do ícone para o executável
    },
    "nsis": {
      "oneClick": false, // Instalação passo a passo (não silenciosa)
      "allowToChangeInstallationDirectory": true,
      "createDesktopShortcut": true,
      "createStartMenuShortcut": true, // Garante que o atalho seja criado no Menu Iniciar
      "shortcutName": "Emmas Librarian" // Nome limpo e seguro para os atalhos criados
    }
  }
```

**Onde estudar mais:**
- Na documentação oficial do **electron-builder**:
  - Para configurações do Windows: [electron.build/configuration/win](https://www.electron.build/configuration/win)
  - Para parâmetros de instalador NSIS: [electron.build/configuration/nsis](https://www.electron.build/configuration/nsis)
- Estudar sobre **Windows AppUserModelID (AUMID)**, que é o identificador interno que o Windows usa para vincular a janela do seu aplicativo aberto ao ícone correspondente fixado na barra de tarefas.
