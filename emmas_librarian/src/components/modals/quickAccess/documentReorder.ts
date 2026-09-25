/**
 * The list after moving the item at `sourceIndex` into the gap at `dropIndex`
 * (gap i sits before item i; gap `items.length` is after the last one).
 * Null when either index is out of range or the move would not change the order.
 *
 * Usage:
 *   reorderedItems(['a', 'b', 'c'], 0, 2); // ['b', 'a', 'c']
 */
export function reorderedItems<T>(items: T[], sourceIndex: number, dropIndex: number | null): T[] | null {
  if (sourceIndex < 0 || sourceIndex >= items.length) return null;
  if (dropIndex === null || dropIndex < 0 || dropIndex > items.length) return null;
  // Removing the source shifts every later gap one position up.
  const finalIndex = sourceIndex < dropIndex ? dropIndex - 1 : dropIndex;
  if (finalIndex === sourceIndex) return null;
  const updated = [...items];
  const [moved] = updated.splice(sourceIndex, 1);
  updated.splice(finalIndex, 0, moved);
  return updated;
}
