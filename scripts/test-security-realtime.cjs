// Regressao UPD-02: fonte real, repositorios sinteticos, sem banco ou e-mail.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const path = require('node:path');
require('../server/node_modules/ts-node').register({ project: path.resolve(__dirname, '../server/tsconfig.json'), transpileOnly: true });
require('../server/node_modules/reflect-metadata');
const { JwtService } = require('../server/node_modules/@nestjs/jwt');
const { RealtimeGateway } = require('../server/src/realtime/realtime.gateway');
const { JwtStrategy } = require('../server/src/auth/jwt.strategy');
const { RefreshTokensService } = require('../server/src/auth/refresh-tokens.service');
const { ClinicalAlertsService } = require('../server/src/avaliacoes/clinical-alerts.service');

function fixture() {
  const users = new Map(['a','b','athlete'].map((id) => [id, { id, role: id === 'athlete' ? 'atleta' : 'professor', status: 'ativo', sessionVersion: 1 }]));
  const patient = { id: 'patient', professorSupervisorId: 'a', atletaUserId: 'athlete', equipeMultiIds: [] };
  const revoked = new Set();
  const config = { get: (key) => ({ 'jwt.secret': 'synthetic-secret', 'jwt.issuer': 'test', 'jwt.audience': 'test', nodeEnv: 'production', corsOrigin: 'https://laines.test' })[key] };
  const jwt = new JwtService({ secret: 'synthetic-secret', signOptions: { issuer: 'test', audience: 'test' } });
  const usersService = { findById: async (id) => users.get(id) };
  const refresh = { isFamilyActive: async (id, sid) => sid === 'session' && !revoked.has(id) };
  const gateway = new RealtimeGateway(config, jwt, usersService, refresh, { findOne: async () => patient });
  const sockets = new Map();
  let middleware;
  gateway.afterInit({ sockets: { sockets }, use: (fn) => { middleware = fn; } });
  const socket = (id) => {
    const item = { id, data: { session: { userId: id, familyId: 'session', version: 1, expiresAt: Date.now()+60000 } }, events: [], closed: false,
      handshake: { headers: { origin: 'https://laines.test' }, auth: {} },
      emit: (...args) => item.events.push(args), disconnect: () => { item.closed = true; }, once: () => {} };
    sockets.set(id, item); return item;
  };
  return { gateway, users, patient, revoked, jwt, socket, config, usersService, refresh, authenticate: (s) => new Promise((resolve) => middleware(s, resolve)) };
}

test('equipes distintas: invalidacao minima somente para vinculado; remocao interrompe entrega', async () => {
  const f=fixture();
  try {
    const a=f.socket('a'), b=f.socket('b');
    await f.gateway.emit('avaliacoes.updated', { pacienteId:'patient', nome:'DADO SIGILOSO', dados:{ diagnostico:'X' } });
    assert.deepEqual(a.events, [['avaliacoes.updated',{invalidate:true}]]);
    assert.deepEqual(b.events, []);
    f.patient.professorSupervisorId='b';
    await f.gateway.emit('avaliacoes.updated',{pacienteId:'patient'});
    assert.equal(a.events.length,1); assert.equal(b.events.length,1);
  } finally { f.gateway.onModuleDestroy(); }
});

test('revogacao, senha pendente, inativacao, versao e expiracao impedem evento e desconectam', async () => {
  for (const mutate of [f=>f.revoked.add('a'), f=>{f.users.get('a').mustChangePassword=true;}, f=>{f.users.get('a').status='inativo';}, f=>{f.users.get('a').sessionVersion=2;}, (f,s)=>{s.data.session.expiresAt=0;}]) {
    const f=fixture();
    try { const s=f.socket('a'); mutate(f,s); await f.gateway.emit('pacientes.updated',{id:'patient'}); assert.equal(s.closed,true); assert.deepEqual(s.events,[]); }
    finally { f.gateway.onModuleDestroy(); }
  }
});

test('handshake valida tipo, origem, assinatura, familia e senha pendente', async () => {
  const f=fixture();
  try {
    const s=f.socket('a');
    const claims={sub:'a',sv:1,sid:'session',typ:'access'};
    s.handshake.auth.token=f.jwt.sign(claims,{expiresIn:60}); assert.equal(await f.authenticate(s),undefined);
    for (const payload of [{...claims,typ:'refresh'},{...claims,sid:undefined},{...claims,sv:9}]) {
      s.handshake.auth.token=f.jwt.sign(payload,{expiresIn:60}); assert.ok(await f.authenticate(s));
    }
    s.handshake.auth.token=f.jwt.sign(claims,{expiresIn:60});
    s.handshake.headers.origin='https://intruso.test'; assert.ok(await f.authenticate(s));
    s.handshake.headers.origin='https://laines.test'; f.users.get('a').mustChangePassword=true; assert.ok(await f.authenticate(s));
  } finally { f.gateway.onModuleDestroy(); }
});

test('notificacao privada e tarefa de outra diretoria nao chegam a terceiros; evento desconhecido fechado', async () => {
  const f=fixture();
  try {
    const a=f.socket('a'), b=f.socket('b'); f.users.get('a').role='aluno'; f.users.get('a').diretoria='ensino';
    await f.gateway.emit('notificacoes.created',{userId:'a',mensagem:'sigilosa'});
    await f.gateway.emit('tarefas.created',{assignedRole:'diretoria_ensino',title:'interna'});
    await f.gateway.emit('desconhecido.created',{secret:'sigilo'});
    assert.equal(a.events.length,2); assert.equal(b.events.length,0);
    assert.ok(a.events.every(([,payload])=>JSON.stringify(payload)==='{"invalidate":true}'));
  } finally { f.gateway.onModuleDestroy(); }
});

test('tarefas institucionais nao notificam atleta nem papel externo com diretoria indevida', async () => {
  const f=fixture();
  try {
    const athlete=f.socket('athlete'), professor=f.socket('a'), student=f.socket('b');
    f.users.get('athlete').diretoria='ensino';
    f.users.get('athlete').coordAtendimento=true;
    f.users.get('a').diretoria='ensino';
    f.users.get('b').role='aluno';
    f.users.get('b').diretoria='ensino';
    await f.gateway.emit('tarefas.created',{id:'task-1',assignedRole:'todos',title:'nao enviar'});
    await f.gateway.emit('tarefas.updated',{id:'task-2',assignedRole:'diretoria_ensino',completionNote:'nao enviar'});
    await f.gateway.emit('tarefas.updated',{id:'task-3',assignedRole:'coord_atendimento'});
    assert.deepEqual(athlete.events, []);
    assert.deepEqual(professor.events, [['tarefas.created',{invalidate:true}]]);
    assert.deepEqual(student.events, [
      ['tarefas.created',{invalidate:true}], ['tarefas.updated',{invalidate:true}]
    ]);
  } finally { f.gateway.onModuleDestroy(); }
});

test('atleta recebe agenda propria mas nao evento de avaliacao', async () => {
  const f=fixture();
  try {
    const s=f.socket('athlete'); await f.gateway.emit('avaliacoes.updated',{pacienteId:'patient'});
    await f.gateway.emit('agendamentos.deleted',{pacienteId:'patient',id:'consult'});
    assert.deepEqual(s.events,[['agendamentos.deleted',{invalidate:true}]]);
  } finally { f.gateway.onModuleDestroy(); }
});

test('HTTP consulta revogacao da mesma familia e rejeita access antigo sem sid', async () => {
  const f=fixture();
  try {
    const strategy = new JwtStrategy(f.config,f.usersService,f.refresh);
    const claims={sub:'a',sv:1,sid:'session',typ:'access'};
    assert.equal((await strategy.validate(claims)).id,'a');
    f.revoked.add('a'); await assert.rejects(strategy.validate(claims),/Sessao encerrada/);
    await assert.rejects(strategy.validate({...claims,sid:undefined}),/Sessao encerrada/);
    await assert.rejects(strategy.validate({...claims,typ:'refresh'}),/Credencial invalida/);
  } finally { f.gateway.onModuleDestroy(); }
});

test('logout com refresh ja rotacionado revoga toda familia, preservando outras', async () => {
  const f=fixture();
  try {
    const service=new RefreshTokensService({findOne:async()=>({userId:'a',familyId:'family-a',usedAt:new Date()})},f.jwt,f.config);
    const revoked=[]; service.revokeFamilyForUser=async(...args)=>revoked.push(args);
    await service.revokeCurrent('rt_'+ 'a'.repeat(64));
    assert.deepEqual(revoked,[['a','family-a']]);
  } finally { f.gateway.onModuleDestroy(); }
});

test('alerta clinico usa somente destinatarios vinculados e nao persiste identificacao', async () => {
  const sent=[];
  const alerts=new ClinicalAlertsService({createForUsers:async(...args)=>sent.push(args),createForRoles:()=>assert.fail('broadcast por papel')});
  await alerts.dispatch({status:'finalizada',tipo:'triagem_reds',classificacao:'alto_risco'},{nome:'Paciente Sigiloso',professorSupervisorId:'a'});
  assert.equal(sent.length,1); assert.deepEqual(sent[0][0],['a']); assert.ok(!JSON.stringify(sent).includes('Paciente Sigiloso'));
  await alerts.dispatch({status:'finalizada',tipo:'triagem_reds',classificacao:'alto_risco'},{nome:'Outro'}); assert.equal(sent.length,1);
});
