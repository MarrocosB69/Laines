/* @work-item-id WI-004
 * UPD-20/21: real application migrations, HTTP/socket journeys and restoration.
 * Only a new synthetic PostgreSQL cluster and files under tmp are used.
 * Existing services, .env files, dependencies and build directories are untouched.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const { createHash } = require('node:crypto');
const { spawn, spawnSync } = require('node:child_process');

const root = fs.realpathSync(path.resolve(__dirname, '..'));
const pgBin = 'C:/Program Files/PostgreSQL/18/bin';
const host = '127.0.0.1';
const pgPort = 55439;
const apiPort = 44100;
const database = 'laines_onda0';
const preservedDatabase = 'laines_onda0_before_restore';
const user = 'laines_test';
const password = 'synthetic-only';
const apiUrl = `http://${host}:${apiPort}`;
const checks = [];
const commands = [];
let runDir;
let workingDir;
let cluster;
let uploads;
let buildDir;
let manifest;
let startupAttempted = false;
let api;
let apiExit;
let apiError;
const report = {
  startedAt: new Date().toISOString(),
  status: 'running',
  host, pgPort, apiPort, database,
  scriptSha256: hash(fs.readFileSync(__filename)),
  limits: [
    'Synthetic local API/SQL/socket journeys only; no browser or frontend validation.',
    'Same application artifact before and after restore; no release-version rollback.',
    'No existing service, real .env, patient data, SMTP, MinIO, image processor, TLS, remote CI or deployment used.'
  ]
};

function hash(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function inside(parent, candidate) {
  const relative = path.relative(parent, candidate);
  assert.ok(relative && !relative.startsWith('..') && !path.isAbsolute(relative), 'Path must remain inside the dedicated parent');
  return candidate;
}

function artifact(name) {
  return inside(runDir, path.join(runDir, name));
}

function saveJson(name, value) {
  fs.writeFileSync(artifact(name), JSON.stringify(value, null, 2), { flag: 'wx' });
}

// Inherit only Windows runtime locations. In particular, do not inherit NODE_OPTIONS,
// PG*, service/credential paths, mail/model configuration or application settings.
function childEnv(extra = {}) {
  const result = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (/^(systemroot|windir|comspec|pathext)$/i.test(key)) result[key] = value;
  }
  return {
    ...result,
    PATH: `${path.dirname(process.execPath)};${pgBin};${process.env.SystemRoot || 'C:/Windows'}/System32`,
    TEMP: runDir, TMP: runDir,
    PGCLIENTENCODING: 'UTF8', PGPASSWORD: password, PGTZ: 'UTC',
    NODE_PATH: path.join(root, 'server/node_modules'),
    NODE_ENV: 'test', TZ: 'UTC',
    DOTENV_CONFIG_PATH: artifact('absent-synthetic.env'),
    DB_HOST: host, DB_PORT: String(pgPort), DB_NAME: database,
    DB_USER: user, DB_PASSWORD: password,
    DB_SYNC: 'false', DB_MIGRATIONS_RUN: 'false', DB_LOGGING: 'false',
    PORT: String(apiPort), HOST: host, BIND_HOST: host,
    JWT_SECRET: 'synthetic-local-access-secret-never-for-production',
    JWT_REFRESH_SECRET: 'synthetic-local-refresh-secret-never-for-production',
    AUTH_NEW_FLOW_ENABLED: 'true', AUTH_ALLOW_REGISTER: 'false',
    AUTH_ALLOW_PUBLIC_ACCESS_REQUEST: 'false', AUTH_REFRESH_COOKIE_SECURE: 'false',
    MAIL_ENABLED: 'false', MAIL_SMTP_HOST: '', MAIL_SMTP_USER: '', MAIL_SMTP_PASS: '',
    UPLOAD_DIR: uploads, UPLOAD_PUBLIC_ACCESS: 'false', UPLOAD_BASE_URL: apiUrl,
    API_BASE_URL: apiUrl, APP_URL: 'http://127.0.0.1:4173', CORS_ORIGIN: 'http://127.0.0.1:4173',
    IMAGE_STORAGE_DRIVER: 'local', IMAGE_PROCESSOR_URL: '', IMAGE_PROCESSOR_TOKEN: '',
    OBSERVABILITY_WEBHOOK_URL: '', OBSERVABILITY_PERSISTENCE_ENABLED: 'false',
    ONDA0_API_URL: apiUrl, ONDA0_MANIFEST: manifest,
    ...extra
  };
}

function command(executable, args, { label = path.basename(executable), timeout = 30000, env, daemon = false } = {}) {
  const descriptors = [];
  const outputFiles = daemon ? [artifact('pg-start.stdout.log'), artifact('pg-start.stderr.log')] : null;
  let result;
  try {
    if (outputFiles) for (const file of outputFiles) descriptors.push(fs.openSync(file, 'wx'));
    result = spawnSync(executable, args, {
      cwd: workingDir, env: childEnv(env), shell: false, windowsHide: true,
      encoding: 'utf8', timeout, maxBuffer: 32 * 1024 * 1024,
      // A PostgreSQL daemon inheriting pipes keeps spawnSync waiting after pg_ctl exits.
      ...(outputFiles ? { stdio: ['ignore', ...descriptors] } : {})
    });
  } finally {
    for (const descriptor of descriptors) fs.closeSync(descriptor);
  }
  if (outputFiles) {
    result.stdout = fs.readFileSync(outputFiles[0], 'utf8');
    result.stderr = fs.readFileSync(outputFiles[1], 'utf8');
  }
  commands.push({ command: label, args, status: result.status, stdout: result.stdout, stderr: result.stderr, error: result.error?.message });
  if (label.startsWith('journey-')) {
    fs.writeFileSync(artifact(`${label}.log`), `${result.stdout || ''}${result.stderr || ''}`, { flag: 'wx' });
  }
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${label} failed (${result.status}): ${result.stderr || result.stdout}`);
  return result.stdout;
}

function pg(name, args, options) {
  return command(path.join(pgBin, `${name}.exe`), args, { ...options, label: name });
}

function sql(db, statement) {
  return pg('psql', ['-X', '--no-password', '-h', host, '-p', String(pgPort), '-U', user,
    '-d', db, '-v', 'ON_ERROR_STOP=1', '-A', '-t', '-q', '-c', statement]);
}

function json(db, statement) {
  return JSON.parse(sql(db, statement).trim());
}

function identifier(name) {
  return `"${name.replace(/"/g, '""')}"`;
}

function passed(name) {
  checks.push(name);
  process.stdout.write(`PASS ${name}\n`);
}

async function requireFreePort(port) {
  await new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', () => reject(new Error(`Refusing occupied or unavailable loopback port ${port}; no existing service will be used.`)));
    probe.listen({ host, port, exclusive: true }, () => probe.close(resolve));
  });
}

function verifyCluster() {
  const server = json('postgres', `SELECT json_build_object(
    'data_directory', current_setting('data_directory'), 'port', current_setting('port'),
    'listen_addresses', current_setting('listen_addresses'), 'server_address', host(inet_server_addr()),
    'current_user', current_user, 'version', version())`);
  inside(runDir, fs.realpathSync(cluster));
  assert.equal(fs.realpathSync(server.data_directory).toLowerCase(), fs.realpathSync(cluster).toLowerCase());
  assert.equal(server.port, String(pgPort));
  assert.equal(server.listen_addresses, host);
  assert.equal(server.server_address, host);
  assert.equal(server.current_user, user);
  return server;
}

function files(directory) {
  const rows = [];
  inside(runDir, fs.realpathSync(directory));
  function walk(current) {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const target = inside(directory, path.join(current, entry.name));
      assert.ok(!entry.isSymbolicLink(), 'Synthetic uploads cannot contain symlinks');
      inside(directory, fs.realpathSync(target));
      if (entry.isDirectory()) walk(target);
      else {
        assert.ok(entry.isFile(), 'Only regular synthetic files are accepted');
        const bytes = fs.readFileSync(target);
        rows.push({ path: path.relative(directory, target).split(path.sep).join('/'), bytes: bytes.length, sha256: hash(bytes) });
      }
    }
  }
  walk(directory);
  return rows.sort((a, b) => a.path.localeCompare(b.path));
}

function snapshot() {
  const tables = json(database, `SELECT COALESCE(json_agg(c.relname ORDER BY c.relname), '[]'::json)
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind IN ('r','p')`);
  assert.ok(tables.includes('migrations'), 'Real application migration table must exist');
  const result = { tables: {} };
  for (const table of tables) {
    result.tables[table] = json(database, `SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text COLLATE "C"), '[]'::jsonb)
      FROM public.${identifier(table)} t`);
  }
  const schemaRows = statement => json(database, `SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text COLLATE "C"), '[]'::jsonb) FROM (${statement}) t`);
  result.columns = schemaRows(`SELECT c.relname AS table_name, a.attnum, a.attname,
    format_type(a.atttypid,a.atttypmod) AS type, a.attnotnull, a.attidentity, a.attgenerated,
    pg_get_expr(d.adbin,d.adrelid) AS default_expression
    FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
    WHERE n.nspname='public' AND c.relkind IN ('r','p') AND a.attnum>0 AND NOT a.attisdropped`);
  result.constraints = schemaRows(`SELECT c.relname AS table_name, k.conname, k.contype,
    k.convalidated, k.condeferrable, k.condeferred, pg_get_constraintdef(k.oid) AS definition
    FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public'`);
  result.indexes = schemaRows(`SELECT tablename, indexname, indexdef FROM pg_indexes WHERE schemaname='public'`);
  result.sequenceDefinitions = schemaRows(`SELECT c.relname, format_type(s.seqtypid,NULL) AS type,
    s.seqstart, s.seqincrement, s.seqmax, s.seqmin, s.seqcache, s.seqcycle
    FROM pg_sequence s JOIN pg_class c ON c.oid=s.seqrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public'`);
  result.sequences = {};
  for (const sequence of result.sequenceDefinitions) {
    result.sequences[sequence.relname] = json(database, `SELECT row_to_json(t) FROM (SELECT last_value, is_called FROM public.${identifier(sequence.relname)}) t`);
  }
  return result;
}

async function startApi(phase) {
  await requireFreePort(apiPort);
  assert.ok(!fs.existsSync(path.join(workingDir, '.env')) && !fs.existsSync(path.join(workingDir, 'server/.env')));
  const descriptors = [artifact(`api-${phase}.stdout.log`), artifact(`api-${phase}.stderr.log`)].map(file => fs.openSync(file, 'wx'));
  apiError = null;
  try {
    api = spawn(process.execPath, [path.join(buildDir, 'main.js')], {
      cwd: workingDir, env: childEnv(), shell: false, windowsHide: true, stdio: ['ignore', ...descriptors]
    });
    apiExit = new Promise(resolve => {
      api.once('error', error => { apiError = error; resolve(); });
      api.once('exit', (code, signal) => { commands.push({ command: `api-${phase}`, pid: api.pid, code, signal }); resolve(); });
    });
  } finally {
    for (const descriptor of descriptors) fs.closeSync(descriptor);
  }
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    if (apiError) throw apiError;
    assert.equal(api.exitCode, null, `Dedicated API exited; inspect api-${phase} logs`);
    assert.equal(api.signalCode, null, `Dedicated API was signalled; inspect api-${phase} logs`);
    try {
      const response = await fetch(`${apiUrl}/ready`, { signal: AbortSignal.timeout(1500) });
      if (response.status === 200) {
        await response.arrayBuffer();
        return;
      }
      await response.arrayBuffer();
    } catch { /* Wait for this newly spawned API only, until the bounded deadline. */ }
    await new Promise(resolve => setTimeout(resolve, 150));
  }
  throw new Error(`Dedicated API did not become ready; inspect api-${phase} logs`);
}

async function stopApi() {
  if (!api) return;
  if (api.exitCode === null && api.signalCode === null && !apiError) {
    assert.ok(api.pid, 'Only the spawned API process can be stopped');
    assert.ok(api.kill('SIGTERM'), 'Failed to stop the dedicated API');
    let timeout;
    try {
      await Promise.race([apiExit, new Promise((_, reject) => {
        timeout = setTimeout(() => reject(new Error('Dedicated API did not stop within 15 seconds')), 15000);
      })]);
    } finally { clearTimeout(timeout); }
  }
  api = null;
}

function journey(phase) {
  const stdout = command(process.execPath, [path.join(root, 'scripts/test-onda0-postgres.cjs')], {
    label: `journey-${phase}`, env: { ONDA0_PHASE: phase }, timeout: 180000
  });
  process.stdout.write(stdout);
  assert.ok(fs.existsSync(manifest), 'Seed must preserve the synthetic journey manifest');
}

async function main() {
  assert.equal(process.platform, 'win32', 'Requires existing Windows PostgreSQL 18 binaries');
  assert.equal(process.argv.length, 2, 'No target, credentials or connection arguments are accepted');
  await requireFreePort(pgPort);
  await requireFreePort(apiPort);
  const temporary = path.join(root, 'tmp');
  fs.mkdirSync(temporary, { recursive: true });
  inside(root, fs.realpathSync(temporary));
  runDir = fs.mkdtempSync(path.join(temporary, 'onda3-release-local-'));
  inside(fs.realpathSync(temporary), fs.realpathSync(runDir));
  report.artifacts = path.relative(root, runDir).split(path.sep).join('/');
  workingDir = artifact('working');
  fs.mkdirSync(workingDir);
  buildDir = artifact('build');
  fs.mkdirSync(buildDir);
  fs.writeFileSync(path.join(buildDir, 'package.json'), '{"type":"commonjs"}\n', { flag: 'wx' });
  uploads = artifact('uploads');
  fs.mkdirSync(uploads);
  manifest = artifact('journey-manifest.json');
  cluster = artifact('cluster');
  saveJson('synthetic-only.json', { purpose: 'UPD-20/21 isolated application restoration', cluster, host, pgPort, apiPort, database });
  for (const name of ['initdb', 'pg_ctl', 'psql', 'pg_dump', 'pg_restore']) {
    assert.ok(fs.existsSync(path.join(pgBin, `${name}.exe`)), `Missing installed binary ${name}`);
  }
  report.postgresVersion = pg('psql', ['--version']).trim();
  assert.match(report.postgresVersion, /PostgreSQL\) 18\./);
  command(process.execPath, [path.join(root, 'server/node_modules/typescript/bin/tsc'),
    '--project', path.join(root, 'server/tsconfig.build.json'), '--outDir', buildDir,
    '--incremental', 'false', '--declaration', 'false', '--sourceMap', 'false'], { label: 'backend-build', timeout: 120000 });
  assert.ok(fs.existsSync(path.join(buildDir, 'main.js')));
  passed('backend built into isolated temporary artifact using installed compiler');

  fs.writeFileSync(artifact('synthetic-password.txt'), `${password}\n`, { flag: 'wx' });
  pg('initdb', ['-D', cluster, '-U', user, '--auth-local=scram-sha-256', '--auth-host=scram-sha-256',
    '--pwfile', artifact('synthetic-password.txt'), '--encoding=UTF8', '--no-locale']);
  await requireFreePort(pgPort);
  startupAttempted = true;
  pg('pg_ctl', ['-D', cluster, '-l', artifact('postgres.log'), '-o', `-h ${host} -p ${pgPort}`, '-w', '-t', '15', 'start'], { daemon: true });
  report.server = verifyCluster();
  passed('new PostgreSQL cluster path, loopback, port and synthetic user verified before writes');
  sql('postgres', `CREATE DATABASE ${database}`);
  command(process.execPath, [path.join(root, 'server/node_modules/typeorm/cli.js'),
    '-d', path.join(buildDir, 'database/typeorm.config.js'), 'migration:run'], { label: 'application-migrations', timeout: 120000 });
  report.migrations = json(database, 'SELECT json_agg(t ORDER BY id) FROM migrations t');
  assert.ok(report.migrations?.length > 0);
  passed('real application migrations applied with synchronization and automatic migration disabled');

  await startApi('seed');
  journey('seed');
  await stopApi();
  passed('synthetic HTTP/socket journeys and negative access checks passed before backup');
  verifyCluster();
  assert.equal(sql('postgres', `SELECT count(*) FROM pg_stat_activity WHERE datname='${database}'`).trim(), '0');
  const before = snapshot();
  const beforeFiles = files(uploads);
  assert.ok(beforeFiles.length > 0, 'Journey must create a real synthetic attachment');
  saveJson('database-before.json', before);
  saveJson('files-before.json', beforeFiles);
  const dump = artifact('application.dump');
  pg('pg_dump', ['--no-password', '-h', host, '-p', String(pgPort), '-U', user, '-d', database,
    '--format=custom', '--no-owner', '--no-acl', '--file', dump]);
  report.dumpSha256 = hash(fs.readFileSync(dump));
  const backupFiles = artifact('uploads-backup');
  fs.cpSync(uploads, backupFiles, { recursive: true, force: false, errorOnExist: true });
  assert.deepEqual(files(backupFiles), beforeFiles);
  passed('application database and matching synthetic uploads backed up with API stopped');

  verifyCluster();
  sql('postgres', `ALTER DATABASE ${database} RENAME TO ${preservedDatabase}`);
  sql('postgres', `CREATE DATABASE ${database}`);
  pg('pg_restore', ['--no-password', '-h', host, '-p', String(pgPort), '-U', user, '-d', database,
    '--exit-on-error', '--no-owner', '--no-acl', dump]);
  const originalUploads = uploads;
  const restoredUploads = artifact('uploads-restored');
  inside(fs.realpathSync(runDir), fs.realpathSync(originalUploads));
  inside(fs.realpathSync(runDir), path.resolve(restoredUploads));
  assert.ok(!fs.existsSync(restoredUploads));
  fs.cpSync(backupFiles, restoredUploads, { recursive: true, force: false, errorOnExist: true });
  uploads = restoredUploads;
  const restored = snapshot();
  saveJson('database-restored.json', restored);
  assert.deepEqual(restored, before, 'Rows, migration versions, columns, constraints, indexes and sequence states must match before API restart');
  assert.deepEqual(files(uploads), beforeFiles, 'Restored file bytes, paths and hashes must match');
  assert.deepEqual(files(originalUploads), beforeFiles, 'Original synthetic uploads must remain unchanged');
  assert.equal(hash(fs.readFileSync(dump)), report.dumpSha256);
  report.restoredTables = Object.keys(restored.tables).length;
  report.restoredFiles = beforeFiles.length;
  passed('empty database restored; all public rows, migrations, schema, constraints, indexes, sequences and upload hashes match before API restart');

  await startApi('restored');
  journey('verify-restored');
  await stopApi();
  passed('restored patient, evaluation, plan, attachment and access rules verified through running API');
  report.status = 'passed';
}

main().catch(error => {
  report.status = 'failed';
  report.error = error.message;
  process.exitCode = 1;
  process.stderr.write(`FAIL ${error.message}\n`);
}).finally(async () => {
  try { await stopApi(); } catch (error) {
    report.status = 'failed'; report.apiShutdownError = error.message; process.exitCode = 1;
    process.stderr.write(`FAIL stopping dedicated API: ${error.message}\n`);
  }
  if (startupAttempted) {
    try {
      inside(runDir, fs.realpathSync(cluster));
      if (fs.existsSync(path.join(cluster, 'postmaster.pid'))) {
        pg('pg_ctl', ['-D', cluster, '-m', 'fast', '-w', '-t', '15', 'stop']);
      }
      report.clusterStopped = true;
      passed('only this run cluster and API stopped; original synthetic database, uploads and all evidence preserved');
    } catch (error) {
      report.clusterStopped = false; report.status = 'failed'; report.shutdownError = error.message; process.exitCode = 1;
      process.stderr.write(`FAIL stopping dedicated cluster: ${error.message}\n`);
    }
  }
  report.checks = checks;
  report.finishedAt = new Date().toISOString();
  if (runDir) {
    saveJson('commands.json', commands);
    saveJson('report.json', report);
    process.stdout.write(`Report: ${report.artifacts}/report.json\n`);
  }
  process.stdout.write(`${checks.length} launcher checks; status=${report.status}. Remote homologation and release-version rollback remain pending.\n`);
});
