const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const path = require('node:path');
const serverRequire = createRequire(path.resolve('server/package.json'));
serverRequire('ts-node').register({ project: path.resolve('server/tsconfig.json'), transpileOnly: true });
serverRequire('reflect-metadata');
const bcrypt = serverRequire('bcryptjs');
const { createHash } = require('node:crypto');
const { CredentialsService } = require('../server/src/credentials/credentials.service.ts');
const { UsersService } = require('../server/src/users/users.service.ts');
const { UsersController } = require('../server/src/users/users.controller.ts');
const { AuthService } = require('../server/src/auth/auth.service.ts');
const { MailService } = require('../server/src/mail/mail.service.ts');
const { RecoverPasswordDto } = require('../server/src/auth/dto/recover-password.dto.ts');
const { validate } = serverRequire('class-validator');

let checks = 0;
async function check(name, run) { await run(); checks++; process.stdout.write(`OK ${name}\n`); }

async function fixture() {
  let state = {
    user: { id: 'user-1', email: 'membro@laines.ufrn.br', recoveryEmail: 'contato@example.test', name: '<Membro>',
      passwordHash: await bcrypt.hash('Inicial123!', 4), tempPassword: null, mustChangePassword: true,
      sessionVersion: 1, status: 'ativo', deletedAt: null },
    token: null, revoked: false
  };
  let tail = Promise.resolve();
  const sent = [];
  let failRevoke = false;
  let deliver = true;
  const query = async (sql, args) => {
    if (sql.startsWith('INSERT')) {
      state.token = { user_id: args[0], token_hash: args[1], expires_at: args[2], session_version: args[3] }; return [];
    }
    if (sql.startsWith('SELECT')) return state.token?.token_hash === args[0] ? [{ ...state.token }] : [];
    if (sql.startsWith('UPDATE refresh_tokens')) {
      if (failRevoke) throw new Error('synthetic failure');
      state.revoked = true; return [];
    }
    if (sql.startsWith('DELETE')) {
      if (state.token && (state.token.token_hash === args[0] || state.token.user_id === args[0])) state.token = null;
      return [];
    }
    throw new Error(`Unexpected SQL: ${sql}`);
  };
  const repo = {
    findOne: async ({ where, lock }) => {
      assert.equal(lock.mode, 'pessimistic_write');
      return state.user.id === where.id ? { ...state.user } : null;
    },
    update: async (id, changes) => { assert.equal(id, state.user.id); Object.assign(state.user, changes); }
  };
  const source = {
    query,
    transaction: (run) => {
      const task = tail.then(async () => {
        const snapshot = structuredClone(state);
        try { return await run({ getRepository: () => repo, query }); }
        catch (error) { state = snapshot; throw error; }
      });
      tail = task.catch(() => {});
      return task;
    }
  };
  const service = new CredentialsService(source, { sendAccountLink: async (options) => {
    sent.push(options); return deliver;
  } });
  return { service, sent, get state() { return state; }, set failRevoke(value) { failRevoke = value; },
    set deliver(value) { deliver = value; }, issue: async () => { await service.issue(state.user.id); return sent.at(-1)?.token; } };
}

(async () => {
  await check('desafio usa 256 bits, somente hash persistido, destinatario registrado', async () => {
    const f = await fixture(); const token = await f.issue();
    assert.match(token, /^[a-f0-9]{64}$/);
    assert.equal(f.state.token.token_hash, createHash('sha256').update(token).digest('hex'));
    assert.notEqual(f.state.token.token_hash, token);
    assert.equal(f.sent[0].toEmail, f.state.user.recoveryEmail);
    assert.equal(f.state.user.tempPassword, null);
    assert.ok(f.state.token.expires_at.getTime() <= Date.now() + 15 * 60000);
  });
  await check('consumo altera hash, revoga sessoes e bloqueia reutilizacao', async () => {
    const f = await fixture(); const token = await f.issue();
    await f.service.consume(token, 'NovaSenha123!');
    assert.equal(await bcrypt.compare('NovaSenha123!', f.state.user.passwordHash), true);
    assert.equal(f.state.user.sessionVersion, 2); assert.equal(f.state.revoked, true);
    assert.equal(f.state.user.mustChangePassword, false); assert.equal(f.state.token, null);
    await assert.rejects(f.service.consume(token, 'OutraSenha123!'));
  });
  await check('dados cadastrais e token adulterado nao redefinem senha', async () => {
    const dto = Object.assign(new RecoverPasswordDto(), { identifier: 'membro@example.test', cpf: '12345678901',
      dataNascimento: '2000-01-01', newPassword: 'NovaSenha123!' });
    assert.ok((await validate(dto, { whitelist: true, forbidNonWhitelisted: true })).length >= 4);
    const f = await fixture(); await f.issue(); const original = f.state.user.passwordHash;
    await assert.rejects(f.service.consume('a'.repeat(64), 'NovaSenha123!'));
    await assert.rejects(f.service.consume(undefined, 'NovaSenha123!'));
    assert.equal(f.state.user.passwordHash, original);
  });
  for (const reason of ['expirado', 'inativo', 'versao revogada', 'excluido']) {
    await check(`desafio ${reason} rejeitado`, async () => {
      const f = await fixture(); const token = await f.issue();
      if (reason === 'expirado') f.state.token.expires_at = new Date(0);
      if (reason === 'inativo') f.state.user.status = 'inativo';
      if (reason === 'versao revogada') f.state.user.sessionVersion++;
      if (reason === 'excluido') f.state.user.deletedAt = new Date();
      await assert.rejects(f.service.consume(token, 'NovaSenha123!'));
      assert.equal(f.state.revoked, false);
    });
  }
  await check('reenvio invalida link anterior', async () => {
    const f = await fixture(); const first = await f.issue(); const second = await f.issue();
    assert.notEqual(first, second); await assert.rejects(f.service.consume(first, 'NovaSenha123!'));
    await f.service.consume(second, 'NovaSenha123!');
  });
  await check('duas tentativas concorrentes tem um vencedor (double transacional)', async () => {
    const f = await fixture(); const token = await f.issue();
    const results = await Promise.allSettled([f.service.consume(token, 'NovaSenha123!'), f.service.consume(token, 'OutraSenha123!')]);
    assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  });
  await check('falha na revogacao reverte senha e consumo (double transacional)', async () => {
    const f = await fixture(); const token = await f.issue(); const original = f.state.user.passwordHash;
    f.failRevoke = true; await assert.rejects(f.service.consume(token, 'NovaSenha123!'));
    assert.equal(f.state.user.passwordHash, original); assert.ok(f.state.token);
    f.failRevoke = false; await f.service.consume(token, 'NovaSenha123!');
  });
  await check('entrega indisponivel nao retorna segredo e remove desafio', async () => {
    const f = await fixture(); f.deliver = false;
    assert.deepEqual(await f.service.issue(f.state.user.id), { delivery: 'unavailable' });
    assert.equal(f.state.token, null);
    f.state.user.recoveryEmail = null; assert.deepEqual(await f.service.issue(f.state.user.id), { delivery: 'unavailable' });
  });
  await check('API publica tem resposta generica e limitacao por IP sem dados em logs', async () => {
    const calls = []; let current = null; let issued = 0;
    const auth = new AuthService({ findByEmail: async () => current }, {}, {
      assertNotBlocked: async (...args) => calls.push(args), registerFailure: async () => {}, clear: async () => {}
    }, { get: () => undefined }, {}, undefined, undefined, { issue: async () => { issued++; } });
    const missing = await auth.requestPasswordRecovery({ identifier: 'membro@laines.ufrn.br' }, '127.0.0.1');
    current = { id: 'user-1', status: 'ativo' };
    assert.deepEqual(await auth.requestPasswordRecovery({ identifier: 'membro@laines.ufrn.br' }, '127.0.0.1'), missing);
    current.status = 'inativo';
    assert.deepEqual(await auth.requestPasswordRecovery({ identifier: 'membro@laines.ufrn.br' }, '127.0.0.1'), missing);
    assert.equal(issued, 1); assert.equal(calls[0][1], '127.0.0.1'); assert.ok(!calls[0][0].includes('membro'));
  });
  await check('listagem e detalhe nunca serializam hash ou senha legada', async () => {
    const f = await fixture(); const users = new UsersService({}, {}, {}, {});
    for (const flag of [true, false]) {
      const projected = users.toPublic({ ...f.state.user, tempPassword: 'LEGACY' }, flag);
      assert.equal(Object.hasOwn(projected, 'tempPassword'), false); assert.equal(Object.hasOwn(projected, 'passwordHash'), false);
    }
    const controller = new UsersController({ findAll: async () => [f.state.user], findPublicById: async () => f.state.user });
    const req = { user: { role: 'aluno', permissions: ['admin:access'] } };
    const listed = await controller.findAll(req);
    assert.equal(Object.hasOwn(listed[0], 'recoveryEmail'), false);
    assert.equal(Object.hasOwn(await controller.findOne(req, 'user-1'), 'passwordHash'), false);
  });

  await check('edicao administrativa preserva cadastro; delegado recebe apenas projecao minima', async () => {
    const f = await fixture();
    const personal = { ...f.state.user, cpf: '00000000191', dataNascimento: '2000-01-01' };
    const query = { orderBy() { return this; }, take() { return this; }, skip() { return this; }, getMany: async () => [personal] };
    const service = new UsersService({ createQueryBuilder: () => query }, {}, {}, {});
    service.findByIdCached = async () => personal;
    const controller = new UsersController(service);
    const admin = { user: { id: 'admin', role: 'admin' } };
    const member = (await controller.findAll(admin))[0];
    assert.equal(member.cpf, personal.cpf);
    assert.equal((await controller.findOne(admin, personal.id)).dataNascimento, personal.dataNascimento);
    assert.equal(Object.hasOwn(member, 'passwordHash'), false);
    assert.equal(Object.hasOwn(member, 'tempPassword'), false);
    const delegated = { user: { id: 'member', role: 'aluno', permissions: ['admin:access'] } };
    const reduced = await controller.findOne(delegated, personal.id);
    for (const key of ['cpf', 'dataNascimento', 'recoveryEmail', 'passwordHash', 'tempPassword']) assert.equal(Object.hasOwn(reduced, key), false);
  });
  await check('criacao administrativa e reenvio retornam estado de entrega sem senha', async () => {
    const f = await fixture(); let saved;
    const users = new UsersService({}, {}, {}, {}, undefined, { issue: async () => ({ delivery: 'sent' }) });
    users.buildAvailableInstitutionalEmail = async () => 'membro@laines.ufrn.br';
    users.create = async (payload) => { saved = { ...payload, id: 'user-1' }; return saved; };
    users.resolveAlunoVinculosOrThrow = async () => null;
    users.resolveProfissionalSupervisorOrThrow = async () => ({});
    const created = await users.createWithTempPassword({ name: 'Membro', role: 'admin', email: 'contato@example.test' });
    assert.equal(saved.tempPassword, null); assert.equal(saved.recoveryEmail, 'contato@example.test');
    assert.equal(Object.hasOwn(created, 'tempPassword'), false); assert.equal(created.activation.delivery, 'sent');
    users.findById = async () => f.state.user;
    const reset = await users.resetTemporaryPassword('user-1');
    assert.equal(Object.hasOwn(reset, 'tempPassword'), false); assert.equal(reset.activation.delivery, 'sent');
  });
  await check('email usa fragmento, escapa HTML e recusa APP_URL insegura', async () => {
    const settings = { 'mail.enabled': false, 'mail.appUrl': 'https://app.example.test' };
    const mail = new MailService({ get: (key) => settings[key] }); let message;
    mail.enabled = true; mail.transporter = { sendMail: async (value) => { message = value; } };
    await mail.sendAccountLink({ toEmail: 'contato@example.test', nome: '<script>', loginEmail: 'login@example.test', token: 'b'.repeat(64), activation: true });
    assert.ok(message.html.includes('/recuperar-senha#token=')); assert.ok(!message.html.includes('<script>'));
    assert.ok(!message.text.includes('Senha temporaria'));
    settings['mail.appUrl'] = 'http://app.example.test';
    await assert.rejects(mail.sendAccountLink({ token: 'b'.repeat(64) }));
  });
  process.stdout.write(`${checks} verificacoes de credenciais aprovadas. Nenhum banco externo ou email real utilizado.\n`);
})().catch((error) => { console.error(error); process.exitCode = 1; });
