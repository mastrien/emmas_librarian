import React from 'react';
import type { PrismaBoxKey } from '../../../utils/prismaFlow';
import { BAND_W, LINE_H, PAD, type BoxPlace, type PrismaLayout } from './prismaLayout';

/** Colours of the diagram: CSS variables on screen (follows the theme), plain hex in exported files. */
export interface PrismaPalette {
  surface: string;
  border: string;
  text: string;
  heading: string;
  warnFill: string;
  warnBorder: string;
  warnText: string;
  infoText: string;
  band: string;
  bandText: string;
  line: string;
  selected: string;
}

export const SCREEN_PALETTE: PrismaPalette = {
  surface: 'var(--bg-surface)',
  border: 'var(--border-color)',
  text: 'var(--text-main)',
  heading: 'var(--text-heading)',
  warnFill: 'var(--review-may-bg)',
  warnBorder: '#d97706',
  warnText: 'var(--review-may-text)',
  infoText: 'var(--review-rem-text)',
  band: 'var(--review-read-bg)',
  bandText: 'var(--review-read-text)',
  line: '#94a3b8',
  selected: 'var(--color-primary)',
};

// An exported figure goes into papers and slides: always light, whatever the app's theme.
export const PRINT_PALETTE: PrismaPalette = {
  surface: '#ffffff',
  border: '#cbd5e1',
  text: '#334155',
  heading: '#0f172a',
  warnFill: '#fffbeb',
  warnBorder: '#d97706',
  warnText: '#92400e',
  infoText: '#075985',
  band: '#e0e7ff',
  bandText: '#3730a3',
  line: '#94a3b8',
  selected: '#4f46e5',
};

interface PrismaDiagramProps {
  layout: PrismaLayout;
  palette: PrismaPalette;
  selected?: PrismaBoxKey | null;
  onSelect?: (key: PrismaBoxKey) => void;
  /** Exported files carry their size in px instead of filling a container. */
  fixedSize?: boolean;
}

const FONT = 'Inter, system-ui, sans-serif';

function lineColour(kind: BoxPlace['lines'][number]['kind'], p: PrismaPalette): string {
  if (kind === 'title') return p.heading;
  if (kind === 'warn') return p.warnText;
  if (kind === 'info') return p.infoText;
  return p.text;
}

const BoxShape: React.FC<{ box: BoxPlace; p: PrismaPalette; selected: boolean; onSelect?: () => void }> = ({
  box,
  p,
  selected,
  onSelect,
}) => {
  const interactive = onSelect !== undefined;
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    onSelect?.();
  };
  return (
    <g
      data-box={box.key}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-label={interactive ? box.lines.map((l) => l.text).join('. ') : undefined}
      aria-pressed={interactive ? selected : undefined}
      onClick={onSelect}
      onKeyDown={interactive ? onKey : undefined}
      style={interactive ? { cursor: 'pointer' } : undefined}
    >
      <rect
        x={box.x}
        y={box.y}
        width={box.w}
        height={box.h}
        rx={8}
        fill={box.warned ? p.warnFill : p.surface}
        stroke={selected ? p.selected : box.warned ? p.warnBorder : p.border}
        strokeWidth={selected ? 2.5 : 1}
      />
      <text x={box.x + PAD + 2} y={box.y + PAD} fontFamily={FONT} fontSize={13}>
        {box.lines.map((line, i) => (
          <tspan
            key={i}
            x={box.x + PAD + 2}
            dy={i === 0 ? LINE_H - 5 : LINE_H}
            fill={lineColour(line.kind, p)}
            fontWeight={line.kind === 'title' ? 600 : line.kind === 'line' ? 400 : 500}
          >
            {line.text}
          </tspan>
        ))}
      </text>
    </g>
  );
};

/**
 * The PRISMA 2020 flow diagram as one SVG that scales to its container. On screen every box is a button that
 * shows where its number comes from; rendered for export (no onSelect, print palette) it is a plain figure.
 *
 * @example <PrismaDiagram layout={prismaLayout(flow)} palette={SCREEN_PALETTE} selected="screened" onSelect={setSelected} />
 */
export const PrismaDiagram: React.FC<PrismaDiagramProps> = ({
  layout,
  palette: p,
  selected = null,
  onSelect,
  fixedSize,
}) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox={`0 0 ${layout.width} ${layout.height}`}
    width={fixedSize ? layout.width : '100%'}
    height={fixedSize ? layout.height : undefined}
    style={fixedSize ? undefined : { maxWidth: layout.width, display: 'block' }}
    role="img"
    aria-label="Diagrama PRISMA 2020 da revisão"
  >
    <defs>
      <marker id="prisma-arrow" orient="auto" markerWidth="6" markerHeight="6" refX="5" refY="3">
        <path d="M0 0 L6 3 L0 6 Z" fill={p.line} />
      </marker>
    </defs>
    {layout.bands.map((band) => (
      <g key={band.label}>
        <rect x={0} y={band.y} width={BAND_W} height={band.h} rx={6} fill={p.band} />
        <text
          transform={`translate(${BAND_W / 2 + 4} ${band.y + band.h / 2}) rotate(-90)`}
          textAnchor="middle"
          fontFamily={FONT}
          fontSize={12}
          fontWeight={600}
          fill={p.bandText}
        >
          {band.label}
        </text>
      </g>
    ))}
    {layout.arrows.map((a, i) => (
      <line
        key={i}
        x1={a.x1}
        y1={a.y1}
        x2={a.x2}
        y2={a.y2}
        stroke={p.line}
        strokeWidth={2}
        markerEnd="url(#prisma-arrow)"
      />
    ))}
    {layout.boxes.map((box) => (
      <BoxShape
        key={box.key}
        box={box}
        p={p}
        selected={selected === box.key}
        onSelect={onSelect ? () => onSelect(box.key) : undefined}
      />
    ))}
  </svg>
);
