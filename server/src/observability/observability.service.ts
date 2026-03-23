import { Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { dirname, resolve } from 'path';
import { existsSync, mkdirSync, readFileSync, renameSync, statSync, unlinkSync, appendFileSync } from 'fs';

type RequestSample = {
  count: number;
  errorCount: number;
  totalDurationMs: number;
  maxDurationMs: number;
  recentDurationsMs: number[];
};

type QuerySample = {
  count: number;
  totalDurationMs: number;
  maxDurationMs: number;
  lastDurationMs: number;
  errorCount: number;
  recentDurationsMs: number[];
  lastContext?: string;
  lastAt: string;
};

type ErrorSample = {
  timestamp: string;
  path: string;
  method: string;
  statusCode: number;
  message: string;
  requestId?: string;
};

type WindowSample = {
  timestampMs: number;
  method: string;
  path: string;
  statusCode: number;
  durationMs: number;
};

type WindowMetrics = {
  windowMinutes: number;
  requestCount: number;
  error5xxCount: number;
  errorRatePercent: number;
  criticalRequestCount: number;
  criticalP95Ms: number;
};

type AlertEvent = {
  key: 'error_rate_5xx' | 'critical_p95';
  status: 'triggered' | 'resolved';
  timestamp: string;
  value: number;
  threshold: number;
  windowMinutes: number;
};

type PersistedEventType = 'alert' | 'error';

type PersistedObservabilityEvent = {
  id: string;
  type: PersistedEventType;
  timestamp: string;
  payload: AlertEvent | ErrorSample;
};

const MAX_ROUTE_SAMPLES = 300;
const MAX_ROUTE_DURATION_SAMPLES = 800;
const MAX_ERROR_SAMPLES = 200;
const MAX_WINDOW_SAMPLES = 15000;
const MAX_ALERT_EVENTS = 250;
const MAX_QUERY_LABELS = 400;
const MAX_QUERY_DURATION_SAMPLES = 1000;
const WINDOW_MS = 15 * 60 * 1000;
const SLO_ERROR_RATE_THRESHOLD = 1;
const SLO_P95_THRESHOLD_MS = 700;
const MAX_PERSISTED_EVENT_CACHE = 1000;

@Injectable()
export class ObservabilityService {
  private startedAt = Date.now();
  private totalRequests = 0;
  private totalErrors = 0;
  private readonly persistenceEnabled: boolean;
  private readonly eventsFilePath: string;
  private readonly maxEventsFileBytes: number;
  private readonly webhookUrl: string;
  private readonly webhookTimeoutMs: number;
  private readonly alertEvaluationIntervalMs: number;
  private readonly alertEvaluationMinRequests: number;
  private lastAlertEvaluationAtMs = 0;
  private requestsSinceLastAlertEvaluation = 0;
  private readonly persistedEvents: PersistedObservabilityEvent[] = [];
  private lastPersistedAt: string | null = null;
  private readonly statusCodes = new Map<number, number>();
  private readonly requestByRoute = new Map<string, RequestSample>();
  private readonly queryByLabel = new Map<string, QuerySample>();
  private readonly recentErrors: ErrorSample[] = [];
  private readonly requestWindow: WindowSample[] = [];
  private readonly recentAlerts: AlertEvent[] = [];
  private alertState = {
    errorRateBreached: false,
    criticalP95Breached: false
  };

  constructor(
    private readonly config: ConfigService,
    @Optional() private readonly dataSource?: DataSource
  ) {
    this.persistenceEnabled = Boolean(this.config.get('observability.persistenceEnabled'));
    this.eventsFilePath = resolve(
      process.cwd(),
      String(this.config.get('observability.eventsFile') || 'logs/observability-events.jsonl')
    );
    const configuredMaxBytes = Number(this.config.get('observability.maxEventsFileBytes') || 5242880);
    this.maxEventsFileBytes = Number.isFinite(configuredMaxBytes)
      ? Math.max(1024 * 256, Math.floor(configuredMaxBytes))
      : 5242880;
    this.webhookUrl = String(this.config.get('observability.webhookUrl') || '').trim();
    const configuredTimeoutMs = Number(this.config.get('observability.webhookTimeoutMs') || 3000);
    this.webhookTimeoutMs = Number.isFinite(configuredTimeoutMs)
      ? Math.max(500, Math.floor(configuredTimeoutMs))
      : 3000;
    const configuredAlertIntervalMs = Number(this.config.get('observability.alertEvaluationIntervalMs') || 1000);
    this.alertEvaluationIntervalMs = Number.isFinite(configuredAlertIntervalMs)
      ? Math.max(200, Math.floor(configuredAlertIntervalMs))
      : 1000;
    const configuredAlertMinRequests = Number(this.config.get('observability.alertEvaluationMinRequests') || 30);
    this.alertEvaluationMinRequests = Number.isFinite(configuredAlertMinRequests)
      ? Math.max(1, Math.floor(configuredAlertMinRequests))
      : 30;
    this.lastAlertEvaluationAtMs = Date.now();
    this.hydratePersistedEvents();
  }

  private buildPersistedEventId() {
    return `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
  }

  private pushPersistedEventCache(event: PersistedObservabilityEvent) {
    if (this.persistedEvents.length >= MAX_PERSISTED_EVENT_CACHE) {
      this.persistedEvents.shift();
    }
    this.persistedEvents.push(event);
    this.lastPersistedAt = event.timestamp;
  }

  private ensurePersistenceDir() {
    const targetDir = dirname(this.eventsFilePath);
    if (!existsSync(targetDir)) {
      mkdirSync(targetDir, { recursive: true });
    }
  }

  private rotateEventsFileIfNeeded() {
    if (!existsSync(this.eventsFilePath)) return;
    const currentSize = Number(statSync(this.eventsFilePath).size || 0);
    if (!Number.isFinite(currentSize) || currentSize < this.maxEventsFileBytes) return;
    const rotatedPath = `${this.eventsFilePath}.1`;
    if (existsSync(rotatedPath)) {
      unlinkSync(rotatedPath);
    }
    renameSync(this.eventsFilePath, rotatedPath);
  }

  private persistEvent(type: PersistedEventType, payload: AlertEvent | ErrorSample) {
    const event: PersistedObservabilityEvent = {
      id: this.buildPersistedEventId(),
      type,
      timestamp: new Date().toISOString(),
      payload
    };
    this.pushPersistedEventCache(event);
    if (!this.persistenceEnabled) return event;
    try {
      this.ensurePersistenceDir();
      this.rotateEventsFileIfNeeded();
      appendFileSync(this.eventsFilePath, `${JSON.stringify(event)}\n`, { encoding: 'utf8' });
    } catch {
      // Em caso de falha de IO, o cache em memoria preserva os eventos recentes.
    }
    return event;
  }

  private hydratePersistedEvents() {
    if (!this.persistenceEnabled) return;
    if (!existsSync(this.eventsFilePath)) return;
    try {
      const fileContent = readFileSync(this.eventsFilePath, 'utf8');
      const lines = fileContent
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .slice(-MAX_PERSISTED_EVENT_CACHE);
      lines.forEach((line) => {
        try {
          const parsed = JSON.parse(line) as PersistedObservabilityEvent;
          if (!parsed || (parsed.type !== 'alert' && parsed.type !== 'error')) return;
          const normalized: PersistedObservabilityEvent = {
            id: String(parsed.id || this.buildPersistedEventId()),
            type: parsed.type,
            timestamp: String(parsed.timestamp || new Date().toISOString()),
            payload: parsed.payload
          };
          this.pushPersistedEventCache(normalized);
        } catch {
          // Ignora linhas invalidas para manter startup resiliente.
        }
      });
    } catch {
      // Ignora falhas de leitura no bootstrap.
    }
  }

  private emitWebhook(event: PersistedObservabilityEvent) {
    if (!this.webhookUrl) return;
    const fetchFn = (globalThis as { fetch?: (input: string, init?: Record<string, unknown>) => Promise<{ ok: boolean }> }).fetch;
    if (typeof fetchFn !== 'function') return;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.webhookTimeoutMs);
    void fetchFn(this.webhookUrl, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        source: 'laines-observability',
        eventType: event.type,
        event
      })
    }).finally(() => {
      clearTimeout(timeout);
    });
  }

  private normalizePath(path: string) {
    const normalized = String(path || '/').trim().toLowerCase();
    return normalized || '/';
  }

  private isCriticalPath(path: string) {
    const normalized = this.normalizePath(path);
    return (
      normalized.startsWith('/auth/login')
      || normalized.startsWith('/pacientes')
      || normalized.startsWith('/agendamentos')
      || normalized.startsWith('/analytics/reports/overview')
      || normalized.startsWith('/analytics/dashboard/summary')
    );
  }

  private trimWindow(nowMs = Date.now()) {
    const threshold = nowMs - WINDOW_MS;
    while (this.requestWindow.length > 0 && this.requestWindow[0].timestampMs < threshold) {
      this.requestWindow.shift();
    }
    while (this.requestWindow.length > MAX_WINDOW_SAMPLES) {
      this.requestWindow.shift();
    }
  }

  private pushAlert(event: AlertEvent) {
    if (this.recentAlerts.length >= MAX_ALERT_EVENTS) {
      this.recentAlerts.shift();
    }
    this.recentAlerts.push(event);
    const persisted = this.persistEvent('alert', event);
    this.emitWebhook(persisted);
  }

  private percentile(values: number[], percentile: number) {
    if (!values.length) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    const safeIndex = Math.min(Math.max(index, 0), sorted.length - 1);
    return sorted[safeIndex];
  }

  private getWindowMetrics(nowMs = Date.now()): WindowMetrics {
    this.trimWindow(nowMs);
    const samples = this.requestWindow;
    const requestCount = samples.length;
    const error5xxCount = samples.filter((item) => item.statusCode >= 500).length;
    const errorRatePercent = requestCount > 0
      ? Number(((error5xxCount / requestCount) * 100).toFixed(2))
      : 0;

    const criticalDurations = samples
      .filter((item) => this.isCriticalPath(item.path))
      .map((item) => item.durationMs);
    const criticalP95Ms = Number(this.percentile(criticalDurations, 95).toFixed(2));

    return {
      windowMinutes: WINDOW_MS / 60000,
      requestCount,
      error5xxCount,
      errorRatePercent,
      criticalRequestCount: criticalDurations.length,
      criticalP95Ms
    };
  }

  private evaluateAlerts(windowMetrics: WindowMetrics) {
    const nowIso = new Date().toISOString();
    const nextErrorRateBreached = windowMetrics.errorRatePercent > SLO_ERROR_RATE_THRESHOLD;
    const nextCriticalP95Breached = windowMetrics.criticalP95Ms > SLO_P95_THRESHOLD_MS;

    if (nextErrorRateBreached !== this.alertState.errorRateBreached) {
      this.pushAlert({
        key: 'error_rate_5xx',
        status: nextErrorRateBreached ? 'triggered' : 'resolved',
        timestamp: nowIso,
        value: windowMetrics.errorRatePercent,
        threshold: SLO_ERROR_RATE_THRESHOLD,
        windowMinutes: windowMetrics.windowMinutes
      });
      this.alertState.errorRateBreached = nextErrorRateBreached;
    }

    if (nextCriticalP95Breached !== this.alertState.criticalP95Breached) {
      this.pushAlert({
        key: 'critical_p95',
        status: nextCriticalP95Breached ? 'triggered' : 'resolved',
        timestamp: nowIso,
        value: windowMetrics.criticalP95Ms,
        threshold: SLO_P95_THRESHOLD_MS,
        windowMinutes: windowMetrics.windowMinutes
      });
      this.alertState.criticalP95Breached = nextCriticalP95Breached;
    }
  }

  private getActiveAlerts(windowMetrics: WindowMetrics) {
    const activeAlerts: Array<{
      key: string;
      currentValue: number;
      threshold: number;
      windowMinutes: number;
    }> = [];

    if (windowMetrics.errorRatePercent > SLO_ERROR_RATE_THRESHOLD) {
      activeAlerts.push({
        key: 'error_rate_5xx',
        currentValue: windowMetrics.errorRatePercent,
        threshold: SLO_ERROR_RATE_THRESHOLD,
        windowMinutes: windowMetrics.windowMinutes
      });
    }

    if (windowMetrics.criticalP95Ms > SLO_P95_THRESHOLD_MS) {
      activeAlerts.push({
        key: 'critical_p95',
        currentValue: windowMetrics.criticalP95Ms,
        threshold: SLO_P95_THRESHOLD_MS,
        windowMinutes: windowMetrics.windowMinutes
      });
    }

    return activeAlerts;
  }

  recordRequest(params: {
    method: string;
    path: string;
    statusCode: number;
    durationMs: number;
  }) {
    const method = String(params.method || 'GET').toUpperCase();
    const path = String(params.path || '/');
    const statusCode = Number(params.statusCode || 0);
    const durationMs = Math.max(Number(params.durationMs || 0), 0);
    const routeKey = `${method} ${path}`;

    this.totalRequests += 1;
    if (statusCode >= 500) {
      this.totalErrors += 1;
    }

    this.statusCodes.set(statusCode, (this.statusCodes.get(statusCode) || 0) + 1);
    if (!this.requestByRoute.has(routeKey)) {
      if (this.requestByRoute.size >= MAX_ROUTE_SAMPLES) {
        const firstKey = this.requestByRoute.keys().next().value;
        if (firstKey) this.requestByRoute.delete(firstKey);
      }
      this.requestByRoute.set(routeKey, {
        count: 0,
        errorCount: 0,
        totalDurationMs: 0,
        maxDurationMs: 0,
        recentDurationsMs: []
      });
    }

    const sample = this.requestByRoute.get(routeKey)!;
    sample.count += 1;
    if (statusCode >= 500) {
      sample.errorCount += 1;
    }
    sample.totalDurationMs += durationMs;
    sample.maxDurationMs = Math.max(sample.maxDurationMs, durationMs);
    if (sample.recentDurationsMs.length >= MAX_ROUTE_DURATION_SAMPLES) {
      sample.recentDurationsMs.shift();
    }
    sample.recentDurationsMs.push(durationMs);
    this.requestByRoute.set(routeKey, sample);

    this.requestWindow.push({
      timestampMs: Date.now(),
      method,
      path: this.normalizePath(path),
      statusCode,
      durationMs
    });
    this.requestsSinceLastAlertEvaluation += 1;
    const nowMs = Date.now();
    const elapsedSinceLastEvaluation = nowMs - this.lastAlertEvaluationAtMs;
    if (
      this.requestsSinceLastAlertEvaluation >= this.alertEvaluationMinRequests
      || elapsedSinceLastEvaluation >= this.alertEvaluationIntervalMs
    ) {
      const windowMetrics = this.getWindowMetrics(nowMs);
      this.evaluateAlerts(windowMetrics);
      this.lastAlertEvaluationAtMs = nowMs;
      this.requestsSinceLastAlertEvaluation = 0;
    }
  }

  recordError(sample: ErrorSample) {
    if (this.recentErrors.length >= MAX_ERROR_SAMPLES) {
      this.recentErrors.shift();
    }
    this.recentErrors.push(sample);
    this.persistEvent('error', sample);
  }

  recordQuery(params: {
    label: string;
    durationMs: number;
    context?: string;
    isError?: boolean;
  }) {
    const label = String(params.label || '').trim() || 'unknown';
    const durationMs = Math.max(Number(params.durationMs || 0), 0);
    const isError = Boolean(params.isError);

    if (!this.queryByLabel.has(label)) {
      if (this.queryByLabel.size >= MAX_QUERY_LABELS) {
        const firstKey = this.queryByLabel.keys().next().value;
        if (firstKey) this.queryByLabel.delete(firstKey);
      }
      this.queryByLabel.set(label, {
        count: 0,
        totalDurationMs: 0,
        maxDurationMs: 0,
        lastDurationMs: 0,
        errorCount: 0,
        recentDurationsMs: [],
        lastAt: new Date().toISOString()
      });
    }

    const sample = this.queryByLabel.get(label)!;
    sample.count += 1;
    sample.totalDurationMs += durationMs;
    sample.maxDurationMs = Math.max(sample.maxDurationMs, durationMs);
    sample.lastDurationMs = durationMs;
    sample.lastAt = new Date().toISOString();
    if (params.context) {
      sample.lastContext = String(params.context).slice(0, 180);
    }
    if (isError) {
      sample.errorCount += 1;
    }
    if (sample.recentDurationsMs.length >= MAX_QUERY_DURATION_SAMPLES) {
      sample.recentDurationsMs.shift();
    }
    sample.recentDurationsMs.push(durationMs);
    this.queryByLabel.set(label, sample);
  }

  private getDbPoolSnapshot() {
    try {
      const driver = (this.dataSource as any)?.driver;
      const pool = driver?.master || driver?.pool;
      if (!pool) return null;
      const total = Number(pool.totalCount);
      const idle = Number(pool.idleCount);
      const waiting = Number(pool.waitingCount);
      if (!Number.isFinite(total) || !Number.isFinite(idle) || !Number.isFinite(waiting)) {
        return null;
      }
      return {
        totalConnections: total,
        idleConnections: idle,
        waitingRequests: waiting
      };
    } catch {
      return null;
    }
  }

  getMetrics() {
    const memory = process.memoryUsage();
    const uptimeSeconds = Math.round((Date.now() - this.startedAt) / 1000);
    const statusCodeBuckets = [...this.statusCodes.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([code, count]) => ({ code, count }));

    const routes = [...this.requestByRoute.entries()]
      .map(([route, sample]) => ({
        route,
        count: sample.count,
        errorCount: sample.errorCount,
        avgDurationMs: sample.count > 0
          ? Number((sample.totalDurationMs / sample.count).toFixed(2))
          : 0,
        p50DurationMs: Number(this.percentile(sample.recentDurationsMs, 50).toFixed(2)),
        p95DurationMs: Number(this.percentile(sample.recentDurationsMs, 95).toFixed(2)),
        maxDurationMs: Number(sample.maxDurationMs.toFixed(2))
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 50);

    const queries = [...this.queryByLabel.entries()]
      .map(([label, sample]) => ({
        label,
        count: sample.count,
        errorCount: sample.errorCount,
        avgDurationMs: sample.count > 0
          ? Number((sample.totalDurationMs / sample.count).toFixed(2))
          : 0,
        p50DurationMs: Number(this.percentile(sample.recentDurationsMs, 50).toFixed(2)),
        p95DurationMs: Number(this.percentile(sample.recentDurationsMs, 95).toFixed(2)),
        maxDurationMs: Number(sample.maxDurationMs.toFixed(2)),
        lastDurationMs: Number(sample.lastDurationMs.toFixed(2)),
        lastContext: sample.lastContext || null,
        lastAt: sample.lastAt
      }))
      .sort((a, b) => b.p95DurationMs - a.p95DurationMs)
      .slice(0, 80);

    const windowMetrics = this.getWindowMetrics();
    const dbPool = this.getDbPoolSnapshot();

    return {
      uptimeSeconds,
      totalRequests: this.totalRequests,
      totalErrors: this.totalErrors,
      errorRate: this.totalRequests > 0
        ? Number(((this.totalErrors / this.totalRequests) * 100).toFixed(2))
        : 0,
      process: {
        pid: process.pid,
        nodeVersion: process.version,
        rssBytes: memory.rss,
        heapUsedBytes: memory.heapUsed,
        heapTotalBytes: memory.heapTotal,
        externalBytes: memory.external
      },
      statusCodes: statusCodeBuckets,
      routes,
      queries,
      dbPool,
      persistence: this.getPersistenceStatus(),
      window: {
        ...windowMetrics,
        activeAlerts: this.getActiveAlerts(windowMetrics)
      }
    };
  }

  getSloWindow() {
    const windowMetrics = this.getWindowMetrics();
    return {
      generatedAt: new Date().toISOString(),
      window: windowMetrics,
      targets: {
        errorRate5xxPercent: SLO_ERROR_RATE_THRESHOLD,
        criticalP95Ms: SLO_P95_THRESHOLD_MS,
        windowMinutes: WINDOW_MS / 60000
      },
      activeAlerts: this.getActiveAlerts(windowMetrics)
    };
  }

  getRecentErrors(limit = 50) {
    const parsedLimit = Math.max(Math.min(Number(limit || 50), 200), 1);
    return this.recentErrors.slice(-parsedLimit).reverse();
  }

  getRecentAlerts(limit = 50) {
    const parsedLimit = Math.max(Math.min(Number(limit || 50), 200), 1);
    return this.recentAlerts.slice(-parsedLimit).reverse();
  }

  getPersistedEvents(limit = 100, type?: 'alert' | 'error') {
    const parsedLimit = Math.max(Math.min(Number(limit || 100), 500), 1);
    const normalizedType = type === 'alert' || type === 'error' ? type : null;
    const source = normalizedType
      ? this.persistedEvents.filter((item) => item.type === normalizedType)
      : this.persistedEvents;
    return source.slice(-parsedLimit).reverse();
  }

  getPersistenceStatus() {
    return {
      enabled: this.persistenceEnabled,
      eventsFile: this.eventsFilePath,
      maxEventsFileBytes: this.maxEventsFileBytes,
      webhookEnabled: Boolean(this.webhookUrl),
      cachedEvents: this.persistedEvents.length,
      lastPersistedAt: this.lastPersistedAt
    };
  }

  simulateDrill(
    scenario: 'error' | 'latency' | 'recover' = 'latency',
    requestedSamples = 120
  ) {
    const samples = Math.max(10, Math.min(Number(requestedSamples || 120), 1500));
    const criticalPath = '/analytics/reports/overview';

    if (scenario === 'recover') {
      this.requestWindow.length = 0;
      for (let i = 0; i < samples; i += 1) {
        this.recordRequest({
          method: 'GET',
          path: criticalPath,
          statusCode: 200,
          durationMs: 120
        });
      }
      return this.getSloWindow();
    }

    if (scenario === 'error') {
      for (let i = 0; i < samples; i += 1) {
        this.recordRequest({
          method: 'GET',
          path: criticalPath,
          statusCode: 500,
          durationMs: 80
        });
      }
      return this.getSloWindow();
    }

    for (let i = 0; i < samples; i += 1) {
      this.recordRequest({
        method: 'GET',
        path: criticalPath,
        statusCode: 200,
        durationMs: 1500
      });
    }
    return this.getSloWindow();
  }

  reset() {
    this.startedAt = Date.now();
    this.totalRequests = 0;
    this.totalErrors = 0;
    this.statusCodes.clear();
    this.requestByRoute.clear();
    this.queryByLabel.clear();
    this.recentErrors.length = 0;
    this.requestWindow.length = 0;
    this.recentAlerts.length = 0;
    this.alertState = {
      errorRateBreached: false,
      criticalP95Breached: false
    };

    return {
      success: true,
      resetAt: new Date().toISOString()
    };
  }
}
