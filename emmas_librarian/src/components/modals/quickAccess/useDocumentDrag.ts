import React, { useRef, useState } from 'react';

/** Drag-and-drop handlers and highlight state for a vertically ordered list. */
export interface DocumentDrag {
  draggedIndex: number | null;
  dropIndex: number | null;
  startDrag: (index: number, e: React.DragEvent) => void;
  hoverItem: (index: number, e: React.DragEvent<HTMLElement>) => void;
  hoverGap: (gapIndex: number, e: React.DragEvent) => void;
  drop: (e: React.DragEvent) => void;
  endDrag: (e: React.DragEvent) => void;
}

const stop = (e: React.DragEvent) => {
  e.preventDefault();
  e.stopPropagation();
};

// Prefer the index carried by dataTransfer; fall back to the ref when the platform drops it.
const sourceIndexOf = (e: React.DragEvent, fallback: number | null) => {
  const carried = e.dataTransfer ? parseInt(e.dataTransfer.getData('text/plain'), 10) : NaN;
  return !isNaN(carried) && carried >= 0 ? carried : (fallback ?? -1);
};

/**
 * Tracks which row is dragged and which gap it hovers; `onMove(source, gap)` fires on drop.
 * Hovering a row's upper half targets the gap before it, the lower half the gap after it.
 *
 * Usage:
 *   const drag = useDocumentDrag((from, gap) => move(from, gap));
 *   <div draggable onDragStart={(e) => drag.startDrag(i, e)} onDragOver={(e) => drag.hoverItem(i, e)} onDrop={drag.drop} />
 */
export function useDocumentDrag(onMove: (sourceIndex: number, dropIndex: number | null) => void): DocumentDrag {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  // Refs mirror the state so the drop handler sees values set earlier in the same gesture.
  const draggedIndexRef = useRef<number | null>(null);
  const dropIndexRef = useRef<number | null>(null);

  const setDraggedAt = (index: number | null) => {
    draggedIndexRef.current = index;
    setDraggedIndex(index);
  };

  const setDropAt = (index: number | null) => {
    dropIndexRef.current = index;
    setDropIndex(index);
  };

  const clear = () => {
    setDraggedAt(null);
    setDropAt(null);
  };

  const startDrag = (index: number, e: React.DragEvent) => {
    e.stopPropagation();
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', String(index));
    }
    setDraggedAt(index);
  };

  const hoverItem = (index: number, e: React.DragEvent<HTMLElement>) => {
    stop(e);
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
    const rect = e.currentTarget.getBoundingClientRect();
    setDropAt(e.clientY < rect.top + rect.height / 2 ? index : index + 1);
  };

  const hoverGap = (gapIndex: number, e: React.DragEvent) => {
    stop(e);
    setDropAt(gapIndex);
  };

  const drop = (e: React.DragEvent) => {
    stop(e);
    const source = sourceIndexOf(e, draggedIndexRef.current);
    const target = dropIndexRef.current;
    clear();
    onMove(source, target);
  };

  const endDrag = (e: React.DragEvent) => {
    e.stopPropagation();
    clear();
  };

  return { draggedIndex, dropIndex, startDrag, hoverItem, hoverGap, drop, endDrag };
}
