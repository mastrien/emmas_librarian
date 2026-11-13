import React from 'react';
import { failureNotice } from '../../common/dialogs/failureNotice';
import { Link } from 'react-router-dom';
import { Upload, Eye, Trash2 } from 'lucide-react';
import type { Article } from '../../../types';
import { useProjectService } from '../../../contexts/ServicesContext';
import { sectionCaptionStyle, sectionStyle } from './sectionStyles';
import { useDialogs } from '../../common/dialogs/DialogProvider';
import { UNLINK_PDF_QUESTION } from '../../common/dialogs/unlinkPdfQuestion';

interface ArticlePdfSectionProps {
  article: Article;
  onClose: () => void;
  onArticleUpdated?: () => void;
  onAttachPdf?: (article: Article) => void;
}

const actionStyle: React.CSSProperties = {
  padding: '0.3rem 0.75rem',
  borderRadius: 'var(--radius-md)',
  fontSize: '0.85rem',
  fontWeight: 600,
  display: 'flex',
  alignItems: 'center',
  gap: '0.4rem',
};

/**
 * Open, unlink or attach the article's PDF.
 *
 * Usage:
 *   <ArticlePdfSection article={article} onClose={close} onArticleUpdated={reload} onAttachPdf={attach} />
 */
export const ArticlePdfSection: React.FC<ArticlePdfSectionProps> = ({
  article,
  onClose,
  onArticleUpdated,
  onAttachPdf,
}) => {
  const projectService = useProjectService();
  const { confirm, inform } = useDialogs();

  const unlinkPdf = async () => {
    if (!(await confirm(UNLINK_PDF_QUESTION))) return;
    try {
      await projectService.unlinkPdf(article.id);
      onArticleUpdated?.();
    } catch (err) {
      await inform(failureNotice('Não conseguimos desvincular o PDF', 'O PDF continua ligado ao artigo.', err));
    }
  };

  return (
    <div style={sectionStyle}>
      <div style={sectionCaptionStyle('0.4rem')}>ARQUIVO PDF</div>
      {article.local_file_path ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Link
            to={`/articles/${article.id}`}
            onClick={onClose}
            className="btn-primary"
            style={{ ...actionStyle, textDecoration: 'none' }}
          >
            <Eye size={14} /> Visualizar PDF
          </Link>
          <button
            onClick={unlinkPdf}
            className="btn-secondary"
            style={{
              ...actionStyle,
              color: 'var(--color-danger)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              background: 'rgba(239, 68, 68, 0.05)',
              cursor: 'pointer',
            }}
          >
            <Trash2 size={14} /> Desvincular PDF
          </button>
        </div>
      ) : (
        <div>
          <button
            onClick={() => onAttachPdf?.(article)}
            className="btn-secondary"
            style={{ ...actionStyle, cursor: 'pointer' }}
          >
            <Upload size={14} /> Anexar PDF
          </button>
        </div>
      )}
    </div>
  );
};
