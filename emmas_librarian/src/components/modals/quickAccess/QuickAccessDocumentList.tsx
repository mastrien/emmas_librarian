import React from 'react';
import { Link as LinkIcon, File as FileIcon, Trash2, GripVertical, Pencil, Tag } from 'lucide-react';
import type { ProjectDocument } from '../../../types';
import { fileNameFromPath } from '../../../utils/formatters';
import type { DocumentDrag } from './useDocumentDrag';

interface QuickAccessDocumentListProps {
  documents: ProjectDocument[];
  editingId: number | null;
  drag: DocumentDrag;
  onEdit: (doc: ProjectDocument) => void;
  onDelete: (id: number) => void;
}

const gapDotStyle = (side: 'left' | 'right'): React.CSSProperties => ({
  position: 'absolute',
  [side]: '-3px',
  width: '8px',
  height: '8px',
  borderRadius: '50%',
  background: 'var(--color-primary)',
});

const DropGapIndicator: React.FC = () => (
  <div
    style={{
      height: '4px',
      margin: '0.2rem 0',
      borderRadius: '4px',
      background: 'var(--color-primary)',
      boxShadow: '0 0 8px color-mix(in srgb, var(--color-primary) 70%, transparent)',
      position: 'relative',
      display: 'flex',
      alignItems: 'center',
    }}
  >
    <div style={gapDotStyle('left')} />
    <div style={gapDotStyle('right')} />
  </div>
);

const DropGap: React.FC<{ gapIndex: number; drag: DocumentDrag }> = ({ gapIndex, drag }) => (
  <div
    data-testid="quick-access-drop-gap"
    onDragOver={(e) => drag.hoverGap(gapIndex, e)}
    onDrop={drag.drop}
    style={{ padding: '0.1rem 0' }}
  >
    <DropGapIndicator />
  </div>
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
 * Quick access documents as draggable rows with edit/delete actions, or an empty-state message.
 *
 * Usage:
 *   <QuickAccessDocumentList documents={docs} editingId={null} drag={drag} onEdit={edit} onDelete={remove} />
 */
export const QuickAccessDocumentList: React.FC<QuickAccessDocumentListProps> = ({
  documents,
  editingId,
  drag,
  onEdit,
  onDelete,
}) => {
  if (documents.length === 0) {
    return (
      <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem 0' }}>
        Nenhum link ou documento cadastrado.
      </div>
    );
  }
  const lastIndex = documents.length - 1;
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}
    >
      {documents.map((doc, index) => (
        <React.Fragment key={doc.id}>
          {showsGapBefore(index, drag) && <DropGap gapIndex={index} drag={drag} />}
          <QuickAccessDocumentRow
            doc={doc}
            index={index}
            isEditing={editingId === doc.id}
            drag={drag}
            onEdit={onEdit}
            onDelete={onDelete}
          />
          {index === lastIndex && showsGapAfterLast(documents.length, drag) && (
            <DropGap gapIndex={documents.length} drag={drag} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
};

interface QuickAccessDocumentRowProps {
  doc: ProjectDocument;
  index: number;
  isEditing: boolean;
  drag: DocumentDrag;
  onEdit: (doc: ProjectDocument) => void;
  onDelete: (id: number) => void;
}

const rowStyle = (isEditing: boolean, isDragging: boolean): React.CSSProperties => ({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '0.65rem 0.75rem',
  background: isEditing ? 'color-mix(in srgb, var(--color-primary) 12%, var(--bg-surface))' : 'var(--bg-surface)',
  border: isEditing ? '1px solid var(--color-primary)' : '1px solid var(--border-color)',
  borderRadius: 'var(--radius-sm)',
  opacity: isDragging ? 0.35 : 1,
  transform: isDragging ? 'scale(0.98)' : 'none',
  transition: 'opacity 0.15s ease, transform 0.15s ease, border var(--transition-fast)',
});

const iconButtonStyle = (color: string): React.CSSProperties => ({
  background: 'none',
  border: 'none',
  color,
  cursor: 'pointer',
  padding: '0.4rem',
});

const QuickAccessDocumentRow: React.FC<QuickAccessDocumentRowProps> = ({
  doc,
  index,
  isEditing,
  drag,
  onEdit,
  onDelete,
}) => (
  <div
    draggable
    onDragStart={(e) => drag.startDrag(index, e)}
    onDragOver={(e) => drag.hoverItem(index, e)}
    onDrop={drag.drop}
    onDragEnd={drag.endDrag}
    style={rowStyle(isEditing, drag.draggedIndex === index)}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', overflow: 'hidden' }}>
      <span
        title="Segure para arrastar e reordenar"
        style={{
          cursor: 'grab',
          display: 'flex',
          alignItems: 'center',
          color: 'var(--text-muted)',
          padding: '0.2rem 0',
        }}
      >
        <GripVertical size={16} />
      </span>
      {doc.url ? (
        <LinkIcon size={16} color="var(--color-primary)" />
      ) : (
        <FileIcon size={16} color="var(--color-secondary)" />
      )}
      <DocumentSummary doc={doc} />
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
      <button
        type="button"
        onClick={() => onEdit(doc)}
        style={iconButtonStyle(isEditing ? 'var(--color-primary)' : 'var(--text-muted)')}
        title="Editar item"
      >
        <Pencil size={15} />
      </button>
      <button
        type="button"
        onClick={() => onDelete(doc.id)}
        style={iconButtonStyle('var(--color-danger)')}
        title="Remover item"
      >
        <Trash2 size={15} />
      </button>
    </div>
  </div>
);

const ellipsis: React.CSSProperties = { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' };

const categoryBadgeStyle: React.CSSProperties = {
  fontSize: '0.7rem',
  padding: '0.1rem 0.4rem',
  borderRadius: 'var(--radius-xs, 4px)',
  background: 'color-mix(in srgb, var(--color-primary) 15%, transparent)',
  color: 'var(--color-primary)',
  fontWeight: 500,
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.2rem',
};

const documentLocation = (doc: ProjectDocument) =>
  doc.url || (doc.local_file_path ? fileNameFromPath(doc.local_file_path) : 'Documento anexado');

const DocumentSummary: React.FC<{ doc: ProjectDocument }> = ({ doc }) => (
  <div style={{ overflow: 'hidden' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
      <span style={{ fontWeight: 600, color: 'var(--text-heading)', ...ellipsis }}>{doc.title}</span>
      {doc.category && (
        <span style={categoryBadgeStyle}>
          <Tag size={10} />
          {doc.category}
        </span>
      )}
    </div>
    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', ...ellipsis }}>{documentLocation(doc)}</div>
  </div>
);
