import React from 'react';
import { Loader2, AlertTriangle, AlertCircle, Edit2, RotateCcw } from 'lucide-react';
import type { QueryTranslationResult } from '../../types';
import './search.css';

interface QueryTranslationCardProps {
  databaseName: string;
  translation?: QueryTranslationResult;
  /** undefined while the automatic translation is used. */
  customQuery?: string;
  onCustomQueryChange: (query: string | undefined) => void;
}

/**
 * One database's translated query, with the option to replace it by a hand-written query.
 *
 * Usage:
 *   <QueryTranslationCard databaseName="Scopus" translation={tr} customQuery={undefined} onCustomQueryChange={set} />
 */
export const QueryTranslationCard: React.FC<QueryTranslationCardProps> = ({
  databaseName,
  translation,
  customQuery,
  onCustomQueryChange,
}) => {
  const isCustom = customQuery !== undefined;
  // Switching to custom starts from the automatic translation so the user only has to tweak it.
  const toggleCustom = () => onCustomQueryChange(isCustom ? undefined : translation?.query || '');
  return (
    <div className="translation-card">
      <div className="translation-card-head">
        <div className="translation-card-name">{databaseName}</div>
        {/* Short words in the narrow summary panel (board 158); the name says what they do, base included. */}
        <button
          type="button"
          onClick={toggleCustom}
          className="translation-card-toggle"
          aria-label={
            isCustom
              ? `Restaurar tradução automática (${databaseName})`
              : `Substituir por query customizada (${databaseName})`
          }
        >
          {isCustom ? (
            <>
              <RotateCcw size={13} /> Restaurar
            </>
          ) : (
            <>
              <Edit2 size={13} /> Editar
            </>
          )}
        </button>
      </div>
      <div className="translation-card-body">
        {isCustom ? (
          <CustomQueryInput value={customQuery} onChange={onCustomQueryChange} />
        ) : (
          <AutomaticTranslation translation={translation} />
        )}
      </div>
    </div>
  );
};

const CustomQueryInput: React.FC<{ value: string; onChange: (value: string) => void }> = ({ value, onChange }) => (
  <textarea
    value={value}
    onChange={(e) => onChange(e.target.value)}
    placeholder="Digite a query exata na sintaxe desta base de dados..."
    className="translation-custom"
  />
);

/** A syntax error or a warning under the translated query. */
const TranslationNotice: React.FC<{ kind: 'error' | 'warning'; title: string; text?: string }> = (props) => {
  const Icon = props.kind === 'error' ? AlertCircle : AlertTriangle;
  return (
    <div className={`translation-notice translation-notice--${props.kind}`}>
      <Icon size={18} />
      <div>
        <div className="translation-notice-title">{props.title}</div>
        <div className="translation-notice-text">{props.text}</div>
      </div>
    </div>
  );
};

const AutomaticTranslation: React.FC<{ translation?: QueryTranslationResult }> = ({ translation }) => {
  if (!translation) {
    return (
      <div className="translation-pending">
        <Loader2 className="animate-spin" size={16} /> Traduzindo...
      </div>
    );
  }
  return (
    <>
      <div className={`translation-query${translation.isValid ? '' : ' is-invalid'}`}>
        {translation.query || 'Vazio'}
      </div>
      {!translation.isValid && (
        <TranslationNotice kind="error" title="Incompatibilidade de Sintaxe" text={translation.error} />
      )}
      {translation.isValid && translation.warning && (
        <TranslationNotice kind="warning" title="Aviso" text={translation.warning} />
      )}
    </>
  );
};
