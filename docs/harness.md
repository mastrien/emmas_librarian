# Harness de ferramentas para modelos (tool calling)

A biblioteca inteira, como um modelo a usa: uma lista de ferramentas com tipos, e uma chamada que valida os
argumentos antes de tocar na biblioteca (épica #27). Não passa por linha de comando: chama o registro de
comandos (`core/commands`) direto, com os argumentos como objeto JSON.

```ts
const toolkit = new LibraryToolkit({ commands, schemas: commandSchemas(), log: new TrajectoryLog(sink) });
toolkit.tools();                                   // as ferramentas, no formato da Messages API
await toolkit.call('diary__save', { projectId: 3, date: '2026-11-14', content: 'Li dois artigos.' });
// { ok: true, result: ... }  ou  { ok: false, error: { code, type, message } }
```

## De onde vêm os tipos

Do próprio código. `npm run schemas:generate` lê cada `commands.add(NOME, (args...) => ...)` com a API do
compilador do TypeScript e escreve `core/harness/commandSchemas.generated.json`: nome, tipo e obrigatoriedade de cada
argumento, e o comentário escrito acima do comando como descrição. Nada é escrito à mão, então não há duas fontes
para divergir.

- Três travas contra desvio: `core/harness/__tests__/commandSchemas.drift.test.ts` compara o esquema com o registro
  real (mesmos comandos, mesmos nomes de argumento); `npm run schemas:check` falha se o arquivo gerado está velho
  (roda no CI); e os testes do extrator em `tools/commandSchemas/__tests__`.
- O que o TypeScript não expressa (`any`, funções, um tipo que contém a si mesmo) vira um esquema que aceita
  qualquer valor e traz o tipo original em `x-ts`. Nada é inventado.

## O que o modelo vê e o que não vê

O nome da ferramenta é o do comando com `:` trocado por `__` (`articles:getByProject` → `articles__getByProject`),
porque as APIs de ferramentas não aceitam `:`.

Ficam de fora por padrão (`core/harness/toolPolicy.ts`, cada regra com o motivo; `toolkit.hidden()` lista):

| O quê | Motivo |
|---|---|
| `settings:*` | devolve e grava as chaves de API da pessoa |
| `aiModelConfig:*` | muda o provedor de IA e a chave em uso |
| `backup:restore*` | substitui ou mescla a biblioteca inteira |
| `ai:*`, `ask:send`, `screening:suggest`… | chama um modelo de IA: custo e texto enviado a terceiros |
| `search:preview`, `searchMonitor:check`, `pdf:fetchOpenAccess`… | usa a rede |
| qualquer comando com argumento `filePath` | o modelo não escolhe onde gravar ou ler no disco |
| `pdf:get`, `highlights:create/delete`, `pendingHighlights:*` | são do leitor de PDF na tela (bytes e posições); o CLI também os deixa de fora |

## Como uma chamada errada responde

A chamada é validada contra o esquema **antes** de executar. Tipo errado, argumento ausente ou desconhecido, e valor
fora de um enum voltam como erro `ERR_INVALID_ARGUMENTS` (tipo `VALIDATION_ERROR`) que cita o valor recebido e o
formato esperado, tudo de uma vez, para uma só nova tentativa corrigir:

```
[ERR_INVALID_ARGUMENTS] Argumentos inválidos para "diary:save". Offending value: projectId = "abc" (string),
esperado número; date = ausente, esperado texto. Expected shape: projectId: número; date: texto; content: texto;
expected?: null | texto.
```

A checagem é estrita: `"3"` não é o número 3. É de propósito: o CLI antigo respondia `ok:true` a
`articles:getByProject abc` e devolvia `[]`, um sucesso falso que ensinaria o modelo errado.

## Trajetórias

`TrajectoryLog` grava cada chamada, as erradas também, como uma linha JSON (`step`, `tool`, `input`, `ok`, `output`,
`durationMs`): a matéria-prima para montar um conjunto de ajuste fino.

## Limites conhecidos do protótipo

- **"Não encontrado" ainda é sucesso.** `projects:getOne 999999` devolve `null` com `ok:true`. O harness repassa o que
  o comando devolve; decidir se isso vira erro depende de a interface do app usar esse `null`.
- **Descrições.** Só os comandos com comentário no código têm descrição; os demais trazem só o nome do comando.
  É o primeiro lugar para melhorar a qualidade das ferramentas.
- **Sem modelo ainda.** Os testes simulam um episódio com chamadas roteirizadas; nada aqui chama a API de um modelo.
- **A política de exposição é uma lista de nomes.** Um comando novo que acessa rede ou disco precisa entrar nela;
  o teste só garante que as regras existentes ainda casam com algum comando.
