import React from 'react';
import { Loader2, AlertTriangle, AlertCircle, Edit2, RotateCcw } from 'lucide-react';
import type { QueryTranslationResult } from '../../types';

interface QueryTranslationCardProps {
  databaseName: string;
  translation?: QueryTranslationResult;
  /** undefined while the automatic translation is used. */
  customQuery?: string;
  onCustomQueryChange: (query: string | undefined) => void;
}

const noticeStyle = (background: string, border: string, color: string): React.CSSProperties => ({
  marginTop: '1rem',
  padding: '1rem',
  background,
  border: `1px solid ${border}`,
  borderRadius: 'var(--radius-sm)',
  color,
  display: 'flex',
  gap: '0.5rem',
  alignItems: 'flex-start',
});

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
    <div style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
      <div
        style={{
          background: 'var(--bg-main)',
          padding: '1rem 1.5rem',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div style={{ fontWeight: 600, color: 'var(--text-heading)', textTransform: 'capitalize' }}>{databaseName}</div>
        <button
          type="button"
          onClick={toggleCustom}
          className="btn-secondary"
          style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
        >
          {isCustom ? (
            <>
              <RotateCcw size={14} /> Restaurar Tradução Automática
            </>
          ) : (
            <>
              <Edit2 size={14} /> Substituir por Query Customizada
            </>
          )}
        </button>
      </div>
      <div style={{ padding: '1.5rem' }}>
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
    style={{
      width: '100%',
      height: '100px',
      padding: '1rem',
      fontFamily: 'monospace',
      borderRadius: 'var(--radius-sm)',
      border: '1px solid var(--color-primary)',
      outline: 'none',
      background: 'var(--bg-main)',
    }}
  />
);

const AutomaticTranslation: React.FC<{ translation?: QueryTranslationResult }> = ({ translation }) => {
  if (!translation) {
    return (
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', color: 'var(--text-muted)' }}>
        <Loader2 className="animate-spin" size={16} /> Traduzindo...
      </div>
    );
  }
  return (
    <>
      <div
        style={{
          fontFamily: 'monospace',
          padding: '1rem',
          background: 'var(--bg-main)',
          borderRadius: 'var(--radius-sm)',
          color: translation.isValid ? 'var(--text-main)' : 'var(--text-muted)',
          wordBreak: 'break-all',
        }}
      >
        {translation.query || 'Vazio'}
      </div>
      {!translation.isValid && (
        <div style={noticeStyle('#fef2f2', '#fecaca', '#991b1b')}>
          <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '0.1rem' }} />
          <div>
            <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>Incompatibilidade de Sintaxe</div>
            <div style={{ fontSize: '0.9rem' }}>{translation.error}</div>
          </div>
        </div>
      )}
      {translation.isValid && translation.warning && (
        <div style={noticeStyle('#fffbeb', '#fde68a', '#92400e')}>
          <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: '0.1rem' }} />
          <div>
            <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>Aviso</div>
            <div style={{ fontSize: '0.9rem' }}>{translation.warning}</div>
          </div>
        </div>
      )}
    </>
  );
};
