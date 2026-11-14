/**
 * Whether a key press belongs to something else: a field being typed in, or a window open over the page. The
 * article list's one-letter shortcuts ("/", J, K, X, Enter) stay out of the way then.
 *
 * @example if (keyBelongsElsewhere(event)) return;
 */
export function keyBelongsElsewhere(event: KeyboardEvent): boolean {
  if (event.ctrlKey || event.metaKey || event.altKey) return true;
  const target = event.target;
  const typing =
    target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
  return typing || document.querySelector('[role="dialog"], [role="menu"]') !== null;
}
