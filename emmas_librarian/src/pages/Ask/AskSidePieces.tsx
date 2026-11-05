import React, { useState } from 'react';
import { X } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import type { AskIndexProgress, AskIndexResult, AskReadCitation, ProjectIndexCoverage } from '../../types';
import { embeddingModelName, pdfCount } from '../../utils/pdfCount';
import { citationAccessNote, citationReaderState } from './askDisplay';

/**
 * The chunk a citation points to, kept with the answer, and the way to its page.
 *
 * @example <AskSourcePanel citation={citation} conversationId={3} onClose={close} />
 */
export const AskSourcePanel: React.FC<{
  citation: AskReadCitation;
  conversationId: number;
  onClose: () => void;
}> = ({ citation, conversationId, onClose }) => {
  const navigate = useNavigate();
  const note = citationAccessNote(citation);
  const { access } = citation;
  return (
    <div className="ask-source" aria-label="Trecho citado">
      <div className="ask-source-head">
        <h2>{citation.title}</h2>
        <button type="button" className="ask-x" aria-label="Fechar o trecho" onClick={onClose}>
          <X size={18} aria-hidden="true" />
        </button>
      </div>
      <p className="ask-muted">
        {[citation.authors, citation.year].filter(Boolean).join(' · ')}
        {citation.authors || citation.year ? ' · ' : ''}página {citation.page}
      </p>
      {note && (
        <p className="ask-source-note" role="note">
          {note}
        </p>
      )}
      <blockquote>{citation.text}</blockquote>
      {access.kind === 'open' && (
        <button
          type="button"
          className="btn-primary"
          onClick={() =>
            navigate(`/articles/${access.articleId}`, { state: citationReaderState(citation, conversationId) })
          }
        >
          Abrir no leitor, página {citation.page}
        </button>
      )}
    </div>
  );
};

const outdatedText = (count: number): string =>
  count === 1
    ? '1 PDF precisa ser recalculado com o modelo de embeddings atual para entrar nas respostas. Isso consome tokens.'
    : `${count} PDFs precisam ser recalculados com o modelo de embeddings atual para entrar nas respostas. Isso consome tokens.`;

/**
 * Says what the answers leave out, and offers to index it there. It disappears when nothing is missing.
 *
 * @example <AskIndexNotice coverage={coverage} indexing={false} progress={null} failed={[]} onIndex={index} />
 */
export const AskIndexNotice: React.FC<{
  coverage: ProjectIndexCoverage | null;
  indexing: boolean;
  progress?: AskIndexProgress | null;
  failed: AskIndexResult['failed'];
  onIndex: () => void;
}> = ({ coverage, indexing, progress = null, failed, onIndex }) => {
  const missing = coverage?.withoutIndex.length ?? 0;
  const outdated = coverage?.outdated.length ?? 0;
  const pending = missing + outdated;
  if (pending === 0) return null;
  return (
    <div className="ask-notices">
      <div className="ask-notice">
        {indexing ? (
          <span className="ask-step ask-step--running" role="status">
            {progress && progress.total > 0
              ? `Indexando ${progress.done + 1 > progress.total ? progress.total : progress.done + 1} de ${pdfCount(progress.total)}${progress.current ? `: ${progress.current}` : ''}…`
              : `Indexando ${pdfCount(pending)}…`}
          </span>
        ) : (
          <>
            <span>
              {missing > 0 && `${pdfCount(missing)} destes projetos ainda não entram nas respostas. `}
              {outdated > 0 && outdatedText(outdated)}
              {outdated > 0 && coverage?.previousModel && (
                <>
                  {' '}
                  Prefere não recalcular? Eles vieram de {embeddingModelName(coverage.previousModel)}: volte a esse
                  modelo em <Link to="/settings">Configurações</Link>.
                </>
              )}
            </span>
            <button type="button" className="btn-secondary ask-small" onClick={onIndex}>
              {outdated > 0 ? `Recalcular ${pdfCount(pending)}` : 'Indexar agora'}
            </button>
          </>
        )}
      </div>
      {failed.length > 0 && !indexing && <FailedList failed={failed} />}
    </div>
  );
};

const FailedList: React.FC<{ failed: AskIndexResult['failed'] }> = ({ failed }) => (
  <details className="ask-notice ask-notice--block">
    <summary>{pdfCount(failed.length)} não puderam ser indexados</summary>
    <ul>
      {failed.map((item) => (
        <li key={item.title}>
          {item.title}: {item.reason}
        </li>
      ))}
    </ul>
  </details>
);

const placeholderFor = (hasScope: boolean, canAsk: boolean): string => {
  if (!hasScope) return 'Escolha ao menos um projeto para perguntar';
  return canAsk
    ? 'Pergunte aos artigos destes projetos…'
    : 'Nenhum PDF destes projetos está indexado com o modelo atual';
};

/**
 * Where the question is written. Enter sends and Shift+Enter breaks the line, as in a chat; the text comes back when a
 * question fails, so nothing written is lost.
 *
 * @example <AskComposer canAsk sending={false} hasScope onSend={send} />
 */
export const AskComposer: React.FC<{
  hasScope: boolean;
  canAsk: boolean;
  sending: boolean;
  onSend: (question: string) => Promise<boolean>;
}> = ({ hasScope, canAsk, sending, onSend }) => {
  const [text, setText] = useState('');
  const blocked = sending || !canAsk || !text.trim();
  const submit = async () => {
    if (blocked) return;
    const question = text.trim();
    setText('');
    if (!(await onSend(question))) setText(question);
  };
  return (
    <form
      className="ask-composer"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <textarea
        className="input-field"
        aria-label="Sua pergunta"
        rows={2}
        value={text}
        placeholder={placeholderFor(hasScope, canAsk)}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== 'Enter' || e.shiftKey) return;
          e.preventDefault();
          void submit();
        }}
      />
      <button type="submit" className="btn-primary" disabled={blocked}>
        {sending ? 'Perguntando…' : 'Enviar'}
      </button>
    </form>
  );
};
