import React from 'react';
import { Save, Download, Upload, Shuffle, RotateCcw } from 'lucide-react';

interface BackupSettingsProps {
  autoBackups: boolean;
  handleToggleAutoBackups: (enabled: boolean) => void;
  autoBackupsList: { filename: string; date: string; sizeBytes: number }[];
  handleExportBackup: () => void;
  handleRestoreBackupOverride: () => void;
  handleRestoreBackupMerge: () => void;
  handleRestoreAutoBackup: (filename: string) => void;
}

export const BackupSettings: React.FC<BackupSettingsProps> = ({
  autoBackups,
  handleToggleAutoBackups,
  autoBackupsList,
  handleExportBackup,
  handleRestoreBackupOverride,
  handleRestoreBackupMerge,
  handleRestoreAutoBackup,
}) => {
  return (
    <div className="card" style={{ padding: '2rem' }}>
      <h2
        style={{ fontSize: '1.5rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}
      >
        <Save size={24} color="var(--color-primary)" /> Backup & Segurança
      </h2>
      <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
        Configure como o Emma's Librarian protege seus dados locais contra exclusões acidentais ou falhas.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <label
          style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', userSelect: 'none' }}
        >
          <input
            type="checkbox"
            checked={autoBackups}
            onChange={(e) => handleToggleAutoBackups(e.target.checked)}
            style={{ width: '18px', height: '18px', cursor: 'pointer' }}
          />
          <div>
            <span style={{ fontWeight: 600, color: 'var(--text-heading)' }}>
              Habilitar backups automáticos locais (Recomendado)
            </span>
            <span
              style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}
            >
              Cria um backup comprimido (gzip) do banco de dados na inicialização com retenção inteligente (GFS).
            </span>
          </div>
        </label>

        <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border-color)' }}>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '0.75rem', color: 'var(--text-heading)' }}>
            Backup Manual Completo
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
            Gere um arquivo contendo todas as informações do banco de dados (projetos, artigos, anotações, diário) e
            todos os arquivos PDF locais. Isso permite migrar seus dados para outro dispositivo.
          </p>

          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <button
              onClick={handleExportBackup}
              className="btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <Download size={16} /> Criar Backup Completo
            </button>
            <button
              onClick={handleRestoreBackupOverride}
              className="btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-danger)' }}
            >
              <Upload size={16} /> Restaurar e Sobrescrever
            </button>
            <button
              onClick={handleRestoreBackupMerge}
              className="btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <Shuffle size={16} /> Importar e Mesclar
            </button>
          </div>
        </div>

        <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border-color)' }}>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '0.75rem', color: 'var(--text-heading)' }}>
            Histórico de Backups Automáticos
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1rem' }}>
            Cópia(s) comprimida(s) (.gz) salvas localmente na inicialização com rotação GFS. Clique em restaurar
            para voltar o sistema ao estado correspondente (sobrescreve banco de dados e reinicia).
          </p>

          {autoBackupsList.length === 0 ? (
            <div
              style={{
                padding: '1rem',
                border: '1px dashed var(--border-color)',
                borderRadius: 'var(--radius-md)',
                textAlign: 'center',
                color: 'var(--text-muted)',
                fontSize: '0.9rem',
              }}
            >
              Nenhum backup automático disponível ainda.
            </div>
          ) : (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
                maxHeight: '200px',
                overflowY: 'auto',
                paddingRight: '0.5rem',
              }}
            >
              {autoBackupsList.map((b) => (
                <div
                  key={b.filename}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '0.75rem 1rem',
                    background: 'var(--bg-main)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-md)',
                  }}
                >
                  <div>
                    <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-heading)' }}>
                      {b.date}
                    </span>
                    <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {(b.sizeBytes / 1024).toFixed(1)} KB (gzip)
                    </span>
                  </div>
                  <button
                    onClick={() => handleRestoreAutoBackup(b.filename)}
                    className="btn-secondary"
                    style={{
                      padding: '0.3rem 0.6rem',
                      fontSize: '0.8rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                    }}
                  >
                    <RotateCcw size={12} /> Restaurar
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
