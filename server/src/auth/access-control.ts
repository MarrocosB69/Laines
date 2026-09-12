import { ADMIN_AREA_ROLES, isStudentMemberRole as isStudentMemberRoleInDomain } from '../common/domain/access.constants';

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
