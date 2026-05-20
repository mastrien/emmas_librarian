import React, { useEffect, useState, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { projectService } from '../services/api';
import { Project, Article } from '../types';
import { ArrowLeft, ExternalLink, FileText, Calendar, Search, Download, Upload, Loader2, CheckCircle, Archive, History, Edit2, Trash2, Check, X as XIcon, BookOpen, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { createPortal } from 'react-dom';
import { SearchHistoryModal } from '../components/SearchHistoryModal';
import { DiarySection } from '../components/DiarySection';

const ArchiveModal = ({ isOpen, onClose, onSubmit }: { isOpen: boolean, onClose: () => void, onSubmit: (note: string) => void }) => {
  const [note, setNote] = useState('');

  if (!isOpen) return null;

  return createPortal(
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999 }}>
      <div className="card fade-in" style={{ padding: '2rem', width: '400px', background: 'var(--bg-main)' }}>
        <h3 style={{ margin: '0 0 1rem 0' }}>Motivo do Arquivamento (Opcional)</h3>
        <form onSubmit={(e) => { e.preventDefault(); onSubmit(note); }}>
          <textarea 
            autoFocus
            value={note} 
            onChange={(e) => setNote(e.target.value)}
            placeholder="Por que este artigo não é relevante?"
            style={{ 
              width: '100%', height: '100px', padding: '0.75rem', 
              borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)',
              outline: 'none', resize: 'none', marginBottom: '1rem',
              fontFamily: 'inherit',
              background: 'var(--bg-surface)',
              color: 'var(--text-main)'
            }}
          />
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
            <button type="submit" className="btn-primary" style={{ background: 'var(--color-danger)', color: '#ffffff' }}>Confirmar Arquivamento</button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};

const ManualArticleModal = ({ isOpen, onClose, onSubmit }: { 
  isOpen: boolean; 
  onClose: () => void; 
  onSubmit: (data: any, filePath?: string) => Promise<void>; 
}) => {
  const [title, setTitle] = useState('');
  const [authors, setAuthors] = useState('');
  const [year, setYear] = useState('');
  const [doi, setDoi] = useState('');
  const [journal, setJournal] = useState('');
  const [abstract, setAbstract] = useState('');
  const [filePath, setFilePath] = useState<string | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setTitle('');
      setAuthors('');
      setYear('');
      setDoi('');
      setJournal('');
      setAbstract('');
      setFilePath(undefined);
      setSubmitting(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSelectFile = async () => {
    try {
      const selected = await projectService.openPdfDialog();
      if (selected) {
        setFilePath(selected);
      }
    } catch (err) {
      alert('Erro ao selecionar o arquivo PDF');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      alert('O título é obrigatório.');
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit({
        title: title.trim(),
        authors: authors.trim(),
        year: year.trim() || undefined,
        doi: doi.trim() || undefined,
        journal: journal.trim() || undefined,
        abstract: abstract.trim() || undefined
      }, filePath);
      onClose();
    } catch (err: any) {
      alert(`Erro ao adicionar artigo: ${err.message || err}`);
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999 }}>
      <div className="card fade-in" style={{ padding: '2rem', width: '550px', maxWidth: '95%', maxHeight: '90vh', overflowY: 'auto', background: 'var(--bg-main)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h3 style={{ margin: 0 }}>Adicionar Artigo Avulso</h3>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <XIcon size={20} />
          </button>
        </div>
        
        <div style={{ marginBottom: '1rem', padding: '0.75rem', borderRadius: 'var(--radius-md)', background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)', fontSize: '0.85rem', color: 'var(--color-danger)', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <span>⚠️</span>
          <span><strong>Atenção:</strong> Artigos adicionados de forma avulsa podem conter metadados incorretos ou incompletos.</span>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem', color: 'var(--text-muted)' }}>Título *</label>
            <input 
              type="text" 
              required
              placeholder="Ex: A New Approach to Bibliometrics"
              value={title} 
              onChange={(e) => setTitle(e.target.value)}
              style={{ 
                width: '100%', padding: '0.6rem 0.8rem', 
                borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)',
                outline: 'none', background: 'var(--bg-surface)', color: 'var(--text-main)',
                fontFamily: 'inherit'
              }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem', color: 'var(--text-muted)' }}>Autores</label>
              <input 
                type="text" 
                placeholder="Ex: John Doe, Jane Smith"
                value={authors} 
                onChange={(e) => setAuthors(e.target.value)}
                style={{ 
                  width: '100%', padding: '0.6rem 0.8rem', 
                  borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)',
                  outline: 'none', background: 'var(--bg-surface)', color: 'var(--text-main)',
                  fontFamily: 'inherit'
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem', color: 'var(--text-muted)' }}>Ano</label>
              <input 
                type="number" 
                placeholder="Ex: 2026"
                value={year} 
                onChange={(e) => setYear(e.target.value)}
                style={{ 
                  width: '100%', padding: '0.6rem 0.8rem', 
                  borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)',
                  outline: 'none', background: 'var(--bg-surface)', color: 'var(--text-main)',
                  fontFamily: 'inherit'
                }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem', color: 'var(--text-muted)' }}>DOI</label>
              <input 
                type="text" 
                placeholder="Ex: 10.1000/xyz123"
                value={doi} 
                onChange={(e) => setDoi(e.target.value)}
                style={{ 
                  width: '100%', padding: '0.6rem 0.8rem', 
                  borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)',
                  outline: 'none', background: 'var(--bg-surface)', color: 'var(--text-main)',
                  fontFamily: 'inherit'
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem', color: 'var(--text-muted)' }}>Revista / Periódico</label>
              <input 
                type="text" 
                placeholder="Ex: Nature"
                value={journal} 
                onChange={(e) => setJournal(e.target.value)}
                style={{ 
                  width: '100%', padding: '0.6rem 0.8rem', 
                  borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)',
                  outline: 'none', background: 'var(--bg-surface)', color: 'var(--text-main)',
                  fontFamily: 'inherit'
                }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem', color: 'var(--text-muted)' }}>Resumo</label>
            <textarea 
              placeholder="Resumo do artigo..."
              value={abstract} 
              onChange={(e) => setAbstract(e.target.value)}
              style={{ 
                width: '100%', height: '80px', padding: '0.6rem 0.8rem', 
                borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)',
                outline: 'none', resize: 'none', background: 'var(--bg-surface)', color: 'var(--text-main)',
                fontFamily: 'inherit'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem', color: 'var(--text-muted)' }}>Documento PDF (Opcional)</label>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <button 
                type="button" 
                onClick={handleSelectFile} 
                className="btn-secondary"
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem' }}
              >
                <Upload size={16} /> {filePath ? 'Alterar PDF' : 'Selecionar PDF'}
              </button>
              {filePath && (
                <div style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.85rem', color: 'var(--text-muted)' }} title={filePath}>
                  {filePath.split('\\').pop()?.split('/').pop()}
                </div>
              )}
              {filePath && (
                <button 
                  type="button" 
                  onClick={() => setFilePath(undefined)} 
                  className="btn-secondary" 
                  style={{ color: 'var(--color-danger)', padding: '0.5rem' }}
                  title="Remover PDF"
                >
                  <XIcon size={16} />
                </button>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
            <button type="button" onClick={onClose} disabled={submitting} className="btn-secondary">Cancelar</button>
            <button type="submit" disabled={submitting} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {submitting ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
              Salvar Artigo
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};

type TabId = 'articles' | 'diary' | 'history';

const ITEMS_PER_PAGE = 50;

export const ProjectDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [onlyWithPdf, setOnlyWithPdf] = useState(false);
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [uploadingId, setUploadingId] = useState<number | null>(null);
  const [archivingId, setArchivingId] = useState<number | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [newName, setNewName] = useState('');
  const [activeTab, setActiveTab] = useState<TabId>('articles');
  const [currentPage, setCurrentPage] = useState(1);
  const navigate = useNavigate();

  const fetchData = async () => {
    if (!id) return;
    try {
      const [projData, artData, histData] = await Promise.all([
        projectService.getProject(parseInt(id)),
        projectService.getArticles(parseInt(id)),
        projectService.getSearchHistory(parseInt(id))
      ]);
      setProject(projData);
      setArticles(artData);
      setHistory(histData);
      setNewName(projData.name);
    } catch (err) {
      console.error('Erro ao carregar dados do projeto', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  // Reset page when filter changes
  useEffect(() => { setCurrentPage(1); }, [searchTerm, onlyWithPdf]);

  const handleUploadClick = async (articleId: number) => {
    setUploadingId(articleId);
    try {
      const filePath = await projectService.openPdfDialog();
      if (filePath) {
        await projectService.uploadPdf(articleId, filePath);
        await fetchData();
      }
    } catch (err) {
      alert('Erro ao fazer upload do PDF');
    } finally {
      setUploadingId(null);
    }
  };

  const handleUnlinkClick = async (articleId: number) => {
    if (window.confirm("Deseja realmente desvincular o PDF deste artigo? O arquivo físico será removido do armazenamento local.")) {
      try {
        await projectService.unlinkPdf(articleId);
        await fetchData();
      } catch (err) {
        alert('Erro ao desvincular o PDF');
      }
    }
  };

  const handleStatusChange = async (articleId: number, status: 'new' | 'read' | 'archived', note?: string) => {
    try {
      await projectService.updateArticleStatus(articleId, status, note);
      setArticles(articles.map(a => a.id === articleId ? { ...a, status, archive_note: note } : a));
    } catch (e: any) {
      alert(`Erro ao atualizar status do artigo: ${e.message}`);
    }
  };

  const handleUpdateName = async () => {
    if (!id || !newName.trim()) return;
    try {
      await projectService.updateProject(parseInt(id), newName.trim());
      setProject(prev => prev ? { ...prev, name: newName.trim() } : null);
      setIsEditingName(false);
    } catch (e) {
      alert('Erro ao atualizar nome do projeto');
    }
  };

  const handleDeleteProject = async () => {
    if (!id || !project) return;
    if (window.confirm(`Tem certeza que deseja excluir o projeto "${project.name}"? Todos os artigos e anotações serão perdidos permanentemente.`)) {
      try {
        await projectService.deleteProject(parseInt(id));
        navigate('/');
      } catch (e) {
        alert('Erro ao excluir projeto');
      }
    }
  };

  const handleArchiveSubmit = (note: string) => {
    if (archivingId) {
      handleStatusChange(archivingId, 'archived', note);
      setArchivingId(null);
    }
  };

  const handleManualArticleSubmit = async (data: any, filePath?: string) => {
    if (!id) return;
    await projectService.createManualArticle(parseInt(id), data, filePath);
    await fetchData();
  };

  const filteredArticles = articles.filter(a => {
    const matchesSearch = (a.title || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (a.authors || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesPdf = !onlyWithPdf || !!a.local_file_path;
    return matchesSearch && matchesPdf;
  });

  const activeArticles = filteredArticles.filter(a => a.status === 'new' || !a.status);
  const readArticles = filteredArticles.filter(a => a.status === 'read');
  const archivedArticles = filteredArticles.filter(a => a.status === 'archived');

  // Pagination
  const totalPages = Math.max(1, Math.ceil(activeArticles.length / ITEMS_PER_PAGE));
  const paginatedArticles = activeArticles.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Carregando...</div>;
  if (!project) return <div style={{ padding: '2rem', textAlign: 'center' }}>Projeto não encontrado.</div>;

  const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: 'articles', label: `Artigos (${articles.length})`, icon: <FileText size={16} /> },
    { id: 'diary', label: 'Diário', icon: <BookOpen size={16} /> },
    { id: 'history', label: `Histórico (${history.length})`, icon: <History size={16} /> },
  ];

  return (
    <div className="fade-in" style={{ maxWidth: '1200px', margin: '0 auto' }}>
      <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', color: 'var(--text-muted)' }}>
        <ArrowLeft size={18} /> Voltar para Projetos
      </Link>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '2rem' }}>
        <div style={{ flex: 1 }}>
          {isEditingName ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <input 
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                style={{ 
                  fontSize: '2rem', 
                  fontWeight: 700, 
                  background: 'var(--bg-main)', 
                  border: '1px solid var(--color-primary)', 
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--text-heading)',
                  padding: '0.2rem 0.5rem',
                  width: '60%'
                }}
                autoFocus
              />
              <button onClick={handleUpdateName} className="btn-primary" style={{ padding: '0.5rem' }}><Check size={20} /></button>
              <button onClick={() => { setIsEditingName(false); setNewName(project.name); }} className="btn-secondary" style={{ padding: '0.5rem' }}><XIcon size={20} /></button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
              <h1 style={{ margin: 0, fontSize: '2rem' }}>{project.name}</h1>
              <button onClick={() => setIsEditingName(true)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.2rem', display: 'flex' }}>
                <Edit2 size={20} />
              </button>
              <button onClick={handleDeleteProject} style={{ background: 'none', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', padding: '0.2rem', display: 'flex' }}>
                <Trash2 size={20} />
              </button>
            </div>
          )}
          <p style={{ color: 'var(--text-muted)', margin: 0 }}>
            Criado em {new Date(project.created_at).toLocaleDateString()} &middot; {articles.length} artigos no total
          </p>
        </div>
        
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button onClick={() => projectService.exportCsv(project.id)} className="btn-secondary">
            <Download size={18} /> CSV
          </button>
          <button onClick={() => projectService.exportBiblioshiny(project.id)} className="btn-secondary" title="Exportar no formato compatível com Biblioshiny">
            <Download size={18} /> Biblioshiny
          </button>
          <button onClick={() => setIsManualModalOpen(true)} className="btn-secondary" title="Adicionar artigo manualmente">
            <Plus size={18} /> Artigo Avulso
          </button>
          <Link to={`/projects/${project.id}/search`} className="btn-primary">
            <Search size={18} /> Nova Busca
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '1.5rem', borderBottom: '2px solid var(--border-color)' }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              padding: '0.75rem 1.5rem',
              border: 'none',
              background: 'transparent',
              color: activeTab === tab.id ? 'var(--color-primary)' : 'var(--text-muted)',
              fontWeight: activeTab === tab.id ? 600 : 400,
              fontSize: '0.95rem',
              cursor: 'pointer',
              borderBottom: activeTab === tab.id ? '2px solid var(--color-primary)' : '2px solid transparent',
              marginBottom: '-2px',
              transition: 'all var(--transition-fast)'
            }}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content: Articles */}
      {activeTab === 'articles' && (
        <>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <div style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>
                <Search size={18} />
              </div>
              <input 
                type="text" 
                placeholder="Filtrar por título ou autor..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ 
                  width: '100%', 
                  padding: '0.8rem 1rem 0.8rem 2.8rem', 
                  fontSize: '1rem', 
                  border: '1px solid var(--border-color)', 
                  borderRadius: 'var(--radius-lg)',
                  boxShadow: 'var(--shadow-sm)',
                  outline: 'none',
                  background: 'var(--bg-surface)',
                  color: 'var(--text-main)',
                  transition: 'border-color var(--transition-fast)'
                }}
                onFocus={(e) => e.currentTarget.style.borderColor = 'var(--color-primary)'}
                onBlur={(e) => e.currentTarget.style.borderColor = 'var(--border-color)'}
              />
            </div>

            <label style={{ 
              display: 'inline-flex', 
              alignItems: 'center', 
              gap: '0.5rem', 
              cursor: 'pointer',
              fontSize: '0.95rem',
              fontWeight: 500,
              color: 'var(--text-main)',
              userSelect: 'none',
              padding: '0.5rem 1rem',
              background: onlyWithPdf ? 'var(--bg-surface)' : 'transparent',
              border: '1px solid ' + (onlyWithPdf ? 'var(--color-primary)' : 'var(--border-color)'),
              borderRadius: 'var(--radius-lg)',
              transition: 'all var(--transition-fast)',
              boxShadow: onlyWithPdf ? 'var(--shadow-sm)' : 'none'
            }}>
              <input 
                type="checkbox" 
                checked={onlyWithPdf} 
                onChange={(e) => setOnlyWithPdf(e.target.checked)} 
                style={{ cursor: 'pointer', accentColor: 'var(--color-primary)' }}
              />
              <span>Apenas com PDF vinculado</span>
            </label>
          </div>

          {readArticles.length > 0 && (
            <details style={{ marginBottom: '1rem', background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', padding: '1rem' }}>
              <summary style={{ fontWeight: 600, color: 'var(--color-primary)', cursor: 'pointer', outline: 'none' }}>
                Artigos Lidos ({readArticles.length})
              </summary>
              <div style={{ marginTop: '1rem' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                  <tbody>
                    {readArticles.map(article => (
                      <tr key={article.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '0.75rem 1rem' }}>{article.title}</td>
                        <td style={{ padding: '0.75rem 1rem', width: '200px' }}>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <Link to={`/articles/${article.id}`} className="btn-secondary" style={{ padding: '0.3rem 0.5rem', fontSize: '0.75rem' }}>Ver</Link>
                            <button onClick={() => handleStatusChange(article.id, 'new')} className="btn-secondary" style={{ padding: '0.3rem 0.5rem', fontSize: '0.75rem' }}>Desmarcar</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          )}

          {archivedArticles.length > 0 && (
            <details style={{ marginBottom: '1rem', background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', padding: '1rem' }}>
              <summary style={{ fontWeight: 600, color: 'var(--color-danger)', cursor: 'pointer', outline: 'none' }}>
                Artigos Arquivados ({archivedArticles.length})
              </summary>
              <div style={{ marginTop: '1rem' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                  <tbody>
                    {archivedArticles.map(article => (
                      <tr key={article.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '0.75rem 1rem' }}>
                          <div style={{ fontWeight: 500, marginBottom: '0.25rem' }}>{article.title}</div>
                          <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontStyle: 'italic' }}>Motivo: {article.archive_note}</div>
                        </td>
                        <td style={{ padding: '0.75rem 1rem', width: '150px' }}>
                          <button onClick={() => handleStatusChange(article.id, 'new')} className="btn-secondary" style={{ padding: '0.3rem 0.5rem', fontSize: '0.75rem' }}>Restaurar</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          )}

          {/* Pagination info */}
          {activeArticles.length > ITEMS_PER_PAGE && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              <span>
                Mostrando {(currentPage - 1) * ITEMS_PER_PAGE + 1}-{Math.min(currentPage * ITEMS_PER_PAGE, activeArticles.length)} de {activeArticles.length} artigos
              </span>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="btn-secondary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}>
                  <ChevronLeft size={14} />
                </button>
                <span style={{ fontWeight: 600 }}>{currentPage} / {totalPages}</span>
                <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="btn-secondary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}>
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}

          <div className="card" style={{ overflowX: 'auto', border: 'none', marginBottom: '2rem' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'var(--bg-main)', borderBottom: '2px solid var(--border-color)' }}>
                  <th style={{ padding: '1rem 1.5rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.875rem' }}>TÍTULO</th>
                  <th style={{ padding: '1rem 1.5rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.875rem' }}>AUTORES</th>
                  <th style={{ padding: '1rem 1.5rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.875rem' }}>BASES</th>
                  <th style={{ padding: '1rem 1.5rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.875rem' }}>AÇÕES</th>
                </tr>
              </thead>
              <tbody>
                {paginatedArticles.map(article => (
                  <tr key={article.id} style={{ borderBottom: '1px solid var(--border-color)', transition: 'background var(--transition-fast)' }} onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-main)'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                    <td style={{ padding: '1.25rem 1.5rem', maxWidth: '350px' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-heading)', marginBottom: '0.25rem', lineHeight: '1.4' }}>{article.title}</div>
                      {article.doi && (
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                          DOI: {article.doi}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '1.25rem 1.5rem', color: 'var(--text-main)', fontSize: '0.9rem', maxWidth: '250px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.4rem' }}>
                        <Calendar size={14} color="var(--text-muted)" /> {article.year || 'N/A'}
                      </div>
                      {article.authors}
                    </td>
                    <td style={{ padding: '1.25rem 1.5rem' }}>
                      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                        {JSON.parse(article.source_databases as any).map((base: string) => {
                          const isManual = base === 'Manual';
                          return (
                            <span key={base} style={{ 
                              padding: '0.2rem 0.6rem', 
                              background: isManual ? 'rgba(239, 68, 68, 0.1)' : 'var(--bg-surface)', 
                              border: isManual ? '1px solid var(--color-danger)' : '1px solid var(--border-color)',
                              borderRadius: 'var(--radius-xl)', 
                              fontSize: '0.75rem', 
                              fontWeight: 600,
                              color: isManual ? 'var(--color-danger)' : 'var(--color-primary)'
                            }} title={isManual ? "Metadados adicionados manualmente (podem conter erros)" : undefined}>
                              {isManual ? '⚠️ Manual' : base}
                            </span>
                          );
                        })}
                      </div>
                    </td>
                    <td style={{ padding: '1.25rem 1.5rem' }}>
                      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                        <Link to={`/articles/${article.id}`} className="btn-primary" style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem' }}>
                          <FileText size={14} /> Ler
                        </Link>

                        {article.local_file_path ? (
                          <button onClick={() => handleUnlinkClick(article.id)} className="btn-secondary" style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem', color: 'var(--color-danger)' }} title="Desvincular PDF">
                            <XIcon size={14} />
                          </button>
                        ) : (
                          <button onClick={() => handleUploadClick(article.id)} disabled={uploadingId === article.id} className="btn-secondary" style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem' }} title="Vincular PDF Local">
                            {uploadingId === article.id ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                          </button>
                        )}

                        <button onClick={() => handleStatusChange(article.id, 'read')} className="btn-secondary" style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem' }} title="Marcar como Lido">
                          <CheckCircle size={14} /> Lido
                        </button>
                        
                        <button onClick={() => setArchivingId(article.id)} className="btn-secondary" style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem', color: 'var(--color-danger)' }} title="Arquivar">
                          <Archive size={14} /> Arquivar
                        </button>

                        {article.doi && (
                          <a href={`https://doi.org/${article.doi}`} target="_blank" rel="noreferrer" style={{ color: 'var(--text-muted)' }} title="Abrir no Navegador">
                            <ExternalLink size={16} />
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {activeArticles.length === 0 && (
              <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                Nenhum artigo ativo na biblioteca.
              </div>
            )}
          </div>

          {/* Bottom pagination */}
          {activeArticles.length > ITEMS_PER_PAGE && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', alignItems: 'center', marginBottom: '2rem' }}>
              <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="btn-secondary" style={{ padding: '0.4rem 0.8rem' }}>
                <ChevronLeft size={16} /> Anterior
              </button>
              <span style={{ padding: '0 1rem', color: 'var(--text-muted)' }}>{currentPage} / {totalPages}</span>
              <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="btn-secondary" style={{ padding: '0.4rem 0.8rem' }}>
                Próxima <ChevronRight size={16} />
              </button>
            </div>
          )}
        </>
      )}

      {/* Tab Content: Diary */}
      {activeTab === 'diary' && id && (
        <DiarySection projectId={parseInt(id)} />
      )}

      {/* Tab Content: History */}
      {activeTab === 'history' && (
        <SearchHistoryModal 
          isOpen={true} 
          onClose={() => setActiveTab('articles')} 
          history={history}
          embedded={true}
        />
      )}

      <ArchiveModal 
        isOpen={archivingId !== null} 
        onClose={() => setArchivingId(null)} 
        onSubmit={handleArchiveSubmit} 
      />

      <ManualArticleModal
        isOpen={isManualModalOpen}
        onClose={() => setIsManualModalOpen(false)}
        onSubmit={handleManualArticleSubmit}
      />

      {isHistoryOpen && (
        <SearchHistoryModal 
          isOpen={isHistoryOpen} 
          onClose={() => setIsHistoryOpen(false)} 
          history={history} 
        />
      )}
    </div>
  );
};
