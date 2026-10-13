import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  ParseUUIDPipe,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards
} from '@nestjs/common';
import type { Response } from 'express';
import { AvaliacoesService } from './avaliacoes.service';
import { normalizeAvaliacaoTipo } from './evaluation-registry';
import { RelatorioClinicoService } from './relatorio-clinico.service';
import { CriarAvaliacaoDto } from './dto/criar-avaliacao.dto';
import { AtualizarAvaliacaoDto } from './dto/atualizar-avaliacao.dto';
import { RevisarAvaliacaoDto } from './dto/revisar-avaliacao.dto';
import { DevolverAvaliacaoDto } from './dto/devolver-avaliacao.dto';
import { EnviarRevisaoAvaliacaoDto } from './dto/enviar-revisao-avaliacao.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AuthenticatedUser } from '../auth/access-control';
import { parsePagination } from '../common/pagination';
import { ADMIN_ROLES, STUDENT_MEMBER_ROLES } from '../common/domain/access.constants';

const ROLES_EDICAO = [...ADMIN_ROLES, ...STUDENT_MEMBER_ROLES];
const ROLES_CRIACAO = [...ROLES_EDICAO, 'atleta'];
const ROLES_REVISAO = [
  'professor',
  'profissional',
  'pesquisador',
  'colaborador',
  'aluno',
  'admin',
  'coordenacao',
  'presidente',
  'vice'
];
// UPD-17: devolver exige vinculo de supervisao ou gestao; a regra fina (link
// supervisor/supervisao_aluno/gestao) vive no servico, este e so o pre-filtro.
const ROLES_DEVOLUCAO = [...ADMIN_ROLES, 'professor', 'profissional', 'pesquisador', 'tecnico', 'colaborador'];

@Controller('avaliacoes')
export class AvaliacoesController {
  constructor(
    private readonly avaliacoesService: AvaliacoesService,
    private readonly relatorioClinicoService: RelatorioClinicoService,
  ) {}

  private assertNotImageType(tipo?: string | null) {
    if (normalizeAvaliacaoTipo(tipo) === 'composicao_corporal_imagem') {
      throw new BadRequestException('Use /avaliacoes-imagem para gerenciar a avaliacao por imagem.');
    }
  }

  private async assertNotImageRecord(id: string, user: AuthenticatedUser) {
    const avaliacao = await this.avaliacoesService.findById(id, user);
    if (!avaliacao) throw new NotFoundException('Avaliacao nao encontrada.');
    this.assertNotImageType(avaliacao.tipo);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  findAll(
    @Req() req: { user: AuthenticatedUser },
    @Query('pacienteId') pacienteId?: string,
    @Query('projetoId') projetoId?: string,
    @Query('tipo') tipo?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string
  ) {
    const { limit: parsedLimit, offset: parsedOffset } = parsePagination({
      limit,
      offset
    });
    return this.avaliacoesService.findAll(req.user, {
      pacienteId,
      projetoId,
      tipo,
      limit: parsedLimit,
      offset: parsedOffset
    });
  }

  @UseGuards(JwtAuthGuard)
  @Get('pendencias/:pacienteId')
  getPendencias(
    @Req() req: { user: AuthenticatedUser },
    @Param('pacienteId', new ParseUUIDPipe()) pacienteId: string
  ) {
    return this.avaliacoesService.findPendencias(pacienteId, req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Get('fila-revisao')
  filaRevisao(
    @Req() req: { user: AuthenticatedUser },
    @Query('limit') limit?: string,
    @Query('offset') offset?: string
  ) {
    const { limit: parsedLimit, offset: parsedOffset } = parsePagination({
      limit,
      offset,
      defaultLimit: 25,
      maxLimit: 100
    });
    return this.avaliacoesService.findFilaRevisao(req.user, { limit: parsedLimit, offset: parsedOffset });
  }

  @UseGuards(JwtAuthGuard)
  @Get('paciente/:pacienteId/relatorio-clinico')
  async relatorioClinicoPdf(
    @Req() req: { user: AuthenticatedUser },
    @Param('pacienteId', new ParseUUIDPipe()) pacienteId: string,
    @Res() res: Response
  ) {
    const pdfBuffer = await this.relatorioClinicoService.gerarPDF(pacienteId, req.user);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=relatorio-clinico-${pacienteId}.pdf`);
    res.send(pdfBuffer);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async findOne(@Req() req: { user: AuthenticatedUser }, @Param('id', new ParseUUIDPipe()) id: string) {
    const avaliacao = await this.avaliacoesService.findById(id, req.user);
    if (!avaliacao) {
      throw new NotFoundException('Avaliacao nao encontrada.');
    }
    return avaliacao;
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ROLES_CRIACAO)
  @Post()
  create(@Req() req: { user: AuthenticatedUser }, @Body() dto: CriarAvaliacaoDto) {
    this.assertNotImageType(dto.tipo);
    return this.avaliacoesService.create(dto, req.user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ROLES_REVISAO)
  @Patch(':id/revisar')
  async revisar(
    @Req() req: { user: AuthenticatedUser },
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() _dto: RevisarAvaliacaoDto
  ) {
    await this.assertNotImageRecord(id, req.user);
    return this.avaliacoesService.marcarComoRevisado(id, req.user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ROLES_DEVOLUCAO)
  @Patch(':id/devolver')
  async devolver(
    @Req() req: { user: AuthenticatedUser },
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: DevolverAvaliacaoDto
  ) {
    await this.assertNotImageRecord(id, req.user);
    return this.avaliacoesService.devolver(id, dto.observacao, req.user);
  }

  // UPD-17: envio opcional do aluno para a fila do supervisor. Pre-filtro
  // igual ao de edicao (ROLES_EDICAO); o vinculo fino (responsavel/equipe/
  // gestao) e decidido no servico, atleta nunca esta em ROLES_EDICAO.
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ROLES_EDICAO)
  @Patch(':id/enviar-revisao')
  async enviarRevisao(
    @Req() req: { user: AuthenticatedUser },
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: EnviarRevisaoAvaliacaoDto
  ) {
    await this.assertNotImageRecord(id, req.user);
    return this.avaliacoesService.enviarParaRevisao(id, dto.observacao, req.user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ROLES_EDICAO)
  @Patch(':id')
  async update(
    @Req() req: { user: AuthenticatedUser },
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: AtualizarAvaliacaoDto
  ) {
    this.assertNotImageType(dto.tipo);
    await this.assertNotImageRecord(id, req.user);
    return this.avaliacoesService.update(id, dto, req.user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ADMIN_ROLES)
  @Delete(':id')
  async remove(
    @Req() req: { user: AuthenticatedUser },
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    await this.assertNotImageRecord(id, req.user);
    return this.avaliacoesService.remove(id);
  }
}
