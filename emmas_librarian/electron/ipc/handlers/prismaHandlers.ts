import fs from 'fs';
import path from 'path';
import { IpcChannel, type PrismaImageFormat, type PrismaManualKey } from '../../types';
import type { DatabaseAdapter } from '../../database/DatabaseAdapter';
import { handle, type IpcRegistrar } from './handle';
import { requireProject, saveExport } from './exportHandlers';

// Excel on Windows reads a UTF-8 CSV without a byte order mark as ANSI and garbles accents.
const UTF8_BOM = '﻿';

const IMAGE_TARGETS: Record<PrismaImageFormat, { filterName: string; extension: string }> = {
  svg: { filterName: 'Imagem SVG', extension: 'svg' },
  png: { filterName: 'Imagem PNG', extension: 'png' },
};

function requireImageFormat(format: unknown): PrismaImageFormat {
  if (format === 'svg' || format === 'png') return format;
  throw new Error(
    `[ERR_INVALID_FORMAT] Offending value: format=${JSON.stringify(format)}. Expected shape: "svg" or "png".`,
  );
}

/**
 * The data table saved beside an exported diagram: same folder and name, "_dados.csv" at the end.
 *
 * @example tablePathFor('/out/prisma.png') // '/out/prisma_dados.csv'
 */
export function tablePathFor(imagePath: string): string {
  const parsed = path.parse(imagePath);
  return path.join(parsed.dir, `${parsed.name}_dados.csv`);
}

/**
 * The PRISMA diagram of the review page (#50): numbers typed by hand, and the export of the diagram as SVG or
 * PNG with its data table always beside it. The image comes from the renderer (an SVG text, or a PNG as base64).
 *
 * Usage:
 *   registerPrismaHandlers(ipcMain, db);
 */
export function registerPrismaHandlers(ipc: IpcRegistrar, db: DatabaseAdapter): void {
  handle(ipc, IpcChannel.PRISMA_MANUAL_GET, (_e, projectId: number) => db.prismaManualRepo.listCounts(projectId));
  handle(ipc, IpcChannel.PRISMA_MANUAL_SET, (_e, projectId: number, key: PrismaManualKey, value: number | null) =>
    db.prismaManualRepo.setCount(projectId, key, value),
  );
  handle(
    ipc,
    IpcChannel.EXPORT_PRISMA,
    async (_e, projectId: number, rawFormat: unknown, image: string, csv: string) => {
      const project = requireProject(db, projectId);
      const format = requireImageFormat(rawFormat);
      const content = format === 'png' ? Buffer.from(image, 'base64') : image;
      const saved = await saveExport(content, {
        title: 'Exportar diagrama PRISMA',
        defaultPath: `${project.name}_prisma.${IMAGE_TARGETS[format].extension}`,
        ...IMAGE_TARGETS[format],
      });
      if (saved) fs.writeFileSync(tablePathFor(saved), UTF8_BOM + csv, 'utf8');
      return saved;
    },
  );
}
