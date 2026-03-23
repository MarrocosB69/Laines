const apiBaseUrl = process.env.E2E_API_BASE_URL || process.env.API_BASE_URL || 'http://localhost:4000';
const email = process.env.E2E_ADMIN_EMAIL || process.env.E2E_EMAIL || '';
const password = process.env.E2E_ADMIN_PASSWORD || process.env.E2E_PASSWORD || '';
const cookieName = process.env.E2E_REFRESH_COOKIE_NAME || 'laines_refresh_token';
const expectSecureCookie = /^(1|true)$/i.test(String(process.env.E2E_EXPECT_SECURE_COOKIE || ''));
const isCi = /^(1|true)$/i.test(String(process.env.CI || ''));

const required = ['email', 'password'];
const missing = required.filter((item) => !String({ email, password }[item] || '').trim());
if (missing.length > 0) {
  if (isCi) {
    console.error(`[e2e-auth] Fail: faltam credenciais (${missing.join(', ')})`);
    process.exit(1);
  }
  console.log(`[e2e-auth] Skip: faltam credenciais (${missing.join(', ')})`);
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

const getSetCookieHeaders = (response) => {
  if (typeof response.headers.getSetCookie === 'function') {
    return response.headers.getSetCookie();
  }
  const fallback = response.headers.get('set-cookie');
  return fallback ? [fallback] : [];
};

const parseCookie = (setCookieHeader) => {
  const [cookiePart] = String(setCookieHeader || '').split(';');
  const index = cookiePart.indexOf('=');
  if (index < 0) return null;
  return {
    name: cookiePart.slice(0, index).trim(),
    value: cookiePart.slice(index + 1).trim()
  };
};

const pickCookie = (setCookies, targetName) => {
  for (const header of setCookies) {
    const parsed = parseCookie(header);
    if (parsed?.name === targetName) {
      return {
        header,
        cookie: parsed
      };
    }
  }
  return null;
};

const run = async () => {
  console.log(`[e2e-auth] Base URL: ${apiBaseUrl}`);

  const login = await requestJson('/auth/login', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-auth-flow': 'v2'
    },
    body: JSON.stringify({ email, password })
  });
  ensure(login.response.ok, `Falha no login v2: HTTP ${login.response.status}`);
  ensure(String(login.body?.authFlow || '') === 'v2', 'Login deveria responder authFlow=v2.');
  const accessToken = String(login.body?.accessToken || '');
  ensure(accessToken.length > 10, 'Login v2 sem access token.');
  const loginCookies = getSetCookieHeaders(login.response);
  const loginRefreshCookie = pickCookie(loginCookies, cookieName);
  ensure(loginRefreshCookie, `Cookie ${cookieName} nao retornado no login.`);
  ensure(/httponly/i.test(loginRefreshCookie.header), 'Cookie refresh sem HttpOnly.');
  ensure(/samesite=lax|samesite=strict/i.test(loginRefreshCookie.header), 'Cookie refresh sem SameSite seguro.');
  if (expectSecureCookie) {
    ensure(/;\s*secure/i.test(loginRefreshCookie.header), 'Cookie refresh deveria estar com Secure habilitado.');
  }
  const cookieV1 = `${cookieName}=${loginRefreshCookie.cookie.value}`;
  console.log('[e2e-auth] login v2 + cookie HttpOnly OK');

  const refresh = await requestJson('/auth/refresh', {
    method: 'POST',
    headers: {
      cookie: cookieV1,
      'x-auth-flow': 'v2'
    }
  });
  ensure(refresh.response.ok, `Refresh inicial falhou: HTTP ${refresh.response.status}`);
  const refreshedAccessToken = String(refresh.body?.accessToken || '');
  ensure(refreshedAccessToken.length > 10, 'Refresh sem access token.');
  const refreshCookies = getSetCookieHeaders(refresh.response);
  const rotatedRefreshCookie = pickCookie(refreshCookies, cookieName);
  ensure(rotatedRefreshCookie, 'Refresh nao retornou cookie rotacionado.');
  ensure(rotatedRefreshCookie.cookie.value !== loginRefreshCookie.cookie.value, 'Refresh token nao foi rotacionado.');
  const cookieV2 = `${cookieName}=${rotatedRefreshCookie.cookie.value}`;
  console.log('[e2e-auth] rotação de refresh token OK');

  const reuseAttempt = await requestJson('/auth/refresh', {
    method: 'POST',
    headers: {
      cookie: cookieV1,
      'x-auth-flow': 'v2'
    }
  });
  ensure(reuseAttempt.response.status === 401, `Reuse de refresh deveria retornar 401, retornou ${reuseAttempt.response.status}`);
  console.log('[e2e-auth] detecção de reuse OK');

  const meAfterReuse = await requestJson('/auth/me', {
    headers: {
      authorization: `Bearer ${refreshedAccessToken}`
    }
  });
  ensure(meAfterReuse.response.status === 401, 'Access token deveria ser invalidado apos detecção de reuse.');

  const refreshAfterReuse = await requestJson('/auth/refresh', {
    method: 'POST',
    headers: {
      cookie: cookieV2,
      'x-auth-flow': 'v2'
    }
  });
  ensure(refreshAfterReuse.response.status === 401, 'Refresh token da mesma família deveria ser revogado apos reuse.');
  console.log('[e2e-auth] revogação de família/sessões OK');

  const relogin = await requestJson('/auth/login', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-auth-flow': 'v2'
    },
    body: JSON.stringify({ email, password })
  });
  ensure(relogin.response.ok, `Falha no re-login apos revogação: HTTP ${relogin.response.status}`);
  console.log('[e2e-auth] re-login pós revogação OK');

  console.log('[e2e-auth] Fluxo de sessão/refresh validado com sucesso.');
};

run().catch((error) => {
  console.error(`[e2e-auth] Falha: ${error.message}`);
  process.exitCode = 1;
});
