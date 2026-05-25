import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, LessThan, Repository } from 'typeorm';
import { LoginAttempt } from './login-attempt.entity';

type AttemptKey = {
  email: string;
  ip: string;
};

const ANY_EMAIL = '__any_email__';
const ANY_IP = '__any_ip__';

@Injectable()
export class LoginAttemptsService {
  // Login-attempts tracker persistido em PostgreSQL. Nao voltar para Map in-process:
  // AVISO: este estado é in-process. PM2 cluster mode desabilitado é obrigatório
  // enquanto esta implementação estiver ativa. Ver docs/deploy.md.
  private readonly maxAttempts: number;
  private readonly blockMs: number;
  private readonly stateTtlMs: number;
  private readonly maxStateEntries: number;
  private readonly cleanupIntervalMs: number;
  private lastCleanupAt = 0;

  constructor(
    @InjectRepository(LoginAttempt)
    private readonly attempts: Repository<LoginAttempt>,
    private readonly config: ConfigService
  ) {
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

  async assertNotBlocked(email: string, clientIp?: string) {
    await this.cleanupExpired();

    const now = Date.now();
    const rows = await this.findAttempts(this.getKeys(email, clientIp));
    for (const row of rows) {
      const blockedUntil = row.blockedUntil ? row.blockedUntil.getTime() : 0;
      if (blockedUntil > now) {
        const remainingSeconds = Math.ceil((blockedUntil - now) / 1000);
        throw new HttpException(
          `Muitas tentativas de login. Tente novamente em ${remainingSeconds}s.`,
          HttpStatus.TOO_MANY_REQUESTS
        );
      }

      if (blockedUntil <= now && row.count === 0) {
        await this.attempts.delete({ id: row.id });
      }
    }
  }

  async registerFailure(email: string, clientIp?: string) {
    await this.cleanupExpired();

    const now = Date.now();
    const keys = this.getKeys(email, clientIp);
    for (const key of keys) {
      await this.registerFailureForKey(key, now);
    }

    await this.enforceMaxEntries();
  }

  async clear(email: string, clientIp?: string) {
    const keys = this.getKeys(email, clientIp);
    await Promise.all(keys.map((key) => this.attempts.delete(key)));
  }

  private async findAttempts(keys: AttemptKey[]) {
    if (keys.length === 0) return [];
    return this.attempts.find({ where: keys });
  }

  private async registerFailureForKey(key: AttemptKey, now: number) {
    const shouldBlockInitialAttempt = this.maxAttempts <= 1;
    const blockedUntil = new Date(now + this.blockMs);
    await this.attempts.query(
      `
      INSERT INTO "login_attempts" ("email", "ip", "count", "blocked_until", "updated_at")
      VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT ("email", "ip")
      DO UPDATE SET
        "count" = CASE
          WHEN "login_attempts"."blocked_until" IS NOT NULL
            AND "login_attempts"."blocked_until" > NOW()
            THEN "login_attempts"."count"
          WHEN "login_attempts"."count" + 1 >= $5
            THEN 0
          ELSE "login_attempts"."count" + 1
        END,
        "blocked_until" = CASE
          WHEN "login_attempts"."blocked_until" IS NOT NULL
            AND "login_attempts"."blocked_until" > NOW()
            THEN "login_attempts"."blocked_until"
          WHEN "login_attempts"."count" + 1 >= $5
            THEN $6
          ELSE NULL
        END,
        "updated_at" = NOW()
      `,
      [
        key.email,
        key.ip,
        shouldBlockInitialAttempt ? 0 : 1,
        shouldBlockInitialAttempt ? blockedUntil : null,
        this.maxAttempts,
        blockedUntil
      ]
    );
  }

  private getKeys(email: string, clientIp?: string): AttemptKey[] {
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const normalizedIp = this.normalizeIp(clientIp);
    const keys: AttemptKey[] = [{ email: normalizedEmail, ip: ANY_IP }];
    if (normalizedIp && normalizedIp !== 'unknown') {
      keys.push({ email: ANY_EMAIL, ip: normalizedIp });
    }
    return keys;
  }

  private normalizeIp(clientIp?: string) {
    const value = String(clientIp || '').trim();
    if (!value) return 'unknown';
    if (value.startsWith('::ffff:')) return value.slice(7);
    return value;
  }

  private async cleanupExpired() {
    const now = Date.now();
    if (now - this.lastCleanupAt < this.cleanupIntervalMs) return;
    this.lastCleanupAt = now;

    const updatedBefore = new Date(now - this.stateTtlMs);
    await this.attempts.delete({
      blockedUntil: IsNull(),
      updatedAt: LessThan(updatedBefore)
    });
    await this.attempts
      .createQueryBuilder()
      .delete()
      .where('blocked_until IS NOT NULL')
      .andWhere('blocked_until <= :now', { now: new Date(now) })
      .andWhere('updated_at < :updatedBefore', { updatedBefore })
      .execute();
  }

  private async enforceMaxEntries() {
    const total = await this.attempts.count();
    if (total <= this.maxStateEntries) return;

    const rows = await this.attempts.find({
      select: { id: true },
      order: { updatedAt: 'ASC' },
      take: total - this.maxStateEntries
    });
    const ids = rows.map((row) => row.id).filter(Boolean);
    if (ids.length > 0) {
      await this.attempts.delete(ids);
    }
  }
}
