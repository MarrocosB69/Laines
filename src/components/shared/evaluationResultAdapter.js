import { getEvaluationTypeLabel } from './evaluationSummaryUtils';
import {
  buildBioimpVariation,
  evaluateBioimpedanceSnapshot,
  extractBioimpedanceSnapshot,
  formatBioimpMetric
} from '../../utils/bioimpedance';

const TONALITY_LABELS = {
  success: 'Estavel',
  info: 'Observacao',
  warning: 'Atencao',
  danger: 'Critico',
  neutral: 'Indefinido'
};

const LOWER_IS_BETTER_TYPES = new Set([
  'bioimpedancia',
  'dobras_cutaneas',
  'perimetros',
  'alimentar',
  'hidratacao',
  'avaliacao_socioeconomica',
  'fisioterapia',
  'psicologia'
]);

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
  const normalized = String(value).replace(',', '.').trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const toDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value?.toDate === 'function') {
    const date = value.toDate();
    return Number.isNaN(date?.getTime?.()) ? null : date;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const readPath = (source, path) => {
  if (!source || !path) return undefined;
  return path.split('.').reduce((acc, key) => (acc === null || acc === undefined ? undefined : acc[key]), source);
};

const pickFirst = (source, paths = []) => {
  for (const path of paths) {
    const value = readPath(source, path);
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return value;
    }
  }
  return null;
};

const formatMainValue = (value, unit) => {
  if (value === null || value === undefined || value === '') return 'Sem dado principal';
  if (typeof value === 'number' && Number.isFinite(value)) {
    return `${Number(value).toFixed(1)}${unit ? ` ${unit}` : ''}`;
  }
  return unit ? `${value} ${unit}` : String(value);
};

const classifyToneByText = (rawValue, fallback = 'neutral') => {
  const token = normalizeToken(rawValue);
  if (!token) return fallback;
  if (token.includes('obes') || token.includes('grave') || token.includes('critic') || token.includes('alto_risco')) {
    return 'danger';
  }
  if (
    token.includes('moderad')
    || token.includes('risco')
    || token.includes('medio')
    || token.includes('atencao')
    || token.includes('elevad')
  ) {
    return 'warning';
  }
  if (token.includes('leve') || token.includes('observacao') || token.includes('monitorar')) {
    return 'info';
  }
  if (
    token.includes('normal')
    || token.includes('adequad')
    || token.includes('seguranca')
    || token.includes('saudavel')
    || token.includes('fitness')
    || token.includes('atleta')
    || token.includes('essencial')
    || token.includes('sem_perda')
  ) {
    return 'success';
  }
  return fallback;
};

const mapHydrationClassification = (lossPercent) => {
  if (!Number.isFinite(lossPercent)) return 'Sem classificação';
  if (lossPercent >= 3) return 'Desidratacao importante';
  if (lossPercent >= 2) return 'Desidratacao moderada';
  if (lossPercent > 0) return 'Leve desidratacao';
  return 'Sem perda relevante';
};

const mapPainClassification = (painLevel) => {
  if (!Number.isFinite(painLevel)) return 'Sem classificação';
  if (painLevel >= 7) return 'Dor elevada';
  if (painLevel >= 4) return 'Dor moderada';
  if (painLevel > 0) return 'Dor leve';
  return 'Sem dor relevante';
};

const mapStressClassification = (stressLevel) => {
  if (!Number.isFinite(stressLevel)) return 'Sem classificação';
  if (stressLevel >= 7) return 'Estresse elevado';
  if (stressLevel >= 4) return 'Estresse moderado';
  if (stressLevel > 0) return 'Estresse leve';
  return 'Estavel';
};

const mapWaistTone = (waist) => {
  if (!Number.isFinite(waist)) return 'neutral';
  if (waist <= 80) return 'success';
  if (waist <= 94) return 'info';
  if (waist <= 102) return 'warning';
  return 'danger';
};

const resolveByType = (evaluation) => {
  const type = normalizeToken(evaluation?.tipo);
  const typeLabel = getEvaluationTypeLabel(type);

  const percentualGordura = toNumber(
    pickFirst(evaluation, [
      'resultados.percentualGordura',
      'dados.percentualGordura'
    ])
  );
  const classificacaoGordura = pickFirst(evaluation, [
    'resultados.classificacaoGordura',
    'dados.classificacaoGordura'
  ]);

  if (type === 'bioimpedancia') {
    const bioSnapshot = extractBioimpedanceSnapshot(evaluation);
    const diagnostics = evaluateBioimpedanceSnapshot(bioSnapshot);
    const targetDiff = Number.isFinite(bioSnapshot.percentualGordura) && Number.isFinite(bioSnapshot.alvoPercentualGordura)
      ? bioSnapshot.percentualGordura - bioSnapshot.alvoPercentualGordura
      : null;
    const targetWeightDiff = Number.isFinite(bioSnapshot.pesoGordura) && Number.isFinite(bioSnapshot.alvoPesoGordura)
      ? bioSnapshot.pesoGordura - bioSnapshot.alvoPesoGordura
      : null;

    return {
      title: '% Gordura corporal',
      value: bioSnapshot.percentualGordura,
      unit: '%',
      classification: diagnostics.bodyFat.label || classificacaoGordura || 'Sem classificação',
      tone: diagnostics.overallTone || classifyToneByText(classificacaoGordura, percentualGordura !== null ? 'info' : 'neutral'),
      interpretation: diagnostics.interpretation || 'Leitura principal de composicao corporal por bioimpedancia.',
      supportLabel: 'IMC',
      supportValue: Number.isFinite(bioSnapshot.imc) ? `${bioSnapshot.imc.toFixed(1)}` : 'Nao informado',
      bioimp: {
        snapshot: bioSnapshot,
        diagnostics,
        targetDiff,
        targetWeightDiff,
        primaryMetrics: [
          {
            key: 'percentualGordura',
            label: '% Gordura',
            value: bioSnapshot.percentualGordura,
            unit: '%',
            displayValue: formatBioimpMetric(bioSnapshot.percentualGordura, '%', 1),
            tooltip: 'Percentual de gordura corporal medido por bioimpedancia.'
          },
          {
            key: 'massaMagra',
            label: 'Massa magra',
            value: bioSnapshot.massaMagra,
            unit: 'kg',
            displayValue: formatBioimpMetric(bioSnapshot.massaMagra, 'kg', 1),
            tooltip: 'Massa livre de gordura.'
          },
          {
            key: 'aguaTotal',
            label: 'Agua total',
            value: bioSnapshot.aguaTotal,
            unit: 'L',
            displayValue: formatBioimpMetric(bioSnapshot.aguaTotal, 'L', 1),
            tooltip: 'Agua corporal total estimada.'
          }
        ],
        secondaryMetrics: [
          {
            key: 'taxaMetabolicaBasal',
            label: 'TMB',
            displayValue: formatBioimpMetric(bioSnapshot.taxaMetabolicaBasal, 'cal/dia', 0),
            tooltip: 'Taxa metabolica basal estimada.'
          },
          {
            key: 'bioresistencia',
            label: 'Bio R',
            displayValue: formatBioimpMetric(bioSnapshot.bioresistencia, 'ohms', 0),
            tooltip: 'Resistencia eletrica dos tecidos.'
          },
          {
            key: 'reatancia',
            label: 'Reat',
            displayValue: formatBioimpMetric(bioSnapshot.reatancia, 'ohms', 0),
            tooltip: 'Reatancia (integridade de membrana celular).'
          }
        ]
      }
    };
  }

  if (type === 'dobras_cutaneas') {
    const tmb = toNumber(pickFirst(evaluation, ['resultados.tmb']));
    return {
      title: '% Gordura estimada',
      value: percentualGordura,
      unit: '%',
      classification: classificacaoGordura || 'Sem classificação',
      tone: classifyToneByText(classificacaoGordura, percentualGordura !== null ? 'info' : 'neutral'),
      interpretation: 'Estimativa por protocolo de dobras cutaneas.',
      supportLabel: 'TMB',
      supportValue: tmb !== null ? `${Math.round(tmb)} kcal` : 'Nao informada'
    };
  }

  if (type === 'perimetros') {
    const cintura = toNumber(
      pickFirst(evaluation, ['dados.cintura', 'dados.cintura_cm', 'dados.abdominal'])
    );
    const quadril = toNumber(pickFirst(evaluation, ['dados.quadril', 'dados.quadril_cm']));
    return {
      title: 'Perimetro de cintura',
      value: cintura,
      unit: 'cm',
      classification: cintura !== null ? 'Risco por cintura' : 'Sem classificação',
      tone: mapWaistTone(cintura),
      interpretation: 'Indicador antropometrico para risco cardiometabolico.',
      supportLabel: 'Quadril',
      supportValue: quadril !== null ? `${quadril.toFixed(1)} cm` : 'Nao informado'
    };
  }

  if (type === 'alimentar') {
    const ultra = toNumber(pickFirst(evaluation, ['percentuais.ultraprocessados']));
    const totalDiario = toNumber(pickFirst(evaluation, ['totalDiario']));
    const classification = pickFirst(evaluation, ['classificacao']) || 'Sem classificação';
    return {
      title: '% Ultraprocessados',
      value: ultra,
      unit: '%',
      classification,
      tone: classifyToneByText(classification, ultra !== null ? 'info' : 'neutral'),
      interpretation: 'Participacao de ultraprocessados no consumo diario.',
      supportLabel: 'Total diario',
      supportValue: totalDiario !== null ? `${Math.round(totalDiario)} kcal` : 'Nao informado'
    };
  }

  if (type === 'hidratacao') {
    const perdaPeso = toNumber(pickFirst(evaluation, ['dados.perdaPesoPercentual']));
    const taxaSudorese = toNumber(pickFirst(evaluation, ['dados.taxaSudorese']));
    const classification = mapHydrationClassification(perdaPeso);
    return {
      title: 'Perda de peso',
      value: perdaPeso,
      unit: '%',
      classification,
      tone: classifyToneByText(classification, perdaPeso !== null ? 'info' : 'neutral'),
      interpretation: 'Resumo de risco hidrico durante atividade/treino.',
      supportLabel: 'Taxa de sudorese',
      supportValue: taxaSudorese !== null ? `${taxaSudorese.toFixed(1)} ml/min` : 'Nao informada'
    };
  }

  if (type === 'avaliacao_socioeconomica') {
    const score = toNumber(pickFirst(evaluation, ['pontuacaoEBIA']));
    const classification = pickFirst(evaluation, ['classificacaoLabel', 'classificacao']) || 'Sem classificação';
    return {
      title: 'Pontuação EBIA',
      value: score,
      unit: 'pts',
      classification,
      tone: classifyToneByText(classification, score !== null ? 'info' : 'neutral'),
      interpretation: 'Classificacao de seguranca/inseguranca alimentar do domicilio.',
      supportLabel: 'Menores no domicilio',
      supportValue: readPath(evaluation, 'dados.temMenores') ? 'Sim' : 'Nao'
    };
  }

  if (type === 'fisioterapia') {
    const pain = toNumber(pickFirst(evaluation, ['dados.intensidadeDor']));
    const classification = mapPainClassification(pain);
    return {
      title: 'Intensidade de dor',
      value: pain,
      unit: '/10',
      classification,
      tone: classifyToneByText(classification, pain !== null ? 'info' : 'neutral'),
      interpretation: 'Indicador funcional para seguimento fisioterapeutico.',
      supportLabel: 'Mobilidade',
      supportValue: pickFirst(evaluation, ['dados.mobilidade']) || 'Nao informada'
    };
  }

  if (type === 'psicologia') {
    const stress = toNumber(pickFirst(evaluation, ['dados.estresse']));
    const classification = mapStressClassification(stress);
    return {
      title: 'Nivel de estresse',
      value: stress,
      unit: '/10',
      classification,
      tone: classifyToneByText(classification, stress !== null ? 'info' : 'neutral'),
      interpretation: 'Leitura sintetica do estado emocional atual.',
      supportLabel: 'Humor',
      supportValue: pickFirst(evaluation, ['dados.humorAtual']) || 'Nao informado'
    };
  }

  return {
    title: 'Resultado principal',
    value: null,
    unit: '',
    classification: 'Sem classificação',
    tone: 'neutral',
    interpretation: `Tipo ${typeLabel} sem resumo clinico padronizado.`,
    supportLabel: 'Detalhe',
    supportValue: 'Revisar preenchimento'
  };
};

const buildVariation = (currentMetric, previousMetric, type) => {
  const currentValue = toNumber(currentMetric?.value);
  const previousValue = toNumber(previousMetric?.value);
  if (!Number.isFinite(currentValue) || !Number.isFinite(previousValue)) {
    return {
      available: false,
      label: 'Sem comparativo anterior',
      direction: 'flat',
      delta: null
    };
  }

  const delta = currentValue - previousValue;
  const absDelta = Math.abs(delta);
  const unit = currentMetric?.unit ? ` ${currentMetric.unit}` : '';
  const lowerIsBetter = LOWER_IS_BETTER_TYPES.has(type);

  if (absDelta < 0.05) {
    return {
      available: true,
      label: `Estavel vs anterior (${absDelta.toFixed(1)}${unit})`,
      direction: 'flat',
      delta: 0
    };
  }

  const improved = lowerIsBetter ? delta < 0 : delta > 0;
  return {
    available: true,
    label: `${improved ? 'Melhorou' : 'Piorou'} ${absDelta.toFixed(1)}${unit} vs anterior`,
    direction: improved ? 'up' : 'down',
    delta
  };
};

export const normalizeEvaluationResult = (evaluation, previousEvaluation = null) => {
  const type = normalizeToken(evaluation?.tipo);
  const metric = resolveByType(evaluation || {});
  const previousMetric = previousEvaluation ? resolveByType(previousEvaluation) : null;
  const variation = buildVariation(metric, previousMetric, type);
  const bioimpMetrics = metric?.bioimp?.primaryMetrics || null;
  let enrichedBioimp = metric?.bioimp || null;

  if (type === 'bioimpedancia' && enrichedBioimp && Array.isArray(bioimpMetrics)) {
    const previousSnapshot = previousEvaluation ? extractBioimpedanceSnapshot(previousEvaluation) : null;
    const withVariation = bioimpMetrics.map((item) => {
      const previousValue = previousSnapshot && Number.isFinite(previousSnapshot[item.key])
        ? previousSnapshot[item.key]
        : null;
      const lowerIsBetter = item.key === 'percentualGordura';
      return {
        ...item,
        variation: buildBioimpVariation(item.value, previousValue, {
          unit: item.unit,
          lowerIsBetter,
          digits: item.key === 'percentualGordura' ? 1 : 1
        })
      };
    });
    enrichedBioimp = {
      ...enrichedBioimp,
      primaryMetrics: withVariation
    };
  }

  return {
    type,
    typeLabel: getEvaluationTypeLabel(type),
    title: metric.title,
    primaryValue: metric.value,
    primaryDisplay: formatMainValue(metric.value, metric.unit),
    classification: metric.classification || 'Sem classificação',
    tone: metric.tone || 'neutral',
    toneLabel: TONALITY_LABELS[metric.tone] || TONALITY_LABELS.neutral,
    interpretation: metric.interpretation || 'Sem interpretacao automatica.',
    supportLabel: metric.supportLabel || '',
    supportValue: metric.supportValue || '',
    variation,
    bioimp: enrichedBioimp
  };
};

export const buildEvaluationResultCollection = (
  evaluations = [],
  {
    groupBy = (item) => `${item?.alunoId || item?.createdById || item?.pacienteId || 'paciente'}::${normalizeToken(item?.tipo)}`,
    getDateValue = (item) => item?.updatedAt || item?.createdAt || item?.data
  } = {}
) => {
  const rows = Array.isArray(evaluations) ? evaluations : [];
  const grouped = new Map();

  rows.forEach((evaluation, index) => {
    const key = groupBy(evaluation, index) || `group-${index}`;
    const timestamp = toDate(getDateValue(evaluation, index))?.getTime() || 0;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push({ index, evaluation, timestamp });
  });

  const previousByIndex = new Map();
  grouped.forEach((items) => {
    items
      .slice()
      .sort((a, b) => b.timestamp - a.timestamp)
      .forEach((item, position, ordered) => {
        const previous = ordered[position + 1]?.evaluation || null;
        previousByIndex.set(item.index, previous);
      });
  });

  return rows.map((evaluation, index) => ({
    evaluation,
    result: normalizeEvaluationResult(evaluation, previousByIndex.get(index) || null)
  }));
};
