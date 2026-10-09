// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { waitUntil } from '../waitUntil';

describe('waitUntil', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 9, 12, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('resolves at once when the condition already holds', async () => {
    const condition = vi.fn(() => true);

    await waitUntil(condition, 5000, 'nothing');

    expect(condition).toHaveBeenCalledTimes(1);
  });

  it('polls once per interval until the condition holds', async () => {
    let checks = 0;
    const waiting = waitUntil(() => ++checks === 3, 10000, 'the third check');

    await vi.advanceTimersByTimeAsync(2000);

    await expect(waiting).resolves.toBeUndefined();
    expect(checks).toBe(3);
  });

  it('rejects after the timeout, naming what it waited for', async () => {
    const waiting = waitUntil(() => false, 3000, 'the installer to reopen the app');
    const rejected = expect(waiting).rejects.toThrow(
      '[ERR_RELEASE_TEST_TIMEOUT] Waited 3000 ms for the installer to reopen the app.',
    );

    await vi.advanceTimersByTimeAsync(3000);

    await rejected;
  });

  it('does not reject before the timeout', async () => {
    let settled = false;
    waitUntil(() => false, 3000, 'never').catch(() => (settled = true));

    await vi.advanceTimersByTimeAsync(2000);

    expect(settled).toBe(false);
  });
});
