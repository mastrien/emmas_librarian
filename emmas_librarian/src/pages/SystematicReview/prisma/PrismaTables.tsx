import React from 'react';
import type { PrismaBoxKey, PrismaColumn, PrismaFlow } from '../../../utils/prismaFlow';
import type { ExcludedReport } from '../../../utils/prisma/prismaTables';

const COLUMN_NAMES: Record<PrismaColumn, string> = {
  databases: 'Bases de dados e repositórios',
  other: 'Outros métodos',
  both: 'As duas colunas',
};

const Heading: React.FC<{ title: string }> = ({ title }) => (
  <h2 style={{ margin: '0 0.75rem 0.6rem', fontSize: '1.05rem' }}>
    {title} <span className="review-muted">vai junto na exportação</span>
  </h2>
);

/**
 * The diagram's numbers as a table: one row per box, with its column, how it is counted and its warnings.
 *
 * @example <DataTable flow={flow} order={prismaOrder(flow)} />
 */
export const DataTable: React.FC<{ flow: PrismaFlow; order: PrismaBoxKey[] }> = ({ flow, order }) => (
  <section aria-label="Tabela de dados" className="review-section" style={{ padding: '1rem 0.5rem 0.5rem' }}>
    <Heading title="Tabela de dados" />
    <div style={{ overflowX: 'auto' }}>
      <table className="prisma-table">
        <thead>
          <tr>
            <th>Coluna</th>
            <th>Caixa</th>
            <th>n</th>
            <th>De onde vem</th>
            <th>Aviso</th>
          </tr>
        </thead>
        <tbody>
          {order.map((key) => (
            <tr key={key}>
              <td className="review-muted">{COLUMN_NAMES[flow[key].column]}</td>
              <td>{flow[key].title}</td>
              <td>{flow[key].n}</td>
              <td className="review-muted">{flow[key].how}</td>
              <td>{flow[key].warnings.map((w) => w.text).join(' ')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </section>
);

/**
 * The reports excluded at full text or not retrieved, with reference, stage, reason and origin: the list PRISMA
 * 2020 item 16b asks for, as supplementary material of the paper.
 *
 * @example <ExcludedTable reports={excludedReports(input, flow)} />
 */
export const ExcludedTable: React.FC<{ reports: ExcludedReport[] }> = ({ reports }) => (
  <section
    aria-label="Publicações excluídas e não recuperadas"
    className="review-section"
    style={{ padding: '1rem 0.5rem 0.5rem' }}
  >
    <Heading title="Publicações excluídas e não recuperadas" />
    <p className="review-muted" style={{ margin: '0 0.75rem 0.6rem' }}>
      A lista que o item 16b da PRISMA pede: cada publicação excluída no texto completo, ou cujo texto não foi
      recuperado, com o motivo.
    </p>
    <div style={{ overflowX: 'auto' }}>
      <table className="prisma-table">
        <thead>
          <tr>
            <th>Referência</th>
            <th>Etapa</th>
            <th>Motivo</th>
            <th>Origem</th>
          </tr>
        </thead>
        <tbody>
          {reports.map((r) => (
            <tr key={r.articleId}>
              <td>{r.reference}</td>
              <td>{r.stage}</td>
              <td>{r.reason}</td>
              <td className="review-muted">{r.origin}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {reports.length === 0 && (
        <p className="review-muted" style={{ margin: '0.5rem 0.75rem' }}>
          Nenhuma publicação excluída no texto completo ainda.
        </p>
      )}
    </div>
  </section>
);
