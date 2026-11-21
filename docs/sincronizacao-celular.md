# Sincronização com o celular (núcleo, sem rede ainda)

Código em `emmas_librarian/core/sync/`. Plano e decisões: `docs/planos/2026-11-21_mobile_robusto.md`.
Nada disso está ligado ao aplicativo ainda: `installSyncSchema` só roda quando o pareamento for integrado.

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

## O que este código não garante

- O segredo do QR protege contra quem só ouve a rede. Quem fotografa o QR durante os 5 minutos pareia no lugar do usuário;
  o código de verificação serve para o usuário notar isso.
- `deviceKey` ainda precisa ser guardada no computador pelo `SecretStore` e no celular pelo armazenamento seguro do Android.
- Nenhuma revisão externa de criptografia foi feita. Para o escopo atual (um celular, LAN) a superfície foi mantida mínima.
