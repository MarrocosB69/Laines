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
  UseGuards
} from '@nestjs/common';
import { ConteudosService } from './conteudos.service';
import { CriarConteudoDto } from './dto/criar-conteudo.dto';
import { AtualizarConteudoDto } from './dto/atualizar-conteudo.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';

const ROLES_EDICAO = [
  'admin',
  'coordenacao',
  'presidente',
  'vice',
  'diretoria_ensino',
  'diretoria_extensao',
  'coord_atendimento'
];

@Controller('conteudos')
export class ConteudosController {
  constructor(private readonly conteudosService: ConteudosService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  findAll(@Query('categoria') categoria?: string) {
    return this.conteudosService.findAll({ categoria });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ROLES_EDICAO)
  @Post()
  create(@Body() dto: CriarConteudoDto) {
    return this.conteudosService.create(dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ROLES_EDICAO)
  @Patch(':id')
  update(@Param('id', new ParseUUIDPipe()) id: string, @Body() dto: AtualizarConteudoDto) {
    return this.conteudosService.update(id, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ROLES_EDICAO)
  @Delete(':id')
  remove(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.conteudosService.remove(id);
  }
}
