import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AIService } from '../AIService';
import { DatabaseAdapter } from '../../database/DatabaseAdapter';
import { AIModelConfigRepository } from '../../database/AIModelConfigRepository';
import { extractTextWithCoordinates } from '../PdfExtractor';

vi.mock('../PdfExtractor', () => ({
  extractTextWithCoordinates: vi.fn().mockResolvedValue({
    chunks: [{ text: 'Mocked PDF text content for testing purposes.', page: 1, bbox: { x: 0, y: 0, w: 100, h: 10 } }],
    totalPages: 1,
    totalCharacters: 45,
  }),
  renderPagesAsImages: vi.fn().mockResolvedValue(new Map()),
}));

const { mockGetConfig } = vi.hoisted(() => ({
  mockGetConfig: vi.fn().mockReturnValue({ provider: 'openai', model_name: 'gpt-4o-mini' }),
}));

vi.mock('../../database/AIModelConfigRepository', () => ({
  AIModelConfigRepository: vi.fn().mockImplementation(() => ({
    getConfig: mockGetConfig,
  })),
}));

vi.mock('../VectorStore', () => ({
  VectorStore: vi.fn().mockImplementation(() => ({
    indexArticleChunks: vi.fn(),
    searchSimilar: vi.fn().mockReturnValue([
      { text: 'Mocked context chunk 1', page: 1, bbox: { x: 0, y: 0, w: 100, h: 10 } },
      { text: 'Mocked context chunk 2', page: 2, bbox: { x: 0, y: 0, w: 100, h: 10 } },
    ]),
    ensureDimensionAndClearIfMismatched: vi.fn(),
  })),
}));

vi.mock('../EmbeddingService', () => ({
  EmbeddingService: vi.fn().mockImplementation(() => ({
    embedBatch: vi.fn().mockResolvedValue([[0.1, 0.2]]),
    embed: vi.fn().mockResolvedValue([0.1, 0.2]),
  })),
}));

// Define mock variable before vi.mock
const mockGetText = vi.fn().mockResolvedValue({ text: 'Mocked PDF text content for testing purposes.' });

// Mock the pdf-parse dependency
vi.mock('pdf-parse', () => {
  const MockPDFParse = vi.fn().mockImplementation(() => {
    return {
      getText: mockGetText,
    };
  });
  return {
    default: { PDFParse: MockPDFParse },
    PDFParse: MockPDFParse,
  };
});

// Mock the fs dependency for extractTextFromPdf
vi.mock('fs', () => {
  return {
    default: {
      existsSync: vi.fn().mockReturnValue(true),
      readFileSync: vi.fn().mockReturnValue(Buffer.from('dummy-pdf-buffer')),
    },
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
      getDB: vi.fn().mockReturnValue({
        prepare: vi.fn().mockReturnValue({
          get: vi.fn().mockReturnValue({ count: 1 }),
        }),
      }),
    } as unknown as DatabaseAdapter;

    aiService = new AIService(dbMock);

    // Mock global fetch for API calls
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: '{"generalSummary": "Resumo geral mockado", "sectionSummary": "Resumo detalhado mockado"}',
            },
          },
        ],
      }),
    });
  });

  it('should get keys from database correctly', () => {
    const keys = aiService.getKeys();
    expect(dbMock.getSetting).toHaveBeenCalledWith('api_key_openai');
    expect(keys.openai).toBe('test-openai-key');
    expect(keys.gemini).toBeNull();
  });

  it('should extract text from PDF using extractTextWithCoordinates', async () => {
    const text = await aiService.extractTextFromPdf('fake/path.pdf');
    expect(text).toBe('Mocked PDF text content for testing purposes.');
  });

  it('should throw an error if PDF does not exist', async () => {
    const fs = await import('fs');
    (fs.default.existsSync as any).mockReturnValueOnce(false);

    await expect(aiService.extractTextFromPdf('invalid/path.pdf')).rejects.toThrow(
      'PDF file not found: invalid/path.pdf',
    );
  });

  it('should throw ERR_API_CONNECTION when fetch fails with fetch failed message', async () => {
    (global.fetch as any).mockRejectedValueOnce(new Error('fetch failed'));

    await expect(aiService.generateSummary(1, 'fake/path.pdf')).rejects.toThrow(
      'Falha de conexão com o provedor de Inteligência Artificial',
    );
  });

  it('should respect the AIModelConfigRepository when resolving providers', async () => {
    mockGetConfig.mockReturnValueOnce({ provider: 'gemini', model_name: 'gemini-1.5-pro' } as any);

    dbMock.getSetting = vi.fn().mockReturnValue('test-gemini-key');

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: '{"title": "Gemini Title", "year": "2025"}' }] } }],
      }),
    });

    const metadata = await aiService.extractMetadataFromPdf(1, 'fake/path.pdf');
    expect(global.fetch).toHaveBeenCalled();
    expect((metadata as any).title).toBe('Gemini Title');
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
              content:
                '{"question": "Q1?", "synthesizedAnswer": "A1", "confidenceScore": 0.9, "evidences": [{"text": "quote", "page": 1, "reasoning": "bla"}]}',
            },
          },
        ],
      }),
    });

    const results = await aiService.massiveExtraction(1, 'fake/path.pdf', ['Q1?']);

    expect(global.fetch).toHaveBeenCalled();
    expect(results).toHaveLength(1);
    expect(results[0].question).toBe('Q1?');
    expect(results[0].synthesizedAnswer).toBe('A1');
    expect(results[0].evidences[0].text).toBe('quote');
  });

  it('should throw error when configured API key is missing', async () => {
    dbMock.getSetting = vi.fn().mockReturnValue(null);
    // The mocked config says provider = openai
    await expect(aiService.generateSummary(1, 'fake/path.pdf')).rejects.toThrow('Chave da OpenAI não configurada.');
  });

  it('should extract metadata by calling completion API', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: '{"title": "Test Title", "year": "2024"}',
            },
          },
        ],
      }),
    });

    const metadata = await aiService.extractMetadataFromPdf(1, 'fake/path.pdf');
    expect(global.fetch).toHaveBeenCalled();
    expect((metadata as any).title).toBe('Test Title');
    expect((metadata as any).year).toBe('2024');
  });

  it('should call Gemini if configured for summary skill', async () => {
    dbMock.getSetting = vi.fn((key: string) => {
      if (key === 'api_key_gemini') return 'test-gemini-key';
      return null;
    });

    // Mock config to return Gemini for this test
    mockGetConfig.mockReturnValueOnce({
      provider: 'gemini',
      model_name: 'gemini-1.5-flash',
    } as any);

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: '{"generalSummary": "Gemini Summary", "sectionSummary": ""}' }] } }],
      }),
    });

    const summary = await aiService.generateSummary(1, 'fake/path.pdf');
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('generativelanguage.googleapis.com'),
      expect.any(Object),
    );
    expect(summary.generalSummary).toBe('Gemini Summary');
  });

  it('should call Ollama if configured for summary skill', async () => {
    dbMock.getSetting = vi.fn((key: string) => {
      if (key === 'api_key_ollama') return 'http://localhost:11434';
      if (key === 'ollama_model') return 'my-model';
      return null;
    });

    // Mock config to return Ollama for this test
    mockGetConfig.mockReturnValueOnce({
      provider: 'ollama',
      model_name: 'llama3',
    } as any);

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '{"generalSummary": "Ollama Summary", "sectionSummary": ""}' } }],
      }),
    });

    const summary = await aiService.generateSummary(1, 'fake/path.pdf');
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('http://localhost:11434/chat/completions'),
      expect.any(Object),
    );
    expect(summary.generalSummary).toBe('Ollama Summary');
  });

  it('should call Ollama Cloud if configured for summary skill', async () => {
    dbMock.getSetting = vi.fn((key: string) => {
      if (key === 'api_key_ollama_cloud') return 'cloud-secret-key';
      return null;
    });

    mockGetConfig.mockReturnValueOnce({
      provider: 'ollama_cloud',
      model_name: 'llama3.1:70b',
    } as any);

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '{"generalSummary": "Ollama Cloud Summary", "sectionSummary": ""}' } }],
      }),
    });

    const summary = await aiService.generateSummary(1, 'fake/path.pdf');
    expect(global.fetch).toHaveBeenCalledWith(
      'https://ollama.com/v1/chat/completions',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer cloud-secret-key',
        }),
      }),
    );
    expect(summary.generalSummary).toBe('Ollama Cloud Summary');
  });

  it('should throw AppError if ollama_cloud key is missing', async () => {
    dbMock.getSetting = vi.fn(() => null);
    mockGetConfig.mockReturnValueOnce({
      provider: 'ollama_cloud',
      model_name: 'llama3.1:70b',
    } as any);

    await expect(aiService.generateSummary(1, 'fake/path.pdf')).rejects.toThrow('Chave do Ollama Cloud não configurada');
  });

  it('should throw QUOTA_EXCEEDED when API returns 429', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
    });

    await expect(aiService.generateSummary(1, 'fake/path.pdf')).rejects.toThrow('QUOTA_EXCEEDED');
  });

  it('should throw error when API returns other error status', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'Internal Server Error',
    });

    await expect(aiService.generateSummary(1, 'fake/path.pdf')).rejects.toThrow(
      'OpenAI API Error: Internal Server Error',
    );
  });

  it('should throw error on invalid JSON response in generateSummary', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'invalid json' } }],
      }),
    });

    await expect(aiService.generateSummary(1, 'fake/path.pdf')).rejects.toThrow(
      'A IA não retornou um formato JSON válido.',
    );
  });

  it('should throw error on invalid JSON response in massiveExtraction', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'invalid json' } }],
      }),
    });

    await expect(aiService.massiveExtraction(1, 'fake/path.pdf', ['Q1?'])).rejects.toThrow(
      'A IA não retornou um formato JSON válido para extração.',
    );
  });

  it('should throw error on invalid JSON response in extractMetadataFromPdf', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'invalid json' } }],
      }),
    });

    await expect(aiService.extractMetadataFromPdf(1, 'fake/path.pdf')).rejects.toThrow(
      'A IA não retornou um formato JSON válido para os metadados.',
    );
  });

  it('should throw error when PDF parsing fails', async () => {
    vi.mocked(extractTextWithCoordinates).mockRejectedValueOnce(new Error('Parse Error'));

    await expect(aiService.extractTextFromPdf('fake/path.pdf')).rejects.toThrow('Falha ao ler o arquivo PDF');
  });
});
