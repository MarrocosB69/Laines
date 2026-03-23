import { normalizeRole } from '../src/constants/roles.js';

const apiBaseUrl = process.env.E2E_API_BASE_URL || process.env.API_BASE_URL || 'http://localhost:4000';
const isCi = /^(1|true)$/i.test(String(process.env.CI || ''));
const requireRoleMatrix = /^(1|true)$/i.test(String(process.env.E2E_ROLE_MATRIX_REQUIRED || ''));
const allowMutations = /^(1|true)$/i.test(String(process.env.E2E_ALLOW_MUTATIONS || ''));

const ADMIN_AREA_ROLES = new Set([
  'admin',
  'coordenacao',
  'presidente',
  'vice',
  'diretoria_marketing',
  'diretoria_ensino',
  'diretoria_pesquisa',
  'diretoria_extensao',
  'coord_atendimento'
]);
const STUDENT_MEMBER_ROLES = new Set(['aluno', 'presidente', 'vice']);
const TEAM_SCOPED_ROLES = new Set(['professor', 'profissional', 'pesquisador', 'colaborador', 'tecnico']);

const ensure = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};

const requestJson = async (path, options = {}) => {
  const response = await fetch(`${apiBaseUrl}${path}`, options);
  let body = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  return { response, body };
};

const authHeaders = (token) => ({ authorization: `Bearer ${token}` });

const buildCredential = (emailKey, passwordKey) => {
  const email = String(process.env[emailKey] || '').trim();
  const password = String(process.env[passwordKey] || '').trim();
  if (!email || !password) return null;
  return { email, password };
};

const login = async (label, credential) => {
  const loginResult = await requestJson('/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(credential)
  });
  ensure(loginResult.response.ok, `[${label}] login falhou com HTTP ${loginResult.response.status}`);

  const token = String(loginResult.body?.accessToken || '');
  ensure(token.length > 10, `[${label}] login sem accessToken valido.`);
  ensure(loginResult.body?.user?.id, `[${label}] login sem user.id.`);

  return {
    label,
    token,
    user: loginResult.body.user
  };
};

const checkMeContract = async (session) => {
  const me = await requestJson('/auth/me', {
    headers: authHeaders(session.token)
  });
  ensure(me.response.ok, `[${session.label}] /auth/me retornou ${me.response.status}`);
  ensure(me.body?.id, `[${session.label}] /auth/me sem id.`);
  ensure(typeof me.body?.name === 'string' && me.body.name.trim().length > 0, `[${session.label}] /auth/me sem name valido.`);
  ensure(!('passwordHash' in (me.body || {})), `[${session.label}] /auth/me exposto com passwordHash.`);

  const meRole = normalizeRole(me.body?.role || '');
  const tokenRole = normalizeRole(session.user?.role || '');
  ensure(meRole === tokenRole, `[${session.label}] role inconsistente entre login (${tokenRole}) e /auth/me (${meRole}).`);
  return {
    ...session,
    user: me.body
  };
};

const canSeePacienteByRole = (role, userId, paciente) => {
  if (ADMIN_AREA_ROLES.has(role)) return true;
  const teamIds = Array.isArray(paciente?.equipeTecnicaIds) ? paciente.equipeTecnicaIds : [];

  if (STUDENT_MEMBER_ROLES.has(role)) {
    return paciente?.alunoResponsavelId === userId || teamIds.includes(userId);
  }
  if (TEAM_SCOPED_ROLES.has(role)) {
    return paciente?.professorSupervisorId === userId
      || paciente?.alunoResponsavelId === userId
      || teamIds.includes(userId);
  }
  if (role === 'atleta') {
    return paciente?.atletaUserId === userId;
  }
  return false;
};

const validateUsersEndpointByRole = async (session) => {
  const role = normalizeRole(session.user?.role || '');
  const usersRes = await requestJson('/users?limit=9999', {
    headers: authHeaders(session.token)
  });

  if (!ADMIN_AREA_ROLES.has(role)) {
    ensure(usersRes.response.status === 403, `[${session.label}] /users deveria retornar 403 para role ${role}, retornou ${usersRes.response.status}`);
    return;
  }

  ensure(usersRes.response.ok, `[${session.label}] /users deveria retornar 200, retornou ${usersRes.response.status}`);
  ensure(Array.isArray(usersRes.body), `[${session.label}] /users sem array de usuarios.`);
  ensure(usersRes.body.length <= 200, `[${session.label}] /users ignorou clamp de paginacao default/max.`);
  usersRes.body.forEach((item, index) => {
    ensure(!('passwordHash' in (item || {})), `[${session.label}] /users exposto com passwordHash no indice ${index}.`);
  });
};

const validatePacientesScopeByRole = async (session) => {
  const role = normalizeRole(session.user?.role || '');
  const userId = String(session.user?.id || '');
  const pacientesRes = await requestJson('/pacientes?limit=200', {
    headers: authHeaders(session.token)
  });
  ensure(pacientesRes.response.ok, `[${session.label}] /pacientes retornou ${pacientesRes.response.status}`);
  ensure(Array.isArray(pacientesRes.body), `[${session.label}] /pacientes sem lista.`);

  if (ADMIN_AREA_ROLES.has(role)) return;
  pacientesRes.body.forEach((paciente) => {
    const allowed = canSeePacienteByRole(role, userId, paciente);
    ensure(
      allowed,
      `[${session.label}] encontrou paciente fora de escopo para role ${role} (pacienteId=${paciente?.id || 'desconhecido'}).`
    );
  });
};

const validateTarefasScopeByRole = async (session) => {
  const role = normalizeRole(session.user?.role || '');
  const tarefasRes = await requestJson('/tarefas', {
    headers: authHeaders(session.token)
  });
  ensure(tarefasRes.response.ok, `[${session.label}] /tarefas retornou ${tarefasRes.response.status}`);
  ensure(Array.isArray(tarefasRes.body), `[${session.label}] /tarefas sem lista.`);

  if (!ADMIN_AREA_ROLES.has(role)) {
    tarefasRes.body.forEach((item) => {
      const assignedRole = normalizeRole(item?.assignedRole || 'todos');
      const visible = assignedRole === 'todos' || assignedRole === role;
      ensure(
        visible,
        `[${session.label}] tarefa fora do escopo retornada (role=${role}, assignedRole=${assignedRole}).`
      );
    });
  }

  if (!ADMIN_AREA_ROLES.has(role)) {
    const createRes = await requestJson('/tarefas', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...authHeaders(session.token) },
      body: JSON.stringify({
        title: `E2E Role Contract ${Date.now()}`,
        assignedRole: 'todos'
      })
    });
    ensure(createRes.response.status === 403, `[${session.label}] POST /tarefas deveria retornar 403 para role ${role}, retornou ${createRes.response.status}`);
    return;
  }

  if (!allowMutations) {
    console.log(`[role-e2e] ${session.label}: validacao de escrita em /tarefas ignorada (E2E_ALLOW_MUTATIONS=false).`);
    return;
  }

  const createRes = await requestJson('/tarefas', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...authHeaders(session.token) },
    body: JSON.stringify({
      title: `E2E Role Contract ${Date.now()}`,
      assignedRole: 'todos'
    })
  });

  ensure(
    createRes.response.status === 201 || createRes.response.status === 200,
    `[${session.label}] POST /tarefas retornou ${createRes.response.status}`
  );
  ensure(createRes.body?.id, `[${session.label}] POST /tarefas sem id para cleanup.`);
  const cleanup = await requestJson(`/tarefas/${createRes.body.id}`, {
    method: 'DELETE',
    headers: authHeaders(session.token)
  });
  ensure(cleanup.response.ok, `[${session.label}] cleanup em /tarefas/:id falhou com ${cleanup.response.status}`);
};

const validateProjetosMutationAccess = async (session) => {
  const role = normalizeRole(session.user?.role || '');
  if (ADMIN_AREA_ROLES.has(role) && !allowMutations) {
    console.log(`[role-e2e] ${session.label}: validacao de escrita em /projetos ignorada (E2E_ALLOW_MUTATIONS=false).`);
    return;
  }

  const payload = {
    nome: `E2E Projeto ${Date.now()}`,
    area: 'nutricao'
  };
  const createRes = await requestJson('/projetos', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...authHeaders(session.token) },
    body: JSON.stringify(payload)
  });

  if (!ADMIN_AREA_ROLES.has(role)) {
    ensure(
      createRes.response.status === 403,
      `[${session.label}] POST /projetos deveria retornar 403 para role ${role}, retornou ${createRes.response.status}`
    );
    return;
  }

  ensure(
    createRes.response.status === 201 || createRes.response.status === 200,
    `[${session.label}] POST /projetos retornou ${createRes.response.status}`
  );
  ensure(createRes.body?.id, `[${session.label}] POST /projetos sem id para cleanup.`);
  const cleanup = await requestJson(`/projetos/${createRes.body.id}`, {
    method: 'DELETE',
    headers: authHeaders(session.token)
  });
  ensure(cleanup.response.ok, `[${session.label}] cleanup em /projetos/:id falhou com ${cleanup.response.status}`);
};

const validateProjetosReadScopeByRole = async (session) => {
  const role = normalizeRole(session.user?.role || '');
  const userId = String(session.user?.id || '');
  const projetosRes = await requestJson('/projetos', {
    headers: authHeaders(session.token)
  });
  ensure(projetosRes.response.ok, `[${session.label}] /projetos retornou ${projetosRes.response.status}`);
  ensure(Array.isArray(projetosRes.body), `[${session.label}] /projetos sem lista.`);

  if (ADMIN_AREA_ROLES.has(role)) {
    return;
  }

  if (STUDENT_MEMBER_ROLES.has(role) || role === 'atleta') {
    projetosRes.body.forEach((item, index) => {
      ensure(typeof item?.id === 'string' && item.id.length > 0, `[${session.label}] /projetos sem id no indice ${index}.`);
      ensure(typeof item?.nome === 'string' && item.nome.length > 0, `[${session.label}] /projetos sem nome no indice ${index}.`);
      const keys = Object.keys(item || {});
      const extraKeys = keys.filter((key) => !['id', 'nome', 'status'].includes(key));
      ensure(
        extraKeys.length === 0,
        `[${session.label}] /projetos exposto com campos sensiveis para role ${role}: ${extraKeys.join(', ')}.`
      );
    });
    return;
  }

  if (!TEAM_SCOPED_ROLES.has(role)) {
    return;
  }

  const pacientesRes = await requestJson('/pacientes?limit=200', {
    headers: authHeaders(session.token)
  });
  ensure(pacientesRes.response.ok, `[${session.label}] /pacientes retornou ${pacientesRes.response.status} durante validacao de projetos.`);
  const pacienteProjectIds = new Set(
    (Array.isArray(pacientesRes.body) ? pacientesRes.body : [])
      .map((item) => String(item?.projetoId || '').trim())
      .filter(Boolean)
  );
  const linkedProjectId = String(session.user?.projetoId || '').trim();

  projetosRes.body.forEach((item) => {
    const alunoIds = Array.isArray(item?.alunosIds) ? item.alunosIds : [];
    const allowed = item?.coordenadorId === userId
      || alunoIds.includes(userId)
      || pacienteProjectIds.has(String(item?.id || ''))
      || (linkedProjectId && item?.id === linkedProjectId);
    ensure(
      allowed,
      `[${session.label}] encontrou projeto fora de escopo para role ${role} (projetoId=${item?.id || 'desconhecido'}).`
    );
  });
};

const run = async () => {
  console.log(`[role-e2e] API base: ${apiBaseUrl}`);
  const adminCred = buildCredential('E2E_ADMIN_EMAIL', 'E2E_ADMIN_PASSWORD')
    || buildCredential('E2E_EMAIL', 'E2E_PASSWORD');
  const studentCred = buildCredential('E2E_STUDENT_EMAIL', 'E2E_STUDENT_PASSWORD');
  const professorCred = buildCredential('E2E_PROFESSOR_EMAIL', 'E2E_PROFESSOR_PASSWORD');
  const teamCred = buildCredential('E2E_TEAM_EMAIL', 'E2E_TEAM_PASSWORD');
  const athleteCred = buildCredential('E2E_ATHLETE_EMAIL', 'E2E_ATHLETE_PASSWORD');

  if (!adminCred) {
    if (isCi) {
      console.error('[role-e2e] Fail: faltam credenciais administrativas (E2E_ADMIN_* ou E2E_EMAIL/E2E_PASSWORD).');
      process.exit(1);
    }
    console.log('[role-e2e] Skip: credenciais administrativas nao configuradas.');
    process.exit(0);
  }

  if (requireRoleMatrix && (!studentCred || !professorCred || !teamCred || !athleteCred)) {
    const missing = [];
    if (!studentCred) missing.push('E2E_STUDENT_EMAIL/E2E_STUDENT_PASSWORD');
    if (!professorCred) missing.push('E2E_PROFESSOR_EMAIL/E2E_PROFESSOR_PASSWORD');
    if (!teamCred) missing.push('E2E_TEAM_EMAIL/E2E_TEAM_PASSWORD');
    if (!athleteCred) missing.push('E2E_ATHLETE_EMAIL/E2E_ATHLETE_PASSWORD');
    const msg = `[role-e2e] Fail: E2E_ROLE_MATRIX_REQUIRED=true exige credenciais por perfil (${missing.join(', ')}).`;
    if (isCi) {
      console.error(msg);
      process.exit(1);
    }
    throw new Error(msg);
  }

  const sessions = [];
  sessions.push(await login('admin', adminCred));
  if (studentCred) {
    sessions.push(await login('student', studentCred));
  }
  if (professorCred) {
    sessions.push(await login('professor', professorCred));
  }
  if (teamCred) {
    sessions.push(await login('tecnico', teamCred));
  }
  if (athleteCred) {
    sessions.push(await login('atleta', athleteCred));
  }

  for (const session of sessions) {
    const hydrated = await checkMeContract(session);
    await validateUsersEndpointByRole(hydrated);
    await validatePacientesScopeByRole(hydrated);
    await validateTarefasScopeByRole(hydrated);
    await validateProjetosReadScopeByRole(hydrated);
    await validateProjetosMutationAccess(hydrated);
    console.log(`[role-e2e] ${hydrated.label} (${normalizeRole(hydrated.user.role)}): checks ok`);
  }

  console.log('[role-e2e] Contratos de role validados com sucesso.');
};

run().catch((error) => {
  console.error(`[role-e2e] Falha: ${error.message}`);
  process.exitCode = 1;
});
