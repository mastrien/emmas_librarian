import { describe, it, expect, vi, beforeEach } from 'vitest';
import { extractTextWithCoordinates, renderPagesAsImages } from '../PdfExtractor';
import fs from 'fs';

vi.mock('fs', () => {
  return {
    default: {
      readFileSync: vi.fn(),
      existsSync: vi.fn().mockReturnValue(true),
    },
  };
});

const { mockGetDocument, mockGetPage, mockGetTextContent } = vi.hoisted(() => {
  const mockGetTextContent = vi.fn().mockResolvedValue({
    items: [
      { str: 'Test text 1', transform: [1, 0, 0, 1, 10, 20], width: 50, height: 12, dir: 'ltr' },
      { str: 'Test text 2', transform: [1, 0, 0, 1, 10, 40], width: 60, height: 12, dir: 'ltr' },
    ],
  });

  const mockGetPage = vi.fn().mockResolvedValue({
    getTextContent: mockGetTextContent,
  });

  const mockGetDocument = vi.fn().mockReturnValue({
    promise: Promise.resolve({
      numPages: 2,
      getPage: mockGetPage,
    }),
  });

  return { mockGetDocument, mockGetPage, mockGetTextContent };
});

vi.mock('pdfjs-dist/legacy/build/pdf.mjs', () => {
  return {
    getDocument: mockGetDocument,
  };
});

describe('PdfExtractor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should extract text with coordinates successfully', async () => {
    vi.mocked(fs.readFileSync).mockReturnValue(Buffer.from('dummy pdf data'));
    vi.mocked(fs.existsSync).mockReturnValue(true);

    const result = await extractTextWithCoordinates('fake.pdf');

    expect(fs.existsSync).toHaveBeenCalledWith('fake.pdf');
    expect(fs.readFileSync).toHaveBeenCalledWith('fake.pdf');
    expect(mockGetDocument).toHaveBeenCalled();
    expect(mockGetPage).toHaveBeenCalledTimes(2);
    expect(mockGetPage).toHaveBeenCalledWith(1);
    expect(mockGetPage).toHaveBeenCalledWith(2);

    expect(result.totalPages).toBe(2);
    expect(result.chunks).toHaveLength(1);

    expect(result.chunks[0].text).toContain('Test text 1');
    expect(result.chunks[0].page).toBe(1);
    expect(result.chunks[0].bbox).toEqual({ x: 10, y: 20, w: 50, h: 12 });
  });

  it('should throw error if file does not exist', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    await expect(extractTextWithCoordinates('missing.pdf')).rejects.toThrow('PDF file not found: missing.pdf');
  });

  it('should handle sliding window overlap and empty items when chunkSize is exceeded', async () => {
    vi.mocked(fs.readFileSync).mockReturnValue(Buffer.from('dummy pdf data'));
    vi.mocked(fs.existsSync).mockReturnValue(true);

    mockGetDocument.mockReturnValueOnce({
      promise: Promise.resolve({
        numPages: 1,
        getPage: mockGetPage,
      }),
    });

    // Setup custom return values to include empty spacings which should be skipped,
    // and layout/text to exceed a small chunkSize
    mockGetTextContent.mockResolvedValueOnce({
      items: [
        { str: 'Test text 1', transform: [1, 0, 0, 1, 10, 20], width: 50, height: 12 },
        { str: ' ', transform: [1, 0, 0, 1, 0, 0], width: 0, height: 0 }, // Should be skipped
        { str: 'Test text 2', transform: [1, 0, 0, 1, 10, 40], width: 60, height: 12 },
      ],
    });

    const result = await extractTextWithCoordinates('fake.pdf', 15, 5);

    expect(result.chunks).toHaveLength(2);
    expect(result.chunks[0].text).toBe('Test text 1 Test text 2');
    expect(result.chunks[1].text).toBe('Test text 2');
    expect(result.chunks[0].bbox).toEqual({ x: 10, y: 20, w: 50, h: 12 });
    expect(result.chunks[1].bbox).toEqual({ x: 10, y: 40, w: 60, h: 12 });
  });

  it('should return empty Map when calling renderPagesAsImages', async () => {
    const result = await renderPagesAsImages('fake.pdf', [1, 2]);
    expect(result).toBeInstanceOf(Map);
    expect(result.size).toBe(0);
  });

  it('should go through all bboxes and include the first item in the overlap if chunkOverlap requires it', async () => {
    vi.mocked(fs.readFileSync).mockReturnValue(Buffer.from('dummy pdf data'));
    vi.mocked(fs.existsSync).mockReturnValue(true);

    mockGetDocument.mockReturnValueOnce({
      promise: Promise.resolve({
        numPages: 1,
        getPage: mockGetPage,
      }),
    });

    mockGetTextContent.mockResolvedValueOnce({
      items: [
        { str: 'ABC', transform: [1, 0, 0, 1, 10, 10], width: 10, height: 10 },
        { str: 'DEF', transform: [1, 0, 0, 1, 20, 10], width: 10, height: 10 },
        { str: 'GHI', transform: [1, 0, 0, 1, 30, 10], width: 10, height: 10 },
      ],
    });

    const result = await extractTextWithCoordinates('fake.pdf', 5, 4);

    expect(result.chunks).toHaveLength(3);
    expect(result.chunks[0].text).toBe('ABC DEF');
    expect(result.chunks[1].text).toBe('ABC DEF GHI');
    expect(result.chunks[2].text).toBe('DEF GHI');
    expect(result.totalCharacters).toBe(9);
  });

  it('should push remaining text even if it is very small (1 character)', async () => {
    vi.mocked(fs.readFileSync).mockReturnValue(Buffer.from('dummy pdf data'));
    vi.mocked(fs.existsSync).mockReturnValue(true);

    mockGetDocument.mockReturnValueOnce({
      promise: Promise.resolve({
        numPages: 1,
        getPage: mockGetPage,
      }),
    });

    mockGetTextContent.mockResolvedValueOnce({
      items: [{ str: 'Z', transform: [1, 0, 0, 1, 10, 10], width: 10, height: 10 }],
    });

    const result = await extractTextWithCoordinates('fake.pdf', 1000, 200);
    expect(result.chunks).toHaveLength(1);
    expect(result.chunks[0].text).toBe('Z');
    expect(result.chunks[0].page).toBe(1);
    expect(result.totalCharacters).toBe(1);
  });

  it('should skip only empty/whitespace items of length < 2', async () => {
    vi.mocked(fs.readFileSync).mockReturnValue(Buffer.from('dummy pdf data'));
    vi.mocked(fs.existsSync).mockReturnValue(true);

    mockGetDocument.mockReturnValueOnce({
      promise: Promise.resolve({
        numPages: 1,
        getPage: mockGetPage,
      }),
    });

    mockGetTextContent.mockResolvedValueOnce({
      items: [
        { str: 'A', transform: [1, 0, 0, 1, 10, 10], width: 10, height: 10 },
        { str: ' ', transform: [1, 0, 0, 1, 20, 10], width: 0, height: 0 },
        { str: '  ', transform: [1, 0, 0, 1, 30, 10], width: 0, height: 0 },
        { str: 'B', transform: [1, 0, 0, 1, 40, 10], width: 10, height: 10 },
      ],
    });

    const result = await extractTextWithCoordinates('fake.pdf', 1000, 200);
    expect(result.chunks).toHaveLength(1);
    expect(result.chunks[0].text).toBe('A    B');
    expect(result.totalCharacters).toBe(4);
  });
});
