import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ScientificVenueRepository } from '../ScientificVenueRepository';
import { ScientificVenue, MilestoneStatus } from '../../types';

// ---------------------------------------------------------------------------
// In-memory table rows
// ---------------------------------------------------------------------------

interface VenueRow {
  id: number;
  title: string;
  acronym: string | null;
  category: string;
  url: string | null;
  color: string;
  created_at: string;
}

interface MilestoneRow {
  id: number;
  venue_id: number;
  label: string;
  field_type: string;
  target_date: string;
  end_date: string | null;
  has_time: number;
  target_time: string | null;
  status: string;
}

interface RunResult {
  changes: number;
  lastInsertRowid: number;
}

// ---------------------------------------------------------------------------
// Fake statement returned by db.prepare(sql)
// ---------------------------------------------------------------------------

interface FakeStatement {
  run: (...args: unknown[]) => RunResult;
  all: (...args: unknown[]) => unknown[];
}

// ---------------------------------------------------------------------------
// Factory: builds a mock db backed by two arrays
// ---------------------------------------------------------------------------

function createMockDatabase() {
  let venues: VenueRow[] = [];
  let milestones: MilestoneRow[] = [];
  let venueAutoId = 0;
  let milestoneAutoId = 0;

  /** Route an SQL string to the right fake statement. */
  function buildStatement(sql: string): FakeStatement {
    const normalised = sql.replace(/\s+/g, ' ').trim();

    // -- INSERT venue ---------------------------------------------------
    if (normalised.startsWith('INSERT INTO scientific_venues')) {
      return {
        run: (...args: unknown[]): RunResult => {
          venueAutoId += 1;
          venues.push({
            id: venueAutoId,
            title: args[0] as string,
            acronym: args[1] as string | null,
            category: (args[2] as string) ?? 'other',
            url: args[3] as string | null,
            color: (args[4] as string) ?? '#3b82f6',
            created_at: new Date().toISOString(),
          });
          return { changes: 1, lastInsertRowid: venueAutoId };
        },
        all: () => [],
      };
    }

    // -- INSERT milestone -----------------------------------------------
    if (normalised.startsWith('INSERT INTO scientific_milestones')) {
      return {
        run: (...args: unknown[]): RunResult => {
          milestoneAutoId += 1;
          milestones.push({
            id: milestoneAutoId,
            venue_id: args[0] as number,
            label: args[1] as string,
            field_type: (args[2] as string) ?? 'single',
            target_date: args[3] as string,
            end_date: args[4] as string | null,
            has_time: args[5] as number,
            target_time: args[6] as string | null,
            status: (args[7] as string) ?? 'pending',
          });
          return { changes: 1, lastInsertRowid: milestoneAutoId };
        },
        all: () => [],
      };
    }

    // -- SELECT venues --------------------------------------------------
    if (normalised.startsWith('SELECT') && normalised.includes('FROM scientific_venues')) {
      return {
        run: () => ({ changes: 0, lastInsertRowid: 0 }),
        all: () => [...venues].reverse(),
      };
    }

    // -- SELECT milestones for a venue ----------------------------------
    if (normalised.startsWith('SELECT') && normalised.includes('FROM scientific_milestones')) {
      return {
        run: () => ({ changes: 0, lastInsertRowid: 0 }),
        all: (...args: unknown[]) => {
          const venueId = args[0] as number;
          return milestones
            .filter((m) => m.venue_id === venueId)
            .sort((a, b) => a.target_date.localeCompare(b.target_date));
        },
      };
    }

    // -- UPDATE venue ---------------------------------------------------
    if (normalised.startsWith('UPDATE scientific_venues')) {
      return {
        run: (...args: unknown[]): RunResult => {
          const id = args[5] as number;
          const idx = venues.findIndex((v) => v.id === id);
          if (idx === -1) return { changes: 0, lastInsertRowid: 0 };
          venues[idx] = {
            ...venues[idx],
            title: args[0] as string,
            acronym: args[1] as string | null,
            category: (args[2] as string) ?? 'other',
            url: args[3] as string | null,
            color: (args[4] as string) ?? '#3b82f6',
          };
          return { changes: 1, lastInsertRowid: id };
        },
        all: () => [],
      };
    }

    // -- UPDATE milestone status ----------------------------------------
    if (normalised.startsWith('UPDATE scientific_milestones')) {
      return {
        run: (...args: unknown[]): RunResult => {
          const status = args[0] as string;
          const mId = args[1] as number;
          const idx = milestones.findIndex((m) => m.id === mId);
          if (idx === -1) return { changes: 0, lastInsertRowid: 0 };
          milestones[idx] = { ...milestones[idx], status };
          return { changes: 1, lastInsertRowid: mId };
        },
        all: () => [],
      };
    }

    // -- DELETE milestones for a venue ----------------------------------
    if (normalised.startsWith('DELETE FROM scientific_milestones')) {
      return {
        run: (...args: unknown[]): RunResult => {
          const venueId = args[0] as number;
          const before = milestones.length;
          milestones = milestones.filter((m) => m.venue_id !== venueId);
          return { changes: before - milestones.length, lastInsertRowid: 0 };
        },
        all: () => [],
      };
    }

    // -- DELETE venue ----------------------------------------------------
    if (normalised.startsWith('DELETE FROM scientific_venues')) {
      return {
        run: (...args: unknown[]): RunResult => {
          const id = args[0] as number;
          const before = venues.length;
          venues = venues.filter((v) => v.id !== id);
          // Cascade: also remove milestones for this venue
          milestones = milestones.filter((m) => m.venue_id !== id);
          return { changes: before - venues.length, lastInsertRowid: 0 };
        },
        all: () => [],
      };
    }

    throw new Error(`Unhandled SQL in mock: ${sql}`);
  }

  const mockDb = {
    prepare: vi.fn().mockImplementation((sql: string) => buildStatement(sql)),
    transaction: vi.fn().mockImplementation((cb: Function) => {
      // better-sqlite3's transaction() returns a callable wrapper
      const wrapper = (...args: unknown[]) => cb(...args);
      return wrapper;
    }),
  };

  return mockDb;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ScientificVenueRepository (mocked)', () => {
  let repo: ScientificVenueRepository;

  beforeEach(() => {
    const db = createMockDatabase();
    // The constructor expects InstanceType<typeof Database> — the mock
    // satisfies the structural contract (prepare + transaction).
    repo = new ScientificVenueRepository(db as never);
  });

  it('creates a new venue with milestones', () => {
    const venueData: Omit<ScientificVenue, 'id' | 'created_at'> = {
      title: 'Simpósio de Banco de Dados',
      acronym: 'SBBD 2026',
      category: 'conference',
      url: 'https://sbbd.org',
      color: '#3b82f6',
      milestones: [
        {
          label: 'Submissão',
          field_type: 'range',
          target_date: '2026-08-01',
          end_date: '2026-08-15',
          has_time: false,
          status: 'pending',
        },
        {
          label: 'Apresentação',
          field_type: 'single',
          target_date: '2026-10-10',
          has_time: true,
          target_time: '14:00',
          status: 'pending',
        },
      ],
    };

    const created = repo.createVenue(venueData);
    expect(created.id).toBeGreaterThan(0);
    expect(created.title).toBe('Simpósio de Banco de Dados');
    expect(created.milestones).toHaveLength(2);
    expect(created.milestones[0].label).toBe('Submissão');
    expect(created.milestones[0].end_date).toBe('2026-08-15');
  });

  it('retrieves all venues with their milestones', () => {
    const venue = repo.createVenue({
      title: 'Revista de Computação',
      acronym: 'RITA',
      category: 'journal',
      color: '#10b981',
      milestones: [
        {
          label: 'Inscrição',
          field_type: 'single',
          target_date: '2026-09-01',
          has_time: false,
          status: 'pending',
        },
      ],
    });

    const all = repo.getAllVenues();
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe(venue.id);
    expect(all[0].milestones).toHaveLength(1);
  });

  it('updates a venue and replaces milestones', () => {
    const created = repo.createVenue({
      title: 'Original Title',
      category: 'workshop',
      milestones: [
        {
          label: 'Prazo 1',
          field_type: 'single',
          target_date: '2026-05-01',
          has_time: false,
          status: 'pending',
        },
      ],
    });

    const updated = repo.updateVenue(created.id, {
      title: 'Updated Title',
      category: 'symposium',
      milestones: [
        {
          label: 'Novo Prazo',
          field_type: 'range',
          target_date: '2026-06-01',
          end_date: '2026-06-10',
          has_time: false,
          status: 'pending',
        },
      ],
    });

    expect(updated.title).toBe('Updated Title');
    expect(updated.milestones[0].label).toBe('Novo Prazo');
  });

  it('toggles milestone status between pending and completed', () => {
    const created = repo.createVenue({
      title: 'Evento Teste',
      category: 'other',
      milestones: [
        {
          label: 'Submissão',
          field_type: 'single',
          target_date: '2026-07-01',
          has_time: false,
          status: 'pending',
        },
      ],
    });

    const milestoneId = created.milestones[0].id!;
    const toggled = repo.toggleMilestoneStatus(milestoneId, 'completed');
    expect(toggled).toBe(true);

    const venues = repo.getAllVenues();
    expect(venues[0].milestones[0].status).toBe('completed');
  });

  it('deletes a venue and its cascaded milestones', () => {
    const created = repo.createVenue({
      title: 'Evento a Deletar',
      category: 'other',
      milestones: [
        {
          label: 'Prazo',
          field_type: 'single',
          target_date: '2026-07-01',
          has_time: false,
          status: 'pending',
        },
      ],
    });

    const success = repo.deleteVenue(created.id);
    expect(success).toBe(true);
    expect(repo.getAllVenues()).toHaveLength(0);
  });
});
