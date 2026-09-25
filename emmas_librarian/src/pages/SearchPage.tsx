import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { QueryBuilder } from '../components/common/QueryBuilder';
import { useProjectService } from '../contexts/ServicesContext';
import { Project, QueryASTNode, DatabaseTranslationMap, QuerySort } from '../types';
import { Search, Loader2, ArrowLeft } from 'lucide-react';
import { SearchSummaryModal } from '../components/modals/SearchSummaryModal';
import { useDebounce } from '../hooks/useDebounce';
import { describeError } from '../utils/describeError';
import {
  SEARCH_DATABASES,
  buildFinalQueries,
  defaultDatabases,
  describeQueryTree,
  type SearchApiKeys,
} from './Search/searchQueries';
import { DatabaseSelector } from './Search/DatabaseSelector';
import { QueryTranslationCard } from './Search/QueryTranslationCard';
import { SearchOptionsCard } from './Search/SearchOptionsCard';
import { ApiKeyRequiredDialog } from './Search/ApiKeyRequiredDialog';

type SearchSummary = {
  savedCount: number;
  breakdown: Record<string, { count: number; error?: string }>;
};

const INITIAL_QUERY: QueryASTNode = {
  type: 'group',
  logicalOperator: 'AND',
  children: [{ type: 'rule', field: 'all', operator: 'contains', value: '' }],
};

const TRANSLATION_DEBOUNCE_MS = 600;

const sectionLabelStyle: React.CSSProperties = { fontWeight: 600, color: 'var(--text-heading)', fontSize: '1.1rem' };

/**
 * Builds a boolean query, shows its translation per database and runs the search into the project.
 *
 * Usage:
 *   <Route path="/projects/:id/search" element={<SearchPage />} />
 */
export const SearchPage: React.FC = () => {
  const projectService = useProjectService();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [ast, setAst] = useState<QueryASTNode>(INITIAL_QUERY);
  const debouncedAst = useDebounce(ast, TRANSLATION_DEBOUNCE_MS);
  const [translations, setTranslations] = useState<DatabaseTranslationMap>({});
  const [customQueries, setCustomQueries] = useState<Record<string, string>>({});
  const [limit, setLimit] = useState(50);
  const [sortBy, setSortBy] = useState<QuerySort>('relevance');
  const [selectedDbs, setSelectedDbs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<SearchSummary | null>(null);
  const [apiKeys, setApiKeys] = useState<SearchApiKeys>({ scopus: '', wos: '' });
  const [missingKeyDb, setMissingKeyDb] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    projectService
      .getProject(parseInt(id))
      .then(setProject)
      .catch(() => navigate('/'));
    Promise.all([projectService.getSetting('scopus_api_key'), projectService.getSetting('wos_api_key')]).then(
      ([scopus, wos]) => {
        const keys = { scopus: scopus || '', wos: wos || '' };
        setApiKeys(keys);
        setSelectedDbs(defaultDatabases(keys));
      },
    );
  }, [id, navigate]);

  useEffect(() => {
    projectService.translateQuery(debouncedAst).then(setTranslations);
  }, [debouncedAst]);

  const toggleDb = (dbId: string) => {
    if ((dbId === 'scopus' || dbId === 'wos') && !apiKeys[dbId]) return setMissingKeyDb(dbId);
    setSelectedDbs((prev) => (prev.includes(dbId) ? prev.filter((db) => db !== dbId) : [...prev, dbId]));
  };

  const setCustomQuery = (dbId: string, query: string | undefined) =>
    setCustomQueries((prev) => {
      const next = { ...prev };
      if (query === undefined) delete next[dbId];
      else next[dbId] = query;
      return next;
    });

  const runSearch = async (projectId: number, queries: Record<string, string>) => {
    setLoading(true);
    setError(null);
    try {
      setSummary(await projectService.searchAndPersist(projectId, queries, limit, sortBy, describeQueryTree(ast)));
    } catch (err: unknown) {
      console.error('Search error:', err);
      setError(describeError(err, 'Erro ao realizar busca'));
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || selectedDbs.length === 0) return;
    const result = buildFinalQueries(selectedDbs, customQueries, translations);
    if ('invalidDatabase' in result) {
      return setError(
        `A busca automática falhou ou é incompatível com a base ${result.invalidDatabase}. Use uma query customizada ou desative a base.`,
      );
    }
    await runSearch(parseInt(id), result.queries);
  };

  if (!project) return null;

  return (
    <div className="fade-in" style={{ maxWidth: '1000px', margin: '0 auto', paddingBottom: '4rem' }}>
      <Link
        to={`/projects/${id}`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.5rem',
          marginBottom: '1.5rem',
          color: 'var(--text-muted)',
        }}
      >
        <ArrowLeft size={18} /> Voltar para o Projeto
      </Link>

      <div style={{ marginBottom: '2.5rem' }}>
        <h1 style={{ margin: '0 0 0.5rem 0', fontSize: '2rem' }}>Fazer Nova Busca</h1>
        <p style={{ margin: 0, color: 'var(--text-muted)' }}>Projeto: {project.name}</p>
      </div>

      <form onSubmit={handleSearch} style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        <DatabaseSelector selected={selectedDbs} onToggle={toggleDb} />

        <div className="card" style={{ padding: '2rem' }}>
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={sectionLabelStyle}>Construtor Visual (Árvore Lógica)</label>
          </div>
          <div
            style={{
              background: 'var(--bg-main)',
              padding: '1.5rem',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-color)',
            }}
          >
            <QueryBuilder node={ast} onChange={setAst} />
          </div>
        </div>

        <div className="card" style={{ padding: '2rem' }}>
          <label style={{ ...sectionLabelStyle, display: 'block', marginBottom: '1.5rem' }}>
            Tradução e Transparência
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {selectedDbs.map((dbId) => (
              <QueryTranslationCard
                key={dbId}
                databaseName={SEARCH_DATABASES.find((d) => d.id === dbId)?.label ?? dbId}
                translation={translations[dbId]}
                customQuery={customQueries[dbId]}
                onCustomQueryChange={(query) => setCustomQuery(dbId, query)}
              />
            ))}
          </div>
        </div>

        <SearchOptionsCard
          sortBy={sortBy}
          limit={limit}
          selected={selectedDbs}
          onSortByChange={setSortBy}
          onLimitChange={setLimit}
        />

        {error && (
          <div
            style={{
              color: '#ef4444',
              background: '#fee2e2',
              padding: '1rem',
              borderRadius: 'var(--radius-md)',
              border: '1px solid #fca5a5',
            }}
          >
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
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? <Loader2 className="animate-spin" /> : <Search size={22} />}
          {loading ? 'Pesquisando e extraindo dados (isso pode levar alguns minutos)...' : 'Fazer Busca'}
        </button>
      </form>

      {summary && <SearchSummaryModal isOpen onClose={() => navigate(`/projects/${id}`)} summary={summary} />}

      {missingKeyDb && (
        <ApiKeyRequiredDialog
          database={missingKeyDb}
          onCancel={() => setMissingKeyDb(null)}
          onOpenSettings={() => navigate('/settings')}
        />
      )}
    </div>
  );
};
