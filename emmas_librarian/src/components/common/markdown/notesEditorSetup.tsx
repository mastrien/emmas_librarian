import React from 'react';
import {
  headingsPlugin,
  listsPlugin,
  quotePlugin,
  markdownShortcutPlugin,
  linkPlugin,
  linkDialogPlugin,
  toolbarPlugin,
  BoldItalicUnderlineToggles,
  BlockTypeSelect,
  CreateLink,
  ListsToggle,
  Separator,
} from '@mdxeditor/editor';
import './notesEditor.css';

// One formatting bar for every markdown page of the app (decision on the redesign canvas: the diary and the
// project overview share it): bold, italic, heading, bullet list, task list and link.

/**
 * The buttons of the shared formatting bar.
 *
 * @example toolbarPlugin({ toolbarContents: () => <NotesToolbarContents /> })
 */
export const NotesToolbarContents: React.FC = () => (
  <>
    <BoldItalicUnderlineToggles options={['Bold', 'Italic']} />
    <Separator />
    <BlockTypeSelect />
    <Separator />
    <ListsToggle options={['bullet', 'check']} />
    <Separator />
    <CreateLink />
  </>
);

/**
 * The editor plugins behind that bar, plus markdown shortcuts ("# ", "- ", "[ ] ").
 *
 * @example <MDXEditor markdown={text} plugins={notesEditorPlugins()} />
 */
export function notesEditorPlugins() {
  return [
    headingsPlugin(),
    listsPlugin(),
    quotePlugin(),
    linkPlugin(),
    linkDialogPlugin(),
    markdownShortcutPlugin(),
    toolbarPlugin({ toolbarContents: () => <NotesToolbarContents /> }),
  ];
}
