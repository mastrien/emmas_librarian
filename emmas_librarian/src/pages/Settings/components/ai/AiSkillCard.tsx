import React from 'react';
import type { AIModelConfig, AISkill, AIProvider } from '../../../../types';
import { MULTILINGUAL_LOCAL_MODEL } from '../../aiModelSuggestions';
import { ExperimentalTag } from '../../../../components/common/ExperimentalTag';
import './aiSettings.css';

const SKILL_TITLES: Record<AISkill, string> = {
  metadata: '📄 Extração de Metadados',
  summary: '📝 Geração de Resumos',
  // The investigation became a page named "Investigação com IA" (#73); the card says the same.
  extraction: '🔍 Investigação com IA',
  embeddings: '🧮 Embeddings (Vetorização)',
  screening: '🧭 Sugestão de triagem',
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
  <div className="ai-skill">
    <h4>{SKILL_TITLES[config.skill]}</h4>
    <div className="ai-skill-grid">
      <div>
        <label className="settings-small-label">Provedor</label>
        <select
          aria-label={`Provedor: ${SKILL_TITLES[config.skill]}`}
          value={config.provider}
          onChange={(e) => onUpdate(config.skill, 'provider', e.target.value)}
          className="input-field settings-input"
        >
          {PROVIDERS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="settings-small-label">Modelo</label>
        <input
          type="text"
          aria-label={`Modelo: ${SKILL_TITLES[config.skill]}`}
          value={config.model_name}
          onChange={(e) => onUpdate(config.skill, 'model_name', e.target.value)}
          className="input-field settings-input"
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
    {config.skill === 'embeddings' && config.provider === 'local' && config.model_name === MULTILINGUAL_LOCAL_MODEL && (
      <p role="note" className="ai-note">
        <ExperimentalTag reason="O download e a qualidade em português ainda não foram testados com dados reais." />{' '}
        Baixa cerca de 118 MB no primeiro uso e lê até 128 tokens de cada texto, então resumos longos são cortados.
      </p>
    )}
  </div>
);

const ModelSuggestions: React.FC<{ current: string; suggestions: string[]; onPick: (model: string) => void }> = ({
  current,
  suggestions,
  onPick,
}) => {
  if (suggestions.length === 0) return null;
  return (
    <div className="model-suggestions">
      <span className="model-suggestions-label">Sugestões:</span>
      {suggestions.map((model) => (
        <button
          key={model}
          type="button"
          className="model-chip"
          aria-pressed={current === model}
          onClick={() => onPick(model)}
        >
          {model}
        </button>
      ))}
    </div>
  );
};

const EmbeddingsRecommendation: React.FC = () => (
  <div className="ai-recommendation">
    ⚠️ <strong>Aviso de Recomendação:</strong> Atualmente, a funcionalidade de vetorização (Embeddings) funciona melhor
    e com maior estabilidade utilizando o <strong>Ollama (Local)</strong> ouvindo na porta 11434 com modelos como{' '}
    <code>nomic-embed-text</code>.
  </div>
);
