const { Client } = require('pg');
const path = require('path');

require('dotenv').config({
  path: process.env.DOTENV_CONFIG_PATH || path.resolve(__dirname, '..', '.env')
});

if (process.env.NODE_ENV === 'production') {
  console.error('BLOQUEADO: seed-ci-analytics não pode rodar em produção.');
  process.exit(1);
}

const ANALYTICS_PROJECT_ID = '11111111-1111-4111-8111-111111111111';
const PATIENT_IDS = {
  linked: '21111111-1111-4111-8111-111111111111',
  waiting: '21111111-1111-4111-8111-111111111112',
  supervised: '21111111-1111-4111-8111-111111111113'
};
const EVALUATION_IDS = {
  first: '31111111-1111-4111-8111-111111111111',
  second: '31111111-1111-4111-8111-111111111112',
  third: '31111111-1111-4111-8111-111111111113'
};
const APPOINTMENT_IDS = {
  today: '41111111-1111-4111-8111-111111111111',
  completed: '41111111-1111-4111-8111-111111111112',
  noShow: '41111111-1111-4111-8111-111111111113',
  rescheduled: '41111111-1111-4111-8111-111111111114'
};

const buildDbConfig = () => ({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 5432),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'postgres'
});

const resolveCiUsers = () => ({
  studentEmail: String(process.env.E2E_STUDENT_EMAIL || 'aluno.ci@laines.ufrn.br').trim().toLowerCase(),
  professorEmail: String(process.env.E2E_PROFESSOR_EMAIL || 'professor.ci@laines.ufrn.br').trim().toLowerCase(),
  teamEmail: String(process.env.E2E_TEAM_EMAIL || 'tecnico.ci@laines.ufrn.br').trim().toLowerCase(),
  athleteEmail: String(process.env.E2E_ATHLETE_EMAIL || 'atleta.ci@laines.ufrn.br').trim().toLowerCase()
});

const getUserIdByEmail = async (client, email) => {
  const result = await client.query(
    'SELECT id, name FROM users WHERE email = $1 LIMIT 1',
    [email]
  );
  if (result.rowCount < 1) return null;
  return result.rows[0];
};

const seedProject = async (client) => {
  await client.query(
    `
    INSERT INTO projetos (
      id, nome, area, status, created_at, updated_at
    )
    VALUES (
      $1, 'Projeto CI Analytics', 'nutricao', 'ativo', NOW(), NOW()
    )
    ON CONFLICT (id)
    DO UPDATE SET
      nome = EXCLUDED.nome,
      area = EXCLUDED.area,
      status = EXCLUDED.status,
      updated_at = NOW()
    `,
    [ANALYTICS_PROJECT_ID]
  );
};

const clearAnalyticsFixtures = async (client) => {
  await client.query(
    'DELETE FROM agendamentos WHERE id = ANY($1::uuid[])',
    [Object.values(APPOINTMENT_IDS)]
  );
  await client.query(
    'DELETE FROM avaliacoes WHERE id = ANY($1::uuid[])',
    [Object.values(EVALUATION_IDS)]
  );
  await client.query(
    'DELETE FROM pacientes WHERE id = ANY($1::uuid[])',
    [Object.values(PATIENT_IDS)]
  );
  await client.query(
    'DELETE FROM projetos WHERE id = $1',
    [ANALYTICS_PROJECT_ID]
  );
};

const seedPatients = async (client, refs) => {
  await client.query(
    `
    INSERT INTO pacientes (
      id,
      prontuario,
      nome,
      cpf,
      status,
      projeto_id,
      projeto_nome,
      aluno_responsavel_id,
      aluno_responsavel_nome,
      professor_supervisor_id,
      professor_supervisor_nome,
      equipe_tecnica_ids,
      atleta_user_id,
      consentimento_pesquisa,
      data_cadastro,
      created_at,
      updated_at
    ) VALUES
      (
        $1,
        'PRT-CI-001',
        'Paciente CI Vinculado',
        '11111111111',
        'ativo',
        $4,
        'Projeto CI Analytics',
        $2,
        $3,
        $5,
        $6,
        ARRAY[$7::uuid],
        $8,
        'aprovado',
        NOW(),
        NOW(),
        NOW()
      ),
      (
        $9,
        'PRT-CI-002',
        'Paciente CI Espera',
        '22222222222',
        'espera',
        NULL,
        NULL,
        NULL,
        NULL,
        NULL,
        NULL,
        ARRAY[]::uuid[],
        NULL,
        'pendente',
        NOW(),
        NOW(),
        NOW()
      ),
      (
        $10,
        'PRT-CI-003',
        'Paciente CI Supervisionado',
        '33333333333',
        'ativo',
        $4,
        'Projeto CI Analytics',
        NULL,
        NULL,
        $5,
        $6,
        ARRAY[$7::uuid],
        NULL,
        'pendente',
        NOW(),
        NOW(),
        NOW()
      )
    ON CONFLICT (id)
    DO UPDATE SET
      nome = EXCLUDED.nome,
      prontuario = EXCLUDED.prontuario,
      cpf = EXCLUDED.cpf,
      status = EXCLUDED.status,
      projeto_id = EXCLUDED.projeto_id,
      projeto_nome = EXCLUDED.projeto_nome,
      aluno_responsavel_id = EXCLUDED.aluno_responsavel_id,
      aluno_responsavel_nome = EXCLUDED.aluno_responsavel_nome,
      professor_supervisor_id = EXCLUDED.professor_supervisor_id,
      professor_supervisor_nome = EXCLUDED.professor_supervisor_nome,
      equipe_tecnica_ids = EXCLUDED.equipe_tecnica_ids,
      atleta_user_id = EXCLUDED.atleta_user_id,
      consentimento_pesquisa = EXCLUDED.consentimento_pesquisa,
      data_cadastro = EXCLUDED.data_cadastro,
      updated_at = NOW()
    `,
    [
      PATIENT_IDS.linked,
      refs.student.id,
      refs.student.name || 'Aluno CI',
      ANALYTICS_PROJECT_ID,
      refs.professor.id,
      refs.professor.name || 'Professor CI',
      refs.team.id,
      refs.athlete.id,
      PATIENT_IDS.waiting,
      PATIENT_IDS.supervised
    ]
  );
};

const seedEvaluations = async (client) => {
  await client.query(
    `
    INSERT INTO avaliacoes (
      id,
      tipo,
      paciente_id,
      projeto_id,
      projeto_nome,
      status,
      data_avaliacao,
      meta,
      created_at,
      updated_at
    ) VALUES
      (
        $1,
        'bioimpedancia',
        $4,
        $6,
        'Projeto CI Analytics',
        'finalizada',
        CURRENT_DATE,
        $7::jsonb,
        NOW() - INTERVAL '1 hour',
        NOW() - INTERVAL '1 hour'
      ),
      (
        $2,
        'perimetros',
        $4,
        $6,
        'Projeto CI Analytics',
        'finalizada',
        CURRENT_DATE,
        $8::jsonb,
        NOW() - INTERVAL '2 hours',
        NOW() - INTERVAL '2 hours'
      ),
      (
        $3,
        'perimetros',
        $5,
        $6,
        'Projeto CI Analytics',
        'finalizada',
        CURRENT_DATE,
        $9::jsonb,
        NOW() - INTERVAL '3 hours',
        NOW() - INTERVAL '3 hours'
      )
    ON CONFLICT (id)
    DO UPDATE SET
      tipo = EXCLUDED.tipo,
      paciente_id = EXCLUDED.paciente_id,
      projeto_id = EXCLUDED.projeto_id,
      projeto_nome = EXCLUDED.projeto_nome,
      status = EXCLUDED.status,
      data_avaliacao = EXCLUDED.data_avaliacao,
      meta = EXCLUDED.meta,
      updated_at = NOW()
    `,
    [
      EVALUATION_IDS.first,
      EVALUATION_IDS.second,
      EVALUATION_IDS.third,
      PATIENT_IDS.linked,
      PATIENT_IDS.supervised,
      ANALYTICS_PROJECT_ID,
      JSON.stringify({ completude: 90 }),
      JSON.stringify({ completude: 85 }),
      JSON.stringify({ completude: 60 })
    ]
  );
};

const seedAppointments = async (client, refs) => {
  await client.query(
    `
    INSERT INTO agendamentos (
      id,
      paciente_id,
      paciente_nome,
      aluno_id,
      aluno_nome,
      date,
      time,
      appointment_type,
      scheduled_at,
      evaluations,
      status,
      created_at,
      updated_at
    ) VALUES
      (
        $1,
        $5,
        'Paciente CI Vinculado',
        $2,
        $3,
        CURRENT_DATE,
        '10:00',
        'primeira_consulta',
        NOW(),
        '{}',
        'agendada',
        NOW(),
        NOW()
      ),
      (
        $6,
        $5,
        'Paciente CI Vinculado',
        $2,
        $3,
        CURRENT_DATE - INTERVAL '1 day',
        '10:00',
        'retorno',
        NOW() - INTERVAL '1 day',
        '{}',
        'realizada',
        NOW() - INTERVAL '1 day',
        NOW() - INTERVAL '1 day'
      ),
      (
        $7,
        $8,
        'Paciente CI Supervisionado',
        $4,
        $9,
        CURRENT_DATE - INTERVAL '2 days',
        '11:00',
        'retorno',
        NOW() - INTERVAL '2 days',
        '{}',
        'falta',
        NOW() - INTERVAL '2 days',
        NOW() - INTERVAL '2 days'
      ),
      (
        $10,
        $8,
        'Paciente CI Supervisionado',
        $4,
        $9,
        CURRENT_DATE - INTERVAL '3 days',
        '12:00',
        'retorno',
        NOW() - INTERVAL '3 days',
        '{}',
        'remarcada',
        NOW() - INTERVAL '3 days',
        NOW() - INTERVAL '3 days'
      )
    ON CONFLICT (id)
    DO UPDATE SET
      paciente_id = EXCLUDED.paciente_id,
      paciente_nome = EXCLUDED.paciente_nome,
      aluno_id = EXCLUDED.aluno_id,
      aluno_nome = EXCLUDED.aluno_nome,
      date = EXCLUDED.date,
      time = EXCLUDED.time,
      appointment_type = EXCLUDED.appointment_type,
      scheduled_at = EXCLUDED.scheduled_at,
      evaluations = EXCLUDED.evaluations,
      status = EXCLUDED.status,
      updated_at = NOW()
    `,
    [
      APPOINTMENT_IDS.today,
      refs.student.id,
      refs.student.name || 'Aluno CI',
      refs.professor.id,
      PATIENT_IDS.linked,
      APPOINTMENT_IDS.completed,
      APPOINTMENT_IDS.noShow,
      PATIENT_IDS.supervised,
      refs.professor.name || 'Professor CI',
      APPOINTMENT_IDS.rescheduled
    ]
  );
};

const main = async () => {
  const client = new Client(buildDbConfig());
  const users = resolveCiUsers();
  await client.connect();

  try {
    const student = await getUserIdByEmail(client, users.studentEmail);
    const professor = await getUserIdByEmail(client, users.professorEmail);
    const team = await getUserIdByEmail(client, users.teamEmail);
    const athlete = await getUserIdByEmail(client, users.athleteEmail);

    if (!student || !professor || !team || !athlete) {
      throw new Error('Missing CI users for analytics seed. Run seed-ci-users first.');
    }

    await clearAnalyticsFixtures(client);
    await seedProject(client);
    await seedPatients(client, { student, professor, team, athlete });
    await seedEvaluations(client);
    await seedAppointments(client, { student, professor });

    console.log('[seed-ci-analytics] deterministic analytics fixture seeded.');
    console.log(`[seed-ci-analytics] project=${ANALYTICS_PROJECT_ID}`);
  } finally {
    await client.end();
  }
};

main().catch((error) => {
  console.error(`[seed-ci-analytics] failed: ${error.message}`);
  process.exitCode = 1;
});
