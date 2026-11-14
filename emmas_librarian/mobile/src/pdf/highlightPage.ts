interface StoredPosition {
  pageNumber?: unknown;
  boundingRect?: { pageNumber?: unknown };
}

/**
 * The page a highlight is on, from the position the desktop's reader stored (an object, or its JSON
 * text as it comes from the database); null when it cannot be told.
 *
 * @example highlightPage('{"boundingRect":{"pageNumber":4}}') // 4
 */
export function highlightPage(positionData: unknown): number | null {
  const position = parsePosition(positionData);
  const page = Number(position?.boundingRect?.pageNumber ?? position?.pageNumber);
  return Number.isInteger(page) && page > 0 ? page : null;
}

function parsePosition(positionData: unknown): StoredPosition | null {
  if (typeof positionData !== 'string') return (positionData as StoredPosition | null) ?? null;
  try {
    return JSON.parse(positionData) as StoredPosition;
  } catch {
    return null;
  }
}
