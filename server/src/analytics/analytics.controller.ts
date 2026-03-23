import { Controller, Get, Query, Res, StreamableFile, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ADMIN_AREA_ROLES } from '../common/domain/access.constants';
import { AnalyticsService } from './analytics.service';

@Controller('analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...ADMIN_AREA_ROLES)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('reports/overview')
  overview(
    @Query('range') range?: string,
    @Query('projectId') projectId?: string,
    @Query('forceRefresh') forceRefresh?: string
  ) {
    const mustRefresh = String(forceRefresh || '').toLowerCase() === 'true';
    return this.analyticsService.getReportsOverview({
      range,
      projectId,
      forceRefresh: mustRefresh
    });
  }

  @Get('dashboard/summary')
  dashboardSummary(
    @Query('forceRefresh') forceRefresh?: string,
    @Query('projectId') projectId?: string
  ) {
    const mustRefresh = String(forceRefresh || '').toLowerCase() === 'true';
    return this.analyticsService.getDashboardSummary({
      forceRefresh: mustRefresh,
      projectId
    });
  }

  @Get('correlations')
  correlations(
    @Query('forceRefresh') forceRefresh?: string,
    @Query('projectId') projectId?: string
  ) {
    const mustRefresh = String(forceRefresh || '').toLowerCase() === 'true';
    return this.analyticsService.getCorrelations({
      forceRefresh: mustRefresh,
      projectId
    });
  }

  @Get('reports/export')
  async exportReports(
    @Res({ passthrough: true }) response: Response,
    @Query('range') range?: string,
    @Query('projectId') projectId?: string,
    @Query('anonymize') anonymize?: string,
    @Query('format') format?: string
  ) {
    const exportResult = await this.analyticsService.exportReports({
      range,
      projectId,
      anonymize,
      format
    });

    response.setHeader('Content-Type', exportResult.mimeType);
    response.setHeader(
      'Content-Disposition',
      `attachment; filename*=UTF-8''${encodeURIComponent(exportResult.filename)}`
    );
    response.setHeader('Cache-Control', 'no-store');
    return new StreamableFile(exportResult.stream);
  }
}
