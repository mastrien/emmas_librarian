import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { MDXEditorMethods } from '@mdxeditor/editor';
import { useProjectService } from '../../contexts/ServicesContext';
import { DiaryEntry } from '../../types';
import { DiaryTimeline } from './diary/DiaryTimeline';
import { DiaryPageToolbar, type DiaryMode } from './diary/DiaryPageToolbar';
import { DiaryEditor, DiaryEmptyState } from './diary/DiaryEditor';
import { DiaryHistoryDialog, type DiaryVersion } from './diary/DiaryDialogs';
import { formatDiaryDate } from './diary/diaryDates';
import { localIsoDate } from '../../utils/localDate';
import { useDialogs } from './dialogs/DialogProvider';
import { usePageCommands } from './shell/palette/PageCommandsContext';
import './diary/diary.css';

interface DiarySectionProps {
  projectId: number;
}

const AUTOSAVE_DELAY_MS = 2000;
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
  const change = (next: DiaryMode) => {
    setMode(next);
    try {
      localStorage.setItem(MODE_KEY, next);
    } catch {
      /* blocked storage: keep the mode for this visit */
    }
  };
  return [mode, change];
}

const clockTime = () => new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

/**
 * Per-project research diary: one markdown page per day, auto-saved, with version history.
 *
 * Usage:
 *   <DiarySection projectId={project.id} />
 */
export const DiarySection: React.FC<DiarySectionProps> = ({ projectId }) => {
  const projectService = useProjectService();
  const { confirm } = useDialogs();
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [mode, setMode] = useDiaryMode();
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [historyList, setHistoryList] = useState<DiaryVersion[]>([]);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editorRef = useRef<MDXEditorMethods>(null);
  // The editor can emit a late onChange for the previous page right after switching dates.
  const currentEditDateRef = useRef<string | null>(null);

  const todayStr = localIsoDate();

  const loadEntries = useCallback(async () => {
    const data = await projectService.getDiaryEntries(projectId);
    setEntries(data as DiaryEntry[]);
  }, [projectId]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  const selectDate = useCallback(
    async (date: string) => {
      // Auto-save current before switching
      if (selectedDate && hasChanges && content.trim()) {
        await projectService.saveDiaryEntry(projectId, selectedDate, content);
      }
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      setSelectedDate(date);
      currentEditDateRef.current = date;
      setHasChanges(false);
      setSavedAt(null);
      const entry = await projectService.getDiaryEntry(projectId, date);
      const newContent = entry?.content || '';
      setContent(newContent);
      setTimeout(() => editorRef.current?.setMarkdown(newContent), 50);
    },
    [projectId, selectedDate, hasChanges, content],
  );

  const handleToday = async () => {
    if (!entries.some((e) => e.entry_date === todayStr)) {
      await projectService.saveDiaryEntry(projectId, todayStr, '');
      await loadEntries();
    }
    selectDate(todayStr);
  };

  const persist = async (date: string, text: string) => {
    setSaving(true);
    await projectService.saveDiaryEntry(projectId, date, text);
    await loadEntries();
    setSaving(false);
    setHasChanges(false);
    setSavedAt(clockTime());
  };

  const handleContentChange = (newContent: string) => {
    if (currentEditDateRef.current !== selectedDate) return;
    setContent(newContent);
    setHasChanges(true);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    const dateToSave = selectedDate;
    saveTimerRef.current = setTimeout(async () => {
      if (dateToSave && newContent.trim()) await persist(dateToSave, newContent);
    }, AUTOSAVE_DELAY_MS);
  };

  const handleDelete = async () => {
    if (!selectedDate) return;
    const message = `A página de ${formatDiaryDate(selectedDate)} será excluída permanentemente.`;
    if (!(await confirm({ title: 'Excluir página?', message, confirmLabel: 'Excluir', danger: true }))) return;
    await projectService.deleteDiaryEntry(projectId, selectedDate);
    setSelectedDate(null);
    setContent('');
    await loadEntries();
  };

  const handleOpenHistory = async () => {
    if (!selectedDate) return;
    try {
      setHistoryList((await projectService.getDiaryEntryHistory(projectId, selectedDate)) as DiaryVersion[]);
      setShowHistory(true);
    } catch (err) {
      console.error('Failed to load diary history:', err);
    }
  };

  const handleRestoreVersion = async (versionId: number) => {
    try {
      await projectService.restoreDiaryEntryVersion(versionId);
      if (selectedDate) {
        const entry = await projectService.getDiaryEntry(projectId, selectedDate);
        const newContent = entry?.content || '';
        setContent(newContent);
        editorRef.current?.setMarkdown(newContent);
        setHasChanges(false);
      }
      await loadEntries();
      setShowHistory(false);
    } catch (err) {
      console.error('Failed to restore diary version:', err);
    }
  };

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
        onSelect={selectDate}
      />
      <div className="diary-main">
        {selectedDate ? (
          <>
            <DiaryPageToolbar
              mode={mode}
              onModeChange={setMode}
              saving={saving}
              hasChanges={hasChanges}
              savedAt={savedAt}
              onOpenHistory={handleOpenHistory}
              onDelete={() => void handleDelete()}
            />
            <article className="diary-doc">
              <h2 className="diary-label diary-doc__date">{formatDiaryDate(selectedDate)}</h2>
              <DiaryEditor
                ref={editorRef}
                date={selectedDate}
                markdown={content}
                readOnly={mode === 'read'}
                onChange={handleContentChange}
              />
            </article>
          </>
        ) : (
          <DiaryEmptyState />
        )}
      </div>
      {showHistory && selectedDate && (
        <DiaryHistoryDialog
          date={selectedDate}
          versions={historyList}
          onRestore={handleRestoreVersion}
          onClose={() => setShowHistory(false)}
        />
      )}
    </div>
  );
};
