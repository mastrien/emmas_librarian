import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AiSettings } from '../AiSettings';
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
    handleSaveKeys: vi.fn(),
    saving: false,
    saved: false,
    ...overrides,
  };
  render(
    <MemoryRouter>
      <AiSettings {...props} />
    </MemoryRouter>,
  );
  return props;
}

const skillCard = (title: string) => screen.getByRole('heading', { name: title }).parentElement as HTMLElement;

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

    expect(screen.getByRole('link', { name: /Termos de Uso/ })).toHaveAttribute('href', '/terms');
  });
});

describe('AiSettings per-skill configuration', () => {
  const configs = [
    config('metadata', 'gemini', 'gemini-2.5-flash'),
    config('summary', 'openai', 'gpt-4o'),
    config('extraction', 'anthropic', 'claude'),
    config('embeddings', 'ollama', 'nomic-embed-text'),
  ];

  it('renders one titled card per skill with its provider and model', () => {
    renderSettings({ aiConfigs: configs });

    const cards = [
      ['📄 Extração de Metadados', 'gemini', 'gemini-2.5-flash'],
      ['📝 Geração de Resumos', 'openai', 'gpt-4o'],
      ['🔍 Investigação Massiva (RAG)', 'anthropic', 'claude'],
      ['🧮 Embeddings (Vetorização)', 'ollama', 'nomic-embed-text'],
    ];
    for (const [title, provider, model] of cards) {
      const card = skillCard(title);
      expect(within(card).getByRole('combobox')).toHaveValue(provider);
      expect(within(card).getByPlaceholderText('Ex: gemini-2.5-flash')).toHaveValue(model);
    }
  });

  it('shows the embeddings recommendation only on the embeddings card', () => {
    renderSettings({ aiConfigs: configs });

    expect(within(skillCard('🧮 Embeddings (Vetorização)')).getByText(/Aviso de Recomendação/)).toBeInTheDocument();
    expect(screen.getAllByText(/Aviso de Recomendação/)).toHaveLength(1);
  });

  it('reports provider and model edits for the right skill', () => {
    const props = renderSettings({ aiConfigs: configs });
    const summary = skillCard('📝 Geração de Resumos');

    fireEvent.change(within(summary).getByRole('combobox'), { target: { value: 'ollama_cloud' } });
    fireEvent.change(within(summary).getByPlaceholderText('Ex: gemini-2.5-flash'), { target: { value: 'gpt-5' } });

    expect(props.handleUpdateAiConfig).toHaveBeenNthCalledWith(1, 'summary', 'provider', 'ollama_cloud');
    expect(props.handleUpdateAiConfig).toHaveBeenNthCalledWith(2, 'summary', 'model_name', 'gpt-5');
  });

  it('offers every supported provider', () => {
    renderSettings({ aiConfigs: [configs[0]] });

    const options = within(screen.getByRole('combobox')).getAllByRole('option').map((o) => (o as HTMLOptionElement).value);
    expect(options).toEqual(['local', 'gemini', 'openai', 'anthropic', 'ollama', 'ollama_cloud']);
  });

  it('hides suggestions when there are none', () => {
    renderSettings({ aiConfigs: [configs[0]] });

    expect(screen.queryByText('Sugestões:')).not.toBeInTheDocument();
  });

  it('lists model suggestions, highlights the current one and applies a click', () => {
    const getModelSuggestions = vi.fn((skill: AISkill, provider: AIProvider) =>
      skill === 'metadata' && provider === 'gemini' ? ['gemini-2.5-flash', 'gemini-2.5-pro'] : [],
    );
    const props = renderSettings({ aiConfigs: [configs[0]], getModelSuggestions });

    const current = screen.getByRole('button', { name: 'gemini-2.5-flash' });
    const other = screen.getByRole('button', { name: 'gemini-2.5-pro' });
    expect(current).toHaveStyle({ fontWeight: '600' });
    expect(other).toHaveStyle({ fontWeight: '400' });

    fireEvent.click(other);

    expect(props.handleUpdateAiConfig).toHaveBeenCalledWith('metadata', 'model_name', 'gemini-2.5-pro');
  });
});

describe('AiSettings RAG parameters', () => {
  it.each([
    ['Tamanho do Chunk (caracteres)', '1000', 'setRagChunkSize'],
    ['Overlap (caracteres)', '200', 'setRagChunkOverlap'],
    ['Chunks Recuperados (Top K)', '5', 'setRagTopK'],
  ] as const)('shows and edits %s', (label, value, setter) => {
    const props = renderSettings();
    const input = screen.getByText(label).nextElementSibling as HTMLInputElement;

    expect(input).toHaveValue(Number(value));
    fireEvent.change(input, { target: { value: '42' } });

    expect(props[setter]).toHaveBeenCalledWith('42');
  });
});

describe('AiSettings actions', () => {
  it('saves from both buttons and restores defaults', () => {
    const props = renderSettings();

    fireEvent.click(screen.getByRole('button', { name: /Salvar Chaves/ }));
    fireEvent.click(screen.getByRole('button', { name: /Salvar Configuração/ }));
    fireEvent.click(screen.getByRole('button', { name: /Restaurar Padrões/ }));

    expect(props.handleSaveKeys).toHaveBeenCalledTimes(2);
    expect(props.handleRestoreAiDefaults).toHaveBeenCalledTimes(1);
  });

  it('disables both save buttons while saving', () => {
    renderSettings({ saving: true });

    const buttons = screen.getAllByRole('button', { name: /Salvando/ });
    expect(buttons).toHaveLength(2);
    buttons.forEach((b) => expect(b).toBeDisabled());
  });

  it('confirms a completed save on both buttons', () => {
    renderSettings({ saved: true });

    expect(screen.getAllByRole('button', { name: /Salvo!/ })).toHaveLength(2);
  });
});
