import { useState } from 'react';
import { AlertCircle, AlertTriangle, Clipboard, Check } from 'lucide-react';
import { useGlobalError } from '../../contexts/GlobalErrorContext';
import { Modal } from '../common/Modal';
import { appErrorView, technicalReport } from './errorModal/appErrorView';
import './errorModal/errorModal.css';

/**
 * The app's error window, for what reaches the global error context: a translated title and message, the tone of the
 * error (the person can act on it, or the system failed) and the technical details to copy.
 *
 * @example <ErrorModal /> // once, under GlobalErrorProvider
 */
export const ErrorModal = () => {
  const { currentError, hideError } = useGlobalError();
  const [showDetails, setShowDetails] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!currentError) return null;

  const view = appErrorView(currentError);
  const { code, rawMessage, details, isUserError } = view;
  const Icon = isUserError ? AlertTriangle : AlertCircle;
  const colorVar = isUserError ? 'var(--color-warning)' : 'var(--color-danger)';
  const bgColorVar = isUserError ? 'rgba(234, 179, 8, 0.1)' : 'rgba(239, 68, 68, 0.1)';

  const handleCopyDetails = () => {
    navigator.clipboard.writeText(technicalReport(view));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Modal
      label={view.title}
      title={
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span
            style={{
              background: bgColorVar,
              color: colorVar,
              padding: '0.5rem',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon size={24} />
          </span>
          {view.title}
        </span>
      }
      onClose={hideError}
      width={500}
      className={isUserError ? 'error-modal--user' : 'error-modal--system'}
    >
      <div style={{ color: 'var(--text-main)', fontSize: '1rem', lineHeight: 1.5 }}>{view.message}</div>

      {showDetails && (
        <div
          style={{
            background: 'var(--bg-surface)',
            padding: '1rem',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-color)',
            fontSize: '0.85rem',
            fontFamily: 'monospace',
            color: 'var(--text-muted)',
            overflowX: 'auto',
            maxHeight: '150px',
            overflowY: 'auto',
          }}
        >
          <div style={{ marginBottom: '0.5rem', fontWeight: 'bold' }}>Detalhes Técnicos:</div>
          <div>[Code]: {code}</div>
          <div>[Message]: {rawMessage}</div>
          {!!details && <div style={{ marginTop: '0.5rem' }}>[Extra]: {JSON.stringify(details, null, 2)}</div>}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
        <button
          onClick={() => setShowDetails(!showDetails)}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--color-primary)',
            cursor: 'pointer',
            fontSize: '0.9rem',
            textDecoration: 'underline',
          }}
        >
          {showDetails ? 'Ocultar detalhes' : 'Ver detalhes técnicos'}
        </button>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          {showDetails && (
            <button
              onClick={handleCopyDetails}
              className="btn-secondary"
              style={{ padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              {copied ? <Check size={16} /> : <Clipboard size={16} />}
              {copied ? 'Copiado' : 'Copiar Logs'}
            </button>
          )}
          <button onClick={hideError} className="btn-primary" style={{ padding: '0.5rem 1.5rem' }}>
            Entendi
          </button>
        </div>
      </div>
    </Modal>
  );
};
