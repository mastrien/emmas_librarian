import React from 'react';
import { Brain, ShieldAlert, RotateCcw } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { AIModelConfig, AISkill, AIProvider } from '../../../types';
import { NumberSetting } from './ai/AiSettingsFields';
import { KeyField } from './KeyField';
import { SettingsCard } from './SettingsCard';
import './ai/aiSettings.css';
import type { AutosaveStatus } from '../useSettingsAutosave';
import { AiSkillCard } from './ai/AiSkillCard';

interface AiSettingsProps {
  openaiKey: string;
  setOpenaiKey: (v: string) => void;
  geminiKey: string;
  setGeminiKey: (v: string) => void;
  anthropicKey: string;
  setAnthropicKey: (v: string) => void;
  ollamaUrl: string;
  setOllamaUrl: (v: string) => void;
  ollamaCloudKey: string;
  setOllamaCloudKey: (v: string) => void;
  aiConfigs: AIModelConfig[];
  handleUpdateAiConfig: (skill: AISkill, field: 'provider' | 'model_name', value: string) => void;
  getModelSuggestions: (skill: AISkill, provider: AIProvider) => string[];
  ragChunkSize: string;
  setRagChunkSize: (v: string) => void;
  ragChunkOverlap: string;
  setRagChunkOverlap: (v: string) => void;
  ragTopK: string;
  setRagTopK: (v: string) => void;
  handleRestoreAiDefaults: () => void;
  /** Settings save on their own; the page shows this status at the top. */
  autosaveStatus: AutosaveStatus;
}

/**
 * AI settings: provider credentials, per-feature provider/model choice and RAG parameters.
 *
 * Usage:
 *   <AiSettings openaiKey={k} setOpenaiKey={setK} ... autosaveStatus={autosave.status} />
 */
export const AiSettings: React.FC<AiSettingsProps> = (props) => (
  <SettingsCard title="Integrações de Inteligência Artificial" icon={<Brain size={24} />} spacing="wide">
    <DataSharingNotice />
    <div className="settings-stack settings-stack--wide">
      <ProviderKeys {...props} />
      <AdvancedAiSettings {...props} />
    </div>
  </SettingsCard>
);

const DataSharingNotice: React.FC = () => (
  <div className="ai-sharing-notice">
    <ShieldAlert size={20} className="ai-sharing-icon" />
    <p className="ai-sharing-text">
      Ao usar funcionalidades de Inteligência Artificial, dados podem ser enviados para provedores externos.
      <br />
      <Link to="/terms">Leia os Termos de Uso e IA completos aqui.</Link>
    </p>
  </div>
);

const ProviderKeys: React.FC<AiSettingsProps> = (props) => (
  <>
    <KeyField label="OpenAI API Key" value={props.openaiKey} onChange={props.setOpenaiKey} placeholder="sk-..." />
    <KeyField
      label="Google Gemini API Key"
      value={props.geminiKey}
      onChange={props.setGeminiKey}
      placeholder="AIza..."
    />
    <KeyField
      label="Anthropic API Key"
      value={props.anthropicKey}
      onChange={props.setAnthropicKey}
      placeholder="sk-ant-..."
      title="Ex: claude-sonnet-5"
    />
    <KeyField
      label={
        <>
          Ollama URL (Local) <span className="settings-label-aside">(Ex: http://127.0.0.1:11434/v1)</span>
        </>
      }
      value={props.ollamaUrl}
      onChange={props.setOllamaUrl}
      placeholder="http://127.0.0.1:11434/v1"
      secret={false}
    />
    <KeyField
      label="Ollama Cloud API Key (Nuvem)"
      value={props.ollamaCloudKey}
      onChange={props.setOllamaCloudKey}
      placeholder="Insira sua chave de API Ollama Cloud..."
    />
  </>
);

const AdvancedAiSettings: React.FC<AiSettingsProps> = (props) => (
  <div className="ai-advanced">
    <h3>Configurações Avançadas por Funcionalidade</h3>
    <p className="ai-advanced-text">
      Personalize qual provedor e modelo devem ser utilizados para cada tipo de funcionalidade.
    </p>
    <div className="settings-stack">
      {props.aiConfigs.map((config) => (
        <AiSkillCard
          key={config.skill}
          config={config}
          suggestions={props.getModelSuggestions(config.skill, config.provider)}
          onUpdate={props.handleUpdateAiConfig}
        />
      ))}
      <div className="ai-rag">
        <h4>Parâmetros Avançados de RAG (Investigação com IA)</h4>
        <div className="ai-rag-grid">
          <NumberSetting
            label="Tamanho do Chunk (caracteres)"
            value={props.ragChunkSize}
            onChange={props.setRagChunkSize}
          />
          <NumberSetting
            label="Overlap (caracteres)"
            value={props.ragChunkOverlap}
            onChange={props.setRagChunkOverlap}
          />
          <NumberSetting label="Chunks Recuperados (Top K)" value={props.ragTopK} onChange={props.setRagTopK} />
        </div>
      </div>
      <div className="ai-footer">
        <button onClick={props.handleRestoreAiDefaults} className="btn-secondary ai-restore-button">
          <RotateCcw size={14} /> Restaurar Padrões
        </button>
      </div>
    </div>
  </div>
);
