# Plano: cliente mobile robusto (PDF, marcação, diário e sincronização cifrada)

Ponto de partida: branch da #202 (`feat/agente-local`). Proposta de telas no artifact "Emma Mobile — proposta de design" (https://claude.ai/artifact/PEJ4CV5MHP5uhUHn7fwKAG, privado).

## 1. O que muda em relação ao plano de 2026-10-09

O plano antigo (seções 7.2, 7.3, 7.5, 7.7 e 8) decidiu: mobile como controle remoto e visualizador de `.emmapcarc`, sem anotação em PDF, sem sincronização completa e sem independência do desktop. O pedido de 2026-11-21 reverte quatro desses pontos:

| Decisão antiga | Nova direção |
|---|---|
| Marcação em PDF fora de escopo | Leitura **e marcação** no celular |
| Sync completo adiado | Sincronização por rede é requisito |
| Mobile não é independente | Cópia local editável (offline) |
| Escritas só em 4 canais | Escritas em mais entidades, com conflito |

Isso reabre o obstáculo 4 do plano antigo: o schema não suporta sync (ids `INTEGER AUTOINCREMENT`, `updated_at` em poucas tabelas, `deleted_at` em algumas; 34 tabelas em `core/database/schema.sql`). É a parte mais cara e deve virar uma fase própria, antes das telas.

## 1.1 Decisões do autor (2026-11-21)

- **Rede:** só LAN. O protocolo cifrado fica pronto para um relay futuro, que não entra agora.
- **Plataforma:** app nativo com **Capacitor**, Android primeiro. iOS depois (não há iPhone nem Mac para teste e build); o código não deve depender de plataforma. Só há Android para teste real.
- **Aparelhos:** **um celular por desktop.** Simplifica pareamento, revogação e conflito.
- **Dois tipos de projeto, visíveis só no celular:**
  - **Projeto próprio:** nasce no celular e é criado e editado livremente nele.
  - **Projeto sincronizado:** vem do desktop. **O desktop manda.** O celular não faz ações destrutivas; tudo que o celular altera entra no desktop como **dry run**: uma lista de alterações propostas, que o usuário confere e **confirma no desktop** antes de aplicar.
- **O celular cria tudo** (artigos, projetos, categorias, marcações, anotações, diário), sujeito à regra acima nos projetos sincronizados.
- **Conflitos:** o mais recente vence; o diário guarda as duas versões. Sem tela de resolução manual. Nos projetos sincronizados a confirmação no desktop já é o ponto de decisão.
- **Cifra local no celular:** opcional, por projeto.
- **PDFs offline:** escolha por artigo e por projeto, com aviso de tamanho.
- **Marcação:** primeiro só PDF com texto selecionável; escaneado depois, por retângulo.
- **Texto longo:** log de operações próprio, sem CRDT nem dependência nova.
- **Ordem:** schema e sync, depois cifra, depois telas.

Consequências para o desenho (ainda a refinar):
- O desktop precisa de uma **fila de alterações pendentes** por celular, com tela de revisão (diff por entidade, aceitar tudo ou item a item) e aplicação atômica. É uma tela e um serviço novos no desktop, fora do mobile.
- "Ação destrutiva" precisa de definição: proposta de trabalho é apagar, sobrescrever campo existente e mover. Criar e acrescentar (marcação nova, página de diário nova) seriam não destrutivos, mas **ainda assim entram como dry run** nos projetos sincronizados, como você pediu.
- Projeto próprio e projeto sincronizado têm regras de escrita diferentes no mesmo cliente: o tipo precisa ser um campo explícito no celular, nunca inferido.
- O diagrama de decisão do conflito muda: em projeto sincronizado não há conflito silencioso, porque o desktop só aplica o que o usuário aprovar.

## 2. Proposta de arquitetura (a validar)

**Dados.** Cada entidade sincronizável ganha `uuid`, `updated_at` e `deleted_at` (tombstone). Alterações viram um log de operações por dispositivo (relógio lógico por dispositivo), não uma comparação de linhas. O celular guarda uma cópia local em IndexedDB (SQLite WASM só se o IndexedDB não bastar).

**Escopo sincronizado (proposta).** Projetos, artigos (metadados), categorias e seleções, marcações e anotações, diário, documentos de acesso rápido. PDFs sob demanda, por artigo. Fora: configurações, chaves de API, vetores, chunks, conversas de IA, lixeira, backups.

**Conflitos.** Último escritor vence por campo, com exceção do diário (texto longo): se as duas pontas mudaram a mesma página, guardar as duas versões (o desktop já tem `project_diary_history`).

**Transporte e cifra.**
- Hoje: HTTPS com certificado autoassinado, token por dispositivo guardado como hash, pareamento por QR com código de uso único, só na mesma LAN.
- Limite do que existe: o navegador do celular não fixa certificado autoassinado e não instala service worker nesse endereço; a cópia publicada no Pages não consegue falar com o desktop (conteúdo misto).
- Proposta: **cifra na camada de aplicação, independente do TLS.** No pareamento, troca de chaves autenticada pelo QR (o QR carrega a impressão digital do desktop e um segredo de uso único; ECDH P-256 ou X25519 via Web Crypto, derivando uma chave de sessão com HKDF). Cada pacote de sincronização é cifrado com AES-256-GCM e autenticado, com contador anti-replay. O TLS vira camada extra, não a única proteção. Isso permite também um relay (item 4, pergunta 3) sem confiar nele.
- Chave do dispositivo no celular: gerada como não exportável no Web Crypto quando possível; dados locais cifrados em repouso (pergunta 5).
- Revogação: o desktop descarta a chave do dispositivo; o celular revogado apaga a cópia local no próximo contato.
- Bibliotecas: só Web Crypto no celular e `node:crypto` no desktop, atrás de uma interface do projeto (`CryptoProvider`), conforme o AGENTS.md. Nada de cripto escrita à mão.

## 3. Fases sugeridas

1. **Esquema de sync no núcleo:** uuid, updated_at, tombstones, log de operações, migração e testes contra SQLite real. Sem tela.
2. **Protocolo e cifra:** pareamento autenticado, pacote cifrado, anti-replay, revogação; testes com fakes nomeados de rede e de relógio.
3. **Armazenamento local no celular** e `LocalProjectReader`/writer ao lado de `HttpProjectReader`/`ArchiveProjectReader`.
4. **Telas:** projetos, artigo, leitor de PDF (pdf.js), marcação, diário, sincronização, conforme o artifact.
5. **E2E** do fluxo parear → sincronizar → editar offline → reconciliar.

## 4. Perguntas (as respondidas estão em 1.1; as que restam estão no fim desta seção)

Marcadas com * as que mudam o desenho de forma que custa caro refazer.

1. *Rede: só LAN ou também fora de casa? Padrão: **só LAN** nesta etapa, com o protocolo cifrado de ponta a ponta já preparado para um relay.
2. *Quem é a fonte da verdade? Padrão: **o desktop** (celular é réplica que também edita). Alternativa: pares iguais.
3. Relay/nuvem no futuro? Padrão: **não agora**; o desenho cifrado não depende dele.
4. *Distribuição: PWA ou app nativo (Capacitor)? Padrão: **PWA**, como hoje. Sem loja e sem conta de desenvolvedor, mas iOS limita o armazenamento do navegador (cota e remoção após dias sem uso). Capacitor resolveria armazenamento e certificado, ao custo de loja e build nativo.
5. *Dados locais cifrados em repouso, com senha/biometria para abrir? Padrão: **sim, opcional**, ligado por projeto.
6. Marcação em PDF escaneado (sem camada de texto): por retângulo? Padrão: **sim, depois**; primeiro só texto selecionável.
7. Número de celulares por desktop e se dois celulares editam o mesmo projeto? Padrão: **vários**, sem edição simultânea garantida além do protocolo de conflito.
8. Escopo de PDFs offline: todos, só incluídos ou escolhidos por artigo? Padrão: **escolha por artigo e por projeto**, com aviso de tamanho.
9. O que o celular pode **criar**: artigos, projetos, categorias, ou só marcar, anotar e escrever diário? Padrão: **marcação, anotação, diário, links, categorização**; criar artigo e projeto fica no desktop.
10. Compatibilidade de versão entre app e celular: o celular fica desatualizado? Padrão: handshake com `protocolVersion`; versão incompatível recusa sincronizar com mensagem clara.
11. Idioma: só pt-BR ou também inglês? Padrão: **só pt-BR** (como o desktop).
12. Existe iPhone e Android disponíveis para teste real? Os testes de PWA no iOS (Safari) dependem disso.
13. Licença e dependências novas permitidas (por exemplo uma biblioteca de CRDT para texto)? Padrão: **nenhuma**; log de operações próprio.
14. Escopo e prazo: as fases 1 e 2 vêm antes de qualquer tela. Concorda com essa ordem?
15. O E2E completo da #202 e a bateria da #201 continuam pendentes. Padrão: **não bloquear** esta frente; rodar a suíte `core` + mobile a cada commit.

## 5. Riscos

- Migração de schema para uuid em bancos existentes (o release 1.2.0 foi retirado por falha de inicialização, issue #22): precisa de teste de upgrade.
- Cota e remoção de armazenamento no Safari do iOS.
- Cripto: sem revisão externa, manter a superfície mínima e usar primitivas padrão.
- PDF grande em celular modesto (memória do pdf.js).

### Ainda em aberto depois das respostas

- Um projeto próprio do celular pode virar sincronizado (enviado ao desktop)? Se sim, é uma importação com dry run, e depois o desktop passa a mandar.
- Ao rejeitar o dry run no desktop, o celular desfaz a alteração local ou mantém e avisa a divergência?
- O celular sem o desktop por perto edita projeto sincronizado offline e acumula alterações pendentes até reencontrar o desktop?
- Como o celular só pareia com um desktop: trocar de desktop apaga a cópia local?
- Compatibilidade de versão (`protocolVersion`): recusar sincronizar com mensagem clara (padrão).
