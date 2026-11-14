import React, { useCallback, useState } from 'react';
import type { ProjectDocument } from '../../../src/types';
import { Await, Empty } from '../components';
import type { ProjectWriter } from '../reader/ProjectReader';
import { useReader } from '../session/SessionContext';
import { useLoaded } from '../useLoaded';

/**
 * The address as a web link, or null when it is not one (only http and https open from a phone).
 *
 * @example webAddress(' example.org/edital ') // 'https://example.org/edital'
 */
export function webAddress(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

const LinkRow: React.FC<{ document: ProjectDocument; onOpen: () => void }> = ({ document, onOpen }) => {
  const address = webAddress(document.url ?? '');
  const detail = [document.category, address ? new URL(address).hostname : 'arquivo no computador'].filter(Boolean);
  if (!address) {
    return (
      <li className="m-row m-row--plain">
        <span className="m-row__title">{document.title}</span>
        <span className="m-row__detail">{detail.join(' · ')}</span>
      </li>
    );
  }
  return (
    <li>
      <a className="m-row" href={address} target="_blank" rel="noreferrer noopener" onClick={onOpen}>
        <span className="m-row__title">{document.title}</span>
        <span className="m-row__detail">{detail.join(' · ')}</span>
      </a>
    </li>
  );
};

const AddLink: React.FC<{ projectId: number; writer: ProjectWriter; onAdded: () => void }> = (props) => {
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const add = async (event: React.FormEvent) => {
    event.preventDefault();
    const address = webAddress(url);
    if (!title.trim() || !address) return setProblem('Dê um título e um endereço da web (https://…).');
    try {
      await props.writer.addQuickLink(props.projectId, title.trim(), address);
      setTitle('');
      setUrl('');
      setProblem(null);
      props.onAdded();
    } catch {
      setProblem('Não foi possível adicionar. Tente de novo.');
    }
  };
  return (
    <form className="m-card" onSubmit={add}>
      <h2>Adicionar link</h2>
      <input
        className="m-input"
        aria-label="Título do link"
        placeholder="Título"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <input
        className="m-input"
        aria-label="Endereço do link"
        placeholder="https://…"
        inputMode="url"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
      />
      <button className="m-button m-button--primary" type="submit">
        Adicionar
      </button>
      {problem && (
        <p className="m-status" role="alert">
          {problem}
        </p>
      )}
    </form>
  );
};

/**
 * The quick access documents of a project. Links open in the browser; where writing is possible, a
 * link can be added (files stay on the desktop).
 *
 * @example <LinksTab projectId={3} />
 */
export const LinksTab: React.FC<{ projectId: number }> = ({ projectId }) => {
  const reader = useReader();
  const { writer } = reader;
  const documents = useLoaded(useCallback(() => reader.listDocuments(projectId), [reader, projectId]));
  return (
    <Await loaded={documents}>
      {(list) => (
        <>
          {writer && (
            <AddLink
              projectId={projectId}
              writer={writer}
              onAdded={documents.state === 'ready' ? documents.reload : () => undefined}
            />
          )}
          {list.length === 0 ? (
            <Empty>Nenhum documento de acesso rápido.</Empty>
          ) : (
            <ul className="m-list">
              {list.map((document) => (
                <LinkRow
                  key={document.id}
                  document={document}
                  onOpen={() => void writer?.markDocumentOpened(document.id)}
                />
              ))}
            </ul>
          )}
        </>
      )}
    </Await>
  );
};
