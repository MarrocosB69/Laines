import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Flame, RefreshCw } from 'lucide-react';
import { Button } from '../../ui';
import api from '../../../services/api';
import { toLocalDateInputValue } from '../../../utils/dateUtils';
import {
  buildComparativeDeltas,
  calculateGetEvaluation,
  calculateWeeklyPal,
  sumWeeklyActivityExpenditure
} from '../../../services/calculationEngine';
import { useUiFeedback } from '../../../contexts/UiFeedbackContext';
import { restoreSavedGetForDisplay } from './getSavedDisplay';
import '../avaliacoes.css';
import {
  AvaliacaoModulo,
  AvaliacaoSecao,
  AvaliacaoIndice,
  Campo,
  ResultadoCalculado,
  AvisoAvaliacao,
  BarraAcoesAvaliacao,
  Tendencia,
  idTituloSecao
} from '../base';
import './GastoEnergeticoTotalForm.css';

const ACTIVITY_OPTIONS = [
  { value: 'sedentario', label: 'Sedentário (1.2)' },
  { value: 'levemente_ativo', label: 'Levemente ativo (1.375)' },
  { value: 'moderadamente_ativo', label: 'Moderadamente ativo (1.55)' },
  { value: 'muito_ativo', label: 'Muito ativo (1.725)' },
  { value: 'extremamente_ativo', label: 'Extremamente ativo (1.9)' }
];

const NIVEL_COMPETITIVO_OPTIONS = [
  { value: 'amador', label: 'Amador' },
  { value: 'semi-pro', label: 'Semi-pro' },
  { value: 'elite', label: 'Elite' },
  { value: 'federado', label: 'Federado' }
];

const DIAS_SEMANA = [
  { key: 'segunda', label: 'Segunda' },
  { key: 'terca', label: 'Terça' },
  { key: 'quarta', label: 'Quarta' },
  { key: 'quinta', label: 'Quinta' },
  { key: 'sexta', label: 'Sexta' },
  { key: 'sabado', label: 'Sábado' },
  { key: 'domingo', label: 'Domingo' }
];

const createSemanaRow = (dia) => ({
  dia,
  metId: '',
  atividade: '',
  categoria: '',
  intensidade: '',
  metValue: '',
  duracaoHoras: '',
  gastoKcal: null,
  erroCalculo: '',
  loadingCalculo: false
});

const buildSemanaPadrao = () => DIAS_SEMANA.map((item) => createSemanaRow(item.key));

const createEsportivoData = (nivelCompetitivo = 'amador') => ({
  palSubjetivoLegado: '',
  nivelCompetitivo,
  registroAtividadesSemana: buildSemanaPadrao()
});

const createInitialData = (nivelCompetitivo = 'amador') => ({
  dataAvaliacao: toLocalDateInputValue(new Date()),
  activityLevel: 'sedentario',
  manualTmbKcal: '',
  esportivo: createEsportivoData(nivelCompetitivo),
  observacoes: ''
});

// Ordem visual: a base energética (dados, TMB e fator), o registro semanal
// com MET, os resultados, a comparação com as avaliações anteriores e as
// observações. "Comparação longitudinal" é título novo, o mesmo de BIA e
// Dobras; os outros já existiam.
const GET_INDICE = [
  { id: 'get-base', titulo: 'Base energética' },
  { id: 'get-semana', titulo: 'Registro de atividades da semana' },
  { id: 'get-resultados', titulo: 'Resultados calculados' },
  { id: 'get-comparacao', titulo: 'Comparação longitudinal' },
  { id: 'get-observacoes', titulo: 'Observações' }
];

// Confiabilidade da demanda (ok, warn, risk) no tipo do aviso. O que ela
// quer dizer já vem escrito no título; o tipo só acompanha.
const TIPO_AVISO_DEMANDA = { ok: 'sucesso', warn: 'atencao', risk: 'perigo' };

const GastoEnergeticoTotalForm = ({
  pacienteId,
  onSalvar,
  onAutoSave,
  readOnly = false,
  onboardingContext,
  baselineAnthropometry,
  moduleSnapshot,
  moduleHistory = [],
  allEvaluationHistory = [],
  currentSessionId
}) => {
  const defaultNivelCompetitivo = normalizeNivelCompetitivoApi(onboardingContext?.nivelCompetitivo);
  const onboardingEsportivo = useMemo(() => ({
    modalidadePrincipal: toTextInput(onboardingContext?.modalidadePrincipal),
    frequenciaSemanal: parseNumeric(onboardingContext?.frequenciaSemanal),
    duracaoSessao: parseNumeric(onboardingContext?.duracaoSessao),
    genero: toTextInput(onboardingContext?.genero),
    status: toTextInput(onboardingContext?.status)
  }), [
    onboardingContext?.duracaoSessao,
    onboardingContext?.frequenciaSemanal,
    onboardingContext?.genero,
    onboardingContext?.modalidadePrincipal,
    onboardingContext?.status
  ]);

  const { confirm } = useUiFeedback();

  const [dados, setDados] = useState(() => createInitialData(defaultNivelCompetitivo));
  const [error, setError] = useState('');
  const [saveStatus, setSaveStatus] = useState(null);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [hasUserInput, setHasUserInput] = useState(false);
  const [metOptions, setMetOptions] = useState([]);
  const [metLoading, setMetLoading] = useState(false);
  const [metError, setMetError] = useState('');
  const loadedSnapshotIdRef = useRef(null);
  const autoSaveRef = useRef(null);
  const saveStatusResetRef = useRef(null);
  const calcRunRef = useRef(0);

  useEffect(() => () => {
    clearTimeout(autoSaveRef.current);
    if (saveStatusResetRef.current) clearTimeout(saveStatusResetRef.current);
  }, []);

  useEffect(() => {
    let mounted = true;
    const fetchMets = async () => {
      setMetLoading(true);
      setMetError('');
      try {
        const { data } = await api.get('/mets');
        if (!mounted) return;
        setMetOptions(normalizeMetCatalog(data));
      } catch {
        if (!mounted) return;
        setMetError('Não foi possível carregar o catálogo de METs.');
      } finally {
        if (mounted) setMetLoading(false);
      }
    };

    fetchMets();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    setDados((prev) => {
      const currentNivel = toTextInput(prev?.esportivo?.nivelCompetitivo);
      if (currentNivel) return prev;
      return {
        ...prev,
        esportivo: {
          ...(prev?.esportivo || createEsportivoData(defaultNivelCompetitivo)),
          nivelCompetitivo: defaultNivelCompetitivo
        }
      };
    });
  }, [defaultNivelCompetitivo]);

  useEffect(() => {
    const snapshotId = moduleSnapshot?.id || '__empty__';
    if (loadedSnapshotIdRef.current === snapshotId) return;

    const source = moduleSnapshot?.dados || {};
    const dadosBrutos = source?.dados_brutos || source?.input || source;
    const esportivoRaw = asRecord(firstDefined(
      dadosBrutos?.esportivo,
      source?.esportivo
    ));
    const registroRaw = normalizeObjectArray(firstDefined(
      esportivoRaw?.registroAtividadesSemana,
      esportivoRaw?.registro_atividades_semana
    ));

    setDados((prev) => ({
      ...prev,
      dataAvaliacao: normalizeDateValue(firstDefined(
        moduleSnapshot?.data,
        source?.dataAvaliacao,
        dadosBrutos?.dataAvaliacao,
        prev.dataAvaliacao
      )),
      activityLevel: toTextInput(firstDefined(
        dadosBrutos?.activityLevel,
        dadosBrutos?.nivel_atividade,
        source?.nivel_atividade,
        'sedentario'
      )) || 'sedentario',
      manualTmbKcal: toInputValue(firstDefined(
        dadosBrutos?.manualTmbKcal,
        dadosBrutos?.tmb_manual_kcal,
        source?.tmb_manual_kcal
      ), 0),
      esportivo: {
        palSubjetivoLegado: toInputValue(firstDefined(
          esportivoRaw?.palSubjetivoLegado,
          esportivoRaw?.pal_subjetivo_legado,
          dadosBrutos?.customActivityFactor,
          dadosBrutos?.fator_atividade_personalizado,
          source?.fator_atividade_personalizado
        ), 3),
        nivelCompetitivo: toTextInput(firstDefined(
          esportivoRaw?.nivelCompetitivo,
          esportivoRaw?.nivel_competitivo,
          defaultNivelCompetitivo
        )) || defaultNivelCompetitivo,
        registroAtividadesSemana: mergeSemanaRows(buildSemanaPadrao(), registroRaw),
      },
      observacoes: toTextInput(firstDefined(
        dadosBrutos?.observacoes,
        source?.observacoes
      ))
    }));

    loadedSnapshotIdRef.current = snapshotId;
  }, [defaultNivelCompetitivo, moduleSnapshot]);

  const sex = useMemo(
    () => normalizeSexToken(baselineAnthropometry?.sexo),
    [baselineAnthropometry?.sexo]
  );

  const metById = useMemo(() => {
    const map = new Map();
    metOptions.forEach((item) => map.set(String(item.id), item));
    return map;
  }, [metOptions]);

  const pesoReferenciaKg = useMemo(
    () => resolvePesoReferenciaKg({ baselineAnthropometry, allEvaluationHistory }),
    [allEvaluationHistory, baselineAnthropometry]
  );

  const manualTmbKcal = useMemo(
    () => parseNumeric(dados.manualTmbKcal),
    [dados.manualTmbKcal]
  );

  const baseEvaluation = useMemo(() => calculateGetEvaluation({
    sex,
    weightKg: pesoReferenciaKg,
    heightCm: baselineAnthropometry?.estaturaCm,
    ageYears: baselineAnthropometry?.idade,
    activityLevel: dados.activityLevel,
    customActivityFactor: null,
    manualTmbKcal
  }), [
    baselineAnthropometry?.estaturaCm,
    baselineAnthropometry?.idade,
    dados.activityLevel,
    manualTmbKcal,
    pesoReferenciaKg,
    sex
  ]);

  // Semana sem atividade com duração: total e PAL real nulos, e vale o fator do
  // nível de atividade (WI-013, decisão 4).
  const totalGastoSemanalKcal = useMemo(
    () => sumWeeklyActivityExpenditure(normalizeObjectArray(dados?.esportivo?.registroAtividadesSemana)),
    [dados?.esportivo?.registroAtividadesSemana]
  );

  const palRealCalculado = useMemo(() => {
    const savedTmb = parseNumeric(firstDefined(
      moduleSnapshot?.dados?.resultados_calculados?.tmbBaseKcal,
      moduleSnapshot?.resultados?.tmb_kcal,
      moduleSnapshot?.resultados?.calculated?.tmbKcal
    ));
    const tmbBase = readOnly && moduleSnapshot?.id && Number.isFinite(savedTmb)
      ? savedTmb
      : toNumber(baseEvaluation?.base?.tmbUsedKcal);
    return calculateWeeklyPal({ weeklyActivityKcal: totalGastoSemanalKcal, tmbKcal: tmbBase });
  }, [baseEvaluation?.base?.tmbUsedKcal, moduleSnapshot, readOnly, totalGastoSemanalKcal]);

  const palSubjetivoLegado = useMemo(
    () => parseNumeric(dados?.esportivo?.palSubjetivoLegado),
    [dados?.esportivo?.palSubjetivoLegado]
  );

  const fatorAtividadeFinal = useMemo(() => {
    if (Number.isFinite(palRealCalculado)) return palRealCalculado;
    if (Number.isFinite(palSubjetivoLegado) && (palSubjetivoLegado) >= 0.8 && (palSubjetivoLegado) <= 2.5) {
      return palSubjetivoLegado;
    }
    return null;
  }, [palRealCalculado, palSubjetivoLegado]);

  const calculatedGetEvaluation = useMemo(() => calculateGetEvaluation({
    sex,
    weightKg: pesoReferenciaKg,
    heightCm: baselineAnthropometry?.estaturaCm,
    ageYears: baselineAnthropometry?.idade,
    activityLevel: dados.activityLevel,
    customActivityFactor: fatorAtividadeFinal,
    manualTmbKcal
  }), [
    baselineAnthropometry?.estaturaCm,
    baselineAnthropometry?.idade,
    dados.activityLevel,
    fatorAtividadeFinal,
    manualTmbKcal,
    pesoReferenciaKg,
    sex
  ]);

  const getEvaluation = useMemo(() => (
    readOnly && moduleSnapshot?.id
      ? restoreSavedGetForDisplay(moduleSnapshot, calculatedGetEvaluation)
      : calculatedGetEvaluation
  ), [calculatedGetEvaluation, moduleSnapshot, readOnly]);

  const normalizedHistory = useMemo(
    () => normalizeGetHistory(moduleHistory.filter((record) => record?.id !== moduleSnapshot?.id)),
    [moduleHistory, moduleSnapshot?.id]
  );
  const previous = normalizedHistory[0] || null;
  const first = normalizedHistory.length ? normalizedHistory[normalizedHistory.length - 1] : null;

  const comparisonRows = useMemo(() => ([
    createComparisonRow(
      'tmb',
      'TMB base',
      'kcal',
      getEvaluation?.base?.tmbUsedKcal,
      previous?.metrics?.tmb,
      first?.metrics?.tmb
    ),
    createComparisonRow(
      'factor',
      'Fator atividade',
      '',
      getEvaluation?.activity?.factorApplied,
      previous?.metrics?.factor,
      first?.metrics?.factor
    ),
    createComparisonRow(
      'get',
      'GET estimado',
      'kcal',
      getEvaluation?.results?.getKcal,
      previous?.metrics?.get,
      first?.metrics?.get
    )
  ]), [
    first?.metrics?.factor,
    first?.metrics?.get,
    first?.metrics?.tmb,
    getEvaluation?.activity?.factorApplied,
    getEvaluation?.base?.tmbUsedKcal,
    getEvaluation?.results?.getKcal,
    previous?.metrics?.factor,
    previous?.metrics?.get,
    previous?.metrics?.tmb
  ]);

  const sparklineGet = useMemo(() => {
    const values = [];
    [...normalizedHistory]
      .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0))
      .forEach((item) => {
        if (Number.isFinite(item?.metrics?.get)) values.push(item.metrics.get);
      });
    if (Number.isFinite(getEvaluation?.results?.getKcal)) values.push(getEvaluation.results.getKcal);
    return values.slice(-6);
  }, [getEvaluation, normalizedHistory]);

  const palLegadoValidation = useMemo(() => {
    if (toTextInput(dados?.esportivo?.palSubjetivoLegado) === '') return { status: 'empty', message: '' };
    const numeric = parseNumeric(dados?.esportivo?.palSubjetivoLegado);
    if (!Number.isFinite(numeric)) return { status: 'error', message: 'Informe um numero valido.' };
    if (numeric < 0.8 || numeric > 2.5) {
      return { status: 'warning', message: 'PAL legado deve estar entre 0.8 e 2.5.' };
    }
    return { status: 'ok', message: '' };
  }, [dados?.esportivo?.palSubjetivoLegado]);

  const manualTmbValidation = useMemo(() => {
    if (dados.manualTmbKcal === '') return { status: 'empty', message: '' };
    const numeric = parseNumeric(dados.manualTmbKcal);
    if (!Number.isFinite(numeric)) return { status: 'error', message: 'Informe um numero valido.' };
    if (numeric <= 0) return { status: 'error', message: 'A TMB deve ser maior que zero.' };
    if (numeric < 500 || numeric > 6000) {
      return { status: 'warning', message: 'TMB fora da faixa esperada. Verifique o valor.' };
    }
    return { status: 'ok', message: '' };
  }, [dados.manualTmbKcal]);

  const hasFieldErrors = useMemo(
    () => [palLegadoValidation, manualTmbValidation].some((item) => item.status === 'error'),
    [manualTmbValidation, palLegadoValidation]
  );

  const weeklyCalculationErrors = useMemo(
    () => normalizeObjectArray(dados?.esportivo?.registroAtividadesSemana)
      .map((row) => toTextInput(row?.erroCalculo))
      .filter(Boolean),
    [dados?.esportivo?.registroAtividadesSemana]
  );

  const weeklyPendingRows = useMemo(
    () => normalizeObjectArray(dados?.esportivo?.registroAtividadesSemana)
      .filter((row) => {
        const hasDraft = toTextInput(row?.metId) !== '' || toTextInput(row?.duracaoHoras) !== '';
        return hasDraft && !Number.isFinite(toNumber(row?.gastoKcal));
      })
      .length,
    [dados?.esportivo?.registroAtividadesSemana]
  );

  const warnings = useMemo(() => {
    const items = [...(Array.isArray(getEvaluation?.warnings) ? getEvaluation.warnings : [])];
    if (palLegadoValidation.status === 'warning') items.push(palLegadoValidation.message);
    if (manualTmbValidation.status === 'warning') items.push(manualTmbValidation.message);
    if (!Number.isFinite(pesoReferenciaKg)) {
      items.push('Peso de referencia indisponivel para calculo por sessao com MET.');
    }
    if (weeklyCalculationErrors.length > 0) {
      items.push('Existem linhas sem calculo valido na tabela semanal.');
    }
    if (weeklyPendingRows > 0) {
      items.push('Existem atividades preenchidas sem gasto calculado. Use "Recalcular semana".');
    }
    return Array.from(new Set(items.filter(Boolean)));
  }, [getEvaluation, manualTmbValidation, palLegadoValidation, pesoReferenciaKg, weeklyCalculationErrors.length, weeklyPendingRows]);

  const hasRequiredMissing = useMemo(
    () => !Number.isFinite(getEvaluation?.base?.tmbUsedKcal),
    [getEvaluation?.base?.tmbUsedKcal]
  );

  const payloadData = useMemo(() => {
    const deltaGet = buildComparativeDeltas({
      current: getEvaluation?.results?.getKcal,
      reference: previous?.metrics?.get
    });
    const esportivoPayload = buildGetEsportivoPayload({
      esportivo: dados.esportivo,
      totalGastoSemanalKcal,
      palRealCalculado
    });

    return {
      dataAvaliacao: normalizeDateValue(dados.dataAvaliacao),
      sexo: sex,
      nivel_atividade: dados.activityLevel || 'sedentario',
      fator_atividade_personalizado: Number.isFinite(fatorAtividadeFinal)
        ? Number((fatorAtividadeFinal).toFixed(3))
        : null,
      tmb_manual_kcal: Number.isFinite(manualTmbKcal)
        ? Math.round(manualTmbKcal)
        : null,
      esportivo: esportivoPayload,
      dados_brutos: {
        activityLevel: dados.activityLevel || 'sedentario',
        customActivityFactor: Number.isFinite(fatorAtividadeFinal)
          ? Number((fatorAtividadeFinal).toFixed(3))
          : null,
        manualTmbKcal: Number.isFinite(manualTmbKcal)
          ? Math.round(manualTmbKcal)
          : null,
        esportivo: esportivoPayload,
        observacoes: toTextInput(dados.observacoes) || null
      },
      resultados_calculados: {
        tmbBaseKcal: Number.isFinite(getEvaluation?.base?.tmbUsedKcal)
          ? Math.round(getEvaluation.base.tmbUsedKcal)
          : null,
        fatorAtividade: Number.isFinite(getEvaluation?.activity?.factorApplied)
          ? Number(getEvaluation.activity.factorApplied.toFixed(3))
          : null,
        getEstimadoKcal: Number.isFinite(getEvaluation?.results?.getKcal)
          ? Math.round(getEvaluation.results.getKcal)
          : null,
        manutencaoKcal: Number.isFinite(getEvaluation?.results?.maintenanceKcal)
          ? Math.round(getEvaluation.results.maintenanceKcal)
          : null,
        emagrecimentoLeveKcal: Number.isFinite(getEvaluation?.results?.weightLossLightKcal)
          ? Math.round(getEvaluation.results.weightLossLightKcal)
          : null,
        emagrecimentoModeradoKcal: Number.isFinite(getEvaluation?.results?.weightLossModerateKcal)
          ? Math.round(getEvaluation.results.weightLossModerateKcal)
          : null,
        emagrecimentoIntensoKcal: Number.isFinite(getEvaluation?.results?.weightLossIntenseKcal)
          ? Math.round(getEvaluation.results.weightLossIntenseKcal)
          : null,
        hipertrofiaMinKcal: Number.isFinite(getEvaluation?.results?.hypertrophyMinKcal)
          ? Math.round(getEvaluation.results.hypertrophyMinKcal)
          : null,
        hipertrofiaMaxKcal: Number.isFinite(getEvaluation?.results?.hypertrophyMaxKcal)
          ? Math.round(getEvaluation.results.hypertrophyMaxKcal)
          : null,
        totalGastoSemanalKcal: Number.isFinite(totalGastoSemanalKcal)
          ? Number((totalGastoSemanalKcal).toFixed(2))
          : null,
        palRealCalculado: Number.isFinite(palRealCalculado)
          ? Number((palRealCalculado).toFixed(3))
          : null
      },
      classificacoes: {
        alertaIngestaoIntensa: Boolean(getEvaluation?.safety?.hasIntenseLowIntakeRisk),
        referenciaSeguranca: getEvaluation?.safety?.hasIntenseLowIntakeRisk
          ? `Limite minimo ${Math.round(getEvaluation?.safety?.intenseMinThreshold || 0)} kcal/dia`
          : 'Sem alerta'
      },
      metadados_formula: {
        formulaId: getEvaluation?.base?.formulaId || null,
        formulaVersion: getEvaluation?.base?.formulaVersion || null,
        formulaLabel: getEvaluation?.base?.formulaLabel || null,
        sourceLabel: getEvaluation?.base?.sourceLabel || null,
        formulaGet: getEvaluation?.formulas?.get || 'GET = TMB x fator_atividade'
      },
      comparacao: {
        referencia_comparacao: previous ? 'avaliacao_anterior' : null,
        delta_get_kcal: Number.isFinite(deltaGet.deltaAbs) ? Number(deltaGet.deltaAbs.toFixed(0)) : null,
        delta_get_percentual: Number.isFinite(deltaGet.deltaPct) ? Number(deltaGet.deltaPct.toFixed(2)) : null
      },
      source: {
        mode: 'calculado',
        system: 'gasto_energetico_total'
      },
      observacoes: toTextInput(dados.observacoes) || null
    };
  }, [
    dados.activityLevel,
    dados.dataAvaliacao,
    dados.esportivo,
    dados.observacoes,
    fatorAtividadeFinal,
    getEvaluation,
    manualTmbKcal,
    palRealCalculado,
    previous,
    totalGastoSemanalKcal,
    sex
  ]);

  const payloadResults = useMemo(() => ({
    tmb_kcal: payloadData?.resultados_calculados?.tmbBaseKcal ?? null,
    fator_atividade: payloadData?.resultados_calculados?.fatorAtividade ?? null,
    get_kcal: payloadData?.resultados_calculados?.getEstimadoKcal ?? null,
    calculated: {
      tmbKcal: payloadData?.resultados_calculados?.tmbBaseKcal ?? null,
      fatorAtividade: payloadData?.resultados_calculados?.fatorAtividade ?? null,
      getKcal: payloadData?.resultados_calculados?.getEstimadoKcal ?? null
    },
    output: {
      alertaIngestaoIntensa: payloadData?.classificacoes?.alertaIngestaoIntensa ?? false
    },
    comparacao: payloadData?.comparacao || {}
  }), [payloadData]);

  const hasValues = useMemo(() => (
    toTextInput(dados?.esportivo?.palSubjetivoLegado) !== ''
    || toTextInput(dados.manualTmbKcal) !== ''
    || toTextInput(dados.observacoes) !== ''
    || Number.isFinite(totalGastoSemanalKcal)
    || normalizeObjectArray(dados?.esportivo?.registroAtividadesSemana).some((row) => (
      toTextInput(row?.metId) !== '' || toTextInput(row?.duracaoHoras) !== ''
    ))
    || Number.isFinite(getEvaluation?.results?.getKcal)
  ), [
    dados?.esportivo?.palSubjetivoLegado,
    dados?.esportivo?.registroAtividadesSemana,
    dados.manualTmbKcal,
    dados.observacoes,
    getEvaluation?.results?.getKcal,
    totalGastoSemanalKcal
  ]);

  const recalculateSemana = useCallback(async (rows, nivelCompetitivo) => {
    const runId = ++calcRunRef.current;
    const peso = toNumber(pesoReferenciaKg);
    const nivel = normalizeNivelCompetitivoApi(nivelCompetitivo);

    const nextRows = normalizeObjectArray(rows).map((row) => {
      const metValue = parseNumeric(row?.metValue);
      const duracaoHoras = parseNumeric(row?.duracaoHoras);
      const shouldCalculate = Number.isFinite(metValue)
        && Number.isFinite(duracaoHoras)
        && (metValue) > 0
        && (duracaoHoras) > 0;
      return {
        ...row,
        loadingCalculo: shouldCalculate,
        erroCalculo: ''
      };
    });

    setDados((prev) => ({
      ...prev,
      esportivo: {
        ...(prev.esportivo || createEsportivoData(defaultNivelCompetitivo)),
        registroAtividadesSemana: nextRows
      }
    }));

    const calculatedRows = await Promise.all(nextRows.map(async (row) => {
      const metValue = parseNumeric(row?.metValue);
      const duracaoHoras = parseNumeric(row?.duracaoHoras);
      const shouldCalculate = Number.isFinite(metValue)
        && Number.isFinite(duracaoHoras)
        && (metValue) > 0
        && (duracaoHoras) > 0;

      if (!shouldCalculate) {
        return { ...row, gastoKcal: null, erroCalculo: '', loadingCalculo: false };
      }

      if (!Number.isFinite(peso) || (peso) <= 0) {
        return { ...row, gastoKcal: null, erroCalculo: 'Peso indisponivel para calculo.', loadingCalculo: false };
      }

      try {
        const { data } = await api.post('/mets/calcular', {
          metValue,
          pesoKg: Number(peso),
          duracaoHoras,
          nivelCompetitivo: nivel
        });
        const gastoKcal = toNumber(data?.gastoKcal);
        return {
          ...row,
          gastoKcal: Number.isFinite(gastoKcal) ? Number((gastoKcal).toFixed(2)) : null,
          erroCalculo: '',
          loadingCalculo: false
        };
      } catch {
        return { ...row, gastoKcal: null, erroCalculo: 'Falha ao calcular gasto.', loadingCalculo: false };
      }
    }));

    if (runId !== calcRunRef.current) return;
    setDados((prev) => ({
      ...prev,
      esportivo: {
        ...(prev.esportivo || createEsportivoData(defaultNivelCompetitivo)),
        registroAtividadesSemana: calculatedRows
      }
    }));
  }, [defaultNivelCompetitivo, pesoReferenciaKg]);

  const handleSemanaActivityChange = useCallback(async (dia, metId) => {
    setHasUserInput(true);
    const option = metById.get(String(metId));
    const rows = normalizeObjectArray(dados?.esportivo?.registroAtividadesSemana).map((row) => (
      String(row?.dia) === String(dia)
        ? {
          ...row,
          metId: String(metId || ''),
          atividade: option?.modalidade || '',
          categoria: option?.categoria || '',
          intensidade: option?.intensidade || '',
          metValue: option ? String(option.metValue) : '',
          gastoKcal: null,
          erroCalculo: '',
          loadingCalculo: false
        }
        : row
    ));
    setDados((prev) => ({
      ...prev,
      esportivo: {
        ...(prev.esportivo || createEsportivoData(defaultNivelCompetitivo)),
        registroAtividadesSemana: rows
      }
    }));
    await recalculateSemana(rows, dados?.esportivo?.nivelCompetitivo || defaultNivelCompetitivo);
  }, [dados?.esportivo?.nivelCompetitivo, dados?.esportivo?.registroAtividadesSemana, defaultNivelCompetitivo, metById, recalculateSemana]);

  const handleSemanaDurationChange = useCallback((dia, value) => {
    setHasUserInput(true);
    setDados((prev) => ({
      ...prev,
      esportivo: {
        ...(prev.esportivo || createEsportivoData(defaultNivelCompetitivo)),
        registroAtividadesSemana: normalizeObjectArray(prev?.esportivo?.registroAtividadesSemana).map((row) => (
          String(row?.dia) === String(dia)
            ? { ...row, duracaoHoras: value, gastoKcal: null, erroCalculo: '' }
            : row
        ))
      }
    }));
  }, [defaultNivelCompetitivo]);

  const recalculateCurrentSemana = useCallback(async () => {
    const rows = normalizeObjectArray(dados?.esportivo?.registroAtividadesSemana);
    await recalculateSemana(rows, dados?.esportivo?.nivelCompetitivo || defaultNivelCompetitivo);
  }, [dados?.esportivo?.nivelCompetitivo, dados?.esportivo?.registroAtividadesSemana, defaultNivelCompetitivo, recalculateSemana]);

  const handleNivelCompetitivoChange = useCallback(async (value) => {
    setHasUserInput(true);
    setDados((prev) => ({
      ...prev,
      esportivo: {
        ...(prev.esportivo || createEsportivoData(defaultNivelCompetitivo)),
        nivelCompetitivo: value
      }
    }));
    const rows = normalizeObjectArray(dados?.esportivo?.registroAtividadesSemana);
    await recalculateSemana(rows, value);
  }, [dados?.esportivo?.registroAtividadesSemana, defaultNivelCompetitivo, recalculateSemana]);

  const dispatchSave = useCallback(async (auto = false) => {
    const dispatch = auto ? onAutoSave : onSalvar;
    if (!dispatch) return;

    await dispatch({
      tipo: 'gasto_energetico_total',
      dados: payloadData,
      resultados: payloadResults,
      data: dados.dataAvaliacao,
      pacienteId,
      schemaVersion: 1,
      formulaId: payloadData?.metadados_formula?.formulaId || 'mifflin_st_jeor_1990',
      formulaVersion: payloadData?.metadados_formula?.formulaVersion || '1.0.0',
      sourceSystem: 'calculado',
      measuredAt: normalizeDateValue(dados.dataAvaliacao),
      sessaoId: moduleSnapshot?.sessaoId || currentSessionId
    });
  }, [
    currentSessionId,
    dados.dataAvaliacao,
    moduleSnapshot?.sessaoId,
    onAutoSave,
    onSalvar,
    pacienteId,
    payloadData,
    payloadResults
  ]);

  const executeSave = useCallback(async (auto = false) => {
    setSaveStatus('saving');
    if (saveStatusResetRef.current) clearTimeout(saveStatusResetRef.current);
    try {
      await dispatchSave(auto);
      setSaveStatus('saved');
      saveStatusResetRef.current = setTimeout(() => setSaveStatus(null), 3000);
    } catch (error) {
      setSaveStatus('error');
      if (!auto) {
        setError('Não foi possível salvar a avaliação. Tente novamente.');
      }
    }
  }, [dispatchSave]);

  const handleSubmit = useCallback(async () => {
    if (!onSalvar) return;
    setSubmitAttempted(true);
    setError('');

    if (!hasValues) {
      setError('Preencha ao menos o nível de atividade para calcular o GET.');
      return;
    }

    if (hasRequiredMissing) {
      setError('TMB indisponível. Confira peso, estatura, idade e sexo ou informe a TMB neste instrumento.');
      return;
    }

    if (hasFieldErrors) {
      setError('Existem campos com erro de validacao. Revise os valores destacados.');
      return;
    }

    if (warnings.length > 0) {
      const proceed = await confirm({
        title: 'Alertas nesta avaliação',
        details: warnings,
        confirmLabel: 'Salvar mesmo assim',
        cancelLabel: 'Corrigir',
        variant: 'warning'
      });
      if (!proceed) return;
    }

    await executeSave(false);
  }, [confirm, executeSave, hasFieldErrors, hasRequiredMissing, hasValues, onSalvar, warnings]);

  const semanaRows = normalizeObjectArray(dados?.esportivo?.registroAtividadesSemana);
  const atividadeSemanaCoverage = useMemo(() => {
    const filledRows = semanaRows.filter((row) => (
      toTextInput(row?.metId)
      && Number.isFinite(parseNumeric(row?.duracaoHoras))
      && Number.isFinite(toNumber(row?.gastoKcal))
    )).length;
    if (filledRows >= 5) return { tone: 'ok', label: 'Cobertura robusta', count: filledRows };
    if (filledRows >= 3) return { tone: 'warn', label: 'Cobertura parcial', count: filledRows };
    return { tone: 'risk', label: 'Cobertura insuficiente', count: filledRows };
  }, [semanaRows]);

  const palCoherence = useMemo(() => {
    if (!Number.isFinite(palRealCalculado)) return { tone: 'risk', message: 'PAL real ainda indisponivel.' };
    if (!Number.isFinite(palSubjetivoLegado)) return { tone: 'warn', message: 'PAL subjetivo legado não informado para comparar.' };
    const delta = Math.abs((palRealCalculado) - (palSubjetivoLegado));
    if (delta <= 0.15) return { tone: 'ok', message: `PAL convergente (delta ${formatNumber(delta, 3)}).` };
    if (delta <= 0.3) return { tone: 'warn', message: `PAL com divergencia moderada (delta ${formatNumber(delta, 3)}).` };
    return { tone: 'risk', message: `PAL com divergencia alta (delta ${formatNumber(delta, 3)}).` };
  }, [palRealCalculado, palSubjetivoLegado]);

  const demandaStatus = useMemo(() => {
    if (atividadeSemanaCoverage.tone === 'risk' || palCoherence.tone === 'risk') {
      return {
        tone: 'risk',
        title: 'Confiabilidade baixa da estimativa de demanda',
        message: 'Revise preenchimento semanal e coerencia do PAL antes de usar o GET para conduta.'
      };
    }
    if (atividadeSemanaCoverage.tone === 'warn' || palCoherence.tone === 'warn') {
      return {
        tone: 'warn',
        title: 'Confiabilidade intermediária da estimativa de demanda',
        message: 'Ajuste os pontos de atenção para melhorar a qualidade do GET.'
      };
    }
    return {
      tone: 'ok',
      title: 'Confiabilidade adequada da estimativa de demanda',
      message: 'GET pronto para apoiar decisao nutricional e periodizacao energetica.'
    };
  }, [atividadeSemanaCoverage.tone, palCoherence.tone]);

  const isAnyRowLoading = semanaRows.some((row) => Boolean(row?.loadingCalculo));

  useEffect(() => {
    if (readOnly || !onAutoSave || !hasUserInput) return undefined;
    if (!hasValues || hasFieldErrors || hasRequiredMissing || isAnyRowLoading) return undefined;

    clearTimeout(autoSaveRef.current);
    autoSaveRef.current = setTimeout(() => {
      executeSave(true);
    }, 3500);

    return () => clearTimeout(autoSaveRef.current);
  }, [executeSave, hasFieldErrors, hasRequiredMissing, hasUserInput, hasValues, isAnyRowLoading, onAutoSave, readOnly]);

  return (
    <AvaliacaoModulo
      className={`eval-card get-form get-form--modern${readOnly ? ' eval-card--readonly' : ''}`}
      titulo="Gasto energético total (GET)"
      descricao="TMB estimada com perfil e medidas disponíveis aqui, mais registro semanal com MET para estimar o gasto."
      icone={<Flame size={22} />}
    >
      <AvaliacaoIndice itens={GET_INDICE} />

      <AvisoAvaliacao tipo="info">
        <strong>Contexto esportivo de referencia:</strong>
        {' '}
        {onboardingEsportivo.modalidadePrincipal || 'modalidade não informada'}
        {' | '}
        Frequência: {Number.isFinite(onboardingEsportivo.frequenciaSemanal) ? `${onboardingEsportivo.frequenciaSemanal}x/sem` : 'não informada'}
        {' | '}
        Duração: {Number.isFinite(onboardingEsportivo.duracaoSessao) ? `${onboardingEsportivo.duracaoSessao} min` : 'não informada'}
        {onboardingEsportivo.genero ? ` | Gênero: ${onboardingEsportivo.genero}` : ''}
      </AvisoAvaliacao>

      <AvisoAvaliacao
        tipo={TIPO_AVISO_DEMANDA[demandaStatus.tone] || 'info'}
        titulo={demandaStatus.title}
        className={`get-demand-status get-demand-status--${demandaStatus.tone}`}
      >
        <p>{demandaStatus.message}</p>
        <small>
          Registro semanal: {atividadeSemanaCoverage.label} ({atividadeSemanaCoverage.count}/7 dias)
          {' | '}
          {palCoherence.message}
        </small>
      </AvisoAvaliacao>

      {/* Os campos primeiro; o que o formulário calcula (TMB estimada, peso de
          referência e fator aplicado) fica logo abaixo, como resultado. O
          .eval-field de cada valor calculado continua, no mesmo número. */}
      <AvaliacaoSecao id="get-base" titulo="Base energética" className="eval-section">
        <div className="av-grade">
          <Campo rotulo="Data da avaliação" className="eval-field">
            <input
              type="date"
              className="eval-input"
              value={dados.dataAvaliacao}
              onChange={(event) => updateField(setDados, setHasUserInput, 'dataAvaliacao', event.target.value)}
              disabled={readOnly}
            />
          </Campo>
          <Campo rotulo="Nível de atividade" className="eval-field">
            <select
              className="eval-select"
              value={dados.activityLevel}
              onChange={(event) => updateField(setDados, setHasUserInput, 'activityLevel', event.target.value)}
              disabled={readOnly}
            >
              {ACTIVITY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </Campo>
          {/* Mesma mensagem de antes, depois de tentar salvar: o erro no
              lugar do erro; o aviso de faixa como ajuda, no tom de atenção. */}
          <Campo
            rotulo={<>TMB informada neste instrumento <span className="get-optional-badge">Opcional</span></>}
            className="eval-field"
            erro={submitAttempted && manualTmbValidation.status === 'error' ? manualTmbValidation.message : null}
            ajuda={submitAttempted && manualTmbValidation.status === 'warning' ? manualTmbValidation.message : null}
            tom={submitAttempted && manualTmbValidation.status === 'warning' ? 'atencao' : undefined}
          >
            <input
              type="text"
              inputMode="decimal"
              className={`eval-input ${submitAttempted && manualTmbValidation.status === 'error' ? 'get-input-invalid' : ''} ${submitAttempted && manualTmbValidation.status === 'warning' ? 'get-input-warning' : ''}`}
              value={dados.manualTmbKcal}
              onChange={(event) => updateField(setDados, setHasUserInput, 'manualTmbKcal', event.target.value)}
              disabled={readOnly}
              placeholder="Ex.: 1640"
            />
          </Campo>
          <Campo
            rotulo={<>PAL subjetivo (legado) <span className="get-optional-badge">Opcional</span></>}
            className="eval-field"
            erro={submitAttempted && palLegadoValidation.status === 'error' ? palLegadoValidation.message : null}
            ajuda={submitAttempted && palLegadoValidation.status === 'warning' ? palLegadoValidation.message : null}
            tom={submitAttempted && palLegadoValidation.status === 'warning' ? 'atencao' : undefined}
          >
            <input
              type="text"
              inputMode="decimal"
              className={`eval-input ${submitAttempted && palLegadoValidation.status === 'error' ? 'get-input-invalid' : ''} ${submitAttempted && palLegadoValidation.status === 'warning' ? 'get-input-warning' : ''}`}
              value={dados?.esportivo?.palSubjetivoLegado || ''}
              onChange={(event) => updateEsportivoField(setDados, setHasUserInput, 'palSubjetivoLegado', event.target.value, defaultNivelCompetitivo)}
              disabled={readOnly}
              placeholder="Opcional (legado)"
            />
          </Campo>
        </div>

        {/* formatMetric com as mesmas chaves de antes (casas iguais); a unidade
            sai do número e vai para a caixa da unidade. Sem valor, "—". */}
        <div className="av-resultados">
          <div className="eval-field">
            <ResultadoCalculado
              rotulo="TMB estimada pelo perfil"
              valor={Number.isFinite(getEvaluation?.base?.tmbEstimatedKcal) ? formatMetric(getEvaluation.base.tmbEstimatedKcal, '', 'kcal') : null}
              unidade="kcal"
            />
          </div>
          <div className="eval-field">
            <ResultadoCalculado
              rotulo="Peso referencia para MET"
              valor={Number.isFinite(pesoReferenciaKg) ? formatMetric(pesoReferenciaKg, '', 'peso') : null}
              unidade="kg"
            />
          </div>
          <div className="eval-field">
            <ResultadoCalculado
              rotulo="Fator aplicado"
              valor={Number.isFinite(getEvaluation?.activity?.factorApplied) ? formatMetric(getEvaluation.activity.factorApplied, '', 'factor') : null}
            />
          </div>
        </div>
      </AvaliacaoSecao>

      <AvaliacaoSecao id="get-semana" titulo="Registro de atividades da semana" className="eval-section">
        <div className="av-grade get-week-controls">
          <Campo rotulo="Nível competitivo" className="eval-field">
            <select
              className="eval-select"
              value={dados?.esportivo?.nivelCompetitivo || defaultNivelCompetitivo}
              onChange={(event) => handleNivelCompetitivoChange(event.target.value)}
              disabled={readOnly}
            >
              {NIVEL_COMPETITIVO_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </Campo>
          <div className="eval-field">
            <ResultadoCalculado
              rotulo="Catálogo MET"
              valor={metLoading ? 'Carregando...' : `${metOptions.length} atividades`}
              valorEmTexto
            />
          </div>
          <div className="eval-field get-week-action-cell">
            <Button type="button" variant="secondary" disabled={readOnly || isAnyRowLoading} onClick={recalculateCurrentSemana}>
              <RefreshCw size={14} /> Recalcular semana
            </Button>
          </div>
        </div>

        {metError ? <AvisoAvaliacao tipo="perigo" className="get-error-note">{metError}</AvisoAvaliacao> : null}

        {/* Tabela semântica: o dia é cabeçalho de linha, e cada controle tem
            rótulo oculto "dia, coluna" com os textos da própria tabela. Em
            tela estreita a tabela rola no invólucro, que recebe foco pelo
            teclado e o nome da seção. */}
        <div
          className="get-table-wrap get-week-table-wrap"
          role="region"
          aria-labelledby={idTituloSecao('get-semana')}
          tabIndex={0}
        >
          <table className="get-table get-week-table" aria-labelledby={idTituloSecao('get-semana')}>
            <thead>
              <tr>
                <th scope="col">Dia</th>
                <th scope="col">Atividade</th>
                <th scope="col">MET</th>
                <th scope="col">Duração (h)</th>
                <th scope="col">Gasto sessao (kcal)</th>
              </tr>
            </thead>
            <tbody>
              {DIAS_SEMANA.map((dia) => {
                const row = semanaRows.find((item) => String(item?.dia) === dia.key) || createSemanaRow(dia.key);
                return (
                  <tr key={dia.key}>
                    <th scope="row">{dia.label}</th>
                    <td>
                      <Campo rotulo={`${dia.label}, Atividade`} rotuloOculto>
                        <select
                          className="eval-select"
                          value={row.metId || ''}
                          onChange={(event) => handleSemanaActivityChange(dia.key, event.target.value)}
                          disabled={readOnly || metLoading}
                        >
                          <option value="">{metLoading ? 'Carregando METs...' : 'Selecione'}</option>
                          {metOptions.map((option) => (
                            <option key={option.id} value={option.id}>{formatMetOptionLabel(option)}</option>
                          ))}
                        </select>
                      </Campo>
                    </td>
                    <td>{formatMetric(parseNumeric(row.metValue), '', 'factor')}</td>
                    <td>
                      <Campo rotulo={`${dia.label}, Duração (h)`} rotuloOculto>
                        <input
                          type="text"
                          inputMode="decimal"
                          className="eval-input"
                          value={row.duracaoHoras || ''}
                          onChange={(event) => handleSemanaDurationChange(dia.key, event.target.value)}
                          onBlur={recalculateCurrentSemana}
                          disabled={readOnly}
                          placeholder="0.0"
                        />
                      </Campo>
                    </td>
                    <td>
                      {row.loadingCalculo ? 'Calculando...' : formatMetric(toNumber(row.gastoKcal), 'kcal', 'kcal')}
                      {row.erroCalculo ? <small className="get-field-message is-warning">{row.erroCalculo}</small> : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* O total e o PAL real vêm do cálculo, com as mesmas casas. Sem
            atividade com duração, os dois ficam "—" (nulos também no dado
            salvo) e o fator aplicado é o do nível de atividade. */}
        <div className="av-resultados">
          <ResultadoCalculado
            rotulo="Total semanal"
            valor={Number.isFinite(totalGastoSemanalKcal) ? formatMetric(totalGastoSemanalKcal, '', 'kcal') : null}
            unidade="kcal"
          />
          <ResultadoCalculado
            rotulo="PAL real calculado"
            valor={Number.isFinite(palRealCalculado) ? formatMetric(palRealCalculado, '', 'factor') : null}
          />
        </div>
      </AvaliacaoSecao>

      {/* O título vinha do ::after de .eval-results-section em avaliacoes.css;
          agora é o título da seção. O alerta de segurança subiu para logo
          depois dos cartões, perto do "Emagrecimento intenso". */}
      <AvaliacaoSecao id="get-resultados" titulo="Resultados calculados">
        <div className="av-resultados">
          <ResultCard
            label="TMB utilizada"
            value={getEvaluation?.base?.tmbUsedKcal}
            unit="kcal"
            badge={getEvaluation?.base?.formulaLabel || 'Sem fórmula'}
            tone="info"
          />
          <ResultCard
            label="GET estimado"
            value={getEvaluation?.results?.getKcal}
            unit="kcal"
            badge={Number.isFinite(palRealCalculado) ? 'PAL real semanal' : (getEvaluation?.activity?.label || 'Fator atividade')}
            tone="success"
            delta={buildComparativeDeltas({
              current: getEvaluation?.results?.getKcal,
              reference: previous?.metrics?.get
            })}
          />
          <ResultCard
            label="Emagrecimento moderado"
            value={getEvaluation?.results?.weightLossModerateKcal}
            unit="kcal"
            badge="GET - 500"
            tone="warning"
          />
          <ResultCard
            label="Emagrecimento intenso"
            value={getEvaluation?.results?.weightLossIntenseKcal}
            unit="kcal"
            badge={getEvaluation?.safety?.hasIntenseLowIntakeRisk ? 'Abaixo do minimo' : 'GET - 750'}
            tone={getEvaluation?.safety?.hasIntenseLowIntakeRisk ? 'danger' : 'warning'}
          />
          <RangeCard
            label="Hipertrofia"
            minValue={getEvaluation?.results?.hypertrophyMinKcal}
            maxValue={getEvaluation?.results?.hypertrophyMaxKcal}
            unit="kcal"
            badge="GET + 300 a 500"
          />
          <ResultCard
            label="Manutenção"
            value={getEvaluation?.results?.maintenanceKcal}
            unit="kcal"
            badge="GET"
            tone="neutral"
          />
        </div>

        {/* O texto já começa com "Alerta de segurança:"; o prefixo lido
            repetiria a palavra. */}
        {getEvaluation?.safety?.hasIntenseLowIntakeRisk && (
          <AvisoAvaliacao tipo="perigo" rotuloTipo="">
            Alerta de segurança: ingestão de emagrecimento intenso abaixo de {Math.round(getEvaluation?.safety?.intenseMinThreshold || 0)} kcal/dia.
          </AvisoAvaliacao>
        )}

        <div className="get-meta-box">
          <p><strong>Formula usada:</strong> {getEvaluation?.base?.formulaLabel || '--'}</p>
          <p><strong>formulaId:</strong> {getEvaluation?.base?.formulaId || '--'} | <strong>versao:</strong> {getEvaluation?.base?.formulaVersion || '--'}</p>
          {getEvaluation?.base?.sourceLabel ? <p><strong>Base do cálculo:</strong> {getEvaluation.base.sourceLabel}</p> : null}
        </div>
      </AvaliacaoSecao>

      {/* Tabela e tendência estavam no pé dos resultados, sem título. */}
      <AvaliacaoSecao id="get-comparacao" titulo="Comparação longitudinal">
        <div
          className="get-table-wrap"
          role="region"
          aria-labelledby={idTituloSecao('get-comparacao')}
          tabIndex={0}
        >
          <table className="get-table" aria-labelledby={idTituloSecao('get-comparacao')}>
            <thead>
              <tr>
                <th scope="col">Indicador</th>
                <th scope="col">Atual</th>
                <th scope="col">Anterior</th>
                <th scope="col">Primeira</th>
                <th scope="col">Delta abs.</th>
                <th scope="col">Delta %</th>
              </tr>
            </thead>
            <tbody>
              {comparisonRows.map((row) => (
                <tr key={row.key}>
                  <th scope="row">{row.label}</th>
                  <td>{formatMetric(row.current, row.unit, row.key)}</td>
                  <td>{formatMetric(row.previous, row.unit, row.key)}</td>
                  <td>{formatMetric(row.first, row.unit, row.key)}</td>
                  <td className={resolveDeltaClass(row.delta.deltaAbs)}>{formatSigned(row.delta.deltaAbs, row.unit, row.key)}</td>
                  <td className={resolveDeltaClass(row.delta.deltaPct)}>{formatSigned(row.delta.deltaPct, '%', 'percent')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <Tendencia
          rotulo="GET (últimos 6)"
          valores={sparklineGet}
          largura={250}
          altura={80}
          unidade="kcal"
          casas={0}
        />
      </AvaliacaoSecao>

      <AvaliacaoSecao id="get-observacoes" titulo="Observações" className="eval-section">
        {/* O rótulo é o próprio título da seção, que já dizia "Observações". */}
        <Campo rotulo="Observações" rotuloOculto>
          <textarea
            className="eval-textarea"
            value={dados.observacoes}
            onChange={(event) => updateField(setDados, setHasUserInput, 'observacoes', event.target.value)}
            disabled={readOnly}
            placeholder="Contexto clinico, adesao e ajustes sugeridos."
          />
        </Campo>
      </AvaliacaoSecao>

      {/* "Salvando...", "Salvo" e "Erro ao salvar" são os textos padrão da barra. */}
      <BarraAcoesAvaliacao status={saveStatus}>
        <Button type="button" variant="primary" disabled={readOnly || isAnyRowLoading} onClick={handleSubmit} loading={saveStatus === 'saving'}>
          Salvar GET
        </Button>
      </BarraAcoesAvaliacao>

      {error && <AvisoAvaliacao tipo="perigo" anunciar className="get-error-note">{error}</AvisoAvaliacao>}
    </AvaliacaoModulo>
  );
};

export default GastoEnergeticoTotalForm;

// Mesma assinatura de antes; por dentro, ResultadoCalculado. O valor usa
// formatMetric com a mesma chave (o rótulo), então as casas não mudam, e a
// unidade vai para a caixa da unidade. Sem valor, "—" no lugar de "--".
// O selo antigo (fórmula, "GET - 500"...) diz como o valor foi obtido e vai
// como texto de método. Só "Abaixo do minimo" é classificação: um limite de
// segurança, escrito e no tom de perigo. As outras cores eram enfeite.
// A variação vem escrita com o sinal, como antes; um GET maior não é melhor
// nem pior por si, então ela fica neutra.
const ResultCard = ({ label, value, unit, badge, tone = 'neutral', delta = null }) => {
  const alerta = tone === 'danger';
  return (
    <ResultadoCalculado
      rotulo={label}
      valor={Number.isFinite(value) ? formatMetric(value, '', label) : null}
      unidade={unit || undefined}
      classificacao={alerta ? badge : null}
      tom={alerta ? 'perigo' : undefined}
      metodo={alerta ? null : badge}
      variacao={delta && Number.isFinite(delta.deltaAbs) ? formatSigned(delta.deltaAbs, unit, label) : undefined}
    />
  );
};

// A faixa leva a unidade uma vez só, na caixa da unidade.
const RangeCard = ({ label, minValue, maxValue, unit, badge }) => (
  <ResultadoCalculado
    rotulo={label}
    valor={Number.isFinite(minValue) && Number.isFinite(maxValue)
      ? `${formatMetric(minValue, '', 'range')} a ${formatMetric(maxValue, '', 'range')}`
      : null}
    unidade={unit || undefined}
    metodo={badge}
  />
);

function updateField(setDados, setHasUserInput, key, value) {
  setHasUserInput(true);
  setDados((prev) => ({ ...prev, [key]: value }));
}

function updateEsportivoField(setDados, setHasUserInput, key, value, defaultNivelCompetitivo = 'amador') {
  setHasUserInput(true);
  setDados((prev) => ({
    ...prev,
    esportivo: {
      ...(prev?.esportivo || createEsportivoData(defaultNivelCompetitivo)),
      [key]: value
    }
  }));
}

function parseNumeric(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = Number(String(value).replace(',', '.').trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function toNumber(value) {
  const numeric = parseNumeric(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function toInputValue(value, digits = null) {
  const numeric = parseNumeric(value);
  if (!Number.isFinite(numeric)) return '';
  if (!Number.isFinite(digits)) return String(numeric);
  return Number(numeric).toFixed(digits);
}

function toTextInput(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function normalizeObjectArray(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => item && typeof item === 'object');
}

function firstDefined(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return null;
}

function asRecord(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value;
}

function normalizeDateValue(value) {
  if (!value) return toLocalDateInputValue(new Date());
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) return value.trim();
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return toLocalDateInputValue(new Date());
  return toLocalDateInputValue(parsed);
}

function normalizeSexToken(value) {
  const token = toTextInput(value).toLowerCase();
  if (!token) return null;
  if (token.includes('fem') || token === 'f' || token === 'female') return 'female';
  if (token.includes('masc') || token === 'm' || token === 'male') return 'male';
  return null;
}

function formatNumber(value, digits = 1) {
  if (!Number.isFinite(value)) return '--';
  return Number(value).toLocaleString('pt-BR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  });
}

function formatMetric(value, unit = '', key = '') {
  if (!Number.isFinite(value)) return '--';
  const token = String(key || '').toLowerCase();
  const digits = token.includes('factor')
    ? 3
    : token.includes('kcal')
      ? 0
      : 2;
  return `${formatNumber(value, digits)}${unit ? ` ${unit}` : ''}`;
}

function formatSigned(value, unit = '', key = '') {
  if (!Number.isFinite(value)) return '--';
  const token = String(key || '').toLowerCase();
  const digits = token.includes('percent')
    ? 2
    : token.includes('kcal')
      ? 0
      : 2;
  const sign = value > 0 ? '+' : '';
  return `${sign}${formatNumber(value, digits)}${unit ? ` ${unit}` : ''}`;
}

function resolveDeltaClass(value) {
  if (!Number.isFinite(value)) return 'is-flat';
  if (value > 0) return 'is-up';
  if (value < 0) return 'is-down';
  return 'is-flat';
}

function createComparisonRow(key, label, unit, current, previous, first) {
  return {
    key,
    label,
    unit,
    current: Number.isFinite(current) ? current : null,
    previous: Number.isFinite(previous) ? previous : null,
    first: Number.isFinite(first) ? first : null,
    delta: buildComparativeDeltas({ current, reference: previous })
  };
}

function normalizeGetHistory(records = []) {
  if (!Array.isArray(records)) return [];
  return records
    .map((record) => {
      const dados = record?.dados || {};
      const calculated = dados?.resultados_calculados || {};
      const timestamp = resolveDate(record?.updatedAt || record?.createdAt || record?.data)?.getTime() || 0;
      return {
        id: record?.id || '',
        timestamp,
        metrics: {
          tmb: parseNumeric(firstDefined(
            calculated?.tmbBaseKcal,
            dados?.tmb_base_kcal,
            record?.resultados?.tmb_kcal
          )),
          factor: parseNumeric(firstDefined(
            calculated?.fatorAtividade,
            dados?.fator_atividade
          )),
          get: parseNumeric(firstDefined(
            calculated?.getEstimadoKcal,
            dados?.get_estimado_kcal,
            record?.resultados?.get_kcal
          ))
        }
      };
    })
    .filter((item) => Number.isFinite(item.metrics.tmb) || Number.isFinite(item.metrics.get))
    .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
}

function resolveDate(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value?.toDate === 'function') {
    const converted = value.toDate();
    return Number.isNaN(converted?.getTime?.()) ? null : converted;
  }
  if (typeof value?.seconds === 'number') {
    const converted = new Date(value.seconds * 1000);
    return Number.isNaN(converted.getTime()) ? null : converted;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalizeMetCatalog(payload) {
  if (!Array.isArray(payload)) return [];
  return payload
    .map((item) => {
      const row = asRecord(item);
      const id = toTextInput(row.id);
      const modalidade = toTextInput(row.modalidade);
      const categoria = toTextInput(row.categoria);
      const intensidade = toTextInput(row.intensidade);
      const metValue = parseNumeric(row.metValue);
      if (!id || !modalidade || !categoria || !intensidade || !Number.isFinite(metValue)) return null;
      return {
        id,
        modalidade,
        categoria,
        intensidade,
        metValue: Number((metValue).toFixed(1))
      };
    })
    .filter(Boolean)
    .sort((a, b) => formatMetOptionLabel(a).localeCompare(formatMetOptionLabel(b)));
}

function normalizeNivelCompetitivoApi(value) {
  const token = toTextInput(value).toLowerCase();
  if (!token) return 'amador';
  if (token === 'federado') return 'semi-pro';
  return token;
}

function resolvePesoReferenciaKg({ baselineAnthropometry, allEvaluationHistory }) {
  const baseline = parseNumeric(baselineAnthropometry?.pesoKg);
  if (Number.isFinite(baseline)) return Number((baseline).toFixed(2));

  const ordered = Array.isArray(allEvaluationHistory)
    ? [...allEvaluationHistory].sort((a, b) => {
      const timeA = resolveDate(a?.updatedAt || a?.createdAt || a?.data)?.getTime() || 0;
      const timeB = resolveDate(b?.updatedAt || b?.createdAt || b?.data)?.getTime() || 0;
      return timeB - timeA;
    })
    : [];

  for (const item of ordered) {
    const dados = asRecord(item?.dados);
    const dadosBrutos = asRecord(firstDefined(dados?.dados_brutos, dados?.input));
    const weight = parseNumeric(firstDefined(
      dadosBrutos?.pesoKg,
      dadosBrutos?.peso_kg,
      dadosBrutos?.peso,
      dados?.peso,
      dados?.peso_kg,
      item?.resultados?.peso
    ));
    if (Number.isFinite(weight)) return Number((weight).toFixed(2));
  }

  return null;
}

function normalizeDayKey(value) {
  const token = toTextInput(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if (!token) return '';
  if (token.startsWith('seg')) return 'segunda';
  if (token.startsWith('ter')) return 'terca';
  if (token.startsWith('qua')) return 'quarta';
  if (token.startsWith('qui')) return 'quinta';
  if (token.startsWith('sex')) return 'sexta';
  if (token.startsWith('sab')) return 'sabado';
  if (token.startsWith('dom')) return 'domingo';
  return '';
}

function mergeSemanaRows(defaultRows, snapshotRows) {
  const byDia = new Map();
  normalizeObjectArray(snapshotRows).forEach((item) => {
    const row = asRecord(item);
    const dia = normalizeDayKey(row.dia || row.day);
    if (!dia) return;
    byDia.set(dia, {
      dia,
      metId: toTextInput(row.metId || row.met_id),
      atividade: toTextInput(row.atividade),
      categoria: toTextInput(row.categoria),
      intensidade: toTextInput(row.intensidade),
      metValue: toInputValue(firstDefined(row.metValue, row.met_value), 1),
      duracaoHoras: toInputValue(firstDefined(row.duracaoHoras, row.duracao_horas), 2),
      gastoKcal: toNumber(firstDefined(row.gastoKcal, row.gasto_kcal)),
      erroCalculo: '',
      loadingCalculo: false
    });
  });

  return defaultRows.map((row) => byDia.get(row.dia) || row);
}

function formatMetOptionLabel(option) {
  return `${capitalize(option.modalidade)} | ${capitalize(option.categoria)} | ${capitalize(option.intensidade)} | MET ${formatNumber(option.metValue, 1)}`;
}

function capitalize(value) {
  const token = toTextInput(value);
  if (!token) return '';
  return token.charAt(0).toUpperCase() + token.slice(1);
}

function buildGetEsportivoPayload({ esportivo, totalGastoSemanalKcal, palRealCalculado }) {
  const source = asRecord(esportivo);
  const rows = normalizeObjectArray(source.registroAtividadesSemana).map((row) => ({
    dia: normalizeDayKey(row.dia || row.day),
    metId: toTextInput(row.metId || row.met_id) || null,
    atividade: toTextInput(row.atividade) || null,
    categoria: toTextInput(row.categoria) || null,
    intensidade: toTextInput(row.intensidade) || null,
    metValue: Number.isFinite(parseNumeric(firstDefined(row.metValue, row.met_value)))
      ? Number(Number(firstDefined(row.metValue, row.met_value)).toFixed(1))
      : null,
    duracaoHoras: Number.isFinite(parseNumeric(firstDefined(row.duracaoHoras, row.duracao_horas)))
      ? Number(Number(firstDefined(row.duracaoHoras, row.duracao_horas)).toFixed(2))
      : null,
    gastoKcal: Number.isFinite(parseNumeric(firstDefined(row.gastoKcal, row.gasto_kcal)))
      ? Number(Number(firstDefined(row.gastoKcal, row.gasto_kcal)).toFixed(2))
      : null
  })).filter((row) => row.dia);

  return {
    palSubjetivoLegado: Number.isFinite(parseNumeric(source.palSubjetivoLegado))
      ? Number(Number(source.palSubjetivoLegado).toFixed(3))
      : null,
    nivelCompetitivo: toTextInput(source.nivelCompetitivo) || 'amador',
    registroAtividadesSemana: rows,
    totalGastoSemanalKcal: Number.isFinite(totalGastoSemanalKcal)
      ? Number((totalGastoSemanalKcal).toFixed(2))
      : null,
    palRealCalculado: Number.isFinite(palRealCalculado)
      ? Number((palRealCalculado).toFixed(3))
      : null
  };
}


