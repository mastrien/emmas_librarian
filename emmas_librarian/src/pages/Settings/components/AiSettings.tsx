import React from 'react';
import { RotateCcw, ShieldAlert } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { AIModelConfig, AISkill, AIProvider } from '../../../types';
import { NumberSetting } from './ai/AiSettingsFields';
import { SettingsCard } from './SettingsCard';
import { ProviderRow } from './ai/ProviderRows';
import { AiTaskTable } from './ai/AiTaskTable';
import './ai/aiSettings.css';
import type { AutosaveStatus } from '../useSettingsAutosave';

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
 * AI settings (board 170): the notice about the cloud, the providers with their keys, the provider and model of
 * each task, and the RAG numbers folded away under "Avançado".
 *
 * Usage:
 *   <AiSettings openaiKey={k} setOpenaiKey={setK} ... autosaveStatus={autosave.status} />
 */
export const AiSettings: React.FC<AiSettingsProps> = (props) => (
  <SettingsCard title="Inteligência artificial" spacing="wide">
    <DataSharingNotice />
    <div className="settings-stack settings-stack--wide">
      <section className="ai-section" aria-label="Provedores">
        <h2 className="ai-section__title">Provedores</h2>
        <ProviderKeys {...props} />
      </section>
      <section className="ai-section" aria-label="Por tarefa">
        <h2 className="ai-section__title">Por tarefa</h2>
        <AiTaskTable
          configs={props.aiConfigs}
          getModelSuggestions={props.getModelSuggestions}
          onUpdate={props.handleUpdateAiConfig}
        />
      </section>
      <RagSettings {...props} />
    </div>
  </SettingsCard>
);

const DataSharingNotice: React.FC = () => (
  <div className="ai-sharing-notice">
    <ShieldAlert size={16} className="ai-sharing-icon" />
    <p className="ai-sharing-text">
      Com provedores na nuvem, título, resumo e trechos dos PDFs saem do computador.{' '}
      <Link to="/terms">Termos de uso e IA</Link>
    </p>
  </div>
);

const ProviderKeys: React.FC<AiSettingsProps> = (props) => (
  <>
    <ProviderRow name="OpenAI" value={props.openaiKey} onChange={props.setOpenaiKey} placeholder="sk-..." />
    <ProviderRow name="Google Gemini" value={props.geminiKey} onChange={props.setGeminiKey} placeholder="AIza..." />
    <ProviderRow
      name="Anthropic"
      value={props.anthropicKey}
      onChange={props.setAnthropicKey}
      placeholder="sk-ant-..."
      title="Ex: claude-sonnet-5"
    />
    <ProviderRow
      name="Ollama (local)"
      value={props.ollamaUrl}
      onChange={props.setOllamaUrl}
      placeholder="http://127.0.0.1:11434/v1"
      secret={false}
    />
    <ProviderRow
      name="Ollama Cloud"
      value={props.ollamaCloudKey}
      onChange={props.setOllamaCloudKey}
      placeholder="Insira sua chave de API Ollama Cloud..."
    />
  </>
);

const RagSettings: React.FC<AiSettingsProps> = (props) => (
  <details className="ai-rag">
    <summary>
      <span className="ai-rag__title">Avançado: busca nos PDFs (RAG)</span>
      <span className="ai-rag__summary">
        trecho {props.ragChunkSize} · sobreposição {props.ragChunkOverlap} · {props.ragTopK} trechos
      </span>
    </summary>
    <div className="ai-rag-grid">
      <NumberSetting
        label="Tamanho do trecho (caracteres)"
        value={props.ragChunkSize}
        onChange={props.setRagChunkSize}
      />
      <NumberSetting
        label="Sobreposição (caracteres)"
        value={props.ragChunkOverlap}
        onChange={props.setRagChunkOverlap}
      />
      <NumberSetting label="Trechos recuperados (Top K)" value={props.ragTopK} onChange={props.setRagTopK} />
    </div>
    <div className="ai-footer">
      <button onClick={props.handleRestoreAiDefaults} className="btn-secondary ai-restore-button">
        <RotateCcw size={14} /> Restaurar Padrões
      </button>
    </div>
  </details>
);
