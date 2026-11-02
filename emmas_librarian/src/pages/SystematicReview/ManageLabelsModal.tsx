import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, ChevronUp, Trash2, X } from 'lucide-react';
import type { ScreeningKind, ScreeningLabel } from '../../types';
import { useProjectService } from '../../contexts/ServicesContext';
import { SCREENING_PRESETS } from '../../utils/screeningPresets';
import { currentDecisions } from '../../utils/screeningView';
import { describeError } from '../../utils/describeError';
import type { ScreeningState } from './useScreening';
import { KIND_EXPLAINED, KIND_MENU_TITLE, articlesCount } from './reviewText';

const KINDS: readonly ScreeningKind[] = ['include', 'maybe', 'exclude', 'removed'];
const KIND_TITLE: Record<ScreeningKind, string> = { ...KIND_MENU_TITLE, exclude: 'Excluir' };

interface ManageLabelsModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: number;
  screening: ScreeningState;
}

/** Runs a label change, then reloads the review; a refusal from the database shows in the window. */
function useLabelAction(screening: ScreeningState) {
  const [error, setError] = useState<string | null>(null);
  const run = async (change: () => Promise<unknown>) => {
    try {
      setError(null);
      await change();
      await screening.reload();
    } catch (err) {
      setError(describeError(err));
    }
  };
  return { error, run };
}

type Run = ReturnType<typeof useLabelAction>['run'];

const DeletePrompt: React.FC<{
  label: ScreeningLabel;
  count: number;
  others: ScreeningLabel[];
  run: Run;
  onCancel: () => void;
}> = ({ label, count, others, run, onCancel }) => {
  const service = useProjectService();
  const [target, setTarget] = useState<number | ''>(others[0]?.id ?? '');
  return (
    <div
      role="alertdialog"
      aria-label={`Apagar ${label.name}`}
      className="review-batch"
      style={{ background: 'var(--bg-main)' }}
    >
      <span style={{ width: '100%' }}>
        {count === 1 ? '1 artigo usa' : `${count} artigos usam`} "{label.name}". O que fazer com eles?
      </span>
      {others.length > 0 && (
        <>
          <label className="review-muted" style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
            Mover para
            <select
              className="input-field input-compact"
              value={target}
              onChange={(e) => setTarget(Number(e.target.value))}
            >
              {others.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="btn-primary"
            onClick={() => run(() => service.deleteScreeningLabel(label.id, Number(target)))}
          >
            Mover e apagar
          </button>
        </>
      )}
      <button
        type="button"
        className="review-small"
        onClick={() => run(() => service.deleteScreeningLabel(label.id, null))}
      >
        {label.kind === 'exclude' || label.kind === 'removed'
          ? 'Desfazer as decisões (voltam à lista)'
          : 'Desfazer as decisões'}
      </button>
      <button type="button" className="review-small" onClick={onCancel}>
        Cancelar
      </button>
    </div>
  );
};

const LabelLine: React.FC<{ label: ScreeningLabel; count: number; others: ScreeningLabel[]; run: Run }> = ({
  label,
  count,
  others,
  run,
}) => {
  const service = useProjectService();
  const [name, setName] = useState(label.name);
  const [deleting, setDeleting] = useState(false);
  const rename = () =>
    name.trim() && name.trim() !== label.name && run(() => service.renameScreeningLabel(label.id, name));
  const remove = () => (count === 0 ? run(() => service.deleteScreeningLabel(label.id, null)) : setDeleting(true));
  return (
    <div className="review-section" style={{ padding: '0.4rem 0.5rem 0.4rem 0.75rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
        <input
          aria-label={`Nome do rótulo ${label.name}`}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={rename}
          onKeyDown={(e) => e.key === 'Enter' && rename()}
          className="input-field input-compact"
          style={{ flex: 1, minWidth: 0 }}
        />
        <span className="review-muted" style={{ minWidth: '84px', textAlign: 'right' }}>
          {count === 0 ? 'sem artigos' : articlesCount(count)}
        </span>
        <button
          type="button"
          className="review-quiet"
          aria-label={`Subir ${label.name}`}
          onClick={() => run(() => service.moveScreeningLabel(label.id, -1))}
        >
          <ChevronUp size={16} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="review-quiet"
          aria-label={`Descer ${label.name}`}
          onClick={() => run(() => service.moveScreeningLabel(label.id, 1))}
        >
          <ChevronDown size={16} aria-hidden="true" />
        </button>
        <button type="button" className="review-quiet" aria-label={`Apagar ${label.name}`} onClick={remove}>
          <Trash2 size={16} aria-hidden="true" />
        </button>
      </div>
      {deleting && (
        <DeletePrompt label={label} count={count} others={others} run={run} onCancel={() => setDeleting(false)} />
      )}
    </div>
  );
};

const NewLabelForm: React.FC<{ projectId: number; run: Run }> = ({ projectId, run }) => {
  const service = useProjectService();
  const [name, setName] = useState('');
  const [kind, setKind] = useState<ScreeningKind>('exclude');
  const add = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    void run(() => service.createScreeningLabel(projectId, { name, kind })).then(() => setName(''));
  };
  return (
    <form
      onSubmit={add}
      className="review-section"
      style={{
        padding: '0.8rem',
        borderStyle: 'dashed',
        display: 'flex',
        flexWrap: 'wrap',
        gap: '0.5rem',
        alignItems: 'center',
      }}
    >
      <strong style={{ width: '100%' }}>Novo rótulo</strong>
      <input
        aria-label="Nome do novo rótulo"
        placeholder="ex.: Fora do período"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="input-field input-compact"
        style={{ flex: '1 1 200px', minWidth: 0 }}
      />
      <select
        className="input-field input-compact"
        aria-label="Tipo do rótulo"
        value={kind}
        onChange={(e) => setKind(e.target.value as ScreeningKind)}
      >
        {KINDS.map((k) => (
          <option key={k} value={k}>
            {KIND_TITLE[k]}
          </option>
        ))}
      </select>
      <button type="submit" className="btn-primary">
        Adicionar
      </button>
    </form>
  );
};

const PresetBox: React.FC<{ projectId: number; labels: ScreeningLabel[]; run: Run }> = ({ projectId, labels, run }) => {
  const service = useProjectService();
  const known = new Set(labels.map((l) => l.preset_key));
  const applied = SCREENING_PRESETS.prisma2020.every((p) => known.has(p.key));
  return (
    <div className="review-counts" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
      <div
        style={{
          display: 'flex',
          width: '100%',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '0.5rem',
          flexWrap: 'wrap',
        }}
      >
        <strong>Começar de um modelo</strong>
        {applied ? (
          <span className="review-chip review-chip--include">Rótulos do PRISMA 2020 criados</span>
        ) : (
          <button
            type="button"
            className="review-small"
            onClick={() => run(() => service.applyScreeningPreset(projectId, 'prisma2020'))}
          >
            Criar rótulos do PRISMA 2020
          </button>
        )}
      </div>
      <span style={{ lineHeight: 1.5 }}>
        Duas etapas: título e resumo, depois texto completo. Usa Incluso, Em dúvida, Excluído e Duplicado (cria se
        faltarem) e, para o texto completo, motivos de exclusão que você pode renomear (o PRISMA pede que os motivos
        sejam relatados, mas não fixa quais). Os rótulos que você já tem continuam.
      </span>
    </div>
  );
};

const ManageLabelsContent: React.FC<Omit<ManageLabelsModalProps, 'isOpen'>> = ({ onClose, projectId, screening }) => {
  const { error, run } = useLabelAction(screening);
  const current = [...currentDecisions(screening.decisions).values()];
  const countOf = (labelId: number) => current.filter((d) => d.label_id === labelId).length;
  return (
    <div
      role="dialog"
      aria-label="Rótulos de triagem"
      className="card fade-in"
      style={{
        width: 'min(760px, 100%)',
        maxHeight: '90vh',
        overflowY: 'auto',
        background: 'var(--bg-surface)',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        padding: '1.5rem',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
        <div>
          <h2 style={{ margin: 0 }}>Rótulos de triagem</h2>
          <p className="review-muted" style={{ margin: '0.3rem 0 0' }}>
            O nome é livre; o tipo diz como o rótulo conta. Um rótulo de exclusão arquiva o artigo no projeto e usa o
            nome do rótulo como motivo.
          </p>
        </div>
        <button type="button" className="review-quiet" aria-label="Fechar" onClick={onClose}>
          <X size={18} aria-hidden="true" />
        </button>
      </div>
      {error && (
        <div role="alert" className="review-chip review-chip--exclude" style={{ whiteSpace: 'normal' }}>
          {error}
        </div>
      )}
      {KINDS.map((kind) => (
        <section
          key={kind}
          aria-label={KIND_TITLE[kind]}
          style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}
        >
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <span className={`review-chip review-chip--${kind}`}>{KIND_TITLE[kind]}</span>
            <span className="review-muted">{KIND_EXPLAINED[kind]}</span>
          </div>
          {screening.labels
            .filter((l) => l.kind === kind)
            .map((label, _i, ofKind) => (
              <LabelLine
                key={label.id}
                label={label}
                count={countOf(label.id)}
                others={ofKind.filter((o) => o.id !== label.id)}
                run={run}
              />
            ))}
        </section>
      ))}
      {screening.view.counts.unlabeled > 0 && (
        <div className="review-counts">
          <span className="review-chip review-chip--none">Arquivado no projeto (sem rótulo)</span>
          <span style={{ flex: '1 1 320px' }}>
            {articlesCount(screening.view.counts.unlabeled)} arquivados na página do projeto só com uma nota. Não entram
            no diagrama do PRISMA até receberem um rótulo, em "Excluídos".
          </span>
        </div>
      )}
      <NewLabelForm projectId={projectId} run={run} />
      <PresetBox projectId={projectId} labels={screening.labels} run={run} />
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button type="button" className="btn-secondary" onClick={onClose}>
          Fechar
        </button>
      </div>
    </div>
  );
};

/**
 * The labels window of the review page (#49): labels by kind, renamed in place, reordered, deleted (moving or
 * taking back their decisions), new labels and the PRISMA 2020 preset.
 *
 * @example <ManageLabelsModal isOpen={open} onClose={close} projectId={3} screening={screening} />
 */
export const ManageLabelsModal: React.FC<ManageLabelsModalProps> = ({ isOpen, ...rest }) => {
  if (!isOpen) return null;
  return createPortal(
    <div
      className="review-modal"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 99999,
        padding: '1rem',
      }}
    >
      <ManageLabelsContent {...rest} />
    </div>,
    document.body,
  );
};
