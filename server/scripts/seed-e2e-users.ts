import 'dotenv/config';
import * as bcrypt from 'bcryptjs';
import { readFileSync } from 'fs';
import { resolve } from 'path';

if (process.env.NODE_ENV === 'production') {
  console.error('BLOQUEADO: seed-e2e-users não pode rodar em produção.');
  process.exit(1);
}

let activeDataSource: import('typeorm').DataSource | null = null;

type DatasetSeedUser = {
  key: string;
  role: string;
  name: string;
  defaultEmail: string;
  defaultPassword: string;
  ciEmailEnv?: string;
  ciPasswordEnv?: string;
};

const normalizeEmail = (email: string) => email.trim().toLowerCase();

const loadDataset = (): DatasetSeedUser[] => {
  const datasetPath = resolve(__dirname, 'seed-datasets', 'e2e-users.json');
  const raw = readFileSync(datasetPath, 'utf8');
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed) ? parsed : [];
};

const resolveLocalSeedUsers = () => {
  const allowedKeys = new Set(['admin', 'professor', 'aluno', 'tecnico', 'atleta']);
  return loadDataset()
    .filter((item) => allowedKeys.has(String(item.key || '').trim().toLowerCase()))
    .map((item) => ({
      email: normalizeEmail(item.defaultEmail),
      password: String(item.defaultPassword || ''),
      role: String(item.role || '').trim().toLowerCase(),
      name: String(item.name || '').trim() || `Usuario ${item.role || 'e2e'}`
    }));
};

async function main() {
  const { default: dataSource } = await import('../src/database/typeorm.config');
  const { User } = await import('../src/users/user.entity');
  activeDataSource = dataSource;

  if (!dataSource.isInitialized) {
    await dataSource.initialize();
  }

  const usersRepository = dataSource.getRepository(User);
  const passwordUpdatedAt = new Date();
  const users = resolveLocalSeedUsers();

  const payload = await Promise.all(
    users.map(async (user, index) => ({
      email: normalizeEmail(user.email),
      passwordHash: await bcrypt.hash(user.password, 10),
      role: user.role,
      name: user.name,
      cpf: String(90000000000 + index).slice(0, 11),
      telefone: `8499000${String(index + 1).padStart(3, '0')}`,
      dataNascimento: '1990-01-01',
      status: 'ativo',
      mustChangePassword: false,
      tempPassword: null,
      passwordUpdatedAt
    }))
  );

  await usersRepository.upsert(payload, ['email']);

  console.log(`[seed-e2e-users] upserted ${payload.length} users.`);
  payload.forEach((user) => {
    console.log(`[seed-e2e-users] ${user.role}: ${user.email}`);
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
