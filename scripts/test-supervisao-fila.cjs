/* UPD-17 — supervisao por jornada (fila de revisao + devolucao).
 * Fonte real (ts-node) com repositorios sinteticos em memoria; sem banco,
 * sem rede, sem .env. Mesmo estilo de scripts/test-security-authorization.cjs. */
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
require(path.join(root, 'server/node_modules/ts-node')).register({ project: path.join(root, 'server/tsconfig.json'), transpileOnly: true });
require(path.join(root, 'server/node_modules/reflect-metadata'));
const { In, IsNull } = require(path.join(root, 'server/node_modules/typeorm'));
const source = (name) => require(path.join(root, 'server/src', name));
const { AvaliacoesService } = source('avaliacoes/avaliacoes.service.ts');
const { PlanoAlimentarService } = source('planos-alimentares/plano-alimentar.service.ts');
const { PlanoAlimentarStatus } = source('planos-alimentares/plano-alimentar.entity.ts');

const checks = [];
const check = async (name, fn) => { await fn(); checks.push(name); process.stdout.write(`PASS ${name}\n`); };

// --- Repositorios sinteticos --------------------------------------------
// matchWhere entende os poucos operadores que os servicos realmente usam
// (igualdade, In(...) e IsNull()) — nao e um motor de SQL, so o suficiente
// para provar o contrato de findFilaRevisao/devolver sem banco real.
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

// Repo generico: cobre findOne/find/merge/save (avaliacoes, pacientes, usuarios).
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

// Repo de plano alimentar: alem do generico, emula o UPDATE com CAS que
// persistVersion() ja usa em producao (id = :id AND deleted_at IS NULL AND
// COALESCE(version,0) = :version). Nao reescreve a regra — so reproduz o
// contrato observavel (affected 1/0) para que devolver()/persistVersion()
// (codigo existente, nao alterado neste item) rodem sem Postgres.
const makePlanoRepo = (rows) => {
  const generic = makeRepo(rows);
  return {
    ...generic,
    createQueryBuilder() {
      let setObj = {};
      let params = {};
      const builder = {
        update() { return builder; },
        set(obj) { setObj = obj; return builder; },
        setParameters(p) { params = { ...params, ...p }; return builder; },
        where(_cond, p) { if (p) params = { ...params, ...p }; return builder; },
        andWhere(_cond, p) { if (p) params = { ...params, ...p }; return builder; },
        async execute() {
          const row = generic._data.get(params.id);
          if (!row) return { affected: 0 };
          const storedVersion = (row.dados && row.dados.version) || 0;
          if (params.version !== undefined && storedVersion !== params.version) {
            return { affected: 0 };
          }
          for (const [key, value] of Object.entries(setObj)) {
            if (typeof value === 'function') continue;
            row[key] = value;
          }
          if ('dados' in setObj) row.dados = JSON.parse(params.planDados);
          if ('resultados' in setObj) row.resultados = JSON.parse(params.planResultados);
          row.updatedAt = new Date();
          generic._data.set(row.id, row);
          return { affected: 1 };
        }
      };
      return builder;
    },
    async findOneByOrFail({ id }) {
      const row = generic._data.get(id);
      if (!row) throw new Error(`Plano ${id} nao encontrado no repo sintetico.`);
      return row;
    }
  };
};

const realtime = { emit: () => {} };
const user = (id, role, extra = {}) => ({ id, role, ...extra });

// --- Pessoas e pacientes sinteticos --------------------------------------
const ids = {
  supervisor: '11111111-1111-4111-8111-111111111111',
  profOutro: '22222222-2222-4222-8222-222222222222',
  aluno: '33333333-3333-4333-8333-333333333333',
  atleta: '44444444-4444-4444-8444-444444444444',
  admin: '55555555-5555-4555-8555-555555555555',
  alunoChain: '66666666-6666-4666-8666-666666666666',
  profissionalChain: '77777777-7777-4777-8777-777777777777',
  pacienteA: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  pacienteB: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  pacienteChain: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
};

const pacienteA = {
  id: ids.pacienteA, nome: 'Paciente Sintetico A',
  alunoResponsavelId: ids.aluno, professorSupervisorId: ids.supervisor,
  equipeTecnicaIds: [], equipeMultiIds: [], atletaUserId: ids.atleta
};
const pacienteB = {
  id: ids.pacienteB, nome: 'Paciente Sintetico B (fora do escopo)',
  alunoResponsavelId: 'outro-aluno-fora-0000-0000-000000000000', professorSupervisorId: 'outro-supervisor-000-0000-000000000000',
  equipeTecnicaIds: [], equipeMultiIds: [], atletaUserId: null
};
const pacienteChain = {
  id: ids.pacienteChain, nome: 'Paciente Sintetico C (cadeia)',
  alunoResponsavelId: ids.alunoChain, professorSupervisorId: null,
  equipeTecnicaIds: [], equipeMultiIds: [], atletaUserId: null
};
const pacientesRepo = makeRepo([pacienteA, pacienteB, pacienteChain]);

// usersRepo serve dois propositos ao mesmo tempo (como no servidor real):
// resolver a cadeia de supervisao (supervisorId/profissionalId) e o nome
// para exibicao na fila.
const usersRepo = makeRepo([
  { id: ids.aluno, name: 'Aluno Responsavel Sintetico', supervisorId: null, profissionalId: null, deletedAt: null },
  { id: ids.alunoChain, name: 'Aluno Cadeia Sintetico', supervisorId: null, profissionalId: ids.profissionalChain, deletedAt: null }
]);

// --- Avaliacoes -----------------------------------------------------------
const avaliacaoOld = {
  id: 'aval-1', pacienteId: ids.pacienteA, alunoId: ids.aluno, tipo: 'alimentar', status: 'rascunho',
  meta: { aguardandoRevisao: true, submittedAt: '2026-01-01T10:00:00.000Z', origemPreenchimento: 'atleta' },
  updatedAt: new Date('2026-01-01T10:00:00.000Z'), deletedAt: null
};
const avaliacaoNew = {
  id: 'aval-2', pacienteId: ids.pacienteA, alunoId: ids.aluno, tipo: 'hidratacao', status: 'rascunho',
  meta: { aguardandoRevisao: true, submittedAt: '2026-02-01T10:00:00.000Z', origemPreenchimento: 'atleta' },
  updatedAt: new Date('2026-02-01T10:00:00.000Z'), deletedAt: null
};
const avaliacaoOutOfScope = {
  id: 'aval-3', pacienteId: ids.pacienteB, alunoId: 'aluno-fora', tipo: 'alimentar', status: 'rascunho',
  meta: { aguardandoRevisao: true, submittedAt: '2025-12-01T10:00:00.000Z', origemPreenchimento: 'atleta' },
  updatedAt: new Date('2025-12-01T10:00:00.000Z'), deletedAt: null
};
const avaliacaoRascunhoComum = {
  // rascunho de preenchimento normal do aluno, nunca entrou na fila do atleta.
  id: 'aval-4', pacienteId: ids.pacienteA, alunoId: ids.aluno, tipo: 'antropometria', status: 'rascunho',
  meta: {}, updatedAt: new Date('2026-01-15T10:00:00.000Z'), deletedAt: null
};
const avaliacaoFinalizadaAntiga = {
  id: 'aval-5', pacienteId: ids.pacienteA, alunoId: ids.aluno, tipo: 'anamnese_inicial', status: 'finalizada',
  meta: { aguardandoRevisao: false }, updatedAt: new Date('2025-06-01T10:00:00.000Z'), deletedAt: null
};
const avaliacoesRepo = makeRepo([
  avaliacaoOld, avaliacaoNew, avaliacaoOutOfScope, avaliacaoRascunhoComum, avaliacaoFinalizadaAntiga
]);

const notificacoesAvaliacoes = [];
const notificacoesAvaliacoesStub = {
  async createForUsers(userIds, dto) { notificacoesAvaliacoes.push({ userIds, dto }); return []; }
};

const avaliacoes = new AvaliacoesService(
  avaliacoesRepo, /* sessoesRepo */ {}, pacientesRepo, usersRepo, realtime,
  /* observability */ undefined, /* auditoria */ undefined, /* clinicalAlerts */ undefined,
  notificacoesAvaliacoesStub
);

// --- Planos alimentares -----------------------------------------------------
const planoRevisadoAntes = {
  id: 'plano-1', pacienteId: ids.pacienteA, alunoId: ids.aluno, status: PlanoAlimentarStatus.EM_REVISAO, tipoDieta: 'fixa',
  dados: {
    refeicoes: [], catalogo: {}, version: 2, historicoRevisoes: [], devolucoes: [],
    revisaoFinal: {
      confirmada: true, origem: 'servidor', version: 2, confirmadoEm: '2026-01-01T09:00:00.000Z',
      confirmadoPorId: ids.supervisor, confirmadoPorNome: 'Supervisor Sintetico', crn: '12345'
    }
  },
  resultados: {}, updatedAt: new Date('2026-01-05T10:00:00.000Z'), deletedAt: null
};
const planoCadeia = {
  id: 'plano-2', pacienteId: ids.pacienteChain, alunoId: ids.alunoChain, status: PlanoAlimentarStatus.EM_REVISAO, tipoDieta: 'rodizio',
  dados: { refeicoes: [], catalogo: {}, version: 1, historicoRevisoes: [], devolucoes: [], revisaoFinal: { confirmada: false } },
  resultados: {}, updatedAt: new Date('2025-11-01T08:00:00.000Z'), deletedAt: null
};
const planoOutOfScope = {
  id: 'plano-3', pacienteId: ids.pacienteB, alunoId: 'aluno-fora', status: PlanoAlimentarStatus.EM_REVISAO, tipoDieta: 'fixa',
  dados: { refeicoes: [], catalogo: {}, version: 1, historicoRevisoes: [], devolucoes: [], revisaoFinal: { confirmada: false } },
  resultados: {}, updatedAt: new Date('2025-10-01T08:00:00.000Z'), deletedAt: null
};
const planosRepo = makePlanoRepo([planoRevisadoAntes, planoCadeia, planoOutOfScope]);

const notificacoesPlanos = [];
const notificacoesPlanosStub = {
  async createForUsers(userIds, dto) { notificacoesPlanos.push({ userIds, dto }); return []; }
};

const planos = new PlanoAlimentarService(
  planosRepo, pacientesRepo, /* avaliacoesRepo */ {}, usersRepo, /* foodsRepo */ {},
  /* auditoria */ undefined, notificacoesPlanosStub
);

(async () => {
  await check('UPD-17 fila de avaliacoes: supervisor ve so o proprio escopo, mais antigo primeiro; rascunho comum nao entra', async () => {
    const fila = await avaliacoes.findFilaRevisao(user(ids.supervisor, 'professor'), {});
    assert.deepEqual(fila.map((item) => item.id), ['aval-1', 'aval-2'], 'ordem: mais antigo primeiro');
    assert.ok(fila.every((item) => item.pacienteId === ids.pacienteA), 'nenhum item de outro paciente vaza');
    assert.equal(fila[0].tipo, 'avaliacao');
    assert.equal(fila[0].pacienteNome, pacienteA.nome);
    assert.equal(fila[0].tipoInstrumento, 'alimentar');
    assert.equal(fila[0].enviadoPorId, ids.aluno);
    assert.equal(fila[0].enviadoPorNome, 'Aluno Responsavel Sintetico');
    assert.equal(fila[0].rota, `/avaliacao/${ids.pacienteA}`, 'a rota de retorno resolve o paciente, nao a avaliacao');
  });

  await check('UPD-17 fila de avaliacoes: professor sem vinculo ve fila vazia; aluno responsavel e atleta nao veem a propria fila', async () => {
    assert.deepEqual(await avaliacoes.findFilaRevisao(user(ids.profOutro, 'professor'), {}), []);
    assert.deepEqual(await avaliacoes.findFilaRevisao(user(ids.aluno, 'aluno'), {}), []);
    assert.deepEqual(await avaliacoes.findFilaRevisao(user(ids.atleta, 'atleta'), {}), []);
  });

  await check('UPD-17 fila de avaliacoes: gestao ve todos os pacientes, ordenacao global por mais antigo', async () => {
    const fila = await avaliacoes.findFilaRevisao(user(ids.admin, 'admin'), {});
    assert.deepEqual(fila.map((item) => item.id), ['aval-3', 'aval-1', 'aval-2']);
  });

  await check('UPD-17 fila de planos: supervisor e cadeia de supervisao veem so o proprio escopo; sem vinculo e aluno veem vazio', async () => {
    const filaSupervisor = await planos.findFilaRevisao(user(ids.supervisor, 'professor'), {});
    assert.deepEqual(filaSupervisor.map((item) => item.id), ['plano-1']);
    assert.equal(filaSupervisor[0].tipo, 'plano');
    assert.equal(filaSupervisor[0].tipoInstrumento, 'fixa');
    assert.equal(filaSupervisor[0].rota, `/prescricao-plano/${ids.pacienteA}`);

    const filaCadeia = await planos.findFilaRevisao(user(ids.profissionalChain, 'profissional'), {});
    assert.deepEqual(filaCadeia.map((item) => item.id), ['plano-2'], 'supervisao_aluno enxerga o plano do aluno supervisionado');

    assert.deepEqual(await planos.findFilaRevisao(user(ids.profOutro, 'professor'), {}), []);
    assert.deepEqual(await planos.findFilaRevisao(user(ids.aluno, 'aluno'), {}), []);
  });

  await check('UPD-17 devolver avaliacao: volta a rascunho, flag limpa, autoria do servidor, payload com porId forjado e ignorado', async () => {
    const devolvida = await avaliacoes.devolver('aval-1', 'Ajustar a quantidade de refeicoes registradas.', user(ids.supervisor, 'professor', { name: 'Supervisor Sintetico' }));
    assert.equal(devolvida.status, 'rascunho');
    assert.equal(devolvida.meta.aguardandoRevisao, false);
    assert.equal(devolvida.meta.devolucao.porId, ids.supervisor);
    assert.equal(devolvida.meta.devolucao.porNome, 'Supervisor Sintetico');
    assert.equal(devolvida.meta.devolucao.observacao, 'Ajustar a quantidade de refeicoes registradas.');
    assert.equal(devolvida.meta.historicoDevolucoes.length, 1);

    // O controller so repassa dto.observacao; um campo extra no corpo (porId
    // forjado) nunca chega como parametro do servico — a autoria vem sempre
    // do usuario autenticado (req.user), nunca do payload.
    const payloadForjado = { observacao: 'Adequar a densidade calorica ao objetivo do atleta.', porId: 'id-forjado-0000-0000-000000000000' };
    const devolvidaForjada = await avaliacoes.devolver('aval-2', payloadForjado.observacao, user(ids.supervisor, 'professor', { name: 'Supervisor Sintetico' }));
    assert.equal(devolvidaForjada.meta.devolucao.porId, ids.supervisor);
    assert.notEqual(devolvidaForjada.meta.devolucao.porId, payloadForjado.porId);
  });

  await check('UPD-17 devolver avaliacao: segunda devolucao preserva o historico da primeira', async () => {
    // Simula o aluno reenviando o formulario (aguardandoRevisao volta a true).
    avaliacoesRepo._data.get('aval-1').meta = {
      ...avaliacoesRepo._data.get('aval-1').meta,
      aguardandoRevisao: true,
      submittedAt: '2026-03-01T00:00:00.000Z'
    };
    const segunda = await avaliacoes.devolver('aval-1', 'Ainda falta registrar a data da coleta.', user(ids.supervisor, 'professor', { name: 'Supervisor Sintetico' }));
    assert.equal(segunda.meta.historicoDevolucoes.length, 2, 'a devolucao anterior nao pode ser perdida');
    assert.equal(segunda.meta.historicoDevolucoes[0].observacao, 'Ajustar a quantidade de refeicoes registradas.');
    assert.equal(segunda.meta.historicoDevolucoes[1].observacao, 'Ainda falta registrar a data da coleta.');
    assert.equal(segunda.meta.devolucao.observacao, 'Ainda falta registrar a data da coleta.');
  });

  await check('UPD-17 devolver avaliacao: observacao vazia ou curta rejeita', async () => {
    await assert.rejects(
      () => avaliacoes.devolver('aval-4', '', user(ids.supervisor, 'professor')),
      /Observacao deve ter entre 5 e 1000/
    );
    await assert.rejects(
      () => avaliacoes.devolver('aval-4', 'abcd', user(ids.supervisor, 'professor')),
      /Observacao deve ter entre 5 e 1000/
    );
  });

  await check('UPD-17 devolver avaliacao: item que nao esta aguardando revisao rejeita', async () => {
    await assert.rejects(
      () => avaliacoes.devolver('aval-4', 'Observacao valida com mais de cinco caracteres.', user(ids.supervisor, 'professor')),
      /nao esta aguardando revisao/
    );
  });

  await check('UPD-17 devolver avaliacao: atleta e aluno responsavel nao devolvem; professor sem vinculo nao acessa o item', async () => {
    // aval-2 pertence a pacienteA: atletaUserId = ids.atleta, alunoResponsavelId = ids.aluno.
    // Ambos tem vinculo de LEITURA ao item (por isso nao e NotFound), mas o vinculo
    // resolvido ('atleta' / 'responsavel') nao esta na lista que pode devolver.
    await assert.rejects(
      () => avaliacoes.devolver('aval-2', 'Observacao valida com mais de cinco caracteres.', user(ids.atleta, 'atleta')),
      /Apenas supervisor, profissional vinculado ou gestao/,
      'atleta tem vinculo de leitura mas nao devolve'
    );
    await assert.rejects(
      () => avaliacoes.devolver('aval-2', 'Observacao valida com mais de cinco caracteres.', user(ids.aluno, 'aluno')),
      /Apenas supervisor, profissional vinculado ou gestao/,
      'aluno responsavel tem vinculo de leitura mas nao devolve o proprio item'
    );
    // aval-3 pertence a pacienteB, fora do escopo do profOutro: sem vinculo
    // algum, o item nem existe para este usuario (evita vazar existencia).
    await assert.rejects(
      () => avaliacoes.devolver('aval-3', 'Observacao valida com mais de cinco caracteres.', user(ids.profOutro, 'professor')),
      /Avaliacao nao encontrada/,
      'sem vinculo algum, o item nem existe para este usuario'
    );
  });

  await check('UPD-17 notificacao ao aluno nao contem nome do paciente nem conteudo clinico', async () => {
    assert.ok(notificacoesAvaliacoes.length >= 1);
    for (const chamada of notificacoesAvaliacoes) {
      assert.deepEqual(chamada.userIds, [ids.aluno]);
      assert.equal(chamada.dto.titulo, 'Avaliacao devolvida');
      assert.ok(!chamada.dto.mensagem.includes(pacienteA.nome), 'mensagem nao pode citar o nome do paciente');
      assert.ok(!chamada.dto.mensagem.toLowerCase().includes('alimentar'), 'mensagem nao pode citar o tipo do instrumento');
      assert.ok(!chamada.dto.mensagem.toLowerCase().includes('hidrata'), 'mensagem nao pode citar o tipo do instrumento');
    }
  });

  await check('UPD-17 devolver plano: exige expectedVersion correta (CAS)', async () => {
    await assert.rejects(
      () => planos.devolver('plano-1', 999, 'Ajustar substituicoes do lanche da tarde.', user(ids.supervisor, 'professor', { name: 'Supervisor Sintetico' })),
      /foi alterado ou a vers/
    );
  });

  await check('UPD-17 devolver plano: em_revisao volta a rascunho, devolucoes[] registrado, historicoRevisoes preservado', async () => {
    const devolvido = await planos.devolver('plano-1', 2, 'Ajustar substituicoes do lanche da tarde.', user(ids.supervisor, 'professor', { name: 'Supervisor Sintetico' }));
    assert.equal(devolvido.status, PlanoAlimentarStatus.RASCUNHO);
    assert.equal(devolvido.dados.devolucoes.length, 1);
    assert.equal(devolvido.dados.devolucoes[0].porId, ids.supervisor);
    assert.equal(devolvido.dados.devolucoes[0].observacao, 'Ajustar substituicoes do lanche da tarde.');
    assert.equal(devolvido.dados.devolucoes[0].version, 3);
    assert.equal(devolvido.dados.revisaoFinal.confirmada, false, 'a revisao anterior fica invalida ao devolver');
    assert.equal(devolvido.dados.historicoRevisoes.length, 1, 'a revisao anterior nao e apagada, so movida para o historico');
    assert.equal(devolvido.dados.historicoRevisoes[0].confirmadoPorId, ids.supervisor);
    assert.equal(devolvido.dados.version, 3);
  });

  await check('UPD-17 devolver plano: observacao curta rejeita; atleta e aluno responsavel nao devolvem', async () => {
    await assert.rejects(
      () => planos.devolver('plano-1', 3, 'abcd', user(ids.supervisor, 'professor')),
      /Observacao deve ter entre 5 e 1000/
    );
    // O atleta e barrado ainda mais cedo aqui: findById() (codigo preexistente,
    // nao alterado neste item) so libera leitura de plano ATIVO e revisado para
    // esse papel — um rascunho nunca chega a assertCanDevolver.
    await assert.rejects(
      () => planos.devolver('plano-1', 3, 'Observacao valida com mais de cinco caracteres.', user(ids.atleta, 'atleta')),
      /ainda não foi publicado/
    );
    await assert.rejects(
      () => planos.devolver('plano-1', 3, 'Observacao valida com mais de cinco caracteres.', user(ids.aluno, 'aluno')),
      /Apenas supervisor, profissional vinculado ou gestao/
    );
  });

  await check('UPD-17 devolver plano: gestao tambem pode devolver; notificacao ao aluno sem dado clinico', async () => {
    const devolvidoPorAdmin = await planos.devolver('plano-2', 1, 'Corrigir horario do lanche pre-treino conforme combinado.', user(ids.admin, 'admin', { name: 'Admin Sintetico' }));
    assert.equal(devolvidoPorAdmin.status, PlanoAlimentarStatus.RASCUNHO);
    assert.equal(devolvidoPorAdmin.dados.devolucoes[0].porId, ids.admin);

    assert.ok(notificacoesPlanos.length >= 1);
    for (const chamada of notificacoesPlanos) {
      assert.equal(chamada.dto.titulo, 'Plano alimentar devolvido');
      assert.ok(!chamada.dto.mensagem.includes(pacienteA.nome));
      assert.ok(!chamada.dto.mensagem.includes(pacienteChain.nome));
    }
  });

  process.stdout.write(`\n${checks.length} verificacoes de supervisao/fila aprovadas.\n`);
})().catch((error) => { console.error(error); process.exit(1); });
