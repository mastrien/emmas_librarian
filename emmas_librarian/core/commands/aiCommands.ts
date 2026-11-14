import fs from 'fs';
import { DatabaseAdapter } from '../database/DatabaseAdapter';
import { AIService } from '../services/AIService';
import { QuestionSetRepository } from '../database/QuestionSetRepository';
import { InvestigationResultRepository } from '../database/InvestigationResultRepository';
import { AIModelConfigRepository } from '../database/AIModelConfigRepository';
import { IpcChannel } from '../../src/types';
import type { AISkill, AIProvider, ResultReview } from '../../src/types';
import type { InvestigationResultInput } from '../database/InvestigationResultRepository';
import type { CommandRegistry } from './CommandRegistry';

type QuestionSetInput = Parameters<QuestionSetRepository['createQuestionSet']>[0];
type QuestionSetChanges = Parameters<QuestionSetRepository['updateQuestionSet']>[1];

/**
 * AI over an article's PDF (summary, extraction, metadata), the model chosen for each skill, question
 * sets and the saved answers of massive investigations.
 *
 * Usage:
 *   registerAiCommands(commands, db, aiService, process.env);
 */
export function registerAiCommands(
  commands: CommandRegistry,
  db: DatabaseAdapter,
  aiService: AIService,
  env: Record<string, string | undefined> = process.env,
): void {
  registerPdfAiCommands(commands, db, aiService, env);
  registerModelConfigCommands(commands, new AIModelConfigRepository(db.getDB()));
  registerQuestionSetCommands(commands, new QuestionSetRepository(db.getDB()));
  registerInvestigationResultCommands(commands, new InvestigationResultRepository(db.getDB()));
}

function requirePdfPath(db: DatabaseAdapter, articleId: number): string {
  const filePath = db.getArticle(articleId)?.local_file_path;
  if (filePath && fs.existsSync(filePath)) return filePath;
  throw new Error(
    `[ERR_NOT_FOUND] PDF não encontrado para o artigo. Offending value: articleId=${articleId}. Expected shape: ID numérico de um artigo com arquivo PDF válido em disco.`,
  );
}

const e2eExtraction = (questions: string[]) =>
  questions.map((question) => ({ question, answer: 'This is the E2E mock answer.', confidence: 0.95 }));

function registerPdfAiCommands(
  commands: CommandRegistry,
  db: DatabaseAdapter,
  aiService: AIService,
  env: Record<string, string | undefined>,
): void {
  commands.add(IpcChannel.AI_GENERATE_SUMMARY, async (articleId: number) =>
    aiService.generateSummary(articleId, requirePdfPath(db, articleId)),
  );
  commands.add(IpcChannel.AI_MASSIVE_EXTRACTION, async (articleId: number, questions: string[]) => {
    // E2E runs must not reach AI providers, and their articles need no PDF for this answer.
    if (env.E2E_MOCK_AI_EXTRACTION === 'true') return e2eExtraction(questions);
    return aiService.massiveExtraction(articleId, requirePdfPath(db, articleId), questions);
  });
  commands.add(IpcChannel.AI_EXTRACT_METADATA, async (articleId: number) =>
    aiService.extractMetadataFromPdf(articleId, requirePdfPath(db, articleId)),
  );
}

function registerModelConfigCommands(commands: CommandRegistry, configs: AIModelConfigRepository): void {
  commands.add(IpcChannel.AI_MODEL_CONFIG_GET_ALL, () => configs.getAllConfigs());
  commands.add(IpcChannel.AI_MODEL_CONFIG_UPDATE, (skill: AISkill, provider: AIProvider, modelName: string) => {
    configs.updateConfig(skill, provider, modelName);
  });
  commands.add(IpcChannel.AI_MODEL_CONFIG_RESTORE, () => {
    configs.restoreDefaults();
  });
}

function registerQuestionSetCommands(commands: CommandRegistry, sets: QuestionSetRepository): void {
  commands.add(IpcChannel.QUESTION_SETS_LIST, (projectId: number | null) => sets.listQuestionSets(projectId));
  commands.add(IpcChannel.QUESTION_SETS_GET, (id: number) => sets.getQuestionSet(id));
  commands.add(IpcChannel.QUESTION_SETS_CREATE, (input: QuestionSetInput) => sets.createQuestionSet(input));
  commands.add(IpcChannel.QUESTION_SETS_UPDATE, (id: number, changes: QuestionSetChanges) => {
    sets.updateQuestionSet(id, changes);
  });
  commands.add(IpcChannel.QUESTION_SETS_DELETE, (id: number) => {
    sets.deleteQuestionSet(id);
  });
  commands.add(IpcChannel.QUESTION_SETS_DUPLICATE, (id: number, projectId: number | null) =>
    sets.duplicateQuestionSet(id, projectId),
  );
}

function registerInvestigationResultCommands(commands: CommandRegistry, results: InvestigationResultRepository): void {
  commands.add(
    IpcChannel.INVESTIGATION_RESULTS_SAVE,
    (investigationId: number, articleId: number, answers: InvestigationResultInput[]) => {
      results.saveResultsBatch(investigationId, articleId, answers);
    },
  );
  commands.add(IpcChannel.INVESTIGATION_RESULTS_GET, (investigationId: number) =>
    results.getResultsByInvestigation(investigationId),
  );
  commands.add(IpcChannel.INVESTIGATION_RESULTS_GET_BY_ARTICLE, (investigationId: number, articleId: number) =>
    results.getResultsByArticle(investigationId, articleId),
  );
  commands.add(IpcChannel.INVESTIGATION_RESULT_REVIEW, (resultId: number, review: ResultReview) =>
    results.reviewResult(resultId, review),
  );
}
