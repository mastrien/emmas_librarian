import path from 'path';
import fs from 'fs';
import https from 'https';
import http from 'http';
import { AppError } from '../../ipc/errorHandler';

export class LlamaDownloader {
  public static readonly MODEL_URL =
    'https://huggingface.co/second-state/All-MiniLM-L6-v2-Embedding-GGUF/resolve/main/all-MiniLM-L6-v2-Q4_K_M.gguf';

  public static readonly BINARY_URL_WIN =
    'https://huggingface.co/second-state/All-MiniLM-L6-v2-Embedding-GGUF/resolve/main/llama-server.exe';

  public getDefaultModelPath(): string {
    const modelName = 'all-MiniLM-L6-v2-Q4_K_M.gguf';
    const devDir = path.join(process.cwd(), 'dev_data', 'models');
    if (fs.existsSync(devDir)) {
      return path.join(devDir, modelName);
    }
    const rootDir = path.join(process.cwd(), 'models');
    if (!fs.existsSync(rootDir)) {
      try {
        fs.mkdirSync(rootDir, { recursive: true });
      } catch {}
    }
    return path.join(rootDir, modelName);
  }

  public getDefaultBinaryPath(): string {
    const exeName = process.platform === 'win32' ? 'llama-server.exe' : 'llama-server';
    const devDir = path.join(process.cwd(), 'dev_data', 'bin');
    if (fs.existsSync(devDir)) {
      return path.join(devDir, exeName);
    }
    const rootDir = path.join(process.cwd(), 'bin');
    if (!fs.existsSync(rootDir)) {
      try {
        fs.mkdirSync(rootDir, { recursive: true });
      } catch {}
    }
    return path.join(rootDir, exeName);
  }

  public areDependenciesPresent(binaryPath?: string, modelPath?: string): boolean {
    const bin = binaryPath || this.getDefaultBinaryPath();
    const mdl = modelPath || this.getDefaultModelPath();
    return fs.existsSync(bin) && fs.existsSync(mdl);
  }

  public async downloadFile(
    url: string,
    destPath: string,
    onProgress?: (percent: number, downloaded: number, total: number) => void,
  ): Promise<void> {
    const dir = path.dirname(destPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const tmpPath = `${destPath}.tmp`;
    if (fs.existsSync(tmpPath)) {
      try {
        fs.unlinkSync(tmpPath);
      } catch {}
    }

    try {
      await this.fetchStreamWithRedirects(url, tmpPath, onProgress);
      fs.renameSync(tmpPath, destPath);
    } catch (err: any) {
      if (fs.existsSync(tmpPath)) {
        try {
          fs.unlinkSync(tmpPath);
        } catch {}
      }
      throw new AppError(
        'ERR_API_CONNECTION',
        'SYSTEM_ERROR',
        `[ERR_API_CONNECTION] Falha ao baixar componente local llama.cpp (${path.basename(destPath)}): ${err.message || 'Erro de rede'}.`,
      );
    }
  }

  private fetchStreamWithRedirects(
    url: string,
    destTmpPath: string,
    onProgress?: (percent: number, downloaded: number, total: number) => void,
    maxRedirects = 5,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      if (maxRedirects <= 0) {
        return reject(new Error('Muitos redirecionamentos HTTP ao baixar o arquivo.'));
      }

      const client = url.startsWith('https') ? https : http;
      client
        .get(url, (res) => {
          if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            let nextUrl = res.headers.location;
            if (nextUrl.startsWith('/')) {
              const parsedUrl = new URL(url);
              nextUrl = `${parsedUrl.protocol}//${parsedUrl.host}${nextUrl}`;
            }
            return this.fetchStreamWithRedirects(nextUrl, destTmpPath, onProgress, maxRedirects - 1)
              .then(resolve)
              .catch(reject);
          }

          if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
            return reject(new Error(`Servidor respondeu com status HTTP ${res.statusCode}`));
          }

          const totalBytes = parseInt(res.headers['content-length'] || '0', 10);
          let downloadedBytes = 0;
          const fileStream = fs.createWriteStream(destTmpPath);

          res.on('data', (chunk) => {
            downloadedBytes += chunk.length;
            if (totalBytes > 0 && onProgress) {
              const percent = Math.round((downloadedBytes / totalBytes) * 100);
              onProgress(percent, downloadedBytes, totalBytes);
            }
          });

          res.pipe(fileStream);

          fileStream.on('finish', () => {
            fileStream.close();
            resolve();
          });

          fileStream.on('error', (err) => {
            fs.unlink(destTmpPath, () => {});
            reject(err);
          });
        })
        .on('error', (err) => {
          reject(err);
        });
    });
  }
}
