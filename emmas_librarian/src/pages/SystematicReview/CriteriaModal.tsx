import React, { useEffect, useState } from 'react';
import { Modal } from '../../components/common/Modal';
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

  return (
    <Modal
      label="Critérios de inclusão e exclusão"
      title="Critérios de inclusão e exclusão"
      description="Vão junto com título e resumo em cada sugestão. Salvos ao sair de cada campo."
      closeLabel="Fechar os critérios"
      onClose={close}
    >
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
    </Modal>
  );
};
