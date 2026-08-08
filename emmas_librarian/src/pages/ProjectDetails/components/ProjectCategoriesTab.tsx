import React from 'react';
import { Tags, Download } from 'lucide-react';
import { Project, Article } from '../../../types';
import { projectService } from '../../../services/api';

interface ProjectCategoriesTabProps {
  project: Project;
  projectCategories: any[];
  articleCategories: any[];
  nonArchivedArticles: Article[];
  onCategorySaved?: () => void;
}

export const ProjectCategoriesTab: React.FC<ProjectCategoriesTabProps> = ({
  project,
  projectCategories,
  articleCategories,
  nonArchivedArticles,
  onCategorySaved
}) => {
  return (
    <div className="card fade-in" style={{ padding: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2 style={{ margin: 0, fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Tags size={24} color="var(--color-primary)" /> Categorias e Extrações
        </h2>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button
            className="btn-secondary"
            onClick={async () => {
              try {
                const savedPath = await projectService.exportCsv(project.id);
                if (savedPath) alert('CSV exportado com sucesso para: ' + savedPath);
              } catch (err: any) {
                alert('Erro ao exportar CSV: ' + err.message);
              }
            }}
          >
            <Download size={18} /> Exportar CSV
          </button>
          <button
            className="btn-secondary"
            onClick={async () => {
              try {
                const savedPath = await projectService.exportXlsx(project.id);
                if (savedPath) alert('XLSX exportado com sucesso para: ' + savedPath);
              } catch (err: any) {
                alert('Erro ao exportar XLSX: ' + err.message);
              }
            }}
          >
            <Download size={18} /> Exportar XLSX
          </button>
        </div>
      </div>

      <div style={{ overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
          <thead>
            <tr style={{ background: 'var(--bg-main)', borderBottom: '2px solid var(--border-color)' }}>
              <th
                style={{
                  padding: '1rem 1.5rem',
                  color: 'var(--text-muted)',
                  fontWeight: 600,
                  fontSize: '0.875rem',
                }}
              >
                ARTIGO
              </th>
              {projectCategories.map((cat) => (
                <th
                  key={cat.id}
                  style={{
                    padding: '1rem 1.5rem',
                    color: 'var(--text-muted)',
                    fontWeight: 600,
                    fontSize: '0.875rem',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {cat.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {nonArchivedArticles.length === 0 ? (
              <tr>
                <td
                  colSpan={projectCategories.length + 1}
                  style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}
                >
                  Nenhum artigo encontrado.
                </td>
              </tr>
            ) : (
              nonArchivedArticles.map((article) => (
                <tr
                  key={article.id}
                  style={{
                    borderBottom: '1px solid var(--border-color)',
                    transition: 'background var(--transition-fast)',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-main)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <td style={{ padding: '1rem 1.5rem', maxWidth: '300px' }}>
                    <div
                      style={{
                        fontWeight: 600,
                        color: 'var(--text-heading)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        marginBottom: '0.25rem',
                      }}
                      title={article.title}
                    >
                      {article.title}
                    </div>
                  </td>
                  {projectCategories.map((cat) => {
                    const articleCat = articleCategories.find(
                      (ac) => ac.article_id === article.id && ac.category_id === cat.id,
                    );
                    return (
                      <td key={cat.id} style={{ padding: '1rem 1.5rem', minWidth: '150px', color: 'var(--text-main)', fontSize: '0.85rem' }}>
                        {articleCat?.value === 'true' ? 'Sim' : articleCat?.value === 'false' ? 'Não' : articleCat?.value || '-'}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
