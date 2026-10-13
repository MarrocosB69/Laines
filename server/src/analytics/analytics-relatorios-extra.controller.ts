import { Controller, ForbiddenException, Get, Query, Req, UseGuards } from '@nestjs/common';
import {
  AuthenticatedUser,
  analyticsProjectScope,
  canAccessAnalyticsReports,
  canAccessAthleteProfileAggregates
} from '../auth/access-control';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AnalyticsPerfilService, resolverPeriodoRelatorio } from './analytics-perfil.service';
import { AnalyticsProducaoService } from './analytics-producao.service';

/*
 * Secoes novas dos Relatorios (WI-016, etapas 2 e 3). Rotas separadas do
 * AnalyticsController para nao disputar o arquivo com a etapa 1.
 */
@Controller('analytics/reports')
@UseGuards(JwtAuthGuard)
export class AnalyticsRelatoriosExtraController {
  constructor(
    private readonly perfilService: AnalyticsPerfilService,
    private readonly producaoService: AnalyticsProducaoService
  ) {}

  // Agregado clinico: capacidade propria (decisao 2) e escopo de projeto do
  // servidor; quem nao tem acesso global fica no proprio projeto.
  @Get('perfil-atletas')
  perfilAtletas(
    @Req() req: { user: AuthenticatedUser },
    @Query('range') range?: string,
    @Query('projectId') projectId?: string
  ) {
    if (!canAccessAthleteProfileAggregates(req.user)) {
      throw new ForbiddenException('Sem permissao para acessar o perfil agregado dos atletas.');
    }
    const escopo = analyticsProjectScope(req.user, projectId);
    return this.perfilService.getPerfilAtletas({ periodo: resolverPeriodoRelatorio(range), projectId: escopo });
  }

  // Producao da liga nao e recortada por projeto: conteudos, triagens publicas
  // e pesquisa nao pertencem a um projeto de atendimento.
  @Get('producao')
  producao(
    @Req() req: { user: AuthenticatedUser },
    @Query('range') range?: string
  ) {
    if (!canAccessAnalyticsReports(req.user)) {
      throw new ForbiddenException('Sem permissao para acessar relatorios administrativos.');
    }
    return this.producaoService.getProducao({ periodo: resolverPeriodoRelatorio(range) });
  }
}
