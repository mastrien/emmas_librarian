import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '10s', target: 20 },
    { duration: '20s', target: 20 },
    { duration: '10s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],
  },
};

const BASE_URL = 'http://localhost:3001';

function testPdf() {
  const res = http.post(`${BASE_URL}/parse-pdf`);
  check(res, {
    'pdf status is 200': (r) => r.status === 200,
    'pdf success': (r) => JSON.parse(r.body).status === 'success',
  });
}

function testDb() {
  const res = http.post(`${BASE_URL}/stress-db`);
  check(res, {
    'db status is 200': (r) => r.status === 200,
    'db success': (r) => JSON.parse(r.body).status === 'success',
  });
}

function testSearch() {
  const res = http.get(`${BASE_URL}/search-capacity?q=123`);
  check(res, {
    'search status is 200': (r) => r.status === 200,
  });
}

function testSoak() {
  const res = http.get(`${BASE_URL}/soak-session`);
  check(res, {
    'soak status is 200': (r) => r.status === 200,
  });
}

function testVolume() {
  const offset = Math.floor(Math.random() * 99900);
  const res = http.get(`${BASE_URL}/volume-query?limit=50&offset=${offset}`);
  check(res, {
    'volume status is 200': (r) => r.status === 200,
    'volume returns results': (r) => JSON.parse(r.body).count === 50,
  });
}

export default function () {
  testPdf();
  testDb();
  testSearch();
  testSoak();
  testVolume();
  sleep(1);
}
