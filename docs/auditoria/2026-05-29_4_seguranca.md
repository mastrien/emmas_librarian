# Relatório de Auditoria: Segurança

## 1. Estado Atual
Foi feita uma auditoria nas dependências do Node (utilizando `npm audit`) e uma inspeção nas configurações de segurança do Electron (`electron/main.ts`).
- **Dependências:** O Electron instalado está na versão `>=34.5.8` e `<=39.8.4`, que foi marcada como crítica.
- **Configurações do Electron:** A opção `nodeIntegration` está configurada como `false` e `contextIsolation` como `true`, que são práticas exemplares para garantir a segurança no Electron.
- A Content Security Policy (CSP) está declarada, bloqueando fontes arbitrárias.

## 2. Pontos Críticos
- **Vulnerabilidade de Alta Severidade no Electron (CVE):** O comando `npm audit` detectou 1 vulnerabilidade crítica no pacote do Electron. A versão atual contém múltiplas brechas (ex: *ASAR Integrity Bypass*, *Use-after-free*, *AppleScript injection*). Isso pode permitir execução de código malicioso.
- **CSP Permissivo (unsafe-inline):** O Content-Security-Policy (CSP) injetado pelo Electron está liberando `'unsafe-inline'` e, em modo dev, `'unsafe-eval'`. Manter `'unsafe-inline'` em produção, embora às vezes necessário para certas bibliotecas, é um risco de *Cross-Site Scripting* (XSS) e injeção indesejada.
- **Armazenamento de Chaves da API:** O aplicativo maneja chaves de API cruciais (OpenAI, Gemini, Anthropic). Na arquitetura observada (`projectService.getSetting`), se a chave estiver armazenada no banco SQLite (`emma.db`) sem criptografia adicional ou *keytar* de S.O., um script local simples de terceiro pode roubá-la facilmente.

## 3. Mudanças Propostas
- **Atualização Crítica:** Atualizar a versão do Electron executando o comando `npm audit fix --force` ou atualizando manualmente para a versão `42.2.0` (ou a LTS mais recente) que mitiga estas vulnerabilidades de segurança.
- **Melhoria da CSP:** Restringir a CSP removendo ou limitando fortemente o uso de `'unsafe-inline'` em `style-src` e `default-src` em ambiente de produção (o que demandará refatorar os estilos *inline* apontados no relatório de qualidade de código).
- **Criptografia e Armazenamento Seguro:** Implementar uso de armazenamento seguro do Sistema Operacional (como `keytar` ou o uso da API criptográfica embutida nativa do node para encriptar e decriptar senhas na base) para armazenar os tokens e API Keys de LLMs. Nenhuma *API Key* deve ficar salva no SQLite local em formato texto puro.
