import React from 'react';
import type { ScreeningLabel, ScreeningSuggestion } from '../../types';
import { providerName } from '../../utils/screeningCriteria';

interface SuggestionBlockProps {
  suggestion: ScreeningSuggestion | null;
  stale: boolean;
  running: boolean;
  failure: string | null;
  hasCriteria: boolean;
  hasAbstract: boolean;
  labels: ScreeningLabel[];
  provider: string | null;
  onSuggest: () => void;
  onWriteCriteria: () => void;
}

const confidenceText = (confidence: number | null) =>
  confidence === null ? null : `confiança ${Math.round(confidence * 100)}%`;

const quoteWarning = ({ quote }: ScreeningSuggestion) =>
  quote
    ? 'O trecho citado não está no resumo. A IA pode ter inventado: confira antes de decidir.'
    : 'A IA não apontou um trecho do resumo. Confira antes de decidir.';

const Asked: React.FC<SuggestionBlockProps & { suggestion: ScreeningSuggestion }> = (props) => {
  const { suggestion, stale, labels, onSuggest } = props;
  const label = labels.find((l) => l.id === suggestion.label_id);
  const unchecked = suggestion.quote_found === 0;
  return (
    <div className={stale || unchecked ? 'review-suggestion review-suggestion--warn' : 'review-suggestion'}>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '0.5rem' }}>
        <strong>A IA sugere: {label?.name}</strong>
        <span className="review-muted">{confidenceText(suggestion.confidence)}</span>
      </div>
      {suggestion.reason && <p style={{ margin: 0 }}>{suggestion.reason}</p>}
      {unchecked ? (
        <strong role="note">{quoteWarning(suggestion)}</strong>
      ) : (
        <span className="review-muted">O trecho que sustenta está marcado no resumo.</span>
      )}
      {stale && (
        <>
          <span role="note">Esta sugestão usou os critérios anteriores.</span>
          <button type="button" className="review-link" onClick={onSuggest}>
            Sugerir de novo (consome tokens)
          </button>
        </>
      )}
    </div>
  );
};

/**
 * What the AI thinks of the article, only when asked (#54): it spends tokens, and asking after reading the abstract
 * keeps the suggestion from steering the person. Accepting is pressing the usual button; ignoring changes nothing.
 *
 * @example <SuggestionBlock suggestion={null} stale={false} running={false} failure={null} hasCriteria hasAbstract … />
 */
export const SuggestionBlock: React.FC<SuggestionBlockProps> = (props) => {
  const { suggestion, running, failure, hasCriteria, hasAbstract, provider, onSuggest, onWriteCriteria } = props;
  if (!hasAbstract) {
    return (
      <div className="review-suggestion review-muted">
        Este artigo não tem resumo, então não há o que a IA leia. Decida pelo título ou abra o artigo.
      </div>
    );
  }
  if (running) {
    return (
      <div className="review-suggestion review-muted" role="status">
        A IA está lendo título e resumo…
      </div>
    );
  }
  if (!hasCriteria && !suggestion) {
    return (
      <div className="review-suggestion">
        <span>Escreva os critérios do projeto para pedir sugestões.</span>
        <button type="button" className="review-link" onClick={onWriteCriteria}>
          Escrever os critérios
        </button>
      </div>
    );
  }
  if (suggestion && !failure) return <Asked {...props} suggestion={suggestion} />;
  return (
    <div className={failure ? 'review-suggestion review-suggestion--warn' : 'review-suggestion'}>
      {failure && (
        <span role="alert">
          <strong>Não foi possível sugerir.</strong> {failure}
        </span>
      )}
      <button type="button" className="review-small" style={{ justifyContent: 'center' }} onClick={onSuggest}>
        {failure ? 'Tentar de novo' : 'Sugerir (S)'}
      </button>
      {provider && (
        <span className="review-muted">Envia título, resumo e critérios para {providerName(provider)}.</span>
      )}
    </div>
  );
};
