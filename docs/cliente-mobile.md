# Cliente mobile (PWA)

Telas para celular sobre o mesmo núcleo do aplicativo (issue #33, épica #27). O código fica em
`emmas_librarian/mobile/` e o build (`npm run build:mobile`) gera `dist-mobile/`.

## Três modos, as mesmas telas

O aplicativo do celular (Capacitor, Android) e a cópia web com `?local=1` usam uma **biblioteca própria no aparelho**,
sincronizada com o computador (`docs/sincronizacao-celular.md`): lê e escreve sem o computador por perto, marca trechos em
PDFs baixados, cria projetos só do celular, e segue a aparência do desktop (modo, tom, cor de destaque, Lexend, Source
Serif 4, JetBrains Mono). Os dois modos abaixo continuam como estavam.

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

## Gerar o APK de teste

O app Android é o mesmo build do cliente (`dist-mobile/`) dentro do WebView do Capacitor. A pasta `android/` é gerada
(`npx cap add android`) e fica no `.gitignore`; o que a torna reproduzível é a configuração em `capacitor.config.ts`
e o passo `npm run android:prepare`, que ajusta o manifest gerado.

Por que isso importa (#208): a página roda em `https://localhost` e chama `http://<ip do computador>:47811/api/sync/*`.
`plugins.CapacitorHttp.enabled` faz o `fetch` sair pelo cliente HTTP nativo, sem preflight de CORS e sem bloqueio de
conteúdo misto. O Android 9 em diante recusa HTTP sem TLS, e `server.cleartext` não grava `usesCleartextTraffic` neste
projeto; por isso `android:prepare` grava o atributo (e a permissão `CAMERA` e o módulo do leitor de QR). Como segunda
linha de defesa, a porta de sincronização do desktop também responde ao preflight para `https://localhost`.

Pré-requisitos: JDK 21, Android SDK com a plataforma 36 e o build-tools (o Gradle baixa o que faltar se as licenças
estiverem aceitas) e uns 3 GB livres para os caches do Gradle. Em `emmas_librarian/`:

```powershell
$env:JAVA_HOME = 'C:\Program Files\Microsoft\jdk-21.0.11.10-hotspot'
$env:ANDROID_HOME = 'C:\Android\Sdk'
npm run build:mobile
npx cap add android          # só na primeira vez
npm run android:prepare      # cleartext, CAMERA e módulo do leitor de QR no manifest
npx cap sync android
cd android
.\gradlew.bat assembleDebug
```

O APK sai em `android/app/build/outputs/apk/debug/app-debug.apk` (cerca de 28 MB, assinado com a chave de debug).
Para instalar:

- Com o celular em modo desenvolvedor, depuração USB ligada e cabo: `adb install -r app-debug.apk`.
- Ou copie o arquivo para o celular, abra-o e permita a instalação de fontes desconhecidas quando o Android pedir.

### Testar no aparelho

1. Computador e celular na mesma rede Wi-Fi. O firewall do Windows pode pedir para liberar as portas do aplicativo:
   permita em redes privadas.
2. No desktop, em Configurações, ligue "Acesso pelo celular" e abra "Parear um celular" para mostrar o QR.
3. No app, vá em Ajustes, toque para parear e leia o QR (aceite a permissão da câmera).
4. Sincronize e confira que a biblioteca do computador aparece no celular.
5. Crie algo no celular (uma página do diário ou um destaque), sincronize de novo e, no desktop, aplique a mudança
   na lista de mudanças do celular.
6. Se algo falhar, `adb logcat | findstr /i "Capacitor chromium"` mostra o erro de rede do WebView.

## Limitações conhecidas

- Não testado em celular de verdade: os testes rodam em jsdom e, no E2E, numa janela do Electron com largura de
  celular. Safari do iOS e Chrome do Android ficam por conferir, em especial o aviso de certificado e o pdf.js.
- Um `.emmapcarc` de mais de 4 GB (zip64) não é aberto.
- Recarregar a página com um arquivo aberto volta à tela inicial (o arquivo não é guardado).
- A cópia da web depende do deploy do GitHub Pages, que só roda a partir da `main`.
