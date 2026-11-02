import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DatabaseAdapter } from '../DatabaseAdapter';
import { VectorStore } from '../../services/VectorStore';

vi.mock('electron', () => ({ safeStorage: {} }));

const MODEL = 'openai/atual';

describe('PdfChunkIndexRepository (#53), on real SQLite', () => {
  let adapter: DatabaseAdapter;
  let projectId: number;

  beforeEach(() => {
    adapter = new DatabaseAdapter(':memory:');
    projectId = adapter.createProject('Revisão').id;
  });

  const repo = () => adapter.pdfChunkIndexRepo;

  function addArticle(title: string, pdf: string | null = null): number {
    const insert = adapter
      .getDB()
      .prepare('INSERT INTO articles (project_id, title, authors, year, local_file_path) VALUES (?, ?, ?, 2020, ?)');
    return Number(insert.run(projectId, title, 'Silva', pdf).lastInsertRowid);
  }

  function indexWith(articleId: number, model: string | null): void {
    const chunk = { text: 't', page: 1, bbox: { x: 0, y: 0, w: 1, h: 1 } };
    new VectorStore(adapter.getDB()).indexArticleChunks(articleId, [chunk], [[0, 0]], model);
  }

  const ids = (articles: { id: number }[]) => articles.map((a) => a.id);

  it('splits the articles by what a question can read', () => {
    const indexed = addArticle('Indexado', 'a.pdf');
    const notYet = addArticle('Com PDF', 'b.pdf');
    const noPdf = addArticle('Sem PDF');
    indexWith(indexed, MODEL);

    const coverage = repo().coverage([indexed, notYet, noPdf], MODEL);

    expect(coverage.total).toBe(3);
    expect(coverage.indexed).toEqual([{ id: indexed, title: 'Indexado', authors: 'Silva', year: 2020 }]);
    expect(ids(coverage.withoutIndex)).toEqual([notYet]);
    expect(ids(coverage.withoutPdf)).toEqual([noPdf]);
    expect(coverage.otherModel).toEqual([]);
    expect(coverage.unknownModel).toEqual([]);
  });

  it('tells a different model from one the app did not record', () => {
    const other = addArticle('Outro', 'a.pdf');
    const older = addArticle('Antigo', 'b.pdf');
    indexWith(other, 'ollama/outro');
    indexWith(older, null);

    const coverage = repo().coverage([other, older], MODEL);

    expect(ids(coverage.otherModel)).toEqual([other]);
    expect(ids(coverage.unknownModel)).toEqual([older]);
    expect(ids(coverage.indexed)).toEqual([other, older]);
  });

  it('leaves out what is in the trash', () => {
    const trashed = addArticle('Na lixeira', 'a.pdf');
    adapter.getDB().prepare("UPDATE articles SET deleted_at = '2026-01-01' WHERE id = ?").run(trashed);

    expect(repo().coverage([trashed], MODEL).total).toBe(0);
    expect(repo().projectArticleIds(projectId)).toEqual([]);
  });

  it('lists only the articles of the project', () => {
    const mine = addArticle('Meu');
    const otherProject = adapter.createProject('Outro').id;
    adapter.getDB().prepare("INSERT INTO articles (project_id, title) VALUES (?, 'Alheio')").run(otherProject);

    expect(repo().projectArticleIds(projectId)).toEqual([mine]);
  });

  it('keeps the model on a copy of the article to another project', () => {
    const source = addArticle('Fonte', 'a.pdf');
    indexWith(source, MODEL);
    const target = adapter.createProject('Destino').id;

    const entry = adapter.saveSearchHistory(target, 'Importação', { import: 'x' }, 1, {});

    adapter.importArticlesFromProject(projectId, target, [source], entry);

    const models = adapter.getDB().prepare('SELECT embedding_model AS m FROM pdf_chunks').all();
    expect(models).toEqual([{ m: MODEL }, { m: MODEL }]);
  });
});
