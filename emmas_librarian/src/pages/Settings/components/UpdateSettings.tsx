import React, { useState } from 'react';
import { RefreshCw, Download, ArrowUpCircle, ShieldCheck, AlertTriangle, CheckCircle, FileText } from 'lucide-react';
import type { UpdateStatusResponse } from '../../../types';
import { canOfferSnapshotRestore } from '../snapshotRestoreWindow';
import { showsNotAppliedNotice } from '../updateNotice';
import { SettingsCard } from './SettingsCard';
import './updateSettings.css';

interface UpdateSettingsProps {
  currentVersion: string;
  updateStatus: UpdateStatusResponse;
  onCheckForUpdates: () => Promise<void>;
  onDownloadUpdate: () => Promise<void>;
  onInstallUpdate: () => Promise<void>;
  onRestoreSnapshot?: () => Promise<void>;
}

type UpdateInfo = NonNullable<UpdateStatusResponse['updateInfo']>;
type Snapshot = NonNullable<UpdateStatusResponse['state']>;

const UpdateProgressBar: React.FC<{ percent: number; speed: number }> = ({ percent, speed }) => {
  // The width is the download's progress: a CSS variable, not an inline rule.
  const progress = { '--progress': `${Math.min(100, Math.max(0, percent))}%` } as React.CSSProperties;
  return (
    <div className="update-progress">
      <div className="update-progress-head">
        <span>Baixando atualização... {percent.toFixed(0)}%</span>
        <span>{(speed / (1024 * 1024)).toFixed(2)} MB/s</span>
      </div>
      <div className="update-progress-track">
        <div className="update-progress-fill" style={progress} />
      </div>
    </div>
  );
};

const ReleaseNotesView: React.FC<{ notes?: string }> = ({ notes }) => {
  const [showNotes, setShowNotes] = useState(false);
  if (!notes) return null;
  return (
    <div className="update-notes">
      <button type="button" onClick={() => setShowNotes(!showNotes)} className="btn-ghost update-notes-toggle">
        <FileText size={14} />
        {showNotes ? 'Ocultar notas da versão' : 'Ver notas da versão'}
      </button>
      {showNotes && <div className="update-notes-text">{notes}</div>}
    </div>
  );
};

const UpdateNotAppliedNotice: React.FC<{ targetVersion?: string; currentVersion: string }> = ({
  targetVersion,
  currentVersion,
}) => (
  <div role="alert" className="update-warning">
    <AlertTriangle size={18} className="update-warning-icon" />
    <span>
      A atualização para a v{targetVersion ?? '...'} foi iniciada, mas não foi aplicada: você continua na v
      {currentVersion}. Isso acontece, por exemplo, quando o app é aberto de novo enquanto o instalador ainda trabalha.
      Sua biblioteca não foi alterada. Use &quot;Verificar Atualizações&quot; para tentar outra vez.
    </span>
  </div>
);

const VersionRow: React.FC<{ currentVersion: string; checking: boolean; busy: boolean; onCheck: () => void }> = (
  props,
) => (
  <div className="update-version-row">
    <div>
      <div className="update-version">Versão Instalada: v{props.currentVersion || '...'}</div>
      <div className="update-channel">Canal de release estável via GitHub Releases</div>
    </div>
    <button
      type="button"
      className="btn btn-secondary settings-icon-button"
      onClick={props.onCheck}
      disabled={props.busy}
    >
      <RefreshCw size={16} className={props.checking ? 'spin' : ''} />
      {props.checking ? 'Verificando...' : 'Verificar Atualizações'}
    </button>
  </div>
);

const UpToDate: React.FC = () => (
  <div className="update-notice">
    <CheckCircle size={18} className="update-icon-success" />
    <span>Você está utilizando a versão mais recente do Emma&apos;s Librarian.</span>
  </div>
);

const UpdateAvailable: React.FC<{ info: UpdateInfo; onDownload: () => void }> = ({ info, onDownload }) => (
  <div className="update-box">
    <div className="update-box-row">
      <div>
        <span className="update-box-title">Nova Versão Disponível: v{info.version}</span>
        {info.releaseDate && <span className="update-box-date">({info.releaseDate})</span>}
      </div>
      <button type="button" className="btn btn-primary settings-icon-button" onClick={onDownload}>
        <Download size={16} /> Baixar Atualização
      </button>
    </div>
    <ReleaseNotesView notes={info.releaseNotes} />
  </div>
);

const UpdateDownloaded: React.FC<{ onInstall: () => void }> = ({ onInstall }) => (
  <div className="update-box">
    <div className="update-box-head">
      <ShieldCheck size={20} className="update-icon-primary" />
      <span>Atualização pronta para instalação</span>
    </div>
    <p className="update-box-text">
      Um snapshot de segurança do seu banco de dados será gerado automaticamente antes da instalação. Se a nova versão
      não abrir a biblioteca, o app oferece restaurar esse snapshot. A restauração devolve só os dados: a versão
      instalada não muda, e voltar a uma versão anterior exige instalá-la de novo.
    </p>
    <button type="button" className="btn btn-primary settings-icon-button" onClick={onInstall}>
      <RefreshCw size={16} /> Reiniciar e Instalar Atualização
    </button>
  </div>
);

const UpdateError: React.FC<{ error: string }> = ({ error }) => (
  <div className="update-error">
    <AlertTriangle size={18} />
    <span>Erro ao processar atualização: {error}</span>
  </div>
);

const SnapshotRollback: React.FC<{ snapshot: Snapshot; onRestore: () => void }> = ({ snapshot, onRestore }) => (
  <div className="update-rollback">
    <h3>Rollback de Emergência</h3>
    <p className="update-rollback-text">
      Snapshot de {describeSnapshotDate(snapshot.timestamp)}, salvo em: <code>{snapshot.snapshotPath}</code>
    </p>
    <p className="update-rollback-text">
      Restaurar desfaz o que foi feito depois dessa data. O banco atual é guardado em <code>backups/</code> antes, e o
      app reinicia.
    </p>
    <button type="button" className="btn btn-secondary settings-icon-button" onClick={onRestore}>
      <ShieldCheck size={16} /> Restaurar Dados do Snapshot Pré-Atualização
    </button>
  </div>
);

// One status at a time, as the updater reports it.
const UpdateStatusPanel: React.FC<{ props: UpdateSettingsProps }> = ({ props }) => {
  const { updateStatus, currentVersion } = props;
  const { status, updateInfo: info, downloadProgress: progress } = updateStatus;
  return (
    <>
      {showsNotAppliedNotice(updateStatus, currentVersion) && (
        <UpdateNotAppliedNotice targetVersion={updateStatus.state?.targetVersion} currentVersion={currentVersion} />
      )}
      {status === 'not-available' && <UpToDate />}
      {status === 'available' && info && <UpdateAvailable info={info} onDownload={props.onDownloadUpdate} />}
      {status === 'downloading' && progress && (
        <UpdateProgressBar percent={progress.percent} speed={progress.bytesPerSecond} />
      )}
      {status === 'downloaded' && <UpdateDownloaded onInstall={props.onInstallUpdate} />}
      {status === 'error' && updateStatus.error && <UpdateError error={updateStatus.error} />}
    </>
  );
};

/**
 * Settings → Atualizações e Contingências: the installed version, the update flow (check, download, install) and,
 * after a failed update, restoring the pre-update snapshot.
 *
 * @example <UpdateSettings currentVersion="1.3.1" updateStatus={status} onCheckForUpdates={check} … />
 */
export const UpdateSettings: React.FC<UpdateSettingsProps> = (props) => {
  const [loading, setLoading] = useState(false);
  const status = props.updateStatus.status;
  const snapshot = canOfferSnapshotRestore(props.updateStatus.state) ? props.updateStatus.state : null;
  const handleCheck = async () => {
    setLoading(true);
    try {
      await props.onCheckForUpdates();
    } finally {
      setLoading(false);
    }
  };
  return (
    <SettingsCard
      title="Atualizações e Contingências"
      icon={<ArrowUpCircle size={24} />}
      description="Gerencie as atualizações do sistema de forma segura e com controle total. Nenhuma atualização é aplicada sem a sua aprovação."
    >
      <div className="update-panel">
        <VersionRow
          currentVersion={props.currentVersion}
          checking={loading || status === 'checking'}
          busy={loading || status === 'checking' || status === 'downloading'}
          onCheck={handleCheck}
        />
        <UpdateStatusPanel props={props} />
        {snapshot && props.onRestoreSnapshot && (
          <SnapshotRollback snapshot={snapshot} onRestore={props.onRestoreSnapshot} />
        )}
      </div>
    </SettingsCard>
  );
};

/**
 * When the pre-update snapshot was taken, in the reader's words; the timestamp is missing on states
 * written by builds that did not record it.
 *
 * Usage:
 *   describeSnapshotDate(state.timestamp); // "03/10/2026, 17:45"
 */
export function describeSnapshotDate(timestamp?: number): string {
  if (!timestamp) return 'antes da última atualização';
  return new Date(timestamp).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}
