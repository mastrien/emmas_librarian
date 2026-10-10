# Crash intermitente do instalador na primeira instalação (0xC0000005)

Relatório de uma investigação feita em 10/10/2026. Registra o problema, o que foi tentado (inclusive o que deu errado),
as evidências, a causa, a correção e como refazer cada passo. Foi escrito para quem não acompanhou o processo.

- **Resumo em uma frase:** o instalador NSIS gerado pelo `electron-builder` lê 16 KB a partir de uma string curta na
  primeira instalação e, quando a página seguinte da memória não está mapeada, o Windows encerra o processo com
  `0xC0000005`. Não é um defeito do app.
- **Correção:** patch de uma linha no template NSIS do `electron-builder`, aplicado com `patch-package`
  (branch `fix/nsis-install-location-overread`).
- **Onde está o trabalho:** branch `investigate/installer-crash-root` (scripts, workflows e este relatório) e branch
  `fix/nsis-install-location-overread` (a correção). Os PRs só serão abertos quando tudo estiver finalizado.

## 1. O problema

### 1.1 O sintoma

Nos testes de release que instalam o app em runners Windows do GitHub, o instalador às vezes sai com o status
`3221225477` (`0xC0000005`, violação de acesso) cerca de 1 segundo depois de começar, sem instalar nada
(`app exe present=false`, `stdout=""`, `stderr=""`). O teste tolera um crash do instalador do release publicado e tenta
de novo uma vez depois de 20 s, mas nos casos ruins a nova tentativa também crasha.

Exemplo que motivou a investigação: no PR #23, o job `update-flow (windows-latest)` falhou no run `38009753573`
(commit `d318700`) em `Update through the app and compare`:

```
[ERR_RELEASE_TEST_INSTALL] "Emma's Librarian Setup 9.0.0.exe " exited with status=3221225477 ...
app exe present=false; stdout="" stderr="". Expected status 0.
```

Entre 08 e 10/10/2026, 4 de 27 jobs Windows dos testes de release falharam assim (runs `38009753573`, `38014725327`,
`38023731009`, esse com os dois jobs). O mesmo job passou no run seguinte, o que sugere instabilidade e não regressão.

### 1.2 O que já se sabia

A investigação anterior (`investigations/2026-10-v120-installer/README.md`, 08/10) já tinha medido o crash e descartado o
Defender: o `0xC0000005` ocorria em ~1 s e quase só na **primeira instalação** de um Windows recém-criado (3 de 10), com
qualquer versão do instalador, e só 1 de 60 em reinstalações. Não deixava evento "Application Error", nem dump, nem
evento do Defender. A causa ficou em aberto. Esta investigação continuou dali.

## 2. Linha do tempo das tentativas

Cada rodada rodou em runners novos (`windows-latest`, imagem `windows-2025-vs2026`). "Direto" quer dizer iniciar o
instalador com `spawnSync` do Node, como o harness de teste faz. As taxas de base ficaram em cerca de **20%** das
primeiras instalações lançadas direto (dezenas de amostras em várias rodadas).

| Rodada | Run | O que foi testado | Resultado |
|---|---|---|---|
| 1 | `38056004941` | direto (`plain`) contra o instalador sob o depurador `cdb` | direto 4/12; **`cdb` 0/12** (o depurador esconde o crash); nenhum evento WER, nenhum dump; sobra em `%TEMP%` uma pasta `ns*.tmp` só com `System.dll` e `UAC.dll` |
| 2 | `38056490987` | `cdb` sem o heap de depuração (`-hd`), Process Monitor, conteúdo dos `ns*.tmp` | `cdb-hd` 0/12, direto 1/12, Procmon 3/11; o traço termina logo depois de uma thread nova carregar o `msctf.dll`, sem `Process Exit` |
| 3 | `38057903508`, `38058390794`, `38060255386` | rodar com "integridade média" (`runas /trustlevel`, depois um token feito à mão) | o `runas` deixou o processo em integridade **alta** (2/30 contra 5/30 do direto, sem diferença); o token manual travou o `cmd.exe` em 60 de 60 jobs |
| 4 | `38061346766` | tarefa agendada com nível "limitado" | continuou em integridade alta (`EnableLUA=1`, grupo Administradores habilitado); **0/30 crasharam**, contra 4/10 do direto: mudar a forma de lançar mexeu na taxa |
| 5 | `38061678549` | variantes de lançamento: sem pipes, ambiente mínimo, via `cmd.exe` | `stdio-ignore` 6/30, `clean-env` 2/30, **`via-cmd` 0/30** |
| 6 | `38063009924` | console oculto, sem console, pausa de 100 ms, `spawn` assíncrono | `hide` 6/30, `detached` 5/30, `delay` 7/30, `async` 4/30; `via-cmd` 0/10 de novo |
| 7 | `38064304918` | `cmd` com handles em NUL, pai PowerShell, `cmd /c start /wait` | `cmd-nul` 3/30, `via-pwsh` 5/30, `cmd-start` 9/30, `via-cmd` 0/10 |
| 7b | `38065035452` | probe dos atributos herdados por cada caminho de lançamento | nenhum atributo isolado separa o `via-cmd` dos demais |
| 8 | `38070894167` | instalador lançado com `CREATE_DEFAULT_ERROR_MODE`, para o WER registrar | **4/30 crasharam e deixaram minidump**: a primeira vez que se viu o ponto exato da falha |
| 8b | `38072399076` | análise dos 4 minidumps com o `cdb` | mesmo ponto de falha nos quatro (seção 3) |
| 9 | `38072774395` | primeira instalação e depois 5 reinstalações no mesmo runner | sem a chave no registro 14/44 crasharam; **com a chave 0/150** |
| 10 | `38076935197` | verificação da correção com instaladores compilados no CI | todos os 90 jobs falharam por um erro meu (o instalador se chama `Emma's Librarian Setup ...exe` e o apóstrofo quebrava um comando PowerShell) |
| 10b | `38077489666` | o mesmo, corrigido | `control` 2/40 e 1/5; `patched` 0/40 e 0/5; pasta padrão igual nos dois |
| 11 | `38078315267` | os mesmos instaladores com page heap | **`control` 6/6 crasharam em `System.dll+0x1581`; `patched` 0/6 passam por ali** (e um segundo defeito, no `StdUtils`, aparece no fim) |

### 2.1 O que cada tentativa ensinou (e onde errei)

- **Rodadas 1 e 2:** mostraram que o crash existe sem depurador e que o depurador o esconde. Isso é típico de defeito que
  depende do layout de memória, mas na hora eu ainda não sabia disso.
- **Rodadas 3 e 4 ("integridade média"):** foram quatro runs gastos numa hipótese que não dava para testar. O usuário
  do runner (`runneradmin`) não tem token filtrado, então não existe integridade média ali: `runas /trustlevel`, um token
  feito à mão e uma tarefa "limitada" ficaram em integridade alta ou travaram. O erro foi supor que um mecanismo de
  rebaixamento funcionava sem **gravar o nível de integridade real do processo**. Só a rodada 3 gravou isso e só aí vi
  que o teste não valia nada. Regra aprendida: toda variante deve registrar a propriedade que diz ter mudado.
- **Rodadas 4 a 7:** o `cmd /c "instalador"` zerou o crash (0 de 50), mas nenhum atributo do processo explicava isso, e
  variantes parecidas (`cmd /c start`, `cmd` com NUL, pai PowerShell) crasharam. A explicação, vista depois, é que a
  forma de lançar muda o layout de memória, o que muda se a página depois do bloco está mapeada. Foi uma mudança de sorte,
  não uma correção.
- **Rodada 8:** a pista decisiva foi o **modo de erro herdado**. Um filho do Node herda `SEM_NOGPFAULTERRORBOX`
  (modo `32771`), o que impede o Windows Error Reporting de registrar o crash. Por isso nenhuma rodada anterior viu evento
  ou dump. Medi com um executável mínimo (filho do Node: `32771`; via `cmd`: `32771`; com a flag `CREATE_DEFAULT_ERROR_MODE`
  do `CreateProcess`: `0`). Atenção: `SetErrorMode(0)` no PowerShell **não** zera o que o filho herda (testei, falhou). Foi
  preciso um lançador com a flag (`launch-default-errormode.ps1`).
- **Um erro de interpretação corrigido no caminho:** a hipótese de que a `UAC.dll` era a causa nasceu de ela ser o último
  plugin extraído antes do crash. Os dumps mostraram que quem falha é o `System.dll`.

## 3. A causa

### 3.1 O que os dumps mostram

Nos quatro minidumps, o ponto de falha é idêntico (só mudam os endereços por causa do ASLR):

- módulo `System.dll` do NSIS 3.0.4.1, variante `x86-unicode` (12288 bytes, o mesmo tamanho do `System.dll` deixado em
  `ns*.tmp` em todo crash), offset `0x1581`;
- a instrução é o laço de cópia byte a byte `mov al,[ecx+edx]; mov [edx],al; inc edx; dec esi; jne`, ou seja, um
  `memcpy(destino, origem, 0x4000)`;
- origem em `0x03011E90`, quando o bloco que a contém termina em `0x03012000`: restam só `0x170` bytes de um bloco de
  `0x2000`, e o endereço lido é exatamente o fim do bloco (`Attempt to read from address 03012000`);
- pilha: executável do instalador (`+0x20c0`) → `System!Call+0x7f` → o laço de cópia.

Confirmei que o mesmo laço (os bytes `8a 04 11 88 02 42 4e 75 f7`) existe no `System.dll` do pacote que o `electron-builder`
baixa (`nsis-3.0.4.1/Plugins/x86-unicode/System.dll`), no RVA `0x1581`.

### 3.2 A linha

`0x4000` bytes são 8192 caracteres UTF-16, que é `NSIS_MAX_STRLEN` neste build ("large strings"). No template do
`electron-builder` (`app-builder-lib/templates/nsis/multiUser.nsh`, linha 35, macro `setInstallModePerUser`):

```nsis
System::Call 'SHELL32::SHGetKnownFolderPath(g "${FOLDERID_UserProgramFiles}", i ${KF_FLAG_CREATE}, p 0, *p .r2)i.r1'
${If} $1 == 0
  System::Call '*$2(&w${NSIS_MAX_STRLEN} .s)'      ; lê 8192 caracteres a partir de $2
```

`$2` aponta para uma string curta (`C:\Users\...\AppData\Local\Programs`) que o Windows alocou com `CoTaskMemAlloc`. O
formato `&w${NSIS_MAX_STRLEN}` copia um número fixo de caracteres, não até o terminador nulo. Quando a string está perto do
fim de um bloco e a página seguinte não está mapeada, a leitura cruza o limite e o Windows encerra o processo.

### 3.3 Por que só na primeira instalação

Esse ramo só roda quando **não há `InstallLocation` no registro** (as linhas 26 a 28 usam o caminho salvo e pulam a
chamada). Em uma reinstalação a chave existe. O teste da rodada 9 mediu isso diretamente:

| Estado | Instalações que crasharam |
|---|---|
| sem a chave no registro (primeira instalação e tentativas seguintes após um crash) | **14 de 44** (32%) |
| com a chave (reinstalações) | **0 de 150** |

Com uma taxa de ~20%, ver 0 em 150 por acaso tem chance da ordem de 10⁻¹⁵.

### 3.4 Por que parecia aleatório e enganava

Depende de a memória depois do bloco estar mapeada ou não, ou seja, do layout (ASLR e ordem das alocações):

- o depurador muda o layout (0 de 24 sob o `cdb`);
- lançar por `cmd.exe` muda o layout (0 de 50), sem corrigir nada;
- o ambiente, o pai e a pausa antes de lançar mexem pouco ou nada na taxa;
- filhos do Node herdam `SEM_NOGPFAULTERRORBOX`, então ninguém via evento ou dump.

### 3.5 O que continua sendo inferência

- A linha 35 foi identificada por leitura do template e pela coincidência exata dos números (`0x4000` bytes, só na
  primeira instalação, `System.dll`), não por um mapa do script compilado até o endereço do chamador. A prova de
  causalidade vem do teste sem e com a chave no registro (0 de 150) e da verificação com page heap (6 de 6 contra 0 de
  6), seção 4.2.
- Usuários reais devem ter o mesmo risco na primeira instalação, mas não foi medido fora dos runners.
- Não foi encontrado relato upstream do defeito nas buscas.

## 4. A correção

### 4.1 O patch

Em vez de ler um número fixo de caracteres, copiar até o terminador nulo com `lstrcpyW`, mantendo a saída `.s` e o resto
do bloco como estavam:

```diff
-        System::Call '*$2(&w${NSIS_MAX_STRLEN} .s)'
+        System::Call 'kernel32::lstrcpyW(t .s, p r2)v'
```

Aplicado com `patch-package` no `postinstall` (`patch-package && electron-builder install-app-deps`), com o arquivo
`emmas_librarian/patches/app-builder-lib+26.8.1.patch`. O `electron-builder 26.8.1` já usa o pacote NSIS mais novo
(`nsis-3.0.4.1`, recursos `3.4.1`), então atualizar a versão não resolve.

Testes: `release-tests/__tests__/nsisInstallTemplate.test.ts` confere o template instalado (falha sem o patch, passa com
ele). Também há uma regra de `.gitattributes` para o patch ficar sempre com fim de linha LF.

### 4.2 Verificação em instaladores reais

Workflow `verify-nsis-fix.yml` na branch de investigação: compila dois instaladores (um da branch da correção, outro da
mesma `main` sem o patch, `ef8b707`), instala cada um em 40 runners novos e confere o diretório padrão de instalação.

Duas verificações, a segunda é a que prova.

**a) Taxa em instaladores compilados no CI (run `38077489666`, 45 runners por lado).** Dois instaladores reais: `patched`
(branch da correção, o `npm ci` aplica o patch) e `control` (a mesma `main`, `ef8b707`, sem o patch).

| Instalador | Primeiras instalações que crasharam |
|---|---|
| `control` | 2 de 40, e 1 de 5 no teste da pasta padrão |
| `patched` | 0 de 40, e 0 de 5 |

Isso **não** discrimina por si só: o controle compilado crashou só ~7%, bem abaixo dos ~20-30% dos instaladores
`1.1.23` e `9.0.0` (cada binário tem um layout de memória um pouco diferente), e 2/40 contra 0/40 tem cerca de 24% de
chance de ser acaso. O que a execução prova é a função: o instalador patchado instala normalmente e calcula a mesma pasta
padrão do controle (`emmas_librarian`, em `%LOCALAPPDATA%\Programs`), ou seja, a nova leitura da string está correta.

**b) Page heap, que torna o defeito determinístico (run `38078315267`).** Com `gflags /p /full` no executável do
instalador, cada bloco de heap fica seguido de uma página de guarda e qualquer leitura além do fim falha na hora. Mesmos
dois instaladores do run anterior, 6 primeiras instalações cada:

| Instalador | Resultado |
|---|---|
| `control` | **6 de 6** `0xC0000005`, sempre em `System.dll+0x1581` (bucket `INVALID_POINTER_READ_AVRF`) |
| `patched` | **0 de 6** passam por esse ponto |

Isso confirma a causa de ponta a ponta: o defeito é uma leitura além do fim de um bloco de heap, e o patch a elimina.

**Um segundo defeito, separado, apareceu.** No instalador patchado com page heap, os 6 saíram com `0xC0000421` (verifier
stop) 40 a 79 s depois de começar, ou seja, no fim da instalação: o verificador acusa um bloco de heap corrompido num `free`
dentro do `StdUtils.dll` quando o plugin é descarregado (`DLL_PROCESS_DETACH`). Sem page heap isso é silencioso (as
instalações normais saem com 0), e acontece ao encerrar o processo, depois de instalar. Fica registrado como defeito
latente do plugin `StdUtils` do NSIS, **fora do escopo desta correção**. Não foi investigado mais (não confirmei que a
instalação termina por inteiro nesse caso; a duração de 40 a 79 s é compatível com isso).

## 5. Como refazer ou revisitar

### 5.1 Onde está cada coisa

| O que | Onde |
|---|---|
| scripts do experimento principal | `investigations/2026-10-installer-crash-root/` (`crash-root.mjs`, `launch-variants.mjs`, `launch-default-errormode.ps1`, `medium.mjs`, `procmon.mjs`, `summarize.mjs`) |
| probe dos atributos herdados | `investigations/2026-10-launch-probe/` |
| análise dos minidumps | `investigations/2026-10-dump-analysis/` |
| workflows | `.github/workflows/investigate-installer-crash-root.yml` (matriz grande, só dispara ao editar `RUN-MATRIX`), `investigate-launch-probe.yml`, `investigate-dump-analysis.yml`, `verify-nsis-fix.yml` |
| a correção | branch `fix/nsis-install-location-overread` |
| investigação anterior | `investigations/2026-10-v120-installer/README.md` |

Os artefatos dos runs ficam 90 dias no GitHub. Passado esse prazo, só restam os números deste relatório e o que está
nos scripts.

### 5.2 Comandos úteis

```bash
# ler a tabela de um run (job "summary")
gh run view <run-id> --job <job-id-do-summary> --log | grep -E "^(plain|reinstall|patched|control)"

# baixar os dumps de um run e analisá-los (precisa do cdb x86; o workflow de análise instala)
gh run download 38070894167 -n result-root-pwsh-em0-1

# rodar a matriz principal de novo
# (edite investigations/2026-10-installer-crash-root/RUN-MATRIX e dê push na branch de investigação)
```

### 5.3 Armadilhas já pisadas

- Um filho do Node herda o modo de erro `32771`: sem `CREATE_DEFAULT_ERROR_MODE` nenhum crash vira evento ou dump.
- `SetErrorMode(0)` no PowerShell não zera o que o filho herda.
- Um depurador esconde defeitos que dependem de layout de memória: "não crasha sob o `cdb`" não quer dizer "não existe".
- No runner do GitHub não existe integridade média para o usuário padrão: não gaste rodadas nisso.
- `cmd /c start /wait` devolve o código de saída 0 mesmo se o programa falhar: repasse o `ERRORLEVEL` com `/v:on`.
- Heredoc do shell e `sed` comem barras invertidas. Para arquivos com caminhos do Windows, use a ferramenta de escrita.
- Antes de concluir de uma variante, confira que ela realmente fez o que dizia (grave a propriedade que ela muda).

## 6. O que decidir ainda

1. Acompanhar o relatório aberto no `electron-builder`: https://github.com/electron-userland/electron-builder/issues/10296 (aberto em 10/10/2026, com os números das duas verificações).
2. Abrir o PR da correção (`fix/nsis-install-location-overread`) e o PR da investigação (scripts e este relatório).
3. Se o upstream corrigir, remover o patch e a dependência explícita do `patch-package` na versão que trouxer a correção.
4. Decidir se vale reduzir o ruído do CI: com a correção, a tolerância de 20 s do harness para o instalador publicado
   deixa de ser necessária para o instalador novo (continua valendo para versões antigas já publicadas, que têm o defeito).
