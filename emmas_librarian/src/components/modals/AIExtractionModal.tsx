import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { X as XIcon, Trash2, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { type Article, type RAGExtractionResult as RAGExtractionResultType } from '../../types';
import QuestionSetCatalog from '../ai/QuestionSetCatalog';
import { InvestigationDetailView } from '../ai/InvestigationDetailView';
import { RAGResultCard } from '../ai/RAGResultCard';

export interface AIExtractionResult {
  article: Article;
  result?: RAGExtractionResultType[];
  error?: string;
}

export interface InvestigationHistoryRecord {
  id: number;
  created_at: string;
  status?: string;
  model_used?: string;
  questions?: string; // JSON string
  articles_ids?: string; // JSON string
}

export interface AIExtractionModalProps {
  isOpen: boolean;
  onClose: () => void;
  articlesWithPdf: Article[];
  aiQuestions: string[];
  setAiQuestions: (questions: string[]) => void;
  handleMassiveExtraction: (selectedIds: number[]) => void;
  isExtracting: boolean;
  extractionProgress: { current: number; total: number };
  aiExtractionResults: AIExtractionResult[];
  cancelExtractionRef: React.MutableRefObject<boolean>;
  investigationHistory?: InvestigationHistoryRecord[];
  articles?: Article[];
  getInvestigationResults: (investigationId: number) => Promise<import('../../types').InvestigationResult[]>;
}
export const AIExtractionModal = ({
  isOpen,
  onClose,
  articlesWithPdf,
  aiQuestions,
  setAiQuestions,
  handleMassiveExtraction,
  isExtracting,
  extractionProgress,
  aiExtractionResults,
  cancelExtractionRef,
  investigationHistory = [],
  articles = [],
  getInvestigationResults,
}: AIExtractionModalProps) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'new' | 'history'>('new');
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<InvestigationHistoryRecord | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [isCreatingSet, setIsCreatingSet] = useState(false);

  const handleViewDocument = (articleId: number) => {
    navigate(`/app/articles/${articleId}`);
    onClose();
  };

  useEffect(() => {
    if (isOpen && !isExtracting && aiExtractionResults.length === 0) {
      setSelectedIds(articlesWithPdf.map((a: Article) => a.id));
    }
  }, [isOpen, isExtracting, aiExtractionResults, articlesWithPdf]);

  if (!isOpen) return null;

  const isFinished = !isExtracting && aiExtractionResults.length > 0;

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
        zIndex: 99999,
      }}
    >
      <div
        className="card fade-in"
        style={{
          padding: '2rem',
          width: '800px',
          maxWidth: '95%',
          maxHeight: '90vh',
          overflowY: 'auto',
          background: 'var(--bg-main)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h3
            style={{ margin: 0, color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            Investigação Massiva com IA
          </h3>
          <button
            type="button"
            onClick={onClose}
            disabled={isExtracting}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: isExtracting ? 'not-allowed' : 'pointer',
              opacity: isExtracting ? 0.5 : 1,
            }}
          >
            <XIcon size={20} />
          </button>
        </div>

        <div
          style={{
            display: 'flex',
            gap: '1rem',
            marginBottom: '1.5rem',
            borderBottom: '1px solid var(--border-color)',
          }}
        >
          <button
            onClick={() => { setActiveTab('new'); setSelectedHistoryItem(null); }}
            style={{
              padding: '0.5rem 1rem',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              borderBottom: activeTab === 'new' ? '2px solid var(--color-primary)' : '2px solid transparent',
              color: activeTab === 'new' ? 'var(--color-primary)' : 'var(--text-muted)',
              fontWeight: activeTab === 'new' ? 600 : 400,
            }}
          >
            Nova Investigação
          </button>
          <button
            onClick={() => setActiveTab('history')}
            style={{
              padding: '0.5rem 1rem',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              borderBottom: activeTab === 'history' ? '2px solid var(--color-primary)' : '2px solid transparent',
              color: activeTab === 'history' ? 'var(--color-primary)' : 'var(--text-muted)',
              fontWeight: activeTab === 'history' ? 600 : 400,
            }}
          >
            Histórico
          </button>
        </div>

        {activeTab === 'new' ? (
          <>
            {articlesWithPdf.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>
                Nenhum artigo com PDF vinculado encontrado neste projeto.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div
                  style={{
                    padding: '1rem',
                    background: 'var(--bg-surface)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-color)',
                  }}
                >
                  <p style={{ margin: '0 0 1rem 0', fontSize: '0.9rem', color: 'var(--text-main)' }}>
                    Selecione os artigos (
                    <strong>
                      {selectedIds.length}/{articlesWithPdf.length}
                    </strong>
                    ) e faça perguntas. A IA buscará respostas.
                  </p>

                  {!isExtracting && !isFinished && (
                    <>
                      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                        <button
                          type="button"
                          className="btn-secondary"
                          style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                          onClick={() => setSelectedIds(articlesWithPdf.map((a: Article) => a.id))}
                        >
                          Selecionar Todos
                        </button>
                        <button
                          type="button"
                          className="btn-secondary"
                          style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                          onClick={() => setSelectedIds([])}
                        >
                          Desmarcar Todos
                        </button>
                      </div>
                      <div
                        style={{
                          maxHeight: '150px',
                          overflowY: 'auto',
                          border: '1px solid var(--border-color)',
                          borderRadius: 'var(--radius-sm)',
                          padding: '0.5rem',
                          marginBottom: '1rem',
                          background: 'var(--bg-main)',
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                          gap: '0.5rem',
                        }}
                      >
                        {articlesWithPdf.map((a: Article) => (
                          <label
                            key={a.id}
                            style={{
                              display: 'flex',
                              alignItems: 'flex-start',
                              gap: '0.5rem',
                              cursor: 'pointer',
                              fontSize: '0.85rem',
                              padding: '0.5rem',
                              borderRadius: 'var(--radius-sm)',
                              background: selectedIds.includes(a.id)
                                ? 'color-mix(in srgb, var(--color-primary) 10%, transparent)'
                                : 'var(--bg-surface)',
                              border: selectedIds.includes(a.id)
                                ? '1px solid var(--color-primary)'
                                : '1px solid var(--border-color)',
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={selectedIds.includes(a.id)}
                              onChange={(e) => {
                                if (e.target.checked) setSelectedIds([...selectedIds, a.id]);
                                else setSelectedIds(selectedIds.filter((id) => id !== a.id));
                              }}
                              style={{ marginTop: '0.2rem' }}
                            />
                            <span
                              style={{
                                lineHeight: '1.2',
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden',
                              }}
                            >
                              {a.title}
                            </span>
                          </label>
                        ))}
                      </div>
                    </>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
                    {isExtracting || isFinished ? (
                      <ul style={{ margin: 0, paddingLeft: '1.2rem', color: 'var(--text-main)', fontSize: '0.9rem' }}>
                        {aiQuestions
                          .filter((q: string) => q.trim().length > 0)
                          .map((q: string, idx: number) => (
                            <li key={idx} style={{ marginBottom: '0.3rem' }}>
                              {q}
                            </li>
                          ))}
                      </ul>
                    ) : (
                      <>
                        {aiQuestions.map((q: string, idx: number) => (
                          <div key={idx} style={{ display: 'flex', gap: '0.5rem' }}>
                            <input
                              type="text"
                              value={q}
                              onChange={(e) => {
                                const newQ = [...aiQuestions];
                                newQ[idx] = e.target.value;
                                setAiQuestions(newQ);
                              }}
                              className="input-field"
                              placeholder={`Pergunta ${idx + 1}`}
                              style={{ flex: 1 }}
                            />
                            <button
                              onClick={() => {
                                const newQ = aiQuestions.filter((_, i: number) => i !== idx);
                                setAiQuestions(newQ.length ? newQ : ['']);
                              }}
                              className="btn-secondary"
                              style={{ color: 'var(--color-danger)', padding: '0.5rem' }}
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        ))}
                      </>
                    )}
                  </div>

                  {!isExtracting && !isFinished && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <button
                        onClick={() => setAiQuestions([...aiQuestions, ''])}
                        className="btn-secondary"
                        style={{ fontSize: '0.85rem' }}
                      >
                        + Adicionar Pergunta
                      </button>
                      <button
                        className="btn-secondary"
                        onClick={() => setIsCreatingSet(true)}
                        disabled={aiQuestions.filter((q: string) => q.trim().length > 0).length === 0}
                        title={aiQuestions.filter((q: string) => q.trim().length > 0).length === 0 ? "Adicione perguntas acima para salvar" : "Salvar perguntas atuais como novo conjunto"}
                        style={{ fontSize: '0.85rem' }}
                      >
                        + Salvar Atual
                      </button>
                    </div>
                  )}

                  {!isExtracting && !isFinished && (
                    <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                      <QuestionSetCatalog 
                        projectId={articlesWithPdf[0]?.project_id || null} 
                        currentQuestions={aiQuestions}
                        onSelectSet={setAiQuestions}
                        isCreatingExternal={isCreatingSet}
                        onCancelCreateExternal={() => setIsCreatingSet(false)}
                      />
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                  {isExtracting ? (
                    <button
                      onClick={() => {
                        cancelExtractionRef.current = true;
                      }}
                      className="btn-secondary"
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        fontSize: '1rem',
                        justifyContent: 'center',
                        color: 'var(--color-danger)',
                        borderColor: 'var(--color-danger)',
                      }}
                    >
                      Cancelar Investigação
                    </button>
                  ) : isFinished ? (
                    <button
                      onClick={onClose}
                      className="btn-primary"
                      style={{ width: '100%', padding: '0.75rem', fontSize: '1rem', justifyContent: 'center' }}
                    >
                      Concluir Investigação
                    </button>
                  ) : (
                    <button
                      onClick={() => handleMassiveExtraction(selectedIds)}
                      disabled={selectedIds.length === 0 || aiQuestions.every((q: string) => !q.trim())}
                      className="btn-primary"
                      style={{ width: '100%', padding: '0.75rem', fontSize: '1rem', justifyContent: 'center' }}
                    >
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
                    Processando artigo {extractionProgress.current} de {extractionProgress.total}...
                  </div>
                )}

                {aiExtractionResults.length > 0 && (
                  <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <h4 style={{ margin: 0, color: 'var(--text-heading)' }}>Resultados</h4>
                    {aiExtractionResults.map((res, idx) => (
                      <div
                        key={idx}
                        className="card"
                        style={{
                          padding: '1rem',
                          border: '1px solid var(--border-color)',
                          background: 'var(--bg-surface)',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'flex-start',
                            marginBottom: '0.5rem',
                          }}
                        >
                          <h5 style={{ margin: 0, color: 'var(--color-primary)', flex: 1 }}>{res.article.title}</h5>
                        </div>
                        {res.error ? (
                          <div style={{ color: 'var(--color-danger)', fontSize: '0.85rem' }}>{res.error}</div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '0.5rem' }}>
                            {res.result?.map((r, rIdx) => (
                              <RAGResultCard 
                                key={rIdx} 
                                result={r} 
                                onViewDocument={(ev) => {
                                  navigate(`/reader/${res.article.id}`, { state: { searchQuery: ev.text, page: ev.page } });
                                  onClose();
                                }}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <div style={{ flex: 1, overflowY: 'auto', paddingRight: '0.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {selectedHistoryItem ? (
              <InvestigationDetailView
                investigation={selectedHistoryItem}
                articles={articles}
                getInvestigationResults={getInvestigationResults}
                onBack={() => setSelectedHistoryItem(null)}
                onReExecute={(questions, artIds) => {
                  setAiQuestions(questions);
                  setSelectedIds(artIds);
                  setSelectedHistoryItem(null);
                  setActiveTab('new');
                }}
              />
            ) : investigationHistory.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>
                Nenhum histórico encontrado.
              </div>
            ) : (
              investigationHistory.map((hist, idx) => {
                const qs = JSON.parse(hist.questions || '[]');
                const artIds = JSON.parse(hist.articles_ids || '[]');
                return (
                  <div
                    key={hist.id || idx}
                    className="card"
                    style={{
                      padding: '1rem',
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-surface)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <span style={{ fontWeight: 600, color: 'var(--text-heading)' }}>
                        {new Date(hist.created_at).toLocaleString()}
                      </span>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        {hist.status && (
                          <span
                            style={{
                              fontSize: '0.75rem',
                              padding: '0.15rem 0.4rem',
                              borderRadius: '4px',
                              background: hist.status === 'Sucesso' ? 'var(--color-success)' : 'var(--color-danger)',
                              color: 'white',
                              fontWeight: 600,
                            }}
                          >
                            {hist.status}
                          </span>
                        )}
                        {hist.model_used && (
                          <span
                            style={{
                              fontSize: '0.75rem',
                              color: 'var(--text-muted)',
                              background: 'var(--bg-main)',
                              padding: '0.2rem 0.5rem',
                              borderRadius: 'var(--radius-sm)',
                            }}
                          >
                            {hist.model_used}
                          </span>
                        )}
                        <span
                          style={{
                            fontSize: '0.85rem',
                            color: 'var(--text-muted)',
                            background: 'var(--bg-main)',
                            padding: '0.2rem 0.5rem',
                            borderRadius: 'var(--radius-sm)',
                          }}
                        >
                          {artIds.length} Artigos
                        </span>
                      </div>
                    </div>

                    <div style={{ marginBottom: '0.5rem' }}>
                      <strong style={{ fontSize: '0.85rem', color: 'var(--text-heading)' }}>Artigos Incluídos:</strong>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                        {artIds
                          .map((id: number) => {
                            const article = articles.find((a: Article) => a.id === id);
                            return article ? article.title : `Artigo #${id}`;
                          })
                          .join(' • ')}
                      </div>
                    </div>

                    <strong style={{ fontSize: '0.85rem', color: 'var(--text-heading)' }}>Perguntas:</strong>
                    <ul
                      style={{
                        margin: 0,
                        paddingLeft: '1.2rem',
                        color: 'var(--text-main)',
                        fontSize: '0.85rem',
                        marginTop: '0.2rem',
                      }}
                    >
                      {qs.map((q: string, i: number) => (
                        <li key={i}>{q}</li>
                      ))}
                    </ul>
                    <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
                      <button
                        onClick={() => setSelectedHistoryItem(hist)}
                        className="btn-primary"
                        style={{ padding: '0.4rem 1rem', fontSize: '0.85rem' }}
                      >
                        Ver Detalhes
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
};
