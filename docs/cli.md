# CLI do Emma's Librarian

O próprio executável do aplicativo roda um comando da biblioteca sem abrir janela (issue #31, épica #27):

```bash
emmas-librarian cli <comando> [argumentos...] [opções]
```

Em desenvolvimento, dentro de `emmas_librarian/` e depois de `npx tsc -p tsconfig.electron.json`:

```bash
npx electron dist-electron/adapters/electron/main.js cli projects:getAll --pretty
```

## Comandos

Os comandos têm os nomes dos canais do aplicativo (`IpcChannel`) e são os mesmos que a interface usa, vindos do
registro em `core/commands`. `cli commands` lista os que funcionam em terminal; ficam de fora os diálogos, a
atualização do app, "abrir documento externo" e o leitor de PDF (classificação em
`core/commands/channelSurfaces.ts`).

```bash
emmas-librarian cli commands
emmas-librarian cli projects:create -- "Minha tese"
emmas-librarian cli articles:getByProject -- 3
emmas-librarian cli diary:save --args-json='[3, "2026-11-14", "Li dois artigos."]'
emmas-librarian cli export:csv -- 3 ./artigos.csv
```

- **Os argumentos vão depois de `--`**, ou todos juntos em `--args-json=<array>`. O Electron tem uma proteção
  contra a falha CVE-2018-1000006 (`CheckCommandLineArguments`, `shell/app/command_line_args.cc`): uma palavra com
  cara de URL (`articles:getByProject`: letras, `:`, e mais de uma letra antes dele) seguida de **outra palavra
  solta** faz o processo sair com -1, sem mensagem, antes de qualquer código nosso rodar. Só o `--` desliga a
  checagem; as opções (`--pretty`, `--opção=valor`) não contam como palavra solta. O Electron não deixa
  configurar isso, e a regra vale em qualquer sistema, não só no Windows.
- Um argumento que começa com `--` (por exemplo o `---` do Markdown) só passa depois do `--`.
- **As opções vêm antes do `--`**: `cli --data-dir=pasta projects:create -- "Minha tese"`. O que vem depois do `--` é
  argumento do comando, inclusive uma opção, e o CLI recusa o excesso com o código 2 em vez de ignorá-lo.
- Um comando recebe no máximo os argumentos que `cli commands` lista para ele; passar mais é erro de uso (código 2).
  Um texto com espaços vai entre aspas, para o terminal não o quebrar em vários argumentos.

- Cada argumento é lido como JSON quando possível (`3`, `true`, `null`, `[1,2]`, `{"a":1}`) e como texto no resto.
  Para passar como texto algo que parece JSON, use aspas de JSON: `'"123"'`.
- `--args-json=<array>` passa os argumentos exatamente como um array JSON; é a forma mais segura para scripts.
- Onde o aplicativo abriria um diálogo de arquivo, o CLI recebe o caminho como argumento. `cli commands` mostra
  qual argumento é (`"file": { "argument": 2, "mode": "save" }`).
- `cli commands` traz, em `args`, o nome de cada argumento do comando, na ordem. `cli <comando> --help` mostra
  a linha de uso (`emmas-librarian cli diary:save -- <projectId> <date> <content> <expected>`). Os últimos
  argumentos podem ser opcionais: isso não é indicado.

## Opções

| Opção | Efeito |
|---|---|
| `--data-dir <pasta>` ou `--data-dir=<pasta>` | Abre a biblioteca dessa pasta em vez da do aplicativo. |
| `--args-json <array>` ou `--args-json=<array>` | Argumentos do comando como array JSON. |
| `--` | Termina as opções: tudo depois é argumento do comando. |
| `--pretty` | JSON indentado. |
| `--help` | Texto de ajuda. |

Uma opção desconhecida (`--nao-existe`, `--pretty=true`) falha com o código 2 e cita o valor; ela nunca é lida como
argumento. Antes, `--data-dir=pasta` era tratado como argumento e o comando rodava na biblioteca do aplicativo.

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

Se o aplicativo estiver aberto na mesma biblioteca, o CLI não abre o banco: ele manda o comando para o próprio
aplicativo, por um canal local (`127.0.0.1`, token em `app-running.json`, ver `docs/acesso-pelo-celular.md`). O
resultado, os erros e os códigos de saída são os mesmos.

- O caminho do arquivo que o comando lê ou grava (o argumento indicado por `cli commands`) pode ser relativo: o
  CLI o torna absoluto a partir da pasta do terminal. Outros argumentos que sejam caminhos (por exemplo o PDF de
  `pdf:upload`) devem ser absolutos, porque quem os lê é o aplicativo.
- Os comandos que trocam o arquivo do banco (`backup:restoreOverride`, `backup:restoreAuto`) são recusados com o
  código 5 enquanto o aplicativo estiver aberto.
- A tela do aplicativo não é avisada do que o CLI gravou: ela mostra a mudança quando recarregar os dados.
- Se o aplicativo não responder (marcador deixado por um travamento), o CLI abre o banco diretamente, em modo WAL.

## Perguntar ao agente local (`ask`)

```
emmas-librarian cli ask --text --llama-server <caminho> -- "Quais projetos eu tenho?"
```

Uma pergunta em linguagem natural, respondida por um modelo pequeno que roda na sua máquina (LFM3-1.7B, com o d1-2B
escolhendo os assuntos; os números estão em `docs/avaliacao-modelos.md` e as licenças em `docs/agente.md`). O agente
usa as mesmas ferramentas da biblioteca que o CLI expõe, e **nada sai do computador**.

- **Precisa do `llama-server` da versão `b12425`**, em `--llama-server <caminho>` ou na variável `LLAMA_SERVER`. O
  aplicativo não o instala.
- **Os modelos** (cerca de 1,1 GB cada) ficam em `models/` dentro da pasta de dados, ou em `--models-dir <pasta>`. Se
  faltarem, uma janela pergunta antes de baixar, com o tamanho, o endereço e a licença; sem um "Sim" nada é baixado.
  O arquivo é conferido por SHA-256 e um download interrompido recomeça de onde parou.
- **Toda chamada que muda a biblioteca abre uma janela** perguntando se pode executar, com o comando e os argumentos.
  O botão padrão e o fechar da janela são "Não". Não existe `--yes`; para automatizar, use os comandos do CLI.
  A pergunta é uma janela, e não o terminal, porque o executável do aplicativo no Windows é um programa de janela: o
  stdin chega vazio e o stderr não aparece.
- **A resposta traz as chamadas feitas**: em `--text`, abaixo do texto; em JSON, no campo `calls`. Um modelo pequeno
  erra um pedido em cada oito, e a lista é como você confere o que ele fez.
- **Tempo:** na RX 580 (Vulkan), cerca de 70 s por pergunta, contando subir os dois servidores. A maior parte é a
  inicialização.
- O resultado em JSON é `{ "answer", "calls", "stopped", "fallback", "subjects", "device" }`. Códigos de saída: os
  da tabela acima; `ask` sem pergunta ou sem `llama-server` sai com 2, e uma falha do modelo local com 1.

## Limitações conhecidas

- **Linux sem display** (servidor, SSH): passe `--ozone-platform=headless` antes de `cli`. O Chromium escolhe a
  plataforma antes de o código do app rodar, então o app não consegue fazer isso sozinho.
- **Windows**: o executável é um programa de janela, então o `cmd`/PowerShell não mostra a saída na tela. Ela
  chega normalmente quando é redirecionada ou lida por outro programa (`... cli commands > saida.json`).
- **Chaves de API**: são decifradas pelo cofre do sistema do mesmo usuário que usa o aplicativo.
- O arranque leva cerca de um segundo, porque é o Electron que sobe.
