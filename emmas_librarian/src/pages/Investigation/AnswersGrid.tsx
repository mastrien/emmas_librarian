import React from 'react';
import type { Article, InvestigationResult } from '../../types';
import { finalAnswerText } from '../../utils/investigationAnswers';

interface AnswersGridProps {
  results: InvestigationResult[];
  questions: string[];
  articles: Article[];
  selectedId: number | null;
  onSelect: (resultId: number) => void;
}

const REVIEW_WORDS: Record<InvestigationResult['review_status'], string> = {
  pending: 'pendente',
  accepted: 'aceita',
  edited: 'editada',
  rejected: 'rejeitada',
};

const dotClass = (r: InvestigationResult) =>
  r.status === 'success' ? `inv-review--${r.review_status}` : `inv-call--${r.status}`;

const stateWord = (r: InvestigationResult) => {
  if (r.status === 'error') return 'erro';
  if (r.status === 'skipped') return 'pulada';
  return REVIEW_WORDS[r.review_status];
};

/** What a cell says: an error names itself; a rejected answer still shows the AI's text, since it can be undone. */
const cellText = (r: InvestigationResult) => {
  if (r.status === 'error') return 'Erro';
  if (r.status === 'skipped') return 'Pulada';
  return finalAnswerText({ ...r, review_status: r.review_status === 'rejected' ? 'pending' : r.review_status }) || '—';
};

const AnswerCell: React.FC<{
  result: InvestigationResult;
  number: number;
  articleTitle: string;
  selected: boolean;
  onSelect: () => void;
}> = ({ result, number, articleTitle, selected, onSelect }) => (
  <td className={selected ? 'inv-cell inv-cell--on' : 'inv-cell'}>
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      aria-label={`${articleTitle}, pergunta ${number}: ${stateWord(result)}`}
    >
      <i className={`inv-dot ${dotClass(result)}`} />
      <span className={result.status === 'success' ? 'inv-clamp' : 'inv-clamp inv-danger'}>{cellText(result)}</span>
    </button>
  </td>
);

/**
 * The answers as a grid, article × question: at a glance, what is left to review and where the errors are. The
 * article column stays in place when the questions scroll sideways.
 *
 * @example <AnswersGrid results={visible} questions={questions} articles={articles} selectedId={id} onSelect={setId} />
 */
export const AnswersGrid: React.FC<AnswersGridProps> = ({ results, questions, articles, selectedId, onSelect }) => {
  const articleIds = [...new Set(results.map((r) => r.article_id))];
  if (articleIds.length === 0) return <div className="inv-grid-wrap inv-empty">Nada neste filtro.</div>;
  const titleOf = (id: number) => articles.find((a) => a.id === id)?.title ?? `Artigo #${id}`;
  return (
    <div className="inv-grid-wrap">
      <table className="inv-grid">
        <thead>
          <tr>
            <th className="inv-grid-article">Artigo</th>
            {questions.map((q, i) => (
              <th key={q} title={q}>
                <span className="inv-clamp inv-clamp--3">
                  P{i + 1}. {q}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {articleIds.map((id) => (
            <tr key={id}>
              <td className="inv-grid-article">
                <span className="inv-clamp" title={titleOf(id)}>
                  {titleOf(id)}
                </span>
              </td>
              {questions.map((q, i) => {
                const result = results.find((r) => r.article_id === id && r.question === q);
                if (!result) return <td key={q} className="inv-cell-none" aria-label="Fora deste filtro" />;
                return (
                  <AnswerCell
                    key={q}
                    result={result}
                    number={i + 1}
                    articleTitle={titleOf(id)}
                    selected={result.id === selectedId}
                    onSelect={() => onSelect(result.id)}
                  />
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
