import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import axios from 'axios';

const toInt = (value, fallback) => {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizePrefix = (value) => {
  const normalized = String(value || 'load100')
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '');
  return normalized || 'load100';
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const isTransientNetworkError = (error) => {
  const code = String(error?.code || '').toUpperCase();
  const message = String(error?.message || '').toUpperCase();
  return (
    code === 'ECONNRESET'
    || code === 'ECONNREFUSED'
    || code === 'EPIPE'
    || code === 'ETIMEDOUT'
    || code === 'ECONNABORTED'
    || message.includes('ECONNRESET')
    || message.includes('SOCKET HANG UP')
    || message.includes('ETIMEDOUT')
  );
};

const retryAsync = async (fn, options) => {
  const attempts = Math.max(1, Number(options?.attempts || 1));
  const baseDelayMs = Math.max(50, Number(options?.baseDelayMs || 120));
  const shouldRetry = typeof options?.shouldRetry === 'function'
    ? options.shouldRetry
    : () => false;

  let lastError = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt >= attempts || !shouldRetry(error)) {
        throw error;
      }
      await sleep(baseDelayMs * attempt);
    }
  }
  throw lastError || new Error('retry failed');
};

const authenticateAndGetToken = async (http, email, password) => {
  const login = await http.post('/auth/login', { email, password });
  const token = String(login?.data?.accessToken || '');
  if (!token) {
    throw new Error('Token vazio na autenticacao.');
  }
  return token;
};

const percentile = (values, p) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[index];
};

const summarizeDurations = (values) => {
  if (!values.length) {
    return {
      count: 0,
      min: 0,
      p50: 0,
      p95: 0,
      max: 0,
      avg: 0
    };
  }
  const total = values.reduce((acc, value) => acc + value, 0);
  return {
    count: values.length,
    min: Math.min(...values),
    p50: percentile(values, 50),
    p95: percentile(values, 95),
    max: Math.max(...values),
    avg: Number((total / values.length).toFixed(2))
  };
};

const buildEmails = (prefix, total) => {
  const emails = [];
  for (let index = 1; index <= total; index += 1) {
    emails.push(`${prefix}.u${String(index).padStart(4, '0')}@laines.ufrn.br`);
  }
  return emails;
};

const config = {
  apiBaseUrl: process.env.LOAD_TEST_API_BASE_URL || process.env.API_BASE_URL || 'http://127.0.0.1:4000',
  prefix: normalizePrefix(process.env.LOAD_TEST_PREFIX),
  users: Math.max(20, toInt(process.env.LOAD_TEST_USERS, 100)),
  concurrency: Math.max(5, toInt(process.env.LOAD_TEST_CONCURRENCY, 20)),
  password: String(process.env.LOAD_TEST_PASSWORD || 'LoadTest#123456'),
  runSeed: String(process.env.LOAD_TEST_RUN_SEED || 'true').toLowerCase() !== 'false',
  resetObservability: String(process.env.LOAD_TEST_RESET_OBSERVABILITY || 'true').toLowerCase() !== 'false',
  primeConnection: String(process.env.LOAD_TEST_PRIME_CONNECTION || 'true').toLowerCase() !== 'false',
  loginRetryAttempts: Math.max(1, toInt(process.env.LOAD_TEST_LOGIN_RETRY_ATTEMPTS, 2)),
  resetRetryAttempts: Math.max(1, toInt(process.env.LOAD_TEST_RESET_RETRY_ATTEMPTS, 3)),
  reportPath: process.env.LOAD_TEST_SIM_REPORT_PATH
    || path.resolve(process.cwd(), 'e2e-artifacts', 'usage-simulation-report.json')
};

const adminAreaRoles = new Set([
  'admin',
  'coordenacao',
  'presidente',
  'vice',
  'diretoria_marketing',
  'diretoria_ensino',
  'diretoria_pesquisa',
  'diretoria_extensao',
  'coord_atendimento'
]);

const runSeed = () => {
  const result = spawnSync('node', ['server/scripts/seed-load-usage.js'], {
    stdio: 'inherit',
    shell: false,
    env: {
      ...process.env,
      LOAD_TEST_PREFIX: config.prefix,
      LOAD_TEST_USERS: String(config.users),
      LOAD_TEST_PASSWORD: config.password
    }
  });
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
};

const ensureApiHealth = async (http) => {
  const response = await http.get('/health');
  if (response.status !== 200) {
    throw new Error(`Healthcheck retornou status ${response.status}`);
  }
};

const writeReport = (payload) => {
  const fullPath = path.resolve(config.reportPath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
};

const simulateSingleUser = async (http, email) => {
  const started = Date.now();
  const checks = [];
  try {
    const loginStart = Date.now();
    const login = await retryAsync(
      () => http.post('/auth/login', {
        email,
        password: config.password
      }),
      {
        attempts: config.loginRetryAttempts,
        baseDelayMs: 120,
        shouldRetry: isTransientNetworkError
      }
    );
    checks.push({ name: 'auth.login', ok: login.status === 201 || login.status === 200, ms: Date.now() - loginStart, status: login.status });
    const token = String(login?.data?.accessToken || '');
    if (!token) {
      throw new Error('Token vazio no login');
    }

    const auth = { headers: { authorization: `Bearer ${token}` } };
    const meStart = Date.now();
    const me = await http.get('/auth/me', auth);
    checks.push({ name: 'auth.me', ok: me.status === 200, ms: Date.now() - meStart, status: me.status });
    const role = String(me?.data?.role || '').toLowerCase();

    const pacientesStart = Date.now();
    const pacientes = await http.get('/pacientes?limit=5', auth);
    checks.push({ name: 'pacientes.list', ok: pacientes.status === 200, ms: Date.now() - pacientesStart, status: pacientes.status });

    const avaliacoesStart = Date.now();
    const avaliacoes = await http.get('/avaliacoes?limit=5', auth);
    checks.push({ name: 'avaliacoes.list', ok: avaliacoes.status === 200, ms: Date.now() - avaliacoesStart, status: avaliacoes.status });

    const agendamentosStart = Date.now();
    const agendamentos = await http.get('/agendamentos?limit=5', auth);
    checks.push({ name: 'agendamentos.list', ok: agendamentos.status === 200, ms: Date.now() - agendamentosStart, status: agendamentos.status });

    if (adminAreaRoles.has(role)) {
      const analyticsStart = Date.now();
      const analytics = await http.get('/analytics/dashboard/summary?projectId=all', auth);
      checks.push({ name: 'analytics.summary', ok: analytics.status === 200, ms: Date.now() - analyticsStart, status: analytics.status });
    }

    return {
      email,
      ok: checks.every((item) => item.ok),
      totalMs: Date.now() - started,
      checks
    };
  } catch (error) {
    const responseStatus = error?.response?.status;
    return {
      email,
      ok: false,
      totalMs: Date.now() - started,
      checks,
      error: {
        message: error?.message || 'erro desconhecido',
        status: responseStatus || null
      }
    };
  }
};

const runPool = async (http, emails, concurrency) => {
  const results = [];
  let cursor = 0;

  const worker = async () => {
    while (true) {
      const current = cursor;
      cursor += 1;
      if (current >= emails.length) return;
      const result = await simulateSingleUser(http, emails[current]);
      results.push(result);
    }
  };

  const tasks = [];
  for (let i = 0; i < concurrency; i += 1) tasks.push(worker());
  await Promise.all(tasks);
  return results;
};

const summarizeChecks = (results) => {
  const byCheck = new Map();
  for (const result of results) {
    for (const check of result.checks || []) {
      if (!byCheck.has(check.name)) {
        byCheck.set(check.name, {
          durations: [],
          success: 0,
          failed: 0
        });
      }
      const bucket = byCheck.get(check.name);
      bucket.durations.push(Number(check.ms || 0));
      if (check.ok) bucket.success += 1;
      else bucket.failed += 1;
    }
  }

  return [...byCheck.entries()]
    .map(([name, bucket]) => ({
      name,
      ...summarizeDurations(bucket.durations),
      success: bucket.success,
      failed: bucket.failed
    }))
    .sort((a, b) => b.p95 - a.p95);
};

const fetchObservabilitySnapshot = async (http, adminEmail, password) => {
  try {
    const token = await authenticateAndGetToken(http, adminEmail, password);
    const headers = { authorization: `Bearer ${token}` };
    const metrics = await http.get('/observability/metrics', { headers });
    const slo = await http.get('/observability/slo', { headers });
    return {
      ok: true,
      metrics: metrics.data,
      slo: slo.data
    };
  } catch (error) {
    return {
      ok: false,
      reason: error?.message || 'failed to fetch observability'
    };
  }
};

const primeAuthConnection = async (http, adminEmail, password) => {
  await retryAsync(
    async () => {
      const token = await authenticateAndGetToken(http, adminEmail, password);
      await http.get('/auth/me', {
        headers: { authorization: `Bearer ${token}` }
      });
    },
    {
      attempts: config.resetRetryAttempts,
      baseDelayMs: 150,
      shouldRetry: isTransientNetworkError
    }
  );
};

const resetObservability = async (http, adminEmail, password) => {
  await retryAsync(
    async () => {
      const token = await authenticateAndGetToken(http, adminEmail, password);
      const headers = { authorization: `Bearer ${token}` };
      const response = await http.post('/observability/reset', {}, { headers });
      if (response.status !== 201 && response.status !== 200) {
        throw new Error(`Falha ao resetar observabilidade: status ${response.status}`);
      }
    },
    {
      attempts: config.resetRetryAttempts,
      baseDelayMs: 180,
      shouldRetry: isTransientNetworkError
    }
  );
};

const main = async () => {
  const http = axios.create({
    baseURL: config.apiBaseUrl,
    timeout: 25000
  });
  const startedAt = new Date().toISOString();
  console.log(`[simulate-usage] API base: ${config.apiBaseUrl}`);
  console.log(`[simulate-usage] users: ${config.users}, concurrency: ${config.concurrency}, prefix: ${config.prefix}`);

  await ensureApiHealth(http);
  if (config.runSeed) {
    console.log('[simulate-usage] seeding dataset...');
    runSeed();
  }

  const adminEmail = `${config.prefix}.u0001@laines.ufrn.br`;
  if (config.primeConnection) {
    console.log('[simulate-usage] priming auth connection...');
    await primeAuthConnection(http, adminEmail, config.password);
  }
  if (config.resetObservability) {
    console.log('[simulate-usage] resetting observability window...');
    await resetObservability(http, adminEmail, config.password);
  }

  const emails = buildEmails(config.prefix, config.users);
  console.log('[simulate-usage] running concurrent scenario...');
  const results = await runPool(http, emails, config.concurrency);
  const success = results.filter((item) => item.ok);
  const failed = results.filter((item) => !item.ok);
  const totalMsValues = results.map((item) => item.totalMs);
  const checkBreakdown = summarizeChecks(results);
  const failureByStatus = failed.reduce((acc, item) => {
    const key = String(item?.error?.status || 'unknown');
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const observability = await fetchObservabilitySnapshot(
    http,
    adminEmail,
    config.password
  );

  const summary = {
    startedAt,
    finishedAt: new Date().toISOString(),
    apiBaseUrl: config.apiBaseUrl,
    config: {
      prefix: config.prefix,
      users: config.users,
      concurrency: config.concurrency,
      runSeed: config.runSeed,
      resetObservability: config.resetObservability,
      primeConnection: config.primeConnection,
      loginRetryAttempts: config.loginRetryAttempts,
      resetRetryAttempts: config.resetRetryAttempts
    },
    totals: {
      usersSimulated: results.length,
      success: success.length,
      failed: failed.length,
      successRatePercent: Number(((success.length / Math.max(results.length, 1)) * 100).toFixed(2))
    },
    latencyMs: {
      min: Math.min(...totalMsValues),
      p50: percentile(totalMsValues, 50),
      p95: percentile(totalMsValues, 95),
      max: Math.max(...totalMsValues),
      avg: Number((totalMsValues.reduce((acc, value) => acc + value, 0) / Math.max(totalMsValues.length, 1)).toFixed(2))
    },
    checks: checkBreakdown,
    observability,
    failureByStatus,
    sampleFailures: failed.slice(0, 10)
  };

  writeReport(summary);
  console.log(`[simulate-usage] success: ${summary.totals.success}/${summary.totals.usersSimulated} (${summary.totals.successRatePercent}%)`);
  console.log(`[simulate-usage] latency(ms): min=${summary.latencyMs.min}, p50=${summary.latencyMs.p50}, p95=${summary.latencyMs.p95}, max=${summary.latencyMs.max}, avg=${summary.latencyMs.avg}`);
  console.log(`[simulate-usage] report: ${config.reportPath}`);

  if (failed.length > 0) {
    process.exitCode = 1;
  }
};

main().catch((error) => {
  console.error(`[simulate-usage] failed: ${error.message}`);
  process.exitCode = 1;
});
