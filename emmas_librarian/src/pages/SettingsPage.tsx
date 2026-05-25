import React, { useState, useEffect } from 'react';
import { projectService } from '../services/api';
import { Settings, Moon, Sun, Key, Save, CheckCircle, Brain, ShieldAlert } from 'lucide-react';
import { Link } from 'react-router-dom';

export const SettingsPage: React.FC = () => {
  const [theme, setTheme] = useState<'light' | 'dark'>(
    (localStorage.getItem('theme') as 'light' | 'dark') || 'light'
  );
  const [accent, setAccent] = useState<string>(
    localStorage.getItem('accent') || 'blue'
  );
  const [scopusKey, setScopusKey] = useState('');
  const [wosKey, setWosKey] = useState('');
  
  const [openaiKey, setOpenaiKey] = useState('');
  const [anthropicKey, setAnthropicKey] = useState('');
  const [geminiKey, setGeminiKey] = useState('');
  const [ollamaUrl, setOllamaUrl] = useState('');
  const [ollamaModel, setOllamaModel] = useState('');

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [appVersion, setAppVersion] = useState('');

  useEffect(() => {
    // Load API keys from DB
    const loadKeys = async () => {
      const sKey = await projectService.getSetting('api_key_scopus');
      const wKey = await projectService.getSetting('api_key_wos');
      const oKey = await projectService.getSetting('api_key_openai');
      const aKey = await projectService.getSetting('api_key_anthropic');
      const gKey = await projectService.getSetting('api_key_gemini');
      const olUrl = await projectService.getSetting('api_key_ollama');
      const olMod = await projectService.getSetting('ollama_model');

      if (sKey) setScopusKey(sKey);
      if (wKey) setWosKey(wKey);
      if (oKey) setOpenaiKey(oKey);
      if (aKey) setAnthropicKey(aKey);
      if (gKey) setGeminiKey(gKey);
      if (olUrl) setOllamaUrl(olUrl);
      if (olMod) setOllamaModel(olMod);
      
      try {
        const v = await projectService.getAppVersion();
        setAppVersion(v);
      } catch (err) {
        console.error('Failed to get app version:', err);
      }
    };
    loadKeys();
  }, []);

  const handleThemeChange = (newTheme: 'light' | 'dark') => {
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
    if ((window as any).electronAPI) {
      (window as any).electronAPI.invoke('UPDATE_TITLE_BAR', newTheme);
    }
  };

  const handleAccentChange = (newAccent: string) => {
    setAccent(newAccent);
    localStorage.setItem('accent', newAccent);
    document.documentElement.setAttribute('data-accent', newAccent);
  };

  const handleSaveKeys = async () => {
    setSaving(true);
    await projectService.setSetting('api_key_scopus', scopusKey);
    await projectService.setSetting('api_key_wos', wosKey);
    await projectService.setSetting('api_key_openai', openaiKey);
    await projectService.setSetting('api_key_anthropic', anthropicKey);
    await projectService.setSetting('api_key_gemini', geminiKey);
    await projectService.setSetting('api_key_ollama', ollamaUrl);
    await projectService.setSetting('ollama_model', ollamaModel);
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

          <div style={{ marginTop: '2.5rem' }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '1.2rem', color: 'var(--text-heading)' }}>
              Cor de Destaque
            </h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
              {[
                { id: 'blue', color: '#4f46e5', label: 'Azul' },
                { id: 'pink', color: '#db2777', label: 'Rosa' },
                { id: 'green', color: '#059669', label: 'Verde' },
                { id: 'purple', color: '#7c3aed', label: 'Roxo' },
                { id: 'orange', color: '#ea580c', label: 'Laranja' },
                { id: 'red', color: '#dc2626', label: 'Vermelho' }
              ].map((colorObj) => (
                <button
                  key={colorObj.id}
                  onClick={() => handleAccentChange(colorObj.id)}
                  title={colorObj.label}
                  style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '50%',
                    background: colorObj.color,
                    border: `3px solid ${accent === colorObj.id ? 'var(--text-heading)' : 'transparent'}`,
                    cursor: 'pointer',
                    transition: 'transform var(--transition-fast)',
                    boxShadow: accent === colorObj.id ? '0 0 0 2px var(--bg-surface), 0 0 0 4px ' + colorObj.color : 'none',
                    transform: accent === colorObj.id ? 'scale(1.1)' : 'scale(1)'
                  }}
                />
              ))}
            </div>
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
          </div>
        </div>

        {/* AI API Keys Section */}
        <div className="card" style={{ padding: '2rem' }}>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Brain size={24} color="var(--color-primary)" /> Integrações de Inteligência Artificial
          </h2>
          <div style={{ padding: '1rem', background: 'rgba(234, 179, 8, 0.1)', border: '1px solid rgba(234, 179, 8, 0.3)', borderRadius: 'var(--radius-md)', marginBottom: '2rem', display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
            <ShieldAlert size={20} color="var(--color-warning)" style={{ flexShrink: 0, marginTop: '2px' }} />
            <p style={{ margin: 0, color: 'var(--text-main)', fontSize: '0.9rem', lineHeight: 1.5 }}>
              Ao usar funcionalidades de Inteligência Artificial, dados podem ser enviados para provedores externos. 
              <br />
              <Link to="/terms" style={{ color: 'var(--color-primary)', fontWeight: 600 }}>Leia os Termos de Uso e IA completos aqui.</Link>
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: 'var(--text-heading)' }}>OpenAI API Key</label>
              <div style={{ position: 'relative' }}>
                <div style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}><Key size={18} /></div>
                <input type="password" value={openaiKey} onChange={(e) => setOpenaiKey(e.target.value)} placeholder="sk-..." style={{ width: '100%', padding: '0.8rem 1rem 0.8rem 2.8rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', background: 'var(--bg-main)', color: 'var(--text-main)', outline: 'none' }} />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: 'var(--text-heading)' }}>Google Gemini API Key</label>
              <div style={{ position: 'relative' }}>
                <div style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}><Key size={18} /></div>
                <input type="password" value={geminiKey} onChange={(e) => setGeminiKey(e.target.value)} placeholder="AIza..." style={{ width: '100%', padding: '0.8rem 1rem 0.8rem 2.8rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', background: 'var(--bg-main)', color: 'var(--text-main)', outline: 'none' }} />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: 'var(--text-heading)' }}>Anthropic API Key <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 'normal' }}>(Em breve)</span></label>
              <div style={{ position: 'relative', opacity: 0.5 }}>
                <div style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}><Key size={18} /></div>
                <input type="password" value={anthropicKey} disabled onChange={(e) => setAnthropicKey(e.target.value)} placeholder="sk-ant-..." style={{ width: '100%', padding: '0.8rem 1rem 0.8rem 2.8rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', background: 'var(--bg-main)', color: 'var(--text-main)', outline: 'none', cursor: 'not-allowed' }} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: 'var(--text-heading)' }}>Ollama URL <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 'normal' }}>(Ex: http://127.0.0.1:11434/v1)</span></label>
                <div style={{ position: 'relative' }}>
                  <div style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}><Key size={18} /></div>
                  <input type="text" value={ollamaUrl} onChange={(e) => setOllamaUrl(e.target.value)} placeholder="http://127.0.0.1:11434/v1" style={{ width: '100%', padding: '0.8rem 1rem 0.8rem 2.8rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', background: 'var(--bg-main)', color: 'var(--text-main)', outline: 'none' }} />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: 'var(--text-heading)' }}>Modelo do Ollama</label>
                <div style={{ position: 'relative' }}>
                  <input type="text" value={ollamaModel} onChange={(e) => setOllamaModel(e.target.value)} placeholder="Ex: llama3.1" style={{ width: '100%', padding: '0.8rem 1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', background: 'var(--bg-main)', color: 'var(--text-main)', outline: 'none' }} />
                </div>
              </div>
            </div>

            <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={handleSaveKeys} className="btn-primary" disabled={saving} style={{ minWidth: '150px' }}>
                {saved ? <CheckCircle size={20} /> : <Save size={20} />}
                {saving ? 'Salvando...' : saved ? 'Salvo!' : 'Salvar Chaves'}
              </button>
            </div>
          </div>
        </div>

        {/* App Info Section */}
        <div style={{ textAlign: 'center', marginTop: '1rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          <p>Emma's Librarian {appVersion ? `v${appVersion}` : ''}</p>
        </div>
      </div>
    </div>
  );
};
