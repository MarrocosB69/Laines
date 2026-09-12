import {
  Controller,
  ForbiddenException,
  Get,
  Query,
  Req,
  Res,
  StreamableFile,
  UseGuards
} from '@nestjs/common';
import type { Response } from 'express';
import { AuthenticatedUser, normalizeRole } from '../auth/access-control';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ADMIN_AREA_ROLES, ADMIN_ROLES, PERMISSIONS } from '../common/domain/access.constants';
import { AnalyticsService } from './analytics.service';
import { analyticsProjectScope, canReadDetailedAnalytics, resolveEffectiveAnonymize } from './analytics-access';

const ADMIN_PANEL_PERMISSIONS = new Set<string>([
  PERMISSIONS.ADMIN_ACCESS,
  PERMISSIONS.USERS_MANAGE,
  PERMISSIONS.PATIENTS_MANAGE,
  PERMISSIONS.RESEARCH_MANAGE,
  PERMISSIONS.REQUESTS_REVIEW,
  PERMISSIONS.RESEARCH_CREATE,
  PERMISSIONS.RESEARCH_UPDATE_OWN_AREA,
  PERMISSIONS.EXTENSAO_CREATE,
  PERMISSIONS.EXTENSAO_UPDATE_OWN_AREA,
  PERMISSIONS.ENSINO_CREATE,
  PERMISSIONS.ENSINO_UPDATE_OWN_AREA,
  PERMISSIONS.MARKETING_CREATE,
  PERMISSIONS.MARKETING_UPDATE_OWN_AREA
]);

const REPORTS_PERMISSIONS = new Set<string>([
  PERMISSIONS.RESEARCH_MANAGE,
  PERMISSIONS.MARKETING_CREATE,
  PERMISSIONS.MARKETING_UPDATE_OWN_AREA
]);

@Controller('analytics')
@UseGuards(JwtAuthGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  private hasAdminAreaRole(user?: AuthenticatedUser) {
    const role = normalizeRole(user?.role);
    return role ? (ADMIN_AREA_ROLES as readonly string[]).includes(role) : false;
  }

  private hasAnyPermission(user: AuthenticatedUser | undefined, allowedPermissions: Set<string>) {
    const permissions = Array.isArray(user?.permissions) ? user.permissions : [];
    return permissions.some((permission) => allowedPermissions.has(permission));
  }

  private assertCanAccessDashboard(user?: AuthenticatedUser) {
    if (this.hasAdminAreaRole(user) || this.hasAnyPermission(user, ADMIN_PANEL_PERMISSIONS)) {
      return;
    }
    throw new ForbiddenException('Sem permissao para acessar indicadores administrativos.');
  }

  private assertCanAccessOperationalBoard(user?: AuthenticatedUser) {
    const role = normalizeRole(user?.role);
    if (role && (ADMIN_ROLES as readonly string[]).includes(role)) {
      return;
    }
    throw new ForbiddenException('Sem permissao para acessar o painel operacional da coordenacao.');
  }

  private assertCanAccessReports(user?: AuthenticatedUser) {
    if (this.hasAdminAreaRole(user) || this.hasAnyPermission(user, REPORTS_PERMISSIONS)) {
      return;
    }
    throw new ForbiddenException('Sem permissao para acessar relatorios administrativos.');
  }

  private resolveEffectiveProjectId(user: AuthenticatedUser | undefined, requestedProjectId?: string): string | undefined {
    return analyticsProjectScope(user, requestedProjectId);
  }

  @Get('reports/overview')
  overview(
    @Req() req: { user: AuthenticatedUser },
    @Query('range') range?: string,
    @Query('projectId') projectId?: string,
    @Query('forceRefresh') forceRefresh?: string
  ) {
    this.assertCanAccessReports(req.user);
    const mustRefresh = String(forceRefresh || '').toLowerCase() === 'true';
    return this.analyticsService.getReportsOverview({
      range,
      projectId: this.resolveEffectiveProjectId(req.user, projectId),
      forceRefresh: mustRefresh
    });
  }

  @Get('dashboard/summary')
  async dashboardSummary(
    @Req() req: { user: AuthenticatedUser },
    @Query('forceRefresh') forceRefresh?: string,
    @Query('projectId') projectId?: string
  ) {
    this.assertCanAccessDashboard(req.user);
    const mustRefresh = String(forceRefresh || '').toLowerCase() === 'true';
    const result = await this.analyticsService.getDashboardSummary({
      forceRefresh: mustRefresh,
      projectId: this.resolveEffectiveProjectId(req.user, projectId)
    }) as Extract<Awaited<ReturnType<AnalyticsService['getDashboardSummary']>>, { appointments: unknown }>;
    if (canReadDetailedAnalytics(req.user)) return result;
    return {
      generatedAt: result.generatedAt,
      filters: result.filters,
      metrics: result.metrics,
      appointments: { summary: result.appointments.summary, items: [] },
      recentActivities: [],
      cache: result.cache
    };
  }

  @Get('dashboard/operational-board')
  operationalBoard(
    @Req() req: { user: AuthenticatedUser },
    @Query('forceRefresh') forceRefresh?: string,
    @Query('projectId') projectId?: string
  ) {
    this.assertCanAccessOperationalBoard(req.user);
    const mustRefresh = String(forceRefresh || '').toLowerCase() === 'true';
    return this.analyticsService.getDashboardOperationalBoard({
      forceRefresh: mustRefresh,
      projectId: this.resolveEffectiveProjectId(req.user, projectId)
    });
  }

  @Get('correlations')
  async correlations(
    @Req() req: { user: AuthenticatedUser },
    @Query('range') range?: string,
    @Query('forceRefresh') forceRefresh?: string,
    @Query('projectId') projectId?: string
  ) {
    this.assertCanAccessReports(req.user);
    const mustRefresh = String(forceRefresh || '').toLowerCase() === 'true';
    const result = await this.analyticsService.getCorrelations({
      range,
      forceRefresh: mustRefresh,
      projectId: this.resolveEffectiveProjectId(req.user, projectId)
    }) as Extract<Awaited<ReturnType<AnalyticsService['getCorrelations']>>, { dataset: unknown }>;
    if (canReadDetailedAnalytics(req.user)) return result;
    return {
      generatedAt: result.generatedAt,
      filters: result.filters,
      dataset: result.dataset,
      absenteeism: {
        byTurn: result.absenteeism.byTurn,
        byLeadTime: result.absenteeism.byLeadTime,
        byAppointmentType: result.absenteeism.byAppointmentType,
        byProject: result.absenteeism.byProject,
        byResponsible: []
      },
      completeness: { ...result.completeness, byResponsible: [] },
      retention: { ...result.retention, byResponsible: [] },
      drivers: result.drivers,
      alerts: result.alerts,
      cache: result.cache
    };
  }

  @Get('reports/export')
  async exportReports(
    @Req() req: { user: AuthenticatedUser },
    @Res({ passthrough: true }) response: Response,
    @Query('range') range?: string,
    @Query('projectId') projectId?: string,
    @Query('anonymize') anonymize?: string,
    @Query('format') format?: string
  ) {
    this.assertCanAccessReports(req.user);
    const exportResult = await this.analyticsService.exportReports({
      range,
      projectId: this.resolveEffectiveProjectId(req.user, projectId),
      anonymize: resolveEffectiveAnonymize(req.user, anonymize),
      format
    }, req.user);

    response.setHeader('Content-Type', exportResult.mimeType);
    response.setHeader(
      'Content-Disposition',
      `attachment; filename*=UTF-8''${encodeURIComponent(exportResult.filename)}`
    );
    response.setHeader('Cache-Control', 'no-store');
    return new StreamableFile(exportResult.stream);
  }
}
