import assert from 'node:assert/strict';
import {
  calculateIntegratedBodyComposition,
  restoreIntegratedCompositionSnapshot
} from '../src/services/calculationEngine.js';

const profile = {
  sex: 'female',
  ageYears: 30,
  weightKg: 70,
  heightCm: 170,
  activityLevel: 'ativo',
  ownMeasurements: { percentFat: 22, bodyWaterL: 38 }
};
const siblingHistory = [{
  id: 'synthetic-bia',
  tipo: 'bioimpedancia',
  sessaoId: 'synthetic-session',
  dados: { percentual_gordura: 55, massa_magra: 12 }
}];

const own = calculateIntegratedBodyComposition(profile);
const withSibling = calculateIntegratedBodyComposition({
  ...profile,
  allHistory: siblingHistory,
  currentSessionId: 'synthetic-session'
});
assert.deepEqual(withSibling, own, 'Sibling assessment history cannot change this assessment.');
assert.equal(own.official.sourceId, 'medicao_propria');
assert.equal(own.official.percentFat, 22);
assert.ok(Math.abs(own.official.fatMassKg - 15.4) < 0.001);
assert.ok(Math.abs(own.official.leanMassKg - 54.6) < 0.001);
assert.equal(own.official.waterL, 38);
assert.ok(Number.isFinite(own.selectedTmb.tmbKcal));
assert.ok(Number.isFinite(own.getKcal));

const fromLeanMass = calculateIntegratedBodyComposition({
  ...profile,
  ownMeasurements: { leanMassKg: 56 }
});
assert.equal(fromLeanMass.official.sourceId, 'medicao_propria');
assert.equal(fromLeanMass.official.fatMassKg, 14);
assert.equal(fromLeanMass.official.percentFat, 20);
assert.equal(fromLeanMass.official.leanMassKg, 56);

const missingOwnData = calculateIntegratedBodyComposition({
  ...profile,
  ownMeasurements: {},
  allHistory: siblingHistory
});
assert.equal(missingOwnData.official.sourceId, null);
assert.equal(missingOwnData.official.percentFat, null);
assert.equal(missingOwnData.official.leanMassKg, null);
assert.deepEqual(missingOwnData.sources, []);

const invalidOwnPercent = calculateIntegratedBodyComposition({
  ...profile,
  ownMeasurements: { percentFat: 120 }
});
assert.equal(invalidOwnPercent.official.sourceId, null);

const conflictingOwnMeasurements = calculateIntegratedBodyComposition({
  ...profile,
  ownMeasurements: { percentFat: 22, fatMassKg: 30 }
});
assert.equal(conflictingOwnMeasurements.official.sourceId, null,
  'Conflicting own measurements cannot become an official source.');
assert.deepEqual(conflictingOwnMeasurements.sources, []);
const conflictingMassesWithoutSharedWeight = calculateIntegratedBodyComposition({
  ...profile,
  weightKg: null,
  ownMeasurements: { percentFat: 22, fatMassKg: 30, leanMassKg: 40 }
});
assert.equal(conflictingMassesWithoutSharedWeight.official.sourceId, null);

const historicalSnapshot = {
  id: 'synthetic-old-integrated',
  dados: {
    fonte_oficial: 'bia_tetrapolar_convencional',
    peso_kg: 68,
    estatura_cm: 168,
    dados_brutos: {
      fontes_disponiveis: [{
        sourceId: 'bia_tetrapolar_convencional',
        label: 'BIA tetrapolar convencional',
        percentFat: 18,
        leanMassKg: 55.76
      }]
    },
    resultados_calculados: {
      percentualGorduraOficial: 18,
      massaGordaOficialKg: 12.24,
      massaMagraOficialKg: 55.76,
      aguaCorporalOficialL: 39,
      tmbSelecionadaKcal: 1510,
      getEstimadoKcal: 2341
    },
    classificacoes: {
      percentual_gordura: 'Adequado',
      fonte_oficial: 'BIA tetrapolar convencional'
    },
    metadados_formula: {
      formulaId: 'henry_2005',
      formulaVersion: '1.0.0',
      formulaLabel: 'Henry (2005)'
    }
  }
};
const restored = restoreIntegratedCompositionSnapshot(historicalSnapshot);
assert.equal(restored.historicalIntegration, true);
assert.equal(restored.official.percentFat, 18);
assert.equal(restored.official.leanMassKg, 55.76);
assert.equal(restored.selectedTmb.tmbKcal, 1510);
assert.equal(restored.getKcal, 2341);
assert.equal(restored.sources[0].sourceId, 'bia_tetrapolar_convencional');

const newSnapshot = {
  ...historicalSnapshot,
  dados: {
    ...historicalSnapshot.dados,
    dados_brutos: {
      ownMeasurements: { percentFat: 18 },
      selectedSourceId: 'medicao_propria'
    },
    fonte_oficial: 'medicao_propria'
  }
};
assert.equal(restoreIntegratedCompositionSnapshot(newSnapshot).historicalIntegration, false);

console.log('Integrated composition autonomy: own measurements and legacy snapshot checks passed.');
