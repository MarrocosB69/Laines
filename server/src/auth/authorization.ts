import { ForbiddenException } from '@nestjs/common';
import {
  ADMIN_ROLES,
  DIRETORIA_ROLES,
  PERMISSIONS,
  getDiretoriaPermissionSource,
  getEffectivePermissions
} from '../common/domain/access.constants';
import {
  AuthenticatedUser,
  canAccessAnalyticsDashboard,
  canAccessAnalyticsReports,
  canAccessAthleteProfileAggregates,
  canAccessOperationalAnalytics,
  canReadDetailedAnalytics,
  hasAnyPermission,
  hasGlobalAccess,
  hasTeamScopedAccess,
  isStudentMemberRole,
  normalizeRole
} from './access-control';

/*
 * Contrato unico de autorizacao (UPD-12).
 *
 * Tres dimensoes independentes: papel, vinculo academico (diretoria/capacidade)
 * e vinculo assistencial. Nenhuma delas concede a outra. Os servicos clinicos
 * chamam estas funcoes em vez de repetir a regra; a interface recebe a projecao
 * de capacidades e nao decide acesso por conta propria.
 */

export type ClinicalLink =
  | 'gestao'           // admin/coordenacao: excecao operacional, auditada
  | 'coord_atendimento' // leitura global para coordenar pacientes, sem autoria clinica
  | 'responsavel'      // aluno responsavel pelo paciente
  | 'supervisor'       // professor supervisor do caso
  | 'equipe'           // equipe tecnica ou multiprofissional
  | 'supervisao_aluno' // supervisor/profissional do aluno responsavel
  | 'atleta';          // o proprio paciente

export type ClinicalPatientRecord = {
  id?: string;
  alunoResponsavelId?: string | null;
  professorSupervisorId?: string | null;
  equipeTecnicaIds?: string[] | null;
  equipeMultiIds?: string[] | null;
  atletaUserId?: string | null;
};

export type StudentLinkRecord = {
  supervisorId?: string | null;
  profissionalId?: string | null;
  deletedAt?: Date | null;
} | null | undefined;

export type StudentLookup = (alunoId: string) => Promise<StudentLinkRecord>;

const userIdOf = (user?: AuthenticatedUser) => String(user?.id || '').trim();

const isTeamMember = (userId: string, paciente: ClinicalPatientRecord) => (
  (paciente.equipeTecnicaIds || []).includes(userId) || (paciente.equipeMultiIds || []).includes(userId)
);

// Decisao sem banco: vinculo direto entre usuario e registro do paciente.
export const resolveDirectClinicalLink = (
  user: AuthenticatedUser | undefined,
  paciente: ClinicalPatientRecord | null | undefined
): ClinicalLink | null => {
  const userId = userIdOf(user);
  if (!userId || !paciente) return null;
  const role = normalizeRole(user?.role);

  if (role === 'atleta') return paciente.atletaUserId === userId ? 'atleta' : null;
  if (hasGlobalAccess(role)) return 'gestao';
  if (role === 'coord_atendimento') return 'coord_atendimento';

  if (isStudentMemberRole(role)) {
    if (paciente.alunoResponsavelId === userId) return 'responsavel';
    if (isTeamMember(userId, paciente)) return 'equipe';
    return null;
  }

  if (hasTeamScopedAccess(role)) {
    if (paciente.professorSupervisorId === userId) return 'supervisor';
    if (paciente.alunoResponsavelId === userId) return 'responsavel';
    if (isTeamMember(userId, paciente)) return 'equipe';
    return null;
  }

  return null;
};

// Decisao completa: inclui a cadeia do aluno responsavel (supervisor/profissional).
export const resolveClinicalLink = async (
  user: AuthenticatedUser | undefined,
  paciente: ClinicalPatientRecord | null | undefined,
  lookupStudent?: StudentLookup
): Promise<ClinicalLink | null> => {
  const direct = resolveDirectClinicalLink(user, paciente);
  if (direct) return direct;
  const userId = userIdOf(user);
  if (!userId || !paciente?.alunoResponsavelId || !lookupStudent) return null;
  if (!hasTeamScopedAccess(normalizeRole(user?.role))) return null;
  const aluno = await lookupStudent(paciente.alunoResponsavelId);
  if (!aluno || aluno.deletedAt) return null;
  return aluno.supervisorId === userId || aluno.profissionalId === userId ? 'supervisao_aluno' : null;
};

export const assertClinicalLink = async (
  user: AuthenticatedUser | undefined,
  paciente: ClinicalPatientRecord | null | undefined,
  lookupStudent?: StudentLookup,
  message = 'Acesso negado para este paciente.'
): Promise<ClinicalLink> => {
  const link = await resolveClinicalLink(user, paciente, lookupStudent);
  if (!link) throw new ForbiddenException(message);
  return link;
};

export const studentLookupFromRepository = (
  repo: { findOne(options: { where: { id: string } }): Promise<StudentLinkRecord> } | undefined
): StudentLookup | undefined => (repo ? (id) => repo.findOne({ where: { id } }) : undefined);

export const isManagementLink = (link: ClinicalLink | null | undefined) => (
  link === 'gestao' || link === 'coord_atendimento'
);

/*
 * Filtro de listagem. Usa o parametro :userId. `supervisedStudentsSubquery` e a
 * subconsulta (ids dos alunos supervisionados) montada pelo servico com o query
 * builder; sem ela a cadeia do aluno nao entra no filtro.
 * Retorna null quando nao ha restricao (gestao) e '1 = 0' quando o papel nao
 * tem escopo clinico algum.
 */
export const clinicalScopeCondition = (params: {
  alias: string;
  user: AuthenticatedUser | undefined;
  supervisedStudentsSubquery?: string;
}): string | null => {
  const { alias, user, supervisedStudentsSubquery } = params;
  const role = normalizeRole(user?.role);
  if (hasGlobalAccess(role) || role === 'coord_atendimento') return null;
  if (!userIdOf(user)) return '1 = 0';

  const team = `:userId = ANY(COALESCE(${alias}.equipeTecnicaIds, ARRAY[]::uuid[])) OR :userId = ANY(COALESCE(${alias}.equipeMultiIds, ARRAY[]::uuid[]))`;
  if (role === 'atleta') return `${alias}.atletaUserId = :userId`;
  if (isStudentMemberRole(role)) return `(${alias}.alunoResponsavelId = :userId OR ${team})`;
  if (hasTeamScopedAccess(role)) {
    const chain = supervisedStudentsSubquery ? ` OR ${alias}.alunoResponsavelId IN (${supervisedStudentsSubquery})` : '';
    return `(${alias}.professorSupervisorId = :userId OR ${alias}.alunoResponsavelId = :userId${chain} OR ${team})`;
  }
  return '1 = 0';
};

/* ---------- Liga: leitura transversal e gestao local ---------- */

export const LIGA_AREAS = ['ensino', 'pesquisa', 'extensao', 'comunicacao'] as const;
export type LigaArea = (typeof LIGA_AREAS)[number];

const AREA_BY_DIRETORIA: Record<string, LigaArea> = {
  diretoria_ensino: 'ensino',
  diretoria_pesquisa: 'pesquisa',
  diretoria_extensao: 'extensao',
  diretoria_marketing: 'comunicacao'
};

const AREA_BY_PERMISSION_PREFIX: Record<string, LigaArea> = {
  ensino: 'ensino',
  research: 'pesquisa',
  extensao: 'extensao',
  marketing: 'comunicacao'
};

export const managedLigaAreas = (user: AuthenticatedUser | undefined): LigaArea[] => {
  const role = normalizeRole(user?.role);
  if (hasGlobalAccess(role)) return [...LIGA_AREAS];
  const areas = new Set<LigaArea>();
  const diretoria = getDiretoriaPermissionSource({ role, diretoria: user?.diretoria || null });
  if (diretoria && AREA_BY_DIRETORIA[diretoria] && (isStudentMemberRole(role) || (DIRETORIA_ROLES as readonly string[]).includes(role))) {
    areas.add(AREA_BY_DIRETORIA[diretoria]);
  }
  for (const permission of getEffectivePermissions({ role, permissions: user?.permissions, diretoria: user?.diretoria || null })) {
    const area = AREA_BY_PERMISSION_PREFIX[permission.split(':')[0]];
    if (area) areas.add(area);
  }
  return LIGA_AREAS.filter((area) => areas.has(area));
};

/* ---------- Projecao de capacidades para a interface ---------- */

export type Capabilities = {
  liga: {
    leitura: boolean;
    areas: LigaArea[];
    gerencia: LigaArea[];
    aprovaConteudo: boolean;
  };
  atendimento: {
    habilitado: boolean;
    escopo: 'gestao' | 'vinculo' | 'proprio' | 'nenhum';
    motivo: 'sem_vinculo' | 'perfil_sem_atendimento' | null;
    criaPaciente: boolean;
    gerenciaVinculos: boolean;
    revisaPlano: boolean;
  };
  gestao: {
    painel: boolean;
    usuarios: boolean;
    solicitacoes: boolean;
    pacientes: boolean;
    configuracoes: boolean;
    relatorios: { painel: boolean; operacional: boolean; detalhado: boolean; exportacao: boolean; perfilAtletas: boolean };
  };
  acessoClinicoGestao: boolean;
};

const PATIENT_CREATOR_ROLES = new Set<string>([...ADMIN_ROLES, 'coord_atendimento', 'professor', 'profissional', 'presidente', 'vice']);
const REVIEWER_ROLES = new Set(['professor', 'profissional']);

export type CapabilityInput = AuthenticatedUser & {
  supervisorId?: string | null;
  crn?: string | null;
  conselhoTipo?: string | null;
  conselhoNumero?: string | null;
};

export const buildCapabilities = (user: CapabilityInput): Capabilities => {
  const role = normalizeRole(user.role);
  const permissions = getEffectivePermissions({ role, permissions: user.permissions, diretoria: user.diretoria || null });
  const scoped: AuthenticatedUser = { ...user, permissions };
  const isAdmin = hasGlobalAccess(role);
  const isAthlete = role === 'atleta';
  const isStudent = isStudentMemberRole(role);
  const isTeam = hasTeamScopedAccess(role);

  const hasStudentBond = Boolean(user.supervisorId) && Boolean(user.projetoId);
  let escopo: Capabilities['atendimento']['escopo'] = 'nenhum';
  let motivo: Capabilities['atendimento']['motivo'] = 'perfil_sem_atendimento';
  if (isAdmin || role === 'coord_atendimento') { escopo = 'gestao'; motivo = null; }
  else if (isAthlete) { escopo = 'proprio'; motivo = null; }
  else if (isStudent) { escopo = hasStudentBond ? 'vinculo' : 'nenhum'; motivo = hasStudentBond ? null : 'sem_vinculo'; }
  else if (isTeam) { escopo = 'vinculo'; motivo = null; }

  const crn = String(user.crn || '').trim()
    || (String(user.conselhoTipo || '').toUpperCase() === 'CRN' ? String(user.conselhoNumero || '').trim() : '');

  return {
    liga: {
      leitura: !isAthlete,
      areas: isAthlete ? [] : [...LIGA_AREAS],
      gerencia: managedLigaAreas(scoped),
      aprovaConteudo: isAdmin
    },
    atendimento: {
      habilitado: escopo !== 'nenhum',
      escopo,
      motivo,
      criaPaciente: PATIENT_CREATOR_ROLES.has(role),
      gerenciaVinculos: isAdmin || role === 'coord_atendimento',
      revisaPlano: REVIEWER_ROLES.has(role) && Boolean(crn)
    },
    gestao: {
      painel: canAccessAnalyticsDashboard(scoped),
      usuarios: isAdmin || hasAnyPermission(scoped, [PERMISSIONS.USERS_MANAGE]),
      solicitacoes: isAdmin || hasAnyPermission(scoped, [PERMISSIONS.REQUESTS_REVIEW]),
      pacientes: isAdmin || role === 'coord_atendimento' || hasAnyPermission(scoped, [PERMISSIONS.PATIENTS_MANAGE]),
      configuracoes: isAdmin,
      relatorios: {
        painel: canAccessAnalyticsDashboard(scoped),
        operacional: canAccessOperationalAnalytics(scoped),
        detalhado: canReadDetailedAnalytics(scoped),
        exportacao: canAccessAnalyticsReports(scoped),
        // Agregado clinico com grupo minimo de 5 (WI-016); nunca dado por pessoa.
        perfilAtletas: canAccessAthleteProfileAggregates(scoped)
      }
    },
    acessoClinicoGestao: isAdmin || role === 'coord_atendimento'
  };
};

/* ---------- Trilha do acesso de gestao a registro clinico ---------- */

type AuditWriter = { create(entry: { action: string; entity: string; entityId?: string; meta?: Record<string, unknown> }): Promise<unknown> };

const recentManagementAccess = new Map<string, number>();
const MANAGEMENT_ACCESS_WINDOW_MS = 5 * 60 * 1000;

// Admin/coordenacao acessam registros clinicos como excecao operacional. A trilha
// registra uma vez por janela para o mesmo usuario/objeto, sem bloquear a leitura.
export const auditManagementAccess = async (
  auditoria: AuditWriter | undefined,
  user: AuthenticatedUser | undefined,
  entity: string,
  entityId: string,
  meta: Record<string, unknown> = {}
): Promise<void> => {
  if (!auditoria || !user?.id || !entityId) return;
  const key = `${user.id}:${entity}:${entityId}:${String(meta.acao || '')}`;
  const now = Date.now();
  const last = recentManagementAccess.get(key) || 0;
  if (now - last < MANAGEMENT_ACCESS_WINDOW_MS) return;
  recentManagementAccess.set(key, now);
  if (recentManagementAccess.size > 5000) {
    for (const [entryKey, at] of recentManagementAccess) {
      if (now - at >= MANAGEMENT_ACCESS_WINDOW_MS) recentManagementAccess.delete(entryKey);
    }
  }
  try {
    await auditoria.create({
      action: 'acesso_clinico_gestao',
      entity,
      entityId,
      meta: { userId: user.id, role: normalizeRole(user.role), via: 'gestao', ...meta }
    });
  } catch {
    // A trilha nao pode derrubar a leitura autorizada; a falha fica no log do servico.
  }
};

/* ---------- Capacidades do caso: area de atuacao por paciente ---------- */

/*
 * A regra de area vivia so em AvaliacoesService, e a interface a repetia em
 * JavaScript. Aqui ela passa a ser unica: o servidor decide e projeta no
 * paciente (`capacidadesDoCaso`); a tela consome.
 */

export type CaseTeamMember = { userId?: string | null; area?: string | null };
export type CasePatientRecord = ClinicalPatientRecord & {
  equipeProfissional?: CaseTeamMember[] | null;
};

// Tipos de avaliacao restritos a uma area; os demais pertencem a nutricao.
export const AREAS_POR_TIPO_AVALIACAO: Record<string, string[]> = {
  psicologia: ['psicologia'],
  fisioterapia: ['fisioterapia'],
  composicao_corporal_imagem: ['nutricao', 'fisioterapia']
};

export const normalizeAreaToken = (value?: string | null): string | null => {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');

  if (!normalized) return null;
  if (normalized.includes('psicolog')) return 'psicologia';
  if (normalized.includes('fisioterap')) return 'fisioterapia';
  if (normalized.includes('nutri')) return 'nutricao';
  if (normalized.includes('educacao_fisica') || normalized.includes('educ_fisica')) return 'educacao_fisica';
  if (normalized.includes('medic')) return 'medicina';
  return normalized;
};

export const areasRequeridasPorTipo = (tipoNormalizado: string): string[] => (
  AREAS_POR_TIPO_AVALIACAO[tipoNormalizado] || ['nutricao']
);

// Areas em que este usuario atua neste caso: equipe profissional, responsavel pelo caso ou equipe multi.
export const resolveCaseAreas = (
  user: AuthenticatedUser | undefined,
  paciente: CasePatientRecord | null | undefined
): Set<string> => {
  const userId = userIdOf(user);
  const areas = new Set<string>();
  if (!userId || !paciente) return areas;

  const equipe = Array.isArray(paciente.equipeProfissional) ? paciente.equipeProfissional : [];
  const membership = equipe.find((member) => String(member?.userId || '') === userId);
  if (membership?.area) {
    const area = normalizeAreaToken(membership.area);
    if (area) areas.add(area);
  }
  if (paciente.alunoResponsavelId === userId) {
    areas.add(normalizeAreaToken(user?.curso) || 'nutricao');
  }
  if (!membership && (paciente.equipeMultiIds || []).includes(userId)) {
    const area = normalizeAreaToken(user?.curso);
    if (area) areas.add(area);
  }
  return areas;
};

export type CaseCapabilities = {
  vinculo: ClinicalLink | null;
  areas: string[];
  tiposEditaveis: string[];
  editaTodosOsTipos: boolean;
  criaAvaliacao: boolean;
  criaPlano: boolean;
  editaResumoClinico: boolean;
};

/*
 * Mesma decisao de assertCaseAreaEditAccess, projetada por tipo. Gestao e o
 * proprio atleta nao passam pela regra de area; papeis sem clinica nao editam.
 */
export const resolveCaseCapabilities = (
  user: AuthenticatedUser | undefined,
  paciente: CasePatientRecord | null | undefined,
  vinculo: ClinicalLink | null,
  tiposConhecidos: readonly string[]
): CaseCapabilities => {
  const role = normalizeRole(user?.role);
  const semAcesso: CaseCapabilities = {
    vinculo, areas: [], tiposEditaveis: [], editaTodosOsTipos: false,
    criaAvaliacao: false, criaPlano: false, editaResumoClinico: false
  };
  if (!vinculo) return semAcesso;

  if (hasGlobalAccess(role) || role === 'atleta') {
    return {
      vinculo, areas: [], tiposEditaveis: [...tiposConhecidos], editaTodosOsTipos: true,
      criaAvaliacao: true, criaPlano: true, editaResumoClinico: true
    };
  }
  if (!isStudentMemberRole(role)) {
    // Professor/profissional supervisionam e revisam; nao preenchem instrumento pelo aluno.
    return { ...semAcesso, editaResumoClinico: vinculo === 'supervisor' || vinculo === 'supervisao_aluno' };
  }

  const areas = resolveCaseAreas(user, paciente);
  const tiposEditaveis = tiposConhecidos.filter((tipo) => areasRequeridasPorTipo(tipo).some((area) => areas.has(area)));
  const pode = new Set(tiposEditaveis);
  return {
    vinculo,
    areas: [...areas],
    tiposEditaveis,
    editaTodosOsTipos: false,
    criaAvaliacao: tiposEditaveis.length > 0,
    criaPlano: pode.has('alimentar') || pode.has('gasto_energetico_total'),
    editaResumoClinico: pode.has('anamnese_inicial')
  };
};
