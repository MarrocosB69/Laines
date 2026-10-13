import {
  Body,
  Controller,
  Delete,
  Get,
  ParseUUIDPipe,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards
} from '@nestjs/common';
import { TarefasService } from './tarefas.service';
import { CriarTarefaDto } from './dto/criar-tarefa.dto';
import { AtualizarTarefaDto } from './dto/atualizar-tarefa.dto';
import { ConcluirTarefaDto } from './dto/concluir-tarefa.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AuthenticatedUser } from '../auth/access-control';
import { ADMIN_ROLES } from '../common/domain/access.constants';

const ROLES_EDICAO = [
  ...ADMIN_ROLES
];

@Controller('tarefas')
export class TarefasController {
  constructor(private readonly tarefasService: TarefasService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  findAll(
    @Req() req: { user: AuthenticatedUser },
    @Query('assignedRole') assignedRole?: string,
    @Query('status') status?: string
  ) {
    return this.tarefasService.findAll(req.user, { assignedRole, status });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ROLES_EDICAO)
  @Post()
  create(@Req() req: { user: AuthenticatedUser }, @Body() dto: CriarTarefaDto) {
    return this.tarefasService.create(dto, req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/resolver')
  resolve(@Req() req: { user: AuthenticatedUser }, @Param('id', new ParseUUIDPipe()) id: string, @Body() dto: ConcluirTarefaDto) {
    return this.tarefasService.resolve(id, req.user, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ROLES_EDICAO)
  @Patch(':id')
  update(@Req() req: { user: AuthenticatedUser }, @Param('id', new ParseUUIDPipe()) id: string, @Body() dto: AtualizarTarefaDto) {
    return this.tarefasService.update(id, dto, req.user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ROLES_EDICAO)
  @Delete(':id')
  remove(@Req() req: { user: AuthenticatedUser }, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.tarefasService.remove(id, req.user);
  }
}
