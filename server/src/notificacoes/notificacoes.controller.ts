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
import { NotificacoesService } from './notificacoes.service';
import { CriarNotificacaoDto } from './dto/criar-notificacao.dto';
import { AtualizarNotificacaoDto } from './dto/atualizar-notificacao.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AuthenticatedUser } from '../auth/access-control';

@Controller('notificacoes')
export class NotificacoesController {
  constructor(private readonly notificacoesService: NotificacoesService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  findAll(@Req() req: { user: AuthenticatedUser }, @Query('userId') userId?: string) {
    return this.notificacoesService.findAll({
      requesterId: req.user.id,
      requesterRole: req.user.role,
      userId
    });
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  create(@Req() req: { user: AuthenticatedUser }, @Body() dto: CriarNotificacaoDto) {
    return this.notificacoesService.create(dto, req.user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'coordenacao', 'presidente', 'vice')
  @Patch(':id')
  update(@Param('id', new ParseUUIDPipe()) id: string, @Body() dto: AtualizarNotificacaoDto) {
    return this.notificacoesService.update(id, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'coordenacao', 'presidente', 'vice')
  @Delete(':id')
  remove(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.notificacoesService.remove(id);
  }
}
