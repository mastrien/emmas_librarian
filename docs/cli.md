# CLI do Emma's Librarian

O próprio executável do aplicativo roda um comando da biblioteca sem abrir janela (issue #31, épica #27):

```bash
emmas-librarian cli <comando> [argumentos...] [opções]
```

Em desenvolvimento, dentro de `emmas_librarian/` e depois de `npx tsc -p tsconfig.electron.json`:

```bash
npx electron dist-electron/electron/main.js cli projects:getAll --pretty
```

## Comandos

Os comandos têm os nomes dos canais do aplicativo (`IpcChannel`) e são os mesmos que a interface usa, vindos do
registro em `core/commands`. `cli commands` lista os que funcionam em terminal; ficam de fora os diálogos, a
atualização do app, "abrir documento externo" e o leitor de PDF (classificação em
`core/commands/channelSurfaces.ts`).

```bash
emmas-librarian cli commands
emmas-librarian cli projects:create "Minha tese"
emmas-librarian cli articles:getByProject 3
emmas-librarian cli diary:save --args-json '[3, "2026-11-14", "Li dois artigos."]'
emmas-librarian cli export:csv 3 ./artigos.csv
```

- Cada argumento é lido como JSON quando possível (`3`, `true`, `null`, `[1,2]`, `{"a":1}`) e como texto no resto.
  Para passar como texto algo que parece JSON, use aspas de JSON: `'"123"'`.
- `--args-json '<array>'` passa os argumentos exatamente como um array JSON; é a forma mais segura para scripts.
- Onde o aplicativo abriria um diálogo de arquivo, o CLI recebe o caminho como argumento. `cli commands` mostra
  qual argumento é (`"file": { "argument": 2, "mode": "save" }`).
- Os argumentos são os mesmos que o canal recebe no aplicativo; o CLI ainda não descreve cada um.

## Opções

| Opção | Efeito |
|---|---|
| `--data-dir <pasta>` | Abre a biblioteca dessa pasta em vez da do aplicativo. |
| `--args-json <array>` | Argumentos do comando como array JSON. |
| `--pretty` | JSON indentado. |
| `--help` | Texto de ajuda. |

O CLI nunca cria uma biblioteca: se a pasta não tem `emma.db`, ele falha com `ERR_LIBRARY_NOT_FOUND`.

## Saída e códigos de saída

Sucesso: uma linha de JSON em **stdout**, `{"ok":true,"result":...}`.
Falha: uma linha de JSON em **stderr**, `{"ok":false,"error":{"code","type","message"}}`, e stdout vazio.
Logs e avisos do Chromium vão para stderr; stdout só carrega o resultado.

| Código | Significado |
|---|---|
| 0 | Sucesso. |
| 1 | Falha do sistema (disco, banco de dados, erro interno). |
| 2 | Uso incorreto: comando desconhecido ou só do aplicativo, opção inválida, falta o caminho do arquivo. |
| 3 | Entrada recusada pelo comando: não encontrado, nome duplicado, valor inválido. |
| 4 | Falha de rede ou do provedor; a mesma chamada pode funcionar depois. |
| 5 | O aplicativo está aberto nessa biblioteca e o comando substituiria o banco de dados. |

## Com o aplicativo aberto

O CLI abre o mesmo `emma.db` (modo WAL, que aceita leitores e escritores ao mesmo tempo). Só os comandos que
trocam o arquivo do banco (`backup:restoreOverride`, `backup:restoreAuto`) são recusados com o código 5 enquanto
o aplicativo estiver aberto. A tela do aplicativo não é avisada do que o CLI gravou: ela mostra a mudança quando
recarregar os dados. Falar com o aplicativo aberto em vez de abrir o banco fica para o servidor local (#32).

## Limitações conhecidas

- **Linux sem display** (servidor, SSH): passe `--ozone-platform=headless` antes de `cli`. O Chromium escolhe a
  plataforma antes de o código do app rodar, então o app não consegue fazer isso sozinho.
- **Windows**: o executável é um programa de janela, então o `cmd`/PowerShell não mostra a saída na tela. Ela
  chega normalmente quando é redirecionada ou lida por outro programa (`... cli commands > saida.json`).
- **Chaves de API**: são decifradas pelo cofre do sistema do mesmo usuário que usa o aplicativo.
- O arranque leva cerca de um segundo, porque é o Electron que sobe.
