import React, { useState, useEffect, useRef, useCallback } from 'react';
import { projectService } from '../services/api';
import { DiaryEntry } from '../types';
import { Plus, Trash2, Calendar, BookOpen, Save } from 'lucide-react';
import { createPortal } from 'react-dom';
import {
  MDXEditor,
  headingsPlugin,
  listsPlugin,
  quotePlugin,
  markdownShortcutPlugin,
  thematicBreakPlugin,
  linkPlugin,
  linkDialogPlugin,
  toolbarPlugin,
  BoldItalicUnderlineToggles,
  BlockTypeSelect,
  CreateLink,
  InsertThematicBreak,
  ListsToggle,
  UndoRedo,
  Separator,
  type MDXEditorMethods
} from '@mdxeditor/editor';
import '@mdxeditor/editor/style.css';

interface DiarySectionProps {
  projectId: number;
}

export const DiarySection: React.FC<DiarySectionProps> = ({ projectId }) => {
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editorRef = useRef<MDXEditorMethods>(null);

  const todayStr = new Date().toISOString().split('T')[0];

  const loadEntries = useCallback(async () => {
    const data = await projectService.getDiaryEntries(projectId);
    setEntries(data);
  }, [projectId]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  const selectDate = useCallback(async (date: string) => {
    // Auto-save current before switching
    if (selectedDate && hasChanges && content.trim()) {
      await projectService.saveDiaryEntry(projectId, selectedDate, content);
    }
    
    setSelectedDate(date);
    setHasChanges(false);
    const entry = await projectService.getDiaryEntry(projectId, date);
    const newContent = entry?.content || '';
    setContent(newContent);
    // Update the editor content via ref
    setTimeout(() => editorRef.current?.setMarkdown(newContent), 50);
  }, [projectId, selectedDate, hasChanges, content]);

  const handleToday = async () => {
    const exists = entries.find(e => e.entry_date === todayStr);
    if (!exists) {
      await projectService.saveDiaryEntry(projectId, todayStr, '');
      await loadEntries();
    }
    selectDate(todayStr);
  };

  const handleContentChange = (newContent: string) => {
    setContent(newContent);
    setHasChanges(true);
    
    // Auto-save after 2s of inactivity
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      if (selectedDate && newContent.trim()) {
        setSaving(true);
        await projectService.saveDiaryEntry(projectId, selectedDate, newContent);
        await loadEntries();
        setSaving(false);
        setHasChanges(false);
      }
    }, 2000);
  };

  const handleSave = async () => {
    if (!selectedDate) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setSaving(true);
    await projectService.saveDiaryEntry(projectId, selectedDate, content);
    await loadEntries();
    setSaving(false);
    setHasChanges(false);
  };

  const handleDelete = async () => {
    if (!selectedDate) return;
    await projectService.deleteDiaryEntry(projectId, selectedDate);
    setSelectedDate(null);
    setContent('');
    setConfirmDelete(false);
    await loadEntries();
  };

  const formatDate = (dateStr: string) => {
    const [y, m, d] = dateStr.split('-');
    const date = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
    return date.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  };

  const formatDateShort = (dateStr: string) => {
    const [y, m, d] = dateStr.split('-');
    const date = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
  };

  return (
    <div style={{ display: 'flex', gap: '1.5rem', minHeight: '500px' }}>
      {/* Timeline lateral */}
      <div style={{ width: '220px', flexShrink: 0 }}>
        <button onClick={handleToday} className="btn-primary" style={{ width: '100%', padding: '0.75rem', marginBottom: '1.5rem' }}>
          <Plus size={18} /> Página de Hoje
        </button>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          {entries.length === 0 && (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', textAlign: 'center', padding: '2rem 0' }}>
              Nenhuma entrada ainda. Clique em "Página de Hoje" para começar.
            </p>
          )}
          {entries.map(entry => {
            const isSelected = entry.entry_date === selectedDate;
            const isToday = entry.entry_date === todayStr;
            return (
              <button
                key={entry.entry_date}
                onClick={() => selectDate(entry.entry_date)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.75rem 1rem',
                  borderRadius: 'var(--radius-md)',
                  border: 'none',
                  background: isSelected ? 'rgba(var(--color-primary-rgb, 79, 70, 229), 0.1)' : 'transparent',
                  borderLeft: isSelected ? '3px solid var(--color-primary)' : '3px solid transparent',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all var(--transition-fast)',
                  color: isSelected ? 'var(--color-primary)' : 'var(--text-main)'
                }}
              >
                <Calendar size={14} style={{ flexShrink: 0, opacity: 0.6 }} />
                <div>
                  <div style={{ fontSize: '0.875rem', fontWeight: isSelected ? 600 : 400 }}>
                    {formatDateShort(entry.entry_date)}
                  </div>
                  {isToday && (
                    <div style={{ fontSize: '0.7rem', color: 'var(--color-primary)', fontWeight: 600 }}>Hoje</div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Área do editor */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {selectedDate ? (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.25rem', textTransform: 'capitalize' }}>
                {formatDate(selectedDate)}
              </h3>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                {saving && <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Salvando...</span>}
                {!saving && hasChanges && <span style={{ fontSize: '0.8rem', color: 'var(--color-primary)' }}>Não salvo</span>}
                {!saving && !hasChanges && selectedDate && content && <span style={{ fontSize: '0.8rem', color: 'var(--color-success)' }}>✓ Salvo</span>}
                <button onClick={handleSave} className="btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }} disabled={!hasChanges}>
                  <Save size={14} /> Salvar
                </button>
                <button onClick={() => setConfirmDelete(true)} className="btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem', color: 'var(--color-danger)' }}>
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
            
            <div style={{
              flex: 1,
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-lg)',
              overflow: 'hidden',
              background: 'var(--bg-surface)',
              minHeight: '400px',
            }} className="diary-editor-wrapper">
              <MDXEditor
                ref={editorRef}
                key={selectedDate}
                markdown={content}
                onChange={handleContentChange}
                placeholder="Escreva suas anotações do dia..."
                plugins={[
                  headingsPlugin(),
                  listsPlugin(),
                  quotePlugin(),
                  thematicBreakPlugin(),
                  linkPlugin(),
                  linkDialogPlugin(),
                  markdownShortcutPlugin(),
                  toolbarPlugin({
                    toolbarContents: () => (
                      <>
                        <UndoRedo />
                        <Separator />
                        <BoldItalicUnderlineToggles />
                        <Separator />
                        <BlockTypeSelect />
                        <Separator />
                        <ListsToggle />
                        <Separator />
                        <CreateLink />
                        <InsertThematicBreak />
                      </>
                    )
                  })
                ]}
              />
            </div>
            <p style={{ margin: '0.5rem 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Editor Markdown com visualização ao vivo. Use atalhos como <strong># </strong> para títulos, <strong>- </strong> para listas, <strong>Ctrl+B</strong> para negrito. Salva automaticamente após 2 segundos.
            </p>
          </>
        ) : (
          <div style={{ 
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            color: 'var(--text-muted)', gap: '1rem'
          }}>
            <div style={{ padding: '1.5rem', background: 'var(--bg-main)', borderRadius: '50%' }}>
              <BookOpen size={48} />
            </div>
            <h3 style={{ margin: 0, color: 'var(--text-heading)' }}>Diário do Projeto</h3>
            <p style={{ margin: 0, maxWidth: '400px', textAlign: 'center', lineHeight: '1.5' }}>
              Selecione uma data na timeline ou clique em "Página de Hoje" para começar a registrar suas anotações de pesquisa.
            </p>
          </div>
        )}
      </div>

      {/* Confirm delete modal */}
      {confirmDelete && createPortal(
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, backdropFilter: 'blur(4px)' }}>
          <div className="card fade-in" style={{ padding: '2rem', maxWidth: '400px', background: 'var(--bg-surface)', textAlign: 'center' }}>
            <h3 style={{ margin: '0 0 1rem 0' }}>Excluir página?</h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
              A página de <strong>{selectedDate && formatDate(selectedDate)}</strong> será excluída permanentemente.
            </p>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button onClick={() => setConfirmDelete(false)} className="btn-secondary" style={{ flex: 1 }}>Cancelar</button>
              <button onClick={handleDelete} className="btn-primary" style={{ flex: 1, background: 'var(--color-danger)' }}>Excluir</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
