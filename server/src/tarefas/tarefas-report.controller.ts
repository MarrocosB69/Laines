import {
  BadRequestException, Controller, Get, Query, Res,
  StreamableFile, UseGuards
} from '@nestjs/common';
import type { Response } from 'express';
import { Readable } from 'stream';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { ADMIN_ROLES } from '../common/domain/access.constants';
import { TarefasReportService, taskReportCsv } from './tarefas-report.service';

@Controller('tarefas/relatorio')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...ADMIN_ROLES)
export class TarefasReportController {
  constructor(private readonly reports: TarefasReportService) {}

  @Get()
  getReport(@Query('range') range?: string) {
    return this.reports.getReport(range);
  }

  @Get('export')
  async exportReport(
    @Res({ passthrough: true }) response: Response,
    @Query('range') range?: string,
    @Query('format') formatInput?: string
  ) {
    const format = String(formatInput || 'csv').trim().toLowerCase();
    if (format !== 'csv' && format !== 'json') {
      throw new BadRequestException('Formato inválido para relatório de tarefas.');
    }
    const report = await this.reports.getReport(range);
    const filename = `tarefas-diretorias-${report.period.range}-${report.period.endDate}.${format}`;
    response.setHeader('Content-Type', format === 'json' ? 'application/json; charset=utf-8' : 'text/csv; charset=utf-8');
    response.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    response.setHeader('Cache-Control', 'no-store');
    const content = format === 'json' ? JSON.stringify(report, null, 2) : taskReportCsv(report);
    return new StreamableFile(Readable.from([content]));
  }
}
