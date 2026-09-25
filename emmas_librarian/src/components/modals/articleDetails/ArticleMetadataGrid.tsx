import React from 'react';
import {
  Calendar,
  User,
  BookOpen,
  Link as LinkIcon,
  GraduationCap,
  Building,
  Layers,
  Hash,
  Bookmark,
  type LucideIcon,
} from 'lucide-react';
import type { Article } from '../../../types';
import { formatVolumeIssuePages } from './articleDetailsFormat';

const captionStyle: React.CSSProperties = { fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 };

interface MetadataItemProps {
  Icon: LucideIcon;
  caption: string;
  valueStyle?: React.CSSProperties;
  children: React.ReactNode;
}

const MetadataItem: React.FC<MetadataItemProps> = ({ Icon, caption, valueStyle, children }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
    <Icon size={18} color="var(--text-muted)" style={{ flexShrink: 0 }} />
    <div>
      <div style={captionStyle}>{caption}</div>
      <div style={{ fontSize: '0.9rem', color: 'var(--text-main)', ...valueStyle }}>{children}</div>
    </div>
  </div>
);

const DoiLink: React.FC<{ doi: string }> = ({ doi }) => (
  <a
    href={`https://doi.org/${doi}`}
    target="_blank"
    rel="noreferrer"
    style={{ color: 'var(--color-primary)', textDecoration: 'none' }}
    onMouseEnter={(e) => (e.currentTarget.style.textDecoration = 'underline')}
    onMouseLeave={(e) => (e.currentTarget.style.textDecoration = 'none')}
  >
    {doi}
  </a>
);

/**
 * Bibliographic facts of an article (authors, year, venue, pages, type, publisher, citations, DOI, ISSN).
 *
 * Usage:
 *   <ArticleMetadataGrid article={article} />
 */
export const ArticleMetadataGrid: React.FC<{ article: Article }> = ({ article }) => (
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
    <MetadataItem Icon={User} caption="AUTORES">
      {article.authors || 'N/A'}
    </MetadataItem>
    <MetadataItem Icon={Calendar} caption="ANO DE PUBLICAÇÃO">
      {article.year || 'N/A'}
    </MetadataItem>
    <MetadataItem Icon={BookOpen} caption="REVISTA / PERIÓDICO" valueStyle={{ fontStyle: 'italic' }}>
      {article.journal || 'N/A'}
    </MetadataItem>
    <MetadataItem Icon={Hash} caption="VOLUME / EDIÇÃO / PÁGINAS">
      {formatVolumeIssuePages(article)}
    </MetadataItem>
    <MetadataItem Icon={Layers} caption="TIPO DE DOCUMENTO" valueStyle={{ textTransform: 'capitalize' }}>
      {article.document_type || 'N/A'}
    </MetadataItem>
    <MetadataItem Icon={Building} caption="EDITORA (PUBLISHER)">
      {article.publisher || 'N/A'}
    </MetadataItem>
    <MetadataItem Icon={GraduationCap} caption="CITAÇÕES" valueStyle={{ fontWeight: 600 }}>
      🎓 {article.citation_count ?? '0'}
    </MetadataItem>
    <MetadataItem Icon={LinkIcon} caption="DOI" valueStyle={{ wordBreak: 'break-all' }}>
      {article.doi ? <DoiLink doi={article.doi} /> : 'N/A'}
    </MetadataItem>
    {article.issn && (
      <MetadataItem Icon={Bookmark} caption="ISSN">
        {article.issn}
      </MetadataItem>
    )}
  </div>
);
