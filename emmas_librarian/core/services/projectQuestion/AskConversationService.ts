import { AppError } from '../../../electron/ipc/errorHandler';
import type { AskConversationRepository, StoredMessage } from '../../database/AskConversationRepository';
import type { PdfChunkIndexRepository } from '../../database/PdfChunkIndexRepository';
import type {
  AskAnswer,
  AskConversation,
  AskMessage,
  AskQuestionInput,
  AskReadCitation,
  ProjectAnswer,
} from '../../../src/types/ask';
import type { AskTurn } from './projectAnswerPrompt';
import type { ProjectQuestionService } from './ProjectQuestionService';

// Enough for a follow-up to make sense; each one is sent with every question and costs tokens.
const TURNS_SENT = 3;
const TITLE_LENGTH = 80;

const titleFrom = (question: string): string =>
  question.length <= TITLE_LENGTH ? question : `${question.slice(0, TITLE_LENGTH - 1).trimEnd()}…`;

const claimsText = (answer: AskAnswer): string => answer.claims.map((claim) => claim.text).join(' ');

/**
 * The conversations of "Perguntar aos projetos": each answer is kept for good, because it cost tokens (#53).
 *
 * @example await service.send({ conversationId: null, projectIds: [1, 2], question: 'Qual a amostra?' });
 */
export class AskConversationService {
  constructor(
    private readonly conversations: AskConversationRepository,
    private readonly index: PdfChunkIndexRepository,
    private readonly questions: ProjectQuestionService,
  ) {}

  /** Answers and keeps both sides, then returns the conversation. A failed question keeps nothing and can be resent. */
  async send({ conversationId, projectIds, question }: AskQuestionInput): Promise<AskConversation> {
    const asked = question.trim();
    if (!asked) {
      throw new AppError(
        'ERR_EMPTY_QUESTION',
        'VALIDATION_ERROR',
        `Escreva a pergunta. Valor recebido: ${JSON.stringify(question)}. Esperado: um texto não vazio.`,
      );
    }
    const answer = await this.questions.ask(
      asked,
      this.index.projectsArticleIds(projectIds),
      this.turnsOf(conversationId),
    );
    if (answer.coverage.indexed.length === 0) throw this.nothingIndexed(projectIds);
    return this.keep(conversationId, projectIds, asked, answer);
  }

  /** The conversation with each citation's situation as it is now, since articles and projects come and go. */
  read(conversationId: number): AskConversation {
    const stored = this.conversations.conversation(conversationId);
    if (!stored) {
      throw new AppError(
        'ERR_NOT_FOUND',
        'USER_ERROR',
        `Conversa não encontrada. Valor recebido: conversationId=${conversationId}. Esperado: o id de uma conversa existente.`,
      );
    }
    return { ...stored, messages: stored.messages.map((message) => this.readMessage(message)) };
  }

  private turnsOf(conversationId: number | null): AskTurn[] {
    if (conversationId === null) return [];
    const messages = this.conversations.conversation(conversationId)?.messages ?? [];
    const turns = messages.flatMap((message, i) => {
      const next = messages[i + 1];
      if (message.role !== 'user' || next?.answer === null || !next) return [];
      return [{ question: message.content, answer: claimsText(next.answer) }];
    });
    return turns.slice(-TURNS_SENT);
  }

  private nothingIndexed(projectIds: number[]): AppError {
    return new AppError(
      'ERR_NOTHING_INDEXED',
      'USER_ERROR',
      `Nenhum artigo destes projetos tem PDF indexado com o modelo de embeddings atual. Valor recebido: projectIds=${JSON.stringify(projectIds)}. Esperado: ao menos um artigo indexado; indexe os PDFs antes de perguntar.`,
    );
  }

  private keep(id: number | null, projectIds: number[], asked: string, answer: ProjectAnswer): AskConversation {
    const conversationId = id ?? this.conversations.create(titleFrom(asked));
    this.conversations.setProjects(conversationId, projectIds);
    const projects = this.conversations.projects(conversationId).map((project) => project.name);
    const step = { kind: 'search' as const, chunks: answer.chunksRead, articles: answer.articlesRead, projects };
    this.conversations.addExchange(conversationId, asked, { claims: answer.claims, steps: [step] });
    return this.read(conversationId);
  }

  private readMessage(message: StoredMessage): AskMessage {
    if (!message.answer) return { ...message, answer: null };
    const claims = message.answer.claims.map((claim) => ({
      ...claim,
      citations: claim.citations.map(
        (citation): AskReadCitation => ({
          ...citation,
          access: this.conversations.citationAccess(citation.articleId, citation.pdfPath),
        }),
      ),
    }));
    return { ...message, answer: { ...message.answer, claims } };
  }
}
