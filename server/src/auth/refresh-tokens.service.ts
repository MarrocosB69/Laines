import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import type { JwtSignOptions } from '@nestjs/jwt';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { Repository } from 'typeorm';
import { RefreshToken } from './refresh-token.entity';

type RefreshTokenPayload = {
  sub: string;
  jti: string;
  fid: string;
  sv: number;
  rc: number;
  typ?: string;
};

type IssueRefreshTokenInput = {
  userId: string;
  sessionVersion: number;
  familyId?: string;
  tokenId?: string;
  rotationCounter?: number;
  userAgent?: string;
  ipAddress?: string;
};

type RotateRefreshTokenInput = {
  rawRefreshToken: string;
  userAgent?: string;
  ipAddress?: string;
};

type RotateRefreshTokenResult =
  | {
    kind: 'ok';
    userId: string;
    familyId: string;
    presentedSessionVersion: number;
    refreshToken: string;
    refreshTokenExpiresAt: Date;
  }
  | {
    kind: 'reuse_detected';
    userId: string;
    familyId: string;
    presentedSessionVersion: number;
  };

type InternalIssuedToken = {
  tokenId: string;
  familyId: string;
  rotationCounter: number;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
};

type RefreshTokenFormat = 'opaque' | 'jwt';

@Injectable()
export class RefreshTokensService {
  private readonly refreshSecret: string;
  private readonly refreshExpiresIn: string;
  private readonly refreshExpiresInMs: number | null;
  private readonly jwtIssuer: string;
  private readonly jwtAudience: string;
  private readonly clockToleranceSeconds: number;
  private readonly refreshTokenFormat: RefreshTokenFormat;
  private readonly opaqueTokenPrefix = 'rt_';

  constructor(
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepository: Repository<RefreshToken>,
    private readonly jwt: JwtService,
    private readonly config: ConfigService
  ) {
    this.refreshSecret = String(this.config.get('jwt.refreshSecret') || this.config.get('jwt.secret') || '');
    this.refreshExpiresIn = String(this.config.get('jwt.refreshExpiresIn') || '14d');
    this.refreshExpiresInMs = this.parseDurationToMs(this.refreshExpiresIn);
    this.jwtIssuer = String(this.config.get('jwt.issuer') || 'laines-api');
    this.jwtAudience = String(this.config.get('jwt.audience') || 'laines-clients');
    const configuredClockTolerance = Number(this.config.get('jwt.clockToleranceSeconds') || 5);
    this.clockToleranceSeconds = Number.isFinite(configuredClockTolerance)
      ? Math.max(0, Math.floor(configuredClockTolerance))
      : 5;
    const configuredRefreshTokenFormat = String(this.config.get('auth.refreshTokenFormat') || 'opaque')
      .trim()
      .toLowerCase();
    this.refreshTokenFormat = configuredRefreshTokenFormat === 'jwt' ? 'jwt' : 'opaque';
  }

  private normalizeOptionalText(value: unknown, maxLength: number) {
    const normalized = String(value || '').trim();
    if (!normalized) return null;
    return normalized.slice(0, maxLength);
  }

  private hashToken(token: string) {
    return createHash('sha256').update(String(token || ''), 'utf8').digest('hex');
  }

  private parseDurationToMs(duration: string): number | null {
    const normalized = String(duration || '').trim().toLowerCase();
    const match = normalized.match(/^(\d+)\s*([smhd])$/i);
    if (!match) return null;
    const value = Number(match[1]);
    if (!Number.isFinite(value) || value <= 0) return null;
    const unit = match[2].toLowerCase();
    const multiplier = unit === 's'
      ? 1000
      : unit === 'm'
        ? 60_000
        : unit === 'h'
          ? 3_600_000
          : 86_400_000;
    return Math.floor(value * multiplier);
  }

  private resolveRefreshTtlMs() {
    if (Number.isFinite(Number(this.refreshExpiresInMs)) && Number(this.refreshExpiresInMs) > 0) {
      return Number(this.refreshExpiresInMs);
    }
    return 14 * 24 * 60 * 60 * 1000;
  }

  private isOpaqueToken(rawToken: string) {
    return String(rawToken || '').trim().startsWith(this.opaqueTokenPrefix);
  }

  private buildOpaqueToken(tokenId: string) {
    const randomSuffix = randomBytes(32).toString('base64url');
    return `${this.opaqueTokenPrefix}${tokenId}.${randomSuffix}`;
  }

  private decodeRefreshToken(token: string) {
    const decoded = this.jwt.decode(token) as { exp?: number } | null;
    const expiresAtMs = Number(decoded?.exp || 0) * 1000;
    if (!Number.isFinite(expiresAtMs) || expiresAtMs <= 0) {
      throw new UnauthorizedException('Sessao invalida. Faca login novamente.');
    }
    return new Date(expiresAtMs);
  }

  private buildRefreshSignOptions(): JwtSignOptions {
    return {
      secret: this.refreshSecret,
      expiresIn: this.refreshExpiresIn as JwtSignOptions['expiresIn'],
      issuer: this.jwtIssuer,
      audience: this.jwtAudience
    };
  }

  private verifyRefreshToken(token: string): RefreshTokenPayload {
    const payload = this.jwt.verify<RefreshTokenPayload>(token, {
      secret: this.refreshSecret,
      issuer: this.jwtIssuer,
      audience: this.jwtAudience,
      clockTolerance: this.clockToleranceSeconds
    });

    const userId = String(payload?.sub || '').trim();
    const tokenId = String(payload?.jti || '').trim();
    const familyId = String(payload?.fid || '').trim();
    const sessionVersion = Number(payload?.sv || 0);
    const rotationCounter = Number(payload?.rc || 0);
    if (!userId || !tokenId || !familyId || !Number.isFinite(sessionVersion) || sessionVersion < 1) {
      throw new UnauthorizedException('Sessao invalida. Faca login novamente.');
    }
    if (!Number.isFinite(rotationCounter) || rotationCounter < 1) {
      throw new UnauthorizedException('Sessao invalida. Faca login novamente.');
    }
    if (payload?.typ && payload.typ !== 'refresh') {
      throw new UnauthorizedException('Tipo de credencial invalido para refresh.');
    }

    return {
      sub: userId,
      jti: tokenId,
      fid: familyId,
      sv: Math.floor(sessionVersion),
      rc: Math.floor(rotationCounter),
      typ: 'refresh'
    };
  }

  private async issueOpaqueWithRepository(
    repository: Repository<RefreshToken>,
    input: IssueRefreshTokenInput
  ): Promise<InternalIssuedToken> {
    const tokenId = input.tokenId || randomUUID();
    const familyId = input.familyId || randomUUID();
    const rotationCounter = Math.max(1, Math.floor(Number(input.rotationCounter || 1)));
    const refreshToken = this.buildOpaqueToken(tokenId);
    const refreshTokenExpiresAt = new Date(Date.now() + this.resolveRefreshTtlMs());

    const row: Partial<RefreshToken> = {
      id: tokenId,
      userId: input.userId,
      familyId,
      tokenHash: this.hashToken(refreshToken),
      rotationCounter,
      sessionVersion: Math.max(1, Math.floor(Number(input.sessionVersion || 1))),
      expiresAt: refreshTokenExpiresAt,
      userAgent: this.normalizeOptionalText(input.userAgent, 255),
      ipAddress: this.normalizeOptionalText(input.ipAddress, 64),
      usedAt: null,
      revokedAt: null,
      replacedByTokenId: null
    };
    await repository.insert(row);

    return {
      tokenId,
      familyId,
      rotationCounter,
      refreshToken,
      refreshTokenExpiresAt
    };
  }

  private async issueLegacyJwtWithRepository(
    repository: Repository<RefreshToken>,
    input: IssueRefreshTokenInput
  ): Promise<InternalIssuedToken> {
    const tokenId = input.tokenId || randomUUID();
    const familyId = input.familyId || randomUUID();
    const rotationCounter = Number(input.rotationCounter || 1);
    const payload: RefreshTokenPayload = {
      sub: input.userId,
      jti: tokenId,
      fid: familyId,
      sv: Number(input.sessionVersion || 1),
      rc: Math.max(1, Math.floor(rotationCounter)),
      typ: 'refresh'
    };

    const issuedAtMs = Date.now();
    const refreshToken = await this.jwt.signAsync(payload, this.buildRefreshSignOptions());
    const refreshTokenExpiresAt = this.refreshExpiresInMs
      ? new Date(issuedAtMs + this.refreshExpiresInMs)
      : this.decodeRefreshToken(refreshToken);

    const row: Partial<RefreshToken> = {
      id: tokenId,
      userId: input.userId,
      familyId,
      tokenHash: this.hashToken(refreshToken),
      rotationCounter: Math.max(1, Math.floor(rotationCounter)),
      sessionVersion: Math.max(1, Math.floor(Number(input.sessionVersion || 1))),
      expiresAt: refreshTokenExpiresAt,
      userAgent: this.normalizeOptionalText(input.userAgent, 255),
      ipAddress: this.normalizeOptionalText(input.ipAddress, 64),
      usedAt: null,
      revokedAt: null,
      replacedByTokenId: null
    };
    await repository.insert(row);

    return {
      tokenId,
      familyId,
      rotationCounter: Math.max(1, Math.floor(rotationCounter)),
      refreshToken,
      refreshTokenExpiresAt
    };
  }

  private async issueWithRepository(
    repository: Repository<RefreshToken>,
    input: IssueRefreshTokenInput
  ): Promise<InternalIssuedToken> {
    if (this.refreshTokenFormat === 'jwt') {
      return this.issueLegacyJwtWithRepository(repository, input);
    }
    return this.issueOpaqueWithRepository(repository, input);
  }

  async issue(input: IssueRefreshTokenInput) {
    return this.issueWithRepository(this.refreshTokenRepository, input);
  }

  private async rotateOpaque(input: RotateRefreshTokenInput): Promise<RotateRefreshTokenResult> {
    const rawToken = String(input.rawRefreshToken || '').trim();
    const tokenHash = this.hashToken(rawToken);
    const now = new Date();
    const nextTokenId = randomUUID();
    const nextRefreshToken = this.buildOpaqueToken(nextTokenId);
    const nextTokenHash = this.hashToken(nextRefreshToken);
    const nextRefreshTokenExpiresAt = new Date(Date.now() + this.resolveRefreshTtlMs());
    const userAgent = this.normalizeOptionalText(input.userAgent, 255);
    const ipAddress = this.normalizeOptionalText(input.ipAddress, 64);

    const rotatedRows = await this.refreshTokenRepository.query(
      `WITH rotated AS (
         UPDATE refresh_tokens
         SET
           used_at = NOW(),
           user_agent = $2,
           ip_address = $3
         WHERE token_hash = $1
           AND revoked_at IS NULL
           AND used_at IS NULL
           AND expires_at > NOW()
         RETURNING user_id, family_id, session_version, rotation_counter
       ),
       inserted AS (
         INSERT INTO refresh_tokens (
           id,
           user_id,
           family_id,
           token_hash,
           rotation_counter,
           session_version,
           expires_at,
           used_at,
           revoked_at,
           replaced_by_token_id,
           user_agent,
           ip_address
         )
         SELECT
           $4,
           rotated.user_id,
           rotated.family_id,
           $5,
           rotated.rotation_counter + 1,
           rotated.session_version,
           $6::timestamp,
           NULL,
           NULL,
           NULL,
           $2,
           $3
         FROM rotated
         RETURNING user_id, family_id, session_version
       )
       SELECT user_id, family_id, session_version FROM inserted`,
      [
        tokenHash,
        userAgent,
        ipAddress,
        nextTokenId,
        nextTokenHash,
        nextRefreshTokenExpiresAt.toISOString()
      ]
    ) as Array<{
      user_id: string;
      family_id: string;
      session_version: number;
    }>;

    if (Array.isArray(rotatedRows) && rotatedRows.length > 0) {
      const row = rotatedRows[0];
      return {
        kind: 'ok',
        userId: String(row.user_id || '').trim(),
        familyId: String(row.family_id || '').trim(),
        presentedSessionVersion: Math.max(1, Math.floor(Number(row.session_version || 1))),
        refreshToken: nextRefreshToken,
        refreshTokenExpiresAt: nextRefreshTokenExpiresAt
      };
    }

    const currentToken = await this.refreshTokenRepository.findOne({
      where: { tokenHash }
    });
    if (!currentToken) {
      throw new UnauthorizedException('Sessao expirada. Faca login novamente.');
    }

    const tokenExpired = currentToken.expiresAt.getTime() <= now.getTime();
    const tokenRevoked = Boolean(currentToken.revokedAt);
    const tokenUsed = Boolean(currentToken.usedAt);

    if (tokenExpired || tokenRevoked) {
      throw new UnauthorizedException('Sessao expirada. Faca login novamente.');
    }

    if (tokenUsed) {
      return {
        kind: 'reuse_detected',
        userId: currentToken.userId,
        familyId: currentToken.familyId,
        presentedSessionVersion: Math.max(1, Math.floor(Number(currentToken.sessionVersion || 1)))
      };
    }

    throw new UnauthorizedException('Sessao expirada. Faca login novamente.');
  }

  private async rotateLegacyJwt(input: RotateRefreshTokenInput): Promise<RotateRefreshTokenResult> {
    const rawToken = String(input.rawRefreshToken || '').trim();
    const payload = this.verifyRefreshToken(rawToken);
    const tokenHash = this.hashToken(rawToken);
    const now = new Date();
    const nextRotationCounter = Number(payload.rc || 0) + 1;
    const nextPayload: RefreshTokenPayload = {
      sub: payload.sub,
      jti: payload.jti,
      fid: payload.fid,
      sv: payload.sv,
      rc: nextRotationCounter,
      typ: 'refresh'
    };
    const nextIssuedAtMs = Date.now();
    const nextRefreshToken = await this.jwt.signAsync(nextPayload, this.buildRefreshSignOptions());
    const nextRefreshTokenExpiresAt = this.refreshExpiresInMs
      ? new Date(nextIssuedAtMs + this.refreshExpiresInMs)
      : this.decodeRefreshToken(nextRefreshToken);
    const nextTokenHash = this.hashToken(nextRefreshToken);

    const rotateCurrentToken = await this.refreshTokenRepository
      .createQueryBuilder()
      .update(RefreshToken)
      .set({
        rotationCounter: nextRotationCounter,
        tokenHash: nextTokenHash,
        expiresAt: nextRefreshTokenExpiresAt,
        userAgent: this.normalizeOptionalText(input.userAgent, 255),
        ipAddress: this.normalizeOptionalText(input.ipAddress, 64)
      } as unknown as Partial<RefreshToken>)
      .where('id = :id', { id: payload.jti })
      .andWhere('token_hash = :tokenHash', { tokenHash })
      .andWhere('user_id = :userId', { userId: payload.sub })
      .andWhere('family_id = :familyId', { familyId: payload.fid })
      .andWhere('rotation_counter = :rotationCounter', { rotationCounter: payload.rc })
      .andWhere('revoked_at IS NULL')
      .andWhere('expires_at > NOW()')
      .execute();

    if (Number(rotateCurrentToken.affected || 0) === 0) {
      const currentToken = await this.refreshTokenRepository.findOne({
        where: { id: payload.jti }
      });
      if (!currentToken) {
        throw new UnauthorizedException('Sessao expirada. Faca login novamente.');
      }

      const tokenBelongsToPayload = currentToken.userId === payload.sub && currentToken.familyId === payload.fid;
      const tokenExpired = currentToken.expiresAt.getTime() <= now.getTime();
      const tokenRevoked = Boolean(currentToken.revokedAt);
      const currentRotationCounter = Number(currentToken.rotationCounter || 1);

      if (!tokenBelongsToPayload) {
        throw new UnauthorizedException('Sessao expirada. Faca login novamente.');
      }

      if (tokenExpired || tokenRevoked) {
        throw new UnauthorizedException('Sessao expirada. Faca login novamente.');
      }

      if (currentRotationCounter > Number(payload.rc || 0)) {
        return {
          kind: 'reuse_detected',
          userId: currentToken.userId || payload.sub,
          familyId: currentToken.familyId || payload.fid,
          presentedSessionVersion: payload.sv
        };
      }

      throw new UnauthorizedException('Sessao expirada. Faca login novamente.');
    }

    return {
      kind: 'ok',
      userId: payload.sub,
      familyId: payload.fid,
      presentedSessionVersion: payload.sv,
      refreshToken: nextRefreshToken,
      refreshTokenExpiresAt: nextRefreshTokenExpiresAt
    };
  }

  async rotate(input: RotateRefreshTokenInput): Promise<RotateRefreshTokenResult> {
    const rawToken = String(input.rawRefreshToken || '').trim();
    if (!rawToken) {
      throw new UnauthorizedException('Sessao expirada. Faca login novamente.');
    }

    if (this.isOpaqueToken(rawToken)) {
      return this.rotateOpaque(input);
    }

    return this.rotateLegacyJwt(input);
  }

  async revokeCurrent(rawRefreshToken?: string | null) {
    const token = String(rawRefreshToken || '').trim();
    if (!token) return;

    if (this.isOpaqueToken(token)) {
      const tokenHash = this.hashToken(token);
      await this.refreshTokenRepository
        .createQueryBuilder()
        .update(RefreshToken)
        .set({
          revokedAt: () => 'NOW()'
        } as unknown as Partial<RefreshToken>)
        .where('token_hash = :tokenHash', { tokenHash })
        .andWhere('revoked_at IS NULL')
        .andWhere('used_at IS NULL')
        .execute();
      return;
    }

    let payload: RefreshTokenPayload;
    try {
      payload = this.verifyRefreshToken(token);
    } catch {
      return;
    }

    const tokenHash = this.hashToken(token);
    const currentToken = await this.refreshTokenRepository.findOne({
      where: { id: payload.jti }
    });
    if (!currentToken) return;
    if (Number(currentToken.rotationCounter || 1) !== Number(payload.rc || 0)) return;
    if (currentToken.tokenHash !== tokenHash) return;
    if (currentToken.revokedAt) return;

    currentToken.revokedAt = new Date();
    await this.refreshTokenRepository.save(currentToken);
  }

  async revokeFamilyForUser(userId: string, familyId: string) {
    const normalizedUserId = String(userId || '').trim();
    const normalizedFamilyId = String(familyId || '').trim();
    if (!normalizedUserId || !normalizedFamilyId) return;

    await this.refreshTokenRepository
      .createQueryBuilder()
      .update(RefreshToken)
      .set({
        revokedAt: () => 'NOW()'
      } as unknown as Partial<RefreshToken>)
      .where('user_id = :userId', { userId: normalizedUserId })
      .andWhere('family_id = :familyId', { familyId: normalizedFamilyId })
      .andWhere('revoked_at IS NULL')
      .execute();
  }

  async revokeAllForUser(userId: string) {
    const normalizedUserId = String(userId || '').trim();
    if (!normalizedUserId) return;
    await this.refreshTokenRepository
      .createQueryBuilder()
      .update(RefreshToken)
      .set({
        revokedAt: () => 'NOW()'
      } as unknown as Partial<RefreshToken>)
      .where('user_id = :userId', { userId: normalizedUserId })
      .andWhere('revoked_at IS NULL')
      .execute();
  }
}

