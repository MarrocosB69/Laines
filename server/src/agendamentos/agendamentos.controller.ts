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
import { AgendamentosService } from './agendamentos.service';
import { CriarAgendamentoDto } from './dto/criar-agendamento.dto';
import { AtualizarAgendamentoDto } from './dto/atualizar-agendamento.dto';
import { RemarcarAgendamentoDto } from './dto/remarcar-agendamento.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AuthenticatedUser } from '../auth/access-control';
import { parsePagination } from '../common/pagination';
import { ADMIN_ROLES, STUDENT_MEMBER_ROLES } from '../common/domain/access.constants';

const ROLES_EDICAO = [
  ...ADMIN_ROLES,
  'coord_atendimento',
  'diretoria_extensao',
  ...STUDENT_MEMBER_ROLES
];
const ROLES_REAGENDAMENTO = [...ROLES_EDICAO, 'atleta'];
const ROLES_ATUALIZACAO = [...ROLES_EDICAO, 'atleta'];

@Controller('agendamentos')
export class AgendamentosController {
  constructor(private readonly agendamentosService: AgendamentosService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  findAll(
    @Req() req: { user: AuthenticatedUser },
    @Query('pacienteId') pacienteId?: string,
    @Query('alunoId') alunoId?: string,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string
  ) {
    const { limit: parsedLimit, offset: parsedOffset } = parsePagination({
      limit,
      offset,
      defaultLimit: 200
    });
    return this.agendamentosService.findAll(req.user, {
      pacienteId,
      alunoId,
      status,
      limit: parsedLimit,
      offset: parsedOffset
    });
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async findOne(@Req() req: { user: AuthenticatedUser }, @Param('id', new ParseUUIDPipe()) id: string) {
    const agendamento = await this.agendamentosService.findById(id, req.user);
    if (!agendamento) {
      throw new NotFoundException('Agendamento nao encontrado.');
    }
    return agendamento;
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ROLES_EDICAO)
  @Post()
  create(@Req() req: { user: AuthenticatedUser }, @Body() dto: CriarAgendamentoDto) {
    return this.agendamentosService.create(dto, req.user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ROLES_REAGENDAMENTO)
  @Post(':id/remarcar')
  reschedule(
    @Req() req: { user: AuthenticatedUser },
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: RemarcarAgendamentoDto
  ) {
    return this.agendamentosService.reschedule(id, dto, req.user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ROLES_ATUALIZACAO)
  @Patch(':id')
  update(
    @Req() req: { user: AuthenticatedUser },
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: AtualizarAgendamentoDto
  ) {
    return this.agendamentosService.update(id, dto, req.user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ADMIN_ROLES)
  @Delete(':id')
  remove(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.agendamentosService.remove(id);
  }
}
