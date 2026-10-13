export const USER_ROLES = [
  'admin', 'coordenacao', 'presidente', 'vice',
  'diretoria_marketing', 'diretoria_ensino', 'diretoria_pesquisa', 'diretoria_extensao',
  'coord_atendimento', 'professor', 'profissional', 'pesquisador', 'colaborador',
  'tecnico', 'atleta', 'aluno'
] as const;

export const ADMIN_ROLES = ['admin', 'coordenacao'] as const;

export const DIRETORIA_ROLES = [
  'diretoria_marketing',
  'diretoria_ensino',
  'diretoria_pesquisa',
  'diretoria_extensao'
] as const;

export const ADMIN_AREA_ROLES = [
  ...ADMIN_ROLES
] as const;

export const ADMIN_PERMISSION_ROLES = [
  ...ADMIN_AREA_ROLES,
  ...DIRETORIA_ROLES,
  'aluno',
  'presidente',
  'vice',
  'professor',
  'profissional',
  'pesquisador',
  'colaborador'
] as const;

export const STUDENT_MEMBER_ROLES = ['aluno', 'presidente', 'vice'] as const;

export const USER_STATUS = ['ativo', 'inativo', 'bloqueado'] as const;
export const SOLICITACAO_STATUS = ['pendente', 'aprovado', 'recusado'] as const;
export const SOLICITACAO_CARGOS = ['professor', 'profissional', 'pesquisador', 'parceiro', 'colaborador'] as const;
export const SOLICITACAO_AREAS = ['nutricao', 'fisioterapia', 'psicologia', 'outros'] as const;

// Permissoes explicitas que podem ser atribuidas a qualquer usuario
export const PERMISSIONS = {
  ADMIN_ACCESS: 'admin:access',
  USERS_MANAGE: 'users:manage',
  PATIENTS_MANAGE: 'patients:manage',
  RESEARCH_MANAGE: 'research:manage',
  REQUESTS_REVIEW: 'requests:review',
  RESEARCH_CREATE: 'research:create',
  RESEARCH_UPDATE_OWN_AREA: 'research:update-own-area',
  EXTENSAO_CREATE: 'extensao:create',
  EXTENSAO_UPDATE_OWN_AREA: 'extensao:update-own-area',
  ENSINO_CREATE: 'ensino:create',
  ENSINO_UPDATE_OWN_AREA: 'ensino:update-own-area',
  MARKETING_CREATE: 'marketing:create',
  MARKETING_UPDATE_OWN_AREA: 'marketing:update-own-area'
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
export type UserRole = (typeof USER_ROLES)[number];
export type UserStatus = (typeof USER_STATUS)[number];
export type SolicitacaoStatus = (typeof SOLICITACAO_STATUS)[number];

// Roles que implicitamente tem acesso admin sem precisar de permission explicita
export const rolesWithImplicitAdminAccess = (role: string): boolean => {
  return (ADMIN_AREA_ROLES as readonly string[]).includes(role);
};

export const roleCanUseExplicitAdminPermissions = (role?: string | null): boolean => {
  const normalized = String(role || '').toLowerCase().trim();
  return (ADMIN_PERMISSION_ROLES as readonly string[]).includes(normalized);
};

export const roleCanUseDiretoriaPermissions = (role?: string | null): boolean => {
  const normalized = String(role || '').toLowerCase().trim();
  return (STUDENT_MEMBER_ROLES as readonly string[]).includes(normalized)
    || (DIRETORIA_ROLES as readonly string[]).includes(normalized);
};

export const normalizeDiretoria = (diretoria?: string | null): string | null => {
  const normalized = String(diretoria || '')
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');

  if (!normalized) return null;

  const map: Record<string, string> = {
    marketing: 'diretoria_marketing',
    comunicacao: 'diretoria_marketing',
    comunicacao_social: 'diretoria_marketing',
    marketing_comunicacao: 'diretoria_marketing',
    marketing_e_comunicacao: 'diretoria_marketing',
    diretoria_marketing: 'diretoria_marketing',
    diretoria_de_marketing: 'diretoria_marketing',
    diretoria_comunicacao: 'diretoria_marketing',
    diretoria_de_comunicacao: 'diretoria_marketing',
    diretoria_marketing_comunicacao: 'diretoria_marketing',
    diretoria_de_marketing_comunicacao: 'diretoria_marketing',
    diretoria_de_marketing_e_comunicacao: 'diretoria_marketing',
    ensino: 'diretoria_ensino',
    diretoria_ensino: 'diretoria_ensino',
    diretoria_de_ensino: 'diretoria_ensino',
    pesquisa: 'diretoria_pesquisa',
    diretoria_pesquisa: 'diretoria_pesquisa',
    diretoria_de_pesquisa: 'diretoria_pesquisa',
    extensao: 'diretoria_extensao',
    diretoria_extensao: 'diretoria_extensao',
    diretoria_de_extensao: 'diretoria_extensao'
  };

  if (map[normalized]) return map[normalized];

  // Fallback por palavra-chave, no mesmo espirito de normalizeRole.
  // A tabela de apelidos exigia correspondencia exata, e rotulos reais como
  // "Ensino e Capacitacao" ou "Pesquisa e Inovacao" nao estavam nela — o efeito
  // era o membro entrar sem nenhuma area, em silencio. Ordem importa: rotulos
  // compostos casam com o primeiro termo encontrado.
  if (normalized.includes('pesquisa')) return 'diretoria_pesquisa';
  if (normalized.includes('extensao')) return 'diretoria_extensao';
  if (normalized.includes('ensino')) return 'diretoria_ensino';
  if (normalized.includes('marketing') || normalized.includes('comunicacao')) return 'diretoria_marketing';

  return null;
};

// Permissoes derivadas automaticamente da diretoria, sem atribuir manualmente.
// Diretoria e uma atribuicao do discente; os roles diretoria_* seguem aceitos
// apenas como compatibilidade com dados legados.
export const getPermissionsFromDiretoria = (diretoria?: string | null): string[] => {
  const map: Record<string, string[]> = {
    diretoria_pesquisa: [
      PERMISSIONS.RESEARCH_CREATE,
      PERMISSIONS.RESEARCH_UPDATE_OWN_AREA
    ],
    diretoria_extensao: [
      PERMISSIONS.EXTENSAO_CREATE,
      PERMISSIONS.EXTENSAO_UPDATE_OWN_AREA
    ],
    diretoria_ensino: [
      PERMISSIONS.ENSINO_CREATE,
      PERMISSIONS.ENSINO_UPDATE_OWN_AREA
    ],
    diretoria_marketing: [
      PERMISSIONS.MARKETING_CREATE,
      PERMISSIONS.MARKETING_UPDATE_OWN_AREA
    ]
  };
  const normalized = normalizeDiretoria(diretoria);
  return normalized ? (map[normalized] || []) : [];
};

export const getDiretoriaPermissionSource = (user: {
  role?: string | null;
  diretoria?: string | null;
}): string | null => {
  const normalizedDiretoria = normalizeDiretoria(user.diretoria);
  if (normalizedDiretoria) return normalizedDiretoria;

  const normalizedRole = String(user.role || '').toLowerCase().trim();
  return (DIRETORIA_ROLES as readonly string[]).includes(normalizedRole)
    ? normalizedRole
    : null;
};

// Permissoes efetivas do usuario: explicitas + derivadas da diretoria
export const getEffectivePermissions = (user: {
  role: string;
  permissions?: string[];
  diretoria?: string | null;
}): string[] => {
  const explicit = roleCanUseExplicitAdminPermissions(user.role) && Array.isArray(user.permissions)
    ? user.permissions
    : [];
  const diretoriaSource = roleCanUseDiretoriaPermissions(user.role)
    ? getDiretoriaPermissionSource(user)
    : null;
  const derived = diretoriaSource ? getPermissionsFromDiretoria(diretoriaSource) : [];
  return [...new Set([...explicit, ...derived])];
};

export const isStudentMemberRole = (role?: string) => {
  const normalized = String(role || '').toLowerCase().trim();
  return (STUDENT_MEMBER_ROLES as readonly string[]).includes(normalized);
};
