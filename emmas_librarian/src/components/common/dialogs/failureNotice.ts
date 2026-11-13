import { describeError } from '../../../utils/describeError';
import type { InformOptions } from './DialogProvider';

/**
 * A notice for something that failed (board 181): the plain sentence in the window, and what the program said folded
 * under "Detalhes técnicos", instead of pasting the raw error into the sentence ("Erro ao importar: Error: ENOENT…").
 *
 * @example await inform(failureNotice('Não conseguimos importar', 'Os artigos não foram importados.', err));
 */
export function failureNotice(title: string, message: string, err: unknown): InformOptions {
  return { title, message, tone: 'danger', details: describeError(err) };
}
