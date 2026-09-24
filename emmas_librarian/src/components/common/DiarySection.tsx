import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { MDXEditorMethods } from '@mdxeditor/editor';
import { useProjectService } from '../../contexts/ServicesContext';
import { DiaryEntry } from '../../types';
import { DiaryTimeline } from './diary/DiaryTimeline';
import { DiaryPageToolbar } from './diary/DiaryPageToolbar';
import { DiaryEditor, DiaryEmptyState } from './diary/DiaryEditor';
import { DeleteDiaryPageDialog, DiaryHistoryDialog, type DiaryVersion } from './diary/DiaryDialogs';

interface DiarySectionProps {
  projectId: number;
}

const AUTOSAVE_DELAY_MS = 2000;

/**
 * Per-project research diary: one markdown page per day, auto-saved, with version history.
 *
 * Usage:
 *   <DiarySection projectId={project.id} />
 */
export const DiarySection: React.FC<DiarySectionProps> = ({ projectId }) => {
  const projectService = useProjectService();
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [isEditMode, setIsEditMode] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [historyList, setHistoryList] = useState<DiaryVersion[]>([]);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editorRef = useRef<MDXEditorMethods>(null);
  // The editor can emit a late onChange for the previous page right after switching dates.
  const currentEditDateRef = useRef<string | null>(null);

  const todayStr = new Date().toISOString().split('T')[0];

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

  const handleSave = async () => {
    if (!selectedDate) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    await persist(selectedDate, content);
  };

  const handleDelete = async () => {
    if (!selectedDate) return;
    await projectService.deleteDiaryEntry(projectId, selectedDate);
    setSelectedDate(null);
    setContent('');
    setConfirmDelete(false);
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

  return (
    <div style={{ display: 'flex', gap: '1.5rem', minHeight: '500px' }}>
      <DiaryTimeline
        entries={entries}
        selectedDate={selectedDate}
        today={todayStr}
        onToday={handleToday}
        onSelect={selectDate}
      />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {selectedDate ? (
          <>
            <DiaryPageToolbar
              date={selectedDate}
              isEditMode={isEditMode}
              saving={saving}
              hasChanges={hasChanges}
              hasContent={!!content}
              onSave={handleSave}
              onOpenHistory={handleOpenHistory}
              onToggleEditMode={() => setIsEditMode(!isEditMode)}
              onDelete={() => setConfirmDelete(true)}
            />
            <DiaryEditor
              ref={editorRef}
              date={selectedDate}
              markdown={content}
              readOnly={!isEditMode}
              onChange={handleContentChange}
            />
          </>
        ) : (
          <DiaryEmptyState />
        )}
      </div>
      {confirmDelete && selectedDate && (
        <DeleteDiaryPageDialog date={selectedDate} onCancel={() => setConfirmDelete(false)} onConfirm={handleDelete} />
      )}
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
