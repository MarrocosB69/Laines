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
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { SetPermissionsDto } from '../auth/dto/set-permissions.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AuthenticatedUser, normalizeRole } from '../auth/access-control';
import { parsePagination } from '../common/pagination';
import {
  ADMIN_AREA_ROLES,
  ADMIN_ROLES,
  PERMISSIONS
} from '../common/domain/access.constants';

const USER_VIEW_PERMISSIONS = new Set<string>([
  PERMISSIONS.ADMIN_ACCESS,
  PERMISSIONS.USERS_MANAGE
]);
const EQUIPE_ATENDIMENTO_VIEW_PERMISSIONS = new Set<string>([
  PERMISSIONS.USERS_MANAGE,
  PERMISSIONS.PATIENTS_MANAGE,
  PERMISSIONS.RESEARCH_MANAGE,
  PERMISSIONS.RESEARCH_CREATE,
  PERMISSIONS.RESEARCH_UPDATE_OWN_AREA,
  PERMISSIONS.EXTENSAO_CREATE,
  PERMISSIONS.EXTENSAO_UPDATE_OWN_AREA,
  PERMISSIONS.ENSINO_CREATE,
  PERMISSIONS.ENSINO_UPDATE_OWN_AREA,
  PERMISSIONS.MARKETING_CREATE,
  PERMISSIONS.MARKETING_UPDATE_OWN_AREA
]);
const EQUIPE_ATENDIMENTO_VIEW_ROLES = new Set<string>([
  'professor',
  'profissional',
  'pesquisador',
  'colaborador'
]);

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  private hasAdminAreaRole(user?: AuthenticatedUser) {
    const role = normalizeRole(user?.role);
    return role ? (ADMIN_AREA_ROLES as readonly string[]).includes(role) : false;
  }

  private hasAnyPermission(user: AuthenticatedUser | undefined, permissions: Set<string>) {
    const userPermissions = Array.isArray(user?.permissions) ? user.permissions : [];
    return userPermissions.some((permission) => permissions.has(permission));
  }

  private assertCanViewUsers(user?: AuthenticatedUser) {
    if (this.hasAdminAreaRole(user) || this.hasAnyPermission(user, USER_VIEW_PERMISSIONS)) {
      return;
    }
    throw new ForbiddenException('Sem permissao para visualizar membros.');
  }

  private projectMember(member: Record<string, unknown>, viewer: AuthenticatedUser) {
    if (this.hasAdminAreaRole(viewer) || viewer.permissions?.includes(PERMISSIONS.USERS_MANAGE)) return member;
    const { id, name, email, role, status, diretoria, curso, projetoId, projetoNome } = member;
    return { id, name, email, role, status, diretoria, curso, projetoId, projetoNome };
  }

  private assertCanViewEquipeAtendimento(user?: AuthenticatedUser) {
    const role = normalizeRole(user?.role);
    if (
      this.hasAdminAreaRole(user)
      || this.hasAnyPermission(user, EQUIPE_ATENDIMENTO_VIEW_PERMISSIONS)
      || EQUIPE_ATENDIMENTO_VIEW_ROLES.has(role)
    ) {
      return;
    }
    throw new ForbiddenException('Sem permissao para visualizar equipe de atendimento.');
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  async findAll(
    @Req() req: { user: AuthenticatedUser },
    @Query('limit') limit?: string,
    @Query('offset') offset?: string
  ) {
    this.assertCanViewUsers(req.user);
    const { limit: parsedLimit, offset: parsedOffset } = parsePagination({
      limit,
      offset,
      defaultLimit: 50
    });
    const members = await this.usersService.findAll(
      parsedLimit,
      parsedOffset
    );
    return members.map((member) => this.projectMember(member as unknown as Record<string, unknown>, req.user));
  }

  @UseGuards(JwtAuthGuard)
  @Get('meus-supervisionados')
  getMeusSupervisionados(@Req() req: { user: { id: string } }) {
    return this.usersService.getMeusSupervisionados(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('equipe-atendimento')
  listEquipeAtendimento(@Req() req: { user: AuthenticatedUser }) {
    this.assertCanViewEquipeAtendimento(req.user);
    return this.usersService.listEquipeAtendimentoOptions();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ADMIN_ROLES)
  @Get('supervisores')
  listActiveSupervisors() {
    return this.usersService.listActiveSupervisors();
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async findOne(
    @Req() req: { user: AuthenticatedUser },
    @Param('id', new ParseUUIDPipe()) id: string
  ) {
    this.assertCanViewUsers(req.user);
    const user = await this.usersService.findPublicById(id, true);
    if (!user) {
      throw new NotFoundException('Usuario nao encontrado.');
    }
    return this.projectMember(user as unknown as Record<string, unknown>, req.user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ADMIN_ROLES)
  @Post()
  create(@Body() dto: CreateUserDto) {
    return this.usersService.createWithTempPassword(dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ADMIN_ROLES)
  @Patch(':id/permissions')
  setPermissions(
    @Req() req: { user: { role: string } },
    @Param('id', new ParseUUIDPipe()) userId: string,
    @Body() dto: SetPermissionsDto
  ) {
    const adminRoles = ['admin', 'coordenacao'];
    const role = String(req.user?.role || '').toLowerCase();
    if (!adminRoles.includes(role)) {
      throw new ForbiddenException('Sem permissao para esta operacao.');
    }
    return this.usersService.setUserPermissions(userId, dto.permissions);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ADMIN_ROLES)
  @Patch(':id')
  update(@Param('id', new ParseUUIDPipe()) id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(id, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ADMIN_ROLES)
  @Delete(':id')
  remove(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: { user?: { id?: string } }
  ) {
    return this.usersService.remove(id, req.user?.id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ADMIN_ROLES)
  @Patch(':id/reset-password')
  resetPassword(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.usersService.resetTemporaryPassword(id);
  }
}
