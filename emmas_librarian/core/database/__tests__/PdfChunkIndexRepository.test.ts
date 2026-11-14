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
    expect(coverage.indexed).toEqual([
      { id: indexed, title: 'Indexado', authors: 'Silva', year: 2020, pdfPath: 'a.pdf' },
    ]);
    expect(ids(coverage.withoutIndex)).toEqual([notYet]);
    expect(ids(coverage.withoutPdf)).toEqual([noPdf]);
    expect(coverage.outdated).toEqual([]);
  });

  it('counts as readable only what the current model indexed', () => {
    const current = addArticle('Atual', 'c.pdf');
    const other = addArticle('Outro', 'a.pdf');
    const older = addArticle('Antigo, sem modelo registrado', 'b.pdf');
    indexWith(current, MODEL);
    indexWith(other, 'ollama/outro');
    indexWith(older, null);

    const coverage = repo().coverage([current, other, older], MODEL);

    expect(ids(coverage.indexed)).toEqual([current]);
    expect(ids(coverage.outdated)).toEqual([other, older]);
    expect(coverage.withoutIndex).toEqual([]);
  });

  it('names the model most outdated PDFs came from, leaving out those of no known model', () => {
    const [a, b, c, d] = ['a', 'b', 'c', 'd'].map((name) => addArticle(name, `${name}.pdf`));
    indexWith(a, 'ollama/velho');
    indexWith(b, 'ollama/velho');
    indexWith(c, 'gemini/outro');
    indexWith(d, null);

    expect(repo().coverage([a, b, c, d], MODEL).previousModel).toBe('ollama/velho');
    expect(repo().coverage([d], MODEL).previousModel).toBeNull();
  });

  it('names no previous model when nothing is outdated', () => {
    const current = addArticle('Atual', 'a.pdf');
    indexWith(current, MODEL);

    expect(repo().coverage([current], MODEL).previousModel).toBeNull();
  });

  it('finds the model most of the library used, besides the current one', () => {
    const [a, b, c, d] = ['a', 'b', 'c', 'd'].map((name) => addArticle(name, `${name}.pdf`));
    indexWith(a, MODEL);
    indexWith(b, 'ollama/velho');
    indexWith(c, 'ollama/velho');
    indexWith(d, null);

    expect(repo().mostUsedModelBesides(MODEL)).toBe('ollama/velho');
    expect(repo().mostUsedModelBesides('ollama/velho')).toBe(MODEL);
  });

  it('finds no model in an empty library', () => {
    expect(repo().mostUsedModelBesides(MODEL)).toBeNull();
  });

  it('keeps a PDF of another model whose file is gone apart, since it cannot be recalculated', () => {
    const gone = addArticle('Sem arquivo');
    indexWith(gone, 'ollama/outro');

    const coverage = repo().coverage([gone], MODEL);

    expect(ids(coverage.withoutPdf)).toEqual([gone]);
    expect(coverage.outdated).toEqual([]);
  });

  it('still reads a PDF of the current model whose file is gone: its text is in the index', () => {
    const gone = addArticle('Sem arquivo');
    indexWith(gone, MODEL);

    expect(ids(repo().coverage([gone], MODEL).indexed)).toEqual([gone]);
  });

  it('counts the other articles that have vectors', () => {
    const mine = addArticle('Meu', 'a.pdf');
    const other = addArticle('Outro', 'b.pdf');
    addArticle('Sem índice', 'c.pdf');
    indexWith(mine, MODEL);
    indexWith(other, null);

    expect(repo().indexedArticlesOutside([mine])).toBe(1);
    expect(repo().indexedArticlesOutside([mine, other])).toBe(0);
  });

  it('leaves out what is in the trash', () => {
    const trashed = addArticle('Na lixeira', 'a.pdf');
    adapter.getDB().prepare("UPDATE articles SET deleted_at = '2026-01-01' WHERE id = ?").run(trashed);

    expect(repo().coverage([trashed], MODEL).total).toBe(0);
    expect(repo().projectsArticleIds([projectId])).toEqual([]);
  });

  it('lists the articles of several projects, leaving out a project in the trash', () => {
    const mine = addArticle('Meu');
    const other = adapter.createProject('Outro').id;
    const insert = adapter.getDB().prepare("INSERT INTO articles (project_id, title) VALUES (?, 'Alheio')");
    const theirs = Number(insert.run(other).lastInsertRowid);
    expect(repo().projectsArticleIds([projectId, other])).toEqual([mine, theirs]);

    adapter.deleteProject(other);

    expect(repo().projectsArticleIds([projectId, other])).toEqual([mine]);
  });

  it('lists only the articles of the project', () => {
    const mine = addArticle('Meu');
    const otherProject = adapter.createProject('Outro').id;
    adapter.getDB().prepare("INSERT INTO articles (project_id, title) VALUES (?, 'Alheio')").run(otherProject);

    expect(repo().projectsArticleIds([projectId])).toEqual([mine]);
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
