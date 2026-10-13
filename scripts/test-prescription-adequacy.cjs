// Synthetic patients and repository doubles; no network, database or patient records.
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const root = path.resolve(__dirname, '..');
require(path.join(root, 'server/node_modules/ts-node')).register({ project: path.join(root, 'server/tsconfig.json'), transpileOnly: true });
const { PlanoAlimentarService } = require(path.join(root, 'server/src/planos-alimentares/plano-alimentar.service.ts'));
const { contextoReferencias } = require(path.join(root, 'server/src/planos-alimentares/referencias-prescricao.ts'));
const clone = (value) => structuredClone(value);
const user = { id: 'student-synthetic', role: 'aluno' };
const patient = { id: 'patient-synthetic', alunoResponsavelId: user.id, sexoBiologico: 'masculino', dataNascimento: '2000-03-10' };
const get = { id: 'get-final', pacienteId: patient.id, tipo: 'gasto_energetico_total', status: 'finalizada',
  data: '2026-09-01', measuredAt: '2026-09-01T12:00:00Z', formulaId: 'synthetic-method', sourceSystem: 'synthetic-test',
  dados: { getEstimadoKcal: 200, choG: 30, ptnG: 10, lipG: 4, fibrasG: 0 } };
const anamnesis = { id: 'anamnesis-final', pacienteId: patient.id, tipo: 'anamnese_inicial', status: 'finalizada',
  data: '2026-09-01', dados: { alergias: 'Nenhuma' } };
const food = { id: 'food', nome: 'Alimento sintético', fonte: 'TACO', grupo: 'frutas', ig: null,
  medidas: [{ descricao: 'porção sintética', gramas: 100 }],
  comp: { kcal: 100, cho: 15, ptn: 5, lip: 2, fibra: 0, sodio: 0, ferro: null } };
const data = { schemaVersion: 2, catalogo: { food }, refeicoes: [{ id: 'meal', itens: [
  { id: 'item', alimentoId: 'food', quantidade: 2, medidaIdx: 0, substitutos: [] }
] }] };
const groups = { frutas: { ancora: 'choDisponivel' } };

function fixture(paciente = patient, evaluations = [get, anamnesis]) {
  const queries = [];
  const avaliacoesRepo = { createQueryBuilder() {
    const params = {}, clauses = [];
    return {
      where(clause, values) { clauses.push(clause); Object.assign(params, values); return this; },
      andWhere(clause, values) { return this.where(clause, values); },
      orderBy() { return this; }, addOrderBy() { return this; },
      async getOne() {
        queries.push({ ...params });
        const rows = evaluations.filter((row) => row.pacienteId === params.pacienteId && row.tipo === params.tipo
          && (!params.statusElegivel || row.status === params.statusElegivel)
          && (!clauses.some((c) => c.includes('deletedAt IS NULL')) || !row.deletedAt));
        rows.sort((a, b) => String(b.measuredAt || b.data).localeCompare(String(a.measuredAt || a.data)));
        return clone(rows[0] || null);
      }
    };
  } };
  return { queries, service: new PlanoAlimentarService({ findOne: async () => null }, {
    findOne: async ({ where }) => where.id === paciente.id ? clone(paciente) : null
  }, avaliacoesRepo) };
}

let passed = 0;
async function check(name, test) { await test(); passed++; console.log(`PASS ${name}`); }
(async () => {
  const core = await import(pathToFileURL(path.join(root, 'src/core/prescricao/index.js')).href);
  const { adaptarMetas } = await import(pathToFileURL(path.join(root, 'src/services/prescricaoCatalogo.js')).href);
  const { calcularPlano, situacaoAdequacao, substitutosPara } = core;
  const front = (payload, metas, refs = []) => calcularPlano(payload, metas, refs, { catalogoPorId: payload.catalogo });

  await check('patient data selects an eligible DRI group; unsupported or missing profiles never inherit seed', async () => {
    const male = await fixture().service.getPacienteContext(patient.id, user);
    assert.equal(male.referencias.grupo, 'homem 19–30 anos');
    assert.ok(male.referencias.linhas.every((row) => Number.isFinite(row.valor)));
    const female = await fixture({ ...patient, sexoBiologico: 'feminino' }).service.getPacienteContext(patient.id, user);
    assert.equal(female.referencias.grupo, 'mulher 19–30 anos');
    assert.ok(female.referencias.linhas.every((row) => Number.isFinite(row.valor)));
    for (const profile of [
      { ...patient, sexoBiologico: null },
      { ...patient, dataNascimento: null }, { ...patient, dataNascimento: '2010-03-10' },
      { ...patient, dataNascimento: '2000-02-30' }
    ]) {
      const ctx = await fixture(profile).service.getPacienteContext(patient.id, user);
      assert.equal(ctx.referencias.grupo, null);
      assert.ok(ctx.referencias.motivo);
      assert.ok(ctx.referencias.linhas.every((row) => row.valor === null));
      assert.equal(adaptarMetas(ctx).kcal, 200, 'individual GET remains available without DRI');
    }
    assert.equal(contextoReferencias({ ...patient, dataNascimento: '2007-09-14' }, null, '2026-09-13').grupo, null);
    assert.equal(contextoReferencias({ ...patient, dataNascimento: '2007-09-14' }, null, '2026-09-14').grupo, 'homem 19–30 anos');
  });

  await check('last finalized GET supplies patient targets and provenance; newer draft/deleted/other-patient records are excluded', async () => {
    const evaluations = [get, anamnesis,
      { ...get, id: 'draft', status: 'rascunho', measuredAt: '2026-09-12', dados: { getEstimadoKcal: 999 } },
      { ...get, id: 'deleted', deletedAt: '2026-09-12', measuredAt: '2026-09-12' },
      { ...get, id: 'other-patient', pacienteId: 'other', measuredAt: '2026-09-12' }
    ];
    const f = fixture(patient, evaluations);
    const ctx = await f.service.getPacienteContext(patient.id, user);
    const result = await f.service.validarAdequacao({ pacienteId: patient.id, dados: clone(data) });
    assert.equal(ctx.origemMetas.avaliacaoId, get.id);
    assert.equal(ctx.origemMetas.status, 'finalizada');
    assert.equal(ctx.origemMetas.data, get.measuredAt);
    assert.equal(ctx.origemMetas.metodo, get.formulaId);
    assert.equal(ctx.origemMetas.origem, get.sourceSystem);
    assert.equal(result.comparativo.calorias.meta, 200);
    assert.equal(result.comparativo.calorias.adequacao, 100);
    assert.ok(f.queries.every((q) => q.statusElegivel === 'finalizada'));
    const empty = await fixture(patient, [{ ...get, status: 'rascunho' }]).service.validarAdequacao({ pacienteId: patient.id, dados: clone(data) });
    assert.equal(empty.hasMetasGet, false);
    assert.equal(empty.comparativo.calorias.meta, null);
    assert.equal(empty.comparativo.calorias.adequacao, null);
    assert.equal(empty.scoreAdequacaoPercent, null);
    const noFoods = await f.service.validarAdequacao({ pacienteId: patient.id, dados: { schemaVersion: 2, catalogo: {}, refeicoes: [] } });
    assert.equal(noFoods.comparativo.calorias.prescrito, null);
    assert.equal(noFoods.scoreAdequacaoPercent, null);
  });

  await check('finalized anamnesis restrictions reach suggestion engine; free text suspends guesses, known IDs remain excluded', async () => {
    const base = front(data, {}).resolvidas[0].itens[0];
    const alternatives = [food, { ...clone(food), id: 'alternative', nome: 'Alternativa sintética' }];
    const clear = await fixture().service.getPacienteContext(patient.id, user);
    assert.equal(substitutosPara(base, { grupos: groups, catalogo: alternatives, restricoes: clear.restricoes }).candidatos.length, 1);
    for (const alergias of ['Leite', 'Não possui alergia a leite, mas amendoim causa reação', '']) {
      const ctx = await fixture(patient, [get, { ...anamnesis, dados: { alergias } }]).service.getPacienteContext(patient.id, user);
      const result = substitutosPara(base, { grupos: groups, catalogo: alternatives, restricoes: ctx.restricoes });
      assert.deepEqual(result.candidatos, []);
      assert.equal(result.motivo, 'restricoes-pendentes');
      assert.equal(ctx.restricoes.origem.avaliacaoId, anamnesis.id);
      assert.ok(ctx.restricoes.motivo);
    }
    assert.deepEqual(substitutosPara(base, { grupos: groups, catalogo: alternatives, restricoes: ['alternative'] }).candidatos, []);
    const draft = { ...anamnesis, id: 'anamnesis-draft', status: 'rascunho', data: '2026-09-12', dados: { alergias: 'Leite' } };
    const previous = await fixture(patient, [get, anamnesis, draft]).service.getPacienteContext(patient.id, user);
    assert.equal(previous.restricoes.origem.avaliacaoId, anamnesis.id);
    const onlyDraft = await fixture(patient, [get, draft]).service.getPacienteContext(patient.id, user);
    assert.equal(onlyDraft.restricoes.origem, null);
    assert.equal(onlyDraft.restricoes.pendenteRevisao, true);
  });

  await check('unknown nutrients remain null, measured zero stays zero, partial coverage cannot imply certainty', async () => {
    const f = fixture();
    const ctx = await f.service.getPacienteContext(patient.id, user);
    const metas = adaptarMetas(ctx);
    for (const value of [null, 0]) {
      const payload = clone(data); payload.catalogo.food.comp.cho = value;
      const view = front(payload, metas, ctx.referencias.linhas).macros.find((line) => line.nutriente === 'cho');
      const result = await f.service.validarAdequacao({ pacienteId: patient.id, dados: payload });
      assert.equal(view.valor, value);
      assert.equal(result.comparativo.cho.prescrito, value);
      assert.equal(view.cobertura, value === null ? 0 : 1);
      assert.equal(situacaoAdequacao(view), result.comparativo.cho.situacao);
    }
    const payload = clone(data);
    payload.catalogo.unknown = { ...clone(food), id: 'unknown', comp: { ...food.comp, cho: null } };
    payload.refeicoes[0].itens.push({ id: 'unknown-item', alimentoId: 'unknown', quantidade: 6, medidaIdx: 0 });
    const view = front(payload, metas).macros.find((line) => line.nutriente === 'cho');
    const result = await f.service.validarAdequacao({ pacienteId: patient.id, dados: payload });
    assert.equal(view.cobertura, 0.25);
    assert.equal(result.comparativo.cho.cobertura, view.cobertura);
    assert.equal(situacaoAdequacao(view), 'sem-dado');
    assert.equal(result.comparativo.cho.adequacao, null);
    payload.catalogo.unknown.comp.kcal = null;
    const withoutEnergy = front(payload, metas).macros.find((line) => line.nutriente === 'cho');
    const serverWithoutEnergy = await f.service.validarAdequacao({ pacienteId: patient.id, dados: payload });
    assert.equal(withoutEnergy.cobertura, 0.5);
    assert.equal(serverWithoutEnergy.comparativo.cho.cobertura, 0.5);
    assert.equal(result.comparativo.fibras.meta, 0, 'a recorded zero target is preserved, not converted into absence');
  });

  await check('individual target, population reference and limit have distinct meanings; excess target is never green', async () => {
    const f = fixture();
    const ctx = await f.service.getPacienteContext(patient.id, user);
    const metas = adaptarMetas(ctx);
    for (const ratio of [0.5, 0.85, 1, 1.15, 2]) {
      const payload = clone(data); payload.refeicoes[0].itens[0].quantidade *= ratio;
      const view = front(payload, metas).macros.find((line) => line.nutriente === 'kcal');
      const result = await f.service.validarAdequacao({ pacienteId: patient.id, dados: payload });
      assert.equal(situacaoAdequacao(view), result.comparativo.calorias.situacao);
      if (ratio === 2) {
        assert.equal(situacaoAdequacao(view), 'excedido');
        assert.equal(result.comparativo.calorias.adequacao, 0);
      }
    }
    assert.equal(situacaoAdequacao({ percentual: 200, direcao: 'referencia', cobertura: 1 }), 'referencia-atingida');
    assert.equal(situacaoAdequacao({ percentual: 101, direcao: 'limite', cobertura: 1 }), 'excedido');
    assert.equal(situacaoAdequacao({ percentual: 50, direcao: 'limite', cobertura: 1 }), 'ok');
    assert.equal(situacaoAdequacao({ percentual: null, direcao: 'meta', cobertura: 1 }), 'sem-dado');
  });
  console.log(`${passed} patient-based adequacy checks passed.`);
})().catch((error) => { console.error(error); process.exitCode = 1; });
