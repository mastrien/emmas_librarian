import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LlamaServerManager } from '../LlamaServerManager';

describe('LlamaServerManager', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should return singleton instance', () => {
    const manager1 = LlamaServerManager.getInstance();
    const manager2 = LlamaServerManager.getInstance();
    expect(manager1).toBe(manager2);
  });

  it('should return correct base URL', () => {
    const manager = LlamaServerManager.getInstance();
    expect(manager.getBaseUrl()).toBe('http://127.0.0.1:11435/v1');
  });

  it('should report unhealthy when fetch fails', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Connection refused'));
    const manager = LlamaServerManager.getInstance();
    const healthy = await manager.isHealthy();
    expect(healthy).toBe(false);
  });

  it('should report healthy when endpoint returns ok', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true });
    const manager = LlamaServerManager.getInstance();
    const healthy = await manager.isHealthy();
    expect(healthy).toBe(true);
  });

  it('should skip starting if server is already healthy', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true });
    const manager = LlamaServerManager.getInstance();
    const started = await manager.ensureStarted();
    expect(started).toBe(true);
  });
});
