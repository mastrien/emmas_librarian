import React from 'react';

export interface ChangelogRelease {
  title: string;
  items: React.ReactNode[];
}

/** Release notes shown after an update, newest first. Add new releases at the top. */
export const CHANGELOG_RELEASES: ChangelogRelease[] = [
  {
    title: 'Versão 1.1.23 — Leitura de PDF & Categorias',
    items: [
      <>
        <strong>Correções no Leitor PDF:</strong> Tratamento aprimorado no leitor de PDF e carregamento seguro de
        buffers de artigos.
      </>,
      <>
        <strong>Categorias & Artigos Lidos:</strong> Correção no salvamento de textos de categorias e exibição
        consistente de artigos não arquivados.
      </>,
      <>
        <strong>Modal de Investigação de IA:</strong> Atualização dos botões de ação e fluxo de conclusão do modal de
        extração.
      </>,
    ],
  },
  {
    title: 'Versão 1.1.22 — Otimização Extrema de Performance',
    items: [
      <>
        <strong>Leitor PDF Instantâneo:</strong> Criado o protocolo customizado <code>emma-pdf://</code> nativo que
        bypassa a lentidão massiva do Electron IPC Buffer na abertura de PDFs grandes, garantindo instaneidade ao
        carregar artigos!
      </>,
      <>
        <strong>Categorias Otimizadas:</strong> Painel de visualização de Categorias do projeto refeito sem inputs
        editáveis invisíveis para prevenir que a renderização pesada afete a página.
      </>,
      <>
        <strong>Painel de Acesso Rápido Consertado:</strong> Resolvido um loop silencioso na dependência do Modal de
        Acesso Rápido, restaurando a digitação fluída sem atualizações espúrias.
      </>,
      <>
        <strong>Lógica de Preenchimento de IA Consertada:</strong> Previne perdas caso mais de 1 campo seja salvo
        através de um uso de cache de erro estrito com limitação correta na UI.
      </>,
    ],
  },
  {
    title: 'Versão 1.1.21 — Estabilidade de Testes & Navegação',
    items: [
      <>
        <strong>Correção de Navegação UI:</strong> Corrigida instabilidade de testes E2E causada por interações rápidas
        no botão de menu "Mais opções" durante carregamentos assíncronos.
      </>,
      <>
        <strong>Correção na Extração de IA:</strong> Seletores dos modais agora estão corretamente restritos, resolvendo
        problemas de seleção indevida de artigos durante a etapa de investigação massiva.
      </>,
    ],
  },
  {
    title: 'Versão 1.1.20 — UI & UX',
    items: [
      <>
        <strong>UI/UX Skeletons:</strong> Substituição dos avisos textuais de carregamento por animações Skeleton,
        mitigando saltos no layout e melhorando a sensação de performance.
      </>,
      <>
        <strong>Padronização Visual:</strong> Adoção global de cores flat sólidas na interface, removendo botões em
        gradiente para garantir maior contraste e legibilidade.
      </>,
      <>
        <strong>Correção em Backups:</strong> Correção no processo de restauração automática do banco de dados para
        incluir o restart da aplicação e reconectar corretamente a IPC bridge.
      </>,
    ],
  },
  {
    title: 'Versão 1.1.19 — Agenda & Prazos',
    items: [
      <>
        <strong>Agenda & Prazos Globais:</strong> Novo módulo de gerenciamento de eventos, conferências e periódicos com
        suporte a múltiplos prazos customizáveis.
      </>,
      <>
        <strong>Intervalos & Prazos Pontuais:</strong> Suporte a prazos com datas únicas ou intervalos com validação de
        vencimento baseada na data final.
      </>,
      <>
        <strong>Visualizações Flexíveis:</strong> Modos de pílula unificada para alternar entre "Por Evento/Revista" e
        "Lista de Prazos", além de calendário integrado.
      </>,
      <>
        <strong>Dashboard Minimalista:</strong> Seção superior com relógio grande em cores neutras e banner de próximos
        prazos com atualização local otimizada.
      </>,
    ],
  },
  {
    title: 'Versão 1.1.18',
    items: [
      <>
        <strong>Edição de Acesso Rápido:</strong> Edite atalhos já cadastrados (título, URL, arquivo PDF ou grupo)
        diretamente pelo modal de gerenciamento.
      </>,
      <>
        <strong>Reordenação por Arraste com Indicador Guia:</strong> Reorganize a ordem dos seus atalhos segurando a
        alça de 6 pontos com indicador visual dinâmico no vão de inserção.
      </>,
      <>
        <strong>Grupos Nomeados e Organização no Topo:</strong> Organize atalhos por grupos nomeados com exibição
        prioritária dos itens gerais no topo da seção.
      </>,
    ],
  },
  {
    title: 'Versão 1.1.17',
    items: [
      <>
        <strong>Interface Limpa & Agrupamento de Ações:</strong> Menu de navegação principal e botões de ação do projeto
        organizados em dropdowns expansíveis por movimento do mouse (hover) com transições suaves.
      </>,
      <>
        <strong>Correção de Importação de PDFs entre Projetos:</strong> Solucionado o erro no banco de dados SQLite ao
        clonar artigos com PDFs anexados e embeddings vetoriais entre projetos.
      </>,
      <>
        <strong>Organização da Biblioteca Global de PDFs:</strong> Arquivos salvos com marca d'água de data e nome
        original (`YYYYMMDD_HHMMSS_nome.pdf`), com layout da tabela aprimorado para telas menores.
      </>,
      <>
        <strong>Estabilidade na Suíte E2E:</strong> Testes End-to-End no Playwright 100% parametrizados e homologados.
      </>,
    ],
  },
  {
    title: 'Versão 1.1.16',
    items: [
      <>
        <strong>Histórico de Parâmetros de Busca:</strong> O critério de ordenação e o limite máximo de resultados
        selecionados para cada busca agora são persistidos no banco de dados e exibidos no histórico de buscas,
        garantindo total transparência e reprodutibilidade nos termos pesquisados.
      </>,
      <>
        <strong>Sincronização Avançada:</strong> Os novos campos de ordenação e limite do histórico de buscas são
        totalmente preservados e reconstruídos nos processos de exportação e importação de projetos.
      </>,
    ],
  },
  {
    title: 'Versão 1.1.15',
    items: [
      <>
        <strong>Histórico Completo na Extração Massiva:</strong> Artigos cancelados, não executados ou com falhas no
        loop da extração massiva agora são devidamente registrados com o status correspondente (como{' '}
        <code>skipped</code> ou <code>error</code>) no banco de dados. Isso garante que todos os artigos selecionados
        apareçam na visualização de detalhes no histórico.
      </>,
      <>
        <strong>Identificação Dinâmica do Modelo de IA:</strong> O modelo e provedor salvos no histórico de
        investigações massivas agora são resolvidos dinamicamente de acordo com o modelo ativo selecionado para a
        habilidade de extração (ex: <code>Gemini (gemini-1.5-pro)</code>), em vez de uma checagem estática de chaves de
        API.
      </>,
    ],
  },
  {
    title: 'Versão 1.1.14',
    items: [
      <>
        <strong>Correção de Recurso Local em Produção:</strong> Correção do erro{' '}
        <code>Not allowed to load local resource</code> ao abrir o aplicativo empacotado. O carregamento do{' '}
        <code>index.html</code> e do ícone agora utilizam a API <code>app.getAppPath()</code> para localizar
        corretamente os arquivos na raiz.
      </>,
    ],
  },
  {
    title: 'Versão 1.1.13',
    items: [
      <>
        <strong>Categorias de Seleção Múltipla:</strong> As categorias do tipo enum e multiselect agora usam um modelo
        relacional, permitindo renomear e reordenar opções sem perder dados históricos dos artigos.
      </>,
      <>
        <strong>Sets de Perguntas:</strong> Crie, reutilize e duplique conjuntos de perguntas para investigações em IA,
        com suporte a escopo global e por projeto.
      </>,
      <>
        <strong>Resultados de Investigação Granulares:</strong> Cada resposta gerada pela IA em investigações massivas
        agora é armazenada individualmente, permitindo visualização e exportação por artigo e pergunta.
      </>,
      <>
        <strong>Configuração de Modelos de IA:</strong> Novo painel para selecionar provider e modelo por habilidade
        (metadados, resumo, extração, embeddings) com suporte a OpenAI, Gemini, Anthropic e Ollama.
      </>,
      <>
        <strong>Export/Import Completo (.emmapcarc):</strong> A transferência de projetos entre computadores agora
        inclui seleções de categorias, sets de perguntas e resultados de investigação, sem perda de dados.
      </>,
      <>
        <strong>RAG e Busca Semântica:</strong> Infraestrutura de chunks de PDF e embeddings vetoriais para respostas
        contextualizadas com citação de trecho e página.
      </>,
    ],
  },
  {
    title: 'Versão 1.1.12',
    items: [
      <>
        <strong>Sistema de Backup e Lixeira:</strong> Implementação completa de backups automáticos (rotação GFS) e
        lixeira para recuperação segura de projetos, artigos e anotações.
      </>,
      <>
        <strong>Histórico do Diário:</strong> O diário do projeto agora armazena versões passadas, permitindo a
        restauração de textos anteriores diretamente pela interface.
      </>,
      <>
        <strong>Integridade de Importação/Exportação:</strong> Resolução de falhas que causavam perda de dados de
        categorias e histórico ao mover projetos entre computadores via arquivos `.emmapcarc`.
      </>,
      <>
        <strong>Correções de Banco de Dados:</strong> Otimização da persistência (checkpointing WAL) e tratamento de
        erros de colunas inexistentes em migrações automáticas.
      </>,
      <>
        <strong>Melhorias de UI:</strong> Novos modais de restauração, botões de lixeira estilizados e feedbacks visuais
        aprimorados.
      </>,
    ],
  },
  {
    title: 'Versão 1.1.11',
    items: [
      <>
        <strong>Controle de "et al." em Citações:</strong> Adicionado checkbox nos modais de citação individual e em
        massa para ativar/desativar o uso de "et al." na lista de autores.
      </>,
      <>
        <strong>Leitura de Autores por Vírgulas:</strong> Correção do parser de autores para suportar adequadamente
        nomes separados por vírgula em metadados importados.
      </>,
      <>
        <strong>Instruções de Preenchimento:</strong> Inclusão de textos de ajuda explicativos sobre o padrão de
        identificação de múltiplos autores nos formulários de cadastro e edição.
      </>,
      <>
        <strong>Padronização de Accordions:</strong> Ajuste visual e estrutural completo dos ícones dinâmicos
        (`ChevronRight`/`ChevronDown`) e remoção das setas nativas do navegador nos accordions de artigos lidos e
        arquivados.
      </>,
      <>
        <strong>Ajustes de Rolagem:</strong> Correção do transbordo da barra de rolagem nas bordas arredondadas do modal
        de citação em massa.
      </>,
    ],
  },
  {
    title: 'Versão 1.1.10',
    items: [
      <>
        <strong>Melhoria de Layout nos Modais:</strong> Correção do transbordo da barra de rolagem (clipping do
        scrollbar) nas bordas arredondadas nos modais do sistema.
      </>,
      <>
        <strong>Rolagem de Resumo e Referências:</strong> Remoção da rolagem interna nas caixas de resumo e referências,
        integrando-as à rolagem global do modal.
      </>,
      <>
        <strong>Padronização de Status de Artigos:</strong> Renomeação do filtro "Novos" para "Ativos", unificando a
        nomenclatura do sistema.
      </>,
      <>
        <strong>Ações Contextuais de Artigos:</strong> Exibição inteligente de botões como "Desmarcar" e "Restaurar" de
        acordo com o status atual do artigo.
      </>,
      <>
        <strong>Mais Opções para Artigos Lidos:</strong> Adição de botões para abrir detalhes e gerar citações
        diretamente nos artigos da lista de lidos.
      </>,
      <>
        <strong>Ajustes Visuais e de Console:</strong> Inversão de posição dos autores/citações e correção de
        erros/avisos do console relacionados ao React 19.
      </>,
    ],
  },
  {
    title: 'Versão 1.1.9',
    items: [
      <>
        <strong>Correção no Reconhecimento de Chaves de API:</strong> Resolvida a inconsistência de nomes nas chaves do
        Scopus e Web of Science entre as configurações e o motor de busca.
      </>,
      <>
        <strong>Retrocompatibilidade de Credenciais:</strong> Adicionado suporte a fallbacks inteligentes para carregar
        e descriptografar de forma nativa chaves já armazenadas em qualquer convenção de nomenclatura.
      </>,
      <>
        <strong>Garantia de Integridade:</strong> Inclusão de novos testes de regressão no banco de dados e orquestrador
        de chamadas de busca das APIs.
      </>,
    ],
  },
  {
    title: 'Versão 1.1.8',
    items: [
      <>
        <strong>Artigos Lidos nas Categorias:</strong> Correção na tabela de categorias para exibir também os artigos
        marcados como lidos, e não apenas os ativos.
      </>,
    ],
  },
  {
    title: 'Versão 1.1.7',
    items: [
      <>
        <strong>Melhoria na Ancoragem de Destaques:</strong> Nova normalização de caracteres do PDF (como ligaduras,
        aspas e travessões) que melhora a vinculação automática com o texto.
      </>,
      <>
        <strong>Quebras de Linha nas Anotações:</strong> Suporte completo para renderização de quebras de linha (\n) nos
        comentários, anotações e no popup de hover no leitor.
      </>,
      <>
        <strong>Sincronização do Diário:</strong> Resolução de inconsistências de persistência de dados e condições de
        corrida no diário do projeto.
      </>,
      <>
        <strong>Gerenciamento de Opções:</strong> Substituição do prompt nativo por campos de input dinâmicos na criação
        de opções para categorias de enum.
      </>,
    ],
  },
  {
    title: 'Versão 1.1.6',
    items: [
      <>
        <strong>Categorias de Seleção Múltipla:</strong> Adicionado suporte a categorias do tipo "seleção múltipla"
        (multi-select), permitindo selecionar várias opções simultaneamente para classificar cada artigo.
      </>,
    ],
  },
];
