import React, { useState } from 'react';
import type { PrismaImageFormat } from '../../../types';
import { useCloseOnOutside } from '../LabelMenu';

const OPTIONS: { format: PrismaImageFormat; title: string; hint: string }[] = [
  { format: 'svg', title: 'SVG + tabelas (CSV)', hint: 'Vetor, para o artigo' },
  { format: 'png', title: 'PNG + tabelas (CSV)', hint: 'Imagem, para slides' },
];

/**
 * "Exportar ▾" of the PRISMA tab: SVG or PNG, the two CSV tables always beside the image.
 *
 * @example <ExportMenu onPick={(format) => exportDiagram(format)} />
 */
export const ExportMenu: React.FC<{ onPick: (format: PrismaImageFormat) => void }> = ({ onPick }) => {
  const [open, setOpen] = useState(false);
  const ref = useCloseOnOutside(open, () => setOpen(false));
  const pick = (format: PrismaImageFormat) => {
    setOpen(false);
    onPick(format);
  };
  return (
    <div className="review-menu-anchor" ref={ref}>
      <button
        type="button"
        className="review-small"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        Exportar ▾
      </button>
      {open && (
        <div className="review-menu" role="menu" aria-label="Exportar o diagrama" style={{ width: '320px' }}>
          {OPTIONS.map((o) => (
            <button
              key={o.format}
              type="button"
              role="menuitem"
              className="review-menu-item"
              onClick={() => pick(o.format)}
            >
              <span style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <strong>{o.title}</strong>
                <span className="review-muted">{o.hint}</span>
              </span>
            </button>
          ))}
          <p className="review-muted" style={{ margin: '0.4rem 0.5rem 0.2rem', lineHeight: 1.5 }}>
            Vão junto duas tabelas: a de dados do diagrama e a lista de publicações excluídas e não recuperadas, com o
            motivo (item 16b da PRISMA). A imagem leva no rodapé a referência do modelo PRISMA, com link. Caixas com
            aviso saem com o aviso; o app não corrige nenhum número sozinho.
          </p>
        </div>
      )}
    </div>
  );
};
