// Inputs that take no typed text: a key press on them (a click leaves focus on a checkbox or switch) is not typing.
const NO_TEXT_INPUTS = new Set(['checkbox', 'radio', 'button', 'submit', 'reset', 'range', 'color', 'file', 'image']);

/**
 * Whether a key pressed on this element is someone typing text, so one-letter shortcuts must stay out of the way:
 * a text field, a text area, a select or editable content. A checkbox, radio or button is not: after clicking the
 * styled switch of the guided screening, focus stays on its hidden checkbox and the decision keys must still work.
 *
 * @example if (isTextEntry(event.target)) return; // 1, 2 and 3 decide only when not typing
 */
export function isTextEntry(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  if (target instanceof HTMLInputElement) return !NO_TEXT_INPUTS.has(target.type);
  return target.tagName === 'TEXTAREA' || target.tagName === 'SELECT';
}
