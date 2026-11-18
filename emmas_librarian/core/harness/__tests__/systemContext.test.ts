import { describe, it, expect } from 'vitest';
import { isoDay, systemContext } from '../systemContext';

const sunday = new Date(2026, 10, 15, 23, 59);

describe('systemContext', () => {
  it('gives the weekday and the date the diary uses', () => {
    expect(isoDay(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(systemContext({ today: sunday })).toContain('Hoje é domingo, 2026-11-15.');
  });

  it('names the project in focus with its id', () => {
    const text = systemContext({ today: sunday, focusProject: { id: 1, name: 'Revisão sobre tutoria' } });
    expect(text).toContain('Projeto em foco: "Revisão sobre tutoria" (id 1).');
  });

  it('tells the model to ask when no project is in focus', () => {
    expect(systemContext({ today: sunday })).toContain('Nenhum projeto em foco');
  });
});
