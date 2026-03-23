import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Patch,
  Post,
  Req,
  Res,
  UseGuards
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { AuthService, AuthFlowVersion } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UsersService } from '../users/users.service';
import { extractClientIp } from '../common/request-ip';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { readCookie } from '../common/cookies';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
    private readonly config: ConfigService
  ) {}

  private resolveAuthFlow(request: Request): AuthFlowVersion {
    const authFlowHeader = String(request.headers['x-auth-flow'] || '').trim().toLowerCase();
    return authFlowHeader === 'v2' ? 'v2' : 'v1';
  }

  private resolveRefreshCookieName() {
    return String(this.config.get('auth.refreshCookieName') || 'laines_refresh_token');
  }

  private resolveRefreshCookieSameSite(): 'lax' | 'strict' | 'none' {
    const value = String(this.config.get('auth.refreshCookieSameSite') || 'lax').trim().toLowerCase();
    if (value === 'strict' || value === 'none') return value;
    return 'lax';
  }

  private resolveRefreshCookieMaxAgeMs(expiresAtIso?: string) {
    const expiresAtMs = new Date(String(expiresAtIso || '')).getTime();
    if (!Number.isFinite(expiresAtMs) || expiresAtMs <= 0) return undefined;
    const nowMs = Date.now();
    const deltaMs = expiresAtMs - nowMs;
    if (!Number.isFinite(deltaMs) || deltaMs <= 0) return 0;
    return deltaMs;
  }

  private buildRefreshCookieOptions(maxAgeMs?: number) {
    const secureCookie = Boolean(this.config.get('auth.refreshCookieSecure'));
    const cookiePath = String(this.config.get('auth.refreshCookiePath') || '/auth');
    const cookieDomain = String(this.config.get('auth.refreshCookieDomain') || '').trim();
    const sameSite = this.resolveRefreshCookieSameSite();

    return {
      httpOnly: true,
      secure: secureCookie,
      sameSite,
      path: cookiePath,
      ...(cookieDomain ? { domain: cookieDomain } : {}),
      ...(Number.isFinite(Number(maxAgeMs)) ? { maxAge: Number(maxAgeMs) } : {})
    } as const;
  }

  private setRefreshCookie(response: Response, refreshToken: string, expiresAtIso?: string) {
    const cookieName = this.resolveRefreshCookieName();
    const maxAgeMs = this.resolveRefreshCookieMaxAgeMs(expiresAtIso);
    response.cookie(cookieName, refreshToken, this.buildRefreshCookieOptions(maxAgeMs));
  }

  private clearRefreshCookie(response: Response) {
    const cookieName = this.resolveRefreshCookieName();
    response.clearCookie(cookieName, this.buildRefreshCookieOptions());
  }

  private readRefreshTokenFromRequest(request: Request) {
    const cookieName = this.resolveRefreshCookieName();
    return readCookie(request, cookieName);
  }

  @Post('register')
  register(@Body() dto: RegisterDto) {
    const allowRegister = this.config.get('auth.allowRegister');
    if (!allowRegister) {
      throw new ForbiddenException('Cadastro publico desativado.');
    }
    return this.authService.register(dto);
  }

  @Post('login')
  async login(@Req() req: Request, @Res({ passthrough: true }) res: Response, @Body() dto: LoginDto) {
    const clientIp = extractClientIp(req);
    const userAgent = String(req.headers['user-agent'] || '').trim();
    const authFlow = this.resolveAuthFlow(req);
    const response = await this.authService.login(dto, clientIp, userAgent, authFlow);
    if (response.authFlow === 'v2' && response.refreshToken) {
      this.setRefreshCookie(res, response.refreshToken, response.refreshTokenExpiresAt);
    } else {
      this.clearRefreshCookie(res);
    }

    const { refreshToken, refreshTokenExpiresAt, ...safeResponse } = response;
    return safeResponse;
  }

  @Post('refresh')
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = this.readRefreshTokenFromRequest(req);
    const clientIp = extractClientIp(req);
    const userAgent = String(req.headers['user-agent'] || '').trim();
    const response = await this.authService.refresh(refreshToken, clientIp, userAgent);
    if (response.refreshToken) {
      this.setRefreshCookie(res, response.refreshToken, response.refreshTokenExpiresAt);
    } else {
      this.clearRefreshCookie(res);
    }
    const { refreshToken: _refreshToken, refreshTokenExpiresAt: _refreshTokenExpiresAt, ...safeResponse } = response;
    return safeResponse;
  }

  @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = this.readRefreshTokenFromRequest(req);
    await this.authService.logout(refreshToken);
    this.clearRefreshCookie(res);
    return { success: true };
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@Req() req: { user: Record<string, unknown> }) {
    return req.user;
  }

  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  changePassword(
    @Req() req: { user: { id: string } },
    @Body() dto: ChangePasswordDto
  ) {
    return this.authService.changePassword(req.user.id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout-all')
  logoutAll(@Req() req: { user: { id: string } }) {
    return this.authService.logoutAll(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('profile')
  updateProfile(
    @Req() req: { user: { id: string } },
    @Body() dto: UpdateProfileDto
  ) {
    return this.authService.updateProfile(req.user.id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('supervisors')
  listSupervisors() {
    return this.authService.listSupervisors();
  }
}
