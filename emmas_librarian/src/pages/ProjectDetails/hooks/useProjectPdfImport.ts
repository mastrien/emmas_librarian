import { useState } from 'react';
import { useProjectService } from '../../../contexts/ServicesContext';
import { droppedFilePath } from '../../../utils/droppedFilePath';
import { useDialogs } from '../../../components/common/dialogs/DialogProvider';

interface PdfImportOptions {
  projectId: number | null;
  onImported: () => Promise<void>;
  /** Drops are ignored while another overlay (e.g. the quick-access modal) owns drag and drop. */
  isDropBlocked: () => boolean;
}

/**
 * Imports PDFs as new articles, either picked in the native dialog or dropped on the page.
 *
 * Usage:
 *   const pdfImport = useProjectPdfImport({ projectId, onImported: reload, isDropBlocked: () => false });
 *   <div {...pdfImport.dropZone}>...</div>
 */
export function useProjectPdfImport({ projectId, onImported, isDropBlocked }: PdfImportOptions) {
  const projectService = useProjectService();
  const { inform } = useDialogs();
  const [isDragging, setIsDragging] = useState(false);
  const informFailure = (err: unknown) =>
    inform({ title: 'Erro ao importar', message: `Erro ao importar PDFs: ${(err as Error)?.message || err}` });

  const importPaths = async (filePaths: string[]) => {
    if (projectId === null || filePaths.length === 0) return;
    try {
      const count = await projectService.createArticlesFromPdfs(projectId, filePaths);
      await onImported();
      await inform({ title: 'PDFs importados', message: `${count} artigo(s) importado(s) com sucesso.` });
    } catch (err) {
      await informFailure(err);
    }
  };

  const importFromDialog = async () => {
    if (projectId === null) return;
    try {
      const filePaths = await projectService.openMultiplePdfsDialog();
      await importPaths(filePaths ?? []);
    } catch (err) {
      await informFailure(err);
    }
  };

  const dropZone = {
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault();
      if (isDropBlocked()) return;
      const types = Array.from(e.dataTransfer?.types || []);
      // Some platforms report no types while dragging files from the OS.
      if (types.length === 0 || types.includes('Files')) setIsDragging(true);
    },
    onDragLeave: (e: React.DragEvent) => {
      e.preventDefault();
      // Moving over a child element fires dragleave on the container; only hide when really leaving.
      if (e.relatedTarget && e.currentTarget.contains(e.relatedTarget as Node)) return;
      setIsDragging(false);
    },
    onDrop: async (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const pdfs = Array.from(e.dataTransfer.files).filter((f) => f.name.toLowerCase().endsWith('.pdf'));
      await importPaths(pdfs.map(droppedFilePath));
    },
  };

  return { isDragging, importFromDialog, dropZone };
}
