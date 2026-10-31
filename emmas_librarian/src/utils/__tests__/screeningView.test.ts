import { describe, it, expect } from 'vitest';
import { buildReview, currentDecisions, decisionAt, guidedPool, listStage } from '../screeningView';
import { archiveNoteFor, isOutKind } from '../screeningPresets';
import type { Article, ScreeningDecision, ScreeningKind, ScreeningLabel, ScreeningStage } from '../../types';

const label = (id: number, name: string, kind: ScreeningKind): ScreeningLabel => ({
  id,
  project_id: 1,
  name,
  kind,
  position: id,
  preset_key: null,
  created_at: '',
});
const LABELS = [
  label(1, 'Incluso', 'include'),
  label(2, 'Em dúvida', 'maybe'),
  label(3, 'Fora do escopo', 'exclude'),
  label(4, 'Duplicado', 'removed'),
  label(5, 'Conjunto de dados', 'include'),
];
const article = (id: number, status: Article['status'] = 'new'): Article =>
  ({ id, project_id: 1, title: `A${id}`, status }) as Article;
const decision = (articleId: number, labelId: number, stage: ScreeningStage = 'title'): ScreeningDecision => ({
  id: articleId * 10 + (stage === 'full' ? 1 : 0),
  article_id: articleId,
  label_id: labelId,
  stage,
  note: null,
  status_before: null,
  decided_at: '',
});

describe('currentDecisions and listStage (#49)', () => {
  it('takes the full-text decision over the title one, whatever their order', () => {
    const current = currentDecisions([decision(1, 1, 'full'), decision(1, 3, 'title')]);

    expect(current.get(1)?.label_id).toBe(1);
  });

  it('sends a decision from the list to full text only once the article has one there', () => {
    const decisions = [decision(1, 1, 'title'), decision(2, 1, 'full')];

    expect([listStage(1, decisions), listStage(2, decisions), listStage(3, decisions)]).toEqual([
      'title',
      'full',
      'title',
    ]);
  });

  it('finds the decision at exactly one stage', () => {
    expect(decisionAt([decision(1, 1, 'title')], 1, 'full')).toBeNull();
  });
});

describe('buildReview (#49)', () => {
  const articles = [article(1), article(2, 'read'), article(3, 'archived'), article(4, 'archived'), article(5)];
  const view = buildReview(articles, LABELS, [decision(1, 5), decision(2, 2), decision(3, 4), decision(5, 1)]);

  it('makes a section per inclusion or doubt label that has articles, in label order', () => {
    expect(view.sections.map((s) => [s.label.name, s.rows.map((r) => r.article.id)])).toEqual([
      ['Incluso', [5]],
      ['Em dúvida', [2]],
      ['Conjunto de dados', [1]],
    ]);
  });

  it('groups exclusions by label with duplicates last, and keeps hand-archived articles apart', () => {
    expect(view.excluded.map((g) => g.label.name)).toEqual(['Duplicado']);
    expect(view.unlabeled.map((r) => r.article.id)).toEqual([4]);
  });

  it('counts each kind, the undecided and the hand-archived articles', () => {
    expect(view.counts).toEqual({ include: 2, maybe: 1, exclude: 0, removed: 1, pending: 0, unlabeled: 1 });
  });

  it('lists an undecided article as pending even when it was read', () => {
    const pending = buildReview([article(7, 'read')], LABELS, []).pending;

    expect(pending.map((r) => r.article.id)).toEqual([7]);
  });
});

describe('guidedPool (#49)', () => {
  const articles = [article(1), article(2), article(3, 'archived'), article(4, 'archived')];
  const decisions = [decision(1, 1), decision(2, 3), decision(3, 3)];

  it('walks every article but those archived by hand at title and abstract', () => {
    expect(guidedPool(articles, LABELS, decisions, 'title').map((a) => a.id)).toEqual([1, 2, 3]);
  });

  it('walks only the articles kept at title and abstract at full text', () => {
    const withDoubt = [...decisions, decision(4, 2)];

    expect(guidedPool(articles, LABELS, withDoubt, 'full').map((a) => a.id)).toEqual([1, 4]);
  });
});

describe('screening presets helpers (#49)', () => {
  it('writes the archive note as the label, then the note', () => {
    expect([archiveNoteFor('Fora do escopo', 'só radar'), archiveNoteFor('Duplicado', null)]).toEqual([
      'Fora do escopo · só radar',
      'Duplicado',
    ]);
  });

  it('takes exclusions and removals out of the review, not inclusions or doubts', () => {
    expect((['include', 'maybe', 'exclude', 'removed'] as ScreeningKind[]).map(isOutKind)).toEqual([
      false,
      false,
      true,
      true,
    ]);
  });
});
