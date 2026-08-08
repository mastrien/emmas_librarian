const fs = require('fs');
const path = require('path');

const diaryPath = 'c:\\root_lab\\antigravity\\emmas_librarian\\development_diary.md';
const content = fs.readFileSync(diaryPath, 'utf-8');
const lines = content.split('\n');

console.log(`Total lines: ${lines.length}`);
console.log(`Total bytes: ${Buffer.byteLength(content, 'utf-8')}`);

// 1. Check main header H1
const h1Headers = lines.filter((l, idx) => /^#\s/.test(l));
console.log(`H1 headers count: ${h1Headers.length}`);
h1Headers.forEach((h) => console.log(`  H1: ${h}`));

// 2. Check Phase headers (should be H2 ##)
const phaseHeaders = lines.filter((l) => /^##\s+Fase\s+\d+/.test(l));
console.log(`Phase H2 headers count: ${phaseHeaders.length}`);
phaseHeaders.forEach((h) => console.log(`  Phase H2: ${h}`));

// 3. Check for any unindented H1 outside the main title
let inCodeBlock = false;
let strayH1Count = 0;
lines.forEach((line, idx) => {
  if (line.trim().startsWith('```')) {
    inCodeBlock = !inCodeBlock;
    return;
  }
  if (!inCodeBlock && /^#\s/.test(line)) {
    if (idx !== 0) { // Line 0 is the main title
      console.warn(`Warning: Stray H1 at line ${idx + 1}: ${line}`);
      strayH1Count++;
    }
  }
});
console.log(`Stray H1 count outside main title: ${strayH1Count}`);

// 4. Check Mermaid blocks
let mermaidCount = 0;
lines.forEach((line) => {
  if (line.trim().startsWith('```mermaid')) {
    mermaidCount++;
  }
});
console.log(`Mermaid blocks count: ${mermaidCount}`);

// 5. Check Code blocks
let codeBlockCount = 0;
lines.forEach((line) => {
  if (line.trim().startsWith('```') && !line.trim().startsWith('```mermaid')) {
    codeBlockCount++;
  }
});
console.log(`Code block backticks count: ${codeBlockCount}`);

// 6. Check Commit Table hashes for Phase 3, Phase 5, Phase 8
const phase3Commits = ['f1c44d1', 'b2e3309', 'c2220b3', '373bb30', 'bca819a', 'f73bad5', 'fa1db44', 'cf9434a', 'f1841d9', '2a73216'];
const phase5Commits = ['0cfd45e', '8929bcb', 'cb15300', '9b5889b', '5364bef', 'b55fa51', 'fe98b0e', '2a5ccdf', '5b56128', 'e37f10f', '87d5707', '0709043', 'f9333b3', 'c371569', '8807a02', '6c7a704', 'd733199', '90f163d', '3067999', '8e72c9e'];
const phase8Commits = ['9e00039', 'c17df04', '043e0c6', 'cb0b167', '172c5e6', 'bbb0c7b', 'fe4b183', '8af275b', '0f4223e', '6050aa7', '8854fe7', '42baf43', 'bf7cedc', '11cc889', '7345071', '718f1b8', '6d1c349', '97f68be', '5dc734b', 'e1293be', 'afe9c42', 'd818226', 'db2ded5', 'aa68e5f', '37efcf0', 'f22810e'];

function verifyHashes(phaseName, hashes) {
  const missing = hashes.filter(h => !content.includes(h));
  if (missing.length === 0) {
    console.log(`✅ ${phaseName}: All ${hashes.length} authentic commit hashes found!`);
  } else {
    console.error(`❌ ${phaseName}: Missing hashes: ${missing.join(', ')}`);
  }
}

verifyHashes('Phase 3', phase3Commits);
verifyHashes('Phase 5', phase5Commits);
verifyHashes('Phase 8', phase8Commits);
