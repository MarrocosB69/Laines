import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Activity, AlertTriangle } from 'lucide-react';
import MiniSparkline from '../../shared/MiniSparkline';
import { Button } from '../../ui';
import { toLocalDateInputValue } from '../../../utils/dateUtils';
import {
  buildComparativeDeltas,
  calculateSkinfoldEvaluation,
  validatePhysiologicalRange
} from '../../../services/calculationEngine';
import { useUiFeedback } from '../../../contexts/UiFeedbackContext';
import '../avaliacoes.css';
import './DobrasCutaneasForm.css';

const FOLD_FIELDS = [
  { key: 'peitoral', label: 'Peitoral', tooltip: ['Dobra na linha axilar anterior, oblíqua.'] },
  { key: 'axilar_media', label: 'Axilar média', tooltip: ['Ponto médio da linha axilar.'] },
  { key: 'triceps', label: 'Tríceps', tooltip: ['Ponto médio posterior do braço.'] },
  { key: 'subescapular', label: 'Subescapular', tooltip: ['Abaixo do ângulo inferior da escápula.'] },
  { key: 'abdominal', label: 'Abdominal', tooltip: ['2 cm ao lado da cicatriz umbilical.'] },
  { key: 'suprailiaca', label: 'Supraíliaca', tooltip: ['Acima da crista ilíaca, linha axilar média.'] },
  { key: 'coxa', label: 'Coxa', tooltip: ['Face anterior da coxa, ponto médio.'] },
  { key: 'panturrilha_medial', label: 'Panturrilha medial', tooltip: ['Região medial, maior perímetro.'] },
  { key: 'biceps', label: 'Bíceps', tooltip: ['Face anterior do braço, ponto médio.'] }
];

const PROTOCOL_OPTIONS = [
  { value: '', label: 'Selecione' },
  { value: 'pollock3h', label: 'Pollock 3H' },
  { value: 'pollock3m', label: 'Pollock 3M' },
  { value: 'pollock7', label: 'Pollock 7' },
  { value: 'durnin_womersley', label: 'Durnin-Womersley' },
  { value: 'guedes', label: 'Guedes' }
];

const PROTOCOL_CONFIG = {
  pollock3h: {
    calculationProtocol: 'jackson_pollock_3',
    sexOverride: 'male',
    visibleFields: ['peitoral', 'abdominal', 'coxa']
  },
  pollock3m: {
    calculationProtocol: 'jackson_pollock_3',
    sexOverride: 'female',
    visibleFields: ['triceps', 'suprailiaca', 'coxa']
  },
  pollock7: {
    calculationProtocol: 'jackson_pollock_7',
    visibleFields: ['peitoral', 'axilar_media', 'triceps', 'subescapular', 'abdominal', 'suprailiaca', 'coxa']
  },
  durnin_womersley: {
    calculationProtocol: 'durnin_womersley',
    visibleFields: ['biceps', 'triceps', 'suprailiaca', 'subescapular']
  },
  guedes: {
    calculationProtocol: 'guedes_1985',
    visibleFields: ['triceps', 'suprailiaca', 'abdominal']
  }
};

const createInitialData = () => ({
  dataAvaliacao: toLocalDateInputValue(new Date()),
  protocolo: '',
  avaliador: '',
  equipamento: '',
  ladoMedicao: 'direito',
  conversionMethod: 'siri',
  maturationStage: 'default',
  pesoKg: '',
  estaturaCm: '',
  idade: '',
  sexo: '',
  peitoral: '',
  axilar_media: '',
  triceps: '',
  subescapular: '',
  abdominal: '',
  suprailiaca: '',
  coxa: '',
  panturrilha_medial: '',
  biceps: '',
  esportivo: createDobrasEsportivoData()
});

function createDobrasEsportivoData() {
  return {
    limitacaoTecnica: false,
    limitacaoTecnicaDescricao: ''
  };
}

const DobrasCutaneasForm = ({
  pacienteId,
  onSalvar,
  onAutoSave,
  patient,
  onboardingContext,
  baselineAnthropometry,
  moduleSnapshot,
  currentSessionId,
  moduleHistory = [],
  allEvaluationHistory = [],
  lockSharedAnthropometry = false,
  readOnly = false
}) => {
  const { confirm } = useUiFeedback();

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

    const baselineHeight = toInputValue(
      firstDefined(
        baselineAnthropometry?.estaturaCm,
        normalizeHeightCm(patient?.altura || patient?.estatura || patient?.height)
      ),
      1
    );
    const baselineWeight = toInputValue(
      firstDefined(
        baselineAnthropometry?.pesoKg,
        parseNumeric(patient?.peso || patient?.weight)
      ),
      1
    );
    const baselineSex = normalizeSexLabel(
      firstDefined(
        baselineAnthropometry?.sexo,
        patient?.sexo,
        patient?.genero
      )
    );
    const baselineAge = toInputValue(
      firstDefined(
        baselineAnthropometry?.idade,
        patient?.idade,
        calculateAge(patient?.dataNascimento)
      ),
      0
    );

    setDados((prev) => ({
      ...prev,
      estaturaCm: lockSharedAnthropometry ? baselineHeight : (prev.estaturaCm || baselineHeight),
      pesoKg: lockSharedAnthropometry ? baselineWeight : (prev.pesoKg || baselineWeight),
      sexo: lockSharedAnthropometry ? baselineSex : (prev.sexo || baselineSex),
      idade: lockSharedAnthropometry ? baselineAge : (prev.idade || baselineAge)
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
    const dobras = dadosBrutos?.dobras || {};
    const esportivoRaw = asRecord(firstDefined(dadosBrutos?.esportivo, source?.esportivo));

    setDados((prev) => ({
      ...prev,
      dataAvaliacao: normalizeDateValue(moduleSnapshot?.data || source?.dataAvaliacao || dadosBrutos?.dataAvaliacao || prev.dataAvaliacao),
      protocolo: resolveUiProtocol(
        toTextInput(firstDefined(
          dadosBrutos?.protocolo,
          dadosBrutos?.protocolId,
          source?.protocolo,
          prev.protocolo
        )),
        normalizeSexToken(firstDefined(dadosBrutos?.sexo, source?.sexo, prev?.sexo))
      ),
      avaliador: toTextInput(firstDefined(dadosBrutos?.avaliador, source?.avaliador)),
      equipamento: toTextInput(firstDefined(dadosBrutos?.equipamento, source?.equipamento)),
      ladoMedicao: toTextInput(firstDefined(dadosBrutos?.ladoMedicao, dadosBrutos?.lado_medicao, source?.lado_medicao, 'direito')) || 'direito',
      conversionMethod: toTextInput(firstDefined(dadosBrutos?.conversionMethod, source?.conversionMethod, 'siri')) || 'siri',
      maturationStage: toTextInput(firstDefined(dadosBrutos?.maturationStage, source?.maturationStage, 'default')) || 'default',
      pesoKg: toInputValue(firstDefined(dadosBrutos?.pesoKg, dadosBrutos?.peso, source?.peso), 1),
      estaturaCm: toInputValue(firstDefined(dadosBrutos?.estaturaCm, dadosBrutos?.estatura, source?.estatura), 1),
      idade: toInputValue(firstDefined(dadosBrutos?.idade, source?.idade), 0),
      sexo: normalizeSexLabel(firstDefined(dadosBrutos?.sexo, source?.sexo)),
      peitoral: toInputValue(firstDefined(dobras?.peitoral, source?.peitoral)),
      axilar_media: toInputValue(firstDefined(dobras?.axilar_media, source?.axilarMedia, source?.axilar_media)),
      triceps: toInputValue(firstDefined(dobras?.triceps, source?.triceps)),
      subescapular: toInputValue(firstDefined(dobras?.subescapular, source?.subescapular)),
      abdominal: toInputValue(firstDefined(dobras?.abdominal, source?.abdominal)),
      suprailiaca: toInputValue(firstDefined(dobras?.suprailiaca, source?.supraIliaca, source?.suprailiaca)),
      coxa: toInputValue(firstDefined(dobras?.coxa, source?.coxa)),
      panturrilha_medial: toInputValue(firstDefined(dobras?.panturrilha_medial, source?.panturrilha_medial)),
      biceps: toInputValue(firstDefined(dobras?.biceps, source?.biceps)),
      esportivo: {
        limitacaoTecnica: normalizeBoolean(firstDefined(
          esportivoRaw?.limitacaoTecnica,
          esportivoRaw?.limitacao_tecnica
        )),
        limitacaoTecnicaDescricao: toTextInput(firstDefined(
          esportivoRaw?.limitacaoTecnicaDescricao,
          esportivoRaw?.limitacao_tecnica_descricao
        ))
      }
    }));

    loadedSnapshotIdRef.current = snapshotId;
  }, [moduleSnapshot]);

  const sexToken = useMemo(() => normalizeSexToken(dados.sexo), [dados.sexo]);
  const selectedProtocolConfig = useMemo(
    () => PROTOCOL_CONFIG[dados.protocolo] || null,
    [dados.protocolo]
  );
  const calculationProtocolId = selectedProtocolConfig?.calculationProtocol || '';
  const calculationSexToken = selectedProtocolConfig?.sexOverride || sexToken;
  const visibleFoldFields = useMemo(
    () => selectedProtocolConfig?.visibleFields || [],
    [selectedProtocolConfig]
  );
  const ageYears = useMemo(() => parseNumeric(dados.idade), [dados.idade]);
  const weightKg = useMemo(() => parseNumeric(dados.pesoKg), [dados.pesoKg]);
  const heightCm = useMemo(() => normalizeHeightCm(dados.estaturaCm), [dados.estaturaCm]);

  const foldsMap = useMemo(() => {
    const map = {};
    FOLD_FIELDS.forEach((field) => {
      map[field.key] = parseNumeric(dados[field.key]);
    });
    return map;
  }, [dados]);

  const requiredFoldFields = useMemo(
    () => [...visibleFoldFields],
    [visibleFoldFields]
  );

  const displayedFoldFields = useMemo(
    () => FOLD_FIELDS.filter((field) => visibleFoldFields.includes(field.key)),
    [visibleFoldFields]
  );

  const foldsForCalculation = useMemo(() => {
    const cloned = { ...foldsMap };
    if (dados.protocolo === 'guedes' && !Number.isFinite(cloned.coxa) && Number.isFinite(cloned.abdominal)) {
      // Compatibilidade temporaria para manter o calculo ativo no motor legado.
      cloned.coxa = cloned.abdominal;
    }
    return cloned;
  }, [dados.protocolo, foldsMap]);

  const skinfold = useMemo(() => {
    if (!calculationProtocolId) return null;
    return calculateSkinfoldEvaluation({
      protocolId: calculationProtocolId,
      sex: calculationSexToken,
      ageYears,
      weightKg,
      folds: foldsForCalculation,
      conversionMethod: dados.conversionMethod,
      maturationStage: dados.maturationStage
    });
  }, [
    ageYears,
    calculationProtocolId,
    calculationSexToken,
    dados.conversionMethod,
    dados.maturationStage,
    foldsForCalculation,
    weightKg
  ]);

  const foldValidation = useMemo(() => {
    const validation = {};
    FOLD_FIELDS.forEach((field) => {
      const value = dados[field.key];
      const text = toTextInput(value);
      const isRequired = requiredFoldFields.includes(field.key);

      if (!text) {
        validation[field.key] = isRequired
          ? { status: 'error', message: 'Campo obrigatório para o protocolo.' }
          : { status: 'empty', message: '' };
        return;
      }

      const numeric = parseNumeric(value);
      if (!Number.isFinite(numeric)) {
        validation[field.key] = { status: 'error', message: 'Valor inválido.' };
        return;
      }

      const range = validatePhysiologicalRange({ metric: 'dobras_mm', value: numeric });
      if (range.status === 'warning') {
        validation[field.key] = { status: 'warning', message: range.message };
        return;
      }

      validation[field.key] = { status: 'ok', message: '' };
    });
    return validation;
  }, [dados, requiredFoldFields]);

  const requiredErrors = useMemo(
    () => requiredFoldFields.some((field) => foldValidation[field]?.status === 'error'),
    [foldValidation, requiredFoldFields]
  );

  const hasAnyFoldValue = useMemo(
    () => FOLD_FIELDS.some((field) => Number.isFinite(parseNumeric(dados[field.key]))),
    [dados]
  );

  const baseMissing = useMemo(() => {
    if (!dados.protocolo) return 'Selecione o protocolo antes de preencher as dobras.';
    if (!calculationSexToken) return 'Informe sexo biológico.';
    if (['jackson_pollock_3', 'jackson_pollock_7', 'petroski_1995', 'durnin_womersley', 'guedes_1985'].includes(calculationProtocolId) && !Number.isFinite(ageYears)) {
      return 'Informe idade para este protocolo.';
    }
    return '';
  }, [ageYears, calculationProtocolId, calculationSexToken, dados.protocolo]);

  const history = useMemo(() => normalizeDobrasHistory(moduleHistory), [moduleHistory]);
  const currentSnapshotId = moduleSnapshot?.id || '';
  const referenceHistory = useMemo(
    () => history.filter((item) => !currentSnapshotId || item.id !== currentSnapshotId).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)),
    [currentSnapshotId, history]
  );

  const previous = referenceHistory[0] || null;
  const first = referenceHistory.length ? referenceHistory[referenceHistory.length - 1] : null;

  const comparisonRows = useMemo(() => {
    const currentMetrics = {
      percentual: skinfold?.percentFat?.selected,
      massaGorda: skinfold?.bodyComposition?.fatMassKg,
      massaMagra: skinfold?.bodyComposition?.leanMassKg,
      somaDobras: skinfold?.sums?.requiredFolds
    };

    const previousMetrics = previous?.metrics || {};
    const firstMetrics = first?.metrics || {};

    return [
      createComparisonRow('percentual', '% Gordura', '%', currentMetrics.percentual, previousMetrics.percentual, firstMetrics.percentual),
      createComparisonRow('massaGorda', 'Massa gorda', 'kg', currentMetrics.massaGorda, previousMetrics.massaGorda, firstMetrics.massaGorda),
      createComparisonRow('massaMagra', 'Massa magra', 'kg', currentMetrics.massaMagra, previousMetrics.massaMagra, firstMetrics.massaMagra),
      createComparisonRow('somaDobras', 'Soma dobras', 'mm', currentMetrics.somaDobras, previousMetrics.somaDobras, firstMetrics.somaDobras)
    ];
  }, [
    first?.metrics,
    previous?.metrics,
    skinfold?.bodyComposition?.fatMassKg,
    skinfold?.bodyComposition?.leanMassKg,
    skinfold?.percentFat?.selected,
    skinfold?.sums?.requiredFolds
  ]);

  const sparklineValues = useMemo(() => {
    const ordered = [...referenceHistory].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    const values = ordered.map((item) => item.metrics.percentual).filter((value) => Number.isFinite(value));
    if (Number.isFinite(skinfold?.percentFat?.selected)) values.push(skinfold.percentFat.selected);
    return values.slice(-6);
  }, [referenceHistory, skinfold]);

  const interpretation = useMemo(() => buildDobrasInterpretation(comparisonRows), [comparisonRows]);

  const latestFatFreeMassFromOther = useMemo(() => resolveLatestFatFreeMass(allEvaluationHistory), [allEvaluationHistory]);

  const payloadDados = useMemo(() => {
    const selectedBodyFat = skinfold?.percentFat?.selected;
    const selectedMethod = skinfold?.percentFat?.selectedMethod;
    const deltaBodyFat = buildComparativeDeltas({
      current: selectedBodyFat,
      reference: previous?.metrics?.percentual
    });
    const esportivoPayload = buildDobrasEsportivoPayload(dados.esportivo);

    const dobrasPayload = {};
    FOLD_FIELDS.forEach((field) => {
      const value = foldsMap[field.key];
      dobrasPayload[field.key] = Number.isFinite(value) ? Number(value.toFixed(2)) : null;
    });

    return {
      protocoloDobras: dados.protocolo,
      protocolo: dados.protocolo,
      protocoloCalculo: calculationProtocolId || null,
      avaliador: toTextInput(dados.avaliador) || null,
      equipamento: toTextInput(dados.equipamento) || null,
      lado_medicao: dados.ladoMedicao || 'direito',
      conversionMethod: dados.conversionMethod || 'siri',
      maturationStage: dados.maturationStage || 'default',
      peso: Number.isFinite(weightKg) ? Number(weightKg.toFixed(2)) : null,
      peso_kg: Number.isFinite(weightKg) ? Number(weightKg.toFixed(2)) : null,
      estatura_cm: Number.isFinite(heightCm) ? Number(heightCm.toFixed(1)) : null,
      idade: Number.isFinite(ageYears) ? Math.round(ageYears) : null,
      sexo: calculationSexToken,
      dobras: dobrasPayload,
      esportivo: esportivoPayload,
      soma_dobras: Number.isFinite(skinfold?.sums?.requiredFolds) ? Number(skinfold.sums.requiredFolds.toFixed(2)) : null,
      soma_dobras_total: Number.isFinite(skinfold?.sums?.allMeasuredFolds) ? Number(skinfold.sums.allMeasuredFolds.toFixed(2)) : null,
      densidade_corporal: Number.isFinite(skinfold?.density) ? Number(skinfold.density.toFixed(6)) : null,
      percentual_gordura_siri: Number.isFinite(skinfold?.percentFat?.siri) ? Number(skinfold.percentFat.siri.toFixed(2)) : null,
      percentual_gordura_brozek: Number.isFinite(skinfold?.percentFat?.brozek) ? Number(skinfold.percentFat.brozek.toFixed(2)) : null,
      percentual_gordura: Number.isFinite(selectedBodyFat) ? Number(selectedBodyFat.toFixed(2)) : null,
      massa_gorda_kg: Number.isFinite(skinfold?.bodyComposition?.fatMassKg) ? Number(skinfold.bodyComposition.fatMassKg.toFixed(2)) : null,
      massa_magra_kg: Number.isFinite(skinfold?.bodyComposition?.leanMassKg) ? Number(skinfold.bodyComposition.leanMassKg.toFixed(2)) : null,
      classificacao_percentual_gordura: skinfold?.classification?.label || null,
      dados_brutos: {
        protocolo: dados.protocolo,
        avaliador: toTextInput(dados.avaliador) || null,
        equipamento: toTextInput(dados.equipamento) || null,
        ladoMedicao: dados.ladoMedicao || 'direito',
        conversionMethod: dados.conversionMethod || 'siri',
        maturationStage: dados.maturationStage || 'default',
        pesoKg: Number.isFinite(weightKg) ? Number(weightKg.toFixed(2)) : null,
        estaturaCm: Number.isFinite(heightCm) ? Number(heightCm.toFixed(1)) : null,
        idade: Number.isFinite(ageYears) ? Math.round(ageYears) : null,
        sexo: calculationSexToken,
        dobras: dobrasPayload,
        esportivo: esportivoPayload
      },
      resultados_calculados: {
        soma_dobras: Number.isFinite(skinfold?.sums?.requiredFolds) ? Number(skinfold.sums.requiredFolds.toFixed(2)) : null,
        densidade_corporal: Number.isFinite(skinfold?.density) ? Number(skinfold.density.toFixed(6)) : null,
        percentual_gordura_siri: Number.isFinite(skinfold?.percentFat?.siri) ? Number(skinfold.percentFat.siri.toFixed(2)) : null,
        percentual_gordura_brozek: Number.isFinite(skinfold?.percentFat?.brozek) ? Number(skinfold.percentFat.brozek.toFixed(2)) : null,
        percentual_gordura: Number.isFinite(selectedBodyFat) ? Number(selectedBodyFat.toFixed(2)) : null,
        massa_gorda_kg: Number.isFinite(skinfold?.bodyComposition?.fatMassKg) ? Number(skinfold.bodyComposition.fatMassKg.toFixed(2)) : null,
        massa_magra_kg: Number.isFinite(skinfold?.bodyComposition?.leanMassKg) ? Number(skinfold.bodyComposition.leanMassKg.toFixed(2)) : null
      },
      classificacoes: {
        percentual_gordura: skinfold?.classification?.label || null,
        referencia: skinfold?.classification?.source || 'Lohman 1992'
      },
      metadados_formula: {
        formulaId: `${calculationProtocolId || dados.protocolo}-${selectedMethod || 'siri'}`,
        formulaVersion: skinfold?.protocol?.version || '1.0.0',
        equacao_dc: skinfold?.formulas?.densityEquationId || null,
        equacao_percentual: selectedMethod || null,
        protocolo: dados.protocolo,
        protocolo_calculo: calculationProtocolId || null,
        protocolo_ref: skinfold?.protocol?.reference || null,
        campos_obrigatorios_protocolo: requiredFoldFields
      },
      comparacao: {
        delta_absoluto_gordura: Number.isFinite(deltaBodyFat.deltaAbs) ? Number(deltaBodyFat.deltaAbs.toFixed(2)) : null,
        delta_percentual_gordura: Number.isFinite(deltaBodyFat.deltaPct) ? Number(deltaBodyFat.deltaPct.toFixed(2)) : null,
        referencia_comparacao: previous ? 'avaliacao_anterior' : null
      },
      input: {
        protocolo: dados.protocolo,
        protocoloCalculo: calculationProtocolId || null,
        conversionMethod: dados.conversionMethod || 'siri',
        maturationStage: dados.maturationStage || 'default',
        dataAvaliacao: normalizeDateValue(dados.dataAvaliacao),
        sexo: calculationSexToken,
        idade: Number.isFinite(ageYears) ? Math.round(ageYears) : null,
        pesoKg: Number.isFinite(weightKg) ? Number(weightKg.toFixed(2)) : null,
        estaturaCm: Number.isFinite(heightCm) ? Number(heightCm.toFixed(1)) : null,
        dobrasMm: dobrasPayload,
        esportivo: esportivoPayload
      },
      source: {
        mode: 'manual',
        system: 'dobras_cutaneas'
      }
    };
  }, [
    ageYears,
    dados.avaliador,
    dados.conversionMethod,
    dados.dataAvaliacao,
    dados.esportivo,
    dados.equipamento,
    dados.ladoMedicao,
    dados.maturationStage,
    dados.protocolo,
    calculationProtocolId,
    calculationSexToken,
    foldsMap,
    heightCm,
    requiredFoldFields,
    previous,
    sexToken,
    skinfold,
    weightKg
  ]);

  const payloadResults = useMemo(() => ({
    soma_dobras: payloadDados.soma_dobras,
    densidade_corporal: payloadDados.densidade_corporal,
    percentual_gordura_siri: payloadDados.percentual_gordura_siri,
    percentual_gordura_brozek: payloadDados.percentual_gordura_brozek,
    percentual_gordura: payloadDados.percentual_gordura,
    massa_gorda_kg: payloadDados.massa_gorda_kg,
    massa_magra_kg: payloadDados.massa_magra_kg,
    classificacao_percentual_gordura: payloadDados.classificacao_percentual_gordura,
    calculated: {
      somaDobras: payloadDados.soma_dobras,
      densidadeCorporal: payloadDados.densidade_corporal,
      percentualGordura: payloadDados.percentual_gordura,
      massaGorda: payloadDados.massa_gorda_kg,
      massaMagra: payloadDados.massa_magra_kg
    },
    output: {
      classificacaoPercentualGordura: payloadDados.classificacao_percentual_gordura
    },
    comparacao: payloadDados.comparacao
  }), [payloadDados]);

  const hasValues = useMemo(() => {
    if (hasAnyFoldValue) return true;
    if (toTextInput(dados.avaliador)) return true;
    if (toTextInput(dados.equipamento)) return true;
    if (hasDobrasEsportivoValues(dados.esportivo)) return true;
    return false;
  }, [dados.avaliador, dados.equipamento, dados.esportivo, hasAnyFoldValue]);

  const canCalculate = useMemo(
    () => !baseMissing && !requiredErrors && skinfold?.hasEnoughData,
    [baseMissing, requiredErrors, skinfold?.hasEnoughData]
  );

  const savePayload = useCallback(async (auto = false) => {
    const dispatch = auto ? onAutoSave : onSalvar;
    if (!dispatch) return;

    await dispatch({
      tipo: 'dobras_cutaneas',
      dados: payloadDados,
      resultados: payloadResults,
      data: dados.dataAvaliacao,
      schemaVersion: 3,
      formulaId: payloadDados?.metadados_formula?.formulaId || `${calculationProtocolId || dados.protocolo}-siri`,
      formulaVersion: payloadDados?.metadados_formula?.formulaVersion || '1.0.0',
      sourceSystem: 'manual',
      measuredAt: normalizeDateValue(dados.dataAvaliacao),
      sessaoId: moduleSnapshot?.sessaoId || currentSessionId,
      pacienteId
    });
  }, [
    currentSessionId,
    calculationProtocolId,
    dados.dataAvaliacao,
    dados.protocolo,
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
      await savePayload(auto);
      setSaveStatus('saved');
      saveStatusResetRef.current = setTimeout(() => setSaveStatus(null), 3000);
    } catch (error) {
      setSaveStatus('error');
      if (!auto) {
        setError('Não foi possível salvar a avaliação. Tente novamente.');
      }
    }
  }, [savePayload]);

  const handleSalvar = useCallback(async () => {
    if (!onSalvar) return;
    setSubmitAttempted(true);
    setError('');

    if (!hasValues) {
      setError('Preencha ao menos um conjunto de dobras para salvar.');
      return;
    }

    if (!dados.protocolo) {
      setError('Selecione o protocolo de dobras antes de salvar.');
      return;
    }

    if (baseMissing) {
      setError(baseMissing);
      return;
    }

    if (requiredErrors) {
      const missingLabels = requiredFoldFields
        .filter((field) => !Number.isFinite(parseNumeric(dados[field])))
        .map(resolveFoldLabel);
      const suffix = missingLabels.length ? ` Campos ausentes: ${missingLabels.join(', ')}.` : '';
      setError(`Existem dobras obrigatórias não preenchidas para o protocolo selecionado.${suffix}`);
      return;
    }

    const warningFields = Object.entries(foldValidation)
      .filter(([, item]) => item.status === 'warning')
      .map(([field, item]) => `${resolveFoldLabel(field)}: ${item.message}`);

    if (warningFields.length > 0) {
      const proceed = await confirm({
        title: 'Valores fora da faixa fisiológica',
        details: warningFields,
        confirmLabel: 'Salvar mesmo assim',
        cancelLabel: 'Corrigir',
        variant: 'warning'
      });
      if (!proceed) return;
    }

    await executeSave(false);
  }, [baseMissing, confirm, dados, executeSave, foldValidation, hasValues, onSalvar, requiredErrors, requiredFoldFields]);

  useEffect(() => {
    if (readOnly || !onAutoSave || !hasUserInput || !hasValues || !canCalculate) return undefined;
    clearTimeout(autoSaveRef.current);
    autoSaveRef.current = setTimeout(() => {
      executeSave(true);
    }, 3500);
    return () => clearTimeout(autoSaveRef.current);
  }, [canCalculate, executeSave, hasUserInput, hasValues, onAutoSave, readOnly]);

  useEffect(() => () => {
    if (saveStatusResetRef.current) clearTimeout(saveStatusResetRef.current);
  }, []);

  const deltaPercentual = useMemo(
    () => buildComparativeDeltas({ current: skinfold?.percentFat?.selected, reference: previous?.metrics?.percentual }),
    [previous?.metrics?.percentual, skinfold?.percentFat?.selected]
  );
  const deltaMassaMagra = useMemo(
    () => buildComparativeDeltas({ current: skinfold?.bodyComposition?.leanMassKg, reference: previous?.metrics?.massaMagra }),
    [previous?.metrics?.massaMagra, skinfold?.bodyComposition?.leanMassKg]
  );
  const deltaSoma = useMemo(
    () => buildComparativeDeltas({ current: skinfold?.sums?.requiredFolds, reference: previous?.metrics?.somaDobras }),
    [previous?.metrics?.somaDobras, skinfold?.sums?.requiredFolds]
  );
  const onboardingResumo = useMemo(() => {
    if (!onboardingContext || typeof onboardingContext !== 'object') return [];
    const resumo = [];
    const modalidade = toTextInput(onboardingContext?.modalidadePrincipal);
    const frequencia = parseNumeric(onboardingContext?.frequenciaSemanal);
    if (modalidade) resumo.push(`Modalidade: ${modalidade}`);
    if (Number.isFinite(frequencia)) resumo.push(`Frequência: ${frequencia}x/sem`);
    return resumo.slice(0, 2);
  }, [onboardingContext]);
  const comparabilidadeColeta = useMemo(() => {
    const itens = [
      Boolean(dados.protocolo),
      Boolean(toTextInput(dados.avaliador)),
      Boolean(toTextInput(dados.equipamento)),
      Boolean(toTextInput(dados.ladoMedicao))
    ];
    const score = itens.filter(Boolean).length;
    if (score === 4) return 'Comparabilidade alta da coleta de dobras.';
    if (score >= 2) return 'Comparabilidade moderada da coleta de dobras.';
    return 'Comparabilidade baixa: defina protocolo e identificação da coleta.';
  }, [dados.avaliador, dados.equipamento, dados.ladoMedicao, dados.protocolo]);

  return (
    <div className={`eval-card dobras-form dobras-form--modern${readOnly ? ' eval-card--readonly' : ''}`}>
      <div className="eval-header">
        <div className="eval-icon">
          <Activity size={22} />
        </div>
        <div>
          <h3 className="eval-title">Dobras cutâneas</h3>
          <p className="eval-subtitle">
            Protocolos dinâmicos com densidade corporal, % gordura (Siri/Brozek) e comparação evolutiva.
          </p>
        </div>
      </div>

      {onboardingResumo.length > 0 ? (
        <div className="eval-note">
          <strong>Contexto do onboarding:</strong> {onboardingResumo.join(' | ')}
        </div>
      ) : null}
      <div className="eval-note">
        <strong>Status de comparabilidade:</strong> {comparabilidadeColeta}
      </div>

      <div className="eval-section">
        <h4 className="eval-section-title">Protocolo e identificação</h4>
        <div className="dobras-grid">
          <div className="eval-field">
            <label className="eval-label">Data da avaliação</label>
            <input
              type="date"
              className="eval-input"
              value={dados.dataAvaliacao}
              onChange={(event) => updateField(setDados, setHasUserInput, 'dataAvaliacao', event.target.value)}
              disabled={readOnly}
            />
          </div>

          <div className="eval-field">
            <label className="eval-label">Protocolo</label>
            <select
              className="eval-input"
              value={dados.protocolo}
              onChange={(event) => updateField(setDados, setHasUserInput, 'protocolo', event.target.value)}
              disabled={readOnly}
            >
              {PROTOCOL_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>

          <div className="eval-field">
            <label className="eval-label">
              Conversao de % gordura
              <InlineHelp lines={[
                'Siri (1956): %G = (495 / DC) - 450  [padrão clínico]',
                'Brozek (1963): %G = (4.57 / DC - 4.142) x 100',
                'Para atletas com alta musculatura, Brozek pode ser preferível pois Siri tende a superestimar %G.'
              ]}
              />
            </label>
            <select
              className="eval-input"
              value={dados.conversionMethod}
              onChange={(event) => updateField(setDados, setHasUserInput, 'conversionMethod', event.target.value)}
              disabled={readOnly || !dados.protocolo}
            >
              <option value="siri">Siri (padrão clínico)</option>
              <option value="brozek">Brozek (atletas alta musculatura)</option>
            </select>
          </div>

          <div className="eval-field">
            <label className="eval-label">Avaliador</label>
            <input
              type="text"
              className="eval-input"
              value={dados.avaliador}
              onChange={(event) => updateField(setDados, setHasUserInput, 'avaliador', event.target.value)}
              disabled={readOnly}
              placeholder="Nome do tecnico"
            />
          </div>

          <div className="eval-field">
            <label className="eval-label">Equipamento</label>
            <input
              type="text"
              className="eval-input"
              value={dados.equipamento}
              onChange={(event) => updateField(setDados, setHasUserInput, 'equipamento', event.target.value)}
              disabled={readOnly}
              placeholder="Marca/modelo do adipometro"
            />
          </div>

          <div className="eval-field">
            <label className="eval-label">Lado da medição</label>
            <select
              className="eval-input"
              value={dados.ladoMedicao}
              onChange={(event) => updateField(setDados, setHasUserInput, 'ladoMedicao', event.target.value)}
              disabled={readOnly}
            >
              <option value="direito">Direito</option>
              <option value="esquerdo">Esquerdo</option>
            </select>
          </div>

          <div className="eval-field eval-field-full">
            <label className="eval-label">Limitação técnica</label>
            <label className="dobras-toggle">
              <input
                type="checkbox"
                checked={Boolean(dados.esportivo?.limitacaoTecnica)}
                onChange={(event) => updateDobrasEsportivoField(setDados, setHasUserInput, 'limitacaoTecnica', event.target.checked)}
                disabled={readOnly}
              />
              <span>Houve limitação técnica relevante durante a coleta.</span>
            </label>
          </div>

          {Boolean(dados.esportivo?.limitacaoTecnica) && (
            <div className="eval-field eval-field-full">
              <label className="eval-label">Descrição da limitação técnica</label>
              <textarea
                className="eval-textarea"
                rows={3}
                value={dados.esportivo?.limitacaoTecnicaDescricao || ''}
                onChange={(event) => updateDobrasEsportivoField(setDados, setHasUserInput, 'limitacaoTecnicaDescricao', event.target.value)}
                disabled={readOnly}
                placeholder="Descreva o motivo da limitação e impacto na medida."
              />
            </div>
          )}
        </div>
      </div>

      <div className="eval-section">
        <h4 className="eval-section-title">Dados do avaliado</h4>
        <div className="dobras-grid">
          <BaseNumericField
            label="Peso"
            unit="kg"
            value={dados.pesoKg}
            onChange={(value) => updateField(setDados, setHasUserInput, 'pesoKg', value)}
            disabled={readOnly || lockSharedAnthropometry}
            placeholder="70,5"
            className="eval-field--critical"
          />
          <BaseNumericField
            label="Estatura"
            unit="cm"
            value={dados.estaturaCm}
            onChange={(value) => updateField(setDados, setHasUserInput, 'estaturaCm', value)}
            disabled={readOnly || lockSharedAnthropometry}
            placeholder="165"
            className="eval-field--critical"
          />
          <BaseNumericField
            label="Idade"
            unit="anos"
            value={dados.idade}
            onChange={(value) => updateField(setDados, setHasUserInput, 'idade', value)}
            disabled={readOnly || lockSharedAnthropometry}
            placeholder="32"
          />
          <div className="eval-field">
            <label className="eval-label">Sexo biologico</label>
            <select
              className="eval-input"
              value={dados.sexo}
              onChange={(event) => updateField(setDados, setHasUserInput, 'sexo', event.target.value)}
              disabled={readOnly || lockSharedAnthropometry}
            >
              <option value="">Selecione</option>
              <option value="MASCULINO">Masculino</option>
              <option value="FEMININO">Feminino</option>
            </select>
          </div>
        </div>
        {lockSharedAnthropometry && (
          <p className="dobras-shared-hint">Peso, estatura, idade e sexo estão sincronizados com a ficha base da sessão.</p>
        )}
      </div>

      <div className="eval-section">
        <h4 className="eval-section-title">Dobras do protocolo</h4>
        {!dados.protocolo ? (
          <div className="eval-note">Selecione um protocolo para liberar os campos de dobras.</div>
        ) : (
          <>
            <p className="eval-section-subtitle">
              Campos obrigatórios para o protocolo atual: {requiredFoldFields.map(resolveFoldLabel).join(', ') || 'não definidos'}.
            </p>
            <div className="dobras-grid">
              {displayedFoldFields.map((field) => {
            const isRequired = requiredFoldFields.includes(field.key);
            const status = foldValidation[field.key]?.status || 'empty';
            const showState = submitAttempted || touched[field.key];
            const message = showState ? (foldValidation[field.key]?.message || '') : '';
            return (
              <div key={field.key} className="eval-field">
                <label className="eval-label">
                  {field.label}
                  <span className="dobras-unit-badge">mm</span>
                  {isRequired ? <span className="dobras-required-dot">*</span> : <span className="dobras-optional-badge">Opcional</span>}
                  <InlineHelp lines={field.tooltip} />
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  className={`eval-input ${showState && status === 'error' ? 'dobras-input-invalid' : ''} ${showState && status === 'warning' ? 'dobras-input-warning' : ''}`}
                  value={dados[field.key]}
                  onChange={(event) => updateField(setDados, setHasUserInput, field.key, event.target.value)}
                  onBlur={() => setTouched((prev) => ({ ...prev, [field.key]: true }))}
                  disabled={readOnly}
                  placeholder={isRequired ? 'Obrigatorio' : 'Opcional'}
                />
                {message ? <small className={`dobras-field-message ${status === 'error' ? 'is-error' : 'is-warning'}`}>{message}</small> : null}
              </div>
            );
          })}
            </div>
          </>
        )}
      </div>

      <div className="eval-results-section">
        <div className="dobras-section-heading">
          <InlineHelp
            lines={[
              `Equacao DC: ${skinfold?.formulas?.densityEquation || 'Não disponível'}`,
              `Referencia protocolo: ${skinfold?.protocol?.reference || 'Não informada'}`,
              `${skinfold?.formulas?.conversionSiri || ''}`,
              `${skinfold?.formulas?.conversionBrozek || ''}`
            ]}
          />
        </div>

        <div className="dobras-results-grid">
          <ResultCard
            label="% Gordura"
            value={skinfold?.percentFat?.selected}
            unit="%"
            digits={2}
            tone={skinfold?.classification?.tone}
            classification={skinfold?.classification?.label}
            delta={deltaPercentual}
          />
          <ResultCard
            label="Massa gorda"
            value={skinfold?.bodyComposition?.fatMassKg}
            unit="kg"
            digits={2}
            tone="warning"
          />
          <ResultCard
            label="Massa magra"
            value={skinfold?.bodyComposition?.leanMassKg}
            unit="kg"
            digits={2}
            tone="success"
            delta={deltaMassaMagra}
          />
          <ResultCard
            label="Soma dobras"
            value={skinfold?.sums?.requiredFolds}
            unit="mm"
            digits={1}
            tone="info"
            delta={deltaSoma}
          />
          <ResultCard
            label="Densidade corporal"
            value={skinfold?.density}
            unit=""
            digits={5}
            tone="neutral"
          />
          <ResultCard
            label="% Gordura Siri"
            value={skinfold?.percentFat?.siri}
            unit="%"
            digits={2}
            tone={dados.conversionMethod === 'siri' ? 'info' : 'neutral'}
          />
          <ResultCard
            label="% Gordura Brozek"
            value={skinfold?.percentFat?.brozek}
            unit="%"
            digits={2}
            tone={dados.conversionMethod === 'brozek' ? 'info' : 'neutral'}
          />
          <ResultCard
            label="% Gordura (direto)"
            value={skinfold?.percentFat?.direct}
            unit="%"
            digits={2}
            tone="neutral"
          />
        </div>

        {baseMissing && (
          <div className="dobras-warning-box">
            <AlertTriangle size={16} />
            <span>{baseMissing}</span>
          </div>
        )}

        <div className="dobras-visual-grid">
          <div className="dobras-radar-card">
            <h5>Padrão regional (radar)</h5>
            <SkinfoldRadar series={skinfold?.radarSeries || []} />
          </div>
          <div className="dobras-sparkline-card">
            <h5>Evolução % gordura</h5>
            <MiniSparkline values={sparklineValues} target={previous?.metrics?.percentual ?? null} width={240} height={82} />
          </div>
        </div>
      </div>

      <div className="eval-section">
        <h4 className="eval-section-title">Comparação longitudinal</h4>
        <div className="dobras-table-wrap">
          <table className="dobras-table">
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
        <p className="dobras-interpretation">{interpretation}</p>
      </div>

      {Number.isFinite(latestFatFreeMassFromOther) && !Number.isFinite(skinfold?.bodyComposition?.leanMassKg) && (
        <div className="eval-note">Massa magra de referencia encontrada no historico: {formatNumber(latestFatFreeMassFromOther, 2)} kg.</div>
      )}

      {readOnly && <div className="eval-note">Somente leitura para o seu perfil.</div>}

      <div className="eval-actions">
        {saveStatus ? <span className={`save-indicator ${saveStatus}`}>{saveStatus === 'saving' ? 'Salvando...' : saveStatus === 'saved' ? 'Salvo' : 'Erro ao salvar'}</span> : null}
        <Button type="button" variant="primary" onClick={handleSalvar} disabled={readOnly || !canCalculate} loading={saveStatus === 'saving'}>
          Salvar dobras
        </Button>
      </div>

      {error && <div className="eval-note dobras-error-note">{error}</div>}
    </div>
  );
};

const BaseNumericField = ({ label, unit, value, onChange, disabled, placeholder, className = '' }) => (
  <div className={`eval-field${className ? ` ${className}` : ''}`}>
    <label className="eval-label">
      {label}
      <span className="dobras-unit-badge">{unit}</span>
    </label>
    <input
      type="text"
      inputMode="decimal"
      className="eval-input"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      disabled={disabled}
      placeholder={placeholder}
    />
  </div>
);

const InlineHelp = ({ lines = [] }) => (
  <span className="dobras-help" tabIndex={0} role="button" aria-label="Abrir informação">
    ?
    <span className="dobras-help-tooltip" role="tooltip">
      {lines.filter(Boolean).map((line, index) => (
        <span key={`${line}-${index}`}>{line}</span>
      ))}
    </span>
  </span>
);

const ResultCard = ({ label, value, unit = '', digits = 2, tone = 'neutral', classification = '', delta }) => (
  <article className="dobras-result-card">
    <span className="dobras-result-label">{label}</span>
    <strong>{Number.isFinite(value) ? `${formatNumber(value, digits)}${unit ? ` ${unit}` : ''}` : 'Não calculado'}</strong>
    <span className={`dobras-status-badge dobras-tone-${tone}`}>{classification || 'Sem classificação'}</span>
    {delta && Number.isFinite(delta.deltaAbs) ? (
      <small className={`dobras-delta ${resolveDeltaClass(delta.deltaAbs)}`}>
        {formatSigned(delta.deltaAbs, unit, unit === '%' ? 'percent' : 'default')}
      </small>
    ) : null}
  </article>
);

const SkinfoldRadar = ({ series = [] }) => {
  const plotted = (Array.isArray(series) ? series : []).filter((item) => item.required || Number.isFinite(item.value));
  if (!plotted.length) {
    return <div className="dobras-radar-empty">Sem dados para radar</div>;
  }

  const size = 230;
  const center = size / 2;
  const maxRadius = 78;
  const maxValue = Math.max(40, ...plotted.map((item) => Number.isFinite(item.value) ? item.value : 0));

  const points = plotted.map((item, index) => {
    const angle = ((Math.PI * 2) / plotted.length) * index - (Math.PI / 2);
    const normalized = Number.isFinite(item.value) ? item.value / maxValue : 0;
    const radius = normalized * maxRadius;
    const x = center + (Math.cos(angle) * radius);
    const y = center + (Math.sin(angle) * radius);
    return {
      ...item,
      axisX: center + (Math.cos(angle) * maxRadius),
      axisY: center + (Math.sin(angle) * maxRadius),
      x,
      y,
      labelX: center + (Math.cos(angle) * (maxRadius + 18)),
      labelY: center + (Math.sin(angle) * (maxRadius + 18))
    };
  });

  const polygon = points.map((point) => `${point.x},${point.y}`).join(' ');

  return (
    <svg className="dobras-radar" viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Radar de dobras">
      <circle cx={center} cy={center} r={maxRadius} fill="none" stroke="rgba(148,163,184,0.35)" strokeWidth="1" />
      <circle cx={center} cy={center} r={maxRadius * 0.66} fill="none" stroke="rgba(148,163,184,0.28)" strokeWidth="1" />
      <circle cx={center} cy={center} r={maxRadius * 0.33} fill="none" stroke="rgba(148,163,184,0.22)" strokeWidth="1" />

      {points.map((point) => (
        <line key={`axis-${point.field}`} x1={center} y1={center} x2={point.axisX} y2={point.axisY} stroke="rgba(148,163,184,0.28)" strokeWidth="1" />
      ))}

      <polygon points={polygon} fill="rgba(14,165,233,0.24)" stroke="#0284c7" strokeWidth="2" />

      {points.map((point) => (
        <g key={`point-${point.field}`}>
          <circle cx={point.x} cy={point.y} r="3.2" fill="#0284c7" />
          <text x={point.labelX} y={point.labelY} textAnchor="middle" className="dobras-radar-label">
            {point.label}
          </text>
        </g>
      ))}
    </svg>
  );
};

export default DobrasCutaneasForm;

function updateField(setDados, setHasUserInput, field, value) {
  setHasUserInput(true);
  setDados((prev) => ({ ...prev, [field]: value }));
}

function updateDobrasEsportivoField(setDados, setHasUserInput, key, value) {
  setHasUserInput(true);
  setDados((prev) => ({
    ...prev,
    esportivo: {
      ...(prev?.esportivo || createDobrasEsportivoData()),
      [key]: value
    }
  }));
}

function asRecord(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value;
}

function normalizeBoolean(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  const token = toTextInput(value).toLowerCase();
  if (!token) return false;
  return ['1', 'true', 'sim', 'yes', 'y', 'on'].includes(token);
}

function buildDobrasEsportivoPayload(esportivo) {
  const source = asRecord(esportivo);
  return {
    limitacaoTecnica: normalizeBoolean(source.limitacaoTecnica),
    limitacaoTecnicaDescricao: toTextInput(source.limitacaoTecnicaDescricao) || null
  };
}

function hasDobrasEsportivoValues(esportivo) {
  const payload = buildDobrasEsportivoPayload(esportivo);
  if (payload.limitacaoTecnica) return true;
  return Boolean(payload.limitacaoTecnicaDescricao);
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

function normalizeDateValue(value) {
  if (!value) return toLocalDateInputValue(new Date());
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) return value.trim();
  const date = resolveDate(value);
  return date ? toLocalDateInputValue(date) : toLocalDateInputValue(new Date());
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

function normalizeHeightCm(value) {
  const numeric = parseNumeric(value);
  if (!Number.isFinite(numeric)) return null;
  if (numeric > 0 && numeric <= 3) return Number((numeric * 100).toFixed(1));
  return numeric;
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

function resolveUiProtocol(rawValue, sexToken = null) {
  const token = toTextInput(rawValue).toLowerCase();
  if (!token) return '';
  if (Object.prototype.hasOwnProperty.call(PROTOCOL_CONFIG, token)) return token;
  if (token === 'jackson_pollock_7') return 'pollock7';
  if (token === 'durnin_womersley') return 'durnin_womersley';
  if (token === 'guedes_1985') return 'guedes';
  if (token === 'jackson_pollock_3') {
    return sexToken === 'female' ? 'pollock3m' : 'pollock3h';
  }
  return '';
}

function calculateAge(dateValue) {
  const birthDate = resolveDate(dateValue);
  if (!birthDate) return null;
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) age -= 1;
  return age;
}

function resolveFoldLabel(fieldKey) {
  const found = FOLD_FIELDS.find((field) => field.key === fieldKey);
  return found?.label || fieldKey;
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
    percentual: 2,
    massaGorda: 2,
    massaMagra: 2,
    somaDobras: 1
  };
  const digits = Object.prototype.hasOwnProperty.call(digitsByKey, key) ? digitsByKey[key] : 2;
  return `${formatNumber(value, digits)}${unit ? ` ${unit}` : ''}`;
}

function formatSigned(value, unit = '', key = '') {
  if (!Number.isFinite(value)) return '--';
  const digits = key === 'percent' ? 2 : (unit === 'mm' ? 1 : 2);
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

function buildDobrasInterpretation(rows = []) {
  const gordura = rows.find((row) => row.key === 'percentual');
  if (!gordura || !Number.isFinite(gordura.delta?.deltaAbs)) {
    return 'Sem dados suficientes para interpretar a evolucao de % gordura.';
  }
  if (Math.abs(gordura.delta.deltaAbs) < 0.001) {
    return '% gordura estavel em relacao a ultima avaliacao.';
  }
  const direction = gordura.delta.deltaAbs > 0 ? 'aumentou' : 'reduziu';
  return `% gordura ${direction} ${formatNumber(Math.abs(gordura.delta.deltaAbs), 2)} p.p. em relacao a ultima avaliacao.`;
}

function normalizeDobrasHistory(records = []) {
  if (!Array.isArray(records)) return [];
  return records
    .map((record) => {
      const date = resolveDate(record?.updatedAt || record?.createdAt || record?.data);
      const timestamp = date ? date.getTime() : 0;
      return {
        id: record?.id || '',
        timestamp,
        metrics: resolveDobrasMetrics(record)
      };
    })
    .filter((item) => Number.isFinite(item.metrics.percentual));
}

function resolveDobrasMetrics(record) {
  const dados = record?.dados || {};
  const resultados = record?.resultados || {};
  const resultadosCalculados = dados?.resultados_calculados || resultados?.calculated || {};

  return {
    percentual: parseNumeric(firstDefined(
      resultadosCalculados?.percentual_gordura,
      dados?.percentual_gordura,
      resultados?.percentual_gordura,
      resultados?.percentualGordura
    )),
    massaGorda: parseNumeric(firstDefined(
      resultadosCalculados?.massa_gorda_kg,
      dados?.massa_gorda,
      resultados?.massa_gorda_kg,
      resultados?.massaGorda
    )),
    massaMagra: parseNumeric(firstDefined(
      resultadosCalculados?.massa_magra_kg,
      dados?.massa_magra,
      resultados?.massa_magra_kg,
      resultados?.massaMagra
    )),
    somaDobras: parseNumeric(firstDefined(
      resultadosCalculados?.soma_dobras,
      dados?.soma_dobras,
      resultados?.soma_dobras,
      resultados?.somaSeteDobras
    ))
  };
}

function resolveLatestFatFreeMass(history = []) {
  if (!Array.isArray(history)) return null;
  const sorted = [...history].sort((a, b) => {
    const aDate = resolveDate(a?.updatedAt || a?.createdAt || a?.data)?.getTime() || 0;
    const bDate = resolveDate(b?.updatedAt || b?.createdAt || b?.data)?.getTime() || 0;
    return bDate - aDate;
  });

  for (const item of sorted) {
    const candidates = [
      item?.dados?.massa_magra,
      item?.dados?.massaMagra,
      item?.dados?.resultados_calculados?.massaMagra,
      item?.dados?.resultados_calculados?.massa_magra,
      item?.resultados?.massa_magra,
      item?.resultados?.massaMagra,
      item?.resultados?.calculated?.massaMagra,
      item?.resultados?.calculated?.massa_magra
    ];

    for (const candidate of candidates) {
      const numeric = parseNumeric(candidate);
      if (Number.isFinite(numeric)) return numeric;
    }
  }

  return null;
}

