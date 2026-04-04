import { getEvaluationTypeLabel } from './evaluationSummaryUtils';
import {
  buildBioimpVariation,
  evaluateBioimpedanceSnapshot,
  extractBioimpedanceSnapshot,
  formatBioimpMetric
} from '../../utils/bioimpedance';
import {
  buildComparativeDeltas,
  classifyHydrationByLossPercent
} from '../../services/calculationEngine';

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
  'composicao_corporal_integrada',
  'alimentar',
  'anamnese_inicial',
  'avaliacao_clinica',
  'hidratacao',
  'avaliacao_socioeconomica',
  'fisioterapia',
  'psicologia',
  'exames_laboratoriais'
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

const toBooleanChoice = (value) => {
  if (value === true || value === 1) return true;
  if (value === false || value === 0) return false;
  const token = normalizeToken(value);
  if (!token) return null;
  if (token === 'sim' || token === 'yes' || token === 'true' || token === '1') return true;
  if (token === 'nao' || token === 'não' || token === 'no' || token === 'false' || token === '0') return false;
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
      'resultados.calculated.percentualGordura',
      'resultados.percentualGordura',
      'resultados.percentual_gordura',
      'dados.resultados.calculated.percentualGordura',
      'dados.resultados.percentualGordura',
      'dados.percentualGordura'
    ])
  );
  const classificacaoGordura = pickFirst(evaluation, [
    'resultados.output.classificacaoGordura',
    'resultados.classificacaoGordura',
    'dados.resultados.output.classificacaoGordura',
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
    const tmb = toNumber(pickFirst(evaluation, [
      'resultados.calculated.tmbCunningham',
      'resultados.tmbCunningham',
      'resultados.tmb_cunningham',
      'dados.tmbCunningham'
    ]));
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

  if (type === 'composicao_corporal_integrada') {
    const percentFat = toNumber(pickFirst(evaluation, [
      'dados.resultados_calculados.percentualGorduraOficial',
      'dados.percentual_gordura_oficial',
      'resultados.calculated.percentualGordura',
      'resultados.percentual_gordura'
    ]));
    const leanMass = toNumber(pickFirst(evaluation, [
      'dados.resultados_calculados.massaMagraOficialKg',
      'dados.massa_magra_kg',
      'resultados.calculated.massaMagraKg',
      'resultados.massa_magra_kg'
    ]));
    const sourceLabel = pickFirst(evaluation, [
      'dados.classificacoes.fonte_oficial',
      'dados.fonte_oficial',
      'resultados.output.fonteOficial'
    ]) || 'Fonte oficial';
    const classification = pickFirst(evaluation, [
      'dados.classificacoes.percentual_gordura',
      'resultados.output.classificacao'
    ]) || 'Sem classificação';
    return {
      title: '% Gordura oficial',
      value: percentFat,
      unit: '%',
      classification,
      tone: classifyToneByText(classification, percentFat !== null ? 'info' : 'neutral'),
      interpretation: 'Resultado integrado por hierarquia de metodos na sessao.',
      supportLabel: 'Massa magra',
      supportValue: leanMass !== null ? `${leanMass.toFixed(1)} kg` : sourceLabel
    };
  }

  if (type === 'gasto_energetico_total') {
    const getKcal = toNumber(pickFirst(evaluation, [
      'dados.resultados_calculados.getEstimadoKcal',
      'dados.get_estimado_kcal',
      'resultados.get_kcal',
      'resultados.calculated.getKcal'
    ]));
    const tmbKcal = toNumber(pickFirst(evaluation, [
      'dados.resultados_calculados.tmbBaseKcal',
      'dados.tmb_base_kcal',
      'resultados.tmb_kcal',
      'resultados.calculated.tmbKcal'
    ]));
    const factor = toNumber(pickFirst(evaluation, [
      'dados.resultados_calculados.fatorAtividade',
      'dados.fator_atividade',
      'resultados.fator_atividade',
      'resultados.calculated.fatorAtividade'
    ]));
    const formulaLabel = pickFirst(evaluation, [
      'dados.metadados_formula.formulaLabel',
      'dados.metadados_formula.formulaId'
    ]) || 'TMB da sessao';
    const hasSafetyAlert = Boolean(pickFirst(evaluation, [
      'dados.classificacoes.alertaIngestaoIntensa',
      'resultados.output.alertaIngestaoIntensa'
    ]));

    return {
      title: 'GET estimado',
      value: getKcal,
      unit: 'kcal',
      classification: hasSafetyAlert ? 'Alerta de ingestao minima' : 'Estimativa energetica',
      tone: hasSafetyAlert ? 'warning' : (getKcal !== null ? 'info' : 'neutral'),
      interpretation: 'Planejamento energetico baseado em TMB e fator de atividade.',
      supportLabel: 'TMB / fator',
      supportValue: tmbKcal !== null
        ? `${Math.round(tmbKcal)} kcal | ${factor !== null ? factor.toFixed(3) : '--'}`
        : formulaLabel
    };
  }

  if (type === 'anamnese_inicial') {
    const priority = pickFirst(evaluation, [
      'dados.resultados_calculados.prioridade',
      'dados.classificacoes.prioridadeCuidado',
      'resultados.prioridade_cuidado',
      'resultados.output.prioridadeCuidado'
    ]);
    const score = toNumber(pickFirst(evaluation, [
      'dados.resultados_calculados.scoreRisco',
      'resultados.score_risco',
      'resultados.calculated.scoreRisco'
    ]));
    const flagsCount = Array.isArray(pickFirst(evaluation, [
      'dados.resultados_calculados.flags'
    ]))
      ? pickFirst(evaluation, ['dados.resultados_calculados.flags']).length
      : null;
    const recommendation = pickFirst(evaluation, [
      'dados.resultados_calculados.encaminhamentos.0',
      'resultados.encaminhamentos.0'
    ]);

    return {
      title: 'Prioridade de cuidado',
      value: score,
      unit: 'pts',
      classification: priority ? String(priority).toUpperCase() : 'Sem classificação',
      tone: classifyToneByText(priority, score !== null ? 'info' : 'neutral'),
      interpretation: 'Estratificacao inicial de risco baseada na anamnese.',
      supportLabel: 'Flags / Encaminhamento',
      supportValue: `${flagsCount !== null ? flagsCount : 0} flag(s)${recommendation ? ` | ${recommendation}` : ''}`
    };
  }

  if (type === 'avaliacao_clinica') {
    const systolic = toNumber(pickFirst(evaluation, [
      'dados.resultados_calculados.pressaoSistolica',
      'dados.pressaoSistolica',
      'dados.pressao_sistolica',
      'resultados.pressao_sistolica'
    ]));
    const diastolic = toNumber(pickFirst(evaluation, [
      'dados.resultados_calculados.pressaoDiastolica',
      'dados.pressaoDiastolica',
      'dados.pressao_diastolica',
      'resultados.pressao_diastolica'
    ]));
    const heartRate = toNumber(pickFirst(evaluation, [
      'dados.resultados_calculados.frequenciaCardiaca',
      'dados.frequenciaCardiaca',
      'dados.frequencia_cardiaca',
      'resultados.frequencia_cardiaca'
    ]));
    const paClassification = pickFirst(evaluation, [
      'dados.resultados_calculados.classificacaoPressaoArterial',
      'dados.classificacoes.pressao_arterial',
      'resultados.output.classificacaoPressaoArterial'
    ]) || 'Sem classificação';
    const priority = pickFirst(evaluation, [
      'dados.resultados_calculados.prioridadeCuidado',
      'dados.classificacoes.prioridade_cuidado',
      'resultados.prioridade_cuidado'
    ]);
    const redFlagsCount = toNumber(pickFirst(evaluation, [
      'dados.resultados_calculados.redFlagsCount',
      'resultados.red_flags_count'
    ]));

    const classification = priority
      ? `${paClassification} | Prioridade ${String(priority).toUpperCase()}`
      : paClassification;

    return {
      title: 'Pressao arterial sistolica',
      value: systolic,
      unit: 'mmHg',
      classification,
      tone: classifyToneByText(classification, systolic !== null ? 'info' : 'neutral'),
      interpretation: 'Triagem clinica de sinais vitais e risco cardiometabolico imediato.',
      supportLabel: 'PAD / FC / Alertas',
      supportValue: `${diastolic !== null ? `${diastolic.toFixed(0)} mmHg` : '--'} | ${heartRate !== null ? `${heartRate.toFixed(0)} bpm` : '--'} | ${redFlagsCount !== null ? `${redFlagsCount} flag(s)` : '0 flag(s)'}`
    };
  }

  if (type === 'alimentar') {
    const ultra = toNumber(pickFirst(evaluation, [
      'resultados.calculated.percentuais.ultraprocessados',
      'resultados.percentuais.ultraprocessados',
      'dados.percentuais.ultraprocessados',
      'percentuais.ultraprocessados'
    ]));
    const totalDiario = toNumber(pickFirst(evaluation, [
      'resultados.calculated.totalDiario',
      'resultados.totalDiario',
      'dados.totalDiario',
      'totalDiario'
    ]));
    const classification = pickFirst(evaluation, [
      'resultados.output.classificacao',
      'resultados.classificacao',
      'dados.classificacao',
      'classificacao'
    ]) || 'Sem classificação';
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
    const perdaPeso = toNumber(pickFirst(evaluation, [
      'resultados.calculated.perdaPesoPercentual',
      'resultados.perdaPesoPercentual',
      'dados.perdaPesoPercentual'
    ]));
    const taxaSudorese = toNumber(pickFirst(evaluation, [
      'resultados.calculated.taxaSudoreseLh',
      'resultados.taxaSudoreseLh',
      'dados.taxaSudoreseLh'
    ]));
    const classification = pickFirst(evaluation, [
      'resultados.output.classificacaoHidrica',
      'dados.classificacaoHidrica'
    ]) || classifyHydrationByLossPercent(perdaPeso)?.label || 'Sem classificação';
    return {
      title: 'Perda de peso',
      value: perdaPeso,
      unit: '%',
      classification,
      tone: classifyToneByText(classification, perdaPeso !== null ? 'info' : 'neutral'),
      interpretation: 'Resumo de risco hidrico durante atividade/treino.',
      supportLabel: 'Taxa de sudorese',
      supportValue: taxaSudorese !== null ? `${taxaSudorese.toFixed(2)} L/h` : 'Nao informada'
    };
  }

  if (type === 'avaliacao_socioeconomica') {
    const score = toNumber(pickFirst(evaluation, [
      'resultados.calculated.pontuacaoEBIA',
      'resultados.pontuacaoEBIA',
      'pontuacaoEBIA'
    ]));
    const classification = pickFirst(evaluation, [
      'resultados.output.classificacaoLabel',
      'resultados.classificacaoLabel',
      'classificacaoLabel',
      'classificacao'
    ]) || 'Sem classificação';
    return {
      title: 'Pontuação EBIA',
      value: score,
      unit: 'pts',
      classification,
      tone: classifyToneByText(classification, score !== null ? 'info' : 'neutral'),
      interpretation: 'Classificacao de seguranca/inseguranca alimentar do domicilio.',
      supportLabel: 'Menores no domicilio',
      supportValue: (() => {
        const hasMinors = toBooleanChoice(
          pickFirst(evaluation, ['dados.input.temMenores', 'dados.temMenores', 'temMenores'])
        );
        if (hasMinors === null) return 'Nao informado';
        return hasMinors ? 'Sim' : 'Nao';
      })()
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

  if (type === 'exames_laboratoriais') {
    const alteracoesCount = toNumber(pickFirst(evaluation, [
      'dados.resultados_calculados.alteracoesCount',
      'resultados.calculated.alteracoesCount'
    ]));
    const limitesCount = toNumber(pickFirst(evaluation, [
      'dados.resultados_calculados.limitesCount',
      'resultados.calculated.limitesCount'
    ]));
    const normaisCount = toNumber(pickFirst(evaluation, [
      'dados.resultados_calculados.normaisCount',
      'resultados.calculated.normaisCount'
    ]));
    const statusPainel = pickFirst(evaluation, [
      'dados.classificacoes.statusPainel',
      'resultados.output.statusPainel',
      'classificacaoLabel',
      'classificacao'
    ]) || 'Sem classificação';
    const painel = pickFirst(evaluation, [
      'dados.dados_brutos.painel',
      'dados.painel'
    ]) || 'Painel geral';

    return {
      title: 'Analitos alterados',
      value: alteracoesCount,
      unit: '',
      classification: String(statusPainel).replace(/_/g, ' '),
      tone: classifyToneByText(statusPainel, alteracoesCount !== null ? 'info' : 'neutral'),
      interpretation: 'Classificacao automatica por faixa de referencia laboratorial.',
      supportLabel: 'Limites / Normais',
      supportValue: `${limitesCount !== null ? limitesCount : 0} / ${normaisCount !== null ? normaisCount : 0} | ${painel}`
    };
  }

  if (type === 'evolucao_retorno') {
    const score = toNumber(pickFirst(evaluation, [
      'dados.resultados_calculados.scoreAdesaoGeral',
      'resultados.calculated.scoreAdesaoGeral',
      'resultados.score_adesao_geral'
    ]));
    const prioridade = pickFirst(evaluation, [
      'dados.classificacoes.prioridadeRetorno',
      'resultados.output.prioridadeRetorno',
      'resultados.prioridade_cuidado',
      'classificacao'
    ]) || 'Sem classificação';
    const proximaAvaliacao = pickFirst(evaluation, [
      'dados.dados_brutos.proximaAvaliacao',
      'dados.proximaAvaliacao'
    ]) || 'Nao informada';

    return {
      title: 'Score de adesao',
      value: score,
      unit: '%',
      classification: String(prioridade).replace(/_/g, ' '),
      tone: classifyToneByText(prioridade, score !== null ? 'info' : 'neutral'),
      interpretation: 'Resumo longitudinal da adesao e necessidade de retorno.',
      supportLabel: 'Proxima avaliacao',
      supportValue: String(proximaAvaliacao)
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
  const deltas = buildComparativeDeltas({
    current: currentValue,
    reference: previousValue
  });
  if (!Number.isFinite(deltas?.deltaAbs)) {
    return {
      available: false,
      label: 'Sem comparativo anterior',
      direction: 'flat',
      delta: null
    };
  }

  const absDelta = Math.abs(deltas.deltaAbs);
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

  const improved = lowerIsBetter ? deltas.deltaAbs < 0 : deltas.deltaAbs > 0;
  return {
    available: true,
    label: `${improved ? 'Melhorou' : 'Piorou'} ${absDelta.toFixed(1)}${unit} vs anterior`,
    direction: improved ? 'up' : 'down',
    delta: deltas.deltaAbs
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

const resolveEvaluationField = (evaluation, keys = []) => {
  if (!evaluation || !Array.isArray(keys)) return null;
  const sources = [
    evaluation?.resultados_calculados || {},
    evaluation?.resultados?.calculated || {},
    evaluation?.resultados || {},
    evaluation?.dados?.resultados_calculados || {},
    evaluation?.dados?.resultados?.calculated || {},
    evaluation?.dados?.resultados || {},
    evaluation?.dados || {},
    evaluation
  ];
  for (const key of keys) {
    for (const source of sources) {
      if (source && Object.prototype.hasOwnProperty.call(source, key)) {
        const value = source[key];
        if (value !== null && value !== undefined && String(value).trim() !== '') {
          return value;
        }
      }
    }
  }
  return null;
};

const resolveSumSevenFolds = (evaluation) => {
  const explicitSum = toNumber(resolveEvaluationField(evaluation, [
    'somaSeteDobras',
    'soma_dobras_7',
    'soma_dobras',
    'somaDobras'
  ]));
  return Number.isFinite(explicitSum) ? explicitSum : null;
};

export const buildEvaluationTimelineSummary = (evaluation) => {
  const type = normalizeToken(evaluation?.tipo);
  if (type === 'bioimpedancia') {
    const percentualGordura = toNumber(resolveEvaluationField(evaluation, ['percentual_gordura', 'percentualGordura']));
    const massaMagra = toNumber(resolveEvaluationField(evaluation, ['massa_magra', 'massaMagra']));
    const aguaTotal = toNumber(resolveEvaluationField(evaluation, ['agua_total', 'aguaTotal', 'aguaCorporal']));
    const blocks = [];
    if (Number.isFinite(percentualGordura)) blocks.push(`%G ${percentualGordura.toFixed(1)}%`);
    if (Number.isFinite(massaMagra)) blocks.push(`MM ${massaMagra.toFixed(1)}kg`);
    if (Number.isFinite(aguaTotal)) blocks.push(`Agua ${aguaTotal.toFixed(1)}L`);
    return blocks.join(' | ');
  }

  if (type === 'dobras_cutaneas') {
    const somaSeteDobras = resolveSumSevenFolds(evaluation);
    const percentualGordura = toNumber(resolveEvaluationField(evaluation, ['percentual_gordura', 'percentualGordura']));
    const massaMagra = toNumber(resolveEvaluationField(evaluation, ['massa_magra', 'massaMagra']));
    const blocks = [];
    if (Number.isFinite(percentualGordura)) blocks.push(`%G ${percentualGordura.toFixed(1)}%`);
    if (Number.isFinite(massaMagra)) blocks.push(`MM ${massaMagra.toFixed(1)}kg`);
    if (Number.isFinite(somaSeteDobras)) blocks.push(`Σ7 ${somaSeteDobras.toFixed(1)}mm`);
    return blocks.length ? blocks.join(' | ') : 'Resultados calculados indisponiveis para esta avaliacao.';
  }

  if (type === 'perimetros') {
    const cintura = toNumber(resolveEvaluationField(evaluation, ['cintura', 'cintura_cm']));
    const quadril = toNumber(resolveEvaluationField(evaluation, ['quadril', 'quadril_cm']));
    const blocks = [];
    if (Number.isFinite(cintura)) blocks.push(`Cintura ${cintura.toFixed(1)}cm`);
    if (Number.isFinite(quadril)) blocks.push(`Quadril ${quadril.toFixed(1)}cm`);
    return blocks.join(' | ');
  }

  if (type === 'composicao_corporal_integrada') {
    const percentFat = toNumber(pickFirst(evaluation, [
      'dados.resultados_calculados.percentualGorduraOficial',
      'dados.percentual_gordura_oficial',
      'resultados.calculated.percentualGordura',
      'resultados.percentual_gordura'
    ]));
    const leanMass = toNumber(pickFirst(evaluation, [
      'dados.resultados_calculados.massaMagraOficialKg',
      'dados.massa_magra_kg',
      'resultados.calculated.massaMagraKg',
      'resultados.massa_magra_kg'
    ]));
    const blocks = [];
    if (Number.isFinite(percentFat)) blocks.push(`%G ${percentFat.toFixed(1)}%`);
    if (Number.isFinite(leanMass)) blocks.push(`MM ${leanMass.toFixed(1)}kg`);
    return blocks.join(' | ');
  }

  if (type === 'gasto_energetico_total') {
    const getKcal = toNumber(pickFirst(evaluation, [
      'dados.resultados_calculados.getEstimadoKcal',
      'dados.get_estimado_kcal',
      'resultados.get_kcal',
      'resultados.calculated.getKcal'
    ]));
    const tmbKcal = toNumber(pickFirst(evaluation, [
      'dados.resultados_calculados.tmbBaseKcal',
      'dados.tmb_base_kcal',
      'resultados.tmb_kcal',
      'resultados.calculated.tmbKcal'
    ]));
    const blocks = [];
    if (Number.isFinite(getKcal)) blocks.push(`GET ${Math.round(getKcal)}kcal`);
    if (Number.isFinite(tmbKcal)) blocks.push(`TMB ${Math.round(tmbKcal)}kcal`);
    return blocks.join(' | ');
  }

  if (type === 'anamnese_inicial') {
    const score = toNumber(pickFirst(evaluation, [
      'dados.resultados_calculados.scoreRisco',
      'resultados.score_risco',
      'resultados.calculated.scoreRisco'
    ]));
    const prioridade = pickFirst(evaluation, [
      'dados.resultados_calculados.prioridade',
      'dados.classificacoes.prioridadeCuidado',
      'resultados.prioridade_cuidado',
      'resultados.output.prioridadeCuidado'
    ]);
    const blocks = [];
    if (Number.isFinite(score)) blocks.push(`Score ${score.toFixed(0)}pts`);
    if (prioridade) blocks.push(`Prior. ${String(prioridade).toUpperCase()}`);
    return blocks.join(' | ');
  }

  if (type === 'avaliacao_clinica') {
    const systolic = toNumber(pickFirst(evaluation, [
      'dados.resultados_calculados.pressaoSistolica',
      'dados.pressaoSistolica',
      'dados.pressao_sistolica',
      'resultados.pressao_sistolica'
    ]));
    const diastolic = toNumber(pickFirst(evaluation, [
      'dados.resultados_calculados.pressaoDiastolica',
      'dados.pressaoDiastolica',
      'dados.pressao_diastolica',
      'resultados.pressao_diastolica'
    ]));
    const heartRate = toNumber(pickFirst(evaluation, [
      'dados.resultados_calculados.frequenciaCardiaca',
      'dados.frequenciaCardiaca',
      'dados.frequencia_cardiaca',
      'resultados.frequencia_cardiaca'
    ]));
    const blocks = [];
    if (Number.isFinite(systolic) && Number.isFinite(diastolic)) {
      blocks.push(`PA ${systolic.toFixed(0)}/${diastolic.toFixed(0)}mmHg`);
    } else if (Number.isFinite(systolic)) {
      blocks.push(`PAS ${systolic.toFixed(0)}mmHg`);
    }
    if (Number.isFinite(heartRate)) blocks.push(`FC ${heartRate.toFixed(0)}bpm`);
    return blocks.join(' | ');
  }

  if (type === 'alimentar') {
    const ultra = toNumber(pickFirst(evaluation, [
      'resultados.calculated.percentuais.ultraprocessados',
      'resultados.percentuais.ultraprocessados',
      'dados.percentuais.ultraprocessados',
      'percentuais.ultraprocessados'
    ]));
    const totalDiario = toNumber(pickFirst(evaluation, [
      'resultados.calculated.totalDiario',
      'resultados.totalDiario',
      'dados.totalDiario',
      'totalDiario'
    ]));
    const blocks = [];
    if (Number.isFinite(ultra)) blocks.push(`Ultra ${ultra.toFixed(0)}%`);
    if (Number.isFinite(totalDiario)) blocks.push(`${Math.round(totalDiario)}kcal`);
    return blocks.join(' | ');
  }

  if (type === 'hidratacao') {
    const perdaPeso = toNumber(pickFirst(evaluation, [
      'resultados.calculated.perdaPesoPercentual',
      'resultados.perdaPesoPercentual',
      'dados.perdaPesoPercentual'
    ]));
    const taxaSudorese = toNumber(pickFirst(evaluation, [
      'resultados.calculated.taxaSudoreseLh',
      'resultados.taxaSudoreseLh',
      'dados.taxaSudoreseLh'
    ]));
    const blocks = [];
    if (Number.isFinite(perdaPeso)) blocks.push(`Perda ${perdaPeso.toFixed(1)}%`);
    if (Number.isFinite(taxaSudorese)) blocks.push(`Sudorese ${taxaSudorese.toFixed(2)}L/h`);
    return blocks.join(' | ');
  }

  if (type === 'avaliacao_socioeconomica') {
    const score = toNumber(pickFirst(evaluation, [
      'resultados.calculated.pontuacaoEBIA',
      'resultados.pontuacaoEBIA',
      'pontuacaoEBIA'
    ]));
    const classificacao = pickFirst(evaluation, [
      'resultados.output.classificacaoLabel',
      'resultados.classificacaoLabel',
      'classificacaoLabel',
      'classificacao'
    ]);
    const blocks = [];
    if (Number.isFinite(score)) blocks.push(`EBIA ${score.toFixed(0)}pts`);
    if (classificacao) blocks.push(String(classificacao));
    return blocks.join(' | ');
  }

  if (type === 'fisioterapia') {
    const pain = toNumber(pickFirst(evaluation, ['dados.intensidadeDor']));
    const mobilidade = pickFirst(evaluation, ['dados.mobilidade']);
    const blocks = [];
    if (Number.isFinite(pain)) blocks.push(`Dor ${pain.toFixed(0)}/10`);
    if (mobilidade) blocks.push(`Mob. ${String(mobilidade)}`);
    return blocks.join(' | ');
  }

  if (type === 'psicologia') {
    const stress = toNumber(pickFirst(evaluation, ['dados.estresse']));
    const humor = pickFirst(evaluation, ['dados.humorAtual']);
    const blocks = [];
    if (Number.isFinite(stress)) blocks.push(`Estresse ${stress.toFixed(0)}/10`);
    if (humor) blocks.push(String(humor));
    return blocks.join(' | ');
  }

  if (type === 'exames_laboratoriais') {
    const alteracoes = toNumber(pickFirst(evaluation, [
      'dados.resultados_calculados.alteracoesCount',
      'resultados.calculated.alteracoesCount'
    ]));
    const limites = toNumber(pickFirst(evaluation, [
      'dados.resultados_calculados.limitesCount',
      'resultados.calculated.limitesCount'
    ]));
    const blocks = [];
    if (Number.isFinite(alteracoes)) blocks.push(`${alteracoes.toFixed(0)} alterado(s)`);
    if (Number.isFinite(limites)) blocks.push(`${limites.toFixed(0)} no limite`);
    return blocks.join(' | ');
  }

  if (type === 'evolucao_retorno') {
    const score = toNumber(pickFirst(evaluation, [
      'dados.resultados_calculados.scoreAdesaoGeral',
      'resultados.calculated.scoreAdesaoGeral',
      'resultados.score_adesao_geral'
    ]));
    const prioridade = pickFirst(evaluation, [
      'dados.classificacoes.prioridadeRetorno',
      'resultados.output.prioridadeRetorno',
      'resultados.prioridade_cuidado',
      'classificacao'
    ]);
    const blocks = [];
    if (Number.isFinite(score)) blocks.push(`Adesao ${score.toFixed(0)}%`);
    if (prioridade) blocks.push(String(prioridade).replace(/_/g, ' '));
    return blocks.join(' | ');
  }

  return '';
};





