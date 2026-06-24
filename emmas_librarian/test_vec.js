const Database = require('better-sqlite3');
const sqliteVec = require('sqlite-vec');

const db = new Database(':memory:');
sqliteVec.load(db);

db.exec(`CREATE VIRTUAL TABLE vec_test USING vec0(chunk_id INTEGER PRIMARY KEY, embedding float[3])`);
try {
  const stmt = db.prepare(`INSERT INTO vec_test (chunk_id, embedding) VALUES (?, ?)`);
  stmt.run(1, new Float32Array([0.1, 0.2, 0.3]));
  console.log('Inserted 1 using Number');
} catch (e) {
  console.error('Err 1: ' + e.message);
}

try {
  const stmt = db.prepare(`INSERT INTO vec_test (chunk_id, embedding) VALUES (?, ?)`);
  stmt.run(2n, new Float32Array([0.1, 0.2, 0.3]));
  console.log('Inserted 2n using BigInt');
} catch (e) {
  console.error('Err 2: ' + e.message);
}

try {
  const stmt = db.prepare(`INSERT INTO vec_test (rowid, embedding) VALUES (?, ?)`);
  stmt.run(3, new Float32Array([0.1, 0.2, 0.3]));
  console.log('Inserted 3 using rowid');
} catch (e) {
  console.error('Err 3: ' + e.message);
}

console.log('DONE');
