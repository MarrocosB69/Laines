import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards
} from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min
} from 'class-validator';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthenticatedUser } from '../auth/access-control';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { ADMIN_ROLES, STUDENT_MEMBER_ROLES } from '../common/domain/access.constants';
import { PlanoAlimentarService } from './plano-alimentar.service';
import { PlanoAlimentarStatus } from './plano-alimentar.entity';

const ROLES_EDICAO = [
  ...ADMIN_ROLES,
  ...STUDENT_MEMBER_ROLES,
  'professor',
  'profissional',
  'pesquisador',
  'tecnico',
  'colaborador'
];

class ListPlanosQueryDto {
  @IsOptional()
  @IsString()
  pacienteId?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;
}

class UpsertPlanoDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  expectedVersion?: number;

  @IsString()
  pacienteId!: string;

  @IsOptional()
  @IsString()
  alunoId?: string | null;

  @IsOptional()
  @IsString()
  projetoId?: string | null;

  @IsOptional()
  @IsEnum(PlanoAlimentarStatus)
  status?: PlanoAlimentarStatus;

  @IsOptional()
  @IsDateString()
  dataInicio?: string;

  @IsOptional()
  @IsDateString()
  dataFim?: string | null;

  @IsOptional()
  @IsString()
  tipoDieta?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  metaCalorica?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  metaCHOg?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  metaPTNg?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  metaLIPg?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  metaFibrasg?: number | null;

  @IsOptional()
  @IsString()
  faseAtual?: string | null;

  @IsOptional()
  @IsBoolean()
  validadoAntidoping?: boolean;

  @IsOptional()
  @IsObject()
  dados?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  resultados?: Record<string, unknown>;
}

class UpdatePlanoDto extends UpsertPlanoDto {
  @IsOptional()
  @IsString()
  pacienteId!: string;
}

class ReviewPlanoDto {
  @IsInt()
  @Min(0)
  expectedVersion!: number;

  @IsOptional()
  @IsBoolean()
  confirmarComposicaoManual?: boolean;
}

@Controller('planos-alimentares')
export class PlanoAlimentarController {
  constructor(private readonly service: PlanoAlimentarService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  list(@Req() req: { user: AuthenticatedUser }, @Query() query: ListPlanosQueryDto) {
    return this.service.findAll(req.user, query);
  }

  @UseGuards(JwtAuthGuard)
  @Get('paciente/:pacienteId/contexto')
  getPacienteContext(
    @Req() req: { user: AuthenticatedUser },
    @Param('pacienteId', new ParseUUIDPipe()) pacienteId: string
  ) {
    return this.service.getPacienteContext(pacienteId, req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  findOne(@Req() req: { user: AuthenticatedUser }, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.findById(id, req.user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ROLES_EDICAO)
  @Post()
  create(@Req() req: { user: AuthenticatedUser }, @Body() dto: UpsertPlanoDto) {
    return this.service.create(dto, req.user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ROLES_EDICAO)
  @Patch(':id')
  update(
    @Req() req: { user: AuthenticatedUser },
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdatePlanoDto
  ) {
    return this.service.update(id, dto as any, req.user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ROLES_EDICAO)
  @Post(':id/revisar')
  revisar(@Req() req: { user: AuthenticatedUser }, @Param('id', new ParseUUIDPipe()) id: string, @Body() dto: ReviewPlanoDto) {
    return this.service.revisar(id, dto.expectedVersion, req.user, dto.confirmarComposicaoManual);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ROLES_EDICAO)
  @Post(':id/ativar')
  ativar(@Req() req: { user: AuthenticatedUser }, @Param('id', new ParseUUIDPipe()) id: string, @Body() dto: ReviewPlanoDto) {
    return this.service.ativar(id, req.user, dto.expectedVersion);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/pdf')
  async exportPdf(
    @Req() req: { user: AuthenticatedUser },
    @Param('id', new ParseUUIDPipe()) id: string,
    @Res() res: Response
  ) {
    const pdfBuffer = await this.service.gerarPDF(id, req.user);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=plano-alimentar-${id}.pdf`);
    res.send(pdfBuffer);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ROLES_EDICAO)
  @Delete(':id')
  remove(@Req() req: { user: AuthenticatedUser }, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.remove(id, req.user);
  }
}
