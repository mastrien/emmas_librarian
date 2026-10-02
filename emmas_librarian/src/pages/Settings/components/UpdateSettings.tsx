import React, { useState } from 'react';
import { RefreshCw, Download, ArrowUpCircle, ShieldCheck, AlertTriangle, CheckCircle, FileText } from 'lucide-react';
import type { UpdateStatusResponse } from '../../../types';

interface UpdateSettingsProps {
  currentVersion: string;
  updateStatus: UpdateStatusResponse;
  onCheckForUpdates: () => Promise<void>;
  onDownloadUpdate: () => Promise<void>;
  onInstallUpdate: () => Promise<void>;
  onRestoreSnapshot?: () => Promise<void>;
}

const UpdateProgressBar: React.FC<{ percent: number; speed: number }> = ({ percent, speed }) => (
  <div style={{ marginTop: '1rem' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.25rem' }}>
      <span>Baixando atualização... {percent.toFixed(0)}%</span>
      <span>{(speed / (1024 * 1024)).toFixed(2)} MB/s</span>
    </div>
    <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--bg-secondary)', borderRadius: '4px' }}>
      <div
        style={{
          width: `${Math.min(100, Math.max(0, percent))}%`,
          height: '100%',
          backgroundColor: 'var(--color-primary)',
          borderRadius: '4px',
          transition: 'width 0.2s ease',
        }}
      />
    </div>
  </div>
);

const ReleaseNotesView: React.FC<{ notes?: string }> = ({ notes }) => {
  const [showNotes, setShowNotes] = useState(false);
  if (!notes) return null;

  return (
    <div style={{ marginTop: '0.75rem' }}>
      <button
        type="button"
        onClick={() => setShowNotes(!showNotes)}
        className="btn-ghost"
        style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.25rem 0.5rem' }}
      >
        <FileText size={14} />
        {showNotes ? 'Ocultar notas da versão' : 'Ver notas da versão'}
      </button>
      {showNotes && (
        <div
          style={{
            marginTop: '0.5rem',
            padding: '0.75rem',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--bg-secondary)',
            fontSize: '0.85rem',
            whiteSpace: 'pre-wrap',
          }}
        >
          {notes}
        </div>
      )}
    </div>
  );
};

export const UpdateSettings: React.FC<UpdateSettingsProps> = ({
  currentVersion,
  updateStatus,
  onCheckForUpdates,
  onDownloadUpdate,
  onInstallUpdate,
  onRestoreSnapshot,
}) => {
  const [loading, setLoading] = useState(false);
  const status = updateStatus.status;
  const info = updateStatus.updateInfo;

  const handleCheck = async () => {
    setLoading(true);
    try {
      await onCheckForUpdates();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card" style={{ padding: '2rem' }}>
      <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <ArrowUpCircle size={24} color="var(--color-primary)" /> Atualizações e Contingências
      </h2>
      <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
        Gerencie as atualizações do sistema de forma segura e com controle total. Nenhuma atualização é aplicada sem a
        sua aprovação.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem',
          }}
        >
          <div>
            <div style={{ fontWeight: 600, color: 'var(--text-heading)' }}>
              Versão Instalada: v{currentVersion || '...'}
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
              Canal de release estável via GitHub Releases
            </div>
          </div>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleCheck}
            disabled={loading || status === 'checking' || status === 'downloading'}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <RefreshCw size={16} className={loading || status === 'checking' ? 'spin' : ''} />
            {loading || status === 'checking' ? 'Verificando...' : 'Verificar Atualizações'}
          </button>
        </div>

        {status === 'not-available' && (
          <div
            style={{
              padding: '0.75rem 1rem',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--bg-secondary)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              color: 'var(--text-main)',
            }}
          >
            <CheckCircle size={18} color="var(--color-success, #10b981)" />
            <span>Você está utilizando a versão mais recente do Emma's Librarian.</span>
          </div>
        )}

        {status === 'available' && info && (
          <div
            style={{
              padding: '1rem',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-secondary)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '0.5rem',
              }}
            >
              <div>
                <span style={{ fontWeight: 600, color: 'var(--text-heading)' }}>
                  Nova Versão Disponível: v{info.version}
                </span>
                {info.releaseDate && (
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginLeft: '0.5rem' }}>
                    ({info.releaseDate})
                  </span>
                )}
              </div>
              <button
                type="button"
                className="btn btn-primary"
                onClick={onDownloadUpdate}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  backgroundColor: 'var(--color-primary)',
                }}
              >
                <Download size={16} /> Baixar Atualização
              </button>
            </div>
            <ReleaseNotesView notes={info.releaseNotes} />
          </div>
        )}

        {status === 'downloading' && updateStatus.downloadProgress && (
          <UpdateProgressBar
            percent={updateStatus.downloadProgress.percent}
            speed={updateStatus.downloadProgress.bytesPerSecond}
          />
        )}

        {status === 'downloaded' && (
          <div
            style={{
              padding: '1rem',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                marginBottom: '0.5rem',
                color: 'var(--text-heading)',
              }}
            >
              <ShieldCheck size={20} color="var(--color-primary)" />
              <span style={{ fontWeight: 600 }}>Atualização pronta para instalação</span>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              Um snapshot de segurança do seu banco de dados será gerado automaticamente antes da instalação. Em caso de
              qualquer falha na nova versão, você poderá retornar imediatamente para a versão atual.
            </p>
            <button
              type="button"
              className="btn btn-primary"
              onClick={onInstallUpdate}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: 'var(--color-primary)' }}
            >
              <RefreshCw size={16} /> Reiniciar e Instalar Atualização
            </button>
          </div>
        )}

        {status === 'error' && updateStatus.error && (
          <div
            style={{
              padding: '0.75rem 1rem',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--bg-danger-subtle, rgba(239, 68, 68, 0.1))',
              color: 'var(--color-danger, #ef4444)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <AlertTriangle size={18} />
            <span>Erro ao processar atualização: {updateStatus.error}</span>
          </div>
        )}

        {updateStatus.state?.snapshotPath && onRestoreSnapshot && (
          <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
            <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem', color: 'var(--text-heading)' }}>
              Rollback de Emergência
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
              Último snapshot pré-atualização salvo em: <code>{updateStatus.state.snapshotPath}</code>
            </p>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onRestoreSnapshot}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <ShieldCheck size={16} /> Restaurar Dados do Snapshot Pré-Atualização
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
