// Stands in for llama-server in the tests: `node fakeLlamaServer.cjs <port> [delayMs] [exit]`.
// It answers /health with 200 after the delay, or exits at once with code 3 when told to.
const http = require('node:http');

const [port, delay = '0', mode = ''] = process.argv.slice(2);
if (mode === 'exit') {
  console.error('fake llama-server: model file not found');
  process.exit(3);
}
const readyAt = Date.now() + Number(delay);
http
  .createServer((request, response) => {
    response.statusCode = request.url === '/health' && Date.now() >= readyAt ? 200 : 503;
    response.end('{}');
  })
  .listen(Number(port), '127.0.0.1');
