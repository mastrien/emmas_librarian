import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { PrismaExportTables, PrismaImageFormat } from '../../../types';
import type { IProjectService } from '../../../services/ProjectServiceInterface';
import type { PrismaFlow } from '../../../utils/prismaFlow';
import { PrismaDiagram, PRINT_PALETTE } from './PrismaDiagram';
import { prismaLayout } from './prismaLayout';

/** Turns an SVG text into PNG bytes (base64). Injected so tests do not need a canvas. */
export type Rasterize = (svg: string, width: number, height: number) => Promise<string>;

/**
 * The diagram as a standalone SVG file: light palette, size in px, no buttons, the reference dated `today`.
 *
 * @example diagramSvgText(flow, new Date()).startsWith('<svg') // true
 */
export function diagramSvgText(flow: PrismaFlow, today: Date): string {
  const layout = prismaLayout(flow, today);
  return renderToStaticMarkup(React.createElement(PrismaDiagram, { layout, palette: PRINT_PALETTE, fixedSize: true }));
}

// Drawn at twice the size, so the PNG stays sharp in slides and printed pages.
const SCALE = 2;

/** Draws the SVG on a canvas in the renderer and answers the PNG as base64. */
export const browserRasterize: Rasterize = (svg, width, height) =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = width * SCALE;
      canvas.height = height * SCALE;
      const context = canvas.getContext('2d')!;
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/png').split(',')[1]);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(
        new Error('[ERR_PRISMA_PNG] Offending value: the diagram SVG. Expected shape: an SVG the browser can draw.'),
      );
    };
    image.src = url;
  });

/**
 * What one export takes: the format, the flow and its two tables, the day for the reference's access date.
 */
export interface PrismaExportJob {
  format: PrismaImageFormat;
  flow: PrismaFlow;
  tables: PrismaExportTables;
  today: Date;
}

/**
 * Exports the diagram as SVG or PNG with its two tables, through the main process. Answers where the image was
 * saved, or null when the person cancelled the dialog.
 *
 * @example await exportPrismaDiagram(service, 3, { format: 'png', flow, tables, today: new Date() });
 */
export async function exportPrismaDiagram(
  service: IProjectService,
  projectId: number,
  job: PrismaExportJob,
  rasterize: Rasterize = browserRasterize,
): Promise<string | null> {
  const svg = diagramSvgText(job.flow, job.today);
  const layout = prismaLayout(job.flow, job.today);
  const image = job.format === 'png' ? await rasterize(svg, layout.width, layout.height) : svg;
  return service.exportPrismaDiagram(projectId, job.format, image, job.tables);
}
