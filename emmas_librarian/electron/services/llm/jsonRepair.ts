/**
 * Utility to parse and automatically repair slightly malformed JSON strings returned by LLMs.
 */
export function parseAndRepairJson<T = unknown>(rawInput: string): T {
  if (!rawInput || typeof rawInput !== 'string') {
    throw new Error(`[ERR_INVALID_AI_RESPONSE] Resposta da IA vazia ou inválida. Offending value: ${String(rawInput)}. Expected shape: String JSON válida.`);
  }

  let cleaned = rawInput.trim();

  // Remove markdown code block fences (```json ... ``` or ``` ...)
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  }

  // Attempt direct JSON parse
  try {
    let parsed = JSON.parse(cleaned);
    if (typeof parsed === 'string' && (parsed.trim().startsWith('{') || parsed.trim().startsWith('['))) {
      try {
        parsed = JSON.parse(parsed);
      } catch (e) {
        // keep as is
      }
    }
    return parsed as T;
  } catch (initialErr) {
    // Attempt basic repairs for common LLM JSON syntax errors:
    // 1. Remove trailing commas before closing brackets or braces
    let repaired = cleaned
      .replace(/,\s*([}\]])/g, '$1')
      // 2. Fix unescaped newlines in JSON strings
      .replace(/(?<=:\s*"[^"\\]*)\n(?=[^"]*")/g, '\\n');

    try {
      let parsed = JSON.parse(repaired);
      if (typeof parsed === 'string' && (parsed.trim().startsWith('{') || parsed.trim().startsWith('['))) {
        try {
          parsed = JSON.parse(parsed);
        } catch (e) {
          // keep as is
        }
      }
      return parsed as T;
    } catch (secondErr) {
      throw new Error(
        `[ERR_INVALID_AI_RESPONSE] A IA não retornou um formato JSON válido. Offending value: "${cleaned.slice(0, 150)}...". Expected shape: Objeto JSON válido.`
      );
    }
  }
}
