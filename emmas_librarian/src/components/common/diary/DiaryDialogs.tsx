import React from 'react';
import { Modal } from '../Modal';
import { formatDiaryDate } from './diaryDates';

export interface DiaryVersion {
  id: number;
  content: string;
  updated_at: string;
}

const PREVIEW_LENGTH = 150;

interface DiaryHistoryDialogProps {
  date: string;
  versions: DiaryVersion[];
  onRestore: (versionId: number) => void;
  onClose: () => void;
}

/**
 * Previous saved versions of a diary page, each restorable.
 *
 * Usage:
 *   {showHistory && <DiaryHistoryDialog date={date} versions={versions} onRestore={restore} onClose={close} />}
 */
export const DiaryHistoryDialog: React.FC<DiaryHistoryDialogProps> = ({ date, versions, onRestore, onClose }) => (
  <Modal
    label="Histórico de Versões"
    title="Histórico de Versões"
    description={
      <>
        Selecione uma versão anterior para restaurar no diário de <strong>{formatDiaryDate(date)}</strong>.
      </>
    }
    onClose={onClose}
    width={500}
  >
    <div
      style={{
        flex: 1,
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
        marginBottom: '1.5rem',
        paddingRight: '0.5rem',
      }}
    >
      {versions.length === 0 ? (
        <NoVersions />
      ) : (
        versions.map((v) => <VersionCard key={v.id} version={v} onRestore={onRestore} />)
      )}
    </div>
  </Modal>
);

const NoVersions: React.FC = () => (
  <div
    style={{
      textAlign: 'center',
      padding: '2rem',
      border: '1px dashed var(--border-color)',
      borderRadius: 'var(--radius-md)',
      color: 'var(--text-muted)',
    }}
  >
    Nenhuma versão anterior encontrada.
  </div>
);

const previewOf = (content: string) =>
  !content ? '(Vazio)' : content.length > PREVIEW_LENGTH ? content.substring(0, PREVIEW_LENGTH) + '...' : content;

const VersionCard: React.FC<{ version: DiaryVersion; onRestore: (versionId: number) => void }> = ({
  version,
  onRestore,
}) => (
  <div
    style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '0.5rem',
      padding: '1rem',
      background: 'var(--bg-main)',
      borderRadius: 'var(--radius-md)',
      border: '1px solid var(--border-color)',
    }}
  >
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-heading)' }}>
        {new Date(version.updated_at).toLocaleString('pt-BR')}
      </span>
      <button
        onClick={() => onRestore(version.id)}
        className="btn-primary"
        style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
      >
        Restaurar
      </button>
    </div>
    <div
      style={{
        fontSize: '0.8rem',
        color: 'var(--text-muted)',
        whiteSpace: 'pre-wrap',
        maxHeight: '60px',
        overflow: 'hidden',
        borderLeft: '2px solid var(--border-color)',
        paddingLeft: '0.5rem',
        fontStyle: version.content ? 'normal' : 'italic',
      }}
    >
      {previewOf(version.content)}
    </div>
  </div>
);
