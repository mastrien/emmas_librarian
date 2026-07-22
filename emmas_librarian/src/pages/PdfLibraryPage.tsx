import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  Trash2,
  Link2,
  Search,
  Database,
  AlertTriangle,
  ExternalLink,
  Clock,
  ArrowLeft,
  Info,
  Upload,
} from 'lucide-react';
import { useProjectService } from '../contexts/ServicesContext';
import { Article, Project } from '../types';

interface PdfFileRecord {
  id: number;
  file_path: string;
  file_hash: string;
  filename: string;
  file_size: number;
  created_at: string;
  articles: Array<{
    article_id: number;
    article_title: string;
    project_id: number;
    project_name: string;
  }>;
}

export const PdfLibraryPage: React.FC = () => {
  const projectService = useProjectService();
  const navigate = useNavigate();

  const [pdfs, setPdfs] = useState<PdfFileRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  // Link Modal States
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [selectedPdf, setSelectedPdf] = useState<PdfFileRecord | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | ''>('');
  const [projectArticles, setProjectArticles] = useState<Article[]>([]);
  const [selectedArticleId, setSelectedArticleId] = useState<number | ''>('');

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const data = await projectService.getStoredPdfs();
      setPdfs(data);
    } catch (err) {
      console.error('Erro ao carregar biblioteca de PDFs:', err);
    } finally {
      setLoading(false);
    }
  }, [projectService]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateStr: string): string => {
    if (!dateStr) return '-';
    try {
      return new Date(dateStr).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (e) {
      return dateStr;
    }
  };

  const handleUploadDirectPdf = async () => {
    try {
      const filePath = await projectService.openPdfDialog();
      if (filePath) {
        await projectService.uploadPdfToLibrary(filePath);
        loadData();
      }
    } catch (err) {
      alert('Erro ao realizar upload do PDF: ' + err);
    }
  };

  const handleOpenLinkModal = async (pdf: PdfFileRecord) => {
    setSelectedPdf(pdf);
    try {
      const projList = await projectService.getProjects();
      setProjects(projList);
      setIsLinkModalOpen(true);
    } catch (err) {
      console.error('Erro ao carregar projetos:', err);
    }
  };

  const handleProjectChange = async (projId: number) => {
    setSelectedProjectId(projId);
    setSelectedArticleId('');
    try {
      const arts = await projectService.getArticles(projId);
      setProjectArticles(arts.filter((a) => !a.local_file_path));
    } catch (err) {
      console.error('Erro ao carregar artigos:', err);
    }
  };

  const handleConfirmLink = async () => {
    if (!selectedArticleId || !selectedPdf) return;
    try {
      await projectService.linkPdfToArticle(Number(selectedArticleId), selectedPdf.file_path);
      setIsLinkModalOpen(false);
      resetLinkModal();
      loadData();
    } catch (err) {
      alert('Erro ao vincular PDF: ' + err);
    }
  };

  const resetLinkModal = () => {
    setSelectedPdf(null);
    setSelectedProjectId('');
    setProjectArticles([]);
    setSelectedArticleId('');
  };

  const handleDeletePdf = async (pdf: PdfFileRecord) => {
    const isShared = pdf.articles.length > 0;
    const warningMsg = isShared
      ? `Atenção: Este PDF está sendo usado em ${pdf.articles.length} artigo(s). Excluí-lo removerá permanentemente o arquivo físico e limpará cascata de destaques, anotações e indexadores de IA em todos os projetos associados. Deseja mesmo prosseguir?`
      : 'Deseja excluir permanentemente este PDF do sistema? Esta ação não pode ser desfeita.';
    
    if (window.confirm(warningMsg)) {
      try {
        await projectService.deletePdfLibraryRecord(pdf.file_path);
        loadData();
      } catch (err) {
        alert('Erro ao excluir PDF: ' + err);
      }
    }
  };

  const filteredPdfs = pdfs.filter((pdf) => {
    const matchesFile = pdf.filename.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesArticle = pdf.articles.some((a) =>
      a.article_title.toLowerCase().includes(searchTerm.toLowerCase()),
    );
    return matchesFile || matchesArticle;
  });

  const totalSize = pdfs.reduce((acc, curr) => acc + curr.file_size, 0);
  const sharedCount = pdfs.filter((p) => p.articles.length > 1).length;
  const orphanCount = pdfs.filter((p) => p.articles.length === 0).length;

  if (loading && pdfs.length === 0) {
    return <div className="p-8 text-center text-muted">Carregando Biblioteca de PDFs...</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            onClick={() => navigate('/')}
            title="Voltar"
            style={{
              background: 'transparent',
              border: 'none',
              padding: '0.4rem',
              cursor: 'pointer',
              color: 'var(--text-main)',
              display: 'flex',
              alignItems: 'center',
              borderRadius: 'var(--radius-md)',
            }}
          >
            <ArrowLeft size={22} />
          </button>
          <div>
            <h1 style={{ margin: 0, fontSize: '2rem', fontWeight: 800 }}>Biblioteca Global de PDFs</h1>
            <p style={{ color: 'var(--text-muted)', margin: '0.25rem 0 0 0' }}>
              Gerencie e deduplique de forma transparente todos os arquivos PDF salvos localmente.
            </p>
          </div>
        </div>
        <button
          className="btn-primary"
          onClick={handleUploadDirectPdf}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
          <Upload size={18} /> Adicionar PDF
        </button>
      </div>

      {/* Metrics Dashboard */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
        <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: 'var(--radius-lg)' }}>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>TOTAL DE ARQUIVOS</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: '0.5rem', color: 'var(--color-primary)' }}>{pdfs.length}</div>
        </div>
        <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: 'var(--radius-lg)' }}>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600 }}>ESPAÇO UTILIZADO</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: '0.5rem', color: 'var(--color-success)' }}>{formatBytes(totalSize)}</div>
        </div>
        <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: 'var(--radius-lg)' }}>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600 }}>PDFs REUTILIZADOS</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: '0.5rem', color: 'var(--color-warning)' }}>{sharedCount}</div>
        </div>
        <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: 'var(--radius-lg)' }}>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600 }}>PDFs ÓRFÃOS</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: '0.5rem', color: '#ef4444' }}>{orphanCount}</div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: 'var(--radius-lg)', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '1rem', position: 'relative' }}>
          <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="input-field"
            placeholder="Pesquisar por nome do PDF ou título do artigo associado..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ paddingLeft: '2.75rem', flexGrow: 1 }}
          />
        </div>

        {/* PDF Table */}
        <div style={{ overflowX: 'auto', width: '100%' }}>
          {filteredPdfs.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              Nenhum arquivo PDF encontrado.
            </div>
          ) : (
            <table className="table" style={{ width: '100%', minWidth: '750px', tableLayout: 'fixed', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                  <th style={{ padding: '1rem 0.5rem', width: '28%' }}>Arquivo</th>
                  <th style={{ padding: '1rem 0.5rem', width: '12%', whiteSpace: 'nowrap' }}>Tamanho</th>
                  <th style={{ padding: '1rem 0.5rem', width: '18%', whiteSpace: 'nowrap' }}>Data de Adição</th>
                  <th style={{ padding: '1rem 0.5rem', width: '24%' }}>Artigos e Projetos Vinculados</th>
                  <th style={{ padding: '1rem 0.5rem', width: '18%', textAlign: 'right', whiteSpace: 'nowrap' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredPdfs.map((pdf) => (
                  <tr key={pdf.file_path} style={{ borderBottom: '1px solid var(--border-color)', verticalAlign: 'top' }}>
                    <td style={{ padding: '1rem 0.5rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <span
                        title={pdf.filename}
                        style={{
                          fontWeight: 600,
                          maxWidth: '100%',
                          display: 'inline-block',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          verticalAlign: 'bottom',
                        }}
                      >
                        {pdf.filename}
                      </span>
                    </td>
                    <td style={{ padding: '1rem 0.5rem', color: 'var(--text-main)', whiteSpace: 'nowrap' }}>{formatBytes(pdf.file_size)}</td>
                    <td style={{ padding: '1rem 0.5rem', color: 'var(--text-muted)', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                      {formatDate(pdf.created_at)}
                    </td>
                    <td style={{ padding: '1rem 0.5rem', overflow: 'hidden' }}>
                      {pdf.articles.length === 0 ? (
                        <span style={{ fontSize: '0.75rem', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                          <AlertTriangle size={12} /> Órfão (Nenhum vínculo)
                        </span>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', overflow: 'hidden' }}>
                          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                            {pdf.articles.length === 1 ? 'Utilizado em 1 artigo' : `Utilizado em ${pdf.articles.length} artigos`}
                          </span>
                          {pdf.articles.map((art) => (
                            <div key={art.article_id} style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', overflow: 'hidden' }}>
                              <span
                                onClick={() => navigate(`/articles/${art.article_id}`)}
                                title={art.article_title}
                                style={{
                                  fontSize: '0.85rem',
                                  color: 'var(--color-primary)',
                                  cursor: 'pointer',
                                  textDecoration: 'underline',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.2rem',
                                  maxWidth: '100%',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                }}
                              >
                                {art.article_title} <ExternalLink size={10} style={{ flexShrink: 0 }} />
                              </span>
                              <span
                                onClick={() => navigate(`/projects/${art.project_id}`)}
                                title={art.project_name}
                                style={{
                                  fontSize: '0.75rem',
                                  color: 'var(--text-muted)',
                                  cursor: 'pointer',
                                  maxWidth: '100%',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  display: 'inline-block',
                                }}
                              >
                                Projeto: <strong>{art.project_name}</strong>
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '1rem 0.5rem', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'flex-end', whiteSpace: 'nowrap', flexShrink: 0 }}>
                        {pdf.articles.length > 0 && (
                          <button
                            className="btn-secondary"
                            onClick={() => navigate(`/articles/${pdf.articles[0].article_id}`)}
                            title="Visualizar no Leitor"
                            style={{ padding: '0.3rem 0.5rem', fontSize: '0.8rem' }}
                          >
                            Leitor
                          </button>
                        )}
                        <button
                          className="btn-secondary"
                          onClick={() => handleOpenLinkModal(pdf)}
                          title="Vincular a outro Artigo"
                          style={{ padding: '0.3rem 0.5rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.2rem' }}
                        >
                          <Link2 size={13} /> Vincular
                        </button>
                        <button
                          className="btn-secondary"
                          onClick={() => handleDeletePdf(pdf)}
                          title="Excluir PDF"
                          style={{ padding: '0.3rem 0.5rem', fontSize: '0.8rem', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)', background: 'rgba(239, 68, 68, 0.05)' }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Link Modal */}
      {isLinkModalOpen && selectedPdf && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(4px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div className="card fade-in" style={{ width: '90%', maxWidth: '500px', padding: '2rem' }}>
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.25rem', fontWeight: 700 }}>Vincular PDF a um Artigo</h3>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
              Selecione o projeto e o artigo correspondente para vincular o PDF: <strong style={{ color: 'var(--text-main)' }}>{selectedPdf.filename}</strong>
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginBottom: '2rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>PROJETO</label>
                <select
                  className="input-field"
                  value={selectedProjectId}
                  onChange={(e) => handleProjectChange(Number(e.target.value))}
                >
                  <option value="">-- Selecione um Projeto --</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              {selectedProjectId !== '' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>ARTIGO (APENAS SEM PDF)</label>
                  {projectArticles.length === 0 ? (
                    <div style={{ fontSize: '0.9rem', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.5rem 0' }}>
                      <Info size={14} /> Nenhum artigo sem PDF neste projeto.
                    </div>
                  ) : (
                    <select
                      className="input-field"
                      value={selectedArticleId}
                      onChange={(e) => setSelectedArticleId(Number(e.target.value))}
                    >
                      <option value="">-- Selecione um Artigo --</option>
                      {projectArticles.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.title}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                className="btn-secondary"
                onClick={() => {
                  setIsLinkModalOpen(false);
                  resetLinkModal();
                }}
              >
                Cancelar
              </button>
              <button
                className="btn-primary"
                onClick={handleConfirmLink}
                disabled={!selectedArticleId}
              >
                Vincular PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
