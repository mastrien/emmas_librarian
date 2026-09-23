import React from 'react';
import { createPortal } from 'react-dom';
import { formatDiaryDate } from './diaryDates';

export interface DiaryVersion {
  id: number;
  content: string;
  updated_at: string;
}

const PREVIEW_LENGTH = 150;

const DiaryDialog: React.FC<{ cardStyle: React.CSSProperties; children: React.ReactNode }> = ({ cardStyle, children }) =>
  createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        backdropFilter: 'blur(4px)',
      }}
    >
      <div className="card fade-in" style={{ padding: '2rem', background: 'var(--bg-surface)', ...cardStyle }}>
        {children}
      </div>
    </div>,
    document.body,
  );

/**
 * Confirmation before permanently deleting a diary page.
 *
 * Usage:
 *   {confirming && <DeleteDiaryPageDialog date={date} onCancel={cancel} onConfirm={remove} />}
 */
export const DeleteDiaryPageDialog: React.FC<{ date: string; onCancel: () => void; onConfirm: () => void }> = ({
  date,
  onCancel,
  onConfirm,
}) => (
  <DiaryDialog cardStyle={{ maxWidth: '400px', textAlign: 'center' }}>
    <h3 style={{ margin: '0 0 1rem 0' }}>Excluir página?</h3>
    <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
      A página de <strong>{formatDiaryDate(date)}</strong> será excluída permanentemente.
    </p>
    <div style={{ display: 'flex', gap: '1rem' }}>
      <button onClick={onCancel} className="btn-secondary" style={{ flex: 1 }}>
        Cancelar
      </button>
      <button onClick={onConfirm} className="btn-primary" style={{ flex: 1, background: 'var(--color-danger)' }}>
        Excluir
      </button>
    </div>
  </DiaryDialog>
);

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
  <DiaryDialog cardStyle={{ width: '500px', maxWidth: '90%', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
    <h3 style={{ margin: '0 0 1rem 0', color: 'var(--text-heading)' }}>Histórico de Versões</h3>
    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1rem' }}>
      Selecione uma versão anterior para restaurar no diário de <strong>{formatDiaryDate(date)}</strong>.
    </p>
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
      {versions.length === 0 ? <NoVersions /> : versions.map((v) => <VersionCard key={v.id} version={v} onRestore={onRestore} />)}
    </div>
    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
      <button onClick={onClose} className="btn-secondary" style={{ padding: '0.5rem 1.5rem' }}>
        Fechar
      </button>
    </div>
  </DiaryDialog>
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

const VersionCard: React.FC<{ version: DiaryVersion; onRestore: (versionId: number) => void }> = ({ version, onRestore }) => (
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
