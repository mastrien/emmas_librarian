# Investigação: falha da v1.2.0 ao atualizar (out/2026)

Experimentos para entender a falha da v1.2.0 na máquina do autor. Nada aqui muda o app: os scripts só
instalam builds em runners Windows descartáveis do GitHub e registram o que acontece. Se os resultados
apontarem uma causa, a correção vai num PR próprio.

## O que já se sabe

Log da máquina afetada (`example/main.log.txt`, fora do repositório), em 01/10/2026:

| Hora | Evento |
|---|---|
| 23:12:32.8 | v1.1.23 fecha; o atualizador roda o instalador da 1.2.0 (`--updated /S`) |
| 23:12:41.7 | app reaberto (+8,9 s), ainda v1.1.23; acha a 1.2.0 de novo |
| 23:12:54.2 | fecha; instalador roda de novo |
| 23:13:03.3 | reaberto (+9,1 s), ainda v1.1.23 |
| 23:13:15.7 | fecha; instalador roda pela terceira vez |
| 23:14:13.7 | reaberto (+58 s): agora é a 1.2.0, que falha ao abrir o banco, sem nada no log |

Já descartado (ver `docs/planos/2026-10-02_proposta_contingencia_releases_e_migracao.md` §1): falta de
`deleted_at`, a cadeia de bancos v1.1.12 → 1.1.22 → 1.1.23 → 1.2.0, a v1.2.0 empacotada sobre um banco real
e sobre pasta vazia, e a sequência de build do CI.

O teste de release (PR #19) achou outro sinal: o instalador publicado da v1.1.23 saiu com `0xC0000005`
(acesso inválido de memória) sem instalar nada em 3 das suas 5 primeiras execuções em runners novos.

## Hipóteses

- **H1, instalador que trava:** o instalador NSIS às vezes trava antes de instalar. Isso explicaria o app
  continuar na 1.1.23 depois das duas primeiras rodadas.
- **H2, instalação interrompida:** reabrir o app enquanto o instalador ainda trabalha (uma instalação leva
  de 18 a 28 s nos runners) faz o instalador abortar ou deixa arquivos de duas versões misturados. Na
  terceira rodada, isso produziria uma 1.2.0 quebrada.

As duas podem ser verdade ao mesmo tempo.

## Experimentos

Workflow `.github/workflows/investigate-v120-installer.yml`, disparado por push neste branch.

Instaladores usados:
- `published-1.1.23`: o `.exe` da release v1.1.23;
- `rebuilt-1.2.0`: compilado da tag v1.2.0 (a release foi apagada; é o mais próximo do que chegou à máquina);
- `current`: compilado do `main`.

1. **Taxa de travamento (H1)**, `install-crash-rate.mjs`: em cada runner novo, o primeiro instalador
   varia e é seguido de reinstalações alternadas. Para cada execução, registra o código de saída e a
   duração; no fim, lê no log de eventos do Windows (Application, ID 1000) qual programa e qual módulo
   travaram.
2. **Atualização interrompida (H2)**, `interrupted-update.mjs`: instala a v1.1.23 e abre o app; depois
   repete até 3 vezes o ciclo do log (fecha o app, roda o instalador da 1.2.0 como o atualizador, reabre o
   app depois de N segundos e o deixa aberto uns 12 s). N vale 9 s (o do log), 3 s e 15 s. No fim,
   compara os arquivos instalados com uma instalação limpa e tenta abrir o app, guardando a saída de erro.

Os resultados de cada runner viram JSON nos artefatos, e o resumo da execução reúne uma tabela.

## Resultados

_A preencher depois das execuções._
