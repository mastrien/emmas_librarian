import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LlamaDownloader } from '../LlamaDownloader';
import fs from 'fs';
import path from 'path';

describe('LlamaDownloader', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should instantiate LlamaDownloader', () => {
    const downloader = new LlamaDownloader();
    expect(downloader).toBeDefined();
  });

  it('should return default target paths for models and bin', () => {
    const downloader = new LlamaDownloader();
    const modelPath = downloader.getDefaultModelPath();
    const binaryPath = downloader.getDefaultBinaryPath();

    expect(modelPath).toContain('all-MiniLM-L6-v2-Q4_K_M.gguf');
    expect(binaryPath).toContain(process.platform === 'win32' ? 'llama-server.exe' : 'llama-server');
  });

  it('should recognize when files exist or do not exist', () => {
    const downloader = new LlamaDownloader();
    const exists = downloader.areDependenciesPresent('/non/existent/path/binary', '/non/existent/path/model');
    expect(exists).toBe(false);
  });
});
