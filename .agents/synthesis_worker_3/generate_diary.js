const fs = require('fs');
const path = require('path');

const projectRoot = 'c:\\root_lab\\antigravity\\emmas_librarian';
const agentsDir = path.join(projectRoot, '.agents');
const outputFile = path.join(projectRoot, 'development_diary.md');

const header = `# Diário de Desenvolvimento — Emma's Librarian

> **Visão Geral do Projeto**: Este documento reúne o diário de desenvolvimento completo, decisões de engenharia, evolução arquitetural, esquemas relacionais de banco de dados, diagramas de fluxo de dados, trechos de código e tabelas autênticas de commits do **Emma's Librarian** ao longo de suas 11 fases de desenvolvimento (Fase 0 a Fase 10), cobrindo a totalidade dos ~182 commits do repositório.

---
`;

let result = header;

function transformContent(content) {
  const lines = content.split('\n');
  let inCodeBlock = false;
  const transformed = [];

  for (let line of lines) {
    if (line.trim().startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      transformed.push(line);
      continue;
    }

    if (inCodeBlock) {
      transformed.push(line);
      continue;
    }

    // Outside code blocks, shift markdown headers down by 1 level if line starts with #
    if (/^#{1,5}\s/.test(line)) {
      transformed.push('#' + line);
    } else {
      transformed.push(line);
    }
  }

  return transformed.join('\n');
}

for (let i = 0; i <= 10; i++) {
  const draftPath = path.join(agentsDir, `phase_${i}_worker`, `draft.md`);
  if (!fs.existsSync(draftPath)) {
    console.error(`Error: ${draftPath} does not exist!`);
    process.exit(1);
  }
  const content = fs.readFileSync(draftPath, 'utf-8');
  const transformed = transformContent(content);
  result += '\n\n' + transformed + '\n\n---\n';
}

fs.writeFileSync(outputFile, result, 'utf-8');
console.log(`Successfully generated ${outputFile} with ${result.length} characters (${result.split('\n').length} lines).`);
