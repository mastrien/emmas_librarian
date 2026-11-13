import React, { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { Info, Trash2, HelpCircle, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Modal, type ModalTone } from '../Modal';
import { ModalFooter } from '../ModalFooter';
import { Button } from '../Button';
import './dialogs.css';

export interface ConfirmOptions {
  title: string;
  message: ReactNode;
  /** The button that goes ahead; say what it does ("Excluir evento"), not "OK". */
  confirmLabel: string;
  cancelLabel?: string;
  /** Destructive actions get the red button. */
  danger?: boolean;
}

export interface InformOptions {
  title: string;
  message: ReactNode;
  okLabel?: string;
  /** What the icon says (board 181): done (green), a problem (red), a caution (amber) or plain news. Default: from the title. */
  tone?: ModalTone;
}

export interface Dialogs {
  /** Resolves true when the person confirms, false on cancel, X or Esc. */
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  /** Resolves when the person closes the message. */
  inform: (options: InformOptions) => Promise<void>;
}

interface PendingDialog {
  id: number;
  kind: 'confirm' | 'inform';
  title: string;
  message: ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  danger: boolean;
  tone: ModalTone;
  settle: (confirmed: boolean) => void;
}

// Exported for tests, which put a FakeDialogs here (components/common/dialogs/__tests__/fakes).
export const DialogsContext = createContext<Dialogs | null>(null);

type DialogRequest = Omit<PendingDialog, 'id'>;

function toRequest(
  kind: PendingDialog['kind'],
  options: ConfirmOptions | InformOptions,
  settle: PendingDialog['settle'],
): DialogRequest {
  const confirm = options as ConfirmOptions;
  const inform = options as InformOptions;
  return {
    kind,
    title: options.title,
    message: options.message,
    confirmLabel: kind === 'confirm' ? confirm.confirmLabel : (inform.okLabel ?? 'Entendi'),
    cancelLabel: confirm.cancelLabel ?? 'Cancelar',
    danger: kind === 'confirm' && Boolean(confirm.danger),
    tone: inform.tone ?? informToneFromTitle(options.title),
    settle,
  };
}

const PROBLEM_TITLE = /^(erro|falha|não (foi possível|conseguimos|deu))/i;

/**
 * The tone of a notice whose caller did not choose one: "Erro ao…" and "Falha…" titles are problems (red), the rest news.
 *
 * @example informToneFromTitle('Erro ao salvar') // 'danger'
 */
export function informToneFromTitle(title: string): ModalTone {
  return PROBLEM_TITLE.test(title.trim()) ? 'danger' : 'info';
}

const NOTICE_ICONS: Record<ModalTone, React.ReactNode> = {
  ok: <CheckCircle2 size={20} aria-hidden="true" />,
  warn: <AlertTriangle size={20} aria-hidden="true" />,
  danger: <AlertTriangle size={20} aria-hidden="true" />,
  info: <Info size={20} aria-hidden="true" />,
};

/** What the window's icon says: a destructive question (red bin), any other question, or a notice by its tone. */
function dialogIcon(dialog: PendingDialog): { icon: React.ReactNode; tone: ModalTone } {
  if (dialog.kind === 'inform') return { icon: NOTICE_ICONS[dialog.tone], tone: dialog.tone };
  if (dialog.danger) return { icon: <Trash2 size={20} aria-hidden="true" />, tone: 'danger' };
  return { icon: <HelpCircle size={20} aria-hidden="true" />, tone: 'info' };
}

const DialogWindow: React.FC<{ dialog: PendingDialog; onSettle: (confirmed: boolean) => void }> = ({
  dialog,
  onSettle,
}) => (
  <Modal label={dialog.title} title={dialog.title} onClose={() => onSettle(false)} width={460} {...dialogIcon(dialog)}>
    <div className="app-dialog-message">{dialog.message}</div>
    <ModalFooter plain>
      {dialog.kind === 'confirm' && (
        <Button variant="ghost" onClick={() => onSettle(false)}>
          {dialog.cancelLabel}
        </Button>
      )}
      <Button variant={dialog.danger ? 'danger' : 'primary'} autoFocus onClick={() => onSettle(true)}>
        {dialog.confirmLabel}
      </Button>
    </ModalFooter>
  </Modal>
);

// Requests wait in line; the first one is on screen. Settling it resolves its promise and shows the next.
function useDialogQueue() {
  const [queue, setQueue] = useState<PendingDialog[]>([]);
  const nextId = useRef(0);
  const enqueue = useCallback((request: DialogRequest) => {
    nextId.current += 1;
    const id = nextId.current;
    setQueue((q) => [...q, { ...request, id }]);
  }, []);
  const settle = useCallback((dialog: PendingDialog, confirmed: boolean) => {
    setQueue((q) => q.filter((pending) => pending.id !== dialog.id));
    dialog.settle(confirmed);
  }, []);
  return { current: queue[0], enqueue, settle };
}

/**
 * The app's own confirm and message windows, in place of window.confirm/alert (Arca 103/134): they follow the theme,
 * name their buttons by what they do and close with the X like every modal. Requests wait in line, one window at a
 * time.
 *
 * @example <DialogProvider><App /></DialogProvider>
 */
export const DialogProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { current, enqueue, settle } = useDialogQueue();
  const dialogs = useMemo<Dialogs>(() => {
    const open = (kind: PendingDialog['kind'], options: ConfirmOptions | InformOptions) =>
      new Promise<boolean>((resolve) => enqueue(toRequest(kind, options, resolve)));
    return {
      confirm: (options) => open('confirm', options),
      inform: async (options) => {
        await open('inform', options);
      },
    };
  }, [enqueue]);
  return (
    <DialogsContext.Provider value={dialogs}>
      {children}
      {current && (
        <DialogWindow key={current.id} dialog={current} onSettle={(confirmed) => settle(current, confirmed)} />
      )}
    </DialogsContext.Provider>
  );
};

/**
 * The confirm and message windows of the nearest DialogProvider.
 *
 * @example const { confirm } = useDialogs(); if (await confirm({ title, message, confirmLabel: 'Excluir', danger: true })) …
 */
export function useDialogs(): Dialogs {
  const dialogs = useContext(DialogsContext);
  if (!dialogs) {
    throw new Error('useDialogs() precisa de um <DialogProvider> acima do componente; nenhum foi encontrado.');
  }
  return dialogs;
}
