# Cliente mobile (PWA)

Telas para celular sobre o mesmo núcleo do aplicativo (issue #33, épica #27). O código fica em
`emmas_librarian/mobile/` e o build (`npm run build:mobile`) gera `dist-mobile/`.

## Dois lugares, o mesmo app

| Onde | Para quê | Como chega |
|---|---|---|
| Servido pelo desktop (`https://<ip>:47810/`) | Controle remoto: lê a biblioteca ao vivo e faz as poucas escritas permitidas | QR code de Configurações › Acesso pelo celular |
| Publicado na web (GitHub Pages, em `/app/`) | Abrir um `.emmapcarc` guardado no celular, sem o computador | Endereço do site; pode ser instalado como app |

Por que dois: o desktop usa certificado autoassinado, e navegador não instala service worker (uso offline) em
site assim; já uma página publicada na web não consegue falar com o desktop. A cópia da web só abre arquivos.
A cópia do desktop faz as duas coisas, mas só enquanto o computador estiver ligado.

## O que dá para fazer

- **Projetos e artigos:** lista com filtro por título ou autor, situação e marca de PDF; página do artigo com
  metadados, resumo e link do DOI.
- **PDF:** somente leitura (pdf.js), uma página abaixo da outra, desenhadas conforme chegam perto da tela.
- **Marcações e anotações:** em lista na página do artigo, com a cor do marca-texto, a nota ligada e um link
  para a página do PDF. O marca-texto não é desenhado sobre a página.
- **Diário:** páginas da mais nova para a mais antiga, com o Markdown formatado (assim como as anotações). Conectado ao desktop, dá para escrever a página de hoje.
- **Acesso rápido:** links abrem no navegador. Conectado ao desktop, dá para adicionar um link.
- **Categorias:** valores do artigo. Conectado ao desktop, dá para mudar (texto, uma opção ou várias).

Arquivo aberto no celular é sempre somente leitura.

## Como é feito

- `ProjectReader` (`mobile/src/reader/`) é a única coisa que as telas conhecem. Duas implementações:
  `HttpProjectReader` (comandos do servidor da LAN) e `ArchiveProjectReader` (o `.emmapcarc`, com `fflate`).
  Um teste de contrato exporta um projeto real pelo núcleo e confere que as duas respondem igual, usando só os
  comandos que um dispositivo pareado pode rodar.
- O `.emmapcarc` não é carregado inteiro: ao abrir, só o índice do zip e o `project.json` são lidos do
  arquivo; cada PDF é lido e descompactado quando aberto (`mobile/src/reader/zipFile.ts`).
- Pareamento: a página lê o código de `#pair=<código>`, troca por um token em `POST /api/pair` e guarda o token no
  `localStorage` daquele endereço. "Desconectar" apaga o token do celular; revogar é no desktop, e o celular
  revogado volta sozinho para a tela inicial, com o aviso.
- O desktop serve `dist-mobile/` com uma Content-Security-Policy que só permite scripts e conexões do próprio
  servidor.
- Tipos e utilitários vêm de `src/types`, `src/utils` e `core/database/backup/projectFileFormat.ts`.

## Desenvolvimento

```bash
npm run build:mobile
```

```bash
npx vite --config vite.mobile.config.mts
```

O segundo sobe o cliente com recarga automática; sem o desktop por trás ele se comporta como a cópia da web
(só abre arquivos). Para testar o modo controle remoto, gere o build e use o endereço do QR code.

## Limitações conhecidas

- Não testado em celular de verdade: os testes rodam em jsdom e, no E2E, numa janela do Electron com largura de
  celular. Safari do iOS e Chrome do Android ficam por conferir, em especial o aviso de certificado e o pdf.js.
- Um `.emmapcarc` de mais de 4 GB (zip64) não é aberto.
- Recarregar a página com um arquivo aberto volta à tela inicial (o arquivo não é guardado).
- A cópia da web depende do deploy do GitHub Pages, que só roda a partir da `main`.
