import React from 'react';
import { createPortal } from 'react-dom';
import { wilsonInterval } from '../../../utils/auditSampling';
import { AxisScale, ForestPlot } from './ForestPlot';

/**
 * Plain-language help for people who do not read confidence intervals every day: what the estimate is, what IC 95%
 * means, how to read the plot (with a normal and a small-sample example) and how to compare models.
 *
 * Usage:
 *   {helpOpen && <AuditHelpDialog onClose={() => setHelpOpen(false)} />}
 */
export const AuditHelpDialog: React.FC<{ onClose: () => void }> = ({ onClose }) =>
  createPortal(
    <div className="audit-dialog-veil" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="audit-panel audit-dialog" role="dialog" aria-modal="true" aria-label="Como ler a auditoria">
        <div className="audit-row audit-spread">
          <h3 style={{ margin: 0 }}>Como ler a auditoria</h3>
          <button type="button" className="btn-secondary" onClick={onClose} autoFocus>
            Fechar
          </button>
        </div>
        <h4 style={{ margin: 0 }}>Acerto estimado</h4>
        <p style={{ margin: 0 }}>
          A auditoria não confere todas as respostas, só uma amostra sorteada. A porcentagem diz quantas respostas da
          amostra você marcou como corretas. Ela é uma estimativa de quanto a IA acertou no conjunto todo.
        </p>
        <h4 style={{ margin: 0 }}>IC 95% (intervalo de confiança)</h4>
        <p style={{ margin: 0 }}>
          Como a amostra é só uma parte, a estimativa tem incerteza. O intervalo é a faixa onde o acerto verdadeiro
          provavelmente está: com o método usado, em 95 de cada 100 auditorias essa faixa contém o valor real. Quanto
          mais itens você marca, mais estreita ela fica.
        </p>
        <h4 style={{ margin: 0 }}>O gráfico</h4>
        <div className="audit-dialog-demo">
          <span className="audit-muted" style={{ fontSize: '0.75rem' }}>
            Exemplo: 8 de 10 corretos, 80%, com IC 95% de 49% a 94%
          </span>
          <ForestPlot interval={wilsonInterval(8, 10)} />
          <AxisScale />
        </div>
        <p style={{ margin: 0 }}>
          O quadrado é a estimativa e a linha é o intervalo, numa régua de 0% a 100%. Uma linha tracejada indica um
          intervalo largo, de poucos itens marcados:
        </p>
        <div className="audit-dialog-demo">
          <span className="audit-muted" style={{ fontSize: '0.75rem' }}>
            2 de 2 corretos: parece 100%, mas o intervalo vai de 34% a 100%
          </span>
          <ForestPlot interval={wilsonInterval(2, 2)} />
          <AxisScale />
        </div>
        <h4 style={{ margin: 0 }}>Comparar modelos</h4>
        <p style={{ margin: 0 }}>
          Se as linhas de dois modelos se sobrepõem, esta amostra não mostra diferença clara entre eles. Para separar,
          marque mais itens ou aumente a amostra.
        </p>
      </div>
    </div>,
    document.body,
  );

/** The "?" that opens the help. */
export const AuditHelpButton: React.FC<{ onClick: () => void; label: string }> = ({ onClick, label }) => (
  <button type="button" className="audit-help-btn" onClick={onClick} aria-label={label} title={label}>
    ?
  </button>
);
