import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Activity, Save } from 'lucide-react';
import { Button } from '../../components/ui';
import EvaluationReadiness from '../../components/Avaliacoes/components/EvaluationReadiness';
import { toLocalDateInputValue } from '../../utils/dateUtils';
import '../../components/Avaliacoes/avaliacoes.css';
import './AvaliacaoTriagemREDS.css';

const LEAF_Q_QUESTIONS = [
  { key: 'leaf_q1', label: 'Ciclos menstruais irregulares nos últimos 12 meses?' },
  { key: 'leaf_q2', label: 'Ausência menstrual por 3 meses ou mais?' },
  { key: 'leaf_q3', label: 'Sangramento menstrual muito reduzido?' },
  { key: 'leaf_q4', label: 'Dor abdominal recorrente associada ao treino?' },
  { key: 'leaf_q5', label: 'Desconforto gastrointestinal em treinos intensos?' },
  { key: 'leaf_q6', label: 'Constipação frequente nas últimas semanas?' },
  { key: 'leaf_q7', label: 'Sensação de fadiga persistente no dia a dia?' },
  { key: 'leaf_q8', label: 'Queda de rendimento sem causa aparente?' },
  { key: 'leaf_q9', label: 'Histórico de fratura por estresse?' },
  { key: 'leaf_q10', label: 'Dor óssea recorrente durante o treino?' },
  { key: 'leaf_q11', label: 'Uso de restrição calórica frequente?' },
  { key: 'leaf_q12', label: 'Dificuldade para recuperar após sessões intensas?' }
];

const LEA_Q13_QUESTIONS = [
  { key: 'lea_q1', label: 'Fadiga persistente sem explicação clínica?' },
  { key: 'lea_q2', label: 'Queda de performance nas últimas 4 semanas?' },
  { key: 'lea_q3', label: 'Perda de massa corporal involuntária recente?' },
  { key: 'lea_q4', label: 'Perda de libido ou queda de interesse sexual?' },
  { key: 'lea_q5', label: 'Alterações de humor associadas ao treinamento?' },
  { key: 'lea_q6', label: 'Dificuldade de recuperação entre sessões?' },
  { key: 'lea_q7', label: 'Infecções recorrentes no último trimestre?' },
  { key: 'lea_q8', label: 'Dor óssea recorrente ao esforço?' },
  { key: 'lea_q9', label: 'Histórico de fratura por estresse?' },
  { key: 'lea_q10', label: 'Sinais de baixa disponibilidade energética?' },
  { key: 'lea_q11', label: 'Restrição alimentar para controle de peso?' },
  { key: 'lea_q12', label: 'Sono não reparador na maior parte da semana?' },
  { key: 'lea_q13', label: 'Dificuldade para manter carga de treino planejada?' }
];

const SINTOMAS_OPTIONS = [
  { value: 'fadiga', label: 'Fadiga' },
  { value: 'queda_performance', label: 'Queda de performance' },
  { value: 'libido_baixa', label: 'Libido baixa' },
  { value: 'irritabilidade', label: 'Irritabilidade' }
];

const createQuestionnaireState = (questions) => (
  questions.reduce((acc, item) => {
    acc[item.key] = null;
    return acc;
  }, {})
);

const normalizeType = (value) => String(value || '').trim().toLowerCase().replace(/-/g, '_');

const toNumber = (value) => {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = Number(String(value).replace(',', '.').trim());
  return Number.isFinite(parsed) ? parsed : null;
};

const toInput = (value, digits = 2) => {
  if (!Number.isFinite(value)) return '';
  return Number(value).toFixed(digits);
};

const toBool = (value) => {
  if (typeof value === 'boolean') return value;
  if (value === null || value === undefined || value === '') return false;
  const token = String(value).trim().toLowerCase();
  return ['true', '1', 'sim', 'yes'].includes(token);
};

const firstDefined = (...values) => values.find((value) => value !== undefined && value !== null);

const normalizeDateValue = (value) => {
  if (!value) return toLocalDateInputValue(new Date());
  const date = value?.toDate ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return toLocalDateInputValue(new Date());
  return toLocalDateInputValue(date);
};

const readPath = (source, path) => {
  if (!source || !path) return undefined;
  return String(path).split('.').reduce((acc, key) => (
    acc === null || acc === undefined ? undefined : acc[key]
  ), source);
};

const readNumberByAliases = (source, aliases = []) => {
  for (const alias of aliases) {
    const value = readPath(source, alias);
    const parsed = toNumber(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};

const resolveSexo = (...values) => {
  for (const value of values) {
    const token = String(value || '').trim().toLowerCase();
    if (!token) continue;
    if (token.includes('fem') || token === 'f') return 'feminino';
    if (token.includes('masc') || token === 'm') return 'masculino';
  }
  return '';
};

const scoreQuestionnaire = (answers = {}) => (
  Object.values(answers).reduce((sum, value) => (
    sum + (value === true ? 1 : 0)
  ), 0)
);

const classifyDE = (de) => {
  if (!Number.isFinite(de)) return '';
  if (de >= 45) return 'otima';
  if (de >= 30) return 'risco_relativo';
  return 'reds_estabelecido';
};

const findLatestEvaluationByType = (history, tipo, sessaoId) => {
  const normalizedTipo = normalizeType(tipo);
  if (!Array.isArray(history)) return null;
  const scoped = history.filter((item) => {
    if (normalizeType(item?.tipo) !== normalizedTipo) return false;
    if (!sessaoId) return true;
    return String(item?.sessaoId || '') === String(sessaoId);
  });
  if (scoped.length > 0) return scoped[0];
  if (!sessaoId) return null;
  return history.find((item) => normalizeType(item?.tipo) === normalizedTipo) || null;
};

const normalizeQuestionnaireSnapshot = (sourceValue, questions) => {
  const base = createQuestionnaireState(questions);
  if (!sourceValue) return base;

  if (Array.isArray(sourceValue)) {
    const next = { ...base };
    questions.forEach((question, index) => {
      const value = sourceValue[index];
      if (typeof value === 'boolean') next[question.key] = value;
    });
    return next;
  }

  if (typeof sourceValue === 'object') {
    const next = { ...base };
    questions.forEach((question) => {
      if (Object.prototype.hasOwnProperty.call(sourceValue, question.key)) {
        next[question.key] = sourceValue[question.key] === null
          ? null
          : Boolean(sourceValue[question.key]);
      }
    });
    return next;
  }

  return base;
};

const AvaliacaoTriagemREDS = ({
  pacienteId,
  onSalvar,
  onAutoSave,
  readOnly = false,
  patient,
  onboardingContext,
  moduleSnapshot,
  currentSessionId,
  allEvaluationHistory = [],
  baselineAnthropometry
}) => {
  const [dataAvaliacao, setDataAvaliacao] = useState(() => toLocalDateInputValue(new Date()));
  const [ingestaoManual, setIngestaoManual] = useState('');
  const [gastoManual, setGastoManual] = useState('');
  const [massaMagraManual, setMassaMagraManual] = useState('');
  const [historicoAmenorreia, setHistoricoAmenorreia] = useState(false);
  const [historicoFraturaEstresse, setHistoricoFraturaEstresse] = useState(false);
  const [pressaoParaRestricao, setPressaoParaRestricao] = useState(false);
  const [sintomas, setSintomas] = useState([]);
  const [leafAnswers, setLeafAnswers] = useState(() => createQuestionnaireState(LEAF_Q_QUESTIONS));
  const [leaAnswers, setLeaAnswers] = useState(() => createQuestionnaireState(LEA_Q13_QUESTIONS));
  const [error, setError] = useState('');
  const [saveStatus, setSaveStatus] = useState(null);

  const saveStatusResetRef = useRef(null);
  const autoSaveRef = useRef(null);
  const loadedSnapshotIdRef = useRef('');

  const sexoBiologico = useMemo(() => resolveSexo(
    baselineAnthropometry?.sexo,
    patient?.sexoBiologico,
    patient?.sexo,
    patient?.genero,
    moduleSnapshot?.dados?.sexoBiologico,
    moduleSnapshot?.dados?.sexo
  ), [
    baselineAnthropometry?.sexo,
    moduleSnapshot?.dados?.sexo,
    moduleSnapshot?.dados?.sexoBiologico,
    patient?.genero,
    patient?.sexo,
    patient?.sexoBiologico
  ]);

  const isFemale = sexoBiologico === 'feminino';
  const isMale = sexoBiologico === 'masculino';

  const latestAlimentar = useMemo(
    () => findLatestEvaluationByType(allEvaluationHistory, 'alimentar', currentSessionId),
    [allEvaluationHistory, currentSessionId]
  );
  const latestGet = useMemo(
    () => findLatestEvaluationByType(allEvaluationHistory, 'gasto_energetico_total', currentSessionId),
    [allEvaluationHistory, currentSessionId]
  );
  const latestComposicao = useMemo(
    () => findLatestEvaluationByType(allEvaluationHistory, 'composicao_corporal_integrada', currentSessionId),
    [allEvaluationHistory, currentSessionId]
  );

  const autoData = useMemo(() => {
    const ingestaoKcalR24h = readNumberByAliases(latestAlimentar, [
      'resultados.ingestaoKcalR24hAuto',
      'resultados.ingestao_kcal_r24h_auto',
      'resultados.ingestaoKcalR24h',
      'resultados.ingestao_kcal_r24h',
      'resultados.ingestaoKcal',
      'resultados.caloriasTotal',
      'resultados.caloriasTotalAuto',
      'resultados.totalDiario',
      'resultados.calculated.ingestaoKcalR24hAuto',
      'resultados.calculated.ingestaoKcalR24h',
      'resultados.calculated.totalDiario',
      'dados.ingestaoKcalR24hAuto',
      'dados.ingestao_kcal_r24h_auto',
      'dados.ingestaoKcalR24h',
      'dados.ingestao_kcal_r24h',
      'dados.ingestaoKcal',
      'dados.caloriasTotal',
      'dados.totalDiario',
      'dados.total_diario',
      'ingestaoKcalR24hAuto',
      'ingestao_kcal_r24h_auto',
      'ingestaoKcalR24h',
      'ingestao_kcal_r24h',
      'ingestaoKcal',
      'caloriasTotal',
      'totalDiario'
    ]);

    const gastoSemanal = readNumberByAliases(latestGet, [
      'resultados.gastoExercicioSemanalAuto',
      'resultados.gasto_exercicio_semanal_auto',
      'resultados.gastoExercicioSemanal',
      'resultados.gastoExercicioSemanalKcal',
      'resultados.calculated.totalGastoSemanalKcal',
      'resultados.calculated.gastoExercicioSemanalAuto',
      'resultados.calculated.gastoExercicioSemanal',
      'dados.gastoExercicioSemanalAuto',
      'dados.gasto_exercicio_semanal_auto',
      'dados.gastoExercicioSemanal',
      'dados.gastoExercicioSemanalKcal',
      'dados.resultados_calculados.totalGastoSemanalKcal',
      'dados.esportivo.totalGastoSemanalKcal',
      'dados.esportivo.total_gasto_semanal_kcal',
      'gastoExercicioSemanalAuto',
      'gasto_exercicio_semanal_auto',
      'gastoExercicioSemanal',
      'gastoExercicioSemanalKcal',
      'totalGastoSemanalKcal'
    ]);
    const gastoDiarioDireto = readNumberByAliases(latestGet, [
      'resultados.gastoExercicioKcalAuto',
      'resultados.gasto_exercicio_kcal_auto',
      'resultados.gastoExercicioKcal',
      'resultados.gastoExercicioKcalDiario',
      'resultados.gastoExercicioKcalDiarioAuto',
      'resultados.gastoExercicioDiarioKcal',
      'resultados.calculated.gastoExercicioKcalAuto',
      'resultados.calculated.gastoExercicioKcal',
      'dados.gastoExercicioKcalAuto',
      'dados.gasto_exercicio_kcal_auto',
      'dados.gastoExercicioKcal',
      'dados.gasto_exercicio_kcal',
      'dados.gastoExercicioKcalDiario',
      'dados.gastoExercicioDiarioKcal',
      'gastoExercicioKcalAuto',
      'gasto_exercicio_kcal_auto',
      'gastoExercicioKcal',
      'gastoExercicioKcalDiario',
      'gastoExercicioDiarioKcal'
    ]);
    const gastoExercicioKcal = Number.isFinite(gastoDiarioDireto)
      ? gastoDiarioDireto
      : (Number.isFinite(gastoSemanal) ? Number((gastoSemanal / 7).toFixed(2)) : null);

    const massaMagraKg = readNumberByAliases(latestComposicao, [
      'resultados.massaMagraKgAuto',
      'resultados.massa_magra_kg_auto',
      'resultados.massaMagraKg',
      'resultados.massa_magra_kg',
      'resultados.massaMagra',
      'resultados.massa_magra_kg',
      'resultados.calculated.massaMagraOficialKg',
      'resultados.calculated.massaMagraKgAuto',
      'resultados.calculated.massaMagraKg',
      'dados.massaMagraKgAuto',
      'dados.massa_magra_kg_auto',
      'dados.massaMagraKg',
      'dados.massa_magra_kg',
      'dados.massaMagra',
      'dados.massaMagraOficialKg',
      'dados.massa_magra_oficial_kg',
      'dados.resultados_calculados.massaMagraOficialKg',
      'massaMagraKgAuto',
      'massa_magra_kg_auto',
      'massaMagraKg',
      'massa_magra_kg',
      'massaMagra'
    ]);

    return {
      ingestaoKcalR24h,
      gastoExercicioKcal,
      massaMagraKg
    };
  }, [latestAlimentar, latestComposicao, latestGet]);

  const precisaDadosExtras = useMemo(() => ([
    !Number.isFinite(autoData.ingestaoKcalR24h) ? 'alimentar' : null,
    !Number.isFinite(autoData.gastoExercicioKcal) ? 'gasto_energetico_total' : null,
    !Number.isFinite(autoData.massaMagraKg) ? 'composicao_corporal_integrada' : null
  ].filter(Boolean)), [autoData.gastoExercicioKcal, autoData.ingestaoKcalR24h, autoData.massaMagraKg]);

  const ingestaoKcalResolvida = useMemo(() => {
    if (Number.isFinite(autoData.ingestaoKcalR24h)) return autoData.ingestaoKcalR24h;
    return toNumber(ingestaoManual);
  }, [autoData.ingestaoKcalR24h, ingestaoManual]);

  const gastoExercicioResolvido = useMemo(() => {
    if (Number.isFinite(autoData.gastoExercicioKcal)) return autoData.gastoExercicioKcal;
    return toNumber(gastoManual);
  }, [autoData.gastoExercicioKcal, gastoManual]);

  const massaMagraResolvida = useMemo(() => {
    if (Number.isFinite(autoData.massaMagraKg)) return autoData.massaMagraKg;
    return toNumber(massaMagraManual);
  }, [autoData.massaMagraKg, massaMagraManual]);

  const disponibilidadeEnergetica = useMemo(() => {
    if (!Number.isFinite(ingestaoKcalResolvida)) return null;
    if (!Number.isFinite(gastoExercicioResolvido)) return null;
    if (!Number.isFinite(massaMagraResolvida) || massaMagraResolvida <= 0) return null;
    const value = (ingestaoKcalResolvida - gastoExercicioResolvido) / massaMagraResolvida;
    return Number.isFinite(value) ? Number(value.toFixed(2)) : null;
  }, [gastoExercicioResolvido, ingestaoKcalResolvida, massaMagraResolvida]);

  const classificacaoDE = useMemo(
    () => classifyDE(disponibilidadeEnergetica),
    [disponibilidadeEnergetica]
  );

  const scoreLeafQ = useMemo(() => {
    if (isFemale) return scoreQuestionnaire(leafAnswers);
    if (isMale) return scoreQuestionnaire(leaAnswers);
    return null;
  }, [isFemale, isMale, leafAnswers, leaAnswers]);

  const scoreLeaQ13 = useMemo(
    () => (isMale ? scoreQuestionnaire(leaAnswers) : null),
    [isMale, leaAnswers]
  );

  const hasLeafAlert = isFemale && Number.isFinite(scoreLeafQ) && scoreLeafQ >= 8;
  const questionnaireStats = useMemo(() => {
    const questions = isFemale ? LEAF_Q_QUESTIONS : isMale ? LEA_Q13_QUESTIONS : [];
    const answers = isFemale ? leafAnswers : isMale ? leaAnswers : {};
    const answered = questions.filter((item) => answers[item.key] !== null).length;
    return {
      answered,
      total: questions.length,
      complete: questions.length > 0 && answered === questions.length
    };
  }, [isFemale, isMale, leaAnswers, leafAnswers]);
  const onboardingResumo = useMemo(() => ({
    modalidadePrincipal: String(onboardingContext?.modalidadePrincipal || '').trim(),
    frequenciaSemanal: toNumber(onboardingContext?.frequenciaSemanal),
    duracaoSessao: toNumber(onboardingContext?.duracaoSessao),
    genero: String(onboardingContext?.genero || '').trim()
  }), [
    onboardingContext?.duracaoSessao,
    onboardingContext?.frequenciaSemanal,
    onboardingContext?.genero,
    onboardingContext?.modalidadePrincipal
  ]);

  const dadosAutomaticosCobertura = useMemo(() => {
    const count = [
      autoData.ingestaoKcalR24h,
      autoData.gastoExercicioKcal,
      autoData.massaMagraKg
    ].filter((value) => Number.isFinite(value)).length;
    if (count === 3) return { tone: 'ok', label: 'Cobertura automatica completa', count };
    if (count >= 1) return { tone: 'warn', label: 'Cobertura automatica parcial', count };
    return { tone: 'risk', label: 'Sem cobertura automatica', count };
  }, [autoData.gastoExercicioKcal, autoData.ingestaoKcalR24h, autoData.massaMagraKg]);

  const recomendacaoConduta = useMemo(() => {
    if (classificacaoDE === 'reds_estabelecido') {
      return {
        tone: 'risk',
        title: 'Conduta com alto risco funcional',
        message: 'Evite plano hipocalorico antes de corrigir disponibilidade energetica e sinais de risco.'
      };
    }
    if (classificacaoDE === 'risco_relativo') {
      return {
        tone: 'warn',
        title: 'Conduta com monitoramento reforcado',
        message: 'Ajuste ingestao e acompanhe sintomas antes de progressao de carga.'
      };
    }
    if (classificacaoDE === 'otima') {
      return {
        tone: 'ok',
        title: 'Conduta energetica favoravel',
        message: 'Disponibilidade energetica adequada para suportar plano e periodizacao.'
      };
    }
    return {
      tone: 'warn',
      title: 'Conduta com dados incompletos',
      message: 'Complete os dados faltantes para classificar risco RED-S com seguranca.'
    };
  }, [classificacaoDE]);

  const readinessItems = useMemo(() => {
    const baseInputsCount = [
      ingestaoKcalResolvida,
      gastoExercicioResolvido,
      massaMagraResolvida
    ].filter((value) => Number.isFinite(value)).length;
    const classificationStatus = classificacaoDE === 'reds_estabelecido'
      ? 'danger'
      : classificacaoDE === 'risco_relativo'
        ? 'warning'
        : classificacaoDE === 'otima'
          ? 'ok'
          : 'pending';

    return [
      {
        key: 'base-inputs',
        label: 'Base energetica',
        status: baseInputsCount === 3 ? 'ok' : baseInputsCount > 0 ? 'warning' : 'pending',
        value: `${baseInputsCount}/3 campos`
      },
      {
        key: 'questionnaire',
        label: isFemale ? 'LEAF-Q' : isMale ? 'LEA-Q13' : 'Questionario',
        status: questionnaireStats.complete ? 'ok' : 'pending',
        value: questionnaireStats.total ? `${questionnaireStats.answered}/${questionnaireStats.total}` : 'sexo pendente'
      },
      {
        key: 'de',
        label: 'Disponibilidade energetica',
        status: Number.isFinite(disponibilidadeEnergetica) ? classificationStatus : 'pending',
        value: Number.isFinite(disponibilidadeEnergetica) ? disponibilidadeEnergetica.toFixed(2) : 'nao calculada'
      },
      {
        key: 'classification',
        label: 'Classificacao',
        status: classificationStatus,
        value: classificacaoDE ? classificacaoDE.replace(/_/g, ' ') : 'pendente'
      }
    ];
  }, [
    classificacaoDE,
    disponibilidadeEnergetica,
    gastoExercicioResolvido,
    ingestaoKcalResolvida,
    isFemale,
    isMale,
    massaMagraResolvida,
    questionnaireStats.answered,
    questionnaireStats.complete,
    questionnaireStats.total
  ]);

  const payload = useMemo(() => ({
    tipo: 'triagem_reds',
    pacienteId,
    data: dataAvaliacao,
    schemaVersion: 1,
    formulaId: 'DE',
    formulaVersion: '1.0.0',
    dados: {
      dataAvaliacao,
      sexoBiologico: sexoBiologico || null,
      ingestaoKcalR24hAuto: Number.isFinite(autoData.ingestaoKcalR24h) ? Number(autoData.ingestaoKcalR24h.toFixed(2)) : null,
      gastoExercicioKcalAuto: Number.isFinite(autoData.gastoExercicioKcal) ? Number(autoData.gastoExercicioKcal.toFixed(2)) : null,
      massaMagraKgAuto: Number.isFinite(autoData.massaMagraKg) ? Number(autoData.massaMagraKg.toFixed(2)) : null,
      ingestaoKcalR24hManual: toNumber(ingestaoManual),
      gastoExercicioKcalManual: toNumber(gastoManual),
      massaMagraKgManual: toNumber(massaMagraManual),
      ingestaoKcalR24h: Number.isFinite(ingestaoKcalResolvida) ? Number(ingestaoKcalResolvida.toFixed(2)) : null,
      gastoExercicioKcal: Number.isFinite(gastoExercicioResolvido) ? Number(gastoExercicioResolvido.toFixed(2)) : null,
      massaMagraKg: Number.isFinite(massaMagraResolvida) ? Number(massaMagraResolvida.toFixed(2)) : null,
      disponibilidadeEnergetica,
      scoreLeafQ: Number.isFinite(scoreLeafQ) ? scoreLeafQ : null,
      scoreLeaQ13: Number.isFinite(scoreLeaQ13) ? scoreLeaQ13 : null,
      leafQRespostas: leafAnswers,
      leaQ13Respostas: leaAnswers,
      historicoAmenorreia,
      historicoFraturaEstresse,
      pressaoParaRestricao,
      sintomas,
      precisaDadosExtras,
      fontesAutomaticas: {
        alimentar: Number.isFinite(autoData.ingestaoKcalR24h),
        gasto_energetico_total: Number.isFinite(autoData.gastoExercicioKcal),
        composicao_corporal_integrada: Number.isFinite(autoData.massaMagraKg)
      }
    },
    resultados: {
      DE: disponibilidadeEnergetica,
      disponibilidadeEnergetica,
      classificacaoDE: classificacaoDE || null,
      scoreLeafQ: Number.isFinite(scoreLeafQ) ? scoreLeafQ : null,
      scoreLeaQ13: Number.isFinite(scoreLeaQ13) ? scoreLeaQ13 : null,
      precisaDadosExtras,
      calculated: {
        DE: disponibilidadeEnergetica,
        classificacaoDE: classificacaoDE || null,
        scoreLeafQ: Number.isFinite(scoreLeafQ) ? scoreLeafQ : null,
        scoreLeaQ13: Number.isFinite(scoreLeaQ13) ? scoreLeaQ13 : null,
        precisaDadosExtras
      },
      output: {
        classificacaoDE: classificacaoDE || null,
        precisaDadosExtras
      }
    },
    classificacao: classificacaoDE || undefined,
    classificacaoLabel: classificacaoDE ? `Triagem RED-S: ${classificacaoDE}` : undefined,
    sessaoId: moduleSnapshot?.sessaoId || currentSessionId
  }), [
    autoData.gastoExercicioKcal,
    autoData.ingestaoKcalR24h,
    autoData.massaMagraKg,
    classificacaoDE,
    currentSessionId,
    dataAvaliacao,
    disponibilidadeEnergetica,
    gastoExercicioResolvido,
    gastoManual,
    historicoAmenorreia,
    historicoFraturaEstresse,
    ingestaoKcalResolvida,
    ingestaoManual,
    leaAnswers,
    leafAnswers,
    massaMagraManual,
    massaMagraResolvida,
    moduleSnapshot?.sessaoId,
    pacienteId,
    precisaDadosExtras,
    pressaoParaRestricao,
    scoreLeafQ,
    scoreLeaQ13,
    sexoBiologico,
    sintomas
  ]);

  const hasInput = useMemo(() => (
    Number.isFinite(ingestaoKcalResolvida)
    || Number.isFinite(gastoExercicioResolvido)
    || Number.isFinite(massaMagraResolvida)
    || sintomas.length > 0
    || historicoAmenorreia
    || historicoFraturaEstresse
    || pressaoParaRestricao
    || Object.values(leafAnswers).some((value) => value !== null)
    || Object.values(leaAnswers).some((value) => value !== null)
  ), [
    gastoExercicioResolvido,
    historicoAmenorreia,
    historicoFraturaEstresse,
    ingestaoKcalResolvida,
    leaAnswers,
    leafAnswers,
    massaMagraResolvida,
    pressaoParaRestricao,
    sintomas.length
  ]);

  useEffect(() => () => {
    clearTimeout(autoSaveRef.current);
    if (saveStatusResetRef.current) clearTimeout(saveStatusResetRef.current);
  }, []);

  useEffect(() => {
    const snapshotId = moduleSnapshot?.id || '';
    if (!snapshotId || loadedSnapshotIdRef.current === snapshotId) return;
    const source = moduleSnapshot?.dados || {};

    setDataAvaliacao(normalizeDateValue(firstDefined(
      moduleSnapshot?.data,
      source?.dataAvaliacao
    )));
    setIngestaoManual(toInput(firstDefined(
      source?.ingestaoKcalR24hManual,
      source?.ingestaoKcalR24hFallback,
      source?.ingestaoManualKcal
    )));
    setGastoManual(toInput(firstDefined(
      source?.gastoExercicioKcalManual,
      source?.gastoManualKcal,
      source?.gastoExercicioDiarioManual
    )));
    setMassaMagraManual(toInput(firstDefined(
      source?.massaMagraKgManual,
      source?.massaMagraFallback,
      source?.massaMagraManual
    )));
    setHistoricoAmenorreia(toBool(source?.historicoAmenorreia));
    setHistoricoFraturaEstresse(toBool(source?.historicoFraturaEstresse));
    setPressaoParaRestricao(toBool(source?.pressaoParaRestricao));
    setSintomas(Array.isArray(source?.sintomas) ? source.sintomas.filter(Boolean) : []);
    setLeafAnswers(normalizeQuestionnaireSnapshot(source?.leafQRespostas, LEAF_Q_QUESTIONS));
    setLeaAnswers(normalizeQuestionnaireSnapshot(source?.leaQ13Respostas, LEA_Q13_QUESTIONS));

    loadedSnapshotIdRef.current = snapshotId;
  }, [moduleSnapshot]);

  const validateBeforeSave = useCallback(() => {
    if (!hasInput) {
      return 'Preencha ao menos um campo para salvar a triagem RED-S.';
    }
    return '';
  }, [hasInput]);

  const dispatchSalvar = useCallback(async (auto = false) => {
    const dispatch = auto ? onAutoSave : onSalvar;
    if (!dispatch) return;

    if (!auto) {
      const validationError = validateBeforeSave();
      if (validationError) {
        setError(validationError);
        return;
      }
    }

    setError('');
    setSaveStatus('saving');
    if (saveStatusResetRef.current) clearTimeout(saveStatusResetRef.current);
    try {
      await Promise.resolve(dispatch(payload));
      setSaveStatus('saved');
      saveStatusResetRef.current = setTimeout(() => setSaveStatus(null), 3200);
    } catch {
      if (!auto) setError('Nao foi possivel salvar a triagem RED-S.');
      setSaveStatus('error');
    }
  }, [onAutoSave, onSalvar, payload, validateBeforeSave]);

  useEffect(() => {
    if (readOnly || !onAutoSave || !hasInput) return undefined;
    clearTimeout(autoSaveRef.current);
    autoSaveRef.current = setTimeout(() => {
      dispatchSalvar(true);
    }, 3500);
    return () => clearTimeout(autoSaveRef.current);
  }, [dispatchSalvar, hasInput, onAutoSave, readOnly]);

  const toggleSintoma = (value) => {
    setSintomas((prev) => (
      prev.includes(value)
        ? prev.filter((item) => item !== value)
        : [...prev, value]
    ));
  };

  const renderQuestionnaire = (questions, answers, onChange) => (
    <div className="triagem-reds-questionnaire">
      {questions.map((item) => (
        <div key={item.key} className="triagem-reds-question">
          <span>{item.label}</span>
          <div className="triagem-reds-question-options">
            <label>
              <input
                type="radio"
                name={item.key}
                checked={answers[item.key] === true}
                onChange={() => onChange(item.key, true)}
                disabled={readOnly}
              />
              Sim
            </label>
            <label>
              <input
                type="radio"
                name={item.key}
                checked={answers[item.key] === false}
                onChange={() => onChange(item.key, false)}
                disabled={readOnly}
              />
              Nao
            </label>
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className={`triagem-reds${readOnly ? ' eval-card--readonly' : ''}`}>
      <div className="eval-card triagem-reds__header-card">
        <div className="eval-header">
          <div className="eval-icon">
            <Activity size={22} />
          </div>
          <div>
            <h3 className="eval-title">Triagem RED-S</h3>
            <p className="eval-subtitle">
              Disponibilidade energetica (DE) com suporte a LEAF-Q / LEA-Q13
            </p>
          </div>
        </div>

        <div className="triagem-reds__date-row">
          <div className="eval-field triagem-reds__date-field">
            <label className="eval-label">Data da triagem</label>
            <input
              type="date"
              className="eval-input"
              value={dataAvaliacao}
              onChange={(event) => setDataAvaliacao(event.target.value)}
              disabled={readOnly}
            />
          </div>
          <div className="triagem-reds__sex-chip">
            Sexo biologico de referencia: <strong>{sexoBiologico || 'nao informado'}</strong>
          </div>
        </div>
      </div>

      <div className={`triagem-reds__context-note triagem-reds__context-note--${dadosAutomaticosCobertura.tone}`}>
        <strong>Contexto esportivo:</strong>
        {' '}
        {onboardingResumo.modalidadePrincipal || 'modalidade nao informada'}
        {' | '}
        Frequencia: {Number.isFinite(onboardingResumo.frequenciaSemanal) ? `${onboardingResumo.frequenciaSemanal}x/sem` : 'nao informada'}
        {' | '}
        Duracao: {Number.isFinite(onboardingResumo.duracaoSessao) ? `${onboardingResumo.duracaoSessao} min` : 'nao informada'}
        {onboardingResumo.genero ? ` | Genero: ${onboardingResumo.genero}` : ''}
        <small>
          {dadosAutomaticosCobertura.label} ({dadosAutomaticosCobertura.count}/3 fontes automaticas)
        </small>
      </div>

      <EvaluationReadiness items={readinessItems} />

      <div className="eval-card triagem-reds__auto-card">
        <h4>Dados automaticos da sessao</h4>
        <div className="triagem-reds__auto-grid">
          <div>
            <span>Ingestao kcal (R24h)</span>
            <strong>{Number.isFinite(autoData.ingestaoKcalR24h) ? `${autoData.ingestaoKcalR24h.toFixed(2)} kcal` : 'Nao disponivel'}</strong>
          </div>
          <div>
            <span>Gasto exercicio (kcal/dia)</span>
            <strong>{Number.isFinite(autoData.gastoExercicioKcal) ? `${autoData.gastoExercicioKcal.toFixed(2)} kcal` : 'Nao disponivel'}</strong>
          </div>
          <div>
            <span>Massa magra (kg)</span>
            <strong>{Number.isFinite(autoData.massaMagraKg) ? `${autoData.massaMagraKg.toFixed(2)} kg` : 'Nao disponivel'}</strong>
          </div>
        </div>

        {precisaDadosExtras.length > 0 && (
          <div className="triagem-reds__missing">
            <AlertTriangle size={16} />
            <p>
              Dados automaticos incompletos: <strong>{precisaDadosExtras.join(', ')}</strong>.
            </p>
          </div>
        )}
      </div>

      <div className="eval-card triagem-reds__manual-card">
        <h4>Informar manualmente</h4>
        <p className="eval-hint">Use quando os módulos correspondentes ainda não foram preenchidos nesta sessão.</p>
        <div className="triagem-reds__manual-grid">
          <label className="eval-label">
            Ingestao kcal R24h (manual)
            <input
              type="number"
              step="0.1"
              className="eval-input"
              value={ingestaoManual}
              onChange={(event) => setIngestaoManual(event.target.value)}
              disabled={readOnly}
              placeholder="Ex.: 2200"
            />
          </label>
          <label className="eval-label">
            Gasto exercicio kcal/dia (manual)
            <input
              type="number"
              step="0.1"
              className="eval-input"
              value={gastoManual}
              onChange={(event) => setGastoManual(event.target.value)}
              disabled={readOnly}
              placeholder="Ex.: 850"
            />
          </label>
          <label className="eval-label">
            Massa magra kg (manual)
            <input
              type="number"
              step="0.1"
              className="eval-input"
              value={massaMagraManual}
              onChange={(event) => setMassaMagraManual(event.target.value)}
              disabled={readOnly}
              placeholder="Ex.: 52"
            />
          </label>
        </div>
      </div>

      <div className="eval-card triagem-reds__result-card">
        <h4>Resultado DE</h4>
        <div className="triagem-reds__result-grid">
          <div>
            <span>Disponibilidade Energetica (kcal/kg MLG)</span>
            <strong>{Number.isFinite(disponibilidadeEnergetica) ? disponibilidadeEnergetica.toFixed(2) : 'Dados insuficientes'}</strong>
          </div>
          <div>
            <span>Classificacao</span>
            <strong className={`triagem-reds__badge triagem-reds__badge--${classificacaoDE || 'na'}`}>
              {classificacaoDE || 'nao calculada'}
            </strong>
          </div>
          <div>
            <span>Score principal</span>
            <strong>{Number.isFinite(scoreLeafQ) ? scoreLeafQ : 'Nao calculado'}</strong>
          </div>
        </div>
      </div>

      <div className={`triagem-reds__conduta-note triagem-reds__conduta-note--${recomendacaoConduta.tone}`}>
        <strong>{recomendacaoConduta.title}</strong>
        <p>{recomendacaoConduta.message}</p>
        <small>
          Classificacao DE: {classificacaoDE || 'nao calculada'}
          {' | '}
          Score principal: {Number.isFinite(scoreLeafQ) ? scoreLeafQ : 'nao calculado'}
          {' | '}
          Plano alimentar: {classificacaoDE === 'reds_estabelecido' ? 'requer override justificado' : 'pode prosseguir com criterio clinico'}
        </small>
      </div>

      {isFemale && (
        <div className="eval-card triagem-reds__questionnaire-card">
          <h4>LEAF-Q (mulheres)</h4>
          {renderQuestionnaire(LEAF_Q_QUESTIONS, leafAnswers, (key, value) => {
            setLeafAnswers((prev) => ({ ...prev, [key]: value }));
          })}
          <p className="triagem-reds__score-line">
            Score LEAF-Q: <strong>{scoreQuestionnaire(leafAnswers)}</strong>
          </p>
          {hasLeafAlert && (
            <div className="triagem-reds__leaf-alert">
              <AlertTriangle size={16} />
              <p>
                Risco elevado de RED-S (sensibilidade 78%, especificidade 90%) — Melin et al. 2014
              </p>
            </div>
          )}
        </div>
      )}

      {isMale && (
        <div className="eval-card triagem-reds__questionnaire-card">
          <h4>LEA-Q13 (homens)</h4>
          {renderQuestionnaire(LEA_Q13_QUESTIONS, leaAnswers, (key, value) => {
            setLeaAnswers((prev) => ({ ...prev, [key]: value }));
          })}
          <p className="triagem-reds__score-line">
            Score LEA-Q13: <strong>{scoreQuestionnaire(leaAnswers)}</strong>
          </p>
        </div>
      )}

      {!isFemale && !isMale && (
        <div className="eval-card triagem-reds__questionnaire-card">
          <h4>Questionario de risco</h4>
          <p>Sexo biologico nao identificado. Defina no prontuario para habilitar LEAF-Q ou LEA-Q13.</p>
        </div>
      )}

      <div className="eval-card triagem-reds__risk-card">
        <h4>Sinais adicionais de risco</h4>
        <div className="triagem-reds__risk-grid">
          <label>
            <input
              type="checkbox"
              checked={historicoAmenorreia}
              onChange={(event) => setHistoricoAmenorreia(event.target.checked)}
              disabled={readOnly}
            />
            Historico de amenorreia
          </label>
          <label>
            <input
              type="checkbox"
              checked={historicoFraturaEstresse}
              onChange={(event) => setHistoricoFraturaEstresse(event.target.checked)}
              disabled={readOnly}
            />
            Historico de fratura por estresse
          </label>
          <label>
            <input
              type="checkbox"
              checked={pressaoParaRestricao}
              onChange={(event) => setPressaoParaRestricao(event.target.checked)}
              disabled={readOnly}
            />
            Pressao para restricao alimentar
          </label>
        </div>
        <div className="triagem-reds__symptoms">
          {SINTOMAS_OPTIONS.map((item) => (
            <label key={item.value}>
              <input
                type="checkbox"
                checked={sintomas.includes(item.value)}
                onChange={() => toggleSintoma(item.value)}
                disabled={readOnly}
              />
              {item.label}
            </label>
          ))}
        </div>
      </div>

      {error && (
        <p className="triagem-reds__error">{error}</p>
      )}

      <div className="triagem-reds__actions">
        <Button
          variant="primary"
          onClick={() => dispatchSalvar(false)}
          disabled={readOnly}
        >
          <Save size={16} />
          Salvar triagem RED-S
        </Button>
        {saveStatus === 'saving' && <span>Salvando...</span>}
        {saveStatus === 'saved' && <span>Salvo com sucesso.</span>}
        {saveStatus === 'error' && <span>Falha ao salvar.</span>}
      </div>
    </div>
  );
};

export default AvaliacaoTriagemREDS;
