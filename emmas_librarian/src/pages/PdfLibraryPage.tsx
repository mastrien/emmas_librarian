import React, { useEffect, useState, useCallback } from 'react';
import { Search, Upload } from 'lucide-react';
import { useProjectService } from '../contexts/ServicesContext';
import { BackLink } from '../components/common/BackLink';
import { filterPdfs, type PdfFileRecord } from './PdfLibrary/pdfLibraryData';
import { PdfMetrics } from './PdfLibrary/PdfMetrics';
import { PdfTable } from './PdfLibrary/PdfTable';
import { PdfLinkDialog } from './PdfLibrary/PdfLinkDialog';
import { usePdfLink } from './PdfLibrary/usePdfLink';
import { useDialogs } from '../components/common/dialogs/DialogProvider';
import './PdfLibrary/pdfLibrary.css';

const LibraryHeader: React.FC<{ onUpload: () => void }> = ({ onUpload }) => (
  <div className="pdf-library-head">
    <div className="pdf-library-title">
      <BackLink to="/" label="Voltar aos projetos" />
      <div>
        <h1>Biblioteca Global de PDFs</h1>
        <p>Gerencie e deduplique de forma transparente todos os arquivos PDF salvos localmente.</p>
      </div>
    </div>
    <button className="btn-primary pdf-library-add" onClick={onUpload}>
      <Upload size={18} /> Adicionar PDF
    </button>
  </div>
);

const SearchBox: React.FC<{ value: string; onChange: (value: string) => void }> = ({ value, onChange }) => (
  <div className="pdf-search">
    <Search size={18} className="pdf-search-icon" />
    <input
      type="text"
      className="input-field pdf-search-input"
      placeholder="Pesquisar por nome do PDF ou título do artigo associado..."
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  </div>
);

// The stored PDFs, reloaded after every change.
function useStoredPdfs() {
  const projectService = useProjectService();
  const [pdfs, setPdfs] = useState<PdfFileRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setPdfs(await projectService.getStoredPdfs());
    } catch (err) {
      console.error('Erro ao carregar biblioteca de PDFs:', err);
    } finally {
      setLoading(false);
    }
  }, [projectService]);
  useEffect(() => {
    loadData();
  }, [loadData]);
  return { pdfs, loading, loadData, projectService };
}

/**
 * Every PDF stored by the app, across projects: what each one is linked to, linking it to another article, deleting
 * it, and adding a PDF directly to the library.
 *
 * @example <Route path="/pdfs" element={<PdfLibraryPage />} />
 */
export const PdfLibraryPage: React.FC = () => {
  const { pdfs, loading, loadData, projectService } = useStoredPdfs();
  const [searchTerm, setSearchTerm] = useState('');
  // The app's own windows, not window.confirm/alert (Arca 103/134).
  const { confirm, inform } = useDialogs();
  const link = usePdfLink(projectService, loadData, (message) => void inform({ title: 'Erro ao vincular', message }));

  const handleUploadDirectPdf = async () => {
    try {
      const filePath = await projectService.openPdfDialog();
      if (filePath) {
        await projectService.uploadPdfToLibrary(filePath);
        loadData();
      }
    } catch (err) {
      await inform({ title: 'Erro no upload', message: 'Erro ao realizar upload do PDF: ' + err });
    }
  };

  const handleDeletePdf = async (pdf: PdfFileRecord) => {
    const isShared = pdf.articles.length > 0;
    const warningMsg = isShared
      ? `Atenção: Este PDF está sendo usado em ${pdf.articles.length} artigo(s). Excluí-lo removerá permanentemente o arquivo físico e limpará cascata de destaques, anotações e indexadores de IA em todos os projetos associados. Deseja mesmo prosseguir?`
      : 'Deseja excluir permanentemente este PDF do sistema? Esta ação não pode ser desfeita.';
    const confirmed = await confirm({
      title: 'Excluir PDF',
      message: warningMsg,
      confirmLabel: 'Excluir PDF',
      danger: true,
    });
    if (confirmed) {
      try {
        await projectService.deletePdfLibraryRecord(pdf.file_path);
        loadData();
      } catch (err) {
        await inform({ title: 'Erro ao excluir', message: 'Erro ao excluir PDF: ' + err });
      }
    }
  };

  if (loading && pdfs.length === 0) {
    return <div className="p-8 text-center text-muted">Carregando Biblioteca de PDFs...</div>;
  }

  return (
    <div className="pdf-library">
      <LibraryHeader onUpload={handleUploadDirectPdf} />
      <PdfMetrics pdfs={pdfs} />
      <div className="glass-panel pdf-browser">
        <SearchBox value={searchTerm} onChange={setSearchTerm} />
        <PdfTable pdfs={filterPdfs(pdfs, searchTerm)} onLink={link.open} onDelete={handleDeletePdf} />
      </div>
      {link.pdf && (
        <PdfLinkDialog
          pdf={link.pdf}
          projects={link.projects}
          projectId={link.projectId}
          onProjectChange={link.pickProject}
          articles={link.articles}
          articleId={link.articleId}
          onArticleChange={link.setArticleId}
          onCancel={link.close}
          onConfirm={link.confirm}
        />
      )}
    </div>
  );
};
