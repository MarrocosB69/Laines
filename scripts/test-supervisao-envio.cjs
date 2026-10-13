/* UPD-17 — supervisao por jornada (envio do aluno para a fila).
 * Fonte real (ts-node) com repositorios sinteticos em memoria; sem banco,
 * sem rede, sem .env. Mesmo estilo de scripts/test-supervisao-fila.cjs. */
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
require(path.join(root, 'server/node_modules/ts-node')).register({ project: path.join(root, 'server/tsconfig.json'), transpileOnly: true });
require(path.join(root, 'server/node_modules/reflect-metadata'));
const source = (name) => require(path.join(root, 'server/src', name));
const { AvaliacoesService } = source('avaliacoes/avaliacoes.service.ts');

const checks = [];
const check = async (name, fn) => { await fn(); checks.push(name); process.stdout.write(`PASS ${name}\n`); };

// --- Repositorios sinteticos --------------------------------------------
// Mesmo matchWhere/makeRepo de test-supervisao-fila.cjs — cobre os poucos
// operadores que os servicos realmente usam (igualdade e IsNull(), este
// ultimo usado por findFilaRevisao em `deletedAt: IsNull()`), sem motor de SQL.
const matchWhere = (row, where) => {
  if (!where) return true;
  return Object.entries(where).every(([key, cond]) => {
    if (cond === undefined) return true;
    if (cond && typeof cond === 'object' && typeof cond.type === 'string') {
      if (cond.type === 'in') return Array.isArray(cond.value) && cond.value.includes(row[key]);
      if (cond.type === 'isNull') return row[key] === null || row[key] === undefined;
      return true;
    }
    return row[key] === cond;
  });
};

const makeRepo = (rows) => {
  const data = new Map(rows.map((r) => [r.id, r]));
  return {
    _data: data,
    async findOne(options) {
      const where = options && options.where;
      for (const row of data.values()) if (matchWhere(row, where)) return row;
      return null;
    },
    async find(options) {
      const where = options && options.where;
      const out = [];
      for (const row of data.values()) if (matchWhere(row, where)) out.push(row);
      return out;
    },
    merge(entity, patch) { return Object.assign(entity, patch); },
    async save(entity) {
      data.set(entity.id, entity);
      return entity;
    }
  };
};

const realtime = { emit: () => {} };
const user = (id, role, extra = {}) => ({ id, role, ...extra });

// --- Pessoas e pacientes sinteticos --------------------------------------
const ids = {
  responsavel: '11111111-1111-4111-8111-111111111111',
  equipeMembro: '22222222-2222-4222-8222-222222222222',
  outroAluno: '33333333-3333-4333-8333-333333333333',
  atleta: '44444444-4444-4444-8444-444444444444',
  admin: '55555555-5555-4555-8555-555555555555',
  supervisor: '66666666-6666-4666-8666-666666666666',
  paciente: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
};

const paciente = {
  id: ids.paciente, nome: 'Paciente Sintetico Envio',
  alunoResponsavelId: ids.responsavel, professorSupervisorId: ids.supervisor,
  equipeTecnicaIds: [ids.equipeMembro], equipeMultiIds: [], atletaUserId: ids.atleta
};
const pacientesRepo = makeRepo([paciente]);
const usersRepo = makeRepo([]);

// avaliacao preenchida pelo aluno no atendimento, finalizada direto — nunca
// passou pelo autorrelato do atleta, entao meta esta vazia.
const avaliacaoFinalizadaSemFlag = {
  id: 'aval-envio-1', pacienteId: ids.paciente, alunoId: ids.responsavel, tipo: 'antropometria', status: 'finalizada',
  meta: {}, updatedAt: new Date('2026-04-01T09:00:00.000Z'), deletedAt: null
};
const avaliacaoRascunho = {
  id: 'aval-envio-2', pacienteId: ids.paciente, alunoId: ids.equipeMembro, tipo: 'psicologia', status: 'rascunho',
  meta: {}, updatedAt: new Date('2026-04-02T09:00:00.000Z'), deletedAt: null
};
const avaliacaoJaAguardando = {
  id: 'aval-envio-3', pacienteId: ids.paciente, alunoId: ids.responsavel, tipo: 'fisioterapia', status: 'rascunho',
  meta: { aguardandoRevisao: true, submittedAt: '2026-03-01T00:00:00.000Z', submittedById: ids.responsavel, submittedByName: 'Antigo' },
  updatedAt: new Date('2026-03-01T00:00:00.000Z'), deletedAt: null
};
const avaliacaoOutroAluno = {
  id: 'aval-envio-4', pacienteId: ids.paciente, alunoId: ids.responsavel, tipo: 'antropometria', status: 'rascunho',
  meta: {}, updatedAt: new Date('2026-04-03T09:00:00.000Z'), deletedAt: null
};
const avaliacaoAutoria = {
  id: 'aval-envio-5', pacienteId: ids.paciente, alunoId: ids.equipeMembro, tipo: 'hidratacao', status: 'rascunho',
  meta: {}, updatedAt: new Date('2026-04-04T09:00:00.000Z'), deletedAt: null
};
const avaliacaoObservacaoLonga = {
  id: 'aval-envio-6', pacienteId: ids.paciente, alunoId: ids.equipeMembro, tipo: 'carga_treino', status: 'rascunho',
  meta: {}, updatedAt: new Date('2026-04-05T09:00:00.000Z'), deletedAt: null
};
const avaliacoesRepo = makeRepo([
  avaliacaoFinalizadaSemFlag, avaliacaoRascunho, avaliacaoJaAguardando, avaliacaoOutroAluno,
  avaliacaoAutoria, avaliacaoObservacaoLonga
]);

const notificacoesChamadas = [];
const notificacoesStub = {
  async createForUsers(userIds, dto) { notificacoesChamadas.push({ userIds, dto }); return []; }
};

const avaliacoes = new AvaliacoesService(
  avaliacoesRepo, /* sessoesRepo */ {}, pacientesRepo, usersRepo, realtime,
  /* observability */ undefined, /* auditoria */ undefined, /* clinicalAlerts */ undefined,
  notificacoesStub
);

(async () => {
  await check('UPD-17 envio: aluno responsavel envia avaliacao finalizada direto no atendimento; flag e submittedAt vem do servidor, observacaoEnvio guardada', async () => {
    const antes = Date.now();
    const enviada = await avaliacoes.enviarParaRevisao(
      'aval-envio-1',
      'Pode conferir a classificacao antropometrica? Fiquei em duvida no ponto de corte.',
      user(ids.responsavel, 'aluno', { name: 'Aluno Responsavel Sintetico' })
    );
    assert.equal(enviada.meta.aguardandoRevisao, true);
    // Pedir conferencia nao desqualifica o dado. Se o envio rebaixasse para
    // rascunho, um GET finalizado deixaria de ser elegivel e a prescricao
    // travaria por falta de GET — efeito colateral clinico de um pedido de
    // revisao. Quem rebaixa e devolver(), quando o supervisor aponta defeito.
    assert.equal(enviada.status, 'finalizada', 'avaliacao finalizada continua finalizada enquanto aguarda conferencia');
    assert.equal(enviada.meta.submittedById, ids.responsavel);
    assert.equal(enviada.meta.submittedByName, 'Aluno Responsavel Sintetico');
    assert.equal(
      enviada.meta.observacaoEnvio,
      'Pode conferir a classificacao antropometrica? Fiquei em duvida no ponto de corte.'
    );
    const submittedAtMs = new Date(enviada.meta.submittedAt).getTime();
    assert.ok(submittedAtMs >= antes && submittedAtMs <= Date.now(), 'submittedAt e cunhado pelo relogio do servidor');
  });

  await check('UPD-17 envio: item enviado passa a aparecer na fila do supervisor (ponta a ponta com findFilaRevisao)', async () => {
    const fila = await avaliacoes.findFilaRevisao(user(ids.supervisor, 'professor'), {});
    const item = fila.find((entry) => entry.id === 'aval-envio-1');
    assert.ok(item, 'a avaliacao enviada deve aparecer na fila do supervisor do caso');
    assert.equal(item.pacienteId, ids.paciente);
    assert.equal(item.enviadoPorId, ids.responsavel);
    assert.equal(item.rota, `/avaliacao/${ids.paciente}`, 'a rota de retorno resolve o paciente, nao a avaliacao');
  });

  await check('UPD-17 envio: membro de equipe tambem pode enviar, sem observacao (opcional)', async () => {
    const enviada = await avaliacoes.enviarParaRevisao(
      'aval-envio-2',
      undefined,
      user(ids.equipeMembro, 'aluno', { name: 'Membro de Equipe' })
    );
    assert.equal(enviada.meta.aguardandoRevisao, true);
    assert.equal('observacaoEnvio' in enviada.meta, false, 'sem observacao, o campo nao deve existir');
  });

  await check('UPD-17 envio: gestao tambem pode enviar em nome do caso', async () => {
    const enviada = await avaliacoes.enviarParaRevisao(
      'aval-envio-4',
      '',
      user(ids.admin, 'admin', { name: 'Admin Sintetico' })
    );
    assert.equal(enviada.meta.aguardandoRevisao, true);
    assert.equal(enviada.meta.submittedById, ids.admin);
  });

  await check('UPD-17 envio: aluno sem vinculo com o paciente nao envia', async () => {
    await assert.rejects(
      () => avaliacoes.enviarParaRevisao('aval-envio-3', 'x', user(ids.outroAluno, 'aluno', { name: 'Aluno de Fora' })),
      /Avaliacao nao encontrada/,
      'sem vinculo algum, o item nem existe para este usuario'
    );
  });

  await check('UPD-17 envio: atleta nao envia (o autorrelato dele ja entra por outro caminho)', async () => {
    await assert.rejects(
      () => avaliacoes.enviarParaRevisao('aval-envio-3', 'x', user(ids.atleta, 'atleta')),
      /Apenas o responsavel pelo caso, a equipe ou a gestao/,
      'atleta tem vinculo de leitura ("atleta") mas nao esta na lista que pode enviar'
    );
  });

  await check('UPD-17 envio: supervisor puro (sem ser responsavel/equipe) nao envia pelo aluno', async () => {
    // professorSupervisorId resolve para link 'supervisor', que nao esta na
    // lista (responsavel/equipe/gestao) — o supervisor revisa, nao envia.
    await assert.rejects(
      () => avaliacoes.enviarParaRevisao('aval-envio-3', 'x', user(ids.supervisor, 'professor')),
      /Apenas o responsavel pelo caso, a equipe ou a gestao/
    );
  });

  await check('UPD-17 envio: enviar duas vezes rejeita', async () => {
    await assert.rejects(
      () => avaliacoes.enviarParaRevisao('aval-envio-3', 'Nova pergunta', user(ids.responsavel, 'aluno')),
      /ja esta aguardando revisao/
    );
  });

  await check('UPD-17 envio: autoria vem do servidor, nao do payload (submittedById forjado e ignorado)', async () => {
    // O metodo do servico so aceita (id, observacao, user) — nao ha campo de
    // autoria no payload para forjar; a prova e que submittedById e sempre
    // o id do usuario autenticado que chamou o metodo, nunca outro (aqui,
    // o membro de equipe que efetivamente chamou — nunca o admin do teste anterior).
    const enviada = await avaliacoes.enviarParaRevisao(
      'aval-envio-5',
      undefined,
      user(ids.equipeMembro, 'aluno', { name: 'Membro de Equipe' })
    );
    assert.equal(enviada.meta.submittedById, ids.equipeMembro);
    assert.notEqual(enviada.meta.submittedById, ids.admin);
  });

  await check('UPD-17 envio + devolucao: devolver limpa observacaoEnvio e preserva o historico de devolucoes', async () => {
    // Reusa aval-envio-1 (ja aguardando revisao, com observacaoEnvio do primeiro teste).
    const antesDevolver = avaliacoesRepo._data.get('aval-envio-1');
    assert.ok(antesDevolver.meta.observacaoEnvio, 'pre-condicao: a observacao de envio esta presente antes de devolver');

    const devolvida = await avaliacoes.devolver(
      'aval-envio-1',
      'Corrija o ponto de corte usado na classificacao.',
      user(ids.supervisor, 'professor', { name: 'Supervisor Sintetico' })
    );
    assert.equal('observacaoEnvio' in devolvida.meta, false, 'a pergunta foi respondida — o campo nao deve sobreviver a devolucao');
    assert.equal(devolvida.meta.aguardandoRevisao, false);
    assert.equal(devolvida.meta.devolucao.observacao, 'Corrija o ponto de corte usado na classificacao.');
    assert.equal(devolvida.meta.historicoDevolucoes.length, 1, 'o historico de devolucoes nao e afetado pela limpeza de observacaoEnvio');

    // O aluno reenvia apos ajustar — envia de novo com nova pergunta.
    const reenviada = await avaliacoes.enviarParaRevisao(
      'aval-envio-1',
      'Ajustei o ponto de corte conforme orientado.',
      user(ids.responsavel, 'aluno', { name: 'Aluno Responsavel Sintetico' })
    );
    assert.equal(reenviada.meta.observacaoEnvio, 'Ajustei o ponto de corte conforme orientado.');
    assert.equal(reenviada.meta.historicoDevolucoes.length, 1, 'reenviar nao apaga o historico de devolucoes anterior');
    assert.equal(reenviada.meta.devolucao.observacao, 'Corrija o ponto de corte usado na classificacao.', 'a ultima devolucao registrada continua legivel para o aluno');
  });

  await check('UPD-17 envio: observacao acima de 1000 caracteres rejeita', async () => {
    await assert.rejects(
      () => avaliacoes.enviarParaRevisao('aval-envio-6', 'x'.repeat(1001), user(ids.equipeMembro, 'aluno')),
      /no maximo 1000 caracteres/
    );
    assert.equal(avaliacoesRepo._data.get('aval-envio-6').meta.aguardandoRevisao, undefined, 'rejeitada, a avaliacao nao deve entrar na fila');
  });

  await check('UPD-17 envio: notificacao ao supervisor (quando ha um) nao contem dado clinico', async () => {
    // notificacoesChamadas tambem carrega a notificacao de devolver() (ao
    // aluno, titulo diferente) do teste anterior — aqui so importa a familia
    // gerada por enviarParaRevisao.
    const chamadasDeEnvio = notificacoesChamadas.filter((c) => c.dto.titulo === 'Avaliacao aguardando revisao');
    assert.ok(chamadasDeEnvio.length >= 1);
    for (const chamada of chamadasDeEnvio) {
      assert.deepEqual(chamada.userIds, [ids.supervisor]);
      assert.ok(!chamada.dto.mensagem.includes(paciente.nome), 'mensagem nao pode citar o nome do paciente');
      assert.ok(!chamada.dto.mensagem.toLowerCase().includes('antropometr'), 'mensagem nao pode citar o tipo do instrumento');
      assert.ok(!chamada.dto.mensagem.toLowerCase().includes('psicolog'), 'mensagem nao pode citar o tipo do instrumento');
    }
  });

  process.stdout.write(`\n${checks.length} verificacoes de supervisao/envio aprovadas.\n`);
})().catch((error) => { console.error(error); process.exit(1); });
