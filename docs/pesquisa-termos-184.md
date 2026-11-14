# Pesquisa dos termos de uso e IA das bases (tarefa 184 do Arca)

Data da pesquisa: 2026-11-13. Quem pesquisou: agente de IA, com leitura de páginas públicas. **Isto não é aconselhamento jurídico.** Onde a página oficial não pôde ser lida (bloqueio 403) ou não traz data, isso está dito. Nenhum arquivo de código foi alterado.

## 1. O que a tarefa pede

Tarefa 184: pesquisar os termos de uso e as regras de uso com IA das bases novas (Europe PMC, arXiv, IEEE Xplore e, se faltar, Crossref) e atualizar a página "Termos de uso e IA", que hoje só cobre OpenAlex, Crossref, Scopus e Web of Science.

Onde está o resumo atual:

- `emmas_librarian/src/pages/Terms/termsContent.ts` (`TERMS_VERSION = '1.3.1'`, lista `BASE_POLICIES`, criada no commit 5987b68, 2026-11-11).
- `emmas_librarian/src/pages/TermsOfUsePage.tsx` (texto "local-first", "IA e chaves" e isenção de responsabilidade).
- `docs/pesquisas/2026-09-28_novas_bases_busca.md` (pesquisa técnica das bases novas; só cita os links dos termos do arXiv e da IEEE, sem analisá-los).

Bases que o app consulta hoje (`electron/services/searchApis/`): OpenAlex, Crossref, Scopus, Web of Science, Europe PMC, arXiv e IEEE. Semantic Scholar e CORE **não** estão implementados (não precisam entrar na página por enquanto). Há também download de PDFs de acesso aberto (`electron/services/openAccess`, `useOpenAccessPdfs`) e IA com chave do usuário (gateways Gemini, OpenAI, Anthropic, Ollama).

Lacuna principal: **Europe PMC, arXiv e IEEE não aparecem na página**, embora o app já as consulte. A IEEE é a mais séria (ver abaixo).

## 2. O que cada fonte diz hoje (comparação com o resumo atual)

Legenda: "bate" = o resumo atual está coerente com a fonte; "muda" = há diferença ou fato novo.

### OpenAlex — resumo atual: "Livre (CC0)... inclusive com modelos de linguagem"
- Fonte: https://openalex.org/about ("Our data is CC0"; a página não tem data). Documentação: https://help.openalex.org/api-reference/authentication.md ("all data is CC0"; sem data) e https://help.openalex.org/api-guide-for-llms.
- A licença dos dados bate (CC0).
- **Muda (operacional, não de licença):** desde fevereiro de 2026 a API hospedada passou a ter chave e cobrança por uso. Os anúncios (https://groups.google.com/g/openalex-users/c/rI1GIAySpVQ, janeiro, e https://groups.google.com/g/openalex-users/c/6kwRTtqUcnU, 24 de fevereiro de 2026) falam em chave gratuita; a documentação atual fala em orçamento diário de US$ 1 com chave gratuita e US$ 0,10 sem chave, listagem a US$ 0,0001, busca (`?search=`) a US$ 0,001 e download de PDF a US$ 0,01. As fontes divergem entre "créditos" e dólares; confirmar na página de preços oficial. O app precisa tratar isso (chave do usuário, aviso de custo), mas não altera o que se pode fazer com os dados.
- A página não diz nada específico sobre IA. Como o dado é CC0, a conclusão "pode usar com IA" é sólida para metadados e resumos que a OpenAlex tem. Ressalva: o resumo (abstract) de um artigo continua sendo texto de terceiros; a OpenAlex o publica como CC0 por sua própria política, mas a titularidade original não desaparece (ver seção 3).

### Crossref — resumo atual: "metadados abertos; PDFs seguem os direitos de cada editora"
- Fonte: https://www.crossref.org/documentation/retrieve-metadata/rest-api/ (última atualização exibida: 2020-04-08): "almost none of the metadata is subject to copyright, and you may use it for any purpose"; "Some abstracts contained in the metadata may be subject to copyright by publishers or authors". Página de licença: https://crossref.org/documentation/retrieve-metadata/rest-api/rest-api-metadata-license-information (só vista por trecho de busca; data exibida 2022).
- Bate, com **um ajuste útil:** os resumos (abstracts) na Crossref podem ter direitos da editora ou do autor. O texto atual diz só "metadados abertos". Vale acrescentar a exceção dos resumos, porque é justamente o que o app envia à IA.
- Contexto: o serviço de click-through de TDM da Crossref foi aposentado em dezembro de 2020 (post de 21/08/2020: https://crossref.org/blog/evolving-our-support-for-text-and-data-mining/). Os campos de licença por editora continuam nos metadados (inclusive um espaço `ai` para a editora declarar regras de IA, segundo a busca, não conferido na fonte primária).
- Política de uso da API (polite pool com e-mail) não foi encontrada em fonte datada; não afeta a licença.

### Scopus (Elsevier) — resumo atual: "mineração só para fins acadêmicos e não comerciais; mandar resumos para IA externa pode violar"
- Fontes: https://dev.elsevier.com/tecdoc_text_mining.html (sem data; rodapé: "All rights reserved, including those for text and data mining, AI training, and similar technologies") e https://www.elsevier.com/about/policies/text-and-data-mining (sem data): mineração automática para pesquisadores de instituições assinantes, "for non-commercial research purposes", com chave de API pessoal; outros casos "case-by-case".
- Bate. A reserva expressa de direitos sobre "AI training" no rodapé reforça o aviso. Nenhuma das duas páginas fala especificamente de LLM, armazenamento ou redistribuição; esses pontos estão nos documentos "Use Policies" e "API Service Agreement", que **não foram lidos**. Não há mudança verificável; também não há data para dizer que nada mudou.

### Web of Science (Clarivate) — resumo atual: "a API proíbe usar os dados com IA não autorizada pela Clarivate"
- A página citada (https://clarivate.com/terms-of-business/) deu 403 e a página "Product/Service Terms" (https://clarivate.com/legal-center/terms-of-business/product-service-terms/) também; **não foi possível ler o texto oficial**.
- Evidência indireta: um guia de biblioteca (https://libguides.tulane.edu/AI/databases, "Last Updated: Nov 11, 2026", data do guia, não dos termos) cita: "you must not use and access the underlying Clarivate proprietary data from the Products..." com IA, salvo adendo de IA acordado por escrito. Um contrato antigo de 2020 (hospedado numa biblioteca tcheca) proíbe também baixar, minerar ou indexar automaticamente sem consentimento escrito e proíbe compartilhar chaves de API.
- O resumo atual está coerente com essa evidência, mas está apoiado em fonte que não consegui reabrir. Um ponto novo: o Web of Science Starter API é regido pelos Termos do Portal de Desenvolvedores e pelos Product/Service Terms (https://developer.clarivate.com/apis/wos-starter). Sugiro trocar o link da página para o dos Product/Service Terms, depois de o autor abrir no navegador e confirmar a cláusula.

### Europe PMC — **ausente da página**
- Fontes: https://europepmc.org/Copyright (só por trecho; a página deu 403 ao leitor automático), https://europepmc.org/Help, https://europepmc.org/downloads (sem termos), https://europepmc.org/developers (403).
- Conteúdo: todo o conteúdo é de leitura gratuita, mas só parte pode ser reutilizada (tradução, mineração); a licença de cada artigo (em geral Creative Commons) define o que se pode fazer; o usuário é "directly and solely responsible" pela conformidade com direitos autorais; baixar artigos em massa pela interface do site com processo automático não é permitido (usar FTP, OAI ou web services). Remete aos termos do EMBL-EBI. Um agregador (Lantern) conclui que a Europe PMC não acrescenta restrições aos dados que mantém, mas isso é fonte secundária.
- Proposta de selo: **"Depende da licença"** (metadados e resumos livres para uso; texto completo só conforme a licença de cada artigo).

### arXiv — **ausente da página**
- Fonte: https://info.arxiv.org/help/api/tou.html (sem data). Metadados descritivos sob CC0 ("retrieve, store, transform, and share"). E-prints têm direitos autorais dos autores; é permitido "retrieve, store, and use the content of arXiv e-prints for your own personal use, or for research purposes", mas é **proibido armazenar e servir** e-prints (PDFs, fontes) a partir dos seus servidores sem permissão do titular. Limite de 1 requisição a cada 3 s, uma conexão, sem burlar. A página não fala de IA nem de cache; não pode sugerir apoio do arXiv ao projeto sem permissão.
- Proposta de selo: **"Metadados livres (CC0)"**, com a nota de que o PDF é uso pessoal ou de pesquisa e que o app guarda só no computador do usuário.

### IEEE Xplore — **ausente da página e é a base mais restritiva**
- Fonte: https://developer.ieee.org/API_Terms_of_Use2 (sem data; a própria IEEE diz que muda os termos a qualquer momento, com efeito imediato).
- Proíbe, salvo autorização escrita da IEEE: usar o conteúdo "for the purpose of training, enhancing, developing, or contributing to any AI system" (IA, aprendizado de máquina, LLM), mineração de dados e obras derivadas para esses fins; licença limitada a atividades "non-commercial educational, research, or scientific"; conteúdo só pode ser apresentado em resposta a consulta individual, "not in bulk"; não reter nem armazenar o conteúdo quando a licença terminar; sem robôs, sem compartilhar a chave; limites de chamadas por minuto, hora ou dia; lei de Nova York.
- **Impacto direto no app:** os termos falam em "treinar, melhorar, desenvolver ou contribuir" para sistemas de IA. Mandar o resumo de um artigo IEEE a um LLM para triagem ou resposta não é treinamento, mas a redação ("source or benchmark", "mining") é ampla e a IEEE pode ler diferente. Armazenar metadados no banco do projeto também esbarra na regra de "não reter". Proposta de selo: **"Restritivo"**, com o texto de que o uso de resultados da IEEE com IA externa e a guarda local ficam por conta do usuário e podem exigir autorização da IEEE.

### Resumo das mudanças a fazer na página
1. Adicionar Europe PMC, arXiv e IEEE Xplore em `BASE_POLICIES`, com os textos acima, e subir `TERMS_VERSION`.
2. Crossref: acrescentar a exceção dos resumos.
3. OpenAlex: mencionar que a API passou a ter chave e custo (pode ir na tela de configurações, não nos termos).
4. Web of Science: trocar o link, depois que o autor confirmar a cláusula no navegador.
5. Acrescentar uma frase sobre a licença de cada artigo e sobre PDFs (seção 3).
6. Marcar a data de verificação de cada base ("conferido em 2026-11-13"), porque várias páginas não têm data e a IEEE muda os termos sem aviso.

## 3. Aprofundamento jurídico (para entender, não para decidir)

### 3.1 O que o app faz, em termos jurídicos
1. Pede metadados e resumos a APIs (uso das APIs, sujeito a contrato/termos de cada base).
2. Guarda esses dados e PDFs no computador do usuário (cópia local).
3. Envia trechos (resumos, textos de PDFs, perguntas) a um provedor de IA com a chave do próprio usuário (transmissão a terceiro).
4. O usuário pode exportar dados (redistribuição pelo usuário).

Cada etapa pode ser regida por uma coisa diferente: direito autoral sobre o texto, contrato (termos da API) e proteção de dados pessoais. Um erro comum é confundir o que o **direito autoral** permite com o que o **contrato** da API permite: mesmo que a lei autorize uma mineração, aceitar termos de API que a proíbem pode criar obrigação contratual.

### 3.2 Metadados e resumos
- Fatos bibliográficos (título, autores, ano, DOI) geralmente têm pouca ou nenhuma proteção autoral. Por isso Crossref e OpenAlex os tratam como livres.
- **Resumos** são texto criativo, normalmente de titularidade da editora ou do autor. A OpenAlex os redistribui como CC0 e a Crossref avisa que podem ter direitos. Incerteza: se a redistribuição CC0 da OpenAlex "limpa" os direitos de quem recebe depois. Em geral, não limpa; quem não tem direito não pode conceder. Na prática o risco de um uso pessoal e local é baixo, mas é uma questão em aberto que um advogado deveria opinar.

### 3.3 Mineração de texto (TDM)
- União Europeia: Diretiva (UE) 2019/790, art. 3 (pesquisa científica por instituições de pesquisa, sem possibilidade de reserva pelos titulares) e art. 4 (uso geral, que o titular pode reservar "de forma apropriada", por exemplo, em termos legíveis por máquina). A reserva da Elsevier no rodapé ("including... text and data mining, AI training") é um exemplo típico de reserva. Reino Unido: exceção só para pesquisa não comercial (CDPA s.29A).
- **Brasil:** a Lei de Direitos Autorais (Lei 9.610/1998) não tem uma exceção específica de mineração; há discussão no Projeto de Lei 2338/2023 (marco da IA), que previa regras de TDM. Não conferi o estado atual do projeto; é ponto para o advogado. Hoje o usuário brasileiro depende de limitações gerais do art. 46 (cópia privada de pequenos trechos, citação) e dos contratos de cada base.
- EUA: o uso transformador (fair use) tem sido invocado para treinar modelos, com decisões recentes divergentes; não é regra segura e não se aplica ao Brasil.
- Ponto crítico: **o app não treina modelos**; ele envia texto a um modelo para obter resposta (inferência). Juridicamente isso é diferente de "treinamento", mas várias cláusulas (IEEE, Scopus) são redigidas de modo amplo (qualquer uso com IA, "benchmark", "mining"). Se o provedor de IA usa os dados para treinar depende do plano e dos termos do provedor (APIs pagas em geral dizem que não treinam; planos gratuitos podem treinar). Isso deveria constar no aviso.

### 3.4 Cache e armazenamento local
- A maioria dos termos permite uso ou cache moderado para o próprio usuário. IEEE é exceção ("não reter"/"apenas em resposta a consulta"). Elsevier, Clarivate e arXiv (para PDFs) restringem principalmente **redistribuição e servir a terceiros**, não a cópia local de uso pessoal.
- Como o banco do app é local e por usuário, o risco maior é o **backup/exportação compartilhado** (por exemplo, o usuário mandar um backup com resumos da Scopus ou do WoS para colegas). Vale um aviso na tela de exportar e backup.
- Incerteza: se o "usuário" é uma pessoa na instituição (licença institucional) ou a própria pessoa, já que muitas licenças são institucionais; a chave pessoal da Elsevier, por exemplo, vale para pesquisa não comercial de assinantes.

### 3.5 Envio de texto de artigos a terceiros (provedores de IA)
- É uma **transmissão a um terceiro** (Google, OpenAI, Anthropic etc.). Para fontes restritivas (Scopus, WoS, IEEE) é aí que o risco contratual aparece. Para fontes abertas (OpenAlex, arXiv metadados, Europe PMC licenças CC) o risco é pequeno.
- O app tem o princípio correto de transferir a responsabilidade ao usuário com as chaves dele, mas **a isenção de responsabilidade não elimina** a obrigação do usuário nem garante proteção do autor do app se o app facilitar ativamente um uso proibido. Um aviso antes do primeiro envio de texto de base restritiva (e um interruptor "não enviar à IA resultados de Scopus/WoS/IEEE") reduziria o risco de modo concreto; isso é decisão de produto, não só jurídica.

### 3.6 Direitos autorais de PDFs
- PDFs de editoras são protegidos. Baixar um PDF de acesso aberto é permitido; **a licença do artigo define o resto** (CC BY permite quase tudo com atribuição; CC BY-NC proíbe uso comercial; "todos os direitos reservados" não permite reuso).
- Baixar PDFs por vias de acesso aberto (como o app faz) e guardá-los localmente para leitura pessoal é, em geral, o cenário de menor risco. Enviar o texto inteiro a uma IA é uso adicional e merece olhar à parte, principalmente quando a licença é NC ou reservada.
- arXiv: não servir PDFs a terceiros; o app não faz isso, pelo que se viu (guarda local).

### 3.7 LGPD / GDPR
- Metadados contêm **dados pessoais** (nomes de autores, ORCIDs, afiliações). São dados publicados pelos próprios titulares ou pelas editoras. A LGPD (Lei 13.709/2018) se aplica a tratamento de dados pessoais, inclusive públicos, mas há bases legais para pesquisa e para dados tornados manifestamente públicos pelo titular (art. 7º, §§ 3º e 4º), e exceções para fins acadêmicos (art. 4º, II, b) e para uso estritamente pessoal e não econômico (art. 4º, I). Um aplicativo local usado por uma pessoa para pesquisa dificilmente seria "controlador" em larga escala.
- Pontos que importam: **o usuário e seus anotações** (diário, notas) podem conter dados pessoais de terceiros e vão para o provedor de IA quando o usuário pergunta; PDFs podem conter dados pessoais (por exemplo, relatos de casos clínicos); chaves e e-mail (polite pool do Crossref e OpenAlex) são dados do usuário enviados a terceiros. Transferência internacional para provedores de IA (art. 33 da LGPD; capítulo V do GDPR) é regida pelas cláusulas do provedor.
- Se o app for distribuído a europeus, o GDPR pode se aplicar ao autor como fornecedor, mas, como o tratamento ocorre no computador do usuário e o autor não recebe os dados, o risco é baixo; incerteza que o advogado deve confirmar.
- O texto atual "não saem daqui" é verdadeiro para o banco local, mas **precisa ser consistente com o fato de que consultas de busca vão às bases** (a consulta e a chave vão às APIs) e que o app faz verificação de atualização. Vale conferir se isso é dito.

### 3.8 O resumo atual basta?
Não. Lacunas:
1. Faltam Europe PMC, arXiv e IEEE (esta última é a mais restritiva).
2. O selo "Livre" para a Crossref não destaca que **resumos** podem ter direitos; para OpenAlex, nada alerta que o resumo original pertence à editora.
3. Não há nada sobre **PDFs e a licença de cada artigo**, nem sobre o envio do texto completo à IA.
4. Não há nada sobre o **provedor de IA** (se usa os dados para treinar, onde guarda, quem é o controlador), nem aviso de que planos gratuitos de alguns provedores podem usar os dados.
5. A isenção diz que cabe ao usuário garantir as licenças, mas a interface não ajuda o usuário a saber de que base veio o texto que ele manda à IA.
6. Não há nada sobre **backup/exportação** e redistribuição.
7. Não há data de conferência por base; a IEEE e a Clarivate mudam termos sem aviso.
8. Nada sobre dados pessoais (LGPD) nem sobre transferência internacional.
9. A página da Clarivate usada como link não pôde ser aberta pelo leitor automático; o autor deve conferir manualmente.

## 4. O que um advogado deveria confirmar
1. Se enviar resumos/textos de bases restritivas (Scopus, WoS, IEEE) a um LLM de terceiros com a chave do usuário viola os contratos, e **quem responde**: o usuário (que aceitou os termos da API ao pedir a chave) ou também o autor do app que facilita o fluxo.
2. Se a cláusula da IEEE ("training, enhancing, developing, or contributing to any AI system", "source or benchmark") alcança inferência, e se guardar metadados em banco local viola "não reter".
3. O estado atual das regras de TDM no Brasil (Lei 9.610, PL 2338/2023) e se a exceção de pesquisa europeia ou brasileira cobre esse uso quando a pessoa não é de instituição de pesquisa.
4. Se a redistribuição de resumos como CC0 pela OpenAlex transmite direito a quem os usa.
5. Se o aviso e a isenção de responsabilidade têm valor jurídico e se devem ser aceitos pelo usuário (um "li e aceito" no primeiro uso, com registro) em vez de só aparecerem em uma página.
6. Enquadramento na LGPD do autor do app e do usuário (controlador/operador), incluindo transferência internacional para os provedores de IA.
7. Termos de uso do próprio app e política de privacidade (não existem como documento próprio além desta página).
8. Licença do próprio software e dos modelos locais (a nota na memória do projeto diz que a conversão ONNX não declara licença).

## 5. Incertezas e limites desta pesquisa
- Páginas da Clarivate, Europe PMC (Copyright e developers) e do OpenAlex (site principal) deram erro 403 ao leitor automático; o que sei delas vem de buscas, guias de bibliotecas e agregadores (fontes secundárias).
- Várias páginas oficiais não mostram data (Elsevier, arXiv, IEEE, OpenAlex "about"). Por isso não é possível afirmar "o que mudou desde a última vez": só comparei o texto atual com o resumo do app. O registro da pesquisa de 2026-09-28 guardava só os links, não o texto dos termos.
- Os termos de contrato da Elsevier ("Use Policies", "API Service Agreement") e os da Clarivate não foram lidos.
- Citações de leis (Diretiva 2019/790, Lei 9.610, LGPD) são de conhecimento geral e não foram reconferidas nesta sessão; confirmar com o advogado.

## 6. Fontes (acessadas em 2026-11-13)
- OpenAlex: https://openalex.org/about; https://help.openalex.org/api-reference/authentication.md; https://help.openalex.org/api-guide-for-llms; https://groups.google.com/g/openalex-users/c/rI1GIAySpVQ; https://groups.google.com/g/openalex-users/c/6kwRTtqUcnU
- Crossref: https://www.crossref.org/documentation/retrieve-metadata/rest-api/ (atualizada 2020-04-08); https://crossref.org/documentation/retrieve-metadata/rest-api/rest-api-metadata-license-information; https://crossref.org/blog/evolving-our-support-for-text-and-data-mining/ (2020-08-21)
- Elsevier/Scopus: https://dev.elsevier.com/tecdoc_text_mining.html; https://www.elsevier.com/about/policies/text-and-data-mining
- Clarivate: https://clarivate.com/legal-center/terms-of-business/product-service-terms/ (não lida); https://developer.clarivate.com/apis/wos-starter; https://libguides.tulane.edu/AI/databases (secundária)
- Europe PMC: https://europepmc.org/Copyright; https://europepmc.org/Help; https://europepmc.org/downloads
- arXiv: https://info.arxiv.org/help/api/tou.html
- IEEE: https://developer.ieee.org/API_Terms_of_Use2

## Atualização (2026-11-13): documentos que o autor baixou

- **Clarivate, "Product/Service Terms" v3.7** (`emmas_termos/Product-Terms-v3.7.pdf`), seção "Web of Science APIs" (pp. 44 a 47): uso acadêmico individual e pesquisa; dados limitados à assinatura e aos mesmos usuários; distribuição só de trechos eventuais entre colaboradores; resumos exigem o direito legal ou do detentor; ao fim da assinatura os dados baixados devem ser apagados; registros de uso por 3 anos. **Não há proibição de IA nessa seção.** As proibições de IA do PDF estão em outros produtos (Derwent, IP Data API, e uma adenda de plataforma de e-books/ProQuest). Os "Clarivate Terms" gerais, que o PDF cita, não foram fornecidos. Isso corrige o resumo anterior, que afirmava a proibição com base num guia de biblioteca.
- **Europe PMC, página Copyright** (`emmas_termos/Copyright - Europe PMC.html`): quase todo o material tem direitos autorais; o usuário é direta e exclusivamente responsável pela conformidade; robôs não podem baixar lotes de artigos do site; só API, OAI, SOAP e downloads em bloco; cada artigo traz a sua licença (CC ou similar). O app só usa a API de busca (não baixa PDFs da Europe PMC).

- **Clarivate Terms v3.3 (dezembro de 2025)** (`emmas_termos/Clarivate-Terms-v3.3-December-2025-EN.pdf`), termos gerais, valem para todos os produtos: seção 1(f) proíbe usar os dados proprietários da Clarivate com tecnologias de IA (generativa, aprendizado de máquina, algoritmos, modelos de linguagem) ou para gerar conteúdo, salvo adendo de IA ou acordo escrito; 1(g)(iv) proíbe mineração e indexação de texto ou de dados; 1(e) proíbe raspar dados; seção 7 (APIs): dados só para os usuários autorizados. **Isso confirma a proibição de IA para a Web of Science**, e o resumo do app voltou a dizê-lo, agora com base no documento.

- **Elsevier** (`emmas_termos/Elsevier Developer Portal Policy.html`, "Use Policies"; `Text and data mining _ Elsevier policy.html`; `Elsevier Developer Portal.html`): o portal diz que registrar ou ter uma chave não dá acesso, só a assinatura/autorização. Caso de uso "Academic Research" (Scopus), atualização não datada: só não comercial e acadêmico; por representante aprovado da instituição (sem terceiros ou consultores); limitado a uma disciplina, sem minerar a base inteira; retenção do conjunto de dados só para arquivo e reprodução, e uso fora do escopo original não é permitido; compartilhamento público só com autorização escrita; Scopus citada como fonte. Em "Federated search", resumos e referências da Scopus não podem ser exibidos e os dados não podem ser indexados ou guardados além de cache temporário. O rodapé reserva "text and data mining, AI training". A política de mineração de texto trata do texto completo do ScienceDirect, não da Scopus. O "API Service Agreement" em si não foi salvo (só o menu do portal), então o contrato continua sem leitura. **Nenhuma política cita IA nominalmente**, mas o resumo do app agora diz o que elas permitem.
