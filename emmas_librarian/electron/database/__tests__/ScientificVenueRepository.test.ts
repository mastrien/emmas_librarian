import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { ScientificVenueRepository } from '../ScientificVenueRepository';
import { ScientificVenue, ScientificMilestone } from '../../../src/types';

describe('ScientificVenueRepository (TDD)', () => {
  let db: InstanceType<typeof Database>;
  let repo: ScientificVenueRepository;

  beforeEach(() => {
    db = new Database(':memory:');
    db.exec(`
      CREATE TABLE IF NOT EXISTS scientific_venues (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        acronym TEXT,
        category TEXT DEFAULT 'other',
        url TEXT,
        color TEXT DEFAULT '#3b82f6',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS scientific_milestones (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        venue_id INTEGER NOT NULL,
        label TEXT NOT NULL,
        field_type TEXT DEFAULT 'single',
        target_date TEXT NOT NULL,
        end_date TEXT,
        has_time INTEGER DEFAULT 0,
        target_time TEXT,
        status TEXT DEFAULT 'pending',
        FOREIGN KEY (venue_id) REFERENCES scientific_venues(id) ON DELETE CASCADE
      );
    `);
    repo = new ScientificVenueRepository(db);
  });

  afterEach(() => {
    db.close();
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
