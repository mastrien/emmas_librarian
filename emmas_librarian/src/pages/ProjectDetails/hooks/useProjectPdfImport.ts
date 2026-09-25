import { useState } from 'react';
import { useProjectService } from '../../../contexts/ServicesContext';

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
  const [isDragging, setIsDragging] = useState(false);

  const importPaths = async (filePaths: string[]) => {
    if (projectId === null || filePaths.length === 0) return;
    try {
      const count = await projectService.createArticlesFromPdfs(projectId, filePaths);
      alert(`${count} artigo(s) importado(s) com sucesso.`);
      await onImported();
    } catch (err) {
      alert(`Erro ao importar PDFs: ${(err as Error)?.message || err}`);
    }
  };

  const importFromDialog = async () => {
    if (projectId === null) return;
    try {
      const filePaths = await projectService.openMultiplePdfsDialog();
      await importPaths(filePaths ?? []);
    } catch (err) {
      alert(`Erro ao importar PDFs: ${(err as Error)?.message || err}`);
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
      await importPaths(pdfs.map(resolveFilePath));
    },
  };

  return { isDragging, importFromDialog, dropZone };
}

// Electron's sandboxed renderer exposes file paths only through the preload bridge.
function resolveFilePath(file: File): string {
  if (window.electronAPI?.getPathForFile) return window.electronAPI.getPathForFile(file);
  return (file as File & { path?: string }).path || file.name;
}
