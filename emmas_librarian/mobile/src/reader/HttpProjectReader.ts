import { IpcChannel } from '../../../src/types';
import type {
  Annotation,
  Article,
  ArticleCategory,
  DiaryEntry,
  Highlight,
  Project,
  ProjectCategory,
  ProjectDocument,
} from '../../../src/types';
import type { ProjectReader, ProjectWriter } from './ProjectReader';

/** Runs one command on the desktop and answers its result; bytes for the commands that answer a file. */
export interface DesktopTransport {
  run(channel: string, args?: unknown[]): Promise<unknown>;
  runForBytes(channel: string, args?: unknown[]): Promise<Uint8Array>;
}

/** A refusal or failure answered by the desktop, with its code (ERR_REMOTE_UNAUTHORIZED, ERR_NOT_FOUND, ...). */
export class DesktopError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'DesktopError';
  }
}

interface DesktopReply {
  ok: boolean;
  result?: unknown;
  error?: { code: string; message: string };
}

async function failureOf(response: Response): Promise<DesktopError> {
  const reply = (await response.json().catch(() => ({}))) as DesktopReply;
  const { code = 'ERR_INTERNAL', message = `O computador respondeu ${response.status}.` } = reply.error ?? {};
  return new DesktopError(code, message, response.status);
}

/**
 * The real transport: HTTPS to the desktop that served this page, with the device's token.
 *
 * Usage:
 *   const transport = fetchTransport(token);
 *   await transport.run('projects:getAll');
 */
export function fetchTransport(token: string, send: typeof fetch = (...args) => fetch(...args)): DesktopTransport {
  const call = async (channel: string, args: unknown[]) => {
    const response = await send(`/api/commands/${encodeURIComponent(channel)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ args }),
    });
    if (!response.ok) throw await failureOf(response);
    return response;
  };
  return {
    run: async (channel, args = []) => ((await (await call(channel, args)).json()) as DesktopReply).result,
    runForBytes: async (channel, args = []) => new Uint8Array(await (await call(channel, args)).arrayBuffer()),
  };
}

/**
 * The library as the desktop serves it, live. Reads go through the commands a paired device may run;
 * the writes are the four the desktop allows.
 *
 * Usage:
 *   const reader = new HttpProjectReader(fetchTransport(token));
 *   await reader.writer.saveDiaryEntry(3, '2026-11-14', 'Li dois artigos.');
 */
export class HttpProjectReader implements ProjectReader {
  readonly source = 'desktop';
  readonly writer: ProjectWriter;

  constructor(private readonly desktop: DesktopTransport) {
    this.writer = {
      saveDiaryEntry: (projectId, date, content) => this.send(IpcChannel.DIARY_SAVE, projectId, date, content),
      addQuickLink: (projectId, title, url) =>
        this.send(IpcChannel.PROJECT_DOCUMENTS_CREATE, projectId, title, url, null, null),
      markDocumentOpened: (documentId) => this.send(IpcChannel.PROJECT_DOCUMENTS_MARK_OPENED, documentId),
      setArticleCategory: (articleId, categoryId, value) =>
        this.send(IpcChannel.CATEGORIES_SET_ARTICLE, articleId, categoryId, value),
    };
  }

  private ask<T>(channel: IpcChannel, ...args: unknown[]): Promise<T> {
    return this.desktop.run(channel, args) as Promise<T>;
  }

  private async send(channel: IpcChannel, ...args: unknown[]): Promise<void> {
    await this.desktop.run(channel, args);
  }

  listProjects = () => this.ask<Project[]>(IpcChannel.PROJECTS_GET_ALL);
  listArticles = (projectId: number) => this.ask<Article[]>(IpcChannel.ARTICLES_GET_BY_PROJECT, projectId);
  listHighlights = (articleId: number) => this.ask<Highlight[]>(IpcChannel.HIGHLIGHTS_GET, articleId);
  listAnnotations = (articleId: number) => this.ask<Annotation[]>(IpcChannel.ANNOTATIONS_GET, articleId);
  listDiary = (projectId: number) => this.ask<DiaryEntry[]>(IpcChannel.DIARY_GET_ALL, projectId);
  listDocuments = (projectId: number) => this.ask<ProjectDocument[]>(IpcChannel.PROJECT_DOCUMENTS_GET, projectId);
  listCategories = (projectId: number) => this.ask<ProjectCategory[]>(IpcChannel.CATEGORIES_GET_PROJECT, projectId);
  listArticleCategories = (articleId: number) =>
    this.ask<ArticleCategory[]>(IpcChannel.CATEGORIES_GET_ARTICLE, articleId);

  async getArticle(articleId: number): Promise<Article | null> {
    return (await this.ask<Article | undefined>(IpcChannel.ARTICLES_GET_ONE, articleId)) ?? null;
  }

  // The desktop refuses (ERR_NOT_FOUND) when the article has no PDF on disk: for the screens that is "no PDF".
  async readPdf(articleId: number): Promise<Uint8Array | null> {
    try {
      return await this.desktop.runForBytes(IpcChannel.PDF_GET, [articleId]);
    } catch (error) {
      if (error instanceof DesktopError && error.code === 'ERR_NOT_FOUND') return null;
      throw error;
    }
  }
}
