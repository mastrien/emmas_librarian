import { describe, it, expect, vi } from 'vitest';
import { IpcChannel } from '../../types';
import type { DatabaseAdapter } from '../../database/DatabaseAdapter';
import { registerPdfHandlers } from '../handlers/pdfHandlers';
import { FakeIpcMain } from './fakes/FakeIpcMain';

/** Named fake of the open access service: answers a fixed outcome and records the articles asked. */
class FakeOpenAccess {
  readonly asked: number[] = [];
  async fetchForArticle(articleId: number) {
    this.asked.push(articleId);
    return { status: 'downloaded' as const, source: 'arXiv' };
  }
}

describe('PDF_FETCH_OPEN_ACCESS', () => {
  it('asks the open access service for the article and returns its outcome', async () => {
    const ipc = new FakeIpcMain();
    const openAccess = new FakeOpenAccess();
    registerPdfHandlers(ipc, {} as DatabaseAdapter, openAccess);

    const outcome = await ipc.invoke(IpcChannel.PDF_FETCH_OPEN_ACCESS, 42);

    expect(outcome).toEqual({ status: 'downloaded', source: 'arXiv' });
    expect(openAccess.asked).toEqual([42]);
  });

  it('builds the real service when none is given', () => {
    const ipc = new FakeIpcMain();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    registerPdfHandlers(ipc, {} as DatabaseAdapter);

    expect(ipc.channels()).toContain(IpcChannel.PDF_FETCH_OPEN_ACCESS);
  });
});
