import type { ExtractionChunk } from './evidenceAnchoring';

/**
 * The chunks as the quote prompt shows them: one block per chunk with its page and retrieval score.
 *
 * @example quoteContext(chunks).startsWith('[Trecho 1 - Página') // true
 */
export function quoteContext(chunks: ExtractionChunk[]): string {
  return chunks
    .map((c, i) => `[Trecho ${i + 1} - Página ${c.page} - Score: ${c.score.toFixed(2)}]\n${c.text}`)
    .join('\n\n');
}

/**
 * The extraction prompt the app uses today: the AI writes each evidence's text, asked to copy it exactly.
 * Kept word for word from AIService.massiveExtraction (#63 compared it with a numbered-sentence format and kept it).
 *
 * @example quotePrompt('Qual a base de dados?', chunks)
 */
export function quotePrompt(question: string, chunks: ExtractionChunk[]): string {
  return `Você é um assistente acadêmico RAG. Baseado nos trechos do texto fornecidos, responda à pergunta.
A sua resposta deve ser EXATAMENTE um objeto JSON válido (sem tags markdown de código), no seguinte formato:
{
  "question": "${question}",
  "synthesizedAnswer": "Sua resposta completa",
  "confidenceScore": 0.95,
  "evidences": [
    {
      "text": "trecho EXATO e COMPLETO do texto original usado como base (nunca extraia apenas palavras soltas; extraia a frase inteira ou parágrafo completo que contém a informação)",
      "page": 1,
      "score": 0.85,
      "reasoning": "Por que este trecho justifica a resposta"
    }
  ]
}
Se não for possível encontrar a resposta nos trechos, responda com confidenceScore baixo e evidences vazias. Copie o score do trecho correspondente para o campo 'score'.

PERGUNTA:
${question}

TRECHOS:
${quoteContext(chunks)}
`;
}
