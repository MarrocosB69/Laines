import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  ParseUUIDPipe,
  Param,
  Post,
  Query,
  Req,
  UseGuards
} from '@nestjs/common';
import { AuditoriaService } from './auditoria.service';
import { CriarAuditoriaDto } from './dto/criar-auditoria.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';

@Controller('auditoria')
export class AuditoriaController {
  constructor(private readonly auditoriaService: AuditoriaService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  create(
    @Req() req: { user?: { id: string; email?: string; role?: string; name?: string } },
    @Body() dto: CriarAuditoriaDto
  ) {
    const actor = req.user
      ? {
        id: req.user.id,
        email: req.user.email || '',
        role: req.user.role || '',
        name: req.user.name || ''
      }
      : undefined;

    return this.auditoriaService.create({
      ...dto,
      actor
    });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'coordenacao', 'presidente', 'vice')
  @Get()
  findAll(
    @Query('action') action?: string,
    @Query('entity') entity?: string,
    @Query('entityId') entityId?: string,
    @Query('limit') limit?: string
  ) {
    const parsedLimit = Number.parseInt(String(limit || ''), 10);
    return this.auditoriaService.findAll({
      action: action ? String(action).trim() : undefined,
      entity: entity ? String(entity).trim() : undefined,
      entityId: entityId ? String(entityId).trim() : undefined,
      limit: Number.isFinite(parsedLimit) ? parsedLimit : undefined
    });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'coordenacao', 'presidente', 'vice')
  @Get(':id')
  async findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    const registro = await this.auditoriaService.findById(id);
    if (!registro) {
      throw new NotFoundException('Registro nao encontrado.');
    }
    return registro;
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'coordenacao', 'presidente', 'vice')
  @Delete(':id')
  remove(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.auditoriaService.remove(id);
  }
}
