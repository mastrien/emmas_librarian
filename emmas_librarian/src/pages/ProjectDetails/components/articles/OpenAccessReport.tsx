import React from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, CheckCircle, Minus, XCircle } from 'lucide-react';
import type { OpenAccessBatchReport } from '../../hooks/useOpenAccessPdfs';
import { openAccessMessage, reportGroups, type OpenAccessMessage, type ReportEntry } from './openAccessText';

const TONE_ICON: Record<OpenAccessMessage['tone'], React.ReactNode> = {
  ok: <CheckCircle size={16} color="var(--color-success)" />,
  warning: <AlertTriangle size={16} color="var(--color-warning)" />,
  muted: <Minus size={16} color="var(--text-muted)" />,
  error: <XCircle size={16} color="var(--color-danger)" />,
};

const EntryRow: React.FC<{ entry: ReportEntry }> = ({ entry }) => {
  const message = openAccessMessage(entry.outcome);
  return (
    <li className="oa-report__entry">
      <span aria-hidden="true">{TONE_ICON[message.tone]}</span>
      <span>
        {entry.title}
        <span className="oa-report__why">{message.text}</span>
      </span>
      {message.page ? (
        <a href={message.page} target="_blank" rel="noreferrer">
          Abrir a página
        </a>
      ) : (
        <span />
      )}
    </li>
  );
};

function heading(report: OpenAccessBatchReport): string {
  const downloaded = report.entries.filter((e) => e.outcome.status === 'downloaded').length;
  const title = `PDFs abertos: ${downloaded} de ${report.entries.length} baixados`;
  return report.entries.length < report.total
    ? `${title} (cancelado; ${report.total - report.entries.length} não tentados)`
    : title;
}

/**
 * The end of a batch download: what came in, and first of all what needs the user — blocked copies with the
 * page to download in the browser — then failures, articles without an open copy and those that had a PDF.
 *
 * Usage:
 *   {openAccess.report && <OpenAccessReport report={openAccess.report} onClose={openAccess.closeReport} />}
 */
export const OpenAccessReport: React.FC<{ report: OpenAccessBatchReport; onClose: () => void }> = ({
  report,
  onClose,
}) =>
  createPortal(
    <div className="oa-report__overlay">
      <div className="card fade-in oa-report" role="dialog" aria-modal="true" aria-labelledby="oa-report-title">
        <h3 id="oa-report-title">{heading(report)}</h3>
        {reportGroups(report.entries).map((group) => (
          <section key={group.label} aria-label={group.label}>
            <h4>
              {group.label} ({group.entries.length})
            </h4>
            <ul>
              {group.entries.map((entry) => (
                <EntryRow key={entry.articleId} entry={entry} />
              ))}
            </ul>
          </section>
        ))}
        <div className="oa-report__actions">
          <button type="button" className="btn-primary" onClick={onClose}>
            Fechar
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
