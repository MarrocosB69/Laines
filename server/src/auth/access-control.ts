import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { isUUID } from 'class-validator';
import {
  ADMIN_AREA_ROLES,
  ADMIN_ROLES,
  PERMISSIONS,
  isStudentMemberRole as isStudentMemberRoleInDomain
} from '../common/domain/access.constants';

export type AuthenticatedUser = {
  id: string;
  email?: string;
  role?: string;
  name?: string;
  diretoria?: string | null;
  permissions?: string[];
  coordAtendimento?: boolean;
  curso?: string | null;
  projetoId?: string | null;
};

type PatientAccessRecord = {
  alunoResponsavelId?: string | null;
  professorSupervisorId?: string | null;
  equipeTecnicaIds?: string[] | null;
  equipeMultiIds?: string[] | null;
};

const GLOBAL_ACCESS_ROLES = new Set<string>([...ADMIN_AREA_ROLES]);

const TEAM_ACCESS_ROLES = new Set([
  'professor',
  'profissional',
  'pesquisador',
  'tecnico',
  'colaborador'
]);

export const normalizeRole = (role?: string) => (role || '').toLowerCase().trim();

export const hasGlobalAccess = (role?: string) => {
  const normalized = normalizeRole(role);
  if (!normalized) return false;
  return GLOBAL_ACCESS_ROLES.has(normalized);
};

export const hasTeamScopedAccess = (role?: string) => TEAM_ACCESS_ROLES.has(normalizeRole(role));

export const isStudentMemberRole = (role?: string) => isStudentMemberRoleInDomain(normalizeRole(role));

export const hasAnyPermission = (user: AuthenticatedUser | undefined, permissions: readonly string[]) => (
  Array.isArray(user?.permissions) && user.permissions.some((permission) => permissions.includes(permission))
);

export const canReadDetailedAnalytics = (user?: AuthenticatedUser) => hasGlobalAccess(user?.role);

export const analyticsProjectScope = (user: AuthenticatedUser | undefined, requested?: string) => {
  if (!user?.id) throw new ForbiddenException('Sessao obrigatoria para acessar indicadores.');
  if (canReadDetailedAnalytics(user)) {
    const value = String(requested || 'all').trim();
    if (!['all', 'sem'].includes(value) && !isUUID(value)) {
      throw new BadRequestException('Projeto invalido para os indicadores.');
    }
    return value;
  }
  if (normalizeRole(user.role) === 'coord_atendimento') return 'all';
  const ownProject = user.projetoId ? String(user.projetoId).trim() : '';
  if (!ownProject) throw new ForbiddenException('Sem projeto vinculado para acessar indicadores.');
  if (!['all', 'sem'].includes(ownProject) && !isUUID(ownProject)) {
    throw new BadRequestException('Projeto vinculado invalido.');
  }
  return ownProject;
};

export const resolveEffectiveAnonymize = (user: AuthenticatedUser | undefined, requested?: string) => (
  canReadDetailedAnalytics(user) && requested === 'false' ? 'false' : 'true'
);

export const assertAnalyticsExport = (user?: AuthenticatedUser) => {
  if (!user?.id) throw new ForbiddenException('Sessao obrigatoria para exportar relatorios.');
  const allowed = [PERMISSIONS.RESEARCH_MANAGE, PERMISSIONS.MARKETING_CREATE, PERMISSIONS.MARKETING_UPDATE_OWN_AREA];
  if (!canReadDetailedAnalytics(user) && !hasAnyPermission(user, allowed)) {
    throw new ForbiddenException('Sem permissao para exportar relatorios.');
  }
};

export const canAccessPatient = (user: AuthenticatedUser | undefined, patient: PatientAccessRecord) => {
  if (!user?.id) return false;
  if (hasGlobalAccess(user.role) || normalizeRole(user.role) === 'coord_atendimento') return true;
  return [patient.alunoResponsavelId, patient.professorSupervisorId, ...(patient.equipeTecnicaIds || []), ...(patient.equipeMultiIds || [])]
    .includes(user.id);
};

export const canAccessAnalyticsDashboard = (user?: AuthenticatedUser) => (
  hasGlobalAccess(user?.role) || normalizeRole(user?.role) === 'coord_atendimento' || hasAnyPermission(user, [
    PERMISSIONS.ADMIN_ACCESS, PERMISSIONS.USERS_MANAGE, PERMISSIONS.PATIENTS_MANAGE,
    PERMISSIONS.RESEARCH_MANAGE, PERMISSIONS.REQUESTS_REVIEW, PERMISSIONS.RESEARCH_CREATE,
    PERMISSIONS.RESEARCH_UPDATE_OWN_AREA, PERMISSIONS.EXTENSAO_CREATE,
    PERMISSIONS.EXTENSAO_UPDATE_OWN_AREA, PERMISSIONS.ENSINO_CREATE,
    PERMISSIONS.ENSINO_UPDATE_OWN_AREA, PERMISSIONS.MARKETING_CREATE,
    PERMISSIONS.MARKETING_UPDATE_OWN_AREA
  ])
);

export const canAccessOperationalAnalytics = (user?: AuthenticatedUser) => (
  ADMIN_ROLES.includes(normalizeRole(user?.role) as typeof ADMIN_ROLES[number])
);

export const canAccessAnalyticsReports = (user?: AuthenticatedUser) => (
  hasGlobalAccess(user?.role) || hasAnyPermission(user, [
    PERMISSIONS.RESEARCH_MANAGE, PERMISSIONS.MARKETING_CREATE, PERMISSIONS.MARKETING_UPDATE_OWN_AREA
  ])
);

const PRESIDENCIA_ROLES = new Set(['presidente', 'vice']);

// Perfil agregado dos atletas (WI-016, decisao 2): gestao, coordenacao de
// atendimento e presidencia/vice que ja usam os Relatorios. So o papel
// coord_atendimento conta, como em `gestao.pacientes`; a marca avulsa
// `coordAtendimento` (equipe de tarefas) nao concede este dado clinico.
export const canAccessAthleteProfileAggregates = (user?: AuthenticatedUser) => {
  const role = normalizeRole(user?.role);
  if (hasGlobalAccess(role)) return true;
  if (role === 'coord_atendimento') return true;
  return PRESIDENCIA_ROLES.has(role) && canAccessAnalyticsReports(user);
};
