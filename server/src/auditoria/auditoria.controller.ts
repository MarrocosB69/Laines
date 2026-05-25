import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
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
import { hasGlobalAccess, hasTeamScopedAccess, isStudentMemberRole, normalizeRole } from '../auth/access-control';
import { ADMIN_ROLES } from '../common/domain/access.constants';

type AuditUser = {
  id: string;
  email?: string;
  role?: string;
  name?: string;
};

type ClientAuditRule = {
  entity: string;
  action: string;
  canRegister: (role: string) => boolean;
};

const isAdminAuditRole = (role: string) => (ADMIN_ROLES as readonly string[]).includes(role);
const isClinicalAuditRole = (role: string) => (
  hasGlobalAccess(role)
  || hasTeamScopedAccess(role)
  || isStudentMemberRole(role)
);
const isProjectAuditRole = (role: string) => (
  isAdminAuditRole(role)
  || role === 'diretoria_pesquisa'
);

const CLIENT_AUDIT_RULES: ClientAuditRule[] = [
  { entity: 'pacientes', action: 'paciente_create', canRegister: isClinicalAuditRole },
  { entity: 'pacientes', action: 'paciente_update', canRegister: isClinicalAuditRole },
  { entity: 'pacientes', action: 'paciente_delete', canRegister: isAdminAuditRole },
  { entity: 'pacientes', action: 'paciente_link', canRegister: isClinicalAuditRole },
  { entity: 'pacientes', action: 'paciente_bulk_project', canRegister: isClinicalAuditRole },
  { entity: 'avaliacoes', action: 'avaliacao_create', canRegister: isClinicalAuditRole },
  { entity: 'avaliacoes', action: 'avaliacao_update', canRegister: isClinicalAuditRole },
  { entity: 'avaliacoes', action: 'avaliacao_update_after_create_conflict', canRegister: isClinicalAuditRole },
  { entity: 'avaliacoes', action: 'avaliacao_sync', canRegister: isProjectAuditRole },
  { entity: 'agendamentos', action: 'agendamento_create', canRegister: isClinicalAuditRole },
  { entity: 'agendamentos', action: 'agendamento_update', canRegister: isClinicalAuditRole },
  { entity: 'agendamentos', action: 'agendamento_reschedule', canRegister: (role) => isClinicalAuditRole(role) || role === 'atleta' },
  { entity: 'projetos_pesquisa', action: 'projeto_create', canRegister: isProjectAuditRole },
  { entity: 'projetos_pesquisa', action: 'projeto_update', canRegister: isProjectAuditRole },
  { entity: 'solicitacoes_acesso', action: 'solicitacao_aprovada', canRegister: isAdminAuditRole },
  { entity: 'admin_settings', action: 'settings_upsert', canRegister: isAdminAuditRole }
];

const findClientAuditRule = (entity: string, action: string) => (
  CLIENT_AUDIT_RULES.find((rule) => rule.entity === entity && rule.action === action)
);

@Controller('auditoria')
export class AuditoriaController {
  constructor(private readonly auditoriaService: AuditoriaService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  create(
    @Req() req: { user?: AuditUser },
    @Body() dto: CriarAuditoriaDto
  ) {
    const action = String(dto.action || '').trim();
    const entity = String(dto.entity || '').trim();
    const entityId = dto.entityId ? String(dto.entityId).trim() : undefined;
    const role = normalizeRole(req.user?.role);
    const rule = findClientAuditRule(entity, action);

    if (!rule) {
      throw new BadRequestException('Evento de auditoria nao permitido para registro pelo cliente.');
    }
    if (!role || !rule.canRegister(role)) {
      throw new ForbiddenException('Seu perfil nao pode registrar este evento de auditoria.');
    }

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
      action,
      entity,
      entityId,
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
