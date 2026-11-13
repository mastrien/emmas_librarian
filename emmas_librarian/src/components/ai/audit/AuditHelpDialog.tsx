import React from 'react';
import { Modal } from '../../common/Modal';
import { wilsonInterval } from '../../../utils/auditSampling';
import { AxisScale, ForestPlot } from './ForestPlot';

/**
 * Plain-language help for people who do not read confidence intervals every day: what the estimate is, what IC 95%
 * means, how to read the plot (with a normal and a small-sample example) and how to compare models.
 *
 * Usage:
 *   {helpOpen && <AuditHelpDialog onClose={() => setHelpOpen(false)} />}
 */
export const AuditHelpDialog: React.FC<{ onClose: () => void }> = ({ onClose }) => (
  <Modal label="Como ler a auditoria" title="Como ler a auditoria" onClose={onClose} width={560} className="audit-help">
    <h4 className="audit-m0">Acerto estimado</h4>
    <p className="audit-m0">
      A auditoria não confere todas as respostas, só uma amostra sorteada. A porcentagem diz quantas respostas da
      amostra você marcou como corretas. Ela é uma estimativa de quanto a IA acertou no conjunto todo.
    </p>
    <h4 className="audit-m0">IC 95% (intervalo de confiança)</h4>
    <p className="audit-m0">
      Como a amostra é só uma parte, a estimativa tem incerteza. O intervalo é a faixa onde o acerto verdadeiro
      provavelmente está: com o método usado, em 95 de cada 100 auditorias essa faixa contém o valor real. Quanto mais
      itens você marca, mais estreita ela fica.
    </p>
    <h4 className="audit-m0">O gráfico</h4>
    <div className="audit-dialog-demo">
      <span className="audit-muted audit-text-xs">Exemplo: 8 de 10 corretos, 80%, com IC 95% de 49% a 94%</span>
      <ForestPlot interval={wilsonInterval(8, 10)} />
      <AxisScale />
    </div>
    <p className="audit-m0">
      O quadrado é a estimativa e a linha é o intervalo, numa régua de 0% a 100%. Uma linha tracejada indica um
      intervalo largo, de poucos itens marcados:
    </p>
    <div className="audit-dialog-demo">
      <span className="audit-muted audit-text-xs">2 de 2 corretos: parece 100%, mas o intervalo vai de 34% a 100%</span>
      <ForestPlot interval={wilsonInterval(2, 2)} />
      <AxisScale />
    </div>
    <h4 className="audit-m0">Comparar modelos</h4>
    <p className="audit-m0">
      Se as linhas de dois modelos se sobrepõem, esta amostra não mostra diferença clara entre eles. Para separar,
      marque mais itens ou aumente a amostra.
    </p>
  </Modal>
);

/** The "?" that opens the help. */
export const AuditHelpButton: React.FC<{ onClick: () => void; label: string }> = ({ onClick, label }) => (
  <button type="button" className="audit-help-btn" onClick={onClick} aria-label={label} title={label}>
    ?
  </button>
);
