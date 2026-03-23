const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const ANALYTICS_PROJECT_ID = '11111111-1111-4111-8111-111111111111';
const PATIENT_IDS = [
  '21111111-1111-4111-8111-111111111111',
  '21111111-1111-4111-8111-111111111112',
  '21111111-1111-4111-8111-111111111113'
];
const EVALUATION_IDS = [
  '31111111-1111-4111-8111-111111111111',
  '31111111-1111-4111-8111-111111111112',
  '31111111-1111-4111-8111-111111111113'
];
const APPOINTMENT_IDS = [
  '41111111-1111-4111-8111-111111111111',
  '41111111-1111-4111-8111-111111111112',
  '41111111-1111-4111-8111-111111111113',
  '41111111-1111-4111-8111-111111111114'
];

const parseEnvFile = (filePath) => {
  if (!fs.existsSync(filePath)) return {};
  const raw = fs.readFileSync(filePath, 'utf8');
  return raw.split(/\r?\n/).reduce((acc, line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return acc;
    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex <= 0) return acc;
    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
    acc[key] = value;
    return acc;
  }, {});
};

const envFileValues = parseEnvFile(path.resolve(process.cwd(), 'server', '.env'));

const buildDbConfig = () => ({
  host: process.env.DB_HOST || envFileValues.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || envFileValues.DB_PORT || 5432),
  user: process.env.DB_USER || envFileValues.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || envFileValues.DB_PASSWORD || '',
  database: process.env.DB_NAME || envFileValues.DB_NAME || 'postgres'
});

const normalizePrefix = (value) => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9_-]/g, '');

const extractPrefixesFromReports = () => {
  const artifactsDir = path.resolve(process.cwd(), 'e2e-artifacts');
  if (!fs.existsSync(artifactsDir)) return [];

  return fs.readdirSync(artifactsDir)
    .filter((file) => /^seed-.*-report\.json$/i.test(file))
    .map((file) => {
      const fullPath = path.join(artifactsDir, file);
      try {
        const payload = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
        return normalizePrefix(payload?.dataset?.prefix);
      } catch {
        return '';
      }
    })
    .filter(Boolean);
};

const cleanupPrefixDataset = async (client, prefix) => {
  const summary = {
    prefix,
    users: 0,
    patients: 0,
    projects: 0,
    avaliacoes: 0,
    agendamentos: 0,
    notificacoes: 0
  };

  const emailLike = `${prefix}.u%@laines.ufrn.br`;
  const projectLike = `Projeto ${prefix} %`;
  const patientLike = `Load ${prefix} Paciente %`;

  const usersResult = await client.query(
    'SELECT id FROM users WHERE email LIKE $1',
    [emailLike]
  );
  const userIds = usersResult.rows.map((row) => row.id);

  const patientsResult = await client.query(
    `SELECT id FROM pacientes
     WHERE nome LIKE $1
       OR aluno_responsavel_id = ANY($2::uuid[])
       OR professor_supervisor_id = ANY($2::uuid[])
       OR atleta_user_id = ANY($2::uuid[])`,
    [patientLike, userIds]
  );
  const patientIds = patientsResult.rows.map((row) => row.id);

  const projectsResult = await client.query(
    'SELECT id FROM projetos WHERE nome LIKE $1',
    [projectLike]
  );
  const projectIds = projectsResult.rows.map((row) => row.id);

  if (patientIds.length > 0 || userIds.length > 0) {
    const agendamentosDelete = await client.query(
      'DELETE FROM agendamentos WHERE paciente_id = ANY($1::uuid[]) OR aluno_id = ANY($2::uuid[])',
      [patientIds, userIds]
    );
    summary.agendamentos += agendamentosDelete.rowCount || 0;

    const avaliacoesDelete = await client.query(
      'DELETE FROM avaliacoes WHERE paciente_id = ANY($1::uuid[]) OR aluno_id = ANY($2::uuid[])',
      [patientIds, userIds]
    );
    summary.avaliacoes += avaliacoesDelete.rowCount || 0;
  }

  if (patientIds.length > 0) {
    const patientsDelete = await client.query(
      'DELETE FROM pacientes WHERE id = ANY($1::uuid[])',
      [patientIds]
    );
    summary.patients += patientsDelete.rowCount || 0;
  }

  if (userIds.length > 0) {
    const notificationsDelete = await client.query(
      'DELETE FROM notificacoes WHERE user_id = ANY($1::uuid[])',
      [userIds]
    );
    summary.notificacoes += notificationsDelete.rowCount || 0;

    const usersDelete = await client.query(
      'DELETE FROM users WHERE id = ANY($1::uuid[])',
      [userIds]
    );
    summary.users += usersDelete.rowCount || 0;
  }

  if (projectIds.length > 0) {
    const projectsDelete = await client.query(
      'DELETE FROM projetos WHERE id = ANY($1::uuid[])',
      [projectIds]
    );
    summary.projects += projectsDelete.rowCount || 0;
  }

  return summary;
};

const cleanupCiFixtures = async (client) => {
  const ciEmails = [
    String(process.env.E2E_ADMIN_EMAIL || envFileValues.E2E_ADMIN_EMAIL || 'admin.ci@laines.ufrn.br').trim().toLowerCase(),
    String(process.env.E2E_STUDENT_EMAIL || envFileValues.E2E_STUDENT_EMAIL || 'aluno.ci@laines.ufrn.br').trim().toLowerCase(),
    String(process.env.E2E_PROFESSOR_EMAIL || envFileValues.E2E_PROFESSOR_EMAIL || 'professor.ci@laines.ufrn.br').trim().toLowerCase()
  ];

  const summary = {
    users: 0,
    patients: 0,
    projects: 0,
    avaliacoes: 0,
    agendamentos: 0,
    notificacoes: 0
  };

  const usersResult = await client.query(
    'SELECT id FROM users WHERE email = ANY($1::text[])',
    [ciEmails]
  );
  const ciUserIds = usersResult.rows.map((row) => row.id);

  const agendamentosDeleteByIds = await client.query(
    'DELETE FROM agendamentos WHERE id = ANY($1::uuid[])',
    [APPOINTMENT_IDS]
  );
  summary.agendamentos += agendamentosDeleteByIds.rowCount || 0;

  const avaliacoesDeleteByIds = await client.query(
    'DELETE FROM avaliacoes WHERE id = ANY($1::uuid[])',
    [EVALUATION_IDS]
  );
  summary.avaliacoes += avaliacoesDeleteByIds.rowCount || 0;

  const pacientesDeleteByIds = await client.query(
    'DELETE FROM pacientes WHERE id = ANY($1::uuid[])',
    [PATIENT_IDS]
  );
  summary.patients += pacientesDeleteByIds.rowCount || 0;

  if (ciUserIds.length > 0) {
    const agendamentosDeleteByUsers = await client.query(
      'DELETE FROM agendamentos WHERE aluno_id = ANY($1::uuid[])',
      [ciUserIds]
    );
    summary.agendamentos += agendamentosDeleteByUsers.rowCount || 0;

    const notificationsDelete = await client.query(
      'DELETE FROM notificacoes WHERE user_id = ANY($1::uuid[])',
      [ciUserIds]
    );
    summary.notificacoes += notificationsDelete.rowCount || 0;
  }

  const ciPatientsDeleteByName = await client.query(
    `DELETE FROM pacientes
     WHERE nome LIKE 'Paciente CI %'`,
    []
  );
  summary.patients += ciPatientsDeleteByName.rowCount || 0;

  const projectDeleteById = await client.query(
    'DELETE FROM projetos WHERE id = $1',
    [ANALYTICS_PROJECT_ID]
  );
  summary.projects += projectDeleteById.rowCount || 0;

  const projectDeleteByName = await client.query(
    `DELETE FROM projetos WHERE nome = 'Projeto CI Analytics'`,
    []
  );
  summary.projects += projectDeleteByName.rowCount || 0;

  if (ciUserIds.length > 0) {
    const usersDelete = await client.query(
      'DELETE FROM users WHERE id = ANY($1::uuid[])',
      [ciUserIds]
    );
    summary.users += usersDelete.rowCount || 0;
  } else {
    const usersDeleteByEmail = await client.query(
      'DELETE FROM users WHERE email = ANY($1::text[])',
      [ciEmails]
    );
    summary.users += usersDeleteByEmail.rowCount || 0;
  }

  return summary;
};

const mergeSummary = (acc, item) => ({
  users: acc.users + item.users,
  patients: acc.patients + item.patients,
  projects: acc.projects + item.projects,
  avaliacoes: acc.avaliacoes + item.avaliacoes,
  agendamentos: acc.agendamentos + item.agendamentos,
  notificacoes: acc.notificacoes + item.notificacoes
});

const main = async () => {
  const argvPrefixes = process.argv.slice(2).map(normalizePrefix).filter(Boolean);
  const reportPrefixes = extractPrefixesFromReports();
  const prefixes = Array.from(new Set([...argvPrefixes, ...reportPrefixes]));

  const client = new Client(buildDbConfig());
  await client.connect();

  const total = {
    users: 0,
    patients: 0,
    projects: 0,
    avaliacoes: 0,
    agendamentos: 0,
    notificacoes: 0
  };

  try {
    await client.query('BEGIN');

    for (const prefix of prefixes) {
      const summary = await cleanupPrefixDataset(client, prefix);
      Object.assign(total, mergeSummary(total, summary));
      console.log(`[cleanup-test-data] prefix=${prefix} users=${summary.users} patients=${summary.patients} projects=${summary.projects} avaliacoes=${summary.avaliacoes} agendamentos=${summary.agendamentos} notificacoes=${summary.notificacoes}`);
    }

    const ciSummary = await cleanupCiFixtures(client);
    Object.assign(total, mergeSummary(total, ciSummary));
    console.log(`[cleanup-test-data] ci-fixtures users=${ciSummary.users} patients=${ciSummary.patients} projects=${ciSummary.projects} avaliacoes=${ciSummary.avaliacoes} agendamentos=${ciSummary.agendamentos} notificacoes=${ciSummary.notificacoes}`);

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }

  console.log(`[cleanup-test-data] done users=${total.users} patients=${total.patients} projects=${total.projects} avaliacoes=${total.avaliacoes} agendamentos=${total.agendamentos} notificacoes=${total.notificacoes}`);
};

main().catch((error) => {
  console.error(`[cleanup-test-data] failed: ${error.message}`);
  process.exitCode = 1;
});
