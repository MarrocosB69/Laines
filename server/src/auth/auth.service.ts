import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  Optional,
  UnauthorizedException
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { JwtSignOptions } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { createHash, randomUUID } from 'crypto';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { RecoverPasswordDto } from './dto/recover-password.dto';
import { RecoveryRequestDto } from './dto/recovery-request.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { LoginAttemptsService } from './login-attempts.service';
import { ObservabilityService } from '../observability/observability.service';
import { RefreshTokensService } from './refresh-tokens.service';
import { SettingsService } from '../settings/settings.service';
import { CredentialsService } from '../credentials/credentials.service';
import { getEffectivePermissions } from '../common/domain/access.constants';

type AuthenticatedIdentity = {
  id: string;
  email: string;
  role: string;
  name: string;
  status?: string;
  diretoria?: string | null;
  permissions?: string[];
  mustChangePassword?: boolean;
  sessionVersion?: number;
};

export type AuthFlowVersion = 'v1' | 'v2';

type BuildAuthResponseInput = {
  authFlow: AuthFlowVersion;
  clientIp?: string;
  userAgent?: string;
  existingRefreshToken?: string;
  existingRefreshTokenExpiresAt?: Date;
  existingRefreshTokenFamilyId?: string;
};

type AuthResult = {
  accessToken: string;
  user: {
    id: string;
    email: string;
    role: string;
    name: string;
    diretoria?: string | null;
    permissions: string[];
    mustChangePassword: boolean;
  };
  authFlow: AuthFlowVersion;
  refreshToken?: string;
  refreshTokenExpiresAt?: string;
};

const AUTH_FLOW_V1_REMOVAL_DATE = '2026-08-31';

class AsyncConcurrencyLimiter {
  private active = 0;
  private readonly queue: Array<(release: () => void) => void> = [];

  constructor(private readonly limit: number) {}

  async acquire() {
    if (this.active < this.limit) {
      this.active += 1;
      return this.createRelease();
    }

    return new Promise<() => void>((resolve) => {
      this.queue.push(resolve);
    });
  }

  private createRelease() {
    let released = false;
    return () => {
      if (released) return;
      released = true;

      const next = this.queue.shift();
      if (next) {
        next(this.createRelease());
        return;
      }

      this.active = Math.max(0, this.active - 1);
    };
  }
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly compareLimiter: AsyncConcurrencyLimiter;
  private readonly newAuthFlowEnabled: boolean;
  private readonly accessTokenExpiresIn: string;
  private readonly jwtIssuer: string;
  private readonly jwtAudience: string;
  private readonly passwordCompareSuccessCacheMs: number;
  private readonly passwordCompareMaxCacheEntries: number;
  // AVISO: este estado é in-process. PM2 cluster mode desabilitado é obrigatório
  // enquanto esta implementação estiver ativa. Ver docs/deploy.md.
  private readonly passwordCompareSuccessCache = new Map<string, { expiresAt: number }>();
  private readonly passwordCompareInFlight = new Map<string, Promise<boolean>>();
  private readonly loginResponseInFlight = new Map<string, Promise<AuthResult>>();

  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly loginAttempts: LoginAttemptsService,
    private readonly config: ConfigService,
    private readonly refreshTokens: RefreshTokensService,
    @Optional() private readonly settingsService?: SettingsService,
    @Optional() private readonly observability?: ObservabilityService,
    @Optional() private readonly credentials?: CredentialsService
  ) {
    const configuredConcurrency = Number(this.config.get('auth.passwordCompareConcurrency') || 2);
    const compareConcurrency = Number.isFinite(configuredConcurrency)
      ? Math.max(1, Math.floor(configuredConcurrency))
      : 2;
    this.compareLimiter = new AsyncConcurrencyLimiter(compareConcurrency);
    this.newAuthFlowEnabled = Boolean(this.config.get('auth.newAuthFlowEnabled'));
    this.accessTokenExpiresIn = String(this.config.get('auth.accessTokenExpiresIn') || '20m');
    this.jwtIssuer = String(this.config.get('jwt.issuer') || 'laines-api');
    this.jwtAudience = String(this.config.get('jwt.audience') || 'laines-clients');
    const configuredPasswordCacheMs = Number(this.config.get('auth.passwordCompareSuccessCacheMs') || 120000);
    this.passwordCompareSuccessCacheMs = Number.isFinite(configuredPasswordCacheMs)
      ? Math.max(1000, Math.floor(configuredPasswordCacheMs))
      : 120000;
    const configuredPasswordCacheSize = Number(this.config.get('auth.passwordCompareCacheMaxEntries') || 3000);
    this.passwordCompareMaxCacheEntries = Number.isFinite(configuredPasswordCacheSize)
      ? Math.max(100, Math.floor(configuredPasswordCacheSize))
      : 3000;
  }

  private recordOp(label: string, durationMs: number, context: string, isError = false) {
    this.observability?.recordQuery({
      label,
      durationMs,
      context,
      isError
    });
  }

  private buildPasswordCompareCacheKey(userId: string, passwordHash: string, rawPassword: string) {
    const normalizedUserId = String(userId || '').trim();
    const normalizedPasswordHash = String(passwordHash || '').trim();
    const passwordDigest = createHash('sha256')
      .update(String(rawPassword || ''), 'utf8')
      .digest('hex');
    return `${normalizedUserId}:${normalizedPasswordHash}:${passwordDigest}`;
  }

  private hasValidPasswordCompareCacheEntry(cacheKey: string) {
    const cacheEntry = this.passwordCompareSuccessCache.get(cacheKey);
    if (!cacheEntry) return false;
    if (cacheEntry.expiresAt <= Date.now()) {
      this.passwordCompareSuccessCache.delete(cacheKey);
      return false;
    }
    return true;
  }

  private setPasswordCompareCacheEntry(cacheKey: string) {
    if (this.passwordCompareSuccessCache.size >= this.passwordCompareMaxCacheEntries) {
      const firstKey = this.passwordCompareSuccessCache.keys().next().value;
      if (firstKey) {
        this.passwordCompareSuccessCache.delete(firstKey);
      }
    }
    this.passwordCompareSuccessCache.set(cacheKey, {
      expiresAt: Date.now() + this.passwordCompareSuccessCacheMs
    });
  }

  private buildLoginIssueKey(
    userId: string,
    passwordHash: string,
    rawPassword: string,
    authFlow: AuthFlowVersion,
    clientIp?: string,
    userAgent?: string
  ) {
    const normalizedUserId = String(userId || '').trim();
    const normalizedPasswordHash = String(passwordHash || '').trim();
    const normalizedFlow = String(authFlow || 'v1').trim().toLowerCase();
    const normalizedIp = String(clientIp || '').trim();
    const normalizedUa = String(userAgent || '').trim();
    const passwordDigest = createHash('sha256')
      .update(String(rawPassword || ''), 'utf8')
      .digest('hex');
    const uaDigest = createHash('sha1')
      .update(normalizedUa, 'utf8')
      .digest('hex')
      .slice(0, 16);
    return `${normalizedUserId}:${normalizedPasswordHash}:${passwordDigest}:${normalizedFlow}:${normalizedIp}:${uaDigest}`;
  }

  private async comparePasswordWithCoalescing(
    cacheKey: string,
    plainPassword: string,
    passwordHash: string
  ) {
    if (this.hasValidPasswordCompareCacheEntry(cacheKey)) {
      this.recordOp('auth.login.password_compare.cache_hit', 0, 'POST /auth/login');
      return true;
    }

    const inFlight = this.passwordCompareInFlight.get(cacheKey);
    if (inFlight) {
      const startedAt = Date.now();
      const valid = await inFlight;
      this.recordOp('auth.login.password_compare.coalesced_wait', Date.now() - startedAt, 'POST /auth/login');
      return valid;
    }

    const compareQueueStartedAt = Date.now();
    const releaseCompareSlot = await this.compareLimiter.acquire();
    this.recordOp('auth.login.password_compare.queue_wait', Date.now() - compareQueueStartedAt, 'POST /auth/login');

    const comparePromise = (async () => {
      const compareStartedAt = Date.now();
      try {
        const valid = await bcrypt.compare(plainPassword, passwordHash);
        if (valid) {
          this.setPasswordCompareCacheEntry(cacheKey);
        }
        return valid;
      } finally {
        releaseCompareSlot();
        this.recordOp('auth.login.password_compare', Date.now() - compareStartedAt, 'POST /auth/login');
      }
    })();

    this.passwordCompareInFlight.set(cacheKey, comparePromise);
    try {
      return await comparePromise;
    } finally {
      this.passwordCompareInFlight.delete(cacheKey);
    }
  }

  private normalizeAuthFlow(flow?: AuthFlowVersion | string): AuthFlowVersion {
    const normalized = String(flow || 'v1').trim().toLowerCase();
    if (!this.newAuthFlowEnabled) {
      return 'v1';
    }
    return normalized === 'v2' ? 'v2' : 'v1';
  }

  private warnDeprecatedAuthFlowV1(email: string) {
    this.logger.warn(
      `authFlow v1 está depreciado. Usuário ${email} ainda usa v1. Remoção planejada: ${AUTH_FLOW_V1_REMOVAL_DATE}. Ativar AUTH_NEW_FLOW_ENABLED=true.`
    );
  }

  private async resolveAccessTokenExpiresIn(authFlow: AuthFlowVersion) {
    if (authFlow !== 'v2' || !this.settingsService) {
      return this.accessTokenExpiresIn;
    }

    try {
      const sessionTimeoutMinutes = await this.settingsService.getSessionTimeoutMinutes();
      if (Number.isFinite(Number(sessionTimeoutMinutes))) {
        const bounded = Math.min(Math.max(Math.trunc(Number(sessionTimeoutMinutes)), 5), 120);
        return `${bounded}m`;
      }
    } catch {
      // Mantem fallback para configuracao estatica se leitura de settings falhar.
    }

    return this.accessTokenExpiresIn;
  }

  private normalizeCpf(cpf?: string) {
    const digits = String(cpf || '').replace(/\D/g, '');
    return digits.length === 11 ? digits : '';
  }

  private normalizeBirthDate(value?: string | Date | null) {
    if (!value) return '';
    const normalized = String(value).trim();
    if (!normalized) return '';
    const date = new Date(normalized);
    if (Number.isNaN(date.getTime())) return '';
    return date.toISOString().slice(0, 10);
  }

  private normalizeRecoveryIdentifier(identifier?: string) {
    const normalized = String(identifier || '').trim().toLowerCase();
    if (!normalized) return { raw: '', email: '', cpf: '' };

    if (normalized.includes('@')) {
      return { raw: normalized, email: normalized, cpf: '' };
    }

    const cpf = this.normalizeCpf(normalized);
    return {
      raw: normalized,
      email: cpf ? `${cpf}@laines.ufrn.br` : '',
      cpf
    };
  }

  private async resolveRecoveryIdentityUser(identifier: string) {
    const parsed = this.normalizeRecoveryIdentifier(identifier);
    if (!parsed.raw) return null;

    if (parsed.cpf) {
      const byCpf = await this.users.findByCpf(parsed.cpf);
      if (byCpf) return byCpf;
    }

    if (parsed.email) {
      return this.users.findByEmail(parsed.email);
    }

    return null;
  }

  private ensureActiveUserOrThrow(user: AuthenticatedIdentity | null | undefined, contextMessage = 'Sessao invalida.') {
    if (!user || !user.id) {
      throw new UnauthorizedException(contextMessage);
    }
    if (String(user.status || 'ativo').toLowerCase() !== 'ativo') {
      throw new ForbiddenException('Conta inativa. Procure a administracao.');
    }
  }

  private async signAccessToken(user: AuthenticatedIdentity, authFlow: AuthFlowVersion, sessionId: string) {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      sv: Number(user.sessionVersion || 1),
      typ: 'access',
      sid: sessionId
    };
    const expiresIn = await this.resolveAccessTokenExpiresIn(authFlow);
    const tokenStartedAt = Date.now();
    const signOptions: JwtSignOptions = {
      expiresIn: expiresIn as JwtSignOptions['expiresIn'],
      issuer: this.jwtIssuer,
      audience: this.jwtAudience
    };
    const accessToken = authFlow === 'v2'
      ? await this.jwt.signAsync(payload, signOptions)
      : await this.jwt.signAsync(payload);
    this.recordOp('auth.login.token_sign', Date.now() - tokenStartedAt, 'POST /auth/login');
    return accessToken;
  }

  private async buildAuthResponse(user: AuthenticatedIdentity, input: BuildAuthResponseInput): Promise<AuthResult> {
    const authFlow = this.normalizeAuthFlow(input.authFlow);
    if (authFlow === 'v1') {
      this.warnDeprecatedAuthFlowV1(user.email);
    }
    const sessionId = input.existingRefreshTokenFamilyId || randomUUID();
    const issued = input.existingRefreshToken && input.existingRefreshTokenExpiresAt
      ? { refreshToken: input.existingRefreshToken, refreshTokenExpiresAt: input.existingRefreshTokenExpiresAt }
      : await this.refreshTokens.issue({
        userId: user.id,
        sessionVersion: Number(user.sessionVersion || 1),
        familyId: sessionId,
        userAgent: input.userAgent,
        ipAddress: input.clientIp
      });
    const accessToken = await this.signAccessToken(user, authFlow, sessionId);
    const result: AuthResult = {
      accessToken,
      authFlow,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.name,
        diretoria: user.diretoria || null,
        permissions: getEffectivePermissions({
          role: user.role,
          permissions: user.permissions,
          diretoria: user.diretoria
        }),
        mustChangePassword: user.mustChangePassword ?? false
      }
    };

    if (authFlow === 'v2') {
      result.refreshToken = issued.refreshToken;
      result.refreshTokenExpiresAt = issued.refreshTokenExpiresAt.toISOString();
    }

    return result;
  }

  async register(dto: RegisterDto) {
    const email = dto.email.toLowerCase().trim();
    const existing = await this.users.findByEmail(email);
    if (existing) {
      throw new ConflictException('Email ja cadastrado.');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.users.create({
      email,
      passwordHash,
      name: dto.name.trim(),
      role: 'aluno',
      status: 'ativo'
    });

    return this.buildAuthResponse(user, { authFlow: 'v1' });
  }

  async login(dto: LoginDto, clientIp?: string, userAgent?: string, authFlow: AuthFlowVersion = 'v1') {
    const loginStartedAt = Date.now();
    const loginEmail = dto.email.toLowerCase().trim();
    await this.loginAttempts.assertNotBlocked(loginEmail, clientIp);

    const lookupStartedAt = Date.now();
    const user = await this.users.findAuthByEmail(loginEmail);
    this.recordOp('auth.login.user_lookup', Date.now() - lookupStartedAt, 'POST /auth/login');
    if (!user) {
      await this.loginAttempts.registerFailure(loginEmail, clientIp);
      this.recordOp('auth.login.total', Date.now() - loginStartedAt, 'POST /auth/login', true);
      throw new UnauthorizedException('Credenciais invalidas.');
    }

    const passwordCompareCacheKey = this.buildPasswordCompareCacheKey(user.id, user.passwordHash, dto.password);
    const valid = await this.comparePasswordWithCoalescing(
      passwordCompareCacheKey,
      dto.password,
      user.passwordHash
    );
    if (!valid) {
      await this.loginAttempts.registerFailure(loginEmail, clientIp);
      this.recordOp('auth.login.total', Date.now() - loginStartedAt, 'POST /auth/login', true);
      throw new UnauthorizedException('Credenciais invalidas.');
    }
    if ((user.status || '').toLowerCase() !== 'ativo') {
      this.recordOp('auth.login.total', Date.now() - loginStartedAt, 'POST /auth/login', true);
      throw new ForbiddenException('Conta inativa. Procure a administracao.');
    }

    await this.loginAttempts.clear(loginEmail, clientIp);

    const normalizedAuthFlow = this.normalizeAuthFlow(authFlow);
    const responseIssueKey = this.buildLoginIssueKey(
      user.id,
      user.passwordHash,
      dto.password,
      normalizedAuthFlow,
      clientIp,
      userAgent
    );
    const inFlightResponse = this.loginResponseInFlight.get(responseIssueKey);
    if (inFlightResponse) {
      const startedAt = Date.now();
      const coalescedResponse = await inFlightResponse;
      this.recordOp('auth.login.response_issue.coalesced_wait', Date.now() - startedAt, 'POST /auth/login');
      this.recordOp('auth.login.total', Date.now() - loginStartedAt, 'POST /auth/login');
      return coalescedResponse;
    }

    const responsePromise = this.buildAuthResponse(user, {
      authFlow: normalizedAuthFlow,
      clientIp,
      userAgent
    });
    this.loginResponseInFlight.set(responseIssueKey, responsePromise);
    let response: AuthResult;
    try {
      response = await responsePromise;
    } finally {
      this.loginResponseInFlight.delete(responseIssueKey);
    }
    this.recordOp('auth.login.total', Date.now() - loginStartedAt, 'POST /auth/login');
    return response;
  }

  async refresh(rawRefreshToken: string, clientIp?: string, userAgent?: string) {
    if (!this.newAuthFlowEnabled) {
      throw new UnauthorizedException('Fluxo de refresh desativado.');
    }

    const refreshStartedAt = Date.now();
    const rotateStartedAt = Date.now();
    const rotateResult = await this.refreshTokens.rotate({
      rawRefreshToken,
      ipAddress: clientIp,
      userAgent
    });
    this.recordOp('auth.refresh.rotate', Date.now() - rotateStartedAt, 'POST /auth/refresh');

    if (rotateResult.kind === 'reuse_detected') {
      await this.refreshTokens.revokeFamilyForUser(rotateResult.userId, rotateResult.familyId);
      await this.refreshTokens.revokeAllForUser(rotateResult.userId);
      await this.users.revokeAllSessions(rotateResult.userId);
      this.recordOp('auth.refresh.total', Date.now() - refreshStartedAt, 'POST /auth/refresh', true);
      throw new UnauthorizedException({
        message: 'Reutilizacao de refresh token detectada. Sessao revogada em todos os dispositivos.',
        code: 'REFRESH_TOKEN_REUSE_DETECTED'
      });
    }

    const userLookupStartedAt = Date.now();
    const user = await this.users.findByIdCached(rotateResult.userId);
    this.recordOp('auth.refresh.user_lookup', Date.now() - userLookupStartedAt, 'POST /auth/refresh');
    this.ensureActiveUserOrThrow(user, 'Sessao invalida.');

    const tokenSessionVersion = Number(user!.sessionVersion || 1);
    if (!Number.isFinite(tokenSessionVersion) || tokenSessionVersion < 1) {
      throw new UnauthorizedException('Sessao invalida.');
    }
    if (tokenSessionVersion !== Number(rotateResult.presentedSessionVersion || 0)) {
      await this.refreshTokens.revokeAllForUser(user!.id);
      this.recordOp('auth.refresh.total', Date.now() - refreshStartedAt, 'POST /auth/refresh', true);
      throw new UnauthorizedException('Sessao revogada. Faca login novamente.');
    }

    const responseBuildStartedAt = Date.now();
    const response = await this.buildAuthResponse(user!, {
      authFlow: 'v2',
      clientIp,
      userAgent,
      existingRefreshToken: rotateResult.refreshToken,
      existingRefreshTokenExpiresAt: rotateResult.refreshTokenExpiresAt,
      existingRefreshTokenFamilyId: rotateResult.familyId
    });
    this.recordOp('auth.refresh.response_build', Date.now() - responseBuildStartedAt, 'POST /auth/refresh');
    this.recordOp('auth.refresh.total', Date.now() - refreshStartedAt, 'POST /auth/refresh');
    return response;
  }

  async logout(rawRefreshToken?: string | null, authorization?: string) {
    await this.refreshTokens.revokeCurrent(rawRefreshToken);
    const token = String(authorization || '').replace(/^Bearer\s+/i, '').trim();
    if (token) {
      let payload: { sub?: string; sid?: string; typ?: string } | undefined;
      try {
        payload = this.jwt.verify(token, { issuer: this.jwtIssuer, audience: this.jwtAudience });
      } catch { /* Logout continua idempotente para credenciais expiradas. */ }
      if (payload?.typ === 'access' && payload.sub && payload.sid) {
        await this.refreshTokens.revokeFamilyForUser(payload.sub, payload.sid);
      }
    }
    return { success: true };
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.users.findById(userId);
    if (!user) {
      throw new UnauthorizedException('Usuario nao encontrado.');
    }
    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException('A nova senha deve ser diferente da senha atual.');
    }
    const emailLocalPart = String(user.email || '').split('@')[0].toLowerCase();
    if (emailLocalPart.length >= 4 && dto.newPassword.toLowerCase().includes(emailLocalPart)) {
      throw new BadRequestException('A nova senha nao deve conter seu identificador de login.');
    }

    const valid = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Senha atual invalida.');
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, 10);
    await this.users.updatePasswordAndRevokeSessions(userId, {
      passwordHash,
      mustChangePassword: false,
      tempPassword: null,
      passwordUpdatedAt: new Date()
    });
    await this.refreshTokens.revokeAllForUser(userId);

    return { success: true };
  }

  async recoverPassword(dto: RecoverPasswordDto, clientIp?: string) {
    const attemptKey = `recover-token:${createHash('sha256').update(String(dto.token || '')).digest('hex')}`;
    await this.loginAttempts.assertNotBlocked(attemptKey, clientIp);
    await this.loginAttempts.registerFailure(attemptKey, clientIp);
    if (!this.credentials) throw new BadRequestException('Recuperacao indisponivel.');
    await this.credentials.consume(dto.token, dto.newPassword);
    this.users.clearReadCaches();
    await this.loginAttempts.clear(attemptKey, clientIp);
    return { success: true };
  }

  async logoutAll(userId: string) {
    const user = await this.users.findById(userId);
    if (!user) {
      throw new UnauthorizedException('Usuario nao encontrado.');
    }
    await this.users.revokeAllSessions(userId);
    await this.refreshTokens.revokeAllForUser(userId);
    return { success: true };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    return this.users.updateSelfProfile(userId, dto);
  }

  async listSupervisors() {
    return this.users.listActiveSupervisors();
  }

  async requestPasswordRecovery(dto: RecoveryRequestDto, clientIp?: string): Promise<{ success: true }> {
    const identifier = String(dto.identifier || '').trim().toLowerCase();
    const attemptKey = `recover-request:${createHash('sha256').update(identifier).digest('hex')}`;
    await this.loginAttempts.assertNotBlocked(attemptKey, clientIp);
    await this.loginAttempts.registerFailure(attemptKey, clientIp);
    const user = await this.users.findByEmail(identifier);
    if (user && user.status === 'ativo' && !user.deletedAt) {
      try {
        await this.credentials?.issue(user.id);
      } catch {
        this.logger.error('Falha no processamento da recuperacao de acesso.');
      }
    }
    // Identical response for unknown, inactive and undeliverable accounts.
    return { success: true };
  }
}
