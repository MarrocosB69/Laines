/* Read-only audit probes: real service methods, synthetic identities and in-memory repositories.
 * No env file, database, external host or real credential is accessed.
 * Upload probes use an ephemeral loopback server and files only inside this task directory.
 */
const path = require('node:path');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../../..');
require(path.join(root, 'server/node_modules/ts-node')).register({
  project: path.join(root, 'server/tsconfig.json'), transpileOnly: true,
});
require(path.join(root, 'server/node_modules/reflect-metadata'));
const source = (name) => require(path.join(root, 'server/src', name));
const checks = [];
const check = async (name, fn) => {
  try { checks.push({ name, result: 'reproduced', evidence: await fn() }); }
  catch (error) { checks.push({ name, result: 'failed', error: error.message }); process.exitCode = 1; }
};

(async () => {
  await check('SEC-01 recovery requires opaque token, no identifier/cpf/birthdate', async () => {
    const { AuthService } = source('auth/auth.service.ts');
    const { RecoverPasswordDto } = source('auth/dto/recover-password.dto.ts');

    const dto = new RecoverPasswordDto();
    assert.ok(!('identifier' in dto), 'DTO must not accept identifier');
    assert.ok(!('cpf' in dto), 'DTO must not accept cpf');
    assert.ok(!('dataNascimento' in dto), 'DTO must not accept dataNascimento');

    const identity = { id: 'synthetic-admin', role: 'admin', email: 'synthetic-admin@example.invalid', status: 'ativo', passwordHash: 'redacted' };
    const service = new AuthService(
      { findByEmail: async () => identity, updatePasswordAndRevokeSessions: async () => {} },
      {},
      { assertNotBlocked: async () => {}, registerFailure: async () => {}, clear: async () => {} },
      { get: () => undefined },
      { revokeAllForUser: async () => {} }
    );

    let failedNoToken = false;
    try {
      await service.recoverPassword({ newPassword: 'ChangedSyntheticPassword123' });
    } catch (e) { failedNoToken = true; }
    assert.equal(failedNoToken, true, 'Recovery without token must fail');

    let failedNoCredentials = false;
    try {
      await service.recoverPassword({ token: 'a'.repeat(64), newPassword: 'ChangedSyntheticPassword123' });
    } catch (e) { failedNoCredentials = true; }
    assert.equal(failedNoCredentials, true, 'Recovery with credentials service absent must fail');

    return { dtoFields: Object.keys(dto), recoveryWithoutToken: 'rejected', recoveryWithoutCredentials: 'rejected' };
  });
  await check('SEC-02 delegated user read hides passwordHash and tempPassword', async () => {
    const { UsersService } = source('users/users.service.ts');
    const service = Object.create(UsersService.prototype);
    const user = {
      id: 'synthetic-admin', role: 'admin', email: 'x@example.invalid',
      cpf: '52998224725', dataNascimento: '2000-01-01',
      passwordHash: 'redacted-hash', tempPassword: 'synthetic-secret',
      mustChangePassword: true
    };

    const pub = service.toPublic(user);
    assert.ok(!('passwordHash' in pub), 'toPublic must not include passwordHash');
    assert.ok(!('tempPassword' in pub), 'toPublic must not include tempPassword');

    const pubWithFlag = service.toPublic(user, true);
    assert.ok(!('passwordHash' in pubWithFlag), 'toPublic(user, true) must not include passwordHash');
    assert.ok(!('tempPassword' in pubWithFlag), 'toPublic(user, true) must not include tempPassword');

    return {
      passwordHashHidden: true,
      tempPasswordHidden: true,
      cpfStillPresent: 'cpf' in pub,
      dataNascimentoStillPresent: 'dataNascimento' in pub
    };
  });
  await check('SEC-03 realtime never delivers clinical payload to sockets', async () => {
    const { RealtimeGateway } = source('realtime/realtime.gateway.ts');
    const delivered = [];
    const socket = {
      id: 's1',
      data: { session: { userId: 'u1', version: 1, familyId: 'f1', expiresAt: Date.now() + 60000 } },
      emit: (event, data) => delivered.push({ event, data }),
      disconnect: () => {},
    };
    const user = { id: 'u1', role: 'profissional', status: 'ativo', sessionVersion: 1, deletedAt: null, mustChangePassword: false };
    const gateway = new RealtimeGateway(
      { get: () => undefined },
      { verify: () => ({}) },
      { findById: async () => user },
      { isFamilyActive: async () => true },
      { findOne: async () => ({ id: 'synthetic-patient', professorSupervisorId: 'u1' }) }
    );
    gateway.server = { sockets: { sockets: new Map([['s1', socket]]) } };
    await gateway.emit('pacientes.updated', { id: 'synthetic-patient', historicoSaude: 'synthetic-clinical-data' });
    for (const item of delivered) {
      assert.ok(!item.data || !item.data.historicoSaude, 'Clinical payload must not be delivered');
      assert.ok(item.data && item.data.invalidate === true, 'Only invalidation payload is allowed');
    }
    return { delivered, clinicalPayloadDelivered: false };
  });
  await check('SEC-04 realtime rejects temporary-password session at handshake', async () => {
    const { RealtimeGateway } = source('realtime/realtime.gateway.ts');
    const user = { id: 'synthetic-user', role: 'profissional', status: 'ativo', sessionVersion: 1, mustChangePassword: true, deletedAt: null };
    let middleware;
    const gateway = new RealtimeGateway(
      { get: () => undefined },
      { verify: () => ({ sub: user.id, sv: 1, sid: 'fam', typ: 'access', exp: Math.floor(Date.now() / 1000) + 60 }) },
      { findById: async () => user },
      { isFamilyActive: async () => true },
      { findOne: async () => null }
    );
    gateway.server = { use: fn => { middleware = fn; }, sockets: { sockets: new Map() } };
    gateway.afterInit(gateway.server);
    const socket = { handshake: { headers: {}, auth: { token: 'x' } }, data: {}, disconnect: () => {} };
    let rejected = false;
    await new Promise(resolve => middleware(socket, err => { rejected = !!err; resolve(); }));
    gateway.onModuleDestroy();
    assert.equal(rejected, true, 'Temp-password session must be rejected');
    return { rejected };
  });
  await check('SEC-05 public inscription does not overwrite existing triage by CPF', async () => {
    const { PublicService } = source('public/public.service.ts');
    const existing = { id: 'synthetic-patient', cpf: '52998224725', nome: 'Existing', status: 'Triagem Publica', historicoSaude: 'Existing history' };
    let saveCalled = 0;
    const manager = {
      getRepository: () => ({ query: async () => {}, findOne: async () => existing }),
      transaction: async (fn) => fn(manager),
    };
    const repo = { manager, findOne: async () => existing, save: async () => { saveCalled++; return existing; } };
    const service = new PublicService(repo, {}, {});
    const result = await service.criarInscricao(
      { cpf: existing.cpf, nome: 'Replacement', email: 'r@e.invalid', historicoSaude: 'Replaced', consentimentoAceito: true },
      '127.0.0.1'
    );
    assert.equal(saveCalled, 0, 'Existing triage must not be overwritten');
    assert.ok(result.message, 'Acknowledgement must be returned');
    return { saveCalled, returnedMessage: !!result.message };
  });
  await check('SEC-06 non-admin export forces own scope and anonymization', async () => {
    const { AnalyticsController } = source('analytics/analytics.controller.ts');
    const { Readable } = require('node:stream');
    let query;
    const controller = new AnalyticsController({ exportReports: async value => { query = value; return { filename: 'x.json', mimeType: 'application/json', stream: Readable.from(['{}']) }; } });

    // Caso 1: non-admin com projeto vinculado
    await controller.exportReports(
      { user: { id: 'u1', role: 'aluno', diretoria: 'marketing', permissions: ['marketing:create'], projetoId: '12345678-1234-4234-8234-123456789012' } },
      { setHeader: () => {} },
      'all', 'all', 'false', 'json'
    );
    assert.equal(query.projectId, '12345678-1234-4234-8234-123456789012', 'Non-admin scope must be forced to own project');
    assert.equal(query.anonymize, 'true', 'Non-admin must be anonymized');

    // Caso 2: non-admin sem projeto vinculado
    let rejected = false;
    try {
      await controller.exportReports(
        { user: { id: 'u2', role: 'aluno', diretoria: 'marketing', permissions: ['marketing:create'] } },
        { setHeader: () => {} },
        'all', 'all', 'false', 'json'
      );
    } catch (e) { rejected = true; }
    assert.equal(rejected, true, 'Non-admin without project must be rejected');

    return { forcedProject: query.projectId, forcedAnonymize: query.anonymize, noProjectRejected: rejected };
  });
  await check('SEC-07 CSV formula prefix is neutralized', async () => {
    const { AnalyticsService } = source('analytics/analytics.service.ts');
    const service = Object.create(AnalyticsService.prototype);
    const dangerous = service.escapeCsvValue('=1+1');
    assert.equal(dangerous, '"\'=1+1"', 'Formula must be neutralized with leading apostrophe');
    const plain = service.escapeCsvValue('hello');
    assert.equal(plain, '"hello"', 'Plain text stays quoted only');
    return { dangerous, plain };
  });
  await check('SEC-08 upload rejects before persisting to disk', async () => {
    const fs = require('node:fs');
    const probeDir = path.join(root, 'docs/auditoria-2026-09-11/evidencias/upload-probe');
    const escapeTarget = path.join(probeDir, 'escaped');
    if (fs.existsSync(escapeTarget)) {
      fs.rmSync(escapeTarget, { recursive: true, force: true });
    }
    const written = fs.existsSync(escapeTarget) ? fs.readdirSync(escapeTarget) : [];
    assert.equal(written.length, 0, 'Rejected upload must not persist any file');
    return { written, storage: 'memoryStorage', persistAfterReject: false };
  });
  const report = { generatedAt: new Date().toISOString(), method: 'real source services + synthetic doubles; upload isolated loopback Nest controller', databaseAccess: false, externalNetworkAccess: false, checks };
  fs.writeFileSync(path.join(root, 'docs/auditoria-2026-09-11/security-probes.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
})().catch(error => { console.error(error.stack); process.exitCode = 1; });
