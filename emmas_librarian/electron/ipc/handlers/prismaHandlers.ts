import fs from 'fs';
import path from 'path';
import {
  IpcChannel,
  type PrismaExportTables,
  type PrismaImageFormat,
  type PrismaRecords,
  type PrismaSourceInput,
} from '../../types';
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
 * A table saved beside an exported diagram: same folder and name, the table's suffix at the end.
 *
 * @example tablePathFor('/out/prisma.png', 'dados') // '/out/prisma_dados.csv'
 */
export function tablePathFor(imagePath: string, suffix: string): string {
  const parsed = path.parse(imagePath);
  return path.join(parsed.dir, `${parsed.name}_${suffix}.csv`);
}

function writeTables(imagePath: string, tables: PrismaExportTables): void {
  fs.writeFileSync(tablePathFor(imagePath, 'dados'), UTF8_BOM + tables.data, 'utf8');
  fs.writeFileSync(tablePathFor(imagePath, 'excluidas'), UTF8_BOM + tables.excluded, 'utf8');
}

/** Everything the person told the app about a project's PRISMA diagram. */
function recordsOf(db: DatabaseAdapter, projectId: number): PrismaRecords {
  return {
    sources: db.prismaOriginRepo.listSources(projectId),
    origins: db.prismaOriginRepo.listOrigins(projectId),
    studyLinks: db.prismaStudyRepo.listLinks(projectId),
  };
}

function registerRecordHandlers(ipc: IpcRegistrar, db: DatabaseAdapter): void {
  const after = (projectId: number, change: () => unknown): PrismaRecords => {
    change();
    return recordsOf(db, projectId);
  };
  handle(ipc, IpcChannel.PRISMA_RECORDS_GET, (_e, projectId: number) => recordsOf(db, projectId));
  handle(ipc, IpcChannel.PRISMA_SOURCE_SAVE, (_e, projectId: number, input: PrismaSourceInput) =>
    after(projectId, () => db.prismaOriginRepo.saveSource(projectId, input)),
  );
  handle(ipc, IpcChannel.PRISMA_ORIGINS_SET, (_e, projectId: number, articleIds: number[], sourceId: number | null) =>
    after(projectId, () => db.prismaOriginRepo.setOrigins(projectId, articleIds, sourceId)),
  );
  handle(ipc, IpcChannel.PRISMA_STUDY_LINK, (_e, projectId: number, articleId: number, otherId: number) =>
    after(projectId, () => db.prismaStudyRepo.link(projectId, articleId, otherId)),
  );
  handle(ipc, IpcChannel.PRISMA_STUDY_UNLINK, (_e, projectId: number, studyArticleId: number) =>
    after(projectId, () => db.prismaStudyRepo.unlink(projectId, studyArticleId)),
  );
}

/**
 * The PRISMA diagram of the review page (#50): sources, origins and same-study links the person records (every
 * change answers the project's records as they now are), and the export of the diagram as SVG or PNG with its
 * two CSV tables beside it. The image comes from the renderer (an SVG text, or a PNG as base64).
 *
 * Usage:
 *   registerPrismaHandlers(ipcMain, db);
 */
export function registerPrismaHandlers(ipc: IpcRegistrar, db: DatabaseAdapter): void {
  registerRecordHandlers(ipc, db);
  handle(
    ipc,
    IpcChannel.EXPORT_PRISMA,
    async (_e, projectId: number, rawFormat: unknown, image: string, tables: PrismaExportTables) => {
      const project = requireProject(db, projectId);
      const format = requireImageFormat(rawFormat);
      const content = format === 'png' ? Buffer.from(image, 'base64') : image;
      const saved = await saveExport(content, {
        title: 'Exportar diagrama PRISMA',
        defaultPath: `${project.name}_prisma.${IMAGE_TARGETS[format].extension}`,
        ...IMAGE_TARGETS[format],
      });
      if (saved) writeTables(saved, tables);
      return saved;
    },
  );
}
