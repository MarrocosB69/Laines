import 'dotenv/config';
import * as bcrypt from 'bcryptjs';
import { ADMIN_ROLES } from '../src/common/domain/access.constants';

let activeDataSource: import('typeorm').DataSource | null = null;

const BOOTSTRAP_LOCK_KEY = 'laines.bootstrap-admin';
const MIN_PASSWORD_LENGTH = 12;

const normalizeEmail = (value?: string) => String(value || '').trim().toLowerCase();

const normalizeName = (value?: string) => {
  const normalized = String(value || '').trim();
  return normalized || 'Administrador LAINES';
};

const assertStrongEnoughInitialPassword = (password: string) => {
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`BOOTSTRAP_ADMIN_PASSWORD deve ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`);
  }
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) {
    throw new Error('BOOTSTRAP_ADMIN_PASSWORD deve conter letras maiusculas, minusculas e numeros.');
  }
};

const resolveBootstrapPayload = () => {
  const email = normalizeEmail(process.env.BOOTSTRAP_ADMIN_EMAIL);
  const password = String(process.env.BOOTSTRAP_ADMIN_PASSWORD || '');
  const name = normalizeName(process.env.BOOTSTRAP_ADMIN_NAME);

  if (!email || !email.includes('@')) {
    throw new Error('BOOTSTRAP_ADMIN_EMAIL e obrigatorio e deve ser um e-mail valido.');
  }
  if (!password) {
    throw new Error('BOOTSTRAP_ADMIN_PASSWORD e obrigatorio.');
  }
  assertStrongEnoughInitialPassword(password);

  return { email, password, name };
};

async function main() {
  const payload = resolveBootstrapPayload();
  const { default: dataSource } = await import('../src/database/typeorm.config');
  const { User } = await import('../src/users/user.entity');
  activeDataSource = dataSource;

  if (!dataSource.isInitialized) {
    await dataSource.initialize();
  }

  await dataSource.transaction(async (manager) => {
    await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [BOOTSTRAP_LOCK_KEY]);

    const usersRepository = manager.getRepository(User);
    const activeAdminCount = await usersRepository
      .createQueryBuilder('user')
      .withDeleted()
      .where('LOWER("user"."role") IN (:...roles)', { roles: ADMIN_ROLES })
      .andWhere('LOWER("user"."status") = :status', { status: 'ativo' })
      .andWhere('"user"."deleted_at" IS NULL')
      .getCount();

    if (activeAdminCount > 0) {
      throw new Error('BLOQUEADO: ja existe usuario administrador ativo. Bootstrap nao foi executado.');
    }

    const existingUser = await usersRepository
      .createQueryBuilder('user')
      .withDeleted()
      .where('LOWER("user"."email") = :email', { email: payload.email })
      .getOne();

    if (existingUser) {
      throw new Error('BLOQUEADO: ja existe usuario com BOOTSTRAP_ADMIN_EMAIL.');
    }

    const passwordHash = await bcrypt.hash(payload.password, 10);
    const user = usersRepository.create({
      email: payload.email,
      passwordHash,
      name: payload.name,
      role: 'admin',
      status: 'ativo',
      mustChangePassword: true,
      tempPassword: null,
      passwordUpdatedAt: new Date(),
      sessionVersion: 1
    });
    const saved = await usersRepository.save(user);

    console.log(`[bootstrap-admin] admin criado: ${saved.email}`);
    console.log('[bootstrap-admin] troca de senha obrigatoria no primeiro acesso.');
  });
}

main()
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[bootstrap-admin] failed: ${message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (activeDataSource?.isInitialized) {
      await activeDataSource.destroy();
    }
  });
