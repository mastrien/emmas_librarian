import type { DiaryEntry } from '../../../types';

// The page list of the diary (redesign, board 155): pages grouped by month, each named by its first line.

const MAX_SUMMARY = 60;

/**
 * The first line of a page without its markdown marks ("#", "-", "[ ]", "**"), as the page's name in the list.
 *
 * @example diaryPageSummary('## Critérios de inclusão\n\nTexto') // 'Critérios de inclusão'
 */
export function diaryPageSummary(markdown: string): string {
  const line = markdown
    .split('\n')
    .map((l) =>
      l
        .replace(/^\s*(#{1,6}\s+|[-*+]\s+(\[[ xX]\]\s+)?|\d+\.\s+|>\s*)/, '')
        .replace(/[*_`]/g, '')
        .trim(),
    )
    .find(Boolean);
  if (!line) return 'Página vazia';
  return line.length > MAX_SUMMARY ? `${line.slice(0, MAX_SUMMARY - 1)}…` : line;
}

export interface DiaryMonth {
  label: string;
  entries: DiaryEntry[];
}

const monthLabel = (isoDay: string, todayYear: string): string => {
  const [y, m] = isoDay.split('-');
  const name = new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('pt-BR', { month: 'long' });
  const capitalized = name.charAt(0).toUpperCase() + name.slice(1);
  return y === todayYear ? capitalized : `${capitalized} de ${y}`;
};

/**
 * The pages newest first, grouped under their month; the year shows only for past years.
 *
 * @example groupDiaryPages(entries, '2026-11-09') // [{ label: 'Novembro', entries: [...] }, { label: 'Agosto de 2025', ... }]
 */
export function groupDiaryPages(entries: DiaryEntry[], today: string): DiaryMonth[] {
  const sorted = [...entries].sort((a, b) => b.entry_date.localeCompare(a.entry_date));
  const months: DiaryMonth[] = [];
  for (const entry of sorted) {
    const label = monthLabel(entry.entry_date, today.slice(0, 4));
    const last = months[months.length - 1];
    if (last?.label === label) last.entries.push(entry);
    else months.push({ label, entries: [entry] });
  }
  return months;
}

/**
 * "05/11" for the page list.
 *
 * @example diaryDayMonth('2026-11-05') // '05/11'
 */
export function diaryDayMonth(isoDay: string): string {
  const [, m, d] = isoDay.split('-');
  return `${d}/${m}`;
}
