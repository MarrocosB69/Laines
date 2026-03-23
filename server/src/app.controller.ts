import { Body, Controller, Get, HttpCode, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { AppService } from './app.service';
import { ObservabilityService } from './observability/observability.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly observability: ObservabilityService
  ) {}

  @Get('health')
  health() {
    return this.appService.health();
  }

  @Get('ready')
  readiness() {
    return this.appService.readiness();
  }

  @Post('csp-report')
  @HttpCode(204)
  cspReport(@Req() req: Request, @Body() body: unknown) {
    const payload = body as Record<string, unknown>;
    const report = payload?.['csp-report'] || payload?.['body'] || payload || {};
    const blockedUri = String((report as Record<string, unknown>)?.['blocked-uri'] || '').slice(0, 250);
    const violatedDirective = String((report as Record<string, unknown>)?.['violated-directive'] || '').slice(0, 250);
    const sourceFile = String((report as Record<string, unknown>)?.['source-file'] || '').slice(0, 250);
    const message = [
      'CSP violation report',
      violatedDirective ? `directive=${violatedDirective}` : '',
      blockedUri ? `blocked=${blockedUri}` : '',
      sourceFile ? `source=${sourceFile}` : ''
    ]
      .filter(Boolean)
      .join(' | ');

    this.observability.recordError({
      timestamp: new Date().toISOString(),
      path: '/csp-report',
      method: String(req.method || 'POST').toUpperCase(),
      statusCode: 499,
      message
    });
  }
}
