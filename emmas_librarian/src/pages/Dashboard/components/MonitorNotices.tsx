import React, { useEffect, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { SearchSummaryModal } from '../../../components/modals/SearchSummaryModal';
import { useProjectService } from '../../../contexts/ServicesContext';
import type { MonitorNotice, SearchPreview } from '../../../types';
import { describeError } from '../../../utils/describeError';

const cardStyle: React.CSSProperties = {
  padding: '0.9rem 1rem',
  marginBottom: '1.25rem',
  borderLeft: '3px solid var(--color-primary)',
};

const NoticeRow: React.FC<{ notice: MonitorNotice; onReview: () => void; busy: boolean }> = ({
  notice,
  onReview,
  busy,
}) => (
  <div
    style={{
      display: 'flex',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: '0.75rem',
      paddingTop: '0.6rem',
      borderTop: '1px solid var(--border-color)',
    }}
  >
    <div style={{ minWidth: 0 }}>
      <strong>
        {notice.newCount === 0
          ? 'Sem novidades confirmadas'
          : `${notice.newCount} ${notice.newCount === 1 ? 'artigo novo' : 'artigos novos'}`}
      </strong>{' '}
      em {notice.projectName}
      <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', overflowWrap: 'anywhere' }}>
        Busca #{notice.searchId}: {notice.query}
      </div>
      {notice.failedBases.length > 0 && (
        <div style={{ fontSize: '0.82rem', color: 'var(--color-warning)' }}>
          Não verificou: {notice.failedBases.join(', ')}.
        </div>
      )}
    </div>
    {notice.newCount > 0 && (
      <button
        type="button"
        className="btn-primary"
        disabled={busy}
        onClick={onReview}
        style={{ padding: '0.35rem 0.8rem', fontSize: '0.85rem' }}
      >
        Revisar
      </button>
    )}
  </div>
);

/**
 * What the monitored searches found (#52), at the top of the dashboard. The check starts once the page is on screen,
 * so it never holds the app back, and nothing shows when there is nothing to say.
 *
 * @example <MonitorNotices />
 */
export const MonitorNotices: React.FC = () => {
  const service = useProjectService();
  const [notices, setNotices] = useState<MonitorNotice[]>([]);
  const [checking, setChecking] = useState(false);
  const [review, setReview] = useState<SearchPreview | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const now = await service.getMonitorOverview();
        if (!alive) return;
        setNotices(now.notices);
        if (now.dueCount === 0) return;
        setChecking(true);
        const checked = await service.checkDueMonitors();
        if (alive) setNotices(checked.notices);
      } catch (err) {
        // The dashboard must open whatever the bases answer; the next opening tries again.
        console.error(JSON.stringify({ event: 'monitor_check_failed', error: String(err) }));
      } finally {
        if (alive) setChecking(false);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per visit to the dashboard
  }, []);

  const drop = (searchId: number) => setNotices((now) => now.filter((n) => n.searchId !== searchId));
  const openReview = async (notice: MonitorNotice) => {
    setError(null);
    try {
      setReview(await service.reviewMonitor(notice.searchId));
      drop(notice.searchId);
    } catch (err) {
      setError(describeError(err));
    }
  };
  const dismissAll = () => {
    notices.forEach((n) => void service.dismissMonitorNotice(n.searchId).catch(() => undefined));
    setNotices([]);
  };
  const save = async () => {
    if (!review) return;
    setSaving(true);
    setError(null);
    try {
      await service.saveSearchPreview(review.previewId);
      setReview(null);
    } catch (err) {
      setError(describeError(err));
    } finally {
      setSaving(false);
    }
  };
  const discard = () => {
    if (review) void service.discardSearchPreview(review.previewId).catch(() => undefined);
    setReview(null);
  };

  return (
    <>
      {checking && (
        <div
          role="status"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            marginBottom: '1rem',
            fontSize: '0.85rem',
            color: 'var(--text-muted)',
          }}
        >
          <Loader2 size={14} className="animate-spin" aria-hidden="true" /> Verificando as buscas monitoradas…
        </div>
      )}
      {notices.length > 0 && (
        <section className="card" aria-label="Novidades nas buscas monitoradas" style={cardStyle}>
          <div
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}
          >
            <strong style={{ color: 'var(--text-heading)' }}>Novidades nas buscas monitoradas</strong>
            <button
              type="button"
              aria-label="Dispensar o aviso"
              title="Dispensar até a próxima verificação"
              onClick={dismissAll}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                display: 'flex',
              }}
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>
          {notices.map((notice) => (
            <NoticeRow key={notice.searchId} notice={notice} busy={saving} onReview={() => void openReview(notice)} />
          ))}
          {error && (
            <div role="alert" style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--color-danger)' }}>
              {error}
            </div>
          )}
        </section>
      )}
      {review && (
        <SearchSummaryModal
          preview={review}
          isSaving={saving}
          saveError={error}
          startOnlyNew
          onSave={() => void save()}
          onDiscard={discard}
        />
      )}
    </>
  );
};
