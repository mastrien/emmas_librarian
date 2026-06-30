---
name: release-manager
description: Flow for verifying integrity and deploying new versions of Emma's Librarian, updating package metadata and creating git tags.
---

# Release Manager

Esta skill fornece instruções para homologar e lançar com segurança novas versões do Emma's Librarian.

## Overview
Este processo assegura que novas versões sejam devidamente testadas, que os metadados da aplicação estejam corretos e que a árvore do repositório Git receba a tag semântica de forma consistente.

## Workflow

Sempre que for solicitado o lançamento de uma nova versão do Emma's Librarian (ex: `v1.1.9`), execute rigorosamente as seguintes etapas:

### 1. Verificação de Integridade (Typecheck e Testes)
Antes de modificar qualquer arquivo de versão, certifique-se de que a aplicação está íntegra:
- Navegue para o diretório da aplicação: `emmas_librarian/emmas_librarian`.
- Execute a checagem de tipos estática:
  ```powershell
  npm run typecheck
  ```
- Execute a suíte de testes unitários e de integração:
  ```powershell
  npm run test
  ```
- **Validação de caminhos em produção**: Certifique-se de que nenhum recurso estático (como `index.html`, ícones ou assets) seja carregado usando caminhos baseados em `__dirname` (como `path.join(__dirname, '../dist/...')`), pois a estrutura de pastas compilada muda em produção. Use sempre `app.getAppPath()` para caminhos relativos à raiz do pacote.
- Se qualquer um dos comandos falhar ou se houver caminhos inadequados, corrija-os antes de prosseguir com o lançamento.

### 2. Atualização dos Arquivos de Metadados
- Abra o arquivo `emmas_librarian/package.json` e atualize o campo `"version"` para a nova versão (ex: `"1.1.9"`).
- Atualize o `package-lock.json` de forma limpa executando o seguinte comando na pasta `emmas_librarian/emmas_librarian`:
  ```powershell
  npm install --package-lock-only
  ```

### 3. Atualização das Notas de Atualização (Patch Notes)
- Abra o arquivo `emmas_librarian/src/components/ChangelogModal.tsx`.
- Adicione a nova versão e detalhe as melhorias, correções de bugs e novas funcionalidades implementadas recentemente.
- **Importante**: Mantenha as seções das versões anteriores (pelo menos as últimas 3 versões) devidamente separadas e identificadas por cabeçalhos (ex: `Versão 1.1.8`, `Versão 1.1.7`) para que o usuário final compreenda a evolução do sistema.
- Se necessário, atualize a asserção no arquivo de testes `emmas_librarian/src/components/__tests__/ChangelogModal.test.tsx` para refletir as mudanças do modal.

### 4. Commitar as Alterações de Lançamento
- Adicione todos os arquivos modificados ao stage do Git:
  ```powershell
  git add .
  ```
- Crie o commit informando a nova versão:
  ```powershell
  git commit -m "chore: release vX.Y.Z"
  ```
  *(O pre-commit hook executará as validações adicionais automaticamente)*.

### 5. Geração e Envio da Tag Git
- Crie a tag local correspondente à nova versão:
  ```powershell
  git tag vX.Y.Z
  ```
- Envie o commit e a nova tag correspondente para o repositório remoto:
  ```powershell
  git push origin main
  git push origin vX.Y.Z
  ```

## Common Mistakes
- **Esquecer o package-lock.json**: Alterar apenas o `package.json` quebra a consistência do gerenciador de pacotes npm. Sempre rode `npm install --package-lock-only`.
- **Não rodar testes após alterar o Changelog**: Mudar a estrutura de textos no `ChangelogModal.tsx` pode fazer o teste unitário correspondente quebrar se ele buscar por termos antigos removidos.
- **Criar tag antes de commitar**: Certifique-se de que o commit do release já foi feito localmente antes de executar o comando `git tag`.
- **Caminhos relativos e `__dirname`**: Evite carregar arquivos do frontend (como `dist/index.html`) com caminhos baseados em `__dirname` e `..`. No build final, a hierarquia do backend compilado (`dist-electron/electron/main.js`) difere do código fonte, fazendo com que caminhos relativos ao arquivo quebrem. Utilize `app.getAppPath()` para apontar para caminhos a partir da raiz da aplicação de forma consistente.
