import React, { forwardRef, useEffect, useImperativeHandle, useState } from 'react';

interface FakeMdxEditorProps {
  markdown: string;
  readOnly?: boolean;
  placeholder?: string;
  onChange?: (markdown: string, initialMarkdownNormalize: boolean) => void;
}

export interface FakeMdxEditorMethods {
  setMarkdown: (markdown: string) => void;
  getMarkdown: () => string;
}

/**
 * Named fake for `@mdxeditor/editor`'s MDXEditor. The real editor is built on
 * Lexical/contentEditable, which jsdom cannot drive; this textarea keeps the
 * same contract the app relies on: initial `markdown`, `onChange`, `readOnly`
 * and the imperative `setMarkdown` ref method.
 *
 * Usage:
 *   vi.mock('@mdxeditor/editor', async () => (await import('./fakes/FakeMdxEditor')).fakeMdxEditorModule);
 */
export const FakeMdxEditor = forwardRef<FakeMdxEditorMethods, FakeMdxEditorProps>(function FakeMdxEditor(
  { markdown, readOnly, placeholder, onChange },
  ref,
) {
  const [value, setValue] = useState(markdown);

  // The real editor rewrites what it loads into its own markdown ("* item" becomes "- item") and reports it as an
  // onChange flagged as normalization, not as an edit of the person.
  useEffect(() => {
    if (!/^\* /m.test(markdown)) return;
    const normalized = markdown.replace(/^\* /gm, '- ');
    setValue(normalized);
    onChange?.(normalized, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when it loads
  }, []);

  useImperativeHandle(ref, () => ({ setMarkdown: setValue, getMarkdown: () => value }), [value]);

  const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(event.target.value);
    onChange?.(event.target.value, false);
  };

  return (
    <textarea aria-label="editor" value={value} readOnly={readOnly} placeholder={placeholder} onChange={handleChange} />
  );
});

const noPlugin = () => null;
const NoToolbarItem = () => null;

export const fakeMdxEditorModule = {
  MDXEditor: FakeMdxEditor,
  headingsPlugin: noPlugin,
  listsPlugin: noPlugin,
  quotePlugin: noPlugin,
  markdownShortcutPlugin: noPlugin,
  thematicBreakPlugin: noPlugin,
  linkPlugin: noPlugin,
  linkDialogPlugin: noPlugin,
  toolbarPlugin: noPlugin,
  BoldItalicUnderlineToggles: NoToolbarItem,
  BlockTypeSelect: NoToolbarItem,
  CreateLink: NoToolbarItem,
  InsertThematicBreak: NoToolbarItem,
  ListsToggle: NoToolbarItem,
  UndoRedo: NoToolbarItem,
  Separator: NoToolbarItem,
};
