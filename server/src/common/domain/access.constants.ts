export const USER_ROLES = [
  'admin',
  'coordenacao',
  'presidente',
  'vice',
  'diretoria_marketing',
  'diretoria_ensino',
  'diretoria_pesquisa',
  'diretoria_extensao',
  'coord_atendimento',
  'professor',
  'profissional',
  'pesquisador',
  'colaborador',
  'tecnico',
  'atleta',
  'aluno'
] as const;

export const ADMIN_ROLES = [
  'admin',
  'coordenacao',
  'presidente',
  'vice'
] as const;

export const ADMIN_AREA_ROLES = [
  ...ADMIN_ROLES,
  'diretoria_marketing',
  'diretoria_ensino',
  'diretoria_pesquisa',
  'diretoria_extensao',
  'coord_atendimento'
] as const;

export const STUDENT_MEMBER_ROLES = [
  'aluno',
  'presidente',
  'vice'
] as const;

export const USER_STATUS = ['ativo', 'inativo', 'bloqueado'] as const;

export const SOLICITACAO_STATUS = ['pendente', 'aprovado', 'recusado'] as const;

export const SOLICITACAO_CARGOS = [
  'professor',
  'profissional',
  'pesquisador',
  'parceiro',
  'colaborador'
] as const;

export const SOLICITACAO_AREAS = [
  'nutricao',
  'fisioterapia',
  'psicologia',
  'outros'
] as const;

export type UserRole = (typeof USER_ROLES)[number];
export type UserStatus = (typeof USER_STATUS)[number];
export type SolicitacaoStatus = (typeof SOLICITACAO_STATUS)[number];

export const isStudentMemberRole = (role?: string) => {
  const normalized = String(role || '').toLowerCase().trim();
  return (STUDENT_MEMBER_ROLES as readonly string[]).includes(normalized);
};
