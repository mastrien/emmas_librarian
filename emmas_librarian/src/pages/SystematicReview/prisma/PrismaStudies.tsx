import React, { useState } from 'react';
import type { Article, PrismaRecords } from '../../../types';

/** What the study grouping can change; each call answers the records as they now are. */
export interface StudyActions {
  link: (articleId: number, otherId: number) => Promise<void>;
  unlink: (studyArticleId: number) => Promise<void>;
}

const FIELD: React.CSSProperties = { width: '100%', minWidth: 0, maxWidth: '100%', boxSizing: 'border-box' };
const LABEL: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: '0.2rem', fontSize: '0.8rem' };

// Studies with more than one included publication, each named by its first article.
function groupsOf(publications: Article[], records: PrismaRecords): { study: number; members: Article[] }[] {
  const studyOf = new Map(records.studyLinks.map((l) => [l.article_id, l.study_article_id]));
  const groups = new Map<number, Article[]>();
  publications.forEach((p) => {
    const study = studyOf.get(p.id) ?? p.id;
    groups.set(study, [...(groups.get(study) ?? []), p]);
  });
  return [...groups.entries()].filter(([, m]) => m.length > 1).map(([study, members]) => ({ study, members }));
}

const PublicationPicker: React.FC<{
  label: string;
  publications: Article[];
  value: string;
  onChange: (value: string) => void;
}> = ({ label, publications, value, onChange }) => (
  <label style={LABEL}>
    {label}
    <select style={FIELD} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Escolha a publicação</option>
      {publications.map((p) => (
        <option key={p.id} value={p.id}>
          {p.title}
          {p.year ? ` (${p.year})` : ''}
        </option>
      ))}
    </select>
  </label>
);

/**
 * The included publications that are of the same study (a preprint and the published paper, a conference
 * abstract and the full article) and the form to mark two of them. The included box counts studies from these
 * links, so nobody types the number of studies.
 *
 * @example <StudyGrouping publications={included} records={records} actions={actions} />
 */
export const StudyGrouping: React.FC<{ publications: Article[]; records: PrismaRecords; actions: StudyActions }> = ({
  publications,
  records,
  actions,
}) => {
  const [first, setFirst] = useState('');
  const [second, setSecond] = useState('');
  const canLink = first !== '' && second !== '' && first !== second;
  const link = async () => {
    await actions.link(Number(first), Number(second));
    setFirst('');
    setSecond('');
  };
  return (
    <section className="prisma-editor" aria-label="Publicações do mesmo estudo">
      <strong>Publicações do mesmo estudo</strong>
      <p className="review-muted" style={{ margin: 0 }}>
        Um estudo pode ter mais de uma publicação: um preprint e o artigo publicado, ou um resumo de congresso e o
        artigo completo. Marque quais são do mesmo estudo e o app conta os estudos sozinho.
      </p>
      {groupsOf(publications, records).map(({ study, members }) => (
        <div key={study} className="prisma-study">
          <span className="review-muted">1 estudo, {members.length} publicações</span>
          {members.map((m) => (
            <span key={m.id} style={{ overflowWrap: 'anywhere' }}>
              · {m.title}
            </span>
          ))}
          <button type="button" className="review-small" onClick={() => void actions.unlink(study)}>
            Desfazer
          </button>
        </div>
      ))}
      <PublicationPicker label="Publicação" publications={publications} value={first} onChange={setFirst} />
      <PublicationPicker
        label="é do mesmo estudo que"
        publications={publications}
        value={second}
        onChange={setSecond}
      />
      <button type="button" className="review-small" disabled={!canLink} onClick={() => void link()}>
        Marcar como mesmo estudo
      </button>
    </section>
  );
};
