import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import './backLink.css';

// `state` travels with the route, e.g. the reader tells the investigation which audit to reopen.
type BackLinkTarget =
  | { to: string; state?: unknown; onClick?: never }
  | { onClick: () => void; to?: never; state?: never };

type BackLinkProps = BackLinkTarget &
  ({ children: React.ReactNode; label?: never } | { children?: never; label: string }) & {
    /** Page-level spacing only (e.g. `page-back`); the look stays the component's. */
    className?: string;
  };

/**
 * The app's one "voltar": an arrow with no fill and no border (design rule, epic #44 validation), followed by where it
 * goes. Pass `children` for the visible text, or only `label` where the arrow stands alone (reader toolbar); the label
 * then names it for screen readers and the tooltip. Use `onClick` when the way back is not a route (browser history).
 *
 * @example <BackLink to={`/projects/${id}`}>Voltar ao projeto</BackLink>
 * @example <BackLink onClick={() => navigate(-1)} label="Voltar" />
 */
export const BackLink: React.FC<BackLinkProps> = (props) => {
  const iconOnly = props.children === undefined;
  const className = ['back-link', iconOnly && 'back-link--icon', props.className].filter(Boolean).join(' ');
  const a11y = iconOnly ? { 'aria-label': props.label, title: props.label } : {};
  const content = (
    <>
      <ArrowLeft size={18} aria-hidden="true" />
      {props.children}
    </>
  );
  if (props.to !== undefined) {
    return (
      <Link to={props.to} state={props.state} className={className} {...a11y}>
        {content}
      </Link>
    );
  }
  return (
    <button type="button" onClick={props.onClick} className={className} {...a11y}>
      {content}
    </button>
  );
};
