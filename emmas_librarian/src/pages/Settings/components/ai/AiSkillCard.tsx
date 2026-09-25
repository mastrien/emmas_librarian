import React from 'react';
import type { AIModelConfig, AISkill, AIProvider } from '../../../../types';
import { smallLabelStyle, settingsInputStyle } from './AiSettingsFields';

const SKILL_TITLES: Record<AISkill, string> = {
  metadata: '📄 Extração de Metadados',
  summary: '📝 Geração de Resumos',
  extraction: '🔍 Investigação Massiva (RAG)',
  embeddings: '🧮 Embeddings (Vetorização)',
};

const PROVIDERS: [AIProvider, string][] = [
  ['local', 'Local Embutido (ONNX)'],
  ['gemini', 'Google Gemini'],
  ['openai', 'OpenAI'],
  ['anthropic', 'Anthropic'],
  ['ollama', 'Ollama (Local)'],
  ['ollama_cloud', 'Ollama Cloud (Nuvem)'],
];

interface AiSkillCardProps {
  config: AIModelConfig;
  suggestions: string[];
  onUpdate: (skill: AISkill, field: 'provider' | 'model_name', value: string) => void;
}

/**
 * Provider and model choice for one AI feature, with one-click model suggestions.
 *
 * Usage:
 *   <AiSkillCard config={conf} suggestions={getModelSuggestions(conf.skill, conf.provider)} onUpdate={update} />
 */
export const AiSkillCard: React.FC<AiSkillCardProps> = ({ config, suggestions, onUpdate }) => (
  <div
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
      {SKILL_TITLES[config.skill]}
    </h4>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
      <div>
        <label style={smallLabelStyle}>Provedor</label>
        <select
          value={config.provider}
          onChange={(e) => onUpdate(config.skill, 'provider', e.target.value)}
          className="input-field"
          style={settingsInputStyle}
        >
          {PROVIDERS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label style={smallLabelStyle}>Modelo</label>
        <input
          type="text"
          value={config.model_name}
          onChange={(e) => onUpdate(config.skill, 'model_name', e.target.value)}
          className="input-field"
          style={settingsInputStyle}
          placeholder="Ex: gemini-2.5-flash"
        />
        <ModelSuggestions
          current={config.model_name}
          suggestions={suggestions}
          onPick={(model) => onUpdate(config.skill, 'model_name', model)}
        />
      </div>
    </div>
    {config.skill === 'embeddings' && <EmbeddingsRecommendation />}
  </div>
);

const ModelSuggestions: React.FC<{ current: string; suggestions: string[]; onPick: (model: string) => void }> = ({
  current,
  suggestions,
  onPick,
}) => {
  if (suggestions.length === 0) return null;
  return (
    <div style={{ marginTop: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Sugestões:</span>
      {suggestions.map((model) => {
        const isCurrent = current === model;
        return (
          <button
            key={model}
            type="button"
            onClick={() => onPick(model)}
            style={{
              fontSize: '0.72rem',
              padding: '0.15rem 0.45rem',
              borderRadius: '12px',
              border: isCurrent ? '1px solid var(--primary-color)' : '1px solid var(--border-color)',
              background: isCurrent ? 'rgba(99, 102, 241, 0.12)' : 'var(--bg-card)',
              color: isCurrent ? 'var(--primary-color)' : 'var(--text-muted)',
              cursor: 'pointer',
              fontWeight: isCurrent ? 600 : 400,
            }}
          >
            {model}
          </button>
        );
      })}
    </div>
  );
};

const EmbeddingsRecommendation: React.FC = () => (
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
    ⚠️ <strong>Aviso de Recomendação:</strong> Atualmente, a funcionalidade de vetorização (Embeddings) funciona melhor
    e com maior estabilidade utilizando o <strong>Ollama (Local)</strong> ouvindo na porta 11434 com modelos como{' '}
    <code>nomic-embed-text</code>.
  </div>
);
