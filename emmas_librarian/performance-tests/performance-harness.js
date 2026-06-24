const http = require('http');
const Database = require('better-sqlite3');

function initDatabase() {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT
    );
    CREATE TABLE IF NOT EXISTS articles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER,
      title TEXT,
      authors TEXT,
      year INTEGER,
      status TEXT
    );
  `);
  return db;
}

function populateVolumeData(db) {
  const insertProject = db.prepare("INSERT INTO projects (name) VALUES ('Performance Project')");
  insertProject.run();

  const insertArticle = db.prepare(`
    INSERT INTO articles (project_id, title, authors, year, status)
    VALUES (?, ?, ?, ?, ?)
  `);

  db.transaction(() => {
    for (let i = 0; i < 100000; i++) {
      insertArticle.run(1, `Article title ${i}`, `Author ${i}`, 2000 + (i % 26), 'new');
    }
  })();
}

function handleParsePdf(req, res) {
  let sum = 0;
  for (let i = 0; i < 2000000; i++) {
    sum += Math.sin(i) * Math.cos(i);
  }
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ status: 'success', text: `Simulated parsed PDF text sum ${sum}` }));
}

function handleStressDb(req, res, db) {
  const insert = db.prepare(`
    INSERT INTO articles (project_id, title, authors, year, status)
    VALUES (?, ?, ?, ?, ?)
  `);
  const info = insert.run(1, 'Stress Article', 'Stress Author', 2026, 'stress');
  const read = db.prepare('SELECT * FROM articles WHERE id = ?').get(info.lastInsertRowid);
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ status: 'success', article: read }));
}

function handleSearchCapacity(req, res, db) {
  const url = new URL(req.url, 'http://localhost');
  const q = url.searchParams.get('q') || '9999';
  const query = db.prepare('SELECT * FROM articles WHERE title LIKE ? LIMIT 50');
  const results = query.all(`%${q}%`);
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ count: results.length, results }));
}

const soakLeakArray = [];
function handleSoakSession(req, res) {
  const chunk = {
    timestamp: Date.now(),
    data: new Array(5000).fill('leak-item-payload-string'),
  };
  soakLeakArray.push(chunk);
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(
    JSON.stringify({
      status: 'success',
      leakArraySize: soakLeakArray.length,
      memory: process.memoryUsage(),
    }),
  );
}

function handleVolumeQuery(req, res, db) {
  const url = new URL(req.url, 'http://localhost');
  const limit = parseInt(url.searchParams.get('limit')) || 100;
  const offset = parseInt(url.searchParams.get('offset')) || 0;
  const query = db.prepare('SELECT * FROM articles LIMIT ? OFFSET ?');
  const results = query.all(limit, offset);
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ status: 'success', count: results.length, limit, offset }));
}

function requestListener(req, res, db) {
  const url = new URL(req.url, 'http://localhost');
  if (req.method === 'POST' && url.pathname === '/parse-pdf') {
    return handleParsePdf(req, res);
  }
  if (req.method === 'POST' && url.pathname === '/stress-db') {
    return handleStressDb(req, res, db);
  }
  if (req.method === 'GET' && url.pathname === '/search-capacity') {
    return handleSearchCapacity(req, res, db);
  }
  if (req.method === 'GET' && url.pathname === '/soak-session') {
    return handleSoakSession(req, res);
  }
  if (req.method === 'GET' && url.pathname === '/volume-query') {
    return handleVolumeQuery(req, res, db);
  }
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not Found' }));
}

const dbInstance = initDatabase();
console.log('Populating 100,000 mock records for volume testing...');
populateVolumeData(dbInstance);
console.log('Database initialized successfully with 100,000 records.');

const server = http.createServer((req, res) => {
  requestListener(req, res, dbInstance);
});

const PORT = 3001;
server.listen(PORT, () => {
  console.log(`Performance harness server running on port ${PORT}`);
});
