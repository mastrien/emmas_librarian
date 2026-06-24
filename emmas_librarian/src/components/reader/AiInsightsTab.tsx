import React from 'react';
import { Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface AiInsightsTabProps {
  isGeneratingAi: boolean;
  aiSummary: { generalSummary: string; sectionSummary: string } | null;
  onGenerateSummary: () => void;
}

export const AiInsightsTab: React.FC<AiInsightsTabProps> = ({ isGeneratingAi, aiSummary, onGenerateSummary }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto' }}>
      <div
        style={{
          padding: '1rem',
          borderBottom: '1px solid var(--border-color)',
          background: 'rgba(79, 70, 229, 0.05)',
        }}
      >
        <h3
          style={{
            margin: 0,
            fontSize: '1.1rem',
            color: 'var(--color-primary)',
            marginBottom: '0.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          Resumo com IA
        </h3>
        <p style={{ margin: '0 0 1rem 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          Gere um resumo detalhado usando o modelo configurado.
        </p>
        <button
          onClick={onGenerateSummary}
          disabled={isGeneratingAi}
          className="btn-primary"
          style={{
            width: '100%',
            padding: '0.6rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
          }}
        >
          {isGeneratingAi ? (
            <>
              <Loader2 size={16} className="animate-spin" /> Gerando Resumo...
            </>
          ) : (
            <>Gerar Resumo com IA</>
          )}
        </button>
      </div>
      <div style={{ padding: '1rem', flexGrow: 1 }}>
        {!aiSummary ? (
          <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-muted)' }}>
            Nenhum resumo gerado ainda. Clique no botão acima para iniciar.
          </div>
        ) : (
          <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div>
              <h4 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-heading)', fontSize: '0.95rem' }}>Visão Geral</h4>
              <div
                className="markdown-body"
                style={{
                  fontSize: '0.85rem',
                  color: 'var(--text-main)',
                  lineHeight: 1.6,
                  background: 'var(--bg-main)',
                  padding: '1rem',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-color)',
                }}
              >
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{aiSummary.generalSummary}</ReactMarkdown>
              </div>
            </div>
            <div>
              <h4 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-heading)', fontSize: '0.95rem' }}>Por Seções</h4>
              <div
                className="markdown-body"
                style={{
                  fontSize: '0.85rem',
                  color: 'var(--text-main)',
                  lineHeight: 1.6,
                  background: 'var(--bg-main)',
                  padding: '1rem',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-color)',
                  whiteSpace: 'pre-wrap',
                }}
              >
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{aiSummary.sectionSummary}</ReactMarkdown>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
