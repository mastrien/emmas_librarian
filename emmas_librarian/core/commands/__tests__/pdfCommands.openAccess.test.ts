import { describe, it, expect, vi } from 'vitest';
import { IpcChannel } from '../../../src/types';
import type { DatabaseAdapter } from '../../database/DatabaseAdapter';
import { registerPdfCommands } from '../pdfCommands';
import { LibraryStorage } from '../../services/LibraryStorage';
import { appPathsIn } from '../../ports/AppPaths';
import { CommandRegistry } from '../CommandRegistry';

const db = {} as DatabaseAdapter;
const storage = new LibraryStorage(db, appPathsIn('/userdata'));

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
    const commands = new CommandRegistry();
    const openAccess = new FakeOpenAccess();
    registerPdfCommands(commands, db, storage, openAccess);

    const outcome = await commands.run(IpcChannel.PDF_FETCH_OPEN_ACCESS, 42);

    expect(outcome).toEqual({ status: 'downloaded', source: 'arXiv' });
    expect(openAccess.asked).toEqual([42]);
  });

  it('builds the real service when none is given', () => {
    const commands = new CommandRegistry();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    registerPdfCommands(commands, db, storage);

    expect(commands.names()).toContain(IpcChannel.PDF_FETCH_OPEN_ACCESS);
  });
});
