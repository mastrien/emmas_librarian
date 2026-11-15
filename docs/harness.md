# Harness de ferramentas para modelos (tool calling)

A biblioteca inteira, como um modelo a usa: uma lista de ferramentas com tipos, e uma chamada que valida os
argumentos antes de tocar na biblioteca (épica #27). Não passa por linha de comando: chama o registro de
comandos (`core/commands`) direto, com os argumentos como objeto JSON.

```ts
const toolkit = new LibraryToolkit({ commands, schemas: commandSchemas(), confirmer, modelIsLocal: true });
toolkit.tools();                                   // as ferramentas, no formato da Messages API
await toolkit.call('diary__appendAgentRecord', { projectId: 3, date: '2026-11-14', message: 'Li dois artigos.' });
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

O que o modelo pode usar está numa lista explícita, `core/harness/toolAccess.ts` (revisão de 15/11/2026). Quem não está
nela não é oferecido, então um comando novo não chega a nenhum modelo até alguém decidir. Cada comando da lista é:

| Acesso | O que significa | Exemplos |
|---|---|---|
| leitura | roda direto | `projects:getAll`, `articles:getByProject`, `diary:getOne`, `annotations:get` |
| pede confirmação | toda criação, edição e remoção: a pessoa vê a ferramenta e os argumentos e diz sim ou não antes de rodar | `projects:create`, `articles:updateStatus`, `diary:appendAgentRecord` |
| só modelo local | manda texto ou consulta a terceiros; não é oferecido a modelo em nuvem | `ai:generateSummary`, `search:preview`, `pdf:fetchOpenAccess`, `ask:indexMissing` |

A confirmação vem de um `Confirmer` injetado (o app põe um diálogo, o terminal pergunta, a avaliação responde por
roteiro). Sem `Confirmer`, nada que precise de aprovação roda (`ERR_NOT_CONFIRMED`). `modelIsLocal` diz se o modelo
roda na máquina. `hideParameters` tira um argumento do que o modelo vê e o envia vazio (o caminho de arquivo de
`projectDocuments:create/update`).

Mesmo dentro da lista, ficam de fora um comando com argumento `filePath` (o modelo não escolhe onde ler ou gravar) e o
que o CLI não oferece (`pdf:get` e os destaques do leitor). Fora da lista, por decisão: `settings:*` (chaves de API),
`aiModelConfig:*`, `backup:restore*`, exportações, escrita de anotações, `diary:save/delete/restoreVersion`,
`trash:empty/permanentDelete`, decisões de triagem, `search:revert`. O modelo escreve no diário só com
`diary:appendAgentRecord`: o comando acrescenta ao fim da página a data, a hora e "registro do agente de IA", e o texto
anterior fica intacto. `systemContext` põe a data de hoje e o projeto em foco no prompt do sistema.

`toolkit.hidden()` lista o que ficou de fora, cada um com o motivo.

## Avaliação

`core/harness/eval/cases.jsonl` tem os casos (pedido, contexto, chamadas ideais, ferramentas que não podem existir,
resposta esperada, verificação do estado final). `core/harness/__tests__/support/libraryF.ts` monta a "Biblioteca de
teste F" com ids estáveis. Os testes conferem que cada caso concorda com o que o toolkit oferece e rodam, sem rede e
sem modelo, as trajetórias ideais: um caso que não tem solução falha aqui, não na comparação entre modelos.

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
- **Aparência.** Tema, tom e cor ficam no `localStorage` da interface, não são comandos; expô-los pede um canal da
  interface (tarefa 212 no Arca).
- **Sem modelo ainda.** Nenhuma chamada a modelo foi feita; a comparação entre modelos vem depois.
