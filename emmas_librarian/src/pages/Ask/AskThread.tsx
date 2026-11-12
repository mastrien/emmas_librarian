import React, { useEffect, useRef } from 'react';
import { AlertTriangle, Copy } from 'lucide-react';
import type { AskAnswer, AskClaim, AskConversation, AskReadCitation } from '../../types';
import {
  answerAsText,
  answerSources,
  auditNotice,
  citationLabel,
  sourceNumber,
  stepText,
  unverifiedReason,
} from './askDisplay';
import { AskRings, AskRingsStill } from './AskRings';
import { useSpeakingAfterAnswer } from './useSpeakingAfterAnswer';

/** The citation open in the side panel. */
export type PickedCitation = AskReadCitation;

const ClaimItem: React.FC<{
  claim: AskClaim<AskReadCitation>;
  sources: AskReadCitation[];
  picked: PickedCitation | null;
  onPick: (citation: PickedCitation) => void;
}> = ({ claim, sources, picked, onPick }) => (
  <li className={claim.unverified ? 'ask-claim ask-claim--unverified' : 'ask-claim'}>
    {claim.text}
    {claim.unverified && (
      <span className="ask-flag">
        <AlertTriangle size={13} aria-hidden="true" /> {unverifiedReason(claim.unverified)}
      </span>
    )}
    {claim.citations.length > 0 && (
      <span className="ask-cites">
        {claim.citations.map((citation, i) => (
          <button
            key={`${citation.articleId}-${citation.page}-${i}`}
            type="button"
            className="ask-cite"
            aria-pressed={picked === citation}
            aria-label={citationLabel(citation)}
            title={citationLabel(citation)}
            onClick={() => onPick(citation)}
          >
            {sourceNumber(sources, citation)}
          </button>
        ))}
      </span>
    )}
  </li>
);

const AnswerBlock: React.FC<{
  answer: AskAnswer<AskReadCitation>;
  picked: PickedCitation | null;
  onPick: (citation: PickedCitation) => void;
}> = ({ answer, picked, onPick }) => {
  const marked = answer.claims.filter((claim) => claim.unverified).length;
  const sources = answerSources(answer);
  return (
    <div className="ask-answer">
      {answer.steps.map((step, i) => (
        <div key={i} className="ask-step">
          {stepText(step)}
        </div>
      ))}
      {marked > 0 && (
        <div className="ask-audit" role="note">
          <strong>{auditNotice(marked)}</strong> A IA pode ter inventado o que está marcado. Confira nos artigos antes
          de usar.
        </div>
      )}
      {answer.claims.length === 0 ? (
        <p className="ask-none">
          Os trechos lidos não respondem a esta pergunta. Os artigos sem índice ou sem PDF não foram considerados.
        </p>
      ) : (
        <>
          <ul className="ask-claims">
            {answer.claims.map((claim, i) => (
              <ClaimItem key={i} claim={claim} sources={sources} picked={picked} onPick={onPick} />
            ))}
          </ul>
          <div className="ask-foot">
            <button
              type="button"
              className="ask-copy"
              onClick={() => void navigator.clipboard?.writeText(answerAsText(answer))}
            >
              <Copy size={14} aria-hidden="true" /> Copiar
            </button>
            <span>
              Respostas de IA podem errar: abra as citações para conferir.
              {sources.length > 0 && ` ${sources.length} ${sources.length === 1 ? 'fonte' : 'fontes'}.`}
            </span>
          </div>
        </>
      )}
    </div>
  );
};

// The rings above the question wait with the page and go away with it, when the first question is sent.
const Empty: React.FC<{ note?: React.ReactNode }> = ({ note }) => (
  <div className="ask-empty">
    <AskRings size="hero" />
    <h2>O que você quer saber?</h2>
    <p className="ask-muted">A resposta vem dos PDFs dos projetos escolhidos, com artigo e página em cada afirmação.</p>
    {note}
  </div>
);

/** An answer with the rings beside it (board 168): alive on the last one, still on the ones before. */
const Reply: React.FC<{ live: boolean; state?: 'idle' | 'thinking' | 'speaking'; children: React.ReactNode }> = ({
  live,
  state = 'idle',
  children,
}) => (
  <div className="ask-reply">
    {live ? <AskRings size="avatar" state={state} /> : <AskRingsStill />}
    <div className="ask-reply__body">{children}</div>
  </div>
);

/**
 * The messages of the conversation, with the question on its way at the end.
 *
 * @example <AskThread conversation={conversation} pending={null} picked={null} onPick={setPicked} />
 */
export const AskThread: React.FC<{
  conversation: AskConversation | null;
  pending: string | null;
  picked: PickedCitation | null;
  onPick: (citation: PickedCitation) => void;
  /** Shown under the empty page's text: the models that will answer. */
  note?: React.ReactNode;
}> = ({ conversation, pending, picked, onPick, note }) => {
  const end = useRef<HTMLDivElement>(null);
  const messages = conversation?.messages ?? [];
  const speaking = useSpeakingAfterAnswer(pending);
  useEffect(() => {
    end.current?.scrollIntoView?.({ block: 'end' });
  }, [messages.length, pending]);
  if (messages.length === 0 && !pending) return <Empty note={note} />;
  const lastAnswer = messages.filter((m) => m.role === 'assistant' && m.answer).at(-1);
  return (
    <div className="ask-thread" role="log" aria-label="Conversa">
      {messages.map((message) =>
        message.role === 'assistant' && message.answer ? (
          <Reply key={message.id} live={!pending && message === lastAnswer} state={speaking ? 'speaking' : 'idle'}>
            <AnswerBlock answer={message.answer} picked={picked} onPick={onPick} />
          </Reply>
        ) : (
          <div key={message.id} className="ask-question">
            {message.content}
          </div>
        ),
      )}
      {pending && (
        <>
          <div className="ask-question">{pending}</div>
          <Reply live state="thinking">
            {/* The rings are the loading; the words stay for screen readers only. */}
            <div className="visually-hidden" role="status">
              Lendo os PDFs…
            </div>
          </Reply>
        </>
      )}
      <div ref={end} />
    </div>
  );
};
