import { ChildProcess, spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { AppError } from '../../ipc/errorHandler';

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

    if (!fs.existsSync(modelPath)) {
      throw new AppError(
        'ERR_MODEL_NOT_DEFINED',
        'USER_ERROR',
        `[ERR_MODEL_NOT_DEFINED] Modelo de embedding local GGUF não encontrado em: "${modelPath}".`,
      );
    }

    if (!fs.existsSync(binaryPath)) {
      throw new AppError(
        'ERR_MODEL_NOT_DEFINED',
        'USER_ERROR',
        `[ERR_MODEL_NOT_DEFINED] Executável do llama-server não encontrado em: "${binaryPath}".`,
      );
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
    const devPath = path.join(process.cwd(), 'bin', exeName);
    if (fs.existsSync(devPath)) return devPath;

    return path.join(process.resourcesPath || process.cwd(), 'bin', exeName);
  }

  private resolveDefaultModelPath(): string {
    const modelName = 'all-MiniLM-L6-v2-Q4_K_M.gguf';
    const devModel = path.join(process.cwd(), 'models', modelName);
    if (fs.existsSync(devModel)) return devModel;

    return path.join(process.resourcesPath || process.cwd(), 'models', modelName);
  }

  private async waitForHealth(retries: number, delayMs: number): Promise<boolean> {
    for (let i = 0; i < retries; i++) {
      if (await this.isHealthy()) return true;
      await new Promise((r) => setTimeout(r, delayMs));
    }
    return false;
  }
}
