import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AIService } from '../AIService';
import { DatabaseManager } from '../../database/DatabaseManager';

// Define mock variable before vi.mock
const mockGetText = vi.fn().mockResolvedValue({ text: 'Mocked PDF text content for testing purposes.' });

// Mock the pdf-parse dependency
vi.mock('pdf-parse', () => {
  const MockPDFParse = vi.fn().mockImplementation(() => {
    return {
      getText: mockGetText
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

  it('should prioritize Gemini if OpenAI key is not present but Gemini is', async () => {
    dbMock.getSetting = vi.fn((key: string) => {
      if (key === 'api_key_gemini') return 'test-gemini-key';
      return null;
    });

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: '{"generalSummary": "Gemini Summary", "sectionSummary": ""}' }] } }]
      })
    });

    const summary = await aiService.generateSummary(1, 'fake/path.pdf');
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('generativelanguage.googleapis.com'), expect.any(Object));
    expect(summary.generalSummary).toBe('Gemini Summary');
  });

  it('should call Ollama if only Ollama key is present', async () => {
    dbMock.getSetting = vi.fn((key: string) => {
      if (key === 'api_key_ollama') return 'http://localhost:11434';
      if (key === 'ollama_model') return 'my-model';
      return null;
    });

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '{"generalSummary": "Ollama Summary", "sectionSummary": ""}' } }]
      })
    });

    const summary = await aiService.generateSummary(1, 'fake/path.pdf');
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('http://localhost:11434/chat/completions'), expect.any(Object));
    expect(summary.generalSummary).toBe('Ollama Summary');
  });

  it('should throw QUOTA_EXCEEDED when API returns 429', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429
    });

    await expect(aiService.generateSummary(1, 'fake/path.pdf')).rejects.toThrow('QUOTA_EXCEEDED');
  });

  it('should throw error when API returns other error status', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'Internal Server Error'
    });

    await expect(aiService.generateSummary(1, 'fake/path.pdf')).rejects.toThrow('OpenAI API Error: Internal Server Error');
  });

  it('should throw error on invalid JSON response in generateSummary', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'invalid json' } }]
      })
    });

    await expect(aiService.generateSummary(1, 'fake/path.pdf')).rejects.toThrow('A IA não retornou um formato JSON válido.');
  });

  it('should throw error on invalid JSON response in massiveExtraction', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'invalid json' } }]
      })
    });

    await expect(aiService.massiveExtraction(1, 'fake/path.pdf', ['Q1?'])).rejects.toThrow('A IA não retornou um formato JSON válido para extração.');
  });

  it('should throw error on invalid JSON response in extractMetadataFromPdf', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'invalid json' } }]
      })
    });

    await expect(aiService.extractMetadataFromPdf(1, 'fake/path.pdf')).rejects.toThrow('A IA não retornou um formato JSON válido para os metadados.');
  });

  it('should throw error when PDF parsing fails', async () => {
    mockGetText.mockRejectedValueOnce(new Error('Parse Error'));

    await expect(aiService.extractTextFromPdf('fake/path.pdf')).rejects.toThrow('Failed to parse PDF file');
  });
});
