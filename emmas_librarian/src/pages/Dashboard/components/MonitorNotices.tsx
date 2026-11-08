import React, { useEffect, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { SearchSummaryModal } from '../../../components/modals/SearchSummaryModal';
import { useProjectService } from '../../../contexts/ServicesContext';
import type { MonitorNotice, SearchPreview } from '../../../types';
import { describeError } from '../../../utils/describeError';
import { ExperimentalTag } from '../../../components/common/ExperimentalTag';
import { MONITOR_EXPERIMENTAL_REASON } from '../../../components/modals/searchHistory/SearchMonitorControl';
import '../dashboard.css';

const NoticeRow: React.FC<{ notice: MonitorNotice; onReview: () => void; busy: boolean }> = ({
  notice,
  onReview,
  busy,
}) => (
  <div className="monitor-row">
    <div className="monitor-row-text">
      <strong>
        {notice.newCount === 0
          ? 'Sem novidades confirmadas'
          : `${notice.newCount} ${notice.newCount === 1 ? 'artigo novo' : 'artigos novos'}`}
      </strong>{' '}
      em {notice.projectName}
      <div className="monitor-row-query">
        Busca #{notice.searchId}: {notice.query}
      </div>
      {notice.failedBases.length > 0 && (
        <div className="monitor-row-failed">Não verificou: {notice.failedBases.join(', ')}.</div>
      )}
    </div>
    {notice.newCount > 0 && (
      <button type="button" className="btn-primary monitor-review" disabled={busy} onClick={onReview}>
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
        <div role="status" className="monitor-checking">
          <Loader2 size={14} className="animate-spin" aria-hidden="true" /> Verificando as buscas monitoradas…
        </div>
      )}
      {notices.length > 0 && (
        <section className="card monitor-card" aria-label="Novidades nas buscas monitoradas">
          <div className="monitor-card-head">
            <span className="monitor-card-title">
              <strong>Novidades nas buscas monitoradas</strong>
              <ExperimentalTag reason={MONITOR_EXPERIMENTAL_REASON} />
            </span>
            <button
              type="button"
              aria-label="Dispensar o aviso"
              title="Dispensar até a próxima verificação"
              onClick={dismissAll}
              className="monitor-dismiss"
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>
          {notices.map((notice) => (
            <NoticeRow key={notice.searchId} notice={notice} busy={saving} onReview={() => void openReview(notice)} />
          ))}
          {error && (
            <div role="alert" className="monitor-error">
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
