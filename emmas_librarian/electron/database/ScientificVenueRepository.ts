import Database from 'better-sqlite3';
import { ScientificVenue, ScientificMilestone, MilestoneStatus } from '../types';

export class ScientificVenueRepository {
  constructor(private db: InstanceType<typeof Database>) {}

  getAllVenues(): ScientificVenue[] {
    const venuesStmt = this.db.prepare(
      'SELECT id, title, acronym, category, url, color, created_at FROM scientific_venues ORDER BY id DESC',
    );
    const venues = venuesStmt.all() as ScientificVenue[];

    const milestonesStmt = this.db.prepare(
      'SELECT id, venue_id, label, field_type, target_date, end_date, has_time, target_time, status FROM scientific_milestones WHERE venue_id = ? ORDER BY target_date ASC',
    );

    return venues.map((v) => {
      const rawMilestones = milestonesStmt.all(v.id) as Array<{
        id: number;
        venue_id: number;
        label: string;
        field_type: 'single' | 'range';
        target_date: string;
        end_date?: string;
        has_time: number;
        target_time?: string;
        status: MilestoneStatus;
      }>;

      const milestones: ScientificMilestone[] = rawMilestones.map((m) => ({
        id: m.id,
        venue_id: m.venue_id,
        label: m.label,
        field_type: m.field_type,
        target_date: m.target_date,
        end_date: m.end_date || undefined,
        has_time: Boolean(m.has_time),
        target_time: m.target_time || undefined,
        status: m.status,
      }));

      return { ...v, milestones };
    });
  }

  createVenue(venueData: Omit<ScientificVenue, 'id' | 'created_at'>): ScientificVenue {
    const insertVenue = this.db.prepare(
      'INSERT INTO scientific_venues (title, acronym, category, url, color) VALUES (?, ?, ?, ?, ?)',
    );
    const insertMilestone = this.db.prepare(
      'INSERT INTO scientific_milestones (venue_id, label, field_type, target_date, end_date, has_time, target_time, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    );

    const transaction = this.db.transaction(() => {
      const info = insertVenue.run(
        venueData.title,
        venueData.acronym || null,
        venueData.category || 'other',
        venueData.url || null,
        venueData.color || '#3b82f6',
      );
      const venueId = Number(info.lastInsertRowid);

      for (const m of venueData.milestones || []) {
        insertMilestone.run(
          venueId,
          m.label,
          m.field_type || 'single',
          m.target_date,
          m.end_date || null,
          m.has_time ? 1 : 0,
          m.target_time || null,
          m.status || 'pending',
        );
      }

      return venueId;
    });

    const newId = transaction();
    return this.getAllVenues().find((v) => v.id === newId)!;
  }

  updateVenue(id: number, venueData: Omit<ScientificVenue, 'id' | 'created_at'>): ScientificVenue {
    const updateVenueStmt = this.db.prepare(
      'UPDATE scientific_venues SET title = ?, acronym = ?, category = ?, url = ?, color = ? WHERE id = ?',
    );
    const deleteMilestonesStmt = this.db.prepare(
      'DELETE FROM scientific_milestones WHERE venue_id = ?',
    );
    const insertMilestoneStmt = this.db.prepare(
      'INSERT INTO scientific_milestones (venue_id, label, field_type, target_date, end_date, has_time, target_time, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    );

    const transaction = this.db.transaction(() => {
      updateVenueStmt.run(
        venueData.title,
        venueData.acronym || null,
        venueData.category || 'other',
        venueData.url || null,
        venueData.color || '#3b82f6',
        id,
      );

      deleteMilestonesStmt.run(id);

      for (const m of venueData.milestones || []) {
        insertMilestoneStmt.run(
          id,
          m.label,
          m.field_type || 'single',
          m.target_date,
          m.end_date || null,
          m.has_time ? 1 : 0,
          m.target_time || null,
          m.status || 'pending',
        );
      }
    });

    transaction();
    return this.getAllVenues().find((v) => v.id === id)!;
  }

  deleteVenue(id: number): boolean {
    const stmt = this.db.prepare('DELETE FROM scientific_venues WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  toggleMilestoneStatus(milestoneId: number, status: MilestoneStatus): boolean {
    const stmt = this.db.prepare('UPDATE scientific_milestones SET status = ? WHERE id = ?');
    const result = stmt.run(status, milestoneId);
    return result.changes > 0;
  }
}
