import React from 'react';
import { Key } from 'lucide-react';

interface ApiKeysSettingsProps {
  scopusKey: string;
  setScopusKey: (v: string) => void;
  wosKey: string;
  setWosKey: (v: string) => void;
}

export const ApiKeysSettings: React.FC<ApiKeysSettingsProps> = ({ scopusKey, setScopusKey, wosKey, setWosKey }) => {
  return (
    <div className="card" style={{ padding: '2rem' }}>
      <h2
        style={{
          fontSize: '1.5rem',
          marginBottom: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
        }}
      >
        Chaves de API
      </h2>
      <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>
        Insira suas chaves de API para habilitar buscas no Scopus e Web of Science. As chaves são armazenadas
        localmente no seu banco de dados.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: 'var(--text-heading)' }}>
            Scopus API Key
          </label>
          <div style={{ position: 'relative' }}>
            <div
              style={{
                position: 'absolute',
                left: '1rem',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)',
              }}
            >
              <Key size={18} />
            </div>
            <input
              type="password"
              value={scopusKey}
              onChange={(e) => setScopusKey(e.target.value)}
              placeholder="Insira sua chave Scopus..."
              style={{
                width: '100%',
                padding: '0.8rem 1rem 0.8rem 2.8rem',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-main)',
                color: 'var(--text-main)',
                outline: 'none',
              }}
            />
          </div>
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: 'var(--text-heading)' }}>
            Web of Science API Key
          </label>
          <div style={{ position: 'relative' }}>
            <div
              style={{
                position: 'absolute',
                left: '1rem',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)',
              }}
            >
              <Key size={18} />
            </div>
            <input
              type="password"
              value={wosKey}
              onChange={(e) => setWosKey(e.target.value)}
              placeholder="Insira sua chave WoS..."
              style={{
                width: '100%',
                padding: '0.8rem 1rem 0.8rem 2.8rem',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-main)',
                color: 'var(--text-main)',
                outline: 'none',
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
