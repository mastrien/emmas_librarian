import React, { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Link, NavLink } from 'react-router-dom';
import type { AskConversationSummary } from '../../types';
import { BackLink } from '../../components/common/BackLink';

const projectCount = (count: number) => (count === 1 ? '1 projeto' : `${count} projetos`);

const ConversationRow: React.FC<{
  conversation: AskConversationSummary;
  onPick: () => void;
  onRemove: () => void;
}> = ({ conversation, onPick, onRemove }) => {
  const [confirming, setConfirming] = useState(false);
  if (confirming) {
    return (
      <div className="ask-conv-confirm">
        <span>Apagar esta conversa? As respostas se perdem.</span>
        <span className="ask-conv-confirm-actions">
          <button type="button" className="btn-secondary ask-small" onClick={() => setConfirming(false)}>
            Cancelar
          </button>
          <button type="button" className="btn-danger ask-small" onClick={onRemove}>
            Apagar
          </button>
        </span>
      </div>
    );
  }
  return (
    <div className="ask-conv-row">
      <NavLink to={`/ask/${conversation.id}`} className="ask-conv" onClick={onPick}>
        {conversation.title}
        <small>{projectCount(conversation.project_count)}</small>
      </NavLink>
      <button
        type="button"
        className="ask-x"
        aria-label={`Apagar a conversa: ${conversation.title}`}
        onClick={() => setConfirming(true)}
      >
        <X size={14} aria-hidden="true" />
      </button>
    </div>
  );
};

/**
 * The kept conversations, and the way back and to a new one.
 *
 * @example <AskSidebar conversations={list} onRemove={remove} onPick={closeDrawer} />
 */
export const AskSidebar: React.FC<{
  conversations: AskConversationSummary[];
  onRemove: (id: number) => void;
  onPick: () => void;
}> = ({ conversations, onRemove, onPick }) => (
  <nav className="ask-side" aria-label="Conversas">
    <BackLink to="/">Voltar aos projetos</BackLink>
    <Link to="/ask" className="btn-primary ask-new" onClick={onPick}>
      <Plus size={16} aria-hidden="true" /> Nova conversa
    </Link>
    <div className="ask-convs">
      {conversations.map((conversation) => (
        <ConversationRow
          key={conversation.id}
          conversation={conversation}
          onPick={onPick}
          onRemove={() => onRemove(conversation.id)}
        />
      ))}
    </div>
  </nav>
);
