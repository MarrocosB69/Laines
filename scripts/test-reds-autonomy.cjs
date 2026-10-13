const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
process.env.TS_NODE_PROJECT = path.join(root, 'server', 'tsconfig.json');
require('../server/node_modules/ts-node/register/transpile-only');

const { normalizeTriagemRedsPayload } = require('../server/src/avaliacoes/normalizers/triagem-reds-normalizer.ts');
const source = fs.readFileSync(path.join(root, 'src/views/avaliacoes/AvaliacaoTriagemREDS.jsx'), 'utf8');

const normalize = (dados) => normalizeTriagemRedsPayload({ tipo: 'triagem_reds', dados, resultados: {} });

const propria = normalize({
  ingestaoKcalR24hManual: 2200,
  gastoExercicioKcalManual: 500,
  massaMagraKgManual: 50
});
assert.equal(propria.resultados.DE, 34);
assert.equal(propria.resultados.classificacaoDE, 'risco_relativo');
assert.deepEqual(propria.resultados.precisaDadosExtras, []);

const incompleta = normalize({ ingestaoKcalR24hManual: 2200, massaMagraKgManual: 0 });
assert.equal(incompleta.resultados.DE, null);
assert.deepEqual(incompleta.resultados.precisaDadosExtras, ['gastoExercicioKcal', 'massaMagraKg']);

const legado = normalize({
  ingestaoKcalR24hAuto: 1600,
  gastoExercicioKcalAuto: 700,
  massaMagraKgAuto: 50
});
assert.equal(legado.resultados.DE, 18);
assert.deepEqual(legado.resultados.precisaDadosExtras, []);

// WI-013: o rótulo escrito usa o glossário; o código da faixa não muda.
assert.equal(propria.classificacao, 'risco_relativo');
assert.equal(propria.classificacaoLabel, 'Disponibilidade energética reduzida');
assert.equal(legado.classificacao, 'reds_estabelecido');
assert.equal(legado.classificacaoLabel, 'Baixa disponibilidade energética');
assert.equal(
  normalize({ ingestaoKcalR24hManual: 3000, gastoExercicioKcalManual: 500, massaMagraKgManual: 50 }).classificacaoLabel,
  'Disponibilidade energética adequada'
);
assert.doesNotMatch(source, /RED-S/);

assert.doesNotMatch(source, /allEvaluationHistory|findLatestEvaluationByType|latestAlimentar|latestGet|latestComposicao/);
assert.match(source, /readNumberByAliases\(moduleSnapshot/);
assert.match(source, /setIngestaoManual\(toInput\(readNumberByAliases/);
assert.match(source, /setGastoManual\(toInput\(readNumberByAliases/);
assert.match(source, /setMassaMagraManual\(toInput\(readNumberByAliases/);

console.log('Disponibilidade energética: entradas próprias, lacunas por campo e snapshot legado verificados.');
