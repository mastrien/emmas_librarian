# Investigação: crash 0xC0000005 do instalador NSIS na primeira instalação (out/2026)

O instalador do Emma's Librarian (NSIS 3.0.4.1, gerado pelo `electron-builder` 26.8.1) saía com `0xC0000005` em cerca de
1 s, sem instalar nada, em ~20% das primeiras instalações em runners Windows novos do GitHub. Derrubou o job
`update-flow` do PR #23 (run 38009753573) quando a nova tentativa, 20 s depois, também crashou. Esta pasta, a
`2026-10-launch-probe/` e a `2026-10-dump-analysis/` guardam os experimentos. Nada aqui muda o app.

## Causa

Uma leitura fora dos limites no template NSIS do próprio `electron-builder`
(`app-builder-lib/templates/nsis/multiUser.nsh`, linha 35, macro `setInstallModePerUser`):

```nsis
System::Call 'SHELL32::SHGetKnownFolderPath(g "${FOLDERID_UserProgramFiles}", i ${KF_FLAG_CREATE}, p 0, *p .r2)i.r1'
${If} $1 == 0
  System::Call '*$2(&w${NSIS_MAX_STRLEN} .s)'     ; lê 8192 caracteres UTF-16 (0x4000 bytes)
```

`$2` aponta para uma string curta (`...\AppData\Local\Programs`) que o Windows alocou com `CoTaskMemAlloc`. O formato
`&w${NSIS_MAX_STRLEN}` copia `NSIS_MAX_STRLEN` (8192 neste build, "large strings") caracteres a partir dele, não até o
terminador nulo. Se a string está perto do fim do bloco e a página seguinte não está mapeada, o `System.dll` lê um
endereço inválido e o processo morre com `c0000005`.

Esse ramo só roda quando **não há `InstallLocation` no registro** (linhas 26-28 usam o caminho salvo e pulam a
chamada). Por isso o crash é da primeira instalação.

## Evidência

| O que | Resultado |
|---|---|
| 4 minidumps (WER, run 38070894167, análise no run 38072399076) | mesmo ponto de falha: `System.dll` (x86-unicode, 12288 bytes) offset `0x1581`, laço `mov al,[ecx+edx]; mov [edx],al; inc edx; dec esi; jne`; `memcpy` de `0x4000` bytes; origem a `0x170` bytes do fim de um bloco de `0x2000`; endereço lido = fim do bloco |
| mesmo laço no pacote do `electron-builder` | `nsis-3.0.4.1/Plugins/x86-unicode/System.dll`, RVA `0x1581` |
| instalações sem chave no registro (run 38072774395) | 14 de 44 crasharam (32%) |
| reinstalações com a chave presente (mesmo run) | **0 de 150** |
| reinstalações, investigação anterior | 1 de 60 (contra 3 de 10 nas primeiras) |

Por que é intermitente e dava tantos resultados estranhos: só falha quando o layout de memória deixa a página depois do
bloco sem mapeamento. O depurador (`cdb`) muda esse layout (0 de 24 crashes), `cmd /c "instalador"` também (0 de 50), e
os processos filhos do Node herdam o modo de erro `32771` (`SEM_NOGPFAULTERRORBOX`), então nenhum crash deixava evento ou
dump até o instalador ser lançado com `CREATE_DEFAULT_ERROR_MODE` (`launch-default-errormode.ps1`).

## O que foi descartado

Defender, nível de integridade (o usuário do runner não tem token filtrado, então "integridade média" não existe lá),
pipes de saída, console, pausa antes de lançar, `spawn` síncrono ou assíncrono, `SEM_FAILCRITICALERRORS`, e a `UAC.dll`
(é só o último plugin extraído antes do crash).

## Limites do que se sabe

- A linha 35 é identificada por leitura do template mais a coincidência exata (`0x4000` bytes, só na primeira
  instalação, `System.dll`), não por um mapa do script compilado até o endereço do chamador.
- Não testei uma correção. Uma candidata é ler até o terminador nulo, por exemplo
  `System::Call 'kernel32::lstrcpyW(t .r0, p r2)'`; ela mudaria o instalador distribuído e precisa do teste de release.
- Nenhum relato upstream foi encontrado nas buscas.

## Rascunho de relatório para o `electron-builder` (não enviado)

> **Title:** NSIS per-user installer: out-of-bounds read in `setInstallModePerUser` (`System::Call '*$2(&w${NSIS_MAX_STRLEN} .s)'`) crashes the installer intermittently on first install
>
> **Where:** `packages/app-builder-lib/templates/nsis/multiUser.nsh`, `setInstallModePerUser`, the `SHGetKnownFolderPath(FOLDERID_UserProgramFiles)` branch (taken when `InstallLocation` is not in the registry).
>
> **What happens:** `System::Call '*$2(&w${NSIS_MAX_STRLEN} .s)'` copies `NSIS_MAX_STRLEN` UTF-16 characters (8192 with the
> large-strings build, 0x4000 bytes) from `$2`, a short string allocated by `SHGetKnownFolderPath` (`CoTaskMemAlloc`). It does
> not stop at the NUL terminator. When the string sits near the end of its heap block and the next page is unmapped, the
> installer dies with `0xC0000005` about 1 s after start, before installing anything.
>
> **Evidence:** four WER minidumps show the same fault: `System.dll` (NSIS 3.0.4.1, `x86-unicode`) at RVA `0x1581`, the
> byte-copy loop of a 0x4000-byte `memcpy`, source 0x170 bytes before the end of a 0x2000-byte block, faulting address =
> end of the block. On GitHub `windows-latest` runners, 14 of 44 first installs (no `InstallLocation` key) crashed, 0 of 150
> reinstalls (key present). Debugging changes the memory layout and hides it, which makes it look random.
>
> **Versions:** electron-builder 26.8.1, NSIS bundle 3.0.4.1 (resources 3.4.1), `nsis.oneClick: false`, per-user install.
>
> **Suggested fix (untested):** read up to the terminator instead of a fixed length, e.g. `System::Call 'kernel32::lstrcpyW(t .r0, p r2)'`.
