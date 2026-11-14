import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useProjectService } from '../contexts/ServicesContext';
import { useDialogs } from '../components/common/dialogs/DialogProvider';
import { describeError } from '../utils/describeError';
import { importProjectWithFeedback } from '../utils/importProjectWithFeedback';
import './newProject.css';

/** What comes after creating a project (board 152), in the order the work usually goes. */
const NEXT_STEPS: readonly { title: string; note: string }[] = [
  {
    title: 'Buscar nas bases',
    note: 'OpenAlex, Crossref, Scopus, Web of Science, Europe PMC, arXiv e IEEE numa só busca.',
  },
  { title: 'Ou trazer o que já tem', note: 'Solte PDFs ou copie artigos de outro projeto.' },
  { title: 'Escrever os critérios', note: 'Eles guiam a triagem e as sugestões da IA.' },
];

// Raw (non-AppError) IPC failures carry Electron's "Error invoking remote method '<channel>':" prefix.
const creationError = (err: unknown): string =>
  describeError(err, 'Erro ao criar projeto').replace(/^Error:\s*Error\s*invoking\s*remote\s*method\s*'.*?':\s*/i, '');

const NextSteps: React.FC = () => (
  <aside className="new-project__after" aria-label="Depois de criar">
    <span className="new-project__eyebrow">Depois de criar</span>
    <ol className="new-project__steps">
      {NEXT_STEPS.map((step, index) => (
        <li key={step.title} className="new-project__step">
          <span className="new-project__step-number" aria-hidden="true">
            {index + 1}
          </span>
          <div>
            <strong>{step.title}</strong>
            <span>{step.note}</span>
          </div>
        </li>
      ))}
    </ol>
  </aside>
);

/**
 * "Novo projeto" (board 152): the name, with the way to import an existing project and, beside it, what usually
 * comes after creating one. Enter creates; Cancelar goes back to the home.
 *
 * @example <Route path="/new-project" element={<NewProjectPage />} />
 */
export const NewProjectPage: React.FC = () => {
  const projectService = useProjectService();
  const { inform } = useDialogs();
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    setError(null);
    try {
      const project = await projectService.createProject(name);
      navigate(`/projects/${project.id}`);
    } catch (err: unknown) {
      setError(creationError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    const newId = await importProjectWithFeedback(projectService, inform);
    if (newId) navigate(`/projects/${newId}`);
  };

  return (
    <div className="fade-in new-project">
      <form onSubmit={handleCreate} className="card new-project__card">
        <div className="new-project__titles">
          <h1>Novo projeto</h1>
          <p>Um projeto reúne os artigos, as buscas e as decisões de uma revisão.</p>
        </div>

        <div className="new-project__field">
          <label htmlFor="new-project-name">Nome</label>
          <input
            id="new-project-name"
            type="text"
            className="input-field"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Sistemas de Recomendação na Educação"
            required
            autoFocus
          />
          <span className="new-project__hint">Dá para mudar depois, no título do projeto.</span>
        </div>

        {error && (
          <div role="alert" className="new-project__error">
            {error}
          </div>
        )}

        <div className="new-project__actions">
          <button type="button" className="btn-ghost new-project__import" onClick={() => void handleImport()}>
            Importar um projeto (.emmapcarc)
          </button>
          <Link to="/" className="btn-ghost">
            Cancelar
          </Link>
          <button type="submit" disabled={loading || !name.trim()} className="btn-primary">
            {loading && <Loader2 className="animate-spin" size={16} aria-hidden="true" />}
            Criar projeto
            <kbd className="new-project__kbd" aria-hidden="true">
              Enter
            </kbd>
          </button>
        </div>
      </form>
      <NextSteps />
    </div>
  );
};
