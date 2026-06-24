import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, AlertTriangle, X as XIcon, Clipboard, Check } from 'lucide-react';
import { useGlobalError } from '../../contexts/GlobalErrorContext';
import { FrontendAppError } from '../../utils/AppError';

const errorTranslations: Record<string, { title: string; message: string }> = {
  ERR_MISSING_API_KEY: {
    title: 'Chave de API Ausente',
    message: 'Você precisa configurar uma chave de API nas Configurações do projeto para usar essa funcionalidade.'
  },
  ERR_MODEL_NOT_DEFINED: {
    title: 'Modelo não Definido',
    message: 'Você precisa selecionar qual modelo deseja usar para esta funcionalidade. Vá até as Configurações de IA e defina um modelo.'
  },
  ERR_INVALID_PDF: {
    title: 'Arquivo PDF Inválido',
    message: 'O sistema não conseguiu ler este arquivo PDF. Ele pode estar corrompido, protegido por senha ou sem formato de texto válido.'
  },
  ERR_API_QUOTA_EXCEEDED: {
    title: 'Cota de Uso Excedida',
    message: 'Você atingiu o limite de uso da sua chave de API ou não há saldo suficiente na sua conta (ex: OpenAI/Anthropic).'
  },
  ERR_API_UNAUTHORIZED: {
    title: 'Chave de API Inválida',
    message: 'A chave configurada parece estar incorreta ou foi revogada pelo provedor.'
  },
  ERR_NOT_FOUND: {
    title: 'Recurso Não Encontrado',
    message: 'O item solicitado não existe mais no banco de dados.'
  },
  ERR_API_CONNECTION: {
    title: 'Falha de Conexão com IA',
    message: 'Não foi possível conectar ao provedor de Inteligência Artificial. Verifique sua conexão com a internet ou se o serviço local (ex: Ollama) está rodando.'
  },
  ERR_INTERNAL: {
    title: 'Falha no Sistema',
    message: 'Ocorreu um problema inesperado no Emma\'s Librarian.'
  }
};

export const ErrorModal = () => {
  const { currentError, hideError } = useGlobalError();
  const [showDetails, setShowDetails] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!currentError) return null;

  const isAppError = 'isAppError' in currentError;
  const code = isAppError ? (currentError as FrontendAppError).code : 'ERR_INTERNAL';
  const type = isAppError ? (currentError as FrontendAppError).type : 'SYSTEM_ERROR';
  
  const translation = errorTranslations[code] || errorTranslations['ERR_INTERNAL'];
  
  // Decide Icon and Color based on ErrorType
  const isUserError = type === 'USER_ERROR' || type === 'VALIDATION_ERROR';
  const Icon = isUserError ? AlertTriangle : AlertCircle;
  const colorVar = isUserError ? 'var(--color-warning)' : 'var(--color-danger)';
  const bgColorVar = isUserError ? 'rgba(234, 179, 8, 0.1)' : 'rgba(239, 68, 68, 0.1)';

  const rawMessage = isAppError ? (currentError as FrontendAppError).message : String((currentError as any).message || currentError);
  const stack = isAppError ? (currentError as FrontendAppError).stack : (currentError as any).stack;
  const details = isAppError ? (currentError as FrontendAppError).details : null;

  const handleCopyDetails = () => {
    const details = `Type: ${type}\nCode: ${code}\nMessage: ${rawMessage}\nStack: ${stack}`;
    navigator.clipboard.writeText(details);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return createPortal(
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 999999,
      }}
    >
      <div
        className="card fade-in"
        style={{
          padding: '2rem',
          width: '500px',
          maxWidth: '90%',
          background: 'var(--bg-main)',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.5rem',
          borderTop: `4px solid ${colorVar}`
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ 
              background: bgColorVar, 
              color: colorVar, 
              padding: '0.5rem', 
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Icon size={24} />
            </div>
            <h3 style={{ margin: 0, color: 'var(--text-heading)', fontSize: '1.25rem' }}>
              {translation.title}
            </h3>
          </div>
          <button
            onClick={hideError}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
            }}
          >
            <XIcon size={20} />
          </button>
        </div>

        <div style={{ color: 'var(--text-main)', fontSize: '1rem', lineHeight: 1.5 }}>
          {translation.message}
        </div>

        {showDetails && (
          <div style={{ 
            background: 'var(--bg-surface)', 
            padding: '1rem', 
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-color)',
            fontSize: '0.85rem',
            fontFamily: 'monospace',
            color: 'var(--text-muted)',
            overflowX: 'auto',
            maxHeight: '150px',
            overflowY: 'auto'
          }}>
            <div style={{ marginBottom: '0.5rem', fontWeight: 'bold' }}>Detalhes Técnicos:</div>
            <div>[Code]: {code}</div>
            <div>[Message]: {rawMessage}</div>
            {!!details && (
               <div style={{ marginTop: '0.5rem' }}>
                 [Extra]: {JSON.stringify(details, null, 2)}
               </div>
            )}
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
              textDecoration: 'underline'
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
            <button
              onClick={hideError}
              className="btn-primary"
              style={{ padding: '0.5rem 1.5rem' }}
            >
              Entendi
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
