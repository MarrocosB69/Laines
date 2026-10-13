/* @work-item-id WI-004
 * UPD-21: real PostgreSQL dump/restore with synthetic SQL and files only.
 * Windows + existing PostgreSQL 18 binaries; no .env, application API or deploy.
 * All artifacts are preserved. Only the cluster created here is stopped.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const { createHash } = require('node:crypto');
const { spawnSync } = require('node:child_process');

const root = fs.realpathSync(path.resolve(__dirname, '..'));
const pgBin = 'C:/Program Files/PostgreSQL/18/bin';
const host = '127.0.0.1';
const port = 55449;
const user = 'laines_restore_test';
const sourceDb = 'laines_restore_source';
const restoredDb = 'laines_restore_recovered';
const checks = [];
const commands = [];
let runDir;
let cluster;
let startupAttempted = false;
const report = {
  startedAt: new Date().toISOString(),
  status: 'running',
  host,
  port,
  scriptSha256: hash(fs.readFileSync(__filename)),
  limits: [
    'Synthetic fixture schema; no application migrations or API journeys.',
    'No TLS, Docker, image model, MinIO, SMTP, remote CI or deployment validation.',
    'Restoration into new destinations; no application release rollback.',
    'No existing PostgreSQL service, credentials, .env or patient data used.'
  ]
};

function hash(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function inside(parent, candidate) {
  const relative = path.relative(parent, candidate);
  assert.ok(relative && !relative.startsWith('..') && !path.isAbsolute(relative), 'Path must stay inside the dedicated parent');
  return candidate;
}

// Do not inherit PG*, service files, credentials or application configuration.
function childEnv() {
  const result = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (/^(systemroot|windir|comspec|pathext)$/i.test(key)) result[key] = value;
  }
  result.PATH = `${pgBin};${process.env.SystemRoot || 'C:/Windows'}/System32`;
  result.TEMP = runDir || root;
  result.TMP = runDir || root;
  result.PGCLIENTENCODING = 'UTF8';
  return result;
}

function command(name, args, allowFailure = false) {
  // A daemon can inherit pg_ctl's pipes and keep spawnSync waiting after exit.
  const outputFiles = name === 'pg_ctl' && args.at(-1) === 'start'
    ? ['pg-ctl-start.stdout.log', 'pg-ctl-start.stderr.log'].map(file => inside(runDir, path.join(runDir, file)))
    : null;
  const descriptors = [];
  let result;
  try {
    if (outputFiles) {
      for (const file of outputFiles) descriptors.push(fs.openSync(file, 'wx'));
    }
    result = spawnSync(path.join(pgBin, `${name}.exe`), args, {
      cwd: runDir || root,
      env: childEnv(),
      shell: false,
      windowsHide: true,
      encoding: 'utf8',
      timeout: 30000,
      maxBuffer: 4 * 1024 * 1024,
      ...(outputFiles ? { stdio: ['ignore', ...descriptors] } : {})
    });
  } finally {
    for (const descriptor of descriptors) fs.closeSync(descriptor);
  }
  if (outputFiles) {
    result.stdout = fs.readFileSync(outputFiles[0], 'utf8');
    result.stderr = fs.readFileSync(outputFiles[1], 'utf8');
  }
  commands.push({ command: name, args, status: result.status, stdout: result.stdout, stderr: result.stderr, error: result.error?.message });
  if (result.error) throw result.error;
  if (!allowFailure && result.status !== 0) throw new Error(`${name} failed (${result.status}): ${result.stderr || result.stdout}`);
  return result;
}

function sql(database, statement, allowFailure = false) {
  return command('psql', ['-X', '--no-password', '-h', host, '-p', String(port), '-U', user,
    '-d', database, '-v', 'ON_ERROR_STOP=1', '-A', '-t', '-q', '-c', statement], allowFailure);
}

function json(database, statement) {
  return JSON.parse(sql(database, statement).stdout.trim());
}

function passed(name) {
  checks.push(name);
  process.stdout.write(`PASS ${name}\n`);
}

async function requireFreePort() {
  await new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', () => reject(new Error(`Refusing occupied or unavailable loopback port ${port}; no existing server will be used.`)));
    probe.listen({ host, port, exclusive: true }, () => probe.close(resolve));
  });
}

function files(directory) {
  const rows = [];
  function walk(current) {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const target = inside(directory, path.join(current, entry.name));
      assert.ok(!entry.isSymbolicLink(), 'Synthetic files cannot contain symlinks');
      if (entry.isDirectory()) walk(target);
      else {
        assert.ok(entry.isFile(), 'Only regular synthetic files are accepted');
        const bytes = fs.readFileSync(target);
        rows.push({ relative_path: path.relative(directory, target).split(path.sep).join('/'), bytes: bytes.length, sha256: hash(bytes) });
      }
    }
  }
  walk(directory);
  return rows.sort((a, b) => a.relative_path.localeCompare(b.relative_path));
}

function snapshot(database) {
  return json(database, `SELECT json_build_object(
    'schema_versions', (SELECT json_agg(t ORDER BY version) FROM fixture_schema_versions t),
    'owners', (SELECT json_agg(t ORDER BY id) FROM fixture_owners t),
    'objects', (SELECT json_agg(t ORDER BY id) FROM fixture_objects t))`);
}

async function main() {
  assert.equal(process.platform, 'win32', 'This drill requires the existing Windows PostgreSQL 18 installation');
  assert.equal(process.argv.length, 2, 'No target, credentials or connection arguments are accepted');
  for (const name of ['initdb', 'pg_ctl', 'psql', 'pg_dump', 'pg_restore']) {
    assert.ok(fs.existsSync(path.join(pgBin, `${name}.exe`)), `Missing existing PostgreSQL binary: ${name}`);
  }
  report.versions = {};
  for (const name of ['initdb', 'psql', 'pg_dump', 'pg_restore']) {
    report.versions[name] = command(name, ['--version']).stdout.trim();
    assert.match(report.versions[name], /PostgreSQL\) 18\./);
  }
  await requireFreePort();
  const temporary = path.join(root, 'tmp');
  fs.mkdirSync(temporary, { recursive: true });
  inside(root, fs.realpathSync(temporary));
  runDir = fs.mkdtempSync(path.join(temporary, 'onda3-backup-restore-'));
  inside(fs.realpathSync(temporary), fs.realpathSync(runDir));
  report.artifacts = path.relative(root, runDir).split(path.sep).join('/');
  cluster = inside(runDir, path.join(runDir, 'cluster'));
  fs.writeFileSync(path.join(runDir, 'synthetic-only.json'), JSON.stringify({ purpose: 'UPD-21 isolated restore drill', cluster, host, port }, null, 2), { flag: 'wx' });
  command('initdb', ['-D', cluster, '-U', user, '--auth-local=trust', '--auth-host=trust', '--encoding=UTF8', '--no-locale']);
  startupAttempted = true;
  command('pg_ctl', ['-D', cluster, '-l', path.join(runDir, 'postgres.log'), '-o', `-h ${host} -p ${port}`, '-w', '-t', '15', 'start']);
  const server = json('postgres', `SELECT json_build_object('data_directory', current_setting('data_directory'),
    'port', current_setting('port'), 'listen_addresses', current_setting('listen_addresses'),
    'server_address', host(inet_server_addr()), 'version', version())`);
  assert.equal(fs.realpathSync(server.data_directory).toLowerCase(), fs.realpathSync(cluster).toLowerCase());
  assert.equal(server.port, String(port));
  assert.equal(server.listen_addresses, host);
  assert.equal(server.server_address, host);
  report.server = server;
  passed('new cluster directory, port and loopback verified before writes');

  sql('postgres', `CREATE DATABASE ${sourceDb}`);
  sql('postgres', `CREATE DATABASE ${restoredDb}`);
  const sourceFiles = inside(runDir, path.join(runDir, 'source-files'));
  fs.mkdirSync(path.join(sourceFiles, 'nested'), { recursive: true });
  fs.writeFileSync(path.join(sourceFiles, 'synthetic.txt'), 'SYNTHETIC ONLY: restore fixture, no patient data.\n');
  fs.writeFileSync(path.join(sourceFiles, 'nested', 'bytes.bin'), Buffer.from(Array.from({ length: 256 }, (_, index) => index)));
  const beforeFiles = files(sourceFiles);
  const fixtureSql = `CREATE TABLE fixture_schema_versions (version text PRIMARY KEY);
    INSERT INTO fixture_schema_versions VALUES ('synthetic_restore_fixture_v1');
    CREATE TABLE fixture_owners (id integer PRIMARY KEY, label text NOT NULL);
    INSERT INTO fixture_owners VALUES (1, 'Synthetic owner');
    CREATE TABLE fixture_objects (id integer PRIMARY KEY, owner_id integer NOT NULL REFERENCES fixture_owners(id),
      relative_path text NOT NULL UNIQUE, bytes integer NOT NULL CHECK(bytes >= 0), sha256 text NOT NULL CHECK(sha256 ~ '^[0-9a-f]{64}$'));
    INSERT INTO fixture_objects VALUES ${beforeFiles.map((file, index) => `(${index + 1}, 1, '${file.relative_path}', ${file.bytes}, '${file.sha256}')`).join(', ')};`;
  fs.writeFileSync(path.join(runDir, 'fixture.sql'), fixtureSql, { flag: 'wx' });
  sql(sourceDb, fixtureSql);
  const before = snapshot(sourceDb);
  assert.equal(before.objects.length, beforeFiles.length);
  passed('synthetic schema version, foreign keys and file metadata persisted');

  const dump = inside(runDir, path.join(runDir, 'database.dump'));
  const backupFiles = inside(runDir, path.join(runDir, 'backup-files'));
  command('pg_dump', ['--no-password', '-h', host, '-p', String(port), '-U', user, '-d', sourceDb,
    '--format=custom', '--no-owner', '--no-acl', '--file', dump]);
  fs.cpSync(sourceFiles, backupFiles, { recursive: true, force: false, errorOnExist: true });
  assert.deepEqual(files(backupFiles), beforeFiles);
  report.dumpSha256 = hash(fs.readFileSync(dump));
  report.fileManifest = beforeFiles;
  report.databaseBefore = before;
  passed('database custom dump and matching file backup created');

  sql(sourceDb, "UPDATE fixture_owners SET label = 'Changed after backup'; UPDATE fixture_objects SET bytes = bytes + 1");
  fs.writeFileSync(path.join(sourceFiles, 'synthetic.txt'), 'Deliberately changed after backup.\n');
  assert.notDeepEqual(snapshot(sourceDb), before);
  assert.notDeepEqual(files(sourceFiles), beforeFiles);
  passed('database and file divergence after backup detected');

  command('pg_restore', ['--no-password', '-h', host, '-p', String(port), '-U', user, '-d', restoredDb,
    '--exit-on-error', '--no-owner', '--no-acl', dump]);
  const restoredFiles = inside(runDir, path.join(runDir, 'restored-files'));
  fs.cpSync(backupFiles, restoredFiles, { recursive: true, force: false, errorOnExist: true });
  assert.deepEqual(snapshot(restoredDb), before);
  assert.deepEqual(files(restoredFiles), beforeFiles);
  for (const row of before.objects) {
    const content = fs.readFileSync(inside(restoredFiles, path.join(restoredFiles, row.relative_path)));
    assert.equal(hash(content), row.sha256);
    assert.equal(content.length, row.bytes);
  }
  passed('restored rows, schema version, file hashes, sizes and metadata match backup');

  const invalid = sql(restoredDb, `INSERT INTO fixture_objects VALUES (999, 999, 'invalid.bin', 0, '${'0'.repeat(64)}')`, true);
  assert.notEqual(invalid.status, 0);
  assert.match(invalid.stderr, /foreign key constraint/i);
  assert.deepEqual(snapshot(restoredDb), before);
  passed('restored foreign key rejects invalid relation without changing data');
  assert.equal(hash(fs.readFileSync(dump)), report.dumpSha256);
  report.status = 'passed';
}

main().catch(error => {
  report.status = 'failed';
  report.error = error.message;
  process.exitCode = 1;
  process.stderr.write(`FAIL ${error.message}\n`);
}).finally(() => {
  if (startupAttempted) {
    try {
      inside(runDir, fs.realpathSync(cluster));
      if (fs.existsSync(path.join(cluster, 'postmaster.pid'))) {
        command('pg_ctl', ['-D', cluster, '-m', 'fast', '-w', '-t', '15', 'stop']);
        report.clusterStopped = true;
        passed('only the new synthetic cluster stopped; artifacts preserved');
      } else {
        report.clusterStopped = true;
        report.shutdownNote = 'No running cluster PID file; nothing to stop.';
      }
    } catch (error) {
      report.clusterStopped = false;
      report.status = 'failed';
      report.shutdownError = error.message;
      process.exitCode = 1;
      process.stderr.write(`FAIL stopping dedicated cluster: ${error.message}\n`);
    }
  }
  report.checks = checks;
  report.finishedAt = new Date().toISOString();
  if (runDir) {
    fs.writeFileSync(path.join(runDir, 'commands.json'), JSON.stringify(commands, null, 2));
    fs.writeFileSync(path.join(runDir, 'report.json'), JSON.stringify(report, null, 2));
    process.stdout.write(`Report: ${report.artifacts}/report.json\n`);
  }
  process.stdout.write(`${checks.length} checks; status=${report.status}. UPD-21 environment homologation remains pending.\n`);
});
