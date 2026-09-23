import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { copyCitations, type CitationClipboard } from '../citationClipboard';

class FakeClipboardItem {
  constructor(readonly items: Record<string, Blob>) {}
}

class FakeCitationClipboard implements CitationClipboard {
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

// jsdom's Blob has no text().
const readBlob = (blob: Blob) =>
  new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.readAsText(blob);
  });

let clipboard: FakeCitationClipboard;

beforeEach(() => {
  clipboard = new FakeCitationClipboard();
  vi.stubGlobal('ClipboardItem', FakeClipboardItem);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('copyCitations', () => {
  it('writes HTML citations as rich text plus a tag-free plain text', async () => {
    await copyCitations(['<i>A</i>.', '<b>B</b>.'], 'html', clipboard);

    const [[item]] = clipboard.richWrites;
    expect(await readBlob(item.items['text/html'])).toBe('<i>A</i>.<br/><br/><b>B</b>.');
    expect(await readBlob(item.items['text/plain'])).toBe('A.\n\nB.');
    expect(clipboard.texts).toEqual([]);
  });

  it('falls back to plain text when rich text is rejected', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    clipboard.rejectRich = true;

    await copyCitations(['<i>A</i>'], 'html', clipboard);

    expect(clipboard.texts).toEqual(['A']);
  });

  it.each(['text', 'bibtex'] as const)('writes %s citations as-is, separated by a blank line', async (format) => {
    await copyCitations(['@a{<x>}', '@b{}'], format, clipboard);

    expect(clipboard.texts).toEqual(['@a{<x>}\n\n@b{}']);
    expect(clipboard.richWrites).toEqual([]);
  });
});
