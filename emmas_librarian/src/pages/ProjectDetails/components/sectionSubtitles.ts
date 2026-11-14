import type { Article, Project } from '../../../types';

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * The line under "Artigos" (board 153): how many, how many read, how many with a PDF.
 *
 * @example articlesSubtitle(articles) // '96 no projeto · 7 lidos · 17 com PDF'
 */
export function articlesSubtitle(articles: Article[]): string {
  const read = articles.filter((a) => a.status === 'read').length;
  const withPdf = articles.filter((a) => a.local_file_path).length;
  return `${articles.length} no projeto · ${plural(read, 'lido', 'lidos')} · ${withPdf} com PDF`;
}

/**
 * The line under the project name on the overview (board 154).
 *
 * @example overviewSubtitle(project, 96) // 'Criado em 06/08/2026 · 96 artigos'
 */
export function overviewSubtitle(project: Project, articleCount: number): string {
  const created = new Date(project.created_at).toLocaleDateString('pt-BR');
  return `Criado em ${created} · ${plural(articleCount, 'artigo', 'artigos')}`;
}

/**
 * A count line for the sections that list one kind of thing.
 *
 * @example countSubtitle(2, 'busca registrada', 'buscas registradas') // '2 buscas registradas'
 */
export function countSubtitle(count: number, one: string, many: string): string {
  return plural(count, one, many);
}
