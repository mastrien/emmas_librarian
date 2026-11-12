import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useProjectService } from '../../contexts/ServicesContext';
import { askModelsText, type AskModelsText } from './askModels';

/**
 * Under the empty page's text, one line each and faint: which model writes the answer, which one searches the PDFs, and
 * the way to change them. Nothing is shown until the settings are read, and a failure to read them hides the note: it must not
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
    <div className="ask-models" role="group" aria-label="Modelos usados">
      <span>Responde com {models.answer}</span>
      <span>Busca nos PDFs com {models.search}</span>
      <Link to="/settings/ai">Mudar nas configurações</Link>
    </div>
  );
};
