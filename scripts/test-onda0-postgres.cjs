// Integracao destrutiva SOMENTE no banco temporario nomeado abaixo.
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { randomUUID, createHash } = require('node:crypto');
const { setTimeout: delay } = require('node:timers/promises');
const { once } = require('node:events');
const { io } = require('socket.io-client');
require('../server/node_modules/ts-node').register({ project: path.resolve(__dirname, '../server/tsconfig.json'), transpileOnly: true });
const { DataSource } = require('../server/node_modules/typeorm');
const bcrypt = require('../server/node_modules/bcryptjs');
const { User } = require('../server/src/users/user.entity');
const { Paciente } = require('../server/src/pacientes/paciente.entity');
const { Avaliacao } = require('../server/src/avaliacoes/avaliacao.entity');
const { PlanoAlimentar } = require('../server/src/planos-alimentares/plano-alimentar.entity');
const { Taco } = require('../server/src/taco/taco.entity');
const { Projeto } = require('../server/src/projetos/projeto.entity');
const { CredentialsService } = require('../server/src/credentials/credentials.service');
const { PlanoAlimentarService } = require('../server/src/planos-alimentares/plano-alimentar.service');
const base = process.env.ONDA0_API_URL;
assert.equal(process.env.DB_HOST, '127.0.0.1');
assert.equal(process.env.DB_NAME, 'laines_onda0');
assert.equal(process.env.DB_PORT, '55439');
assert.equal(base, 'http://127.0.0.1:44100');
const db = new DataSource({ type:'postgres',host:'127.0.0.1',port:55439,username:'laines_test',password:'synthetic-only',database:'laines_onda0',
  entities:[path.resolve(__dirname,'../server/src/**/*.entity.ts')], synchronize:false, migrationsRun:false });
const sockets=[];
let count=0;
const check=async(name,fn)=>{await fn();count++;console.log('PASS '+name);};
const login=async(email,password)=>{
  const response=await fetch(base+'/auth/login',{method:'POST',headers:{'content-type':'application/json','x-auth-flow':'v2'},body:JSON.stringify({email,password})});
  const body=await response.json();
  assert.equal(response.status,201,`Login sintetico ${email}: ${response.status} ${body.message || ''}`);
  assert.ok(body.accessToken);return body.accessToken;
};
const connect=async(token)=>{
  const socket=io(base,{auth:{token:'Bearer '+token},transports:['websocket'],reconnection:false,timeout:4000,autoConnect:false});
  sockets.push(socket);
  await new Promise((resolve,reject)=>{socket.once('connect',resolve);socket.once('connect_error',reject);socket.connect();});
  return socket;
};
const me=token=>fetch(base+'/auth/me',{headers:{authorization:'Bearer '+token}});
const phase = process.env.ONDA0_PHASE || 'seed';
assert.ok(['seed', 'verify-restored'].includes(phase), 'Fase de integracao invalida');
const manifestPath = process.env.ONDA0_MANIFEST;
const uploadsRoot = process.env.UPLOAD_DIR;
const tmpRoot = path.resolve(__dirname, '../tmp') + path.sep;
for (const [label, value] of Object.entries({ ONDA0_MANIFEST: manifestPath, UPLOAD_DIR: uploadsRoot })) {
  assert.ok(value && path.isAbsolute(value) && path.resolve(value).startsWith(tmpRoot), `${label} deve ficar no tmp isolado do projeto`);
}
const digest = value => createHash('sha256').update(value).digest('hex');
// Mesmo payload do painel de restricoes: a ausencia de anamnese permanece
// explicita; a fixture registra uma restricao conferida, sem fabricar carimbo.
const syntheticRestrictions = () => ({
  origem: { descricao: '', avaliacaoId: null, data: null },
  semRestricao: false,
  grupos: ['leites'],
  alimentoIds: [],
  observacao: 'Conferencia exclusivamente sintetica: excluir leites. Sem anamnese finalizada nesta fixture.',
  justificativas: {}
});
const api = (token, route, method = 'GET', body) => fetch(base + route, {
  method, headers: { authorization: 'Bearer ' + token, ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
  ...(body === undefined ? {} : { body: JSON.stringify(body) })
});
const json = async (token, route, method = 'GET', body, status = method === 'POST' ? 201 : 200) => {
  const response = await api(token, route, method, body);
  const text = await response.text();
  assert.equal(response.status, status, `${method} ${route}: ${response.status} ${text}`);
  return JSON.parse(text);
};
const denied = async (token, route, method = 'GET', body) => {
  const response = await api(token, route, method, body);
  assert.ok([403, 404].includes(response.status), `${method} ${route}: acesso indevido (${response.status})`);
  await response.arrayBuffer();
};
const assertAbsent = async (token, route, ids) => {
  const response = await api(token, route);
  const rows = await response.json();
  if (route === '/avaliacoes' && response.status === 400) {
    assert.match(rows.message, /Perfil atleta deve informar pacienteId ou projetoId/);
    return;
  }
  assert.equal(response.status, 200, `${route}: listagem falhou (${response.status})`);
  assert.ok(Array.isArray(rows), `${route} deve retornar lista`);
  for (const id of ids) assert.ok(!rows.some(row => row.id === id), `${route} expos registro sem vinculo ${id}`);
};
const pdfText = bytes => {
  const { inflateSync } = require('node:zlib');
  const texts = [];
  for (const stream of bytes.toString('latin1').matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)) {
    let raw;
    try { raw = inflateSync(Buffer.from(stream[1], 'latin1')).toString('latin1'); } catch { continue; }
    texts.push([...raw.matchAll(/<([0-9a-f]+)>/gi)].map(hit => Buffer.from(hit[1], 'hex').toString('latin1')).join(''));
  }
  return texts.join('');
};
const assertPdf = async (token, team) => {
  const response = await api(token, `/planos-alimentares/${team.planId}/pdf?expectedVersion=${team.planVersion}`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  const bytes = Buffer.from(await response.arrayBuffer());
  assert.equal(bytes.subarray(0, 5).toString(), '%PDF-');
  const printed = pdfText(bytes);
  for (const value of [team.planId, team.food, team.professor.crn]) {
    assert.ok(printed.includes(value), 'PDF nao preservou ' + value);
  }
};
const assertAttachment = async (token, team) => {
  const response = await api(token, `/pacientes/${team.patientId}/anexos/${encodeURIComponent(team.attachment.filename)}`);
  assert.equal(response.status, 200);
  assert.equal(digest(Buffer.from(await response.arrayBuffer())), team.attachment.sha256);
};
const denyObjects = async (token, team) => {
  await denied(token, `/pacientes/${team.patientId}`);
  await denied(token, `/avaliacoes/${team.evaluationId}`);
  await denied(token, `/planos-alimentares/${team.planId}`);
  await denied(token, `/planos-alimentares/${team.planId}/pdf?expectedVersion=${team.planVersion}`);
  await denied(token, `/pacientes/${team.patientId}/anexos/${encodeURIComponent(team.attachment.filename)}`);
  await assertAbsent(token, '/pacientes', [team.patientId]);
  await assertAbsent(token, '/avaliacoes', [team.evaluationId]);
  await assertAbsent(token, '/planos-alimentares', [team.planId]);
  // A listagem filtrada pode negar o objeto ou devolver uma lista vazia.
  for (const resource of ['avaliacoes', 'planos-alimentares']) {
    const response = await api(token, `/${resource}?pacienteId=${team.patientId}`);
    if (response.status === 200) assert.deepEqual(await response.json(), []);
    else { assert.ok([403, 404].includes(response.status)); await response.arrayBuffer(); }
  }
};
const authenticateTeams = async manifest => {
  const tokens = {};
  for (const team of manifest.teams) {
    tokens[team.key] = {};
    for (const role of ['professor', 'student', 'athlete']) {
      tokens[team.key][role] = await login(team[role].email, manifest.password);
    }
  }
  return tokens;
};
const verifyTransferred = async (manifest, tokens) => {
  const [a, b] = manifest.teams;
  for (const role of ['professor', 'student']) {
    await denyObjects(tokens.A[role], a);
    await denyObjects(tokens.A[role], b);
    for (const team of [a, b]) {
      const patient = await json(tokens.B[role], `/pacientes/${team.patientId}`);
      assert.equal(patient.alunoResponsavelId, b.student.id);
      assert.equal(patient.professorSupervisorId, b.professor.id);
      const evaluation = await json(tokens.B[role], `/avaliacoes/${team.evaluationId}`);
      assert.equal(evaluation.alunoId, team.student.id, 'Transferencia nao deve reescrever autoria historica');
      assert.equal(evaluation.revisadoPorId, team.professor.id);
      assert.equal(evaluation.status, 'finalizada');
      assert.equal(evaluation.dados.tmbBaseKcal, 1400);
      assert.equal(evaluation.dados.getEstimadoKcal, 2100);
      const plan = await json(tokens.B[role], `/planos-alimentares/${team.planId}`);
      assert.equal(plan.status, 'ativo');
      assert.deepEqual(plan.entrega, team.delivery);
      await assertAttachment(tokens.B[role], team);
      await assertPdf(tokens.B[role], team);
    }
  }
  // Transferir a equipe clinica nao troca a identidade do paciente/atleta.
  for (const [own, other] of [[a, b], [b, a]]) {
    await denyObjects(tokens[own.key].athlete, other);
    assert.equal((await json(tokens[own.key].athlete, `/pacientes/${own.patientId}`)).id, own.patientId);
    const plan = await json(tokens[own.key].athlete, `/planos-alimentares/${own.planId}`);
    assert.deepEqual(plan.entrega, own.delivery);
    await assertAttachment(tokens[own.key].athlete, own);
    await assertPdf(tokens[own.key].athlete, own);
  }
};
const assertSocketScope = async (connections, recipientKeys, operation) => {
  const received = new Map(connections.map(({ key }) => [key, []]));
  const listeners = connections.map(({ key, socket }) => {
    const handler = payload => received.get(key).push(payload);
    socket.on('pacientes.updated', handler);
    return { socket, handler };
  });
  try {
    await operation();
    const until = Date.now() + 5000;
    while (recipientKeys.some(key => received.get(key).length === 0) && Date.now() < until) await delay(50);
    // Mantem uma janela negativa apos a entrega positiva, sem aceitar timeout como sucesso.
    await delay(500);
    for (const { key } of connections) {
      const payloads = received.get(key);
      if (recipientKeys.includes(key)) assert.ok(payloads.length > 0, `Socket ${key} nao recebeu invalidacao autorizada`);
      else assert.equal(payloads.length, 0, `Socket ${key} recebeu evento de paciente sem vinculo`);
      for (const payload of payloads) assert.deepEqual(payload, { invalidate: true }, 'Socket expos dados clinicos');
    }
  } finally {
    for (const { socket, handler } of listeners) socket.off('pacientes.updated', handler);
  }
};

const realJourneys = async () => {
  const password = 'Synthetic#934';
  const suffix = randomUUID();
  const users = db.getRepository(User);
  const hash = await bcrypt.hash(password, 10);
  const makeUser = async (label, role, extra = {}) => {
    const user = await users.save(users.create({ name: `Sintetico ${label}`, email: `${label}-${suffix}@example.invalid`.toLowerCase(),
      passwordHash: hash, role, status: 'ativo', mustChangePassword: false, ...extra }));
    return { id: user.id, email: user.email, role: user.role, ...(user.crn ? { crn: user.crn } : {}) };
  };
  const manager = await makeUser('gestao', 'admin');
  const managerToken = await login(manager.email, password);
  const manifest = { version: 1, password, teams: [], transferred: false };
  for (const key of ['A', 'B']) {
    const professor = await makeUser(`professor-${key}`, 'professor', { crn: `SYNTHETIC-${key}` });
    const project = await db.getRepository(Projeto).save(db.getRepository(Projeto).create({ nome: `Projeto sintetico ${key}`, area: 'nutricao', status: 'ativo', coordenadorId: professor.id }));
    const student = await makeUser(`aluno-${key}`, 'aluno', { supervisorId: professor.id, projetoId: project.id, projetoNome: project.nome, curso: 'Nutricao' });
    const athlete = await makeUser(`atleta-${key}`, 'atleta');
    manifest.teams.push({ key, professor, student, athlete, projectId: project.id, food: `Alimento sintetico equipe ${key}` });
  }
  const tokens = await authenticateTeams(manifest);
  for (const team of manifest.teams) {
    await check(`UPD-20 equipe ${team.key}: cadastro HTTP, GET finalizada, revisao, plano publicado e portal/PDF`, async () => {
      const patient = await json(managerToken, '/pacientes', 'POST', {
        nome: `Paciente sintetico equipe ${team.key}`, cpf: team.key === 'A' ? '00000000272' : '00000000353',
        dataNascimento: '1998-02-10', sexoBiologico: 'feminino', status: 'Ativo',
        alunoResponsavelId: team.student.id, professorSupervisorId: team.professor.id,
        projetoId: team.projectId, atletaUserId: team.athlete.id
      });
      team.patientId = patient.id;
      assert.equal(patient.alunoResponsavelId, team.student.id);
      const evaluation = await json(tokens[team.key].student, '/avaliacoes', 'POST', {
        pacienteId: patient.id, tipo: 'gasto_energetico_total', status: 'finalizada',
        dados: { tmbBaseKcal: 1400, fatorAtividade: 1.5, getEstimadoKcal: 2100, choG: 250, ptnG: 100, lipG: 78, fibrasG: 25 }
      });
      team.evaluationId = evaluation.id;
      assert.equal(evaluation.status, 'finalizada');
      assert.equal(evaluation.meta.completude, 100);
      const reviewedEvaluation = await json(tokens[team.key].professor, `/avaliacoes/${evaluation.id}/revisar`, 'PATCH', {});
      assert.equal(reviewedEvaluation.revisadoPorId, team.professor.id);
      const context = await json(tokens[team.key].student, `/planos-alimentares/paciente/${patient.id}/contexto`);
      assert.equal(context.restricoes.pendenteRevisao, true, 'Ausencia de anamnese exige conferencia');
      assert.equal(context.restricoes.origem, null);
      const draft = await json(tokens[team.key].student, '/planos-alimentares', 'POST', {
        pacienteId: patient.id, status: 'em_revisao', dados: {
          restricoes: syntheticRestrictions(),
          orientacoesGerais: `Orientacao sintetica ${team.key}`, refeicoes: [{ nome: 'Refeicao sintetica', horario: '12:00',
            alimentos: [{ descricao: team.food, medidaCaseira: 'Porcao sintetica', quantidadeGramas: 1000,
              calorias: 2100, cho: 250, ptn: 100, lip: 78, fibra: 25 }] }]
        }
      });
      assert.equal(draft.dados.version, 1);
      assert.equal(draft.dados.restricoes.semRestricao, false);
      assert.equal(draft.dados.restricoes.conferidoPorId, team.student.id);
      assert.ok(draft.dados.restricoes.conferidoEm);
      await denied(tokens[team.key].athlete, `/planos-alimentares/${draft.id}`);
      await denied(tokens[team.key].student, `/planos-alimentares/${draft.id}/revisar`, 'POST', { expectedVersion: 1, confirmarComposicaoManual: true });
      const reviewed = await json(tokens[team.key].professor, `/planos-alimentares/${draft.id}/revisar`, 'POST', { expectedVersion: 1, confirmarComposicaoManual: true });
      assert.equal(reviewed.dados.revisaoFinal.confirmadoPorId, team.professor.id);
      const active = await json(tokens[team.key].professor, `/planos-alimentares/${draft.id}/ativar`, 'POST', { expectedVersion: reviewed.dados.version });
      team.planId = active.id;
      team.planVersion = active.dados.version;
      team.delivery = (await json(tokens[team.key].professor, `/planos-alimentares/${active.id}`)).entrega;
      assert.equal(active.status, 'ativo');
      assert.equal(team.planVersion, 3);
      const visible = await json(tokens[team.key].athlete, `/planos-alimentares?pacienteId=${patient.id}&status=ativo`);
      assert.deepEqual(visible.map(item => item.id), [active.id]);
      assert.deepEqual(visible[0].entrega, team.delivery);
      await assertPdf(tokens[team.key].professor, team);
      await assertPdf(tokens[team.key].athlete, team);
      const stale = await api(tokens[team.key].athlete, `/planos-alimentares/${active.id}/pdf?expectedVersion=2`);
      assert.equal(stale.status, 409);
      await stale.arrayBuffer();
      const bytes = Buffer.from(`%PDF-1.4\n% Anexo exclusivamente sintetico da equipe ${team.key}\n%%EOF\n`);
      const form = new FormData();
      form.append('file', new Blob([bytes], { type: 'application/pdf' }), `sintetico-${team.key}.pdf`);
      const upload = await fetch(`${base}/pacientes/${patient.id}/anexos`, { method: 'POST', headers: { authorization: 'Bearer ' + tokens[team.key].professor }, body: form });
      assert.equal(upload.status, 201, await upload.clone().text());
      const metadata = await upload.json();
      team.attachment = { filename: path.posix.basename(metadata.path), sha256: digest(bytes) };
      await assertAttachment(tokens[team.key].student, team);
    });
  }
  await check('UPD-20: mesmas roles de equipes distintas nao acessam IDs, listas, anexos ou PDFs entre si', async () => {
    const [a, b] = manifest.teams;
    for (const [own, other] of [[a, b], [b, a]]) {
      for (const role of ['professor', 'student', 'athlete']) await denyObjects(tokens[own.key][role], other);
      await denied(tokens[own.key].student, `/pacientes/${other.patientId}`, 'PATCH', { observacoes: 'Tentativa sintetica negada' });
      await denied(tokens[own.key].student, `/avaliacoes/${other.evaluationId}`, 'PATCH', { dados: { tmbBaseKcal: 999 } });
      await denied(tokens[own.key].student, `/planos-alimentares/${other.planId}`, 'PATCH', { expectedVersion: other.planVersion, metaCalorica: 999 });
    }
  });
  const connections = [];
  for (const team of manifest.teams) {
    for (const role of ['professor', 'student', 'athlete']) connections.push({ key: `${team.key}.${role}`, socket: await connect(tokens[team.key][role]) });
  }
  await check('UPD-20: websocket entrega apenas invalidacao a equipe/paciente vinculados, nos dois sentidos', async () => {
    for (const team of manifest.teams) {
      await assertSocketScope(connections, ['professor', 'student', 'athlete'].map(role => `${team.key}.${role}`),
        () => json(managerToken, `/pacientes/${team.patientId}`, 'PATCH', { observacoes: `Evento sintetico ${team.key}` }));
    }
  });
  await check('UPD-20: logout revoga HTTP/socket clinicos e preserva a outra sessao', async () => {
    const team = manifest.teams[0];
    const revoked = await login(team.student.email, password);
    const socket = await connect(revoked);
    const disconnected = once(socket, 'disconnect', { signal: AbortSignal.timeout(7000) });
    await json(revoked, '/auth/logout', 'POST');
    assert.equal((await api(revoked, `/pacientes/${team.patientId}`)).status, 401);
    await disconnected;
    assert.equal((await api(tokens.A.student, `/pacientes/${team.patientId}`)).status, 200);
    assert.equal(connections.find(item => item.key === 'A.student').socket.connected, true);
  });
  await check('UPD-20: transferencia revoga equipe antiga, inclusive autor historico e socket ja aberto', async () => {
    const [a, b] = manifest.teams;
    await assertSocketScope(connections, ['B.professor', 'B.student', 'A.athlete'], () => json(managerToken, `/pacientes/${a.patientId}`, 'PATCH', {
      alunoResponsavelId: b.student.id, professorSupervisorId: b.professor.id, projetoId: b.projectId
    }));
    manifest.transferred = true;
    await verifyTransferred(manifest, tokens);
  });
  await check('UPD-20: upload negado nao altera metadados nem deixa arquivo orfao', async () => {
    const [a, b] = manifest.teams;
    // A equipe A nao tem mais acesso a nenhum dos dois pacientes.
    for (const team of [a, b]) {
      const folder = path.join(uploadsRoot, 'pacientes', team.patientId, 'anexos');
      const before = fs.readdirSync(folder).sort();
      const patientBefore = await json(managerToken, `/pacientes/${team.patientId}`);
      const form = new FormData();
      form.append('file', new Blob(['%PDF-1.4\n% upload negado sintetico\n%%EOF\n'], { type: 'application/pdf' }), `negado-${randomUUID()}.pdf`);
      const response = await fetch(`${base}/pacientes/${team.patientId}/anexos`, { method: 'POST', headers: { authorization: 'Bearer ' + tokens.A.professor }, body: form });
      assert.ok([403, 404].includes(response.status));
      await response.arrayBuffer();
      assert.deepEqual((await json(managerToken, `/pacientes/${team.patientId}`)).anexos, patientBefore.anexos);
      assert.deepEqual(fs.readdirSync(folder).sort(), before, `Upload negado deixou arquivo orfao no paciente ${team.key}`);
    }
  });
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx' });
};

(async()=>{
  await db.initialize();
  if (phase === 'verify-restored') {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    assert.equal(manifest.version, 1);
    assert.equal(manifest.transferred, true);
    assert.equal(manifest.teams.length, 2);
    await check('UPD-21: mesmos pacientes, avaliacoes, planos/PDFs e anexos restaurados, com vinculos/revogacao preservados', async () => {
      await verifyTransferred(manifest, await authenticateTeams(manifest));
    });
    console.log(`${count} verificacao pos-restauracao passou; nenhum registro clinico criado.`);
    return;
  }
  const suffix=randomUUID();
  const password='Synthetic#934';
  const user=await db.getRepository(User).save(db.getRepository(User).create({name:'Pessoa sintetica',email:`synthetic-${suffix}@example.invalid`,
    recoveryEmail:`synthetic-${suffix}@example.invalid`,passwordHash:await bcrypt.hash(password,10),role:'professor',status:'ativo',mustChangePassword:false}));
  await check('migration aplicada e banco recusa senha em texto',async()=>{
    const rows=await db.query('SELECT name FROM migrations WHERE name=$1',['SecureAccountRecovery1789128000000']); assert.equal(rows.length,1);
    await assert.rejects(db.query('UPDATE users SET temp_password=$1 WHERE id=$2',['nao-persistir',user.id]),/users_no_plaintext_password/);
  });
  let tokenB;
  await check('HTTP e socket: logout de uma familia revoga A e preserva B',async()=>{
    const tokenA=await login(user.email,password);tokenB=await login(user.email,password);
    const socketA=await connect(tokenA);
    const disconnected=once(socketA,'disconnect',{signal:AbortSignal.timeout(7000)});
    assert.equal((await me(tokenA)).status,200);
    const logout=await fetch(base+'/auth/logout',{method:'POST',headers:{authorization:'Bearer '+tokenA}});assert.equal(logout.status,201);
    assert.equal((await me(tokenA)).status,401);assert.equal((await me(tokenB)).status,200);
    await disconnected;
  });
  await check('recuperacao PostgreSQL: concorrencia tem um vencedor e revoga HTTP/socket',async()=>{
    let token;
    const credentials=new CredentialsService(db,{sendAccountLink:async(input)=>{token=input.token;return true;}});
    assert.equal((await credentials.issue(user.id)).delivery,'sent');
    const socketB=await connect(tokenB);const disconnected=once(socketB,'disconnect',{signal:AbortSignal.timeout(7000)});
    const results=await Promise.allSettled([credentials.consume(token,'Changed#12345'),credentials.consume(token,'Changed#67890')]);
    assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
    assert.equal(results.filter(r=>r.status==='rejected').length,1);
    assert.equal((await db.query('SELECT * FROM password_recovery_tokens WHERE user_id=$1',[user.id])).length,0);
    assert.equal((await me(tokenB)).status,401);await disconnected;
    await assert.rejects(credentials.consume(token,'Repeated#12345'),/invalido ou expirado/);
  });
  await check('plano PostgreSQL: roundtrip legado e comparacao atomica de versao',async()=>{
    const patient=await db.getRepository(Paciente).save(db.getRepository(Paciente).create({prontuario:'SYN-'+suffix.slice(0,12),nome:'Paciente sintetico',cpf:'00000000191',status:'Ativo',professorSupervisorId:user.id}));
    const service=new PlanoAlimentarService(db.getRepository(PlanoAlimentar),db.getRepository(Paciente),db.getRepository(Avaliacao),db.getRepository(User),db.getRepository(Taco));
    const plano=await service.create({pacienteId:patient.id,dados:{refeicoes:[{nome:'Refeicao sintetica',orientacoes:'Preservar',alimentos:[{descricao:'Alimento sintetico',quantidadeGramas:100,calorias:100,cho:10,ptn:5,lip:2,fibra:1}]}]}},user);
    assert.equal(plano.dados.version,1);assert.equal(plano.resultados.totaisCalculados.calorias,100);
    const results=await Promise.allSettled([
      service.update(plano.id,{expectedVersion:1,metaCalorica:201},user),
      service.update(plano.id,{expectedVersion:1,metaCalorica:202},user)
    ]);
    assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.filter(r=>r.status==='rejected').length,1);
    const saved=await service.findById(plano.id,user);assert.equal(saved.dados.version,2);assert.equal(saved.dados.refeicoes[0].orientacoes,'Preservar');
    const pdf=await service.gerarPDF(plano.id,user);assert.equal(pdf.subarray(0,5).toString(),'%PDF-');
  });

  await check('UPD-10: publicacao, portal/PDF, copia imutavel e concorrencia transacional', async () => {
    const { inflateSync } = require('node:zlib');
    await db.getRepository(User).update(user.id, { crn: 'SYNTHETIC-TEST' });
    const athlete = await db.getRepository(User).save(db.getRepository(User).create({ name: 'Atleta sintetico',
      email: 'athlete-' + suffix + '@example.invalid', passwordHash: await bcrypt.hash(password, 10),
      role: 'atleta', status: 'ativo', mustChangePassword: false }));
    const patient = await db.getRepository(Paciente).save(db.getRepository(Paciente).create({
      prontuario: 'SYN-PLAN-' + suffix.slice(0, 8), nome: 'Paciente de teste', cpf: '00000000191', status: 'Ativo',
      professorSupervisorId: user.id, atletaUserId: athlete.id }));
    await db.getRepository(Avaliacao).save(db.getRepository(Avaliacao).create({ pacienteId: patient.id,
      tipo: 'gasto_energetico_total', status: 'finalizada',
      dados: { getEstimadoKcal: 100, choG: 10, ptnG: 5, lipG: 2, fibrasG: 1 } }));
    const plans = db.getRepository(PlanoAlimentar);
    const service = new PlanoAlimentarService(plans, db.getRepository(Paciente), db.getRepository(Avaliacao), db.getRepository(User), db.getRepository(Taco));
    const draft = await service.create({ pacienteId: patient.id, status: 'em_revisao', dados: {
      restricoes: syntheticRestrictions(),
      orientacoesGerais: 'Orientacao sintetica preservada', refeicoes: [{ nome: 'Refeicao de teste', horario: '12:00',
        orientacoes: 'Comer com calma', alimentos: [{ descricao: 'Alimento de teste', medidaCaseira: '2 fatias',
          quantidadeGramas: 100, calorias: 100, cho: 10, ptn: 5, lip: 2, fibra: 1 }] }] } }, user);
    assert.equal(draft.dados.restricoes.semRestricao, false);
    assert.equal(draft.dados.restricoes.conferidoPorId, user.id);
    assert.ok(draft.dados.restricoes.conferidoEm);
    const reviewed = await service.revisar(draft.id, 1, user, true);
    const active = await service.ativar(reviewed.id, user, reviewed.dados.version);
    const list = await service.findAll(athlete, { pacienteId: patient.id, status: 'ativo' });
    assert.equal(list.length, 1); assert.equal(list[0].id, active.id);
    assert.equal(list[0].entrega.version, 3);
    const food = list[0].entrega.refeicoes[0].alimentos[0];
    assert.equal(food.quantidadeGramas, 100); assert.equal(food.quantidadeMedidas, null); assert.equal(food.medidaCaseira, '2 fatias');
    const access = await login(athlete.email, password);
    const headers = { authorization: 'Bearer ' + access };
    const httpList = await fetch(base + '/planos-alimentares?pacienteId=' + patient.id + '&status=ativo', { headers });
    assert.equal(httpList.status, 200); const httpPlans = await httpList.json();
    assert.deepEqual(httpPlans[0].entrega, list[0].entrega);
    const stalePdf = await fetch(base + '/planos-alimentares/' + active.id + '/pdf?expectedVersion=2', { headers });
    assert.equal(stalePdf.status, 409);
    const response = await fetch(base + '/planos-alimentares/' + active.id + '/pdf?expectedVersion=3', { headers });
    assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'private, no-store');
    const pdf = Buffer.from(await response.arrayBuffer()); assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
    const texts = [];
    for (const stream of pdf.toString('latin1').matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)) {
      let raw; try { raw = inflateSync(Buffer.from(stream[1], 'latin1')).toString('latin1'); } catch { continue; }
      texts.push([...raw.matchAll(/<([0-9a-f]+)>/gi)].map(hit => Buffer.from(hit[1], 'hex').toString('latin1')).join(''));
    }
    const printed = texts.join('');
    for (const value of ['Alimento de teste', '2 fatias', 'Comer com calma', 'Orientacao sintetica preservada', active.id, 'SYNTHETIC-TEST']) assert.ok(printed.includes(value), 'PDF missing ' + value);
    const firstCopy = await service.update(active.id, { expectedVersion: 3, status: 'em_revisao', metaCalorica: 105 }, user);
    const secondCopy = await service.update(active.id, { expectedVersion: 3, status: 'em_revisao', metaCalorica: 110 }, user);
    assert.notEqual(firstCopy.id, active.id); assert.notEqual(secondCopy.id, firstCopy.id);
    const preserved = await plans.findOneByOrFail({ id: active.id });
    assert.equal(preserved.status, 'ativo'); assert.deepEqual(preserved.dados, active.dados);
    assert.equal((await fetch(base + '/planos-alimentares/' + firstCopy.id, { headers })).status, 403);
    await assert.rejects(service.findById(active.id, { id: randomUUID(), role: 'atleta' }), error => error.getStatus() === 403);
    const r1 = await service.revisar(firstCopy.id, 1, user, true);
    const r2 = await service.revisar(secondCopy.id, 1, user, true);
    const persist = service.persistVersion;
    service.persistVersion = async () => { throw new Error('synthetic publication failure'); };
    await assert.rejects(service.ativar(r1.id, user, r1.dados.version), /synthetic publication failure/);
    service.persistVersion = persist;
    assert.equal((await plans.findOneByOrFail({ id: active.id })).status, 'ativo', 'failed publication must roll back archiving');
    await Promise.all([service.ativar(r1.id, user, r1.dados.version), service.ativar(r2.id, user, r2.dados.version)]);
    const final = await plans.find({ where: { pacienteId: patient.id, status: 'ativo' } });
    assert.equal(final.length, 1);
    assert.equal((await plans.findOneByOrFail({ id: active.id })).status, 'arquivado');
    assert.equal((await service.findAll(athlete, { pacienteId: patient.id })).length, 1);
    assert.equal((await fetch(base + '/planos-alimentares/' + active.id + '/pdf?expectedVersion=3', { headers })).status, 403);
  });
  await realJourneys();
  console.log(`${count} integracoes passaram em PostgreSQL isolado; nenhum email enviado.`);
})().catch(error=>{console.error(error.message);process.exitCode=1;}).finally(async()=>{for(const socket of sockets)socket.disconnect();if(db.isInitialized)await db.destroy();});
