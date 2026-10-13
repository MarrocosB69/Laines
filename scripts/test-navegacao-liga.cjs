// UPD-13 — Navegação da liga. Dados 100% sintéticos, sem rede nem banco.
//
// Regressão para UX-04 (a diretoria mudava o ambiente inicial da pessoa: um
// aluno de Ensino/Marketing caía em /admin, com painel administrativo
// genérico, em vez de /aluno) e UX-05 (Comunicação não aparecia na leitura
// comum da Liga). Este teste falha se a diretoria voltar a redirecionar para
// /admin, ou se Comunicação sumir da navegação/capacidades da Liga.
//
// A checagem de redirecionamento reproduz o MESMO cálculo que
// src/contexts/AuthContext.jsx faz de verdade (canAccessAdmin =
// ADMIN_AREA_ROLES.includes(role) || hasAdminPanelPermission(...)), em vez de
// injetar `canAccessAdmin` a dedo — assim o teste exercita a integração real
// entre adminTabs.js e roles.js, que foi onde o bug do UX-04 vivia.
const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');
const root = path.resolve(__dirname, '..');
const esbuild = require(path.join(root, 'node_modules', 'esbuild'));

// src/constants/*.js usa import sem extensão ("./roles"), resolução válida no
// Vite mas não no loader ESM nativo do Node. adminTabs.js, capabilities.js e
// profileCompletion.js importam roles.js entre si — para exercitar a
// integração REAL (não uma cópia), bundlamos com esbuild (que resolve esses
// specifiers como um bundler) e carregamos o resultado via `require`, como
// scripts/test-visualizacao-dados.cjs faz para outro módulo do projeto.
function carregarModulosSrc() {
  const entrySource = [
    "export * as roles from './src/constants/roles.js';",
    "export * as adminTabs from './src/constants/adminTabs.js';",
    "export * as academicNavigation from './src/constants/academicNavigation.js';",
    "export * as capabilities from './src/constants/capabilities.js';",
    "export * as profileCompletion from './src/utils/profileCompletion.js';"
  ].join('\n');

  const result = esbuild.buildSync({
    stdin: { contents: entrySource, resolveDir: root, loader: 'js' },
    bundle: true,
    format: 'cjs',
    platform: 'node',
    target: 'node18',
    write: false
  });

  const code = result.outputFiles[0].text;
  const bundlePath = path.join(root, 'scripts', '__test-navegacao-liga-bundle.cjs');
  const mod = new Module(bundlePath, null);
  mod.filename = bundlePath;
  mod.paths = Module._nodeModulePaths(root);
  mod._compile(code, bundlePath);
  return mod.exports;
}

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log(`PASS ${name}`);
}

(() => {
  const {
    roles: {
      ADMIN_AREA_ROLES,
      PROFESSOR_AREA_ROLES,
      DIRETORIA_ROLES,
      getRedirectPathFromRole,
      getRedirecionamentoPaginaUnica,
      temDoisPapeis
    },
    adminTabs: { hasAdminPanelPermission },
    academicNavigation: { ACADEMIC_NAVIGATION, LIGA_AREA_ROOT_TABS },
    capabilities: { LIGA_AREAS, normalizeCapabilities, resolveAdminAccess },
    profileCompletion: {
      getRequiredProfileFields,
      getAtendimentoProfileFields,
      getProfileCompletionState
    }
  } = carregarModulosSrc();

  // Mesmo cálculo que AuthContext.buildUser: a função real, não uma cópia.
  // `capabilities` ausente exercita a reserva local (sessão antiga).
  const canAccessAdminFor = (user) => resolveAdminAccess({
    role: user.role,
    permissions: Array.isArray(user.permissions) ? user.permissions : [],
    diretoria: user.diretoria || '',
    capabilities: user.capabilities || normalizeCapabilities(null, user)
  });
  const redirectFor = (user) => getRedirectPathFromRole(user.role, { ...user, canAccessAdmin: canAccessAdminFor(user) });
  // Gate real da rota /admin em App.jsx: allowedRoles={ADMIN_AREA_ROLES} + fallbackCheck(canAccessAdmin).
  const passaNoGateAdmin = (user) => ADMIN_AREA_ROLES.includes(user.role) || canAccessAdminFor(user);

  // ── 1. Aluno com/sem diretoria, presidente e papel legado: todos vão para /aluno ──
  check('aluno sem diretoria vai para /aluno', () => {
    assert.equal(redirectFor({ role: 'aluno' }), '/aluno');
  });

  check('aluno de Ensino (diretoria=ensino) vai para /aluno, não /admin', () => {
    assert.equal(redirectFor({ role: 'aluno', diretoria: 'ensino' }), '/aluno');
  });

  check('aluno de Marketing (diretoria=marketing) vai para /aluno, não /admin — UX-04', () => {
    assert.equal(redirectFor({ role: 'aluno', diretoria: 'marketing' }), '/aluno');
  });

  check('presidente (com ou sem diretoria) vai para /aluno', () => {
    assert.equal(redirectFor({ role: 'presidente' }), '/aluno');
    assert.equal(redirectFor({ role: 'presidente', diretoria: 'pesquisa' }), '/aluno');
  });

  check('vice vai para /aluno', () => {
    assert.equal(redirectFor({ role: 'vice' }), '/aluno');
  });

  check('papel legado diretoria_ensino (compatibilidade com dados antigos) vai para /aluno', () => {
    assert.ok(DIRETORIA_ROLES.includes('diretoria_ensino'), 'diretoria_ensino é um papel legado conhecido');
    assert.equal(redirectFor({ role: 'diretoria_ensino' }), '/aluno');
  });

  check('todos os papéis legados diretoria_* vão para /aluno', () => {
    DIRETORIA_ROLES.forEach((role) => {
      assert.equal(redirectFor({ role }), '/aluno', `papel legado '${role}' deveria ir para /aluno`);
    });
  });

  // ── 2. Nada regrediu para os demais perfis ──────────────────────────────
  check('professor vai para /professor', () => {
    assert.equal(redirectFor({ role: 'professor' }), '/professor');
    assert.ok(PROFESSOR_AREA_ROLES.includes('professor'));
  });

  check('admin vai para /admin', () => {
    assert.equal(redirectFor({ role: 'admin' }), '/admin');
  });

  check('atleta vai para /atleta', () => {
    assert.equal(redirectFor({ role: 'atleta' }), '/atleta');
  });

  check('coordenacao de atendimento continua em /admin (não é discente)', () => {
    assert.equal(ADMIN_AREA_ROLES.includes('coord_atendimento'), false);
    assert.equal(redirectFor({ role: 'coord_atendimento' }), '/admin');
  });

  check('coordenacao de atendimento passa no gate real de /admin, com capabilities do servidor e sem elas', () => {
    // Redirecionar para /admin não basta: PrivateRoute recusa quem não passa
    // em allowedRoles nem em canAccessAdmin, e cai na trava anti-laço.
    const doServidor = {
      liga: { leitura: true, areas: [...LIGA_AREAS], gerencia: [], aprovaConteudo: false },
      atendimento: { habilitado: true, escopo: 'vinculo', motivo: null, criaPaciente: false, gerenciaVinculos: false, revisaPlano: false },
      gestao: { painel: false, usuarios: false, solicitacoes: false, pacientes: true, configuracoes: false, relatorios: { painel: false, operacional: false, detalhado: false, exportacao: false, perfilAtletas: true } },
      acessoClinicoGestao: false
    };
    assert.equal(passaNoGateAdmin({ role: 'coord_atendimento', capabilities: doServidor }), true, 'com capabilities do servidor');
    assert.equal(passaNoGateAdmin({ role: 'coord_atendimento' }), true, 'com a reserva local (sessão antiga)');
    // E a diretoria sozinha continua NÃO abrindo /admin: a gestão dela vive em /aluno.
    assert.equal(passaNoGateAdmin({ role: 'aluno', diretoria: 'marketing' }), false);
    assert.equal(passaNoGateAdmin({ role: 'professor' }), false);
  });

  check('permissão explícita de admin (não ligada a diretoria) ainda leva a /admin', () => {
    // Contrato preexistente (scripts/run-core-tests.mjs): canAccessAdmin
    // explícito continua valendo — só a concessão IMPLÍCITA por diretoria
    // foi removida.
    assert.equal(getRedirectPathFromRole('aluno', { canAccessAdmin: true }), '/admin');
  });

  // ── 3. A Liga expõe as quatro áreas para qualquer membro discente ───────
  check('capabilities.LIGA_AREAS tem as quatro diretorias, incluindo comunicacao', () => {
    assert.deepEqual([...LIGA_AREAS].sort(), ['comunicacao', 'ensino', 'extensao', 'pesquisa'].sort());
  });

  check('ACADEMIC_NAVIGATION inclui comunicacao com as mesmas seções de ensino/extensao', () => {
    assert.ok(Array.isArray(ACADEMIC_NAVIGATION.comunicacao), 'comunicacao deve existir na navegação acadêmica');
    const sections = ACADEMIC_NAVIGATION.comunicacao.map((item) => item.section);
    assert.deepEqual(sections, ['overview', 'comunicados', 'materiais']);
  });

  check('LIGA_AREA_ROOT_TABS mapeia as quatro áreas para as raízes de navegação', () => {
    assert.equal(LIGA_AREA_ROOT_TABS.ensino, 'ensino');
    assert.equal(LIGA_AREA_ROOT_TABS.pesquisa, 'research');
    assert.equal(LIGA_AREA_ROOT_TABS.extensao, 'extensao');
    assert.equal(LIGA_AREA_ROOT_TABS.comunicacao, 'comunicacao');
  });

  check('aluno sem diretoria conhece as quatro áreas publicadas na Liga', () => {
    const caps = normalizeCapabilities(null, { role: 'aluno' });
    assert.equal(caps.liga.leitura, true);
    assert.deepEqual([...caps.liga.areas].sort(), ['comunicacao', 'ensino', 'extensao', 'pesquisa'].sort());
  });

  check('aluno de Marketing também conhece as quatro áreas (leitura transversal)', () => {
    const caps = normalizeCapabilities(null, { role: 'aluno', diretoria: 'marketing' });
    assert.deepEqual([...caps.liga.areas].sort(), ['comunicacao', 'ensino', 'extensao', 'pesquisa'].sort());
  });

  // ── 4. gerencia: só a área local autorizada, nunca por consequência automática ──
  check('gerencia de aluno de Ensino contém só "ensino"', () => {
    const caps = normalizeCapabilities(null, { role: 'aluno', diretoria: 'ensino' });
    assert.deepEqual(caps.liga.gerencia, ['ensino']);
  });

  check('gerencia de aluno sem diretoria é vazia', () => {
    const caps = normalizeCapabilities(null, { role: 'aluno' });
    assert.deepEqual(caps.liga.gerencia, []);
  });

  check('gerencia de coordenação inclui as quatro áreas', () => {
    const caps = normalizeCapabilities(null, { role: 'coordenacao' });
    assert.deepEqual([...caps.liga.gerencia].sort(), ['comunicacao', 'ensino', 'extensao', 'pesquisa'].sort());
  });

  // ── 5. Cadastro sem supervisor/projeto não bloqueia a Liga ──────────────
  check('participação acadêmica não inclui supervisor/projeto; habilitação para atendimento sim', () => {
    const participacao = getRequiredProfileFields('aluno');
    assert.ok(!participacao.includes('supervisorId'), 'supervisorId não deve bloquear o cadastro da liga');
    assert.ok(!participacao.includes('projetoId'), 'projetoId não deve bloquear o cadastro da liga');
    assert.deepEqual(participacao.sort(), ['cpf', 'curso', 'dataNascimento', 'matricula', 'name', 'periodo', 'telefone'].sort());

    const atendimento = getAtendimentoProfileFields('aluno');
    assert.deepEqual(atendimento.sort(), ['projetoId', 'supervisorId'].sort());
  });

  check('aluno com participação acadêmica completa mas sem supervisor/projeto tem cadastro completo (não bloqueia a Liga)', () => {
    const alunoSemVinculoClinico = {
      role: 'aluno',
      name: 'Estudante Sintético',
      cpf: '000.000.000-00',
      telefone: '(84) 90000-0000',
      dataNascimento: '2000-01-01',
      matricula: '2023000000',
      curso: 'Nutrição',
      periodo: '5'
      // supervisorId e projetoId propositalmente ausentes.
    };

    const completionState = getProfileCompletionState(alunoSemVinculoClinico);
    assert.equal(completionState.complete, true, 'cadastro deve estar completo sem supervisor/projeto');
    assert.deepEqual(completionState.missingFields, []);

    const caps = normalizeCapabilities(null, alunoSemVinculoClinico);
    assert.equal(caps.atendimento.habilitado, false, 'sem vínculo, o atendimento fica pendente');
    assert.equal(caps.atendimento.motivo, 'sem_vinculo');
    assert.equal(caps.liga.leitura, true, 'a Liga continua acessível mesmo sem habilitação para atendimento');
    assert.equal(caps.liga.areas.length, 4, 'as quatro áreas continuam visíveis mesmo sem habilitação para atendimento');
  });

  // ── 6. WI-015: página única para quem tem dois papéis ───────────────────
  // Capacidades no formato que o servidor envia (buildCapabilities), com a
  // gestão de cada perfil sintético; canAccessAdmin vem do mesmo cálculo do
  // AuthContext (canAccessAdminFor), não é injetado.
  const capsDoServidor = (role, gestao = {}) => ({
    ...normalizeCapabilities(null, { role }),
    gestao: {
      painel: false, usuarios: false, solicitacoes: false, pacientes: false, configuracoes: false,
      relatorios: { painel: false, operacional: false, detalhado: false, exportacao: false, perfilAtletas: false },
      ...gestao
    }
  });
  const comAuth = (user) => ({ ...user, canAccessAdmin: canAccessAdminFor(user) });
  const PRESIDENTE_GESTOR = { role: 'presidente', permissions: ['users:manage', 'requests:review'], capabilities: capsDoServidor('presidente', { painel: true, usuarios: true, solicitacoes: true, relatorios: { painel: true } }) };
  // WI-016: a aba Relatórios exige relatorios.exportacao, que o servidor dá
  // a research:manage (canAccessAnalyticsReports); admin:access só dá o painel.
  const PROFESSOR_GESTOR = { role: 'professor', permissions: ['research:manage'], capabilities: capsDoServidor('professor', { painel: true, relatorios: { painel: true, exportacao: true } }) };

  check('WI-015: presidente com gestão entra por /aluno e /admin o leva de volta para lá', () => {
    assert.equal(passaNoGateAdmin(PRESIDENTE_GESTOR), true, 'passava no portão de /admin, então tinha as duas páginas');
    assert.equal(temDoisPapeis(comAuth(PRESIDENTE_GESTOR)), true);
    assert.equal(redirectFor(PRESIDENTE_GESTOR), '/aluno');
    assert.deepEqual(getRedirecionamentoPaginaUnica(comAuth(PRESIDENTE_GESTOR), { tab: 'users' }), { to: '/aluno?area=gestao_membros', state: null });
  });

  check('WI-015: professor com o painel entra por /professor e /admin?tab=X vai à aba equivalente', () => {
    assert.equal(redirectFor(PROFESSOR_GESTOR), '/professor');
    assert.deepEqual(getRedirecionamentoPaginaUnica(comAuth(PROFESSOR_GESTOR), { tab: 'reports' }), { to: '/professor?area=gestao_relatorios', state: null });
  });

  check('WI-016: aluno de diretoria só com o painel volta a entrar por /admin, sem a seção Direção', () => {
    // O servidor dá research:create à diretoria de Pesquisa, e com ele
    // gestao.painel e gestao.relatorios.painel, mas não .exportacao. Sem a
    // aba Relatórios (WI-016), não sobra tela de gestão para a página única:
    // fica como antes do WI-015, com o portão de /admin aberto pela permissão.
    const diretor = { role: 'aluno', diretoria: 'pesquisa', permissions: ['research:create', 'research:update-own-area'], capabilities: capsDoServidor('aluno', { painel: true, relatorios: { painel: true } }) };
    assert.equal(passaNoGateAdmin(diretor), true);
    assert.equal(temDoisPapeis(comAuth(diretor)), false);
    assert.equal(redirectFor(diretor), '/admin', 'só o painel: volta a /admin, como antes do WI-015');
    // Quem leva a /admin é a permissão explícita, não a diretoria (UX-04).
    assert.equal(redirectFor({ role: 'aluno', diretoria: 'pesquisa' }), '/aluno');
  });

  check('WI-015: presidente sem capabilities.gestao segue como antes (/aluno, sem portão de /admin)', () => {
    const presidente = { role: 'presidente', capabilities: capsDoServidor('presidente') };
    assert.equal(passaNoGateAdmin(presidente), false);
    assert.equal(temDoisPapeis(comAuth(presidente)), false);
    assert.equal(redirectFor(presidente), '/aluno');
  });

  check('WI-015: admin, coordenação, coord_atendimento, técnico e atleta seguem iguais', () => {
    assert.equal(redirectFor({ role: 'admin' }), '/admin');
    assert.equal(redirectFor({ role: 'coordenacao' }), '/admin');
    // Como o servidor manda: pacientes e o perfil dos atletas (aba Relatórios, WI-016).
    const coordAt = { role: 'coord_atendimento', capabilities: capsDoServidor('coord_atendimento', { pacientes: true, relatorios: { painel: false, operacional: false, detalhado: false, exportacao: false, perfilAtletas: true } }) };
    assert.equal(redirectFor(coordAt), '/admin');
    assert.equal(getRedirecionamentoPaginaUnica(comAuth(coordAt), { tab: 'patients' }), null, 'continua no painel');
    assert.equal(getRedirecionamentoPaginaUnica(comAuth(coordAt), { tab: 'reports' }), null, 'Relatórios também fica no painel');
    assert.equal(getRedirecionamentoPaginaUnica(comAuth({ role: 'admin' }), { tab: 'users' }), null);
    assert.equal(redirectFor({ role: 'tecnico' }), '/equipe');
    assert.equal(redirectFor({ role: 'atleta' }), '/atleta');
  });

  console.log(`\n${passed} verificações passaram (UPD-13 — navegação da liga).`);
})();
