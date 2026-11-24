import { describe, it, expect, beforeEach } from 'vitest';
import type { SyncOperation } from '../../../../core/sync/operations';
import { LocalLibrary, type LibraryClock } from '../LocalLibrary';
import { LocalProjectReader } from '../LocalProjectReader';
import { MemoryPdfStorage } from './fakes/MemoryPdfStorage';

class StepClock implements LibraryClock {
  private n = 0;
  public now(): string {
    return '2026-11-21T09:00:00.000Z';
  }
  public newUuid(): string {
    this.n += 1;
    return `u${this.n}`;
  }
}

let library: LocalLibrary;
let pdfs: MemoryPdfStorage;
let reader: LocalProjectReader;

const remote = (entity: SyncOperation['entity'], uuid: string, fields: SyncOperation['fields']): SyncOperation => ({
  opId: `r-${uuid}`,
  deviceId: 'desktop',
  entity,
  uuid,
  kind: 'insert',
  fields,
  changedAt: 't',
});

beforeEach(() => {
  library = LocalLibrary.empty('phone', new StepClock());
  pdfs = new MemoryPdfStorage();
  reader = new LocalProjectReader(library, pdfs);
  library.applyRemote([
    remote('projects', 'p1', { name: 'Review', created_at: '2026-11-01', deleted_at: null }),
    remote('articles', 'a1', { project_id: 'p1', title: 'Mindfulness', deleted_at: null }),
    remote('project_diary', 'd1', { project_id: 'p1', entry_date: '2026-11-20', content: 'desktop day' }),
  ]);
});

describe('reading', () => {
  it('lists projects with their origin and how many changes wait for the computer', async () => {
    await reader.writer.saveDiaryEntry(1, '2026-11-21', 'phone page');
    expect(await reader.listProjects()).toMatchObject([{ id: 1, name: 'Review', origin: 'synced', pendingChanges: 1 }]);
  });

  it('gives articles with the project as a numeric id, never a uuid', async () => {
    expect(await reader.listArticles(1)).toMatchObject([{ id: 1, project_id: 1, title: 'Mindfulness' }]);
  });

  it('hides what is in the trash', async () => {
    library.applyRemote([{ ...remote('articles', 'a1', { deleted_at: '2026-11-21' }), kind: 'update' }]);
    expect(await reader.listArticles(1)).toEqual([]);
    expect(await reader.getArticle(1)).toBeNull();
  });

  it('lists the diary newest first', async () => {
    await reader.writer.saveDiaryEntry(1, '2026-11-21', 'today');
    expect((await reader.listDiary(1)).map((page) => page.entry_date)).toEqual(['2026-11-21', '2026-11-20']);
  });

  it('reads a downloaded PDF, and says none when it was not downloaded', async () => {
    expect(await reader.readPdf(1)).toBeNull();
    await pdfs.put('a1', new Uint8Array([1, 2, 3]));
    expect(Array.from((await reader.readPdf(1)) ?? [])).toEqual([1, 2, 3]);
  });

  it('has no categories yet, because they do not sync', async () => {
    expect(await reader.listCategories(1)).toEqual([]);
    expect(await reader.listArticleCategories(1)).toEqual([]);
  });
});

describe('writing', () => {
  it('writes a new diary page, and rewrites the page of the same day instead of making a second one', async () => {
    await reader.writer.saveDiaryEntry(1, '2026-11-20', 'edited');
    expect(await reader.listDiary(1)).toMatchObject([{ entry_date: '2026-11-20', content: 'edited' }]);
  });

  it('adds a quick link and marks it opened', async () => {
    await reader.writer.addQuickLink(1, 'Protocol', 'https://example.org');
    await reader.writer.markDocumentOpened(1);
    const [link] = await reader.listDocuments(1);
    expect(link).toMatchObject({ title: 'Protocol', url: 'https://example.org' });
    expect(link.last_opened_at).toBeTruthy();
  });

  it('marks a passage with a note, in an order the computer can apply', async () => {
    await reader.writer?.addHighlight?.(1, {
      color: '#facc15',
      positionData: { boundingRect: { pageNumber: 6 } },
      contentText: 'Anxiety dropped',
      comment: 'check scale',
    });

    expect(await reader.listHighlights(1)).toMatchObject([
      {
        color: '#facc15',
        content_text: 'Anxiety dropped',
        comment: 'check scale',
        position_data: { boundingRect: { pageNumber: 6 } },
      },
    ]);
    expect(library.pendingOperations().map((op) => `${op.kind}:${op.entity}`)).toEqual([
      'insert:highlights',
      'insert:annotations',
      'update:highlights',
    ]);
  });

  it('marks a passage without a note as one change', async () => {
    await reader.writer?.addHighlight?.(1, { color: '#4ade80', positionData: {}, contentText: 'x' });
    expect(library.pendingOperations()).toHaveLength(1);
  });

  it('creates a project and an article that stay on the phone', async () => {
    const project = (await reader.writer?.createProject?.('Ideas')) as number;
    await reader.writer?.addArticle?.(project, { title: 'Only here', year: 2025 });
    expect(await reader.listArticles(project)).toMatchObject([{ title: 'Only here', year: 2025 }]);
    expect(reader.standingOf(project)).toEqual({ origin: 'own', pendingChanges: 0 });
  });

  it('says plainly that categories cannot be changed on the phone yet', async () => {
    await expect(reader.writer.setArticleCategory(1, 1, 'x')).rejects.toThrow('Categories do not sync');
  });

  it('lists the notes of an article, hiding the ones in the trash', async () => {
    library.applyRemote([
      remote('annotations', 'n1', { article_id: 'a1', content_markdown: 'kept', created_at: 't', deleted_at: null }),
      remote('annotations', 'n2', {
        article_id: 'a1',
        content_markdown: 'trashed',
        created_at: 't',
        deleted_at: '2026-11-21',
      }),
    ]);
    expect(await reader.listAnnotations(1)).toMatchObject([{ content_markdown: 'kept', article_id: 1 }]);
  });

  it('tells the size of a downloaded PDF, or null when there is none', async () => {
    expect(await reader.pdfSize(1)).toBeNull();
    await pdfs.put('a1', new Uint8Array(2048));
    expect(await reader.pdfSize(1)).toBe(2048);
  });
});
