import React from 'react';
import { AlertTriangle, CheckCircle, Minus, XCircle } from 'lucide-react';
import { Modal } from '../../../../components/common/Modal';
import { ModalFooter } from '../../../../components/common/ModalFooter';
import { Button } from '../../../../components/common/Button';
import type { OpenAccessBatchReport } from '../../hooks/useOpenAccessPdfs';
import { openAccessMessage, reportGroups, type OpenAccessMessage, type ReportEntry } from './openAccessText';
import './openAccessReport.css';

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

/** Downloaded, with no open version, and failed (an open copy the app could not download counts as failed). */
export function reportTotals(entries: ReportEntry[]): { downloaded: number; noOpenVersion: number; failed: number } {
  const count = (...statuses: ReportEntry['outcome']['status'][]) =>
    entries.filter((e) => statuses.includes(e.outcome.status)).length;
  return {
    downloaded: count('downloaded'),
    noOpenVersion: count('not-open', 'no-doi'),
    failed: count('failed', 'blocked'),
  };
}

const Tile: React.FC<{ label: string; value: number; tone?: 'ok' | 'bad' }> = ({ label, value, tone }) => (
  <div className="oa-report__tile">
    <span className="oa-report__tile-label">{label}</span>
    <span className={tone ? `oa-report__tile-value is-${tone}` : 'oa-report__tile-value'}>{value}</span>
  </div>
);

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
}) => {
  const totals = reportTotals(report.entries);
  return (
    <Modal
      label={heading(report)}
      title="PDFs em acesso aberto"
      description={`${report.total} artigos sem PDF procurados`}
      onClose={onClose}
      width={640}
      className="oa-report"
    >
      <div className="oa-report__tiles" role="group" aria-label="Resumo">
        <Tile label="Baixados" value={totals.downloaded} tone="ok" />
        <Tile label="Sem versão aberta" value={totals.noOpenVersion} />
        <Tile label="Falharam" value={totals.failed} tone="bad" />
      </div>
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
      <ModalFooter>
        <Button onClick={onClose}>Concluir</Button>
      </ModalFooter>
    </Modal>
  );
};
