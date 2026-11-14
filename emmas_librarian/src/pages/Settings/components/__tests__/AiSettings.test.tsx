import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AiSettings } from '../AiSettings';
import { isRecommendedEmbedding } from '../ai/AiTaskTable';
import { providerBadge } from '../ai/ProviderRows';
import type { AIModelConfig, AISkill, AIProvider } from '../../../../types';

type Props = React.ComponentProps<typeof AiSettings>;

const config = (skill: AISkill, provider: AIProvider, model_name: string): AIModelConfig => ({
  id: 0,
  skill,
  provider,
  model_name,
  updated_at: '',
});

function renderSettings(overrides: Partial<Props> = {}) {
  const props: Props = {
    openaiKey: 'sk-1',
    setOpenaiKey: vi.fn(),
    geminiKey: 'AIza-1',
    setGeminiKey: vi.fn(),
    anthropicKey: 'sk-ant-1',
    setAnthropicKey: vi.fn(),
    ollamaUrl: 'http://127.0.0.1:11434/v1',
    setOllamaUrl: vi.fn(),
    ollamaCloudKey: 'oc-1',
    setOllamaCloudKey: vi.fn(),
    aiConfigs: [],
    handleUpdateAiConfig: vi.fn(),
    getModelSuggestions: vi.fn(() => []),
    ragChunkSize: '1000',
    setRagChunkSize: vi.fn(),
    ragChunkOverlap: '200',
    setRagChunkOverlap: vi.fn(),
    ragTopK: '5',
    setRagTopK: vi.fn(),
    handleRestoreAiDefaults: vi.fn(),
    autosaveStatus: 'idle' as const,
    ...overrides,
  };
  render(
    <MemoryRouter>
      <AiSettings {...props} />
    </MemoryRouter>,
  );
  return props;
}

const taskRow = (title: string) => screen.getByRole('cell', { name: title }).closest('tr') as HTMLElement;

describe('AiSettings provider keys', () => {
  it.each([
    ['sk-...', 'sk-1', 'setOpenaiKey'],
    ['AIza...', 'AIza-1', 'setGeminiKey'],
    ['sk-ant-...', 'sk-ant-1', 'setAnthropicKey'],
    ['http://127.0.0.1:11434/v1', 'http://127.0.0.1:11434/v1', 'setOllamaUrl'],
    ['Insira sua chave de API Ollama Cloud...', 'oc-1', 'setOllamaCloudKey'],
  ] as const)('shows and edits the %s field', (placeholder, value, setter) => {
    const props = renderSettings();
    const input = screen.getByPlaceholderText(placeholder);

    expect(input).toHaveValue(value);
    fireEvent.change(input, { target: { value: 'novo' } });

    expect(props[setter]).toHaveBeenCalledWith('novo');
  });

  it('masks secret keys but not the Ollama URL', () => {
    renderSettings();

    expect(screen.getByPlaceholderText('sk-...')).toHaveAttribute('type', 'password');
    expect(screen.getByPlaceholderText('http://127.0.0.1:11434/v1')).toHaveAttribute('type', 'text');
  });

  it('links to the terms of use', () => {
    renderSettings();

    expect(screen.getByRole('link', { name: /Termos de uso e IA/ })).toHaveAttribute('href', '/terms');
  });
});

describe('AiSettings per-task configuration', () => {
  const configs = [
    config('metadata', 'gemini', 'gemini-2.5-flash'),
    config('summary', 'openai', 'gpt-4o'),
    config('extraction', 'anthropic', 'claude'),
    config('embeddings', 'ollama', 'nomic-embed-text'),
  ];

  it('renders one row per task with its provider and model', () => {
    renderSettings({ aiConfigs: configs });

    const rows = [
      ['Extração de metadados', 'gemini', 'gemini-2.5-flash'],
      ['Geração de resumos', 'openai', 'gpt-4o'],
      ['Investigação com IA', 'anthropic', 'claude'],
      ['Vetores (embeddings)', 'ollama', 'nomic-embed-text'],
    ];
    for (const [title, provider, model] of rows) {
      const row = taskRow(title);
      expect(within(row).getByRole('combobox', { name: /Provedor/ })).toHaveValue(provider);
      expect(within(row).getByPlaceholderText('Ex: gemini-2.5-flash')).toHaveValue(model);
    }
  });

  it('marks the vectors as recommended when they run on the recommended Ollama model', () => {
    renderSettings({ aiConfigs: configs });

    expect(within(taskRow('Vetores (embeddings)')).getByText('rec.')).toBeInTheDocument();
    expect(screen.queryByText(/Recomendação:/)).not.toBeInTheDocument();
  });

  it('recommends Ollama for the vectors when they run on something else', () => {
    renderSettings({ aiConfigs: [config('embeddings', 'gemini', 'text-embedding-004')] });

    expect(screen.getByText(/Recomendação:/)).toBeInTheDocument();
    expect(screen.queryByText('rec.')).not.toBeInTheDocument();
  });

  it('says what the multilingual local model costs, only when it is the one chosen', () => {
    renderSettings({ aiConfigs: [config('embeddings', 'local', 'paraphrase-multilingual-MiniLM-L12-v2')] });

    expect(screen.getByRole('note')).toHaveTextContent('cerca de 118 MB');
    expect(within(screen.getByRole('note')).getByText('Experimental')).toBeInTheDocument();
  });

  it('says nothing of it with the default local model', () => {
    renderSettings({ aiConfigs: [config('embeddings', 'local', 'all-MiniLM-L6-v2')] });

    expect(screen.queryByRole('note')).not.toBeInTheDocument();
  });

  it('reports provider and model edits for the right task', () => {
    const props = renderSettings({ aiConfigs: configs });
    const summary = taskRow('Geração de resumos');

    fireEvent.change(within(summary).getByRole('combobox', { name: /Provedor/ }), {
      target: { value: 'ollama_cloud' },
    });
    fireEvent.change(within(summary).getByPlaceholderText('Ex: gemini-2.5-flash'), { target: { value: 'gpt-5' } });

    expect(props.handleUpdateAiConfig).toHaveBeenNthCalledWith(1, 'summary', 'provider', 'ollama_cloud');
    expect(props.handleUpdateAiConfig).toHaveBeenNthCalledWith(2, 'summary', 'model_name', 'gpt-5');
  });

  it('offers every supported provider', () => {
    renderSettings({ aiConfigs: [configs[0]] });

    const options = within(screen.getByRole('combobox', { name: /Provedor/ }))
      .getAllByRole('option')
      .map((o) => (o as HTMLOptionElement).value);
    expect(options).toEqual(['local', 'gemini', 'openai', 'anthropic', 'ollama', 'ollama_cloud']);
  });

  it('suggests the known models of the chosen provider in the model field, which still takes any name', () => {
    const getModelSuggestions = vi.fn((skill: AISkill, provider: AIProvider) =>
      skill === 'metadata' && provider === 'gemini' ? ['gemini-2.5-flash', 'gemini-2.5-pro'] : [],
    );
    renderSettings({ aiConfigs: [configs[0]], getModelSuggestions });

    const field = screen.getByPlaceholderText('Ex: gemini-2.5-flash');
    const suggestions = document.getElementById(field.getAttribute('list')!)!;
    expect([...suggestions.querySelectorAll('option')].map((o) => o.getAttribute('value'))).toEqual([
      'gemini-2.5-flash',
      'gemini-2.5-pro',
    ]);
  });
});

describe('AiSettings providers', () => {
  it('says whether each provider has a key', () => {
    renderSettings({ openaiKey: '', geminiKey: 'AIza-1' });

    const rows = (name: string) => screen.getByText(name, { selector: 'label' }).closest('.ai-provider') as HTMLElement;
    expect(within(rows('OpenAI')).getByText('sem chave')).toBeInTheDocument();
    expect(within(rows('Google Gemini')).getByText('configurada')).toBeInTheDocument();
  });
});

describe('AiSettings RAG parameters', () => {
  it('folds them away under a line that already says the numbers', () => {
    renderSettings();

    expect(screen.getByText('trecho 1000 · sobreposição 200 · 5 trechos')).toBeInTheDocument();
    expect(screen.getByText('Avançado: busca nos PDFs (RAG)').closest('details')).not.toHaveAttribute('open');
  });

  it.each([
    ['Tamanho do trecho (caracteres)', '1000', 'setRagChunkSize'],
    ['Sobreposição (caracteres)', '200', 'setRagChunkOverlap'],
    ['Trechos recuperados (Top K)', '5', 'setRagTopK'],
  ] as const)('shows and edits %s', (label, value, setter) => {
    const props = renderSettings();
    const input = screen.getByText(label).nextElementSibling as HTMLInputElement;

    expect(input).toHaveValue(Number(value));
    fireEvent.change(input, { target: { value: '42' } });

    expect(props[setter]).toHaveBeenCalledWith('42');
  });
});

describe('AiSettings actions', () => {
  it('restores the defaults, and has no save button: settings save on their own', () => {
    const props = renderSettings();

    fireEvent.click(screen.getByRole('button', { name: /Restaurar Padrões/ }));

    expect(props.handleRestoreAiDefaults).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: /Salvar/ })).toBeNull();
  });
});

describe('isRecommendedEmbedding and providerBadge', () => {
  it('recommends only the vector task on the recommended Ollama model', () => {
    expect(isRecommendedEmbedding(config('embeddings', 'ollama', 'nomic-embed-text'))).toBe(true);
    expect(isRecommendedEmbedding(config('embeddings', 'ollama', 'other'))).toBe(false);
    expect(isRecommendedEmbedding(config('summary', 'ollama', 'nomic-embed-text'))).toBe(false);
  });

  it('calls a provider configured as soon as its field has something', () => {
    expect(providerBadge('  ')).toEqual({ tone: 'none', text: 'sem chave' });
    expect(providerBadge('sk-1')).toEqual({ tone: 'ok', text: 'configurada' });
  });
});
