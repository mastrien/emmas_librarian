import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams, Link } from 'react-router-dom';
import { QueryBuilder } from '../components/common/QueryBuilder';
import { useProjectService } from '../contexts/ServicesContext';
import { Project, QueryASTNode, DatabaseTranslationMap, QuerySort, SearchPreview } from '../types';
import { Search, Loader2, ArrowLeft } from 'lucide-react';
import { SearchSummaryModal } from '../components/modals/SearchSummaryModal';
import { useDebounce } from '../hooks/useDebounce';
import { describeError } from '../utils/describeError';
import { defaultSearchLimits, limitProblems, type SearchLimits } from '../utils/searchLimits';
import {
  EMPTY_QUERY,
  SEARCH_DATABASES,
  buildFinalQueries,
  defaultDatabases,
  describeQueryTree,
  restoreSearch,
  usableDatabases,
  type RestoredSearch,
  type SearchApiKeys,
  isKeyedDatabase,
  loadSearchApiKeys,
} from './Search/searchQueries';
import { DatabaseSelector } from './Search/DatabaseSelector';
import { QueryTranslationCard } from './Search/QueryTranslationCard';
import { SearchOptionsCard } from './Search/SearchOptionsCard';
import { ApiKeyRequiredDialog } from './Search/ApiKeyRequiredDialog';

const TRANSLATION_DEBOUNCE_MS = 600;

const sectionLabelStyle: React.CSSProperties = { fontWeight: 600, color: 'var(--text-heading)', fontSize: '1.1rem' };

/**
 * Builds a boolean query, shows its translation per database, runs the search and lets the user
 * review the results before saving them into the project (or discarding them to refine the query).
 *
 * Usage:
 *   <Route path="/projects/:id/search" element={<SearchPage />} />
 */
const RestoredSearchNotice: React.FC<{ searchId: number; isLegacy: boolean }> = ({ searchId, isLegacy }) => (
  <div
    role="status"
    style={{
      marginBottom: '2rem',
      padding: '1rem 1.25rem',
      borderRadius: 'var(--radius-md)',
      border: '1px solid var(--color-primary)',
      background: 'rgba(79, 70, 229, 0.08)',
    }}
  >
    Busca #{searchId} carregada do histórico. Ajuste o que quiser e clique em <strong>Fazer Busca</strong>.
    {isLegacy &&
      ' Essa busca é de antes do construtor visual ser salvo junto, então a query de cada base veio como query customizada.'}
  </div>
);

export const SearchPage: React.FC = () => {
  const projectService = useProjectService();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  // ?from=<history id>: "Nova busca a partir desta" in the search history.
  const fromSearchId = Number(useSearchParams()[0].get('from')) || null;
  const [restoredFrom, setRestoredFrom] = useState<{ id: number; isLegacy: boolean } | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [ast, setAst] = useState<QueryASTNode>(EMPTY_QUERY);
  const debouncedAst = useDebounce(ast, TRANSLATION_DEBOUNCE_MS);
  const [translations, setTranslations] = useState<DatabaseTranslationMap>({});
  const [customQueries, setCustomQueries] = useState<Record<string, string>>({});
  const [limits, setLimits] = useState<SearchLimits>(defaultSearchLimits);
  const [sortBy, setSortBy] = useState<QuerySort>('relevance');
  const [selectedDbs, setSelectedDbs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<SearchPreview | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [apiKeys, setApiKeys] = useState<SearchApiKeys>({ scopus: '', wos: '', ieee: '' });
  const [missingKeyDb, setMissingKeyDb] = useState<string | null>(null);

  const applyRestoredSearch = (searchId: number, restored: RestoredSearch, keys: SearchApiKeys) => {
    setAst(restored.state.ast);
    setSelectedDbs(usableDatabases(restored.state.selectedDbs, keys));
    setCustomQueries(restored.state.customQueries);
    if (restored.sortBy) setSortBy(restored.sortBy);
    if (restored.limits) setLimits(restored.limits);
    setRestoredFrom({ id: searchId, isLegacy: restored.isLegacy });
  };

  useEffect(() => {
    if (!id) return;
    projectService
      .getProject(parseInt(id))
      .then(setProject)
      .catch(() => navigate('/'));
    Promise.all([
      loadSearchApiKeys((key) => projectService.getSetting(key)),
      fromSearchId ? projectService.getSearchHistory(parseInt(id)) : Promise.resolve([]),
    ]).then(([keys, history]) => {
      setApiKeys(keys);
      const entry = history.find((h) => h.id === fromSearchId);
      const restored = entry ? restoreSearch(entry) : null;
      if (entry && restored) applyRestoredSearch(entry.id, restored, keys);
      else setSelectedDbs(defaultDatabases(keys));
    });
  }, [id, navigate, fromSearchId]);

  useEffect(() => {
    projectService.translateQuery(debouncedAst).then(setTranslations);
  }, [debouncedAst]);

  const toggleDb = (dbId: string) => {
    if (isKeyedDatabase(dbId) && !apiKeys[dbId]) return setMissingKeyDb(dbId);
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
      const queryState = JSON.stringify({ ast, selectedDbs, customQueries, limits });
      setPreview(
        await projectService.previewSearch(projectId, queries, limits, sortBy, describeQueryTree(ast), queryState),
      );
    } catch (err: unknown) {
      console.error('Search error:', err);
      setError(describeError(err, 'Erro ao realizar busca'));
    } finally {
      setLoading(false);
    }
  };

  const saveResults = async (previewId: string) => {
    setIsSaving(true);
    setSaveError(null);
    try {
      await projectService.saveSearchPreview(previewId);
      navigate(`/projects/${id}`);
    } catch (err: unknown) {
      setSaveError(describeError(err, 'Erro ao salvar os resultados da busca'));
      setIsSaving(false);
    }
  };

  const discardResults = (previewId: string) => {
    setPreview(null);
    setSaveError(null);
    projectService.discardSearchPreview(previewId).catch((err: unknown) => console.error('Discard error:', err));
  };

  // A limit above a base's ceiling blocks the search, so it never runs differently from what the page shows.
  const limitsBlocked = limitProblems(limits, selectedDbs).length > 0;

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || selectedDbs.length === 0 || limitsBlocked) return;
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

      {restoredFrom && <RestoredSearchNotice searchId={restoredFrom.id} isLegacy={restoredFrom.isLegacy} />}

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
          limits={limits}
          selected={selectedDbs}
          onSortByChange={setSortBy}
          onLimitsChange={setLimits}
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
          disabled={loading || selectedDbs.length === 0 || limitsBlocked}
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

      {preview && (
        <SearchSummaryModal
          preview={preview}
          isSaving={isSaving}
          saveError={saveError}
          onSave={() => saveResults(preview.previewId)}
          onDiscard={() => discardResults(preview.previewId)}
        />
      )}

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
