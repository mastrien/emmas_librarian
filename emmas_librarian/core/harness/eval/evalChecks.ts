import type { CommandRegistry } from '../../commands/CommandRegistry';
import type { EvalCheck } from './evalCase';

type Args = Record<string, unknown>;
type Rows = Array<Record<string, unknown>>;
type Check = (commands: CommandRegistry, args: Args, before: string) => Promise<boolean>;

const rows = async (commands: CommandRegistry, name: string, ...args: unknown[]): Promise<Rows> =>
  (await commands.run(name, ...args)) as Rows;

/** Everything an episode could change, as one text, so "nothing changed" is one comparison. */
export async function snapshot(commands: CommandRegistry): Promise<string> {
  const parts = await Promise.all([
    rows(commands, 'projects:getAll'),
    rows(commands, 'articles:getByProject', 1),
    rows(commands, 'annotations:get', 1),
    rows(commands, 'diary:getAll', 1),
    rows(commands, 'trash:getItems'),
    rows(commands, 'scientificVenues:getAll'),
    rows(commands, 'projectDocuments:get', 1),
    rows(commands, 'categories:getProject', 1),
    rows(commands, 'screening:labels', 1),
    rows(commands, 'questionSets:list', null),
  ]);
  return JSON.stringify(parts);
}

const namesOf = (list: Rows, key: string): unknown[] => list.map((row) => row[key]);

const CHECKS: Record<string, Check> = {
  unchanged: async (commands, _args, before) => (await snapshot(commands)) === before,
  projectExists: async (c, a) => namesOf(await rows(c, 'projects:getAll'), 'name').includes(a.name),
  projectName: async (c, a) => (await rows(c, 'projects:getAll')).some((p) => p.id === a.id && p.name === a.name),
  inTrash: async (c, a) => (await rows(c, 'trash:getItems')).some((i) => i.type === a.type && i.id === a.id),
  articleStatus: async (c, a) => {
    const articles = await rows(c, 'articles:getByProject', 1);
    return (a.ids as number[]).every((id) => articles.find((x) => x.id === id)?.status === a.status);
  },
  diaryEndsWith: async (c, a) => {
    const page = (await c.run('diary:getOne', a.projectId, a.date)) as { content: string } | undefined;
    return !!page?.content.endsWith(String(a.text)) && page.content.startsWith(String(a.keeps));
  },
  venueCount: async (c, a) => (await rows(c, 'scientificVenues:getAll')).length === a.count,
  categoryExists: async (c, a) => {
    const found = (await rows(c, 'categories:getProject', a.projectId)).find((x) => x.name === a.name);
    const options = (found?.parsedOptions as Rows | undefined) ?? [];
    return !!found && JSON.stringify(namesOf(options, 'name')) === JSON.stringify(a.options);
  },
  docExists: async (c, a) =>
    (await rows(c, 'projectDocuments:get', a.projectId)).some((d) => d.title === a.title && d.url === a.url),
  labelExists: async (c, a) => namesOf(await rows(c, 'screening:labels', a.projectId), 'name').includes(a.name),
  questionSetExists: async (c, a) => {
    const found = (await rows(c, 'questionSets:list', null)).find((s) => s.name === a.name);
    return !!found && found.questions === JSON.stringify(a.questions);
  },
};

export const CHECK_NAMES: string[] = Object.keys(CHECKS);

/**
 * Whether the library is in the state a case wants when its episode ends.
 *
 * Usage:
 *   const before = await snapshot(commands);
 *   // ...the episode...
 *   await runCheck({ check: 'articleStatus', args: { ids: [3], status: 'read' } }, commands, before);
 */
export async function runCheck(check: EvalCheck, commands: CommandRegistry, before: string): Promise<boolean> {
  const run = CHECKS[check.check];
  if (!run)
    throw new Error(
      `[ERR_UNKNOWN_CHECK] Offending value: ${JSON.stringify(check.check)}. Expected one of: ${CHECK_NAMES.join(', ')}.`,
    );
  return run(commands, check.args ?? {}, before);
}
