/* UPD-22: real source, synthetic repositories and isolated loopback static delivery.
 * No .env, real patients, database, processor, MinIO or external requests. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const http = require('node:http');
const root = path.resolve(__dirname, '..');
require(path.join(root, 'server/node_modules/ts-node')).register({ project: path.join(root, 'server/tsconfig.json'), transpileOnly: true });
require(path.join(root, 'server/node_modules/reflect-metadata'));
const { AvaliacaoImagemService } = require(path.join(root, 'server/src/avaliacao-imagem/avaliacao-imagem.service.ts'));
const { AvaliacoesService } = require(path.join(root, 'server/src/avaliacoes/avaliacoes.service.ts'));
const { AvaliacaoImagemController } = require(path.join(root, 'server/src/avaliacao-imagem/avaliacao-imagem.controller.ts'));
const { JwtAuthGuard } = require(path.join(root, 'server/src/auth/jwt-auth.guard.ts'));
const esbuild = require(path.join(root, 'node_modules/esbuild'));
const ts = require(path.join(root, 'server/node_modules/typescript'));
const express = require(path.join(root, 'server/node_modules/express'));
const checks = [];
const check = async (name, action) => { await action(); checks.push(name); process.stdout.write(`PASS ${name}\n`); };
const views = ['frontal', 'lateral_direita', 'posterior', 'lateral_esquerda', 'video_360'];
const linked = { id: 'synthetic-current-member', role: 'aluno' };
const revoked = { id: 'synthetic-old-author', role: 'aluno' };
global.fetch = async () => { throw new Error('External network forbidden in this test'); };

function repository(initial) {
  const rows = structuredClone(initial);
  let writes = 0;
  const matches = (row, where = {}) => Object.entries(where).every(([key, value]) => (
    value && value._type === 'in' ? value._value.includes(row[key]) : row[key] === value
  ));
  const repo = {
    findOne: async ({ where }) => structuredClone(rows.find((row) => matches(row, where)) || null),
    find: async ({ where = {} } = {}) => structuredClone(rows.filter((row) => matches(row, where))),
    count: async ({ where }) => rows.filter((row) => matches(row, where)).length,
    create: (data) => structuredClone(data),
    save: async (data) => {
      writes++;
      for (const row of Array.isArray(data) ? data : [data]) {
        const idx = rows.findIndex((existing) => existing.id === row.id);
        if (idx < 0) rows.push(structuredClone(row)); else rows[idx] = structuredClone(row);
      }
      return data;
    },
    update: async (where, data) => {
      let affected = 0;
      for (const row of rows) if (matches(row, where)) { Object.assign(row, structuredClone(data)); writes++; affected++; }
      return { affected };
    },
    delete: async (where) => { writes++; for (let i = rows.length - 1; i >= 0; i--) if (matches(rows[i], where)) rows.splice(i, 1); },
  };
  return { repo, rows, writes: () => writes };
}

function fixture(status = 'aguardando_upload', confirmed = 0) {
  const evaluation = { id: 'synthetic-evaluation', tipo: 'composicao_corporal_imagem', pacienteId: 'synthetic-patient', alunoId: revoked.id, status: 'rascunho', dados: { peso: 70, estatura: 175, sexo: 'masculino' } };
  const captures = repository(views.map((vista, index) => ({ id: `capture-${index}`, avaliacaoId: evaluation.id, vista, objectKey: `synthetic/${index}.jpg`, mimeType: index === 4 ? 'video/webm' : 'image/jpeg', tamanhoBytes: '10', uploadStatus: index < confirmed ? 'confirmado' : 'pendente' })));
  const jobs = repository([{ id: 'synthetic-job', avaliacaoId: evaluation.id, status, progresso: 5, processorJobId: status === 'em_processamento' ? 'external-synthetic-job' : null }]);
  const evaluations = repository([evaluation]);
  jobs.repo.manager = { transaction: async (action) => {
    const beforeJobs = structuredClone(jobs.rows);
    const beforeEvaluations = structuredClone(evaluations.rows);
    try {
      return await action({ save: (entity, data) => entity.name === 'Avaliacao' ? evaluations.repo.save(data) : jobs.repo.save(data) });
    } catch (error) {
      jobs.rows.splice(0, jobs.rows.length, ...beforeJobs);
      evaluations.rows.splice(0, evaluations.rows.length, ...beforeEvaluations);
      throw error;
    }
  } };
  const patients = repository([{ id: evaluation.pacienteId, alunoResponsavelId: linked.id }]);
  const users = repository([{ id: linked.id, supervisorId: 'synthetic-supervisor' }]);
  const effects = { writes: 0, inspections: 0, urls: 0, removed: 0, sources: 0, audit: [] };
  const storage = {
    localUploadObjectKey: () => 'synthetic/0.jpg',
    saveLocalUpload: async () => { effects.writes++; return { size: 10 }; },
    createUploadDescriptor: async () => { effects.urls++; return { uploadUrl: 'synthetic-url' }; },
    inspectObject: async () => { effects.inspections++; return { size: 10, detectedMimeType: 'video/webm', sha256: 'abc' }; },
    deleteObject: async () => { effects.removed++; },
    createProcessorSource: async () => { effects.sources++; return { type: 'synthetic' }; },
  };
  const evaluationService = {
    findById: async () => structuredClone(evaluation),
    findEditableById: async () => structuredClone(evaluation),
    remove: async () => { effects.removed++; },
  };
  const service = new AvaliacaoImagemService(captures.repo, jobs.repo, evaluations.repo, evaluationService, storage, { create: async (entry) => effects.audit.push(entry) }, patients.repo, users.repo);
  service.processorBaseUrl = '';
  return { service, captures, jobs, evaluations, patients, effects, storage };
}

const validResults = { percGordura: 20, massaGorda: 14, massaMagra: 56 };

(async () => {
  await check('image age is snapshotted from patient birth date only for the studied adult range', async () => {
    const captureDate = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
    const [year, month, day] = captureDate.split('-');
    const birthday = (age) => `${Number(year) - age}-${month}-${day}`;
    for (const [birthDate, expectedAge] of [
      [birthday(19), 19], [birthday(18), null], [birthday(84), null],
      ['2000-02-30', null], [null, null],
    ]) {
      const f = fixture();
      f.patients.rows[0].dataNascimento = birthDate;
      let captured = null;
      f.service.avaliacoesService.create = async (payload) => {
        captured = payload;
        return { id: 'new-image-evaluation', ...payload };
      };
      await f.service.create({
        pacienteId: 'synthetic-patient', peso: 70, estatura: 175,
        sexo: 'masculino', consentimentoTipo: 'participante', consentimento: true,
      }, linked);
      assert.equal(captured.dados.idade, expectedAge);
      assert.equal(captured.dados.idadeReferenciaEm, captureDate);
      assert.equal(captured.dados.idadeOrigem,
        expectedAge === null ? 'indisponivel' : 'paciente.dataNascimento');
      if (expectedAge !== null) {
        f.evaluations.rows[0].dados = captured.dados;
        f.captures.rows.forEach((capture) => { capture.uploadStatus = 'confirmado'; });
        f.service.processorBaseUrl = 'synthetic';
        let submitted = null;
        f.service.fetchProcessor = async (_path, request) => {
          submitted = JSON.parse(request.body).anthropometry;
          return { jobId: 'synthetic-age-job' };
        };
        await f.service.startProcessing('synthetic-evaluation', linked);
        assert.equal(submitted.idade, expectedAge);
        assert.equal(submitted.idadeOrigem, 'paciente.dataNascimento');
      }
    }
  });

  await check('generic evaluation route requires current link for image and anamnesis authors', async () => {
    const service = Object.create(AvaliacoesService.prototype);
    const evaluation = { id: 'synthetic', pacienteId: 'synthetic-patient', alunoId: revoked.id, tipo: 'composicao_corporal_imagem' };
    const patient = { id: 'synthetic-patient', alunoResponsavelId: linked.id };
    service.findByIdRaw = async () => evaluation;
    service.pacientesRepo = { findOne: async () => patient };
    service.usersRepo = { findOne: async () => null };
    assert.equal(await service.findById('synthetic', revoked), null);
    patient.alunoResponsavelId = revoked.id;
    assert.equal(await service.findById('synthetic', revoked), evaluation);
    patient.alunoResponsavelId = linked.id;
    evaluation.tipo = 'anamnese';
    assert.equal(await service.findById('synthetic', revoked), null);
  });

  await check('current clinical link rejects old author, another patient and academic role before side effects', async () => {
    for (const actor of [revoked, { id: 'other-athlete', role: 'atleta' }, { id: 'academic', role: 'diretoria_ensino' }]) {
      const f = fixture();
      for (const action of [
        () => f.service.status('synthetic-evaluation', actor),
        () => f.service.results('synthetic-evaluation', actor),
        () => f.service.createUploadUrls('synthetic-evaluation', actor),
        () => f.service.concludeUpload('synthetic-evaluation', 'capture-0', {}, actor),
        () => f.service.uploadLocal('synthetic-token', {}, actor),
        () => f.service.reprocess('synthetic-evaluation', actor),
        () => f.service.remove('synthetic-evaluation', actor),
      ]) await assert.rejects(action, /Acesso negado/);
      assert.deepEqual(f.effects, { writes: 0, inspections: 0, urls: 0, removed: 0, sources: 0, audit: [] });
      assert.equal(f.captures.writes() + f.jobs.writes() + f.evaluations.writes(), 0);
    }
  });

  await check('supervision chain is reused and revocation is checked on every request', async () => {
    const f = fixture();
    assert.equal((await f.service.status('synthetic-evaluation', { id: 'synthetic-supervisor', role: 'professor' })).status, 'aguardando_upload');
    await f.service.uploadLocal('synthetic-token', {}, linked);
    f.patients.rows[0].alunoResponsavelId = 'other-member';
    await assert.rejects(() => f.service.uploadLocal('synthetic-token', {}, linked), /Acesso negado/);
    assert.equal(f.effects.writes, 1);
    assert.ok(Reflect.getMetadata('__guards__', AvaliacaoImagemController.prototype.uploadLocal).includes(JwtAuthGuard));
  });

  await check('resume exposes only capture states and issues URLs only for missing captures', async () => {
    const f = fixture('aguardando_upload', 3);
    const status = await f.service.status('synthetic-evaluation', linked);
    assert.equal(status.captures.filter((capture) => capture.confirmed).length, 3);
    assert.ok(status.captures.every((capture) => !('objectKey' in capture)));
    const contract = await f.service.createUploadUrls('synthetic-evaluation', linked);
    assert.deepEqual(contract.uploads.map((capture) => capture.vista), ['lateral_esquerda', 'video_360']);
    await assert.rejects(() => f.service.uploadLocal('synthetic-token', {}, linked), /confirmada/);
    assert.equal(f.effects.writes, 0);
  });

  await check('confirmation retry is idempotent and final upload preserves waiting processor state', async () => {
    const f = fixture('aguardando_upload', 4);
    await f.service.concludeUpload('synthetic-evaluation', 'capture-0', {}, linked);
    assert.equal(f.effects.inspections, 0);
    await f.service.concludeUpload('synthetic-evaluation', 'capture-4', { tamanhoBytes: 10 }, linked);
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(f.jobs.rows[0].status, 'aguardando_processador');
    assert.equal((await f.service.status('synthetic-evaluation', linked)).terminal, false);
    await f.service.concludeUpload('synthetic-evaluation', 'capture-4', {}, linked);
    assert.equal(f.effects.inspections, 1);
  });

  await check('invalid file confirmation changes neither capture nor job', async () => {
    const f = fixture('aguardando_upload', 4);
    f.storage.inspectObject = async () => ({ size: 10, detectedMimeType: 'image/jpeg', sha256: 'abc' });
    await assert.rejects(() => f.service.concludeUpload('synthetic-evaluation', 'capture-4', {}, linked), /formato esperado/);
    assert.equal(f.captures.rows[4].uploadStatus, 'pendente');
    assert.equal(f.jobs.rows[0].status, 'aguardando_upload');
  });

  await check('processing and completed jobs reject replacement uploads and duplicate processing', async () => {
    for (const state of ['iniciando', 'em_processamento', 'concluida']) {
      const f = fixture(state, 5);
      await assert.rejects(() => f.service.createUploadUrls('synthetic-evaluation', linked), /encaminhadas/);
      await assert.rejects(() => f.service.reprocess('synthetic-evaluation', linked), /Aguarde/);
      assert.equal(f.effects.urls, 0);
      assert.equal(f.jobs.writes(), 0);
    }
  });

  await check('processor startup failure is persisted and explicit retry resumes preserved captures', async () => {
    const f = fixture('falha', 5);
    f.service.processorBaseUrl = 'synthetic';
    f.service.fetchProcessor = async () => { throw new Error('Synthetic unavailable'); };
    await assert.rejects(() => f.service.reprocess('synthetic-evaluation', linked), /Synthetic/);
    assert.equal(f.jobs.rows[0].status, 'falha');
    assert.equal(f.jobs.rows[0].erroCodigo, 'PROCESSOR_START_FAILED');
    f.service.fetchProcessor = async () => ({ jobId: 'resumed-job' });
    assert.equal((await f.service.reprocess('synthetic-evaluation', linked)).status, 'em_processamento');
    assert.equal(f.captures.rows.filter((capture) => capture.uploadStatus === 'confirmado').length, 5);
  });

  await check('maintenance recovers interruption between final confirmation and processor start', async () => {
    const f = fixture('aguardando_upload', 5);
    f.service.processorBaseUrl = 'synthetic';
    let starts = 0;
    f.service.fetchProcessor = async () => { starts++; return { jobId: 'recovered-job' }; };
    await f.service.reconcileProcessingJobs();
    assert.equal(f.jobs.rows[0].status, 'em_processamento');
    assert.equal(starts, 1);
  });

  await check('temporary polling failure preserves job; malformed completion becomes an explicit failure', async () => {
    const f = fixture('em_processamento', 5);
    f.service.processorBaseUrl = 'synthetic';
    f.service.fetchProcessor = async () => { throw new Error('Temporary'); };
    await assert.rejects(() => f.service.status('synthetic-evaluation', linked), /Temporary/);
    assert.equal(f.jobs.rows[0].processorJobId, 'external-synthetic-job');
    f.service.fetchProcessor = async () => ({ status: 'completed', results: { ...validResults, massaMagra: null } });
    assert.equal((await f.service.status('synthetic-evaluation', linked)).status, 'falha');
    assert.equal(f.jobs.rows[0].erroCodigo, 'PROCESSOR_RESULTS_INVALID');
    assert.equal(f.evaluations.rows[0].status, 'rascunho');
  });

  await check('missing values never become zero; estimates carry origin/version and stale results stay hidden', async () => {
    const f = fixture('falha', 5);
    for (const value of [null, undefined, '', ' ', false, [], {}]) {
      const result = f.service.normalizeResults({ ...validResults, massaMagra: value });
      assert.throws(() => f.service.assertValidResults(result), /invalido/);
    }
    const zero = f.service.normalizeResults({ ...validResults, massaGorda: 0 });
    assert.equal(zero.massaGorda, 0);
    assert.equal(zero.algoritmoVersion, 'nao_informada');
    assert.equal(zero.natureza, 'estimativa');
    f.jobs.rows[0].resultados = validResults;
    assert.equal((await f.service.results('synthetic-evaluation', linked)).results, null);
    f.service.processorBaseUrl = 'synthetic';
    f.service.fetchProcessor = async () => ({ results: validResults, algorithmVersion: 'synthetic-v1' });
    await f.service.reprocess('synthetic-evaluation', linked);
    assert.equal(f.evaluations.rows[0].resultados.algoritmoVersion, 'synthetic-v1');
    assert.equal((await f.service.results('synthetic-evaluation', linked)).results.validacaoClinica, 'nao_comprovada');
  });

  await check('storage deletion failure retains database mapping for a later retry', async () => {
    const f = fixture('concluida', 5);
    f.storage.deleteObject = async () => { throw new Error('Synthetic storage failure'); };
    await assert.rejects(() => f.service.remove('synthetic-evaluation', linked), /storage failure/);
    assert.equal(f.captures.rows.length, 5);
    assert.equal(f.jobs.rows.length, 1);
    assert.equal(f.effects.removed, 0);
  });

  await check('completion persistence failure rolls back evaluation and preserves the job for polling retry', async () => {
    const f = fixture('em_processamento', 5);
    f.service.processorBaseUrl = 'synthetic';
    f.service.fetchProcessor = async () => ({ status: 'completed', results: validResults });
    const save = f.jobs.repo.save;
    f.jobs.repo.save = async () => { throw new Error('Synthetic database failure'); };
    await assert.rejects(() => f.service.status('synthetic-evaluation', linked), /database failure/);
    assert.equal(f.evaluations.rows[0].status, 'rascunho');
    assert.equal(f.jobs.rows[0].status, 'em_processamento');
    assert.equal(f.jobs.rows[0].erroCodigo, undefined);
    f.jobs.repo.save = save;
    assert.equal((await f.service.status('synthetic-evaluation', linked)).status, 'concluida');
    assert.equal(f.evaluations.rows[0].status, 'finalizada');
  });

  await check('frontend local upload supports absolute and relative API bases and never sends auth to MinIO', async () => {
    const code = esbuild.transformSync(fs.readFileSync(path.join(root, 'src/services/avaliacaoImagemService.js'), 'utf8'), { format: 'cjs', loader: 'js' }).code;
    for (const base of ['http://localhost:4000', 'https://synthetic.test/api', '/api']) {
      const writes = [];
      const api = { defaults: { baseURL: base }, put: async (...args) => writes.push(args), post: async () => ({ data: {} }) };
      let directUploads = 0;
      class FakeXHR {
        upload = {};
        open() { directUploads++; }
        setRequestHeader(name) { assert.notEqual(name.toLowerCase(), 'authorization'); }
        send() { this.status = 200; this.onload(); }
      }
      const context = { module: { exports: {} }, require: () => ({ __esModule: true, default: api }), URL, Blob, Uint8Array, XMLHttpRequest: FakeXHR, window: { location: { origin: 'https://synthetic.test' } } };
      vm.runInNewContext(code, context);
      const apiUrl = new URL(base, context.window.location.origin);
      const uploadUrl = `${apiUrl.href.replace(/\/$/, '')}/avaliacoes-imagem/uploads/local/token`;
      await context.module.exports.uploadCapture({ evaluationId: 'synthetic', descriptor: { uploadUrl, authenticatedLocal: true, captureId: 'synthetic' }, blob: new Blob(['synthetic']) });
      assert.equal(writes.length, 1);
      await assert.rejects(() => context.module.exports.uploadCapture({ descriptor: { uploadUrl: 'https://storage.test/avaliacoes-imagem/uploads/local/token', authenticatedLocal: true }, blob: new Blob(['synthetic']) }), /Destino/);
      await context.module.exports.uploadCapture({ evaluationId: 'synthetic', descriptor: { uploadUrl: 'https://storage.test/signed', captureId: 'synthetic' }, blob: new Blob(['synthetic']) });
      assert.equal(writes.length, 1);
      assert.equal(directUploads, 1);
    }
  });

  await check('frontend rendering labels unknown quality and estimates without public mesh or fabricated version', async () => {
    const source = fs.readFileSync(path.join(root, 'src/components/Avaliacoes/avaliacao-imagem/AvaliacaoImagem.jsx'), 'utf8');
    const code = esbuild.transformSync(`${source}\nexport { StepResults, StepReview, normalizeResultPayload };`, { format: 'cjs', loader: 'jsx' }).code;
    const React = require(path.join(root, 'node_modules/react'));
    const { renderToStaticMarkup } = require(path.join(root, 'node_modules/react-dom/server'));
    const context = { module: { exports: {} }, require: (id) => {
      if (id === 'react') return React;
      if (id.endsWith('Body3D')) return { __esModule: true, default: () => null };
      if (id === 'lucide-react') return new Proxy({}, { get: () => () => null });
      return {};
    } };
    vm.runInNewContext(code, context);
    const ui = context.module.exports;
    for (const value of [null, undefined, '', false, [], {}]) assert.equal(ui.normalizeResultPayload({ ...validResults, massaMagra: value }), null);
    const html = renderToStaticMarkup(React.createElement(ui.StepResults, { results: validResults }));
    assert.match(html, /ESTIMATIVA EXPERIMENTAL/);
    assert.match(html, /Qualidade não informada/);
    assert.match(html, /Algoritmo: não informada/);
    assert.doesNotMatch(html, /2\.0\.0|Alta confiabilidade|medidas reais|uploads\/avaliacoes-imagem|340|Obesidade/);
    const legacy = renderToStaticMarkup(React.createElement(ui.StepResults, { results: {
      ...validResults, peso: 70, estatura: 175,
      risco_metabolico: { pontos: 0, classificacao: 'Baixo' },
      idade_corporal: 18,
      intervalo_confianca: { inferior: 18, superior: 22 },
      indices: { calf_screening: 'triagem_positiva_massa_muscular' },
    } }));
    assert.match(legacy, /IMC · peso e estatura informados/);
    assert.doesNotMatch(legacy, /Risco metabólico|Idade corporal|Intervalo informado|Panturrilha|Baixo/);
    const preview = renderToStaticMarkup(React.createElement(ui.StepReview, { captures: [{ previewUrl: 'blob:synthetic-preview' }, { confirmed: true }, null, null] }));
    assert.match(preview, /blob:synthetic-preview/);
    assert.match(preview, /Confirmada no servidor/);
    assert.doesNotMatch(preview, /\[object Object\]/);
  });

  await check('public static delivery blocks direct, encoded and Windows private paths; public files remain available', async () => {
    const tempRoot = path.resolve(root, 'tmp');
    fs.mkdirSync(tempRoot, { recursive: true });
    const uploadsDir = fs.mkdtempSync(path.join(tempRoot, 'upd22-static-'));
    const resolved = path.resolve(uploadsDir);
    assert.ok(resolved.startsWith(`${tempRoot}${path.sep}`));
    fs.mkdirSync(path.join(uploadsDir, 'avaliacoes-imagem'));
    fs.writeFileSync(path.join(uploadsDir, 'avaliacoes-imagem', 'image.jpg'), 'synthetic-private-image');
    fs.writeFileSync(path.join(uploadsDir, 'public.txt'), 'synthetic-public');
    const app = express();
    app.use('/baseline', express.static(uploadsDir));
    const main = fs.readFileSync(path.join(root, 'server/src/main.ts'), 'utf8');
    const start = main.indexOf("  if (config.get('uploads.publicAccess')) {");
    const end = main.indexOf("  const port =", start);
    assert.ok(start >= 0 && end > start);
    const block = ts.transpileModule(main.slice(start, end), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
    vm.runInNewContext(block, { app, uploadsDir, express, config: { get: () => true } });
    const server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const request = (requestPath) => new Promise((resolve, reject) => {
      http.get({ hostname: '127.0.0.1', port: server.address().port, path: requestPath }, (res) => {
        let body = ''; res.on('data', (chunk) => { body += chunk; }); res.on('end', () => resolve({ status: res.statusCode, body }));
      }).on('error', reject);
    });
    try {
      let otherwisePublic = 0;
      for (const tail of [
        '/avaliacoes-imagem/image.jpg', '/%61valiacoes-imagem/image.jpg', '/avaliacoes%2dimagem/image.jpg',
        '/avaliacoes-imagem%2fimage.jpg', '/AVALIACOES-IMAGEM/image.jpg', '/avaliacoes-imagem%5cimage.jpg',
        '/avaliacoes-imagem./image.jpg', '/avaliacoes-imagem%20/image.jpg', '/avaliacoes-imagem::$INDEX_ALLOCATION/image.jpg',
        '/other/../avaliacoes-imagem/image.jpg', '/%2e/avaliacoes-imagem/image.jpg', '/avaliacoes-imagem/image.jpg?download=1',
      ]) {
        if ((await request(`/baseline${tail}`)).status === 200) otherwisePublic++;
        const protectedResult = await request(`/uploads${tail}`);
        assert.equal(protectedResult.status, 404, tail);
        assert.ok(!protectedResult.body.includes('synthetic-private-image'), tail);
      }
      assert.ok(otherwisePublic >= 4, `Only ${otherwisePublic} accepted by static baseline`);
      assert.equal((await request('/uploads/public.txt')).body, 'synthetic-public');
      assert.equal((await request('/uploads/%ZZ')).status, 400);
      process.stdout.write(`INFO ${otherwisePublic} private path variants would otherwise be served on ${process.platform}\n`);
    } finally {
      await new Promise((resolve) => server.close(resolve));
      assert.ok(path.resolve(uploadsDir).startsWith(`${tempRoot}${path.sep}`));
      fs.rmSync(uploadsDir, { recursive: true, force: true });
    }
  });

  process.stdout.write(`UPD-22: ${checks.length} checks passed; synthetic repositories, source rendering and loopback HTTP only.\n`);
})().catch((error) => { process.stderr.write(`${error.stack}\n`); process.exitCode = 1; });
