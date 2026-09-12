import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { isUUID } from 'class-validator';
import { AuthenticatedUser, normalizeRole } from '../auth/access-control';
import { ADMIN_ROLES, PERMISSIONS } from '../common/domain/access.constants';

export function canReadDetailedAnalytics(user?: AuthenticatedUser) {
  return (ADMIN_ROLES as readonly string[]).includes(normalizeRole(user?.role));
}

export function analyticsProjectScope(user: AuthenticatedUser | undefined, requested?: string) {
  if (!user?.id) throw new ForbiddenException('Sessao obrigatoria para acessar indicadores.');
  if (canReadDetailedAnalytics(user)) {
    const value = String(requested || 'all').trim();
    if (!['all', 'sem'].includes(value) && !isUUID(value)) {
      throw new BadRequestException('Projeto invalido para os indicadores.');
    }
    return value;
  }
  const ownProject = user.projetoId ? String(user.projetoId).trim() : '';
  if (!ownProject) {
    throw new ForbiddenException('Sem projeto vinculado para acessar indicadores.');
  }
  if (!['all', 'sem'].includes(ownProject) && !isUUID(ownProject)) {
    throw new BadRequestException('Projeto vinculado invalido.');
  }
  return ownProject;
}

export function resolveEffectiveAnonymize(user: AuthenticatedUser | undefined, requested?: string): string {
  if (canReadDetailedAnalytics(user)) {
    return requested === 'false' ? 'false' : 'true';
  }
  return 'true';
}

export function assertAnalyticsExport(user?: AuthenticatedUser) {
  if (!user?.id) throw new ForbiddenException('Sessao obrigatoria para exportar relatorios.');
  const allowed = [PERMISSIONS.RESEARCH_MANAGE, PERMISSIONS.MARKETING_CREATE, PERMISSIONS.MARKETING_UPDATE_OWN_AREA];
  if (!canReadDetailedAnalytics(user) && !user.permissions?.some((permission) => (allowed as string[]).includes(permission))) {
    throw new ForbiddenException('Sem permissao para exportar relatorios.');
  }
}
