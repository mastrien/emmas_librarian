import React from 'react';
import { Info } from 'lucide-react';
import { STALE_AFTER_DAYS } from './deadlineDates';

const NUMBER_WORDS = ['nenhum', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez'];

const countWord = (count: number): string => NUMBER_WORDS[count] ?? String(count);

/**
 * The notice under the list (board 173): "Os dois prazos venceram há mais de 60 dias" and a button to mark them done,
 * since they stay pending until someone does and the home only lists recent ones.
 *
 * @example <StaleCallout count={2} onMarkDone={markStaleDone} />
 */
export const StaleCallout: React.FC<{ count: number; onMarkDone: () => void }> = ({ count, onMarkDone }) => {
  if (count === 0) return null;
  const many = count > 1;
  return (
    <div className="agenda-callout" role="note">
      <Info size={16} aria-hidden="true" />
      <div className="agenda-callout__text">
        <strong>
          {many
            ? `Os ${countWord(count)} prazos venceram há mais de ${STALE_AFTER_DAYS} dias`
            : `Um prazo venceu há mais de ${STALE_AFTER_DAYS} dias`}
        </strong>
        <span>
          {many ? 'Eles aparecem' : 'Ele aparece'} aqui porque ainda não {many ? 'foram marcados' : 'foi marcado'} como{' '}
          {many ? 'feitos' : 'feito'}. No Início, só entram prazos dos próximos {STALE_AFTER_DAYS} dias e vencidos
          recentes.
        </span>
      </div>
      <button type="button" className="btn-secondary" onClick={onMarkDone}>
        {many ? `Marcar os ${countWord(count)} como feitos` : 'Marcar como feito'}
      </button>
    </div>
  );
};
