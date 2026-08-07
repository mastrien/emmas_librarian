import path from 'path';
import fs from 'fs';
import Database from 'better-sqlite3';
import { DatabaseAdapter } from '../electron/database/DatabaseAdapter';
import { AIModelConfigRepository } from '../electron/database/AIModelConfigRepository';
import { AIService } from '../electron/services/AIService';

async function runExperiment() {
  console.log('====================================================');
  console.log('   INICIANDO EXPERIMENTO OLLAMA CLOUD (.experiment)');
  console.log('====================================================\n');

  const pdfPath = path.join(__dirname, 'education-13-01216-v2.pdf');
  const tempDbPath = path.join(__dirname, 'temp_experiment.db');

  if (fs.existsSync(tempDbPath)) {
    fs.unlinkSync(tempDbPath);
  }

  // Setup temporary database and schema
  const rawDb = new Database(tempDbPath);
  const schemaPath = path.join(__dirname, '../electron/database/schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');
  rawDb.exec(schemaSql);

  const dbAdapter = new DatabaseAdapter(tempDbPath);

  // Configure settings for Ollama Cloud experiment
  const apiKey = 'a7dae34b50a94fb995d33c134b6fab33.ptfvW3Gk4Lse-tCXjeSzQa7U';
  const baseUrl = 'https://ollama.com/v1';

  dbAdapter.setSetting('api_key_ollama_cloud', apiKey);
  dbAdapter.setSetting('ollama_cloud_base_url', baseUrl);
  dbAdapter.setSetting('ollama_cloud_model', 'gpt-oss:120b-cloud');

  const configRepo = new AIModelConfigRepository(rawDb);
  configRepo.updateConfig('metadata', 'ollama_cloud', 'gpt-oss:120b-cloud');
  configRepo.updateConfig('summary', 'ollama_cloud', 'gpt-oss:120b-cloud');
  configRepo.updateConfig('extraction', 'ollama_cloud', 'gpt-oss:120b-cloud');

  const aiService = new AIService(dbAdapter);

  // Test 1: Extract Metadata
  console.log('📌 Teste 1: Extraindo Metadados com gpt-oss:120b-cloud via Ollama Cloud...');
  try {
    const metadata = await aiService.extractMetadataFromPdf(1, pdfPath);
    console.log('✅ Metadados Extraídos com Sucesso:');
    console.log(JSON.stringify(metadata, null, 2));
  } catch (err) {
    console.error('❌ Erro na extração de metadados:', err);
  }

  // Test 2: Generate Summary
  console.log('\n📌 Teste 2: Gerando Resumos com gpt-oss:120b-cloud via Ollama Cloud...');
  try {
    const summary = await aiService.generateSummary(1, pdfPath);
    console.log('✅ Resumo Gerado com Sucesso:');
    console.log('--- Resumo Geral ---');
    console.log(summary.generalSummary);
    console.log('\n--- Resumo por Seções ---');
    console.log(summary.sectionSummary ? summary.sectionSummary.slice(0, 300) + '...' : '');
  } catch (err) {
    console.error('❌ Erro na geração de resumo:', err);
  }

  // Clean up temp DB
  dbAdapter.close();
  if (fs.existsSync(tempDbPath)) {
    try { fs.unlinkSync(tempDbPath); } catch (e) {}
  }

  console.log('\n====================================================');
  console.log('   EXPERIMENTO CONCLUÍDO COM SUCESSO!');
  console.log('====================================================');
}

runExperiment().catch((err) => {
  console.error('Erro fatal no experimento:', err);
  process.exit(1);
});
