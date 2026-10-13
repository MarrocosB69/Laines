const asRecord = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};

const numberOrNull = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(String(value).replace(',', '.').trim());
  return Number.isFinite(parsed) ? parsed : null;
};

const firstValue = (...values) => values.find((value) => value !== null && value !== undefined && value !== '');

// A leitura de um registro antigo usa os resultados que foram salvos na avaliação.
export const restoreSavedGetForDisplay = (snapshot, fallback) => {
  const dados = asRecord(snapshot?.dados);
  const saved = asRecord(dados.resultados_calculados);
  const resultados = asRecord(snapshot?.resultados);
  const calculated = asRecord(resultados.calculated);
  const formula = asRecord(dados.metadados_formula);
  const classifications = asRecord(dados.classificacoes);
  const output = asRecord(resultados.output);
  const tmb = numberOrNull(firstValue(saved.tmbBaseKcal, resultados.tmb_kcal, calculated.tmbKcal));
  const get = numberOrNull(firstValue(saved.getEstimadoKcal, resultados.get_kcal, calculated.getKcal));
  if (!Number.isFinite(tmb) && !Number.isFinite(get)) return fallback;

  const savedResult = (key, offset) => {
    const explicit = numberOrNull(saved[key]);
    return Number.isFinite(explicit) ? explicit : Number.isFinite(get) ? get + offset : null;
  };
  const threshold = numberOrNull(String(classifications.referenciaSeguranca || '').match(/\d+/)?.[0]);
  const savedRisk = firstValue(classifications.alertaIngestaoIntensa, output.alertaIngestaoIntensa);
  const hasSavedRisk = typeof savedRisk === 'boolean';

  return {
    ...fallback,
    base: {
      ...fallback?.base,
      tmbUsedKcal: Number.isFinite(tmb) ? tmb : null,
      tmbEstimatedKcal: null,
      formulaId: formula.formulaId || snapshot?.formulaId || null,
      formulaVersion: formula.formulaVersion || snapshot?.formulaVersion || null,
      formulaLabel: formula.formulaLabel || formula.label || 'Resultado registrado',
      sourceLabel: 'Valores salvos nesta avaliação'
    },
    activity: {
      ...fallback?.activity,
      factorApplied: numberOrNull(firstValue(saved.fatorAtividade, resultados.fator_atividade, calculated.fatorAtividade))
    },
    results: {
      getKcal: Number.isFinite(get) ? get : null,
      maintenanceKcal: savedResult('manutencaoKcal', 0),
      weightLossLightKcal: savedResult('emagrecimentoLeveKcal', -300),
      weightLossModerateKcal: savedResult('emagrecimentoModeradoKcal', -500),
      weightLossIntenseKcal: savedResult('emagrecimentoIntensoKcal', -750),
      hypertrophyMinKcal: savedResult('hipertrofiaMinKcal', 300),
      hypertrophyMaxKcal: savedResult('hipertrofiaMaxKcal', 500)
    },
    safety: {
      intenseMinThreshold: threshold,
      hasIntenseLowIntakeRisk: hasSavedRisk ? savedRisk : false
    },
    warnings: []
  };
};
