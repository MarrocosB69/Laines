import { ExecutionContext, ForbiddenException, Injectable, Optional } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';

const MUST_CHANGE_PASSWORD_ALLOWLIST: Array<{ method: string; path: string }> = [
  { method: 'GET', path: '/auth/me' },
  { method: 'POST', path: '/auth/change-password' },
  { method: 'POST', path: '/auth/logout-all' }
];

const canProceedWhileMustChangePassword = (method: string, path: string) => {
  const normalizedMethod = String(method || '').toUpperCase();
  const normalizedPath = String(path || '').trim().toLowerCase();
  return MUST_CHANGE_PASSWORD_ALLOWLIST.some((item) => {
    return item.method === normalizedMethod && normalizedPath === item.path;
  });
};

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  private readonly tokenCacheEnabled: boolean;
  private readonly tokenCacheTtlMs: number;
  private readonly tokenCacheMaxEntries: number;
  private readonly tokenCache = new Map<string, { user: Record<string, unknown>; expiresAt: number }>();

  constructor(
    private readonly config: ConfigService,
    @Optional() private readonly usersService?: UsersService
  ) {
    super();
    this.tokenCacheEnabled = this.config.get('auth.guardTokenCacheEnabled') !== false;
    const configuredTtlMs = Number(this.config.get('auth.guardTokenCacheTtlMs') || 800);
    this.tokenCacheTtlMs = Number.isFinite(configuredTtlMs)
      ? Math.max(100, Math.floor(configuredTtlMs))
      : 800;
    const configuredCacheEntries = Number(this.config.get('auth.guardTokenCacheMaxEntries') || 2000);
    this.tokenCacheMaxEntries = Number.isFinite(configuredCacheEntries)
      ? Math.max(100, Math.floor(configuredCacheEntries))
      : 2000;
  }

  private extractBearerToken(authorizationHeader?: string) {
    const raw = String(authorizationHeader || '').trim();
    if (!raw) return '';
    if (!raw.toLowerCase().startsWith('bearer ')) return '';
    return raw.slice(7).trim();
  }

  private readTokenCache(token: string) {
    const entry = this.tokenCache.get(token);
    if (!entry) return null;
    if (entry.expiresAt <= Date.now()) {
      this.tokenCache.delete(token);
      return null;
    }
    return entry.user;
  }

  private writeTokenCache(token: string, user: Record<string, unknown>) {
    if (!token || !user) return;
    if (this.tokenCache.size >= this.tokenCacheMaxEntries) {
      const firstKey = this.tokenCache.keys().next().value;
      if (firstKey) {
        this.tokenCache.delete(firstKey);
      }
    }
    this.tokenCache.set(token, {
      user,
      expiresAt: Date.now() + this.tokenCacheTtlMs
    });
  }

  private enforceMustChangePasswordPolicy(
    user: { mustChangePassword?: boolean } | undefined,
    context: ExecutionContext
  ) {
    const request = context.switchToHttp().getRequest<{ method?: string; path?: string; url?: string }>();
    const requestPath = String(request?.path || request?.url || '').split('?')[0].toLowerCase();
    const requestMethod = String(request?.method || 'GET').toUpperCase();
    const mustChangePassword = Boolean(user?.mustChangePassword);

    if (mustChangePassword && !canProceedWhileMustChangePassword(requestMethod, requestPath)) {
      throw new ForbiddenException('Atualize sua senha para continuar.');
    }

    return user;
  }

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<{ headers?: Record<string, string>; user?: Record<string, unknown> }>();
    const token = this.extractBearerToken(String(request?.headers?.authorization || ''));

    if (this.tokenCacheEnabled && token) {
      const cachedUser = this.readTokenCache(token);
      if (cachedUser) {
        const cachedUserId = String(cachedUser.id || '').trim();
        const cachedSessionVersion = Number(cachedUser.sessionVersion || 0);
        if (this.usersService && cachedUserId && Number.isFinite(cachedSessionVersion) && cachedSessionVersion > 0) {
          const persistedUser = await this.usersService.findByIdCached(cachedUserId);
          const persistedSessionVersion = Number(persistedUser?.sessionVersion || 0);
          const persistedStatus = String(persistedUser?.status || '').toLowerCase();
          const staleCache = !persistedUser
            || !Number.isFinite(persistedSessionVersion)
            || persistedSessionVersion !== cachedSessionVersion
            || persistedStatus !== 'ativo';
          if (staleCache) {
            this.tokenCache.delete(token);
          } else {
            request.user = cachedUser;
            this.enforceMustChangePasswordPolicy(cachedUser as { mustChangePassword?: boolean }, context);
            return true;
          }
        } else {
          request.user = cachedUser;
          this.enforceMustChangePasswordPolicy(cachedUser as { mustChangePassword?: boolean }, context);
          return true;
        }
      }
    }

    const activated = await Promise.resolve(super.canActivate(context));
    if (!activated) return false;

    if (this.tokenCacheEnabled && token) {
      const authenticatedRequest = context.switchToHttp().getRequest<{ user?: Record<string, unknown> }>();
      if (authenticatedRequest?.user) {
        this.writeTokenCache(token, authenticatedRequest.user);
      }
    }

    return true;
  }

  handleRequest<TUser = any>(
    err: any,
    user: any,
    info: any,
    context: ExecutionContext,
    status?: any
  ): TUser {
    const authenticated = super.handleRequest(err, user, info, context, status) as { mustChangePassword?: boolean } | undefined;
    return this.enforceMustChangePasswordPolicy(authenticated, context) as TUser;
  }
}
