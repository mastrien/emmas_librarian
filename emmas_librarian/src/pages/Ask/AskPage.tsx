import React, { useState } from 'react';
import { AlertCircle, ChevronsRight } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { SideDrawer } from '../../components/common/SideDrawer';
import { IndexRecalculationModal } from '../../components/modals/IndexRecalculationModal';
import { useFillWindowHeight } from '../../hooks/useFillWindowHeight';
import { useNarrowWindow } from '../../hooks/useNarrowWindow';
import { AskScopeBar } from './AskScopeBar';
import { AskSidebar } from './AskSidebar';
import { AskComposer, AskIndexNotice, AskSourcePanel } from './AskSidePieces';
import { AskThread, type PickedCitation } from './AskThread';
import { useAskPage } from './useAskPage';
import './ask.css';

/**
 * "Perguntar aos projetos" (#53): a chat over the PDFs of the projects chosen, reached from the dashboard. Prototype:
 * https://claude.ai/artifact/Jho1jyhLYCLWsMUML6a273. On narrow windows the side panels become drawers, as in #73.
 *
 * @example <Route path="/ask/:conversationId" element={<AskPage />} />
 */
export const AskPage: React.FC = () => {
  const params = useParams();
  const conversationId = params.conversationId ? Number(params.conversationId) : null;
  const ask = useAskPage(conversationId);
  const narrow = useNarrowWindow();
  const { setPage, height } = useFillWindowHeight();
  // Kept with its conversation, so opening another one closes the panel.
  const [opened, setOpened] = useState<{ conversationId: number | null; citation: PickedCitation } | null>(null);
  const picked = opened?.conversationId === conversationId ? opened.citation : null;
  const setPicked = (citation: PickedCitation | null) => setOpened(citation && { conversationId, citation });
  const [listOpen, setListOpen] = useState(false);

  const sidebar = (
    <AskSidebar conversations={ask.conversations} onRemove={ask.remove} onPick={() => setListOpen(false)} />
  );
  const source = picked && ask.conversation && (
    <AskSourcePanel citation={picked} conversationId={ask.conversation.id} onClose={() => setPicked(null)} />
  );
  const shownError = ask.error ?? ask.indexError;

  return (
    <div ref={setPage} className="ask-page" style={{ height }}>
      {narrow ? (
        listOpen && (
          <SideDrawer side="left" label="Conversas" onClose={() => setListOpen(false)}>
            {sidebar}
          </SideDrawer>
        )
      ) : (
        <div className="ask-side-pane">{sidebar}</div>
      )}
      <div className="ask-main">
        {narrow && (
          <button type="button" className="ask-list-open" onClick={() => setListOpen(true)}>
            <ChevronsRight size={16} aria-hidden="true" /> Conversas
          </button>
        )}
        <AskScopeBar projects={ask.projects} scope={ask.scope} onChange={ask.setScope} />
        <AskThread conversation={ask.conversation} pending={ask.pending} picked={picked} onPick={setPicked} />
        {shownError && (
          <div className="ask-error" role="alert">
            <AlertCircle size={16} aria-hidden="true" /> {shownError}
          </div>
        )}
        <AskIndexNotice
          coverage={ask.coverage}
          indexing={ask.indexing}
          failed={ask.failed}
          onIndex={ask.indexMissing}
        />
        <AskComposer
          hasScope={ask.scope.length > 0}
          canAsk={(ask.coverage?.indexed.length ?? 0) > 0}
          sending={ask.pending !== null}
          onSend={ask.send}
        />
      </div>
      {source &&
        (narrow ? (
          <SideDrawer side="right" label="Trecho citado" onClose={() => setPicked(null)}>
            {source}
          </SideDrawer>
        ) : (
          <aside className="ask-source-pane">{source}</aside>
        ))}
      {ask.confirming && (
        <IndexRecalculationModal
          plan={ask.confirming}
          running={false}
          confirmLabel="Recalcular"
          onConfirm={ask.confirmIndexing}
          onClose={ask.dismissIndexing}
        />
      )}
    </div>
  );
};
