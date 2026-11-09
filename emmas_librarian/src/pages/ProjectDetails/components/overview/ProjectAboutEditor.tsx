import React from 'react';
import { Check } from 'lucide-react';
import { MDXEditor } from '@mdxeditor/editor';
import '@mdxeditor/editor/style.css';
import { notesEditorPlugins } from '../../../../components/common/markdown/notesEditorSetup';
import { notesEditorTranslation } from '../../../../components/common/markdown/notesEditorTranslation';
import { useProjectAbout, type AboutSaveState } from './useProjectAbout';

const SAVE_LABELS: Record<AboutSaveState, string> = {
  idle: '',
  saving: 'Salvando…',
  saved: 'Salvo',
  error: 'Erro ao salvar',
};

const SaveStatus: React.FC<{ state: AboutSaveState }> = ({ state }) => (
  <span className={`overview-save overview-save--${state}`} role="status">
    {state === 'saved' && <Check size={14} aria-hidden="true" />}
    {SAVE_LABELS[state]}
  </span>
);

/**
 * "Sobre o projeto" (board 154): a markdown page for the goal, the research question and the next steps, with the
 * diary's formatting bar, saved as the user types. It is the first thing the project shows.
 *
 * @example <ProjectAboutEditor projectId={3} />
 */
export const ProjectAboutEditor: React.FC<{ projectId: number }> = ({ projectId }) => {
  const about = useProjectAbout(projectId);
  return (
    <section className="overview-about" aria-labelledby="overview-about-title">
      <div className="overview-about__head">
        <h2 id="overview-about-title" className="overview-section-title">
          Sobre o projeto
        </h2>
        <SaveStatus state={about.saveState} />
      </div>
      {about.markdown === null ? (
        <div className="overview-about__loading" aria-busy="true" />
      ) : (
        <div className="overview-about__editor">
          <MDXEditor
            key={projectId}
            markdown={about.markdown}
            onChange={about.onChange}
            placeholder="Objetivo, pergunta de pesquisa, próximos passos…"
            contentEditableClassName="overview-about__content"
            plugins={notesEditorPlugins()}
            translation={notesEditorTranslation}
          />
        </div>
      )}
    </section>
  );
};
