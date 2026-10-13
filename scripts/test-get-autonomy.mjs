import assert from 'node:assert/strict';
import { calculateGetEvaluation } from '../src/services/calculationEngine.js';
import { restoreSavedGetForDisplay } from '../src/components/Avaliacoes/Antropometria/getSavedDisplay.js';

const profile = {
  sex: 'male',
  weightKg: 72,
  heightCm: 178,
  ageYears: 27,
  activityLevel: 'moderadamente_ativo'
};

const siblingHistory = [{
  id: 'synthetic-composition',
  tipo: 'composicao_corporal_integrada',
  sessaoId: 'synthetic-session',
  dados: { resultados_calculados: { tmbKcal: 9999, getKcal: 19999 } },
  resultados: { tmb_kcal: 9999, get_kcal: 19999 }
}];

const fromProfile = calculateGetEvaluation(profile);
const withSiblingHistory = calculateGetEvaluation({
  ...profile,
  allHistory: siblingHistory,
  currentSessionId: 'synthetic-session'
});

assert.deepEqual(withSiblingHistory, fromProfile,
  'Sibling assessment history must not change GET calculations.');
assert.equal(fromProfile.base.integratedRecordId, null);
assert.equal(fromProfile.base.tmbFromIntegratedKcal, null);
assert.ok(Number.isFinite(fromProfile.base.tmbEstimatedKcal));
assert.ok(fromProfile.base.tmbEstimatedKcal > 0);
assert.equal(fromProfile.base.tmbUsedKcal, fromProfile.base.tmbEstimatedKcal);
assert.ok(Number.isFinite(fromProfile.results.getKcal));
assert.equal(fromProfile.results.getKcal,
  Math.round(fromProfile.base.tmbUsedKcal * fromProfile.activity.factorApplied));

const changedProfile = calculateGetEvaluation({ ...profile, weightKg: 80 });
assert.notEqual(changedProfile.base.tmbEstimatedKcal, fromProfile.base.tmbEstimatedKcal,
  'The estimate must respond to this assessment’s profile measurements.');

const ownManualTmb = calculateGetEvaluation({
  ...profile,
  manualTmbKcal: 1600,
  allHistory: siblingHistory
});
assert.equal(ownManualTmb.base.tmbEstimatedKcal, fromProfile.base.tmbEstimatedKcal);
assert.equal(ownManualTmb.base.tmbUsedKcal, 1600);
assert.equal(ownManualTmb.base.formulaId, 'manual_override');
assert.equal(ownManualTmb.results.getKcal,
  Math.round(1600 * ownManualTmb.activity.factorApplied));

const incompleteProfile = calculateGetEvaluation({ activityLevel: 'sedentario', allHistory: siblingHistory });
assert.equal(incompleteProfile.base.tmbUsedKcal, null);
assert.equal(incompleteProfile.results.getKcal, null);

const manualWithoutProfile = calculateGetEvaluation({
  activityLevel: 'sedentario',
  manualTmbKcal: 1500,
  allHistory: siblingHistory
});
assert.equal(manualWithoutProfile.base.tmbEstimatedKcal, null);
assert.equal(manualWithoutProfile.base.tmbUsedKcal, 1500);
assert.equal(manualWithoutProfile.results.getKcal, 1800);

const zeroManual = calculateGetEvaluation({ ...profile, manualTmbKcal: 0 });
assert.equal(zeroManual.base.tmbUsedKcal, fromProfile.base.tmbUsedKcal,
  'A zero manual TMB must not replace the own profile estimate.');

const savedGet = restoreSavedGetForDisplay({
  id: 'synthetic-finished-get',
  dados: {
    resultados_calculados: {
      tmbBaseKcal: 1520,
      fatorAtividade: 1.4,
      getEstimadoKcal: 2128,
      manutencaoKcal: 2128,
      emagrecimentoLeveKcal: 1828,
      emagrecimentoModeradoKcal: 1628,
      emagrecimentoIntensoKcal: 1378,
      hipertrofiaMinKcal: 2428,
      hipertrofiaMaxKcal: 2628
    },
    classificacoes: { alertaIngestaoIntensa: true, referenciaSeguranca: 'Limite minimo 1500 kcal/dia' },
    metadados_formula: { formulaId: 'saved-method', formulaLabel: 'Método registrado' }
  }
}, changedProfile);
assert.equal(savedGet.base.tmbUsedKcal, 1520);
assert.equal(savedGet.results.getKcal, 2128);
assert.equal(savedGet.results.weightLossIntenseKcal, 1378);
assert.equal(savedGet.activity.factorApplied, 1.4);
assert.equal(savedGet.base.formulaId, 'saved-method');
assert.equal(savedGet.safety.hasIntenseLowIntakeRisk, true);
assert.equal(savedGet.safety.intenseMinThreshold, 1500);
assert.notEqual(savedGet.results.getKcal, changedProfile.results.getKcal,
  'A read-only historical record must not display a fresh calculation.');

assert.equal(restoreSavedGetForDisplay({ dados: {} }, fromProfile), fromProfile,
  'Records without saved results retain the calculation fallback.');

console.log('GET autonomy: synthetic profile, manual input and sibling-history checks passed.');
