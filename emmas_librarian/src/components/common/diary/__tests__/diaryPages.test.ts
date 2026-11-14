import { describe, expect, it } from 'vitest';
import { diaryDayMonth, diaryPageSummary, groupDiaryPages } from '../diaryPages';
import type { DiaryEntry } from '../../../../types';

const page = (entry_date: string, content = ''): DiaryEntry => ({ id: 0, project_id: 1, entry_date, content });

describe('diaryPageSummary', () => {
  it('names a page by its first line without the markdown marks', () => {
    expect(diaryPageSummary('## Critérios de inclusão, versão 2\n\nTexto')).toBe('Critérios de inclusão, versão 2');
    expect(diaryPageSummary('\n- [ ] **Rever** os lidos')).toBe('Rever os lidos');
  });

  it('calls an empty page so and cuts a long first line', () => {
    expect(diaryPageSummary('  \n')).toBe('Página vazia');
    expect(diaryPageSummary('a'.repeat(80))).toHaveLength(60);
  });
});

describe('groupDiaryPages', () => {
  it('lists the newest first, by month, with the year only for past years', () => {
    const months = groupDiaryPages(
      [page('2026-08-07'), page('2026-11-05'), page('2025-08-30'), page('2026-11-08')],
      '2026-11-09',
    );

    expect(months.map((m) => [m.label, m.entries.map((e) => e.entry_date)])).toEqual([
      ['Novembro', ['2026-11-08', '2026-11-05']],
      ['Agosto', ['2026-08-07']],
      ['Agosto de 2025', ['2025-08-30']],
    ]);
  });
});

describe('diaryDayMonth', () => {
  it('writes day and month', () => {
    expect(diaryDayMonth('2026-11-05')).toBe('05/11');
  });
});
