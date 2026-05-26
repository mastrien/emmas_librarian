import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AIService } from '../AIService';
import { DatabaseManager } from '../../database/DatabaseManager';

// Mock the pdf-parse dependency
vi.mock('pdf-parse', () => {
  const MockPDFParse = vi.fn().mockImplementation(() => {
    return {
      getText: vi.fn().mockResolvedValue({ text: 'Mocked PDF text content for testing purposes.' })
    };
  });
  return {
    default: { PDFParse: MockPDFParse },
    PDFParse: MockPDFParse
  };
});

// Mock the fs dependency for extractTextFromPdf
vi.mock('fs', () => {
  return {
    default: {
      existsSync: vi.fn().mockReturnValue(true),
      readFileSync: vi.fn().mockReturnValue(Buffer.from('dummy-pdf-buffer')),
    }
  };
});

describe('AIService', () => {
  let dbMock: any;
  let aiService: AIService;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Mock DatabaseManager
    dbMock = {
      getSetting: vi.fn((key: string) => {
        if (key === 'api_key_openai') return 'test-openai-key';
        return null;
      }),
      getArticle: vi.fn().mockReturnValue({ local_file_path: 'fake/path.pdf' }),
      savePendingHighlight: vi.fn().mockReturnValue(123),
      updateArticleAiSummary: vi.fn(),
    } as unknown as DatabaseManager;

    aiService = new AIService(dbMock);

    // Mock global fetch for API calls
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: '{"generalSummary": "Resumo geral mockado", "sectionSummary": "Resumo detalhado mockado"}'
            }
          }
        ]
      })
    });
  });

  it('should get keys from database correctly', () => {
    const keys = aiService.getKeys();
    expect(dbMock.getSetting).toHaveBeenCalledWith('api_key_openai');
    expect(keys.openai).toBe('test-openai-key');
    expect(keys.gemini).toBeNull();
  });

  it('should extract text from PDF using PDFParse class', async () => {
    const text = await aiService.extractTextFromPdf('fake/path.pdf');
    expect(text).toBe('Mocked PDF text content for testing purposes.');
  });

  it('should throw an error if PDF does not exist', async () => {
    const fs = await import('fs');
    (fs.default.existsSync as any).mockReturnValueOnce(false);
    
    await expect(aiService.extractTextFromPdf('invalid/path.pdf')).rejects.toThrow('PDF file not found: invalid/path.pdf');
  });

  it('should generate summary by calling completion API', async () => {
    const summary = await aiService.generateSummary(1, 'fake/path.pdf');
    
    expect(global.fetch).toHaveBeenCalled();
    expect(summary.generalSummary).toBe('Resumo geral mockado');
    expect(summary.sectionSummary).toBe('Resumo detalhado mockado');
  });

  it('should massive extraction by calling completion API', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: '[{"question": "Q1?", "answer": "A1", "quote": "quote"}]'
            }
          }
        ]
      })
    });

    const results = await aiService.massiveExtraction(1, 'fake/path.pdf', ['Q1?']);
    
    expect(global.fetch).toHaveBeenCalled();
    expect(results).toHaveLength(1);
    expect(results[0].question).toBe('Q1?');
    expect(results[0].answer).toBe('A1');
    expect(results[0].quote).toBe('quote');
  });

  it('should throw error when no API key is configured', async () => {
    dbMock.getSetting = vi.fn().mockReturnValue(null);
    
    await expect(aiService.generateSummary(1, 'fake/path.pdf')).rejects.toThrow('Nenhuma chave de IA configurada');
  });

  it('should extract metadata by calling completion API', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: '{"title": "Test Title", "year": "2024"}'
            }
          }
        ]
      })
    });

    const metadata = await aiService.extractMetadataFromPdf(1, 'fake/path.pdf');
    expect(global.fetch).toHaveBeenCalled();
    expect(metadata.title).toBe('Test Title');
    expect(metadata.year).toBe('2024');
  });
});
