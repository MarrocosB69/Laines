import {
  ADMIN_AREA_ROLES,
  ADMIN_ROLES,
  PROFESSOR_AREA_ROLES,
  getDiretoriaPermissionSource,
  isStudentMemberRole,
  normalizeRole
} from './roles';
import { hasAdminPanelPermission } from './adminTabs';

// Áreas da Liga na ordem de navegação. Toda pessoa membro lê o publicado das quatro.
export const LIGA_AREAS = Object.freeze(['ensino', 'pesquisa', 'extensao', 'comunicacao']);

export const LIGA_AREA_LABELS = Object.freeze({
  ensino: 'Ensino',
  pesquisa: 'Pesquisa',
  extensao: 'Extensão',
  comunicacao: 'Comunicação'
});

const AREA_BY_DIRETORIA = Object.freeze({
  diretoria_ensino: 'ensino',
  diretoria_pesquisa: 'pesquisa',
  diretoria_extensao: 'extensao',
  diretoria_marketing: 'comunicacao'
});

const AREA_BY_PERMISSION_PREFIX = Object.freeze({
  ensino: 'ensino',
  research: 'pesquisa',
  extensao: 'extensao',
  marketing: 'comunicacao'
});

const EMPTY = Object.freeze({
  liga: { leitura: false, areas: [], gerencia: [], aprovaConteudo: false },
  atendimento: { habilitado: false, escopo: 'nenhum', motivo: 'perfil_sem_atendimento', criaPaciente: false, gerenciaVinculos: false, revisaPlano: false },
  gestao: { painel: false, usuarios: false, solicitacoes: false, pacientes: false, configuracoes: false, relatorios: { painel: false, operacional: false, detalhado: false, exportacao: false, perfilAtletas: false } },
  acessoClinicoGestao: false
});

// Reserva local usada apenas quando a API ainda não envia `capabilities`
// (sessão antiga). Espelha a regra do servidor de forma conservadora; a
// decisão de acesso continua sendo do servidor.
const deriveFallback = (user) => {
  if (!user) return EMPTY;
  const role = normalizeRole(user.role);
  const isAdmin = ADMIN_ROLES.includes(role);
  const isAthlete = role === 'atleta';
  const isStudent = isStudentMemberRole(role);
  const isTeam = PROFESSOR_AREA_ROLES.includes(role) || role === 'tecnico';
  const permissions = Array.isArray(user.permissions) ? user.permissions : [];

  const gerencia = new Set();
  if (isAdmin) LIGA_AREAS.forEach((area) => gerencia.add(area));
  const diretoria = getDiretoriaPermissionSource(user);
  if (diretoria && AREA_BY_DIRETORIA[diretoria] && isStudent) gerencia.add(AREA_BY_DIRETORIA[diretoria]);
  permissions.forEach((permission) => {
    const area = AREA_BY_PERMISSION_PREFIX[String(permission).split(':')[0]];
    if (area) gerencia.add(area);
  });

  const hasStudentBond = Boolean(user.supervisorId) && Boolean(user.projetoId);
  let escopo = 'nenhum';
  let motivo = 'perfil_sem_atendimento';
  if (isAdmin || role === 'coord_atendimento') { escopo = 'gestao'; motivo = null; }
  else if (isAthlete) { escopo = 'proprio'; motivo = null; }
  else if (isStudent) { escopo = hasStudentBond ? 'vinculo' : 'nenhum'; motivo = hasStudentBond ? null : 'sem_vinculo'; }
  else if (isTeam) { escopo = 'vinculo'; motivo = null; }

  const crn = String(user.crn || '').trim()
    || (String(user.conselhoTipo || '').toUpperCase() === 'CRN' ? String(user.conselhoNumero || '').trim() : '');

  const exportacao = isAdmin || permissions.some((permission) => ['research:manage', 'marketing:create', 'marketing:update-own-area'].includes(permission));

  return {
    liga: {
      leitura: !isAthlete,
      areas: isAthlete ? [] : [...LIGA_AREAS],
      gerencia: LIGA_AREAS.filter((area) => gerencia.has(area)),
      aprovaConteudo: isAdmin
    },
    atendimento: {
      habilitado: escopo !== 'nenhum',
      escopo,
      motivo,
      criaPaciente: isAdmin || ['coord_atendimento', 'professor', 'profissional', 'presidente', 'vice'].includes(role),
      gerenciaVinculos: isAdmin || role === 'coord_atendimento',
      revisaPlano: ['professor', 'profissional'].includes(role) && Boolean(crn)
    },
    gestao: {
      painel: isAdmin || role === 'coord_atendimento' || Boolean(user.canAccessAdmin),
      usuarios: isAdmin || permissions.includes('users:manage'),
      solicitacoes: isAdmin || permissions.includes('requests:review'),
      pacientes: isAdmin || role === 'coord_atendimento' || permissions.includes('patients:manage'),
      configuracoes: isAdmin,
      relatorios: {
        painel: isAdmin || role === 'coord_atendimento' || Boolean(user.canAccessAdmin),
        operacional: isAdmin,
        detalhado: isAdmin,
        exportacao,
        perfilAtletas: isAdmin || role === 'coord_atendimento' || (['presidente', 'vice'].includes(role) && exportacao)
      }
    },
    acessoClinicoGestao: isAdmin || role === 'coord_atendimento'
  };
};

const isCapabilityShape = (value) => (
  value && typeof value === 'object' && value.liga && value.atendimento && value.gestao
);

export const normalizeCapabilities = (raw, user) => {
  if (isCapabilityShape(raw)) {
    return {
      ...raw,
      liga: { ...raw.liga, areas: Array.isArray(raw.liga.areas) ? raw.liga.areas : [], gerencia: Array.isArray(raw.liga.gerencia) ? raw.liga.gerencia : [] }
    };
  }
  return deriveFallback(user);
};

export const getLigaAreaLabel = (area) => LIGA_AREA_LABELS[area] || area;

// Alguma responsabilidade de gestão institucional. Gerir a própria diretoria
// NÃO entra aqui: essa gestão vive em /aluno ("Minha diretoria"), não em /admin.
export const hasManagementAccess = (capabilities) => {
  const gestao = capabilities?.gestao || {};
  return Boolean(gestao.painel || gestao.usuarios || gestao.solicitacoes || gestao.pacientes || gestao.configuracoes);
};

// Gate único de /admin. AuthContext calcula `canAccessAdmin` com isto e o
// teste de navegação exercita a mesma função — não uma cópia da regra.
// Papel administrativo, permissão explícita avulsa ou capacidade de gestão
// vinda do servidor; diretoria sozinha não abre a porta.
export const resolveAdminAccess = ({ role, permissions = [], diretoria = '', capabilities = null } = {}) => {
  const normalizedRole = normalizeRole(role);
  return ADMIN_AREA_ROLES.includes(normalizedRole)
    || hasAdminPanelPermission(permissions, normalizedRole, diretoria)
    || hasManagementAccess(capabilities);
};
