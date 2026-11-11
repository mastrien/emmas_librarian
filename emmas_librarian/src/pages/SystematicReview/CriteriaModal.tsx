import React, { useEffect, useState } from 'react';
import { Check, X } from 'lucide-react';
import { Modal } from '../../components/common/Modal';
import { ModalFooter } from '../../components/common/ModalFooter';
import { Button } from '../../components/common/Button';
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
      title="Critérios do projeto"
      description="Guiam a sua triagem e as sugestões da IA"
      closeLabel="Fechar os critérios"
      onClose={close}
    >
      {criteria && (
        <>
          <label className="review-field">
            <span className="review-field-name">
              <Check size={14} aria-hidden="true" style={{ color: 'var(--color-success)' }} />
              Incluir quando
            </span>
            <textarea
              className="input-field"
              rows={4}
              value={criteria.inclusion}
              onChange={(e) => setCriteria({ ...criteria, inclusion: e.target.value })}
              onBlur={() => void save()}
            />
          </label>
          <label className="review-field">
            <span className="review-field-name">
              <X size={14} aria-hidden="true" style={{ color: 'var(--color-danger)' }} />
              Excluir quando
            </span>
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
      <ModalFooter hint="Salvos ao sair de cada campo">
        <Button variant="primary" onClick={close}>
          Concluir
        </Button>
      </ModalFooter>
    </Modal>
  );
};
