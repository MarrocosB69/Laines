import fs from 'node:fs';
import path from 'node:path';

const apiBaseUrl = process.env.E2E_API_BASE_URL || process.env.API_BASE_URL || 'http://localhost:4000';
const adminEmail = process.env.E2E_ADMIN_EMAIL || process.env.E2E_EMAIL || 'e2e-admin@teste.com';
const adminPassword = process.env.E2E_ADMIN_PASSWORD || process.env.E2E_PASSWORD || 'e2e-password';
const outputPath = process.env.SECURITY_REPORT_PATH || 'e2e-artifacts/security-assessment.json';

const results = [];

const addResult = (name, status, details = {}) => {
  results.push({
    name,
    status,
    details,
    at: new Date().toISOString()
  });
};

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
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

const runCheck = async (name, callback) => {
  try {
    const details = await callback();
    addResult(name, 'passed', details || {});
  } catch (error) {
    addResult(name, 'failed', {
      message: error instanceof Error ? error.message : String(error)
    });
  }
};

const verifyHeader = (headers, key, predicate, failMessage) => {
  const value = headers.get(key);
  assert(predicate(value), failMessage);
  return value;
};

const loginV2 = async () => {
  const login = await requestJson('/auth/login', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-auth-flow': 'v2'
    },
    body: JSON.stringify({ email: adminEmail, password: adminPassword })
  });
  assert(login.response.ok, `login v2 falhou com HTTP ${login.response.status}`);
  const accessToken = String(login.body?.accessToken || '');
  assert(accessToken.length > 10, 'login sem accessToken');
  const setCookie = login.response.headers.get('set-cookie') || '';
  const cookie = setCookie.split(';')[0] || '';
  assert(cookie.includes('='), 'login sem cookie de refresh');
  return { accessToken, cookie, setCookie };
};

const scanTokenPersistence = () => {
  const files = [
    'src/contexts/AuthContext.jsx',
    'src/services/api.js',
    'src/services/sessionToken.js'
  ];
  const findings = [];
  files.forEach((relativePath) => {
    const absolutePath = path.resolve(relativePath);
    const content = fs.readFileSync(absolutePath, 'utf8');
    const lines = content.split('\n');
    lines.forEach((line, index) => {
      if (/localStorage\.setItem|sessionStorage\.setItem/.test(line)) {
        findings.push({
          file: relativePath,
          line: index + 1,
          snippet: line.trim()
        });
      }
    });
  });

  const unsafeWrites = findings.filter((item) => !item.file.endsWith('sessionToken.js'));
  assert(unsafeWrites.length === 0, `Persistencia em storage fora de sessionToken.js: ${unsafeWrites.length}`);
  return {
    storageWritesFound: findings.length,
    writes: findings
  };
};

const run = async () => {
  await runCheck('security.headers.baseline', async () => {
    const health = await requestJson('/health');
    assert(health.response.ok, `health falhou com HTTP ${health.response.status}`);
    const headers = health.response.headers;
    const xcto = verifyHeader(headers, 'x-content-type-options', (value) => value === 'nosniff', 'X-Content-Type-Options ausente');
    const xfo = verifyHeader(headers, 'x-frame-options', (value) => value === 'DENY', 'X-Frame-Options ausente');
    const rp = verifyHeader(headers, 'referrer-policy', (value) => String(value || '').length > 0, 'Referrer-Policy ausente');
    const perm = verifyHeader(headers, 'permissions-policy', (value) => String(value || '').includes('camera=()'), 'Permissions-Policy ausente');
    const cspReportOnly = headers.get('content-security-policy-report-only');
    const cspEnforce = headers.get('content-security-policy');
    assert(Boolean(cspReportOnly || cspEnforce), 'CSP nao configurada');
    return {
      xContentTypeOptions: xcto,
      xFrameOptions: xfo,
      referrerPolicy: rp,
      permissionsPolicy: perm,
      cspReportOnly,
      cspEnforce
    };
  });

  await runCheck('security.login.sqli', async () => {
    const payload = {
      email: `admin' OR '1'='1@teste.com`,
      password: "' OR '1'='1"
    };
    const response = await requestJson('/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload)
    });
    assert(response.response.status === 401 || response.response.status === 400, `status inesperado para SQLi: ${response.response.status}`);
    return {
      status: response.response.status
    };
  });

  await runCheck('security.login.xss-payload', async () => {
    const payload = {
      email: 'xss@teste.com',
      password: '<script>alert(1)</script>'
    };
    const response = await requestJson('/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload)
    });
    assert(response.response.status === 401 || response.response.status === 400, `status inesperado para XSS payload: ${response.response.status}`);
    return {
      status: response.response.status
    };
  });

  await runCheck('security.refresh.cookie-flags', async () => {
    const { setCookie } = await loginV2();
    assert(/httponly/i.test(setCookie), 'refresh cookie sem HttpOnly');
    assert(/samesite=lax|samesite=strict/i.test(setCookie), 'refresh cookie sem SameSite seguro');
    return {
      setCookie
    };
  });

  await runCheck('security.refresh.no-cookie-rejected', async () => {
    const response = await requestJson('/auth/refresh', {
      method: 'POST',
      headers: {
        'x-auth-flow': 'v2'
      }
    });
    assert(response.response.status === 401, `refresh sem cookie deveria retornar 401, retornou ${response.response.status}`);
    return {
      status: response.response.status
    };
  });

  await runCheck('security.refresh.body-token-ignored', async () => {
    const response = await requestJson('/auth/refresh', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-auth-flow': 'v2'
      },
      body: JSON.stringify({
        refreshToken: 'fake-token-value'
      })
    });
    assert(response.response.status === 401, `refresh com token no body deveria retornar 401, retornou ${response.response.status}`);
    return {
      status: response.response.status
    };
  });

  await runCheck('security.refresh.reuse-revocation', async () => {
    const login = await loginV2();
    const firstRefresh = await requestJson('/auth/refresh', {
      method: 'POST',
      headers: {
        cookie: login.cookie,
        'x-auth-flow': 'v2'
      }
    });
    assert(firstRefresh.response.ok, `primeiro refresh falhou com ${firstRefresh.response.status}`);
    const rotatedCookie = (firstRefresh.response.headers.get('set-cookie') || '').split(';')[0] || '';
    assert(rotatedCookie.includes('='), 'refresh nao retornou cookie rotacionado');

    const reuse = await requestJson('/auth/refresh', {
      method: 'POST',
      headers: {
        cookie: login.cookie,
        'x-auth-flow': 'v2'
      }
    });
    assert(reuse.response.status === 401, `reuse deveria retornar 401, retornou ${reuse.response.status}`);

    const meWithOldAccess = await requestJson('/auth/me', {
      headers: {
        authorization: `Bearer ${login.accessToken}`
      }
    });
    assert(meWithOldAccess.response.status === 401, `access antigo deveria ser revogado, retornou ${meWithOldAccess.response.status}`);

    const refreshAfterReuse = await requestJson('/auth/refresh', {
      method: 'POST',
      headers: {
        cookie: rotatedCookie,
        'x-auth-flow': 'v2'
      }
    });
    assert(refreshAfterReuse.response.status === 401, `familia deveria ser revogada, retornou ${refreshAfterReuse.response.status}`);
    return {
      reuseStatus: reuse.response.status,
      oldAccessStatus: meWithOldAccess.response.status,
      rotatedFamilyStatus: refreshAfterReuse.response.status
    };
  });

  await runCheck('security.csrf-baseline', async () => {
    const response = await requestJson('/auth/refresh', {
      method: 'POST',
      headers: {
        origin: 'https://evil.example.com',
        referer: 'https://evil.example.com/attack',
        'x-auth-flow': 'v2'
      }
    });
    assert(response.response.status === 401, `CSRF baseline deveria falhar sem cookie, retornou ${response.response.status}`);
    return {
      status: response.response.status
    };
  });

  await runCheck('security.frontend.token-persistence-scan', async () => scanTokenPersistence());

  const report = {
    generatedAt: new Date().toISOString(),
    apiBaseUrl,
    totalChecks: results.length,
    passed: results.filter((item) => item.status === 'passed').length,
    failed: results.filter((item) => item.status === 'failed').length,
    checks: results
  };

  const absolutePath = path.resolve(outputPath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(`[security] report gerado em ${absolutePath}`);

  const failed = report.checks.filter((item) => item.status === 'failed');
  if (failed.length > 0) {
    failed.forEach((item) => {
      console.error(`[security] FAIL ${item.name}: ${item.details?.message || 'erro'}`);
    });
    process.exitCode = 1;
  } else {
    console.log('[security] Todos os checks passaram.');
  }
};

run().catch((error) => {
  console.error(`[security] Falha fatal: ${error.message}`);
  process.exitCode = 1;
});
