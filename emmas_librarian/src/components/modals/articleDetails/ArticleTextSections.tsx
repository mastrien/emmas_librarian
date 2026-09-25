import React from 'react';
import { Tag } from 'lucide-react';
import type { Article } from '../../../types';
import { splitSemicolonList } from './articleDetailsFormat';
import { sectionCaptionStyle, sectionStyle } from './sectionStyles';

const boxStyle: React.CSSProperties = {
  color: 'var(--text-main)',
  background: 'var(--bg-surface)',
  borderRadius: 'var(--radius-md)',
  border: '1px solid var(--border-color)',
};

const tagStyle: React.CSSProperties = {
  padding: '0.2rem 0.5rem',
  background: 'var(--bg-surface)',
  border: '1px solid var(--border-color)',
  borderRadius: 'var(--radius-sm)',
  fontSize: '0.8rem',
  color: 'var(--text-main)',
};

/**
 * Affiliations, abstract, keywords and cited references; optional ones are hidden when empty.
 *
 * Usage:
 *   <ArticleTextSections article={article} />
 */
export const ArticleTextSections: React.FC<{ article: Article }> = ({ article }) => (
  <>
    {article.affiliations && (
      <div style={sectionStyle}>
        <div style={sectionCaptionStyle('0.25rem')}>AFILIAÇÕES</div>
        <div style={{ fontSize: '0.85rem', color: 'var(--text-main)', lineHeight: '1.4' }}>{article.affiliations}</div>
      </div>
    )}
    <div style={sectionStyle}>
      <div style={sectionCaptionStyle('0.5rem')}>RESUMO (ABSTRACT)</div>
      <div style={{ ...boxStyle, fontSize: '0.9rem', lineHeight: '1.6', padding: '1.25rem', whiteSpace: 'pre-wrap' }}>
        {article.abstract || 'Nenhum resumo disponível para este artigo.'}
      </div>
    </div>
    <KeywordSections authorKeywords={article.author_keywords} indexKeywords={article.index_keywords} />
    {article.references_list && <ReferenceList references={article.references_list} />}
  </>
);

const KeywordSections: React.FC<{ authorKeywords?: string; indexKeywords?: string }> = (props) => {
  const author = splitSemicolonList(props.authorKeywords);
  const index = splitSemicolonList(props.indexKeywords);
  if (author.length === 0 && index.length === 0) return null;
  return (
    <div style={{ ...sectionStyle, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <KeywordGroup caption="PALAVRAS-CHAVE DO AUTOR" keywords={author} />
      <KeywordGroup caption="PALAVRAS-CHAVE INDEXADAS" keywords={index} />
    </div>
  );
};

const KeywordGroup: React.FC<{ caption: string; keywords: string[] }> = ({ caption, keywords }) => {
  if (keywords.length === 0) return null;
  return (
    <div>
      <div style={{ ...sectionCaptionStyle('0.4rem'), display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
        <Tag size={12} /> {caption}
      </div>
      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
        {keywords.map((tag) => (
          <span key={tag} style={tagStyle}>
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
};

const ReferenceList: React.FC<{ references: string }> = ({ references }) => (
  <div style={sectionStyle}>
    <div style={sectionCaptionStyle('0.5rem')}>REFERÊNCIAS CITADAS</div>
    <div style={{ ...boxStyle, fontSize: '0.8rem', lineHeight: '1.5', padding: '1rem' }}>
      <ol style={{ margin: 0, paddingLeft: '1.25rem' }}>
        {references.split(';').map((ref, idx) => (
          <li key={idx} style={{ marginBottom: '0.5rem' }}>
            {ref.trim()}
          </li>
        ))}
      </ol>
    </div>
  </div>
);
