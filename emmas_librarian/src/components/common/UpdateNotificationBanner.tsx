import React, { useState } from 'react';
import { ArrowUpCircle, X, Download, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { UpdateInfoPayload } from '../../types';

interface UpdateNotificationBannerProps {
  updateInfo: UpdateInfoPayload | null;
  onDownload: () => Promise<void>;
}

export const UpdateNotificationBanner: React.FC<UpdateNotificationBannerProps> = ({ updateInfo, onDownload }) => {
  const version = updateInfo?.version;
  const isPreviouslyDismissed = version ? sessionStorage.getItem(`dismissed_update_${version}`) === 'true' : false;
  const [dismissedVersion, setDismissedVersion] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const navigate = useNavigate();

  if (!updateInfo || isPreviouslyDismissed || dismissedVersion === version) return null;

  const handleDismiss = () => {
    if (updateInfo.version) {
      sessionStorage.setItem(`dismissed_update_${updateInfo.version}`, 'true');
      setDismissedVersion(updateInfo.version);
    }
  };

  const handleStartUpdate = async () => {
    setDownloading(true);
    try {
      await onDownload();
      navigate('/settings');
    } catch {
      setDownloading(false);
    }
  };

  return (
    <div
      style={{
        backgroundColor: 'var(--color-primary-dark, #1e3a8a)',
        color: '#ffffff',
        padding: '0.6rem 1.5rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        fontSize: '0.875rem',
        zIndex: 55,
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <ArrowUpCircle size={18} />
        <span>
          Nova versão <strong>v{updateInfo.version}</strong> do Emma's Librarian disponível!
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <button
          type="button"
          onClick={handleStartUpdate}
          disabled={downloading}
          style={{
            backgroundColor: '#ffffff',
            color: 'var(--color-primary-dark, #1e3a8a)',
            border: 'none',
            borderRadius: 'var(--radius-sm, 4px)',
            padding: '0.3rem 0.75rem',
            fontWeight: 600,
            fontSize: '0.8rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.3rem',
          }}
        >
          <Download size={14} />
          {downloading ? 'Iniciando...' : 'Atualizar'}
        </button>

        <button
          type="button"
          onClick={() => navigate('/settings')}
          style={{
            backgroundColor: 'transparent',
            color: '#ffffff',
            border: '1px solid rgba(255, 255, 255, 0.4)',
            borderRadius: 'var(--radius-sm, 4px)',
            padding: '0.3rem 0.6rem',
            fontSize: '0.8rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.3rem',
          }}
        >
          <FileText size={14} /> Ver Notas
        </button>

        <button
          type="button"
          onClick={handleDismiss}
          title="Lembrar mais tarde"
          style={{
            background: 'none',
            border: 'none',
            color: 'rgba(255, 255, 255, 0.8)',
            cursor: 'pointer',
            padding: '0.2rem',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
};
