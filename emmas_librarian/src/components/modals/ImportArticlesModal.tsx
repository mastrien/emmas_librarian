import React, { useEffect, useState, useCallback } from 'react';
import { X, Search, Database, Share2, Info } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useProjectService } from '../../contexts/ServicesContext';
import { Article, Project } from '../../types';

interface ImportArticlesModalProps {
  isOpen: boolean;
  destProjectId: number;
  onClose: () => void;
  onImportComplete: () => void;
}

export const ImportArticlesModal: React.FC<ImportArticlesModalProps> = ({
  isOpen,
  destProjectId,
  onClose,
  onImportComplete,
}) => {
  if (!isOpen) return null;

  const projectService = useProjectService();
  const [projects, setProjects] = useState<Project[]>([]);
  const [sourceProjectId, setSourceProjectId] = useState<number | ''>('');
  const [articles, setArticles] = useState<Article[]>([]);
  const [selectedIds, setSelectedIds] = useState<Record<number, boolean>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);

  const loadProjects = useCallback(async () => {
    try {
      const list = await projectService.getProjects();
      setProjects(list.filter((p) => p.id !== destProjectId));
    } catch (err) {
      console.error('Erro ao buscar projetos:', err);
    }
  }, [projectService, destProjectId]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const handleSourceProjectChange = async (projId: number) => {
    setSourceProjectId(projId);
    setSelectedIds({});
    try {
      setLoading(true);
      const arts = await projectService.getArticles(projId);
      setArticles(arts);
    } catch (err) {
      console.error('Erro ao buscar artigos do projeto de origem:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleArticle = (id: number) => {
    setSelectedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleSelectAll = (filtered: Article[]) => {
    const allSelected = filtered.every((a) => selectedIds[a.id]);
    setSelectedIds((prev) => {
      const next = { ...prev };
      filtered.forEach((a) => {
        next[a.id] = !allSelected;
      });
      return next;
    });
  };

  const handleImport = async () => {
    if (!sourceProjectId) return;
    const ids = Object.keys(selectedIds).map(Number).filter((k) => selectedIds[k]);
    if (ids.length === 0) return;
    try {
      setLoading(true);
      await projectService.importArticlesFromProject(Number(sourceProjectId), destProjectId, ids);
      onImportComplete();
      onClose();
    } catch (err) {
      alert('Erro ao importar artigos: ' + err);
    } finally {
      setLoading(false);
    }
  };

  const filteredArticles = articles.filter((a) =>
    a.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (a.authors && a.authors.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const selectedCount = Object.values(selectedIds).filter(Boolean).length;

  return createPortal(
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
      <div
        className="card fade-in"
        style={{
          width: '90%',
          maxWidth: '750px',
          maxHeight: '85vh',
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
          <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.5rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Share2 size={24} color="var(--color-primary)" /> Importar Artigos de Outro Projeto
          </h3>
          <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.9rem' }}>
            Copie metadados e PDFs compartilhados de outros projetos locais de forma transparente.
          </p>
        </div>

        {/* Project Selector */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '1.25rem' }}>
          <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>PROJETO DE ORIGEM</label>
          <select
            id="source-project-select"
            className="input-field"
            value={sourceProjectId}
            onChange={(e) => handleSourceProjectChange(Number(e.target.value))}
          >
            <option value="">-- Selecione o projeto de origem --</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        {/* Articles List */}
        {sourceProjectId !== '' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0, gap: '1rem' }}>
            <div style={{ display: 'flex', gap: '1rem', position: 'relative' }}>
              <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                className="input-field"
                placeholder="Pesquisar artigos no projeto de origem..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ paddingLeft: '2.5rem', flexGrow: 1 }}
              />
            </div>

            {loading ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', flex: 1 }}>
                Carregando artigos...
              </div>
            ) : filteredArticles.length === 0 ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', flex: 1 }}>
                Nenhum artigo encontrado para importação.
              </div>
            ) : (
              <div style={{ flex: 1, overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem', borderBottom: '1px solid var(--border-color)', marginBottom: '0.5rem' }}>
                  <div
                    style={{ display: 'flex', alignItems: 'center', color: 'var(--color-primary)', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}
                  >
                    <input
                      type="checkbox"
                      id="select-all-articles"
                      checked={filteredArticles.length > 0 && filteredArticles.every((a) => selectedIds[a.id])}
                      onChange={() => handleSelectAll(filteredArticles)}
                      style={{ marginRight: '0.5rem' }}
                    />
                    <span onClick={() => handleSelectAll(filteredArticles)}>Selecionar Todos Filtrados</span>
                  </div>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    {filteredArticles.length} artigos encontrados
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  {filteredArticles.map((art) => (
                    <div
                      key={art.id}
                      onClick={() => handleToggleArticle(art.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        padding: '0.6rem 0.5rem',
                        borderRadius: 'var(--radius-sm)',
                        cursor: 'pointer',
                        background: selectedIds[art.id] ? 'rgba(79,70,229,0.05)' : 'transparent',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={!!selectedIds[art.id]}
                        onChange={(e) => {
                          e.stopPropagation();
                          handleToggleArticle(art.id);
                        }}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-main)' }}>{art.title}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {art.authors || 'Sem autores'} • {art.year || 'N/A'} {art.local_file_path && <span style={{ color: 'var(--color-success)', fontWeight: 600 }}>• PDF Incluído</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.25rem' }}>
          <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
            {selectedCount > 0 ? (
              <span><strong>{selectedCount}</strong> artigo(s) selecionado(s) para cópia.</span>
            ) : (
              <span>Selecione artigos para importar.</span>
            )}
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button className="btn-secondary" onClick={onClose} disabled={loading}>
              Cancelar
            </button>
            <button
              className="btn-primary"
              onClick={handleImport}
              disabled={selectedCount === 0 || loading}
            >
              Confirmar Importação
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
