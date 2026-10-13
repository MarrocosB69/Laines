import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as express from 'express';
import { randomUUID } from 'crypto';
import { existsSync, mkdirSync } from 'fs';
import { resolve } from 'path';
import type { NextFunction, Request, Response } from 'express';
import { AppModule } from './app.module';
import { GlobalHttpExceptionFilter } from './common/filters/http-exception.filter';
import { normalizeDeepUnicode } from './common/text-normalization';
import { ObservabilityService } from './observability/observability.service';

const isPrivateNetworkHost = (hostname: string) => {
  if (['localhost', '127.0.0.1', '[::1]'].includes(hostname)) return true;
  // IPv4 privado (RFC 1918)
  if (/^10\./.test(hostname)) return true;
  if (/^192\.168\./.test(hostname)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(hostname)) return true;
  // IPv6 link-local / ULA
  if (hostname.startsWith('fe80:') || hostname.startsWith('fd')) return true;
  return false;
};

const isLocalhostOrigin = (origin: string) => {
  try {
    const url = new URL(origin);
    return isPrivateNetworkHost(url.hostname);
  } catch {
    return false;
  }
};

const parseTrustProxy = (value: string) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized || normalized === 'false' || normalized === 'off') return false;
  if (normalized === 'true' || normalized === 'on') return true;
  if (/^\d+$/.test(normalized)) return Number(normalized);
  return value;
};

const hasMaintenanceBypass = (req: Request, maintenanceToken: string) => {
  if (!maintenanceToken) return false;
  const headerToken = String(req.headers['x-maintenance-bypass'] || '').trim();
  return headerToken === maintenanceToken;
};

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();
  const config = app.get(ConfigService);
  const observability = app.get(ObservabilityService);
  const nodeEnv = String(config.get('nodeEnv') || 'development');
  const isProduction = nodeEnv === 'production';
  const rawCorsOrigin = String(process.env.CORS_ORIGIN || '').trim();
  const allowedOrigins = String(config.get('corsOrigin') || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  const allowAllOrigins = allowedOrigins.includes('*');
  const maintenanceMode = Boolean(config.get('operations.maintenanceMode'));
  const maintenanceToken = String(config.get('operations.maintenanceBypassToken') || '');
  const requestLogsEnabled = Boolean(config.get('observability.requestLogsEnabled'));
  const cspMode = String(config.get('security.cspMode') || 'report-only').trim().toLowerCase();
  const cspPolicy = String(config.get('security.cspPolicy') || '').trim();
  const expressApp = app.getHttpAdapter().getInstance();
  const trustProxy = parseTrustProxy(String(config.get('security.trustProxy') || 'false'));

  if (isProduction && (!rawCorsOrigin || allowAllOrigins)) {
    throw new Error('BLOQUEADO: CORS_ORIGIN deve ser explicito em producao e nao pode ser "*". Ex.: CORS_ORIGIN=https://laines.app,https://www.laines.app');
  }
  if (Boolean(config.get('db.sync')) && nodeEnv !== 'development') {
    throw new Error('DB_SYNC=true so e permitido em desenvolvimento. Use migrations.');
  }
  if (isProduction && Boolean(config.get('auth.allowRegister'))) {
    logger.warn('AUTH_ALLOW_REGISTER=true em producao. Verifique se isso e intencional.');
  }
  if (isProduction && Boolean(config.get('auth.allowPublicAccessRequest'))) {
    logger.warn('AUTH_ALLOW_PUBLIC_ACCESS_REQUEST=true em producao.');
  }
  if (maintenanceMode && !maintenanceToken) {
    logger.warn('MAINTENANCE_MODE ativo sem MAINTENANCE_BYPASS_TOKEN configurado.');
  }

  expressApp.disable('x-powered-by');
  if (trustProxy !== false) {
    expressApp.set('trust proxy', trustProxy);
  }

  app.enableCors({
    origin: (origin, callback) => {
      if (
        !origin ||
        allowAllOrigins ||
        allowedOrigins.includes(origin) ||
        (!isProduction && isLocalhostOrigin(origin))
      ) {
        callback(null, true);
        return;
      }
      logger.warn(`Origem CORS rejeitada: ${origin}`);
      // Nega CORS sem gerar erro interno 500.
      callback(null, false);
    },
    credentials: true
  });

  app.use(express.json({
    limit: '1mb',
    type: ['application/json', 'application/csp-report', 'application/reports+json']
  }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  app.use((req: Request, _res: Response, next: NextFunction) => {
    if (req.path === '/health' || req.path === '/ready') {
      next();
      return;
    }
    normalizeDeepUnicode(req.body);
    normalizeDeepUnicode(req.query);
    normalizeDeepUnicode(req.params);
    next();
  });
  app.use((req: Request & { requestId?: string }, res: Response, next: NextFunction) => {
    const startedAt = Date.now();
    const isHealthProbe = req.path === '/health';
    const incomingRequestId = String(req.headers['x-request-id'] || '').trim();
    const requestId = incomingRequestId || (isHealthProbe ? `health-${startedAt}` : randomUUID());
    req.requestId = requestId;
    res.setHeader('X-Request-Id', requestId);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-DNS-Prefetch-Control', 'off');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    if (cspPolicy && cspMode !== 'off') {
      if (cspMode === 'enforce') {
        res.setHeader('Content-Security-Policy', cspPolicy);
      } else {
        res.setHeader('Content-Security-Policy-Report-Only', cspPolicy);
      }
    }
    if (isProduction) {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }

    if (maintenanceMode && req.path !== '/health' && req.path !== '/ready' && !hasMaintenanceBypass(req, maintenanceToken)) {
      res.status(503).json({
        statusCode: 503,
        message: 'Sistema temporariamente em manutencao.',
        error: 'Service Unavailable',
        timestamp: new Date().toISOString(),
        path: req.originalUrl || req.url,
        requestId
      });
      return;
    }

    res.on('finish', () => {
      const elapsedMs = Date.now() - startedAt;
      const rawPath = req.originalUrl || req.url;
      const safePath = rawPath.replace(
        /(\/avaliacoes-imagem\/uploads\/local\/)[^/?#]+/,
        '$1[REDACTED]',
      );
      const message = `${req.method} ${safePath} ${res.statusCode} ${elapsedMs}ms`;
      if (!isHealthProbe) {
        observability.recordRequest({
          method: req.method,
          path: req.route?.path ? `${req.baseUrl || ''}${req.route.path}` : (req.path || req.url || '/'),
          statusCode: res.statusCode,
          durationMs: elapsedMs
        });
      }
      if (res.statusCode >= 500) {
        logger.error(`${message} [requestId=${requestId}]`);
      } else if (res.statusCode >= 400) {
        logger.warn(`${message} [requestId=${requestId}]`);
      } else if (requestLogsEnabled) {
        logger.log(`${message} [requestId=${requestId}]`);
      }
    });
    next();
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true
    })
  );
  app.useGlobalFilters(new GlobalHttpExceptionFilter(observability));

  const uploadsDir = resolve(process.cwd(), config.get('uploads.dir') || 'uploads');
  if (!existsSync(uploadsDir)) {
    mkdirSync(uploadsDir, { recursive: true });
  }
  if (config.get('uploads.publicAccess')) {
    app.use('/uploads', (req: Request, res: Response, next: NextFunction) => {
      // Match the decoding performed by static delivery. Fold Windows separators,
      // case, trailing dots/spaces and ADS names before inspecting path segments.
      // Reject the private segment even before dot-segment normalization.
      let requestedPath: string;
      try {
        requestedPath = decodeURIComponent(req.path).replace(/\\/g, '/');
      } catch {
        res.sendStatus(400);
        return;
      }
      const privatePath = requestedPath.split('/').some((part) => (
        part.split(':')[0].replace(/[. ]+$/g, '').toLowerCase() === 'avaliacoes-imagem'
      ));
      if (privatePath) {
        res.sendStatus(404);
        return;
      }
      next();
    }, express.static(uploadsDir));
  }

  const port = config.get('port') || 4000;
  const backlog = Math.max(256, Number(config.get('operations.httpBacklog') || 2048));
  process.on('unhandledRejection', (reason) => {
    const message = reason instanceof Error ? `${reason.message}\n${reason.stack || ''}` : String(reason);
    logger.error(`Unhandled rejection: ${message}`);
    observability.recordError({
      timestamp: new Date().toISOString(),
      method: 'PROCESS',
      path: 'unhandledRejection',
      statusCode: 500,
      message: String(reason)
    });
  });
  process.on('uncaughtException', (error) => {
    logger.error(`Uncaught exception: ${error.message}`, error.stack);
    observability.recordError({
      timestamp: new Date().toISOString(),
      method: 'PROCESS',
      path: 'uncaughtException',
      statusCode: 500,
      message: error.message
    });
  });

  const host = String(process.env.HOST || process.env.BIND_HOST || '0.0.0.0').trim() || '0.0.0.0';
  await app.listen(port, host);
  const httpServer = app.getHttpServer() as { maxConnections?: number; keepAliveTimeout?: number; headersTimeout?: number };
  if (httpServer && Number.isFinite(backlog)) {
    httpServer.maxConnections = backlog;
  }
  const displayHost = host === '0.0.0.0' ? 'localhost' : host;
  logger.log(`API running on http://${displayHost}:${port}`);
  if (host === '0.0.0.0') {
    logger.log(`LAN access enabled. Use http://<seu-ip-local>:${port} (descubra com "ipconfig")`);
  }
}

bootstrap();
