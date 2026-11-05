// Predicted order of the screening (#55): only the order changes. No article leaves the queue and nothing is decided.

/** What generating the vectors of title and abstract would do, known before anything is spent. */
export interface ArticleVectorPlan {
  total: number;
  pending: number;
  provider: string;
  /** The model the project's vectors came from, when another: going back to it spares generating them again. */
  previousModel: string | null;
}

/** One step of the generation, which runs a batch at a time so the screen can show how far it got. */
export interface ArticleVectorStep {
  generated: number;
  pending: number;
}

/** The queue as the classifier sees it now. */
export interface ScreeningRank {
  /** Pending articles with a vector, likeliest first; empty until there are enough examples. */
  order: number[];
  learnedFrom: number;
  /** Still needed to begin: until then the original order stands. */
  needRelevant: number;
  needExcluded: number;
}

/** How many relevant articles each order would have found after each article screened. */
export interface ScreeningSimulation {
  articles: number;
  relevant: number;
  predicted: number[];
  original: number[];
  /** Decided articles left out because they have no vector. */
  withoutVector: number;
}
