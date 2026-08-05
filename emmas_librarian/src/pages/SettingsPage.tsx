import React, { useState, useEffect } from 'react';
import type { TrashItem, AIModelConfig, AISkill, AIProvider } from '../types';
import { projectService } from '../services/api';
import {
  Settings,
  Moon,
  Sun,
  Key,
  Save,
  CheckCircle,
  Brain,
  ShieldAlert,
  Trash2,
  RotateCcw,
  X,
  Download,
  Upload,
  Shuffle,
} from 'lucide-react';
import { Link } from 'react-router-dom';

export const SettingsPage: React.FC = () => {
  const [theme, setTheme] = useState<'light' | 'dark'>((localStorage.getItem('theme') as 'light' | 'dark') || 'light');
  const [accent, setAccent] = useState<string>(localStorage.getItem('accent') || 'blue');
  const [scopusKey, setScopusKey] = useState('');
  const [wosKey, setWosKey] = useState('');

  const [openaiKey, setOpenaiKey] = useState('');
  const [anthropicKey, setAnthropicKey] = useState('');
  const [geminiKey, setGeminiKey] = useState('');
  const [ollamaUrl, setOllamaUrl] = useState('');
  const [ollamaModel, setOllamaModel] = useState('');
  const [ollamaCloudKey, setOllamaCloudKey] = useState('');
  const [ollamaCloudUrl, setOllamaCloudUrl] = useState('');
  const [ollamaCloudModel, setOllamaCloudModel] = useState('');

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [appVersion, setAppVersion] = useState('');
  const [aiConfigs, setAiConfigs] = useState<AIModelConfig[]>([]);

  const [ragChunkSize, setRagChunkSize] = useState('1000');
  const [ragChunkOverlap, setRagChunkOverlap] = useState('200');
  const [ragTopK, setRagTopK] = useState('10');

  const [autoBackups, setAutoBackups] = useState(true);
  const [trashItems, setTrashItems] = useState<any[]>([]);
  const [autoBackupsList, setAutoBackupsList] = useState<{ filename: string; date: string; sizeBytes: number }[]>([]);

  useEffect(() => {
    // Load settings from DB
    const loadSettings = async () => {
      try {
        const list = await projectService.listAutoBackups();
        setAutoBackupsList(list);
      } catch (err) {
        console.error('Failed to load auto backups on init:', err);
      }

      const sKey = await projectService.getSetting('scopus_api_key');
      const wKey = await projectService.getSetting('wos_api_key');
      const oKey = await projectService.getSetting('api_key_openai');
      const aKey = await projectService.getSetting('api_key_anthropic');
      const gKey = await projectService.getSetting('api_key_gemini');
      const olUrl = await projectService.getSetting('api_key_ollama');
      const olMod = await projectService.getSetting('ollama_model');
      const olCloudKey = await projectService.getSetting('api_key_ollama_cloud');
      const olCloudUrl = await projectService.getSetting('ollama_cloud_base_url');
      const olCloudMod = await projectService.getSetting('ollama_cloud_model');
      const backupsEnabledSetting = await projectService.getSetting('enable_auto_backups');
      const rSize = await projectService.getSetting('rag_chunk_size');
      const rOverlap = await projectService.getSetting('rag_chunk_overlap');
      const rTopK = await projectService.getSetting('rag_top_k');

      if (sKey) setScopusKey(sKey);
      if (wKey) setWosKey(wKey);
      if (oKey) setOpenaiKey(oKey);
      if (aKey) setAnthropicKey(aKey);
      if (gKey) setGeminiKey(gKey);
      if (olUrl) setOllamaUrl(olUrl);
      if (olMod) setOllamaModel(olMod);
      if (olCloudKey) setOllamaCloudKey(olCloudKey);
      if (olCloudUrl) setOllamaCloudUrl(olCloudUrl);
      if (olCloudMod) setOllamaCloudModel(olCloudMod);
      if (rSize) setRagChunkSize(rSize);
      if (rOverlap) setRagChunkOverlap(rOverlap);
      if (rTopK) setRagTopK(rTopK);
      setAutoBackups(backupsEnabledSetting !== 'false');

      try {
        const v = await projectService.getAppVersion();
        setAppVersion(v);
      } catch (err) {
        console.error('Failed to get app version:', err);
      }

      try {
        const trash = await projectService.getTrashItems();
        setTrashItems(trash);
      } catch (err) {
        console.error('Failed to load trash items:', err);
      }

      try {
        const configs = await projectService.getAiModelConfigs();
        setAiConfigs(configs);
      } catch (err) {
        console.error('Failed to load AI configs:', err);
      }
    };
    loadSettings();
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
    await projectService.setSetting('scopus_api_key', scopusKey);
    await projectService.setSetting('wos_api_key', wosKey);
    await projectService.setSetting('api_key_openai', openaiKey);
    await projectService.setSetting('api_key_anthropic', anthropicKey);
    await projectService.setSetting('api_key_gemini', geminiKey);
    await projectService.setSetting('api_key_ollama', ollamaUrl);
    await projectService.setSetting('ollama_model', ollamaModel);
    await projectService.setSetting('api_key_ollama_cloud', ollamaCloudKey);
    await projectService.setSetting('ollama_cloud_base_url', ollamaCloudUrl);
    await projectService.setSetting('ollama_cloud_model', ollamaCloudModel);
    await projectService.setSetting('rag_chunk_size', ragChunkSize);
    await projectService.setSetting('rag_chunk_overlap', ragChunkOverlap);
    await projectService.setSetting('rag_top_k', ragTopK);

    for (const conf of aiConfigs) {
      await projectService.updateAiModelConfig(conf.skill, conf.provider, conf.model_name);
    }

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleRestoreAiDefaults = async () => {
    if (confirm('Restaurar as configurações avançadas de IA para os padrões originais?')) {
      await projectService.restoreAiModelConfigDefaults();
      const configs = await projectService.getAiModelConfigs();
      setAiConfigs(configs);
    }
  };

  const getModelSuggestions = (skill: AISkill, provider: AIProvider): string[] => {
    if (skill === 'embeddings') {
      if (provider === 'gemini') return ['text-embedding-004'];
      if (provider === 'openai') return ['text-embedding-3-small', 'text-embedding-3-large'];
      if (provider === 'ollama') return ['nomic-embed-text', 'all-minilm'];
      return [];
    }
    if (provider === 'gemini') return ['gemini-2.5-flash', 'gemini-1.5-pro'];
    if (provider === 'openai') return ['gpt-4o-mini', 'gpt-4o'];
    if (provider === 'ollama_cloud') return ['gpt-oss:120b-cloud', 'gpt-oss:120b', 'deepseek-v4-pro', 'qwen3.5:397b'];
    if (provider === 'ollama') return ['llama3', 'llama3.1:70b', 'mistral'];
    if (provider === 'anthropic') return ['claude-3-5-sonnet-20240620', 'claude-3-haiku-20240307'];
    return [];
  };

  const handleUpdateAiConfig = (skill: AISkill, field: 'provider' | 'model_name', value: string) => {
    setAiConfigs((prev) =>
      prev.map((c) => {
        if (c.skill !== skill) return c;
        if (field === 'provider') {
          const newProvider = value as AIProvider;
          let suggestedModel = c.model_name;

          if (skill === 'embeddings') {
            if (newProvider === 'gemini') suggestedModel = 'text-embedding-004';
            else if (newProvider === 'openai') suggestedModel = 'text-embedding-3-small';
            else if (newProvider === 'ollama') suggestedModel = 'nomic-embed-text';
          } else {
            if (newProvider === 'gemini') suggestedModel = 'gemini-2.5-flash';
            else if (newProvider === 'openai') suggestedModel = 'gpt-4o-mini';
            else if (newProvider === 'ollama_cloud') suggestedModel = 'gpt-oss:120b-cloud';
            else if (newProvider === 'ollama') suggestedModel = 'llama3';
            else if (newProvider === 'anthropic') suggestedModel = 'claude-3-5-sonnet-20240620';
          }
          return { ...c, provider: newProvider, model_name: suggestedModel };
        }
        return { ...c, [field]: value };
      }),
    );
  };

  const handleToggleAutoBackups = async (enabled: boolean) => {
    setAutoBackups(enabled);
    await projectService.setSetting('enable_auto_backups', enabled ? 'true' : 'false');
  };

  const loadTrash = async () => {
    try {
      const trash = await projectService.getTrashItems();
      setTrashItems(trash);
    } catch (err) {
      console.error('Failed to reload trash:', err);
    }
  };

  const handleRestore = async (type: 'project' | 'article' | 'annotation', id: number) => {
    try {
      await projectService.restoreTrashItem(type, id);
      await loadTrash();
    } catch (err) {
      console.error('Failed to restore item:', err);
    }
  };

  const handlePermanentDelete = async (type: 'project' | 'article' | 'annotation', id: number) => {
    if (confirm('Tem certeza que deseja excluir permanentemente este item? Esta ação não pode ser desfeita.')) {
      try {
        await projectService.deleteTrashItemPermanent(type, id);
        await loadTrash();
      } catch (err) {
        console.error('Failed to delete item permanently:', err);
      }
    }
  };

  const handleEmptyTrash = async () => {
    if (confirm('Tem certeza que deseja esvaziar a lixeira? Todos os itens serão apagados permanentemente.')) {
      try {
        await projectService.emptyTrash();
        await loadTrash();
      } catch (err) {
        console.error('Failed to empty trash:', err);
      }
    }
  };

  const loadAutoBackups = async () => {
    try {
      const list = await projectService.listAutoBackups();
      setAutoBackupsList(list);
    } catch (err) {
      console.error('Failed to load auto backups:', err);
    }
  };

  const handleRestoreAutoBackup = async (filename: string) => {
    if (
      confirm(
        `ATENÇÃO: Isso irá SOBRESCREVER todos os dados atuais (projetos, artigos, PDFs, etc) com o conteúdo do backup automático "${filename}". Todos os dados atuais não salvos em backups serão PERDIDOS permanentemente. O aplicativo será fechado e reiniciado para concluir. Deseja continuar?`,
      )
    ) {
      try {
        const success = await projectService.restoreAutoBackup(filename);
        if (!success) {
          alert('Restauração cancelada.');
        }
      } catch (err) {
        console.error('Failed to restore auto backup:', err);
        alert('Erro ao restaurar backup automático.');
      }
    }
  };

  const handleExportBackup = async () => {
    try {
      const backupPath = await projectService.exportBackup();
      if (backupPath) {
        alert(`Backup completo criado com sucesso em:\n${backupPath}`);
      }
    } catch (err) {
      console.error('Failed to export backup:', err);
      alert('Erro ao criar backup completo.');
    }
  };

  const handleRestoreBackupOverride = async () => {
    if (
      confirm(
        'ATENÇÃO: Isso irá SOBRESCREVER todos os dados atuais (projetos, artigos, PDFs, etc) com as informações do backup. Todos os dados atuais não salvos em backups serão PERDIDOS permanentemente. O aplicativo será fechado e reiniciado para concluir. Deseja continuar?',
      )
    ) {
      try {
        const success = await projectService.restoreBackupOverride();
        if (!success) {
          alert('Restauração cancelada pelo usuário.');
        }
      } catch (err) {
        console.error('Failed to restore backup:', err);
        alert('Erro ao restaurar backup.');
      }
    }
  };

  const handleRestoreBackupMerge = async () => {
    try {
      const count = await projectService.restoreBackupMerge();
      if (count > 0) {
        alert(`${count} projetos novos foram importados e mesclados com sucesso!`);
      } else if (count === 0) {
        alert(
          'Nenhum projeto novo encontrado no backup para importar (todos os projetos já existem no seu banco atual).',
        );
      }
    } catch (err) {
      console.error('Failed to merge backup:', err);
      alert('Erro ao mesclar backup.');
    }
  };

  return (
    <div className="fade-in" style={{ maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2.5rem' }}>
        <div
          style={{
            background: 'var(--color-primary)',
            color: 'white',
            padding: '0.75rem',
            borderRadius: 'var(--radius-lg)',
            display: 'flex',
          }}
        >
          <Settings size={28} />
        </div>
        <h1 style={{ margin: 0, fontSize: '2.5rem' }}>Configurações</h1>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        {/* Theme Section */}
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
                transition: 'all var(--transition-fast)',
              }}
            >
              <Sun size={32} color={theme === 'light' ? 'var(--color-primary)' : 'var(--text-muted)'} />
              <span style={{ fontWeight: 600, color: theme === 'light' ? 'var(--color-primary)' : 'var(--text-main)' }}>
                Modo Claro
              </span>
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
                transition: 'all var(--transition-fast)',
              }}
            >
              <Moon size={32} color={theme === 'dark' ? 'var(--color-primary)' : 'var(--text-muted)'} />
              <span style={{ fontWeight: 600, color: theme === 'dark' ? 'var(--color-primary)' : 'var(--text-main)' }}>
                Modo Escuro
              </span>
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
                { id: 'red', color: '#dc2626', label: 'Vermelho' },
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
                    boxShadow:
                      accent === colorObj.id ? '0 0 0 2px var(--bg-surface), 0 0 0 4px ' + colorObj.color : 'none',
                    transform: accent === colorObj.id ? 'scale(1.1)' : 'scale(1)',
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* API Keys Section */}
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
              <label
                style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: 'var(--text-heading)' }}
              >
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
              <label
                style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: 'var(--text-heading)' }}
              >
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

        {/* AI API Keys Section */}
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
            <Brain size={24} color="var(--color-primary)" /> Integrações de Inteligência Artificial
          </h2>
          <div
            style={{
              padding: '1rem',
              background: 'rgba(234, 179, 8, 0.1)',
              border: '1px solid rgba(234, 179, 8, 0.3)',
              borderRadius: 'var(--radius-md)',
              marginBottom: '2rem',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.75rem',
            }}
          >
            <ShieldAlert size={20} color="var(--color-warning)" style={{ flexShrink: 0, marginTop: '2px' }} />
            <p style={{ margin: 0, color: 'var(--text-main)', fontSize: '0.9rem', lineHeight: 1.5 }}>
              Ao usar funcionalidades de Inteligência Artificial, dados podem ser enviados para provedores externos.
              <br />
              <Link to="/terms" style={{ color: 'var(--color-primary)', fontWeight: 600 }}>
                Leia os Termos de Uso e IA completos aqui.
              </Link>
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div>
              <label
                style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: 'var(--text-heading)' }}
              >
                OpenAI API Key
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
                  value={openaiKey}
                  onChange={(e) => setOpenaiKey(e.target.value)}
                  placeholder="sk-..."
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
              <label
                style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: 'var(--text-heading)' }}
              >
                Google Gemini API Key
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
                  value={geminiKey}
                  onChange={(e) => setGeminiKey(e.target.value)}
                  placeholder="AIza..."
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
              <label
                style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: 'var(--text-heading)' }}
              >
                Anthropic API Key
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
                  value={anthropicKey}
                  onChange={(e) => setAnthropicKey(e.target.value)}
                  placeholder="sk-ant-..."
                  style={{
                    width: '100%',
                    padding: '0.8rem 1rem 0.8rem 2.8rem',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-main)',
                    color: 'var(--text-main)',
                    outline: 'none',
                  }}
                  title="Ex: claude-3-5-sonnet-20240620"
                />
              </div>
            </div>

            <div>
              <label
                style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: 'var(--text-heading)' }}
              >
                Ollama URL (Local){' '}
                <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 'normal' }}>
                  (Ex: http://127.0.0.1:11434/v1)
                </span>
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
                  type="text"
                  value={ollamaUrl}
                  onChange={(e) => setOllamaUrl(e.target.value)}
                  placeholder="http://127.0.0.1:11434/v1"
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
              <label
                style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: 'var(--text-heading)' }}
              >
                Ollama Cloud API Key (Nuvem)
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
                  value={ollamaCloudKey}
                  onChange={(e) => setOllamaCloudKey(e.target.value)}
                  placeholder="Insira sua chave de API Ollama Cloud..."
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

            <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={handleSaveKeys} className="btn-primary" disabled={saving} style={{ minWidth: '150px' }}>
                {saved ? <CheckCircle size={20} /> : <Save size={20} />}
                {saving ? 'Salvando...' : saved ? 'Salvo!' : 'Salvar Chaves'}
              </button>
            </div>

            {/* Advanced AI Settings Section (Moved Inside) */}
            <div style={{ marginTop: '2rem', paddingTop: '2rem', borderTop: '1px solid var(--border-color)' }}>
              <h3 style={{ fontSize: '1.2rem', marginBottom: '0.5rem', color: 'var(--text-heading)' }}>
                Configurações Avançadas por Funcionalidade
              </h3>
              <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
                Personalize qual provedor e modelo devem ser utilizados para cada tipo de funcionalidade.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {aiConfigs.map((conf) => (
                  <div
                    key={conf.skill}
                    style={{
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-md)',
                      padding: '1rem',
                      background: 'var(--bg-main)',
                    }}
                  >
                    <h4
                      style={{
                        margin: '0 0 1rem 0',
                        color: 'var(--text-heading)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                      }}
                    >
                      {conf.skill === 'metadata' && '📄 Extração de Metadados'}
                      {conf.skill === 'summary' && '📝 Geração de Resumos'}
                      {conf.skill === 'extraction' && '🔍 Investigação Massiva (RAG)'}
                      {conf.skill === 'embeddings' && '🧮 Embeddings (Vetorização)'}
                    </h4>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                      <div>
                        <label
                          style={{
                            display: 'block',
                            marginBottom: '0.5rem',
                            fontSize: '0.85rem',
                            fontWeight: 600,
                            color: 'var(--text-muted)',
                          }}
                        >
                          Provedor
                        </label>
                        <select
                          value={conf.provider}
                          onChange={(e) => handleUpdateAiConfig(conf.skill, 'provider', e.target.value as AIProvider)}
                          className="input-field"
                          style={{
                            width: '100%',
                            padding: '0.6rem 0.8rem',
                            borderRadius: 'var(--radius-md)',
                            border: '1px solid var(--border-color)',
                            background: 'var(--bg-surface)',
                            color: 'var(--text-main)',
                            outline: 'none',
                          }}
                        >
                          <option value="gemini">Google Gemini</option>
                          <option value="openai">OpenAI</option>
                          <option value="anthropic">Anthropic</option>
                          <option value="ollama">Ollama (Local)</option>
                          <option value="ollama_cloud">Ollama Cloud (Nuvem)</option>
                        </select>
                      </div>
                      <div>
                        <label
                          style={{
                            display: 'block',
                            marginBottom: '0.5rem',
                            fontSize: '0.85rem',
                            fontWeight: 600,
                            color: 'var(--text-muted)',
                          }}
                        >
                          Modelo
                        </label>
                        <input
                          type="text"
                          value={conf.model_name}
                          onChange={(e) => handleUpdateAiConfig(conf.skill, 'model_name', e.target.value)}
                          className="input-field"
                          style={{
                            width: '100%',
                            padding: '0.6rem 0.8rem',
                            borderRadius: 'var(--radius-md)',
                            border: '1px solid var(--border-color)',
                            background: 'var(--bg-surface)',
                            color: 'var(--text-main)',
                            outline: 'none',
                          }}
                          placeholder="Ex: gemini-2.5-flash"
                        />
                        {getModelSuggestions(conf.skill, conf.provider).length > 0 && (
                          <div
                            style={{
                              marginTop: '0.4rem',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                              flexWrap: 'wrap',
                            }}
                          >
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Sugestões:</span>
                            {getModelSuggestions(conf.skill, conf.provider).map((sug) => (
                              <button
                                key={sug}
                                type="button"
                                onClick={() => handleUpdateAiConfig(conf.skill, 'model_name', sug)}
                                style={{
                                  fontSize: '0.72rem',
                                  padding: '0.15rem 0.45rem',
                                  borderRadius: '12px',
                                  border:
                                    conf.model_name === sug
                                      ? '1px solid var(--primary-color)'
                                      : '1px solid var(--border-color)',
                                  background:
                                    conf.model_name === sug ? 'rgba(99, 102, 241, 0.12)' : 'var(--bg-card)',
                                  color: conf.model_name === sug ? 'var(--primary-color)' : 'var(--text-muted)',
                                  cursor: 'pointer',
                                  fontWeight: conf.model_name === sug ? 600 : 400,
                                }}
                              >
                                {sug}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    {conf.skill === 'embeddings' && (
                      <div
                        style={{
                          marginTop: '0.6rem',
                          padding: '0.66rem 0.9rem',
                          borderRadius: 'var(--radius-md)',
                          background: 'rgba(234, 179, 8, 0.1)',
                          border: '1px solid rgba(234, 179, 8, 0.35)',
                          color: 'var(--text-main)',
                          fontSize: '0.82rem',
                          lineHeight: '1.4',
                        }}
                      >
                        ⚠️ <strong>Aviso de Recomendação:</strong> Atualmente, a funcionalidade de vetorização (Embeddings) funciona melhor e com maior estabilidade utilizando o <strong>Ollama (Local)</strong> ouvindo na porta 11434 com modelos como <code>nomic-embed-text</code>.
                      </div>
                    )}
                  </div>
                ))}

                <div style={{ marginTop: '2rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
                  <h4 style={{ margin: '0 0 1rem 0', color: 'var(--text-heading)' }}>
                    Parâmetros Avançados de RAG (Investigação Massiva)
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                    <div>
                      <label
                        style={{
                          display: 'block',
                          marginBottom: '0.5rem',
                          fontSize: '0.85rem',
                          fontWeight: 600,
                          color: 'var(--text-muted)',
                        }}
                      >
                        Tamanho do Chunk (caracteres)
                      </label>
                      <input
                        type="number"
                        value={ragChunkSize}
                        onChange={(e) => setRagChunkSize(e.target.value)}
                        className="input-field"
                        style={{
                          width: '100%',
                          padding: '0.6rem 0.8rem',
                          borderRadius: 'var(--radius-md)',
                          border: '1px solid var(--border-color)',
                          background: 'var(--bg-surface)',
                          color: 'var(--text-main)',
                          outline: 'none',
                        }}
                      />
                    </div>
                    <div>
                      <label
                        style={{
                          display: 'block',
                          marginBottom: '0.5rem',
                          fontSize: '0.85rem',
                          fontWeight: 600,
                          color: 'var(--text-muted)',
                        }}
                      >
                        Overlap (caracteres)
                      </label>
                      <input
                        type="number"
                        value={ragChunkOverlap}
                        onChange={(e) => setRagChunkOverlap(e.target.value)}
                        className="input-field"
                        style={{
                          width: '100%',
                          padding: '0.6rem 0.8rem',
                          borderRadius: 'var(--radius-md)',
                          border: '1px solid var(--border-color)',
                          background: 'var(--bg-surface)',
                          color: 'var(--text-main)',
                          outline: 'none',
                        }}
                      />
                    </div>
                    <div>
                      <label
                        style={{
                          display: 'block',
                          marginBottom: '0.5rem',
                          fontSize: '0.85rem',
                          fontWeight: 600,
                          color: 'var(--text-muted)',
                        }}
                      >
                        Chunks Recuperados (Top K)
                      </label>
                      <input
                        type="number"
                        value={ragTopK}
                        onChange={(e) => setRagTopK(e.target.value)}
                        className="input-field"
                        style={{
                          width: '100%',
                          padding: '0.6rem 0.8rem',
                          borderRadius: 'var(--radius-md)',
                          border: '1px solid var(--border-color)',
                          background: 'var(--bg-surface)',
                          color: 'var(--text-main)',
                          outline: 'none',
                        }}
                      />
                    </div>
                  </div>
                </div>

                <div
                  style={{ marginTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <button
                    onClick={handleRestoreAiDefaults}
                    className="btn-secondary"
                    style={{ color: 'var(--color-danger)', fontSize: '0.9rem', padding: '0.5rem 1rem' }}
                  >
                    <RotateCcw size={14} style={{ marginRight: '0.4rem' }} /> Restaurar Padrões
                  </button>
                  <button
                    onClick={handleSaveKeys}
                    className="btn-primary"
                    disabled={saving}
                    style={{ minWidth: '150px' }}
                  >
                    {saved ? (
                      <CheckCircle size={18} style={{ marginRight: '0.4rem' }} />
                    ) : (
                      <Save size={18} style={{ marginRight: '0.4rem' }} />
                    )}
                    {saving ? 'Salvando...' : saved ? 'Salvo!' : 'Salvar Configuração'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Backup Settings Section */}
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

        {/* Lixeira Section */}
        <div className="card" style={{ padding: '2rem' }}>
          <h2
            style={{ fontSize: '1.5rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}
          >
            <Trash2 size={24} color="var(--color-danger)" /> Lixeira (Trash Bin)
          </h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
            Itens excluídos permanecem aqui e podem ser recuperados. Excluir permanentemente removerá os dados e os
            arquivos PDF do disco.
          </p>

          {trashItems.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '2rem',
                border: '1px dashed var(--border-color)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-muted)',
              }}
            >
              A lixeira está vazia.
            </div>
          ) : (
            <div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
                <button
                  onClick={handleEmptyTrash}
                  className="btn-danger"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.5rem 1rem',
                    fontSize: '0.9rem',
                  }}
                >
                  <Trash2 size={16} /> Esvaziar Lixeira
                </button>
              </div>

              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem',
                  maxHeight: '300px',
                  overflowY: 'auto',
                  paddingRight: '0.5rem',
                }}
              >
                {trashItems.map((item) => (
                  <div
                    key={`${item.type}-${item.id}`}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '1rem',
                      background: 'var(--bg-main)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-color)',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span
                          style={{
                            fontSize: '0.75rem',
                            textTransform: 'uppercase',
                            fontWeight: 'bold',
                            padding: '0.2rem 0.5rem',
                            borderRadius: '4px',
                            background:
                              item.type === 'project'
                                ? 'rgba(59, 130, 246, 0.1)'
                                : item.type === 'article'
                                  ? 'rgba(16, 185, 129, 0.1)'
                                  : 'rgba(245, 158, 11, 0.1)',
                            color:
                              item.type === 'project' ? '#3b82f6' : item.type === 'article' ? '#10b981' : '#f59e0b',
                          }}
                        >
                          {item.type === 'project' ? 'Projeto' : item.type === 'article' ? 'Artigo' : 'Anotação'}
                        </span>
                        <span style={{ fontWeight: 600, color: 'var(--text-heading)' }}>{item.title}</span>
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                        Excluído em: {new Date(item.deleted_at).toLocaleString()}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        onClick={() => handleRestore(item.type, item.id)}
                        className="btn-secondary"
                        style={{
                          padding: '0.4rem 0.8rem',
                          fontSize: '0.85rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                        }}
                      >
                        <RotateCcw size={14} /> Restaurar
                      </button>
                      <button
                        onClick={() => handlePermanentDelete(item.type, item.id)}
                        className="btn-danger"
                        style={{
                          padding: '0.4rem 0.8rem',
                          fontSize: '0.85rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                        }}
                      >
                        <X size={14} /> Excluir
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* App Info Section */}
        <div style={{ textAlign: 'center', marginTop: '1rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          <p>Emma's Librarian {appVersion ? `v${appVersion}` : ''}</p>
        </div>
      </div>
    </div>
  );
};
