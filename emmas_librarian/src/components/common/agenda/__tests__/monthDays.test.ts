import { describe, it, expect } from 'vitest';
import type { ScientificVenue } from '../../../../types';
import { chipsByDay, monthCells } from '../monthDays';

const VENUE: ScientificVenue = {
  id: 1,
  title: 'Simpósio Brasileiro de Sensoriamento Remoto',
  acronym: 'SBSR',
  category: 'symposium',
  color: '#f472b6',
  milestones: [
    {
      id: 1,
      label: 'Evento',
      field_type: 'range',
      target_date: '2025-04-06',
      end_date: '2025-04-09',
      has_time: false,
      status: 'pending',
    },
    {
      id: 2,
      label: 'Submissão',
      field_type: 'single',
      target_date: '2025-03-10',
      has_time: false,
      status: 'completed',
    },
  ],
};

describe('month grid (Arca 134, board 172)', () => {
  it('fills whole weeks from Sunday: five for April 2025, six for August 2025', () => {
    const april = monthCells(2025, 3);
    expect(april).toHaveLength(35);
    expect(april[0]).toMatchObject({ iso: '2025-03-30', day: 30, outside: true });
    expect(april[2]).toMatchObject({ iso: '2025-04-01', outside: false });
    expect(april[34]).toMatchObject({ iso: '2025-05-03', outside: true });
    expect(monthCells(2025, 7)).toHaveLength(42);
  });

  it('puts a chip on each day of a range, naming the deadline only on the first', () => {
    const chips = chipsByDay([VENUE]);
    expect(chips.get('2025-04-06')?.[0].text).toBe('SBSR · Evento');
    expect(chips.get('2025-04-07')?.[0].text).toBe('SBSR');
    expect(chips.get('2025-04-09')?.[0].text).toBe('SBSR');
    expect(chips.get('2025-04-10')).toBeUndefined();
  });

  it('keeps the venue colour and marks done deadlines', () => {
    const chips = chipsByDay([VENUE]);
    expect(chips.get('2025-03-10')?.[0]).toMatchObject({ color: '#f472b6', done: true });
  });

  it('draws a runaway range on its first days only', () => {
    const runaway = { ...VENUE, milestones: [{ ...VENUE.milestones[0], end_date: '2099-01-01' }] };
    expect(chipsByDay([runaway]).size).toBe(62);
  });
});
