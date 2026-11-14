import { useState } from 'react';
import { AlertCircle, AlertTriangle, Clipboard, Check } from 'lucide-react';
import { useGlobalError } from '../../contexts/GlobalErrorContext';
import { Modal } from '../common/Modal';
import { ModalFooter } from '../common/ModalFooter';
import { Button } from '../common/Button';
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

  const handleCopyDetails = () => {
    navigator.clipboard.writeText(technicalReport(view));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Modal
      label={view.title}
      title={view.title}
      icon={<Icon size={20} aria-hidden="true" />}
      tone={isUserError ? 'warn' : 'danger'}
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
            fontFamily: 'var(--font-mono)',
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

      <ModalFooter
        leading={
          <Button variant="ghost" size="sm" onClick={() => setShowDetails(!showDetails)}>
            {showDetails ? 'Ocultar detalhes' : 'Ver detalhes técnicos'}
          </Button>
        }
      >
        {showDetails && (
          <Button size="sm" onClick={handleCopyDetails}>
            {copied ? <Check size={14} aria-hidden="true" /> : <Clipboard size={14} aria-hidden="true" />}
            {copied ? 'Copiado' : 'Copiar Logs'}
          </Button>
        )}
        <Button variant="primary" onClick={hideError}>
          Entendi
        </Button>
      </ModalFooter>
    </Modal>
  );
};
