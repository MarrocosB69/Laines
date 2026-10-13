// Synthetic regression tests. No network, SMTP or real database.
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const root = path.resolve(__dirname, '..');
require(path.join(root, 'server/node_modules/ts-node')).register({
  project: path.join(root, 'server/tsconfig.json'), transpileOnly: true,
});
const { PlanoAlimentarService } = require(path.join(root, 'server/src/planos-alimentares/plano-alimentar.service.ts'));
const { planoAlimentarPdfReport } = require(path.join(root, 'server/src/planos-alimentares/plano-alimentar.pdf.ts'));
const { assertSubstitutosAutomaticos, normalizePrescription, mealsForPrint, prescriptionTotals } = require(path.join(root, 'server/src/planos-alimentares/prescricao-contract.ts'));
const clone = (value) => structuredClone(value);
let passed = 0;
async function check(name, test) { await test(); passed++; console.log(`PASS ${name}`); }
const student = { id: 'student', role: 'aluno', name: 'Estudante sintético' };
const reviewer = { id: 'reviewer', role: 'profissional', name: 'Revisor sintético', crn: 'CRN teste', status: 'ativo' };
const food = { id: '1', nome: 'Arroz sintético', fonte: 'TACO', grupo: 'cereais e derivados', grupoEquivalencia: 'choDisponivel',
  medidas: [{ descricao: null, gramas: 1 }], ig: null,
  comp: { kcal: 100, cho: 15, ptn: 5, lip: 2, fibra: 3, ferro: null } };
const meal = { id: 'meal', nome: 'Almoço', horarioFixo: '12:00', orientacoes: 'Manter esta orientação',
  itens: [{ id: 'item', alimentoId: '1', quantidade: 200, medidaIdx: 0, substitutos: [] }] };
const dados = { schemaVersion: 2, catalogo: { 1: food }, refeicoes: [meal], orientacoesGerais: 'Orientação geral',
  suplementos: [{ nome: 'Suplemento registrado', statusWADA: 'aprovado' }], extensaoExistente: { preservar: true },
  restricoes: { semRestricao: true, observacao: 'Conferido no teste sintético' } };
const legacyFood = { descricao: 'Legado sintético', quantidadeGramas: 200, calorias: 200, cho: 30, ptn: 10, lip: 4, fibra: 6 };

function fixture(getStatus = 'finalizada') {
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
  const get = { id: 'get', status: getStatus, dados: { getEstimadoKcal: 200, choG: 30, ptnG: 10, lipG: 4, fibrasG: 6 } };
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
  await check('cross-group alternatives need an explicit quantity and never claim automatic equivalence', async () => {
    const { montarOpcao, opcoesDoItem } = await import(pathToFileURL(path.join(root, 'src/core/prescricao/equivalencia.js')).href);
    const data = clone(dados);
    const alternative = { ...clone(food), id: 'fat', nome: 'Gordura sintética', grupo: 'gorduras e oleos',
      grupoEquivalencia: 'lip', comp: { kcal: 900, cho: 0, ptn: 0, lip: 100, fibra: 0 } };
    data.catalogo.fat = alternative;
    const base = calcularPlano(data, {}, [], { catalogoPorId: data.catalogo }).resolvidas[0].itens[0];
    assert.equal(montarOpcao(base, alternative, 0, { grupos: { [food.grupo]: { ancora: 'choDisponivel' } } }), null);
    data.refeicoes[0].itens[0].substitutos = [{ alimentoId: 'fat', medidaIdx: 0, modo: 'auto' }];
    assert.throws(() => assertSubstitutosAutomaticos(data), /quantidade prescrita/);
    const unconfirmed = mealsForPrint(data)[0].substitutos[0];
    assert.equal(unconfirmed.quantidadeGramas, null);
    assert.equal(unconfirmed.quantidadePendente, true);
    await assert.rejects(fixture().service.create({ pacienteId: 'patient', dados: data, status: 'em_revisao' }, student), /quantidade prescrita/);
    data.refeicoes[0].itens[0].substitutos[0] = { alimentoId: 'fat', medidaIdx: 0, modo: 'fixa', quantidade: null };
    const pending = opcoesDoItem({ ...base, substitutos: data.refeicoes[0].itens[0].substitutos },
      { grupos: { [food.grupo]: { ancora: 'choDisponivel' } }, catalogoPorId: data.catalogo })[0];
    assert.equal(pending.quantidade, null);
    assert.equal(pending.pendenteQuantidade, true);
    assert.throws(() => prescriptionTotals(data), /Quantidade prescrita/);
    data.refeicoes[0].itens[0].substitutos[0] = { alimentoId: 'fat', medidaIdx: 0, modo: 'fixa', quantidade: 10 };
    assert.doesNotThrow(() => assertSubstitutosAutomaticos(data));
    assert.equal((await fixture().service.create({ pacienteId: 'patient', dados: data, status: 'em_revisao' }, student)).status, 'em_revisao');
    const option = opcoesDoItem({ ...base, substitutos: data.refeicoes[0].itens[0].substitutos },
      { grupos: { [food.grupo]: { ancora: 'choDisponivel' } }, catalogoPorId: data.catalogo })[0];
    assert.equal(option.desvio, null);
    assert.equal(option.quantidade, 10);
    const print = mealsForPrint(data)[0];
    assert.equal(print.substitutos[0].quantidadeGramas, 10);
    assert.equal(print.substitutos[0].semEquivalenciaAutomatica, true);
    assert.equal(prescriptionTotals(data).calorias, 200);
  });
  await check('save/reopen roundtrip uses controlled source composition and preserves all existing data', async () => {
    const f = fixture();
    const input = clone(dados); input.catalogo[1].comp.kcal = 999;
    input.catalogo[1].grupoEquivalencia = 'lip';
    input.catalogo[1].nomeExibicao = 'Alimento diferente';
    input.catalogo[1].codigoFonte = 'inventado';
    const saved = await f.service.create({ pacienteId: 'patient', dados: input }, student);
    const reopened = await f.service.findById(saved.id, student);
    assert.equal(reopened.dados.catalogo[1].comp.kcal, 100);
    assert.equal(reopened.dados.catalogo[1].grupoEquivalencia, 'choDisponivel');
    assert.equal(reopened.dados.catalogo[1].nomeExibicao, food.nome);
    assert.equal(reopened.dados.catalogo[1].codigoFonte, '');
    assert.equal(reopened.dados.version, 1);
    assert.equal(reopened.resultados.totaisCalculados.calorias, 200);
    assert.deepEqual(reopened.dados.extensaoExistente, dados.extensaoExistente);
    assert.equal(reopened.dados.refeicoes[0].orientacoes, meal.orientacoes);
    const oldInstruction = clone(dados);
    delete oldInstruction.refeicoes[0].orientacoes;
    oldInstruction.refeicoes[0].orientacao = 'Orientação antiga da refeição';
    assert.equal(mealsForPrint(oldInstruction)[0].orientacoes, 'Orientação antiga da refeição');
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
    await f.service.create({ pacienteId: 'patient', dados: { refeicoes: [{ alimentos: [legacyFood] }], restricoes: { semRestricao: true } }, status: 'em_revisao' }, student);
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
  await check('patient PDF uses the shared prescription without internal activation data', async () => {
    const PDFDocument = require(path.join(root, 'server/node_modules/pdfkit'));
    const originalText = PDFDocument.prototype.text;
    const text = [];
    PDFDocument.prototype.text = function (value, ...args) {
      text.push(String(value));
      return originalText.call(this, value, ...args);
    };
    try {
      for (const status of ['finalizada', 'rascunho']) {
        text.length = 0;
        const f = fixture(status);
        await f.service.create({ pacienteId: 'patient', dados: clone(dados) }, student);
        const pdf = await f.service.gerarPDF('plan', student);
        assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
        assert.ok(pdf.length > 1500);
        const printed = text.join(' ');
        assert.match(printed, /Paciente sintético/);
        assert.match(printed, /Arroz sintético/);
        assert.match(printed, /200 g/);
        assert.match(printed, /Orientação geral/);
        assert.match(printed, /Suplemento registrado/);
        assert.doesNotMatch(printed, /Score geral|Pronto para ativação|GlobalDRO|WADA|Justificativa clínica|plano: plan/i);
      }
      text.length = 0;
      const parcial = clone(dados);
      parcial.catalogo.manual = { ...clone(food), id: 'manual', nome: 'Alimento manual sem composição', fonte: 'manual',
        comp: { kcal: null, cho: null, ptn: null, lip: null, fibra: null } };
      parcial.refeicoes[0].itens.push({ id: 'manual-item', alimentoId: 'manual', quantidade: 100, medidaIdx: 0, substitutos: [] });
      const fParcial = fixture();
      await fParcial.service.create({ pacienteId: 'patient', dados: parcial }, student);
      await fParcial.service.gerarPDF('plan', student);
      assert.ok(text.some((line) => /Subtotal conhecido/i.test(line)), 'PDF precisa nomear total parcial');
      assert.ok(text.some((line) => /Composição parcial/i.test(line)), 'PDF precisa avisar composição parcial');
      assert.doesNotMatch(text.join(' '), /Cobertura da composição|Score geral/i);
      assert.equal(prescriptionTotals(fParcial.row().dados).calorias, 200, 'aviso não muda o total persistido');
    } finally {
      PDFDocument.prototype.text = originalText;
    }
  });
  await check('PDF projection keeps missing composition absent and never trusts an unreviewed signature', () => {
    const incomplete = clone(dados);
    incomplete.catalogo[1].comp = { kcal: null, cho: null, ptn: null, lip: null, fibra: null };
    incomplete.revisaoFinal = { confirmada: true, origem: 'cliente', version: 1,
      confirmadoPorNome: 'Assinatura não verificada', crn: '00000' };
    const canonical = normalizePrescription(incomplete);
    const printable = { ...canonical, refeicoes: mealsForPrint(canonical) };
    const report = planoAlimentarPdfReport({ status: 'rascunho', dataInicio: '2026-09-29',
      dataFim: null, tipoDieta: 'fixa' }, { nome: 'Atleta sintético' }, printable, false);
    const exported = JSON.stringify(report);
    assert.match(exported, /Sem composição/);
    assert.match(exported, /—/);
    assert.doesNotMatch(exported, /Assinatura não verificada|CRN 00000/);
    assert.equal(report.patientVariant, 'compact');
  });
  const choiceListOf = (data) => {
    const canonical = normalizePrescription(data);
    const printable = { ...canonical, refeicoes: mealsForPrint(canonical) };
    const report = planoAlimentarPdfReport({ status: 'rascunho', dataInicio: '2026-09-29',
      dataFim: null, tipoDieta: 'fixa' }, { nome: 'Atleta sintético' }, printable, false);
    const find = (blocks) => blocks.flatMap((block) =>
      block.kind === 'choiceList' ? [block] : block.blocks ? find(block.blocks) : []);
    const lists = find(report.blocks);
    assert.equal(lists.length, 1);
    return lists[0];
  };
  await check('PDF pairs identical primary names by prescription item, never by food name', () => {
    const data = clone(dados);
    data.catalogo.altA = { ...clone(food), id: 'altA', nome: 'Alternativa A' };
    data.catalogo.altB = { ...clone(food), id: 'altB', nome: 'Alternativa B' };
    data.refeicoes[0].itens = [
      { id: 'primeiro', alimentoId: '1', quantidade: 200, medidaIdx: 0,
        substitutos: [{ alimentoId: 'altA', medidaIdx: 0, modo: 'fixa', quantidade: 80 }] },
      { id: 'segundo', alimentoId: '1', quantidade: 120, medidaIdx: 0,
        substitutos: [{ alimentoId: 'altB', medidaIdx: 0, modo: 'fixa', quantidade: 60 }] }
    ];
    const choices = choiceListOf(data);
    assert.equal(choices.entries.length, 2);
    assert.equal(choices.entries[0].primary.name, choices.entries[1].primary.name);
    assert.match(choices.entries[0].primary.quantity, /200 g/);
    assert.match(choices.entries[1].primary.quantity, /120 g/);
    assert.match(choices.entries[0].alternatives[0].name, /Alternativa A/);
    assert.match(choices.entries[1].alternatives[0].name, /Alternativa B/);
    assert.equal(choices.unlinked.length, 0);
  });
  await check('PDF isolates legacy alternatives without a known primary', () => {
    const legacy = { refeicoes: [{ nome: 'Refeição legada',
      alimentos: [legacyFood, { ...legacyFood, descricao: 'Segundo principal' }],
      substitutos: [{ ...legacyFood, descricao: 'Alternativa sem vínculo' }] }] };
    const choices = choiceListOf(legacy);
    assert.equal(choices.entries.length, 2);
    assert.ok(choices.entries.every((entry) => entry.alternatives.length === 0));
    assert.equal(choices.unlinked.length, 1);
    assert.match(choices.unlinked[0].name, /Alternativa sem vínculo/);
  });
  await check('PDF labels pending and manually defined alternative quantities', () => {
    const data = clone(dados);
    data.catalogo.fat = { ...clone(food), id: 'fat', nome: 'Alternativa de outro grupo',
      grupo: 'gorduras e oleos', comp: { kcal: 900, cho: 0, ptn: 0, lip: 100, fibra: 0 } };
    data.refeicoes[0].itens[0].substitutos = [{ alimentoId: 'fat', medidaIdx: 0, modo: 'auto' }];
    const pending = choiceListOf(data).entries[0].alternatives[0];
    assert.match(pending.quantity, /quantidade não confirmada/i);
    data.refeicoes[0].itens[0].substitutos[0] =
      { alimentoId: 'fat', medidaIdx: 0, modo: 'fixa', quantidade: 10 };
    const manual = choiceListOf(data).entries[0].alternatives[0];
    assert.match(manual.quantity, /10 g/);
    assert.ok(manual.note, 'quantidade sem equivalência automática deve ter nota');
  });
  await check('UPD-11 references follow sex and age from existing records; unknown or under 19 stays null', async () => {
    const { contextoReferencias } = require(path.join(root, 'server/src/planos-alimentares/referencias-prescricao.ts'));
    const hoje = '2026-09-20';
    const linha = (ctx, nutriente) => ctx.linhas.find((l) => l.nutriente === nutriente).valor;
    const homem25 = contextoReferencias({ sexoBiologico: 'Masculino', dataNascimento: '2001-03-10' }, null, hoje);
    assert.equal(homem25.grupo, 'homem 19–30 anos');
    assert.equal(linha(homem25, 'ferro'), 8);
    assert.equal(linha(homem25, 'magnesio'), 400);
    const mulher25 = contextoReferencias({ sexoBiologico: 'F', dataNascimento: '2001-03-10' }, null, hoje);
    assert.equal(mulher25.grupo, 'mulher 19–30 anos');
    assert.equal(linha(mulher25, 'ferro'), 18);
    assert.equal(linha(mulher25, 'fibra'), 25);
    assert.equal(linha(mulher25, 'potassio'), 2600);
    const mulher60 = contextoReferencias({ sexo: 'feminino', dataNascimento: '1966-01-01' }, null, hoje);
    assert.equal(mulher60.grupo, 'mulher 51–70 anos');
    assert.equal(linha(mulher60, 'calcio'), 1200);
    assert.equal(linha(mulher60, 'ferro'), 8);
    const homem75 = contextoReferencias({ sexo: 'M', dataNascimento: '1950-01-01' }, null, hoje);
    assert.equal(linha(homem75, 'vitaminaD'), 20);
    assert.equal(linha(homem75, 'sodio'), 2300);
    assert.equal(homem75.linhas.find((l) => l.nutriente === 'sodio').direcao, 'limite');
    const adolescente = contextoReferencias({ sexo: 'feminino', dataNascimento: '2010-01-01' }, null, hoje);
    assert.equal(adolescente.grupo, null);
    assert.ok(adolescente.linhas.every((l) => l.valor === null));
    assert.match(adolescente.motivo, /menores de 19/);
    const semSexo = contextoReferencias({ dataNascimento: '2001-03-10' }, null, hoje);
    assert.equal(semSexo.grupo, null);
    assert.match(semSexo.motivo, /Sexo biológico não informado/);
    const rascunho = contextoReferencias({}, { status: 'rascunho', dados: { sexoBiologico: 'M', dataNascimento: '2001-03-10' } }, hoje);
    assert.equal(rascunho.grupo, null, 'anamnese em rascunho não vira perfil de referência');
  });
  await check('UPD-11/UPD-18 o sexo informado no onboarding do atleta chega a referencia (campo certo, nao `genero`)', async () => {
    const { contextoReferencias } = require(path.join(root, 'server/src/planos-alimentares/referencias-prescricao.ts'));
    const hoje = '2026-09-23';
    // O assistente do atleta rotula o campo "Sexo biologico". Se ele gravar
    // apenas `genero`, a referencia nao encontra o dado e a paciente fica sem
    // DRI mesmo tendo respondido — foi o defeito corrigido em UPD-18.
    const soGenero = contextoReferencias({ genero: 'feminino', dataNascimento: '2001-03-10' }, null, hoje);
    assert.equal(soGenero.grupo, null, '`genero` sozinho nao e sexo biologico: pode ser identidade de genero');

    const comSexoBiologico = contextoReferencias({ genero: 'feminino', sexoBiologico: 'feminino', dataNascimento: '2001-03-10' }, null, hoje);
    assert.equal(comSexoBiologico.grupo, 'mulher 19–30 anos');
    assert.equal(comSexoBiologico.linhas.find((l) => l.nutriente === 'ferro').valor, 18);
  });
  await check('UPD-11 restriction check is stamped by the server and required before review', async () => {
    const f = fixture();
    const forged = clone(dados);
    forged.restricoes = { semRestricao: false, grupos: ['leites'], conferidoPorId: 'forjado', conferidoPorNome: 'Forjado', conferidoEm: '2001-01-01',
      origem: { descricao: 'intolerância a lactose', avaliacaoId: 'anamnese-1' } };
    const saved = await f.service.create({ pacienteId: 'patient', dados: forged }, student);
    assert.equal(saved.dados.restricoes.conferidoPorId, student.id);
    assert.equal(saved.dados.restricoes.conferidoPorNome, student.name);
    assert.ok(Date.parse(saved.dados.restricoes.conferidoEm) > Date.parse('2025-01-01'));
    assert.deepEqual(saved.dados.restricoes.grupos, ['leites']);
    assert.equal(saved.dados.restricoes.origem.descricao, 'intolerância a lactose');
    const firstStamp = saved.dados.restricoes.conferidoEm;
    const unchanged = await f.service.update('plan', { expectedVersion: 1, metaCalorica: 210 }, reviewer);
    assert.equal(unchanged.dados.restricoes.conferidoEm, firstStamp, 'conferência inalterada preserva autoria e data');
    assert.equal(unchanged.dados.restricoes.conferidoPorId, student.id);
    const g = fixture();
    const semConferencia = clone(dados); delete semConferencia.restricoes;
    await assert.rejects(g.service.create({ pacienteId: 'patient', dados: semConferencia, status: 'em_revisao' }, student), /Confira as restrições/);
    const draft = await g.service.create({ pacienteId: 'patient', dados: semConferencia }, student);
    assert.equal(draft.dados.restricoes, undefined, 'rascunho pode ser salvo sem conferência');
    await assert.rejects(g.service.update('plan', { expectedVersion: 1, status: 'em_revisao' }, student), /Confira as restrições/);
  });
  await check('UPD-11 item conflicting with a confirmed restriction needs an explicit justification', async () => {
    const f = fixture();
    const conflicting = clone(dados);
    conflicting.restricoes = { semRestricao: false, grupos: [food.grupo] };
    await assert.rejects(f.service.create({ pacienteId: 'patient', dados: conflicting, status: 'em_revisao' }, student), /Arroz sintético/);
    conflicting.restricoes.justificativas = { item: 'ok' };
    await assert.rejects(f.service.create({ pacienteId: 'patient', dados: conflicting, status: 'em_revisao' }, student), /sem justificativa/);
    conflicting.restricoes.justificativas = { item: 'Tolerância confirmada em consulta; manter porção reduzida.' };
    const saved = await f.service.create({ pacienteId: 'patient', dados: conflicting, status: 'em_revisao' }, student);
    assert.equal(saved.status, 'em_revisao');
    const approved = await f.service.revisar('plan', 1, reviewer);
    assert.equal(approved.dados.restricoes.justificativas.item, 'Tolerância confirmada em consulta; manter porção reduzida.');
    const byFood = clone(dados); byFood.restricoes = { semRestricao: false, alimentoIds: ['1'] };
    await assert.rejects(fixture().service.create({ pacienteId: 'patient', dados: byFood, status: 'em_revisao' }, student), /Arroz sintético/);
  });
  await check('restricted substitutes require their own justification before review', async () => {
    const { conflitosDeRestricao } = require(path.join(root, 'server/src/planos-alimentares/referencias-prescricao.ts'));
    for (const key of ['alimentoIds', 'grupos']) {
      const data = clone(dados);
      data.catalogo.alt = { ...clone(food), id: 'alt', nome: 'Leite sintético', grupo: 'leite e derivados' };
      data.refeicoes[0].itens[0].substitutos = [{ alimentoId: 'alt', medidaIdx: 0, modo: 'fixa', quantidade: 100 }];
      data.restricoes = { semRestricao: false, [key]: [key === 'grupos' ? 'leite e derivados' : 'alt'] };
      const f = fixture();
      await assert.rejects(f.service.create({ pacienteId: 'patient', dados: data, status: 'em_revisao' }, student), /Leite sintético/);
      const conflict = conflitosDeRestricao({ ...data, restricoes: { ...data.restricoes, conferidoEm: '2026-09-01' } });
      assert.equal(conflict[0].itemId, 'item:alt');
      data.restricoes.justificativas = { 'item:alt': 'Alternativa avaliada individualmente pela equipe.' };
      const saved = await f.service.create({ pacienteId: 'patient', dados: data, status: 'em_revisao' }, student);
      assert.equal(saved.status, 'em_revisao');
      const approved = await f.service.revisar('plan', 1, reviewer, true);
      assert.equal(approved.dados.restricoes.justificativas['item:alt'], data.restricoes.justificativas['item:alt']);
    }
  });
  console.log(`${passed} prescription regression checks passed.`);
})().catch((error) => { console.error(error); process.exitCode = 1; });
