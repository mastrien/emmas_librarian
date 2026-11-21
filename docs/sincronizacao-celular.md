# Sincronização com o celular

Código em `emmas_librarian/core/sync/` (protocolo, dados, cifra), `adapters/electron/remote/` (servidor e pareamento) e
`emmas_librarian/mobile/src/{local,sync}/` (o lado do celular). Plano e decisões: `docs/planos/2026-11-21_mobile_robusto.md`.
O desktop só instala as tabelas e os gatilhos de sincronização na primeira vez que alguém abre um pareamento
(`LibrarySync.parts()`); uma biblioteca que nunca sincroniza não paga nada.

## Dados

- **Tabelas laterais** (`sync_ids`, `sync_changes`, `sync_state`, `sync_pending_ops`): não mudam nenhuma coluna da biblioteca.
  O release 1.2.0 foi retirado por falha de migração (issue #22); por isso o uuid de cada linha fica numa tabela à parte.
- **Entidades sincronizadas** (`syncedTables.ts`): projetos, artigos, anotações, marca-textos, diário, links de acesso rápido.
  Caminhos de arquivo do computador (`local_file_path`) nunca saem.
- **Captura de mudanças:** gatilhos de SQLite gravam em `sync_changes` toda inserção, alteração e exclusão. Escritas feitas pela
  própria sincronização ficam de fora (`sync_state.applying`), para não voltarem ao celular como se fossem do usuário.
- **Exclusão:** o uuid sobrevive à linha, o que vira um tombstone. Artigos, projetos e anotações vão para a lixeira
  (`deleted_at`) em vez de serem apagados.

## Dry run

O que o celular altera num projeto sincronizado chega ao computador e fica em `sync_pending_ops`, sem tocar na biblioteca.
`PendingChangeStore` lista, aplica (tudo ou nada por chamada, na ordem em que chegaram) ou rejeita. Um item que não cabe mais
(linha apagada, pai desconhecido) é marcado como `skipped` com o motivo e não impede os outros. O que não for aplicado volta
ao celular, que desfaz a alteração local. Um dia de diário que já existe guarda o texto antigo em `project_diary_history`.

## Criptografia

Tudo passa por `CryptoProvider` (`crypto/`), implementado em Web Crypto, que existe no Node e no WebView do Android.
Curva P-256 (X25519 não existe nos WebViews antigos). As primitivas são testadas contra vetores publicados
(RFC 5869 HKDF, RFC 4231 HMAC, NIST AES-GCM).

1. **Pareamento** (`pairing.ts`). O QR carrega a chave pública efêmera do computador e um segredo de uso único (32 bytes, 5 minutos).
   O celular faz ECDH, mistura o segredo no HKDF e deriva `deviceKey` (longa) e uma chave de confirmação. Ele responde com sua
   chave pública, o nome e um HMAC de tudo isso. Só quem leu o QR consegue o HMAC certo; quem está na rede e viu a resposta não.
   Cada pareamento vale uma vez. Os dois lados mostram o mesmo código de verificação (ex.: `4F2A · 91C7 · D03B · 7E58`).
2. **Sessão** (`SecureChannel.ts`). Cada sincronização deriva uma chave nova de `deviceKey` e de um nonce de cada lado. Cada mensagem é
   AES-256-GCM; o contador entra no nonce e nos dados autenticados. Repetição, ordem invertida, contador forjado, mensagem de
   outro aparelho e a própria mensagem devolvida (reflexão) são recusados. A versão do protocolo vem em cada mensagem.
3. **Rodada** (`DesktopSyncEndpoint.ts`). O celular manda `{cursor, operations, processed}`; o computador responde
   `{decided, operations, cursor, staged}`. Operações têm `opId`, então reenviar depois de uma queda é inofensivo.

## Como liga ao aplicativo

- **Servidor:** com o acesso pela rede local ligado, o aplicativo abre também uma porta HTTP simples (47811, ou outra livre)
  que atende só `/api/sync/{pair,hello,round,pdf}`. Sem certificado: o WebView do Android não aceita um autoassinado, e tudo
  que passa por ali já está cifrado (ou é uma prova de pareamento que não revela nada). Não serve páginas nem comandos.
  A cópia web, servida em HTTPS, usa as mesmas rotas na porta HTTPS.
- **Pareamento:** Configurações › Acesso pelo celular › "Parear um celular para sincronizar" mostra o QR. O celular lê (ou
  recebe o texto colado), responde, e os dois mostram o mesmo código de verificação. A chave do celular fica em
  `sync-device.json` (cifrada pelo cofre do sistema onde houver). Um celular por computador; parear outro substitui o primeiro.
- **Revisão (dry run):** a mesma tela lista o que o celular mudou, com o que a linha diz agora no computador; exclusões
  aparecem em vermelho. Você aplica ou rejeita as escolhidas.
- **PDFs:** o celular pede um por artigo (`/api/sync/pdf`), selado como as outras mensagens, até 64 MB.

## No celular

Biblioteca própria em IndexedDB (`LocalLibrary`: linhas por uuid, fila de envio, desfazer), PDFs à parte. Projetos vindos do
computador entram na fila de envio; projetos feitos no celular nunca. Rejeitado ou pulado pelo computador, o item é desfeito
no celular. Parear de novo ou desparear apaga a cópia local. Categorias ainda não sincronizam.

## Testes

- Unitários e de integração (SQLite real, cripto real): `npm run test`.
- Navegador de verdade contra um computador de verdade (SQLite, rotas cifradas, build do celular, PDF de teste):
  `npm run test:mobile-e2e` (`PW_CHROMIUM_PATH=<chrome>` onde o Chromium não é o do Playwright). Cobre abertura, aparência,
  pareamento, cópia da biblioteca, escrita sem o computador, aplicar e rejeitar, baixar PDF e marcar um trecho.
- Não coberto: Android de verdade (câmera do QR, WebView, `usesCleartextTraffic`), o fluxo de pareamento pela tela de
  configurações do Electron (E2E do Electron não rodado aqui) e iOS.

## O que este código não garante

- O segredo do QR protege contra quem só ouve a rede. Quem fotografa o QR durante os 5 minutos pareia no lugar do usuário;
  o código de verificação serve para o usuário notar isso.
- `deviceKey` ainda precisa ser guardada no computador pelo `SecretStore` e no celular pelo armazenamento seguro do Android.
- Nenhuma revisão externa de criptografia foi feita. Para o escopo atual (um celular, LAN) a superfície foi mantida mínima.
