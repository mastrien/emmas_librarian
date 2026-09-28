import { describeError } from './describeError';

/**
 * Runs an export and tells the user how it went: where the file was saved, or why it failed. A null path means
 * the save dialog was cancelled, which needs no message.
 *
 * Usage:
 *   await exportWithFeedback(() => projectService.exportCsv(project.id), 'CSV');
 *   // "CSV exportado com sucesso para: C:\...\project_1_export.csv"
 */
export async function exportWithFeedback(save: () => Promise<string | null>, kind: string): Promise<void> {
  try {
    const savedPath = await save();
    if (savedPath) alert(`${kind} exportado com sucesso para: ${savedPath}`);
  } catch (err) {
    alert(`Erro ao exportar ${kind}: ${describeError(err)}`);
  }
}
