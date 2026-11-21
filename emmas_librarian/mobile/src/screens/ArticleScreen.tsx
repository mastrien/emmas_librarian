import React, { useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { Annotation, Article, ArticleCategory, Highlight, ProjectCategory } from '../../../src/types';
import { Await, Empty, ScreenHeader } from '../components';
import { Markdown } from '../Markdown';
import { highlightPage } from '../pdf/highlightPage';
import type { ProjectReader } from '../reader/ProjectReader';
import { useReader } from '../session/SessionContext';
import { useLoaded } from '../useLoaded';
import { CategoryField, valueFor } from './CategoryFields';
import { PdfAction } from './PdfAction';

interface ArticleView {
  article: Article;
  categories: ProjectCategory[];
  values: ArticleCategory[];
  highlights: Highlight[];
  annotations: Annotation[];
}

async function loadArticleView(reader: ProjectReader, articleId: number): Promise<ArticleView | null> {
  const article = await reader.getArticle(articleId);
  if (!article) return null;
  const [categories, values, highlights, annotations] = await Promise.all([
    reader.listCategories(article.project_id),
    reader.listArticleCategories(articleId),
    reader.listHighlights(articleId),
    reader.listAnnotations(articleId),
  ]);
  return { article, categories, values, highlights, annotations };
}

const Metadata: React.FC<{ article: Article }> = ({ article }) => (
  <section className="m-card">
    <h2 className="m-article-title">{article.title}</h2>
    <p className="m-row__detail">{[article.authors, article.year, article.journal].filter(Boolean).join(' · ')}</p>
    {article.doi && (
      <a className="m-link" href={`https://doi.org/${article.doi}`} target="_blank" rel="noreferrer noopener">
        doi:{article.doi}
      </a>
    )}
    {article.abstract && <p className="m-prose">{article.abstract}</p>}
    <PdfAction article={article} />
  </section>
);

const HighlightItem: React.FC<{ articleId: number; highlight: Highlight }> = ({ articleId, highlight }) => {
  const page = highlightPage(highlight.position_data);
  return (
    <li className="m-highlight" style={{ borderLeftColor: highlight.color }}>
      {highlight.content_text && <p className="m-prose">{highlight.content_text}</p>}
      {highlight.comment && <Markdown className="m-highlight__note" text={highlight.comment} />}
      {page && (
        <Link className="m-link" to={`/articles/${articleId}/pdf?page=${page}`}>
          Página {page}
        </Link>
      )}
    </li>
  );
};

// Notes linked to a highlight are shown with it; the rest are the article's loose notes.
const looseNotes = (view: ArticleView) => {
  const linked = new Set(view.highlights.map((highlight) => highlight.annotation_id));
  return view.annotations.filter((note) => !linked.has(note.id));
};

const ReadingNotes: React.FC<{ view: ArticleView }> = ({ view }) => (
  <section className="m-card">
    <h2>Marcações e anotações</h2>
    {view.highlights.length + view.annotations.length === 0 && <Empty>Nada marcado neste artigo.</Empty>}
    <ul className="m-list m-list--plain">
      {view.highlights.map((highlight) => (
        <HighlightItem key={highlight.id} articleId={view.article.id} highlight={highlight} />
      ))}
      {looseNotes(view).map((note) => (
        <li key={`note-${note.id}`} className="m-highlight">
          <Markdown className="m-highlight__note" text={note.content_markdown} />
        </li>
      ))}
    </ul>
  </section>
);

/**
 * One article: metadata and abstract, its categories (editable where writing is possible), what was
 * marked and noted in it, and the way into its PDF.
 *
 * @example <Route path="/articles/:articleId" element={<ArticleScreen />} />
 */
export const ArticleScreen: React.FC = () => {
  const articleId = Number(useParams().articleId);
  const reader = useReader();
  const view = useLoaded(useCallback(() => loadArticleView(reader, articleId), [reader, articleId]));
  const projectId = view.state === 'ready' ? view.value?.article.project_id : undefined;
  const { writer } = reader;
  const reload = view.state === 'ready' ? view.reload : () => undefined;
  return (
    <main className="m-screen">
      <ScreenHeader title="Artigo" back={projectId ? `/projects/${projectId}` : '/projects'} />
      <Await loaded={view}>
        {(loaded) =>
          !loaded ? (
            <Empty>Artigo não encontrado.</Empty>
          ) : (
            <>
              <Metadata article={loaded.article} />
              {loaded.categories.length > 0 && (
                <section className="m-card">
                  <h2>Categorias</h2>
                  {loaded.categories.map((category) => (
                    <CategoryField
                      key={category.id}
                      category={category}
                      current={valueFor(loaded.values, category)}
                      onChange={
                        writer
                          ? (value) => writer.setArticleCategory(articleId, category.id, value).then(reload)
                          : undefined
                      }
                    />
                  ))}
                </section>
              )}
              <ReadingNotes view={loaded} />
            </>
          )
        }
      </Await>
    </main>
  );
};
