import type { ConfirmOptions } from './DialogProvider';

/**
 * The question before unlinking an article's PDF, asked the same way from the project list, the article details and
 * the reader (it was written out in each, Arca 134).
 *
 * @example if (await confirm(UNLINK_PDF_QUESTION)) await projectService.unlinkPdf(article.id);
 */
export const UNLINK_PDF_QUESTION: ConfirmOptions = {
  title: 'Desvincular PDF',
  message: 'Deseja realmente desvincular o PDF deste artigo? O arquivo físico será removido do armazenamento local.',
  confirmLabel: 'Desvincular',
  danger: true,
};
