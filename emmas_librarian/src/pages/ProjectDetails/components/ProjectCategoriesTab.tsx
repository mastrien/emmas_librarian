import React from 'react';
import { Tags, Download } from 'lucide-react';
import { Project, Article, ProjectCategory } from '../../../types';
import { useProjectService } from '../../../contexts/ServicesContext';
import { exportWithFeedback } from '../../../utils/exportWithFeedback';
import { categoryCellText, type ProjectArticleCategory } from './categoriesTab/categoryCells';
import './categoriesTab/categoriesTab.css';
import { useDialogs } from '../../../components/common/dialogs/DialogProvider';

interface ProjectCategoriesTabProps {
  project: Project;
  projectCategories: ProjectCategory[];
  articleCategories: ProjectArticleCategory[];
  nonArchivedArticles: Article[];
  onCategorySaved?: () => void;
}

const CategoriesHead: React.FC<{ projectId: number }> = ({ projectId }) => {
  const projectService = useProjectService();
  const { inform } = useDialogs();
  return (
    <div className="categories-tab-head">
      <h2>
        <Tags size={24} /> Categorias e Extrações
      </h2>
      <div className="categories-tab-exports">
        <button
          className="btn-secondary"
          onClick={() => exportWithFeedback(() => projectService.exportCsv(projectId), 'CSV', inform)}
        >
          <Download size={18} /> Exportar CSV
        </button>
        <button
          className="btn-secondary"
          onClick={() => exportWithFeedback(() => projectService.exportXlsx(projectId), 'XLSX', inform)}
        >
          <Download size={18} /> Exportar XLSX
        </button>
      </div>
    </div>
  );
};

const ArticleRow: React.FC<{ article: Article; categories: ProjectCategory[]; values: ProjectArticleCategory[] }> = (
  props,
) => (
  <tr>
    <td className="categories-cell-title">
      <div title={props.article.title}>{props.article.title}</div>
    </td>
    {props.categories.map((cat) => (
      <td key={cat.id} className="categories-cell-value">
        {categoryCellText(props.values, props.article.id, cat.id)}
      </td>
    ))}
  </tr>
);

/**
 * The project's categories tab: every non-archived article with its value in each category, and the CSV/XLSX
 * exports.
 *
 * @example <ProjectCategoriesTab project={p} projectCategories={cats} articleCategories={values} nonArchivedArticles={a} />
 */
export const ProjectCategoriesTab: React.FC<ProjectCategoriesTabProps> = (props) => (
  <div className="card fade-in categories-tab">
    <CategoriesHead projectId={props.project.id} />
    <div className="categories-table-wrap">
      <table className="categories-table">
        <thead>
          <tr>
            <th>ARTIGO</th>
            {props.projectCategories.map((cat) => (
              <th key={cat.id} className="categories-th-category">
                {cat.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {props.nonArchivedArticles.length === 0 ? (
            <tr>
              <td colSpan={props.projectCategories.length + 1} className="categories-empty">
                Nenhum artigo encontrado.
              </td>
            </tr>
          ) : (
            props.nonArchivedArticles.map((article) => (
              <ArticleRow
                key={article.id}
                article={article}
                categories={props.projectCategories}
                values={props.articleCategories}
              />
            ))
          )}
        </tbody>
      </table>
    </div>
  </div>
);
