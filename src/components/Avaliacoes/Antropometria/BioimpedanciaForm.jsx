import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Scale } from 'lucide-react';
import MiniSparkline from '../../shared/MiniSparkline';
import { Button } from '../../ui';
import { toLocalDateInputValue } from '../../../utils/dateUtils';
import {
  buildComparativeDeltas,
  calculateBiaEvaluation,
  validatePhysiologicalRange
} from '../../../services/calculationEngine';
import '../avaliacoes.css';
import './BioimpedanciaForm.css';

const BIA_TYPE_OPTIONS = [
  { value: 'tetrapolar_segmentar', label: 'Tetrapolar segmentar' },
  { value: 'tetrapolar_convencional', label: 'Tetrapolar convencional' },
  { value: 'bipolar', label: 'Bipolar' }
];

const createInitialData = () => ({
  dataAvaliacao: toLocalDateInputValue(new Date()),
  equipamento: '',
  biaType: 'tetrapolar_segmentar',
  entryMode: 'manual',
  importText: '',
  fastingHours: '',
  hydrationStatus: 'nao_informado',
  hadPhysicalActivity24h: 'nao_informado',
  menstrualPhase: 'nao_informado',
  resistanceOhm: '',
  reactanceOhm: '',
  phaseAngle: '',
  percentFat: '',
  fatMassKg: '',
  leanMassKg: '',
  tbwL: '',
  icwL: '',
  ecwL: '',
  deviceTmbKcal: '',
  weightKg: '',
  heightCm: '',
  ageYears: '',
  sex: '',
  observacoes: ''
});

const BioimpedanciaForm = ({
  pacienteId,
  onSalvar,
  onAutoSave,
  patient,
  baselineAnthropometry,
  moduleSnapshot,
  currentSessionId,
  moduleHistory = [],
  allEvaluationHistory = [],
  lockSharedAnthropometry = false,
  readOnly = false
}) => {
  const [dados, setDados] = useState(createInitialData);
  const [error, setError] = useState('');
  const [saveStatus, setSaveStatus] = useState(null);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [touched, setTouched] = useState({});
  const [hasUserInput, setHasUserInput] = useState(false);

  const autoSaveRef = useRef(null);
  const saveStatusResetRef = useRef(null);
  const loadedSnapshotIdRef = useRef('');

  useEffect(() => {
    setHasUserInput(false);
    setSubmitAttempted(false);
    setTouched({});
    setError('');
    setSaveStatus(null);
    if (saveStatusResetRef.current) clearTimeout(saveStatusResetRef.current);
  }, [pacienteId]);

  useEffect(() => {
    if (!patient && !baselineAnthropometry) return;

    const baselineWeight = toInputValue(firstDefined(
      baselineAnthropometry?.pesoKg,
      parseNumeric(patient?.peso || patient?.weight)
    ), 1);
    const baselineHeight = toInputValue(firstDefined(
      baselineAnthropometry?.estaturaCm,
      normalizeHeightCm(patient?.altura || patient?.estatura || patient?.height)
    ), 1);
    const baselineAge = toInputValue(firstDefined(
      baselineAnthropometry?.idade,
      patient?.idade,
      calculateAge(patient?.dataNascimento)
    ), 0);
    const baselineSex = normalizeSexLabel(firstDefined(
      baselineAnthropometry?.sexo,
      patient?.sexo,
      patient?.genero
    ));

    setDados((prev) => ({
      ...prev,
      weightKg: lockSharedAnthropometry ? baselineWeight : (prev.weightKg || baselineWeight),
      heightCm: lockSharedAnthropometry ? baselineHeight : (prev.heightCm || baselineHeight),
      ageYears: lockSharedAnthropometry ? baselineAge : (prev.ageYears || baselineAge),
      sex: lockSharedAnthropometry ? baselineSex : (prev.sex || baselineSex)
    }));
  }, [
    baselineAnthropometry,
    lockSharedAnthropometry,
    patient,
    patient?.altura,
    patient?.dataNascimento,
    patient?.estatura,
    patient?.genero,
    patient?.height,
    patient?.idade,
    patient?.peso,
    patient?.sexo,
    patient?.weight
  ]);

  useEffect(() => {
    const snapshotId = moduleSnapshot?.id || '';
    if (!snapshotId || loadedSnapshotIdRef.current === snapshotId) return;

    const source = moduleSnapshot?.dados || {};
    const dadosBrutos = source?.dados_brutos || source?.input || source;

    setDados((prev) => ({
      ...prev,
      dataAvaliacao: normalizeDateValue(moduleSnapshot?.data || source?.dataAvaliacao || dadosBrutos?.dataAvaliacao || prev.dataAvaliacao),
      equipamento: toTextInput(firstDefined(dadosBrutos?.equipamento, source?.equipamento)),
      biaType: toTextInput(firstDefined(dadosBrutos?.biaType, dadosBrutos?.tipo_bia, source?.biaType, 'tetrapolar_segmentar')) || 'tetrapolar_segmentar',
      entryMode: toTextInput(firstDefined(dadosBrutos?.entryMode, dadosBrutos?.modoInsercao, source?.entryMode, 'manual')) || 'manual',
      importText: toTextInput(firstDefined(dadosBrutos?.importText, source?.importText)),
      fastingHours: toInputValue(firstDefined(dadosBrutos?.fastingHours, dadosBrutos?.jejum_horas, source?.fastingHours)),
      hydrationStatus: toTextInput(firstDefined(dadosBrutos?.hydrationStatus, source?.hydrationStatus, 'nao_informado')) || 'nao_informado',
      hadPhysicalActivity24h: normalizeYesNo(firstDefined(dadosBrutos?.hadPhysicalActivity24h, source?.hadPhysicalActivity24h, 'nao_informado')),
      menstrualPhase: toTextInput(firstDefined(dadosBrutos?.menstrualPhase, source?.menstrualPhase, 'nao_informado')) || 'nao_informado',
      resistanceOhm: toInputValue(firstDefined(dadosBrutos?.resistanceOhm, source?.bioresistencia, source?.resistanceOhm), 0),
      reactanceOhm: toInputValue(firstDefined(dadosBrutos?.reactanceOhm, source?.reatancia, source?.reactanceOhm), 0),
      phaseAngle: toInputValue(firstDefined(dadosBrutos?.phaseAngle, source?.phaseAngle), 2),
      percentFat: toInputValue(firstDefined(dadosBrutos?.percentFat, source?.percentual_gordura, source?.percentualGordura), 2),
      fatMassKg: toInputValue(firstDefined(dadosBrutos?.fatMassKg, source?.massa_gorda, source?.peso_gordura, source?.massaGorda), 2),
      leanMassKg: toInputValue(firstDefined(dadosBrutos?.leanMassKg, source?.massa_magra, source?.massaMagra), 2),
      tbwL: toInputValue(firstDefined(dadosBrutos?.tbwL, source?.agua_total, source?.aguaTotal), 2),
      icwL: toInputValue(firstDefined(dadosBrutos?.icwL, source?.icwL, source?.agua_intracelular), 2),
      ecwL: toInputValue(firstDefined(dadosBrutos?.ecwL, source?.ecwL, source?.agua_extracelular), 2),
      deviceTmbKcal: toInputValue(firstDefined(dadosBrutos?.deviceTmbKcal, source?.taxa_metabolica_basal, source?.taxaMetabolicaBasal, source?.tmb), 0),
      weightKg: toInputValue(firstDefined(dadosBrutos?.weightKg, dadosBrutos?.pesoKg, source?.peso, source?.weight), 1),
      heightCm: toInputValue(firstDefined(dadosBrutos?.heightCm, dadosBrutos?.estaturaCm, source?.estatura_cm, source?.estatura), 1),
      ageYears: toInputValue(firstDefined(dadosBrutos?.ageYears, source?.idade), 0),
      sex: normalizeSexLabel(firstDefined(dadosBrutos?.sex, source?.sexo, source?.genero)),
      observacoes: toTextInput(firstDefined(dadosBrutos?.observacoes, source?.observacoes))
    }));

    loadedSnapshotIdRef.current = snapshotId;
  }, [moduleSnapshot]);

  const sexToken = useMemo(() => normalizeSexToken(dados.sex), [dados.sex]);
  const weightKg = useMemo(() => parseNumeric(dados.weightKg), [dados.weightKg]);
  const heightCm = useMemo(() => normalizeHeightCm(dados.heightCm), [dados.heightCm]);
  const ageYears = useMemo(() => parseNumeric(dados.ageYears), [dados.ageYears]);

  const evaluation = useMemo(() => calculateBiaEvaluation({
    entryMode: dados.entryMode,
    biaType: dados.biaType,
    sex: sexToken,
    ageYears,
    weightKg,
    heightCm,
    resistanceOhm: parseNumeric(dados.resistanceOhm),
    reactanceOhm: parseNumeric(dados.reactanceOhm),
    phaseAngle: parseNumeric(dados.phaseAngle),
    percentFat: parseNumeric(dados.percentFat),
    fatMassKg: parseNumeric(dados.fatMassKg),
    leanMassKg: parseNumeric(dados.leanMassKg),
    tbwL: parseNumeric(dados.tbwL),
    icwL: parseNumeric(dados.icwL),
    ecwL: parseNumeric(dados.ecwL),
    deviceTmbKcal: parseNumeric(dados.deviceTmbKcal),
    fastingHours: parseNumeric(dados.fastingHours),
    hydrationStatus: dados.hydrationStatus,
    hadPhysicalActivity24h: dados.hadPhysicalActivity24h,
    menstrualPhase: dados.menstrualPhase
  }), [
    ageYears,
    dados.biaType,
    dados.deviceTmbKcal,
    dados.ecwL,
    dados.entryMode,
    dados.fastingHours,
    dados.fatMassKg,
    dados.hadPhysicalActivity24h,
    dados.hydrationStatus,
    dados.icwL,
    dados.leanMassKg,
    dados.menstrualPhase,
    dados.percentFat,
    dados.phaseAngle,
    dados.reactanceOhm,
    dados.resistanceOhm,
    dados.tbwL,
    heightCm,
    sexToken,
    weightKg
  ]);

  const fieldValidation = useMemo(() => ({
    weightKg: validateNumberField(dados.weightKg, 'peso_kg', true),
    heightCm: validateNumberField(dados.heightCm, 'estatura_cm', true),
    percentFat: validateNumberField(dados.percentFat, 'percentual_gordura', false)
  }), [dados.heightCm, dados.percentFat, dados.weightKg]);

  const hasRequiredErrors = useMemo(
    () => fieldValidation.weightKg.status === 'error' || fieldValidation.heightCm.status === 'error',
    [fieldValidation.heightCm.status, fieldValidation.weightKg.status]
  );

  const history = useMemo(() => normalizeBiaHistory(moduleHistory), [moduleHistory]);
  const currentSnapshotId = moduleSnapshot?.id || '';
  const refHistory = useMemo(
    () => history.filter((item) => !currentSnapshotId || item.id !== currentSnapshotId).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)),
    [currentSnapshotId, history]
  );
  const previous = refHistory[0] || null;
  const first = refHistory.length ? refHistory[refHistory.length - 1] : null;

  const comparisonRows = useMemo(() => {
    const currentMetrics = {
      percentFat: evaluation?.inputNormalized?.percentFat,
      leanMass: evaluation?.inputNormalized?.leanMassKg,
      ffmi: evaluation?.derived?.ffmi,
      phase: evaluation?.inputNormalized?.phaseAngle
    };
    const previousMetrics = previous?.metrics || {};
    const firstMetrics = first?.metrics || {};

    return [
      createComparisonRow('percentFat', '% Gordura', '%', currentMetrics.percentFat, previousMetrics.percentFat, firstMetrics.percentFat),
      createComparisonRow('leanMass', 'Massa magra', 'kg', currentMetrics.leanMass, previousMetrics.leanMass, firstMetrics.leanMass),
      createComparisonRow('ffmi', 'IMLG', '', currentMetrics.ffmi, previousMetrics.ffmi, firstMetrics.ffmi),
      createComparisonRow('phase', 'Angulo de fase', 'graus', currentMetrics.phase, previousMetrics.phase, firstMetrics.phase)
    ];
  }, [
    evaluation?.derived?.ffmi,
    evaluation?.inputNormalized?.leanMassKg,
    evaluation?.inputNormalized?.percentFat,
    evaluation?.inputNormalized?.phaseAngle,
    first?.metrics,
    previous?.metrics
  ]);

  const sparklineValues = useMemo(() => {
    const ordered = [...refHistory].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    const values = ordered.map((item) => item.metrics.percentFat).filter((value) => Number.isFinite(value));
    if (Number.isFinite(evaluation?.inputNormalized?.percentFat)) values.push(evaluation.inputNormalized.percentFat);
    return values.slice(-6);
  }, [evaluation, refHistory]);

  const comparativeSources = useMemo(
    () => buildCompositionSourceComparison({
      allHistory: allEvaluationHistory,
      currentSessionId: moduleSnapshot?.sessaoId || currentSessionId,
      currentBia: {
        percentFat: evaluation?.inputNormalized?.percentFat,
        leanMass: evaluation?.inputNormalized?.leanMassKg,
        date: normalizeDateValue(dados.dataAvaliacao)
      }
    }),
    [
      allEvaluationHistory,
      currentSessionId,
      dados.dataAvaliacao,
      evaluation?.inputNormalized?.leanMassKg,
      evaluation?.inputNormalized?.percentFat,
      moduleSnapshot?.sessaoId
    ]
  );

  const interpretation = useMemo(() => {
    const row = comparisonRows.find((item) => item.key === 'leanMass');
    if (!row || !Number.isFinite(row.delta.deltaAbs)) return 'Sem comparacao suficiente para interpretar evolucao da BIA.';
    if (Math.abs(row.delta.deltaAbs) < 0.001) return 'Massa magra estavel em relacao a ultima avaliacao.';
    const direction = row.delta.deltaAbs > 0 ? 'aumentou' : 'reduziu';
    return `Massa magra ${direction} ${formatNumber(Math.abs(row.delta.deltaAbs), 2)} kg em relacao a ultima avaliacao.`;
  }, [comparisonRows]);

  const payloadDados = useMemo(() => {
    const deltaPercent = buildComparativeDeltas({
      current: evaluation?.inputNormalized?.percentFat,
      reference: previous?.metrics?.percentFat
    });

    return {
      equipamento: toTextInput(dados.equipamento) || null,
      biaType: dados.biaType,
      entryMode: dados.entryMode,
      fastingHours: parseNumeric(dados.fastingHours),
      hydrationStatus: dados.hydrationStatus,
      hadPhysicalActivity24h: dados.hadPhysicalActivity24h,
      menstrualPhase: dados.menstrualPhase,
      resistanceOhm: parseNumeric(dados.resistanceOhm),
      reactanceOhm: parseNumeric(dados.reactanceOhm),
      phaseAngle: numberOrNull(evaluation?.inputNormalized?.phaseAngle, 2),
      percentual_gordura: numberOrNull(evaluation?.inputNormalized?.percentFat, 2),
      massa_gorda: numberOrNull(evaluation?.inputNormalized?.fatMassKg, 2),
      massa_magra: numberOrNull(evaluation?.inputNormalized?.leanMassKg, 2),
      agua_total: numberOrNull(evaluation?.inputNormalized?.tbwL, 2),
      agua_intracelular: numberOrNull(evaluation?.inputNormalized?.icwL, 2),
      agua_extracelular: numberOrNull(evaluation?.inputNormalized?.ecwL, 2),
      taxa_metabolica_basal: numberOrNull(evaluation?.inputNormalized?.deviceTmbKcal, 0),
      peso: numberOrNull(weightKg, 2),
      estatura_cm: numberOrNull(heightCm, 1),
      idade: numberOrNull(ageYears, 0),
      sexo: sexToken,
      observacoes: toTextInput(dados.observacoes) || null,
      dados_brutos: {
        equipamento: toTextInput(dados.equipamento) || null,
        biaType: dados.biaType,
        entryMode: dados.entryMode,
        fastingHours: parseNumeric(dados.fastingHours),
        hydrationStatus: dados.hydrationStatus,
        hadPhysicalActivity24h: dados.hadPhysicalActivity24h,
        menstrualPhase: dados.menstrualPhase,
        resistanceOhm: parseNumeric(dados.resistanceOhm),
        reactanceOhm: parseNumeric(dados.reactanceOhm),
        phaseAngle: parseNumeric(dados.phaseAngle),
        percentFat: parseNumeric(dados.percentFat),
        fatMassKg: parseNumeric(dados.fatMassKg),
        leanMassKg: parseNumeric(dados.leanMassKg),
        tbwL: parseNumeric(dados.tbwL),
        icwL: parseNumeric(dados.icwL),
        ecwL: parseNumeric(dados.ecwL),
        deviceTmbKcal: parseNumeric(dados.deviceTmbKcal),
        weightKg: numberOrNull(weightKg, 2),
        heightCm: numberOrNull(heightCm, 1),
        ageYears: numberOrNull(ageYears, 0),
        sex: sexToken,
        importText: toTextInput(dados.importText) || null
      },
      resultados_calculados: {
        phaseAngle: numberOrNull(evaluation?.inputNormalized?.phaseAngle, 2),
        ffmi: numberOrNull(evaluation?.derived?.ffmi, 2),
        ecwIcwRatio: numberOrNull(evaluation?.derived?.ecwIcwRatio, 3),
        tmbCunningham: numberOrNull(evaluation?.derived?.tmbCunningham, 0),
        tmbGuedes: numberOrNull(evaluation?.derived?.tmbGuedes, 0),
        diffDeviceVsCunningham: numberOrNull(evaluation?.derived?.diffDeviceVsCunningham, 0),
        diffDeviceVsGuedes: numberOrNull(evaluation?.derived?.diffDeviceVsGuedes, 0)
      },
      classificacoes: {
        bodyFat: evaluation?.classifications?.bodyFat?.label || null,
        hydration: evaluation?.classifications?.hydration?.label || null,
        phaseAngle: evaluation?.classifications?.phaseAngle?.label || null,
        ecwIcw: evaluation?.classifications?.ecwIcw?.label || null
      },
      metadados_formula: {
        formulaId: 'bia_cunningham_guedes_phase_ffmi',
        formulaVersion: '1.0.0',
        tmbFormulaPrimary: 'cunningham_1980',
        tmbFormulaSecondary: 'guedes_2006'
      },
      comparacao: {
        referencia_comparacao: previous ? 'avaliacao_anterior' : null,
        delta_absoluto_percentual_gordura: numberOrNull(deltaPercent.deltaAbs, 2),
        delta_percentual_percentual_gordura: numberOrNull(deltaPercent.deltaPct, 2)
      },
      input: {
        dataAvaliacao: normalizeDateValue(dados.dataAvaliacao),
        equipamento: toTextInput(dados.equipamento) || null,
        biaType: dados.biaType,
        entryMode: dados.entryMode,
        fastingHours: parseNumeric(dados.fastingHours),
        hydrationStatus: dados.hydrationStatus,
        hadPhysicalActivity24h: dados.hadPhysicalActivity24h,
        menstrualPhase: dados.menstrualPhase,
        resistanceOhm: parseNumeric(dados.resistanceOhm),
        reactanceOhm: parseNumeric(dados.reactanceOhm),
        phaseAngle: parseNumeric(dados.phaseAngle),
        percentFat: parseNumeric(dados.percentFat),
        fatMassKg: parseNumeric(dados.fatMassKg),
        leanMassKg: parseNumeric(dados.leanMassKg),
        tbwL: parseNumeric(dados.tbwL),
        icwL: parseNumeric(dados.icwL),
        ecwL: parseNumeric(dados.ecwL),
        deviceTmbKcal: parseNumeric(dados.deviceTmbKcal),
        weightKg: numberOrNull(weightKg, 2),
        heightCm: numberOrNull(heightCm, 1),
        ageYears: numberOrNull(ageYears, 0),
        sex: sexToken
      },
      source: {
        mode: dados.entryMode,
        system: 'bioimpedancia'
      }
    };
  }, [
    ageYears,
    dados.biaType,
    dados.dataAvaliacao,
    dados.deviceTmbKcal,
    dados.ecwL,
    dados.equipamento,
    dados.entryMode,
    dados.fastingHours,
    dados.fatMassKg,
    dados.hadPhysicalActivity24h,
    dados.hydrationStatus,
    dados.icwL,
    dados.importText,
    dados.leanMassKg,
    dados.menstrualPhase,
    dados.observacoes,
    dados.percentFat,
    dados.phaseAngle,
    dados.reactanceOhm,
    dados.resistanceOhm,
    dados.tbwL,
    evaluation,
    heightCm,
    previous,
    sexToken,
    weightKg
  ]);

  const payloadResults = useMemo(() => ({
    percentual_gordura: payloadDados.percentual_gordura,
    massa_gorda: payloadDados.massa_gorda,
    massa_magra: payloadDados.massa_magra,
    agua_total: payloadDados.agua_total,
    phaseAngle: payloadDados.resultados_calculados?.phaseAngle ?? null,
    ffmi: payloadDados.resultados_calculados?.ffmi ?? null,
    ecwIcwRatio: payloadDados.resultados_calculados?.ecwIcwRatio ?? null,
    tmbCunningham: payloadDados.resultados_calculados?.tmbCunningham ?? null,
    tmbGuedes: payloadDados.resultados_calculados?.tmbGuedes ?? null,
    calculated: {
      percentualGordura: payloadDados.percentual_gordura,
      massaMagra: payloadDados.massa_magra,
      ffmi: payloadDados.resultados_calculados?.ffmi ?? null,
      phaseAngle: payloadDados.resultados_calculados?.phaseAngle ?? null
    },
    output: {
      bodyFatClassificacao: payloadDados.classificacoes?.bodyFat ?? null,
      hydrationClassificacao: payloadDados.classificacoes?.hydration ?? null,
      phaseClassificacao: payloadDados.classificacoes?.phaseAngle ?? null
    },
    comparacao: payloadDados.comparacao
  }), [payloadDados]);

  const hasValues = useMemo(() => {
    const candidates = [
      dados.resistanceOhm,
      dados.reactanceOhm,
      dados.phaseAngle,
      dados.percentFat,
      dados.fatMassKg,
      dados.leanMassKg,
      dados.tbwL,
      dados.equipamento,
      dados.observacoes
    ];
    return candidates.some((value) => toTextInput(value) !== '');
  }, [
    dados.equipamento,
    dados.fatMassKg,
    dados.leanMassKg,
    dados.observacoes,
    dados.percentFat,
    dados.phaseAngle,
    dados.reactanceOhm,
    dados.resistanceOhm,
    dados.tbwL
  ]);

  const dispatchSave = useCallback(async (auto = false) => {
    const dispatch = auto ? onAutoSave : onSalvar;
    if (!dispatch) return;

    await dispatch({
      tipo: 'bioimpedancia',
      dados: payloadDados,
      resultados: payloadResults,
      data: dados.dataAvaliacao,
      schemaVersion: 3,
      formulaId: 'bia_cunningham_guedes_phase_ffmi',
      formulaVersion: '1.0.0',
      sourceSystem: dados.entryMode || 'manual',
      sourceRef: toTextInput(dados.equipamento) || undefined,
      measuredAt: normalizeDateValue(dados.dataAvaliacao),
      sessaoId: moduleSnapshot?.sessaoId || currentSessionId,
      pacienteId
    });
  }, [
    currentSessionId,
    dados.dataAvaliacao,
    dados.entryMode,
    dados.equipamento,
    moduleSnapshot?.sessaoId,
    onAutoSave,
    onSalvar,
    pacienteId,
    payloadDados,
    payloadResults
  ]);

  const executeSave = useCallback(async (auto = false) => {
    setSaveStatus('saving');
    if (saveStatusResetRef.current) clearTimeout(saveStatusResetRef.current);
    try {
      await dispatchSave(auto);
      setSaveStatus('saved');
      saveStatusResetRef.current = setTimeout(() => setSaveStatus(null), 3000);
    } catch (saveError) {
      setSaveStatus('error');
      if (!auto) {
        setError('Nao foi possivel salvar a avaliacao. Tente novamente.');
      }
    }
  }, [dispatchSave]);

  const handleSalvar = useCallback(async () => {
    if (!onSalvar) return;
    setSubmitAttempted(true);
    setError('');

    if (!hasValues) {
      setError('Preencha ao menos uma leitura de BIA para salvar.');
      return;
    }

    if (hasRequiredErrors) {
      setError('Peso e estatura invalidos. Revise os valores obrigatorios.');
      return;
    }

    const warningLines = Object.entries(fieldValidation)
      .filter(([, item]) => item.status === 'warning')
      .map(([key, item]) => `${resolveFieldLabel(key)}: ${item.message}`);

    if (warningLines.length > 0) {
      const proceed = window.confirm([
        'Foram detectados valores fora da faixa fisiologica:',
        ...warningLines.map((line) => `- ${line}`),
        '',
        'Deseja salvar mesmo assim?'
      ].join('\n'));
      if (!proceed) return;
    }

    await executeSave(false);
  }, [executeSave, fieldValidation, hasRequiredErrors, hasValues, onSalvar]);

  useEffect(() => {
    if (readOnly || !onAutoSave || !hasUserInput || !hasValues) return undefined;
    if (hasRequiredErrors) return undefined;
    clearTimeout(autoSaveRef.current);
    autoSaveRef.current = setTimeout(() => {
      executeSave(true);
    }, 900);
    return () => clearTimeout(autoSaveRef.current);
  }, [executeSave, hasRequiredErrors, hasUserInput, hasValues, onAutoSave, readOnly]);

  useEffect(() => () => {
    if (saveStatusResetRef.current) clearTimeout(saveStatusResetRef.current);
  }, []);

  const showPrecheckAlert = Array.isArray(evaluation?.warnings?.precheck) && evaluation.warnings.precheck.length > 0;

  return (
    <div className={`eval-card bioimpedancia-form bioimpedancia-form--modern${readOnly ? ' eval-card--readonly' : ''}`}>
      <div className="eval-header">
        <div className="eval-icon">
          <Scale size={22} />
        </div>
        <div>
          <h3 className="eval-title">Bioimpedancia (BIA)</h3>
          <p className="eval-subtitle">Leituras de composicao corporal com derivacoes automaticas e comparacao longitudinal.</p>
        </div>
      </div>

      <div className="eval-section">
        <h4 className="eval-section-title">Equipamento e condicoes pre-avaliacao</h4>
        <div className="bia-grid">
          <div className="eval-field">
            <label className="eval-label">Data da avaliacao</label>
            <input
              type="date"
              className="eval-input"
              value={dados.dataAvaliacao}
              onChange={(event) => updateField(setDados, setHasUserInput, 'dataAvaliacao', event.target.value)}
              disabled={readOnly}
            />
          </div>
          <div className="eval-field">
            <label className="eval-label">Equipamento (marca/modelo)</label>
            <input
              type="text"
              className="eval-input"
              value={dados.equipamento}
              onChange={(event) => updateField(setDados, setHasUserInput, 'equipamento', event.target.value)}
              disabled={readOnly}
              placeholder="Ex.: InBody 270"
            />
          </div>
          <div className="eval-field">
            <label className="eval-label">Tipo de BIA</label>
            <select
              className="eval-input"
              value={dados.biaType}
              onChange={(event) => updateField(setDados, setHasUserInput, 'biaType', event.target.value)}
              disabled={readOnly}
            >
              {BIA_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
          <div className="eval-field">
            <label className="eval-label">Modo de insercao</label>
            <select
              className="eval-input"
              value={dados.entryMode}
              onChange={(event) => updateField(setDados, setHasUserInput, 'entryMode', event.target.value)}
              disabled={readOnly}
            >
              <option value="manual">Manual</option>
              <option value="importacao">Importacao</option>
            </select>
          </div>
          <BaseNumericField
            label="Jejum"
            unit="h"
            value={dados.fastingHours}
            onChange={(value) => updateField(setDados, setHasUserInput, 'fastingHours', value)}
            disabled={readOnly}
            placeholder="Ex.: 8"
          />
          <div className="eval-field">
            <label className="eval-label">Hidratacao</label>
            <select
              className="eval-input"
              value={dados.hydrationStatus}
              onChange={(event) => updateField(setDados, setHasUserInput, 'hydrationStatus', event.target.value)}
              disabled={readOnly}
            >
              <option value="nao_informado">Nao informado</option>
              <option value="adequada">Adequada</option>
              <option value="desidratado">Desidratado</option>
              <option value="hiperidratado">Hiperidratado</option>
            </select>
          </div>
          <div className="eval-field">
            <label className="eval-label">Atividade fisica ultimas 24h</label>
            <select
              className="eval-input"
              value={dados.hadPhysicalActivity24h}
              onChange={(event) => updateField(setDados, setHasUserInput, 'hadPhysicalActivity24h', normalizeYesNo(event.target.value))}
              disabled={readOnly}
            >
              <option value="nao_informado">Nao informado</option>
              <option value="nao">Nao</option>
              <option value="sim">Sim</option>
            </select>
          </div>
          <div className="eval-field">
            <label className="eval-label">Fase ciclo menstrual</label>
            <select
              className="eval-input"
              value={dados.menstrualPhase}
              onChange={(event) => updateField(setDados, setHasUserInput, 'menstrualPhase', event.target.value)}
              disabled={readOnly}
            >
              <option value="nao_informado">Nao informado</option>
              <option value="folicular">Folicular</option>
              <option value="ovulatoria">Ovulatoria</option>
              <option value="lutea">Lutea</option>
              <option value="menstrual">Menstrual</option>
              <option value="nenhuma">Nao se aplica</option>
            </select>
          </div>
        </div>

        {showPrecheckAlert && (
          <div className="bia-precheck-alert">
            <AlertTriangle size={16} />
            <div>
              <strong>Resultado pode estar subestimado. Considere repetir em condicoes padronizadas.</strong>
              <ul>
                {evaluation.warnings.precheck.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </div>
          </div>
        )}
      </div>

      <div className="eval-section">
        <h4 className="eval-section-title">Dados de entrada ou leitura direta</h4>
        {dados.entryMode === 'importacao' && (
          <div className="eval-field eval-field-full">
            <label className="eval-label">Importacao (colar resultado)</label>
            <textarea
              className="eval-textarea"
              rows={4}
              value={dados.importText}
              onChange={(event) => updateField(setDados, setHasUserInput, 'importText', event.target.value)}
              disabled={readOnly}
              placeholder="Cole o texto exportado do equipamento..."
            />
            <div className="bia-import-actions">
              <Button
                type="button"
                variant="secondary"
                onClick={() => applyImportText(dados.importText, setDados, setHasUserInput)}
                disabled={readOnly || !toTextInput(dados.importText)}
              >
                Aplicar importacao
              </Button>
            </div>
          </div>
        )}

        <div className="bia-grid">
          <BaseNumericField
            label="Resistencia"
            unit="ohm"
            value={dados.resistanceOhm}
            onChange={(value) => updateField(setDados, setHasUserInput, 'resistanceOhm', value)}
            disabled={readOnly}
          />
          <BaseNumericField
            label="Reactancia"
            unit="ohm"
            value={dados.reactanceOhm}
            onChange={(value) => updateField(setDados, setHasUserInput, 'reactanceOhm', value)}
            disabled={readOnly}
          />
          <BaseNumericField
            label="Angulo de fase"
            unit="graus"
            value={dados.phaseAngle}
            onChange={(value) => updateField(setDados, setHasUserInput, 'phaseAngle', value)}
            disabled={readOnly}
          />
          <BaseNumericField
            label="% Gordura"
            unit="%"
            value={dados.percentFat}
            onChange={(value) => updateField(setDados, setHasUserInput, 'percentFat', value)}
            disabled={readOnly}
            state={resolveInputState(fieldValidation.percentFat, submitAttempted || touched.percentFat)}
            onBlur={() => setTouched((prev) => ({ ...prev, percentFat: true }))}
            className="eval-field--critical"
          />
          <BaseNumericField
            label="Massa gorda"
            unit="kg"
            value={dados.fatMassKg}
            onChange={(value) => updateField(setDados, setHasUserInput, 'fatMassKg', value)}
            disabled={readOnly}
          />
          <BaseNumericField
            label="Massa magra"
            unit="kg"
            value={dados.leanMassKg}
            onChange={(value) => updateField(setDados, setHasUserInput, 'leanMassKg', value)}
            disabled={readOnly}
            className="eval-field--critical"
          />
          <BaseNumericField
            label="Agua corporal total"
            unit="L"
            value={dados.tbwL}
            onChange={(value) => updateField(setDados, setHasUserInput, 'tbwL', value)}
            disabled={readOnly}
          />
          <BaseNumericField
            label="Agua intracelular"
            unit="L"
            value={dados.icwL}
            onChange={(value) => updateField(setDados, setHasUserInput, 'icwL', value)}
            disabled={readOnly}
          />
          <BaseNumericField
            label="Agua extracelular"
            unit="L"
            value={dados.ecwL}
            onChange={(value) => updateField(setDados, setHasUserInput, 'ecwL', value)}
            disabled={readOnly}
          />
          <BaseNumericField
            label="TMB pelo equipamento"
            unit="kcal/dia"
            value={dados.deviceTmbKcal}
            onChange={(value) => updateField(setDados, setHasUserInput, 'deviceTmbKcal', value)}
            disabled={readOnly}
          />
        </div>
      </div>

      <div className="eval-section">
        <h4 className="eval-section-title">Base antropometrica</h4>
        <div className="bia-grid">
          <BaseNumericField
            label="Peso"
            unit="kg"
            value={dados.weightKg}
            onChange={(value) => updateField(setDados, setHasUserInput, 'weightKg', value)}
            disabled={readOnly || lockSharedAnthropometry}
            state={resolveInputState(fieldValidation.weightKg, submitAttempted || touched.weightKg)}
            onBlur={() => setTouched((prev) => ({ ...prev, weightKg: true }))}
            className="eval-field--critical"
          />
          <BaseNumericField
            label="Estatura"
            unit="cm"
            value={dados.heightCm}
            onChange={(value) => updateField(setDados, setHasUserInput, 'heightCm', value)}
            disabled={readOnly || lockSharedAnthropometry}
            state={resolveInputState(fieldValidation.heightCm, submitAttempted || touched.heightCm)}
            onBlur={() => setTouched((prev) => ({ ...prev, heightCm: true }))}
          />
          <BaseNumericField
            label="Idade"
            unit="anos"
            value={dados.ageYears}
            onChange={(value) => updateField(setDados, setHasUserInput, 'ageYears', value)}
            disabled={readOnly || lockSharedAnthropometry}
          />
          <div className="eval-field">
            <label className="eval-label">Sexo biologico</label>
            <select
              className="eval-input"
              value={dados.sex}
              onChange={(event) => updateField(setDados, setHasUserInput, 'sex', event.target.value)}
              disabled={readOnly || lockSharedAnthropometry}
            >
              <option value="">Selecione</option>
              <option value="MASCULINO">Masculino</option>
              <option value="FEMININO">Feminino</option>
            </select>
          </div>
        </div>
        {lockSharedAnthropometry && (
          <p className="bia-shared-hint">Peso, estatura, idade e sexo estao sincronizados com a ficha base compartilhada.</p>
        )}
      </div>

      <div className="eval-results-section">
        <div className="bia-results-grid">
          <ResultCard
            label="% Gordura"
            value={evaluation?.inputNormalized?.percentFat}
            unit="%"
            digits={2}
            classification={evaluation?.classifications?.bodyFat}
            delta={buildComparativeDeltas({ current: evaluation?.inputNormalized?.percentFat, reference: previous?.metrics?.percentFat })}
          />
          <ResultCard
            label="Massa magra"
            value={evaluation?.inputNormalized?.leanMassKg}
            unit="kg"
            digits={2}
            classification={{ label: 'Composicao corporal', tone: 'info', source: 'BIA' }}
            delta={buildComparativeDeltas({ current: evaluation?.inputNormalized?.leanMassKg, reference: previous?.metrics?.leanMass })}
          />
          <ResultCard
            label="IMLG"
            value={evaluation?.derived?.ffmi}
            unit=""
            digits={2}
            classification={{ label: 'Indice massa livre de gordura', tone: 'neutral', source: 'IMLG = MM/altura^2' }}
          />
          <ResultCard
            label="Angulo de fase"
            value={evaluation?.inputNormalized?.phaseAngle}
            unit="graus"
            digits={2}
            classification={evaluation?.classifications?.phaseAngle}
            delta={buildComparativeDeltas({ current: evaluation?.inputNormalized?.phaseAngle, reference: previous?.metrics?.phase })}
          />
          <ResultCard
            label="Razao ECW/ICW"
            value={evaluation?.derived?.ecwIcwRatio}
            unit=""
            digits={3}
            classification={evaluation?.classifications?.ecwIcw}
          />
          <ResultCard
            label="TMB Cunningham"
            value={evaluation?.derived?.tmbCunningham}
            unit="kcal/dia"
            digits={0}
            classification={{ label: '500 + 22 x MM', tone: 'neutral', source: 'Cunningham 1980' }}
          />
          <ResultCard
            label="TMB Guedes"
            value={evaluation?.derived?.tmbGuedes}
            unit="kcal/dia"
            digits={0}
            classification={{ label: '426.2 + 14.334 x MM', tone: 'neutral', source: 'Guedes 2006' }}
          />
          <ResultCard
            label="Dif. equipamento vs Cunningham"
            value={evaluation?.derived?.diffDeviceVsCunningham}
            unit="kcal"
            digits={0}
            classification={{
              label: Number.isFinite(evaluation?.derived?.diffDeviceVsCunningham) ? 'Comparativo de TMB' : 'Sem TMB do equipamento',
              tone: Number.isFinite(evaluation?.derived?.diffDeviceVsCunningham) ? 'info' : 'neutral',
              source: 'BIA vs formula'
            }}
          />
        </div>

        <div className="bia-comparison">
          <div className="bia-table-wrap">
            <table className="bia-table">
              <thead>
                <tr>
                  <th>Indicador</th>
                  <th>Atual</th>
                  <th>Anterior</th>
                  <th>Primeira</th>
                  <th>Delta abs.</th>
                  <th>Delta %</th>
                </tr>
              </thead>
              <tbody>
                {comparisonRows.map((row) => (
                  <tr key={row.key}>
                    <td>{row.label}</td>
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
          <div className="bia-sparkline-card">
            <p>% gordura (ultimos 6)</p>
            <MiniSparkline values={sparklineValues} target={previous?.metrics?.percentFat ?? null} width={240} height={82} />
          </div>
          <p className="bia-interpretation">{interpretation}</p>
        </div>
      </div>

      <div className="eval-section">
        <h4 className="eval-section-title">Comparativo BIA vs Dobras vs DEXA (sessao)</h4>
        <div className="bia-table-wrap">
          <table className="bia-table bia-source-table">
            <thead>
              <tr>
                <th>Fonte</th>
                <th>% Gordura</th>
                <th>Massa magra</th>
                <th>Data</th>
                <th>Delta vs BIA</th>
              </tr>
            </thead>
            <tbody>
              {comparativeSources.map((row) => (
                <tr key={row.source}>
                  <td>{row.label}</td>
                  <td>{formatMetric(row.percentFat, '%', 'percentFat')}</td>
                  <td>{formatMetric(row.leanMass, 'kg', 'leanMass')}</td>
                  <td>{row.dateLabel || '--'}</td>
                  <td className={resolveDeltaClass(row.deltaVsBia)}>{formatSigned(row.deltaVsBia, 'p.p.', 'percent')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="eval-section">
        <h4 className="eval-section-title">Observacoes</h4>
        <div className="eval-field eval-field-full">
          <textarea
            className="eval-textarea"
            rows={3}
            value={dados.observacoes}
            onChange={(event) => updateField(setDados, setHasUserInput, 'observacoes', event.target.value)}
            disabled={readOnly}
          />
        </div>
      </div>

      {readOnly && <div className="eval-note">Somente leitura para o seu perfil.</div>}

      <div className="eval-actions">
        {saveStatus ? <span className={`save-indicator ${saveStatus}`}>{saveStatus === 'saving' ? 'Salvando...' : saveStatus === 'saved' ? 'Salvo' : 'Erro ao salvar'}</span> : null}
        <Button type="button" variant="primary" onClick={handleSalvar} disabled={readOnly} loading={saveStatus === 'saving'}>
          Salvar bioimpedancia
        </Button>
      </div>

      {error && <div className="eval-note bia-error-note">{error}</div>}
    </div>
  );
};

const BaseNumericField = ({ label, unit, value, onChange, disabled, placeholder = '', state = '', onBlur, className = '' }) => (
  <div className={`eval-field${className ? ` ${className}` : ''}`}>
    <label className="eval-label">
      {label}
      <span className="bia-unit-badge">{unit}</span>
    </label>
    <input
      type="text"
      inputMode="decimal"
      className={`eval-input ${state === 'error' ? 'bia-input-invalid' : ''} ${state === 'warning' ? 'bia-input-warning' : ''}`}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      disabled={disabled}
      placeholder={placeholder}
      onBlur={onBlur}
    />
  </div>
);

const ResultCard = ({ label, value, unit = '', digits = 2, classification, delta }) => {
  const tone = resolveTone(classification?.tone);
  return (
    <article className="bia-result-card">
      <span className="bia-result-label">{label}</span>
      <strong>{Number.isFinite(value) ? `${formatNumber(value, digits)}${unit ? ` ${unit}` : ''}` : 'Não calculado'}</strong>
      <span className={`bia-status-badge bia-tone-${tone}`}>{classification?.label || 'Sem classificação'}</span>
      {classification?.source ? <small>{classification.source}</small> : null}
      {delta && Number.isFinite(delta.deltaAbs) ? (
        <small className={`bia-delta ${resolveDeltaClass(delta.deltaAbs)}`}>{formatSigned(delta.deltaAbs, unit, unit === '%' ? 'percent' : 'default')}</small>
      ) : null}
    </article>
  );
};

export default BioimpedanciaForm;

function updateField(setDados, setHasUserInput, field, value) {
  setHasUserInput(true);
  setDados((prev) => ({ ...prev, [field]: value }));
}

function parseNumeric(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = Number(String(value).replace(',', '.').trim());
  return Number.isFinite(parsed) ? parsed : null;
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

function firstDefined(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return null;
}

function numberOrNull(value, digits = 2) {
  const numeric = parseNumeric(value);
  if (!Number.isFinite(numeric)) return null;
  if (!Number.isFinite(digits)) return numeric;
  return Number(numeric.toFixed(digits));
}

function resolveDate(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value?.toDate === 'function') {
    const converted = value.toDate();
    return Number.isNaN(converted?.getTime?.()) ? null : converted;
  }
  if (typeof value?.seconds === 'number') {
    const fromSeconds = new Date(value.seconds * 1000);
    return Number.isNaN(fromSeconds.getTime()) ? null : fromSeconds;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalizeDateValue(value) {
  if (!value) return toLocalDateInputValue(new Date());
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) return value.trim();
  const date = resolveDate(value);
  return date ? toLocalDateInputValue(date) : toLocalDateInputValue(new Date());
}

function normalizeHeightCm(value) {
  const numeric = parseNumeric(value);
  if (!Number.isFinite(numeric)) return null;
  if (numeric > 0 && numeric <= 3) return Number((numeric * 100).toFixed(1));
  return numeric;
}

function calculateAge(dateValue) {
  const birthDate = resolveDate(dateValue);
  if (!birthDate) return null;
  const now = new Date();
  let age = now.getFullYear() - birthDate.getFullYear();
  const monthDiff = now.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birthDate.getDate())) age -= 1;
  return age;
}

function normalizeSexLabel(value) {
  const token = toTextInput(value).toLowerCase();
  if (!token) return '';
  if (token.includes('fem') || token === 'f' || token === 'female') return 'FEMININO';
  if (token.includes('masc') || token === 'm' || token === 'male') return 'MASCULINO';
  return toTextInput(value).toUpperCase();
}

function normalizeSexToken(value) {
  const token = toTextInput(value).toLowerCase();
  if (!token) return null;
  if (token.includes('fem') || token === 'f' || token === 'female') return 'female';
  if (token.includes('masc') || token === 'm' || token === 'male') return 'male';
  return null;
}

function normalizeYesNo(value) {
  const token = toTextInput(value).toLowerCase();
  if (!token) return 'nao_informado';
  if (['sim', 'true', '1', 'yes', 'y'].includes(token)) return 'sim';
  if (['nao', 'false', '0', 'no', 'n'].includes(token)) return 'nao';
  return 'nao_informado';
}

function validateNumberField(value, metric, required = false) {
  const text = toTextInput(value);
  if (!text) {
    if (required) return { status: 'error', message: 'Campo obrigatorio.' };
    return { status: 'empty', message: '' };
  }

  const numeric = parseNumeric(value);
  if (!Number.isFinite(numeric)) return { status: 'error', message: 'Valor invalido.' };

  const range = validatePhysiologicalRange({ metric, value: numeric });
  if (range.status === 'warning') return { status: 'warning', message: range.message };
  return { status: 'ok', message: '' };
}

function resolveInputState(validation, show) {
  if (!show || !validation) return '';
  if (validation.status === 'error') return 'error';
  if (validation.status === 'warning') return 'warning';
  return '';
}

function resolveFieldLabel(key) {
  const map = {
    weightKg: 'Peso',
    heightCm: 'Estatura',
    percentFat: '% Gordura'
  };
  return map[key] || key;
}

function resolveTone(tone) {
  if (!tone) return 'neutral';
  if (tone === 'success') return 'success';
  if (tone === 'warning') return 'warning';
  if (tone === 'danger') return 'danger';
  if (tone === 'info') return 'info';
  return 'neutral';
}

function resolveDeltaClass(value) {
  if (!Number.isFinite(value)) return 'is-flat';
  if (value > 0) return 'is-up';
  if (value < 0) return 'is-down';
  return 'is-flat';
}

function formatNumber(value, digits = 2) {
  if (!Number.isFinite(value)) return '--';
  return Number(value).toLocaleString('pt-BR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  });
}

function formatMetric(value, unit = '', key = '') {
  if (!Number.isFinite(value)) return '--';
  const digitsByKey = {
    percentFat: 2,
    leanMass: 2,
    ffmi: 2,
    phase: 2
  };
  const digits = Object.prototype.hasOwnProperty.call(digitsByKey, key) ? digitsByKey[key] : 2;
  return `${formatNumber(value, digits)}${unit ? ` ${unit}` : ''}`;
}

function formatSigned(value, unit = '', key = '') {
  if (!Number.isFinite(value)) return '--';
  const digits = key === 'percent' ? 2 : (unit === 'kcal' ? 0 : 2);
  const sign = value > 0 ? '+' : '';
  return `${sign}${formatNumber(value, digits)}${unit ? ` ${unit}` : ''}`;
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

function normalizeBiaHistory(records = []) {
  if (!Array.isArray(records)) return [];
  return records
    .map((record) => {
      const date = resolveDate(record?.updatedAt || record?.createdAt || record?.data);
      const timestamp = date ? date.getTime() : 0;
      return {
        id: record?.id || '',
        timestamp,
        metrics: resolveBiaMetrics(record)
      };
    })
    .filter((item) => Number.isFinite(item.metrics.percentFat) || Number.isFinite(item.metrics.leanMass));
}

function resolveBiaMetrics(record) {
  const dados = record?.dados || {};
  const resultados = record?.resultados || {};
  const calculados = dados?.resultados_calculados || resultados?.calculated || {};
  return {
    percentFat: parseNumeric(firstDefined(dados?.percentual_gordura, resultados?.percentual_gordura, resultados?.percentualGordura)),
    leanMass: parseNumeric(firstDefined(dados?.massa_magra, resultados?.massa_magra, resultados?.massaMagra)),
    ffmi: parseNumeric(firstDefined(calculados?.ffmi, dados?.ffmi, resultados?.ffmi)),
    phase: parseNumeric(firstDefined(calculados?.phaseAngle, dados?.phaseAngle, resultados?.phaseAngle))
  };
}

function applyImportText(text, setDados, setHasUserInput) {
  const parsed = parseBiaImportText(text);
  if (!parsed) return;
  setHasUserInput(true);
  setDados((prev) => ({ ...prev, ...parsed }));
}

function parseBiaImportText(text) {
  const raw = toTextInput(text);
  if (!raw) return null;
  const lines = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (!lines.length) return null;

  const next = {};
  lines.forEach((line) => {
    const normalized = line.toLowerCase();
    const numeric = extractFirstNumber(line);
    if (!Number.isFinite(numeric)) return;

    if (normalized.includes('resist')) next.resistanceOhm = String(Math.round(numeric));
    else if (normalized.includes('react')) next.reactanceOhm = String(Math.round(numeric));
    else if (normalized.includes('fase') || normalized.includes('phase')) next.phaseAngle = String(numeric.toFixed(2));
    else if (normalized.includes('%') && normalized.includes('gord')) next.percentFat = String(numeric.toFixed(2));
    else if (normalized.includes('massa gorda') || normalized.includes('fat mass')) next.fatMassKg = String(numeric.toFixed(2));
    else if (normalized.includes('massa magra') || normalized.includes('lean mass')) next.leanMassKg = String(numeric.toFixed(2));
    else if (normalized.includes('agua intracel')) next.icwL = String(numeric.toFixed(2));
    else if (normalized.includes('agua extracel')) next.ecwL = String(numeric.toFixed(2));
    else if (normalized.includes('agua') || normalized.includes('tbw')) next.tbwL = String(numeric.toFixed(2));
    else if (normalized.includes('tmb') || normalized.includes('bmr')) next.deviceTmbKcal = String(Math.round(numeric));
  });

  return Object.keys(next).length ? next : null;
}

function extractFirstNumber(line) {
  if (!line) return null;
  const match = String(line).replace(',', '.').match(/(-?\d+(?:\.\d+)?)/);
  if (!match) return null;
  const numeric = Number(match[1]);
  return Number.isFinite(numeric) ? numeric : null;
}

function buildCompositionSourceComparison({ allHistory = [], currentSessionId = '', currentBia }) {
  const rows = [];
  rows.push({
    source: 'bia_atual',
    label: 'BIA (atual)',
    percentFat: currentBia?.percentFat ?? null,
    leanMass: currentBia?.leanMass ?? null,
    dateLabel: currentBia?.date || '--',
    deltaVsBia: 0
  });

  const normalizedHistory = Array.isArray(allHistory) ? allHistory : [];
  const sessionRows = currentSessionId
    ? normalizedHistory.filter((item) => String(item?.sessaoId || '') === String(currentSessionId))
    : normalizedHistory;

  const pickLatestByType = (typeMatcher) => {
    const filtered = sessionRows.filter((item) => typeMatcher(normalizeType(item?.tipo)));
    filtered.sort((a, b) => {
      const aTime = resolveDate(a?.updatedAt || a?.createdAt || a?.data)?.getTime() || 0;
      const bTime = resolveDate(b?.updatedAt || b?.createdAt || b?.data)?.getTime() || 0;
      return bTime - aTime;
    });
    return filtered[0] || null;
  };

  const dobras = pickLatestByType((type) => type === 'dobras_cutaneas');
  if (dobras) {
    const dobrasPercent = parseNumeric(firstDefined(
      dobras?.dados?.percentual_gordura,
      dobras?.dados?.resultados_calculados?.percentual_gordura,
      dobras?.resultados?.percentual_gordura,
      dobras?.resultados?.percentualGordura
    ));
    const dobrasLean = parseNumeric(firstDefined(
      dobras?.dados?.massa_magra,
      dobras?.dados?.resultados_calculados?.massa_magra_kg,
      dobras?.resultados?.massa_magra,
      dobras?.resultados?.massaMagra
    ));
    rows.push({
      source: 'dobras',
      label: 'Dobras cutaneas',
      percentFat: dobrasPercent,
      leanMass: dobrasLean,
      dateLabel: formatDateLabel(dobras?.updatedAt || dobras?.createdAt || dobras?.data),
      deltaVsBia: Number.isFinite(dobrasPercent) && Number.isFinite(currentBia?.percentFat)
        ? dobrasPercent - currentBia.percentFat
        : null
    });
  }

  const dexa = pickLatestByType((type) => type.includes('dexa') || type.includes('dxa'));
  if (dexa) {
    const dexaPercent = parseNumeric(firstDefined(
      dexa?.dados?.percentual_gordura,
      dexa?.resultados?.percentual_gordura,
      dexa?.resultados?.percentualGordura
    ));
    const dexaLean = parseNumeric(firstDefined(
      dexa?.dados?.massa_magra,
      dexa?.resultados?.massa_magra,
      dexa?.resultados?.massaMagra
    ));
    rows.push({
      source: 'dexa',
      label: 'DEXA',
      percentFat: dexaPercent,
      leanMass: dexaLean,
      dateLabel: formatDateLabel(dexa?.updatedAt || dexa?.createdAt || dexa?.data),
      deltaVsBia: Number.isFinite(dexaPercent) && Number.isFinite(currentBia?.percentFat)
        ? dexaPercent - currentBia.percentFat
        : null
    });
  }

  return rows;
}

function normalizeType(value) {
  return String(value || '').trim().toLowerCase().replace(/-/g, '_');
}

function formatDateLabel(value) {
  const date = resolveDate(value);
  if (!date) return '--';
  return date.toLocaleDateString('pt-BR');
}
