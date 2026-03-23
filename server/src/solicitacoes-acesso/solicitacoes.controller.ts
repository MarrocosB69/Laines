import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  NotFoundException,
  ParseUUIDPipe,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { SolicitacoesService } from './solicitacoes.service';
import { CriarSolicitacaoDto } from './dto/criar-solicitacao.dto';
import { AtualizarSolicitacaoDto } from './dto/atualizar-solicitacao.dto';
import { AprovarSolicitacaoDto } from './dto/aprovar-solicitacao.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { extractClientIp } from '../common/request-ip';
import { ADMIN_ROLES } from '../common/domain/access.constants';
import { parsePagination } from '../common/pagination';

@Controller('solicitacoes-acesso')
export class SolicitacoesController {
  constructor(
    private readonly solicitacoesService: SolicitacoesService,
    private readonly config: ConfigService
  ) {}

  @Post()
  create(@Req() req: Request, @Body() dto: CriarSolicitacaoDto) {
    if (!this.config.get('auth.allowPublicAccessRequest')) {
      throw new ForbiddenException('Solicitacoes publicas de acesso estao desativadas.');
    }
    const clientIp = extractClientIp(req);
    return this.solicitacoesService.create(dto, clientIp);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ADMIN_ROLES)
  @Get()
  findAll(@Query('limit') limit?: string, @Query('offset') offset?: string) {
    const { limit: parsedLimit, offset: parsedOffset } = parsePagination({
      limit,
      offset,
      defaultLimit: 200
    });
    return this.solicitacoesService.findAll(parsedLimit, parsedOffset);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ADMIN_ROLES)
  @Get(':id')
  async findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    const solicitacao = await this.solicitacoesService.findById(id);
    if (!solicitacao) {
      throw new NotFoundException('Solicitacao nao encontrada.');
    }
    return solicitacao;
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ADMIN_ROLES)
  @Patch(':id')
  update(@Param('id', new ParseUUIDPipe()) id: string, @Body() dto: AtualizarSolicitacaoDto) {
    return this.solicitacoesService.update(id, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ADMIN_ROLES)
  @Post(':id/approve')
  approve(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: AprovarSolicitacaoDto
  ) {
    return this.solicitacoesService.approveAndCreateUser(id, dto.cargoSolicitado);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ADMIN_ROLES)
  @Delete(':id')
  remove(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.solicitacoesService.remove(id);
  }
}
