import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// Links leave the app: a new tab, with no way back into this page for the site that opens.
const ExternalLink: React.FC<React.AnchorHTMLAttributes<HTMLAnchorElement>> = ({ href, children }) => (
  <a href={href} target="_blank" rel="noreferrer noopener">
    {children}
  </a>
);

/**
 * Markdown written on the desktop (diary pages, notes), drawn formatted (#191). The wrapper this
 * project owns around react-markdown: HTML inside the text is shown as text, never interpreted, and
 * only web and mail links are kept, so content synced from a library cannot run anything here.
 *
 * @example <Markdown text={entry.content} />
 */
export const Markdown: React.FC<{ text: string; className?: string }> = ({ text, className }) => (
  <div className={['m-markdown', className].filter(Boolean).join(' ')}>
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ a: ExternalLink }}>
      {text}
    </ReactMarkdown>
  </div>
);
