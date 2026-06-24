import { describe, it, expect, vi, beforeEach } from 'vitest';
import { extractTextWithCoordinates } from '../PdfExtractor';
import fs from 'fs';

vi.mock('fs', () => {
  return {
    default: {
      readFileSync: vi.fn(),
      existsSync: vi.fn().mockReturnValue(true)
    }
  };
});

const { mockGetDocument, mockGetPage, mockGetTextContent } = vi.hoisted(() => {
  const mockGetTextContent = vi.fn().mockResolvedValue({
    items: [
      { str: 'Test text 1', transform: [1, 0, 0, 1, 10, 20], width: 50, height: 12, dir: 'ltr' },
      { str: 'Test text 2', transform: [1, 0, 0, 1, 10, 40], width: 60, height: 12, dir: 'ltr' }
    ]
  });

  const mockGetPage = vi.fn().mockResolvedValue({
    getTextContent: mockGetTextContent
  });

  const mockGetDocument = vi.fn().mockReturnValue({
    promise: Promise.resolve({
      numPages: 2,
      getPage: mockGetPage
    })
  });

  return { mockGetDocument, mockGetPage, mockGetTextContent };
});

vi.mock('pdfjs-dist/legacy/build/pdf.mjs', () => {
  return {
    getDocument: mockGetDocument
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
});
