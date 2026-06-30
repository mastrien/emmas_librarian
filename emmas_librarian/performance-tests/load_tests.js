import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend } from 'k6/metrics';

// Custom trends to collect and report memory usage from the local Node.js process (Soak Testing)
const heapUsedTrend = new Trend('node_heap_used_bytes');
const rssTrend = new Trend('node_rss_bytes');
const heapTotalTrend = new Trend('node_heap_total_bytes');
const externalTrend = new Trend('node_external_bytes');

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';
const TEST_TYPE = __ENV.TEST_TYPE || 'smoke';

let testOptions = {};

if (TEST_TYPE === 'smoke') {
  testOptions = {
    scenarios: {
      smoke: {
        executor: 'constant-vus',
        vus: 1,
        duration: '10s',
        exec: 'runSmoke',
      },
    },
    thresholds: {
      http_req_failed: ['rate<0.01'],
      http_req_duration: ['p(95)<1000'],
    },
  };
} else if (TEST_TYPE === 'load') {
  testOptions = {
    scenarios: {
      pdf: {
        executor: 'ramping-vus',
        startVUs: 0,
        stages: [
          { duration: '10s', target: 2 },
          { duration: '20s', target: 2 },
          { duration: '10s', target: 0 },
        ],
        exec: 'runPdf',
      },
      db: {
        executor: 'ramping-vus',
        startVUs: 0,
        stages: [
          { duration: '10s', target: 3 },
          { duration: '20s', target: 3 },
          { duration: '10s', target: 0 },
        ],
        exec: 'runDb',
      },
      search: {
        executor: 'ramping-vus',
        startVUs: 0,
        stages: [
          { duration: '10s', target: 5 },
          { duration: '20s', target: 5 },
          { duration: '10s', target: 0 },
        ],
        exec: 'runSearch',
      },
      volume: {
        executor: 'ramping-vus',
        startVUs: 0,
        stages: [
          { duration: '10s', target: 3 },
          { duration: '20s', target: 3 },
          { duration: '10s', target: 0 },
        ],
        exec: 'runVolume',
      },
      mixed: {
        executor: 'ramping-vus',
        startVUs: 0,
        stages: [
          { duration: '10s', target: 2 },
          { duration: '20s', target: 2 },
          { duration: '10s', target: 0 },
        ],
        exec: 'runMixed',
      },
    },
    thresholds: {
      'http_req_duration{scenario:pdf}': ['p(95)<5000'],
      'http_req_duration{scenario:db}': ['p(95)<3000'],
      'http_req_duration{scenario:search}': ['p(95)<200'],
      'http_req_duration{scenario:volume}': ['p(95)<1000'],
      'http_req_duration{scenario:mixed}': ['p(95)<3000'],
      http_req_failed: ['rate<0.01'],
    },
  };
} else if (TEST_TYPE === 'stress') {
  testOptions = {
    scenarios: {
      stress: {
        executor: 'ramping-vus',
        startVUs: 0,
        stages: [
          { duration: '15s', target: 5 },
          { duration: '30s', target: 10 },
          { duration: '15s', target: 0 },
        ],
        exec: 'runStress',
      },
    },
    thresholds: {
      http_req_failed: ['rate<0.05'],
      http_req_duration: ['p(95)<6000'],
    },
  };
} else if (TEST_TYPE === 'soak') {
  testOptions = {
    scenarios: {
      soak: {
        executor: 'ramping-vus',
        startVUs: 0,
        stages: [
          { duration: '15s', target: 3 },
          { duration: '60s', target: 3 },
          { duration: '15s', target: 0 },
        ],
        exec: 'runSoak',
      },
    },
    thresholds: {
      http_req_failed: ['rate<0.01'],
      http_req_duration: ['p(95)<3000'],
    },
  };
}

export const options = testOptions;

export function runSmoke() {
  runPdf();
  runDb();
  runSearch();
  runVolume();
  runSoak();
  sleep(1);
}

export function runPdf() {
  const res = http.post(`${BASE_URL}/parse-pdf`);
  check(res, {
    'pdf status is 200': (r) => r.status === 200,
    'pdf success': (r) => JSON.parse(r.body).status === 'success',
  });
}

export function runDb() {
  const res = http.post(`${BASE_URL}/stress-db`);
  check(res, {
    'db status is 200': (r) => r.status === 200,
    'db success': (r) => JSON.parse(r.body).status === 'success',
  });
}

export function runSearch() {
  const res = http.get(`${BASE_URL}/search-capacity?q=123`);
  check(res, {
    'search status is 200': (r) => r.status === 200,
  });
}

export function runVolume() {
  const offset = Math.floor(Math.random() * 99900);
  const res = http.get(`${BASE_URL}/volume-query?limit=50&offset=${offset}`);
  check(res, {
    'volume status is 200': (r) => r.status === 200,
    'volume returns results': (r) => JSON.parse(r.body).count === 50,
  });
}

export function runSoak() {
  const res = http.get(`${BASE_URL}/soak-session`);
  const success = check(res, {
    'soak status is 200': (r) => r.status === 200,
  });

  if (success && res.body) {
    try {
      const parsed = JSON.parse(res.body);
      if (parsed.memory) {
        heapUsedTrend.add(parsed.memory.heapUsed);
        rssTrend.add(parsed.memory.rss);
        heapTotalTrend.add(parsed.memory.heapTotal);
        externalTrend.add(parsed.memory.external);
      }
    } catch (e) {
      // Ignored if JSON parsing fails
    }
  }
}

export function runMixed() {
  const resPdf = http.post(`${BASE_URL}/parse-pdf`);
  const resSearch = http.get(`${BASE_URL}/search-capacity?q=123`);
  check(resPdf, {
    'mixed: pdf status is 200': (r) => r.status === 200,
  });
  check(resSearch, {
    'mixed: search status is 200': (r) => r.status === 200,
  });
}

export function runStress() {
  runPdf();
  runDb();
}
