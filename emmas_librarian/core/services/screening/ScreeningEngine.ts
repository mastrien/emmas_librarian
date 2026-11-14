import type { ScreeningCriteria } from '../../../src/types/screeningSuggestion';
import {
  parseScreeningAnswer,
  screeningPrompt,
  type OfferedLabel,
  type ScreenedArticle,
  type ScreeningAnswer,
} from './screeningPrompt';

/** What an engine answers, and what the answer cost. */
export interface EngineSuggestion extends ScreeningAnswer {
  tokensEstimated: number;
}

/**
 * Anything that reads an article and suggests a label. Engines are interchangeable so they can be measured against
 * each other; the local classifier of #55 and the closed-answer experiment implement this too.
 */
export interface ScreeningEngine {
  readonly id: string;
  suggest(article: ScreenedArticle, criteria: ScreeningCriteria, labels: OfferedLabel[]): Promise<EngineSuggestion>;
}

/** The AI model that answers. */
export type ScreeningCompletion = (prompt: string) => Promise<string>;

// The gateways return only text. About 4 characters per token: enough to compare engines, not a bill.
const CHARS_PER_TOKEN = 4;

/**
 * Asks a language model, through the app's gateways.
 *
 * @example new LlmScreeningEngine(complete, 'ollama/llama3.1').suggest(article, criteria, labels);
 */
export class LlmScreeningEngine implements ScreeningEngine {
  constructor(
    private readonly complete: ScreeningCompletion,
    readonly id: string,
  ) {}

  async suggest(
    article: ScreenedArticle,
    criteria: ScreeningCriteria,
    labels: OfferedLabel[],
  ): Promise<EngineSuggestion> {
    const prompt = screeningPrompt(article, criteria, labels);
    const answer = await this.complete(prompt);
    return {
      ...parseScreeningAnswer(answer, labels, article.abstract),
      tokensEstimated: Math.ceil((prompt.length + answer.length) / CHARS_PER_TOKEN),
    };
  }
}
