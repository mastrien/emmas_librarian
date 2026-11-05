// Screening suggestion (#54). The goal of an engine is to get right what the person would mark, even when that is
// "em dúvida". A suggestion is kept apart from the decision and never becomes one by itself.

/** What a project looks for, in the person's words. Goes with title and abstract in each suggestion. */
export interface ScreeningCriteria {
  inclusion: string;
  exclusion: string;
}

/** An engine's reading of one article, kept because it cost tokens. */
export interface ScreeningSuggestion {
  id: number;
  article_id: number;
  label_id: number;
  /** Which engine answered, such as `ollama_cloud/gpt-oss:120b`: engines are compared side by side. */
  engine: string;
  /** The criteria it read. When the project's differ, the suggestion says it used the previous ones. */
  criteria: string;
  confidence: number | null;
  reason: string;
  quote: string | null;
  /** Whether the quote is in the abstract. When it is not, the model may have made it up. */
  quote_found: number;
  elapsed_ms: number;
  tokens_estimated: number;
  created_at: string;
}

/** The engine set in the settings, and whom the text is sent to. */
export interface ScreeningEngineInfo {
  id: string;
  provider: string;
}
