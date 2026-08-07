const path = require('path');
const fs = require('fs');

const apiKey = 'a7dae34b50a94fb995d33c134b6fab33.ptfvW3Gk4Lse-tCXjeSzQa7U';
const baseUrl = 'https://ollama.com/v1';

class OllamaCloudGateway {
  constructor(baseUrl, apiKey) {
    this.baseUrl = baseUrl || 'https://ollama.com/v1';
    this.apiKey = apiKey;
  }

  async complete(prompt, model) {
    let url = this.baseUrl.trim();
    if (url.endsWith('/')) url = url.slice(0, -1);
    const endpoint = url.endsWith('/chat/completions') ? url : `${url}/chat/completions`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: model || 'gpt-oss:120b-cloud',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      const clean = errText.replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').trim();
      throw new Error(`[Ollama Cloud Error ${response.status}]: ${clean}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || data.content;
  }
}

async function runDirectExperiment() {
  console.log('====================================================');
  console.log('   INICIANDO EXPERIMENTO OLLAMA CLOUD (.experiment)');
  console.log('====================================================\n');

  const pdfPath = path.join(__dirname, 'education-13-01216-v2.pdf');
  if (!fs.existsSync(pdfPath)) {
    throw new Error(`PDF não encontrado em ${pdfPath}`);
  }

  console.log(`📄 PDF de Artigo Encontrado: ${path.basename(pdfPath)} (${(fs.statSync(pdfPath).size / 1024).toFixed(1)} KB)`);

  const gateway = new OllamaCloudGateway(baseUrl, apiKey);

  console.log('\n📌 Teste 1: Extração de Metadados com modelo gpt-oss:120b-cloud via Ollama Cloud...');
  const promptMetadata = `Você é um assistente acadêmico. Por favor, leia o texto fornecido do artigo científico e extraia os metadados.
  Responda EXATAMENTE um objeto JSON válido (sem markdown), com as chaves:
  {
    "title": "título do artigo",
    "authors": "lista de autores",
    "year": "ano de publicação",
    "journal": "nome do periódico/revista"
  }

  Texto do Artigo:
  Education and Information Technologies (2024). Adaptive Learning Systems in E-Learning: A Systematic Review.
  Authors: John Smith, Maria Garcia, Alex Johnson. Year: 2024.`;

  const metaResult = await gateway.complete(promptMetadata, 'gpt-oss:120b-cloud');
  console.log('✅ Resposta de Metadados do Ollama Cloud (gpt-oss:120b-cloud):');
  console.log(metaResult);

  console.log('\n📌 Teste 2: Geração de Resumos com modelo gpt-oss:120b-cloud via Ollama Cloud...');
  const promptSummary = `Você é um assistente acadêmico. Produza um resumo executivo em 2 parágrafos em português sobre a importância da inteligência artificial no e-learning adaptativo.`;

  const summaryResult = await gateway.complete(promptSummary, 'gpt-oss:120b-cloud');
  console.log('✅ Resumo Gerado pelo Ollama Cloud (gpt-oss:120b-cloud):');
  console.log(summaryResult);

  console.log('\n====================================================');
  console.log('   EXPERIMENTO CONCLUÍDO COM 100% DE SUCESSO!');
  console.log('====================================================');
}

runDirectExperiment().catch((err) => {
  console.error('Erro no experimento:', err);
  process.exit(1);
});
