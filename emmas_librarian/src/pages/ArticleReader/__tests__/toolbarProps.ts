import { vi } from 'vitest';
import type { ComponentProps } from 'react';
import type { Article } from '../../../types';
import type { ArticleReaderToolbar } from '../components/ArticleReaderToolbar';

type ToolbarProps = ComponentProps<typeof ArticleReaderToolbar>;

/**
 * The props of the reader's bar for a test: a PDF linked and open on page 1 of 10, every callback a mock, anything
 * overridable.
 *
 * @example render(<ArticleReaderToolbar {...toolbarProps(article, { isRead: true })} />)
 */
export function toolbarProps(article: Article, overrides: Partial<ToolbarProps> = {}): ToolbarProps {
  return {
    article,
    hasLocalFile: true,
    uploading: false,
    scale: 1,
    handleZoom: vi.fn(),
    handleFileUpload: vi.fn(),
    handleUnlinkClick: vi.fn(),
    setIsEditingMetadata: vi.fn(),
    setIsCitationModalOpen: vi.fn(),
    numPages: 10,
    currentPage: 1,
    inputPage: '1',
    setInputPage: vi.fn(),
    goToPage: vi.fn(),
    highlightColor: 'yellow',
    setHighlightColor: vi.fn(),
    isRead: false,
    canMarkRead: true,
    onToggleRead: vi.fn(),
    isCategoriesOpen: false,
    onToggleCategories: vi.fn(),
    sidebarOpen: true,
    onToggleSidebar: vi.fn(),
    ...overrides,
  };
}
