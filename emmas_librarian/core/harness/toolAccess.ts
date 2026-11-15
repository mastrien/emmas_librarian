/**
 * How a model may use a command. A command that is not in TOOL_ACCESS is not offered at all (deny by default), so
 * a command added tomorrow reaches no model until someone decides it should (#27, review of 2026-11-15).
 */
export interface Access {
  /** The person approves each call, seeing the tool and its arguments, before it runs. */
  confirm: boolean;
  /** Only offered when the model runs on the person's machine: the call sends text or queries to a third party. */
  localOnly: boolean;
  /** Arguments the model never sees; the command gets them empty (a file path the model must not choose). */
  hideParameters?: readonly string[];
}

const NO_PATH: Access = { confirm: true, localOnly: false, hideParameters: ['sourceFilePath'] };
const READ: Access = { confirm: false, localOnly: false };
const CONFIRMED: Access = { confirm: true, localOnly: false };
const LOCAL: Access = { confirm: false, localOnly: true };
const LOCAL_CONFIRMED: Access = { confirm: true, localOnly: true };

const grant = (access: Access, names: string[]): Array<[string, Access]> => names.map((name) => [name, access]);

/** Reads, and what only moves the "last opened" mark. */
const READS = [
  'app:getVersion',
  'projects:getAll', 'projects:getOne', 'projects:getAbout', 'projects:getNavCounts', 'projects:markOpened',
  'projects:getScreeningSummaries', 'projects:getSearchHistory', 'projects:getWritingPad',
  'articles:getByProject', 'articles:getOne', 'pdfLibrary:list', 'highlights:get',
  'diary:getAll', 'diary:getOne', 'diary:getHistory',
  'categories:getProject', 'categories:getAllProjectArticle',
  'projectDocuments:get', 'projectDocuments:markOpened', 'trash:getItems',
  'screening:labels', 'screening:criteriaGet', 'screening:decisions', 'prisma:recordsGet',
  'questionSets:list', 'questionSets:get', 'investigationAudits:byProject', 'investigationAudits:get',
  'investigationResults:get', 'investigationResults:getByArticle', 'massiveInvestigations:get',
  'search:translateQuery', 'searchMonitor:list', 'searchMonitor:overview', 'scientificVenues:getAll', 'backup:listAuto',
]; // prettier-ignore

/** Every creation, edit and removal asks the person first. */
const WRITES = [
  'projects:create', 'projects:update', 'projects:delete', 'projects:updateAbout', 'projects:updateWritingPad',
  'articles:importFromProject', 'articles:updateMetadata', 'articles:updateStatus', 'articles:updateStatusMany',
  'pdf:unlink', 'diary:appendAgentRecord', 'categories:createProject', 'categories:applySet',
  'projectDocuments:delete', 'projectDocuments:reorder',
  'trash:restoreItem', 'screening:labelCreate', 'screening:labelRename',
  'questionSets:create', 'questionSets:update', 'questionSets:duplicate',
  'searchMonitor:set', 'searchMonitor:dismiss', 'searchMonitor:review',
  'scientificVenue:create', 'scientificVenue:update', 'scientificVenue:delete', 'scientificMilestone:toggleStatus',
]; // prettier-ignore

/** They send the library's text, or a query, to a third party, so a model in the cloud never gets them. */
const LOCAL_WRITES = [
  'pdf:fetchOpenAccess', 'search:preview', 'search:peekCitations', 'search:previewCitations', 'search:savePreview',
  'ai:generateSummary', 'ai:extractMetadata', 'ai:massiveExtraction', 'ask:indexMissing', 'screening:vectorsGenerate',
]; // prettier-ignore

const LOCAL_READS = ['search:discardPreview', 'ask:indexPlan', 'screening:vectorsPlan'];

/**
 * Puts the groups in one table, refusing a command listed twice: the second grant would silently replace the first
 * (a command moved from "asks first" to "free" by a typo).
 *
 * Usage:
 *   buildAccess([['a:read', READ]]); // Map { 'a:read' => READ }
 */
export function buildAccess(entries: Array<[string, Access]>): ReadonlyMap<string, Access> {
  const table = new Map<string, Access>();
  for (const [name, access] of entries) {
    if (table.has(name))
      throw new Error(
        `[ERR_DUPLICATE_ACCESS] Offending value: ${JSON.stringify(name)}. Expected each command in one group only.`,
      );
    table.set(name, access);
  }
  return table;
}

export const TOOL_ACCESS: ReadonlyMap<string, Access> = buildAccess([
  ...grant(READ, READS),
  ...grant(CONFIRMED, WRITES),
  ...grant(LOCAL_CONFIRMED, LOCAL_WRITES),
  ...grant(LOCAL, LOCAL_READS),
  ...grant(NO_PATH, ['projectDocuments:create', 'projectDocuments:update']),
]);
