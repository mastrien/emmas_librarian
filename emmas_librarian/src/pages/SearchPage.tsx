import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { QueryBuilder } from '../components/common/QueryBuilder';
import { useProjectService } from '../contexts/ServicesContext';
import { Project, QueryASTNode, DatabaseTranslationMap, QuerySort, SearchHistoryItem, SearchPreview } from '../types';
import { withPublishedSince } from '../utils/publishedSince';
import { Search, Loader2 } from 'lucide-react';
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
  lastRunDate,
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
import { BackLink } from '../components/common/BackLink';
import './Search/search.css';

const TRANSLATION_DEBOUNCE_MS = 600;

/**
 * Builds a boolean query, shows its translation per database, runs the search and lets the user
 * review the results before saving them into the project (or discarding them to refine the query).
 *
 * Usage:
 *   <Route path="/projects/:id/search" element={<SearchPage />} />
 */
const RestoredSearchNotice: React.FC<{ searchId: number; isLegacy: boolean }> = ({ searchId, isLegacy }) => (
  <div role="status" className="search-restored">
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
  const [searchParams] = useSearchParams();
  const fromSearchId = Number(searchParams.get('from')) || null;
  // &rerun=1: "Rodar de novo" in the history, which looks at what was published since that search ran (#52).
  const isRerun = searchParams.get('rerun') === '1';
  const [publishedSince, setPublishedSince] = useState('');
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

  const applyRestoredSearch = (entry: SearchHistoryItem, restored: RestoredSearch, keys: SearchApiKeys) => {
    const searchId = entry.id;
    setPublishedSince(isRerun ? lastRunDate(entry) : (restored.state.publishedSince ?? ''));
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
      if (entry && restored) applyRestoredSearch(entry, restored, keys);
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

  const runSearch = async (projectId: number, typedQueries: Record<string, string>) => {
    const queries = withPublishedSince(typedQueries, publishedSince, new Date().toISOString().slice(0, 10));
    setLoading(true);
    setError(null);
    try {
      const queryState = JSON.stringify({
        ast,
        selectedDbs,
        customQueries,
        limits,
        ...(publishedSince && { publishedSince }),
      });
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
    <div className="fade-in search-page">
      <BackLink to={`/projects/${id}`} className="page-back">
        Voltar ao projeto
      </BackLink>

      <div className="search-head">
        <h1>Fazer Nova Busca</h1>
        <p>Projeto: {project.name}</p>
      </div>

      {restoredFrom && <RestoredSearchNotice searchId={restoredFrom.id} isLegacy={restoredFrom.isLegacy} />}

      <form onSubmit={handleSearch} className="search-form">
        <DatabaseSelector selected={selectedDbs} onToggle={toggleDb} />

        <div className="card search-card">
          <div className="search-builder-head">
            <label className="search-section-label">Construtor Visual (Árvore Lógica)</label>
          </div>
          <div className="search-builder">
            <QueryBuilder node={ast} onChange={setAst} />
          </div>
        </div>

        <div className="card search-card">
          <label className="search-section-label search-section-label--block">Tradução e Transparência</label>
          <div className="search-translations">
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
          publishedSince={publishedSince}
          onPublishedSinceChange={setPublishedSince}
        />

        {error && <div className="search-error">{error}</div>}

        <button
          type="submit"
          disabled={loading || selectedDbs.length === 0 || limitsBlocked}
          className={`btn-primary search-submit${loading ? ' is-loading' : ''}`}
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
          startOnlyNew={isRerun}
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
