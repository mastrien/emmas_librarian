import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { ServicesProvider } from '../../../../contexts/ServicesContext';
import { FakeProjectService } from '../../../../services/__tests__/fakes/FakeProjectService';
import { useDiaryPageSave } from '../useDiaryPageSave';

// A database that holds what was last written and answers each write only when the test lets it.
class SlowDiary extends FakeProjectService {
  stored = 'T0';
  private releases: Array<() => void> = [];
  conflicts: string[] = [];

  constructor() {
    super();
    this.saveDiaryEntry.mockImplementation(
      async (_project: number, _date: string, text: string, expected?: string | null) => {
        await new Promise<void>((resolve) => this.releases.push(resolve));
        if (expected !== undefined && expected !== null && expected !== this.stored) {
          this.conflicts.push(`expected ${expected}, found ${this.stored}`);
          throw Object.assign(new Error('ERR_DIARY_CONFLICT'), { code: 'ERR_DIARY_CONFLICT' });
        }
        this.stored = text;
      },
    );
  }

  /** Lets the oldest write that is waiting finish. */
  async finishOne() {
    await act(async () => {
      this.releases.shift()?.();
      await Promise.resolve();
    });
  }
}

function renderSave(service: SlowDiary) {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <ServicesProvider apiService={service}>{children}</ServicesProvider>
  );
  return renderHook(
    () => useDiaryPageSave({ projectId: 1, date: '2026-11-13', initialContent: 'T0', onSaved: vi.fn(), delayMs: 10 }),
    { wrapper },
  );
}

describe('useDiaryPageSave writes in order (review of PR #187)', () => {
  it('waits for a write in flight before the next one, which then expects what the first wrote', async () => {
    const service = new SlowDiary();
    const { result } = renderSave(service);

    act(() => result.current.change('T1'));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 30));
    });
    expect(service.saveDiaryEntry).toHaveBeenCalledTimes(1);
    act(() => result.current.change('T2'));
    let flushing: Promise<void> = Promise.resolve();
    act(() => {
      flushing = result.current.flush();
    });
    // The second write is not sent while the first is still in flight: it would carry the old baseline.
    expect(service.saveDiaryEntry).toHaveBeenCalledTimes(1);
    await service.finishOne();
    await service.finishOne();
    await act(async () => flushing);

    expect(service.saveDiaryEntry).toHaveBeenCalledTimes(2);
    expect(service.saveDiaryEntry).toHaveBeenLastCalledWith(1, '2026-11-13', 'T2', 'T1');
    expect(service.conflicts).toEqual([]);
    expect(result.current.status.problem).toBeNull();
    expect(service.stored).toBe('T2');
  });

  it('writes the text still waiting when the page is left, after the write in flight', async () => {
    const service = new SlowDiary();
    const { result, unmount } = renderSave(service);
    act(() => result.current.change('T1'));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 30));
    });
    act(() => result.current.change('T2'));

    unmount();
    await service.finishOne();
    await service.finishOne();

    expect(service.conflicts).toEqual([]);
    expect(service.stored).toBe('T2');
  });
});
