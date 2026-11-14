import React, { forwardRef } from 'react';
import { BookOpen } from 'lucide-react';
import { MDXEditor, thematicBreakPlugin, type MDXEditorMethods } from '@mdxeditor/editor';
import { notesEditorPlugins } from '../markdown/notesEditorSetup';
import { notesEditorTranslation } from '../markdown/notesEditorTranslation';
import '@mdxeditor/editor/style.css';

interface DiaryEditorProps {
  date: string;
  markdown: string;
  readOnly: boolean;
  onChange: (markdown: string) => void;
}

/**
 * Live-preview markdown editor for one diary page, in the reading font; its formatting bar shows only while editing.
 * Keyed by date so switching pages starts a fresh editor instead of merging undo history.
 *
 * Usage:
 *   <DiaryEditor ref={editorRef} date={date} markdown={content} readOnly={!edit} onChange={onChange} />
 */
export const DiaryEditor = forwardRef<MDXEditorMethods, DiaryEditorProps>(function DiaryEditor(
  { date, markdown, readOnly, onChange },
  ref,
) {
  return (
    <div className={`diary-editor${readOnly ? ' is-reading' : ''}`}>
      <MDXEditor
        ref={ref}
        key={date}
        markdown={markdown}
        readOnly={readOnly}
        onChange={onChange}
        placeholder="Escreva as anotações do dia…"
        contentEditableClassName="diary-editor__content"
        // The shared formatting bar; thematic breaks stay so older pages with "---" still render them.
        plugins={[...notesEditorPlugins(), thematicBreakPlugin()]}
        translation={notesEditorTranslation}
      />
    </div>
  );
});

/**
 * Placeholder shown when no diary page is open.
 *
 * Usage:
 *   {!selectedDate && <DiaryEmptyState />}
 */
export const DiaryEmptyState: React.FC = () => (
  <div className="diary-empty">
    <BookOpen size={40} aria-hidden="true" />
    <h3>Diário do projeto</h3>
    <p>Uma página por dia para registrar decisões, dúvidas e o que foi feito. Abra a página de hoje para começar.</p>
  </div>
);
