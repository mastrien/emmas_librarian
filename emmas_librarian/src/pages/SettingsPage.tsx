import React, { useState, useEffect } from 'react';
import { Settings } from 'lucide-react';
import { useProjectService } from '../contexts/ServicesContext';
import type { AIModelConfig, AISkill, AIProvider, UpdateStatusResponse } from '../types';

import { AppearanceSettings } from './Settings/components/AppearanceSettings';
import { ApiKeysSettings } from './Settings/components/ApiKeysSettings';
import { AiSettings } from './Settings/components/AiSettings';
import { BackupSettings } from './Settings/components/BackupSettings';
import { UpdateSettings, describeSnapshotDate } from './Settings/components/UpdateSettings';
import { TrashSettings } from './Settings/components/TrashSettings';
import { modelSuggestions, suggestedModelFor } from './Settings/aiModelSuggestions';
import { TYPING_DELAY_MS, useSettingsAutosave } from './Settings/useSettingsAutosave';
import { AutosaveNotice } from './Settings/components/AutosaveNotice';

export const SettingsPage: React.FC = () => {
  const projectService = useProjectService();
  const [scopusKey, setScopusKey] = useState('');
  const [wosKey, setWosKey] = useState('');
  const [openAlexKey, setOpenAlexKey] = useState('');
  const [ieeeKey, setIeeeKey] = useState('');

  const [openaiKey, setOpenaiKey] = useState('');
  const [anthropicKey, setAnthropicKey] = useState('');
  const [geminiKey, setGeminiKey] = useState('');
  const [ollamaUrl, setOllamaUrl] = useState('');
  const [ollamaCloudKey, setOllamaCloudKey] = useState('');

  const autosave = useSettingsAutosave();
  const [appVersion, setAppVersion] = useState('');
  const [aiConfigs, setAiConfigs] = useState<AIModelConfig[]>([]);

  const [ragChunkSize, setRagChunkSize] = useState('1000');
  const [ragChunkOverlap, setRagChunkOverlap] = useState('200');
  const [ragTopK, setRagTopK] = useState('10');

  const [autoBackups, setAutoBackups] = useState(true);
  const [trashItems, setTrashItems] = useState<any[]>([]);
  const [autoBackupsList, setAutoBackupsList] = useState<{ filename: string; date: string; sizeBytes: number }[]>([]);
  const [updateStatus, setUpdateStatus] = useState<UpdateStatusResponse>({
    status: 'idle',
    updateInfo: null,
    downloadProgress: null,
    error: null,
    state: null,
  });

  useEffect(() => {
    projectService.getUpdateStatus().then(setUpdateStatus).catch(console.error);
    const unsubStatus = projectService.onUpdateStatusChange(setUpdateStatus);
    const unsubProgress = projectService.onUpdateDownloadProgress((progress) => {
      setUpdateStatus((prev) => ({ ...prev, downloadProgress: progress }));
    });
    return () => {
      unsubStatus();
      unsubProgress();
    };
  }, [projectService]);

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
      const oaKey = await projectService.getSetting('openalex_api_key');
      const ieKey = await projectService.getSetting('ieee_api_key');
      const oKey = await projectService.getSetting('api_key_openai');
      const aKey = await projectService.getSetting('api_key_anthropic');
      const gKey = await projectService.getSetting('api_key_gemini');
      const olUrl = await projectService.getSetting('api_key_ollama');
      const olCloudKey = await projectService.getSetting('api_key_ollama_cloud');
      const backupsEnabledSetting = await projectService.getSetting('enable_auto_backups');
      const rSize = await projectService.getSetting('rag_chunk_size');
      const rOverlap = await projectService.getSetting('rag_chunk_overlap');
      const rTopK = await projectService.getSetting('rag_top_k');

      if (sKey) setScopusKey(sKey);
      if (wKey) setWosKey(wKey);
      if (oaKey) setOpenAlexKey(oaKey);
      if (ieKey) setIeeeKey(ieKey);
      if (oKey) setOpenaiKey(oKey);
      if (aKey) setAnthropicKey(aKey);
      if (gKey) setGeminiKey(gKey);
      if (olUrl) setOllamaUrl(olUrl);
      if (olCloudKey) setOllamaCloudKey(olCloudKey);
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

  // Every setting saves on its own as it changes; there is no "Salvar" to forget (validation of epic #44).
  const bind = (key: string, setter: (value: string) => void) => (value: string) => {
    setter(value);
    autosave.schedule(key, () => projectService.setSetting(key, value));
  };

  const handleRestoreAiDefaults = async () => {
    if (confirm('Restaurar as configurações avançadas de IA para os padrões originais?')) {
      autosave.cancel('ai_model:');
      await projectService.restoreAiModelConfigDefaults();
      const configs = await projectService.getAiModelConfigs();
      setAiConfigs(configs);
    }
  };

  // A provider is a choice and saves at once; a model name is typed and waits for the pause.
  const handleUpdateAiConfig = (skill: AISkill, field: 'provider' | 'model_name', value: string) => {
    const next = aiConfigs.map((c) => {
      if (c.skill !== skill) return c;
      if (field === 'provider') {
        const newProvider = value as AIProvider;
        return { ...c, provider: newProvider, model_name: suggestedModelFor(skill, newProvider, c.model_name) };
      }
      return { ...c, [field]: value };
    });
    setAiConfigs(next);
    const changed = next.find((c) => c.skill === skill);
    if (!changed) return;
    autosave.schedule(
      `ai_model:${skill}`,
      () => projectService.updateAiModelConfig(changed.skill, changed.provider, changed.model_name),
      field === 'provider' ? 0 : TYPING_DELAY_MS,
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
        `ATENÇÃO: Isso irá SOBRESCREVER o banco de dados atual (projetos, artigos, anotações, diário) com o backup automático "${filename}". Tudo o que foi feito depois dessa data será PERDIDO permanentemente. Os PDFs e documentos guardados não são alterados. O aplicativo será fechado e reiniciado para concluir. Deseja continuar?`,
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
      if (count === 1) {
        alert('1 projeto novo foi importado e mesclado com sucesso!');
      } else if (count !== null && count > 1) {
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

  const handleCheckUpdates = async () => {
    await projectService.checkForUpdates();
    const status = await projectService.getUpdateStatus();
    setUpdateStatus(status);
  };

  const handleDownloadUpdate = async () => {
    await projectService.downloadUpdate();
  };

  const handleInstallUpdate = async () => {
    await projectService.installUpdate();
  };

  // The main process restarts the app after restoring, so nothing runs after the call.
  const handleRestoreSnapshot = async () => {
    const takenAt = describeSnapshotDate(updateStatus.state?.timestamp);
    const question = `Voltar a biblioteca para como estava em ${takenAt}? O banco atual é guardado em backups/ antes, e o app reinicia.`;
    if (!confirm(question)) return;
    await projectService.restoreUpdateSnapshot();
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
        <AutosaveNotice status={autosave.status} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        <AppearanceSettings />

        <ApiKeysSettings
          scopusKey={scopusKey}
          setScopusKey={bind('scopus_api_key', setScopusKey)}
          wosKey={wosKey}
          setWosKey={bind('wos_api_key', setWosKey)}
          openAlexKey={openAlexKey}
          setOpenAlexKey={bind('openalex_api_key', setOpenAlexKey)}
          ieeeKey={ieeeKey}
          setIeeeKey={bind('ieee_api_key', setIeeeKey)}
        />

        <AiSettings
          openaiKey={openaiKey}
          setOpenaiKey={bind('api_key_openai', setOpenaiKey)}
          geminiKey={geminiKey}
          setGeminiKey={bind('api_key_gemini', setGeminiKey)}
          anthropicKey={anthropicKey}
          setAnthropicKey={bind('api_key_anthropic', setAnthropicKey)}
          ollamaUrl={ollamaUrl}
          setOllamaUrl={bind('api_key_ollama', setOllamaUrl)}
          ollamaCloudKey={ollamaCloudKey}
          setOllamaCloudKey={bind('api_key_ollama_cloud', setOllamaCloudKey)}
          aiConfigs={aiConfigs}
          handleUpdateAiConfig={handleUpdateAiConfig}
          getModelSuggestions={modelSuggestions}
          ragChunkSize={ragChunkSize}
          setRagChunkSize={bind('rag_chunk_size', setRagChunkSize)}
          ragChunkOverlap={ragChunkOverlap}
          setRagChunkOverlap={bind('rag_chunk_overlap', setRagChunkOverlap)}
          ragTopK={ragTopK}
          setRagTopK={bind('rag_top_k', setRagTopK)}
          handleRestoreAiDefaults={handleRestoreAiDefaults}
          autosaveStatus={autosave.status}
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

        <UpdateSettings
          currentVersion={appVersion}
          updateStatus={updateStatus}
          onCheckForUpdates={handleCheckUpdates}
          onDownloadUpdate={handleDownloadUpdate}
          onInstallUpdate={handleInstallUpdate}
          onRestoreSnapshot={handleRestoreSnapshot}
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
