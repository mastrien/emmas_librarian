import React from 'react';
import { useLocation } from 'react-router-dom';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  CopyPlus,
  Edit2,
  Loader2,
  Minus,
  PanelRight,
  Plus,
  Tags,
  Upload,
  X as XIcon,
} from 'lucide-react';
import { auditReturnFrom } from '../../../utils/auditReturn';
import { readerBackFrom } from '../../../utils/readerReturn';
import { HelpButton } from '../../../components/common/HelpButton';
import { HIGHLIGHT_COLORS } from '../../../components/reader/TipContent';
import type { Article } from '../../../types';
import { BackLink } from '../../../components/common/BackLink';
import './readerToolbar.css';

interface ArticleReaderToolbarProps {
  article: Article;
  hasLocalFile: boolean;
  uploading: boolean;
  scale: number;
  handleZoom: (updater: number | ((s: number) => number)) => void;
  handleFileUpload: () => void;
  handleUnlinkClick: () => void;
  setIsEditingMetadata: (val: boolean) => void;
  setIsCitationModalOpen: (val: boolean) => void;
  /** Pages of the open PDF; 0 until it is loaded (the page navigation waits for it). */
  numPages: number;
  currentPage: number;
  inputPage: string;
  setInputPage: (value: string) => void;
  goToPage: (page: number) => void;
  highlightColor: string;
  setHighlightColor: (color: string) => void;
  isRead: boolean;
  /** Archived articles are not marked as read from here. */
  canMarkRead: boolean;
  onToggleRead: () => void;
  isCategoriesOpen: boolean;
  onToggleCategories: () => void;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
}

const Separator: React.FC = () => <span className="reader-bar__sep" aria-hidden="true" />;

/** The icon button of the bar: a name for screen readers and a tooltip, no frame. */
const IconButton: React.FC<{
  label: string;
  onClick: () => void;
  disabled?: boolean;
  pressed?: boolean;
  children: React.ReactNode;
}> = ({ label, onClick, disabled, pressed, children }) => (
  <button
    type="button"
    className="reader-bar__icon"
    aria-label={label}
    title={label}
    aria-pressed={pressed}
    disabled={disabled}
    onClick={onClick}
  >
    {children}
  </button>
);

/** Previous, the page box and the next (board 169): the number is typed and confirmed with Enter. */
const PageNav: React.FC<
  Pick<ArticleReaderToolbarProps, 'numPages' | 'currentPage' | 'inputPage' | 'setInputPage' | 'goToPage'>
> = (props) => {
  const { numPages, currentPage, inputPage, setInputPage, goToPage } = props;
  const confirm = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    const page = parseInt(inputPage, 10);
    if (page >= 1 && page <= numPages) goToPage(page);
    else setInputPage(String(currentPage));
  };
  return (
    <div className="reader-bar__group">
      <IconButton label="Página anterior" disabled={currentPage <= 1} onClick={() => goToPage(currentPage - 1)}>
        <ChevronLeft size={18} />
      </IconButton>
      <input
        type="text"
        className="reader-bar__page"
        aria-label="Página atual"
        value={inputPage}
        onChange={(e) => setInputPage(e.target.value)}
        onBlur={() => setInputPage(String(currentPage))}
        onKeyDown={confirm}
      />
      <span className="reader-bar__muted">/ {numPages}</span>
      <IconButton label="Próxima página" disabled={currentPage >= numPages} onClick={() => goToPage(currentPage + 1)}>
        <ChevronRight size={18} />
      </IconButton>
    </div>
  );
};

/** Zoom out, the level (a click returns to 100%) and zoom in. */
const ZoomControls: React.FC<Pick<ArticleReaderToolbarProps, 'scale' | 'handleZoom'>> = ({ scale, handleZoom }) => (
  <div className="reader-bar__group">
    <IconButton label="Menos zoom" onClick={() => handleZoom((s) => Math.max(0.5, parseFloat((s - 0.1).toFixed(1))))}>
      <Minus size={16} />
    </IconButton>
    <button type="button" className="reader-bar__zoom" title="Voltar a 100%" onClick={() => handleZoom(1.0)}>
      {Math.round(scale * 100)}%
    </button>
    <IconButton label="Mais zoom" onClick={() => handleZoom((s) => Math.min(2.5, parseFloat((s + 0.1).toFixed(1))))}>
      <Plus size={16} />
    </IconButton>
  </div>
);

/** "Grifar:" and the colour a new highlight starts with; the popup of a selection can still change it. */
const HighlightColors: React.FC<Pick<ArticleReaderToolbarProps, 'highlightColor' | 'setHighlightColor'>> = (props) => (
  <div className="reader-bar__group" role="group" aria-label="Cor do grifo">
    <span className="reader-bar__muted">Grifar:</span>
    {HIGHLIGHT_COLORS.map((color) => (
      <button
        key={color}
        type="button"
        className={`reader-bar__dot${props.highlightColor === color ? ' is-on' : ''}`}
        style={{ backgroundColor: color }}
        aria-label={`Grifar em ${color}`}
        aria-pressed={props.highlightColor === color}
        onClick={() => props.setHighlightColor(color)}
      />
    ))}
  </div>
);

/** Where "back" leads: the audit, the page the reader was opened from, or the project (validation of epic #44). */
function useBackTarget(article: Article) {
  const routerState = useLocation().state;
  const toAudit = auditReturnFrom(routerState);
  const toPage = toAudit ? null : readerBackFrom(routerState);
  return {
    label: toAudit ? 'Voltar para a auditoria' : (toPage?.label ?? 'Voltar ao projeto'),
    path: toAudit
      ? `/projects/${toAudit.projectId}/investigation/${toAudit.investigationId}`
      : (toPage?.path ?? `/projects/${article.project_id}`),
    state: toAudit ? { openAudit: toAudit } : undefined,
  };
}

const RightActions: React.FC<ArticleReaderToolbarProps> = (props) => (
  <div className="reader-bar__group reader-bar__end">
    <button
      type="button"
      className="btn-secondary reader-bar__text"
      aria-pressed={props.isCategoriesOpen}
      onClick={props.onToggleCategories}
    >
      <Tags size={14} aria-hidden="true" /> Categorias
    </button>
    <button
      type="button"
      className="btn-secondary reader-bar__text"
      title="Gerar Citação"
      onClick={() => props.setIsCitationModalOpen(true)}
    >
      <CopyPlus size={14} aria-hidden="true" /> Citar
    </button>
    {props.canMarkRead && (
      <button
        type="button"
        className={props.isRead ? 'btn-secondary reader-bar__text' : 'btn-primary reader-bar__text'}
        onClick={props.onToggleRead}
      >
        <Check size={14} aria-hidden="true" /> {props.isRead ? 'Lido' : 'Marcar como lido'}
      </button>
    )}
    <IconButton label="Editar Metadados" onClick={() => props.setIsEditingMetadata(true)}>
      <Edit2 size={16} />
    </IconButton>
    <IconButton label="Desvincular PDF" onClick={props.handleUnlinkClick}>
      <XIcon size={16} />
    </IconButton>
    <HelpButton />
    <IconButton label="Painel lateral" pressed={props.sidebarOpen} onClick={props.onToggleSidebar}>
      <PanelRight size={18} />
    </IconButton>
  </div>
);

/**
 * The bar of the reader (board 169), one line of 48px: back, page, zoom and highlight colour on the left; Categorias,
 * Citar, "Marcar como lido" and the side panel on the right. Without a PDF it offers to link one instead.
 *
 * @example <ArticleReaderToolbar article={article} hasLocalFile scale={1} … />
 */
export const ArticleReaderToolbar: React.FC<ArticleReaderToolbarProps> = (props) => {
  const back = useBackTarget(props.article);
  return (
    <header className="reader-bar" aria-label="Barra do leitor">
      <BackLink to={back.path} state={back.state} label={back.label} />
      {/* The canvas puts the title in the title bar's path; that path does not know the article yet. */}
      <h2 className="reader-bar__title" title={props.article.title}>
        {props.article.title}
      </h2>
      <Separator />
      {!props.hasLocalFile ? (
        <div className="reader-bar__group reader-bar__end">
          <button
            type="button"
            className="btn-primary reader-bar__text"
            disabled={props.uploading}
            onClick={props.handleFileUpload}
          >
            {props.uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            Vincular PDF Local
          </button>
          <button
            type="button"
            className="btn-secondary reader-bar__text"
            title="Gerar Citação"
            onClick={() => props.setIsCitationModalOpen(true)}
          >
            <CopyPlus size={14} aria-hidden="true" /> Citar
          </button>
          <IconButton label="Editar Metadados" onClick={() => props.setIsEditingMetadata(true)}>
            <Edit2 size={16} />
          </IconButton>
          <HelpButton />
        </div>
      ) : (
        <>
          {props.numPages > 0 && <PageNav {...props} />}
          <Separator />
          <ZoomControls scale={props.scale} handleZoom={props.handleZoom} />
          <Separator />
          <HighlightColors highlightColor={props.highlightColor} setHighlightColor={props.setHighlightColor} />
          <RightActions {...props} />
        </>
      )}
    </header>
  );
};
