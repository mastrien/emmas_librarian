import React from 'react';
import { Tag } from 'lucide-react';
import type { Article, Project } from '../../../types';
import type { ProjectSection } from '../../../components/common/shell/projectNav';
import { PageHeader } from '../../../components/common/PageHeader';
import type { ProjectActions } from '../hooks/useProjectActions';
import { ArticleActions, type ArticleActionsProps } from './ArticleActions';
import { ProjectNameActions, ProjectNameTitle } from './ProjectNameTitle';
import { articlesSubtitle, countSubtitle, overviewSubtitle } from './sectionSubtitles';

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

const CategoriesHeader: React.FC<ProjectSectionHeaderProps> = ({ categoryCount, onManageCategories }) => (
  <PageHeader
    title="Categorias"
    subtitle={countSubtitle(categoryCount, 'categoria', 'categorias')}
    actions={
      <button
        onClick={onManageCategories}
        className="btn-secondary toolbar-button"
        title="Gerenciar categorias de artigos"
      >
        <Tag size={18} /> Criar categorias
      </button>
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
