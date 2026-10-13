export const ADMIN_ROLES = [
  'admin',
  'coordenacao'
];

export const ADMIN_AREA_ROLES = [
  ...ADMIN_ROLES
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
    diretoria_comunicacao: 'diretoria_marketing',
    diretoria_de_comunicacao: 'diretoria_marketing',
    diretoria_marketing_comunicacao: 'diretoria_marketing',
    diretoria_de_marketing_comunicacao: 'diretoria_marketing',
    diretoria_de_marketing_e_comunicacao: 'diretoria_marketing',
    comunicacao: 'diretoria_marketing',
    comunicacao_social: 'diretoria_marketing',
    marketing_comunicacao: 'diretoria_marketing',
    marketing_e_comunicacao: 'diretoria_marketing',
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

export const normalizeDiretoria = (diretoria) => {
  if (!diretoria) return '';
  const raw = String(diretoria).toLowerCase().trim();
  const cleaned = raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');

  const map = {
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

  if (map[cleaned]) return map[cleaned];
  if (cleaned.includes('pesquisa')) return 'diretoria_pesquisa';
  if (cleaned.includes('extensao')) return 'diretoria_extensao';
  if (cleaned.includes('ensino')) return 'diretoria_ensino';
  if (cleaned.includes('marketing') || cleaned.includes('comunicacao')) return 'diretoria_marketing';

  return '';
};

// user é opcional — permite checar permissions além do role
export const DIRETORIA_ROLES = [
  'diretoria_marketing',
  'diretoria_ensino',
  'diretoria_pesquisa',
  'diretoria_extensao'
];

export const getDiretoriaPermissionSource = (user = {}) => {
  const normalizedDiretoria = normalizeDiretoria(user?.diretoria);
  if (normalizedDiretoria) return normalizedDiretoria;

  const normalizedRole = normalizeRole(user?.role);
  return DIRETORIA_ROLES.includes(normalizedRole) ? normalizedRole : '';
};

// ── WI-015: página única para quem tem dois papéis ───────────────────────
// docs/inception/navegacao/WI-015/README.md. Este arquivo não importa nada de
// propósito: tests/core/roles.test.mjs e scripts/run-core-tests.mjs o carregam
// no ESM nativo do Node, que não resolve os imports sem extensão de src/.

// Telas de gestão institucional do painel (/admin), na ordem do painel, cada
// uma liberada por um item de capabilities.gestao (servidor). O painel
// (getAllowedAdminTabsFromCapabilities, adminTabs.js) usa esta mesma função,
// para que painel e página única nunca divirjam.
// Relatórios abre com o acesso dos dados da tela: relatorios.exportacao (a
// regra dos endpoints, canAccessAnalyticsReports) ou relatorios.perfilAtletas
// (o perfil agregado, canAccessAthleteProfileAggregates). relatorios.painel é
// mais larga e abria a aba para quem recebia 403 (WI-016, decisão 4). Só
// coord_atendimento tem o perfil sem a exportação; a tela mostra só o perfil.
export const getGestaoTabsFromCapabilities = (capabilities) => {
  const gestao = capabilities?.gestao || {};
  const relatorios = gestao.relatorios || {};
  return [
    gestao.usuarios && 'users',
    gestao.pacientes && 'patients',
    gestao.solicitacoes && 'requests',
    (relatorios.exportacao || relatorios.perfilAtletas) && 'reports',
    gestao.configuracoes && 'settings'
  ].filter(Boolean);
};

// Papéis que têm uma página de origem além de /admin (decisão 1 do WI-015).
// Ficam fora: admin, coordenação e coord_atendimento (só têm /admin), e
// colaborador e os papéis legados diretoria_* (não citados na decisão).
const PAGINA_DE_ORIGEM_POR_PAPEL = Object.freeze({
  aluno: '/aluno',
  presidente: '/aluno',
  vice: '/aluno',
  professor: '/professor',
  profissional: '/professor',
  pesquisador: '/professor'
});

const temChave = (mapa, chave) => Object.prototype.hasOwnProperty.call(mapa, chave);

export const getPaginaDeOrigem = (role) => {
  const normalized = normalizeRole(role);
  return temChave(PAGINA_DE_ORIGEM_POR_PAPEL, normalized) ? PAGINA_DE_ORIGEM_POR_PAPEL[normalized] : null;
};

// Telas de gestão que entram na página de origem: as do painel, para quem
// já passava no portão de /admin (canAccessAdmin). O portão faz parte da
// regra para a página única nunca mostrar uma tela que a pessoa não
// alcançava antes. As áreas da Liga não entram: a página de origem já as tem.
export const getAbasDeGestaoEmbutidas = (user) => {
  if (!user?.canAccessAdmin || !getPaginaDeOrigem(user?.role)) return [];
  return getGestaoTabsFromCapabilities(user.capabilities);
};

export const temDoisPapeis = (user) => getAbasDeGestaoEmbutidas(user).length > 0;

// Ids das telas de gestão na página única. Prefixo próprio porque "patients"
// já é "Meus Atletas" (aluno) e "Alunos e Atletas" (professor).
export const ABA_DE_GESTAO_NA_PAGINA_UNICA = Object.freeze({
  users: 'gestao_membros',
  patients: 'gestao_atletas',
  requests: 'gestao_solicitacoes',
  reports: 'gestao_relatorios',
  settings: 'gestao_configuracoes'
});

// Aba do painel -> aba equivalente na página única. A Visão geral e as
// áreas da Liga (com as subseções) têm o mesmo id nos dois lugares.
export const getAbaNaPaginaUnica = (adminTab) => {
  const tab = String(adminTab || '').trim();
  if (temChave(ABA_DE_GESTAO_NA_PAGINA_UNICA, tab)) return ABA_DE_GESTAO_NA_PAGINA_UNICA[tab];
  return tab || 'dashboard';
};

// /admin para quem tem dois papéis: vai à página de origem, na aba
// equivalente, e traduz o retorno do prontuário (returnTab do painel vira o
// returnView das páginas de origem). null para quem não tem dois papéis.
export const getRedirecionamentoPaginaUnica = (user, { tab = '', state = null } = {}) => {
  if (!temDoisPapeis(user)) return null;
  const origem = getPaginaDeOrigem(user.role);
  const aba = getAbaNaPaginaUnica(tab);
  const selectedPatientId = state?.selectedPatientId;
  return {
    to: aba === 'dashboard' ? origem : `${origem}?area=${encodeURIComponent(aba)}`,
    state: selectedPatientId
      ? { selectedPatientId, returnView: getAbaNaPaginaUnica(state.returnTab || 'patients') }
      : null
  };
};

export const getRedirectPathFromRole = (role, user = null) => {
  const normalized = normalizeRole(role);
  const canAccessAdmin = Boolean(user?.canAccessAdmin);
  if (ADMIN_AREA_ROLES.includes(normalized)) return '/admin';
  // WI-015: quem tem dois papéis entra pela página de origem, que já reúne a
  // gestão; quem só tem o painel continua indo para /admin.
  if (canAccessAdmin) {
    const doisPapeis = temDoisPapeis({ role: normalized, canAccessAdmin, capabilities: user?.capabilities });
    return doisPapeis ? getPaginaDeOrigem(normalized) : '/admin';
  }
  // Presidencia, vice e diretoria (inclusive o papel legado diretoria_*, mantido
  // so por compatibilidade com dados antigos) sao discentes: pertencer a uma
  // diretoria acrescenta uma area local dentro de /aluno, nunca troca o
  // ambiente inicial da pessoa (UPD-13, UX-04).
  if (STUDENT_MEMBER_ROLES.includes(normalized) || DIRETORIA_ROLES.includes(normalized)) return '/aluno';
  // Coordenacao de atendimento opera suas abas dentro de /admin.
  if (normalized === 'coord_atendimento') return '/admin';
  if (PROFESSOR_AREA_ROLES.includes(normalized)) return '/professor';
  if (normalized === 'tecnico') return '/equipe';
  if (normalized === 'atleta') return '/atleta';
  // Nunca devolver '/' para usuario autenticado: a rota raiz redireciona de volta
  // para este mesmo calculo e o resultado e um laco infinito com tela em branco.
  return '/aluno';
};

export const isStudentMemberRole = (role) => STUDENT_MEMBER_ROLES.includes(normalizeRole(role));

export const isDiretoriaStudentMember = (user = {}, areaDiretoria = '') => (
  isStudentMemberRole(user?.role)
  && getDiretoriaPermissionSource(user) === normalizeDiretoria(areaDiretoria)
);
