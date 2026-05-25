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
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AuthenticatedUser } from '../auth/access-control';

const ROLES_EDICAO = [
  'admin',
  'coordenacao',
  'presidente',
  'vice',
  'diretoria_marketing',
  'diretoria_ensino',
  'diretoria_pesquisa',
  'diretoria_extensao',
  'coord_atendimento'
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
  create(@Body() dto: CriarTarefaDto) {
    return this.tarefasService.create(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/resolver')
  resolve(@Req() req: { user: AuthenticatedUser }, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.tarefasService.resolve(id, req.user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ROLES_EDICAO)
  @Patch(':id')
  update(@Param('id', new ParseUUIDPipe()) id: string, @Body() dto: AtualizarTarefaDto) {
    return this.tarefasService.update(id, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ROLES_EDICAO)
  @Delete(':id')
  remove(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.tarefasService.remove(id);
  }
}
