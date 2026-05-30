import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { projectService } from '../services/api';
import { Project, Article } from '../types';
import { ArrowLeft, ExternalLink, FileText, Calendar, Search, Download, Upload, Loader2, CheckCircle, Archive, History, Edit2, Trash2, Check, X as XIcon, BookOpen, ChevronLeft, ChevronRight, Plus, CopyPlus, Key, AlertCircle, Settings, Link as LinkIcon, File as FileIcon, PieChart as PieChartIcon, Tag, Tags, Brain } from 'lucide-react';
import { createPortal } from 'react-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
} from 'chart.js';
import { Pie, Bar } from 'react-chartjs-2';

ChartJS.register(
  ArcElement,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);
import { SearchHistoryModal } from '../components/SearchHistoryModal';
import { DiarySection } from '../components/DiarySection';
import { EditArticleModal } from '../components/EditArticleModal';
import { ManageQuickAccessModal } from '../components/ManageQuickAccessModal';
import { ProjectCategoriesModal } from '../components/ProjectCategoriesModal';
import { CategoryCell } from '../components/CategoryCell';
import { CitationModal } from '../components/CitationModal';

const ArchiveModal = ({ isOpen, onClose, onSubmit }: { isOpen: boolean, onClose: () => void, onSubmit: (note: string) => void }) => {
  const [note, setNote] = useState('');

  if (!isOpen) return null;

  return createPortal(
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999 }}>
      <div className="card fade-in" style={{ padding: '2rem', width: '400px', background: 'var(--bg-main)' }}>
        <h3 style={{ margin: '0 0 1rem 0' }}>Motivo do Arquivamento (Opcional)</h3>
        <form onSubmit={(e) => { e.preventDefault(); onSubmit(note); }}>
          <textarea 
            autoFocus
            value={note} 
            onChange={(e) => setNote(e.target.value)}
            placeholder="Por que este artigo não é relevante?"
            style={{ 
              width: '100%', height: '100px', padding: '0.75rem', 
              borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)',
              outline: 'none', resize: 'none', marginBottom: '1rem',
              fontFamily: 'inherit',
              background: 'var(--bg-surface)',
              color: 'var(--text-main)'
            }}
          />
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
            <button type="submit" className="btn-primary" style={{ background: 'var(--color-danger)', color: '#ffffff' }}>Confirmar Arquivamento</button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};

const ManualArticleModal = ({ isOpen, onClose, onSubmit }: { 
  isOpen: boolean; 
  onClose: () => void; 
  onSubmit: (data: any, filePath?: string) => Promise<void>; 
}) => {
  const [title, setTitle] = useState('');
  const [authors, setAuthors] = useState('');
  const [year, setYear] = useState('');
  const [doi, setDoi] = useState('');
  const [journal, setJournal] = useState('');
  const [abstract, setAbstract] = useState('');
  const [filePath, setFilePath] = useState<string | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setTitle('');
      setAuthors('');
      setYear('');
      setDoi('');
      setJournal('');
      setAbstract('');
      setFilePath(undefined);
      setSubmitting(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSelectFile = async () => {
    try {
      const selected = await projectService.openPdfDialog();
      if (selected) {
        setFilePath(selected);
      }
    } catch (err) {
      alert('Erro ao selecionar o arquivo PDF');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      alert('O título é obrigatório.');
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit({
        title: title.trim(),
        authors: authors.trim(),
        year: year.trim() || undefined,
        doi: doi.trim() || undefined,
        journal: journal.trim() || undefined,
        abstract: abstract.trim() || undefined
      }, filePath);
      onClose();
    } catch (err: any) {
      alert(`Erro ao adicionar artigo: ${err.message || err}`);
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999 }}>
      <div className="card fade-in" style={{ padding: '2rem', width: '550px', maxWidth: '95%', maxHeight: '90vh', overflowY: 'auto', background: 'var(--bg-main)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h3 style={{ margin: 0 }}>Adicionar Artigo Avulso</h3>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <XIcon size={20} />
          </button>
        </div>
        
        <div style={{ marginBottom: '1rem', padding: '0.75rem', borderRadius: 'var(--radius-md)', background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)', fontSize: '0.85rem', color: 'var(--color-danger)', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <span>⚠️</span>
          <span><strong>Atenção:</strong> Artigos adicionados de forma avulsa podem conter metadados incorretos ou incompletos.</span>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem', color: 'var(--text-muted)' }}>Título *</label>
            <input 
              type="text" 
              required
              placeholder="Ex: A New Approach to Bibliometrics"
              value={title} 
              onChange={(e) => setTitle(e.target.value)}
              style={{ 
                width: '100%', padding: '0.6rem 0.8rem', 
                borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)',
                outline: 'none', background: 'var(--bg-surface)', color: 'var(--text-main)',
                fontFamily: 'inherit'
              }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem', color: 'var(--text-muted)' }}>Autores</label>
              <input 
                type="text" 
                placeholder="Ex: John Doe, Jane Smith"
                value={authors} 
                onChange={(e) => setAuthors(e.target.value)}
                style={{ 
                  width: '100%', padding: '0.6rem 0.8rem', 
                  borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)',
                  outline: 'none', background: 'var(--bg-surface)', color: 'var(--text-main)',
                  fontFamily: 'inherit'
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem', color: 'var(--text-muted)' }}>Ano</label>
              <input 
                type="number" 
                placeholder="Ex: 2026"
                value={year} 
                onChange={(e) => setYear(e.target.value)}
                style={{ 
                  width: '100%', padding: '0.6rem 0.8rem', 
                  borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)',
                  outline: 'none', background: 'var(--bg-surface)', color: 'var(--text-main)',
                  fontFamily: 'inherit'
                }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem', color: 'var(--text-muted)' }}>DOI</label>
              <input 
                type="text" 
                placeholder="Ex: 10.1000/xyz123"
                value={doi} 
                onChange={(e) => setDoi(e.target.value)}
                style={{ 
                  width: '100%', padding: '0.6rem 0.8rem', 
                  borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)',
                  outline: 'none', background: 'var(--bg-surface)', color: 'var(--text-main)',
                  fontFamily: 'inherit'
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem', color: 'var(--text-muted)' }}>Revista / Periódico</label>
              <input 
                type="text" 
                placeholder="Ex: Nature"
                value={journal} 
                onChange={(e) => setJournal(e.target.value)}
                style={{ 
                  width: '100%', padding: '0.6rem 0.8rem', 
                  borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)',
                  outline: 'none', background: 'var(--bg-surface)', color: 'var(--text-main)',
                  fontFamily: 'inherit'
                }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem', color: 'var(--text-muted)' }}>Resumo</label>
            <textarea 
              placeholder="Resumo do artigo..."
              value={abstract} 
              onChange={(e) => setAbstract(e.target.value)}
              style={{ 
                width: '100%', height: '80px', padding: '0.6rem 0.8rem', 
                borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)',
                outline: 'none', resize: 'none', background: 'var(--bg-surface)', color: 'var(--text-main)',
                fontFamily: 'inherit'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem', color: 'var(--text-muted)' }}>Documento PDF (Opcional)</label>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button 
                type="button" 
                onClick={handleSelectFile} 
                className="btn-secondary"
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem' }}
              >
                <Upload size={16} /> {filePath ? 'Alterar PDF' : 'Selecionar PDF'}
              </button>
              {filePath && (
                <div style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.85rem', color: 'var(--text-muted)' }} title={filePath}>
                  {filePath.split('\\').pop()?.split('/').pop()}
                </div>
              )}
              {filePath && (
                <button 
                  type="button" 
                  onClick={() => setFilePath(undefined)} 
                  className="btn-secondary" 
                  style={{ color: 'var(--color-danger)', padding: '0.5rem' }}
                  title="Remover PDF"
                >
                  <XIcon size={16} />
                </button>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
            <button type="button" onClick={onClose} disabled={submitting} className="btn-secondary">Cancelar</button>
            <button type="submit" disabled={submitting} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {submitting ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
              Salvar Artigo
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};

const AIExtractionModal = ({ 
  isOpen, onClose, articlesWithPdf, 
  aiQuestions, setAiQuestions, 
  handleMassiveExtraction, isExtracting, extractionProgress, aiExtractionResults,
  cancelExtractionRef, investigationHistory = [], articles = []
}: any) => {
  const [activeTab, setActiveTab] = useState<'new' | 'history'>('new');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  useEffect(() => {
    if (isOpen && !isExtracting && aiExtractionResults.length === 0) {
      setSelectedIds(articlesWithPdf.map((a: any) => a.id));
    }
  }, [isOpen]); // Only run when modal is opened, avoid resetting when typing

  if (!isOpen) return null;

  const isFinished = !isExtracting && aiExtractionResults.length > 0;

  return createPortal(
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999 }}>
      <div className="card fade-in" style={{ padding: '2rem', width: '800px', maxWidth: '95%', maxHeight: '90vh', overflowY: 'auto', background: 'var(--bg-main)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h3 style={{ margin: 0, color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            Investigação Massiva com IA
          </h3>
          <button type="button" onClick={onClose} disabled={isExtracting} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: isExtracting ? 'not-allowed' : 'pointer', opacity: isExtracting ? 0.5 : 1 }}>
            <XIcon size={20} />
          </button>
        </div>

        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)' }}>
          <button 
            onClick={() => setActiveTab('new')}
            style={{ padding: '0.5rem 1rem', background: 'none', border: 'none', cursor: 'pointer', borderBottom: activeTab === 'new' ? '2px solid var(--color-primary)' : '2px solid transparent', color: activeTab === 'new' ? 'var(--color-primary)' : 'var(--text-muted)', fontWeight: activeTab === 'new' ? 600 : 400 }}
          >
            Nova Investigação
          </button>
          <button 
            onClick={() => setActiveTab('history')}
            style={{ padding: '0.5rem 1rem', background: 'none', border: 'none', cursor: 'pointer', borderBottom: activeTab === 'history' ? '2px solid var(--color-primary)' : '2px solid transparent', color: activeTab === 'history' ? 'var(--color-primary)' : 'var(--text-muted)', fontWeight: activeTab === 'history' ? 600 : 400 }}
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
                <div style={{ padding: '1rem', background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                  <p style={{ margin: '0 0 1rem 0', fontSize: '0.9rem', color: 'var(--text-main)' }}>
                    Selecione os artigos (<strong>{selectedIds.length}/{articlesWithPdf.length}</strong>) e faça perguntas. A IA buscará respostas.
                  </p>
                  
                  {!isExtracting && !isFinished && (
                    <>
                      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                        <button type="button" className="btn-secondary" style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }} onClick={() => setSelectedIds(articlesWithPdf.map((a:any) => a.id))}>Selecionar Todos</button>
                        <button type="button" className="btn-secondary" style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }} onClick={() => setSelectedIds([])}>Desmarcar Todos</button>
                      </div>
                      <div style={{ maxHeight: '150px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '0.5rem', marginBottom: '1rem', background: 'var(--bg-main)', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.5rem' }}>
                        {articlesWithPdf.map((a: any) => (
                      <label key={a.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem', padding: '0.5rem', borderRadius: 'var(--radius-sm)', background: selectedIds.includes(a.id) ? 'color-mix(in srgb, var(--color-primary) 10%, transparent)' : 'var(--bg-surface)', border: selectedIds.includes(a.id) ? '1px solid var(--color-primary)' : '1px solid var(--border-color)' }}>
                        <input 
                          type="checkbox" 
                          checked={selectedIds.includes(a.id)}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedIds([...selectedIds, a.id]);
                            else setSelectedIds(selectedIds.filter(id => id !== a.id));
                          }}
                          style={{ marginTop: '0.2rem' }}
                        />
                        <span style={{ lineHeight: '1.2', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{a.title}</span>
                      </label>
                    ))}
                  </div>
                </>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
                {isExtracting || isFinished ? (
                  <ul style={{ margin: 0, paddingLeft: '1.2rem', color: 'var(--text-main)', fontSize: '0.9rem' }}>
                    {aiQuestions.filter((q: string) => q.trim().length > 0).map((q: string, idx: number) => (
                      <li key={idx} style={{ marginBottom: '0.3rem' }}>{q}</li>
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
                          placeholder={`Pergunta ${idx + 1}`}
                          style={{ 
                            flex: 1, padding: '0.5rem', borderRadius: 'var(--radius-sm)', 
                            border: '1px solid var(--border-color)', background: 'var(--bg-main)', color: 'var(--text-main)',
                            outline: 'none'
                          }}
                        />
                        <button 
                          onClick={() => {
                            const newQ = aiQuestions.filter((_: any, i: number) => i !== idx);
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
                <button 
                  onClick={() => setAiQuestions([...aiQuestions, ''])}
                  className="btn-secondary"
                  style={{ fontSize: '0.85rem' }}
                >
                  + Adicionar Pergunta
                </button>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
              {isExtracting ? (
                <button 
                  onClick={() => { cancelExtractionRef.current = true; }}
                  className="btn-secondary"
                  style={{ width: '100%', padding: '0.75rem', fontSize: '1rem', justifyContent: 'center', color: 'var(--color-danger)', borderColor: 'var(--color-danger)' }}
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
                <Loader2 size={16} className="animate-spin" style={{ marginRight: '0.5rem', display: 'inline-block', verticalAlign: 'middle' }} />
                Processando artigo {extractionProgress.current} de {extractionProgress.total}...
              </div>
            )}

            {aiExtractionResults.length > 0 && (
              <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <h4 style={{ margin: 0, color: 'var(--text-heading)' }}>Resultados</h4>
                {aiExtractionResults.map((res: any, idx: number) => (
                  <div key={idx} className="card" style={{ padding: '1rem', border: '1px solid var(--border-color)', background: 'var(--bg-surface)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                      <h5 style={{ margin: 0, color: 'var(--color-primary)', flex: 1 }}>{res.article.title}</h5>
                    </div>
                    {res.error ? (
                      <div style={{ color: 'var(--color-danger)', fontSize: '0.85rem' }}>{res.error}</div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '0.5rem' }}>
                        {res.result.map((r: any, rIdx: number) => (
                          <div key={rIdx} style={{ background: 'var(--bg-main)', padding: '0.75rem', borderRadius: 'var(--radius-sm)' }}>
                            <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.5rem', color: 'var(--text-heading)' }}>
                              Q: {r.question}
                            </div>
                            <div className="markdown-body" style={{ fontSize: '0.85rem', color: 'var(--text-main)', marginBottom: '0.5rem' }}>
                              <ReactMarkdown remarkPlugins={[remarkGfm]}>{typeof r.answer === 'string' ? r.answer.replace(/\\n/g, '\n') : r.answer}</ReactMarkdown>
                            </div>
                            {r.quote && (
                              <div style={{ fontSize: '0.8rem', fontStyle: 'italic', color: 'var(--text-muted)', borderLeft: '3px solid var(--color-primary)', paddingLeft: '0.5rem' }}>
                                "{r.quote}"
                              </div>
                            )}
                          </div>
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {investigationHistory.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>Nenhum histórico encontrado.</div>
            ) : (
              investigationHistory.map((hist: any, idx: number) => {
                const qs = JSON.parse(hist.questions || '[]');
                const artIds = JSON.parse(hist.articles_ids || '[]');
                return (
                  <div key={idx} className="card" style={{ padding: '1rem', border: '1px solid var(--border-color)', background: 'var(--bg-surface)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <span style={{ fontWeight: 600, color: 'var(--text-heading)' }}>{new Date(hist.created_at).toLocaleString()}</span>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        {hist.status && (
                          <span style={{ 
                            fontSize: '0.75rem', 
                            padding: '0.15rem 0.4rem', 
                            borderRadius: '4px', 
                            background: hist.status === 'Sucesso' ? 'var(--color-success)' : 'var(--color-danger)', 
                            color: 'white',
                            fontWeight: 600
                          }}>
                            {hist.status}
                          </span>
                        )}
                        {hist.model_used && (
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', background: 'var(--bg-main)', padding: '0.2rem 0.5rem', borderRadius: 'var(--radius-sm)' }}>
                            {hist.model_used}
                          </span>
                        )}
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', background: 'var(--bg-main)', padding: '0.2rem 0.5rem', borderRadius: 'var(--radius-sm)' }}>{artIds.length} Artigos</span>
                      </div>
                    </div>
                    
                    <div style={{ marginBottom: '0.5rem' }}>
                      <strong style={{ fontSize: '0.85rem', color: 'var(--text-heading)' }}>Artigos Incluídos:</strong>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                        {artIds.map((id: number) => {
                          const article = articles.find((a: any) => a.id === id);
                          return article ? article.title : `Artigo #${id}`;
                        }).join(' • ')}
                      </div>
                    </div>

                    <strong style={{ fontSize: '0.85rem', color: 'var(--text-heading)' }}>Perguntas:</strong>
                    <ul style={{ margin: 0, paddingLeft: '1.2rem', color: 'var(--text-main)', fontSize: '0.85rem', marginTop: '0.2rem' }}>
                      {qs.map((q: string, i: number) => <li key={i}>{q}</li>)}
                    </ul>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};

type TabId = 'articles' | 'overview' | 'diary' | 'history' | 'categories';

const ITEMS_PER_PAGE = 50;

const isArticleManual = (article: Article) => {
  try {
    return JSON.parse(article.source_databases as string).includes('Manual');
  } catch {
    return false;
  }
};

export const ProjectDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [onlyWithPdf, setOnlyWithPdf] = useState(false);
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [uploadingId, setUploadingId] = useState<number | null>(null);
  const [archivingId, setArchivingId] = useState<number | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [newName, setNewName] = useState('');
  const [activeTab, setActiveTab] = useState<TabId>('articles');
  const [currentPage, setCurrentPage] = useState(1);
  const [isCategoriesModalOpen, setIsCategoriesModalOpen] = useState(false);
  const [projectCategories, setProjectCategories] = useState<any[]>([]);
  const [articleCategories, setArticleCategories] = useState<any[]>([]);
  const [editingArticle, setEditingArticle] = useState<Article | null>(null);
  const [isImportingPdfs, setIsImportingPdfs] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const navigate = useNavigate();

  const [isAIExtractionModalOpen, setIsAIExtractionModalOpen] = useState(false);
  const [aiQuestions, setAiQuestions] = useState<string[]>(['']);
  const [aiExtractionResults, setAiExtractionResults] = useState<any[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionProgress, setExtractionProgress] = useState({ current: 0, total: 0 });
  const [citationArticle, setCitationArticle] = useState<Article | null>(null);
  
  const [sortOrder, setSortOrder] = useState(() => {
    return localStorage.getItem('emmas_librarian_sort_order') || 'added-desc';
  });

  useEffect(() => {
    localStorage.setItem('emmas_librarian_sort_order', sortOrder);
  }, [sortOrder]);
  
  const cancelExtractionRef = useRef(false);
  const [showQuotaModal, setShowQuotaModal] = useState(false);

  const [hasAiKey, setHasAiKey] = useState(false);
  const [showKeyAlert, setShowKeyAlert] = useState(false);

  const [projectDocuments, setProjectDocuments] = useState<any[]>([]);
  const [isQuickAccessModalOpen, setIsQuickAccessModalOpen] = useState(false);
  
  const [investigationHistory, setInvestigationHistory] = useState<any[]>([]);

  const fetchData = useCallback(async () => {
    if (!id) return;
    try {
      const [projData, artData, histData, openai, gemini, anthropic, ollama, docsData, invHist, projCategories, artCategories] = await Promise.all([
        projectService.getProject(parseInt(id)),
        projectService.getArticles(parseInt(id)),
        projectService.getSearchHistory(parseInt(id)),
        projectService.getSetting('api_key_openai'),
        projectService.getSetting('api_key_gemini'),
        projectService.getSetting('api_key_anthropic'),
        projectService.getSetting('api_key_ollama'),
        projectService.getProjectDocuments(parseInt(id)),
        projectService.getMassiveInvestigations(parseInt(id)),
        projectService.getProjectCategories(parseInt(id)),
        projectService.getAllProjectArticleCategories(parseInt(id))
      ]);
      setProject(projData);
      setArticles(artData);
      setHistory(histData);
      setHasAiKey(!!(openai || gemini || anthropic || ollama));
      setNewName(projData.name);
      setProjectDocuments(docsData);
      setInvestigationHistory(invHist);
      setProjectCategories(projCategories);
      setArticleCategories(artCategories);
    } catch (err) {
      console.error('Erro ao carregar dados do projeto', err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [id]);

  const handleCloseAIExtractionModal = () => {
    setIsAIExtractionModalOpen(false);
    setAiQuestions(['']);
    setAiExtractionResults([]);
    setExtractionProgress({ current: 0, total: 0 });
    setIsExtracting(false);
  };

  const handleUploadClick = useCallback(async (articleId: number) => {
    setUploadingId(articleId);
    try {
      const filePath = await projectService.openPdfDialog();
      if (filePath) {
        await projectService.uploadPdf(articleId, filePath);
        await fetchData();
      }
    } catch (err) {
      alert('Erro ao fazer upload do PDF');
    } finally {
      setUploadingId(null);
    }
  }, [fetchData]);

  const handleUnlinkClick = useCallback(async (articleId: number) => {
    if (window.confirm("Deseja realmente desvincular o PDF deste artigo? O arquivo físico será removido do armazenamento local.")) {
      try {
        await projectService.unlinkPdf(articleId);
        await fetchData();
      } catch (err) {
        alert('Erro ao desvincular o PDF');
      }
    }
  }, [fetchData]);

  const handleRevertSearch = async (searchId: number) => {
    try {
      await projectService.revertSearch(searchId);
      await fetchData();
    } catch (err) {
      alert('Erro ao desfazer a busca');
    }
  };

  const handleStatusChange = useCallback(async (articleId: number, status: 'new' | 'read' | 'archived', note?: string) => {
    try {
      await projectService.updateArticleStatus(articleId, status, note);
      setArticles(prev => prev.map(a => a.id === articleId ? { ...a, status, archive_note: note } : a));
    } catch (e: any) {
      alert(`Erro ao atualizar status do artigo: ${e.message}`);
    }
  }, []);

  const handleUpdateName = async () => {
    if (!id || !newName.trim()) return;
    try {
      await projectService.updateProject(parseInt(id), newName.trim());
      setProject(prev => prev ? { ...prev, name: newName.trim() } : null);
      setIsEditingName(false);
    } catch (e) {
      alert('Erro ao atualizar nome do projeto');
    }
  };

  const handleDeleteProject = async () => {
    if (!id || !project) return;
    if (window.confirm(`Tem certeza que deseja excluir o projeto "${project.name}"? Todos os artigos e anotações serão perdidos permanentemente.`)) {
      try {
        await projectService.deleteProject(parseInt(id));
        navigate('/');
      } catch (e) {
        alert('Erro ao excluir projeto');
      }
    }
  };

  const handleArchiveSubmit = (note: string) => {
    if (archivingId) {
      handleStatusChange(archivingId, 'archived', note);
      setArchivingId(null);
    }
  };

  const handleManualArticleSubmit = async (data: any, filePath?: string) => {
    if (!id) return;
    await projectService.createManualArticle(parseInt(id), data, filePath);
    await fetchData();
  };

  const handleEditArticleSubmit = async (data: any) => {
    if (!editingArticle) return;
    await projectService.updateArticleMetadata(editingArticle.id, data);
    await fetchData();
  };

  const handleBatchPdfImport = async () => {
    if (!id) return;
    try {
      setIsImportingPdfs(true);
      const filePaths = await projectService.openMultiplePdfsDialog();
      if (filePaths && filePaths.length > 0) {
        const count = await projectService.createArticlesFromPdfs(parseInt(id), filePaths);
        alert(`${count} artigo(s) importado(s) com sucesso.`);
        await fetchData();
      }
    } catch (err: any) {
      alert(`Erro ao importar PDFs: ${err.message || err}`);
    } finally {
      setIsImportingPdfs(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (!id) return;

    const files = Array.from(e.dataTransfer.files);
    const pdfFiles = files.filter(f => f.name.toLowerCase().endsWith('.pdf'));
    
    if (pdfFiles.length > 0) {
      try {
        setIsImportingPdfs(true);
        // @ts-ignore
        const filePaths = pdfFiles.map(f => window.electronAPI && window.electronAPI.getPathForFile ? window.electronAPI.getPathForFile(f) : (f.path || f.name));
        const count = await projectService.createArticlesFromPdfs(parseInt(id), filePaths);
        alert(`${count} artigo(s) importado(s) com sucesso.`);
        await fetchData();
      } catch (err: any) {
        alert(`Erro ao importar PDFs: ${err.message || err}`);
      } finally {
        setIsImportingPdfs(false);
      }
    }
  };

  const handleMassiveExtraction = async (selectedIds: number[]) => {
    const validQuestions = aiQuestions.filter(q => q.trim().length > 0);
    if (validQuestions.length === 0) return;

    const articlesToExtract = articles.filter(a => selectedIds.includes(a.id));
    if (articlesToExtract.length === 0) return;

    setIsExtracting(true);
    cancelExtractionRef.current = false;
    setExtractionProgress({ current: 0, total: articlesToExtract.length });
    setAiExtractionResults([]);

    const results = [];
    let finalStatus = 'Sucesso';
    for (let i = 0; i < articlesToExtract.length; i++) {
      if (cancelExtractionRef.current) break;

      const article = articlesToExtract[i];
      setExtractionProgress({ current: i + 1, total: articlesToExtract.length });
      try {
        const result = await projectService.massiveExtraction(article.id, validQuestions);
        results.push({ article, result });
        setAiExtractionResults([...results]);
        
      } catch (err: any) {
        console.error(`Erro ao extrair de ${article.title}:`, err);
        if (err.message && (err.message.includes('429') || err.message.includes('QUOTA_EXCEEDED'))) {
          setShowQuotaModal(true);
          cancelExtractionRef.current = true;
          finalStatus = 'Erro: Quota Excedida';
          break;
        }
        results.push({ article, error: "Falha ao processar." });
        setAiExtractionResults([...results]);
        finalStatus = 'Erro Parcial';
      }
    }

    if (id && results.length > 0) {
      const openai = await projectService.getSetting('api_key_openai');
      const gemini = await projectService.getSetting('api_key_gemini');
      const ollama = await projectService.getSetting('ollama_model');
      const modelUsed = openai ? 'OpenAI' : gemini ? 'Gemini' : ollama ? `Ollama (${ollama})` : 'Desconhecido';

      await projectService.saveMassiveInvestigation(parseInt(id), validQuestions, selectedIds, modelUsed, finalStatus);
      // refetch history
      const newHist = await projectService.getMassiveInvestigations(parseInt(id));
      setInvestigationHistory(newHist);
    }

    setIsExtracting(false);
  };

  const filteredArticles = articles.filter(a => {
    const matchesSearch = (a.title || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (a.authors || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesPdf = !onlyWithPdf || !!a.local_file_path;
    return matchesSearch && matchesPdf;
  });

  const sortedArticles = [...filteredArticles].sort((a, b) => {
    switch (sortOrder) {
      case 'year-desc':
        return (parseInt(b.year?.toString() || '0') || 0) - (parseInt(a.year?.toString() || '0') || 0);
      case 'year-asc':
        return (parseInt(a.year?.toString() || '0') || 0) - (parseInt(b.year?.toString() || '0') || 0);
      case 'title-asc':
        return (a.title || '').localeCompare(b.title || '');
      case 'title-desc':
        return (b.title || '').localeCompare(a.title || '');
      case 'added-desc':
        return (b.id || 0) - (a.id || 0);
      case 'added-asc':
        return (a.id || 0) - (b.id || 0);
      default:
        return 0;
    }
  });

  const activeArticles = sortedArticles.filter(a => a.status === 'new' || !a.status);
  const readArticles = sortedArticles.filter(a => a.status === 'read');
  const archivedArticles = sortedArticles.filter(a => a.status === 'archived');

  // Pagination
  const totalPages = Math.max(1, Math.ceil(activeArticles.length / ITEMS_PER_PAGE));
  const paginatedArticles = activeArticles.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Carregando...</div>;
  if (!project) return <div style={{ padding: '2rem', textAlign: 'center' }}>Projeto não encontrado.</div>;

  const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: 'articles', label: `Artigos (${articles.length})`, icon: <FileText size={16} /> },
    { id: 'overview', label: 'Estatísticas', icon: <PieChartIcon size={16} /> },
    { id: 'diary', label: 'Diário', icon: <BookOpen size={16} /> },
    { id: 'categories', label: 'Categorias', icon: <Tags size={16} /> },
    { id: 'history', label: `Histórico (${history.length})`, icon: <History size={16} /> },
  ];

  return (
    <div 
      className="fade-in" 
      style={{ maxWidth: '1200px', margin: '0 auto', position: 'relative', minHeight: '80vh' }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isDragging && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          backdropFilter: 'blur(4px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '4px dashed var(--color-primary)'
        }}>
          <h2 style={{ color: 'white', fontSize: '2rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <CopyPlus size={40} /> Solte seus PDFs aqui para importar
          </h2>
        </div>
      )}

      <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', color: 'var(--text-muted)' }}>
        <ArrowLeft size={18} /> Voltar para Projetos
      </Link>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '2rem' }}>
        <div>
          {isEditingName ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <input 
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                style={{ 
                  fontSize: '2rem', 
                  fontWeight: 700, 
                  background: 'var(--bg-main)', 
                  border: '1px solid var(--color-primary)', 
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--text-heading)',
                  padding: '0.2rem 0.5rem',
                  width: '100%',
                  maxWidth: '600px'
                }}
                autoFocus
              />
              <button onClick={handleUpdateName} className="btn-primary" style={{ padding: '0.5rem' }}><Check size={20} /></button>
              <button onClick={() => { setIsEditingName(false); setNewName(project.name); }} className="btn-secondary" style={{ padding: '0.5rem' }}><XIcon size={20} /></button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
              <h1 style={{ margin: 0, fontSize: '2rem' }}>{project.name}</h1>
              <button onClick={() => setIsEditingName(true)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.2rem', display: 'flex' }}>
                <Edit2 size={20} />
              </button>
              <button onClick={handleDeleteProject} style={{ background: 'none', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', padding: '0.2rem', display: 'flex' }}>
                <Trash2 size={20} />
              </button>
            </div>
          )}
          <p style={{ color: 'var(--text-muted)', margin: 0 }}>
            Criado em {new Date(project.created_at).toLocaleDateString()} &middot; {articles.length} artigos no total
          </p>
        </div>
        
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <button onClick={() => projectService.exportBiblioshiny(project.id)} className="btn-secondary" title="Exportar no formato compatível com Biblioshiny">
            <Download size={18} /> Biblioshiny
          </button>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button onClick={() => setIsAIExtractionModalOpen(true)} className="btn-primary" title="Extração Inteligente IA">
            <Brain size={18} /> Extração IA
          </button>
          <button onClick={() => document.getElementById('batch-pdf-upload')?.click()} className="btn-secondary" title="Importar PDFs em Lote">
            <Upload size={18} /> Importar PDFs
          </button>
          <button onClick={() => setIsManualModalOpen(true)} className="btn-secondary" title="Adicionar artigo manualmente">
            <Plus size={18} /> Manual
          </button>
        </div>
          <button 
            onClick={async () => {
              await projectService.exportProject(project.id);
            }} 
            className="btn-secondary" 
            title="Exportar projeto completo com PDFs (.emmapcarc)"
          >
            <Download size={18} /> .emmapcarc
          </button>
          <Link to={`/projects/${project.id}/search`} className="btn-primary">
            <Search size={18} /> Nova Busca
          </Link>
          <button onClick={() => setIsCategoriesModalOpen(true)} className="btn-secondary" title="Gerenciar categorias de artigos">
            <Tag size={18} /> Categorias
          </button>
        </div>

        {/* Acesso rápido */}
        <div style={{ marginTop: '0.5rem', background: 'var(--bg-surface)', padding: '1rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-heading)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <LinkIcon size={16} /> Acesso rápido
            </h3>
            <button 
              onClick={() => setIsQuickAccessModalOpen(true)} 
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.2rem', display: 'flex', transition: 'color var(--transition-fast)' }}
              title="Gerenciar acessos rápidos"
            >
              <Settings size={16} />
            </button>
          </div>
          
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {projectDocuments.length === 0 ? (
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', padding: '0.5rem 0' }}>
                Nenhum link ou documento cadastrado. Clique na engrenagem para adicionar.
              </div>
            ) : (
              projectDocuments.map(doc => (
                <button
                  key={doc.id}
                  onClick={() => projectService.openProjectDocument(doc.url, doc.local_file_path)}
                  className="btn-secondary fade-in"
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0.8rem', fontSize: '0.85rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)' }}
                  title={doc.url || doc.local_file_path}
                >
                  {doc.url ? <LinkIcon size={14} color="var(--color-primary)" /> : <FileIcon size={14} color="var(--color-secondary)" />}
                  {doc.title}
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '1.5rem', borderBottom: '2px solid var(--border-color)' }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              padding: '0.75rem 1.5rem',
              border: 'none',
              background: 'transparent',
              color: activeTab === tab.id ? 'var(--color-primary)' : 'var(--text-muted)',
              fontWeight: activeTab === tab.id ? 600 : 400,
              fontSize: '0.95rem',
              cursor: 'pointer',
              borderBottom: activeTab === tab.id ? '2px solid var(--color-primary)' : '2px solid transparent',
              marginBottom: '-2px',
              transition: 'all var(--transition-fast)'
            }}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content: Articles */}
      {activeTab === 'articles' && (
        <>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <div style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>
                <Search size={18} />
              </div>
              <input 
                type="text" 
                placeholder="Filtrar por título ou autor..." 
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                style={{ 
                  width: '100%', 
                  padding: '0.8rem 1rem 0.8rem 2.8rem', 
                  fontSize: '1rem', 
                  border: '1px solid var(--border-color)', 
                  borderRadius: 'var(--radius-lg)',
                  boxShadow: 'var(--shadow-sm)',
                  outline: 'none',
                  background: 'var(--bg-surface)',
                  color: 'var(--text-main)',
                  transition: 'border-color var(--transition-fast)'
                }}
                onFocus={(e) => e.currentTarget.style.borderColor = 'var(--color-primary)'}
                onBlur={(e) => e.currentTarget.style.borderColor = 'var(--border-color)'}
              />
            </div>

            <label style={{ 
              display: 'inline-flex', 
              alignItems: 'center', 
              gap: '0.5rem', 
              cursor: 'pointer',
              fontSize: '0.95rem',
              fontWeight: 500,
              color: 'var(--text-main)',
              userSelect: 'none',
              padding: '0.5rem 1rem',
              background: onlyWithPdf ? 'var(--bg-surface)' : 'transparent',
              border: '1px solid ' + (onlyWithPdf ? 'var(--color-primary)' : 'var(--border-color)'),
              borderRadius: 'var(--radius-lg)',
              transition: 'all var(--transition-fast)',
              boxShadow: onlyWithPdf ? 'var(--shadow-sm)' : 'none'
            }}>
              <input 
                type="checkbox" 
                checked={onlyWithPdf} 
                onChange={(e) => {
                  setOnlyWithPdf(e.target.checked);
                  setCurrentPage(1);
                }} 
                style={{ cursor: 'pointer', accentColor: 'var(--color-primary)' }}
              />
              <span>Apenas com PDF vinculado</span>
            </label>

            <div style={{ position: 'relative' }}>
              <select 
                value={sortOrder}
                onChange={(e) => {
                  setSortOrder(e.target.value);
                  setCurrentPage(1);
                }}
                style={{ 
                  padding: '0.8rem 1rem', 
                  fontSize: '0.95rem', 
                  border: '1px solid var(--border-color)', 
                  borderRadius: 'var(--radius-lg)',
                  outline: 'none',
                  background: 'var(--bg-surface)',
                  color: 'var(--text-main)',
                  cursor: 'pointer'
                }}
              >
                <option value="year-desc">Mais Recentes (Ano)</option>
                <option value="year-asc">Mais Antigos (Ano)</option>
                <option value="title-asc">Título (A-Z)</option>
                <option value="title-desc">Título (Z-A)</option>
                <option value="added-desc">Últimos Adicionados</option>
                <option value="added-asc">Primeiros Adicionados</option>
              </select>
            </div>
          </div>

          {readArticles.length > 0 && (
            <details style={{ marginBottom: '1rem', background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', padding: '1rem' }}>
              <summary style={{ fontWeight: 600, color: 'var(--color-primary)', cursor: 'pointer', outline: 'none' }}>
                Artigos Lidos ({readArticles.length})
              </summary>
              <div style={{ marginTop: '1rem' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                  <tbody>
                    {readArticles.map(article => (
                      <tr key={article.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '0.75rem 1rem' }}>{article.title}</td>
                        <td style={{ padding: '0.75rem 1rem', width: '200px' }}>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <Link to={`/articles/${article.id}`} className="btn-secondary" style={{ padding: '0.3rem 0.5rem', fontSize: '0.75rem' }}>Ver</Link>
                            <button onClick={() => handleStatusChange(article.id, 'new')} className="btn-secondary" style={{ padding: '0.3rem 0.5rem', fontSize: '0.75rem' }}>Desmarcar</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          )}

          {archivedArticles.length > 0 && (
            <details style={{ marginBottom: '1rem', background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', padding: '1rem' }}>
              <summary style={{ fontWeight: 600, color: 'var(--color-danger)', cursor: 'pointer', outline: 'none' }}>
                Artigos Arquivados ({archivedArticles.length})
              </summary>
              <div style={{ marginTop: '1rem' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                  <tbody>
                    {archivedArticles.map(article => (
                      <tr key={article.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '0.75rem 1rem' }}>
                          <div style={{ fontWeight: 500, marginBottom: '0.25rem' }}>{article.title}</div>
                          <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontStyle: 'italic' }}>Motivo: {article.archive_note}</div>
                        </td>
                        <td style={{ padding: '0.75rem 1rem', width: '150px' }}>
                          <button onClick={() => handleStatusChange(article.id, 'new')} className="btn-secondary" style={{ padding: '0.3rem 0.5rem', fontSize: '0.75rem' }}>Restaurar</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          )}

          {/* Pagination info */}
          {activeArticles.length > ITEMS_PER_PAGE && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              <span>
                Mostrando {(currentPage - 1) * ITEMS_PER_PAGE + 1}-{Math.min(currentPage * ITEMS_PER_PAGE, activeArticles.length)} de {activeArticles.length} artigos
              </span>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="btn-secondary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}>
                  <ChevronLeft size={14} />
                </button>
                <span style={{ fontWeight: 600 }}>{currentPage} / {totalPages}</span>
                <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="btn-secondary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}>
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}

          <div className="card" style={{ overflowX: 'auto', border: 'none', marginBottom: '2rem' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'var(--bg-main)', borderBottom: '2px solid var(--border-color)' }}>
                  <th style={{ padding: '1rem 1.5rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.875rem' }}>TÍTULO</th>
                  <th style={{ padding: '1rem 1.5rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.875rem' }}>AUTORES</th>
                  <th style={{ padding: '1rem 1.5rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.875rem' }}>AÇÕES</th>
                </tr>
              </thead>
              <tbody>
                {paginatedArticles.map(article => (
                  <tr key={article.id} style={{ borderBottom: '1px solid var(--border-color)', transition: 'background var(--transition-fast)' }} onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-main)'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                    <td style={{ padding: '1.25rem 1.5rem', maxWidth: '350px' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-heading)', marginBottom: '0.25rem', lineHeight: '1.4' }}>{article.title}</div>
                      {article.doi && (
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                          DOI: {article.doi}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '1.25rem 1.5rem', color: 'var(--text-main)', fontSize: '0.9rem', maxWidth: '250px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.4rem' }}>
                        <Calendar size={14} color="var(--text-muted)" /> {article.year || 'N/A'}
                      </div>
                      {article.authors}
                    </td>
                    <td style={{ padding: '1.25rem 1.5rem' }}>
                      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                        {article.local_file_path ? (
                          <>
                            <Link to={`/articles/${article.id}`} className="btn-primary" style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem' }}>
                              <FileText size={14} /> Ler
                            </Link>
                            <button onClick={() => handleUnlinkClick(article.id)} className="btn-secondary" style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem', color: 'var(--color-danger)' }} title="Desvincular PDF">
                              <XIcon size={14} />
                            </button>
                          </>
                        ) : (
                          <button onClick={() => handleUploadClick(article.id)} disabled={uploadingId === article.id} className="btn-secondary" style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem' }} title="Vincular PDF">
                            {uploadingId === article.id ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} PDF
                          </button>
                        )}

                        <button onClick={() => handleStatusChange(article.id, 'read')} className="btn-secondary" style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem' }} title="Marcar como Lido">
                          <CheckCircle size={14} /> Lido
                        </button>
                        
                        {isArticleManual(article) && (
                          <button onClick={() => setEditingArticle(article)} className="btn-secondary" style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem' }} title="Editar Metadados">
                            <Edit2 size={14} /> Editar
                          </button>
                        )}

                        <button onClick={() => setArchivingId(article.id)} className="btn-secondary" style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem', color: 'var(--color-danger)' }} title="Arquivar">
                          <Archive size={14} /> Arquivar
                        </button>

                        <button onClick={() => setCitationArticle(article)} className="btn-secondary" style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem' }} title="Gerar Citação">
                          <CopyPlus size={14} /> Citar
                        </button>

                        {article.doi && (
                          <a href={`https://doi.org/${article.doi}`} target="_blank" rel="noreferrer" className="btn-secondary" style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem', textDecoration: 'none' }} title="Abrir no Navegador">
                            <ExternalLink size={14} /> Buscar por DOI
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {activeArticles.length === 0 && (
              <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                Nenhum artigo ativo na biblioteca.
              </div>
            )}
          </div>

          {/* Bottom pagination */}
          {activeArticles.length > ITEMS_PER_PAGE && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', alignItems: 'center', marginBottom: '2rem' }}>
              <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="btn-secondary" style={{ padding: '0.4rem 0.8rem' }}>
                <ChevronLeft size={16} /> Anterior
              </button>
              <span style={{ padding: '0 1rem', color: 'var(--text-muted)' }}>{currentPage} / {totalPages}</span>
              <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="btn-secondary" style={{ padding: '0.4rem 0.8rem' }}>
                Próxima <ChevronRight size={16} />
              </button>
            </div>
          )}
        </>
      )}

      {/* Tab Content: Overview */}
      {activeTab === 'overview' && (
        <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
            <div className="card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <h3 style={{ margin: '0 0 1rem 0' }}>Status dos Artigos</h3>
              <div style={{ width: '100%', height: '300px', position: 'relative' }}>
                <Pie
                  data={{
                    labels: ['Ativos', 'Lidos', 'Arquivados'],
                    datasets: [{
                      data: [activeArticles.length, readArticles.length, archivedArticles.length],
                      backgroundColor: ['#3b82f6', '#10b981', '#6b7280'],
                      borderWidth: 0,
                    }]
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: '70%',
                    plugins: {
                      legend: { display: false },
                      tooltip: {
                        backgroundColor: 'rgba(0,0,0,0.8)',
                        padding: 12,
                        cornerRadius: 8,
                      }
                    }
                  }}
                />
              </div>
              <div style={{ display: 'flex', gap: '1.5rem', marginTop: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><div style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#3b82f6' }} /> Ativos ({activeArticles.length})</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><div style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#10b981' }} /> Lidos ({readArticles.length})</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><div style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#6b7280' }} /> Arquivados ({archivedArticles.length})</div>
              </div>
            </div>

            <div className="card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <h3 style={{ margin: '0 0 1rem 0' }}>Artigos por Ano</h3>
              <div style={{ width: '100%', height: '300px', position: 'relative' }}>
                <Bar
                  data={{
                    labels: Object.entries(
                      filteredArticles.reduce((acc: Record<string, number>, art) => {
                        const year = art.year ? art.year.toString() : 'N/A';
                        acc[year] = (acc[year] || 0) + 1;
                        return acc;
                      }, {})
                    ).sort(([a], [b]) => a.localeCompare(b)).map(([year]) => year),
                    datasets: [{
                      label: 'Quantidade',
                      data: Object.entries(
                        filteredArticles.reduce((acc: Record<string, number>, art) => {
                          const year = art.year ? art.year.toString() : 'N/A';
                          acc[year] = (acc[year] || 0) + 1;
                          return acc;
                        }, {})
                      ).sort(([a], [b]) => a.localeCompare(b)).map(([, count]) => count),
                      backgroundColor: '#3b82f6',
                      borderRadius: 4,
                    }]
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: { display: false },
                      tooltip: {
                        backgroundColor: 'rgba(0,0,0,0.8)',
                        padding: 12,
                        cornerRadius: 8,
                      }
                    },
                    scales: {
                      y: {
                        beginAtZero: true,
                        ticks: {
                          stepSize: 1,
                          color: '#9ca3af'
                        },
                        grid: {
                          color: 'rgba(156, 163, 175, 0.1)'
                        }
                      },
                      x: {
                        ticks: {
                          color: '#9ca3af'
                        },
                        grid: {
                          display: false
                        }
                      }
                    }
                  }}
                />
              </div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
            {/* Open Access Pie */}
            <div className="card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <h3 style={{ margin: '0 0 1rem 0' }}>Acesso Aberto (Open Access)</h3>
              <div style={{ width: '100%', height: '300px', position: 'relative' }}>
                <Pie
                  data={{
                    labels: ['Open Access', 'Closed Access', 'Desconhecido'],
                    datasets: [{
                      data: [
                        filteredArticles.filter(a => {
                          let isOa = a.is_oa;
                          if (isOa === undefined && a.csl_json) {
                            try { const csl = typeof a.csl_json === 'string' ? JSON.parse(a.csl_json) : a.csl_json; isOa = csl.is_oa ? 1 : 0; } catch (e) {}
                          }
                          return isOa === 1;
                        }).length,
                        filteredArticles.filter(a => {
                          let isOa = a.is_oa;
                          if (isOa === undefined && a.csl_json) {
                            try { const csl = typeof a.csl_json === 'string' ? JSON.parse(a.csl_json) : a.csl_json; isOa = csl.is_oa ? 1 : 0; } catch (e) {}
                          }
                          return isOa === 0;
                        }).length,
                        filteredArticles.filter(a => {
                          let isOa = a.is_oa;
                          if (isOa === undefined && a.csl_json) {
                            try { const csl = typeof a.csl_json === 'string' ? JSON.parse(a.csl_json) : a.csl_json; isOa = csl.is_oa !== undefined ? (csl.is_oa ? 1 : 0) : -1; } catch (e) {}
                          }
                          return isOa !== 1 && isOa !== 0;
                        }).length
                      ],
                      backgroundColor: ['#10b981', '#ef4444', '#9ca3af'],
                      borderWidth: 0,
                    }]
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { position: 'bottom', labels: { color: '#9ca3af' } } }
                  }}
                />
              </div>
            </div>

            {/* Document Types Pie */}
            <div className="card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <h3 style={{ margin: '0 0 1rem 0' }}>Tipos de Documentos</h3>
              <div style={{ width: '100%', height: '300px', position: 'relative' }}>
                <Pie
                  data={(() => {
                    const counts = filteredArticles.reduce((acc: Record<string, number>, art) => {
                      const type = art.document_type || 'Desconhecido';
                      acc[type] = (acc[type] || 0) + 1;
                      return acc;
                    }, {});
                    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
                    return {
                      labels: sorted.map(i => i[0]),
                      datasets: [{
                        data: sorted.map(i => i[1]),
                        backgroundColor: ['#8b5cf6', '#3b82f6', '#f59e0b', '#10b981', '#ec4899', '#6366f1', '#14b8a6', '#f43f5e', '#84cc16', '#64748b'],
                        borderWidth: 0,
                      }]
                    };
                  })()}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { position: 'bottom', labels: { color: '#9ca3af' } } }
                  }}
                />
              </div>
            </div>
            
            {/* Publishers Bar */}
            <div className="card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <h3 style={{ margin: '0 0 1rem 0' }}>Top 10 Editoras / Publishers</h3>
              <div style={{ width: '100%', height: '300px', position: 'relative' }}>
                <Bar
                  data={(() => {
                    const counts = filteredArticles.reduce((acc: Record<string, number>, art) => {
                      let pub = art.publisher;
                      if (!pub && art.csl_json) {
                        try { const csl = typeof art.csl_json === 'string' ? JSON.parse(art.csl_json) : art.csl_json; pub = csl.publisher; } catch (e) {}
                      }
                      const finalPub = pub || 'Desconhecido';
                      acc[finalPub] = (acc[finalPub] || 0) + 1;
                      return acc;
                    }, {});
                    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10);
                    return {
                      labels: sorted.map(i => i[0].length > 15 ? i[0].substring(0, 15) + '...' : i[0]),
                      datasets: [{
                        label: 'Artigos',
                        data: sorted.map(i => i[1]),
                        backgroundColor: '#8b5cf6',
                        borderRadius: 4,
                      }]
                    };
                  })()}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                      y: {
                        beginAtZero: true,
                        ticks: { stepSize: 1, color: '#9ca3af' },
                        grid: { color: 'rgba(156, 163, 175, 0.1)' }
                      },
                      x: {
                        ticks: { color: '#9ca3af' },
                        grid: { display: false }
                      }
                    }
                  }}
                />
              </div>
            </div>

            {/* DOI Presence */}
            <div className="card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <h3 style={{ margin: '0 0 1rem 0' }}>Presença de DOI</h3>
              <div style={{ width: '100%', height: '300px', position: 'relative' }}>
                <Pie
                  data={{
                    labels: ['Com DOI', 'Sem DOI'],
                    datasets: [{
                      data: [
                        filteredArticles.filter(a => !!a.doi).length,
                        filteredArticles.filter(a => !a.doi).length
                      ],
                      backgroundColor: ['#3b82f6', '#f59e0b'],
                      borderWidth: 0,
                    }]
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { position: 'bottom', labels: { color: '#9ca3af' } } }
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab Content: Diary */}
      {activeTab === 'diary' && id && (
        <DiarySection projectId={parseInt(id)} />
      )}

      {/* Tab Content: History */}
      {activeTab === 'history' && (
        <SearchHistoryModal 
          isOpen={true} 
          onClose={() => setActiveTab('articles')} 
          history={history}
          embedded={true}
          onRevertSearch={handleRevertSearch}
        />
      )}

      <ArchiveModal 
        isOpen={archivingId !== null} 
        onClose={() => setArchivingId(null)} 
        onSubmit={handleArchiveSubmit} 
      />

      <ProjectCategoriesModal
        isOpen={isCategoriesModalOpen}
        projectId={project.id}
        onClose={() => {
          setIsCategoriesModalOpen(false);
          fetchData();
        }}
      />

      {editingArticle && (
        <EditArticleModal
          isOpen={true}
          onClose={() => setEditingArticle(null)}
          article={editingArticle}
          onSubmit={handleEditArticleSubmit}
        />
      )}

      <ManualArticleModal
        isOpen={isManualModalOpen}
        onClose={() => setIsManualModalOpen(false)}
        onSubmit={handleManualArticleSubmit}
      />

      {isHistoryOpen && (
        <SearchHistoryModal 
          isOpen={isHistoryOpen} 
          onClose={() => setIsHistoryOpen(false)} 
          history={history} 
          onRevertSearch={handleRevertSearch}
        />
      )}

      <AIExtractionModal
        isOpen={isAIExtractionModalOpen}
        onClose={handleCloseAIExtractionModal}
        articles={articles}
        articlesWithPdf={articles.filter(a => !!a.local_file_path)}
        aiQuestions={aiQuestions}
        setAiQuestions={setAiQuestions}
        handleMassiveExtraction={handleMassiveExtraction}
        isExtracting={isExtracting}
        extractionProgress={extractionProgress}
        aiExtractionResults={aiExtractionResults}
        cancelExtractionRef={cancelExtractionRef}
        investigationHistory={investigationHistory}
      />

      {showQuotaModal && createPortal(
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
          <div className="card fade-in" style={{ padding: '2rem', width: '400px', background: 'var(--bg-main)', textAlign: 'center' }}>
            <AlertCircle size={48} style={{ color: 'var(--color-danger)', margin: '0 auto 1rem auto' }} />
            <h3 style={{ margin: '0 0 1rem 0' }}>Limite de Cota Atingido</h3>
            <p style={{ margin: '0 0 1.5rem 0', color: 'var(--text-muted)' }}>
              A sua chave de API (OpenAI/Anthropic/Gemini) parece ter esgotado o limite de cota ou os créditos disponíveis. Verifique o seu provedor de IA e atualize as configurações no sistema.
            </p>
            <button className="btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={() => setShowQuotaModal(false)}>
              Entendi
            </button>
          </div>
        </div>,
        document.body
      )}

      {showKeyAlert && createPortal(
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
          <div className="card fade-in" style={{ width: '100%', maxWidth: '450px', background: 'var(--bg-surface)', padding: '2.5rem', textAlign: 'center' }}>
            <div style={{ background: 'color-mix(in srgb, var(--color-primary) 10%, transparent)', color: 'var(--color-primary)', width: '64px', height: '64px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
              <Key size={32} />
            </div>
            <h2 style={{ fontSize: '1.5rem', margin: '0 0 1rem 0' }}>Chave de IA Necessária</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '2rem', lineHeight: '1.5' }}>
              Para usar os recursos de Inteligência Artificial, você precisa primeiro configurar sua chave de API (OpenAI, Gemini, Anthropic ou modelo local) nas configurações do sistema.
            </p>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button onClick={() => setShowKeyAlert(false)} className="btn-secondary" style={{ flex: 1 }}>Cancelar</button>
              <button onClick={() => navigate('/settings')} className="btn-primary" style={{ flex: 1 }}>Configurações</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {isQuickAccessModalOpen && project && (
        <ManageQuickAccessModal
          isOpen={isQuickAccessModalOpen}
          onClose={() => setIsQuickAccessModalOpen(false)}
          projectId={project.id}
          documents={projectDocuments}
          onDocumentsChanged={fetchData}
        />
      )}
      <CitationModal
        isOpen={!!citationArticle}
        onClose={() => setCitationArticle(null)}
        article={citationArticle}
      />
    </div>
  );
};
