import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Heart } from 'lucide-react';
import { Button } from '../../ui';
import { toLocalDateInputValue } from '../../../utils/dateUtils';
import {
  buildComparativeDeltas,
  calculateClinicalEvaluation
} from '../../../services/calculationEngine';
import { useUiFeedback } from '../../../contexts/UiFeedbackContext';
import '../avaliacoes.css';
import {
  AvaliacaoModulo,
  AvaliacaoSecao,
  AvaliacaoIndice,
  Campo,
  GrupoOpcoes,
  Opcao,
  ResultadoCalculado,
  AvisoAvaliacao,
  BarraAcoesAvaliacao,
  Tendencia
} from '../base';
import './AvaliacaoClinicaForm.css';
import { CLINICAL_SIGN_OPTIONS } from '../../../constants/clinicalInstruments';

// Índice "Neste formulário": os mesmos títulos de seção de antes. Os
// resultados vêm logo depois dos sinais vitais que os geram.
const CLINICA_INDICE = [
  { id: 'clinica-sinais', titulo: 'Sinais vitais' },
  { id: 'clinica-resultados', titulo: 'Resultados calculados' },
  { id: 'clinica-opcionais', titulo: 'Dados opcionais' },
  { id: 'clinica-esportivo', titulo: 'Contexto esportivo' },
  { id: 'clinica-observacoes', titulo: 'Observacoes clinicas' }
];

// Gravidade das red flags no aviso da base: além da cor, o ícone muda de
// forma e o leitor de tela ouve "Alerta:" ou "Atenção:". Antes todas levavam
// o mesmo triângulo; a gravidade vem do motor de regras, como antes.
const RED_FLAG_TIPO_AVISO = { danger: 'perigo', warning: 'atencao' };

const GLUCOSE_CONTEXT_OPTIONS = [
  { value: 'nao_informado', label: 'Nao informado' },
  { value: 'jejum', label: 'Jejum' },
  { value: 'pos_prandial', label: 'Pos-prandial' }
];

const EDEMA_GRADE_OPTIONS = [
  { value: '0', label: '0 (ausente)' },
  { value: '1', label: '1+' },
  { value: '2', label: '2+' },
  { value: '3', label: '3+' },
  { value: '4', label: '4+' }
];

const INDICATOR_INFO = {
  bloodPressure: {
    name: 'Classificacao da Pressao Arterial',
    formula: 'Tabela de classificacao da 7a Diretriz Brasileira de HAS (PAS/PAD)',
    reference: 'Sociedade Brasileira de Cardiologia',
    year: '2016'
  },
  map: {
    name: 'Pressao Arterial Media (PAM)',
    formula: 'PAM = (PAS + 2 x PAD) / 3',
    reference: 'Monitoramento hemodinamico clinico',
    year: 'Uso clinico consolidado'
  },
  pulsePressure: {
    name: 'Pressao de Pulso',
    formula: 'PP = PAS - PAD',
    reference: 'Semiologia cardiovascular',
    year: 'Uso clinico consolidado'
  },
  heartRate: {
    name: 'Frequencia Cardiaca',
    formula: 'BPM medidos em repouso',
    reference: 'Triagem clinica de sinais vitais',
    year: 'Uso clinico consolidado'
  },
  glucose: {
    name: 'Glicemia Capilar',
    formula: 'Classificacao por contexto (jejum/pos-prandial)',
    reference: 'Consenso ADA/SBD',
    year: 'Atual'
  },
  redFlags: {
    name: 'Red Flags Clinicas',
    formula: 'PA >= 180/110 | Glicemia jejum > 200 | FC < 40 ou > 120 | Edema >= 3+',
    reference: 'Regras de seguranca clinica do modulo',
    year: 'v1.0.0'
  }
};

const createInitialData = () => ({
  dataAvaliacao: toLocalDateInputValue(new Date()),
  systolic: '',
  diastolic: '',
  heartRate: '',
  temperatureC: '',
  glucoseMgDl: '',
  glucoseContext: 'nao_informado',
  edemaLocation: '',
  edemaGrade: '0',
  clinicalSigns: [],
  esportivo: createClinicalEsportivoData(),
  observacoes: ''
});

function createClinicalEsportivoData() {
  return {
    vo2maxEstimado: '',
    taxaSudorese: '',
    forcaPreensaoPalmar: {
      direita: '',
      esquerda: ''
    }
  };
}

const AvaliacaoClinicaForm = ({
  pacienteId,
  onSalvar,
  onAutoSave,
  readOnly = false,
  patient,
  onboardingContext,
  moduleSnapshot,
  moduleHistory = [],
  currentSessionId
}) => {
  const [dados, setDados] = useState(createInitialData);
  const { confirm } = useUiFeedback();

  const [error, setError] = useState('');
  const [saveStatus, setSaveStatus] = useState(null);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [touchedFields, setTouchedFields] = useState({});
  const [hasUserInput, setHasUserInput] = useState(false);

  const autoSaveRef = useRef(null);
  const saveStatusResetRef = useRef(null);
  const loadedSnapshotIdRef = useRef('');

  useEffect(() => {
    setHasUserInput(false);
    setTouchedFields({});
    setSubmitAttempted(false);
    setError('');
    setSaveStatus(null);
    if (saveStatusResetRef.current) clearTimeout(saveStatusResetRef.current);
  }, [pacienteId]);

  useEffect(() => () => {
    clearTimeout(autoSaveRef.current);
    if (saveStatusResetRef.current) clearTimeout(saveStatusResetRef.current);
  }, []);

  useEffect(() => {
    const snapshotId = moduleSnapshot?.id || '';
    if (!snapshotId || loadedSnapshotIdRef.current === snapshotId) return;

    const source = moduleSnapshot?.dados || {};
    const dadosBrutos = source?.dados_brutos || source?.input || source;
    const esportivoRaw = asRecord(firstDefined(
      dadosBrutos?.esportivo,
      source?.esportivo
    ));
    const forcaPreensaoRaw = asRecord(firstDefined(
      esportivoRaw?.forcaPreensaoPalmar,
      esportivoRaw?.forca_preensao_palmar
    ));

    setDados((prev) => ({
      ...prev,
      dataAvaliacao: normalizeDateValue(firstDefined(
        moduleSnapshot?.data,
        source?.dataAvaliacao,
        dadosBrutos?.dataAvaliacao,
        prev.dataAvaliacao
      )),
      systolic: toInputValue(firstDefined(
        dadosBrutos?.systolic,
        dadosBrutos?.pressaoSistolica,
        dadosBrutos?.pressao_sistolica,
        source?.pressaoSistolica,
        source?.pressao_sistolica
      ), 0),
      diastolic: toInputValue(firstDefined(
        dadosBrutos?.diastolic,
        dadosBrutos?.pressaoDiastolica,
        dadosBrutos?.pressao_diastolica,
        source?.pressaoDiastolica,
        source?.pressao_diastolica
      ), 0),
      heartRate: toInputValue(firstDefined(
        dadosBrutos?.heartRate,
        dadosBrutos?.frequenciaCardiaca,
        dadosBrutos?.frequencia_cardiaca,
        source?.frequenciaCardiaca,
        source?.frequencia_cardiaca
      ), 0),
      temperatureC: toInputValue(firstDefined(
        dadosBrutos?.temperatureC,
        dadosBrutos?.temperaturaC,
        dadosBrutos?.temperatura,
        source?.temperaturaC,
        source?.temperatura
      ), 1),
      glucoseMgDl: toInputValue(firstDefined(
        dadosBrutos?.glucoseMgDl,
        dadosBrutos?.glicemiaCapilar,
        dadosBrutos?.glicemia_capilar,
        source?.glicemiaCapilar,
        source?.glicemia_capilar
      ), 0),
      glucoseContext: toTextInput(firstDefined(
        dadosBrutos?.glucoseContext,
        dadosBrutos?.contextoGlicemia,
        dadosBrutos?.contexto_glicemia,
        source?.contextoGlicemia,
        source?.contexto_glicemia,
        'nao_informado'
      )) || 'nao_informado',
      edemaLocation: toTextInput(firstDefined(
        dadosBrutos?.edemaLocation,
        dadosBrutos?.edemaLocal,
        dadosBrutos?.edema_local,
        source?.edemaLocal,
        source?.edema_local
      )),
      edemaGrade: String(firstDefined(
        dadosBrutos?.edemaGrade,
        dadosBrutos?.edemaGrau,
        dadosBrutos?.edema_grau,
        source?.edemaGrau,
        source?.edema_grau,
        '0'
      )),
      clinicalSigns: normalizeStringArray(firstDefined(
        dadosBrutos?.clinicalSigns,
        dadosBrutos?.sinaisCarenciais,
        dadosBrutos?.sinais_carenciais,
        source?.sinaisCarenciais,
        source?.sinais_carenciais
      )),
      esportivo: {
        vo2maxEstimado: toInputValue(firstDefined(
          esportivoRaw?.vo2maxEstimado,
          esportivoRaw?.vo2max_estimado,
          prev?.esportivo?.vo2maxEstimado
        ), 1),
        taxaSudorese: toInputValue(firstDefined(
          esportivoRaw?.taxaSudorese,
          esportivoRaw?.taxa_sudorese,
          prev?.esportivo?.taxaSudorese
        ), 0),
        forcaPreensaoPalmar: {
          direita: toInputValue(firstDefined(
            forcaPreensaoRaw?.direita,
            forcaPreensaoRaw?.right,
            prev?.esportivo?.forcaPreensaoPalmar?.direita
          ), 1),
          esquerda: toInputValue(firstDefined(
            forcaPreensaoRaw?.esquerda,
            forcaPreensaoRaw?.left,
            prev?.esportivo?.forcaPreensaoPalmar?.esquerda
          ), 1)
        }
      },
      observacoes: toTextInput(firstDefined(
        dadosBrutos?.observacoes,
        source?.observacoes
      ))
    }));

    loadedSnapshotIdRef.current = snapshotId;
  }, [moduleSnapshot]);

  const evaluation = useMemo(() => calculateClinicalEvaluation({
    systolic: parseNumeric(dados.systolic),
    diastolic: parseNumeric(dados.diastolic),
    heartRate: parseNumeric(dados.heartRate),
    temperatureC: parseNumeric(dados.temperatureC),
    glucoseMgDl: parseNumeric(dados.glucoseMgDl),
    glucoseContext: dados.glucoseContext,
    edemaLocation: dados.edemaLocation,
    edemaGrade: parseNumeric(dados.edemaGrade),
    clinicalSigns: dados.clinicalSigns
  }), [
    dados.clinicalSigns,
    dados.diastolic,
    dados.edemaGrade,
    dados.edemaLocation,
    dados.glucoseContext,
    dados.glucoseMgDl,
    dados.heartRate,
    dados.systolic,
    dados.temperatureC
  ]);

  const selectedClinicalSignsDetails = useMemo(
    () => buildClinicalSignsDetails(dados.clinicalSigns),
    [dados.clinicalSigns]
  );

  const heartRateValue = useMemo(
    () => parseNumeric(dados.heartRate),
    [dados.heartRate]
  );
  const isAthletePatient = useMemo(
    () => resolveAthletePatient(patient, onboardingContext),
    [onboardingContext, patient]
  );
  const hasExpectedAthleteBradycardia = isAthletePatient
    && Number.isFinite(heartRateValue)
    && heartRateValue < 50;

  const onboardingInsights = useMemo(
    () => buildClinicalOnboardingInsights(onboardingContext),
    [onboardingContext]
  );

  const fieldValidation = useMemo(() => {
    const heartRateValidation = validateNumericField({
      value: dados.heartRate,
      label: 'Frequencia cardiaca',
      required: true,
      min: 20,
      max: 220
    });

    const resolvedHeartRateValidation = hasExpectedAthleteBradycardia
      ? { status: 'ok', message: '' }
      : heartRateValidation;

    return {
      systolic: validateNumericField({
        value: dados.systolic,
        label: 'PA sistolica',
        required: true,
        min: 70,
        max: 260
      }),
      diastolic: validateNumericField({
        value: dados.diastolic,
        label: 'PA diastolica',
        required: true,
        min: 40,
        max: 160
      }),
      heartRate: resolvedHeartRateValidation,
      temperatureC: validateNumericField({
        value: dados.temperatureC,
        label: 'Temperatura',
        required: false,
        min: 32,
        max: 43
      }),
      glucoseMgDl: validateNumericField({
        value: dados.glucoseMgDl,
        label: 'Glicemia capilar',
        required: false,
        min: 20,
        max: 700
      }),
      edemaGrade: validateNumericField({
        value: dados.edemaGrade,
        label: 'Grau de edema',
        required: false,
        min: 0,
        max: 4
      })
    };
  }, [
    dados.diastolic,
    dados.edemaGrade,
    dados.glucoseMgDl,
    dados.heartRate,
    dados.systolic,
    dados.temperatureC,
    hasExpectedAthleteBradycardia
  ]);

  const hasRequiredMissing = useMemo(() => (
    !Number.isFinite(evaluation?.inputNormalized?.systolic)
    || !Number.isFinite(evaluation?.inputNormalized?.diastolic)
    || !Number.isFinite(evaluation?.inputNormalized?.heartRate)
  ), [
    evaluation?.inputNormalized?.diastolic,
    evaluation?.inputNormalized?.heartRate,
    evaluation?.inputNormalized?.systolic
  ]);

  const hasFieldErrors = useMemo(
    () => Object.values(fieldValidation).some((item) => item.status === 'error'),
    [fieldValidation]
  );

  const warnings = useMemo(() => {
    const list = new Set(Array.isArray(evaluation?.warnings) ? evaluation.warnings : []);
    Object.values(fieldValidation).forEach((item) => {
      if (item.status === 'warning' && item.message) list.add(item.message);
    });
    return Array.from(list);
  }, [evaluation, fieldValidation]);

  const redFlags = useMemo(() => {
    const flags = Array.isArray(evaluation?.redFlags) ? evaluation.redFlags : [];
    if (!hasExpectedAthleteBradycardia) return flags;
    return flags.filter((item) => String(item?.id || '').trim() !== 'fc_critica');
  }, [evaluation, hasExpectedAthleteBradycardia]);

  // Há o que as regras de red flag avaliam: PA completa, FC, glicemia ou
  // edema acima do grau 0 (o padrão do formulário). Sem isso, a contagem
  // não existe e o cartão mostra "—", nunca "0 alertas".
  const hasRedFlagInputs = useMemo(() => {
    const input = evaluation?.inputNormalized || {};
    return (Number.isFinite(input.systolic) && Number.isFinite(input.diastolic))
      || Number.isFinite(input.heartRate)
      || Number.isFinite(input.glucoseMgDl)
      || (Number.isFinite(input.edemaGrade) && input.edemaGrade > 0);
  }, [evaluation]);

  const heartRateClassification = useMemo(() => {
    if (!hasExpectedAthleteBradycardia) return evaluation?.classifications?.heartRate;
    return {
      label: 'Bradicardia fisiologica esperada em atletas',
      tone: 'info',
      source: 'Triagem esportiva'
    };
  }, [evaluation?.classifications?.heartRate, hasExpectedAthleteBradycardia]);

  const history = useMemo(
    () => normalizeClinicalHistory(moduleHistory),
    [moduleHistory]
  );
  const currentSnapshotId = moduleSnapshot?.id || '';
  const referenceHistory = useMemo(
    () => history.filter((item) => !currentSnapshotId || item.id !== currentSnapshotId),
    [currentSnapshotId, history]
  );
  const previous = referenceHistory[0] || null;
  const first = referenceHistory.length ? referenceHistory[referenceHistory.length - 1] : null;

  const comparisonRows = useMemo(() => ([
    createComparisonRow(
      'systolic',
      'PA sistolica',
      'mmHg',
      evaluation?.inputNormalized?.systolic,
      previous?.metrics?.systolic,
      first?.metrics?.systolic
    ),
    createComparisonRow(
      'diastolic',
      'PA diastolica',
      'mmHg',
      evaluation?.inputNormalized?.diastolic,
      previous?.metrics?.diastolic,
      first?.metrics?.diastolic
    ),
    createComparisonRow(
      'map',
      'PAM',
      'mmHg',
      evaluation?.derived?.meanArterialPressure,
      previous?.metrics?.map,
      first?.metrics?.map
    ),
    createComparisonRow(
      'heartRate',
      'Frequencia cardiaca',
      'bpm',
      evaluation?.inputNormalized?.heartRate,
      previous?.metrics?.heartRate,
      first?.metrics?.heartRate
    ),
    createComparisonRow(
      'glucose',
      'Glicemia capilar',
      'mg/dL',
      evaluation?.inputNormalized?.glucoseMgDl,
      previous?.metrics?.glucose,
      first?.metrics?.glucose
    )
  ]), [
    evaluation?.derived?.meanArterialPressure,
    evaluation?.inputNormalized?.diastolic,
    evaluation?.inputNormalized?.glucoseMgDl,
    evaluation?.inputNormalized?.heartRate,
    evaluation?.inputNormalized?.systolic,
    first?.metrics?.diastolic,
    first?.metrics?.glucose,
    first?.metrics?.heartRate,
    first?.metrics?.map,
    first?.metrics?.systolic,
    previous?.metrics?.diastolic,
    previous?.metrics?.glucose,
    previous?.metrics?.heartRate,
    previous?.metrics?.map,
    previous?.metrics?.systolic
  ]);

  const comparisonByKey = useMemo(
    () => Object.fromEntries(comparisonRows.map((row) => [row.key, row])),
    [comparisonRows]
  );

  const sparklineSystolic = useMemo(
    () => buildSparklineSeries(referenceHistory, 'systolic', evaluation?.inputNormalized?.systolic),
    [evaluation?.inputNormalized?.systolic, referenceHistory]
  );
  const sparklineHeartRate = useMemo(
    () => buildSparklineSeries(referenceHistory, 'heartRate', evaluation?.inputNormalized?.heartRate),
    [evaluation?.inputNormalized?.heartRate, referenceHistory]
  );

  const autoInterpretation = useMemo(
    () => buildClinicalInterpretation(comparisonRows, evaluation),
    [comparisonRows, evaluation]
  );

  const payloadData = useMemo(() => {
    const deltaSystolic = buildComparativeDeltas({
      current: evaluation?.inputNormalized?.systolic,
      reference: previous?.metrics?.systolic
    });
    const deltaDiastolic = buildComparativeDeltas({
      current: evaluation?.inputNormalized?.diastolic,
      reference: previous?.metrics?.diastolic
    });
    const deltaHeartRate = buildComparativeDeltas({
      current: evaluation?.inputNormalized?.heartRate,
      reference: previous?.metrics?.heartRate
    });
    const deltaGlucose = buildComparativeDeltas({
      current: evaluation?.inputNormalized?.glucoseMgDl,
      reference: previous?.metrics?.glucose
    });
    const esportivoPayload = buildClinicalEsportivoPayload(dados.esportivo);

    return {
      dataAvaliacao: normalizeDateValue(dados.dataAvaliacao),
      pressaoSistolica: numberOrNull(evaluation?.inputNormalized?.systolic, 0),
      pressaoDiastolica: numberOrNull(evaluation?.inputNormalized?.diastolic, 0),
      frequenciaCardiaca: numberOrNull(evaluation?.inputNormalized?.heartRate, 0),
      prioridadeCuidado: evaluation?.summary?.carePriority?.level || null,
      esportivo: esportivoPayload,
      dados_brutos: {
        systolic: numberOrNull(evaluation?.inputNormalized?.systolic, 0),
        diastolic: numberOrNull(evaluation?.inputNormalized?.diastolic, 0),
        heartRate: numberOrNull(evaluation?.inputNormalized?.heartRate, 0),
        temperatureC: numberOrNull(evaluation?.inputNormalized?.temperatureC, 1),
        glucoseMgDl: numberOrNull(evaluation?.inputNormalized?.glucoseMgDl, 0),
        glucoseContext: evaluation?.inputNormalized?.glucoseContext || 'nao_informado',
        edemaLocation: toTextInput(evaluation?.inputNormalized?.edemaLocation) || null,
        edemaGrade: numberOrNull(evaluation?.inputNormalized?.edemaGrade, 0),
        clinicalSigns: Array.isArray(evaluation?.inputNormalized?.clinicalSigns)
          ? evaluation.inputNormalized.clinicalSigns
          : [],
        clinicalSignsDetails: selectedClinicalSignsDetails,
        esportivo: esportivoPayload,
        observacoes: toTextInput(dados.observacoes) || null
      },
      resultados_calculados: {
        pressaoSistolica: numberOrNull(evaluation?.inputNormalized?.systolic, 0),
        pressaoDiastolica: numberOrNull(evaluation?.inputNormalized?.diastolic, 0),
        frequenciaCardiaca: numberOrNull(evaluation?.inputNormalized?.heartRate, 0),
        glicemiaCapilar: numberOrNull(evaluation?.inputNormalized?.glucoseMgDl, 0),
        pressaoArterialMedia: numberOrNull(evaluation?.derived?.meanArterialPressure, 1),
        pressaoPulso: numberOrNull(evaluation?.derived?.pulsePressure, 1),
        classificacaoPressaoArterial: evaluation?.classifications?.bloodPressure?.label || null,
        estagioPressaoArterial: evaluation?.classifications?.bloodPressure?.stage || null,
        classificacaoFrequenciaCardiaca: heartRateClassification?.label || null,
        bradicardiaFisiologica: hasExpectedAthleteBradycardia || null,
        classificacaoGlicemia: evaluation?.classifications?.glucose?.label || null,
        classificacaoEdema: evaluation?.classifications?.edema?.label || null,
        redFlags: redFlags.map((flag) => ({
          id: flag.id,
          label: flag.label,
          severity: flag.severity,
          source: flag.source,
          detail: flag.detail || null
        })),
        redFlagsCount: redFlags.length,
        sinaisCarenciaisCount: Array.isArray(evaluation?.inputNormalized?.clinicalSigns)
          ? evaluation.inputNormalized.clinicalSigns.length
          : 0,
        sintomasClinicosDetalhados: selectedClinicalSignsDetails,
        prioridadeCuidado: evaluation?.summary?.carePriority?.level || null,
        justificativaPrioridade: evaluation?.summary?.carePriority?.reason || null
      },
      classificacoes: {
        pressao_arterial: evaluation?.classifications?.bloodPressure?.label || null,
        frequencia_cardiaca: heartRateClassification?.label || null,
        glicemia: evaluation?.classifications?.glucose?.label || null,
        edema: evaluation?.classifications?.edema?.label || null,
        prioridade_cuidado: evaluation?.summary?.carePriority?.level || null,
        referencia: '7a Diretriz Brasileira de HAS (2016)'
      },
      metadados_formula: {
        formulaId: 'avaliacao_clinica_has_2016_redflags_v1',
        formulaVersion: '1.0.0',
        paReferencia: evaluation?.formulas?.bloodPressure || null,
        redFlagRule: evaluation?.formulas?.redFlags || null
      },
      comparacao: {
        referencia_comparacao: previous ? 'avaliacao_anterior' : null,
        delta_pas_mmhg: numberOrNull(deltaSystolic?.deltaAbs, 1),
        delta_pas_percentual: numberOrNull(deltaSystolic?.deltaPct, 2),
        delta_pad_mmhg: numberOrNull(deltaDiastolic?.deltaAbs, 1),
        delta_pad_percentual: numberOrNull(deltaDiastolic?.deltaPct, 2),
        delta_fc_bpm: numberOrNull(deltaHeartRate?.deltaAbs, 1),
        delta_fc_percentual: numberOrNull(deltaHeartRate?.deltaPct, 2),
        delta_glicemia_mgdl: numberOrNull(deltaGlucose?.deltaAbs, 1),
        delta_glicemia_percentual: numberOrNull(deltaGlucose?.deltaPct, 2)
      },
      source: {
        mode: 'calculado',
        system: 'avaliacao_clinica'
      },
      observacoes: toTextInput(dados.observacoes) || null
    };
  }, [
    dados.dataAvaliacao,
    dados.esportivo,
    dados.observacoes,
    evaluation,
    hasExpectedAthleteBradycardia,
    heartRateClassification,
    previous,
    redFlags,
    selectedClinicalSignsDetails
  ]);

  const payloadResults = useMemo(() => ({
    pressao_sistolica: payloadData?.pressaoSistolica ?? null,
    pressao_diastolica: payloadData?.pressaoDiastolica ?? null,
    frequencia_cardiaca: payloadData?.frequenciaCardiaca ?? null,
    prioridade_cuidado: payloadData?.prioridadeCuidado ?? null,
    red_flags_count: payloadData?.resultados_calculados?.redFlagsCount ?? 0,
    output: {
      classificacaoPressaoArterial: payloadData?.resultados_calculados?.classificacaoPressaoArterial ?? null,
      prioridadeCuidado: payloadData?.prioridadeCuidado ?? null
    },
    comparacao: payloadData?.comparacao || {}
  }), [payloadData]);

  const hasValues = useMemo(() => (
    toTextInput(dados.systolic) !== ''
    || toTextInput(dados.diastolic) !== ''
    || toTextInput(dados.heartRate) !== ''
    || toTextInput(dados.temperatureC) !== ''
    || toTextInput(dados.glucoseMgDl) !== ''
    || toTextInput(dados.edemaLocation) !== ''
    || hasClinicalEsportivoValues(dados.esportivo)
    || toTextInput(dados.observacoes) !== ''
    || (Array.isArray(dados.clinicalSigns) && dados.clinicalSigns.length > 0)
  ), [
    dados.clinicalSigns,
    dados.diastolic,
    dados.edemaLocation,
    dados.esportivo,
    dados.glucoseMgDl,
    dados.heartRate,
    dados.observacoes,
    dados.systolic,
    dados.temperatureC
  ]);

  const dispatchSave = useCallback(async (auto = false) => {
    const dispatch = auto ? onAutoSave : onSalvar;
    if (!dispatch) return;

    await dispatch({
      tipo: 'avaliacao_clinica',
      dados: payloadData,
      resultados: payloadResults,
      data: dados.dataAvaliacao,
      pacienteId,
      schemaVersion: 1,
      formulaId: 'avaliacao_clinica_has_2016_redflags_v1',
      formulaVersion: '1.0.0',
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
        setError('Nao foi possivel salvar a avaliacao. Tente novamente.');
      }
    }
  }, [dispatchSave]);

  const handleSubmit = useCallback(async () => {
    if (!onSalvar) return;
    setSubmitAttempted(true);
    setError('');

    if (!hasValues) {
      setError('Preencha ao menos os sinais vitais principais para salvar a avaliacao clinica.');
      return;
    }

    if (hasRequiredMissing) {
      setError('PA sistolica, PA diastolica e frequencia cardiaca sao obrigatorias.');
      return;
    }

    if (hasFieldErrors) {
      setError('Existem campos com erro de validacao. Revise os valores destacados.');
      return;
    }

    if (warnings.length > 0) {
      const proceed = await confirm({
        title: 'Valores fora da faixa fisiológica',
        details: warnings,
        confirmLabel: 'Salvar mesmo assim',
        cancelLabel: 'Corrigir',
        variant: 'warning'
      });
      if (!proceed) return;
    }

    await executeSave(false);
  }, [confirm, executeSave, hasFieldErrors, hasRequiredMissing, hasValues, onSalvar, warnings]);

  useEffect(() => {
    if (readOnly || !onAutoSave || !hasUserInput) return undefined;
    if (!hasValues || hasFieldErrors || hasRequiredMissing) return undefined;

    clearTimeout(autoSaveRef.current);
    autoSaveRef.current = setTimeout(() => {
      executeSave(true);
    }, 3500);

    return () => clearTimeout(autoSaveRef.current);
  }, [
    executeSave,
    hasFieldErrors,
    hasRequiredMissing,
    hasUserInput,
    hasValues,
    onAutoSave,
    readOnly
  ]);

  const redFlagTone = redFlags.some((item) => item.severity === 'danger') ? 'danger' : 'warning';

  return (
    <AvaliacaoModulo
      className={`eval-card clinica-form clinica-form--modern${readOnly ? ' eval-card--readonly' : ''}`}
      titulo="Avaliacao clinica"
      descricao="Triagem de sinais vitais, classificacao automatica de PA e alertas clinicos de seguranca."
      icone={<Heart size={20} />}
    >
      <AvaliacaoIndice itens={CLINICA_INDICE} />

      {onboardingInsights.length ? (
        <AvisoAvaliacao tipo="info">
          <strong>Contexto do onboarding:</strong> {onboardingInsights.join(' - ')}
        </AvisoAvaliacao>
      ) : null}

      <AvaliacaoSecao id="clinica-sinais" titulo="Sinais vitais" className="eval-section eval-section--primary">
        <div className="av-grade">
          <Campo rotulo="Data da avaliacao" className="eval-field">
            <input
              type="date"
              className="eval-input"
              value={dados.dataAvaliacao}
              onChange={(event) => handleFieldValueChange(setDados, setHasUserInput, 'dataAvaliacao', event.target.value)}
              disabled={readOnly}
            />
          </Campo>

          <NumericField
            label="PA sistolica"
            unit="mmHg"
            required
            value={dados.systolic}
            placeholder="Ex.: 120"
            disabled={readOnly}
            isInvalid={shouldShowMessage(submitAttempted, touchedFields.systolic) && fieldValidation.systolic.status === 'error'}
            isWarning={shouldShowMessage(submitAttempted, touchedFields.systolic) && fieldValidation.systolic.status === 'warning'}
            message={shouldShowMessage(submitAttempted, touchedFields.systolic) ? fieldValidation.systolic.message : ''}
            tooltipLines={[
              'Pressao arterial sistolica (maxima).',
              'Classificacao por diretriz brasileira de hipertensao.'
            ]}
            onChange={(value) => handleFieldValueChange(setDados, setHasUserInput, 'systolic', value)}
            onBlur={() => markTouched(setTouchedFields, 'systolic')}
            className="eval-field--critical"
          />

          <NumericField
            label="PA diastolica"
            unit="mmHg"
            required
            value={dados.diastolic}
            placeholder="Ex.: 80"
            disabled={readOnly}
            isInvalid={shouldShowMessage(submitAttempted, touchedFields.diastolic) && fieldValidation.diastolic.status === 'error'}
            isWarning={shouldShowMessage(submitAttempted, touchedFields.diastolic) && fieldValidation.diastolic.status === 'warning'}
            message={shouldShowMessage(submitAttempted, touchedFields.diastolic) ? fieldValidation.diastolic.message : ''}
            tooltipLines={[
              'Pressao arterial diastolica (minima).',
              'Classificacao por diretriz brasileira de hipertensao.'
            ]}
            onChange={(value) => handleFieldValueChange(setDados, setHasUserInput, 'diastolic', value)}
            onBlur={() => markTouched(setTouchedFields, 'diastolic')}
            className="eval-field--critical"
          />

          <NumericField
            label="Frequencia cardiaca"
            unit="bpm"
            required
            value={dados.heartRate}
            placeholder="Ex.: 72"
            disabled={readOnly}
            isInvalid={shouldShowMessage(submitAttempted, touchedFields.heartRate) && fieldValidation.heartRate.status === 'error'}
            isWarning={shouldShowMessage(submitAttempted, touchedFields.heartRate) && fieldValidation.heartRate.status === 'warning'}
            message={shouldShowMessage(submitAttempted, touchedFields.heartRate) ? fieldValidation.heartRate.message : ''}
            tooltipLines={[
              'Frequencia cardiaca de repouso.',
              'Red flag: < 40 bpm ou > 120 bpm.'
            ]}
            onChange={(value) => handleFieldValueChange(setDados, setHasUserInput, 'heartRate', value)}
            onBlur={() => markTouched(setTouchedFields, 'heartRate')}
          />

          {hasExpectedAthleteBradycardia && (
            <div className="eval-field eval-field-full">
              <AvisoAvaliacao tipo="info" className="clinica-athlete-badge">Bradicardia fisiologica esperada em atletas</AvisoAvaliacao>
            </div>
          )}
        </div>
      </AvaliacaoSecao>

      <AvaliacaoSecao id="clinica-resultados" titulo="Resultados calculados" className="eval-section">
        <div className="av-resultados">
          <ResultCard
            title="Pressao arterial"
            valueDisplay={formatPressure(
              evaluation?.inputNormalized?.systolic,
              evaluation?.inputNormalized?.diastolic
            )}
            classification={evaluation?.classifications?.bloodPressure}
            delta={comparisonByKey?.systolic?.delta}
            tooltipInfo={INDICATOR_INFO.bloodPressure}
          />
          <ResultCard
            title="PAM"
            valueDisplay={formatMetricValue(evaluation?.derived?.meanArterialPressure, 'mmHg', 1)}
            classification={evaluation?.classifications?.bloodPressure}
            delta={comparisonByKey?.map?.delta}
            tooltipInfo={INDICATOR_INFO.map}
          />
          <ResultCard
            title="Pressao de pulso"
            valueDisplay={formatMetricValue(evaluation?.derived?.pulsePressure, 'mmHg', 1)}
            classification={evaluation?.classifications?.bloodPressure}
            tooltipInfo={INDICATOR_INFO.pulsePressure}
          />
          <ResultCard
            title="Frequencia cardiaca"
            valueDisplay={formatMetricValue(evaluation?.inputNormalized?.heartRate, 'bpm', 0)}
            classification={heartRateClassification}
            delta={comparisonByKey?.heartRate?.delta}
            tooltipInfo={INDICATOR_INFO.heartRate}
          />
          <ResultCard
            title="Glicemia capilar"
            valueDisplay={formatMetricValue(evaluation?.inputNormalized?.glucoseMgDl, 'mg/dL', 0)}
            classification={evaluation?.classifications?.glucose}
            delta={comparisonByKey?.glucose?.delta}
            tooltipInfo={INDICATOR_INFO.glucose}
          />
          <ResultCard
            title="Red flags"
            valueDisplay={redFlags.length > 0 || hasRedFlagInputs
              ? formatMetricValue(redFlags.length, 'alertas', 0)
              : null}
            classification={{
              label: redFlags.length > 0
                ? `${redFlags.length} alerta(s)`
                : hasRedFlagInputs ? 'Sem alertas' : 'Sem dados',
              tone: redFlags.length > 0 ? redFlagTone : hasRedFlagInputs ? 'success' : 'neutral',
              source: 'Regras de triagem'
            }}
            tooltipInfo={INDICATOR_INFO.redFlags}
          />
        </div>

        {redFlags.length ? (
          <div className="clinica-flag-list">
            {redFlags.map((flag) => (
              <AvisoAvaliacao
                key={flag.id}
                tipo={RED_FLAG_TIPO_AVISO[flag.severity] || 'atencao'}
                className={`clinica-flag-item severity-${flag.severity}`}
              >
                <strong>{flag.label}</strong>
                <small>{flag.detail || flag.source}</small>
              </AvisoAvaliacao>
            ))}
          </div>
        ) : (
          <AvisoAvaliacao tipo="info">Sem red flags clinicas para a avaliacao atual.</AvisoAvaliacao>
        )}

        <AvaliacaoSecao titulo="Comparacao longitudinal" className="clinica-comparison">
          <div className="clinica-table-wrap">
            <table className="clinica-table">
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
                    <td>{formatMetricValue(row.current, row.unit, row.digits)}</td>
                    <td>{formatMetricValue(row.previous, row.unit, row.digits)}</td>
                    <td>{formatMetricValue(row.first, row.unit, row.digits)}</td>
                    <td className={resolveDeltaClass(row.delta?.deltaAbs)}>
                      {formatSigned(row.delta?.deltaAbs, row.unit, row.digits)}
                    </td>
                    <td className={resolveDeltaClass(row.delta?.deltaPct)}>
                      {formatSigned(row.delta?.deltaPct, '%', 2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="clinica-sparklines">
            <SparklineCard label="PA sistolica (ultimos 6)" values={sparklineSystolic} />
            <SparklineCard label="Frequencia cardiaca (ultimos 6)" values={sparklineHeartRate} />
          </div>
          <p className="clinica-interpretation">{autoInterpretation}</p>
        </AvaliacaoSecao>
      </AvaliacaoSecao>

      <AvaliacaoSecao id="clinica-opcionais" titulo="Dados opcionais" className="eval-section">
        {/* Os dois grupos de antes viram subseções (h5), com o mesmo texto do
            rótulo de grupo e a mesma classe .eval-field-group. */}
        <AvaliacaoSecao titulo="Glicemia capilar" className="eval-field-group">
          <div className="eval-field-group__grid">
            <NumericField
              label="Glicemia capilar"
              unit="mg/dL"
              optional
              value={dados.glucoseMgDl}
              placeholder="Ex.: 92"
              disabled={readOnly}
              isInvalid={shouldShowMessage(submitAttempted, touchedFields.glucoseMgDl) && fieldValidation.glucoseMgDl.status === 'error'}
              isWarning={shouldShowMessage(submitAttempted, touchedFields.glucoseMgDl) && fieldValidation.glucoseMgDl.status === 'warning'}
              message={shouldShowMessage(submitAttempted, touchedFields.glucoseMgDl) ? fieldValidation.glucoseMgDl.message : ''}
              tooltipLines={[
                'Informe em mg/dL.',
                'Se em jejum e > 200 mg/dL, gera alerta critico.'
              ]}
              onChange={(value) => handleFieldValueChange(setDados, setHasUserInput, 'glucoseMgDl', value)}
              onBlur={() => markTouched(setTouchedFields, 'glucoseMgDl')}
            />

            <SelectField
              label="Contexto da glicemia"
              optional
              value={dados.glucoseContext}
              options={GLUCOSE_CONTEXT_OPTIONS}
              disabled={readOnly}
              tooltipLines={['Utilizado para classificar o resultado glicemico automaticamente.']}
              onChange={(value) => handleFieldValueChange(setDados, setHasUserInput, 'glucoseContext', value)}
            />
          </div>
        </AvaliacaoSecao>

        <AvaliacaoSecao titulo="Exame físico" className="eval-field-group">
          <div className="eval-field-group__grid">
            <NumericField
              label="Temperatura"
              unit="degC"
              optional
              value={dados.temperatureC}
              placeholder="Ex.: 36.4"
              disabled={readOnly}
              isInvalid={shouldShowMessage(submitAttempted, touchedFields.temperatureC) && fieldValidation.temperatureC.status === 'error'}
              isWarning={shouldShowMessage(submitAttempted, touchedFields.temperatureC) && fieldValidation.temperatureC.status === 'warning'}
              message={shouldShowMessage(submitAttempted, touchedFields.temperatureC) ? fieldValidation.temperatureC.message : ''}
              tooltipLines={['Temperatura corporal periferica.']}
              onChange={(value) => handleFieldValueChange(setDados, setHasUserInput, 'temperatureC', value)}
              onBlur={() => markTouched(setTouchedFields, 'temperatureC')}
            />

            <Campo
              rotulo={(
                <>
                  Local do edema
                  <span className="clinica-optional-badge">Opcional</span>
                </>
              )}
              dica={{ texto: ['Registre local predominante do edema (MMII, sacral, etc.).'], rotulo: ROTULO_DICA }}
              className="eval-field"
            >
              <input
                type="text"
                className="eval-input"
                value={dados.edemaLocation}
                onChange={(event) => handleFieldValueChange(setDados, setHasUserInput, 'edemaLocation', event.target.value)}
                disabled={readOnly}
                placeholder="Ex.: Membros inferiores"
              />
            </Campo>

            <SelectField
              label="Grau de edema"
              optional
              value={dados.edemaGrade}
              options={EDEMA_GRADE_OPTIONS}
              disabled={readOnly}
              tooltipLines={[
                'Escala semiologica de edema.',
                'Red flag amarelo para grau 3+ ou maior.'
              ]}
              isInvalid={shouldShowMessage(submitAttempted, touchedFields.edemaGrade) && fieldValidation.edemaGrade.status === 'error'}
              isWarning={shouldShowMessage(submitAttempted, touchedFields.edemaGrade) && fieldValidation.edemaGrade.status === 'warning'}
              message={shouldShowMessage(submitAttempted, touchedFields.edemaGrade) ? fieldValidation.edemaGrade.message : ''}
              onChange={(value) => {
                handleFieldValueChange(setDados, setHasUserInput, 'edemaGrade', value);
                markTouched(setTouchedFields, 'edemaGrade');
              }}
            />

            <div className="eval-field eval-field-full">
              <GrupoOpcoes
                legenda={(
                  <>
                    Sinais e sintomas clinico-nutricionais
                    <span className="clinica-optional-badge">Opcional</span>
                  </>
                )}
                dica={{
                  texto: [
                    'Checklist semiologico para rastreio clinico-nutricional.',
                    'As relacoes de deficiencia/excesso sao sinais de triagem, nao diagnostico isolado.'
                  ],
                  rotulo: ROTULO_DICA
                }}
                className="clinica-sinais"
              >
                {CLINICAL_SIGN_OPTIONS.map((item) => (
                  <Opcao
                    key={item.value}
                    tipo="checkbox"
                    className="clinica-sign-item"
                    rotulo={item.label}
                    descricao={(
                      <>
                        {item.nutrientDeficiency ? (
                          <small>Deficiencia: {item.nutrientDeficiency}</small>
                        ) : null}
                        {item.nutrientExcess ? (
                          <small>Excesso: {item.nutrientExcess}</small>
                        ) : null}
                      </>
                    )}
                    checked={dados.clinicalSigns.includes(item.value)}
                    onChange={() => toggleStringArray(setDados, setHasUserInput, 'clinicalSigns', item.value)}
                    disabled={readOnly}
                  />
                ))}
              </GrupoOpcoes>
              {selectedClinicalSignsDetails.length ? (
                <p className="clinica-sign-summary">
                  {selectedClinicalSignsDetails.length} sinal(is)/sintoma(s) selecionado(s) para compor a triagem clinico-nutricional.
                </p>
              ) : null}
            </div>
          </div>
        </AvaliacaoSecao>
      </AvaliacaoSecao>

      <AvaliacaoSecao id="clinica-esportivo" titulo="Contexto esportivo" className="eval-section">
        <div className="av-grade">
          <NumericField
            label="VO2max estimado"
            unit="mL/kg/min"
            optional
            value={dados.esportivo.vo2maxEstimado}
            placeholder="Ex.: 48.5"
            disabled={readOnly}
            tooltipLines={['Parametro opcional para triagem esportiva.']}
            onChange={(value) => updateEsportivoField(setDados, setHasUserInput, 'vo2maxEstimado', value)}
          />

          <NumericField
            label="Taxa de sudorese"
            unit="mL/h"
            optional
            value={dados.esportivo.taxaSudorese}
            placeholder="Ex.: 850"
            disabled={readOnly}
            tooltipLines={['Taxa media estimada de perda hidrica em treino.']}
            onChange={(value) => updateEsportivoField(setDados, setHasUserInput, 'taxaSudorese', value)}
          />

          <NumericField
            label="Preensao palmar direita"
            unit="kgf"
            optional
            value={dados.esportivo.forcaPreensaoPalmar.direita}
            placeholder="Ex.: 42.0"
            disabled={readOnly}
            tooltipLines={['Dinamometria palmar - lado direito.']}
            onChange={(value) => updateEsportivoGrip(setDados, setHasUserInput, 'direita', value)}
          />

          <NumericField
            label="Preensao palmar esquerda"
            unit="kgf"
            optional
            value={dados.esportivo.forcaPreensaoPalmar.esquerda}
            placeholder="Ex.: 39.8"
            disabled={readOnly}
            tooltipLines={['Dinamometria palmar - lado esquerdo.']}
            onChange={(value) => updateEsportivoGrip(setDados, setHasUserInput, 'esquerda', value)}
          />
        </div>
      </AvaliacaoSecao>

      <AvaliacaoSecao id="clinica-observacoes" titulo="Observacoes clinicas" className="eval-section">
        {/* A área não tinha rótulo, só o título da seção: o mesmo texto vira
            rótulo para o leitor de tela. Sem .eval-field, como antes. */}
        <Campo rotulo="Observacoes clinicas" rotuloOculto>
          <textarea
            className="eval-textarea"
            value={dados.observacoes}
            onChange={(event) => handleFieldValueChange(setDados, setHasUserInput, 'observacoes', event.target.value)}
            disabled={readOnly}
            placeholder="Anote conduta, orientacoes e encaminhamentos complementares."
          />
        </Campo>
      </AvaliacaoSecao>

      <BarraAcoesAvaliacao status={saveStatus}>
        <Button type="button" variant="primary" onClick={handleSubmit} disabled={readOnly} loading={saveStatus === 'saving'}>
          Salvar avaliacao clinica
        </Button>
      </BarraAcoesAvaliacao>

      {error ? <AvisoAvaliacao tipo="perigo" anunciar className="clinica-error-note">{error}</AvisoAvaliacao> : null}
    </AvaliacaoModulo>
  );
};

export default AvaliacaoClinicaForm;

// Mesma assinatura. A unidade sai do rótulo para a caixa ao lado do campo;
// `required` continua no input (o modo essencial conta [required]) e o
// rótulo passa a escrever "obrigatório". A mensagem é a mesma de antes: o
// erro vai em `erro` e o aviso de faixa fisiológica, em `ajuda`.
const NumericField = ({
  label,
  unit,
  value,
  placeholder,
  disabled,
  required = false,
  optional = false,
  isInvalid = false,
  isWarning = false,
  message = '',
  tooltipLines = [],
  onChange,
  onBlur,
  className = ''
}) => (
  <Campo
    rotulo={(
      <>
        {label}
        {optional ? <span className="clinica-optional-badge">Opcional</span> : null}
      </>
    )}
    dica={{ texto: tooltipLines, rotulo: ROTULO_DICA }}
    unidade={unit}
    obrigatorio={required}
    erro={message && isInvalid ? message : undefined}
    ajuda={message && !isInvalid ? message : undefined}
    className={`eval-field${className ? ` ${className}` : ''}`}
  >
    <input
      type="text"
      inputMode="decimal"
      className={`eval-input ${isInvalid ? 'clinica-input-invalid' : ''} ${isWarning ? 'clinica-input-warning' : ''}`}
      value={value}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
      onBlur={onBlur}
      disabled={disabled}
      required={required}
      aria-invalid={isInvalid ? 'true' : 'false'}
    />
  </Campo>
);

const SelectField = ({
  label,
  value,
  options = [],
  disabled,
  optional = false,
  tooltipLines = [],
  isInvalid = false,
  isWarning = false,
  message = '',
  onChange
}) => (
  <Campo
    rotulo={(
      <>
        {label}
        {optional ? <span className="clinica-optional-badge">Opcional</span> : null}
      </>
    )}
    dica={{ texto: tooltipLines, rotulo: ROTULO_DICA }}
    erro={message && isInvalid ? message : undefined}
    ajuda={message && !isInvalid ? message : undefined}
    className="eval-field"
  >
    <select
      className={`eval-select ${isInvalid ? 'clinica-input-invalid' : ''} ${isWarning ? 'clinica-input-warning' : ''}`}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      disabled={disabled}
      aria-invalid={isInvalid ? 'true' : 'false'}
    >
      {options.map((item) => (
        <option key={item.value} value={item.value}>{item.label}</option>
      ))}
    </select>
  </Campo>
);

// Nome do botão "?" (o aria-label de antes). A dica agora é da base: um
// botão de 44 px fora do <label> e da legenda, com o mesmo texto.
const ROTULO_DICA = 'Abrir informacao';

const ResultCard = ({
  title,
  valueDisplay,
  classification,
  delta,
  tooltipInfo
}) => {
  const tone = resolveTone(classification?.tone);
  // O valor já chega formatado (formatPressure/formatMetricValue, com a
  // unidade no texto); '--' era a ausência e vira "—". A classificação
  // continua escrita ("Sem classificacao" quando não há) e o tom só acompanha
  // uma classificação de verdade. A variação vai no texto de apoio.
  return (
    <ResultadoCalculado
      className="clinica-result-card"
      rotulo={title}
      dica={{
        texto: [
          tooltipInfo?.name || 'Indicador',
          `Formula: ${tooltipInfo?.formula || 'N/A'}`,
          `Referencia: ${tooltipInfo?.reference || 'N/A'}`,
          `Ano/Fonte: ${tooltipInfo?.year || 'N/A'}`
        ],
        rotulo: ROTULO_DICA
      }}
      valor={valueDisplay && valueDisplay !== '--' ? valueDisplay : null}
      classificacao={classification?.label || 'Sem classificacao'}
      tom={classification?.label ? tone : 'neutral'}
      referencia={classification?.source || undefined}
      metodo={delta && Number.isFinite(delta.deltaAbs) ? (
        <span className={`clinica-delta ${resolveDeltaClass(delta.deltaAbs)}`}>
          {formatSigned(delta.deltaAbs, '', 1)}
          {Number.isFinite(delta.deltaPct) ? ` (${formatSigned(delta.deltaPct, '%', 2)})` : ''}
        </span>
      ) : null}
    />
  );
};

// A mesma série e o mesmo tamanho de antes; sem linha de referência, como antes.
const SparklineCard = ({ label, values = [] }) => (
  <Tendencia rotulo={label} valores={values} largura={220} altura={72} className="clinica-sparkline-card" />
);

function handleFieldValueChange(setDados, setHasUserInput, key, value) {
  setHasUserInput(true);
  setDados((prev) => ({ ...prev, [key]: value }));
}

function updateEsportivoField(setDados, setHasUserInput, key, value) {
  setHasUserInput(true);
  setDados((prev) => ({
    ...prev,
    esportivo: {
      ...(prev?.esportivo || createClinicalEsportivoData()),
      [key]: value
    }
  }));
}

function updateEsportivoGrip(setDados, setHasUserInput, lado, value) {
  setHasUserInput(true);
  setDados((prev) => ({
    ...prev,
    esportivo: {
      ...(prev?.esportivo || createClinicalEsportivoData()),
      forcaPreensaoPalmar: {
        ...(prev?.esportivo?.forcaPreensaoPalmar || {}),
        [lado]: value
      }
    }
  }));
}

function markTouched(setTouchedFields, field) {
  setTouchedFields((prev) => ({ ...prev, [field]: true }));
}

function shouldShowMessage(submitAttempted, touched) {
  return Boolean(submitAttempted || touched);
}

function toggleStringArray(setDados, setHasUserInput, key, value) {
  setHasUserInput(true);
  setDados((prev) => {
    const current = Array.isArray(prev[key]) ? prev[key] : [];
    return current.includes(value)
      ? { ...prev, [key]: current.filter((item) => item !== value) }
      : { ...prev, [key]: [...current, value] };
  });
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

function asRecord(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value;
}

function buildClinicalEsportivoPayload(esportivo) {
  const source = asRecord(esportivo);
  const grip = asRecord(source.forcaPreensaoPalmar);

  return {
    vo2maxEstimado: numberOrNull(parseNumeric(source.vo2maxEstimado), 1),
    taxaSudorese: numberOrNull(parseNumeric(source.taxaSudorese), 0),
    forcaPreensaoPalmar: {
      direita: numberOrNull(parseNumeric(grip.direita), 1),
      esquerda: numberOrNull(parseNumeric(grip.esquerda), 1)
    }
  };
}

function hasClinicalEsportivoValues(esportivo) {
  const payload = buildClinicalEsportivoPayload(esportivo);
  if (Number.isFinite(payload.vo2maxEstimado)) return true;
  if (Number.isFinite(payload.taxaSudorese)) return true;
  return Object.values(payload.forcaPreensaoPalmar || {}).some((value) => Number.isFinite(value));
}

function buildClinicalOnboardingInsights(onboardingContext) {
  if (!onboardingContext || typeof onboardingContext !== 'object') return [];
  const insights = [];
  const modalidade = toTextInput(onboardingContext?.modalidadePrincipal);
  const frequencia = parseNumeric(onboardingContext?.frequenciaSemanal);
  const duracao = parseNumeric(onboardingContext?.duracaoSessao);
  const status = toTextInput(onboardingContext?.status);

  if (modalidade) insights.push(`Modalidade: ${modalidade}`);
  if (Number.isFinite(frequencia)) insights.push(`Frequencia: ${frequencia}x/sem`);
  if (Number.isFinite(duracao)) insights.push(`Duracao media: ${duracao} min`);
  if (status) insights.push(`Status: ${status}`);

  return insights.slice(0, 4);
}

function resolveAthletePatient(patient, onboardingContext) {
  if (patient && typeof patient === 'object') {
    const roleToken = String(patient?.role || patient?.perfil || '').trim().toLowerCase();
    if (roleToken === 'atleta' || roleToken === 'athlete') return true;
    if (patient?.atletaUserId || patient?.athleteUserId) return true;
  }
  const modality = String(
    patient?.modalidade
    || patient?.modalidadePrincipal
    || onboardingContext?.modalidadePrincipal
    || onboardingContext?.raw?.atividadeFisica
    || ''
  ).trim();
  if (modality) return true;
  return false;
}

function firstDefined(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return null;
}

function normalizeDateValue(value) {
  if (!value) return toLocalDateInputValue(new Date());
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) return value.trim();
  const date = resolveDate(value);
  if (!date) return toLocalDateInputValue(new Date());
  return toLocalDateInputValue(date);
}

function resolveDate(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value?.toDate === 'function') {
    const converted = value.toDate();
    return Number.isNaN(converted?.getTime?.()) ? null : converted;
  }
  if (typeof value?.seconds === 'number') {
    const dateFromSeconds = new Date(value.seconds * 1000);
    return Number.isNaN(dateFromSeconds.getTime()) ? null : dateFromSeconds;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalizeStringArray(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || '').trim()).filter(Boolean);
  }
  const token = toTextInput(value);
  if (!token) return [];
  return token.split(/[,\n;]+/g).map((item) => item.trim()).filter(Boolean);
}

function buildClinicalSignsDetails(values = []) {
  return normalizeStringArray(values).map((value) => {
    const option = CLINICAL_SIGN_OPTIONS.find((item) => item.value === value);
    return {
      value,
      label: option?.label || value,
      nutrientDeficiency: option?.nutrientDeficiency || null,
      nutrientExcess: option?.nutrientExcess || null,
      source: option?.source || null
    };
  });
}

function validateNumericField({
  value,
  label,
  required = false,
  min = null,
  max = null
}) {
  const text = toTextInput(value);
  if (!text) {
    if (required) return { status: 'error', message: 'Campo obrigatorio.' };
    return { status: 'empty', message: '' };
  }

  const numeric = parseNumeric(value);
  if (!Number.isFinite(numeric)) {
    return { status: 'error', message: 'Informe um numero valido.' };
  }

  if (Number.isFinite(min) && numeric < min) {
    return {
      status: 'warning',
      message: `${label} abaixo da faixa fisiologica. Verifique o valor informado.`
    };
  }
  if (Number.isFinite(max) && numeric > max) {
    return {
      status: 'warning',
      message: `${label} acima da faixa fisiologica. Verifique o valor informado.`
    };
  }

  return { status: 'ok', message: '' };
}

function numberOrNull(value, digits = null) {
  if (!Number.isFinite(value)) return null;
  if (!Number.isFinite(digits)) return Number(value);
  return Number(Number(value).toFixed(digits));
}

function resolveTone(tone) {
  if (tone === 'success') return 'success';
  if (tone === 'warning') return 'warning';
  if (tone === 'danger') return 'danger';
  if (tone === 'info') return 'info';
  return 'neutral';
}

function formatNumber(value, digits = 1) {
  if (!Number.isFinite(value)) return '--';
  return Number(value).toLocaleString('pt-BR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  });
}

function formatMetricValue(value, unit = '', digits = 1) {
  if (!Number.isFinite(value)) return '--';
  return `${formatNumber(value, digits)}${unit ? ` ${unit}` : ''}`;
}

function formatPressure(systolic, diastolic) {
  if (!Number.isFinite(systolic) || !Number.isFinite(diastolic)) return '--';
  return `${formatNumber(systolic, 0)}/${formatNumber(diastolic, 0)} mmHg`;
}

function formatSigned(value, unit = '', digits = 1) {
  if (!Number.isFinite(value)) return '--';
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
    digits: unit === '%' ? 2 : 1,
    current: Number.isFinite(current) ? current : null,
    previous: Number.isFinite(previous) ? previous : null,
    first: Number.isFinite(first) ? first : null,
    delta: buildComparativeDeltas({ current, reference: previous })
  };
}

function buildSparklineSeries(records = [], metricKey, currentValue) {
  const values = [];
  records
    .slice()
    .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0))
    .forEach((item) => {
      const metric = item?.metrics?.[metricKey];
      if (Number.isFinite(metric)) values.push(metric);
    });
  if (Number.isFinite(currentValue)) values.push(currentValue);
  return values.slice(-6);
}

function buildClinicalInterpretation(rows = [], evaluation = null) {
  if (!Array.isArray(rows) || !rows.length) {
    return 'Sem dados suficientes para interpretacao automatica.';
  }

  const systolicRow = rows.find((item) => item.key === 'systolic');
  if (systolicRow && Number.isFinite(systolicRow?.delta?.deltaAbs) && Math.abs(systolicRow.delta.deltaAbs) >= 1) {
    const direction = systolicRow.delta.deltaAbs > 0 ? 'aumentou' : 'reduziu';
    return `PA sistolica ${direction} ${formatNumber(Math.abs(systolicRow.delta.deltaAbs), 1)} mmHg em relacao a ultima avaliacao.`;
  }

  const heartRow = rows.find((item) => item.key === 'heartRate');
  if (heartRow && Number.isFinite(heartRow?.delta?.deltaAbs) && Math.abs(heartRow.delta.deltaAbs) >= 1) {
    const direction = heartRow.delta.deltaAbs > 0 ? 'aumentou' : 'reduziu';
    return `Frequencia cardiaca ${direction} ${formatNumber(Math.abs(heartRow.delta.deltaAbs), 1)} bpm em relacao a ultima avaliacao.`;
  }

  const carePriority = evaluation?.summary?.carePriority?.level;
  if (carePriority === 'alta') {
    return 'Foram detectados sinais criticos. Recomenda-se avaliacao medica imediata.';
  }
  if (carePriority === 'moderada') {
    return 'Ha sinais de atencao clinica que exigem acompanhamento proximo.';
  }
  return 'Sem variacoes relevantes em relacao a ultima avaliacao.';
}

function normalizeClinicalHistory(records = []) {
  if (!Array.isArray(records)) return [];
  return records
    .map((record) => {
      const date = resolveDate(record?.updatedAt || record?.createdAt || record?.data);
      const timestamp = date ? date.getTime() : 0;
      return {
        id: record?.id || '',
        timestamp,
        metrics: resolveClinicalMetrics(record)
      };
    })
    .filter((entry) => hasAnyClinicalMetric(entry.metrics))
    .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
}

function hasAnyClinicalMetric(metrics = {}) {
  return ['systolic', 'diastolic', 'map', 'heartRate', 'glucose'].some((key) => Number.isFinite(metrics[key]));
}

function resolveClinicalMetrics(record) {
  const dados = record?.dados || {};
  const dadosBrutos = dados?.dados_brutos || dados?.input || {};
  const calculated = dados?.resultados_calculados || {};

  const systolic = parseNumeric(firstDefined(
    calculated?.pressaoSistolica,
    dados?.pressaoSistolica,
    dados?.pressao_sistolica,
    dadosBrutos?.systolic,
    dadosBrutos?.pressaoSistolica,
    dadosBrutos?.pressao_sistolica,
    record?.resultados?.pressao_sistolica
  ));

  const diastolic = parseNumeric(firstDefined(
    calculated?.pressaoDiastolica,
    dados?.pressaoDiastolica,
    dados?.pressao_diastolica,
    dadosBrutos?.diastolic,
    dadosBrutos?.pressaoDiastolica,
    dadosBrutos?.pressao_diastolica,
    record?.resultados?.pressao_diastolica
  ));

  const map = parseNumeric(firstDefined(
    calculated?.pressaoArterialMedia,
    dados?.pressaoArterialMedia,
    dados?.pressao_arterial_media,
    record?.resultados?.pressao_arterial_media
  ));

  const heartRate = parseNumeric(firstDefined(
    calculated?.frequenciaCardiaca,
    dados?.frequenciaCardiaca,
    dados?.frequencia_cardiaca,
    dadosBrutos?.heartRate,
    dadosBrutos?.frequenciaCardiaca,
    dadosBrutos?.frequencia_cardiaca,
    record?.resultados?.frequencia_cardiaca
  ));

  const glucose = parseNumeric(firstDefined(
    calculated?.glicemiaCapilar,
    dados?.glicemiaCapilar,
    dados?.glicemia_capilar,
    dadosBrutos?.glucoseMgDl,
    dadosBrutos?.glicemiaCapilar,
    dadosBrutos?.glicemia_capilar,
    record?.resultados?.glicemia_capilar
  ));

  return {
    systolic: Number.isFinite(systolic) ? systolic : null,
    diastolic: Number.isFinite(diastolic) ? diastolic : null,
    map: Number.isFinite(map) ? map : null,
    heartRate: Number.isFinite(heartRate) ? heartRate : null,
    glucose: Number.isFinite(glucose) ? glucose : null
  };
}

