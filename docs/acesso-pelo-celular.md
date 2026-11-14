# Acesso pelo celular (servidor na rede local)

O aplicativo pode servir a biblioteca para dispositivos pareados na mesma rede (issue #32, épica #27). É o lado
do desktop do cliente mobile (#33), que ainda não existe: por enquanto o acesso serve a quem usa a API abaixo.

## Como ligar

Configurações › Acesso pelo celular › "Permitir acesso pela rede local". Vem desligado. Ligado, o aplicativo
escuta em HTTPS na porta 47810 (ou em outra livre, se essa estiver ocupada) enquanto estiver aberto, e volta a
ligar sozinho na próxima abertura. No Windows, o firewall pede permissão na primeira vez.

O servidor escuta em todas as interfaces de rede do computador. Ligue só em redes em que você confia.

## Segurança

- **Cifra:** HTTPS com certificado autoassinado, criado na primeira vez e guardado em `lan-certificate.json` na
  pasta de dados (a chave privada cifrada pelo cofre do sistema). O navegador do celular avisa que não reconhece
  o certificado; a tela de configurações mostra a impressão digital SHA-256 para conferir antes de aceitar.
  O certificado vale 825 dias e é trocado um mês antes de vencer (o celular aceita o novo aviso).
- **Pareamento:** "Parear um celular" abre um código de uso único, válido por 5 minutos, mostrado como QR code
  (`https://<ip>:<porta>/#pair=<código>`). Cinco tentativas erradas cancelam o código. Sair da tela também.
- **Token por dispositivo:** o pareamento devolve um token que só aquele dispositivo conhece. No disco fica
  apenas o SHA-256 dele (`paired-devices.json`). Revogar um dispositivo corta o token na hora.
- **Tentativas:** dez tokens ou códigos errados a partir do mesmo endereço em um minuto e ele espera um minuto.
- **Navegadores de terceiros:** o servidor só aceita `Content-Type: application/json` e não responde a CORS, então
  uma página de outro site não consegue chamá-lo pelo navegador de quem está na rede.
- **O que nunca sai do desktop:** configurações (onde ficam as chaves de API), backups, lixeira, buscas e IA não
  estão na lista do que um dispositivo pode chamar. Erros internos chegam sem a mensagem, que poderia citar pastas
  do computador.

## O que um dispositivo pode fazer

A lista é explícita, em `core/remote/remoteAccessPolicy.ts`; um canal novo não fica exposto sem entrar nela.

- **Leitura:** projetos, artigos, PDFs, anotações e marca-textos, diário, documentos de acesso rápido, categorias,
  investigações e seus resultados, auditorias, conjuntos de perguntas, rótulos e decisões de triagem, registros
  PRISMA, agenda e a versão do aplicativo.
- **Escrita:** salvar página do diário (`diary:save`), criar link de acesso rápido
  (`projectDocuments:create`, sempre sem arquivo do desktop), marcar documento como aberto e definir a categoria
  de um artigo (`categories:setArticle`).

As linhas de artigos e documentos trazem o caminho do arquivo no desktop (`local_file_path`), como no aplicativo.

## API

Todas as respostas são JSON (`{"ok":true,"result":...}` ou `{"ok":false,"error":{"code","type","message"}}`),
exceto o PDF, que vem em bytes.

| Rota | Autenticação | Efeito |
|---|---|---|
| `GET /api/ping` | nenhuma | `{"app":"emmas-librarian"}`: confirma que o endereço é do aplicativo. |
| `POST /api/pair` | código de uso único | Corpo `{"code","deviceName"}`; devolve `{"token","deviceId","deviceName"}`. |
| `GET /api/commands` | `Authorization: Bearer <token>` | Os comandos que este dispositivo pode rodar. |
| `POST /api/commands/<comando>` | `Authorization: Bearer <token>` | Corpo `{"args":[...]}`; roda o comando. |

Status: 400 entrada recusada, 401 token ausente ou revogado, 403 comando fora da lista ou código inválido,
404 comando ou rota inexistente, 413 corpo acima de 1 MB, 429 tentativas demais, 500 erro interno.

```bash
curl -k https://192.168.0.10:47810/api/pair -H 'Content-Type: application/json' \
  -d '{"code":"<código do QR>","deviceName":"Meu celular"}'
curl -k https://192.168.0.10:47810/api/commands/projects:getAll -X POST \
  -H 'Content-Type: application/json' -H 'Authorization: Bearer <token>' -d '{}'
```

## Canal local do CLI

Separado do servidor da rede e sempre ativo com o aplicativo aberto: um servidor HTTP em `127.0.0.1`, em porta
aleatória, com um token novo a cada abertura do aplicativo, gravados em `app-running.json` na pasta de dados (só
o dono lê). É por ele que o CLI roda comandos dentro do aplicativo aberto (ver `docs/cli.md`). Nada fora do
computador alcança esse canal.

## Limitações conhecidas

- Não há descoberta automática (mDNS): o endereço vem do QR code.
- Se o IP do computador mudar, o celular precisa do endereço novo; o token continua valendo.
- O aviso de certificado do navegador não some: navegadores não fixam certificado autoassinado.
- A tela do aplicativo não é avisada do que um dispositivo gravou; mostra ao recarregar os dados.
