import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { QueryBuilder } from '../components/common/QueryBuilder';
import { projectService } from '../services/api';
import { Project, QueryASTNode, DatabaseTranslationMap } from '../types';
import { Search, Loader2, ArrowLeft, AlertTriangle, AlertCircle, Edit2, RotateCcw, Key } from 'lucide-react';
import { SearchSummaryModal } from '../components/modals/SearchSummaryModal';
import { createPortal } from 'react-dom';

const DATABASES = [
  { id: 'openalex', label: 'OpenAlex' },
  { id: 'crossref', label: 'Crossref' },
  { id: 'scopus', label: 'Scopus' },
  { id: 'wos', label: 'Web of Science' },
];

// Custom hook for debouncing
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

export const SearchPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  
  const [ast, setAst] = useState<QueryASTNode>({
    type: 'group',
    logicalOperator: 'AND',
    children: [{ type: 'rule', field: 'all', operator: 'contains', value: '' }]
  });
  const debouncedAst = useDebounce(ast, 600);
  
  const [translations, setTranslations] = useState<DatabaseTranslationMap>({});
  const [customQueries, setCustomQueries] = useState<Record<string, string>>({});
  
  const [limit, setLimit] = useState(50);
  const [sortBy, setSortBy] = useState<'relevance' | 'citations' | 'date'>('relevance');
  const [selectedDbs, setSelectedDbs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<{ savedCount: number; breakdown: Record<string, { count: number; error?: string }> } | null>(null);
  const [apiKeys, setApiKeys] = useState<{ scopus: string; wos: string }>({ scopus: '', wos: '' });
  const [showKeyAlert, setShowKeyAlert] = useState<{ db: string; isOpen: boolean }>({ db: '', isOpen: false });
  const navigate = useNavigate();

  const astToHumanString = (node: QueryASTNode): string => {
    if (node.type === 'rule') {
      const fields: Record<string, string> = { all: 'Todos', title: 'Título', abstract: 'Resumo', authors: 'Autores' };
      const ops: Record<string, string> = { contains: 'contém', exact: 'é exatamente', not_contains: 'não contém' };
      return `${fields[node.field]} ${ops[node.operator]} "${node.value}"`;
    } else {
      return `(${node.children.map(astToHumanString).join(` ${node.logicalOperator} `)})`;
    }
  };

  useEffect(() => {
    if (id) {
      projectService.getProject(parseInt(id)).then(setProject).catch(() => navigate('/'));
      
      // Load API keys and set default selection
      Promise.all([
        projectService.getSetting('scopus_api_key'),
        projectService.getSetting('wos_api_key')
      ]).then(([scopus, wos]) => {
        setApiKeys({ scopus: scopus || '', wos: wos || '' });
        
        const defaultDbs = ['openalex', 'crossref'];
        if (scopus) defaultDbs.push('scopus');
        if (wos) defaultDbs.push('wos');
        setSelectedDbs(defaultDbs);
      });
    }
  }, [id, navigate]);

  useEffect(() => {
    // Translate query live
    projectService.translateQuery(debouncedAst).then(res => setTranslations(res));
  }, [debouncedAst]);

  const toggleDb = (dbId: string) => {
    if ((dbId === 'scopus' && !apiKeys.scopus) || (dbId === 'wos' && !apiKeys.wos)) {
      setShowKeyAlert({ db: dbId, isOpen: true });
      return;
    }
    setSelectedDbs(prev => 
      prev.includes(dbId) ? prev.filter(db => db !== dbId) : [...prev, dbId]
    );
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || selectedDbs.length === 0) return;
    
    // Build the final query map
    const finalQueries: Record<string, string> = {};
    for (const dbId of selectedDbs) {
      if (customQueries[dbId]) {
        finalQueries[dbId] = customQueries[dbId];
      } else {
        const tr = translations[dbId];
        if (!tr || !tr.isValid) {
          setError(`A busca automática falhou ou é incompatível com a base ${dbId}. Use uma query customizada ou desative a base.`);
          return;
        }
        finalQueries[dbId] = tr.query;
      }
    }
    
    setLoading(true);
    setError(null);
    try {
      const res = await projectService.searchAndPersist(parseInt(id), finalQueries, limit, sortBy, astToHumanString(ast));
      setSummary(res);
    } catch (err: any) {
      console.error('Search error:', err);
      let errorMsg = 'Erro ao realizar busca';
      if (err) {
        if (err.message) {
          errorMsg = err.message;
        } else if (typeof err === 'string') {
          errorMsg = err;
        } else if (typeof err === 'object') {
          try {
            errorMsg = err.error || JSON.stringify(err);
          } catch {
            errorMsg = String(err);
          }
        } else {
          errorMsg = String(err);
        }
      }
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  if (!project) return null;

  return (
    <div className="fade-in" style={{ maxWidth: '1000px', margin: '0 auto', paddingBottom: '4rem' }}>
      <Link to={`/projects/${id}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', color: 'var(--text-muted)' }}>
        <ArrowLeft size={18} /> Voltar para o Projeto
      </Link>
      
      <div style={{ marginBottom: '2.5rem' }}>
        <h1 style={{ margin: '0 0 0.5rem 0', fontSize: '2rem' }}>Fazer Nova Busca</h1>
        <p style={{ margin: 0, color: 'var(--text-muted)' }}>Projeto: {project.name}</p>
      </div>
      
      <form onSubmit={handleSearch} style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        
        <div className="card" style={{ padding: '2rem' }}>
          <label style={{ display: 'block', marginBottom: '1rem', fontWeight: 600, color: 'var(--text-heading)', fontSize: '1.1rem' }}>Bases de Dados Alvo</label>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            {DATABASES.map(db => {
              const isSelected = selectedDbs.includes(db.id);
              return (
                <button
                  key={db.id}
                  type="button"
                  onClick={() => toggleDb(db.id)}
                  style={{
                    padding: '0.75rem 1.5rem',
                    borderRadius: 'var(--radius-xl)',
                    border: `2px solid ${isSelected ? 'var(--color-primary)' : 'var(--border-color)'}`,
                    background: isSelected ? 'color-mix(in srgb, var(--color-primary) 10%, transparent)' : 'var(--bg-surface)',
                    color: isSelected ? 'var(--color-primary)' : 'var(--text-muted)',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all var(--transition-fast)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}
                >
                  <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: isSelected ? 'var(--color-primary)' : 'var(--border-color)' }}></div>
                  {db.label}
                </button>
              );
            })}
          </div>
          {selectedDbs.length === 0 && <p style={{ color: 'var(--color-danger)', fontSize: '0.9rem', marginTop: '1rem' }}>Selecione pelo menos uma base.</p>}
        </div>

        <div className="card" style={{ padding: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <label style={{ fontWeight: 600, color: 'var(--text-heading)', fontSize: '1.1rem' }}>Construtor Visual (Árvore Lógica)</label>
          </div>
          <div style={{ background: 'var(--bg-main)', padding: '1.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
            <QueryBuilder node={ast} onChange={setAst} />
          </div>
        </div>

        <div className="card" style={{ padding: '2rem' }}>
          <label style={{ display: 'block', marginBottom: '1.5rem', fontWeight: 600, color: 'var(--text-heading)', fontSize: '1.1rem' }}>Tradução e Transparência</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {selectedDbs.map(dbId => {
              const tr = translations[dbId];
              const customQ = customQueries[dbId];
              const isCustom = customQ !== undefined;
              const dbName = DATABASES.find(d => d.id === dbId)?.label;

              return (
                <div key={dbId} style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                  <div style={{ background: 'var(--bg-main)', padding: '1rem 1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontWeight: 600, color: 'var(--text-heading)', textTransform: 'capitalize' }}>{dbName}</div>
                    <button
                      type="button"
                      onClick={() => {
                        if (isCustom) {
                          const newCq = { ...customQueries };
                          delete newCq[dbId];
                          setCustomQueries(newCq);
                        } else {
                          setCustomQueries({ ...customQueries, [dbId]: tr?.query || '' });
                        }
                      }}
                      className="btn-secondary"
                      style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
                    >
                      {isCustom ? <><RotateCcw size={14} /> Restaurar Tradução Automática</> : <><Edit2 size={14} /> Substituir por Query Customizada</>}
                    </button>
                  </div>
                  
                  <div style={{ padding: '1.5rem' }}>
                    {isCustom ? (
                      <textarea
                        value={customQ}
                        onChange={(e) => setCustomQueries({ ...customQueries, [dbId]: e.target.value })}
                        placeholder="Digite a query exata na sintaxe desta base de dados..."
                        style={{ width: '100%', height: '100px', padding: '1rem', fontFamily: 'monospace', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-primary)', outline: 'none', background: 'var(--bg-main)' }}
                      />
                    ) : (
                      <>
                        {!tr ? (
                          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', color: 'var(--text-muted)' }}>
                            <Loader2 className="animate-spin" size={16} /> Traduzindo...
                          </div>
                        ) : (
                          <>
                            <div style={{ fontFamily: 'monospace', padding: '1rem', background: 'var(--bg-main)', borderRadius: 'var(--radius-sm)', color: tr.isValid ? 'var(--text-main)' : 'var(--text-muted)', wordBreak: 'break-all' }}>
                              {tr.query || 'Vazio'}
                            </div>
                            
                            {!tr.isValid && (
                              <div style={{ marginTop: '1rem', padding: '1rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 'var(--radius-sm)', color: '#991b1b', display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                                <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '0.1rem' }} />
                                <div>
                                  <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>Incompatibilidade de Sintaxe</div>
                                  <div style={{ fontSize: '0.9rem' }}>{tr.error}</div>
                                </div>
                              </div>
                            )}

                            {tr.isValid && tr.warning && (
                              <div style={{ marginTop: '1rem', padding: '1rem', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 'var(--radius-sm)', color: '#92400e', display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                                <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: '0.1rem' }} />
                                <div>
                                  <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>Aviso</div>
                                  <div style={{ fontSize: '0.9rem' }}>{tr.warning}</div>
                                </div>
                              </div>
                            )}
                          </>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="card" style={{ padding: '2rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: 'var(--text-heading)', fontSize: '1.1rem' }}>Critério de Ordenação</label>
              <select 
                value={sortBy} 
                onChange={(e) => setSortBy(e.target.value as 'relevance' | 'citations' | 'date')}
                style={{ 
                  width: '100%', 
                  padding: '0.8rem 1rem', 
                  fontSize: '1rem', 
                  border: '1px solid var(--border-color)', 
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-main)',
                  color: 'var(--text-main)',
                  outline: 'none',
                  transition: 'border-color var(--transition-fast)'
                }}
                onFocus={(e) => e.currentTarget.style.borderColor = 'var(--color-primary)'}
                onBlur={(e) => e.currentTarget.style.borderColor = 'var(--border-color)'}
              >
                <option value="relevance">Mais Relevantes (Padrão)</option>
                <option value="citations">Mais Citados (Maior Impacto)</option>
                <option value="date">Mais Recentes</option>
              </select>
            </div>
            
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: 'var(--text-heading)', fontSize: '1.1rem' }}>Quantidade Máxima (por base)</label>
              <input 
                type="number" 
                value={limit} 
                onChange={(e) => setLimit(parseInt(e.target.value) || 50)}
                min="10"
                max="100000"
                style={{ 
                  width: '100%', 
                  padding: '0.8rem 1rem', 
                  fontSize: '1rem', 
                  border: '1px solid var(--border-color)', 
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-main)',
                  color: 'var(--text-main)',
                  outline: 'none',
                  transition: 'border-color var(--transition-fast)'
                }}
                onFocus={(e) => e.currentTarget.style.borderColor = 'var(--color-primary)'}
                onBlur={(e) => e.currentTarget.style.borderColor = 'var(--border-color)'}
              />
              <div style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <strong>Limites das APIs:</strong>
                <span style={{ color: selectedDbs.includes('crossref') && limit > 1000 ? 'var(--color-danger)' : 'inherit' }}>• Crossref: máximo de 1.000 resultados.</span>
                <span style={{ color: selectedDbs.includes('scopus') && limit > 5000 ? 'var(--color-danger)' : 'inherit' }}>• Scopus: a API pode limitar entre 200 e 5.000 dependendo da assinatura institucional (pode falhar em limites altos).</span>
                <span>• OpenAlex / Web of Science: máximo de 100.000 resultados.</span>
                {limit > 1000 && selectedDbs.includes('crossref') && (
                  <span style={{ color: 'var(--color-danger)', fontWeight: 600, marginTop: '0.25rem' }}>
                    Atenção: A base Crossref será limitada a 1.000 resultados.
                  </span>
                )}
                {limit > 200 && selectedDbs.includes('scopus') && (
                  <span style={{ color: 'var(--color-warning)', fontWeight: 600, marginTop: '0.25rem' }}>
                    Aviso: A base Scopus pode retornar erro (Exceeds maximum) para limites &gt 200 dependendo do seu nível de serviço.
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div style={{ color: '#ef4444', background: '#fee2e2', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid #fca5a5' }}>
            {error}
          </div>
        )}

        <button 
          type="submit" 
          disabled={loading || selectedDbs.length === 0}
          className="btn-primary"
          style={{ 
            width: '100%',
            padding: '1.25rem', 
            fontSize: '1.2rem',
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.7 : 1
          }}
        >
          {loading ? <Loader2 className="animate-spin" /> : <Search size={22} />}
          {loading ? 'Pesquisando e extraindo dados (isso pode levar alguns minutos)...' : 'Fazer Busca'}
        </button>
      </form>

      {summary && (
        <SearchSummaryModal 
          isOpen={!!summary} 
          onClose={() => navigate(`/projects/${id}`)} 
          summary={summary} 
        />
      )}

      {showKeyAlert.isOpen && createPortal(
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
          <div className="card fade-in" style={{ width: '100%', maxWidth: '450px', background: 'var(--bg-surface)', padding: '2.5rem', textAlign: 'center' }}>
            <div style={{ background: 'color-mix(in srgb, var(--color-primary) 10%, transparent)', color: 'var(--color-primary)', width: '64px', height: '64px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
              <Key size={32} />
            </div>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Chave de API Necessária</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '2rem', lineHeight: '1.5' }}>
              Para realizar buscas na <strong>{showKeyAlert.db === 'wos' ? 'Web of Science' : 'Scopus'}</strong>, você precisa primeiro configurar sua chave de API nas configurações do sistema.
            </p>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button onClick={() => setShowKeyAlert({ ...showKeyAlert, isOpen: false })} className="btn-secondary" style={{ flex: 1 }}>Cancelar</button>
              <button onClick={() => navigate('/settings')} className="btn-primary" style={{ flex: 1 }}>Configurações</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
