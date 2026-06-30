import { ipcMain } from 'electron';
import fs from 'fs';
import { withErrorHandling } from './errorHandler';
import { DatabaseAdapter } from '../database/DatabaseAdapter';
import { AIService } from '../services/AIService';
import { QuestionSetRepository } from '../database/QuestionSetRepository';
import { InvestigationResultRepository } from '../database/InvestigationResultRepository';
import { AIModelConfigRepository } from '../database/AIModelConfigRepository';
import { IpcChannel } from '../types';
import type { AISkill, AIProvider } from '../types';
import type { InvestigationResultInput } from '../database/InvestigationResultRepository';

export function setupAiIpcHandlers(db: DatabaseAdapter, aiService: AIService, ipcMainModule: typeof ipcMain = ipcMain) {
  const qsRepo = new QuestionSetRepository(db.getDB());
  const irRepo = new InvestigationResultRepository(db.getDB());
  const amcRepo = new AIModelConfigRepository(db.getDB());

  ipcMainModule.handle(
    IpcChannel.AI_GENERATE_SUMMARY,
    withErrorHandling(async (event, articleId: number) => {
      const article = db.getArticle(articleId);
      if (!article || !article.local_file_path || !fs.existsSync(article.local_file_path)) {
        throw new Error('PDF not found for this article.');
      }
      return aiService.generateSummary(articleId, article.local_file_path);
    }),
  );

  ipcMainModule.handle(
    IpcChannel.AI_MASSIVE_EXTRACTION,
    withErrorHandling(async (event, articleId: number, questions: string[]) => {
      if (process.env.E2E_MOCK_AI_EXTRACTION === 'true') {
        return questions.map((q) => ({
          question: q,
          answer: 'This is the E2E mock answer.',
          confidence: 0.95,
        }));
      }
      const article = db.getArticle(articleId);
      if (!article || !article.local_file_path || !fs.existsSync(article.local_file_path)) {
        throw new Error('PDF not found for this article.');
      }
      return aiService.massiveExtraction(articleId, article.local_file_path, questions);
    }),
  );

  ipcMainModule.handle(
    IpcChannel.AI_EXTRACT_METADATA,
    withErrorHandling(async (event, articleId: number) => {
      const article = db.getArticle(articleId);
      if (!article || !article.local_file_path || !fs.existsSync(article.local_file_path)) {
        throw new Error('PDF not found for this article.');
      }
      return aiService.extractMetadataFromPdf(articleId, article.local_file_path);
    }),
  );

  // AI Model Config handlers
  ipcMainModule.handle(IpcChannel.AI_MODEL_CONFIG_GET_ALL, async () => {
    return amcRepo.getAllConfigs();
  });

  ipcMainModule.handle(
    IpcChannel.AI_MODEL_CONFIG_UPDATE,
    async (_, skill: AISkill, provider: AIProvider, modelName: string) => {
      amcRepo.updateConfig(skill, provider, modelName);
    },
  );

  ipcMainModule.handle(IpcChannel.AI_MODEL_CONFIG_RESTORE, async () => {
    amcRepo.restoreDefaults();
  });

  // Question Sets handlers
  ipcMainModule.handle(IpcChannel.QUESTION_SETS_LIST, async (_, projectId: number | null) => {
    return qsRepo.listQuestionSets(projectId);
  });

  ipcMainModule.handle(IpcChannel.QUESTION_SETS_GET, async (_, id: number) => {
    return qsRepo.getQuestionSet(id);
  });

  ipcMainModule.handle(IpcChannel.QUESTION_SETS_CREATE, async (_, data: any) => {
    return qsRepo.createQuestionSet(data);
  });

  ipcMainModule.handle(IpcChannel.QUESTION_SETS_UPDATE, async (_, id: number, data: any) => {
    qsRepo.updateQuestionSet(id, data);
  });

  ipcMainModule.handle(IpcChannel.QUESTION_SETS_DELETE, async (_, id: number) => {
    qsRepo.deleteQuestionSet(id);
  });

  ipcMainModule.handle(IpcChannel.QUESTION_SETS_DUPLICATE, async (_, id: number, projectId: number | null) => {
    return qsRepo.duplicateQuestionSet(id, projectId);
  });

  // Investigation Results handlers
  ipcMainModule.handle(
    IpcChannel.INVESTIGATION_RESULTS_SAVE,
    async (_, investigationId: number, articleId: number, results: InvestigationResultInput[]) => {
      irRepo.saveResultsBatch(investigationId, articleId, results);
    },
  );

  ipcMainModule.handle(IpcChannel.INVESTIGATION_RESULTS_GET, async (_, investigationId: number) => {
    return irRepo.getResultsByInvestigation(investigationId);
  });

  ipcMainModule.handle(
    IpcChannel.INVESTIGATION_RESULTS_GET_BY_ARTICLE,
    async (_, investigationId: number, articleId: number) => {
      return irRepo.getResultsByArticle(investigationId, articleId);
    },
  );
}
