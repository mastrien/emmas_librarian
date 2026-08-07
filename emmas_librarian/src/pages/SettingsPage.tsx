import React, { useState, useEffect } from 'react';
import { Settings } from 'lucide-react';
import { projectService } from '../services/api';
import type { AIModelConfig, AISkill, AIProvider } from '../types';

import { AppearanceSettings } from './Settings/components/AppearanceSettings';
import { ApiKeysSettings } from './Settings/components/ApiKeysSettings';
import { AiSettings } from './Settings/components/AiSettings';
import { BackupSettings } from './Settings/components/BackupSettings';
import { TrashSettings } from './Settings/components/TrashSettings';

export const SettingsPage: React.FC = () => {
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
      if (provider === 'local' || provider === 'llama_cpp') return ['all-MiniLM-L6-v2'];
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
            if (newProvider === 'local' || newProvider === 'llama_cpp') suggestedModel = 'all-MiniLM-L6-v2';
            else if (newProvider === 'gemini') suggestedModel = 'text-embedding-004';
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
        <AppearanceSettings />

        <ApiKeysSettings
          scopusKey={scopusKey}
          setScopusKey={setScopusKey}
          wosKey={wosKey}
          setWosKey={setWosKey}
        />

        <AiSettings
          openaiKey={openaiKey}
          setOpenaiKey={setOpenaiKey}
          geminiKey={geminiKey}
          setGeminiKey={setGeminiKey}
          anthropicKey={anthropicKey}
          setAnthropicKey={setAnthropicKey}
          ollamaUrl={ollamaUrl}
          setOllamaUrl={setOllamaUrl}
          ollamaCloudKey={ollamaCloudKey}
          setOllamaCloudKey={setOllamaCloudKey}
          aiConfigs={aiConfigs}
          handleUpdateAiConfig={handleUpdateAiConfig}
          getModelSuggestions={getModelSuggestions}
          ragChunkSize={ragChunkSize}
          setRagChunkSize={setRagChunkSize}
          ragChunkOverlap={ragChunkOverlap}
          setRagChunkOverlap={setRagChunkOverlap}
          ragTopK={ragTopK}
          setRagTopK={setRagTopK}
          handleRestoreAiDefaults={handleRestoreAiDefaults}
          handleSaveKeys={handleSaveKeys}
          saving={saving}
          saved={saved}
        />

        <BackupSettings
          autoBackups={autoBackups}
          handleToggleAutoBackups={handleToggleAutoBackups}
          autoBackupsList={autoBackupsList}
          handleExportBackup={handleExportBackup}
          handleRestoreBackupOverride={handleRestoreBackupOverride}
          handleRestoreBackupMerge={handleRestoreBackupMerge}
          handleRestoreAutoBackup={handleRestoreAutoBackup}
        />

        <TrashSettings
          trashItems={trashItems}
          handleEmptyTrash={handleEmptyTrash}
          handleRestore={handleRestore}
          handlePermanentDelete={handlePermanentDelete}
        />

        {/* App Info Section */}
        <div style={{ textAlign: 'center', marginTop: '1rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          <p>Emma's Librarian {appVersion ? `v${appVersion}` : ''}</p>
        </div>
      </div>
    </div>
  );
};
