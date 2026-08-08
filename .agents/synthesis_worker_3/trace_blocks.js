const fs = require('fs');
const diaryPath = 'c:\\root_lab\\antigravity\\emmas_librarian\\development_diary.md';
const content = fs.readFileSync(diaryPath, 'utf-8');
const lines = content.split('\n');

let inCodeBlock = false;
lines.forEach((line, idx) => {
  if (line.trim().startsWith('```')) {
    inCodeBlock = !inCodeBlock;
    console.log(`Line ${idx + 1}: "${line.trim()}" -> inCodeBlock = ${inCodeBlock}`);
  }
});
console.log(`Final inCodeBlock state: ${inCodeBlock}`);
