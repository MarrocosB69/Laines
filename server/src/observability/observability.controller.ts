import { Body, Controller, ForbiddenException, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ADMIN_ROLES } from '../common/domain/access.constants';
import { ObservabilityService } from './observability.service';

@Controller('observability')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...ADMIN_ROLES)
export class ObservabilityController {
  constructor(
    private readonly observabilityService: ObservabilityService,
    private readonly config: ConfigService
  ) {}

  @Get('metrics')
  metrics() {
    return this.observabilityService.getMetrics();
  }

  @Get('slo')
  slo() {
    return this.observabilityService.getSloWindow();
  }

  @Get('alerts')
  alerts(@Query('limit') limit?: string) {
    return this.observabilityService.getRecentAlerts(Number(limit || 50));
  }

  @Get('errors')
  errors(@Query('limit') limit?: string) {
    return this.observabilityService.getRecentErrors(Number(limit || 50));
  }

  @Get('events')
  events(
    @Query('limit') limit?: string,
    @Query('type') type?: 'alert' | 'error'
  ) {
    const normalizedType = type === 'alert' || type === 'error' ? type : undefined;
    return this.observabilityService.getPersistedEvents(Number(limit || 100), normalizedType);
  }

  @Post('drill')
  drill(
    @Body('scenario') scenario?: 'error' | 'latency' | 'recover',
    @Body('samples') samples?: number
  ) {
    const drillEnabled = Boolean(this.config.get('observability.drillEnabled'));
    if (!drillEnabled) {
      throw new ForbiddenException('Drill endpoint is disabled. Set OBSERVABILITY_DRILL_ENABLED=true.');
    }
    const safeScenario = scenario === 'error' || scenario === 'recover' ? scenario : 'latency';
    return this.observabilityService.simulateDrill(safeScenario, Number(samples || 120));
  }

  @Post('reset')
  reset() {
    return this.observabilityService.reset();
  }
}
