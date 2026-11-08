import React from 'react';
import { Trash2, RotateCcw, X } from 'lucide-react';
import type { TrashItem } from '../../../types';
import { SettingsCard } from './SettingsCard';

type TrashType = TrashItem['type'];

interface TrashSettingsProps {
  trashItems: TrashItem[];
  handleEmptyTrash: () => void;
  handleRestore: (type: TrashType, id: number) => void;
  handlePermanentDelete: (type: TrashType, id: number) => void;
}

const TYPE_LABELS: Record<TrashType, string> = { project: 'Projeto', article: 'Artigo', annotation: 'Anotação' };

const TrashRow: React.FC<{ item: TrashItem; onRestore: () => void; onDelete: () => void }> = ({
  item,
  onRestore,
  onDelete,
}) => (
  <div className="trash-item">
    <div>
      <div className="trash-item-names">
        <span className={`trash-badge trash-badge--${item.type}`}>{TYPE_LABELS[item.type]}</span>
        <span className="trash-item-title">{item.title}</span>
      </div>
      <div className="trash-item-date">Excluído em: {new Date(item.deleted_at).toLocaleString()}</div>
    </div>
    <div className="trash-item-actions">
      <button onClick={onRestore} className="btn-secondary settings-small-button">
        <RotateCcw size={14} /> Restaurar
      </button>
      <button onClick={onDelete} className="btn-danger settings-small-button">
        <X size={14} /> Excluir
      </button>
    </div>
  </div>
);

/**
 * Settings → Lixeira: deleted projects, articles and annotations, each restorable or deletable for good.
 *
 * @example <TrashSettings trashItems={items} handleEmptyTrash={empty} handleRestore={restore} handlePermanentDelete={del} />
 */
export const TrashSettings: React.FC<TrashSettingsProps> = (props) => (
  <SettingsCard
    title="Lixeira (Trash Bin)"
    icon={<Trash2 size={24} />}
    iconTone="danger"
    description="Itens excluídos permanecem aqui e podem ser recuperados. Excluir permanentemente removerá os dados e os arquivos PDF do disco."
  >
    {props.trashItems.length === 0 ? (
      <div className="settings-empty">A lixeira está vazia.</div>
    ) : (
      <div>
        <div className="trash-toolbar">
          <button onClick={props.handleEmptyTrash} className="btn-danger trash-empty-button">
            <Trash2 size={16} /> Esvaziar Lixeira
          </button>
        </div>
        <div className="trash-list">
          {props.trashItems.map((item) => (
            <TrashRow
              key={`${item.type}-${item.id}`}
              item={item}
              onRestore={() => props.handleRestore(item.type, item.id)}
              onDelete={() => props.handlePermanentDelete(item.type, item.id)}
            />
          ))}
        </div>
      </div>
    )}
  </SettingsCard>
);
