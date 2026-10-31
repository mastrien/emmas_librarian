import React, { useEffect, useRef, useState } from 'react';
import type { ScreeningKind, ScreeningLabel } from '../../types';
import { KIND_MENU_TITLE } from './reviewText';

interface LabelMenuProps {
  labels: ScreeningLabel[];
  kinds: readonly ScreeningKind[];
  currentLabelId: number | null;
  buttonText: string;
  onPick: (label: ScreeningLabel) => void;
  disabled?: boolean;
  primary?: boolean;
  alignLeft?: boolean;
}

function useCloseOnOutside(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && close();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, close]);
  return ref;
}

const MenuGroups: React.FC<
  Pick<LabelMenuProps, 'labels' | 'kinds' | 'currentLabelId'> & { pick: (l: ScreeningLabel) => void }
> = ({ labels, kinds, currentLabelId, pick }) => (
  <>
    {kinds.map((kind) => {
      const ofKind = labels.filter((l) => l.kind === kind);
      if (ofKind.length === 0) return null;
      return (
        <div key={kind} role="group" aria-label={KIND_MENU_TITLE[kind]}>
          <div className="review-menu-title">{KIND_MENU_TITLE[kind]}</div>
          {ofKind.map((label) => (
            <button
              key={label.id}
              type="button"
              role="menuitem"
              className="review-menu-item"
              onClick={() => pick(label)}
            >
              <span className={`review-dot review-dot--${kind}`} aria-hidden="true" />
              <span style={{ flex: 1 }}>{label.name}</span>
              {label.id === currentLabelId && <span className="review-muted">atual</span>}
            </button>
          ))}
        </div>
      );
    })}
  </>
);

/**
 * The "Rótulo ▾" dropdown: the project's labels grouped by kind, closing on a pick, a click outside or Escape.
 *
 * @example <LabelMenu labels={labels} kinds={KINDS_BY_STAGE.title} currentLabelId={null} buttonText="Rótulo ▾" onPick={decide} />
 */
export const LabelMenu: React.FC<LabelMenuProps> = (props) => {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  const ref = useCloseOnOutside(open, close);
  const pick = (label: ScreeningLabel) => {
    close();
    props.onPick(label);
  };
  return (
    <div className="review-menu-anchor" ref={ref}>
      <button
        type="button"
        className={props.primary ? 'btn-primary' : 'review-small'}
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={props.disabled}
        onClick={() => setOpen(!open)}
      >
        {props.buttonText}
      </button>
      {open && (
        <div className={`review-menu${props.alignLeft ? ' review-menu--left' : ''}`} role="menu" aria-label="Rótulos">
          <MenuGroups labels={props.labels} kinds={props.kinds} currentLabelId={props.currentLabelId} pick={pick} />
        </div>
      )}
    </div>
  );
};
