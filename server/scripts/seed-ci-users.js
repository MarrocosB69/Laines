const fs = require('fs');
const path = require('path');

require('dotenv').config({
  path: process.env.DOTENV_CONFIG_PATH || path.resolve(__dirname, '..', '.env')
});

if (process.env.NODE_ENV === 'production') {
  console.error('BLOQUEADO: seed-ci-users não pode rodar em produção.');
  process.exit(1);
}

const { Client } = require('pg');
const bcrypt = require('bcryptjs');

const buildDbConfig = () => ({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 5432),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'postgres'
});

const loadDataset = () => {
  const datasetPath = path.resolve(__dirname, 'seed-datasets', 'e2e-users.json');
  const raw = fs.readFileSync(datasetPath, 'utf8');
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed) ? parsed : [];
};

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();

const resolveCiUsers = () => (
  loadDataset().map((entry) => {
    const role = String(entry.role || '').trim().toLowerCase();
    const name = String(entry.name || '').trim() || `Usuario ${role || 'ci'}`;
    const envEmail = String(entry.ciEmailEnv || '').trim();
    const envPassword = String(entry.ciPasswordEnv || '').trim();
    const email = normalizeEmail(
      envEmail && process.env[envEmail]
        ? process.env[envEmail]
        : entry.defaultEmail
    );
    const password = String(
      envPassword && process.env[envPassword]
        ? process.env[envPassword]
        : entry.defaultPassword
    );

    return {
      email,
      password,
      role,
      name,
      // Diretorias derivam permissao deste campo; sem ele o perfil entra sem area.
      diretoria: String(entry.diretoria || '').trim() || null
    };
  })
);

const upsertUser = async (client, user) => {
  const passwordHash = await bcrypt.hash(user.password, 10);
  await client.query(
    `
    INSERT INTO users (
      email,
      password_hash,
      role,
      name,
      status,
      must_change_password,
      temp_password,
      password_updated_at,
      deleted_at,
      diretoria,
      created_at,
      updated_at
    )
    VALUES ($1, $2, $3, $4, 'ativo', false, NULL, NOW(), NULL, $5, NOW(), NOW())
    ON CONFLICT (email)
    DO UPDATE SET
      password_hash = EXCLUDED.password_hash,
      role = EXCLUDED.role,
      name = EXCLUDED.name,
      status = 'ativo',
      must_change_password = false,
      temp_password = NULL,
      password_updated_at = NOW(),
      deleted_at = NULL,
      diretoria = EXCLUDED.diretoria,
      updated_at = NOW()
    `,
    [user.email, passwordHash, user.role, user.name, user.diretoria]
  );
};

const main = async () => {
  const client = new Client(buildDbConfig());
  const users = resolveCiUsers();
  await client.connect();

  try {
    for (const user of users) {
      await upsertUser(client, user);
    }
    console.log(`[seed-ci-users] upserted ${users.length} users.`);
    users.forEach((user) => {
      console.log(`[seed-ci-users] ${user.role}: ${user.email}`);
    });
  } finally {
    await client.end();
  }
};

main().catch((error) => {
  console.error(`[seed-ci-users] failed: ${error.message}`);
  process.exitCode = 1;
});
