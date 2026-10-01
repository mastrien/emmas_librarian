import { describe, it, expect, vi, afterEach } from 'vitest';
import { BODY_TIMEOUT_MS, RESPONSE_TIMEOUT_MS, fetchHttpClient } from '../httpClient';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const signalOf = (fetchSpy: ReturnType<typeof vi.fn>) =>
  (fetchSpy.mock.calls[0] as unknown as [string, RequestInit])[1].signal as AbortSignal;

describe('fetchHttpClient', () => {
  it('asks with the app user agent, follows redirects and exposes status, headers and body', async () => {
    const fetchSpy = vi.fn(async () => new Response('{"a":1}', { status: 200, headers: { 'Content-Length': '7' } }));
    vi.stubGlobal('fetch', fetchSpy);

    const response = await fetchHttpClient.get('https://example.org/x', { Accept: 'application/pdf' });

    const [url, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://example.org/x');
    expect(init.redirect).toBe('follow');
    expect(init.headers).toMatchObject({
      Accept: 'application/pdf',
      'User-Agent': expect.stringContaining('EmmasLibrarian'),
    });
    expect([response.status, response.ok, response.header('Content-Length')]).toEqual([200, true, '7']);
    expect(await response.json()).toEqual({ a: 1 });
  });

  it('reads the body as text or bytes', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('%PDF-')),
    );
    const asText = await (await fetchHttpClient.get('https://example.org/a')).text();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('%PDF-')),
    );
    const asBytes = await (await fetchHttpClient.get('https://example.org/b')).bytes();

    expect([asText, asBytes.toString()]).toEqual(['%PDF-', '%PDF-']);
  });

  it('gives up on a server that does not answer within the response deadline', async () => {
    vi.useFakeTimers();
    const fetchSpy = vi.fn(() => new Promise<Response>(() => {}));
    vi.stubGlobal('fetch', fetchSpy);

    void fetchHttpClient.get('https://example.org/slow');
    vi.advanceTimersByTime(RESPONSE_TIMEOUT_MS);

    expect(signalOf(fetchSpy).aborted).toBe(true);
  });

  // Regression: a 30 s limit on the whole request cut off an 11.6 MB Copernicus PDF that took 35 s.
  it('lets a body that started arriving take longer than the response deadline, up to the body deadline', async () => {
    vi.useFakeTimers();
    const fetchSpy = vi.fn(async () => new Response('%PDF-'));
    vi.stubGlobal('fetch', fetchSpy);

    await fetchHttpClient.get('https://example.org/big.pdf');
    vi.advanceTimersByTime(RESPONSE_TIMEOUT_MS + 5000);
    expect(signalOf(fetchSpy).aborted).toBe(false);

    vi.advanceTimersByTime(BODY_TIMEOUT_MS);
    expect(signalOf(fetchSpy).aborted).toBe(true);
  });

  it('drops the deadline once the body is read or the request fails', async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('ok')),
    );
    await (await fetchHttpClient.get('https://example.org/a')).text();
    expect(vi.getTimerCount()).toBe(0);

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Promise.reject(new Error('offline'))),
    );
    await expect(fetchHttpClient.get('https://example.org/b')).rejects.toThrow('offline');
    expect(vi.getTimerCount()).toBe(0);
  });
});
