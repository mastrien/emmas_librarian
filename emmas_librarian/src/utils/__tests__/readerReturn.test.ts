import { describe, it, expect } from 'vitest';
import { readerBackFrom, readerStateBackTo } from '../readerReturn';

describe('readerReturn', () => {
  it('reads back the page the reader was opened from', () => {
    const back = { path: '/projects/3/review/guided', label: 'Voltar à triagem guiada' };

    expect(readerBackFrom(readerStateBackTo(back))).toEqual(back);
  });

  it.each([
    [null],
    [{}],
    [{ backTo: { path: 'https://example.org', label: 'x' } }],
    [{ backTo: { path: '/settings', label: 'x' } }],
    [{ backTo: { path: '/projects/3/review', label: '  ' } }],
    [{ backTo: { path: '/projects/3/../x', label: 'x' } }],
  ])('ignores %j, which could send the reader elsewhere', (state) => {
    expect(readerBackFrom(state)).toBeNull();
  });
});
