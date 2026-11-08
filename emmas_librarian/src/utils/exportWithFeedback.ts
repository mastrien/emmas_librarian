import { describeError } from './describeError';
import type { Dialogs } from '../components/common/dialogs/DialogProvider';

/** Window titles of the two outcomes; the E2E answers them by these names. */
export const EXPORT_DONE_TITLE = 'Exportação concluída';
export const EXPORT_FAILED_TITLE = 'Erro ao exportar';

/**
 * Runs an export and tells the user how it went, in the app's message window: where the file was saved, or why it
 * failed. A null path means the save dialog was cancelled, which needs no message.
 *
 * Usage:
 *   const { inform } = useDialogs();
 *   await exportWithFeedback(() => projectService.exportCsv(project.id), 'CSV', inform);
 *   // "CSV exportado com sucesso para: C:\...\project_1_export.csv"
 */
export async function exportWithFeedback(
  save: () => Promise<string | null>,
  kind: string,
  inform: Dialogs['inform'],
): Promise<void> {
  try {
    const savedPath = await save();
    if (savedPath)
      await inform({ title: EXPORT_DONE_TITLE, message: `${kind} exportado com sucesso para: ${savedPath}` });
  } catch (err) {
    await inform({ title: EXPORT_FAILED_TITLE, message: `Erro ao exportar ${kind}: ${describeError(err)}` });
  }
}
