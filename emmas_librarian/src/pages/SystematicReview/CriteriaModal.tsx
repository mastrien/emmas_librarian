import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useProjectService } from '../../contexts/ServicesContext';
import type { ScreeningCriteria } from '../../types';

/**
 * The inclusion and exclusion criteria of a project (#54), in free text. They save by themselves, like the settings.
 * Rendered only while open, so each opening reads what is stored.
 *
 * @example {writing && <CriteriaModal projectId={3} onClose={close} onSaved={setCriteria} />}
 */
export const CriteriaModal: React.FC<{
  projectId: number;
  onClose: () => void;
  onSaved?: (criteria: ScreeningCriteria) => void;
}> = ({ projectId, onClose, onSaved }) => {
  const service = useProjectService();
  const [criteria, setCriteria] = useState<ScreeningCriteria | null>(null);

  useEffect(() => {
    let alive = true;
    void service.getScreeningCriteria(projectId).then((found) => {
      if (alive) setCriteria(found);
    });
    return () => {
      alive = false;
    };
  }, [service, projectId]);

  const save = async () => {
    if (!criteria) return;
    await service.saveScreeningCriteria(projectId, criteria);
    onSaved?.(criteria);
  };

  const close = () => {
    void save().finally(onClose);
  };

  return createPortal(
    <div className="review-modal-overlay">
      <div className="card fade-in review-modal" role="dialog" aria-label="Critérios de inclusão e exclusão">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start' }}>
          <h2 style={{ margin: 0, fontSize: '1.15rem' }}>Critérios de inclusão e exclusão</h2>
          <button type="button" className="review-x" aria-label="Fechar os critérios" onClick={close}>
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <p className="review-muted" style={{ margin: 0 }}>
          Vão junto com título e resumo em cada sugestão. Salvos ao sair de cada campo.
        </p>
        {criteria && (
          <>
            <label className="review-field">
              <span>Incluir quando</span>
              <textarea
                className="input-field"
                rows={4}
                value={criteria.inclusion}
                onChange={(e) => setCriteria({ ...criteria, inclusion: e.target.value })}
                onBlur={() => void save()}
              />
            </label>
            <label className="review-field">
              <span>Excluir quando</span>
              <textarea
                className="input-field"
                rows={4}
                value={criteria.exclusion}
                onChange={(e) => setCriteria({ ...criteria, exclusion: e.target.value })}
                onBlur={() => void save()}
              />
            </label>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
};
