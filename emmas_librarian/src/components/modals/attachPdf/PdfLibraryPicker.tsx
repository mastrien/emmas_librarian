import React, { useEffect, useState } from 'react';
import { ArrowLeft, FileText, Search } from 'lucide-react';
import { useProjectService } from '../../../contexts/ServicesContext';
import { formatBytes } from '../../../utils/formatters';
import { Button } from '../../common/Button';
import './attachPdf.css';

interface StoredPdf {
  file_path: string;
  filename: string;
  file_size: number;
}

interface PdfLibraryPickerProps {
  onLink: (filePath: string) => void;
  onBack: () => void;
}

/**
 * The library view of the "PDF do artigo" window: the PDFs already stored, filtered by name, each with a way to link it.
 *
 * @example <PdfLibraryPicker onLink={(path) => link(path)} onBack={() => setView('options')} />
 */
export const PdfLibraryPicker: React.FC<PdfLibraryPickerProps> = ({ onLink, onBack }) => {
  const projectService = useProjectService();
  const [pdfs, setPdfs] = useState<StoredPdf[]>([]);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    projectService
      .getStoredPdfs()
      .then(setPdfs)
      .catch((err: unknown) => console.error('Erro ao buscar biblioteca de PDFs:', err))
      .finally(() => setLoading(false));
  }, [projectService]);

  const shown = pdfs.filter((pdf) => pdf.filename.toLowerCase().includes(filter.toLowerCase()));

  return (
    <div className="attach-pdf">
      <label className="pdf-pick__search">
        <Search size={16} aria-hidden="true" />
        <input
          type="text"
          className="input-field"
          placeholder="Pesquisar PDFs armazenados..."
          aria-label="Pesquisar PDFs armazenados"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </label>
      {loading && <div className="pdf-pick__empty">Carregando biblioteca...</div>}
      {!loading && shown.length === 0 && (
        <div className="pdf-pick__empty">Nenhum PDF encontrado na biblioteca global.</div>
      )}
      {shown.length > 0 && (
        <div className="pdf-pick__list">
          {shown.map((pdf) => (
            <div key={pdf.file_path} className="pdf-pick__row">
              <FileText size={16} aria-hidden="true" color="var(--color-primary-text)" />
              <div className="pdf-pick__name">
                <div className="pdf-pick__file">{pdf.filename}</div>
                <div className="pdf-pick__size">{formatBytes(pdf.file_size)}</div>
              </div>
              <Button size="sm" title="Vincular este PDF" onClick={() => onLink(pdf.file_path)}>
                Vincular
              </Button>
            </div>
          ))}
        </div>
      )}
      <Button variant="ghost" onClick={onBack}>
        <ArrowLeft size={16} aria-hidden="true" /> Voltar para as opções
      </Button>
    </div>
  );
};
