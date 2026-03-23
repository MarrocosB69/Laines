const apiBaseUrl = process.env.E2E_API_BASE_URL || process.env.API_BASE_URL || 'http://localhost:4000';
const email = process.env.E2E_EMAIL || '';
const password = process.env.E2E_PASSWORD || '';
const isCi = /^(1|true)$/i.test(String(process.env.CI || ''));

const required = ['E2E_EMAIL', 'E2E_PASSWORD'];
const missing = required.filter((item) => !process.env[item]);

if (missing.length > 0) {
  if (isCi) {
    console.error(`[e2e] Fail: faltam variaveis ${missing.join(', ')} (obrigatorias em CI)`);
    process.exit(1);
  }
  console.log(`[e2e] Skip: faltam variaveis ${missing.join(', ')}`);
  process.exit(0);
}

const ensure = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};

const requestJson = async (path, options = {}) => {
  const response = await fetch(`${apiBaseUrl}${path}`, options);
  let body = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  return { response, body };
};

const run = async () => {
  console.log(`[e2e] Base URL: ${apiBaseUrl}`);
  const login = await requestJson('/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  ensure(login.response.ok, `Falha no login: HTTP ${login.response.status}`);
  const token = String(login.body?.accessToken || '');
  ensure(token.length > 10, 'Token de login ausente.');
  console.log('[e2e] Login ok');

  const me = await requestJson('/auth/me', {
    headers: { authorization: `Bearer ${token}` }
  });
  ensure(me.response.ok, `Falha em /auth/me: HTTP ${me.response.status}`);
  ensure(!!me.body?.id, 'Resposta de /auth/me sem id.');
  ensure(typeof me.body?.name === 'string' && me.body.name.trim().length > 0, 'Resposta de /auth/me sem campo name valido.');
  ensure(!('passwordHash' in (me.body || {})), 'Resposta de /auth/me expoe passwordHash.');
  ensure(!('temporaryPassword' in (me.body || {})), 'Resposta de /auth/me expoe temporaryPassword.');
  console.log('[e2e] /auth/me ok');

  const observability = await requestJson('/observability/metrics', {
    headers: { authorization: `Bearer ${token}` }
  });
  if (observability.response.status === 403) {
    console.log('[e2e] /observability/metrics sem permissao para este usuario (esperado para nao-admin).');
  } else {
    ensure(observability.response.ok, `Falha em /observability/metrics: HTTP ${observability.response.status}`);
    ensure(typeof observability.body?.totalRequests === 'number', 'Resposta de metricas invalida.');
    console.log('[e2e] /observability/metrics ok');
  }

  const logoutAll = await requestJson('/auth/logout-all', {
    method: 'POST',
    headers: { authorization: `Bearer ${token}` }
  });
  ensure(logoutAll.response.ok, `Falha em /auth/logout-all: HTTP ${logoutAll.response.status}`);
  console.log('[e2e] /auth/logout-all ok');

  const meAfterRevoke = await requestJson('/auth/me', {
    headers: { authorization: `Bearer ${token}` }
  });
  ensure(meAfterRevoke.response.status === 401, 'Token antigo deveria ser invalidado apos logout-all.');
  console.log('[e2e] token revogado apos logout-all');

  const relogin = await requestJson('/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  ensure(relogin.response.ok, `Falha no re-login apos logout-all: HTTP ${relogin.response.status}`);
  const reloginToken = String(relogin.body?.accessToken || '');
  ensure(reloginToken.length > 10, 'Token ausente apos re-login.');
  console.log('[e2e] re-login apos revogacao ok');

  console.log('[e2e] Fluxo critico concluido com sucesso.');
};

run().catch((error) => {
  console.error(`[e2e] Falha: ${error.message}`);
  process.exitCode = 1;
});
