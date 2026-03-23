const apiBaseUrl = process.env.API_BASE_URL || 'http://localhost:4000';

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
  console.log(`[smoke] API base: ${apiBaseUrl}`);

  const health = await requestJson('/health');
  ensure(health.response.ok, `Health check falhou: HTTP ${health.response.status}`);
  ensure(health.body?.status === 'ok', 'Health check sem status ok.');
  ensure(
    health.body?.database === 'up' || health.body?.database === 'down',
    'Health check sem campo database valido.'
  );
  const requestId = health.response.headers.get('x-request-id');
  ensure(!!requestId, 'Health check sem header x-request-id.');
  ensure(
    health.response.headers.get('x-content-type-options') === 'nosniff',
    'Header de seguranca X-Content-Type-Options ausente.'
  );
  console.log('[smoke] /health ok');

  const me = await requestJson('/auth/me');
  ensure(me.response.status === 401, `Esperado 401 em /auth/me sem token, recebido ${me.response.status}.`);
  console.log('[smoke] /auth/me sem token ok (401)');

  const loginWithUnexpectedField = await requestJson('/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      email: 'smoke@example.com',
      password: '123456',
      unexpected: 'forbidden'
    })
  });
  ensure(
    loginWithUnexpectedField.response.status === 400,
    `Esperado 400 para payload invalido em /auth/login, recebido ${loginWithUnexpectedField.response.status}.`
  );
  console.log('[smoke] validacao de payload em /auth/login ok (400)');

  console.log('[smoke] Concluido com sucesso.');
};

run().catch((error) => {
  console.error(`[smoke] Falha: ${error.message}`);
  process.exitCode = 1;
});
