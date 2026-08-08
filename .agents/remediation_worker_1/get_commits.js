const { execSync } = require('child_process');

const format = '%H|%h|%an|%ad|%s';
const logRaw = execSync(`git log --format="${format}" --date=iso-local --reverse`, { encoding: 'utf8' }).trim().split('\n');

console.log('=== COMMITS 51-60 ===');
for (let i = 50; i < 60; i++) {
  console.log(`${i + 1}|${logRaw[i]}`);
}
