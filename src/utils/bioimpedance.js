const normalizeToken = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_');

const toNumber = (value) => {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = Number(String(value).replace(',', '.').trim());
  return Number.isFinite(parsed) ? parsed : null;
};

const toDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const pickValue = (source, aliases = []) => {
  if (!source || !aliases.length) return null;
  for (const alias of aliases) {
    if (Object.prototype.hasOwnProperty.call(source, alias)) {
      const value = source[alias];
      if (value !== null && value !== undefined && String(value).trim() !== '') {
        return value;
      }
    }
  }
  return null;
};

const pickNumber = (sources = [], aliases = []) => {
  for (const source of sources) {
    const value = pickValue(source, aliases);
    const numeric = toNumber(value);
    if (Number.isFinite(numeric)) return numeric;
  }
  return null;
};

const pickText = (sources = [], aliases = []) => {
  for (const source of sources) {
    const value = pickValue(source, aliases);
    if (value !== null && value !== undefined && String(value).trim() !== '') {
      return String(value).trim();
    }
  }
  return '';
};

const normalizeSex = (value) => {
  const token = normalizeToken(value);
  if (!token) return '';
  if (token.includes('femin') || token === 'f') return 'FEMININO';
  if (token.includes('mascul') || token === 'm') return 'MASCULINO';
  return String(value || '').toUpperCase();
};

const resolveBodyFatRange = (sexo, idade) => {
  const age = Number.isFinite(idade) ? idade : null;
  if (sexo === 'MASCULINO') {
    if (age !== null && age >= 60) return { low: 13, high: 25, warning: 29 };
    if (age !== null && age >= 40) return { low: 11, high: 22, warning: 27 };
    return { low: 8, high: 20, warning: 25 };
  }
  if (sexo === 'FEMININO') {
    if (age !== null && age >= 60) return { low: 24, high: 35, warning: 40 };
    if (age !== null && age >= 40) return { low: 23, high: 34, warning: 39 };
    return { low: 21, high: 33, warning: 38 };
  }
  return { low: 10, high: 30, warning: 35 };
};

const evaluateBodyFatStatus = ({ percentualGordura, sexo, idade, alvoPercentualGordura }) => {
  if (!Number.isFinite(percentualGordura)) {
    return { tone: 'neutral', label: 'Sem classificação de gordura' };
  }

  if (Number.isFinite(alvoPercentualGordura)) {
    const diff = percentualGordura - alvoPercentualGordura;
    if (Math.abs(diff) <= 0.5) return { tone: 'success', label: 'Percentual de gordura na meta' };
    if (diff > 0.5 && diff <= 3) return { tone: 'warning', label: 'Percentual de gordura acima da meta' };
    if (diff > 3) return { tone: 'danger', label: 'Percentual de gordura muito acima da meta' };
    return { tone: 'info', label: 'Percentual de gordura abaixo da meta definida' };
  }

  const range = resolveBodyFatRange(sexo, idade);
  if (percentualGordura < range.low) return { tone: 'info', label: 'Percentual de gordura abaixo da faixa de referência' };
  if (percentualGordura <= range.high) return { tone: 'success', label: 'Percentual de gordura em faixa adequada' };
  if (percentualGordura <= range.warning) return { tone: 'warning', label: 'Percentual de gordura em atenção' };
  return { tone: 'danger', label: 'Percentual de gordura em faixa crítica' };
};

const evaluateHydrationStatus = ({ percentualAguaMassaMagra, percentualAguaPesoCorporal }) => {
  const hydrationScore = Number.isFinite(percentualAguaMassaMagra)
    ? percentualAguaMassaMagra
    : percentualAguaPesoCorporal;

  if (!Number.isFinite(hydrationScore)) {
    return { tone: 'neutral', label: 'Hidratação não classificada' };
  }

  if (hydrationScore < 69) return { tone: 'danger', label: 'Hidratação celular baixa' };
  if (hydrationScore < 72) return { tone: 'warning', label: 'Hidratação em atenção' };
  if (hydrationScore <= 78) return { tone: 'success', label: 'Hidratação adequada' };
  if (hydrationScore <= 82) return { tone: 'info', label: 'Hidratação elevada, monitorar' };
  return { tone: 'warning', label: 'Hidratação muito elevada, revisar aferição' };
};

export const extractBioimpedanceSnapshot = (evaluation) => {
  const dados = evaluation?.dados || {};
  const resultados = evaluation?.resultados || {};
  const dadosBrutos = dados?.dados_brutos || dados?.input || {};
  const resultadosCalculados = dados?.resultados_calculados || resultados?.calculated || {};
  const classificacoes = dados?.classificacoes || resultados?.output || {};
  const sources = [resultadosCalculados, dadosBrutos, classificacoes, dados, resultados, evaluation || {}];

  const percentualGordura = pickNumber(sources, ['percentual_gordura', 'percentualGordura', 'percentFat']);
  const pesoGordura = pickNumber(sources, ['peso_gordura', 'pesoGordura', 'massaGorda', 'massa_gorda_kg', 'fatMassKg']);
  const massaMagra = pickNumber(sources, ['massa_magra', 'massaMagra', 'massa_magra_kg', 'leanMassKg']);
  const taxaMetabolicaBasal = pickNumber(sources, ['taxa_metabolica_basal', 'taxaMetabolicaBasal', 'tmb', 'tmb_kcal', 'deviceTmbKcal']);
  const aguaTotal = pickNumber(sources, ['agua_total', 'aguaTotal', 'aguaCorporal', 'agua_total_l', 'tbwL']);
  const pesoTotal = pickNumber(sources, ['peso', 'peso_total', 'pesoTotal', 'weight', 'weightKg']);
  const bioresistencia = pickNumber(sources, ['bioresistencia', 'bioresistencia_ohms', 'bioResistencia', 'resistanceOhm']);
  const reatancia = pickNumber(sources, ['reatancia', 'reatancia_ohms', 'reactancia', 'reactanceOhm']);
  const alvoPercentualGordura = pickNumber(sources, ['alvo_percentual_gordura', 'alvoPercentualGordura']);
  const alvoPesoGordura = pickNumber(sources, ['alvo_peso_gordura', 'alvoPesoGordura']);
  const alvoPesoTotal = pickNumber(sources, ['alvo_peso_total', 'alvoPesoTotal']);
  const idade = pickNumber(sources, ['idade', 'ageYears']);
  const sexo = normalizeSex(pickText(sources, ['sexo', 'genero', 'sex']));
  const imc = pickNumber(sources, ['imc', 'bmi']);

  let percentualAguaPesoCorporal = pickNumber(sources, [
    'percentual_agua_peso_corporal',
    'percentualAguaPesoCorporal'
  ]);
  if (!Number.isFinite(percentualAguaPesoCorporal) && Number.isFinite(aguaTotal) && Number.isFinite(pesoTotal) && pesoTotal > 0) {
    percentualAguaPesoCorporal = (aguaTotal / pesoTotal) * 100;
  }

  let percentualAguaMassaMagra = pickNumber(sources, [
    'percentual_agua_massa_magra',
    'percentualAguaMassaMagra'
  ]);
  if (!Number.isFinite(percentualAguaMassaMagra) && Number.isFinite(aguaTotal) && Number.isFinite(massaMagra) && massaMagra > 0) {
    percentualAguaMassaMagra = (aguaTotal / massaMagra) * 100;
  }

  const date = toDate(evaluation?.updatedAt || evaluation?.createdAt || evaluation?.data);

  return {
    percentualGordura,
    pesoGordura,
    massaMagra,
    taxaMetabolicaBasal,
    aguaTotal,
    percentualAguaPesoCorporal,
    percentualAguaMassaMagra,
    bioresistencia,
    reatancia,
    alvoPercentualGordura,
    alvoPesoGordura,
    alvoPesoTotal,
    pesoTotal,
    idade,
    sexo,
    imc,
    date
  };
};

export const evaluateBioimpedanceSnapshot = (snapshot) => {
  const bodyFat = evaluateBodyFatStatus(snapshot);
  const hydration = evaluateHydrationStatus(snapshot);
  const tonePriority = ['danger', 'warning', 'info', 'success', 'neutral'];
  const overallTone = [bodyFat.tone, hydration.tone].sort(
    (a, b) => tonePriority.indexOf(a) - tonePriority.indexOf(b)
  )[0] || 'neutral';
  const interpretation = `${bodyFat.label}. ${hydration.label}.`;

  return {
    bodyFat,
    hydration,
    overallTone,
    interpretation
  };
};

export const formatBioimpMetric = (value, unit, digits = 1) => {
  if (!Number.isFinite(value)) return 'Não informado';
  return `${Number(value).toFixed(digits)}${unit ? ` ${unit}` : ''}`;
};

export const buildBioimpVariation = (currentValue, previousValue, { unit = '', lowerIsBetter = false, digits = 1 } = {}) => {
  if (!Number.isFinite(currentValue) || !Number.isFinite(previousValue)) {
    return {
      available: false,
      direction: 'flat',
      label: 'Sem comparativo anterior',
      delta: null
    };
  }

  const delta = currentValue - previousValue;
  const absDelta = Math.abs(delta);
  if (absDelta < 0.05) {
    return {
      available: true,
      direction: 'flat',
      label: `Estável (${absDelta.toFixed(digits)} ${unit})`,
      delta: 0
    };
  }

  const improved = lowerIsBetter ? delta < 0 : delta > 0;
  const direction = improved ? 'up' : 'down';
  return {
    available: true,
    direction,
    label: `${improved ? 'Melhorou' : 'Piorou'} ${absDelta.toFixed(digits)} ${unit}`.trim(),
    delta
  };
};
