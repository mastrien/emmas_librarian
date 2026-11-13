import React, { useEffect, useState, useCallback } from 'react';
import { failureNotice } from '../components/common/dialogs/failureNotice';
import { Search, Upload } from 'lucide-react';
import { useProjectService } from '../contexts/ServicesContext';
import { PageHeader } from '../components/common/PageHeader';
import { SegmentedControl, type SegmentedOption } from '../components/common/SegmentedControl';
import {
  PDF_SORTS,
  filterByUse,
  filterPdfs,
  libraryMetrics,
  sortPdfs,
  type PdfFileRecord,
  type PdfFilter,
  type PdfSort,
} from './PdfLibrary/pdfLibraryData';
import { PdfMetrics } from './PdfLibrary/PdfMetrics';
import { PdfTable } from './PdfLibrary/PdfTable';
import { PdfLinkDialog } from './PdfLibrary/PdfLinkDialog';
import { usePdfLink } from './PdfLibrary/usePdfLink';
import { useDialogs } from '../components/common/dialogs/DialogProvider';
import './PdfLibrary/pdfLibrary.css';

const SearchBox: React.FC<{ value: string; onChange: (value: string) => void }> = ({ value, onChange }) => (
  <div className="pdf-search">
    <Search size={16} className="pdf-search-icon" aria-hidden="true" />
    <input
      type="text"
      className="input-field pdf-search-input"
      placeholder="Nome do arquivo ou título do artigo"
      aria-label="Pesquisar PDFs"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  </div>
);

/** Todos / Reutilizados / Órfãos with their counts, and the order of the table (board 171). */
const LibraryFilters: React.FC<{
  pdfs: PdfFileRecord[];
  filter: PdfFilter;
  onFilter: (filter: PdfFilter) => void;
  sort: PdfSort;
  onSort: (sort: PdfSort) => void;
}> = ({ pdfs, filter, onFilter, sort, onSort }) => {
  const metrics = libraryMetrics(pdfs);
  const options: SegmentedOption<PdfFilter>[] = [
    { value: 'all', label: `Todos ${metrics.total}` },
    { value: 'shared', label: `Reutilizados ${metrics.shared}` },
    { value: 'orphans', label: `Órfãos ${metrics.orphans}` },
  ];
  return (
    <>
      <SegmentedControl label="Mostrar" value={filter} options={options} onChange={onFilter} />
      <label className="pdf-sort">
        Ordenar:
        <select className="pdf-sort__select" value={sort} onChange={(e) => onSort(e.target.value as PdfSort)}>
          {PDF_SORTS.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    </>
  );
};

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
  const [filter, setFilter] = useState<PdfFilter>('all');
  const [sort, setSort] = useState<PdfSort>('size');
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
      await inform(failureNotice('Não conseguimos enviar o PDF', 'O arquivo não foi adicionado à biblioteca.', err));
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
        await inform(failureNotice('Não conseguimos excluir o PDF', 'O arquivo continua na biblioteca.', err));
      }
    }
  };

  if (loading && pdfs.length === 0) {
    return <div className="p-8 text-center text-muted">Carregando Biblioteca de PDFs...</div>;
  }

  const shown = sortPdfs(filterByUse(filterPdfs(pdfs, searchTerm), filter), sort);

  return (
    <div className="pdf-library">
      <PageHeader
        title="Biblioteca de PDFs"
        subtitle="Todos os PDFs guardados neste computador, de todos os projetos"
        actions={
          <button type="button" className="btn-primary" onClick={handleUploadDirectPdf}>
            <Upload size={18} aria-hidden="true" /> Adicionar PDF
          </button>
        }
      />
      <PdfMetrics pdfs={pdfs} />
      <div className="pdf-filters">
        <SearchBox value={searchTerm} onChange={setSearchTerm} />
        <LibraryFilters pdfs={pdfs} filter={filter} onFilter={setFilter} sort={sort} onSort={setSort} />
      </div>
      <PdfTable pdfs={shown} onLink={link.open} onDelete={handleDeletePdf} />
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
