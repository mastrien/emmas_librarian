import React, { useState, useEffect } from 'react';
import { projectService } from '../services/api';
import { Settings, Moon, Sun, Key, Save, CheckCircle } from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const [theme, setTheme] = useState<'light' | 'dark'>(
    (localStorage.getItem('theme') as 'light' | 'dark') || 'light'
  );
  const [scopusKey, setScopusKey] = useState('');
  const [wosKey, setWosKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    // Load API keys from DB
    const loadKeys = async () => {
      const sKey = await projectService.getSetting('scopus_api_key');
      const wKey = await projectService.getSetting('wos_api_key');
      if (sKey) setScopusKey(sKey);
      if (wKey) setWosKey(wKey);
    };
    loadKeys();
  }, []);

  const handleThemeChange = (newTheme: 'light' | 'dark') => {
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  };

  const handleSaveKeys = async () => {
    setSaving(true);
    await projectService.setSetting('scopus_api_key', scopusKey);
    await projectService.setSetting('wos_api_key', wosKey);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="fade-in" style={{ maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2.5rem' }}>
        <div style={{ background: 'var(--color-primary)', color: 'white', padding: '0.75rem', borderRadius: 'var(--radius-lg)', display: 'flex' }}>
          <Settings size={28} />
        </div>
        <h1 style={{ margin: 0, fontSize: '2.5rem' }}>Configurações</h1>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        {/* Theme Section */}
        <div className="card" style={{ padding: '2rem' }}>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            Aparência
          </h2>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button
              onClick={() => handleThemeChange('light')}
              style={{
                flex: 1,
                padding: '1.5rem',
                borderRadius: 'var(--radius-lg)',
                border: `2px solid ${theme === 'light' ? 'var(--color-primary)' : 'var(--border-color)'}`,
                background: theme === 'light' ? 'rgba(79, 70, 229, 0.05)' : 'var(--bg-surface)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.75rem',
                cursor: 'pointer',
                transition: 'all var(--transition-fast)'
              }}
            >
              <Sun size={32} color={theme === 'light' ? 'var(--color-primary)' : 'var(--text-muted)'} />
              <span style={{ fontWeight: 600, color: theme === 'light' ? 'var(--color-primary)' : 'var(--text-main)' }}>Modo Claro</span>
            </button>
            <button
              onClick={() => handleThemeChange('dark')}
              style={{
                flex: 1,
                padding: '1.5rem',
                borderRadius: 'var(--radius-lg)',
                border: `2px solid ${theme === 'dark' ? 'var(--color-primary)' : 'var(--border-color)'}`,
                background: theme === 'dark' ? 'rgba(79, 70, 229, 0.05)' : 'var(--bg-surface)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.75rem',
                cursor: 'pointer',
                transition: 'all var(--transition-fast)'
              }}
            >
              <Moon size={32} color={theme === 'dark' ? 'var(--color-primary)' : 'var(--text-muted)'} />
              <span style={{ fontWeight: 600, color: theme === 'dark' ? 'var(--color-primary)' : 'var(--text-main)' }}>Modo Escuro</span>
            </button>
          </div>
        </div>

        {/* API Keys Section */}
        <div className="card" style={{ padding: '2rem' }}>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            Chaves de API
          </h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>
            Insira suas chaves de API para habilitar buscas no Scopus e Web of Science. As chaves são armazenadas localmente no seu banco de dados.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: 'var(--text-heading)' }}>Scopus API Key</label>
              <div style={{ position: 'relative' }}>
                <div style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>
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
                    outline: 'none'
                  }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: 'var(--text-heading)' }}>Web of Science API Key</label>
              <div style={{ position: 'relative' }}>
                <div style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>
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
                    outline: 'none'
                  }}
                />
              </div>
            </div>

            <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
              <button 
                onClick={handleSaveKeys} 
                className="btn-primary" 
                disabled={saving}
                style={{ minWidth: '150px' }}
              >
                {saved ? <CheckCircle size={20} /> : <Save size={20} />}
                {saving ? 'Salvando...' : saved ? 'Salvo!' : 'Salvar Chaves'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
