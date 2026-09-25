import React, { forwardRef } from 'react';
import { BookOpen } from 'lucide-react';
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
  type MDXEditorMethods,
} from '@mdxeditor/editor';
import '@mdxeditor/editor/style.css';

interface DiaryEditorProps {
  date: string;
  markdown: string;
  readOnly: boolean;
  onChange: (markdown: string) => void;
}

const DiaryToolbarContents: React.FC = () => (
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
);

/**
 * Live-preview markdown editor for one diary page. Keyed by date so switching pages
 * starts a fresh editor instead of merging undo history.
 *
 * Usage:
 *   <DiaryEditor ref={editorRef} date={date} markdown={content} readOnly={!edit} onChange={onChange} />
 */
export const DiaryEditor = forwardRef<MDXEditorMethods, DiaryEditorProps>(function DiaryEditor(
  { date, markdown, readOnly, onChange },
  ref,
) {
  return (
    <>
      <div
        style={{
          flex: 1,
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
          background: 'var(--bg-surface)',
          minHeight: '400px',
        }}
        className={`diary-editor-wrapper ${readOnly ? 'read-only-mode' : ''}`}
      >
        <MDXEditor
          ref={ref}
          key={date}
          markdown={markdown}
          readOnly={readOnly}
          onChange={onChange}
          placeholder="Escreva suas anotações do dia..."
          plugins={[
            headingsPlugin(),
            listsPlugin(),
            quotePlugin(),
            thematicBreakPlugin(),
            linkPlugin(),
            linkDialogPlugin(),
            markdownShortcutPlugin(),
            toolbarPlugin({ toolbarContents: () => <DiaryToolbarContents /> }),
          ]}
        />
      </div>
      <p style={{ margin: '0.5rem 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
        Editor Markdown com visualização ao vivo. Use atalhos como <strong># </strong> para títulos, <strong>- </strong>{' '}
        para listas, <strong>Ctrl+B</strong> para negrito. Salva automaticamente após 2 segundos.
      </p>
    </>
  );
});

/**
 * Placeholder shown when no diary page is open.
 *
 * Usage:
 *   {!selectedDate && <DiaryEmptyState />}
 */
export const DiaryEmptyState: React.FC = () => (
  <div
    style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'var(--text-muted)',
      gap: '1rem',
    }}
  >
    <div style={{ padding: '1.5rem', background: 'var(--bg-main)', borderRadius: '50%' }}>
      <BookOpen size={48} />
    </div>
    <h3 style={{ margin: 0, color: 'var(--text-heading)' }}>Diário do Projeto</h3>
    <p style={{ margin: 0, maxWidth: '400px', textAlign: 'center', lineHeight: '1.5' }}>
      Selecione uma data na timeline ou clique em "Página de Hoje" para começar a registrar suas anotações de pesquisa.
    </p>
  </div>
);
