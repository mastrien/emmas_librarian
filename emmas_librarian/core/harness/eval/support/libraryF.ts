import type { CommandRegistry } from '../../../commands/CommandRegistry';

/** The ids of "Biblioteca de teste F". Stable: the library is built in this order over an empty database. */
export const LIBRARY_F = {
  projectA: 1,
  projectB: 2,
  projectTrashed: 3,
  articles: { adaptive: 1, hints: 2, rules: 3, recall: 4, effect: 5, old: 6 },
  annotations: { first: 1, second: 2, trashed: 3 },
  diaryDate: '2026-11-10',
} as const;

type Row = [title: string, status: 'new' | 'read' | 'archived', year: number];

// 3 new, 2 read, 1 archived. Article 1 is about adaptive feedback and carries the notes and the highlight; the one on
// rule-based tutors (3) is new, for the case that marks it as read.
const ARTICLES: Row[] = [
  ['Adaptive feedback in intelligent tutoring systems', 'read', 2020],
  ['Hints and student modelling in tutoring dialogues', 'read', 2021],
  ['Tutores baseados em regras para ensino de álgebra', 'new', 2018],
  ['Retrieval practice with an adaptive tutor', 'new', 2022],
  ['Effect sizes of tutoring systems: a meta-analysis', 'new', 2019],
  ['Early tutoring prototypes', 'archived', 2005],
];

const run = (commands: CommandRegistry, name: string, ...args: unknown[]) => commands.run(name, ...args);

async function seedArticles(commands: CommandRegistry): Promise<void> {
  for (const [title, status, year] of ARTICLES) {
    const id = await run(commands, 'articles:createManual', LIBRARY_F.projectA, { title, year });
    if (status !== 'new') await run(commands, 'articles:updateStatus', id, status);
  }
}

async function seedNotes(commands: CommandRegistry): Promise<void> {
  const { adaptive } = LIBRARY_F.articles;
  await run(commands, 'annotations:create', adaptive, 'Comparar com o estudo de Pereira');
  await run(commands, 'annotations:create', adaptive, 'Boa revisão da literatura');
  await run(commands, 'annotations:create', adaptive, 'comentário');
  await run(commands, 'annotations:delete', LIBRARY_F.annotations.trashed);
  await run(commands, 'highlights:create', LIBRARY_F.articles.adaptive, '#FFEB3B', '{"page":3}', 'adaptive feedback');
  await run(commands, 'diary:save', LIBRARY_F.projectA, LIBRARY_F.diaryDate, 'Li dois artigos.');
}

async function seedAgenda(commands: CommandRegistry): Promise<void> {
  const submission = {
    label: 'Submissão',
    field_type: 'single',
    target_date: '2026-12-15',
    has_time: false,
    status: 'pending',
  };
  await run(commands, 'scientificVenue:create', {
    title: 'Simpósio Brasileiro de Informática na Educação',
    acronym: 'SBIE',
    category: 'conference',
    milestones: [submission],
  });
}

/**
 * Fills an empty library with "Biblioteca de teste F": project A "Revisão sobre tutoria" (6 articles, 3 new, 2 read and 1
 * archived; 2 annotations and 1 highlight; a diary page of 2026-11-10 with "Li dois artigos."), project B "Vazio", a
 * trash with 1 project and 1 annotation, and 1 conference with a submission date. No API keys, no network.
 *
 * Usage:
 *   const library = openTestLibrary();
 *   await seedLibraryF(library.commands); // ids are in LIBRARY_F
 */
export async function seedLibraryF(commands: CommandRegistry): Promise<typeof LIBRARY_F> {
  await run(commands, 'projects:create', 'Revisão sobre tutoria');
  await run(commands, 'projects:create', 'Vazio');
  await run(commands, 'projects:create', 'Projeto antigo');
  await run(commands, 'projects:delete', LIBRARY_F.projectTrashed);
  await seedArticles(commands);
  await seedNotes(commands);
  await seedAgenda(commands);
  return LIBRARY_F;
}
