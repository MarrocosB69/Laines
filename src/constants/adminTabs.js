import { normalizeRole } from './roles';

export const ADMIN_TAB_PERMISSIONS = Object.freeze({
  admin: ['dashboard', 'users', 'patients', 'reports', 'research', 'ensino', 'extensao', 'requests', 'settings'],
  coordenacao: ['dashboard', 'users', 'patients', 'reports', 'research', 'ensino', 'extensao', 'requests', 'settings'],
  presidente: ['dashboard', 'users', 'patients', 'reports', 'research', 'ensino', 'extensao', 'requests', 'settings'],
  vice: ['dashboard', 'users', 'patients', 'reports', 'research', 'ensino', 'extensao', 'requests', 'settings'],
  diretoria_marketing: ['dashboard', 'reports'],
  diretoria_ensino: ['dashboard', 'ensino'],
  diretoria_pesquisa: ['dashboard', 'research'],
  diretoria_extensao: ['dashboard', 'extensao'],
  coord_atendimento: ['dashboard', 'extensao', 'patients']
});

export const DEFAULT_ADMIN_TABS = Object.freeze(['dashboard']);

export const getAllowedAdminTabs = (role) => {
  const normalizedRole = normalizeRole(role);
  return ADMIN_TAB_PERMISSIONS[normalizedRole] || DEFAULT_ADMIN_TABS;
};
