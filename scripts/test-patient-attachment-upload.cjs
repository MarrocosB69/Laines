/* WI-004: real Nest multipart route with synthetic patient records and isolated files.
 * No .env, database, external service or real patient is used. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const serverModules = path.join(root, 'server/node_modules');
require(path.join(serverModules, 'ts-node')).register({
  project: path.join(root, 'server/tsconfig.json'),
  transpileOnly: true
});
require(path.join(serverModules, 'reflect-metadata'));

const { Test } = require(path.join(serverModules, '@nestjs/testing'));
const { JwtAuthGuard } = require(path.join(root, 'server/src/auth/jwt-auth.guard.ts'));
const { RolesGuard } = require(path.join(root, 'server/src/auth/roles.guard.ts'));
const { PacientesController } = require(path.join(root, 'server/src/pacientes/pacientes.controller.ts'));
const { PacientesService } = require(path.join(root, 'server/src/pacientes/pacientes.service.ts'));

const patientId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const author = { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', role: 'professor', name: 'Professor A' };
const successor = { id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', role: 'professor', name: 'Professor B' };
const unrelated = { id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', role: 'professor', name: 'Professor C' };
const actors = { author, successor, unrelated };
const bytes = Buffer.from('%PDF-1.4\n% anexo sintetico existente\n%%EOF\n');
const tmpRoot = path.join(root, 'tmp');
fs.mkdirSync(tmpRoot, { recursive: true });
const runDir = fs.mkdtempSync(path.join(tmpRoot, 'patient-attachment-upload-'));
const uploadDir = path.join(runDir, 'uploads');
const attachmentDir = path.join(uploadDir, 'pacientes', patientId, 'anexos');
const previousUploadDir = process.env.UPLOAD_DIR;
process.env.UPLOAD_DIR = uploadDir;

let stored = { id: patientId, professorSupervisorId: author.id, anexos: [] };
let failSave = false;
let saveCalls = 0;
let events = 0;
let app;
const repo = {
  findOne: async ({ where }) => where.id === patientId ? structuredClone(stored) : null,
  merge: (entity, patch) => ({ ...entity, ...patch }),
  save: async (entity) => {
    saveCalls++;
    if (failSave) throw new Error('Synthetic patient persistence failure');
    stored = structuredClone(entity);
    return structuredClone(stored);
  }
};
const service = new PacientesService(
  repo,
  { findOne: async () => null },
  {},
  {},
  {},
  { emit: () => { events++; } },
  { get: (key) => key === 'uploads.dir' ? uploadDir : '' }
);

const check = async (name, action) => {
  await action();
  process.stdout.write(`PASS ${name}\n`);
};

(async () => {
  try {
    const builder = Test.createTestingModule({
      controllers: [PacientesController],
      providers: [RolesGuard, { provide: PacientesService, useValue: service }]
    });
    builder.overrideGuard(JwtAuthGuard).useValue({
      canActivate: (context) => {
        const request = context.switchToHttp().getRequest();
        const token = String(request.headers.authorization || '').replace(/^Bearer\s+/i, '');
        request.user = actors[token];
        return Boolean(request.user);
      }
    });
    const module = await builder.compile();
    app = module.createNestApplication({ logger: false });
    await app.listen(0, '127.0.0.1');
    const endpoint = await app.getUrl();

    const upload = (actor, content = bytes) => {
      const form = new FormData();
      form.append('file', new Blob([content], { type: 'application/pdf' }), 'synthetic.pdf');
      return fetch(`${endpoint}/pacientes/${patientId}/anexos`, {
        method: 'POST',
        headers: { authorization: `Bearer ${actor}` },
        body: form
      });
    };
    const download = (actor, filename) => fetch(
      `${endpoint}/pacientes/${patientId}/anexos/${encodeURIComponent(filename)}`,
      { headers: { authorization: `Bearer ${actor}` } }
    );

    await check('unrelated supervisor cannot create patient attachment or metadata', async () => {
      const response = await upload('unrelated');
      assert.equal(response.status, 404, await response.text());
      assert.equal(fs.existsSync(attachmentDir), false);
      assert.deepEqual(stored.anexos, []);
      assert.equal(saveCalls, 0);
      assert.equal(events, 0);
    });

    let existingFilename;
    await check('authorized multipart upload returns metadata and downloads identical bytes', async () => {
      const response = await upload('author');
      assert.equal(response.status, 201, await response.clone().text());
      const metadata = await response.json();
      existingFilename = path.posix.basename(metadata.path);
      assert.equal(metadata.name, 'synthetic.pdf');
      assert.equal(metadata.type, 'application/pdf');
      assert.equal(metadata.size, bytes.length);
      assert.deepEqual(stored.anexos, [metadata]);
      assert.deepEqual(fs.readdirSync(attachmentDir), [existingFilename]);
      assert.deepEqual(fs.readFileSync(path.join(attachmentDir, existingFilename)), bytes);
      const downloaded = await download('author', existingFilename);
      assert.equal(downloaded.status, 200);
      assert.deepEqual(Buffer.from(await downloaded.arrayBuffer()), bytes);
      assert.equal(events, 1);
    });

    await check('revoked link and persistence failure preserve existing attachment', async () => {
      stored.professorSupervisorId = successor.id;
      const originalMetadata = structuredClone(stored.anexos);
      const originalFiles = fs.readdirSync(attachmentDir).sort();
      const beforeDeniedSaves = saveCalls;

      const denied = await upload('author', Buffer.from('%PDF-1.4\nrevoked'));
      assert.equal(denied.status, 404, await denied.text());
      assert.equal(saveCalls, beforeDeniedSaves);
      assert.deepEqual(stored.anexos, originalMetadata);
      assert.deepEqual(fs.readdirSync(attachmentDir).sort(), originalFiles);

      failSave = true;
      const failed = await upload('successor', Buffer.from('%PDF-1.4\npersistence fails'));
      assert.equal(failed.status, 500, await failed.text());
      failSave = false;
      assert.equal(saveCalls, beforeDeniedSaves + 1);
      assert.deepEqual(stored.anexos, originalMetadata);
      assert.deepEqual(fs.readdirSync(attachmentDir).sort(), originalFiles);
      assert.equal(events, 1);
      const downloaded = await download('successor', existingFilename);
      assert.equal(downloaded.status, 200);
      assert.deepEqual(Buffer.from(await downloaded.arrayBuffer()), bytes);
    });

    process.stdout.write('3 patient attachment upload regressions passed.\n');
  } finally {
    await app?.close();
    if (previousUploadDir === undefined) delete process.env.UPLOAD_DIR;
    else process.env.UPLOAD_DIR = previousUploadDir;
    const resolvedRunDir = fs.realpathSync(runDir);
    const resolvedTmpRoot = fs.realpathSync(tmpRoot);
    const resolvedWorkspaceRoot = fs.realpathSync(root);
    assert.ok(resolvedTmpRoot.startsWith(resolvedWorkspaceRoot + path.sep));
    assert.ok(resolvedRunDir.startsWith(resolvedTmpRoot + path.sep));
    fs.rmSync(resolvedRunDir, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(error.stack);
  process.exitCode = 1;
});
