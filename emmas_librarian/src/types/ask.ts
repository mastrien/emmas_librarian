// "Perguntar aos projetos" (#53). Messages have a role and an answer has steps so that the next epic, where the AI uses
// the app's functions, can add its own kinds of message and step without changing how conversations are kept.

/** An article as a question sees it. */
export interface ProjectIndexArticle {
  id: number;
  title: string;
  authors: string | null;
  year: number | null;
  pdfPath: string | null;
}

/**
 * What a search can read. `indexed` is only what the current embedding model indexed: vectors of different models are
 * not comparable, so the others stay out until recalculated, in `outdated`. That includes PDFs indexed before the app
 * recorded the model, since nothing says which model made them.
 */
export interface ProjectIndexCoverage {
  total: number;
  indexed: ProjectIndexArticle[];
  withoutIndex: ProjectIndexArticle[];
  withoutPdf: ProjectIndexArticle[];
  outdated: ProjectIndexArticle[];
}

/** Which articles an indexing is about: the question page thinks in projects, an investigation in articles. */
export type AskIndexTarget = { projectIds: number[] } | { articleIds: number[] };

/**
 * What indexing would do, known before anything is spent or removed. The vector table holds one size only, so a model
 * of another size (`sizeChanged`) also takes out the vectors of the other PDFs of the library.
 */
export interface AskIndexPlan {
  pending: number;
  outdated: number;
  sizeChanged: boolean;
  othersLosingVectors: number;
}

/** A chunk an answer cites. Its text is kept with the answer, so it stays readable after the article is gone. */
export interface AskCitation {
  articleId: number;
  title: string;
  authors: string | null;
  year: number | null;
  page: number;
  bbox: { x: number; y: number; w: number; h: number };
  text: string;
  pdfPath: string | null;
}

/**
 * Whether a citation can still be opened, worked out each time the conversation is read. `articleId` may be another
 * article: a copy in another project shares the PDF, so the page is the same.
 */
export type AskCitationAccess = { kind: 'open'; articleId: number } | { kind: 'trash' } | { kind: 'gone' };

export type AskReadCitation = AskCitation & { access: AskCitationAccess };

/** Why a statement could not be checked against what was read. The model may have made it up. */
export type AskUnverified =
  | { kind: 'unknown_source'; sources: string[]; available: number }
  | { kind: 'no_source' }
  | { kind: 'loose_text' };

export interface AskClaim<Citation = AskCitation> {
  text: string;
  citations: Citation[];
  unverified: AskUnverified | null;
}

/** What the answer did before writing. */
export type AskStep = { kind: 'search'; chunks: number; articles: number; projects: string[] };

export interface AskAnswer<Citation = AskCitation> {
  claims: AskClaim<Citation>[];
  steps: AskStep[];
}

/** What a question over a set of articles produced. No claims: what was read does not answer it. */
export interface ProjectAnswer {
  question: string;
  claims: AskClaim[];
  chunksRead: number;
  articlesRead: number;
  coverage: ProjectIndexCoverage;
}

export interface AskMessage {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  answer: AskAnswer<AskReadCitation> | null;
  created_at: string;
}

export interface AskConversationSummary {
  id: number;
  title: string;
  updated_at: string;
  project_count: number;
}

export interface AskConversation {
  id: number;
  title: string;
  projects: { id: number; name: string }[];
  messages: AskMessage[];
}

export interface AskQuestionInput {
  conversationId: number | null;
  projectIds: number[];
  question: string;
}

/** After indexing: what a question can read now, and which PDFs could not be indexed. */
export interface AskIndexResult {
  coverage: ProjectIndexCoverage;
  failed: { title: string; reason: string }[];
}
