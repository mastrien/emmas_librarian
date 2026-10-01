import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchHttpClient } from '../httpClient';

afterEach(() => {
  vi.unstubAllGlobals();
});

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
});
