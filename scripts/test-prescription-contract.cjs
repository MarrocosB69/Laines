// Synthetic regression tests. No network, SMTP or real database.
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const root = path.resolve(__dirname, '..');
require(path.join(root, 'server/node_modules/ts-node')).register({
  project: path.join(root, 'server/tsconfig.json'), transpileOnly: true,
});
const { PlanoAlimentarService } = require(path.join(root, 'server/src/planos-alimentares/plano-alimentar.service.ts'));
const { normalizePrescription, mealsForPrint, prescriptionTotals } = require(path.join(root, 'server/src/planos-alimentares/prescricao-contract.ts'));
const clone = (value) => structuredClone(value);
let passed = 0;
async function check(name, test) { await test(); passed++; console.log(`PASS ${name}`); }
const student = { id: 'student', role: 'aluno', name: 'Estudante sintético' };
const reviewer = { id: 'reviewer', role: 'profissional', name: 'Revisor sintético', crn: 'CRN teste', status: 'ativo' };
const food = { id: '1', nome: 'Arroz sintético', fonte: 'TACO', grupo: 'cereais', grupoEquivalencia: 'choDisponivel',
  medidas: [{ descricao: null, gramas: 1 }], ig: null,
  comp: { kcal: 100, cho: 15, ptn: 5, lip: 2, fibra: 3, ferro: null } };
const meal = { id: 'meal', nome: 'Almoço', horarioFixo: '12:00', orientacoes: 'Manter esta orientação',
  itens: [{ id: 'item', alimentoId: '1', quantidade: 200, medidaIdx: 0, substitutos: [] }] };
const dados = { schemaVersion: 2, catalogo: { 1: food }, refeicoes: [meal], orientacoesGerais: 'Orientação geral',
  suplementos: [{ nome: 'Suplemento registrado', statusWADA: 'aprovado' }], extensaoExistente: { preservar: true } };
const legacyFood = { descricao: 'Legado sintético', quantidadeGramas: 200, calorias: 200, cho: 30, ptn: 10, lip: 4, fibra: 6 };

function fixture() {
  let row;
  const rows = new Map();
  let nextId = 0;
  const repo = {
    create: (data) => ({ ...data, id: ++nextId === 1 ? 'plan' : `plan-${nextId}` }),
    save: async (data) => { row = clone(data); rows.set(row.id, row); return clone(row); },
    findOne: async ({where}) => rows.has(where.id) ? clone(rows.get(where.id)) : null,
    findOneByOrFail: async ({id}) => clone(rows.get(id)),
    createQueryBuilder() {
      let patch, version, id = 'plan';
      const q = { update() { return this; }, set(data) { patch = { ...data }; return this; },
        setParameters(params) {
          if (typeof patch.dados === 'function' && params.planDados !== undefined) patch.dados = JSON.parse(params.planDados);
          if (typeof patch.resultados === 'function') patch.resultados = JSON.parse(params.planResultados);
          return this;
        },
        where(_clause, params) { if(params?.id) id=params.id; return this; }, andWhere(_clause, parameters) { if (parameters?.version !== undefined) version = parameters.version; return this; },
        execute: async () => {
          if (version === undefined) return { affected: 0 };
          row = rows.get(id);
          if (Number(row.dados.version || 0) !== version) return { affected: 0 };
          row = { ...row, ...patch }; rows.set(row.id, row); return { affected: 1 };
        } };
      return q;
    },
  };
  const paciente = { id: 'patient', nome: 'Paciente sintético', alunoResponsavelId: student.id,
    equipeMultiIds: [reviewer.id], atletaUserId: 'athlete' };
  repo.manager = { transaction: async (run) => run({ getRepository: (entity) => entity.name === 'PlanoAlimentar' ? repo : { findOne: async () => paciente } }) };
  const get = { id: 'get', status: 'concluida', dados: { getEstimadoKcal: 200, choG: 30, ptnG: 10, lipG: 4, fibrasG: 6 } };
  const query = { where() { return this; }, andWhere() { return this; }, orderBy() { return this; }, addOrderBy() { return this; }, getOne: async () => get };
  const users = { findOne: async ({ where }) => where.id === reviewer.id ? clone(reviewer)
    : where.id === student.id ? { ...student, status: 'ativo', crn: 'Client role cannot bypass' } : null };
  const foods = { findOne: async ({ where }) => where.id === 1 ? { id: 1, descricao: food.nome, grupo: food.grupo, fonte: 'TACO',
    energiaKcal: '100', carboidrato: '15', proteina: '5', lipidios: '2', fibra: '3' } : null };
  return { service: new PlanoAlimentarService(repo, { findOne: async () => paciente }, { createQueryBuilder: () => query }, users, foods),
    row: () => clone(row), setRow: (data) => { row = clone(data); rows.set(row.id, row); } };
}

(async () => {
  const { calcularPlano } = await import(pathToFileURL(path.join(root, 'src/core/prescricao/plano.js')).href);
  const { migrarRefeicao, por100 } = await import(pathToFileURL(path.join(root, 'src/core/prescricao/legado.js')).href);
  await check('schema 2 has the same front/server/PDF totals; no total from client', async () => {
    const canonical = normalizePrescription(clone(dados));
    canonical.refeicoes[0].totalRefeicao = { calorias: 999999 };
    const front = calcularPlano(canonical, {}, [], { catalogoPorId: canonical.catalogo });
    const total = prescriptionTotals(canonical);
    const printed = mealsForPrint(canonical);
    assert.equal(total.calorias, front.dia.kcal);
    assert.equal(total.calorias, 200);
    assert.equal(printed[0].totalRefeicao.calorias, 200);
    assert.equal(printed[0].alimentos[0].quantidadeGramas, 200);
  });
  await check('legacy migration preserves empty-items anomaly, guidance, alternatives, metadata and null', async () => {
    const raw = { refeicoes: [{ id: 'legacy', itens: [], alimentos: [legacyFood, legacyFood],
      substitutos: [legacyFood], orientacoes: 'Não perder', campoExistente: { a: true } }], outraExtensao: 7 };
    const canonical = normalizePrescription(raw);
    const catalogo = {};
    const front = migrarRefeicao(raw.refeicoes[0], 0, catalogo);
    assert.equal(canonical.refeicoes[0].itens.length, 2);
    assert.deepEqual(canonical.refeicoes[0].itens, front.itens);
    assert.equal(front.orientacoes, 'Não perder');
    assert.equal(canonical.outraExtensao, 7);
    assert.deepEqual(canonical.refeicoes[0].substitutosSemVinculo, [legacyFood]);
    assert.deepEqual(normalizePrescription(canonical), canonical);
    assert.equal(por100(null, 100), null);
    assert.equal(por100(0, 100), 0);
    const deleted = clone(canonical); deleted.refeicoes[0].itens = [];
    assert.equal(normalizePrescription(deleted).refeicoes[0].itens.length, 0, 'schema 2 cannot resurrect deleted items');
  });
  await check('unknown schema and physically impossible nutrient values are rejected', async () => {
    assert.throws(() => normalizePrescription({ schemaVersion: 200 }), /suportada/);
    const bad = clone(dados); bad.catalogo[1].comp.kcal = 999999;
    assert.throws(() => prescriptionTotals(bad), /Composição/);
    const f = fixture();
    await assert.rejects(f.service.calcularTotais([{ alimentos: [{ ...legacyFood, quantidadeGramas: 1, calorias: 99999 }] }]), /Composição/);
    const missing = clone(dados); missing.catalogo = {};
    assert.throws(() => prescriptionTotals(missing), /ausente/);
  });
  await check('substitutes print against the correct item and never increase daily totals', async () => {
    const data = clone(dados);
    data.catalogo.alt = { ...clone(food), id: 'alt', nome: 'Alternativa' };
    data.refeicoes[0].itens[0].substitutos = [{ alimentoId: 'alt', medidaIdx: 0, modo: 'auto' }];
    data.refeicoes[0].ancora = { ref: 'fim', min: 15 }; data.treinoInicio = '18:00'; data.treinoDuracao = 60;
    const printed = mealsForPrint(data)[0];
    assert.equal(printed.horario, '19:15');
    assert.equal(printed.substitutos[0].quantidadeGramas, 200);
    assert.equal(printed.substitutos[0].substitui, food.nome);
    assert.equal(prescriptionTotals(data).calorias, 200);
  });
  await check('save/reopen roundtrip uses controlled source composition and preserves all existing data', async () => {
    const f = fixture();
    const input = clone(dados); input.catalogo[1].comp.kcal = 999;
    const saved = await f.service.create({ pacienteId: 'patient', dados: input }, student);
    const reopened = await f.service.findById(saved.id, student);
    assert.equal(reopened.dados.catalogo[1].comp.kcal, 100);
    assert.equal(reopened.dados.version, 1);
    assert.equal(reopened.resultados.totaisCalculados.calorias, 200);
    assert.deepEqual(reopened.dados.extensaoExistente, dados.extensaoExistente);
    assert.equal(reopened.dados.refeicoes[0].orientacoes, meal.orientacoes);
    assert.deepEqual(reopened.dados.suplementos, dados.suplementos);
    const tampered = clone(reopened.dados); tampered.catalogo[1].comp.kcal = 101;
    await assert.rejects(f.service.update(saved.id, { expectedVersion: 1, dados: tampered }, student), /histórica/);
  });
  await check('review metadata cannot be forged and student cannot approve or activate', async () => {
    const f = fixture();
    const input = clone(dados); input.revisaoFinal = { confirmada: true, origem: 'servidor', version: 1,
      confirmadoPorId: reviewer.id, confirmadoEm: '2001-01-01' };
    const saved = await f.service.create({ pacienteId: 'patient', dados: input, status: 'em_revisao' }, student);
    assert.deepEqual(saved.dados.revisaoFinal, { confirmada: false });
    await assert.rejects(f.service.revisar('plan', 1, { ...student, role: 'profissional', crn: 'fake' }), /CRN/);
    await assert.rejects(f.service.ativar('plan', student, 1), /CRN/);
    await assert.rejects(f.service.update('plan', { expectedVersion: 1, status: 'ativo' }, student), /ativação/);
    await assert.rejects(f.service.create({ pacienteId: 'patient', dados: input, status: 'ativo' }, student), /Salve/);
  });
  await check('reviewer publishes exact version; subsequent edit creates draft and preserves published history', async () => {
    const f = fixture();
    await f.service.create({ pacienteId: 'patient', dados: clone(dados), status: 'em_revisao' }, student);
    const approved = await f.service.revisar('plan', 1, { ...reviewer, name: 'Spoofed' });
    assert.equal(approved.dados.revisaoFinal.confirmadoPorNome, reviewer.name);
    assert.equal(approved.dados.revisaoFinal.version, 2);
    assert.ok(Date.parse(approved.dados.revisaoFinal.confirmadoEm) > Date.parse('2025-01-01'));
    const active = await f.service.ativar('plan', reviewer, 2);
    assert.equal(active.status, 'ativo');
    const edited = await f.service.update('plan', { expectedVersion: 3, metaCalorica: 210 }, student);
    assert.equal(edited.status, 'rascunho');
    assert.deepEqual(edited.dados.revisaoFinal, { confirmada: false });
    assert.notEqual(edited.id, active.id);
    assert.equal(edited.dados.version, 1);
    assert.equal(edited.dados.origemPlanoId, active.id);
    const athlete = { id: 'athlete', role: 'atleta' };
    const published = await f.service.findById(active.id, athlete);
    assert.equal(published.status, 'ativo');
    assert.equal(published.entrega.version, 3);
    assert.equal(published.entrega.refeicoes[0].alimentos[0].quantidadeGramas, 200);
    await assert.rejects(f.service.findById(edited.id, athlete), /publicado/);
    await assert.rejects(f.service.gerarPDF(active.id, athlete, 2), /versão/i);
    await assert.rejects(f.service.remove(active.id, reviewer), (error) => error.getStatus() === 403);
  });
  await check('manual/legacy composition requires explicit professional validation', async () => {
    const f = fixture();
    await f.service.create({ pacienteId: 'patient', dados: { refeicoes: [{ alimentos: [legacyFood] }] }, status: 'em_revisao' }, student);
    await assert.rejects(f.service.revisar('plan', 1, reviewer), /explicitamente/);
    const approved = await f.service.revisar('plan', 1, reviewer, true);
    assert.equal(approved.dados.catalogo['legado-0-0'].validacaoComposicao.porId, reviewer.id);
  });
  await check('missing/stale version and simultaneous writes cannot overwrite another change', async () => {
    const f = fixture();
    await f.service.create({ pacienteId: 'patient', dados: clone(dados) }, student);
    await assert.rejects(f.service.update('plan', { metaCalorica: 100 }, student), /versão/);
    const attempts = await Promise.allSettled([
      f.service.update('plan', { expectedVersion: 1, metaCalorica: 201 }, student),
      f.service.update('plan', { expectedVersion: 1, metaCalorica: 202 }, student),
    ]);
    assert.equal(attempts.filter((a) => a.status === 'fulfilled').length, 1);
    assert.equal(attempts.filter((a) => a.status === 'rejected').length, 1);
    assert.equal(f.row().dados.version, 2);
    await assert.rejects(f.service.revisar('plan', 1, reviewer), /versão/);
  });
  await check('PDF is generated from current schema with real PDFKit and saved totals', async () => {
    const f = fixture();
    await f.service.create({ pacienteId: 'patient', dados: clone(dados) }, student);
    const pdf = await f.service.gerarPDF('plan', student);
    assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
    assert.ok(pdf.length > 1500);
  });
  console.log(`${passed} prescription regression checks passed.`);
})().catch((error) => { console.error(error); process.exitCode = 1; });
