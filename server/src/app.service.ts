import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AppService {
  private readonly healthDbCacheTtlMs: number;
  private cachedDbStatus: { value: 'up' | 'down'; checkedAt: number } | null = null;
  private inFlightDbStatusCheck: Promise<'up' | 'down'> | null = null;

  constructor(
    private readonly dataSource: DataSource,
    private readonly config: ConfigService
  ) {
    const configuredTtl = Number(this.config.get('operations.healthDbCacheTtlMs') || 1200);
    this.healthDbCacheTtlMs = Number.isFinite(configuredTtl)
      ? Math.max(250, Math.floor(configuredTtl))
      : 1200;
  }

  private async resolveDatabaseStatus() {
    const now = Date.now();
    if (this.cachedDbStatus && now - this.cachedDbStatus.checkedAt <= this.healthDbCacheTtlMs) {
      return this.cachedDbStatus.value;
    }

    if (this.inFlightDbStatusCheck) {
      return this.inFlightDbStatusCheck;
    }

    this.inFlightDbStatusCheck = (async () => {
      let value: 'up' | 'down' = 'down';
      try {
        await this.dataSource.query('SELECT 1');
        value = 'up';
      } catch {
        value = 'down';
      } finally {
        this.cachedDbStatus = {
          value,
          checkedAt: Date.now()
        };
      }
      return value;
    })();

    try {
      return await this.inFlightDbStatusCheck;
    } finally {
      this.inFlightDbStatusCheck = null;
    }
  }

  async health() {
    const database = await this.resolveDatabaseStatus();

    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.round(process.uptime()),
      environment: process.env.NODE_ENV || 'development',
      database
    };
  }

  async readiness() {
    const health = await this.health();
    const maintenanceMode = Boolean(this.config.get('operations.maintenanceMode'));
    const isReady = health.database === 'up' && !maintenanceMode;
    return {
      readinessStatus: isReady ? 'ready' : 'not_ready',
      maintenanceMode,
      ...health
    };
  }
}
