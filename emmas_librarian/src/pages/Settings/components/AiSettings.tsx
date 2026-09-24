import React from 'react';
import { Brain, ShieldAlert, RotateCcw } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { AIModelConfig, AISkill, AIProvider } from '../../../types';
import { KeyField, NumberSetting, SaveSettingsButton } from './ai/AiSettingsFields';
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
  handleSaveKeys: () => void;
  saving: boolean;
  saved: boolean;
}

/**
 * AI settings: provider credentials, per-feature provider/model choice and RAG parameters.
 *
 * Usage:
 *   <AiSettings openaiKey={k} setOpenaiKey={setK} ... saving={saving} saved={saved} />
 */
export const AiSettings: React.FC<AiSettingsProps> = (props) => (
  <div className="card" style={{ padding: '2rem' }}>
    <h2 style={{ fontSize: '1.5rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
      <Brain size={24} color="var(--color-primary)" /> Integrações de Inteligência Artificial
    </h2>
    <DataSharingNotice />
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <ProviderKeys {...props} />
      <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
        <SaveSettingsButton
          onClick={props.handleSaveKeys}
          saving={props.saving}
          saved={props.saved}
          idleLabel="Salvar Chaves"
          iconSize={20}
        />
      </div>
      <AdvancedAiSettings {...props} />
    </div>
  </div>
);

const DataSharingNotice: React.FC = () => (
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
      title="Ex: claude-3-5-sonnet-20240620"
    />
    <KeyField
      label={
        <>
          Ollama URL (Local){' '}
          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 'normal' }}>
            (Ex: http://127.0.0.1:11434/v1)
          </span>
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
  <div style={{ marginTop: '2rem', paddingTop: '2rem', borderTop: '1px solid var(--border-color)' }}>
    <h3 style={{ fontSize: '1.2rem', marginBottom: '0.5rem', color: 'var(--text-heading)' }}>
      Configurações Avançadas por Funcionalidade
    </h3>
    <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
      Personalize qual provedor e modelo devem ser utilizados para cada tipo de funcionalidade.
    </p>
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {props.aiConfigs.map((config) => (
        <AiSkillCard
          key={config.skill}
          config={config}
          suggestions={props.getModelSuggestions(config.skill, config.provider)}
          onUpdate={props.handleUpdateAiConfig}
        />
      ))}
      <div style={{ marginTop: '2rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
        <h4 style={{ margin: '0 0 1rem 0', color: 'var(--text-heading)' }}>
          Parâmetros Avançados de RAG (Investigação Massiva)
        </h4>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
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
      <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button
          onClick={props.handleRestoreAiDefaults}
          className="btn-secondary"
          style={{ color: 'var(--color-danger)', fontSize: '0.9rem', padding: '0.5rem 1rem' }}
        >
          <RotateCcw size={14} style={{ marginRight: '0.4rem' }} /> Restaurar Padrões
        </button>
        <SaveSettingsButton
          onClick={props.handleSaveKeys}
          saving={props.saving}
          saved={props.saved}
          idleLabel="Salvar Configuração"
          iconSize={18}
          iconStyle={{ marginRight: '0.4rem' }}
        />
      </div>
    </div>
  </div>
);
