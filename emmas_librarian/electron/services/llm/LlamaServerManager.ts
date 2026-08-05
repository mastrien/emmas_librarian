import { ChildProcess, spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { AppError } from '../../ipc/errorHandler';
import { LlamaDownloader } from './LlamaDownloader';

export class LlamaServerManager {
  private static instance: LlamaServerManager;
  private process: ChildProcess | null = null;
  private readonly port: number = 11435;
  private readonly host: string = '127.0.0.1';

  public static getInstance(): LlamaServerManager {
    if (!LlamaServerManager.instance) {
      LlamaServerManager.instance = new LlamaServerManager();
    }
    return LlamaServerManager.instance;
  }

  public getBaseUrl(): string {
    return `http://${this.host}:${this.port}/v1`;
  }

  public async isHealthy(): Promise<boolean> {
    try {
      const res = await fetch(`http://${this.host}:${this.port}/health`, { method: 'GET' });
      return res.ok;
    } catch {
      return false;
    }
  }

  public async ensureStarted(customModelPath?: string): Promise<boolean> {
    const alreadyHealthy = await this.isHealthy();
    if (alreadyHealthy) {
      return true;
    }

    const binaryPath = this.resolveBinaryPath();
    const modelPath = customModelPath || this.resolveDefaultModelPath();

    const downloader = new LlamaDownloader();

    if (!fs.existsSync(binaryPath)) {
      console.log(`[LlamaServerManager] Baixando executável local llama-server em: "${binaryPath}"...`);
      await downloader.downloadFile(LlamaDownloader.BINARY_URL_WIN, binaryPath);
    }

    if (!fs.existsSync(modelPath)) {
      console.log(`[LlamaServerManager] Baixando modelo de embedding local GGUF em: "${modelPath}"...`);
      await downloader.downloadFile(LlamaDownloader.MODEL_URL, modelPath);
    }

    this.process = spawn(binaryPath, [
      '--embedding',
      '-m', modelPath,
      '--port', this.port.toString(),
      '--host', this.host,
      '--threads', '4',
    ], {
      detached: false,
      stdio: 'ignore',
    });

    return await this.waitForHealth(10, 500);
  }

  public stopServer(): void {
    if (this.process) {
      try {
        this.process.kill();
      } catch (err) {
        console.error('[LlamaServerManager] Erro ao encerrar processo:', err);
      }
      this.process = null;
    }
  }

  private resolveBinaryPath(): string {
    const exeName = process.platform === 'win32' ? 'llama-server.exe' : 'llama-server';
    const candidatePaths = [
      path.join(process.cwd(), 'bin', exeName),
      path.join(process.cwd(), 'dev_data', 'bin', exeName),
      path.join(process.resourcesPath || process.cwd(), 'bin', exeName),
    ];

    for (const p of candidatePaths) {
      if (fs.existsSync(p)) return p;
    }

    return candidatePaths[0];
  }

  private resolveDefaultModelPath(): string {
    const modelName = 'all-MiniLM-L6-v2-Q4_K_M.gguf';
    const candidatePaths = [
      path.join(process.cwd(), 'models', modelName),
      path.join(process.cwd(), 'dev_data', 'models', modelName),
      path.join(process.resourcesPath || process.cwd(), 'models', modelName),
    ];

    for (const p of candidatePaths) {
      if (fs.existsSync(p)) return p;
    }

    return candidatePaths[0];
  }

  private async waitForHealth(retries: number, delayMs: number): Promise<boolean> {
    for (let i = 0; i < retries; i++) {
      if (await this.isHealthy()) return true;
      await new Promise((r) => setTimeout(r, delayMs));
    }
    return false;
  }
}
