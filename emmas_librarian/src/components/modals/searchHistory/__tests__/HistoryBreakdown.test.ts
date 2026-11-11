import { describe, it, expect } from 'vitest';
import { overlapNote } from '../HistoryBreakdown';

describe('overlapNote', () => {
  it('says how many returned results the project did not keep as new (already in it, or from several bases)', () => {
    const breakdown = { openalex: { count: 20 }, scopus: { count: 20 }, wos: { count: 20 } };

    expect(overlapNote(breakdown, 46)).toBe('14 já estavam no projeto ou vieram de mais de uma base.');
  });

  it('says nothing when everything returned was saved', () => {
    expect(overlapNote({ openalex: { count: 5 } }, 5)).toBeNull();
  });

  it('does not count a base that failed', () => {
    expect(overlapNote({ openalex: { count: 5 }, scopus: { count: 0, error: 'HTTP 503' } }, 5)).toBeNull();
  });
});
