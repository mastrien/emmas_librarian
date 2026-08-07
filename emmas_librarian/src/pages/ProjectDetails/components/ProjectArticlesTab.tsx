import React from 'react';
import { ChevronDown, ChevronRight, ChevronLeft, SlidersHorizontal, CopyPlus, Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Article, ScientificVenue } from '../../../types';
import { ProjectArticlesList } from './ProjectArticlesList';
import { ProjectSidebar } from './ProjectSidebar';

interface ProjectArticlesTabProps {
  searchTerm: string;
  setSearchTerm: (s: string) => void;
  onlyWithPdf: boolean;
  setOnlyWithPdf: (b: boolean) => void;
  onlyOpenAccess: boolean;
  setOnlyOpenAccess: (b: boolean) => void;
  isSidebarOpen: boolean;
  setIsSidebarOpen: (b: boolean) => void;
  sortOrder: string;
  setSortOrder: (s: string) => void;
  statusFilter: 'all' | 'new' | 'read' | 'archived';
  setStatusFilter: (s: 'all' | 'new' | 'read' | 'archived') => void;

  uniqueDatabases: string[];
  selectedDatabases: string[];
  setSelectedDatabases: (db: string[]) => void;
  
  uniqueDocTypes: string[];
  selectedDocType: string;
  setSelectedDocType: (dt: string) => void;
  
  keywordFrequencies: { keyword: string; count: number }[];
  selectedKeyword: string;
  setSelectedKeyword: (kw: string) => void;

  currentPage: number;
  setCurrentPage: (p: number | ((prev: number) => number)) => void;
  totalPages: number;

  activeArticles: Article[];
  readArticles: Article[];
  archivedArticles: Article[];
  paginatedArticles: Article[];

  isReadArticlesOpen: boolean;
  setIsReadArticlesOpen: (b: boolean) => void;
  isArchivedArticlesOpen: boolean;
  setIsArchivedArticlesOpen: (b: boolean) => void;

  modals: any;
  handleUnlinkClick: (id: number) => void;
  handleUploadClick: (id: number) => void;
  uploadingId: number | null;
  handleStatusChange: (id: number, status: 'new' | 'read' | 'archived') => void;
  isArticleManual: (art: Article) => boolean;
}

const ITEMS_PER_PAGE = 50;

export const ProjectArticlesTab: React.FC<ProjectArticlesTabProps> = ({
  searchTerm, setSearchTerm,
  onlyWithPdf, setOnlyWithPdf,
  onlyOpenAccess, setOnlyOpenAccess,
  isSidebarOpen, setIsSidebarOpen,
  sortOrder, setSortOrder,
  statusFilter, setStatusFilter,
  uniqueDatabases, selectedDatabases, setSelectedDatabases,
  uniqueDocTypes, selectedDocType, setSelectedDocType,
  keywordFrequencies, selectedKeyword, setSelectedKeyword,
  currentPage, setCurrentPage, totalPages,
  activeArticles, readArticles, archivedArticles, paginatedArticles,
  isReadArticlesOpen, setIsReadArticlesOpen,
  isArchivedArticlesOpen, setIsArchivedArticlesOpen,
  modals,
  handleUnlinkClick, handleUploadClick, uploadingId,
  handleStatusChange, isArticleManual
}) => {
  return (
    <>
      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <div
                style={{
                  position: 'absolute',
                  left: '1rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)',
                }}
              >
                <Search size={18} />
              </div>
              <input
                type="text"
                placeholder="Filtrar por título ou autor..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
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
                  transition: 'border-color var(--transition-fast)',
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--color-primary)')}
                onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border-color)')}
              />
            </div>

            <label
              style={{
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
                boxShadow: onlyWithPdf ? 'var(--shadow-sm)' : 'none',
              }}
            >
              <input
                type="checkbox"
                checked={onlyWithPdf}
                onChange={(e) => {
                  setOnlyWithPdf(e.target.checked);
                  setCurrentPage(1);
                }}
                style={{ cursor: 'pointer', accentColor: 'var(--color-primary)' }}
              />
              <span>Apenas com PDF vinculado</span>
            </label>

            <label
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                cursor: 'pointer',
                fontSize: '0.95rem',
                fontWeight: 500,
                color: 'var(--text-main)',
                userSelect: 'none',
                padding: '0.5rem 1rem',
                background: onlyOpenAccess ? 'var(--bg-surface)' : 'transparent',
                border: '1px solid ' + (onlyOpenAccess ? 'var(--color-primary)' : 'var(--border-color)'),
                borderRadius: 'var(--radius-lg)',
                transition: 'all var(--transition-fast)',
                boxShadow: onlyOpenAccess ? 'var(--shadow-sm)' : 'none',
              }}
            >
              <input
                type="checkbox"
                checked={onlyOpenAccess}
                onChange={(e) => {
                  setOnlyOpenAccess(e.target.checked);
                  setCurrentPage(1);
                }}
                style={{ cursor: 'pointer', accentColor: 'var(--color-primary)' }}
              />
              <span>Apenas Acesso Aberto</span>
            </label>

            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="btn-secondary"
              style={{
                padding: '0.5rem 1rem',
                fontSize: '0.95rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                background: isSidebarOpen ? 'var(--bg-surface)' : 'transparent',
                border: '1px solid ' + (isSidebarOpen ? 'var(--color-primary)' : 'var(--border-color)'),
                borderRadius: 'var(--radius-lg)',
                color: isSidebarOpen ? 'var(--color-primary)' : 'var(--text-main)',
                boxShadow: isSidebarOpen ? 'var(--shadow-sm)' : 'none',
                cursor: 'pointer',
                transition: 'all var(--transition-fast)',
              }}
            >
              <SlidersHorizontal size={18} /> Filtros
            </button>

            <div style={{ position: 'relative' }}>
              <select
                value={sortOrder}
                onChange={(e) => {
                  setSortOrder(e.target.value);
                  setCurrentPage(1);
                }}
                style={{
                  padding: '0.8rem 1rem',
                  fontSize: '0.95rem',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-lg)',
                  outline: 'none',
                  background: 'var(--bg-surface)',
                  color: 'var(--text-main)',
                  cursor: 'pointer',
                }}
              >
                <option value="year-desc">Mais Recentes (Ano)</option>
                <option value="year-asc">Mais Antigos (Ano)</option>
                <option value="title-asc">Título (A-Z)</option>
                <option value="title-desc">Título (Z-A)</option>
                <option value="added-desc">Últimos Adicionados</option>
                <option value="added-asc">Primeiros Adicionados</option>
                <option value="citations-desc">Mais Citados (Citações)</option>
                <option value="citations-asc">Menos Citados (Citações)</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '2rem', alignItems: 'flex-start', width: '100%' }}>
            {isSidebarOpen && (
              <ProjectSidebar
                statusFilter={statusFilter}
                setStatusFilter={setStatusFilter}
                uniqueDatabases={uniqueDatabases}
                selectedDatabases={selectedDatabases}
                setSelectedDatabases={setSelectedDatabases}
                uniqueDocTypes={uniqueDocTypes}
                selectedDocType={selectedDocType}
                setSelectedDocType={setSelectedDocType}
                keywordFrequencies={keywordFrequencies}
                selectedKeyword={selectedKeyword}
                setSelectedKeyword={setSelectedKeyword}
                setCurrentPage={setCurrentPage}
              />
            )}

            <div style={{ flex: 1, minWidth: 0 }}>
              {readArticles.length > 0 && (
                <details
                  className="custom-accordion"
                  onToggle={(e) => setIsReadArticlesOpen((e.target as HTMLDetailsElement).open)}
                  style={{
                    marginBottom: '1rem',
                    background: 'var(--bg-surface)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-color)',
                    padding: '1rem',
                  }}
                >
                  <summary
                    style={{
                      fontWeight: 600,
                      color: 'var(--color-primary)',
                      cursor: 'pointer',
                      outline: 'none',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      {isReadArticlesOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      <span>Artigos Lidos ({readArticles.length})</span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        modals.setIsMassCitationModalOpen(true);
                      }}
                      className="btn-primary"
                      style={{
                        padding: '0.3rem 0.6rem',
                        fontSize: '0.75rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                      }}
                    >
                      <CopyPlus size={12} /> Citação em Massa
                    </button>
                  </summary>
                  <div style={{ marginTop: '1rem' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                      <tbody>
                        {readArticles.map((article) => (
                          <tr key={article.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                            <td style={{ padding: '0.75rem 1rem' }}>{article.title}</td>
                            <td style={{ padding: '0.75rem 1rem', width: '320px' }}>
                              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                <Link
                                  to={`/articles/${article.id}`}
                                  className="btn-secondary"
                                  style={{ padding: '0.3rem 0.5rem', fontSize: '0.75rem' }}
                                >
                                  Ver
                                </Link>
                                <button
                                  onClick={() => modals.setSelectedArticleForDetails(article)}
                                  className="btn-secondary"
                                  style={{ padding: '0.3rem 0.5rem', fontSize: '0.75rem' }}
                                >
                                  Detalhes
                                </button>
                                <button
                                  onClick={() => modals.setCitationArticle(article)}
                                  className="btn-secondary"
                                  style={{ padding: '0.3rem 0.5rem', fontSize: '0.75rem' }}
                                >
                                  Citar
                                </button>
                                <button
                                  onClick={() => handleStatusChange(article.id, 'new')}
                                  className="btn-secondary"
                                  style={{ padding: '0.3rem 0.5rem', fontSize: '0.75rem' }}
                                >
                                  Desmarcar
                                </button>
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
                <details
                  className="custom-accordion"
                  onToggle={(e) => setIsArchivedArticlesOpen((e.target as HTMLDetailsElement).open)}
                  style={{
                    marginBottom: '1rem',
                    background: 'var(--bg-surface)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-color)',
                    padding: '1rem',
                  }}
                >
                  <summary
                    style={{
                      fontWeight: 600,
                      color: 'var(--color-danger)',
                      cursor: 'pointer',
                      outline: 'none',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      {isArchivedArticlesOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      <span>Artigos Arquivados ({archivedArticles.length})</span>
                    </div>
                  </summary>
                  <div style={{ marginTop: '1rem' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                      <tbody>
                        {archivedArticles.map((article) => (
                          <tr key={article.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                            <td style={{ padding: '0.75rem 1rem' }}>
                              <div style={{ fontWeight: 500, marginBottom: '0.25rem' }}>{article.title}</div>
                              <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontStyle: 'italic' }}>
                                Motivo: {article.archive_note}
                              </div>
                            </td>
                            <td style={{ padding: '0.75rem 1rem', width: '150px' }}>
                              <button
                                onClick={() => handleStatusChange(article.id, 'new')}
                                className="btn-secondary"
                                style={{ padding: '0.3rem 0.5rem', fontSize: '0.75rem' }}
                              >
                                Restaurar
                              </button>
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
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '0.75rem',
                    color: 'var(--text-muted)',
                    fontSize: '0.875rem',
                  }}
                >
                  <span>
                    Mostrando {(currentPage - 1) * ITEMS_PER_PAGE + 1}-
                    {Math.min(currentPage * ITEMS_PER_PAGE, activeArticles.length)} de {activeArticles.length} artigos
                  </span>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <button
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="btn-secondary"
                      style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}
                    >
                      <ChevronLeft size={14} />
                    </button>
                    <span style={{ fontWeight: 600 }}>
                      {currentPage} / {totalPages}
                    </span>
                    <button
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="btn-secondary"
                      style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}
                    >
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              )}

              <ProjectArticlesList
                paginatedArticles={paginatedArticles}
                setSelectedArticleForDetails={modals.setSelectedArticleForDetails}
                handleUnlinkClick={handleUnlinkClick}
                handleUploadClick={handleUploadClick}
                uploadingId={uploadingId}
                handleStatusChange={handleStatusChange}
                setEditingArticle={modals.setEditingArticle}
                setArchivingId={modals.setArchivingId}
                setCitationArticle={modals.setCitationArticle}
                isArticleManual={isArticleManual}
              />

              {/* Bottom pagination */}
              {activeArticles.length > ITEMS_PER_PAGE && (
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    alignItems: 'center',
                    marginBottom: '2rem',
                  }}
                >
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="btn-secondary"
                    style={{ padding: '0.4rem 0.8rem' }}
                  >
                    <ChevronLeft size={16} /> Anterior
                  </button>
                  <span style={{ padding: '0 1rem', color: 'var(--text-muted)' }}>
                    {currentPage} / {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="btn-secondary"
                    style={{ padding: '0.4rem 0.8rem' }}
                  >
                    Próxima <ChevronRight size={16} />
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
  );
};
