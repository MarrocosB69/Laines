import 'dotenv/config';
import * as bcrypt from 'bcryptjs';
import { readFileSync } from 'fs';
import { resolve } from 'path';

if (process.env.NODE_ENV === 'production') {
  console.error('BLOQUEADO: seed-e2e-users não pode rodar em produção.');
  process.exit(1);
}

let activeDataSource: import('typeorm').DataSource | null = null;
const E2E_PROJECT_NAME = 'Projeto E2E LAINES';

type DatasetSeedUser = {
  key: string;
  role: string;
  name: string;
  defaultEmail: string;
  defaultPassword: string;
  ciEmailEnv?: string;
  ciPasswordEnv?: string;
  diretoria?: string | null;
  permissions?: string[];
  curso?: string;
  matricula?: string;
  periodo?: string;
};

const normalizeEmail = (email: string) => email.trim().toLowerCase();

const loadDataset = (): DatasetSeedUser[] => {
  const datasetPath = resolve(__dirname, 'seed-datasets', 'e2e-users.json');
  const raw = readFileSync(datasetPath, 'utf8');
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed) ? parsed : [];
};

const resolveLocalSeedUsers = () => {
  return loadDataset()
    .map((item) => {
      const emailEnv = String(item.ciEmailEnv || '').trim();
      const passwordEnv = String(item.ciPasswordEnv || '').trim();
      const email = emailEnv && process.env[emailEnv] ? process.env[emailEnv] : item.defaultEmail;
      const password = passwordEnv && process.env[passwordEnv] ? process.env[passwordEnv] : item.defaultPassword;
      return {
        email: normalizeEmail(String(email || '')),
        password: String(password || ''),
        role: String(item.role || '').trim().toLowerCase(),
        name: String(item.name || '').trim() || `Usuario ${item.role || 'e2e'}`,
        diretoria: item.diretoria ?? null,
        permissions: Array.isArray(item.permissions) ? item.permissions : [],
        curso: String(item.curso || '').trim() || undefined,
        matricula: String(item.matricula || '').trim() || undefined,
        periodo: String(item.periodo || '').trim() || undefined,
        key: String(item.key || '').trim()
      };
    });
};

async function main() {
  const { default: dataSource } = await import('../src/database/typeorm.config');
  const { User } = await import('../src/users/user.entity');
  const { Projeto } = await import('../src/projetos/projeto.entity');
  activeDataSource = dataSource;

  if (!dataSource.isInitialized) {
    await dataSource.initialize();
  }

  const usersRepository = dataSource.getRepository(User);
  const projetosRepository = dataSource.getRepository(Projeto);
  const passwordUpdatedAt = new Date();
  const users = resolveLocalSeedUsers();

  let project = await projetosRepository.findOne({ where: { nome: E2E_PROJECT_NAME } });
  if (!project) {
    project = projetosRepository.create({
      nome: E2E_PROJECT_NAME,
      area: 'nutricao',
      status: 'em_andamento',
      descricao: 'Projeto base para perfis E2E.',
      equipe: [],
      alunosIds: [],
      alunosNomes: []
    });
  } else {
    project.status = 'em_andamento';
    project.descricao = 'Projeto base para perfis E2E.';
  }
  project = await projetosRepository.save(project);

  const payload = await Promise.all(
    users.map(async (user, index) => ({
      email: normalizeEmail(user.email),
      passwordHash: await bcrypt.hash(user.password, 10),
      role: user.role,
      name: user.name,
      cpf: String(90000000000 + index).slice(0, 11),
      telefone: `8499000${String(index + 1).padStart(3, '0')}`,
      dataNascimento: '1990-01-01',
      diretoria: user.diretoria,
      permissions: user.permissions,
      curso: user.curso,
      matricula: user.matricula,
      periodo: user.periodo,
      coordAtendimento: user.role === 'coord_atendimento',
      nivelAcesso: 'e2e',
      status: 'ativo',
      mustChangePassword: false,
      tempPassword: null,
      passwordUpdatedAt,
      deletedAt: null
    }))
  );

  await usersRepository.upsert(payload, ['email']);

  const professorSeed = users.find((user) => user.key === 'professor');
  const professor = professorSeed
    ? await usersRepository.findOne({ where: { email: professorSeed.email } })
    : null;
  const studentEmails = users
    .filter((user) => ['aluno', 'presidente', 'vice'].includes(user.role))
    .map((user) => user.email);

  if (professor && studentEmails.length > 0) {
    const students = await usersRepository.createQueryBuilder('user')
      .where('user.email IN (:...studentEmails)', { studentEmails })
      .getMany();

    for (const student of students) {
      student.supervisorId = professor.id;
      student.supervisorNome = professor.name;
      student.projetoId = project.id;
      student.projetoNome = project.nome;
    }
    await usersRepository.save(students);

    project.coordenador = professor.name;
    project.coordenadorId = professor.id;
    project.equipe = [professor.name];
    project.alunosIds = students.map((student) => student.id);
    project.alunosNomes = students.map((student) => student.name);
    await projetosRepository.save(project);
  }

  await dataSource.query(
    'DELETE FROM login_attempts WHERE email = ANY($1::text[])',
    [payload.map((user) => user.email)]
  );

  console.log(`[seed-e2e-users] upserted ${payload.length} users.`);
  users.forEach((user) => {
    const scope = user.diretoria ? `${user.role}/${user.diretoria}` : user.role;
    console.log(`[seed-e2e-users] ${user.key} (${scope}): ${user.email}`);
  });
}

main()
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[seed-e2e-users] failed: ${message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (activeDataSource?.isInitialized) {
      await activeDataSource.destroy();
    }
  });
