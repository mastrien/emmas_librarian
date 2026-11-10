import React from 'react';
import { Tag } from 'lucide-react';
import type { Article, Project } from '../../../types';
import type { ProjectSection } from '../../../components/common/shell/projectNav';
import { PageHeader } from '../../../components/common/PageHeader';
import type { ProjectActions } from '../hooks/useProjectActions';
import { ArticleActions, type ArticleActionsProps } from './ArticleActions';
import { ProjectNameActions, ProjectNameTitle } from './ProjectNameTitle';
import { articlesSubtitle, countSubtitle, overviewSubtitle } from './sectionSubtitles';
import { CategoriesExportMenu } from './categoriesTab/CategoriesExportMenu';

export interface ProjectSectionHeaderProps {
  section: ProjectSection;
  project: Project;
  articles: Article[];
  historyCount: number;
  categoryCount: number;
  actions: ProjectActions;
  articleActions: ArticleActionsProps;
  onManageCategories: () => void;
}

const OverviewHeader: React.FC<ProjectSectionHeaderProps> = ({ project, articles, actions }) => (
  <PageHeader
    eyebrow="Projeto"
    title={<ProjectNameTitle project={project} {...actions} />}
    subtitle={overviewSubtitle(project, articles.length)}
    actions={
      actions.isEditingName ? undefined : (
        <ProjectNameActions onRename={() => actions.setIsEditingName(true)} onDelete={actions.deleteProject} />
      )
    }
  />
);

// Board 156: the matrix explains itself in the subtitle; export and the one primary action on the right.
const CategoriesHeader: React.FC<ProjectSectionHeaderProps> = ({ project, categoryCount, onManageCategories }) => (
  <PageHeader
    title="Categorias e extrações"
    subtitle={
      categoryCount > 0
        ? `${countSubtitle(categoryCount, 'categoria', 'categorias')} · uma coluna por categoria; clique numa célula para editar`
        : 'Uma coluna por categoria para anotar o mesmo dado em todos os artigos'
    }
    actions={
      <>
        <CategoriesExportMenu projectId={project.id} />
        <button onClick={onManageCategories} className="btn-primary toolbar-button" title="Criar e editar categorias">
          <Tag size={18} /> Gerenciar categorias
        </button>
      </>
    }
  />
);

/**
 * The header of each project section (redesign, boards 153-157): the project name, rename and delete on the
 * overview; counts and the section's own actions elsewhere. It replaces the one header the tabs shared.
 *
 * @example <ProjectSectionHeader section="articles" project={project} articles={articles} … />
 */
export const ProjectSectionHeader: React.FC<ProjectSectionHeaderProps> = (props) => {
  switch (props.section) {
    case 'overview':
      return <OverviewHeader {...props} />;
    case 'articles':
      return (
        <PageHeader
          title="Artigos"
          subtitle={articlesSubtitle(props.articles)}
          actions={<ArticleActions {...props.articleActions} />}
        />
      );
    case 'categories':
      return <CategoriesHeader {...props} />;
    case 'diary':
      return <PageHeader title="Diário" />;
    case 'history':
      return (
        <PageHeader title="Histórico de buscas" subtitle={countSubtitle(props.historyCount, 'entrada', 'entradas')} />
      );
  }
};
