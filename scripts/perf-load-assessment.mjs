import fs from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';

const apiBaseUrl = process.env.E2E_API_BASE_URL || process.env.API_BASE_URL || 'http://localhost:4000';
const adminEmail = process.env.E2E_ADMIN_EMAIL || process.env.E2E_EMAIL || 'e2e-admin@teste.com';
const adminPassword = process.env.E2E_ADMIN_PASSWORD || process.env.E2E_PASSWORD || 'e2e-password';
const outputPath = process.env.PERF_REPORT_PATH || 'e2e-artifacts/perf-load-assessment.json';
const soakMinutes = Math.max(1, Number(process.env.PERF_SOAK_MINUTES || 10));
const sustainedMinutes = Math.max(1, Number(process.env.PERF_SUSTAINED_MINUTES || 5));

const percentile = (values, pct) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((pct / 100) * sorted.length) - 1));
  return Number(sorted[index].toFixed(2));
};

const summarize = ({ latencies, statusCodes, startedAt, endedAt, failures }) => {
  const durationMs = endedAt - startedAt;
  const successCount = latencies.length - failures;
  const avg = latencies.length > 0
    ? Number((latencies.reduce((acc, value) => acc + value, 0) / latencies.length).toFixed(2))
    : 0;

  return {
    requests: latencies.length,
    successCount,
    failures,
    errorRatePercent: latencies.length > 0
      ? Number(((failures / latencies.length) * 100).toFixed(2))
      : 0,
    durationMs: Number(durationMs.toFixed(2)),
    throughputRps: durationMs > 0
      ? Number(((latencies.length / durationMs) * 1000).toFixed(2))
      : 0,
    avgMs: avg,
    p50Ms: percentile(latencies, 50),
    p95Ms: percentile(latencies, 95),
    p99Ms: percentile(latencies, 99),
    statusCodes: Object.fromEntries([...statusCodes.entries()].sort((a, b) => Number(a[0]) - Number(b[0])))
  };
};

const requestJson = async (pathName, options = {}) => {
  const response = await fetch(`${apiBaseUrl}${pathName}`, options);
  let body = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  return { response, body };
};

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};

const runConcurrentScenario = async ({
  name,
  totalRequests,
  concurrency,
  makeRequest
}) => {
  const latencies = [];
  const statusCodes = new Map();
  let failures = 0;
  let cursor = 0;
  const startedAt = performance.now();

  const workers = Array.from({ length: concurrency }).map(async () => {
    while (true) {
      const current = cursor;
      cursor += 1;
      if (current >= totalRequests) {
        break;
      }

      const requestStartedAt = performance.now();
      try {
        const response = await makeRequest(current);
        const elapsed = performance.now() - requestStartedAt;
        latencies.push(elapsed);
        const code = Number(response.status || 0);
        statusCodes.set(code, (statusCodes.get(code) || 0) + 1);
        if (code >= 400) {
          failures += 1;
        }
      } catch {
        const elapsed = performance.now() - requestStartedAt;
        latencies.push(elapsed);
        failures += 1;
      }
    }
  });

  await Promise.all(workers);
  const endedAt = performance.now();
  const summary = summarize({ latencies, statusCodes, startedAt, endedAt, failures });
  return {
    name,
    totalRequests,
    concurrency,
    ...summary
  };
};

const runDurationScenario = async ({
  name,
  durationMs,
  concurrency,
  makeRequest
}) => {
  const latencies = [];
  const statusCodes = new Map();
  let failures = 0;
  let requests = 0;
  const startedAt = performance.now();
  const stopAt = startedAt + durationMs;

  const workers = Array.from({ length: concurrency }).map(async () => {
    while (performance.now() < stopAt) {
      const requestStartedAt = performance.now();
      requests += 1;
      try {
        const response = await makeRequest(requests);
        const elapsed = performance.now() - requestStartedAt;
        latencies.push(elapsed);
        const code = Number(response.status || 0);
        statusCodes.set(code, (statusCodes.get(code) || 0) + 1);
        if (code >= 400) {
          failures += 1;
        }
      } catch {
        const elapsed = performance.now() - requestStartedAt;
        latencies.push(elapsed);
        failures += 1;
      }
    }
  });

  await Promise.all(workers);
  const endedAt = performance.now();
  const summary = summarize({ latencies, statusCodes, startedAt, endedAt, failures });
  return {
    name,
    durationRequestedMs: durationMs,
    concurrency,
    ...summary
  };
};

const loginV2 = async () => {
  const login = await requestJson('/auth/login', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-auth-flow': 'v2'
    },
    body: JSON.stringify({
      email: adminEmail,
      password: adminPassword
    })
  });
  assert(login.response.ok, `login falhou com HTTP ${login.response.status}`);
  const accessToken = String(login.body?.accessToken || '');
  assert(accessToken.length > 10, 'login sem accessToken');
  const setCookieHeader = login.response.headers.get('set-cookie') || '';
  const cookie = setCookieHeader.split(';')[0] || '';
  assert(cookie.includes('='), 'login sem cookie de refresh');
  return { accessToken, cookie };
};

const createRefreshCookies = async (count) => {
  const cookies = [];
  for (let index = 0; index < count; index += 1) {
    const { cookie } = await loginV2();
    cookies.push(cookie);
  }
  return cookies;
};

const run = async () => {
  const report = {
    generatedAt: new Date().toISOString(),
    apiBaseUrl,
    params: {
      soakMinutes,
      sustainedMinutes
    },
    scenarios: [],
    observability: null
  };

  const { accessToken } = await loginV2();

  report.scenarios.push(await runConcurrentScenario({
    name: 'health_100_conc',
    totalRequests: 3000,
    concurrency: 100,
    makeRequest: async () => fetch(`${apiBaseUrl}/health`)
  }));

  report.scenarios.push(await runConcurrentScenario({
    name: 'health_500_conc',
    totalRequests: 4000,
    concurrency: 500,
    makeRequest: async () => fetch(`${apiBaseUrl}/health`)
  }));

  report.scenarios.push(await runConcurrentScenario({
    name: 'health_1000_conc',
    totalRequests: 5000,
    concurrency: 1000,
    makeRequest: async () => fetch(`${apiBaseUrl}/health`)
  }));

  report.scenarios.push(await runConcurrentScenario({
    name: 'login_v2_100_conc',
    totalRequests: 500,
    concurrency: 100,
    makeRequest: async () => fetch(`${apiBaseUrl}/auth/login`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-auth-flow': 'v2'
      },
      body: JSON.stringify({
        email: adminEmail,
        password: adminPassword
      })
    })
  }));

  report.scenarios.push(await runConcurrentScenario({
    name: 'login_v2_200_conc',
    totalRequests: 600,
    concurrency: 200,
    makeRequest: async () => fetch(`${apiBaseUrl}/auth/login`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-auth-flow': 'v2'
      },
      body: JSON.stringify({
        email: adminEmail,
        password: adminPassword
      })
    })
  }));

  report.scenarios.push(await runConcurrentScenario({
    name: 'login_v2_500_conc',
    totalRequests: 1000,
    concurrency: 500,
    makeRequest: async () => fetch(`${apiBaseUrl}/auth/login`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-auth-flow': 'v2'
      },
      body: JSON.stringify({
        email: adminEmail,
        password: adminPassword
      })
    })
  }));

  report.scenarios.push(await runConcurrentScenario({
    name: 'auth_me_300_conc',
    totalRequests: 3000,
    concurrency: 300,
    makeRequest: async () => fetch(`${apiBaseUrl}/auth/me`, {
      headers: {
        authorization: `Bearer ${accessToken}`
      }
    })
  }));

  report.scenarios.push(await runConcurrentScenario({
    name: 'auth_me_500_conc',
    totalRequests: 3500,
    concurrency: 500,
    makeRequest: async () => fetch(`${apiBaseUrl}/auth/me`, {
      headers: {
        authorization: `Bearer ${accessToken}`
      }
    })
  }));

  const refreshCookies500 = await createRefreshCookies(500);
  report.scenarios.push(await runConcurrentScenario({
    name: 'refresh_v2_500_conc',
    totalRequests: refreshCookies500.length,
    concurrency: 500,
    makeRequest: async (index) => fetch(`${apiBaseUrl}/auth/refresh`, {
      method: 'POST',
      headers: {
        cookie: refreshCookies500[index],
        'x-auth-flow': 'v2'
      }
    })
  }));

  const soakSession = await loginV2();
  report.scenarios.push(await runDurationScenario({
    name: 'soak_auth_me_50_conc',
    durationMs: soakMinutes * 60 * 1000,
    concurrency: 50,
    makeRequest: async () => fetch(`${apiBaseUrl}/auth/me`, {
      headers: {
        authorization: `Bearer ${soakSession.accessToken}`
      }
    })
  }));

  const sustainedSession = await loginV2();
  report.scenarios.push(await runDurationScenario({
    name: 'sustained_auth_me_200_conc',
    durationMs: sustainedMinutes * 60 * 1000,
    concurrency: 200,
    makeRequest: async () => fetch(`${apiBaseUrl}/auth/me`, {
      headers: {
        authorization: `Bearer ${sustainedSession.accessToken}`
      }
    })
  }));

  const metrics = await requestJson('/observability/metrics', {
    headers: {
      authorization: `Bearer ${accessToken}`
    }
  });
  if (metrics.response.ok) {
    report.observability = metrics.body;
  }

  const absoluteOutputPath = path.resolve(outputPath);
  fs.mkdirSync(path.dirname(absoluteOutputPath), { recursive: true });
  fs.writeFileSync(absoluteOutputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(`[perf] report gerado em ${absoluteOutputPath}`);
  report.scenarios.forEach((scenario) => {
    console.log(
      `[perf] ${scenario.name}: req=${scenario.requests} ok=${scenario.successCount} err=${scenario.failures} p95=${scenario.p95Ms}ms p99=${scenario.p99Ms}ms rps=${scenario.throughputRps}`
    );
  });
};

run().catch((error) => {
  console.error(`[perf] Falha: ${error.message}`);
  process.exitCode = 1;
});
