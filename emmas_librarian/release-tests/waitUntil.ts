/**
 * Polls `condition` every `intervalMs` until it holds, or rejects naming what it waited for. The release
 * tests' only way to follow processes they did not start (the installer, the app it reopens).
 *
 * Usage:
 *   await waitUntil(() => readUpdateState().status === 'verified', 5 * 60 * 1000, 'the first boot');
 */
export async function waitUntil(
  condition: () => boolean,
  timeoutMs: number,
  what: string,
  intervalMs = 1000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!condition()) {
    if (Date.now() >= deadline) throw new Error(`[ERR_RELEASE_TEST_TIMEOUT] Waited ${timeoutMs} ms for ${what}.`);
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}
