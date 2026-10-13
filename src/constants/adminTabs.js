import { normalizeRole, getGestaoTabsFromCapabilities } from './roles';
import { LIGA_AREA_ROOT_TABS } from './academicNavigation';

// Papeis que podem receber acesso EXPLICITO ao painel administrativo por
// permissao avulsa (ex.: um professor com 'research:manage'). Pertencer a uma
// diretoria NAO concede mais acesso a /admin: a area local de gestao do aluno
// vive dentro de /aluno, junto da sua rotina (UPD-13, UX-04). Papeis
// administrativos (ADMIN_AREA_ROLES) sempre acessam e nao precisam constar
// aqui.
const EXPLICIT_ADMIN_PANEL_ROLES = new Set([
  'aluno',
  'presidente',
  'vice',
  'professor',
  'profissional',
  'pesquisador',
  'colaborador'
]);

// Permissoes avulsas que, quando atribuidas a um desses papeis, liberam o
// acesso ao painel administrativo (independente de diretoria).
const ADMIN_PANEL_GRANTING_PERMISSIONS = new Set([
  'admin:access',
  'users:manage',
  'research:manage',
  'research:create',
  'research:update-own-area',
  'extensao:create',
  'extensao:update-own-area',
  'ensino:create',
  'ensino:update-own-area',
  'marketing:create',
  'marketing:update-own-area',
  'requests:review'
]);

// Usado por AuthContext para compor `canAccessAdmin`. Mantido role/permission
// based porque `capabilities` ainda nao existe no momento em que e chamado
// (e' um dos insumos usados para derivar a reserva local de capabilities).
export const hasAdminPanelPermission = (permissions = [], role = '', _diretoria = '') => {
  const normalizedRole = normalizeRole(role);
  if (!EXPLICIT_ADMIN_PANEL_ROLES.has(normalizedRole)) return false;

  return Array.isArray(permissions)
    && permissions.some((permission) => ADMIN_PANEL_GRANTING_PERMISSIONS.has(permission));
};

export const DEFAULT_ADMIN_TABS = Object.freeze(['dashboard']);

// Fonte de verdade para o que aparece no painel administrativo: o objeto
// `capabilities` vindo do servidor (ou a reserva local de sessao antiga), em
// vez de derivar por papel/diretoria/permissao no cliente (UPD-13).
export const getAllowedAdminTabsFromCapabilities = (capabilities) => {
  const liga = capabilities?.liga || {};
  const gerencia = new Set(Array.isArray(liga.gerencia) ? liga.gerencia : []);
  const tabs = new Set(DEFAULT_ADMIN_TABS);

  Object.entries(LIGA_AREA_ROOT_TABS).forEach(([area, tab]) => {
    if (gerencia.has(area)) tabs.add(tab);
  });

  // Mesma lista que a página única (WI-015) embute para quem tem dois papéis.
  getGestaoTabsFromCapabilities(capabilities).forEach((tab) => tabs.add(tab));

  return [...tabs];
};
