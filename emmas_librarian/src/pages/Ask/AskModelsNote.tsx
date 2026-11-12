import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useProjectService } from '../../contexts/ServicesContext';
import { askModelsText, type AskModelsText } from './askModels';

/**
 * Under the box where the question is typed: which model writes the answer and which one searches the PDFs, with the way
 * to change them. Nothing is shown until the settings are read, and a failure to read them hides the note: it must not
 * name a model it does not know.
 *
 * @example <AskModelsNote />
 */
export const AskModelsNote: React.FC = () => {
  const service = useProjectService();
  const [models, setModels] = useState<AskModelsText | null>(null);
  useEffect(() => {
    let alive = true;
    service
      .getAiModelConfigs()
      .then((configs) => alive && setModels(askModelsText(configs)))
      .catch((err: unknown) => console.error('Não foi possível ler os modelos de IA:', err));
    return () => {
      alive = false;
    };
  }, [service]);
  if (!models) return null;
  return (
    <p className="ask-models" aria-label="Modelos usados">
      <span>
        Responde com <strong>{models.answer}</strong>
      </span>
      <span>
        Busca nos PDFs com <strong>{models.search}</strong>
      </span>
      <Link to="/settings/ai">Mudar nas configurações</Link>
    </p>
  );
};
