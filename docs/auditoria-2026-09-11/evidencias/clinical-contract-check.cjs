// Read-only audit: current TS source, in-memory repository doubles, synthetic data.
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');
const root = path.resolve(__dirname, '../../..');
require(path.join(root, 'server/node_modules/ts-node')).register({
  project: path.join(root, 'server/tsconfig.json'), transpileOnly: true,
});
const { PlanoAlimentarService } = require(path.join(root, 'server/src/planos-alimentares/plano-alimentar.service.ts'));

(async () => {
  const { calcularPlano } = await import(pathToFileURL(path.join(root, 'src/core/prescricao/plano.js')).href);
  const { migrarRefeicao, por100 } = await import(pathToFileURL(path.join(root, 'src/core/prescricao/legado.js')).href);
  const { situacaoAdequacao } = await import(pathToFileURL(path.join(root, 'src/core/prescricao/adequacao.js')).href);
  const catalogo = { audit_food: { id: 'audit_food', nome: 'Alimento sintético', fonte: 'fixture', grupo: null,
    ig: null, medidas: [{ descricao: null, gramas: 1 }], comp: { kcal: 100, cho: 15, ptn: 5, lip: 2, fibra: 3 } } };
  const refeicoes = [{ id: 'audit_meal', nome: 'Refeição sintética', horario: '12:00',
    itens: [{ id: 'audit_item', alimentoId: 'audit_food', quantidade: 200, medidaIdx: 0, substitutos: [] }] }];
  const metas = { kcal: 200, cho: 30, ptn: 10, lip: 4, fibra: 6 };
  const evaluation = { id: 'synthetic_get', tipo: 'gasto_energetico_total', status: 'rascunho',
    dados: { getEstimadoKcal: 200, choG: 30, ptnG: 10, lipG: 4, fibrasG: 6 }, resultados: {} };
  const query = { where() { return this; }, andWhere() { return this; }, orderBy() { return this; },
    addOrderBy() { return this; }, getOne: async () => evaluation };
  const service = new PlanoAlimentarService({}, {}, { createQueryBuilder: () => query });
  const normalized = service.normalizeDados({ refeicoes, catalogo, revisaoFinal: { confirmada: true } });
  const frontend = calcularPlano({ refeicoes }, metas, [], { catalogoPorId: catalogo });
  const backend = await service.calcularTotais(normalized.refeicoes);
  const activation = await service.validarAtivacaoClinica({ pacienteId: 'synthetic_patient', dados: normalized });
  const spoof = service.stampRevisaoFinal({ revisaoFinal: {
    confirmada: true, confirmadoPorId: 'other_professional', confirmadoPorNome: 'Identidade declarada no payload',
    confirmadoEm: '2001-01-01T00:00:00.000Z' } }, { id: 'student_actor', name: 'Estudante', role: 'aluno' });
  const legacy = { id: 'legacy_meal', nome: 'Legado', horario: '12:00',
    alimentos: [{ descricao: 'Alimento sintético', quantidadeGramas: 200, calorias: 200, cho: 30, ptn: 10, lip: 4, fibra: 6 }],
    substitutos: [], orientacoes: 'Orientação clínica sintética' };
  const normalizedLegacy = service.normalizeDados({ refeicoes: [legacy] }).refeicoes[0];
  const migratedNormalizedLegacy = migrarRefeicao(normalizedLegacy, 0, {});
  const migratedRawLegacy = migrarRefeicao(legacy, 0, {});
  const getBased = await service.validarAdequacao({ pacienteId: 'synthetic_patient', dados: { refeicoes: [legacy] } });
  const fakeTotals = await service.calcularTotais([{ alimentos: [{ tacoId: 1, quantidadeGramas: 1, calorias: 99999, cho: 88888 }] }]);
  const result = {
    scope: 'Synthetic data, current source via ts-node, no API/DB writes or reads',
    newContract: { frontendTotals: frontend.dia, backendTotals: backend,
      activationAllowed: activation.podeAtivar, blockers: activation.bloqueios },
    legacyContract: { normalizedLegacyItemCount: normalizedLegacy.itens.length,
      normalizedLegacyFoodCount: normalizedLegacy.alimentos.length,
      frontendAfterNormalizedLegacyItemCount: migratedNormalizedLegacy.itens.length,
      rawLegacyMigrationPreservesGuidance: Object.hasOwn(migratedRawLegacy, 'orientacoes'),
      rawLegacyMigrationPreservesUnlinkedSubstitutes: Object.hasOwn(migratedRawLegacy, 'substitutosSemVinculo'),
      backendPreservesUnlinkedSubstitutes: Object.hasOwn(service.normalizeDados({ refeicoes: [migratedRawLegacy] }).refeicoes[0], 'substitutosSemVinculo') },
    clientSuppliedReview: spoof.revisaoFinal,
    draftGetUsedAsReference: { fixtureStatus: evaluation.status, returnedEvaluationId: getBased.metasGet.avaliacaoId },
    frontendVsBackendAdequacy: { frontendFor200Percent: situacaoAdequacao({ percentual: 200, direcao: 'meta', cobertura: 1 }),
      backendFor200Percent: service.clampAdequacao(100, 200) },
    legacyNullToZero: por100(null, 100),
    clientSuppliedLegacyNutrients: fakeTotals,
  };
  fs.writeFileSync(path.join(__dirname, 'clinical-contract-result.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
})().catch((error) => { console.error(error); process.exitCode = 1; });
