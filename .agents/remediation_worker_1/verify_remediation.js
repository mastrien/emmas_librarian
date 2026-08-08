const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const gitLog = execSync('git log --format="%H|%h|%an|%ad|%s" --date=iso-local --reverse', { encoding: 'utf8' }).trim().split('\n');

const repoDir = 'c:\\root_lab\\antigravity\\emmas_librarian';
const p3Path = path.join(repoDir, '.agents', 'phase_3_worker', 'draft.md');
const p5Path = path.join(repoDir, '.agents', 'phase_5_worker', 'draft.md');
const p8Path = path.join(repoDir, '.agents', 'phase_8_worker', 'draft.md');

const p3Content = fs.readFileSync(p3Path, 'utf8');
const p5Content = fs.readFileSync(p5Path, 'utf8');
const p8Content = fs.readFileSync(p8Path, 'utf8');

console.log('--- Verifying Phase 3 (Commits 51-60) ---');
for (let i = 50; i < 60; i++) {
  const [fullHash, shortHash] = gitLog[i].split('|');
  const found = p3Content.includes(shortHash) || p3Content.includes(fullHash);
  console.log(`Commit ${i + 1} (${shortHash}): ${found ? 'PASSED' : 'FAILED'}`);
}

console.log('\n--- Verifying Phase 5 (Commits 72-91) ---');
for (let i = 71; i < 91; i++) {
  const [fullHash, shortHash] = gitLog[i].split('|');
  const found = p5Content.includes(shortHash) || p5Content.includes(fullHash);
  console.log(`Commit ${i + 1} (${shortHash}): ${found ? 'PASSED' : 'FAILED'}`);
}

console.log('\n--- Checking for fake hashes in Phase 5 ---');
const fakeHashes = ['0145cb4d', '8d28be81', '8b452fcc', '522ceb93'];
for (const fake of fakeHashes) {
  const present = p5Content.includes(fake);
  console.log(`Fake hash ${fake} present: ${present ? 'FAILED (found fake)' : 'PASSED (absent)'}`);
}

console.log('\n--- Verifying Phase 8 (Commits 130-155) ---');
for (let i = 129; i < 155; i++) {
  const [fullHash, shortHash] = gitLog[i].split('|');
  const found = p8Content.includes(shortHash) || p8Content.includes(fullHash);
  console.log(`Commit ${i + 1} (${shortHash}): ${found ? 'PASSED' : 'FAILED'}`);
}
