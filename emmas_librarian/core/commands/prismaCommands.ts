import fs from 'fs';
import path from 'path';
import {
  IpcChannel,
  type PrismaExportTables,
  type PrismaImageFormat,
  type PrismaRecords,
  type PrismaSourceInput,
} from '../../src/types';
import type { DatabaseAdapter } from '../database/DatabaseAdapter';
import type { CommandRegistry } from './CommandRegistry';
import { exportFile, requireProject, savedAt, writeExport, type ExportFileType } from './exportCommands';

// Excel on Windows reads a UTF-8 CSV without a byte order mark as ANSI and garbles accents.
const UTF8_BOM = '﻿';

const IMAGE_TYPES: Record<PrismaImageFormat, ExportFileType> = {
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

function registerRecordCommands(commands: CommandRegistry, db: DatabaseAdapter): void {
  const after = (projectId: number, change: () => unknown): PrismaRecords => {
    change();
    return recordsOf(db, projectId);
  };
  commands.add(IpcChannel.PRISMA_RECORDS_GET, (projectId: number) => recordsOf(db, projectId));
  commands.add(IpcChannel.PRISMA_SOURCE_SAVE, (projectId: number, input: PrismaSourceInput) =>
    after(projectId, () => db.prismaOriginRepo.saveSource(projectId, input)),
  );
  commands.add(IpcChannel.PRISMA_ORIGINS_SET, (projectId: number, articleIds: number[], sourceId: number | null) =>
    after(projectId, () => db.prismaOriginRepo.setOrigins(projectId, articleIds, sourceId)),
  );
  commands.add(IpcChannel.PRISMA_STUDY_LINK, (projectId: number, articleId: number, otherId: number) =>
    after(projectId, () => db.prismaStudyRepo.link(projectId, articleId, otherId)),
  );
  commands.add(IpcChannel.PRISMA_STUDY_UNLINK, (projectId: number, studyArticleId: number) =>
    after(projectId, () => db.prismaStudyRepo.unlink(projectId, studyArticleId)),
  );
}

/**
 * The PRISMA diagram of the review page (#50): sources, origins and same-study links the person records (every
 * change answers the project's records as they now are), and the export of the diagram as SVG or PNG with its
 * two CSV tables beside it. The image comes from the caller (an SVG text, or a PNG as base64) and the file to
 * write is the last argument.
 *
 * Usage:
 *   registerPrismaCommands(commands, db);
 */
export function registerPrismaCommands(commands: CommandRegistry, db: DatabaseAdapter): void {
  registerRecordCommands(commands, db);
  const describe = (projectId: number, rawFormat: unknown) => {
    const project = requireProject(db, projectId);
    const type = IMAGE_TYPES[requireImageFormat(rawFormat)];
    return exportFile('Exportar diagrama PRISMA', `${project.name}_prisma.${type.extension}`, type);
  };
  commands.add(
    IpcChannel.EXPORT_PRISMA,
    (projectId: number, rawFormat: unknown, image: string, tables: PrismaExportTables, filePath: string) => {
      requireProject(db, projectId);
      const content = requireImageFormat(rawFormat) === 'png' ? Buffer.from(image, 'base64') : image;
      const saved = writeExport(content, filePath);
      writeTables(saved, tables);
      return saved;
    },
    { file: savedAt(4, describe) },
  );
}
