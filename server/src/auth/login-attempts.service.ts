import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type AttemptState = {
  failures: number;
  blockedUntil: number;
  updatedAt: number;
};

@Injectable()
export class LoginAttemptsService {
  private readonly attempts = new Map<string, AttemptState>();
  private readonly maxAttempts: number;
  private readonly blockMs: number;
  private readonly stateTtlMs: number;
  private readonly maxStateEntries: number;
  private readonly cleanupIntervalMs: number;
  private lastCleanupAt = 0;

  constructor(private readonly config: ConfigService) {
    this.maxAttempts = Math.max(Number(this.config.get('auth.loginMaxAttempts') || 5), 1);
    const blockSeconds = Math.max(Number(this.config.get('auth.loginBlockSeconds') || 300), 30);
    const stateTtlSeconds = Math.max(Number(this.config.get('auth.loginStateTtlSeconds') || 86400), 600);
    this.maxStateEntries = Math.max(Number(this.config.get('auth.loginMaxStateEntries') || 5000), 1000);
    const configuredCleanupInterval = Number(this.config.get('auth.loginCleanupIntervalSeconds') || 20);
    this.cleanupIntervalMs = Number.isFinite(configuredCleanupInterval)
      ? Math.max(2000, Math.floor(configuredCleanupInterval * 1000))
      : 20000;

    this.blockMs = blockSeconds * 1000;
    this.stateTtlMs = stateTtlSeconds * 1000;
  }

  assertNotBlocked(email: string, clientIp?: string) {
    this.cleanupExpired();

    const now = Date.now();
    const keys = this.getKeys(email, clientIp);
    for (const key of keys) {
      const state = this.attempts.get(key);
      if (!state) continue;

      if (state.blockedUntil > now) {
        const remainingSeconds = Math.ceil((state.blockedUntil - now) / 1000);
        throw new HttpException(
          `Muitas tentativas de login. Tente novamente em ${remainingSeconds}s.`,
          HttpStatus.TOO_MANY_REQUESTS
        );
      }

      if (state.blockedUntil <= now && state.failures === 0) {
        this.attempts.delete(key);
      }
    }
  }

  registerFailure(email: string, clientIp?: string) {
    const now = Date.now();
    const keys = this.getKeys(email, clientIp);

    for (const key of keys) {
      const current = this.attempts.get(key) || {
        failures: 0,
        blockedUntil: 0,
        updatedAt: now
      };

      if (current.blockedUntil > now) {
        current.updatedAt = now;
        this.attempts.set(key, current);
        continue;
      }

      current.failures += 1;
      current.updatedAt = now;

      if (current.failures >= this.maxAttempts) {
        current.failures = 0;
        current.blockedUntil = now + this.blockMs;
      }

      this.attempts.set(key, current);
      this.enforceMaxEntries();
    }
  }

  clear(email: string, clientIp?: string) {
    const keys = this.getKeys(email, clientIp);
    keys.forEach((key) => this.attempts.delete(key));
  }

  private getKeys(email: string, clientIp?: string) {
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const normalizedIp = this.normalizeIp(clientIp);
    const keys = [`email:${normalizedEmail}`];
    if (normalizedIp && normalizedIp !== 'unknown') {
      keys.push(`ip:${normalizedIp}`);
    }
    return keys;
  }

  private normalizeIp(clientIp?: string) {
    const value = String(clientIp || '').trim();
    if (!value) return 'unknown';
    if (value.startsWith('::ffff:')) return value.slice(7);
    return value;
  }

  private cleanupExpired() {
    const now = Date.now();
    if (now - this.lastCleanupAt < this.cleanupIntervalMs) return;
    this.lastCleanupAt = now;
    if (this.attempts.size === 0) return;

    this.attempts.forEach((state, key) => {
      const isExpired = now - state.updatedAt > this.stateTtlMs;
      const isUnblocked = state.blockedUntil <= now;
      if (isExpired && isUnblocked) {
        this.attempts.delete(key);
      }
    });
  }

  private enforceMaxEntries() {
    if (this.attempts.size <= this.maxStateEntries) return;
    const sortedByUpdatedAt = [...this.attempts.entries()]
      .sort((a, b) => a[1].updatedAt - b[1].updatedAt);
    const toRemove = this.attempts.size - this.maxStateEntries;
    for (let index = 0; index < toRemove; index += 1) {
      const key = sortedByUpdatedAt[index]?.[0];
      if (key) this.attempts.delete(key);
    }
  }
}
