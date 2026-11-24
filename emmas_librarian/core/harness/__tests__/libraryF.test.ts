// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { LIBRARY_F, seedLibraryF } from './support/libraryF';
import { openTestLibrary, type TestLibrary } from './support/openTestLibrary';

let library: TestLibrary;
beforeEach(async () => {
  library = openTestLibrary();
  await seedLibraryF(library.commands);
});
afterEach(() => library.close());

const run = (name: string, ...args: unknown[]) => library.commands.run(name, ...args);

describe('Biblioteca de teste F', () => {
  it('has projects A and B, and the third one in the trash', async () => {
    const projects = (await run('projects:getAll')) as Array<{ id: number; name: string }>;
    expect(projects.map((p) => [p.id, p.name]).sort()).toEqual([
      [LIBRARY_F.projectA, 'Revisão sobre tutoria'],
      [LIBRARY_F.projectB, 'Vazio'],
    ]);
  });

  it('gives project A 6 articles: 3 new, 2 read, 1 archived, with the ids of LIBRARY_F', async () => {
    const articles = (await run('articles:getByProject', LIBRARY_F.projectA)) as Array<{ id: number; status: string }>;
    const count = (status: string) => articles.filter((a) => a.status === status).length;
    expect([articles.length, count('new'), count('read'), count('archived')]).toEqual([6, 3, 2, 1]);
    expect(articles.map((a) => a.id).sort()).toEqual(Object.values(LIBRARY_F.articles).sort());
  });

  it('leaves project B with nothing inside', async () => {
    expect(await run('articles:getByProject', LIBRARY_F.projectB)).toEqual([]);
  });

  it('gives article 1 two annotations and one highlight', async () => {
    expect(await run('annotations:get', LIBRARY_F.articles.adaptive)).toHaveLength(2);
    expect(await run('highlights:get', LIBRARY_F.articles.adaptive)).toHaveLength(1);
  });

  it('has the diary page of 2026-11-10', async () => {
    expect(await run('diary:getOne', LIBRARY_F.projectA, LIBRARY_F.diaryDate)).toMatchObject({
      content: 'Li dois artigos.',
    });
  });

  it('puts one project and one annotation in the trash', async () => {
    const items = (await run('trash:getItems')) as Array<{ type: string }>;
    expect(items.map((i) => i.type).sort()).toEqual(['annotation', 'project']);
  });

  it('has the default screening labels and one conference', async () => {
    const labels = (await run('screening:labels', LIBRARY_F.projectA)) as Array<{ name: string }>;
    expect(labels.map((l) => l.name)).toEqual(['Incluso', 'Em dúvida', 'Excluído', 'Duplicado']);
    expect(await run('scientificVenues:getAll')).toHaveLength(1);
  });
});
