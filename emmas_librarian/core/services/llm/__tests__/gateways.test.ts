import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GeminiGateway } from '../GeminiGateway';
import { OllamaGateway } from '../OllamaGateway';
import { OpenAIGateway } from '../OpenAIGateway';
import { AnthropicGateway } from '../AnthropicGateway';

describe('LLM Gateways', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('GeminiGateway', () => {
    it('should complete successfully', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: 'Gemini Response' }] } }],
        }),
      });
      const gateway = new GeminiGateway('gemini-key');
      const response = await gateway.complete('hello', 'gemini-model');
      expect(response).toBe('Gemini Response');
    });

    it('should throw if api key missing', async () => {
      const gateway = new GeminiGateway('');
      await expect(gateway.complete('hello', 'gemini-model')).rejects.toThrow('não configurada');
    });

    it('should handle quota limit error', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
      });
      const gateway = new GeminiGateway('gemini-key');
      await expect(gateway.complete('hello', 'gemini-model')).rejects.toThrow('QUOTA_EXCEEDED');
    });

    it('should handle general error', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => 'Bad Request Details',
      });
      const gateway = new GeminiGateway('gemini-key');
      await expect(gateway.complete('hello', 'gemini-model')).rejects.toThrow('Gemini API Error: Bad Request Details');
    });
  });

  describe('OllamaGateway', () => {
    it('should complete successfully', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Ollama Response' } }],
        }),
      });
      const gateway = new OllamaGateway('http://localhost:11434/');
      const response = await gateway.complete('hello', 'llama3');
      expect(response).toBe('Ollama Response');
    });

    it('should throw if baseUrl is missing', async () => {
      const gateway = new OllamaGateway('');
      await expect(gateway.complete('hello', 'llama3')).rejects.toThrow('não configurada');
    });

    it('should handle errors', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        text: async () => 'Ollama Server Error',
      });
      const gateway = new OllamaGateway('http://localhost:11434');
      await expect(gateway.complete('hello', 'llama3')).rejects.toThrow('Ollama/Local API Error: Ollama Server Error');
    });
  });

  describe('OpenAIGateway', () => {
    it('should complete successfully', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'OpenAI Response' } }],
        }),
      });
      const gateway = new OpenAIGateway('openai-key');
      const response = await gateway.complete('hello', 'gpt-4o');
      expect(response).toBe('OpenAI Response');
    });

    it('should throw if api key missing', async () => {
      const gateway = new OpenAIGateway('');
      await expect(gateway.complete('hello', 'gpt-4o')).rejects.toThrow('não configurada');
    });

    it('should handle quota limit error', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
      });
      const gateway = new OpenAIGateway('openai-key');
      await expect(gateway.complete('hello', 'gpt-4o')).rejects.toThrow('QUOTA_EXCEEDED');
    });

    it('should handle general error', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'Server Error',
      });
      const gateway = new OpenAIGateway('openai-key');
      await expect(gateway.complete('hello', 'gpt-4o')).rejects.toThrow('OpenAI API Error: Server Error');
    });
  });

  describe('AnthropicGateway', () => {
    it('should complete successfully', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          content: [{ text: 'Anthropic Response' }],
        }),
      });
      const gateway = new AnthropicGateway('anthropic-key');
      const response = await gateway.complete('hello', 'claude-3');
      expect(response).toBe('Anthropic Response');
    });

    it('should throw if api key missing', async () => {
      const gateway = new AnthropicGateway('');
      await expect(gateway.complete('hello', 'claude-3')).rejects.toThrow('não configurada');
    });

    it('should handle general error', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        text: async () => 'Forbidden API',
      });
      const gateway = new AnthropicGateway('anthropic-key');
      await expect(gateway.complete('hello', 'claude-3')).rejects.toThrow('Anthropic API Error: Forbidden API');
    });
  });
});
