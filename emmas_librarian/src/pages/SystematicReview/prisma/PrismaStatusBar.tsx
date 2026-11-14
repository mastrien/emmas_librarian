import React from 'react';
import { AlertTriangle, Check, Info } from 'lucide-react';
import type { PrismaBoxKey, PrismaFlow } from '../../../utils/prismaFlow';
import './prisma.css';

const boxes = (n: number) => (n === 1 ? '1 caixa' : `${n} caixas`);

interface PrismaStatusBarProps {
  flow: PrismaFlow;
  order: PrismaBoxKey[];
  /** Articles still waiting for a decision, at title and abstract and at full text together. */
  waiting: number;
}

/**
 * The line of badges above the diagram (board 166): articles waiting for a decision (amber), boxes whose numbers do not
 * agree or may be partial (amber), boxes with no data to check (blue) and, when nothing disagrees, a green "Números
 * batem". Only what applies is shown; the app never fixes a number by itself.
 *
 * @example <PrismaStatusBar flow={flow} order={prismaOrder(flow)} waiting={96} />
 */
export const PrismaStatusBar: React.FC<PrismaStatusBarProps> = ({ flow, order, waiting }) => {
  const all = order.flatMap((k) => flow[k].warnings);
  const count = (kind: string) => all.filter((w) => w.kind === kind).length;
  return (
    <div className="prisma-row prisma-status" role="group" aria-label="Avisos do diagrama">
      {waiting > 0 && (
        <span className="review-chip review-chip--maybe">
          <AlertTriangle size={12} aria-hidden="true" /> {waiting} aguardando decisão
        </span>
      )}
      {count('mismatch') > 0 && (
        <span className="review-chip review-chip--maybe">
          <AlertTriangle size={12} aria-hidden="true" /> {boxes(count('mismatch'))} com números que não batem
        </span>
      )}
      {count('partial') > 0 && (
        <span className="review-chip review-chip--maybe">
          <AlertTriangle size={12} aria-hidden="true" /> {boxes(count('partial'))} com busca parcial
        </span>
      )}
      {count('nodata') > 0 && (
        <span className="review-chip review-chip--removed">
          <Info size={12} aria-hidden="true" /> {boxes(count('nodata'))} sem dados para conferir
        </span>
      )}
      {count('mismatch') === 0 && (
        <span className="review-chip review-chip--include">
          <Check size={12} aria-hidden="true" /> Números batem
        </span>
      )}
      <span className="review-muted prisma-status__hint">Clique numa caixa para ver de onde vem o número.</span>
    </div>
  );
};
