import type { CitationClipboard } from '../../citationClipboard';

/** A ClipboardItem stand-in: jsdom has none. */
export class FakeClipboardItem {
  constructor(readonly items: Record<string, Blob>) {}
}

/**
 * Records what the citation code copies, instead of touching the system clipboard.
 *
 * Usage:
 *   const clipboard = new FakeCitationClipboard();
 *   await copyCitations(['A'], 'text', clipboard);
 *   expect(clipboard.texts).toEqual(['A']);
 */
export class FakeCitationClipboard implements CitationClipboard {
  richWrites: FakeClipboardItem[][] = [];
  texts: string[] = [];
  rejectRich = false;

  async write(items: ClipboardItem[]) {
    if (this.rejectRich) throw new Error('ClipboardItem not supported');
    this.richWrites.push(items as unknown as FakeClipboardItem[]);
  }

  async writeText(text: string) {
    this.texts.push(text);
  }
}
