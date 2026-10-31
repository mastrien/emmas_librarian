import type Database from 'better-sqlite3';
import type { PrismaManualCount, PrismaManualKey } from '../../src/types';

const KEYS: readonly PrismaManualKey[] = ['other_sources'];
const MAX_VALUE = 1_000_000;

function requireKey(key: unknown): PrismaManualKey {
  if (KEYS.includes(key as PrismaManualKey)) return key as PrismaManualKey;
  throw new Error(
    `[ERR_INVALID_PRISMA] Offending value: key=${JSON.stringify(key)}. Expected shape: ${KEYS.join(' | ')}.`,
  );
}

function requireValue(value: unknown): number {
  if (Number.isInteger(value) && (value as number) >= 0 && (value as number) <= MAX_VALUE) return value as number;
  throw new Error(
    `[ERR_INVALID_PRISMA] Offending value: value=${JSON.stringify(value)}. Expected shape: whole number from 0 to ${MAX_VALUE}, or null to clear.`,
  );
}

/**
 * Numbers of a project's PRISMA diagram typed by hand (#50), such as records from sources outside the app.
 * Each keeps when it was last changed, so the diagram can say "editado manualmente em …".
 *
 * Usage:
 *   new PrismaManualRepository(db).setCount(projectId, 'other_sources', 2);
 */
export class PrismaManualRepository {
  constructor(private readonly db: Database.Database) {}

  /** The project's hand-typed numbers. */
  listCounts(projectId: number): PrismaManualCount[] {
    return this.db
      .prepare('SELECT count_key, value, updated_at FROM prisma_manual_counts WHERE project_id = ? ORDER BY count_key')
      .all(projectId) as PrismaManualCount[];
  }

  /** Sets a number, or clears it with null so the diagram goes back to what the app counts on its own. */
  setCount(projectId: number, key: PrismaManualKey, value: number | null): PrismaManualCount[] {
    const countKey = requireKey(key);
    if (value === null) {
      this.db
        .prepare('DELETE FROM prisma_manual_counts WHERE project_id = ? AND count_key = ?')
        .run(projectId, countKey);
      return this.listCounts(projectId);
    }
    this.db
      .prepare(
        `INSERT INTO prisma_manual_counts (project_id, count_key, value) VALUES (?, ?, ?)
         ON CONFLICT(project_id, count_key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`,
      )
      .run(projectId, countKey, requireValue(value));
    return this.listCounts(projectId);
  }
}
