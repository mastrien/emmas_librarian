import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProjectService } from '../../contexts/ServicesContext';
import type {
  AskConversation,
  AskConversationSummary,
  AskIndexPlan,
  AskIndexResult,
  Project,
  ProjectIndexCoverage,
} from '../../types';
import { describeError } from '../../utils/describeError';

// Kept with the projects it is about: when they change, what was known about the others simply stops applying.
interface IndexState {
  key: string;
  coverage: ProjectIndexCoverage | null;
  failed: AskIndexResult['failed'];
  error: string | null;
}

const indexStateOf = (key: string): IndexState => ({ key, coverage: null, failed: [], error: null });

/** The PDFs a question cannot read yet, and how indexing them is going. */
function useAskIndex(scope: number[], conversationId: number | null) {
  const service = useProjectService();
  const [stored, setStored] = useState<IndexState>(indexStateOf(''));
  const [indexing, setIndexing] = useState(false);
  const [confirming, setConfirming] = useState<AskIndexPlan | null>(null);
  const key = scope.join(',');
  const { coverage, failed, error } = stored.key === key ? stored : indexStateOf(key);

  useEffect(() => {
    if (key === '') return;
    let alive = true;
    service
      .getAskCoverage(key.split(',').map(Number))
      .then((found) => {
        if (alive) setStored({ ...indexStateOf(key), coverage: found });
      })
      .catch((err) => {
        if (alive) setStored({ ...indexStateOf(key), error: describeError(err) });
      });
    return () => {
      alive = false;
    };
    // conversationId: an article may have changed while another conversation was open.
  }, [key, conversationId, service]);

  const runIndexing = async (replaceIndex: boolean) => {
    setIndexing(true);
    try {
      const result = await service.indexAskMissing({ projectIds: scope }, replaceIndex);
      setStored({ key, coverage: result.coverage, failed: result.failed, error: null });
    } catch (err) {
      setStored({ key, coverage, failed: [], error: describeError(err) });
    } finally {
      setIndexing(false);
    }
  };

  // Asks only when other PDFs would lose their vectors; the notice on the page already said the rest.
  const indexMissing = async () => {
    try {
      const plan = await service.getAskIndexPlan({ projectIds: scope });
      if (plan.othersLosingVectors > 0) setConfirming(plan);
      else await runIndexing(plan.sizeChanged);
    } catch (err) {
      setStored({ key, coverage, failed: [], error: describeError(err) });
    }
  };

  const confirmIndexing = () => {
    setConfirming(null);
    if (confirming) void runIndexing(confirming.sizeChanged);
  };
  const dismissIndexing = () => setConfirming(null);

  return { coverage, indexing, failed, indexError: error, indexMissing, confirming, confirmIndexing, dismissIndexing };
}

// What was loaded or went wrong, kept with the conversation it is about, so opening another one starts clean.
interface LoadedConversation {
  id: number | null;
  conversation: AskConversation | null;
  error: string | null;
}

/**
 * Everything the "Perguntar aos projetos" page shows and does (#53).
 *
 * @example const ask = useAskPage(conversationId);
 */
export function useAskPage(conversationId: number | null) {
  const service = useProjectService();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [conversations, setConversations] = useState<AskConversationSummary[]>([]);
  const [loaded, setLoaded] = useState<LoadedConversation>({ id: null, conversation: null, error: null });
  const [scope, setScope] = useState<number[]>([]);
  const [pending, setPending] = useState<string | null>(null);
  const current = loaded.id === conversationId ? loaded : { conversation: null, error: null };

  const refreshList = useCallback(() => {
    return service.getAskConversations().then(setConversations);
  }, [service]);

  useEffect(() => {
    void service.getProjects().then(setProjects);
    void refreshList();
  }, [service, refreshList]);

  useEffect(() => {
    if (conversationId === null) return;
    let alive = true;
    service
      .getAskConversation(conversationId)
      .then((found) => {
        if (!alive) return;
        setLoaded({ id: conversationId, conversation: found, error: null });
        setScope(found.projects.map((project) => project.id));
      })
      .catch((err) => {
        if (alive) setLoaded({ id: conversationId, conversation: null, error: describeError(err) });
      });
    return () => {
      alive = false;
    };
  }, [conversationId, service]);

  /** True when the question was answered and kept; on false the page gives the text back to the person. */
  const send = async (question: string): Promise<boolean> => {
    setPending(question);
    setLoaded({ id: conversationId, conversation: current.conversation, error: null });
    try {
      const updated = await service.sendAskQuestion({ conversationId, projectIds: scope, question });
      setLoaded({ id: updated.id, conversation: updated, error: null });
      void refreshList();
      if (updated.id !== conversationId) navigate(`/ask/${updated.id}`, { replace: true });
      return true;
    } catch (err) {
      setLoaded({ id: conversationId, conversation: current.conversation, error: describeError(err) });
      return false;
    } finally {
      setPending(null);
    }
  };

  const remove = async (id: number) => {
    await service.deleteAskConversation(id);
    await refreshList();
    if (id === conversationId) navigate('/ask');
  };

  return {
    projects,
    conversations,
    conversation: current.conversation,
    scope,
    setScope,
    pending,
    error: current.error,
    send,
    remove,
    ...useAskIndex(scope, conversationId),
  };
}
