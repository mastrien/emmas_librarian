import { SegmentedControl } from '../../components/common/SegmentedControl';
import React, { useState } from 'react';
import { Copy } from 'lucide-react';
import { SideDrawer } from '../../components/common/SideDrawer';
import { useNarrowWindow } from '../../hooks/useNarrowWindow';
import { callAsText, callsSummary, failedCount, visibleCalls, type CallFilter, type NumberedCall } from './callsList';
import { callErrorGroups, type CallCell } from './investigationView';
import './investigationRuns.css';

interface CallsTabProps {
  cells: CallCell[];
  questions: string[];
  /** Runs the articles of a failed group again, in a new investigation. */
  onRedo: (articleIds: number[]) => void;
}

const STATUS_TONE = { success: 'ok', error: 'bad', skipped: 'warn', running: 'run', queued: 'run' } as const;
// Short labels for the list's narrow column (board 161); the matrix and tooltips keep the long ones.
const LIST_STATUS: Record<CallCell['status'], string> = {
  success: 'ok',
  error: 'erro',
  skipped: 'pulada',
  running: 'rodando',
  queued: 'na fila',
};

const ErrorGroups: React.FC<{ cells: CallCell[]; onRedo: CallsTabProps['onRedo'] }> = ({ cells, onRedo }) => (
  <>
    {callErrorGroups(cells).map((group) => (
      <div key={`${group.status}:${group.message}`} role="alert" className="inv-error-group">
        <div className="inv-shrink">
          <strong>
            {group.count} {group.count === 1 ? 'chamada' : 'chamadas'}{' '}
            {group.status === 'error' ? 'com erro' : 'pulada(s)'}
          </strong>
          <div className="inv-muted inv-wrap-anywhere">{group.message}</div>
        </div>
        <button type="button" className="btn-secondary inv-small" onClick={() => onRedo(group.articleIds)}>
          Refazer {group.articleIds.length === 1 ? 'este artigo' : `estes ${group.articleIds.length} artigos`}
        </button>
      </div>
    ))}
  </>
);

const CallRow: React.FC<{ item: NumberedCall; questionNumber: number; selected: boolean; onSelect: () => void }> = ({
  item,
  questionNumber,
  selected,
  onSelect,
}) => (
  <tr className={selected ? 'is-selected' : undefined} aria-selected={selected}>
    <td className="inv-calls__num">{item.number}</td>
    <td className="inv-calls__title">
      <button type="button" onClick={onSelect} title={item.call.articleTitle}>
        {item.call.articleTitle}
      </button>
    </td>
    <td title={item.call.question}>P{questionNumber}</td>
    <td>
      <span className={`inv-chip inv-chip--${STATUS_TONE[item.call.status]}`}>{LIST_STATUS[item.call.status]}</span>
    </td>
  </tr>
);

/** The selected call (board 161): its question, the passage the model cited and what it answered or why it failed. */
const CallInspector: React.FC<{ item: NumberedCall }> = ({ item }) => {
  const { call } = item;
  return (
    <div className="inv-call-detail">
      <div className="inv-call-detail__head">
        <span className="inv-section-title">Chamada {item.number}</span>
        <button
          type="button"
          className="btn-ghost inv-small"
          onClick={() => void navigator.clipboard?.writeText(callAsText(item))}
        >
          <Copy size={14} aria-hidden="true" /> Copiar
        </button>
      </div>
      <span className="inv-muted">{call.articleTitle}</span>
      <Field label="Pergunta">{call.question}</Field>
      <Field label={`Trechos citados · ${call.evidences.length}`}>
        {call.evidences.length === 0
          ? '—'
          : call.evidences.map((e, i) => (
              <q key={i} className="inv-quote">
                {e.page && <span className="inv-quote__page">pág. {e.page} · </span>}
                {e.text}
              </q>
            ))}
      </Field>
      {call.status === 'success' ? (
        <Field label="Resposta do modelo">
          <span className="inv-wrap-anywhere">{call.answer}</span>
        </Field>
      ) : (
        <Field label="Erro">
          <span className="inv-danger inv-wrap-anywhere">{call.error || 'Falha ao extrair resposta.'}</span>
        </Field>
      )}
    </div>
  );
};

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="inv-field">
    <span className="inv-section-title">{label}</span>
    <div>{children}</div>
  </div>
);

interface CallsToolbarProps {
  cells: CallCell[];
  questions: string[];
  filter: CallFilter;
  onFilter: (filter: CallFilter) => void;
  question: string;
  onQuestion: (question: string) => void;
}

/** Todas / Com erro, the question, and how the calls went. */
const CallsToolbar: React.FC<CallsToolbarProps> = ({ cells, questions, filter, onFilter, question, onQuestion }) => {
  const filters: { id: CallFilter; label: string; count: number }[] = [
    { id: 'all', label: 'Todas', count: cells.length },
    { id: 'errors', label: 'Com erro', count: failedCount(cells) },
  ];
  return (
    <div className="inv-toolbar">
      <SegmentedControl
        label="Chamadas a mostrar"
        value={filter}
        onChange={onFilter}
        options={filters.map((f) => ({
          value: f.id,
          label: (
            <>
              {f.label} <span className="segmented-option__count">{f.count}</span>
            </>
          ),
        }))}
      />
      <select
        className="input-field input-compact inv-question-filter"
        aria-label="Pergunta"
        value={question}
        onChange={(e) => onQuestion(e.target.value)}
      >
        <option value="all">Todas as perguntas</option>
        {questions.map((q, i) => (
          <option key={q} value={q}>
            P{i + 1}. {q}
          </option>
        ))}
      </select>
      <span className="inv-muted inv-toolbar-end">{callsSummary(cells)}</span>
    </div>
  );
};

/**
 * The "Chamadas" tab of a stored investigation (board 161): errors grouped by message with a way to run those
 * articles again, then every call as a list, filtered by outcome and question, with the chosen one beside it.
 *
 * @example <CallsTab cells={savedCalls(results, articles)} questions={questions} onRedo={redo} />
 */
export const CallsTab: React.FC<CallsTabProps> = ({ cells, questions, onRedo }) => {
  const narrow = useNarrowWindow();
  const [filter, setFilter] = useState<CallFilter>('all');
  const [question, setQuestion] = useState('all');
  const [selected, setSelected] = useState<number | null>(narrow ? null : 1);
  const shown = visibleCalls(cells, filter, question);
  const current = visibleCalls(cells, 'all', 'all').find((c) => c.number === selected);
  return (
    <>
      <CallsToolbar
        cells={cells}
        questions={questions}
        filter={filter}
        onFilter={setFilter}
        question={question}
        onQuestion={setQuestion}
      />
      <div className="inv-split">
        <div className="inv-scroll inv-stack">
          <ErrorGroups cells={cells} onRedo={onRedo} />
          <table className="inv-calls" aria-label="Chamadas">
            <thead>
              <tr>
                <th scope="col">#</th>
                <th scope="col">Artigo</th>
                <th scope="col">Perg.</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((item) => (
                <CallRow
                  key={item.number}
                  item={item}
                  questionNumber={questions.indexOf(item.call.question) + 1}
                  selected={item.number === selected}
                  onSelect={() => setSelected(item.number)}
                />
              ))}
            </tbody>
          </table>
          {shown.length === 0 && <div className="inv-empty">Nenhuma chamada neste filtro.</div>}
        </div>
        {!narrow && current && (
          <aside className="inv-card inv-side-panel" aria-label="Chamada selecionada">
            <CallInspector item={current} />
          </aside>
        )}
      </div>
      {narrow && current && (
        <SideDrawer side="right" label="Chamada selecionada" onClose={() => setSelected(null)}>
          <CallInspector item={current} />
        </SideDrawer>
      )}
    </>
  );
};
