import React, { useEffect, useState, useCallback } from 'react';
import { X, Search, FileText, Upload, Link2, Info } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useProjectService } from '../../contexts/ServicesContext';

interface AttachPdfModalProps {
  isOpen: boolean;
  articleId: number;
  articleTitle: string;
  onClose: () => void;
  onAttached: () => void;
}

interface StoredPdf {
  id: number;
  file_path: string;
  file_hash: string;
  filename: string;
  file_size: number;
  created_at: string;
}

export const AttachPdfModal: React.FC<AttachPdfModalProps> = ({
  isOpen,
  articleId,
  articleTitle,
  onClose,
  onAttached,
}) => {
  if (!isOpen) return null;

  const projectService = useProjectService();
  const [pdfs, setPdfs] = useState<StoredPdf[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'options' | 'library'>('options');

  const loadPdfs = useCallback(async () => {
    try {
      setLoading(true);
      const data = await projectService.getStoredPdfs();
      setPdfs(data);
    } catch (err) {
      console.error('Erro ao buscar biblioteca de PDFs:', err);
    } finally {
      setLoading(false);
    }
  }, [projectService]);

  useEffect(() => {
    if (viewMode === 'library') {
      loadPdfs();
    }
  }, [viewMode, loadPdfs]);

  const handleUploadNewFile = async () => {
    try {
      const filePath = await projectService.openPdfDialog();
      if (filePath) {
        await projectService.uploadPdf(articleId, filePath);
        onAttached();
        onClose();
      }
    } catch (err) {
      alert('Erro ao realizar upload do PDF: ' + err);
    }
  };

  const handleLinkExisting = async (filePath: string) => {
    try {
      await projectService.linkPdfToArticle(articleId, filePath);
      onAttached();
      onClose();
    } catch (err) {
      alert('Erro ao vincular PDF existente: ' + err);
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const filteredPdfs = pdfs.filter((pdf) =>
    pdf.filename.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        backdropFilter: 'blur(4px)',
        zIndex: 100000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        className="card fade-in"
        style={{
          width: '90%',
          maxWidth: '550px',
          maxHeight: '80vh',
          background: 'var(--bg-surface)',
          padding: '2.5rem',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <button
          onClick={onClose}
          style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
        >
          <X size={24} />
        </button>

        <div style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.4rem', fontWeight: 800 }}>Anexar PDF ao Artigo</h3>
          <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.9rem' }}>
            Artigo: <strong style={{ color: 'var(--text-main)' }}>{articleTitle}</strong>
          </p>
        </div>

        {viewMode === 'options' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', margin: '1.5rem 0' }}>
            <button
              onClick={handleUploadNewFile}
              className="btn-primary"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.75rem',
                padding: '1.25rem',
                fontSize: '1rem',
                fontWeight: 600,
                borderRadius: 'var(--radius-lg)',
              }}
            >
              <Upload size={20} /> Upload do Computador
            </button>
            <button
              onClick={() => setViewMode('library')}
              className="btn-secondary"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.75rem',
                padding: '1.25rem',
                fontSize: '1rem',
                fontWeight: 600,
                borderRadius: 'var(--radius-lg)',
              }}
            >
              <Link2 size={20} /> Selecionar da Biblioteca
            </button>
          </div>
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0, gap: '1rem' }}>
            <div style={{ display: 'flex', gap: '1rem', position: 'relative' }}>
              <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                className="input-field"
                placeholder="Pesquisar PDFs armazenados..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ paddingLeft: '2.5rem', flexGrow: 1 }}
              />
            </div>

            {loading ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', flex: 1 }}>
                Carregando biblioteca...
              </div>
            ) : filteredPdfs.length === 0 ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', flex: 1 }}>
                Nenhum PDF encontrado na biblioteca global.
              </div>
            ) : (
              <div style={{ flex: 1, overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '0.5rem' }}>
                {filteredPdfs.map((pdf) => (
                  <div
                    key={pdf.file_path}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.6rem 0.5rem',
                      borderBottom: '1px solid var(--border-color)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, overflow: 'hidden' }}>
                      <FileText size={16} color="var(--color-primary)" style={{ flexShrink: 0 }} />
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-main)' }}>{pdf.filename}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{formatBytes(pdf.file_size)}</div>
                      </div>
                    </div>
                    <button
                      className="btn-secondary"
                      onClick={() => handleLinkExisting(pdf.file_path)}
                      title="Vincular este PDF"
                      style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.2rem' }}
                    >
                      <Link2 size={12} /> Vincular
                    </button>
                  </div>
                ))}
              </div>
            )}

            <button className="btn-secondary" onClick={() => setViewMode('options')} style={{ marginTop: '0.5rem' }}>
              Voltar para Opções
            </button>
          </div>
        )}

        {viewMode === 'options' && (
          <button className="btn-secondary" onClick={onClose} style={{ marginTop: '1rem' }}>
            Fechar
          </button>
        )}
      </div>
    </div>,
    document.body
  );
};
