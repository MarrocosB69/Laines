/* UPD-12 — contrato unico de autorizacao.
 * Fonte real (ts-node) com registros sinteticos; sem banco, rede ou arquivo .env. */
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
require(path.join(root, 'server/node_modules/ts-node')).register({ project: path.join(root, 'server/tsconfig.json'), transpileOnly: true });
require(path.join(root, 'server/node_modules/reflect-metadata'));
const source = (name) => require(path.join(root, 'server/src', name));
const {
  resolveDirectClinicalLink, resolveClinicalLink, assertClinicalLink, clinicalScopeCondition,
  buildCapabilities, managedLigaAreas, auditManagementAccess, resolveCaseCapabilities
} = source('auth/authorization.ts');
const { ConteudosService } = source('conteudos/conteudos.service.ts');
const { PlanoAlimentarService } = source('planos-alimentares/plano-alimentar.service.ts');
const { AgendamentosService } = source('agendamentos/agendamentos.service.ts');
const { AvaliacoesService } = source('avaliacoes/avaliacoes.service.ts');

const checks = [];
const check = async (name, fn) => { await fn(); checks.push(name); process.stdout.write(`PASS ${name}\n`); };

// Pessoas sinteticas: nenhuma corresponde a usuario real.
const ids = {
  alunoA: '11111111-1111-4111-8111-111111111111',
  alunoB: '22222222-2222-4222-8222-222222222222',
  alunoEnsino: '33333333-3333-4333-8333-333333333333',
  profSupervisor: '44444444-4444-4444-8444-444444444444',
  profOutro: '55555555-5555-4555-8555-555555555555',
  atleta: '66666666-6666-4666-8666-666666666666',
  atletaOutro: '77777777-7777-4777-8777-777777777777',
  admin: '88888888-8888-4888-8888-888888888888',
  pesquisadorEquipe: '99999999-9999-4999-8999-999999999999',
  paciente: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
};
const paciente = {
  id: ids.paciente,
  alunoResponsavelId: ids.alunoA,
  professorSupervisorId: null,
  equipeTecnicaIds: [],
  equipeMultiIds: [ids.pesquisadorEquipe],
  atletaUserId: ids.atleta
};
const students = new Map([
  [ids.alunoA, { id: ids.alunoA, supervisorId: ids.profSupervisor, profissionalId: null, deletedAt: null }],
  [ids.alunoB, { id: ids.alunoB, supervisorId: ids.profOutro, profissionalId: null, deletedAt: null }]
]);
const lookup = async (id) => students.get(id) || null;
const user = (id, role, extra = {}) => ({ id, role, ...extra });
const tiposAvaliacao = ['composicao_corporal_imagem', 'anamnese_inicial', 'antropometria', 'alimentar', 'psicologia'];
const avaliacaoScenario = (autorId, pacienteAtual = paciente) => {
  const rows = new Map(tiposAvaliacao.map((tipo, index) => {
    const id = `bbbbbbbb-bbbb-4bbb-8bbb-${String(index + 1).padStart(12, '0')}`;
    return [id, { id, tipo, alunoId: autorId, pacienteId: ids.paciente }];
  }));
  const patients = new Map(pacienteAtual ? [[pacienteAtual.id, pacienteAtual]] : []);
  const entries = [];
  const repo = { findOne: async ({ where }) => rows.get(where.id) || null };
  const pacientesRepo = { findOne: async ({ where }) => patients.get(where.id) || null };
  const usersRepo = { findOne: async ({ where }) => students.get(where.id) || null };
  const service = new AvaliacoesService(repo, {}, pacientesRepo, usersRepo, {}, undefined, {
    create: async (entry) => { entries.push(entry); }
  });
  return { service, rows, patients, entries };
};

(async () => {
  await check('UPD-12 aluno responsavel, equipe e atleta acessam; aluno sem vinculo, outro atleta e papel sem clinica nao', async () => {
    assert.equal(resolveDirectClinicalLink(user(ids.alunoA, 'aluno'), paciente), 'responsavel');
    assert.equal(resolveDirectClinicalLink(user(ids.pesquisadorEquipe, 'pesquisador'), paciente), 'equipe');
    assert.equal(resolveDirectClinicalLink(user(ids.atleta, 'atleta'), paciente), 'atleta');
    assert.equal(resolveDirectClinicalLink(user(ids.alunoB, 'aluno'), paciente), null);
    assert.equal(resolveDirectClinicalLink(user(ids.atletaOutro, 'atleta'), paciente), null);
    assert.equal(resolveDirectClinicalLink(user(ids.alunoEnsino, 'diretoria_ensino'), paciente), null);
    assert.equal(resolveDirectClinicalLink(user('', 'admin'), paciente), null);
  });

  await check('UPD-12 diretoria e presidencia nao concedem acesso clinico; so o vinculo concede', async () => {
    const presidente = user(ids.alunoB, 'presidente', { diretoria: 'Ensino', permissions: ['ensino:create'] });
    assert.equal(await resolveClinicalLink(presidente, paciente, lookup), null);
    const marketing = user(ids.alunoEnsino, 'aluno', { diretoria: 'Marketing', permissions: ['marketing:create'] });
    assert.equal(await resolveClinicalLink(marketing, paciente, lookup), null);
    await assert.rejects(() => assertClinicalLink(marketing, paciente, lookup), /Acesso negado/);
  });

  await check('UPD-12 cadeia de supervisao vale em todos os objetos; professor sem cadeia nao entra', async () => {
    assert.equal(await resolveClinicalLink(user(ids.profSupervisor, 'professor'), paciente, lookup), 'supervisao_aluno');
    assert.equal(await resolveClinicalLink(user(ids.profOutro, 'professor'), paciente, lookup), null);
    assert.equal(await resolveClinicalLink(user(ids.profSupervisor, 'professor'), paciente), null, 'sem lookup nao ha cadeia');
    students.set(ids.alunoA, { ...students.get(ids.alunoA), deletedAt: new Date() });
    assert.equal(await resolveClinicalLink(user(ids.profSupervisor, 'professor'), paciente, lookup), null, 'aluno removido encerra a cadeia');
    students.set(ids.alunoA, { ...students.get(ids.alunoA), deletedAt: null });
  });

  await check('UPD-12 planos e agendamentos usam o mesmo contrato (cadeia de supervisao reconhecida)', async () => {
    const usersRepo = { findOne: async ({ where }) => students.get(where.id) || null };
    const pacientesRepo = { findOne: async () => paciente };
    const planos = new PlanoAlimentarService({}, pacientesRepo, {}, usersRepo, {});
    await planos.assertCanAccessPaciente(user(ids.profSupervisor, 'professor'), ids.paciente);
    await assert.rejects(() => planos.assertCanAccessPaciente(user(ids.profOutro, 'professor'), ids.paciente), /Acesso negado/);
    await assert.rejects(() => planos.assertCanAccessPaciente(user(ids.alunoB, 'aluno'), ids.paciente), /Acesso negado/);

    const agendamentos = new AgendamentosService({ findOne: async () => ({ id: 'ag', pacienteId: ids.paciente, alunoId: ids.alunoA }) }, pacientesRepo, usersRepo, { emit: async () => {} });
    assert.ok(await agendamentos.findById('ag', user(ids.profSupervisor, 'professor')), 'supervisor do aluno le a consulta');
    assert.equal(await agendamentos.findById('ag', user(ids.profOutro, 'professor')), null, 'sem vinculo a consulta nao existe para o usuario');
    assert.equal(await agendamentos.findById('ag', user(ids.alunoB, 'aluno')), null);
  });

  await check('UPD-12 avaliacoes: ex-autor aluno, presidente e vice sem vinculo nao acessam nenhum dos cinco tipos', async () => {
    const { service, rows } = avaliacaoScenario(ids.alunoB);
    for (const role of ['aluno', 'presidente', 'vice']) {
      for (const row of rows.values()) {
        assert.equal(await service.findById(row.id, user(ids.alunoB, role)), null, `${role}: autoria historica nao concede acesso a ${row.tipo}`);
      }
    }
  });

  await check('UPD-12 avaliacoes: autor vinculado, equipe e cadeia de supervisao mantem acesso nos cinco tipos', async () => {
    const { service, rows } = avaliacaoScenario(ids.alunoA);
    const viewers = [
      ...['aluno', 'presidente', 'vice'].map((role) => user(ids.alunoA, role)),
      user(ids.pesquisadorEquipe, 'pesquisador'),
      user(ids.profSupervisor, 'professor')
    ];
    for (const viewer of viewers) {
      for (const row of rows.values()) {
        assert.equal(await service.findById(row.id, viewer), row, `${viewer.role} vinculado le ${row.tipo}`);
      }
    }
  });

  await check('UPD-12 avaliacoes: remover vinculo encerra leitura do autor e do supervisor sem alterar autoria', async () => {
    const { service, rows, patients } = avaliacaoScenario(ids.alunoA);
    for (const row of rows.values()) {
      assert.equal(await service.findById(row.id, user(ids.alunoA, 'aluno')), row);
      assert.equal(await service.findById(row.id, user(ids.profSupervisor, 'professor')), row);
    }
    patients.set(ids.paciente, { ...paciente, alunoResponsavelId: ids.alunoB });
    for (const row of rows.values()) {
      assert.equal(await service.findById(row.id, user(ids.alunoA, 'aluno')), null, `ex-autor perde ${row.tipo}`);
      assert.equal(await service.findById(row.id, user(ids.profSupervisor, 'professor')), null, `ex-supervisor perde ${row.tipo}`);
    }
  });

  await check('UPD-12 avaliacoes: paciente ou avaliacao ausente nao concede acesso ao autor', async () => {
    const { service, rows } = avaliacaoScenario(ids.alunoA, null);
    for (const role of ['aluno', 'presidente', 'vice']) {
      for (const row of rows.values()) {
        assert.equal(await service.findById(row.id, user(ids.alunoA, role)), null, `${role}: ${row.tipo} sem paciente`);
      }
    }
    assert.equal(await service.findById('cccccccc-cccc-4ccc-8ccc-cccccccccccc', user(ids.alunoA, 'aluno')), null);
  });

  await check('UPD-12 avaliacoes: excecao de gestao permanece auditada por objeto', async () => {
    const { service, rows, entries } = avaliacaoScenario(ids.alunoA);
    for (const viewer of [user(ids.admin, 'admin'), user(ids.profOutro, 'coordenacao')]) {
      for (const row of rows.values()) {
        assert.equal(await service.findById(row.id, viewer), row);
        const entry = entries.at(-1);
        assert.equal(entry.action, 'acesso_clinico_gestao');
        assert.equal(entry.entity, 'avaliacoes');
        assert.equal(entry.entityId, row.id);
        assert.equal(entry.meta.userId, viewer.id);
        assert.equal(entry.meta.acao, 'leitura_avaliacao');
        assert.equal(entry.meta.pacienteId, ids.paciente);
      }
    }
    assert.equal(entries.length, rows.size * 2);
  });

  await check('UPD-12 filtro de listagem: um fragmento por papel; gestao sem filtro; papel sem clinica bloqueado', async () => {
    assert.equal(clinicalScopeCondition({ alias: 'paciente', user: user(ids.admin, 'admin') }), null);
    assert.equal(clinicalScopeCondition({ alias: 'paciente', user: user(ids.alunoEnsino, 'diretoria_ensino') }), '1 = 0');
    assert.equal(clinicalScopeCondition({ alias: 'paciente', user: user('', 'aluno') }), '1 = 0');
    const aluno = clinicalScopeCondition({ alias: 'paciente', user: user(ids.alunoA, 'aluno') });
    assert.match(aluno, /alunoResponsavelId = :userId/);
    assert.doesNotMatch(aluno, /professorSupervisorId/);
    const prof = clinicalScopeCondition({ alias: 'p', user: user(ids.profSupervisor, 'professor'), supervisedStudentsSubquery: 'SELECT id FROM alunos' });
    assert.match(prof, /p\.professorSupervisorId = :userId/);
    assert.match(prof, /p\.alunoResponsavelId IN \(SELECT id FROM alunos\)/);
    assert.equal(clinicalScopeCondition({ alias: 'p', user: user(ids.atleta, 'atleta') }), 'p.atletaUserId = :userId');
    assert.ok(![aluno, prof].some((sql) => sql.includes(ids.alunoA)), 'ids entram por parametro, nunca no SQL');
  });

  await check('UPD-12 liga: leitura das quatro areas para todo membro; gestao so da propria diretoria', async () => {
    const semDiretoria = buildCapabilities(user(ids.alunoB, 'aluno', { supervisorId: ids.profOutro, projetoId: 'p' }));
    assert.deepEqual(semDiretoria.liga.areas, ['ensino', 'pesquisa', 'extensao', 'comunicacao']);
    assert.deepEqual(semDiretoria.liga.gerencia, []);
    assert.equal(semDiretoria.atendimento.escopo, 'vinculo');

    const ensino = buildCapabilities(user(ids.alunoEnsino, 'aluno', { diretoria: 'Ensino e Capacitacao' }));
    assert.deepEqual(ensino.liga.areas, ['ensino', 'pesquisa', 'extensao', 'comunicacao']);
    assert.deepEqual(ensino.liga.gerencia, ['ensino']);
    assert.equal(ensino.liga.aprovaConteudo, false);
    assert.equal(ensino.atendimento.habilitado, false, 'sem supervisor/projeto nao atende');
    assert.equal(ensino.atendimento.motivo, 'sem_vinculo');
    assert.equal(ensino.gestao.usuarios, false);

    const marketing = buildCapabilities(user(ids.alunoEnsino, 'aluno', { diretoria: 'Marketing' }));
    assert.deepEqual(marketing.liga.gerencia, ['comunicacao']);
    assert.equal(marketing.gestao.relatorios.detalhado, false, 'comunicacao nunca recebe dados clinicos identificados');
    assert.equal(marketing.gestao.relatorios.exportacao, true, 'agregados institucionais continuam disponiveis');

    assert.deepEqual(managedLigaAreas(user(ids.admin, 'coordenacao')), ['ensino', 'pesquisa', 'extensao', 'comunicacao']);
  });

  await check('UPD-12 capacidades: atleta, professor com CRN, admin como excecao clinica', async () => {
    const atleta = buildCapabilities(user(ids.atleta, 'atleta'));
    assert.equal(atleta.liga.leitura, false);
    assert.equal(atleta.atendimento.escopo, 'proprio');
    assert.equal(atleta.atendimento.criaPaciente, false);
    assert.equal(atleta.gestao.painel, false);

    const prof = buildCapabilities(user(ids.profSupervisor, 'professor', { crn: '12345' }));
    assert.equal(prof.atendimento.revisaPlano, true);
    assert.equal(prof.atendimento.criaPaciente, true);
    assert.equal(buildCapabilities(user(ids.profSupervisor, 'professor')).atendimento.revisaPlano, false, 'sem CRN nao revisa');
    assert.equal(buildCapabilities(user(ids.profSupervisor, 'professor', { conselhoTipo: 'crn', conselhoNumero: '9' })).atendimento.revisaPlano, true);

    const admin = buildCapabilities(user(ids.admin, 'admin'));
    assert.equal(admin.acessoClinicoGestao, true);
    assert.equal(admin.atendimento.escopo, 'gestao');
    assert.equal(admin.gestao.configuracoes, true);
    assert.equal(admin.atendimento.revisaPlano, false, 'administrar nao e assinar como profissional');
  });

  await check('UPD-12 acesso de gestao gera trilha uma vez por janela e nunca bloqueia a leitura', async () => {
    const entries = [];
    const auditoria = { create: async (entry) => { entries.push(entry); } };
    const admin = user(ids.admin, 'admin');
    await auditManagementAccess(auditoria, admin, 'pacientes', ids.paciente, { acao: 'leitura_prontuario' });
    await auditManagementAccess(auditoria, admin, 'pacientes', ids.paciente, { acao: 'leitura_prontuario' });
    await auditManagementAccess(auditoria, admin, 'pacientes', ids.paciente, { acao: 'acesso_plano_alimentar' });
    assert.equal(entries.length, 2);
    assert.equal(entries[0].action, 'acesso_clinico_gestao');
    assert.equal(entries[0].meta.via, 'gestao');
    await auditManagementAccess({ create: async () => { throw new Error('db down'); } }, admin, 'avaliacoes', 'x', { acao: 'falha' });
    await auditManagementAccess(undefined, admin, 'pacientes', ids.paciente);
  });

  await check('UPD-12 conteudo: publicado e transversal; rascunho fica na diretoria de origem', async () => {
    const rows = [
      { id: 'c1', categoria: 'materiais_ensino', status: 'publicado', titulo: 'Aula publicada' },
      { id: 'c2', categoria: 'materiais_ensino', status: 'rascunho', titulo: 'Aula em preparo' },
      { id: 'c3', categoria: 'materiais_marketing', status: 'rascunho', titulo: 'Post em preparo' }
    ];
    const service = new ConteudosService({}, { emit: async () => {} });
    const view = (u, row) => { try { service.assertCanViewConteudo(u, row); return true; } catch { return false; } };
    const alunoPesquisa = user(ids.alunoB, 'aluno', { diretoria: 'Pesquisa' });
    const alunoEnsino = user(ids.alunoEnsino, 'aluno', { diretoria: 'Ensino' });
    assert.equal(view(alunoPesquisa, rows[0]), true, 'outra diretoria le o publicado');
    assert.equal(view(alunoPesquisa, rows[1]), false, 'rascunho de ensino nao vaza para pesquisa');
    assert.equal(view(alunoEnsino, rows[1]), true, 'diretoria de origem ve o proprio rascunho');
    assert.equal(view(alunoEnsino, rows[2]), false, 'ensino nao ve rascunho de comunicacao');
    assert.equal(view(user(ids.admin, 'coordenacao'), rows[2]), true);
    assert.equal(service.canManageConteudo(alunoPesquisa, 'materiais_ensino'), false);
    assert.equal(service.canManageConteudo(alunoEnsino, 'materiais_ensino'), true);
  });

  await check('UPD-12 capacidades do caso: area do membro decide os tipos editaveis; gestao e supervisor seguem regras proprias', async () => {
    const tipos = ['anamnese_inicial', 'antropometria', 'alimentar', 'gasto_energetico_total', 'psicologia', 'fisioterapia', 'composicao_corporal_imagem'];
    const casoComEquipe = {
      ...paciente,
      equipeProfissional: [
        { userId: ids.alunoA, area: 'Nutrição', papel: 'responsavel' },
        { userId: ids.alunoB, area: 'Psicologia', papel: 'avaliador' }
      ],
      equipeMultiIds: [ids.alunoB]
    };
    const nutri = resolveCaseCapabilities(user(ids.alunoA, 'aluno', { curso: 'Nutrição' }), casoComEquipe, 'responsavel', tipos);
    assert.deepEqual(nutri.areas, ['nutricao']);
    assert.ok(nutri.tiposEditaveis.includes('antropometria') && nutri.tiposEditaveis.includes('composicao_corporal_imagem'));
    assert.ok(!nutri.tiposEditaveis.includes('psicologia') && !nutri.tiposEditaveis.includes('fisioterapia'));
    assert.equal(nutri.criaPlano, true);
    assert.equal(nutri.editaResumoClinico, true, 'anamnese e da nutricao');

    const psico = resolveCaseCapabilities(user(ids.alunoB, 'aluno', { curso: 'Psicologia' }), casoComEquipe, 'equipe', tipos);
    assert.deepEqual(psico.tiposEditaveis, ['psicologia'], 'membro de psicologia so preenche o instrumento da sua area');
    assert.equal(psico.criaAvaliacao, true);
    assert.equal(psico.criaPlano, false, 'psicologia nao prescreve plano alimentar');
    assert.equal(psico.editaResumoClinico, false);

    const semVinculo = resolveCaseCapabilities(user(ids.alunoB, 'aluno', { curso: 'Psicologia' }), casoComEquipe, null, tipos);
    assert.deepEqual(semVinculo.tiposEditaveis, []);
    assert.equal(semVinculo.criaAvaliacao, false, 'sem vinculo nao ha capacidade alguma, seja qual for o curso');

    const supervisor = resolveCaseCapabilities(user(ids.profSupervisor, 'professor'), casoComEquipe, 'supervisao_aluno', tipos);
    assert.deepEqual(supervisor.tiposEditaveis, [], 'supervisor revisa; nao preenche instrumento pelo aluno');
    assert.equal(supervisor.editaResumoClinico, true);
    assert.equal(supervisor.criaPlano, false);

    const gestao = resolveCaseCapabilities(user(ids.admin, 'coordenacao'), casoComEquipe, 'gestao', tipos);
    assert.equal(gestao.editaTodosOsTipos, true);
    assert.equal(gestao.tiposEditaveis.length, tipos.length);

    // Sem equipe registrada, o responsavel herda a area do proprio curso; curso desconhecido cai em nutricao.
    const semEquipe = resolveCaseCapabilities(user(ids.alunoA, 'aluno'), { ...paciente, equipeProfissional: [] }, 'responsavel', tipos);
    assert.deepEqual(semEquipe.areas, ['nutricao']);
  });

  process.stdout.write(`\n${checks.length} verificacoes de autorizacao aprovadas.\n`);
})().catch((error) => { console.error(error); process.exit(1); });
