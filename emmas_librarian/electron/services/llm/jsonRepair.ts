type ParseAttempt = { ok: true; value: unknown } | { ok: false };

/**
 * Parses JSON returned by an LLM, tolerating markdown fences, double-encoded payloads,
 * trailing commas and raw newlines inside strings.
 *
 * Usage:
 *   const answers = parseAndRepairJson<ExtractionAnswer[]>(completionText);
 */
export function parseAndRepairJson<T = unknown>(rawInput: string): T {
  assertNonEmptyString(rawInput);
  const cleaned = stripMarkdownFence(rawInput.trim());
  const attempt = tryParse(cleaned);
  const repaired = attempt.ok ? attempt : tryParse(repairCommonSlips(cleaned));
  if (!repaired.ok) {
    throw new Error(
      `[ERR_INVALID_AI_RESPONSE] A IA não retornou um formato JSON válido. Offending value: "${cleaned.slice(0, 150)}...". Expected shape: Objeto JSON válido.`,
    );
  }
  return unwrapDoubleEncoded(repaired.value) as T;
}

function assertNonEmptyString(rawInput: unknown): asserts rawInput is string {
  if (rawInput && typeof rawInput === 'string') return;
  throw new Error(
    `[ERR_INVALID_AI_RESPONSE] Resposta da IA vazia ou inválida. Offending value: ${String(rawInput)}. Expected shape: String JSON válida.`,
  );
}

function stripMarkdownFence(text: string): string {
  if (!text.startsWith('```')) return text;
  return text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

function tryParse(text: string): ParseAttempt {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false };
  }
}

// Removes trailing commas before a closing bracket and escapes raw newlines inside string values.
function repairCommonSlips(text: string): string {
  return text.replace(/,\s*([}\]])/g, '$1').replace(/(?<=:\s*"[^"\\]*)\n(?=[^"]*")/g, '\\n');
}

// Some models return the JSON document itself as a JSON string ("{\"a\":1}").
function unwrapDoubleEncoded(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return value;
  const inner = tryParse(value);
  return inner.ok ? inner.value : value;
}
