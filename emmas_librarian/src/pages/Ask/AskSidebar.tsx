import React, { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Link, NavLink } from 'react-router-dom';
import type { AskConversationSummary } from '../../types';
import { conversationGroup } from './askDisplay';

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

/** The conversations in the order they come, split under their headings ("Hoje", "Agosto"…). */
function groupedConversations(conversations: AskConversationSummary[], now: Date) {
  const groups: { title: string; items: AskConversationSummary[] }[] = [];
  for (const conversation of conversations) {
    const title = conversationGroup(conversation.updated_at, now);
    const last = groups[groups.length - 1];
    if (last?.title === title) last.items.push(conversation);
    else groups.push({ title, items: [conversation] });
  }
  return groups;
}

/**
 * The kept conversations under their date headings, and "Nova conversa" with its key (Ctrl N, handled by the page).
 * The way back to the projects is the module rail.
 *
 * @example <AskSidebar conversations={list} onRemove={remove} onPick={closeDrawer} />
 */
export const AskSidebar: React.FC<{
  conversations: AskConversationSummary[];
  onRemove: (id: number) => void;
  onPick: () => void;
}> = ({ conversations, onRemove, onPick }) => (
  <nav className="ask-side" aria-label="Conversas">
    <Link to="/ask" className="btn-primary ask-new" onClick={onPick} aria-keyshortcuts="Control+N">
      <Plus size={16} aria-hidden="true" /> Nova conversa
      <kbd className="ask-new__key" aria-hidden="true">
        Ctrl N
      </kbd>
    </Link>
    <div className="ask-convs">
      {groupedConversations(conversations, new Date()).map((group) => (
        <div key={group.title} className="ask-conv-group">
          <span className="ask-conv-group__title">{group.title}</span>
          {group.items.map((conversation) => (
            <ConversationRow
              key={conversation.id}
              conversation={conversation}
              onPick={onPick}
              onRemove={() => onRemove(conversation.id)}
            />
          ))}
        </div>
      ))}
    </div>
  </nav>
);
