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
  Req,
  UseGuards
} from '@nestjs/common';
import { ProjetosService } from './projetos.service';
import { CriarProjetoDto } from './dto/criar-projeto.dto';
import { AtualizarProjetoDto } from './dto/atualizar-projeto.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AuthenticatedUser } from '../auth/access-control';

const ROLES_EDICAO = [
  'admin',
  'coordenacao',
  'presidente',
  'vice',
  'diretoria_pesquisa'
];

@Controller('projetos')
export class ProjetosController {
  constructor(private readonly projetosService: ProjetosService) {}

  @Get('public')
  findPublic() {
    return this.projetosService.findPublic();
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  findAll(@Req() req: { user: AuthenticatedUser }) {
    return this.projetosService.findAll(req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async findOne(
    @Req() req: { user: AuthenticatedUser },
    @Param('id', new ParseUUIDPipe()) id: string
  ) {
    const projeto = await this.projetosService.findById(id, req.user);
    if (!projeto) {
      throw new NotFoundException('Projeto nao encontrado.');
    }
    return projeto;
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ROLES_EDICAO)
  @Post()
  create(@Body() dto: CriarProjetoDto) {
    return this.projetosService.create(dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ROLES_EDICAO)
  @Patch(':id')
  update(@Param('id', new ParseUUIDPipe()) id: string, @Body() dto: AtualizarProjetoDto) {
    return this.projetosService.update(id, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ROLES_EDICAO)
  @Delete(':id')
  remove(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.projetosService.remove(id);
  }
}
