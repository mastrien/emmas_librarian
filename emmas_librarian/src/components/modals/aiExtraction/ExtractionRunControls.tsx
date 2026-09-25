import React from 'react';
import { Loader2 } from 'lucide-react';

interface ExtractionRunControlsProps {
  isExtracting: boolean;
  isFinished: boolean;
  canStart: boolean;
  progress: { current: number; total: number };
  onStart: () => void;
  onCancel: () => void;
  onFinish: () => void;
}

const wideButton: React.CSSProperties = {
  width: '100%',
  padding: '0.75rem',
  fontSize: '1rem',
  justifyContent: 'center',
};

/**
 * Start / cancel / conclude button for the current run, plus the progress line while running.
 *
 * Usage:
 *   <ExtractionRunControls isExtracting={false} isFinished={false} canStart progress={p} onStart={start} onCancel={cancel} onFinish={close} />
 */
export const ExtractionRunControls: React.FC<ExtractionRunControlsProps> = ({
  isExtracting,
  isFinished,
  canStart,
  progress,
  onStart,
  onCancel,
  onFinish,
}) => (
  <>
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
      {isExtracting ? (
        <button
          onClick={onCancel}
          className="btn-secondary"
          style={{ ...wideButton, color: 'var(--color-danger)', borderColor: 'var(--color-danger)' }}
        >
          Cancelar
        </button>
      ) : isFinished ? (
        <button onClick={onFinish} className="btn-primary" style={wideButton}>
          Concluir Investigação
        </button>
      ) : (
        <button onClick={onStart} disabled={!canStart} className="btn-primary" style={wideButton}>
          Iniciar Investigação
        </button>
      )}
    </div>
    {isExtracting && (
      <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center' }}>
        <Loader2
          size={16}
          className="animate-spin"
          style={{ marginRight: '0.5rem', display: 'inline-block', verticalAlign: 'middle' }}
        />
        Processando artigo {progress.current} de {progress.total}...
      </div>
    )}
  </>
);
