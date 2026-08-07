import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setupAiIpcHandlers } from './aiIpcHandlers';
import { IpcChannel } from '../types';
import fs from 'fs';

// Mock fs to simulate valid/invalid files
vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn(),
  },
}));

// Mock repositories and services
const mockQsRepo = {
  listQuestionSets: vi.fn(),
  getQuestionSet: vi.fn(),
  createQuestionSet: vi.fn(),
  updateQuestionSet: vi.fn(),
  deleteQuestionSet: vi.fn(),
  duplicateQuestionSet: vi.fn(),
};

const mockIrRepo = {
  saveResultsBatch: vi.fn(),
  getResultsByInvestigation: vi.fn(),
  getResultsByArticle: vi.fn(),
};

const mockAmcRepo = {
  getAllConfigs: vi.fn(),
  updateConfig: vi.fn(),
  restoreDefaults: vi.fn(),
};

vi.mock('../database/QuestionSetRepository', () => ({
  QuestionSetRepository: vi.fn(() => mockQsRepo),
}));

vi.mock('../database/InvestigationResultRepository', () => ({
  InvestigationResultRepository: vi.fn(() => mockIrRepo),
}));

vi.mock('../database/AIModelConfigRepository', () => ({
  AIModelConfigRepository: vi.fn(() => mockAmcRepo),
}));

const mockDbAdapter = {
  getDB: vi.fn(),
  getArticle: vi.fn(),
};

const mockAiService = {
  generateSummary: vi.fn(),
  massiveExtraction: vi.fn(),
  extractMetadataFromPdf: vi.fn(),
};

const mockIpcMain = {
  handle: vi.fn(),
};

describe('aiIpcHandlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupAiIpcHandlers(mockDbAdapter as any, mockAiService as any, mockIpcMain as any);
  });

  const getHandler = (channel: string) => {
    const call = mockIpcMain.handle.mock.calls.find((c) => c[0] === channel);
    if (!call) throw new Error(`Handler for ${channel} not found`);
    return call[1];
  };

  describe('AI_GENERATE_SUMMARY', () => {
    it('throws error if article not found', async () => {
      mockDbAdapter.getArticle.mockReturnValue(undefined);
      const handler = getHandler(IpcChannel.AI_GENERATE_SUMMARY);
      await expect(handler({}, 1)).rejects.toThrow('[ERR_NOT_FOUND]');
    });

    it('throws error if article local_file_path is missing', async () => {
      mockDbAdapter.getArticle.mockReturnValue({});
      const handler = getHandler(IpcChannel.AI_GENERATE_SUMMARY);
      await expect(handler({}, 1)).rejects.toThrow('[ERR_NOT_FOUND]');
    });

    it('throws error if article local_file_path does not exist on disk', async () => {
      mockDbAdapter.getArticle.mockReturnValue({ local_file_path: '/missing.pdf' });
      vi.mocked(fs.existsSync).mockReturnValue(false);
      const handler = getHandler(IpcChannel.AI_GENERATE_SUMMARY);
      await expect(handler({}, 1)).rejects.toThrow('[ERR_NOT_FOUND]');
    });

    it('calls aiService.generateSummary if article exists and file exists', async () => {
      mockDbAdapter.getArticle.mockReturnValue({ local_file_path: '/exists.pdf' });
      vi.mocked(fs.existsSync).mockReturnValue(true);
      mockAiService.generateSummary.mockResolvedValue('Summary');
      const handler = getHandler(IpcChannel.AI_GENERATE_SUMMARY);
      const result = await handler({}, 1);
      expect(result).toBe('Summary');
      expect(mockAiService.generateSummary).toHaveBeenCalledWith(1, '/exists.pdf');
    });
  });

  describe('AI_MASSIVE_EXTRACTION', () => {
    it('returns mock data if process.env.E2E_MOCK_AI_EXTRACTION is true', async () => {
      process.env.E2E_MOCK_AI_EXTRACTION = 'true';
      const handler = getHandler(IpcChannel.AI_MASSIVE_EXTRACTION);
      const result = await handler({}, 1, ['Question 1']);
      expect(result).toEqual([{ question: 'Question 1', answer: 'This is the E2E mock answer.', confidence: 0.95 }]);
      delete process.env.E2E_MOCK_AI_EXTRACTION;
    });

    it('throws error if article not found', async () => {
      mockDbAdapter.getArticle.mockReturnValue(undefined);
      const handler = getHandler(IpcChannel.AI_MASSIVE_EXTRACTION);
      await expect(handler({}, 1, [])).rejects.toThrow('[ERR_NOT_FOUND]');
    });

    it('calls aiService.massiveExtraction with correct arguments', async () => {
      mockDbAdapter.getArticle.mockReturnValue({ local_file_path: '/exists.pdf' });
      vi.mocked(fs.existsSync).mockReturnValue(true);
      mockAiService.massiveExtraction.mockResolvedValue([]);
      const handler = getHandler(IpcChannel.AI_MASSIVE_EXTRACTION);
      const result = await handler({}, 1, ['Q1']);
      expect(result).toEqual([]);
      expect(mockAiService.massiveExtraction).toHaveBeenCalledWith(1, '/exists.pdf', ['Q1']);
    });
  });

  describe('AI_EXTRACT_METADATA', () => {
    it('throws error if article not found', async () => {
      mockDbAdapter.getArticle.mockReturnValue(undefined);
      const handler = getHandler(IpcChannel.AI_EXTRACT_METADATA);
      await expect(handler({}, 1)).rejects.toThrow('[ERR_NOT_FOUND]');
    });

    it('calls aiService.extractMetadataFromPdf', async () => {
      mockDbAdapter.getArticle.mockReturnValue({ local_file_path: '/exists.pdf' });
      vi.mocked(fs.existsSync).mockReturnValue(true);
      mockAiService.extractMetadataFromPdf.mockResolvedValue({ title: 'T' });
      const handler = getHandler(IpcChannel.AI_EXTRACT_METADATA);
      const result = await handler({}, 1);
      expect(result).toEqual({ title: 'T' });
      expect(mockAiService.extractMetadataFromPdf).toHaveBeenCalledWith(1, '/exists.pdf');
    });
  });

  describe('AIModelConfigRepository handlers', () => {
    it('AI_MODEL_CONFIG_GET_ALL calls getAllConfigs', async () => {
      const handler = getHandler(IpcChannel.AI_MODEL_CONFIG_GET_ALL);
      mockAmcRepo.getAllConfigs.mockResolvedValue(['config']);
      const res = await handler({});
      expect(res).toEqual(['config']);
      expect(mockAmcRepo.getAllConfigs).toHaveBeenCalled();
    });

    it('AI_MODEL_CONFIG_UPDATE calls updateConfig', async () => {
      const handler = getHandler(IpcChannel.AI_MODEL_CONFIG_UPDATE);
      await handler({}, 'skill', 'provider', 'modelName');
      expect(mockAmcRepo.updateConfig).toHaveBeenCalledWith('skill', 'provider', 'modelName');
    });

    it('AI_MODEL_CONFIG_RESTORE calls restoreDefaults', async () => {
      const handler = getHandler(IpcChannel.AI_MODEL_CONFIG_RESTORE);
      await handler({});
      expect(mockAmcRepo.restoreDefaults).toHaveBeenCalled();
    });
  });

  describe('QuestionSetRepository handlers', () => {
    it('QUESTION_SETS_LIST', async () => {
      const handler = getHandler(IpcChannel.QUESTION_SETS_LIST);
      mockQsRepo.listQuestionSets.mockResolvedValue([]);
      const res = await handler({}, 1);
      expect(res).toEqual([]);
      expect(mockQsRepo.listQuestionSets).toHaveBeenCalledWith(1);
    });

    it('QUESTION_SETS_GET', async () => {
      const handler = getHandler(IpcChannel.QUESTION_SETS_GET);
      mockQsRepo.getQuestionSet.mockResolvedValue({ id: 1 });
      const res = await handler({}, 1);
      expect(res).toEqual({ id: 1 });
      expect(mockQsRepo.getQuestionSet).toHaveBeenCalledWith(1);
    });

    it('QUESTION_SETS_CREATE', async () => {
      const handler = getHandler(IpcChannel.QUESTION_SETS_CREATE);
      mockQsRepo.createQuestionSet.mockResolvedValue(1);
      const res = await handler({}, { name: 'test' });
      expect(res).toBe(1);
      expect(mockQsRepo.createQuestionSet).toHaveBeenCalledWith({ name: 'test' });
    });

    it('QUESTION_SETS_UPDATE', async () => {
      const handler = getHandler(IpcChannel.QUESTION_SETS_UPDATE);
      await handler({}, 1, { name: 'test2' });
      expect(mockQsRepo.updateQuestionSet).toHaveBeenCalledWith(1, { name: 'test2' });
    });

    it('QUESTION_SETS_DELETE', async () => {
      const handler = getHandler(IpcChannel.QUESTION_SETS_DELETE);
      await handler({}, 1);
      expect(mockQsRepo.deleteQuestionSet).toHaveBeenCalledWith(1);
    });

    it('QUESTION_SETS_DUPLICATE', async () => {
      const handler = getHandler(IpcChannel.QUESTION_SETS_DUPLICATE);
      mockQsRepo.duplicateQuestionSet.mockResolvedValue(2);
      const res = await handler({}, 1, 3);
      expect(res).toBe(2);
      expect(mockQsRepo.duplicateQuestionSet).toHaveBeenCalledWith(1, 3);
    });
  });

  describe('InvestigationResultRepository handlers', () => {
    it('INVESTIGATION_RESULTS_SAVE', async () => {
      const handler = getHandler(IpcChannel.INVESTIGATION_RESULTS_SAVE);
      await handler({}, 1, 2, [{ res: 'a' }]);
      expect(mockIrRepo.saveResultsBatch).toHaveBeenCalledWith(1, 2, [{ res: 'a' }]);
    });

    it('INVESTIGATION_RESULTS_GET', async () => {
      const handler = getHandler(IpcChannel.INVESTIGATION_RESULTS_GET);
      mockIrRepo.getResultsByInvestigation.mockResolvedValue(['r']);
      const res = await handler({}, 1);
      expect(res).toEqual(['r']);
      expect(mockIrRepo.getResultsByInvestigation).toHaveBeenCalledWith(1);
    });

    it('INVESTIGATION_RESULTS_GET_BY_ARTICLE', async () => {
      const handler = getHandler(IpcChannel.INVESTIGATION_RESULTS_GET_BY_ARTICLE);
      mockIrRepo.getResultsByArticle.mockResolvedValue(['r2']);
      const res = await handler({}, 1, 2);
      expect(res).toEqual(['r2']);
      expect(mockIrRepo.getResultsByArticle).toHaveBeenCalledWith(1, 2);
    });
  });
});
