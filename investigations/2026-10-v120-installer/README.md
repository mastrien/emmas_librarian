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

## Resultados (08/10/2026)

Execuções do workflow: rodada 1 `37851835168`, rodada 2 `37853326091`, rodada 3 `37859559896`.

### H1, instalador que trava: não explica o incidente

| | 1ª instalação de um runner novo | reinstalações (rodadas 1 e 2) |
|---|---|---|
| publicado 1.1.23 | 3 de 10 travaram | 1 de 60 |
| v1.2.0 recompilada | 0 de 10 | 0 de 60 |
| build atual | 2 de 10 | 0 de 60 |
| publicado 1.1.23, Defender em tempo real **ligado** (rodada 3) | 2 de 10 | — |
| publicado 1.1.23, Defender em tempo real **desligado** (rodada 3) | 1 de 10 | — |

- O `0xC0000005` acontece em ~1 s e quase só na primeira instalação de um Windows recém-criado (houve 1 caso
  numa reinstalação, na rodada 2), com qualquer instalador. Não deixa evento "Application Error", nem dump (WER LocalDumps ligado), nem evento do Defender.
- Não é o Defender: trava com a proteção em tempo real desligada.
- A máquina afetada já tinha instalado várias versões antes, sem problema. Causa não identificada; pouca
  relação com o incidente. O teste de release repete a instalação uma vez (após 20 s) e avisa.

### H2, instalação interrompida: confirmada para as duas primeiras rodadas do log

Rodada 3, `stuck-installer.mjs` (sem nunca encerrar instaladores):

| reabre o app após | resultado (3 tentativas cada) |
|---|---|
| 2 s | 3/3: 1º instalador **nunca termina**; 2º e 3º saem com código 2; app fica na 1.1.23 |
| 3 s | 2/3 igual ao de 2 s; 1/3 a 1ª instalação concluiu e a 1.2.0 ficou correta |
| 4 s | 2/2: o exe já não existia ao reabrir; 1.2.0 correta (2º instalador saiu com 2, o 3º instalou) |
| 9 s, 15 s, sem reabrir (rodada 2) | 1.2.0 correta |

- Reabrir o app nos primeiros segundos da instalação silenciosa (enquanto o exe antigo ainda existe) deixa o
  instalador preso: ele continua vivo minutos depois de o app fechar. Com ele vivo, as próximas instalações
  desistem em menos de 1 s com código 2. O app continua na versão antiga, sem aviso: é o que o log da
  máquina afetada mostra nas duas primeiras rodadas (lá a reabertura foi em ~9 s; o runner instala mais
  rápido, então o ponto equivalente fica mais cedo).
- Em nenhum caso os arquivos ficaram misturados: a instalação final é coerente com a 1.1.23 ou com a 1.2.0.
- **Não reproduzido:** a 3ª rodada do incidente, em que a 1.2.0 abriu e falhou no banco. Em todos os
  runners a versão final abriu sem erro.

### Achado lateral (teste de release, etapa 3, PR #20)

Depois de "Reiniciar e Instalar" (`quitAndInstall`), a versão antiga levou ~60 s para fechar em 2 de 3
execuções; o instalador espera o app sair. Uma pessoa esperando um minuto tende a abrir o app de novo, que é
justamente o caso H2.

## Conclusões e próximos passos

1. **Causa real e reproduzível de atualizações que não aplicam (H2).** Candidatas a correção, a decidir:
   impedir que a versão antiga abra enquanto um instalador de atualização roda (ou avisar e sair); na
   abertura seguinte, detectar que a atualização registrada não foi aplicada e avisar/tentar de novo;
   descobrir por que o app demora ~60 s para fechar depois de `quitAndInstall`.
2. **A falha final da v1.2.0 continua sem causa.** Ela não vem da instalação interrompida nos testes feitos.
   O que ajudaria: o texto da caixa de erro, ou uma cópia do `emma.db` daquela máquina, e o `main.log` com o
   erro gravado (PR #15).
3. H1 fica registrado; não justifica mudança no app.
