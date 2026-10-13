/* Multipart real em loopback, repositos sinteticos e pasta temporaria isolada. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Test } = require('@nestjs/testing');
const { ProjetosController } = require('../dist/projetos/projetos.controller.js');
const { ProjetosService } = require('../dist/projetos/projetos.service.js');
const { productionUploadPath } = require('../dist/projetos/producao-upload.js');
const { JwtAuthGuard } = require('../dist/auth/jwt-auth.guard.js');

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'laines-producao-upload-'));
const uploads = path.join(scratch, 'uploads');
const projectId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const admin = { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', role: 'admin', name: 'Admin Sintetico' };
const student = { id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', role: 'aluno', name: 'Aluno Sintetico' };
let currentUser = admin;
let projectExists = true;
let saveFails = false;
let stored = null;

const productions = {
  create: (value) => ({ ...value }),
  save: async (value) => {
    if (saveFails) throw new Error('Falha sintetica de persistencia');
    stored = value;
    return value;
  },
  findOne: async ({ where }) => where.id === stored?.id ? stored : null
};
const config = { get: (key) => key === 'uploads.dir' ? uploads : '' };
const service = new ProjetosService({}, productions, {}, {}, {}, {}, config, { emit: () => {} });
service.findByIdRaw = async (id) => projectExists && id === projectId
  ? { id: projectId, nome: 'Projeto Sintetico', area: 'nutricao' } : null;
service.buildTeamScopeProjectIds = async () => [];

const run = async () => {
  const builder = Test.createTestingModule({
    controllers: [ProjetosController],
    providers: [{ provide: ProjetosService, useValue: service }]
  });
  builder.overrideGuard(JwtAuthGuard).useValue({
    canActivate: (context) => {
      context.switchToHttp().getRequest().user = currentUser;
      return true;
    }
  });
  const module = await builder.compile();
  const app = module.createNestApplication({ logger: false });
  await app.listen(0, '127.0.0.1');
  const base = await app.getUrl();
  const upload = async (bytes, mime = 'application/pdf', name = 'artigo.pdf') => {
    const form = new FormData();
    form.append('titulo', 'Artigo sintetico');
    form.append('projetoId', projectId);
    form.append('file', new Blob([bytes], { type: mime }), name);
    return fetch(`${base}/projetos/producoes`, { method: 'POST', body: form });
  };
  const noFiles = () => {
    const root = path.join(uploads, 'projetos');
    assert.equal(fs.existsSync(root), false);
  };
  try {
    currentUser = student;
    assert.equal((await upload('%PDF-1.4\nsynthetic')).status, 403);
    noFiles();
    console.log('PASS producao sem permissao nao grava arquivo');

    currentUser = admin;
    projectExists = false;
    assert.equal((await upload('%PDF-1.4\nsynthetic')).status, 404);
    noFiles();
    console.log('PASS projeto ausente nao grava arquivo');

    projectExists = true;
    assert.equal((await upload('<html>conteudo falso</html>')).status, 400);
    noFiles();
    assert.equal((await upload('%PDF-1.4\nsynthetic', 'text/html')).status, 400);
    noFiles();
    console.log('PASS MIME e conteudo falsos nao gravam arquivo');

    saveFails = true;
    assert.equal((await upload('%PDF-1.4\nsynthetic')).status, 500);
    const directory = path.join(uploads, 'projetos', projectId, 'producoes');
    assert.deepEqual(fs.readdirSync(directory), []);
    console.log('PASS falha de persistencia apaga o arquivo novo');

    saveFails = false;
    const bytes = Buffer.from('%PDF-1.4\nsynthetic');
    const uploaded = await upload(bytes);
    assert.equal(uploaded.status, 201);
    const record = await uploaded.json();
    assert.equal(record.arquivo.name, 'artigo.pdf');
    const storedFile = path.join(uploads, record.arquivo.path);
    assert.deepEqual(fs.readFileSync(storedFile), bytes);
    const downloaded = await fetch(`${base}${record.arquivo.url}`);
    assert.equal(downloaded.status, 200);
    assert.match(downloaded.headers.get('content-disposition') || '', /^attachment;/);
    assert.equal(downloaded.headers.get('x-content-type-options'), 'nosniff');
    assert.deepEqual(Buffer.from(await downloaded.arrayBuffer()), bytes);
    console.log('PASS anexo permitido preserva bytes e baixa como attachment');

    assert.throws(() => productionUploadPath(uploads, '../fora.pdf'), /Caminho/);
    assert.throws(() => productionUploadPath(uploads, 'projetos/../../fora.pdf'), /Caminho/);
    console.log('PASS caminho de anexo nao sai da raiz de producoes');
  } finally {
    await app.close();
  }
};

run().catch((error) => { console.error(error); process.exitCode = 1; })
  .finally(() => fs.rmSync(scratch, { recursive: true, force: true }));
