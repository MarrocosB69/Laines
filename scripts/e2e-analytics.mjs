import fs from 'node:fs';
import path from 'node:path';

const apiBaseUrl = process.env.E2E_API_BASE_URL || process.env.API_BASE_URL || 'http://localhost:4000';
const adminEmail = process.env.E2E_ADMIN_EMAIL || process.env.E2E_EMAIL || '';
const adminPassword = process.env.E2E_ADMIN_PASSWORD || process.env.E2E_PASSWORD || '';
const studentEmail = process.env.E2E_STUDENT_EMAIL || '';
const studentPassword = process.env.E2E_STUDENT_PASSWORD || '';
const professorEmail = process.env.E2E_PROFESSOR_EMAIL || '';
const professorPassword = process.env.E2E_PROFESSOR_PASSWORD || '';
const analyticsProjectId = process.env.E2E_ANALYTICS_PROJECT_ID || '11111111-1111-4111-8111-111111111111';
const isCi = /^(1|true)$/i.test(String(process.env.CI || ''));
const reportPath = (() => {
  const explicitPath = String(process.env.E2E_ANALYTICS_REPORT_PATH || '').trim();
  if (explicitPath) return explicitPath;
  const reportDir = String(process.env.E2E_REPORT_DIR || '').trim();
  if (reportDir) return path.join(reportDir, 'e2e-analytics-report.json');
  return '';
})();

const report = {
  suite: 'e2e-analytics',
  startedAt: new Date().toISOString(),
  finishedAt: null,
  status: 'running',
  apiBaseUrl,
  analyticsProjectId,
  checks: [],
  details: {},
  error: null
};

const addCheck = (name, status, details = null) => {
  report.checks.push({
    name,
    status,
    at: new Date().toISOString(),
    ...(details ? { details } : {})
  });
};

const writeReport = (status, extra = {}) => {
  report.status = status;
  report.finishedAt = new Date().toISOString();
  if (extra.details && typeof extra.details === 'object') {
    report.details = { ...report.details, ...extra.details };
  }
  report.error = extra.error || null;
  if (!reportPath) return;
  const targetPath = path.resolve(reportPath);
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
};

const missing = [];
if (!adminEmail) missing.push('E2E_ADMIN_EMAIL|E2E_EMAIL');
if (!adminPassword) missing.push('E2E_ADMIN_PASSWORD|E2E_PASSWORD');
if (isCi) {
  if (!studentEmail) missing.push('E2E_STUDENT_EMAIL');
  if (!studentPassword) missing.push('E2E_STUDENT_PASSWORD');
  if (!professorEmail) missing.push('E2E_PROFESSOR_EMAIL');
  if (!professorPassword) missing.push('E2E_PROFESSOR_PASSWORD');
}

if (missing.length > 0) {
  if (isCi) {
    console.error(`[e2e-analytics] Fail: faltam variaveis ${missing.join(', ')}`);
    addCheck('env.required', 'failed', { missing });
    writeReport('failed', { error: `Missing required env vars: ${missing.join(', ')}` });
    process.exit(1);
  }
  console.log(`[e2e-analytics] Skip: faltam variaveis ${missing.join(', ')}`);
  addCheck('env.required', 'skipped', { missing });
  writeReport('skipped', { details: { missing } });
  process.exit(0);
}
addCheck('env.required', 'passed');

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

const assertSummaryMetrics = (payload, expected) => {
  const metrics = payload?.metrics || {};
  const appointments = payload?.appointments?.summary || {};
  const assertExpected = (actual, expectedValue, label) => {
    if (expectedValue === null || expectedValue === undefined) {
      return;
    }
    if (Array.isArray(expectedValue)) {
      ensure(
        expectedValue.includes(actual),
        `Esperado ${label} em [${expectedValue.join(', ')}], recebido ${actual}`
      );
      return;
    }
    ensure(actual === expectedValue, `Esperado ${label}=${expectedValue}, recebido ${actual}`);
  };

  ensure(metrics.totalPatients === expected.totalPatients, `Esperado totalPatients=${expected.totalPatients}, recebido ${metrics.totalPatients}`);
  ensure(metrics.professors === expected.professors, `Esperado professors=${expected.professors}, recebido ${metrics.professors}`);
  ensure(metrics.activePatients === expected.activePatients, `Esperado activePatients=${expected.activePatients}, recebido ${metrics.activePatients}`);
  ensure(metrics.waitingList === expected.waitingList, `Esperado waitingList=${expected.waitingList}, recebido ${metrics.waitingList}`);

  assertExpected(appointments.todayCount, expected.todayCount, 'todayCount');
  assertExpected(appointments.weekCount, expected.weekCount, 'weekCount');
  assertExpected(appointments.noShowRate, expected.noShowRate, 'noShowRate');
  assertExpected(appointments.rescheduleRate, expected.rescheduleRate, 'rescheduleRate');
  assertExpected(appointments.completionRate, expected.completionRate, 'completionRate');

  ensure(Number.isFinite(Number(appointments.todayCount)) && Number(appointments.todayCount) >= 0, 'todayCount invalido');
  ensure(Number.isFinite(Number(appointments.weekCount)) && Number(appointments.weekCount) >= 0, 'weekCount invalido');
  ensure(Number(appointments.weekCount) >= Number(appointments.todayCount), 'weekCount nao pode ser menor que todayCount');
  ensure(Number.isFinite(Number(appointments.noShowRate)) && Number(appointments.noShowRate) >= 0 && Number(appointments.noShowRate) <= 100, 'noShowRate invalido');
  ensure(Number.isFinite(Number(appointments.rescheduleRate)) && Number(appointments.rescheduleRate) >= 0 && Number(appointments.rescheduleRate) <= 100, 'rescheduleRate invalido');
  ensure(Number.isFinite(Number(appointments.completionRate)) && Number(appointments.completionRate) >= 0 && Number(appointments.completionRate) <= 100, 'completionRate invalido');

  const items = Array.isArray(payload?.appointments?.items) ? payload.appointments.items : [];
  ensure(items.length >= 4, `Esperado ao menos 4 agendamentos no resumo, recebido ${items.length}`);
};

const assertOverviewMetrics = (payload, expected) => {
  const metrics = payload?.metrics || {};
  ensure(metrics.totalAlunos === expected.totalAlunos, `Esperado totalAlunos=${expected.totalAlunos}, recebido ${metrics.totalAlunos}`);
  ensure(metrics.professores === expected.professores, `Esperado professores=${expected.professores}, recebido ${metrics.professores}`);
  ensure(metrics.totalPacientes === expected.totalPacientes, `Esperado totalPacientes=${expected.totalPacientes}, recebido ${metrics.totalPacientes}`);
  ensure(metrics.avaliacoesPeriodo === expected.avaliacoesPeriodo, `Esperado avaliacoesPeriodo=${expected.avaliacoesPeriodo}, recebido ${metrics.avaliacoesPeriodo}`);
  ensure(metrics.taxaVinculacao === expected.taxaVinculacao, `Esperado taxaVinculacao=${expected.taxaVinculacao}, recebido ${metrics.taxaVinculacao}`);
  ensure(metrics.integridade === expected.integridade, `Esperado integridade=${expected.integridade}, recebido ${metrics.integridade}`);
  ensure(metrics.completionRate === expected.completionRate, `Esperado completionRate=${expected.completionRate}, recebido ${metrics.completionRate}`);
  ensure(metrics.retencao === expected.retencao, `Esperado retencao=${expected.retencao}, recebido ${metrics.retencao}`);
  ensure(Number(metrics.satisfacao).toFixed(1) === Number(expected.satisfacao).toFixed(1), `Esperado satisfacao=${expected.satisfacao}, recebido ${metrics.satisfacao}`);
};

const assertUsageByType = (payload) => {
  const usage = Array.isArray(payload?.usageByType) ? payload.usageByType : [];
  const byKey = usage.reduce((acc, item) => {
    acc[item.key] = item;
    return acc;
  }, {});

  ensure(byKey.bioimpedancia?.count === 1, `Esperado bioimpedancia.count=1, recebido ${byKey.bioimpedancia?.count}`);
  ensure(byKey.perimetros?.count === 2, `Esperado perimetros.count=2, recebido ${byKey.perimetros?.count}`);
  ensure(byKey.perimetros?.percentage === 67, `Esperado perimetros.percentage=67, recebido ${byKey.perimetros?.percentage}`);
};

const assertQuarterly = (payload) => {
  const quarterly = Array.isArray(payload?.quarterly) ? payload.quarterly : [];
  ensure(quarterly.length === 4, `Esperado quarterly com 4 trimestres, recebido ${quarterly.length}`);
  const totalEvaluations = quarterly.reduce((acc, item) => acc + Number(item?.avaliacoes || 0), 0);
  ensure(totalEvaluations === 3, `Esperado soma trimestral de avaliacoes=3, recebido ${totalEvaluations}`);
};

const assertExportCsv = (raw) => {
  const normalized = String(raw || '').replace(/^\uFEFF/, '');
  const lines = normalized
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  ensure(lines.length === 10, `Esperado 10 linhas no CSV (cabecalho + 9 registros), recebido ${lines.length}`);
  ensure(
    lines[0] === 'tipo_registro,id,paciente_id,paciente_nome,paciente_anon_id,projeto_id,projeto_nome,status,responsavel_id,responsavel_nome,consulta_data,consulta_hora,consulta_tipo,avaliacao_tipo,avaliacao_completude,consentimento_pesquisa,criado_em,atualizado_em',
    'Cabecalho CSV inesperado.'
  );
  ensure(normalized.includes('"paciente"'), 'CSV sem linhas de paciente.');
  ensure(normalized.includes('"avaliacao"'), 'CSV sem linhas de avaliacao.');
  ensure(normalized.includes('"consulta"'), 'CSV sem linhas de consulta.');
  ensure(normalized.includes('consulta_tipo'), 'CSV sem coluna de tipo de consulta.');
  ensure(normalized.includes('responsavel_id'), 'CSV sem coluna de responsavel.');
  ensure(normalized.includes('anon-'), 'CSV sem IDs anonimizados.');
  ensure(!normalized.includes('Paciente CI Vinculado'), 'CSV anonimo nao deve conter nome de paciente.');
};

const assertCorrelationsPayload = (payload) => {
  ensure(payload && typeof payload === 'object', 'Payload de correlations invalido.');
  ensure(typeof payload.generatedAt === 'string', 'Correlations sem generatedAt.');
  ensure(typeof payload?.dataset?.patients === 'number', 'Correlations sem dataset.patients.');
  ensure(Array.isArray(payload?.absenteeism?.byTurn), 'Correlations sem absenteeism.byTurn.');
  ensure(Array.isArray(payload?.completeness?.byEvaluationType), 'Correlations sem completeness.byEvaluationType.');
  ensure(Array.isArray(payload?.retention?.byConsultInterval), 'Correlations sem retention.byConsultInterval.');
  ensure(Array.isArray(payload?.drivers), 'Correlations sem drivers.');
  ensure(Array.isArray(payload?.alerts), 'Correlations sem alerts.');
};

const assertExportJson = (raw) => {
  const parsed = JSON.parse(raw);
  ensure(parsed && typeof parsed === 'object', 'Export json invalido.');
  ensure(typeof parsed.generatedAt === 'string', 'Export json sem generatedAt.');
  ensure(parsed.filters?.anonymize === true, 'Export json com anonimização inesperada.');
  ensure(Array.isArray(parsed.pacientes) && parsed.pacientes.length === 2, 'Export json sem pacientes esperados.');
  ensure(Array.isArray(parsed.avaliacoes) && parsed.avaliacoes.length === 3, 'Export json sem avaliacoes esperadas.');
  ensure(Array.isArray(parsed.agendamentos) && parsed.agendamentos.length === 4, 'Export json sem agendamentos esperados.');
};

const loginUser = async (email, password, label) => {
  const result = await requestJson('/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  ensure(result.response.ok, `Falha no login ${label}: HTTP ${result.response.status}`);
  const token = String(result.body?.accessToken || '');
  ensure(token.length > 10, `Token de login ausente para ${label}.`);
  return token;
};

const assertAnalyticsDenied = async (label, token) => {
  const headers = { authorization: `Bearer ${token}` };
  const deniedDashboard = await requestJson(`/analytics/dashboard/summary?projectId=${analyticsProjectId}`, { headers });
  ensure(
    deniedDashboard.response.status === 403,
    `Esperado 403 para ${label} em /analytics/dashboard/summary, recebido ${deniedDashboard.response.status}`
  );

  const deniedOverview = await requestJson(`/analytics/reports/overview?range=month&projectId=${analyticsProjectId}`, { headers });
  ensure(
    deniedOverview.response.status === 403,
    `Esperado 403 para ${label} em /analytics/reports/overview, recebido ${deniedOverview.response.status}`
  );

  const deniedExport = await fetch(
    `${apiBaseUrl}/analytics/reports/export?range=month&projectId=${analyticsProjectId}&format=csv&anonymize=true`,
    { headers }
  );
  ensure(
    deniedExport.status === 403,
    `Esperado 403 para ${label} em /analytics/reports/export, recebido ${deniedExport.status}`
  );

  const deniedCorrelations = await requestJson(`/analytics/correlations?projectId=${analyticsProjectId}`, { headers });
  ensure(
    deniedCorrelations.response.status === 403,
    `Esperado 403 para ${label} em /analytics/correlations, recebido ${deniedCorrelations.response.status}`
  );
};

const run = async () => {
  console.log(`[e2e-analytics] API base: ${apiBaseUrl}`);

  const token = await loginUser(adminEmail, adminPassword, 'admin');
  const authHeaders = { authorization: `Bearer ${token}` };
  console.log('[e2e-analytics] Login admin ok');
  addCheck('auth.admin-login', 'passed');

  const summary = await requestJson(`/analytics/dashboard/summary?projectId=${analyticsProjectId}`, {
    headers: authHeaders
  });
  ensure(summary.response.ok, `Falha em /analytics/dashboard/summary?projectId=<fixture>: HTTP ${summary.response.status}`);
  assertSummaryMetrics(summary.body, {
    totalPatients: 2,
    professors: 1,
    activePatients: 2,
    waitingList: 0,
    todayCount: null,
    weekCount: null,
    noShowRate: null,
    rescheduleRate: null,
    completionRate: null
  });
  console.log('[e2e-analytics] /analytics/dashboard/summary fixture ok');
  addCheck('analytics.dashboard-summary', 'passed', {
    httpStatus: summary.response.status,
    metrics: summary.body?.metrics || null,
    appointmentsSummary: summary.body?.appointments?.summary || null
  });

  const correlations = await requestJson(`/analytics/correlations?projectId=${analyticsProjectId}`, {
    headers: authHeaders
  });
  ensure(correlations.response.ok, `Falha em /analytics/correlations?projectId=<fixture>: HTTP ${correlations.response.status}`);
  assertCorrelationsPayload(correlations.body);
  console.log('[e2e-analytics] /analytics/correlations fixture ok');
  addCheck('analytics.correlations', 'passed', {
    httpStatus: correlations.response.status,
    drivers: Array.isArray(correlations.body?.drivers) ? correlations.body.drivers.length : 0
  });

  const overviewProject = await requestJson(`/analytics/reports/overview?range=month&projectId=${analyticsProjectId}`, {
    headers: authHeaders
  });
  ensure(overviewProject.response.ok, `Falha em /analytics/reports/overview?projectId=<fixture>: HTTP ${overviewProject.response.status}`);
  assertOverviewMetrics(overviewProject.body, {
    totalAlunos: 1,
    professores: 1,
    totalPacientes: 2,
    avaliacoesPeriodo: 3,
    taxaVinculacao: 50,
    integridade: 67,
    completionRate: 25,
    satisfacao: 1.3,
    retencao: 50
  });
  assertUsageByType(overviewProject.body);
  assertQuarterly(overviewProject.body);
  console.log('[e2e-analytics] /analytics/reports/overview project ok');
  addCheck('analytics.reports-overview', 'passed', {
    httpStatus: overviewProject.response.status,
    metrics: overviewProject.body?.metrics || null
  });

  const exportCsv = await fetch(
    `${apiBaseUrl}/analytics/reports/export?range=month&projectId=${analyticsProjectId}&format=csv&anonymize=true`,
    { headers: authHeaders }
  );
  ensure(exportCsv.ok, `Falha em export csv: HTTP ${exportCsv.status}`);
  const csvDisposition = exportCsv.headers.get('content-disposition') || '';
  const csvContentType = String(exportCsv.headers.get('content-type') || '').toLowerCase();
  ensure(/filename/i.test(csvDisposition), 'Export csv sem content-disposition com filename.');
  ensure(csvContentType.includes('text/csv'), `Content-Type csv invalido: ${csvContentType || '<empty>'}`);
  ensure(csvContentType.includes('charset=utf-8'), `Export csv sem charset utf-8: ${csvContentType || '<empty>'}`);
  const csvBody = await exportCsv.text();
  assertExportCsv(csvBody);
  console.log('[e2e-analytics] /analytics/reports/export csv ok');
  addCheck('analytics.export-csv', 'passed', {
    httpStatus: exportCsv.status,
    contentDisposition: csvDisposition,
    lineCount: String(csvBody).split('\n').filter(Boolean).length
  });

  const exportJson = await fetch(
    `${apiBaseUrl}/analytics/reports/export?range=month&projectId=${analyticsProjectId}&format=json&anonymize=true`,
    { headers: authHeaders }
  );
  ensure(exportJson.ok, `Falha em export json: HTTP ${exportJson.status}`);
  const jsonDisposition = exportJson.headers.get('content-disposition') || '';
  ensure(/filename/i.test(jsonDisposition), 'Export json sem content-disposition com filename.');
  const jsonText = await exportJson.text();
  assertExportJson(jsonText);
  console.log('[e2e-analytics] /analytics/reports/export json ok');
  const parsedExportJson = JSON.parse(jsonText);
  addCheck('analytics.export-json', 'passed', {
    httpStatus: exportJson.status,
    contentDisposition: jsonDisposition,
    pacientes: Array.isArray(parsedExportJson?.pacientes) ? parsedExportJson.pacientes.length : 0,
    avaliacoes: Array.isArray(parsedExportJson?.avaliacoes) ? parsedExportJson.avaliacoes.length : 0,
    agendamentos: Array.isArray(parsedExportJson?.agendamentos) ? parsedExportJson.agendamentos.length : 0
  });

  if (studentEmail && studentPassword) {
    const studentToken = await loginUser(studentEmail, studentPassword, 'student');
    await assertAnalyticsDenied('student', studentToken);
    console.log('[e2e-analytics] autorizacao negativa student ok');
    addCheck('analytics.authorization.student', 'passed');
  }

  if (professorEmail && professorPassword) {
    const professorToken = await loginUser(professorEmail, professorPassword, 'professor');
    await assertAnalyticsDenied('professor', professorToken);
    console.log('[e2e-analytics] autorizacao negativa professor ok');
    addCheck('analytics.authorization.professor', 'passed');
  }

  console.log('[e2e-analytics] Fluxo analytics/export validado com sucesso.');
  writeReport('passed');
};

run().catch((error) => {
  console.error(`[e2e-analytics] Falha: ${error.message}`);
  addCheck('suite.execution', 'failed', { message: error.message });
  writeReport('failed', { error: error.message });
  process.exitCode = 1;
});
