const { Client } = require('pg');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

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

const toInt = (value, fallback) => {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizePrefix = (value) => {
  const normalized = String(value || 'load100')
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '');
  return normalized || 'load100';
};

const createRng = (seedInput) => {
  let seed = 0x6d2b79f5;
  for (let index = 0; index < seedInput.length; index += 1) {
    seed ^= seedInput.charCodeAt(index);
    seed = Math.imul(seed, 2654435761);
  }
  return () => {
    seed += 0x6d2b79f5;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const buildDbConfig = () => ({
  host: process.env.DB_HOST || envFileValues.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || envFileValues.DB_PORT || 5432),
  user: process.env.DB_USER || envFileValues.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || envFileValues.DB_PASSWORD || '',
  database: process.env.DB_NAME || envFileValues.DB_NAME || 'postgres'
});

const config = (() => {
  const prefix = normalizePrefix(process.env.LOAD_TEST_PREFIX);
  const users = Math.max(20, toInt(process.env.LOAD_TEST_USERS, 100));
  const patients = Math.max(users, toInt(process.env.LOAD_TEST_PATIENTS, users * 2));
  const projects = Math.max(3, toInt(process.env.LOAD_TEST_PROJECTS, 6));
  const password = String(process.env.LOAD_TEST_PASSWORD || 'LoadTest#123456');
  return {
    prefix,
    users,
    patients,
    projects,
    password,
    reportPath: process.env.LOAD_TEST_REPORT_PATH
      || path.resolve(process.cwd(), 'e2e-artifacts', `seed-${prefix}-report.json`)
  };
})();

const now = () => new Date();

const fmtDate = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const randomDateMinusDays = (rng, maxDays) => {
  const result = new Date();
  const delta = Math.floor(rng() * maxDays);
  result.setDate(result.getDate() - delta);
  return result;
};

const randomDatePlusDays = (rng, maxDays) => {
  const result = new Date();
  const delta = Math.floor(rng() * maxDays) + 1;
  result.setDate(result.getDate() + delta);
  return result;
};

const pick = (rng, collection) => {
  if (!collection.length) return null;
  return collection[Math.floor(rng() * collection.length)];
};

const pad = (value, size) => String(value).padStart(size, '0');

const cpfFor = (base, index) => String(base + index).padStart(11, '0').slice(-11);

const emailFor = (prefix, index) => `${prefix}.u${pad(index, 4)}@laines.ufrn.br`;

const rolePlan = (totalUsers) => {
  const roles = [];
  if (totalUsers >= 1) roles.push('admin');
  if (totalUsers >= 2) roles.push('coordenacao');
  if (totalUsers >= 3) roles.push('presidente');
  if (totalUsers >= 4) roles.push('vice');

  const remainingAfterFixed = totalUsers - roles.length;
  let professorCount = Math.max(3, Math.floor(totalUsers * 0.08));
  professorCount = Math.min(professorCount, Math.max(1, remainingAfterFixed - 1));
  for (let i = 0; i < professorCount; i += 1) roles.push('professor');

  const remainingAfterProf = totalUsers - roles.length;
  let athleteCount = Math.max(10, Math.floor(totalUsers * 0.25));
  athleteCount = Math.min(athleteCount, Math.max(0, remainingAfterProf - 1));
  for (let i = 0; i < athleteCount; i += 1) roles.push('atleta');

  while (roles.length < totalUsers) {
    roles.push('aluno');
  }
  return roles;
};

const cleanupDataset = async (client, prefix) => {
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

  if (patientIds.length) {
    await client.query(
      'DELETE FROM agendamentos WHERE paciente_id = ANY($1::uuid[]) OR aluno_id = ANY($2::uuid[])',
      [patientIds, userIds]
    );
    await client.query(
      'DELETE FROM avaliacoes WHERE paciente_id = ANY($1::uuid[]) OR aluno_id = ANY($2::uuid[])',
      [patientIds, userIds]
    );
    await client.query(
      'DELETE FROM pacientes WHERE id = ANY($1::uuid[])',
      [patientIds]
    );
  }

  if (userIds.length) {
    await client.query(
      'DELETE FROM notificacoes WHERE user_id = ANY($1::uuid[])',
      [userIds]
    );
    await client.query(
      'DELETE FROM users WHERE id = ANY($1::uuid[])',
      [userIds]
    );
  }

  if (projectIds.length) {
    await client.query(
      'DELETE FROM projetos WHERE id = ANY($1::uuid[])',
      [projectIds]
    );
  }

  return {
    removedUsers: userIds.length,
    removedPatients: patientIds.length,
    removedProjects: projectIds.length
  };
};

const createProjects = async (client, cfg) => {
  const created = [];
  for (let index = 1; index <= cfg.projects; index += 1) {
    const nome = `Projeto ${cfg.prefix} ${pad(index, 2)}`;
    const row = await client.query(
      `INSERT INTO projetos (nome, area, status, descricao, equipe, alunos_ids, alunos_nomes, created_at, updated_at)
       VALUES ($1, 'nutricao', 'ativo', $2, '{}', '{}', '{}', NOW(), NOW())
       RETURNING id, nome`,
      [nome, `Projeto de simulacao de carga ${cfg.prefix}`]
    );
    created.push(row.rows[0]);
  }
  return created;
};

const upsertUser = async (client, payload) => {
  const row = await client.query(
    `INSERT INTO users (
      email, password_hash, role, name, cpf, telefone, curso, status, must_change_password, temp_password,
      password_updated_at, supervisor_id, supervisor_nome, projeto_id, projeto_nome, created_at, updated_at
    )
    VALUES (
      $1, $2, $3, $4, $5, $6, 'Nutricao', 'ativo', false, NULL,
      NOW(), $7, $8, $9, $10, NOW(), NOW()
    )
    ON CONFLICT (email)
    DO UPDATE SET
      password_hash = EXCLUDED.password_hash,
      role = EXCLUDED.role,
      name = EXCLUDED.name,
      cpf = EXCLUDED.cpf,
      telefone = EXCLUDED.telefone,
      status = 'ativo',
      must_change_password = false,
      temp_password = NULL,
      password_updated_at = NOW(),
      supervisor_id = EXCLUDED.supervisor_id,
      supervisor_nome = EXCLUDED.supervisor_nome,
      projeto_id = EXCLUDED.projeto_id,
      projeto_nome = EXCLUDED.projeto_nome,
      updated_at = NOW()
    RETURNING id, email, role, name, supervisor_id, projeto_id`,
    [
      payload.email,
      payload.passwordHash,
      payload.role,
      payload.name,
      payload.cpf,
      payload.telefone,
      payload.supervisorId,
      payload.supervisorNome,
      payload.projetoId,
      payload.projetoNome
    ]
  );
  return row.rows[0];
};

const createUsers = async (client, cfg, projects, passwordHash) => {
  const roles = rolePlan(cfg.users);
  const users = [];
  const professors = [];
  const students = [];
  const athletes = [];
  let userIndex = 1;

  for (let i = 0; i < roles.length; i += 1) {
    const role = roles[i];
    if (role !== 'admin' && role !== 'coordenacao' && role !== 'professor') continue;
    const created = await upsertUser(client, {
      email: emailFor(cfg.prefix, userIndex),
      passwordHash,
      role,
      name: `Load ${cfg.prefix} ${role} ${pad(userIndex, 3)}`,
      cpf: cpfFor(81000000000, userIndex),
      telefone: `8499${pad(userIndex, 6)}`,
      supervisorId: null,
      supervisorNome: null,
      projetoId: null,
      projetoNome: null
    });
    users.push(created);
    if (role === 'professor') professors.push(created);
    userIndex += 1;
  }

  if (!professors.length) {
    throw new Error('Nao foi possivel criar professores para vinculo de alunos.');
  }

  for (let i = 0; i < roles.length; i += 1) {
    const role = roles[i];
    if (role !== 'presidente' && role !== 'vice' && role !== 'aluno') continue;
    const supervisor = professors[(students.length) % professors.length];
    const project = projects[(students.length) % projects.length];
    const created = await upsertUser(client, {
      email: emailFor(cfg.prefix, userIndex),
      passwordHash,
      role,
      name: `Load ${cfg.prefix} ${role} ${pad(userIndex, 3)}`,
      cpf: cpfFor(82000000000, userIndex),
      telefone: `8498${pad(userIndex, 6)}`,
      supervisorId: supervisor.id,
      supervisorNome: supervisor.name,
      projetoId: project.id,
      projetoNome: project.nome
    });
    users.push(created);
    students.push(created);
    userIndex += 1;
  }

  for (let i = 0; i < roles.length; i += 1) {
    const role = roles[i];
    if (role !== 'atleta') continue;
    const created = await upsertUser(client, {
      email: emailFor(cfg.prefix, userIndex),
      passwordHash,
      role,
      name: `Load ${cfg.prefix} atleta ${pad(userIndex, 3)}`,
      cpf: cpfFor(83000000000, userIndex),
      telefone: `8497${pad(userIndex, 6)}`,
      supervisorId: null,
      supervisorNome: null,
      projetoId: null,
      projetoNome: null
    });
    users.push(created);
    athletes.push(created);
    userIndex += 1;
  }

  return {
    all: users,
    professors,
    students,
    athletes
  };
};

const createPatients = async (client, cfg, projects, users, rng) => {
  const patients = [];
  const modalidades = ['Atletismo', 'Futebol', 'Volei', 'Natacao', 'Crossfit'];
  const objetivos = ['performance', 'saude', 'reabilitacao'];
  const statusPool = ['Ativo', 'Ativo', 'Ativo', 'Ativo', 'Lista de Espera'];

  for (let index = 1; index <= cfg.patients; index += 1) {
    const status = pick(rng, statusPool) || 'Ativo';
    const aluno = users.students.length ? users.students[(index - 1) % users.students.length] : null;
    const professor = aluno
      ? users.professors.find((item) => item.id === aluno.supervisor_id) || users.professors[(index - 1) % users.professors.length]
      : users.professors[(index - 1) % users.professors.length];
    const project = aluno
      ? projects.find((item) => item.id === aluno.projeto_id) || projects[(index - 1) % projects.length]
      : projects[(index - 1) % projects.length];
    const athlete = index <= users.athletes.length ? users.athletes[index - 1] : null;
    const dataCadastro = randomDateMinusDays(rng, 120);
    const linkedAt = status === 'Ativo' ? randomDateMinusDays(rng, 90) : null;

    const row = await client.query(
      `INSERT INTO pacientes (
        nome, cpf, genero, telefone, email, status, modalidade_principal,
        frequencia_semanal, duracao_sessao, tipo_treino, intensidade, objetivo,
        observacoes, projeto_id, projeto_nome, aluno_responsavel_id, aluno_responsavel_nome,
        professor_supervisor_id, professor_supervisor_nome, atleta_user_id,
        consentimento_pesquisa, data_cadastro, linked_at, created_at, updated_at
      ) VALUES (
        $1, $2, 'nao_informado', $3, $4, $5, $6,
        $7, $8, 'misto', 'moderada', $9,
        $10, $11, $12, $13, $14,
        $15, $16, $17,
        $18, $19, $20, NOW(), NOW()
      )
      RETURNING id, nome, status, projeto_id, projeto_nome, aluno_responsavel_id, aluno_responsavel_nome, professor_supervisor_id`,
      [
        `Load ${cfg.prefix} Paciente ${pad(index, 4)}`,
        cpfFor(91000000000, index),
        `8496${pad(index, 6)}`,
        `paciente.${cfg.prefix}.${pad(index, 4)}@mail.test`,
        status,
        pick(rng, modalidades),
        2 + Math.floor(rng() * 5),
        30 + Math.floor(rng() * 40),
        pick(rng, objetivos),
        `Paciente gerado por simulacao ${cfg.prefix}`,
        project?.id || null,
        project?.nome || null,
        aluno?.id || null,
        aluno?.name || null,
        professor?.id || null,
        professor?.name || null,
        athlete?.id || null,
        status === 'Ativo' ? 'aprovado' : 'pendente',
        dataCadastro,
        linkedAt
      ]
    );
    patients.push(row.rows[0]);
  }

  return patients;
};

const createEvaluations = async (client, cfg, patients, rng) => {
  const tipos = [
    'bioimpedancia',
    'perimetros',
    'dobras_cutaneas',
    'alimentar',
    'hidratacao'
  ];
  let inserted = 0;

  for (let index = 0; index < patients.length; index += 1) {
    const paciente = patients[index];
    const perPatient = paciente.status === 'Ativo' ? (index % 3 === 0 ? 3 : 2) : 1;
    for (let round = 0; round < perPatient; round += 1) {
      const tipo = tipos[(inserted + round) % tipos.length];
      const done = round < perPatient - 1 || paciente.status === 'Ativo';
      const completude = done ? 75 + Math.floor(rng() * 25) : 40 + Math.floor(rng() * 25);
      const totalDiario = 1400 + Math.floor(rng() * 1200);
      const avaliacaoDate = fmtDate(randomDateMinusDays(rng, 90));
      await client.query(
        `INSERT INTO avaliacoes (
          tipo, paciente_id, projeto_id, projeto_nome, aluno_id, status, data_avaliacao,
          dados, resultados, meta, auto_save, total_diario, classificacao, classificacao_label, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          $8::jsonb, $9::jsonb, $10::jsonb, false, $11, $12, $13, NOW(), NOW()
        )`,
        [
          tipo,
          paciente.id,
          paciente.projeto_id || null,
          paciente.projeto_nome || null,
          paciente.aluno_responsavel_id || null,
          done ? 'concluida' : 'rascunho',
          avaliacaoDate,
          JSON.stringify({ coleta: 'simulada', versao: 1 }),
          JSON.stringify({ interpretacao: done ? 'resultado registrado' : 'pendente de preenchimento' }),
          JSON.stringify({ completude }),
          totalDiario,
          completude >= 85 ? 'boa' : 'regular',
          completude >= 85 ? 'Boa aderencia' : 'Atenção'
        ]
      );
      inserted += 1;
    }
  }

  return inserted;
};

const createAppointments = async (client, patients, rng) => {
  let inserted = 0;
  const timePool = ['08:00', '09:30', '11:00', '14:00', '15:30', '17:00'];
  const doneStatus = ['realizada', 'falta', 'remarcada'];

  for (let index = 0; index < patients.length; index += 1) {
    const paciente = patients[index];
    const count = paciente.status === 'Ativo' ? 2 : 1;
    for (let slot = 0; slot < count; slot += 1) {
      const isFuture = slot === 0;
      const dateObj = isFuture ? randomDatePlusDays(rng, 21) : randomDateMinusDays(rng, 30);
      const status = isFuture ? 'agendada' : pick(rng, doneStatus);
      const date = fmtDate(dateObj);
      const time = pick(rng, timePool) || '10:00';
      const scheduledAt = new Date(`${date}T${time}:00`);
      const remarcadaEm = status === 'remarcada' ? randomDateMinusDays(rng, 20) : null;
      const remarcadaPara = status === 'remarcada' ? dateObj : null;
      const completedAt = status === 'realizada' ? dateObj : null;
      const faltouEm = status === 'falta' ? dateObj : null;

      await client.query(
        `INSERT INTO agendamentos (
          paciente_id, paciente_nome, aluno_id, aluno_nome,
          date, time, appointment_type, scheduled_at, evaluations, status,
          remarcada_em, remarcada_para, completed_at, faltou_em, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4,
          $5, $6, $7, $8, $9, $10,
          $11, $12, $13, $14, NOW(), NOW()
        )`,
        [
          paciente.id,
          paciente.nome,
          paciente.aluno_responsavel_id || null,
          paciente.aluno_responsavel_nome || null,
          date,
          time,
          slot === 0 ? 'primeira_consulta' : 'retorno',
          scheduledAt,
          ['bioimpedancia', 'perimetros'],
          status,
          remarcadaEm,
          remarcadaPara,
          completedAt,
          faltouEm
        ]
      );
      inserted += 1;
    }
  }

  return inserted;
};

const createNotifications = async (client, users, rng) => {
  let inserted = 0;
  const tipos = ['info', 'sucesso', 'aviso'];
  for (let index = 0; index < users.all.length; index += 1) {
    const user = users.all[index];
    for (let round = 1; round <= 2; round += 1) {
      await client.query(
        `INSERT INTO notificacoes (user_id, titulo, mensagem, tipo, read_at, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
        [
          user.id,
          `Notificacao ${round} - ${user.role}`,
          `Mensagem simulada para ${user.name}`,
          pick(rng, tipos),
          round === 1 ? randomDateMinusDays(rng, 7) : null
        ]
      );
      inserted += 1;
    }
  }
  return inserted;
};

const writeReport = (reportPath, payload) => {
  const fullPath = path.resolve(reportPath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
};

const main = async () => {
  const rng = createRng(`${config.prefix}:${config.users}:${config.patients}`);
  const client = new Client(buildDbConfig());
  const startedAt = now().toISOString();
  await client.connect();

  try {
    await client.query('BEGIN');
    const cleanup = await cleanupDataset(client, config.prefix);
    const projects = await createProjects(client, config);
    const passwordHash = await bcrypt.hash(config.password, 10);
    const users = await createUsers(client, config, projects, passwordHash);
    const patients = await createPatients(client, config, projects, users, rng);
    const avaliacoes = await createEvaluations(client, config, patients, rng);
    const agendamentos = await createAppointments(client, patients, rng);
    const notificacoes = await createNotifications(client, users, rng);
    await client.query('COMMIT');

    const roleCount = users.all.reduce((acc, item) => {
      const role = String(item.role || '');
      acc[role] = (acc[role] || 0) + 1;
      return acc;
    }, {});

    const summary = {
      dataset: {
        prefix: config.prefix,
        startedAt,
        finishedAt: now().toISOString()
      },
      cleanup,
      created: {
        users: users.all.length,
        projects: projects.length,
        patients: patients.length,
        avaliacoes,
        agendamentos,
        notificacoes
      },
      roles: roleCount,
      auth: {
        passwordForAllSeededUsers: config.password,
        emailPattern: `${config.prefix}.u0001@laines.ufrn.br ... ${config.prefix}.u${pad(config.users, 4)}@laines.ufrn.br`
      }
    };

    writeReport(config.reportPath, summary);
    console.log(`[seed-load-usage] dataset prefix: ${config.prefix}`);
    console.log(`[seed-load-usage] users=${summary.created.users}, patients=${summary.created.patients}, avaliacoes=${summary.created.avaliacoes}, agendamentos=${summary.created.agendamentos}`);
    console.log(`[seed-load-usage] report: ${config.reportPath}`);
    console.log(`[seed-load-usage] credentials: email pattern + senha "${config.password}"`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
};

main().catch((error) => {
  console.error(`[seed-load-usage] failed: ${error.message}`);
  process.exitCode = 1;
});
