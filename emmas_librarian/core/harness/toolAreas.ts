/** A subject of the library, with the commands a model needs to work on it. */
export interface ToolArea {
  id: string;
  /** One line the model reads to pick the area: what it is for. */
  about: string;
  commands: readonly string[];
}

/**
 * The library by subject (the cards of the review of 2026-11-15). Every command a model may use is in exactly one area,
 * which a test checks against TOOL_ACCESS. Routing offers a model only the areas it picked, so a small model reads a
 * few tools instead of eighty (#27).
 */
export const TOOL_AREAS: readonly ToolArea[] = [
  {
    id: 'projetos',
    about:
      'listar, criar, renomear e apagar projetos; sobre o projeto, bloco de escrita, contagens e histórico de buscas',
    commands: [
      'projects:getAll',
      'projects:getOne',
      'projects:getAbout',
      'projects:getNavCounts',
      'projects:markOpened',
      'projects:getScreeningSummaries',
      'projects:getSearchHistory',
      'projects:getWritingPad',
      'projects:create',
      'projects:update',
      'projects:delete',
      'projects:updateAbout',
      'projects:updateWritingPad',
    ],
  },
  {
    id: 'artigos',
    about:
      'ver artigos de um projeto, mudar status (novo, lido, arquivado), editar metadados, importar de outro projeto',
    commands: [
      'articles:getByProject',
      'articles:getOne',
      'articles:importFromProject',
      'articles:updateMetadata',
      'articles:updateStatus',
      'articles:updateStatusMany',
    ],
  },
  {
    id: 'pdfs',
    about: 'PDFs dos artigos: ver a biblioteca de PDFs, desvincular, baixar PDF de acesso aberto',
    commands: ['pdfLibrary:list', 'pdf:unlink', 'pdf:fetchOpenAccess'],
  },
  {
    id: 'anotacoes',
    about: 'ler as anotações e os destaques de um artigo',
    commands: ['annotations:get', 'highlights:get'],
  },
  {
    id: 'diario',
    about: 'ler o diário do projeto (por dia, com histórico) e acrescentar um registro',
    commands: ['diary:getAll', 'diary:getOne', 'diary:getHistory', 'diary:appendAgentRecord'],
  },
  {
    id: 'categorias',
    about: 'categorias personalizadas do projeto: ver, criar, aplicar um conjunto',
    commands: [
      'categories:getProject',
      'categories:getAllProjectArticle',
      'categories:createProject',
      'categories:applySet',
    ],
  },
  {
    id: 'acesso-rapido',
    about: 'links e documentos de acesso rápido do projeto',
    commands: [
      'projectDocuments:get',
      'projectDocuments:markOpened',
      'projectDocuments:create',
      'projectDocuments:update',
      'projectDocuments:delete',
      'projectDocuments:reorder',
    ],
  },
  { id: 'lixeira', about: 'ver o que foi apagado e restaurar', commands: ['trash:getItems', 'trash:restoreItem'] },
  {
    id: 'triagem',
    about: 'rótulos e critérios da triagem de artigos, decisões já tomadas; criar e renomear rótulos',
    commands: [
      'screening:labels',
      'screening:criteriaGet',
      'screening:decisions',
      'screening:labelCreate',
      'screening:labelRename',
    ],
  },
  { id: 'prisma', about: 'fontes e registros do fluxo PRISMA (só leitura)', commands: ['prisma:recordsGet'] },
  {
    id: 'perguntas',
    about: 'conjuntos de perguntas para extração, resultados e auditorias de extração',
    commands: [
      'questionSets:list',
      'questionSets:get',
      'questionSets:create',
      'questionSets:update',
      'questionSets:duplicate',
      'investigationAudits:byProject',
      'investigationAudits:get',
      'investigationResults:get',
      'investigationResults:getByArticle',
      'massiveInvestigations:get',
    ],
  },
  {
    id: 'busca',
    about: 'buscas bibliográficas: converter consulta, pré-visualizar e salvar busca, citações, monitor de buscas',
    commands: [
      'search:translateQuery',
      'search:preview',
      'search:peekCitations',
      'search:previewCitations',
      'search:savePreview',
      'search:discardPreview',
      'searchMonitor:list',
      'searchMonitor:overview',
      'searchMonitor:set',
      'searchMonitor:dismiss',
      'searchMonitor:review',
    ],
  },
  {
    id: 'ia',
    about: 'usar IA: resumo de artigo, extração de metadados e de respostas; indexar para perguntas e gerar vetores',
    commands: [
      'ai:generateSummary',
      'ai:extractMetadata',
      'ai:massiveExtraction',
      'ask:indexPlan',
      'ask:indexMissing',
      'screening:vectorsPlan',
      'screening:vectorsGenerate',
    ],
  },
  {
    id: 'agenda',
    about: 'agenda científica: congressos e periódicos com prazos',
    commands: [
      'scientificVenues:getAll',
      'scientificVenue:create',
      'scientificVenue:update',
      'scientificVenue:delete',
      'scientificMilestone:toggleStatus',
    ],
  },
  {
    id: 'sistema',
    about: 'versão do aplicativo e backups automáticos existentes',
    commands: ['app:getVersion', 'backup:listAuto'],
  },
];
