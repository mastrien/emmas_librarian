import React from 'react';
import type { AIModelConfig, AISkill, AIProvider } from '../../../../types';
import { MULTILINGUAL_LOCAL_MODEL } from '../../aiModelSuggestions';
import { ExperimentalTag } from '../../../../components/common/ExperimentalTag';

const SKILL_TITLES: Record<AISkill, string> = {
  metadata: 'Extração de metadados',
  summary: 'Geração de resumos',
  // The investigation became a page named "Investigação com IA" (#73); the row says the same.
  extraction: 'Investigação com IA',
  embeddings: 'Vetores (embeddings)',
  screening: 'Sugestão de triagem',
};

const PROVIDERS: [AIProvider, string][] = [
  ['local', 'Local embutido (ONNX)'],
  ['gemini', 'Google Gemini'],
  ['openai', 'OpenAI'],
  ['anthropic', 'Anthropic'],
  ['ollama', 'Ollama (local)'],
  ['ollama_cloud', 'Ollama Cloud'],
];

const RECOMMENDED_EMBEDDINGS_MODEL = 'nomic-embed-text';

type UpdateAiConfig = (skill: AISkill, field: 'provider' | 'model_name', value: string) => void;

interface AiTaskTableProps {
  configs: AIModelConfig[];
  getModelSuggestions: (skill: AISkill, provider: AIProvider) => string[];
  onUpdate: UpdateAiConfig;
}

/**
 * Whether the vector task already runs on what the app recommends (the board's "rec." badge).
 *
 * @example isRecommendedEmbedding({ skill: 'embeddings', provider: 'ollama', model_name: 'nomic-embed-text' } as AIModelConfig) // true
 */
export function isRecommendedEmbedding(config: AIModelConfig): boolean {
  return (
    config.skill === 'embeddings' && config.provider === 'ollama' && config.model_name === RECOMMENDED_EMBEDDINGS_MODEL
  );
}

const ProviderSelect: React.FC<{ config: AIModelConfig; title: string; onUpdate: UpdateAiConfig }> = (props) => (
  <select
    aria-label={`Provedor: ${props.title}`}
    value={props.config.provider}
    onChange={(e) => props.onUpdate(props.config.skill, 'provider', e.target.value)}
    className="input-field ai-task__field"
  >
    {PROVIDERS.map(([value, label]) => (
      <option key={value} value={value}>
        {label}
      </option>
    ))}
  </select>
);

const TaskRow: React.FC<{ config: AIModelConfig; suggestions: string[]; onUpdate: UpdateAiConfig }> = (props) => {
  const { config, suggestions, onUpdate } = props;
  const title = SKILL_TITLES[config.skill];
  const listId = `models-${config.skill}`;
  return (
    <tr>
      <td className="ai-task__name">{title}</td>
      <td>
        <ProviderSelect config={config} title={title} onUpdate={onUpdate} />
      </td>
      <td>
        <input
          type="text"
          list={listId}
          aria-label={`Modelo: ${title}`}
          value={config.model_name}
          onChange={(e) => onUpdate(config.skill, 'model_name', e.target.value)}
          className="input-field ai-task__field ai-task__model"
          placeholder="Ex: gemini-2.5-flash"
        />
        <datalist id={listId}>
          {suggestions.map((model) => (
            <option key={model} value={model} />
          ))}
        </datalist>
      </td>
      <td>
        {isRecommendedEmbedding(config) && (
          <span className="ai-badge ai-badge--acc" title="Recomendado">
            rec.
          </span>
        )}
      </td>
    </tr>
  );
};

const EmbeddingsNotes: React.FC<{ config?: AIModelConfig }> = ({ config }) => {
  if (!config) return null;
  return (
    <>
      {!isRecommendedEmbedding(config) && (
        <div className="ai-recommendation">
          <strong>Recomendação:</strong> os vetores funcionam melhor e com mais estabilidade com o{' '}
          <strong>Ollama (local)</strong> na porta 11434 e modelos como <code>{RECOMMENDED_EMBEDDINGS_MODEL}</code>.
        </div>
      )}
      {config.provider === 'local' && config.model_name === MULTILINGUAL_LOCAL_MODEL && (
        <p role="note" className="ai-note">
          <ExperimentalTag reason="O download e a qualidade em português ainda não foram testados com dados reais." />{' '}
          Baixa cerca de 118 MB no primeiro uso e lê até 128 tokens de cada texto, então resumos longos são cortados.
        </p>
      )}
    </>
  );
};

/**
 * "Por tarefa" (board 170): one row per AI task with its provider and model. The model field takes any name and
 * suggests the known ones of the chosen provider.
 *
 * @example <AiTaskTable configs={aiConfigs} getModelSuggestions={suggest} onUpdate={update} />
 */
export const AiTaskTable: React.FC<AiTaskTableProps> = ({ configs, getModelSuggestions, onUpdate }) => (
  <>
    <table className="ai-tasks">
      <thead>
        <tr>
          <th>Tarefa</th>
          <th>Provedor</th>
          <th>Modelo</th>
          <th />
        </tr>
      </thead>
      <tbody>
        {configs.map((config) => (
          <TaskRow
            key={config.skill}
            config={config}
            suggestions={getModelSuggestions(config.skill, config.provider)}
            onUpdate={onUpdate}
          />
        ))}
      </tbody>
    </table>
    <span className="ai-hint">
      O seletor de modelo sugere os modelos conhecidos de cada provedor e aceita qualquer nome.
    </span>
    <EmbeddingsNotes config={configs.find((c) => c.skill === 'embeddings')} />
  </>
);
