/* Real source + synthetic repositories and an isolated loopback Nest server.
 * No environment file, database, mail or external host is accessed. */
const path = require('node:path');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
require(path.join(root, 'server/node_modules/ts-node')).register({ project: path.join(root, 'server/tsconfig.json'), transpileOnly: true });
require(path.join(root, 'server/node_modules/reflect-metadata'));
const source = (name) => require(path.join(root, 'server/src', name));
const { AnalyticsService } = source('analytics/analytics.service.ts');
const { AnalyticsController } = source('analytics/analytics.controller.ts');
const { PublicService } = source('public/public.service.ts');
const { ConteudosService } = source('conteudos/conteudos.service.ts');
const { ConteudosController } = source('conteudos/conteudos.controller.ts');
const { ConteudoUploadGuard } = source('conteudos/conteudo-upload.guard.ts');
const { JwtAuthGuard } = source('auth/jwt-auth.guard.ts');
const { containedConteudoPath } = source('conteudos/conteudo-upload.ts');
const checks = [];
const check = async (name, fn) => { await fn(); checks.push(name); process.stdout.write(`PASS ${name}\n`); };
const streamText = async (stream) => { let output = ''; for await (const chunk of stream) output += chunk; return output; };
const marketing = { id: 'synthetic-marketing', role: 'aluno', permissions: ['marketing:create'], projetoId: '12345678-1234-4234-8234-123456789012' };
const admin = { id: 'synthetic-admin', role: 'admin' };
const projectA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const projectB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const itemId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const missingId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

function publicRepository(initial = []) {
  const rows = structuredClone(initial);
  const tails = new Map();
  let writes = 0;
  let sequence = 0;
  const repo = { manager: { transaction: async (fn) => {
    const held = [];
    const releases = [];
    const tx = {
      query: async (sql, parameters) => {
        if (sql.includes('pg_advisory_xact_lock')) {
          const key = parameters[0];
          const before = tails.get(key) || Promise.resolve();
          let release;
          const after = new Promise((resolve) => { release = resolve; });
          tails.set(key, after);
          await before;
          held.push(key);
          releases.push(release);
          return [];
        }
        assert.match(sql, /nextval/);
        return [{ value: ++sequence }];
      },
      findOne: async ({ where, withDeleted }) => {
        assert.equal(withDeleted, true);
        assert.ok(held.some((key) => key.startsWith('inscricao:cpf:')));
        return rows.find((row) => where.some((condition) => Object.entries(condition).every(([key, value]) => row[key] === value))) || null;
      },
      create: (value) => value,
      save: async (value) => { writes++; rows.push(structuredClone(value)); return value; }
    };
    try { return await fn({ getRepository: () => tx }); }
    finally { for (const release of releases.reverse()) release(); }
  } } };
  return { repo, rows, writes: () => writes };
}

(async () => {
  await check('SEC-06 non-admin exports cannot select another project or request individual rows', async () => {
    const service = Object.create(AnalyticsService.prototype);
    let query;
    service.getReportsOverview = async (value) => { query = value; return { generatedAt: 'synthetic', metrics: { totalPacientes: 12 }, usageByType: [], quarterly: [], projects: [] }; };
    service.fetchPacientesForExport = service.fetchAvaliacoesForExport = () => { throw new Error('Individual data must not be loaded'); };
    for (const requested of ['all', projectB, '../../other']) {
      const result = await service.exportReports({ projectId: requested, anonymize: 'false', format: 'json' }, { ...marketing, projetoId: projectA });
      const payload = JSON.parse(await streamText(result.stream));
      assert.equal(query.projectId, projectA);
      assert.equal(payload.filters.anonymize, true);
      assert.equal(payload.filters.projection, 'aggregate');
      assert.equal(payload.pacientes, undefined);
      assert.equal(payload.avaliacoes, undefined);
      assert.equal(payload.agendamentos, undefined);
    }
    const unlinked = await service.exportReports({ projectId: projectB, anonymize: false, format: 'json' }, marketing);
    assert.equal(JSON.parse(await streamText(unlinked.stream)).filters.projectId, marketing.projetoId);
    await assert.rejects(
      service.exportReports({ projectId: projectB, anonymize: false, format: 'json' }, { ...marketing, projetoId: undefined }),
      /Sem projeto vinculado/
    );
    await assert.rejects(service.exportReports({}, undefined), /Sessao/);
    await assert.rejects(service.exportReports({}, { id: 'student', role: 'aluno' }), /permissao/);
  });
  await check('SEC-06 detailed exports remain available to global administration', async () => {
    const service = Object.create(AnalyticsService.prototype);
    service.getReportsOverview = async () => ({
      projects: [], metrics: {},
      period: { startDate: '2026-10-01', endDate: '2026-10-31', days: 31, timeZone: 'America/Sao_Paulo' }
    });
    service.fetchPacientesForExport = async () => [
      { id: 'synthetic-patient', nome: 'Synthetic patient', dataCadastro: '2026-10-13' },
      { id: 'outside-period', nome: 'Outside period', dataCadastro: '2026-09-13' }
    ];
    service.fetchAvaliacoesForExport = async () => [];
    service.fetchAgendamentosForExport = async () => [];
    const result = await service.exportReports({ projectId: projectA, anonymize: false, format: 'json' }, admin);
    const pacientes = JSON.parse(await streamText(result.stream)).pacientes;
    assert.deepEqual(pacientes.map((patient) => patient.nome), ['Synthetic patient']);
    await assert.rejects(service.exportReports({ projectId: '../../escape' }, admin), /Projeto invalido/);
  });
  await check('SEC-06 delegated dashboard and correlations omit identities even from shared cache payloads', async () => {
    const controller = new AnalyticsController({
      getDashboardSummary: async () => ({ metrics: { totalPatients: 10 }, appointments: { summary: { todayCount: 2 }, items: [{ pacienteNome: 'SECRET' }] }, recentActivities: [{ label: 'SECRET' }] }),
      getCorrelations: async () => ({ absenteeism: { byResponsible: ['SECRET'] }, completeness: { byResponsible: ['SECRET'] }, retention: { byResponsible: ['SECRET'] } })
    });
    const dashboard = await controller.dashboardSummary({ user: marketing });
    const correlation = await controller.correlations({ user: marketing });
    assert.ok(!JSON.stringify(dashboard).includes('SECRET'));
    assert.ok(!JSON.stringify(correlation).includes('SECRET'));
    assert.equal(dashboard.metrics.totalPatients, 10);
    await assert.rejects(
      controller.dashboardSummary({ user: { id: 'no-proj', role: 'aluno', permissions: ['marketing:create'] } }),
      /Sem projeto vinculado/
    );
  });
  await check('SEC-07 CSV treats formula prefixes and controls as text and preserves numbers', async () => {
    const service = Object.create(AnalyticsService.prototype);
    for (const value of ['=1+1', '+SUM(A1)', '-2+4', '@SUM(A1)', '\t=1+1', '\r=1', '\n@A1', '  =1+1', '\uFEFF=1+1', '\u0000=1']) {
      assert.ok(service.escapeCsvValue(value).startsWith('"\''), JSON.stringify(value));
    }
    assert.equal(service.escapeCsvValue(-2.5), '"-2.5"');
    assert.equal(service.escapeCsvValue('two "quotes"'), '"two ""quotes"""');
    assert.equal(service.escapeCsvValue(null), '""');
  });
  const dto = { nome: 'New synthetic name', cpf: '52998224725', email: 'new@example.invalid', consentimentoAceito: true, historicoSaude: 'New synthetic history' };
  await check('SEC-05 duplicate public CPF cannot overwrite triage, active or deleted records', async () => {
    for (const status of ['Triagem Publica', 'ativo', 'inativo']) {
      const original = { id: 'secret-id', prontuario: 'SECRET-REF', cpf: dto.cpf, email: 'original@example.invalid', nome: 'Original', historicoSaude: 'Original history', status, deletedAt: status === 'inativo' ? new Date() : null };
      const db = publicRepository([original]);
      const before = structuredClone(db.rows);
      const service = new PublicService(db.repo, {}, {});
      const response = await service.criarInscricao(dto, `synthetic-${status}`);
      assert.deepEqual(db.rows, before);
      assert.equal(db.writes(), 0);
      assert.deepEqual(Object.keys(response), ['message']);
      assert.ok(!JSON.stringify(response).includes('SECRET'));
    }
  });
  await check('SEC-05 fresh, duplicate and conflicting-email submissions have the same acknowledgement', async () => {
    const db = publicRepository();
    const service = new PublicService(db.repo, {}, {});
    const fresh = await service.criarInscricao(dto, 'new');
    const duplicate = await service.criarInscricao({ ...dto, nome: 'ATTACK' }, 'duplicate');
    const emailConflict = await service.criarInscricao({ ...dto, cpf: '11144477735' }, 'email-conflict');
    assert.deepEqual(fresh, duplicate);
    assert.deepEqual(fresh, emailConflict);
    assert.equal(db.writes(), 1);
    assert.equal(db.rows[0].nome, dto.nome);
  });
  await check('SEC-05 transaction locks serialize concurrent public submissions', async () => {
    const db = publicRepository();
    const services = Array.from({ length: 5 }, () => new PublicService(db.repo, {}, {}));
    const responses = await Promise.all(services.map((service, index) => service.criarInscricao({ ...dto, nome: `Submission ${index}` }, `ip-${index}`)));
    assert.equal(db.writes(), 1);
    assert.equal(db.rows.length, 1);
    for (const response of responses) assert.deepEqual(response, responses[0]);
  });

  const scratch = path.join(root, 'tmp/implementacao-onda0');
  fs.mkdirSync(scratch, { recursive: true });
  const runDir = fs.mkdtempSync(path.join(scratch, 'access-regression-'));
  const previousUploadRoot = process.env.UPLOAD_DIR;
  process.env.UPLOAD_DIR = path.join(runDir, 'uploads');
  let app;
  try {
    let denied = false;
    let failSave = false;
    let stored = { id: itemId, categoria: 'materiais_ensino', status: 'publicado' };
    const service = new ConteudosService({
      findOne: async ({ where }) => where.id === itemId ? { ...stored } : null,
      merge: (entity, data) => ({ ...entity, ...data }),
      save: async (entity) => { if (failSave) throw new Error('Synthetic persistence failure'); stored = entity; return entity; }
    }, { emit: () => {} });
    const { Test } = require(path.join(root, 'server/node_modules/@nestjs/testing'));
    const builder = Test.createTestingModule({ controllers: [ConteudosController], providers: [ConteudoUploadGuard, { provide: ConteudosService, useValue: service }] });
    builder.overrideGuard(JwtAuthGuard).useValue({ canActivate: (context) => { context.switchToHttp().getRequest().user = denied ? marketing : admin; return true; } });
    const module = await builder.compile();
    app = module.createNestApplication({ logger: false });
    await app.listen(0, '127.0.0.1');
    const endpoint = await app.getUrl();
    const upload = async (id, content = '%PDF-1.4\nsynthetic fixture', mime = 'application/pdf', name = 'synthetic.pdf') => {
      const form = new FormData();
      form.append('file', new Blob([content], { type: mime }), name);
      return fetch(`${endpoint}/conteudos/${id}/arquivo`, { method: 'POST', body: form });
    };
    await check('SEC-08 invalid UUID, encoded traversal, missing content and forbidden upload create zero paths', async () => {
      for (const id of ['invalid', '..%2F..%2Fescaped', '..%5C..%5Cescaped', '%2e%2e%252fescape', missingId]) {
        const response = await upload(id);
        assert.ok([400, 404].includes(response.status), `${id}: ${response.status}`);
        assert.deepEqual(fs.readdirSync(runDir), []);
      }
      denied = true;
      assert.equal((await upload(itemId)).status, 403);
      denied = false;
      assert.deepEqual(fs.readdirSync(runDir), []);
    });
    await check('SEC-08 disguised MIME/content and oversized body create no uploaded files', async () => {
      assert.equal((await upload(itemId, '<html>not a PDF</html>')).status, 400);
      assert.equal((await upload(itemId, '%PDF-1.4', 'image/png')).status, 400);
      assert.equal((await upload(itemId, 'a'.repeat(10 * 1024 * 1024 + 1))).status, 413);
      assert.deepEqual(fs.readdirSync(runDir), []);
    });
    await check('SEC-08 failed persistence cleans new upload and preserves existing attachment', async () => {
      failSave = true;
      const failed = await upload(itemId);
      assert.equal(failed.status, 500, await failed.text());
      const directory = path.join(process.env.UPLOAD_DIR, 'conteudos', itemId);
      assert.equal(fs.existsSync(directory), false);
      failSave = false;
      assert.equal((await upload(itemId)).status, 201);
      const original = stored.arquivoPath;
      assert.equal(fs.readFileSync(original, 'utf8'), '%PDF-1.4\nsynthetic fixture');
      failSave = true;
      assert.equal((await upload(itemId, '%PDF-1.4 replacement')).status, 500);
      assert.equal(fs.readFileSync(original, 'utf8'), '%PDF-1.4\nsynthetic fixture');
      assert.equal(fs.readdirSync(directory).length, 1);
      failSave = false;
    });
    await check('SEC-08 read/write paths reject paths outside content root', async () => {
      assert.throws(() => containedConteudoPath(path.join(runDir, 'escape.pdf')), /Caminho/);
      assert.throws(() => containedConteudoPath(path.join(process.env.UPLOAD_DIR, 'conteudos', '..', 'escape.pdf')), /Caminho/);
      stored.arquivoPath = path.join(runDir, 'escape.pdf');
      await assert.rejects(service.getArquivoInfo(itemId, admin), /Caminho/);
    });
  } finally {
    await app?.close();
    if (previousUploadRoot === undefined) delete process.env.UPLOAD_DIR; else process.env.UPLOAD_DIR = previousUploadRoot;
  }
  process.stdout.write(`${checks.length} access security regressions passed. No database or external network used.\n`);
})().catch((error) => { console.error(error.stack); process.exitCode = 1; });
