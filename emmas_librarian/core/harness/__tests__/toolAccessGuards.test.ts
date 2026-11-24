// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { commandSchemas } from '../commandSchemas';
import { LibraryToolkit } from '../LibraryToolkit';
import { FakeConfirmer } from './support/FakeConfirmer';
import { openTestLibrary } from './support/openTestLibrary';
import { TOOL_ACCESS } from '../toolAccess';
import type { ValueSchema } from '../valueSchema';

/**
 * Commands that run with no approval from the person: reads, plus the exceptions below. Written out in full on
 * purpose: a command added or moved here must be added to this list too, so the decision is made twice and seen
 * in review (#195 review: moving articles:updateStatusMany to the reads must fail a test).
 */
const RUNS_WITHOUT_APPROVAL: readonly string[] = [
  'app:getVersion',
  'projects:getAll', 'projects:getOne', 'projects:getAbout', 'projects:getNavCounts', 'projects:markOpened',
  'projects:getScreeningSummaries', 'projects:getSearchHistory', 'projects:getWritingPad',
  'articles:getByProject', 'articles:getOne', 'pdfLibrary:list', 'highlights:get', 'annotations:get',
  'diary:getAll', 'diary:getOne', 'diary:getHistory',
  'categories:getProject', 'categories:getAllProjectArticle',
  'projectDocuments:get', 'projectDocuments:markOpened', 'trash:getItems',
  'screening:labels', 'screening:criteriaGet', 'screening:decisions', 'prisma:recordsGet',
  'questionSets:list', 'questionSets:get', 'investigationAudits:byProject', 'investigationAudits:get',
  'investigationResults:get', 'investigationResults:getByArticle', 'massiveInvestigations:get',
  'search:translateQuery', 'searchMonitor:list', 'searchMonitor:overview', 'scientificVenues:getAll', 'backup:listAuto',
  'search:discardPreview', 'ask:indexPlan', 'screening:vectorsPlan',
]; // prettier-ignore

/**
 * The accepted exceptions: names that look like a change but only move a "last opened" mark, or drop a preview that was
 * never saved. Nothing of the person's library is created, edited or removed by them.
 */
const ACCEPTED_NON_READS: readonly string[] = [
  'projects:markOpened',
  'projectDocuments:markOpened',
  'search:discardPreview',
];

const CHANGES_STATE =
  /create|update|delete|remove|set|save|reorder|restore|toggle|append|apply|import|review|dismiss|unlink|duplicate|rename|generate|mark|discard|fetch|extract/i;

describe('what runs without asking the person', () => {
  it('is exactly the written list: a command moved to the free group fails here', () => {
    const free = [...TOOL_ACCESS].filter(([, access]) => !access.confirm).map(([name]) => name);
    expect(free.sort()).toEqual([...RUNS_WITHOUT_APPROVAL].sort());
  });

  it('has no command that changes state except the accepted exceptions', () => {
    const suspicious = RUNS_WITHOUT_APPROVAL.filter((name) => CHANGES_STATE.test(name.split(':')[1]));
    expect(suspicious.sort()).toEqual([...ACCEPTED_NON_READS].sort());
  });

  it('asks for every command the harness knows to change the library', () => {
    const changing = ['articles:updateStatusMany', 'projects:delete', 'diary:appendAgentRecord', 'trash:restoreItem'];
    for (const name of changing) expect(TOOL_ACCESS.get(name)?.confirm, name).toBe(true);
  });
});

const PATH_LIKE = /path|file|dir/i;

/** Parameter names that look like a place on the disk, anywhere in the schema, with the way to reach each. */
function pathLikeNames(schema: ValueSchema | undefined, trail: string): string[] {
  if (!schema) return [];
  const own = Object.entries(schema.properties ?? {}).flatMap(([name, inner]) => [
    ...(PATH_LIKE.test(name) ? [`${trail}.${name}`] : []),
    ...pathLikeNames(inner, `${trail}.${name}`),
  ]);
  const nested = [schema.items, schema.additionalProperties, ...(schema.anyOf ?? [])];
  return [...own, ...nested.flatMap((inner) => pathLikeNames(inner, trail))];
}

/**
 * Visible parameters that match /path|file|dir/i and were looked at by a person (one today, a false positive). A legitimate one goes
 * here with the reason it is safe, instead of the test being loosened.
 */
const ACCEPTED_PATH_LIKE: Record<string, string> = {
  // "directions" is the citation direction (forward or backward), it only contains "dir"; no disk is involved.
  'search__previewCitations.request.directions': 'citation directions, not a directory',
};

describe('what a local model is shown', () => {
  it('has no parameter named like a path, a file or a directory, even inside nested objects', () => {
    const library = openTestLibrary();
    try {
      const toolkit = new LibraryToolkit({
        commands: library.commands,
        schemas: commandSchemas(),
        confirmer: new FakeConfirmer(true),
        modelIsLocal: true,
      });
      const found = toolkit
        .tools()
        .flatMap((tool) => pathLikeNames({ properties: tool.input_schema.properties }, tool.name))
        .filter((place) => !(place in ACCEPTED_PATH_LIKE));
      expect(found).toEqual([]);
    } finally {
      library.close();
    }
  });

  it('is found by the walk when the name is nested (the walk itself is not blind)', () => {
    const nested: ValueSchema = {
      type: 'object',
      properties: {
        items: { type: 'array', items: { type: 'object', properties: { sourceDir: { type: 'string' } } } },
      },
    };
    expect(pathLikeNames(nested, 't')).toEqual(['t.items.sourceDir']);
  });
});
