import React from 'react';
import { GripVertical, Pencil, Trash2 } from 'lucide-react';
import type { ProjectDocument } from '../../../types';
import { fileNameFromPath } from '../../../utils/formatters';
import { RowActionsButton } from '../../common/RowActionsButton';
import { groupDocuments } from './groupDocuments';
import { QuickAccessGroupHeader } from './QuickAccessGroupHeader';
import type { DocumentDrag } from './useDocumentDrag';
import './quickAccess.css';

interface QuickAccessDocumentListProps {
  /** In the order the groups show them (`inGroupOrder`): a drag moves a row by its place in this list. */
  documents: ProjectDocument[];
  editingId: number | null;
  drag: DocumentDrag;
  onEdit: (doc: ProjectDocument) => void;
  onDelete: (id: number) => void;
  onRenameGroup: (from: string, to: string) => void;
}

const DropGap: React.FC<{ gapIndex: number; drag: DocumentDrag }> = ({ gapIndex, drag }) => (
  <div
    data-testid="quick-access-drop-gap"
    className="quick-access-gap"
    onDragOver={(e) => drag.hoverGap(gapIndex, e)}
    onDrop={drag.drop}
  />
);

// A gap is pointless right before or after the dragged row: dropping there would not move it.
const showsGapBefore = (index: number, drag: DocumentDrag) =>
  drag.draggedIndex !== null &&
  drag.dropIndex === index &&
  drag.draggedIndex !== index &&
  drag.draggedIndex !== index - 1;

const showsGapAfterLast = (count: number, drag: DocumentDrag) =>
  drag.draggedIndex !== null && drag.dropIndex === count && drag.draggedIndex !== count - 1;

/**
 * The quick access documents by group, each a draggable line with a "⋯" for edit and remove (board 178), or an
 * empty-state message.
 *
 * Usage:
 *   <QuickAccessDocumentList documents={inGroupOrder(docs)} editingId={null} drag={drag} onEdit={edit} onDelete={remove} onRenameGroup={rename} />
 */
export const QuickAccessDocumentList: React.FC<QuickAccessDocumentListProps> = (props) => {
  const { documents, drag } = props;
  if (documents.length === 0) {
    return <div className="quick-access-empty">Nenhum link ou documento cadastrado.</div>;
  }
  return (
    <div
      className="quick-access-groups"
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      {groupDocuments(documents).map((group) => (
        <section key={group.name ?? ''} className="quick-access-group" aria-label={group.name ?? 'Sem grupo'}>
          {group.name && (
            <QuickAccessGroupHeader name={group.name} onRename={(to) => props.onRenameGroup(group.name!, to)} />
          )}
          {group.documents.map((doc) => {
            const index = documents.indexOf(doc);
            return (
              <React.Fragment key={doc.id}>
                {showsGapBefore(index, drag) && <DropGap gapIndex={index} drag={drag} />}
                <QuickAccessDocumentRow {...props} doc={doc} index={index} />
                {index === documents.length - 1 && showsGapAfterLast(documents.length, drag) && (
                  <DropGap gapIndex={documents.length} drag={drag} />
                )}
              </React.Fragment>
            );
          })}
        </section>
      ))}
    </div>
  );
};

const documentLocation = (doc: ProjectDocument) =>
  doc.url
    ? 'link externo'
    : `arquivo local · ${doc.local_file_path ? fileNameFromPath(doc.local_file_path) : 'anexado'}`;

interface QuickAccessDocumentRowProps extends QuickAccessDocumentListProps {
  doc: ProjectDocument;
  index: number;
}

const QuickAccessDocumentRow: React.FC<QuickAccessDocumentRowProps> = ({
  doc,
  index,
  editingId,
  drag,
  onEdit,
  onDelete,
}) => (
  <div
    draggable
    className={`quick-access-row${editingId === doc.id ? ' is-editing' : ''}${drag.draggedIndex === index ? ' is-dragged' : ''}`}
    onDragStart={(e) => drag.startDrag(index, e)}
    onDragOver={(e) => drag.hoverItem(index, e)}
    onDrop={drag.drop}
    onDragEnd={drag.endDrag}
  >
    <span title="Segure para arrastar e reordenar" className="quick-access-row__grip">
      <GripVertical size={14} aria-hidden="true" />
    </span>
    <div className="quick-access-row__text">
      <span className="quick-access-row__title">{doc.title}</span>
      <span className="quick-access-row__where">{documentLocation(doc)}</span>
    </div>
    <RowActionsButton
      label={`Ações de ${doc.title}`}
      items={[
        { label: 'Editar', icon: <Pencil size={14} aria-hidden="true" />, onSelect: () => onEdit(doc) },
        {
          label: 'Remover',
          icon: <Trash2 size={14} aria-hidden="true" />,
          onSelect: () => onDelete(doc.id),
          danger: true,
        },
      ]}
    />
  </div>
);
