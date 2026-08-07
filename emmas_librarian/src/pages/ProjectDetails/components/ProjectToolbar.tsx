import React, { useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Search, Brain, Plus, ChevronDown, Upload, Share2, Download, Tag, Link as LinkIcon, Settings, FileIcon, ExternalLink } from 'lucide-react';
import { Project, ProjectDocument } from '../../../types';
import { projectService } from '../../../services/api';

interface ProjectToolbarProps {
  project: Project;
  projectDocuments: ProjectDocument[];
  setIsAIExtractionModalOpen: (val: boolean) => void;
  isAddArticlesMenuOpen: boolean;
  setIsAddArticlesMenuOpen: (val: boolean) => void;
  isExportMenuOpen: boolean;
  setIsExportMenuOpen: (val: boolean) => void;
  handleBatchPdfImport: () => void;
  setIsImportArticlesModalOpen: (val: boolean) => void;
  setIsManualModalOpen: (val: boolean) => void;
  setIsCategoriesModalOpen: (val: boolean) => void;
  setIsQuickAccessModalOpen: (val: boolean) => void;
  addArticlesMenuRef: React.RefObject<HTMLDivElement | null>;
  exportMenuRef: React.RefObject<HTMLDivElement | null>;
  handleAddMenuMouseEnter: () => void;
  handleAddMenuMouseLeave: () => void;
  handleExportMenuMouseEnter: () => void;
  handleExportMenuMouseLeave: () => void;
}

export const ProjectToolbar: React.FC<ProjectToolbarProps> = ({
  project,
  projectDocuments,
  setIsAIExtractionModalOpen,
  isAddArticlesMenuOpen,
  setIsAddArticlesMenuOpen,
  isExportMenuOpen,
  setIsExportMenuOpen,
  handleBatchPdfImport,
  setIsImportArticlesModalOpen,
  setIsManualModalOpen,
  setIsCategoriesModalOpen,
  setIsQuickAccessModalOpen,
  addArticlesMenuRef,
  exportMenuRef,
  handleAddMenuMouseEnter,
  handleAddMenuMouseLeave,
  handleExportMenuMouseEnter,
  handleExportMenuMouseLeave
}) => {
  return (
    <>
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <Link to={`/projects/${project.id}/search`} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Search size={18} /> Nova busca
        </Link>

        <button
          onClick={() => setIsAIExtractionModalOpen(true)}
          className="btn-secondary"
          title="Extração Inteligente IA"
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
          <Brain size={18} /> Extração IA
        </button>

        {/* Group 1: Dropdown "Adicionar Artigos" */}
        <div
          ref={addArticlesMenuRef}
          onMouseEnter={handleAddMenuMouseEnter}
          onMouseLeave={handleAddMenuMouseLeave}
          style={{ position: 'relative' }}
        >
          <button
            onClick={() => setIsAddArticlesMenuOpen(!isAddArticlesMenuOpen)}
            className="btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <Plus size={18} /> Adicionar Artigos <ChevronDown size={14} />
          </button>

          {isAddArticlesMenuOpen && (
            <div
              className="glass-panel"
              style={{
                position: 'absolute',
                left: 0,
                top: '100%',
                minWidth: '220px',
                borderRadius: 'var(--radius-md)',
                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)',
                zIndex: 100,
                display: 'flex',
                flexDirection: 'column',
                padding: '0.5rem',
                gap: '0.25rem',
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-color)',
              }}
            >
              <button
                className="menu-dropdown-item"
                onClick={() => {
                  setIsAddArticlesMenuOpen(false);
                  handleBatchPdfImport();
                }}
              >
                <Upload size={16} style={{ color: 'var(--color-primary)', flexShrink: 0 }} /> Importar PDFs em Lote
              </button>

              <button
                className="menu-dropdown-item"
                onClick={() => {
                  setIsAddArticlesMenuOpen(false);
                  setIsImportArticlesModalOpen(true);
                }}
              >
                <Share2 size={16} style={{ color: 'var(--color-primary)', flexShrink: 0 }} /> Importar de outro projeto
              </button>

              <button
                className="menu-dropdown-item"
                onClick={() => {
                  setIsAddArticlesMenuOpen(false);
                  setIsManualModalOpen(true);
                }}
              >
                <Plus size={16} style={{ color: 'var(--color-primary)', flexShrink: 0 }} /> Artigo Manual
              </button>
            </div>
          )}
        </div>

        {/* Group 2: Dropdown "Exportar" */}
        <div
          ref={exportMenuRef}
          onMouseEnter={handleExportMenuMouseEnter}
          onMouseLeave={handleExportMenuMouseLeave}
          style={{ position: 'relative' }}
        >
          <button
            onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
            className="btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <Download size={18} /> Exportar <ChevronDown size={14} />
          </button>

          {isExportMenuOpen && (
            <div
              className="glass-panel"
              style={{
                position: 'absolute',
                left: 0,
                top: '100%',
                minWidth: '220px',
                borderRadius: 'var(--radius-md)',
                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)',
                zIndex: 100,
                display: 'flex',
                flexDirection: 'column',
                padding: '0.5rem',
                gap: '0.25rem',
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-color)',
              }}
            >
              <button
                className="menu-dropdown-item"
                onClick={() => {
                  setIsExportMenuOpen(false);
                  projectService.exportBiblioshiny(project.id);
                }}
              >
                <Download size={16} style={{ color: 'var(--color-primary)', flexShrink: 0 }} /> Biblioshiny
              </button>

              <button
                className="menu-dropdown-item"
                onClick={async () => {
                  setIsExportMenuOpen(false);
                  await projectService.exportProject(project.id);
                }}
              >
                <Download size={16} style={{ color: 'var(--color-primary)', flexShrink: 0 }} /> Pacote .emmapcarc (com PDFs)
              </button>
            </div>
          )}
        </div>

        <button
          onClick={() => setIsCategoriesModalOpen(true)}
          className="btn-secondary"
          title="Gerenciar categorias de artigos"
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
          <Tag size={18} /> Criar categorias
        </button>
      </div>

      {/* Acesso rápido */}
      <div
        style={{
          marginTop: '0.5rem',
          background: 'var(--bg-surface)',
          padding: '1rem',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-color)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
          <h3
            style={{
              margin: 0,
              fontSize: '1.1rem',
              color: 'var(--text-heading)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <LinkIcon size={16} /> Acesso rápido
          </h3>
          <button
            onClick={() => setIsQuickAccessModalOpen(true)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '0.2rem',
              display: 'flex',
              transition: 'color var(--transition-fast)',
            }}
            title="Gerenciar acessos rápidos"
          >
            <Settings size={16} />
          </button>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        {projectDocuments.length === 0 ? (
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', padding: '0.5rem 0' }}>
            Nenhum link ou documento cadastrado. Clique na engrenagem para adicionar.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {Object.entries(
              projectDocuments.reduce<Record<string, ProjectDocument[]>>((acc, doc) => {
                const key = doc.category?.trim() || '';
                if (!acc[key]) acc[key] = [];
                acc[key].push(doc);
                return acc;
              }, {}),
            )
              .sort(([catA], [catB]) => {
                if (catA === '') return -1;
                if (catB === '') return 1;
                return 0;
              })
              .map(([catName, docs]) => (
              <div key={catName || 'uncategorized'} style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                {catName && (
                  <div
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: 'var(--text-muted)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      marginBottom: '0.25rem',
                    }}
                  >
                    <Tag size={12} /> {catName}
                  </div>
                )}
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {docs.map((doc) => (
                    <button
                      key={doc.id}
                      onClick={() => {
                        projectService.openProjectDocumentExternal(doc.url, doc.local_file_path);
                      }}
                      className="btn-secondary"
                      style={{
                        padding: '0.4rem 0.8rem',
                        fontSize: '0.85rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        background: 'var(--bg-main)',
                      }}
                      title={doc.url || doc.local_file_path}
                    >
                      {doc.url ? (
                        <ExternalLink size={14} style={{ color: 'var(--color-primary)' }} />
                      ) : (
                        <FileIcon size={14} style={{ color: 'var(--color-primary)' }} />
                      )}
                      {doc.title}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
        </div>
      </div>
    </>
  );
};
