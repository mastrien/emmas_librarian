import React, { memo, useMemo } from 'react';
import { BookOpen } from 'lucide-react';
import { MDXEditor, thematicBreakPlugin } from '@mdxeditor/editor';
import { notesEditorPlugins } from '../markdown/notesEditorSetup';
import { notesEditorTranslation } from '../markdown/notesEditorTranslation';
import '@mdxeditor/editor/style.css';

interface DiaryEditorProps {
  /** The text the editor opens with. It is read once: to show other text, mount another editor (key the page). */
  initialMarkdown: string;
  readOnly: boolean;
  /** `initialNormalize` is true when the editor itself rewrote what it loaded, which is not an edit of the person. */
  onChange: (markdown: string, initialNormalize: boolean) => void;
}

/**
 * Live-preview markdown editor for one diary page, in the reading font; its formatting bar shows only while editing.
 * It does not render again unless its props change, and its plugins are built once: the editor is the costly part of the
 * page, and every key already makes it work.
 *
 * Usage:
 *   <DiaryEditor initialMarkdown={content} readOnly={!edit} onChange={save.change} />
 */
export const DiaryEditor = memo(function DiaryEditor({ initialMarkdown, readOnly, onChange }: DiaryEditorProps) {
  // The shared formatting bar; thematic breaks stay so older pages with "---" still render them.
  const plugins = useMemo(() => [...notesEditorPlugins(), thematicBreakPlugin()], []);
  return (
    <div className={`notes-editor diary-editor${readOnly ? ' is-reading' : ''}`}>
      <MDXEditor
        markdown={initialMarkdown}
        readOnly={readOnly}
        onChange={onChange}
        placeholder="Escreva as anotações do dia…"
        contentEditableClassName="diary-editor__content"
        plugins={plugins}
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
