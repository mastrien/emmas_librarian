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

const Empty: React.FC = () => (
  <div className="ask-empty">
    <h2>O que você quer saber?</h2>
    <p className="ask-muted">A resposta vem dos PDFs dos projetos escolhidos, com artigo e página em cada afirmação.</p>
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
}> = ({ conversation, pending, picked, onPick }) => {
  const end = useRef<HTMLDivElement>(null);
  const messages = conversation?.messages ?? [];
  useEffect(() => {
    end.current?.scrollIntoView?.({ block: 'end' });
  }, [messages.length, pending]);
  if (messages.length === 0 && !pending) return <Empty />;
  return (
    <div className="ask-thread" role="log" aria-label="Conversa">
      {messages.map((message) =>
        message.role === 'assistant' && message.answer ? (
          <AnswerBlock key={message.id} answer={message.answer} picked={picked} onPick={onPick} />
        ) : (
          <div key={message.id} className="ask-question">
            {message.content}
          </div>
        ),
      )}
      {pending && (
        <>
          <div className="ask-question">{pending}</div>
          <div className="ask-step ask-step--running" role="status">
            Lendo os PDFs…
          </div>
        </>
      )}
      <div ref={end} />
    </div>
  );
};
