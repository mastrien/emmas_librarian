import React from 'react';
import { Save, Download, Upload, Shuffle, RotateCcw } from 'lucide-react';
import { SettingsCard } from './SettingsCard';

type AutoBackup = { filename: string; date: string; sizeBytes: number };

interface BackupSettingsProps {
  autoBackups: boolean;
  handleToggleAutoBackups: (enabled: boolean) => void;
  autoBackupsList: AutoBackup[];
  handleExportBackup: () => void;
  handleRestoreBackupOverride: () => void;
  handleRestoreBackupMerge: () => void;
  handleRestoreAutoBackup: (filename: string) => void;
}

const AutoBackupToggle: React.FC<{ enabled: boolean; onChange: (enabled: boolean) => void }> = (props) => (
  <label className="settings-toggle">
    <input type="checkbox" checked={props.enabled} onChange={(e) => props.onChange(e.target.checked)} />
    <div>
      <span className="settings-toggle-title">Habilitar backups automáticos locais (Recomendado)</span>
      <span className="settings-toggle-hint">
        Cria um backup comprimido (gzip) do banco de dados na inicialização com retenção inteligente (GFS).
      </span>
    </div>
  </label>
);

const ManualBackup: React.FC<
  Pick<BackupSettingsProps, 'handleExportBackup' | 'handleRestoreBackupOverride' | 'handleRestoreBackupMerge'>
> = (props) => (
  <div className="settings-subsection">
    <h3>Backup Manual Completo</h3>
    <p className="settings-subsection-text">
      Gere um arquivo contendo todas as informações do banco de dados (projetos, artigos, anotações, diário) e todos os
      arquivos PDF locais. Isso permite migrar seus dados para outro dispositivo.
    </p>
    <div className="settings-button-row">
      <button onClick={props.handleExportBackup} className="btn-primary settings-icon-button">
        <Download size={16} /> Criar Backup Completo
      </button>
      <button
        onClick={props.handleRestoreBackupOverride}
        className="btn-secondary settings-icon-button settings-danger-text"
      >
        <Upload size={16} /> Restaurar e Sobrescrever
      </button>
      <button onClick={props.handleRestoreBackupMerge} className="btn-secondary settings-icon-button">
        <Shuffle size={16} /> Importar e Mesclar
      </button>
    </div>
  </div>
);

const AutoBackupItem: React.FC<{ backup: AutoBackup; onRestore: () => void }> = ({ backup, onRestore }) => (
  <div className="backup-item">
    <div>
      <span className="backup-item-date">{backup.date}</span>
      <span className="backup-item-size">{(backup.sizeBytes / 1024).toFixed(1)} KB (gzip)</span>
    </div>
    <button onClick={onRestore} className="btn-secondary settings-tiny-button">
      <RotateCcw size={12} /> Restaurar
    </button>
  </div>
);

// The heading's parent is this whole section: the screenshot comparison masks it by that (visual-tests).
const AutoBackupHistory: React.FC<{ backups: AutoBackup[]; onRestore: (filename: string) => void }> = (props) => (
  <div className="settings-subsection">
    <h3>Histórico de Backups Automáticos</h3>
    <p className="settings-subsection-text settings-subsection-text--close">
      Cópia(s) comprimida(s) (.gz) salvas localmente na inicialização com rotação GFS. Clique em restaurar para voltar o
      sistema ao estado correspondente (sobrescreve banco de dados e reinicia).
    </p>
    {props.backups.length === 0 ? (
      <div className="settings-empty settings-empty--small">Nenhum backup automático disponível ainda.</div>
    ) : (
      <div className="backup-list">
        {props.backups.map((b) => (
          <AutoBackupItem key={b.filename} backup={b} onRestore={() => props.onRestore(b.filename)} />
        ))}
      </div>
    )}
  </div>
);

/**
 * Settings → Backup & Segurança: automatic backups at startup, a full manual backup and its restores, and the
 * automatic backups kept so far.
 *
 * @example <BackupSettings autoBackups={on} handleToggleAutoBackups={setOn} autoBackupsList={list} … />
 */
export const BackupSettings: React.FC<BackupSettingsProps> = (props) => (
  <SettingsCard
    title="Backup & Segurança"
    icon={<Save size={24} />}
    description="Configure como o Emma's Librarian protege seus dados locais contra exclusões acidentais ou falhas."
  >
    <div className="settings-stack">
      <AutoBackupToggle enabled={props.autoBackups} onChange={props.handleToggleAutoBackups} />
      <ManualBackup {...props} />
      <AutoBackupHistory backups={props.autoBackupsList} onRestore={props.handleRestoreAutoBackup} />
    </div>
  </SettingsCard>
);
