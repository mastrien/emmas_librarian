import type { IProjectService } from '../services/ProjectServiceInterface';

type Inform = (options: { title: string; message: string }) => Promise<void>;

// What went wrong, as the import error message always showed it: the error's text, or the value itself.
const errorText = (err: unknown): string => (err instanceof Error && err.message ? err.message : String(err));

/**
 * Imports a project (.emmapcarc) and returns its id, or null when the person cancelled the file dialog or the import
 * failed (the failure is told in a dialog naming `what`, "projeto" or the dropped file).
 *
 * @example const id = await importProjectWithFeedback(service, inform); if (id) navigate(`/projects/${id}`);
 */
export async function importProjectWithFeedback(
  service: Pick<IProjectService, 'importProject'>,
  inform: Inform,
  options: { path?: string; what?: string } = {},
): Promise<number | null> {
  try {
    return (await service.importProject(options.path)) || null;
  } catch (err) {
    await inform({
      title: 'Erro ao importar',
      message: `Erro ao importar ${options.what ?? 'projeto'}: ${errorText(err)}`,
    });
    return null;
  }
}
