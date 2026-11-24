import React from 'react';
import { Link } from 'react-router-dom';
import type { Loaded } from './useLoaded';

/**
 * The bar at the top of a screen: where "back" goes, the title, and an optional action at the right.
 *
 * @example <ScreenHeader title="Tese" back="/projects" />
 */
export const ScreenHeader: React.FC<{ title: string; back?: string; action?: React.ReactNode }> = (props) => (
  <header className="m-header">
    {props.back ? (
      <Link to={props.back} className="m-header__back" aria-label="Voltar">
        ‹
      </Link>
    ) : (
      <span className="m-header__back" aria-hidden="true" />
    )}
    <h1 className="m-header__title">{props.title}</h1>
    <span className="m-header__action">{props.action}</span>
  </header>
);

/**
 * Draws what was loaded, or says that it is loading or why it failed (with a way to try again).
 *
 * @example <Await loaded={articles}>{(list) => <ArticleList articles={list} />}</Await>
 */
export function Await<T>(props: { loaded: Loaded<T>; children: (value: T) => React.ReactNode }): React.ReactElement {
  const { loaded } = props;
  if (loaded.state === 'loading') return <p className="m-note">Carregando…</p>;
  if (loaded.state === 'ready') return <>{props.children(loaded.value)}</>;
  return (
    <div className="m-note m-note--error" role="alert">
      <p>Não foi possível carregar: {loaded.message}</p>
      <button className="m-button" onClick={loaded.reload}>
        Tentar de novo
      </button>
    </div>
  );
}

/** @example <Empty>Nenhum artigo neste projeto.</Empty> */
export const Empty: React.FC<{ children: React.ReactNode }> = ({ children }) => <p className="m-note">{children}</p>;
