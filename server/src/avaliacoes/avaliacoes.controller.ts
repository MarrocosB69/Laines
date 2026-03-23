import {
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
  UseGuards
} from '@nestjs/common';
import { AvaliacoesService } from './avaliacoes.service';
import { CriarAvaliacaoDto } from './dto/criar-avaliacao.dto';
import { AtualizarAvaliacaoDto } from './dto/atualizar-avaliacao.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AuthenticatedUser } from '../auth/access-control';
import { parsePagination } from '../common/pagination';
import { ADMIN_ROLES, STUDENT_MEMBER_ROLES } from '../common/domain/access.constants';

const ROLES_EDICAO = [...ADMIN_ROLES, ...STUDENT_MEMBER_ROLES];

@Controller('avaliacoes')
export class AvaliacoesController {
  constructor(private readonly avaliacoesService: AvaliacoesService) {}

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
      offset,
      defaultLimit: 200
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
  @Get(':id')
  async findOne(@Req() req: { user: AuthenticatedUser }, @Param('id', new ParseUUIDPipe()) id: string) {
    const avaliacao = await this.avaliacoesService.findById(id, req.user);
    if (!avaliacao) {
      throw new NotFoundException('Avaliacao nao encontrada.');
    }
    return avaliacao;
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ROLES_EDICAO)
  @Post()
  create(@Req() req: { user: AuthenticatedUser }, @Body() dto: CriarAvaliacaoDto) {
    return this.avaliacoesService.create(dto, req.user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ROLES_EDICAO)
  @Patch(':id')
  update(
    @Req() req: { user: AuthenticatedUser },
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: AtualizarAvaliacaoDto
  ) {
    return this.avaliacoesService.update(id, dto, req.user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ADMIN_ROLES)
  @Delete(':id')
  remove(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.avaliacoesService.remove(id);
  }
}
