import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, X } from 'lucide-react';
import { useProjectService } from '../../../contexts/ServicesContext';
import type { Article, CitationDirection, CitationSeedCount, SearchPreview } from '../../../types';
import {
  citationSeedOf,
  NO_CITATION_LOOKUP,
  SNOWBALL_DEFAULT_LIMIT,
  SNOWBALL_MAX_LIMIT,
} from '../../../utils/citationSeeds';
import { describeError } from '../../../utils/describeError';
import { SearchSummaryModal } from '../SearchSummaryModal';

interface ExploreCitationsModalProps {
  projectId: number;
  articles: Article[];
  onClose: () => void;
  /** Called after the results were saved, to reload the project. */
  onSaved: () => void;
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 9999,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'rgba(0,0,0,0.5)',
};

const cardStyle: React.CSSProperties = {
  width: '620px',
  maxWidth: '95%',
  maxHeight: '90vh',
  overflowY: 'auto',
  padding: '1.5rem',
  display: 'flex',
  flexDirection: 'column',
  gap: '1rem',
  background: 'var(--bg-main)',
};

const mutedStyle: React.CSSProperties = { margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' };

const CountLine: React.FC<{ count: CitationSeedCount }> = ({ count }) => (
  <li style={{ overflowWrap: 'anywhere' }}>
    <strong>{count.title}</strong>
    <div style={mutedStyle}>
      {count.found
        ? `Cita ${count.references} ${count.references === 1 ? 'trabalho' : 'trabalhos'} · citado por ${count.citedBy}`
        : 'O OpenAlex não encontrou este artigo.'}
    </div>
  </li>
);

const DirectionChoice: React.FC<{
  label: string;
  hint: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}> = ({ label, hint, checked, onChange }) => (
  <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
    <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    <span>
      {label}
      <div style={mutedStyle}>{hint}</div>
    </span>
  </label>
);

// Each failure stays in the dialog, since the page behind it is covered by the overlay.
function useCitationRun(projectId: number, articles: Article[], onSaved: () => void, onClose: () => void) {
  const service = useProjectService();
  const seeds = articles.flatMap((a) => citationSeedOf(a) ?? []);
  const [counts, setCounts] = useState<CitationSeedCount[] | null>(null);
  const [preview, setPreview] = useState<SearchPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    if (seeds.length === 0) return;
    service
      .peekCitations(seeds)
      .then((found) => alive && setCounts(found))
      .catch((err: unknown) => alive && setError(describeError(err)));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reads the articles the modal opened with
  }, []);

  const search = async (directions: CitationDirection[], limit: number) => {
    const known = seeds.filter((s) => counts?.find((c) => c.articleId === s.articleId)?.found);
    setBusy(true);
    setError(null);
    try {
      setPreview(await service.previewCitations(projectId, { seeds: known, directions, limit }));
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(false);
    }
  };
  const save = async () => {
    if (!preview) return;
    setSaving(true);
    try {
      await service.saveSearchPreview(preview.previewId);
      onSaved();
      onClose();
    } catch (err) {
      setError(describeError(err));
      setSaving(false);
    }
  };
  const discard = () => {
    if (preview) void service.discardSearchPreview(preview.previewId).catch(() => undefined);
    setPreview(null);
  };
  return { seeds, counts, preview, busy, saving, error, search, save, discard };
}

/**
 * Snowballing (#51): what the chosen articles cite and what cites them, found on OpenAlex. It says the volume before
 * downloading, and the results go through the same preview as a search, so nothing enters the project unasked.
 *
 * @example <ExploreCitationsModal projectId={3} articles={[article]} onClose={close} onSaved={reload} />
 */
export const ExploreCitationsModal: React.FC<ExploreCitationsModalProps> = ({
  projectId,
  articles,
  onClose,
  onSaved,
}) => {
  const run = useCitationRun(projectId, articles, onSaved, onClose);
  const [references, setReferences] = useState(true);
  const [citedBy, setCitedBy] = useState(false);
  const [limit, setLimit] = useState(SNOWBALL_DEFAULT_LIMIT);
  const { counts, seeds } = run;
  const missing = articles.length - seeds.length;
  const volume =
    (counts ?? []).reduce((sum, c) => sum + (references ? c.references : 0) + (citedBy ? c.citedBy : 0), 0) || 0;
  const limitValid = Number.isInteger(limit) && limit >= 1 && limit <= SNOWBALL_MAX_LIMIT;
  const canSearch = !!counts?.some((c) => c.found) && (references || citedBy) && limitValid && volume > 0 && !run.busy;
  const directions: CitationDirection[] = [
    ...(references ? ['references' as const] : []),
    ...(citedBy ? ['citedBy' as const] : []),
  ];

  if (run.preview) {
    return (
      <SearchSummaryModal
        preview={run.preview}
        isSaving={run.saving}
        saveError={run.error}
        onSave={() => void run.save()}
        onDiscard={run.discard}
      />
    );
  }
  return createPortal(
    <div style={overlayStyle}>
      <div className="card fade-in" role="dialog" aria-modal="true" aria-label="Explorar citações" style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
          <div>
            <h2 style={{ margin: '0 0 0.25rem' }}>Explorar citações</h2>
            <p style={mutedStyle}>
              Busca no OpenAlex o que estes artigos citam e quem os cita. Nada entra no projeto antes da sua revisão.
            </p>
          </div>
          <button
            type="button"
            aria-label="Fechar"
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
          >
            <X size={22} aria-hidden="true" />
          </button>
        </div>
        {missing > 0 && (
          <div role="note" style={mutedStyle}>
            {seeds.length === 0
              ? NO_CITATION_LOOKUP
              : `${missing} ${missing === 1 ? 'artigo fica' : 'artigos ficam'} de fora. ${NO_CITATION_LOOKUP}`}
          </div>
        )}
        {seeds.length > 0 && !counts && !run.error && (
          <div role="status" style={mutedStyle}>
            <Loader2 size={16} className="spin" aria-hidden="true" /> Consultando o OpenAlex…
          </div>
        )}
        {counts && (
          <ul style={{ margin: 0, paddingLeft: '1.1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {counts.map((c) => (
              <CountLine key={c.articleId} count={c} />
            ))}
          </ul>
        )}
        {counts && (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <DirectionChoice
                label="Referências"
                hint="O que estes artigos citam."
                checked={references}
                onChange={setReferences}
              />
              <DirectionChoice
                label="Citações"
                hint="Quem cita estes artigos."
                checked={citedBy}
                onChange={setCitedBy}
              />
            </div>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              Baixar no máximo
              <input
                type="number"
                className="input-field"
                min={1}
                max={SNOWBALL_MAX_LIMIT}
                value={Number.isNaN(limit) ? '' : limit}
                onChange={(e) => setLimit(e.target.valueAsNumber)}
                style={{ width: '10rem' }}
              />
            </label>
            <p role="status" style={mutedStyle}>
              {!limitValid
                ? `Escolha um número de 1 a ${SNOWBALL_MAX_LIMIT}.`
                : volume === 0
                  ? 'Não há nada para baixar nas direções escolhidas.'
                  : volume > limit
                    ? `São ${volume} trabalhos; só os ${limit} primeiros serão baixados.`
                    : `São ${volume} trabalhos.`}
            </p>
          </>
        )}
        {run.error && (
          <div role="alert" style={{ ...mutedStyle, color: 'var(--color-danger)' }}>
            {run.error}
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={!canSearch}
            onClick={() => void run.search(directions, limit)}
          >
            {run.busy ? <Loader2 size={16} className="spin" aria-hidden="true" /> : null} Buscar
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};
