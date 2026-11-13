import React, { useState } from 'react';
import { Modal } from '../Modal';
import { ModalFooter } from '../ModalFooter';
import { Button } from '../Button';
import { changeSummary, diffWords } from './diffText';
import { versionStamp } from './diaryDates';
import './diary.css';

export interface DiaryVersion {
  id: number;
  content: string;
  updated_at: string;
}

interface DiaryHistoryDialogProps {
  /** The page's name (its first line), for the title. */
  title: string;
  /** What the page says now: what each version is compared with. */
  current: string;
  /** The versions before the current one, the newest first. */
  versions: DiaryVersion[];
  onRestore: (versionId: number) => void;
  onClose: () => void;
}

const CURRENT = 'current';

const Legend: React.FC = () => (
  <div className="diary-history__legend">
    <span>
      <ins className="diary-diff diary-diff--add">verde</ins> entrou depois
    </span>
    <span>
      <del className="diary-diff diary-diff--del">vermelho</del> saiu depois
    </span>
  </div>
);

/** A version as it differs from the current text: what came in after it in green, what went out after it in red. */
const VersionText: React.FC<{ version: string; current: string }> = ({ version, current }) => (
  <div className="diary-history__text">
    {diffWords(version, current).map((part, i) => {
      if (part.kind === 'add') {
        return (
          <ins key={i} className="diary-diff diary-diff--add">
            {part.text}
          </ins>
        );
      }
      if (part.kind === 'del') {
        return (
          <del key={i} className="diary-diff diary-diff--del">
            {part.text}
          </del>
        );
      }
      return <span key={i}>{part.text}</span>;
    })}
  </div>
);

const VersionButton: React.FC<{ on: boolean; head: string; note: string; onSelect: () => void }> = ({
  on,
  head,
  note,
  onSelect,
}) => (
  <button type="button" className={`diary-history__version${on ? ' is-on' : ''}`} aria-pressed={on} onClick={onSelect}>
    <span className="diary-history__when">{head}</span>
    <span className="diary-history__note">{note}</span>
  </button>
);

/** How many versions of a page the database keeps (HistoryRepository trims the older ones). */
export const DIARY_VERSIONS_KEPT = 10;

/**
 * What the oldest version in the list is called: "primeira versão" only while the list is not trimmed; once the
 * database holds its limit, older ones may have been dropped and it is just the oldest that is still kept.
 *
 * @example oldestNote(3) // 'primeira versão'; oldestNote(10) // 'mais antiga guardada'
 */
export function oldestNote(count: number): string {
  return count >= DIARY_VERSIONS_KEPT ? 'mais antiga guardada' : 'primeira versão';
}

/**
 * The versions of a diary page (board 180): the list at the left, the current page first, each version with what
 * differs from the current text; at the right the chosen version with that difference marked. The current text becomes
 * a version before being replaced, so restoring loses nothing.
 *
 * Usage:
 *   {showHistory && <DiaryHistoryDialog title="Critérios" current={text} versions={versions} onRestore={restore} onClose={close} />}
 */
export const DiaryHistoryDialog: React.FC<DiaryHistoryDialogProps> = ({
  title,
  current,
  versions,
  onRestore,
  onClose,
}) => {
  const [chosen, setChosen] = useState<string>(versions.length > 0 ? String(versions[0].id) : CURRENT);
  const version = versions.find((v) => String(v.id) === chosen) ?? null;
  const oldest = versions[versions.length - 1];
  return (
    <Modal
      label="Histórico de Versões"
      title={`Versões de “${title}”`}
      description="Salvas sozinhas enquanto você escreve"
      onClose={onClose}
      width={700}
    >
      <div className="diary-history">
        <div className="diary-history__list" role="group" aria-label="Versões">
          <VersionButton
            on={chosen === CURRENT}
            head="Atual"
            note="a página como está"
            onSelect={() => setChosen(CURRENT)}
          />
          {versions.map((v) => (
            <VersionButton
              key={v.id}
              on={chosen === String(v.id)}
              head={versionStamp(v.updated_at)}
              note={v === oldest ? oldestNote(versions.length) : changeSummary(v.content, current)}
              onSelect={() => setChosen(String(v.id))}
            />
          ))}
        </div>
        <div className="diary-history__body">
          {versions.length === 0 && <p className="diary-history__empty">Nenhuma versão anterior encontrada.</p>}
          {version && (
            <>
              <Legend />
              <VersionText version={version.content} current={current} />
            </>
          )}
          {versions.length > 0 && !version && <div className="diary-history__text">{current}</div>}
        </div>
      </div>
      <ModalFooter hint="A versão atual vira uma versão antes de ser trocada">
        <Button variant="primary" disabled={!version} onClick={() => version && onRestore(version.id)}>
          Restaurar esta versão
        </Button>
      </ModalFooter>
    </Modal>
  );
};
