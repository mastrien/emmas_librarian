import { DIARY_CONFLICT } from './diary/useDiaryPageSave';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useProjectService } from '../../contexts/ServicesContext';
import { DiaryEntry } from '../../types';
import { DiaryTimeline } from './diary/DiaryTimeline';
import type { DiaryMode } from './diary/DiaryPageToolbar';
import { DiaryEmptyState } from './diary/DiaryEditor';
import { DiaryPage, type DiaryPageHandle } from './diary/DiaryPage';
import { DiaryHistoryDialog, type DiaryVersion } from './diary/DiaryDialogs';
import { diaryPageSummary } from './diary/diaryPages';
import { formatDiaryDate } from './diary/diaryDates';
import { localIsoDate } from '../../utils/localDate';
import { useDialogs } from './dialogs/DialogProvider';
import { usePageCommands } from './shell/palette/PageCommandsContext';
import './diary/diary.css';

interface DiarySectionProps {
  projectId: number;
}

const MODE_KEY = 'diary_mode';

// Ler/Editar stays as the user left it, from page to page and from one visit to the next (decision on the redesign
// canvas, board 155). Storage can be blocked: then it lasts for this visit only.
function useDiaryMode(): [DiaryMode, (mode: DiaryMode) => void] {
  const [mode, setMode] = useState<DiaryMode>(() => {
    try {
      return localStorage.getItem(MODE_KEY) === 'read' ? 'read' : 'edit';
    } catch {
      return 'edit';
    }
  });
  const change = useCallback((next: DiaryMode) => {
    setMode(next);
    try {
      localStorage.setItem(MODE_KEY, next);
    } catch {
      /* blocked storage: keep the mode for this visit */
    }
  }, []);
  return [mode, change];
}

/**
 * The diary's list of pages, as the service gives it, kept in step with what the open page saves: the first line of a
 * page changes in the list when it is saved, with no new read.
 */
function useDiaryEntries(projectId: number) {
  const projectService = useProjectService();
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const reload = useCallback(async () => {
    setEntries((await projectService.getDiaryEntries(projectId)) as DiaryEntry[]);
  }, [projectService, projectId]);
  useEffect(() => {
    void reload();
  }, [reload]);
  const saved = useCallback((date: string, text: string) => {
    setEntries((all) => all.map((e) => (e.entry_date === date ? { ...e, content: text } : e)));
  }, []);
  return { entries, reload, saved };
}

/**
 * Per-project research diary: one markdown page per day, auto-saved, with version history.
 *
 * Which page is open is just a date. The page itself (`DiaryPage`) reads its own text and saves its own text under its
 * own date, so opening another page cannot carry text from one to the other.
 *
 * Usage:
 *   <DiarySection projectId={project.id} />
 */
export const DiarySection: React.FC<DiarySectionProps> = ({ projectId }) => {
  const projectService = useProjectService();
  const { confirm } = useDialogs();
  const { entries, reload, saved } = useDiaryEntries(projectId);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  // Bumped to open the same page again from the database (a version restored, a change made elsewhere).
  const [pageVersion, setPageVersion] = useState(0);
  const [mode, setMode] = useDiaryMode();
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<{ versions: DiaryVersion[]; current: string }>({ versions: [], current: '' });
  const pageRef = useRef<DiaryPageHandle>(null);
  const todayStr = localIsoDate();

  const handleToday = async () => {
    if (!entries.some((e) => e.entry_date === todayStr)) {
      // The list may be older than the database: today's page can already exist (made in another window). The
      // database then refuses the empty write; the page is there, so it is read again and opened.
      await projectService.saveDiaryEntry(projectId, todayStr, '', null).catch((err: unknown) => {
        if ((err as { code?: string } | null)?.code !== DIARY_CONFLICT) throw err;
      });
      await reload();
    }
    setSelectedDate(todayStr);
  };

  const handleDelete = useCallback(async () => {
    if (!selectedDate) return;
    const message = `A página de ${formatDiaryDate(selectedDate)} será excluída permanentemente.`;
    if (!(await confirm({ title: 'Excluir página?', message, confirmLabel: 'Excluir', danger: true }))) return;
    // What is waiting would be saved on the way out and bring the page back.
    pageRef.current?.discard();
    await projectService.deleteDiaryEntry(projectId, selectedDate);
    setSelectedDate(null);
    await reload();
  }, [confirm, projectService, projectId, selectedDate, reload]);

  const handleOpenHistory = useCallback(async () => {
    if (!selectedDate) return;
    try {
      await pageRef.current?.flush();
      const [versions, entry] = await Promise.all([
        projectService.getDiaryEntryHistory(projectId, selectedDate),
        projectService.getDiaryEntry(projectId, selectedDate),
      ]);
      setHistory({ versions: versions as DiaryVersion[], current: entry?.content ?? '' });
      setShowHistory(true);
    } catch (err) {
      console.error('Failed to load diary history:', err);
    }
  }, [projectService, projectId, selectedDate]);

  const handleRestoreVersion = async (versionId: number) => {
    try {
      await projectService.restoreDiaryEntryVersion(versionId);
      setPageVersion((version) => version + 1);
      await reload();
      setShowHistory(false);
    } catch (err) {
      console.error('Failed to restore diary version:', err);
    }
  };

  const handleReload = useCallback(() => {
    setPageVersion((version) => version + 1);
    void reload();
  }, [reload]);

  usePageCommands('diary', [
    { id: 'diary:today', label: 'Diário: página de hoje', run: () => void handleToday() },
    ...(selectedDate
      ? [
          {
            id: 'diary:history',
            label: 'Diário: histórico de versões desta página',
            run: () => void handleOpenHistory(),
          },
          {
            id: 'diary:mode',
            label: mode === 'read' ? 'Diário: editar esta página' : 'Diário: só ler esta página',
            run: () => setMode(mode === 'read' ? 'edit' : 'read'),
          },
        ]
      : []),
  ]);
  return (
    <div className="diary">
      <DiaryTimeline
        entries={entries}
        selectedDate={selectedDate}
        today={todayStr}
        onToday={handleToday}
        onSelect={setSelectedDate}
      />
      <div className="diary-main">
        {selectedDate ? (
          <DiaryPage
            key={`${projectId}:${selectedDate}:${pageVersion}`}
            ref={pageRef}
            projectId={projectId}
            date={selectedDate}
            mode={mode}
            onModeChange={setMode}
            onSaved={saved}
            onOpenHistory={handleOpenHistory}
            onDelete={() => void handleDelete()}
            onReload={handleReload}
          />
        ) : (
          <DiaryEmptyState />
        )}
      </div>
      {showHistory && selectedDate && (
        <DiaryHistoryDialog
          key={`${selectedDate}:${pageVersion}`}
          title={diaryPageSummary(history.current) || formatDiaryDate(selectedDate)}
          current={history.current}
          versions={history.versions}
          onRestore={handleRestoreVersion}
          onClose={() => setShowHistory(false)}
        />
      )}
    </div>
  );
};
