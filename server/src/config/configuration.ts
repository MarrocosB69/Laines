import { randomBytes } from 'crypto';

const nodeEnv = process.env.NODE_ENV || 'development';
const isProd = nodeEnv === 'production';
const migrationsRunEnv = process.env.DB_MIGRATIONS_RUN;
const cspModeRaw = String(process.env.CSP_MODE || '').trim().toLowerCase();
const cspMode = cspModeRaw === 'enforce' || cspModeRaw === 'off'
  ? cspModeRaw
  : 'report-only';
const cspReportEndpoint = process.env.CSP_REPORT_URI || '/csp-report';
const cspDefaultPolicy = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob: https:",
  "connect-src 'self' http://localhost:4000 http://127.0.0.1:4000 https://api.laines.app ws: wss:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  `report-uri ${cspReportEndpoint}`
].join('; ');

const requireProdEnv = (name: string, fallback?: string) => {
  const value = process.env[name];
  if (value && value.trim()) {
    return value;
  }
  if (isProd) {
    throw new Error(`Variavel obrigatoria ausente em producao: ${name}`);
  }
  return fallback || '';
};

const devJwtSecret = `dev-${randomBytes(24).toString('hex')}`;

export default () => ({
  nodeEnv,
  port: parseInt(process.env.PORT || '4000', 10),
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  security: {
    trustProxy: process.env.TRUST_PROXY || (isProd ? 'loopback' : 'false'),
    cspMode,
    cspPolicy: process.env.CSP_POLICY || cspDefaultPolicy,
    cspReportUri: cspReportEndpoint
  },
  operations: {
    maintenanceMode: process.env.MAINTENANCE_MODE === 'true',
    maintenanceBypassToken: process.env.MAINTENANCE_BYPASS_TOKEN || '',
    healthDbCacheTtlMs: parseInt(process.env.HEALTH_DB_CACHE_TTL_MS || '1200', 10),
    httpBacklog: parseInt(process.env.HTTP_BACKLOG || '2048', 10)
  },
  observability: {
    drillEnabled: process.env.OBSERVABILITY_DRILL_ENABLED === 'true',
    requestLogsEnabled: process.env.REQUEST_LOGS_ENABLED === 'true',
    persistenceEnabled: process.env.OBSERVABILITY_PERSISTENCE_ENABLED !== 'false',
    eventsFile: process.env.OBSERVABILITY_EVENTS_FILE || 'logs/observability-events.jsonl',
    maxEventsFileBytes: parseInt(process.env.OBSERVABILITY_MAX_EVENTS_FILE_BYTES || '5242880', 10),
    webhookUrl: process.env.OBSERVABILITY_WEBHOOK_URL || '',
    webhookTimeoutMs: parseInt(process.env.OBSERVABILITY_WEBHOOK_TIMEOUT_MS || '3000', 10),
    alertEvaluationIntervalMs: parseInt(process.env.OBSERVABILITY_ALERT_EVAL_INTERVAL_MS || '1000', 10),
    alertEvaluationMinRequests: parseInt(process.env.OBSERVABILITY_ALERT_EVAL_MIN_REQUESTS || '30', 10)
  },
  uploads: {
    dir: process.env.UPLOAD_DIR || 'uploads',
    publicAccess: process.env.UPLOAD_PUBLIC_ACCESS === 'true',
    baseUrl: process.env.UPLOAD_BASE_URL || process.env.API_BASE_URL || `http://localhost:${process.env.PORT || '4000'}`
  },
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USER || 'laines',
    password: requireProdEnv('DB_PASSWORD', 'laines_dev_password'),
    name: process.env.DB_NAME || 'laines',
    sync: process.env.DB_SYNC === 'true',
    logging: process.env.DB_LOGGING === 'true',
    poolMax: parseInt(process.env.DB_POOL_MAX || '60', 10),
    poolMin: parseInt(process.env.DB_POOL_MIN || '2', 10),
    poolIdleTimeoutMs: parseInt(process.env.DB_POOL_IDLE_TIMEOUT_MS || '30000', 10),
    poolConnectionTimeoutMs: parseInt(process.env.DB_POOL_CONNECTION_TIMEOUT_MS || '8000', 10),
    migrationsRun: migrationsRunEnv === undefined
      ? true
      : migrationsRunEnv === 'true'
  },
  jwt: {
    secret: requireProdEnv('JWT_SECRET', devJwtSecret),
    expiresIn: process.env.JWT_EXPIRES_IN || '1d',
    refreshSecret: process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET || devJwtSecret,
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '14d',
    issuer: process.env.JWT_ISSUER || 'laines-api',
    audience: process.env.JWT_AUDIENCE || 'laines-clients',
    clockToleranceSeconds: parseInt(process.env.JWT_CLOCK_TOLERANCE_SECONDS || '5', 10)
  },
  auth: {
    newAuthFlowEnabled: process.env.AUTH_NEW_FLOW_ENABLED !== 'false',
    accessTokenExpiresIn: process.env.AUTH_ACCESS_TOKEN_EXPIRES_IN || '20m',
    refreshTokenFormat: process.env.AUTH_REFRESH_TOKEN_FORMAT || 'opaque',
    refreshCookieName: process.env.AUTH_REFRESH_COOKIE_NAME || 'laines_refresh_token',
    refreshCookiePath: process.env.AUTH_REFRESH_COOKIE_PATH || '/auth',
    refreshCookieDomain: process.env.AUTH_REFRESH_COOKIE_DOMAIN || '',
    refreshCookieSameSite: process.env.AUTH_REFRESH_COOKIE_SAMESITE || 'lax',
    refreshCookieSecure: process.env.AUTH_REFRESH_COOKIE_SECURE === undefined
      ? isProd
      : process.env.AUTH_REFRESH_COOKIE_SECURE === 'true',
    allowRegister: process.env.AUTH_ALLOW_REGISTER === 'true',
    allowPublicAccessRequest: process.env.AUTH_ALLOW_PUBLIC_ACCESS_REQUEST !== 'false',
    loginMaxAttempts: parseInt(process.env.LOGIN_MAX_ATTEMPTS || '5', 10),
    loginBlockSeconds: parseInt(process.env.LOGIN_BLOCK_SECONDS || '300', 10),
    loginStateTtlSeconds: parseInt(process.env.LOGIN_STATE_TTL_SECONDS || '86400', 10),
    loginMaxStateEntries: parseInt(process.env.LOGIN_MAX_STATE_ENTRIES || '5000', 10),
    loginCleanupIntervalSeconds: parseInt(process.env.LOGIN_CLEANUP_INTERVAL_SECONDS || '20', 10),
    passwordCompareConcurrency: parseInt(process.env.AUTH_PASSWORD_COMPARE_CONCURRENCY || '24', 10),
    passwordCompareSuccessCacheMs: parseInt(process.env.AUTH_PASSWORD_COMPARE_SUCCESS_CACHE_MS || '120000', 10),
    passwordCompareCacheMaxEntries: parseInt(process.env.AUTH_PASSWORD_COMPARE_CACHE_MAX_ENTRIES || '3000', 10),
    guardTokenCacheEnabled: process.env.AUTH_GUARD_TOKEN_CACHE_ENABLED !== 'false',
    guardTokenCacheTtlMs: parseInt(process.env.AUTH_GUARD_TOKEN_CACHE_TTL_MS || '800', 10),
    guardTokenCacheMaxEntries: parseInt(process.env.AUTH_GUARD_TOKEN_CACHE_MAX_ENTRIES || '2000', 10)
  },
  abuseProtection: {
    accessRequestMaxAttempts: parseInt(process.env.ACCESS_REQUEST_MAX_ATTEMPTS || '5', 10),
    accessRequestWindowSeconds: parseInt(process.env.ACCESS_REQUEST_WINDOW_SECONDS || '900', 10),
    accessRequestCooldownSeconds: parseInt(process.env.ACCESS_REQUEST_COOLDOWN_SECONDS || '900', 10),
    accessRequestDuplicateWindowHours: parseInt(process.env.ACCESS_REQUEST_DUPLICATE_WINDOW_HOURS || '24', 10)
  },
  realtime: {
    broadcastRoles: process.env.REALTIME_BROADCAST_ROLES
      || 'admin,coordenacao,presidente,vice,coord_atendimento,diretoria_marketing,diretoria_ensino,diretoria_pesquisa,diretoria_extensao,professor,profissional,pesquisador,colaborador,tecnico'
  }
});
