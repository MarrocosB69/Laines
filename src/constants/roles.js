export const ADMIN_ROLES = [
  'admin',
  'coordenacao',
  'presidente',
  'vice'
];

export const ADMIN_AREA_ROLES = [
  ...ADMIN_ROLES,
  'diretoria_marketing',
  'diretoria_ensino',
  'diretoria_pesquisa',
  'diretoria_extensao',
  'coord_atendimento'
];

export const PROFESSOR_AREA_ROLES = [
  'professor',
  'profissional',
  'pesquisador',
  'colaborador'
];

export const STUDENT_MEMBER_ROLES = [
  'aluno',
  'presidente',
  'vice'
];

export const normalizeRole = (role) => {
  if (!role) return 'aluno';
  const raw = String(role).toLowerCase().trim();
  const cleaned = raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');

  const map = {
    coordenacao: 'coordenacao',
    coordenacao_geral: 'coordenacao',
    coord_geral: 'coordenacao',
    presidente: 'presidente',
    vice: 'vice',
    vice_presidente: 'vice',
    diretoria_marketing: 'diretoria_marketing',
    diretoria_de_marketing: 'diretoria_marketing',
    diretoria_ensino: 'diretoria_ensino',
    diretoria_de_ensino: 'diretoria_ensino',
    diretoria_pesquisa: 'diretoria_pesquisa',
    diretoria_de_pesquisa: 'diretoria_pesquisa',
    diretoria_extensao: 'diretoria_extensao',
    diretoria_de_extensao: 'diretoria_extensao',
    coordenacao_atendimentos: 'coord_atendimento',
    coordenacao_de_atendimentos: 'coord_atendimento',
    coord_de_atendimento: 'coord_atendimento',
    coord_atendimento: 'coord_atendimento',
    tecnico: 'tecnico',
    equipe: 'tecnico',
    equipe_tecnica: 'tecnico',
    professor: 'professor',
    profissional: 'profissional',
    pesquisador: 'pesquisador',
    colaborador: 'colaborador',
    parceiro: 'colaborador',
    admin: 'admin',
    atleta: 'atleta',
    aluno: 'aluno',
    student: 'aluno'
  };

  if (map[cleaned]) return map[cleaned];
  if (cleaned.includes('admin')) return 'admin';
  if (cleaned.includes('vice') && cleaned.includes('president')) return 'vice';
  if (cleaned.includes('president')) return 'presidente';
  if (cleaned.includes('coord') && cleaned.includes('atend')) return 'coord_atendimento';
  if (cleaned.includes('coorden')) return 'coordenacao';
  if (cleaned.includes('pesquis')) return 'pesquisador';
  if (cleaned.includes('colaborador') || cleaned.includes('parceir')) return 'colaborador';
  if (cleaned.includes('tecnic')) return 'tecnico';
  if (cleaned.includes('atlet')) return 'atleta';
  if (cleaned.includes('profissional')) return 'profissional';
  if (cleaned.includes('prof')) return 'professor';
  if (cleaned.includes('aluno')) return 'aluno';
  return cleaned || 'aluno';
};

export const getRedirectPathFromRole = (role) => {
  const normalized = normalizeRole(role);
  if (ADMIN_AREA_ROLES.includes(normalized)) return '/admin';
  if (PROFESSOR_AREA_ROLES.includes(normalized)) return '/professor';
  if (normalized === 'aluno') return '/aluno';
  if (normalized === 'tecnico') return '/equipe';
  if (normalized === 'atleta') return '/atleta';
  return '/';
};

export const isStudentMemberRole = (role) => STUDENT_MEMBER_ROLES.includes(normalizeRole(role));
