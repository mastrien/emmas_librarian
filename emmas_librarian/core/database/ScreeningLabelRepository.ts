import type Database from 'better-sqlite3';
import type { Article, ScreeningKind, ScreeningLabel, ScreeningLabelInput } from '../../src/types';
import { DEFAULT_LABELS, SCREENING_PRESETS, type PresetLabel } from '../../src/utils/screeningPresets';
import type { ScreeningDecisionRepository } from './ScreeningDecisionRepository';

const KINDS: readonly ScreeningKind[] = ['include', 'maybe', 'exclude', 'removed'];
const MAX_NAME = 80;

function cleanName(name: unknown): string {
  const trimmed = typeof name === 'string' ? name.trim() : '';
  if (trimmed && trimmed.length <= MAX_NAME) return trimmed;
  throw new Error(
    `[ERR_INVALID_LABEL] Offending value: ${JSON.stringify(name)}. Expected shape: non-empty text up to ${MAX_NAME} characters.`,
  );
}

function requireKind(kind: unknown): ScreeningKind {
  if (KINDS.includes(kind as ScreeningKind)) return kind as ScreeningKind;
  throw new Error(
    `[ERR_INVALID_LABEL] Offending value: ${JSON.stringify(kind)}. Expected shape: ${KINDS.join(' | ')}.`,
  );
}

/**
 * A project's screening labels (#49): the defaults a project starts with, the ones the person creates, their
 * order, and the presets (PRISMA 2020). Renaming or deleting a label keeps the archived articles in step,
 * through the decision repository.
 *
 * Usage:
 *   const labels = new ScreeningLabelRepository(db, decisions).listLabels(projectId);
 */
export class ScreeningLabelRepository {
  constructor(
    private readonly db: Database.Database,
    private readonly decisions: ScreeningDecisionRepository,
  ) {}

  /** The project's labels in order. A project that never had labels gets the defaults first. */
  listLabels(projectId: number): ScreeningLabel[] {
    if (this.countLabels(projectId) === 0) this.addMissing(projectId, DEFAULT_LABELS);
    return this.db
      .prepare('SELECT * FROM screening_labels WHERE project_id = ? ORDER BY position, id')
      .all(projectId) as ScreeningLabel[];
  }

  /** Adds a label at the end of the list and returns it. */
  createLabel(projectId: number, input: ScreeningLabelInput): ScreeningLabel {
    const id = this.insert(projectId, cleanName(input?.name), requireKind(input?.kind), null);
    return this.getLabel(id)!;
  }

  /** Renames a label; the articles it archived get the new name as their reason. */
  renameLabel(labelId: number, name: string): ScreeningLabel {
    const label = this.requireLabel(labelId);
    this.db.prepare('UPDATE screening_labels SET name = ? WHERE id = ?').run(cleanName(name), label.id);
    this.decisions.refreshArchiveNotes(label.id);
    return this.getLabel(label.id)!;
  }

  /** Swaps a label with its neighbour of the same kind, one step up (-1) or down (1). */
  moveLabel(labelId: number, step: -1 | 1): void {
    const label = this.requireLabel(labelId);
    const sameKind = this.listLabels(label.project_id).filter((l) => l.kind === label.kind);
    const neighbour = sameKind[sameKind.findIndex((l) => l.id === label.id) + step];
    if (!neighbour) return;
    const setPosition = this.db.prepare('UPDATE screening_labels SET position = ? WHERE id = ?');
    this.db.transaction(() => {
      setPosition.run(neighbour.position, label.id);
      setPosition.run(label.position, neighbour.id);
    })();
  }

  /**
   * Deletes a label. Its decisions move to `moveTo` (a label of the same project and kind) or are taken back,
   * which brings back the articles the label had archived.
   */
  deleteLabel(labelId: number, moveTo: number | null): void {
    const label = this.requireLabel(labelId);
    const target = moveTo === null ? null : this.requireTarget(label, moveTo);
    const articleIds = this.articlesOf(label.id);
    const before = new Map(articleIds.map((id) => [id, this.decisions.statusBefore(id)]));
    this.db.transaction(() => {
      if (target)
        this.db.prepare('UPDATE screening_decisions SET label_id = ? WHERE label_id = ?').run(target.id, label.id);
      // Explicit, not left to ON DELETE CASCADE, so it holds even on a connection without foreign keys.
      this.db.prepare('DELETE FROM screening_decisions WHERE label_id = ?').run(label.id);
      this.db.prepare('DELETE FROM screening_labels WHERE id = ?').run(label.id);
      this.decisions.resync(articleIds, before);
    })();
  }

  /** Creates the preset's labels the project does not have yet (found by preset key) and returns the list. */
  applyPreset(projectId: number, presetKey: string): ScreeningLabel[] {
    const preset = SCREENING_PRESETS[presetKey];
    if (!preset) {
      throw new Error(
        `[ERR_INVALID_PRESET] Offending value: ${JSON.stringify(presetKey)}. Expected shape: ${Object.keys(SCREENING_PRESETS).join(' | ')}.`,
      );
    }
    this.addMissing(projectId, preset);
    return this.listLabels(projectId);
  }

  private addMissing(projectId: number, labels: readonly PresetLabel[]): void {
    const known = this.db.prepare('SELECT 1 FROM screening_labels WHERE project_id = ? AND preset_key = ?');
    this.db.transaction(() => {
      for (const label of labels) {
        if (!known.get(projectId, label.key)) this.insert(projectId, label.name, label.kind, label.key);
      }
    })();
  }

  private insert(projectId: number, name: string, kind: ScreeningKind, presetKey: string | null): number {
    const { next } = this.db
      .prepare('SELECT COALESCE(MAX(position), -1) + 1 AS next FROM screening_labels WHERE project_id = ?')
      .get(projectId) as { next: number };
    const sql = 'INSERT INTO screening_labels (project_id, name, kind, position, preset_key) VALUES (?, ?, ?, ?, ?)';
    return Number(this.db.prepare(sql).run(projectId, name, kind, next, presetKey).lastInsertRowid);
  }

  private requireTarget(label: ScreeningLabel, moveTo: number): ScreeningLabel {
    const target = this.getLabel(moveTo);
    if (target && target.id !== label.id && target.project_id === label.project_id && target.kind === label.kind) {
      return target;
    }
    throw new Error(
      `[ERR_INVALID_LABEL] Offending value: moveTo=${moveTo}. Expected shape: another label of project ${label.project_id} with kind '${label.kind}'.`,
    );
  }

  private requireLabel(labelId: number): ScreeningLabel {
    const label = this.getLabel(labelId);
    if (label) return label;
    throw new Error(
      `[ERR_INVALID_LABEL] Offending value: labelId=${labelId}. Expected shape: id of an existing label.`,
    );
  }

  private getLabel(labelId: number): ScreeningLabel | null {
    const row = this.db.prepare('SELECT * FROM screening_labels WHERE id = ?').get(labelId);
    return (row as ScreeningLabel | undefined) ?? null;
  }

  private countLabels(projectId: number): number {
    const row = this.db.prepare('SELECT COUNT(*) AS n FROM screening_labels WHERE project_id = ?').get(projectId);
    return (row as { n: number }).n;
  }

  private articlesOf(labelId: number): number[] {
    const rows = this.db.prepare('SELECT DISTINCT article_id FROM screening_decisions WHERE label_id = ?').all(labelId);
    return (rows as { article_id: Article['id'] }[]).map((r) => r.article_id);
  }
}
