import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Ruler } from 'lucide-react';
import MiniSparkline from '../../shared/MiniSparkline';
import { Button } from '../../ui';
import { toLocalDateInputValue } from '../../../utils/dateUtils';
import {
  buildComparativeDeltas,
  calculateAnthropometryIndicators,
  calculateCircumferenceIndicators,
  calculateTmbComparative,
  resolveOfficialTmbSelection,
  validatePhysiologicalRange
} from '../../../services/calculationEngine';
import { useUiFeedback } from '../../../contexts/UiFeedbackContext';
import '../avaliacoes.css';
import './PerimetrosCorporaisForm.css';

const REQUIRED_FIELDS = [
  {
    key: 'pesoKg',
    label: 'Peso atual',
    unit: 'kg',
    metric: 'peso_kg',
    tooltip: [
      'Medida usada para IMC, SC e formulas energeticas.',
      'Faixa valida: 10 a 400 kg.'
    ]
  },
  {
    key: 'estaturaCm',
    label: 'Estatura',
    unit: 'cm',
    metric: 'estatura_cm',
    tooltip: [
      'Digite em centimetros (ex.: 175).',
      'Faixa valida: 50 a 250 cm.'
    ]
  }
];

const OPTIONAL_FIELDS = [
  {
    key: 'cinturaCm',
    label: 'Circunferência da cintura',
    unit: 'cm',
    metric: 'circunferencia_cm',
    tooltip: [
      'Usada para ICE, RCQ e risco cardiometabólico.',
      'Cortes OMS: risco aumentado > 94 cm (H) / > 80 cm (M).'
    ]
  },
  {
    key: 'quadrilCm',
    label: 'Circunferência do quadril',
    unit: 'cm',
    metric: 'circunferencia_cm',
    tooltip: [
      'Usada no cálculo de RCQ (cintura/quadril).',
      'Faixa valida: 10 a 200 cm.'
    ]
  },
  {
    key: 'pescocoCm',
    label: 'Circunferência do pescoço',
    unit: 'cm',
    metric: 'circunferencia_cm',
    tooltip: [
      'Medida complementar para risco e composição corporal.',
      'Faixa valida: 10 a 200 cm.'
    ]
  },
  {
    key: 'bracoRelaxadoCm',
    label: 'Braço relaxado',
    unit: 'cm',
    metric: 'circunferencia_cm',
    tooltip: ['Perímetro do braço em repouso.']
  },
  {
    key: 'bracoContraidoCm',
    label: 'Braço contraído',
    unit: 'cm',
    metric: 'circunferencia_cm',
    tooltip: ['Perímetro do braço contraído.']
  },
  {
    key: 'antebracoCm',
    label: 'Antebraço',
    unit: 'cm',
    metric: 'circunferencia_cm',
    tooltip: ['Medida do antebraço no maior perímetro.']
  },
  {
    key: 'coxaProximalCm',
    label: 'Coxa proximal',
    unit: 'cm',
    metric: 'circunferencia_cm',
    tooltip: ['Região proximal da coxa.']
  },
  {
    key: 'coxaMedialCm',
    label: 'Coxa medial',
    unit: 'cm',
    metric: 'circunferencia_cm',
    tooltip: ['Região medial da coxa.']
  },
  {
    key: 'panturrilhaCm',
    label: 'Panturrilha',
    unit: 'cm',
    metric: 'circunferencia_cm',
    tooltip: ['Maior perímetro da panturrilha.']
  },
  {
    key: 'toraxInspiradoCm',
    label: 'Tórax inspirado',
    unit: 'cm',
    metric: 'circunferencia_cm',
    tooltip: ['Perímetro torácico em inspiração máxima.']
  },
  {
    key: 'toraxExpiradoCm',
    label: 'Tórax expirado',
    unit: 'cm',
    metric: 'circunferencia_cm',
    tooltip: ['Perímetro torácico em expiração.']
  }
];

const BILATERAL_MEMBER_FIELDS = [
  { key: 'bracoRelaxadoCm', label: 'Braço relaxado', unit: 'cm', metric: 'circunferencia_cm' },
  { key: 'bracoContraidoCm', label: 'Braço contraído', unit: 'cm', metric: 'circunferencia_cm' },
  { key: 'antebracoCm', label: 'Antebraço', unit: 'cm', metric: 'circunferencia_cm' },
  { key: 'coxaProximalCm', label: 'Coxa proximal', unit: 'cm', metric: 'circunferencia_cm' },
  { key: 'coxaMedialCm', label: 'Coxa medial', unit: 'cm', metric: 'circunferencia_cm' },
  { key: 'panturrilhaCm', label: 'Panturrilha', unit: 'cm', metric: 'circunferencia_cm' }
];

const CIRCUMFERENCE_SEGMENTS = [
  { key: 'cinturaCm', label: 'Cintura', metaKey: 'metaCinturaCm' },
  { key: 'quadrilCm', label: 'Quadril', metaKey: 'metaQuadrilCm' },
  { key: 'pescocoCm', label: 'Pescoço', metaKey: 'metaPescocoCm' },
  { key: 'bracoRelaxadoCm', label: 'Braço relaxado', metaKey: 'metaBracoRelaxadoCm' },
  { key: 'bracoContraidoCm', label: 'Braço contraído', metaKey: 'metaBracoContraidoCm' },
  { key: 'antebracoCm', label: 'Antebraço', metaKey: 'metaAntebraçoCm' },
  { key: 'coxaProximalCm', label: 'Coxa proximal', metaKey: 'metaCoxaProximalCm' },
  { key: 'coxaMedialCm', label: 'Coxa medial', metaKey: 'metaCoxaMedialCm' },
  { key: 'panturrilhaCm', label: 'Panturrilha', metaKey: 'metaPanturrilhaCm' },
  { key: 'toraxInspiradoCm', label: 'Tórax inspirado', metaKey: 'metaToraxInspiradoCm' },
  { key: 'toraxExpiradoCm', label: 'Tórax expirado', metaKey: 'metaToraxExpiradoCm' }
];

const MEASUREMENT_CONTEXT_FIELDS = [
  {
    key: 'horarioPesagem',
    label: 'Horário da pesagem',
    type: 'select',
    options: [
      { value: '', label: 'Selecione' },
      { value: 'manha', label: 'Manhã' },
      { value: 'tarde', label: 'Tarde' },
      { value: 'noite', label: 'Noite' }
    ],
    tooltip: ['Horario pode explicar variações de peso entre sessões.']
  },
  {
    key: 'condicaoMedicao',
    label: 'Condição da medida',
    type: 'select',
    options: [
      { value: 'nao_informado', label: 'Não informado' },
      { value: 'jejum', label: 'Em jejum' },
      { value: 'nao_jejum', label: 'Não em jejum' }
    ],
    tooltip: ['Padronize o contexto para comparação longitudinal mais confiável.']
  },
  {
    key: 'equipamento',
    label: 'Equipamento utilizado',
    type: 'text',
    placeholder: 'Ex.: Balanca Filizola / Estadiometro Sanny',
    tooltip: ['Registre marca/modelo para rastreabilidade técnica.']
  }
];

const INDICATOR_INFO = {
  imc: {
    name: 'IMC',
    formula: 'peso_kg / (altura_m^2)',
    reference: 'OMS - classificacao de IMC',
    year: '1995/2000'
  },
  rcq: {
    name: 'RCQ',
    formula: 'cintura_cm / quadril_cm',
    reference: 'OMS - risco cardiometabólico por sexo',
    year: '2008'
  },
  ice: {
    name: 'Indice cintura-estatura',
    formula: 'cintura_cm / estatura_cm',
    reference: 'Indice de risco central',
    year: 'uso clinico consolidado'
  },
  bsa: {
    name: 'Superficie corporal',
    formula: 'sqrt((altura_cm x peso_kg) / 3600)',
    reference: 'Mosteller',
    year: '1987'
  },
  conicity: {
    name: 'Indice de conicidade',
    formula: 'cintura_m / (0.109 * sqrt(peso_kg / estatura_m))',
    reference: 'Valdez',
    year: '1991'
  },
  ymca: {
    name: '% gordura estimado (YMCA)',
    formula: 'Homem: (-98.42 + 4.15*cintura - 0.082*peso)/peso*100 | Mulher: (-76.76 + 4.15*cintura - 0.082*peso)/peso*100',
    reference: 'YMCA',
    year: 'protocolo clinico'
  }
};

const createInitialData = () => ({
  dataAvaliacao: toLocalDateInputValue(new Date()),
  pesoKg: '',
  estaturaCm: '',
  cinturaCm: '',
  quadrilCm: '',
  pescocoCm: '',
  bracoRelaxadoCm: '',
  bracoRelaxadoCmD: '',
  bracoRelaxadoCmE: '',
  bracoContraidoCm: '',
  bracoContraidoCmD: '',
  bracoContraidoCmE: '',
  antebracoCm: '',
  antebracoCmD: '',
  antebracoCmE: '',
  coxaProximalCm: '',
  coxaProximalCmD: '',
  coxaProximalCmE: '',
  coxaMedialCm: '',
  coxaMedialCmD: '',
  coxaMedialCmE: '',
  panturrilhaCm: '',
  panturrilhaCmD: '',
  panturrilhaCmE: '',
  toraxInspiradoCm: '',
  toraxExpiradoCm: '',
  focoCardiometabolico: false,
  metaCinturaCm: '',
  metaQuadrilCm: '',
  metaPescocoCm: '',
  metaBracoRelaxadoCm: '',
  metaBracoContraidoCm: '',
  metaAntebraçoCm: '',
  metaCoxaProximalCm: '',
  metaCoxaMedialCm: '',
  metaPanturrilhaCm: '',
  metaToraxInspiradoCm: '',
  metaToraxExpiradoCm: '',
  horarioPesagem: '',
  condicaoMedicao: 'nao_informado',
  equipamento: '',
  selectedTmbFormulaId: '',
  tmbSelectionReason: ''
});

const PerimetrosCorporaisForm = ({
  pacienteId,
  onSalvar,
  onAutoSave,
  readOnly = false,
  onboardingContext,
  baselineAnthropometry,
  lockSharedAnthropometry = false,
  moduleSnapshot,
  currentSessionId,
  moduleHistory = [],
  allEvaluationHistory = []
}) => {
  const { confirm } = useUiFeedback();

  const [dados, setDados] = useState(createInitialData);
  const [error, setError] = useState('');
  const [saveStatus, setSaveStatus] = useState(null);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [touchedFields, setTouchedFields] = useState({});
  const [hasUserInput, setHasUserInput] = useState(false);
  const [metaOpen, setMetaOpen] = useState(() => (moduleHistory?.length ?? 0) > 1);

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

  useEffect(() => {
    const snapshotId = moduleSnapshot?.id || '';
    if (!snapshotId || loadedSnapshotIdRef.current === snapshotId) return;

    const source = moduleSnapshot?.dados || {};
    const dadosBrutos = source?.dados_brutos || source?.input || source;
    const metadadosFormula = source?.metadados_formula || {};
    const esportivoRaw = asRecord(firstDefined(dadosBrutos?.esportivo, source?.esportivo));
    const bilateralRaw = asRecord(firstDefined(esportivoRaw?.bilateral, esportivoRaw?.membros_bilaterais));
    const estaturaFromSnapshot = normalizeHeightToCm(
      firstDefined(
        dadosBrutos?.estaturaCm,
        dadosBrutos?.estatura_cm,
        dadosBrutos?.estatura,
        dadosBrutos?.altura,
        source?.estatura_cm,
        source?.estatura,
        source?.altura
      )
    );

    setDados((prev) => ({
      ...prev,
      dataAvaliacao: normalizeDateValue(
        moduleSnapshot?.data
          || dadosBrutos?.dataAvaliacao
          || source?.dataAvaliacao
          || prev.dataAvaliacao
      ),
      pesoKg: toInputValue(firstDefined(
        dadosBrutos?.pesoKg,
        dadosBrutos?.peso_kg,
        dadosBrutos?.peso,
        source?.peso
      )),
      estaturaCm: toInputValue(estaturaFromSnapshot),
      cinturaCm: toInputValue(firstDefined(
        dadosBrutos?.cinturaCm,
        dadosBrutos?.cintura_cm,
        dadosBrutos?.cintura,
        source?.cintura
      )),
      quadrilCm: toInputValue(firstDefined(
        dadosBrutos?.quadrilCm,
        dadosBrutos?.quadril_cm,
        dadosBrutos?.quadril,
        source?.quadril
      )),
      pescocoCm: toInputValue(firstDefined(
        dadosBrutos?.pescocoCm,
        dadosBrutos?.pescoco_cm,
        dadosBrutos?.pescoco,
        source?.pescoco
      )),
      bracoRelaxadoCm: toInputValue(firstDefined(
        dadosBrutos?.bracoRelaxadoCm,
        dadosBrutos?.braco_relaxado_cm,
        dadosBrutos?.braco_relaxado,
        source?.braco_relaxado_cm,
        source?.braco_relaxado
      )),
      bracoRelaxadoCmD: toInputValue(firstDefined(
        bilateralRaw?.bracoRelaxadoCmD,
        bilateralRaw?.braco_relaxado_cm_d,
        dadosBrutos?.bracoRelaxadoCmD,
        dadosBrutos?.braco_relaxado_cm_d
      )),
      bracoRelaxadoCmE: toInputValue(firstDefined(
        bilateralRaw?.bracoRelaxadoCmE,
        bilateralRaw?.braco_relaxado_cm_e,
        dadosBrutos?.bracoRelaxadoCmE,
        dadosBrutos?.braco_relaxado_cm_e
      )),
      bracoContraidoCm: toInputValue(firstDefined(
        dadosBrutos?.bracoContraidoCm,
        dadosBrutos?.braco_contraido_cm,
        dadosBrutos?.braco_contraido,
        source?.braco_contraido_cm,
        source?.braco_contraido
      )),
      bracoContraidoCmD: toInputValue(firstDefined(
        bilateralRaw?.bracoContraidoCmD,
        bilateralRaw?.braco_contraido_cm_d,
        dadosBrutos?.bracoContraidoCmD,
        dadosBrutos?.braco_contraido_cm_d
      )),
      bracoContraidoCmE: toInputValue(firstDefined(
        bilateralRaw?.bracoContraidoCmE,
        bilateralRaw?.braco_contraido_cm_e,
        dadosBrutos?.bracoContraidoCmE,
        dadosBrutos?.braco_contraido_cm_e
      )),
      antebracoCm: toInputValue(firstDefined(
        dadosBrutos?.antebracoCm,
        dadosBrutos?.antebraco_cm,
        dadosBrutos?.antebraco,
        source?.antebraco_cm,
        source?.antebraco
      )),
      antebracoCmD: toInputValue(firstDefined(
        bilateralRaw?.antebracoCmD,
        bilateralRaw?.antebraco_cm_d,
        dadosBrutos?.antebracoCmD,
        dadosBrutos?.antebraco_cm_d
      )),
      antebracoCmE: toInputValue(firstDefined(
        bilateralRaw?.antebracoCmE,
        bilateralRaw?.antebraco_cm_e,
        dadosBrutos?.antebracoCmE,
        dadosBrutos?.antebraco_cm_e
      )),
      coxaProximalCm: toInputValue(firstDefined(
        dadosBrutos?.coxaProximalCm,
        dadosBrutos?.coxa_proximal_cm,
        source?.coxa_proximal_cm,
        source?.coxa_proximal
      )),
      coxaProximalCmD: toInputValue(firstDefined(
        bilateralRaw?.coxaProximalCmD,
        bilateralRaw?.coxa_proximal_cm_d,
        dadosBrutos?.coxaProximalCmD,
        dadosBrutos?.coxa_proximal_cm_d
      )),
      coxaProximalCmE: toInputValue(firstDefined(
        bilateralRaw?.coxaProximalCmE,
        bilateralRaw?.coxa_proximal_cm_e,
        dadosBrutos?.coxaProximalCmE,
        dadosBrutos?.coxa_proximal_cm_e
      )),
      coxaMedialCm: toInputValue(firstDefined(
        dadosBrutos?.coxaMedialCm,
        dadosBrutos?.coxa_medial_cm,
        source?.coxa_medial_cm,
        source?.coxa_medial
      )),
      coxaMedialCmD: toInputValue(firstDefined(
        bilateralRaw?.coxaMedialCmD,
        bilateralRaw?.coxa_medial_cm_d,
        dadosBrutos?.coxaMedialCmD,
        dadosBrutos?.coxa_medial_cm_d
      )),
      coxaMedialCmE: toInputValue(firstDefined(
        bilateralRaw?.coxaMedialCmE,
        bilateralRaw?.coxa_medial_cm_e,
        dadosBrutos?.coxaMedialCmE,
        dadosBrutos?.coxa_medial_cm_e
      )),
      panturrilhaCm: toInputValue(firstDefined(
        dadosBrutos?.panturrilhaCm,
        dadosBrutos?.panturrilha_cm,
        source?.panturrilha_cm,
        source?.panturrilha
      )),
      panturrilhaCmD: toInputValue(firstDefined(
        bilateralRaw?.panturrilhaCmD,
        bilateralRaw?.panturrilha_cm_d,
        dadosBrutos?.panturrilhaCmD,
        dadosBrutos?.panturrilha_cm_d
      )),
      panturrilhaCmE: toInputValue(firstDefined(
        bilateralRaw?.panturrilhaCmE,
        bilateralRaw?.panturrilha_cm_e,
        dadosBrutos?.panturrilhaCmE,
        dadosBrutos?.panturrilha_cm_e
      )),
      toraxInspiradoCm: toInputValue(firstDefined(
        dadosBrutos?.toraxInspiradoCm,
        dadosBrutos?.torax_inspirado_cm,
        source?.torax_inspirado_cm,
        source?.torax_inspirado
      )),
      toraxExpiradoCm: toInputValue(firstDefined(
        dadosBrutos?.toraxExpiradoCm,
        dadosBrutos?.torax_expirado_cm,
        source?.torax_expirado_cm,
        source?.torax_expirado
      )),
      focoCardiometabolico: normalizeBoolean(firstDefined(
        dadosBrutos?.focoCardiometabolico,
        dadosBrutos?.foco_cardiometabolico,
        source?.foco_cardiometabolico
      )),
      metaCinturaCm: toInputValue(firstDefined(
        dadosBrutos?.metaCinturaCm,
        dadosBrutos?.meta_cintura_cm,
        source?.meta_cintura_cm
      )),
      metaQuadrilCm: toInputValue(firstDefined(
        dadosBrutos?.metaQuadrilCm,
        dadosBrutos?.meta_quadril_cm,
        source?.meta_quadril_cm
      )),
      metaPescocoCm: toInputValue(firstDefined(
        dadosBrutos?.metaPescocoCm,
        dadosBrutos?.meta_pescoco_cm,
        source?.meta_pescoco_cm
      )),
      metaBracoRelaxadoCm: toInputValue(firstDefined(
        dadosBrutos?.metaBracoRelaxadoCm,
        dadosBrutos?.meta_braco_relaxado_cm,
        source?.meta_braco_relaxado_cm
      )),
      metaBracoContraidoCm: toInputValue(firstDefined(
        dadosBrutos?.metaBracoContraidoCm,
        dadosBrutos?.meta_braco_contraido_cm,
        source?.meta_braco_contraido_cm
      )),
      metaAntebraçoCm: toInputValue(firstDefined(
        dadosBrutos?.metaAntebraçoCm,
        dadosBrutos?.meta_antebraco_cm,
        source?.meta_antebraco_cm
      )),
      metaCoxaProximalCm: toInputValue(firstDefined(
        dadosBrutos?.metaCoxaProximalCm,
        dadosBrutos?.meta_coxa_proximal_cm,
        source?.meta_coxa_proximal_cm
      )),
      metaCoxaMedialCm: toInputValue(firstDefined(
        dadosBrutos?.metaCoxaMedialCm,
        dadosBrutos?.meta_coxa_medial_cm,
        source?.meta_coxa_medial_cm
      )),
      metaPanturrilhaCm: toInputValue(firstDefined(
        dadosBrutos?.metaPanturrilhaCm,
        dadosBrutos?.meta_panturrilha_cm,
        source?.meta_panturrilha_cm
      )),
      metaToraxInspiradoCm: toInputValue(firstDefined(
        dadosBrutos?.metaToraxInspiradoCm,
        dadosBrutos?.meta_torax_inspirado_cm,
        source?.meta_torax_inspirado_cm
      )),
      metaToraxExpiradoCm: toInputValue(firstDefined(
        dadosBrutos?.metaToraxExpiradoCm,
        dadosBrutos?.meta_torax_expirado_cm,
        source?.meta_torax_expirado_cm
      )),
      horarioPesagem: toTextInput(firstDefined(
        dadosBrutos?.horarioPesagem,
        dadosBrutos?.horario_pesagem,
        source?.horario_pesagem
      )),
      condicaoMedicao: toTextInput(firstDefined(
        dadosBrutos?.condicaoMedicao,
        dadosBrutos?.condicao_medicao,
        source?.condicao_medicao,
        'nao_informado'
      )) || 'nao_informado',
      equipamento: toTextInput(firstDefined(
        dadosBrutos?.equipamento,
        source?.equipamento
      )),
      selectedTmbFormulaId: toTextInput(firstDefined(
        metadadosFormula?.formulaId,
        source?.formulaId,
        moduleSnapshot?.formulaId
      )),
      tmbSelectionReason: toTextInput(firstDefined(
        metadadosFormula?.justificativa,
        source?.tmbSelectionReason
      ))
    }));

    loadedSnapshotIdRef.current = snapshotId;
  }, [moduleSnapshot]);

  useEffect(() => {
    if (!baselineAnthropometry) return;

    const baselineWeight = toInputValue(baselineAnthropometry?.pesoKg, 1);
    const baselineHeight = toInputValue(baselineAnthropometry?.estaturaCm, 1);

    setDados((prev) => ({
      ...prev,
      pesoKg: lockSharedAnthropometry ? baselineWeight : (prev.pesoKg || baselineWeight),
      estaturaCm: lockSharedAnthropometry ? baselineHeight : (prev.estaturaCm || baselineHeight)
    }));
  }, [baselineAnthropometry, lockSharedAnthropometry]);

  const sharedSex = useMemo(
    () => normalizeSexToken(baselineAnthropometry?.sexo),
    [baselineAnthropometry?.sexo]
  );
  const sharedAge = useMemo(
    () => parseNumeric(baselineAnthropometry?.idade),
    [baselineAnthropometry?.idade]
  );

  const numericFields = useMemo(() => ({
    pesoKg: parseNumeric(dados.pesoKg),
    estaturaCm: normalizeHeightToCm(dados.estaturaCm),
    cinturaCm: parseNumeric(dados.cinturaCm),
    quadrilCm: parseNumeric(dados.quadrilCm),
    pescocoCm: parseNumeric(dados.pescocoCm),
    bracoRelaxadoCmD: parseNumeric(dados.bracoRelaxadoCmD),
    bracoRelaxadoCmE: parseNumeric(dados.bracoRelaxadoCmE),
    bracoRelaxadoCm: resolveSingleFromBilateral({
      single: parseNumeric(dados.bracoRelaxadoCm),
      right: parseNumeric(dados.bracoRelaxadoCmD),
      left: parseNumeric(dados.bracoRelaxadoCmE)
    }),
    bracoContraidoCmD: parseNumeric(dados.bracoContraidoCmD),
    bracoContraidoCmE: parseNumeric(dados.bracoContraidoCmE),
    bracoContraidoCm: resolveSingleFromBilateral({
      single: parseNumeric(dados.bracoContraidoCm),
      right: parseNumeric(dados.bracoContraidoCmD),
      left: parseNumeric(dados.bracoContraidoCmE)
    }),
    antebracoCmD: parseNumeric(dados.antebracoCmD),
    antebracoCmE: parseNumeric(dados.antebracoCmE),
    antebracoCm: resolveSingleFromBilateral({
      single: parseNumeric(dados.antebracoCm),
      right: parseNumeric(dados.antebracoCmD),
      left: parseNumeric(dados.antebracoCmE)
    }),
    coxaProximalCmD: parseNumeric(dados.coxaProximalCmD),
    coxaProximalCmE: parseNumeric(dados.coxaProximalCmE),
    coxaProximalCm: resolveSingleFromBilateral({
      single: parseNumeric(dados.coxaProximalCm),
      right: parseNumeric(dados.coxaProximalCmD),
      left: parseNumeric(dados.coxaProximalCmE)
    }),
    coxaMedialCmD: parseNumeric(dados.coxaMedialCmD),
    coxaMedialCmE: parseNumeric(dados.coxaMedialCmE),
    coxaMedialCm: resolveSingleFromBilateral({
      single: parseNumeric(dados.coxaMedialCm),
      right: parseNumeric(dados.coxaMedialCmD),
      left: parseNumeric(dados.coxaMedialCmE)
    }),
    panturrilhaCmD: parseNumeric(dados.panturrilhaCmD),
    panturrilhaCmE: parseNumeric(dados.panturrilhaCmE),
    panturrilhaCm: resolveSingleFromBilateral({
      single: parseNumeric(dados.panturrilhaCm),
      right: parseNumeric(dados.panturrilhaCmD),
      left: parseNumeric(dados.panturrilhaCmE)
    }),
    toraxInspiradoCm: parseNumeric(dados.toraxInspiradoCm),
    toraxExpiradoCm: parseNumeric(dados.toraxExpiradoCm),
    metaCinturaCm: parseNumeric(dados.metaCinturaCm),
    metaQuadrilCm: parseNumeric(dados.metaQuadrilCm),
    metaPescocoCm: parseNumeric(dados.metaPescocoCm),
    metaBracoRelaxadoCm: parseNumeric(dados.metaBracoRelaxadoCm),
    metaBracoContraidoCm: parseNumeric(dados.metaBracoContraidoCm),
    metaAntebraçoCm: parseNumeric(dados.metaAntebraçoCm),
    metaCoxaProximalCm: parseNumeric(dados.metaCoxaProximalCm),
    metaCoxaMedialCm: parseNumeric(dados.metaCoxaMedialCm),
    metaPanturrilhaCm: parseNumeric(dados.metaPanturrilhaCm),
    metaToraxInspiradoCm: parseNumeric(dados.metaToraxInspiradoCm),
    metaToraxExpiradoCm: parseNumeric(dados.metaToraxExpiradoCm)
  }), [
    dados.antebracoCm,
    dados.antebracoCmD,
    dados.antebracoCmE,
    dados.bracoContraidoCm,
    dados.bracoContraidoCmD,
    dados.bracoContraidoCmE,
    dados.bracoRelaxadoCm,
    dados.bracoRelaxadoCmD,
    dados.bracoRelaxadoCmE,
    dados.cinturaCm,
    dados.coxaMedialCm,
    dados.coxaMedialCmD,
    dados.coxaMedialCmE,
    dados.coxaProximalCm,
    dados.coxaProximalCmD,
    dados.coxaProximalCmE,
    dados.estaturaCm,
    dados.metaAntebraçoCm,
    dados.metaBracoContraidoCm,
    dados.metaBracoRelaxadoCm,
    dados.metaCinturaCm,
    dados.metaCoxaMedialCm,
    dados.metaCoxaProximalCm,
    dados.metaPanturrilhaCm,
    dados.metaPescocoCm,
    dados.metaQuadrilCm,
    dados.metaToraxExpiradoCm,
    dados.metaToraxInspiradoCm,
    dados.panturrilhaCm,
    dados.panturrilhaCmD,
    dados.panturrilhaCmE,
    dados.pescocoCm,
    dados.pesoKg,
    dados.quadrilCm,
    dados.toraxExpiradoCm,
    dados.toraxInspiradoCm
  ]);

  const bilateralAsymmetryRows = useMemo(
    () => BILATERAL_MEMBER_FIELDS.map((field) => {
      const right = numericFields[`${field.key}D`];
      const left = numericFields[`${field.key}E`];
      return {
        key: field.key,
        label: field.label,
        right: Number.isFinite(right) ? right : null,
        left: Number.isFinite(left) ? left : null,
        asymmetryPct: calculateAsymmetryIndex(right, left)
      };
    }),
    [numericFields]
  );

  const panturrilhaBelowCutoff = useMemo(
    () => (
      (Number.isFinite(numericFields.panturrilhaCmD) && numericFields.panturrilhaCmD < 31)
      || (Number.isFinite(numericFields.panturrilhaCmE) && numericFields.panturrilhaCmE < 31)
      || (Number.isFinite(numericFields.panturrilhaCm) && numericFields.panturrilhaCm < 31)
    ),
    [numericFields.panturrilhaCm, numericFields.panturrilhaCmD, numericFields.panturrilhaCmE]
  );

  const anthropometry = useMemo(() => calculateAnthropometryIndicators({
    weightKg: numericFields.pesoKg,
    heightCm: numericFields.estaturaCm,
    waistCm: numericFields.cinturaCm,
    hipCm: numericFields.quadrilCm,
    neckCm: numericFields.pescocoCm,
    ageYears: sharedAge,
    sex: sharedSex
  }), [
    numericFields.cinturaCm,
    numericFields.estaturaCm,
    numericFields.pescocoCm,
    numericFields.pesoKg,
    numericFields.quadrilCm,
    sharedAge,
    sharedSex
  ]);

  const circumferenceIndicators = useMemo(() => calculateCircumferenceIndicators({
    weightKg: numericFields.pesoKg,
    heightCm: numericFields.estaturaCm,
    waistCm: numericFields.cinturaCm,
    hipCm: numericFields.quadrilCm,
    sex: sharedSex
  }), [
    numericFields.cinturaCm,
    numericFields.estaturaCm,
    numericFields.pesoKg,
    numericFields.quadrilCm,
    sharedSex
  ]);

  const latestFatFreeMass = useMemo(
    () => resolveLatestFatFreeMass(allEvaluationHistory),
    [allEvaluationHistory]
  );

  const tmbComparative = useMemo(() => calculateTmbComparative({
    weightKg: numericFields.pesoKg,
    heightCm: numericFields.estaturaCm,
    ageYears: sharedAge,
    sex: sharedSex,
    fatFreeMassKg: latestFatFreeMass,
    population: 'tropical'
  }), [
    latestFatFreeMass,
    numericFields.estaturaCm,
    numericFields.pesoKg,
    sharedAge,
    sharedSex
  ]);

  useEffect(() => {
    if (!Array.isArray(tmbComparative?.rows)) return;
    const applicableIds = tmbComparative.rows.filter((row) => row.applicable).map((row) => row.formulaId);
    if (!applicableIds.length) return;

    const selectedId = dados.selectedTmbFormulaId;
    if (selectedId && applicableIds.includes(selectedId)) return;

    const nextId = tmbComparative.defaultFormulaId && applicableIds.includes(tmbComparative.defaultFormulaId)
      ? tmbComparative.defaultFormulaId
      : applicableIds[0];

    setDados((prev) => ({ ...prev, selectedTmbFormulaId: nextId }));
  }, [dados.selectedTmbFormulaId, tmbComparative]);

  const selectedTmb = useMemo(
    () => resolveOfficialTmbSelection({
      comparative: tmbComparative,
      selectedFormulaId: dados.selectedTmbFormulaId
    }),
    [dados.selectedTmbFormulaId, tmbComparative]
  );

  const requiredFieldValidation = useMemo(() => {
    const validation = {};
    REQUIRED_FIELDS.forEach((field) => {
      validation[field.key] = validateInputField({
        value: dados[field.key],
        required: true,
        metric: field.metric
      });
    });
    return validation;
  }, [dados]);

  const optionalFieldValidation = useMemo(() => {
    const validation = {};
    OPTIONAL_FIELDS.forEach((field) => {
      validation[field.key] = validateInputField({
        value: dados[field.key],
        required: false,
        metric: field.metric
      });
    });
    return validation;
  }, [dados]);

  const combinedValidation = useMemo(
    () => ({ ...requiredFieldValidation, ...optionalFieldValidation }),
    [optionalFieldValidation, requiredFieldValidation]
  );

  const hasFieldErrors = useMemo(
    () => Object.values(combinedValidation).some((item) => item.status === 'error'),
    [combinedValidation]
  );

  const outlierWarnings = useMemo(
    () => Object.entries(combinedValidation)
      .filter(([, item]) => item.status === 'warning')
      .map(([fieldKey, item]) => ({ fieldKey, message: item.message })),
    [combinedValidation]
  );

  const hasRequiredMissing = useMemo(
    () => {
      const baseMissing = REQUIRED_FIELDS.some((field) => !Number.isFinite(parseNumeric(dados[field.key])));
      if (baseMissing) return true;
      if (dados.focoCardiometabolico && !Number.isFinite(parseNumeric(dados.cinturaCm))) return true;
      return false;
    },
    [dados]
  );

  const normalizedHistory = useMemo(
    () => normalizePerimetrosHistory(moduleHistory),
    [moduleHistory]
  );

  const referenceHistory = useMemo(() => {
    const currentSnapshotId = moduleSnapshot?.id || '';
    const filtered = normalizedHistory.filter((item) => !currentSnapshotId || item.id !== currentSnapshotId);
    return filtered.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  }, [moduleSnapshot?.id, normalizedHistory]);

  const previousReference = referenceHistory[0] || null;
  const firstReference = referenceHistory.length ? referenceHistory[referenceHistory.length - 1] : null;

  const comparisonRows = useMemo(() => {
    const current = {
      peso: numericFields.pesoKg,
      imc: anthropometry?.indicators?.bmi,
      rcq: anthropometry?.indicators?.rcq,
      ice: anthropometry?.indicators?.ice,
      conicity: circumferenceIndicators?.indicators?.conicity,
      bsa: anthropometry?.indicators?.bodySurfaceArea
    };

    const previous = previousReference?.metrics || {};
    const first = firstReference?.metrics || {};

    return [
      createComparisonRow('peso', 'Peso', 'kg', current.peso, previous.peso, first.peso),
      createComparisonRow('imc', 'IMC', 'kg/m2', current.imc, previous.imc, first.imc),
      createComparisonRow('rcq', 'RCQ', '', current.rcq, previous.rcq, first.rcq),
      createComparisonRow('ice', 'ICE', '', current.ice, previous.ice, first.ice),
      createComparisonRow('conicity', 'Indice de conicidade', '', current.conicity, previous.conicity, first.conicity),
      createComparisonRow('bsa', 'Superficie corporal', 'm2', current.bsa, previous.bsa, first.bsa)
    ];
  }, [
    anthropometry?.indicators?.bmi,
    anthropometry?.indicators?.bodySurfaceArea,
    anthropometry?.indicators?.ice,
    anthropometry?.indicators?.rcq,
    circumferenceIndicators?.indicators?.conicity,
    firstReference?.metrics,
    numericFields.pesoKg,
    previousReference?.metrics
  ]);

  const segmentComparisonRows = useMemo(() => (
    CIRCUMFERENCE_SEGMENTS.map((segment) => {
      const currentValue = numericFields[segment.key];
      const previousValue = previousReference?.metrics?.[segment.key];
      const metaValue = numericFields[segment.metaKey];
      return {
        key: segment.key,
        label: segment.label,
        current: Number.isFinite(currentValue) ? currentValue : null,
        previous: Number.isFinite(previousValue) ? previousValue : null,
        meta: Number.isFinite(metaValue) ? metaValue : null,
        delta: buildComparativeDeltas({ current: currentValue, reference: previousValue })
      };
    })
  ), [numericFields, previousReference?.metrics]);

  const silhouetteSegments = useMemo(() => (
    CIRCUMFERENCE_SEGMENTS.map((segment) => {
      const row = segmentComparisonRows.find((item) => item.key === segment.key);
      return {
        ...segment,
        tone: resolveSegmentTone(row)
      };
    })
  ), [segmentComparisonRows]);

  const sparklineSeries = useMemo(() => {
    const chronological = [...referenceHistory].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    return {
      peso: buildSparklineSeries(chronological, 'peso', numericFields.pesoKg),
      imc: buildSparklineSeries(chronological, 'imc', anthropometry?.indicators?.bmi),
      ice: buildSparklineSeries(chronological, 'ice', anthropometry?.indicators?.ice),
      conicity: buildSparklineSeries(chronological, 'conicity', circumferenceIndicators?.indicators?.conicity)
    };
  }, [
    anthropometry?.indicators?.bmi,
    anthropometry?.indicators?.ice,
    circumferenceIndicators?.indicators?.conicity,
    numericFields.pesoKg,
    referenceHistory
  ]);

  const autoInterpretation = useMemo(
    () => buildAutoInterpretation(comparisonRows),
    [comparisonRows]
  );

  const payloadData = useMemo(() => {
    const selectedFormula = selectedTmb?.selected || null;
    const bmi = anthropometry?.indicators?.bmi;
    const rcq = anthropometry?.indicators?.rcq;
    const ice = anthropometry?.indicators?.ice;
    const bsa = anthropometry?.indicators?.bodySurfaceArea;
    const waistRisk = anthropometry?.classifications?.waistRisk;
    const imcClass = anthropometry?.classifications?.bmi;
    const rcqClass = anthropometry?.classifications?.rcq;
    const iceClass = anthropometry?.classifications?.ice;
    const deltaPeso = buildComparativeDeltas({
      current: numericFields.pesoKg,
      reference: previousReference?.metrics?.peso
    });
    const deltaImc = buildComparativeDeltas({
      current: bmi,
      reference: previousReference?.metrics?.imc
    });
    const deltaIce = buildComparativeDeltas({
      current: ice,
      reference: previousReference?.metrics?.ice
    });
    const deltaConicity = buildComparativeDeltas({
      current: circumferenceIndicators?.indicators?.conicity,
      reference: previousReference?.metrics?.conicity
    });

    const tmbRowsPayload = (Array.isArray(tmbComparative?.rows) ? tmbComparative.rows : [])
      .filter((row) => row.applicable && Number.isFinite(row.valueKcal))
      .map((row) => ({
        formulaId: row.formulaId,
        formulaVersion: row.formulaVersion,
        label: row.label,
        tmbKcal: row.valueKcal
      }));
    const bilateralPayload = buildPerimetrosBilateralPayload(numericFields);
    const asymmetryPayload = buildPerimetrosAsymmetryPayload(bilateralAsymmetryRows);

    const estaturaM = Number.isFinite(numericFields.estaturaCm)
      ? Number((numericFields.estaturaCm / 100).toFixed(4))
      : null;

    return {
      peso: numericFields.pesoKg,
      peso_kg: numericFields.pesoKg,
      weight: numericFields.pesoKg,
      estatura: estaturaM,
      estatura_m: estaturaM,
      estatura_cm: numericFields.estaturaCm,
      altura: numericFields.estaturaCm,
      height: numericFields.estaturaCm,
      cintura: numericFields.cinturaCm,
      cintura_cm: numericFields.cinturaCm,
      quadril: numericFields.quadrilCm,
      quadril_cm: numericFields.quadrilCm,
      pescoco: numericFields.pescocoCm,
      pescoco_cm: numericFields.pescocoCm,
      braco_relaxado_cm: numericFields.bracoRelaxadoCm,
      braco_contraido_cm: numericFields.bracoContraidoCm,
      antebraco_cm: numericFields.antebracoCm,
      coxa_proximal_cm: numericFields.coxaProximalCm,
      coxa_medial_cm: numericFields.coxaMedialCm,
      panturrilha_cm: numericFields.panturrilhaCm,
      braco_relaxado_cm_d: bilateralPayload.bracoRelaxadoCmD,
      braco_relaxado_cm_e: bilateralPayload.bracoRelaxadoCmE,
      braco_contraido_cm_d: bilateralPayload.bracoContraidoCmD,
      braco_contraido_cm_e: bilateralPayload.bracoContraidoCmE,
      antebraco_cm_d: bilateralPayload.antebracoCmD,
      antebraco_cm_e: bilateralPayload.antebracoCmE,
      coxa_proximal_cm_d: bilateralPayload.coxaProximalCmD,
      coxa_proximal_cm_e: bilateralPayload.coxaProximalCmE,
      coxa_medial_cm_d: bilateralPayload.coxaMedialCmD,
      coxa_medial_cm_e: bilateralPayload.coxaMedialCmE,
      panturrilha_cm_d: bilateralPayload.panturrilhaCmD,
      panturrilha_cm_e: bilateralPayload.panturrilhaCmE,
      torax_inspirado_cm: numericFields.toraxInspiradoCm,
      torax_expirado_cm: numericFields.toraxExpiradoCm,
      esportivo: {
        bilateral: bilateralPayload,
        assimetria: asymmetryPayload
      },
      foco_cardiometabolico: Boolean(dados.focoCardiometabolico),
      meta_cintura_cm: numericFields.metaCinturaCm,
      meta_quadril_cm: numericFields.metaQuadrilCm,
      meta_pescoco_cm: numericFields.metaPescocoCm,
      meta_braco_relaxado_cm: numericFields.metaBracoRelaxadoCm,
      meta_braco_contraido_cm: numericFields.metaBracoContraidoCm,
      meta_antebraco_cm: numericFields.metaAntebraçoCm,
      meta_coxa_proximal_cm: numericFields.metaCoxaProximalCm,
      meta_coxa_medial_cm: numericFields.metaCoxaMedialCm,
      meta_panturrilha_cm: numericFields.metaPanturrilhaCm,
      meta_torax_inspirado_cm: numericFields.metaToraxInspiradoCm,
      meta_torax_expirado_cm: numericFields.metaToraxExpiradoCm,
      horario_pesagem: dados.horarioPesagem || null,
      condicao_medicao: dados.condicaoMedicao || 'nao_informado',
      equipamento: toTextInput(dados.equipamento) || null,
      sexo: sharedSex,
      idade: Number.isFinite(sharedAge) ? Math.round(sharedAge) : null,
      imc: Number.isFinite(bmi) ? Number(bmi.toFixed(2)) : null,
      rcq: Number.isFinite(rcq) ? Number(rcq.toFixed(3)) : null,
      indice_cintura_estatura: Number.isFinite(ice) ? Number(ice.toFixed(3)) : null,
      area_superficie_corporal: Number.isFinite(bsa) ? Number(bsa.toFixed(3)) : null,
      indice_conicidade: Number.isFinite(circumferenceIndicators?.indicators?.conicity)
        ? Number(circumferenceIndicators.indicators.conicity.toFixed(3))
        : null,
      percentual_gordura_ymca: Number.isFinite(circumferenceIndicators?.indicators?.ymcaPercentFat)
        ? Number(circumferenceIndicators.indicators.ymcaPercentFat.toFixed(2))
        : null,
      risco_cintura: waistRisk?.label || null,
      dados_brutos: {
        pesoKg: numericFields.pesoKg,
        estaturaCm: numericFields.estaturaCm,
        cinturaCm: numericFields.cinturaCm,
        quadrilCm: numericFields.quadrilCm,
        pescocoCm: numericFields.pescocoCm,
        bracoRelaxadoCm: numericFields.bracoRelaxadoCm,
        bracoContraidoCm: numericFields.bracoContraidoCm,
        antebracoCm: numericFields.antebracoCm,
        coxaProximalCm: numericFields.coxaProximalCm,
        coxaMedialCm: numericFields.coxaMedialCm,
        panturrilhaCm: numericFields.panturrilhaCm,
        esportivo: {
          bilateral: bilateralPayload,
          assimetria: asymmetryPayload
        },
        toraxInspiradoCm: numericFields.toraxInspiradoCm,
        toraxExpiradoCm: numericFields.toraxExpiradoCm,
        focoCardiometabolico: Boolean(dados.focoCardiometabolico),
        metas: {
          cinturaCm: numericFields.metaCinturaCm,
          quadrilCm: numericFields.metaQuadrilCm,
          pescocoCm: numericFields.metaPescocoCm,
          bracoRelaxadoCm: numericFields.metaBracoRelaxadoCm,
          bracoContraidoCm: numericFields.metaBracoContraidoCm,
          antebracoCm: numericFields.metaAntebraçoCm,
          coxaProximalCm: numericFields.metaCoxaProximalCm,
          coxaMedialCm: numericFields.metaCoxaMedialCm,
          panturrilhaCm: numericFields.metaPanturrilhaCm,
          toraxInspiradoCm: numericFields.metaToraxInspiradoCm,
          toraxExpiradoCm: numericFields.metaToraxExpiradoCm
        },
        horarioPesagem: dados.horarioPesagem || null,
        condicaoMedicao: dados.condicaoMedicao || 'nao_informado',
        equipamento: toTextInput(dados.equipamento) || null,
        sexo: sharedSex,
        idade: Number.isFinite(sharedAge) ? Math.round(sharedAge) : null
      },
      resultados_calculados: {
        imc: Number.isFinite(bmi) ? Number(bmi.toFixed(2)) : null,
        rcq: Number.isFinite(rcq) ? Number(rcq.toFixed(3)) : null,
        indiceCinturaEstatura: Number.isFinite(ice) ? Number(ice.toFixed(3)) : null,
        areaSuperficieCorporal: Number.isFinite(bsa) ? Number(bsa.toFixed(3)) : null,
        indiceConicidade: Number.isFinite(circumferenceIndicators?.indicators?.conicity)
          ? Number(circumferenceIndicators.indicators.conicity.toFixed(3))
          : null,
        percentualGorduraYmca: Number.isFinite(circumferenceIndicators?.indicators?.ymcaPercentFat)
          ? Number(circumferenceIndicators.indicators.ymcaPercentFat.toFixed(2))
          : null,
        tmbSelecionada: selectedTmb?.tmbKcal ?? null,
        tmbComparativo: tmbRowsPayload
      },
      classificacoes: {
        imc: imcClass?.label || null,
        rcq: rcqClass?.label || null,
        cintura: waistRisk?.label || null,
        ice: iceClass?.label || null,
        conicidade: circumferenceIndicators?.classifications?.conicity?.label || null,
        ymca: circumferenceIndicators?.classifications?.ymcaPercentFat?.label || null,
        referenciaImc: imcClass?.source || null
      },
      metadados_formula: {
        formulaId: selectedFormula?.formulaId || null,
        formulaVersion: selectedFormula?.formulaVersion || null,
        formulaLabel: selectedFormula?.label || null,
        equacao: selectedFormula?.equation || null,
        justificativa: toTextInput(dados.tmbSelectionReason) || null
      },
      comparacao: {
        referencia_comparacao: previousReference ? 'avaliacao_anterior' : null,
        delta_peso_kg: Number.isFinite(deltaPeso.deltaAbs) ? Number(deltaPeso.deltaAbs.toFixed(2)) : null,
        delta_peso_percentual: Number.isFinite(deltaPeso.deltaPct) ? Number(deltaPeso.deltaPct.toFixed(2)) : null,
        delta_imc: Number.isFinite(deltaImc.deltaAbs) ? Number(deltaImc.deltaAbs.toFixed(2)) : null,
        delta_imc_percentual: Number.isFinite(deltaImc.deltaPct) ? Number(deltaImc.deltaPct.toFixed(2)) : null,
        delta_ice: Number.isFinite(deltaIce.deltaAbs) ? Number(deltaIce.deltaAbs.toFixed(3)) : null,
        delta_ice_percentual: Number.isFinite(deltaIce.deltaPct) ? Number(deltaIce.deltaPct.toFixed(2)) : null,
        delta_conicidade: Number.isFinite(deltaConicity.deltaAbs) ? Number(deltaConicity.deltaAbs.toFixed(3)) : null,
        delta_conicidade_percentual: Number.isFinite(deltaConicity.deltaPct) ? Number(deltaConicity.deltaPct.toFixed(2)) : null
      },
      input: {
        dataAvaliacao: normalizeDateValue(dados.dataAvaliacao),
        pesoKg: numericFields.pesoKg,
        estaturaCm: numericFields.estaturaCm,
        cinturaCm: numericFields.cinturaCm,
        quadrilCm: numericFields.quadrilCm,
        pescocoCm: numericFields.pescocoCm,
        esportivo: {
          bilateral: bilateralPayload,
          assimetria: asymmetryPayload
        },
        horarioPesagem: dados.horarioPesagem || null,
        condicaoMedicao: dados.condicaoMedicao || 'nao_informado',
        equipamento: toTextInput(dados.equipamento) || null
      },
      source: {
        mode: 'manual',
        system: 'antropometria_basica'
      }
    };
  }, [
    anthropometry?.classifications?.bmi,
    anthropometry?.classifications?.ice,
    anthropometry?.classifications?.rcq,
    anthropometry?.classifications?.waistRisk,
    anthropometry?.indicators?.bmi,
    anthropometry?.indicators?.bodySurfaceArea,
    anthropometry?.indicators?.ice,
    anthropometry?.indicators?.rcq,
    dados.condicaoMedicao,
    dados.dataAvaliacao,
    dados.equipamento,
    dados.focoCardiometabolico,
    dados.horarioPesagem,
    dados.tmbSelectionReason,
    numericFields,
    previousReference,
    selectedTmb,
    sharedAge,
    sharedSex,
    circumferenceIndicators,
    tmbComparative,
    bilateralAsymmetryRows
  ]);

  const payloadResults = useMemo(() => ({
    imc: payloadData.imc,
    rcq: payloadData.rcq,
    indice_cintura_estatura: payloadData.indice_cintura_estatura,
    indice_conicidade: payloadData.indice_conicidade,
    percentual_gordura_ymca: payloadData.percentual_gordura_ymca,
    area_superficie_corporal: payloadData.area_superficie_corporal,
    risco_cintura: payloadData.risco_cintura,
    tmbSelecionada: payloadData.resultados_calculados?.tmbSelecionada ?? null,
    calculated: {
      imc: payloadData.imc,
      rcq: payloadData.rcq,
      indiceCinturaEstatura: payloadData.indice_cintura_estatura,
      indiceConicidade: payloadData.indice_conicidade,
      percentualGorduraYmca: payloadData.percentual_gordura_ymca,
      areaSuperficieCorporal: payloadData.area_superficie_corporal,
      tmbSelecionada: payloadData.resultados_calculados?.tmbSelecionada ?? null
    },
    output: {
      classificacaoImc: payloadData.classificacoes?.imc ?? null,
      classificacaoRcq: payloadData.classificacoes?.rcq ?? null,
      classificacaoCintura: payloadData.classificacoes?.cintura ?? null,
      classificacaoIce: payloadData.classificacoes?.ice ?? null,
      classificacaoConicidade: payloadData.classificacoes?.conicidade ?? null,
      classificacaoYmca: payloadData.classificacoes?.ymca ?? null
    },
    comparacao: payloadData.comparacao
  }), [payloadData]);

  const hasValues = useMemo(() => {
    const candidates = [
      dados.pesoKg,
      dados.estaturaCm,
      dados.cinturaCm,
      dados.quadrilCm,
      dados.pescocoCm,
      dados.bracoRelaxadoCm,
      dados.bracoRelaxadoCmD,
      dados.bracoRelaxadoCmE,
      dados.bracoContraidoCm,
      dados.bracoContraidoCmD,
      dados.bracoContraidoCmE,
      dados.antebracoCm,
      dados.antebracoCmD,
      dados.antebracoCmE,
      dados.coxaProximalCm,
      dados.coxaProximalCmD,
      dados.coxaProximalCmE,
      dados.coxaMedialCm,
      dados.coxaMedialCmD,
      dados.coxaMedialCmE,
      dados.panturrilhaCm,
      dados.panturrilhaCmD,
      dados.panturrilhaCmE,
      dados.toraxInspiradoCm,
      dados.toraxExpiradoCm,
      dados.horarioPesagem,
      dados.condicaoMedicao,
      dados.equipamento
    ];
    return candidates.some((value) => toTextInput(value) !== '');
  }, [
    dados.condicaoMedicao,
    dados.cinturaCm,
    dados.coxaMedialCm,
    dados.coxaMedialCmD,
    dados.coxaMedialCmE,
    dados.coxaProximalCm,
    dados.coxaProximalCmD,
    dados.coxaProximalCmE,
    dados.equipamento,
    dados.estaturaCm,
    dados.horarioPesagem,
    dados.panturrilhaCm,
    dados.panturrilhaCmD,
    dados.panturrilhaCmE,
    dados.pescocoCm,
    dados.pesoKg,
    dados.quadrilCm
    ,
    dados.toraxExpiradoCm,
    dados.toraxInspiradoCm,
    dados.bracoRelaxadoCm,
    dados.bracoRelaxadoCmD,
    dados.bracoRelaxadoCmE,
    dados.bracoContraidoCm,
    dados.bracoContraidoCmD,
    dados.bracoContraidoCmE,
    dados.antebracoCm,
    dados.antebracoCmD,
    dados.antebracoCmE
  ]);

  const dispatchSave = useCallback(async (auto = false) => {
    const dispatch = auto ? onAutoSave : onSalvar;
    if (!dispatch) return;

    await dispatch({
      tipo: 'perimetros',
      dados: payloadData,
      resultados: payloadResults,
      data: dados.dataAvaliacao,
      pacienteId,
      schemaVersion: 3,
      formulaId: selectedTmb?.formulaId || 'mifflin_st_jeor_1990',
      formulaVersion: selectedTmb?.formulaVersion || '1.0.0',
      sourceSystem: 'manual',
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
    payloadResults,
    selectedTmb?.formulaId,
    selectedTmb?.formulaVersion
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
      setError('Preencha ao menos os dados obrigatorios da avaliacao.');
      return;
    }

    if (hasRequiredMissing) {
      setError(dados.focoCardiometabolico
        ? 'Peso, estatura e cintura sao obrigatorios quando foco cardiometabolico estiver ativo.'
        : 'Peso e estatura sao obrigatorios para salvar a antropometria basica.');
      return;
    }

    if (hasFieldErrors) {
      setError('Existem campos com erro de validacao. Revise os valores destacados.');
      return;
    }

    if (outlierWarnings.length > 0) {
      const proceed = await confirm({
        title: 'Valores fora da faixa fisiológica',
        details: outlierWarnings.map((item) => `${resolveFieldLabel(item.fieldKey)}: ${item.message}`),
        confirmLabel: 'Salvar mesmo assim',
        cancelLabel: 'Corrigir',
        variant: 'warning'
      });
      if (!proceed) return;
    }

    await executeSave(false);
  }, [
    confirm,
    dados.focoCardiometabolico,
    executeSave,
    hasFieldErrors,
    hasRequiredMissing,
    hasValues,
    onSalvar,
    outlierWarnings
  ]);

  useEffect(() => {
    if (readOnly || !onAutoSave || !hasUserInput) return undefined;
    if (!hasValues || hasFieldErrors || hasRequiredMissing) return undefined;

    clearTimeout(autoSaveRef.current);
    autoSaveRef.current = setTimeout(() => {
      executeSave(true);
    }, 3500);

    return () => clearTimeout(autoSaveRef.current);
  }, [executeSave, hasFieldErrors, hasRequiredMissing, hasUserInput, hasValues, onAutoSave, readOnly]);

  useEffect(() => () => {
    if (saveStatusResetRef.current) clearTimeout(saveStatusResetRef.current);
  }, []);

  const imcCardDelta = useMemo(
    () => buildComparativeDeltas({
      current: anthropometry?.indicators?.bmi,
      reference: previousReference?.metrics?.imc
    }),
    [anthropometry?.indicators?.bmi, previousReference?.metrics?.imc]
  );
  const pesoCardDelta = useMemo(
    () => buildComparativeDeltas({
      current: numericFields.pesoKg,
      reference: previousReference?.metrics?.peso
    }),
    [numericFields.pesoKg, previousReference?.metrics?.peso]
  );
  const iceCardDelta = useMemo(
    () => buildComparativeDeltas({
      current: anthropometry?.indicators?.ice,
      reference: previousReference?.metrics?.ice
    }),
    [anthropometry?.indicators?.ice, previousReference?.metrics?.ice]
  );

  const isSharedWeightLocked = lockSharedAnthropometry && Number.isFinite(parseNumeric(baselineAnthropometry?.pesoKg));
  const isSharedHeightLocked = lockSharedAnthropometry && Number.isFinite(parseNumeric(baselineAnthropometry?.estaturaCm));

  const tmbRows = useMemo(
    () => (Array.isArray(tmbComparative?.rows) ? tmbComparative.rows : []),
    [tmbComparative]
  );
  const hasApplicableTmbRows = tmbRows.some((row) => row.applicable);
  const onboardingResumo = useMemo(() => {
    if (!onboardingContext || typeof onboardingContext !== 'object') return [];
    const resumo = [];
    const modalidade = toTextInput(onboardingContext?.modalidadePrincipal);
    const frequencia = parseNumeric(onboardingContext?.frequenciaSemanal);
    const duracao = parseNumeric(onboardingContext?.duracaoSessao);
    if (modalidade) resumo.push(`Modalidade: ${modalidade}`);
    if (Number.isFinite(frequencia)) resumo.push(`Frequencia: ${frequencia}x/sem`);
    if (Number.isFinite(duracao)) resumo.push(`Sessao media: ${duracao} min`);
    return resumo.slice(0, 3);
  }, [onboardingContext]);
  const comparabilidadeColeta = useMemo(() => {
    const checklist = [
      Boolean(toTextInput(dados.horarioPesagem)),
      Boolean(toTextInput(dados.equipamento)),
      Boolean(toTextInput(dados.condicaoMedicao) && dados.condicaoMedicao !== 'nao_informado')
    ];
    const score = checklist.filter(Boolean).length;
    if (score === 3) return 'Comparabilidade alta da coleta (contexto completo).';
    if (score === 2) return 'Comparabilidade moderada (falta 1 item de contexto).';
    return 'Comparabilidade baixa (padronize horario, condicao e equipamento).';
  }, [dados.condicaoMedicao, dados.equipamento, dados.horarioPesagem]);

  return (
    <div className={`eval-card perimetros-form perimetros-form--modern${readOnly ? ' eval-card--readonly' : ''}`}>
      <div className="eval-header">
        <div className="eval-icon">
          <Ruler size={22} />
        </div>
        <div>
          <h3 className="eval-title">Antropometria basica</h3>
          <p className="eval-subtitle">
            Medidas principais, indicadores automaticos e comparacao longitudinal da evolucao.
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

      <fieldset className="eval-section eval-fieldset">
        <legend className="eval-section-title eval-legend">Dados obrigatórios</legend>
        <div className="perimetros-grid">
          <div className="eval-field">
            <label className="eval-label">Data da avaliacao</label>
            <input
              type="date"
              className="eval-input"
              value={dados.dataAvaliacao || ''}
              onChange={(event) => {
                setHasUserInput(true);
                setDados((prev) => ({ ...prev, dataAvaliacao: event.target.value }));
              }}
              disabled={readOnly}
            />
          </div>

          {REQUIRED_FIELDS.map((field) => {
            const fieldValidation = combinedValidation[field.key];
            const showState = submitAttempted || touchedFields[field.key];
            const isInvalid = showState && fieldValidation?.status === 'error';
            const isWarning = showState && fieldValidation?.status === 'warning';
            const disabledByShared = readOnly
              || (field.key === 'pesoKg' && isSharedWeightLocked)
              || (field.key === 'estaturaCm' && isSharedHeightLocked);

            return (
              <NumericField
                key={field.key}
                label={field.label}
                unit={field.unit}
                value={dados[field.key]}
                placeholder={field.key === 'pesoKg' ? '70,5' : '165'}
                disabled={disabledByShared}
                required
                isInvalid={isInvalid}
                isWarning={isWarning}
                message={showState ? fieldValidation?.message : ''}
                tooltipLines={field.tooltip}
                onChange={(value) => handleFieldValueChange(setDados, setHasUserInput, field.key, value)}
                onBlur={() => setTouchedFields((prev) => ({ ...prev, [field.key]: true }))}
              />
            );
          })}
        </div>
        {(isSharedWeightLocked || isSharedHeightLocked) && (
          <p className="perimetros-shared-hint">
            Peso e/ou estatura estao vinculados a ficha base compartilhada da sessao.
          </p>
        )}
      </fieldset>

      <fieldset className="eval-section eval-fieldset">
        <legend className="eval-section-title eval-legend">Dados opcionais</legend>

        <div className="eval-field-group">
          <span className="eval-field-group__label">Tronco</span>
          <div className="eval-field-group__grid">
            {OPTIONAL_FIELDS.filter((f) => ['cinturaCm', 'quadrilCm', 'pescocoCm', 'toraxInspiradoCm', 'toraxExpiradoCm'].includes(f.key)).map((field) => {
              const fieldValidation = combinedValidation[field.key];
              const showState = submitAttempted || touchedFields[field.key];
              const isInvalid = showState && fieldValidation?.status === 'error';
              const isWarning = showState && fieldValidation?.status === 'warning';
              return (
                <NumericField
                  key={field.key}
                  label={field.label}
                  unit={field.unit}
                  value={dados[field.key]}
                  placeholder="Opcional"
                  disabled={readOnly}
                  optional
                  isInvalid={isInvalid}
                  isWarning={isWarning}
                  message={showState ? fieldValidation?.message : ''}
                  tooltipLines={field.tooltip}
                  onChange={(value) => handleFieldValueChange(setDados, setHasUserInput, field.key, value)}
                  onBlur={() => setTouchedFields((prev) => ({ ...prev, [field.key]: true }))}
                />
              );
            })}
          </div>
        </div>

        <div className="eval-field-group">
          <span className="eval-field-group__label">Membros superiores</span>
          <div className="eval-field-group__grid">
            {BILATERAL_MEMBER_FIELDS.filter((field) => ['bracoRelaxadoCm', 'bracoContraidoCm', 'antebracoCm'].includes(field.key)).map((field) => {
              const rightKey = `${field.key}D`;
              const leftKey = `${field.key}E`;
              const rightValidation = validateInputField({ value: dados[rightKey], required: false, metric: field.metric });
              const leftValidation = validateInputField({ value: dados[leftKey], required: false, metric: field.metric });
              const rightShow = submitAttempted || touchedFields[rightKey];
              const leftShow = submitAttempted || touchedFields[leftKey];
              const asymmetry = bilateralAsymmetryRows.find((row) => row.key === field.key);

              return (
                <div key={field.key} className="eval-field eval-field-full perimetros-bilateral-row">
                  <div className="perimetros-bilateral-header">
                    <label className="eval-label">{field.label} (bilateral)</label>
                    {Number.isFinite(asymmetry?.asymmetryPct) && (
                      <span className={`perimetros-asymmetry-badge ${asymmetry.asymmetryPct >= 10 ? 'is-alert' : ''}`}>
                        Assimetria: {formatNumber(asymmetry.asymmetryPct, 1)}%
                      </span>
                    )}
                  </div>
                  <div className="perimetros-bilateral-grid">
                    <NumericField
                      label={`${field.label} D`}
                      unit={field.unit}
                      value={dados[rightKey]}
                      placeholder="Opcional"
                      disabled={readOnly}
                      optional
                      isInvalid={rightShow && rightValidation?.status === 'error'}
                      isWarning={rightShow && rightValidation?.status === 'warning'}
                      message={rightShow ? rightValidation?.message : ''}
                      tooltipLines={['Lado direito']}
                      onChange={(value) => handleFieldValueChange(setDados, setHasUserInput, rightKey, value)}
                      onBlur={() => setTouchedFields((prev) => ({ ...prev, [rightKey]: true }))}
                    />
                    <NumericField
                      label={`${field.label} E`}
                      unit={field.unit}
                      value={dados[leftKey]}
                      placeholder="Opcional"
                      disabled={readOnly}
                      optional
                      isInvalid={leftShow && leftValidation?.status === 'error'}
                      isWarning={leftShow && leftValidation?.status === 'warning'}
                      message={leftShow ? leftValidation?.message : ''}
                      tooltipLines={['Lado esquerdo']}
                      onChange={(value) => handleFieldValueChange(setDados, setHasUserInput, leftKey, value)}
                      onBlur={() => setTouchedFields((prev) => ({ ...prev, [leftKey]: true }))}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="eval-field-group">
          <span className="eval-field-group__label">Membros inferiores</span>
          <div className="eval-field-group__grid">
            {BILATERAL_MEMBER_FIELDS.filter((field) => ['coxaProximalCm', 'coxaMedialCm', 'panturrilhaCm'].includes(field.key)).map((field) => {
              const rightKey = `${field.key}D`;
              const leftKey = `${field.key}E`;
              const rightValidation = validateInputField({ value: dados[rightKey], required: false, metric: field.metric });
              const leftValidation = validateInputField({ value: dados[leftKey], required: false, metric: field.metric });
              const rightShow = submitAttempted || touchedFields[rightKey];
              const leftShow = submitAttempted || touchedFields[leftKey];
              const asymmetry = bilateralAsymmetryRows.find((row) => row.key === field.key);

              return (
                <div key={field.key} className="eval-field eval-field-full perimetros-bilateral-row">
                  <div className="perimetros-bilateral-header">
                    <label className="eval-label">{field.label} (bilateral)</label>
                    {Number.isFinite(asymmetry?.asymmetryPct) && (
                      <span className={`perimetros-asymmetry-badge ${asymmetry.asymmetryPct >= 10 ? 'is-alert' : ''}`}>
                        Assimetria: {formatNumber(asymmetry.asymmetryPct, 1)}%
                      </span>
                    )}
                  </div>
                  <div className="perimetros-bilateral-grid">
                    <NumericField
                      label={`${field.label} D`}
                      unit={field.unit}
                      value={dados[rightKey]}
                      placeholder="Opcional"
                      disabled={readOnly}
                      optional
                      isInvalid={rightShow && rightValidation?.status === 'error'}
                      isWarning={rightShow && rightValidation?.status === 'warning'}
                      message={rightShow ? rightValidation?.message : ''}
                      tooltipLines={['Lado direito']}
                      onChange={(value) => handleFieldValueChange(setDados, setHasUserInput, rightKey, value)}
                      onBlur={() => setTouchedFields((prev) => ({ ...prev, [rightKey]: true }))}
                    />
                    <NumericField
                      label={`${field.label} E`}
                      unit={field.unit}
                      value={dados[leftKey]}
                      placeholder="Opcional"
                      disabled={readOnly}
                      optional
                      isInvalid={leftShow && leftValidation?.status === 'error'}
                      isWarning={leftShow && leftValidation?.status === 'warning'}
                      message={leftShow ? leftValidation?.message : ''}
                      tooltipLines={['Lado esquerdo']}
                      onChange={(value) => handleFieldValueChange(setDados, setHasUserInput, leftKey, value)}
                      onBlur={() => setTouchedFields((prev) => ({ ...prev, [leftKey]: true }))}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          {panturrilhaBelowCutoff && (
            <div className="eval-note perimetros-alert-note">
              Panturrilha abaixo de 31 cm detectada. Revisar risco funcional e massa muscular.
            </div>
          )}
        </div>
      </fieldset>

      <fieldset className="eval-section eval-fieldset">
        <legend className="eval-section-title eval-legend">Contexto da medição</legend>
        <div className="perimetros-grid">
          {MEASUREMENT_CONTEXT_FIELDS.map((field) => (
            <div key={field.key} className={`eval-field ${field.key === 'equipamento' ? 'eval-field-full' : ''}`}>
              <label className="eval-label">
                {field.label}
                <InlineHelp lines={field.tooltip} />
              </label>
              {field.type === 'select' ? (
                <select
                  className="eval-input"
                  value={dados[field.key]}
                  onChange={(event) => handleFieldValueChange(setDados, setHasUserInput, field.key, event.target.value)}
                  disabled={readOnly}
                >
                  {(field.options || []).map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  className="eval-input"
                  value={dados[field.key]}
                  placeholder={field.placeholder || ''}
                  onChange={(event) => handleFieldValueChange(setDados, setHasUserInput, field.key, event.target.value)}
                  disabled={readOnly}
                />
              )}
            </div>
          ))}
          <div className="eval-field eval-field-full">
            <label className="eval-label">Foco cardiometabolico</label>
            <label className="perimetros-toggle">
              <input
                type="checkbox"
                checked={Boolean(dados.focoCardiometabolico)}
                onChange={(event) => handleFieldValueChange(setDados, setHasUserInput, 'focoCardiometabolico', event.target.checked)}
                disabled={readOnly}
              />
              <span>Exigir cintura como obrigatoria nesta avaliacao.</span>
            </label>
          </div>
        </div>
      </fieldset>

      <div className="eval-results-section">
        <div className="perimetros-results-grid">
          <ResultCard
            title="IMC"
            value={anthropometry?.indicators?.bmi}
            unit="kg/m2"
            digits={2}
            classification={anthropometry?.classifications?.bmi}
            delta={imcCardDelta}
            tooltipInfo={INDICATOR_INFO.imc}
          />
          <ResultCard
            title="Peso atual"
            value={numericFields.pesoKg}
            unit="kg"
            digits={1}
            classification={{ label: 'Valor atual', tone: 'info', source: 'Medida direta' }}
            delta={pesoCardDelta}
            tooltipInfo={{
              name: 'Peso atual',
              formula: 'Medida direta em balanca calibrada',
              reference: 'Protocolo antropometrico',
              year: 'sessao atual'
            }}
          />
          <ResultCard
            title="IMC ideal (faixa)"
            valueRange={anthropometry?.idealBmiRange}
            unit="kg/m2"
            digits={1}
            classification={{ label: anthropometry?.idealBmiRange?.source || 'Referencia', tone: 'neutral', source: 'Referencia clinica' }}
            tooltipInfo={{
              name: 'Faixa de IMC ideal',
              formula: 'Adultos: 18.5-24.9 | Idosos: 22-27',
              reference: 'OMS / Lipschitz 1994',
              year: '1994'
            }}
          />
          <ResultCard
            title="Indice cintura-estatura (ICE)"
            value={anthropometry?.indicators?.ice}
            unit=""
            digits={3}
            classification={anthropometry?.classifications?.ice}
            delta={iceCardDelta}
            tooltipInfo={INDICATOR_INFO.ice}
          />
          <ResultCard
            title="Indice de conicidade"
            value={circumferenceIndicators?.indicators?.conicity}
            unit=""
            digits={3}
            classification={circumferenceIndicators?.classifications?.conicity}
            delta={buildComparativeDeltas({
              current: circumferenceIndicators?.indicators?.conicity,
              reference: previousReference?.metrics?.conicity
            })}
            tooltipInfo={INDICATOR_INFO.conicity}
          />
          <ResultCard
            title="% Gordura estimado (YMCA)"
            value={circumferenceIndicators?.indicators?.ymcaPercentFat}
            unit="%"
            digits={2}
            classification={circumferenceIndicators?.classifications?.ymcaPercentFat}
            tooltipInfo={INDICATOR_INFO.ymca}
          />
        </div>

        {anthropometry?.classifications?.waistRisk && anthropometry.classifications.waistRisk.tone !== 'neutral' && (
          <div className={`perimetros-waist-alert perimetros-tone-${resolveTone(anthropometry.classifications.waistRisk.tone)}`}>
            <AlertTriangle size={16} />
            <div>
              <strong>{anthropometry.classifications.waistRisk.label}</strong>
              <p>{anthropometry.classifications.waistRisk.source}</p>
            </div>
          </div>
        )}

        <div className="perimetros-comparison">
          <h5>Comparacao longitudinal</h5>
          <div className="perimetros-comparison-table-wrap">
            <table className="perimetros-comparison-table">
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
                    <td className={resolveDeltaClass(row.delta.deltaAbs)}>
                      {formatSigned(row.delta.deltaAbs, row.unit, row.key)}
                    </td>
                    <td className={resolveDeltaClass(row.delta.deltaPct)}>
                      {formatSigned(row.delta.deltaPct, '%', 'percent')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="perimetros-sparklines">
            <SparklineCard
              label="Peso (ultimos 6)"
              values={sparklineSeries.peso}
              target={previousReference?.metrics?.peso ?? null}
            />
            <SparklineCard
              label="IMC (ultimos 6)"
              values={sparklineSeries.imc}
              target={previousReference?.metrics?.imc ?? null}
            />
            <SparklineCard
              label="ICE (ultimos 6)"
              values={sparklineSeries.ice}
              target={previousReference?.metrics?.ice ?? null}
            />
            <SparklineCard
              label="Conicidade (ultimos 6)"
              values={sparklineSeries.conicity}
              target={previousReference?.metrics?.conicity ?? null}
            />
          </div>
          <p className="perimetros-interpretation">{autoInterpretation}</p>
        </div>
      </div>

      <fieldset className="eval-section eval-fieldset">
        <legend className="eval-section-title eval-legend">Circunferências corporais</legend>
        <div className="perimetros-circ-layout">
          <div className="perimetros-silhouette-card">
            <h5>Silhueta por segmentos</h5>
            <CircumferenceSilhouette segments={silhouetteSegments} />
          </div>
          <details
            className="perimetros-meta-card"
            open={metaOpen}
            onToggle={(event) => setMetaOpen(event.currentTarget.open)}
          >
            <summary className="perimetros-meta-summary">
              Metas por segmento
              {metaOpen ? null : <span className="perimetros-meta-hint">Expandir para definir metas</span>}
            </summary>
            <div className="perimetros-meta-grid">
              {CIRCUMFERENCE_SEGMENTS.map((segment) => (
                <div key={segment.metaKey} className="eval-field">
                  <label className="eval-label">
                    Meta {segment.label}
                    <span className="perimetros-unit-badge">cm</span>
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    className="eval-input"
                    value={dados[segment.metaKey] || ''}
                    onChange={(event) => handleFieldValueChange(setDados, setHasUserInput, segment.metaKey, event.target.value)}
                    disabled={readOnly}
                    placeholder="Opcional"
                  />
                </div>
              ))}
            </div>
          </details>
        </div>
        <div className="perimetros-comparison-table-wrap">
          <table className="perimetros-comparison-table">
            <thead>
              <tr>
                <th>Segmento</th>
                <th>Atual</th>
                <th>Anterior</th>
                <th>Meta</th>
                <th>Delta abs.</th>
                <th>Delta %</th>
              </tr>
            </thead>
            <tbody>
              {segmentComparisonRows.map((row) => (
                <tr key={row.key}>
                  <td>{row.label}</td>
                  <td>{formatMetric(row.current, 'cm', row.key)}</td>
                  <td>{formatMetric(row.previous, 'cm', row.key)}</td>
                  <td>{formatMetric(row.meta, 'cm', row.key)}</td>
                  <td className={resolveDeltaClass(row.delta.deltaAbs)}>{formatSigned(row.delta.deltaAbs, 'cm', row.key)}</td>
                  <td className={resolveDeltaClass(row.delta.deltaPct)}>{formatSigned(row.delta.deltaPct, '%', 'percent')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </fieldset>

      <fieldset className="eval-section eval-fieldset">
        <legend className="eval-section-title eval-legend">Comparativo de TMB</legend>
        <p className="eval-section-subtitle">
          Perfil usado: {formatProfileSummary(sharedAge, sharedSex, numericFields.pesoKg, numericFields.estaturaCm, latestFatFreeMass)}
        </p>
        {hasApplicableTmbRows ? (
          <div className="perimetros-tmb-table-wrap">
            <table className="perimetros-tmb-table">
              <thead>
                <tr>
                  <th>Formula</th>
                  <th>TMB/GET</th>
                  <th>Indicado para</th>
                </tr>
              </thead>
              <tbody>
                {tmbRows.map((row) => {
                  const isSelected = row.formulaId === selectedTmb?.formulaId;
                  return (
                    <tr
                      key={row.formulaId}
                      className={`${isSelected ? 'is-selected' : ''} ${!row.applicable ? 'is-disabled' : ''}`}
                      onClick={() => {
                        if (readOnly || !row.applicable) return;
                        handleFieldValueChange(setDados, setHasUserInput, 'selectedTmbFormulaId', row.formulaId);
                      }}
                      onKeyDown={(event) => {
                        if (readOnly || !row.applicable) return;
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          handleFieldValueChange(setDados, setHasUserInput, 'selectedTmbFormulaId', row.formulaId);
                        }
                      }}
                      tabIndex={row.applicable && !readOnly ? 0 : -1}
                      role="button"
                      aria-label={`Selecionar formula ${row.label}`}
                    >
                      <td>
                        <div className="perimetros-formula-name">
                          <span>{row.label}{row.recommended ? ' *' : ''}</span>
                          <InlineHelp
                            lines={[
                              `Equacao: ${row.equation}`,
                              `Referencia: ${row.reference}`,
                              `Ano: ${row.year}`
                            ]}
                          />
                        </div>
                      </td>
                      <td>{row.applicable && Number.isFinite(row.valueKcal) ? `${Math.round(row.valueKcal)} kcal/dia` : 'Nao aplicavel'}</td>
                      <td>{row.indicatedFor}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="eval-note">
            Dados insuficientes para calcular formulas de TMB nesta avaliacao.
          </div>
        )}

        {selectedTmb?.selected && (
          <div className="perimetros-selected-formula">
            <strong>
              Selecionada: {selectedTmb.selected.label} ({selectedTmb.tmbKcal} kcal/dia)
            </strong>
            <p>Versao da formula: {selectedTmb.formulaVersion}</p>
          </div>
        )}

        {tmbComparative?.hasRelevantSpread && (
          <div className="perimetros-tmb-warning">
            <AlertTriangle size={16} />
            <span>
              Variacao relevante entre metodos ({Math.round(tmbComparative.spreadKcal)} kcal). Confirme a formula mais adequada.
            </span>
          </div>
        )}

        <div className="eval-field eval-field-full">
          <label className="eval-label">
            Justificativa da formula oficial
            <span className="perimetros-optional-badge">Opcional</span>
          </label>
          <textarea
            className="eval-textarea"
            rows={3}
            value={dados.tmbSelectionReason}
            placeholder="Ex.: selecionada por melhor aderencia ao perfil adulto com obesidade."
            onChange={(event) => handleFieldValueChange(setDados, setHasUserInput, 'tmbSelectionReason', event.target.value)}
            disabled={readOnly}
          />
        </div>
      </fieldset>

      {readOnly && (
        <div className="eval-note">Somente leitura para o seu perfil.</div>
      )}

      <div className="eval-actions">
        {saveStatus ? <span className={`save-indicator ${saveStatus}`}>{saveStatus === 'saving' ? 'Salvando...' : saveStatus === 'saved' ? 'Salvo' : 'Erro ao salvar'}</span> : null}
        <Button type="button" variant="primary" onClick={handleSubmit} disabled={readOnly} loading={saveStatus === 'saving'}>
          Salvar antropometria basica
        </Button>
      </div>

      {error && <div className="eval-note perimetros-error-note">{error}</div>}
    </div>
  );
};

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
  onBlur
}) => (
  <div className="eval-field">
    <label className="eval-label">
      {label}
      <span className="perimetros-unit-badge">{unit}</span>
      {required ? <span className="perimetros-required-dot" aria-hidden="true">*</span> : null}
      {optional ? <span className="perimetros-optional-badge">Opcional</span> : null}
      <InlineHelp lines={tooltipLines} />
    </label>
    <input
      type="text"
      inputMode="decimal"
      className={`eval-input ${isInvalid ? 'perimetros-input-invalid' : ''} ${isWarning ? 'perimetros-input-warning' : ''}`}
      value={value}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
      onBlur={onBlur}
      disabled={disabled}
      aria-invalid={isInvalid ? 'true' : 'false'}
    />
    {message ? <small className={`perimetros-field-message ${isInvalid ? 'is-error' : 'is-warning'}`}>{message}</small> : null}
  </div>
);

const InlineHelp = ({ lines = [] }) => (
  <span className="perimetros-help" tabIndex={0} role="button" aria-label="Abrir informacao da formula ou protocolo">
    ?
    <span className="perimetros-help-tooltip" role="tooltip">
      {lines.map((line, index) => (
        <span key={`${line}-${index}`}>{line}</span>
      ))}
    </span>
  </span>
);

const ResultCard = ({
  title,
  value,
  valueRange,
  unit,
  digits = 2,
  classification,
  delta,
  tooltipInfo
}) => {
  const tone = resolveTone(classification?.tone);
  return (
    <article className="perimetros-result-card">
      <div className="perimetros-result-card__header">
        <h6>{title}</h6>
        <InlineHelp
          lines={[
            `${tooltipInfo?.name || 'Indicador'}`,
            `Formula: ${tooltipInfo?.formula || 'N/A'}`,
            `Referencia: ${tooltipInfo?.reference || 'N/A'}`,
            `Ano/Fonte: ${tooltipInfo?.year || 'N/A'}`
          ]}
        />
      </div>

      <strong className="perimetros-result-card__value">
        {valueRange && Number.isFinite(valueRange?.min) && Number.isFinite(valueRange?.max)
          ? `${formatNumber(valueRange.min, digits)} - ${formatNumber(valueRange.max, digits)}${unit ? ` ${unit}` : ''}`
          : Number.isFinite(value)
            ? `${formatNumber(value, digits)}${unit ? ` ${unit}` : ''}`
            : 'Nao calculado'}
      </strong>

      <div className="perimetros-result-card__meta">
        <span className={`perimetros-status-badge perimetros-tone-${tone}`}>
          {classification?.label || 'Sem classificacao'}
        </span>
        {classification?.source ? <small>{classification.source}</small> : null}
      </div>

      {delta && Number.isFinite(delta.deltaAbs) && (
        <p className={`perimetros-delta ${resolveDeltaClass(delta.deltaAbs)}`}>
          {formatSigned(delta.deltaAbs, unit, unit === '%' ? 'percent' : 'default')}
          {Number.isFinite(delta.deltaPct) ? ` (${formatSigned(delta.deltaPct, '%', 'percent')})` : ''}
        </p>
      )}
    </article>
  );
};

const SparklineCard = ({ label, values, target }) => (
  <div className="perimetros-sparkline-card">
    <p>{label}</p>
    <MiniSparkline values={values} target={target} width={220} height={72} />
  </div>
);

const CircumferenceSilhouette = ({ segments = [] }) => {
  const byKey = Object.fromEntries((segments || []).map((item) => [item.key, item]));
  const segmentClass = (key) => `perimetros-segment-${byKey[key]?.tone || 'neutral'}`;

  return (
    <svg className="perimetros-silhouette" viewBox="0 0 220 360" role="img" aria-label="Silhueta de circunferencias">
      <circle cx="110" cy="34" r="24" className={segmentClass('pescocoCm')} />
      <rect x="92" y="58" width="36" height="20" rx="10" className={segmentClass('pescocoCm')} />

      <rect x="48" y="80" width="46" height="26" rx="13" className={segmentClass('bracoRelaxadoCm')} />
      <rect x="126" y="80" width="46" height="26" rx="13" className={segmentClass('bracoContraidoCm')} />
      <rect x="42" y="108" width="42" height="20" rx="10" className={segmentClass('antebracoCm')} />
      <rect x="136" y="108" width="42" height="20" rx="10" className={segmentClass('antebracoCm')} />

      <rect x="72" y="82" width="76" height="34" rx="16" className={segmentClass('toraxInspiradoCm')} />
      <rect x="72" y="116" width="76" height="30" rx="15" className={segmentClass('toraxExpiradoCm')} />
      <rect x="66" y="146" width="88" height="34" rx="16" className={segmentClass('cinturaCm')} />
      <rect x="62" y="180" width="96" height="38" rx="18" className={segmentClass('quadrilCm')} />

      <rect x="72" y="220" width="34" height="56" rx="15" className={segmentClass('coxaProximalCm')} />
      <rect x="114" y="220" width="34" height="56" rx="15" className={segmentClass('coxaMedialCm')} />
      <rect x="74" y="278" width="30" height="52" rx="15" className={segmentClass('panturrilhaCm')} />
      <rect x="116" y="278" width="30" height="52" rx="15" className={segmentClass('panturrilhaCm')} />
    </svg>
  );
};

export default PerimetrosCorporaisForm;

function handleFieldValueChange(setDados, setHasUserInput, key, value) {
  setHasUserInput(true);
  setDados((prev) => ({ ...prev, [key]: value }));
}

function asRecord(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value;
}

function resolveSingleFromBilateral({ single, right, left }) {
  if (Number.isFinite(single)) return single;
  if (Number.isFinite(right) && Number.isFinite(left)) {
    return Number(((right + left) / 2).toFixed(2));
  }
  if (Number.isFinite(right)) return right;
  if (Number.isFinite(left)) return left;
  return null;
}

function calculateAsymmetryIndex(right, left) {
  if (!Number.isFinite(right) || !Number.isFinite(left)) return null;
  const maxSide = Math.max(right, left);
  if (!Number.isFinite(maxSide) || maxSide <= 0) return null;
  return Number((Math.abs(right - left) / maxSide * 100).toFixed(2));
}

function buildPerimetrosBilateralPayload(numericFields = {}) {
  const payload = {};
  BILATERAL_MEMBER_FIELDS.forEach((field) => {
    payload[`${field.key}D`] = Number.isFinite(numericFields?.[`${field.key}D`])
      ? Number(Number(numericFields[`${field.key}D`]).toFixed(2))
      : null;
    payload[`${field.key}E`] = Number.isFinite(numericFields?.[`${field.key}E`])
      ? Number(Number(numericFields[`${field.key}E`]).toFixed(2))
      : null;
  });
  return payload;
}

function buildPerimetrosAsymmetryPayload(rows = []) {
  if (!Array.isArray(rows)) return {};
  const payload = {};
  rows.forEach((row) => {
    if (!row?.key) return;
    payload[row.key] = Number.isFinite(row?.asymmetryPct) ? row.asymmetryPct : null;
  });
  return payload;
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

function normalizeHeightToCm(value) {
  const numeric = parseNumeric(value);
  if (!Number.isFinite(numeric)) return null;
  if (numeric > 0 && numeric <= 3) return Number((numeric * 100).toFixed(1));
  return numeric;
}

function normalizeSexToken(value) {
  const token = toTextInput(value).toLowerCase();
  if (!token) return null;
  if (token.includes('fem') || token === 'f' || token === 'female') return 'female';
  if (token.includes('masc') || token === 'm' || token === 'male') return 'male';
  return null;
}

function normalizeBoolean(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;

  const token = toTextInput(value).toLowerCase();
  if (!token) return false;
  return ['1', 'true', 'sim', 'yes', 'y', 'on'].includes(token);
}

function validateInputField({ value, required = false, metric = null }) {
  const textValue = toTextInput(value);
  if (!textValue) {
    if (required) {
      return { status: 'error', message: 'Campo obrigatorio.' };
    }
    return { status: 'empty', message: '' };
  }

  const numeric = parseNumeric(value);
  if (!Number.isFinite(numeric)) {
    return { status: 'error', message: 'Informe um numero valido.' };
  }

  if (!metric) return { status: 'ok', message: '' };
  const range = validatePhysiologicalRange({ metric, value: numeric });
  if (range.status === 'warning') {
    return { status: 'warning', message: range.message || 'Verifique o valor informado.' };
  }
  return { status: 'ok', message: '' };
}

function resolveFieldLabel(fieldKey) {
  const map = {
    pesoKg: 'Peso',
    estaturaCm: 'Estatura',
    cinturaCm: 'Cintura',
    quadrilCm: 'Quadril',
    pescocoCm: 'Pescoco',
    bracoRelaxadoCm: 'Braço relaxado',
    bracoContraidoCm: 'Braço contraído',
    antebracoCm: 'Antebraço',
    coxaProximalCm: 'Coxa proximal',
    coxaMedialCm: 'Coxa medial',
    panturrilhaCm: 'Panturrilha',
    toraxInspiradoCm: 'Tórax inspirado',
    toraxExpiradoCm: 'Tórax expirado'
  };
  return map[fieldKey] || fieldKey;
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

function resolveSegmentTone(row) {
  if (!row || !Number.isFinite(row.current)) return 'neutral';

  if (Number.isFinite(row.meta)) {
    const distanceToTarget = Math.abs(row.current - row.meta);
    if (distanceToTarget <= 0.5) return 'success';
    if (distanceToTarget <= 2) return 'warning';
    return 'danger';
  }

  const deltaAbs = row?.delta?.deltaAbs;
  if (!Number.isFinite(deltaAbs)) return 'neutral';

  const variation = Math.abs(deltaAbs);
  if (variation < 0.5) return 'neutral';
  if (variation < 2) return 'warning';
  return 'danger';
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
  const digitsByKey = {
    peso: 1,
    imc: 2,
    rcq: 3,
    ice: 3,
    conicity: 3,
    bsa: 3,
    cinturaCm: 1,
    quadrilCm: 1,
    pescocoCm: 1,
    bracoRelaxadoCm: 1,
    bracoContraidoCm: 1,
    antebracoCm: 1,
    coxaProximalCm: 1,
    coxaMedialCm: 1,
    panturrilhaCm: 1,
    toraxInspiradoCm: 1,
    toraxExpiradoCm: 1
  };
  const digits = Object.prototype.hasOwnProperty.call(digitsByKey, key) ? digitsByKey[key] : 2;
  return `${formatNumber(value, digits)}${unit ? ` ${unit}` : ''}`;
}

function formatSigned(value, unit = '', key = '') {
  if (!Number.isFinite(value)) return '--';
  const digits = key === 'percent'
    ? 2
    : unit === 'kg'
      ? 1
      : unit === 'cm'
        ? 1
        : key === 'ice' || key === 'rcq' || key === 'conicity'
        ? 3
        : 2;
  const sign = value > 0 ? '+' : '';
  return `${sign}${formatNumber(value, digits)}${unit ? ` ${unit}` : ''}`;
}

function createComparisonRow(key, label, unit, current, previous, first) {
  const delta = buildComparativeDeltas({ current, reference: previous });
  return {
    key,
    label,
    unit,
    current: Number.isFinite(current) ? current : null,
    previous: Number.isFinite(previous) ? previous : null,
    first: Number.isFinite(first) ? first : null,
    delta
  };
}

function buildSparklineSeries(records = [], metricKey, currentValue) {
  const values = [];
  records.forEach((entry) => {
    const metric = entry?.metrics?.[metricKey];
    if (Number.isFinite(metric)) values.push(metric);
  });
  if (Number.isFinite(currentValue)) values.push(currentValue);
  return values.slice(-6);
}

function buildAutoInterpretation(rows = []) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return 'Sem dados suficientes para interpretacao automatica.';
  }

  const priorityKeys = ['peso', 'imc', 'ice'];
  for (const key of priorityKeys) {
    const row = rows.find((item) => item.key === key);
    if (!row || !Number.isFinite(row.delta?.deltaAbs)) continue;
    if (Math.abs(row.delta.deltaAbs) < 0.0001) continue;
    const direction = row.delta.deltaAbs > 0 ? 'aumentou' : 'reduziu';
    return `${row.label} ${direction} ${formatNumber(Math.abs(row.delta.deltaAbs), key === 'peso' ? 1 : 2)}${row.unit ? ` ${row.unit}` : ''} em relacao a ultima avaliacao.`;
  }

  return 'Sem variacoes relevantes em relacao a ultima avaliacao.';
}

function normalizePerimetrosHistory(records = []) {
  if (!Array.isArray(records)) return [];
  return records
    .map((record) => {
      const date = resolveDate(record?.updatedAt || record?.createdAt || record?.data);
      const timestamp = date ? date.getTime() : 0;
      return {
        id: record?.id || '',
        timestamp,
        metrics: resolvePerimetrosMetrics(record)
      };
    })
    .filter((entry) => hasAnyMetric(entry.metrics));
}

function hasAnyMetric(metrics = {}) {
  const hasCoreMetric = ['peso', 'imc', 'rcq', 'ice', 'bsa', 'conicity', 'ymcaPercentFat']
    .some((key) => Number.isFinite(metrics[key]));
  if (hasCoreMetric) return true;
  return CIRCUMFERENCE_SEGMENTS.some((segment) => Number.isFinite(metrics[segment.key]));
}

function resolvePerimetrosMetrics(record) {
  const dados = record?.dados || {};
  const resultados = record?.resultados || {};
  const dadosBrutos = dados?.dados_brutos || dados?.input || {};
  const resultadosCalculados = dados?.resultados_calculados || resultados?.calculated || {};

  const weight = parseNumeric(firstDefined(
    resultadosCalculados?.peso,
    dadosBrutos?.pesoKg,
    dadosBrutos?.peso_kg,
    dados?.peso,
    dados?.weight
  ));
  const heightCm = normalizeHeightToCm(firstDefined(
    dadosBrutos?.estaturaCm,
    dadosBrutos?.estatura_cm,
    dados?.estatura_cm,
    dados?.estatura,
    dados?.altura,
    dados?.height
  ));
  const waist = parseNumeric(firstDefined(
    dadosBrutos?.cinturaCm,
    dadosBrutos?.cintura_cm,
    dados?.cintura,
    dados?.cintura_cm
  ));
  const hip = parseNumeric(firstDefined(
    dadosBrutos?.quadrilCm,
    dadosBrutos?.quadril_cm,
    dados?.quadril_cm,
    dados?.quadril,
    dados?.quadril_cm
  ));
  const neck = parseNumeric(firstDefined(
    dadosBrutos?.pescocoCm,
    dadosBrutos?.pescoco_cm,
    dados?.pescoco,
    dados?.pescoco_cm
  ));
  const armRelaxed = parseNumeric(firstDefined(
    dadosBrutos?.bracoRelaxadoCm,
    dadosBrutos?.braco_relaxado_cm,
    dados?.braco_relaxado_cm,
    dados?.braco_relaxado
  ));
  const armContracted = parseNumeric(firstDefined(
    dadosBrutos?.bracoContraidoCm,
    dadosBrutos?.braco_contraido_cm,
    dados?.braco_contraido_cm,
    dados?.braco_contraido
  ));
  const forearm = parseNumeric(firstDefined(
    dadosBrutos?.antebracoCm,
    dadosBrutos?.antebraco_cm,
    dados?.antebraco_cm,
    dados?.antebraco
  ));
  const thighProximal = parseNumeric(firstDefined(
    dadosBrutos?.coxaProximalCm,
    dadosBrutos?.coxa_proximal_cm,
    dados?.coxa_proximal_cm,
    dados?.coxa_proximal
  ));
  const thighMedial = parseNumeric(firstDefined(
    dadosBrutos?.coxaMedialCm,
    dadosBrutos?.coxa_medial_cm,
    dados?.coxa_medial_cm,
    dados?.coxa_medial
  ));
  const calf = parseNumeric(firstDefined(
    dadosBrutos?.panturrilhaCm,
    dadosBrutos?.panturrilha_cm,
    dados?.panturrilha_cm,
    dados?.panturrilha
  ));
  const thoraxInhaled = parseNumeric(firstDefined(
    dadosBrutos?.toraxInspiradoCm,
    dadosBrutos?.torax_inspirado_cm,
    dados?.torax_inspirado_cm,
    dados?.torax_inspirado
  ));
  const thoraxExhaled = parseNumeric(firstDefined(
    dadosBrutos?.toraxExpiradoCm,
    dadosBrutos?.torax_expirado_cm,
    dados?.torax_expirado_cm,
    dados?.torax_expirado
  ));
  const sex = normalizeSexToken(firstDefined(
    dadosBrutos?.sexo,
    dados?.sexo,
    dados?.sex
  ));

  const bmi = parseNumeric(firstDefined(
    resultadosCalculados?.imc,
    resultados?.imc,
    dados?.imc
  )) ?? computeBmi(weight, heightCm);
  const rcq = parseNumeric(firstDefined(
    resultadosCalculados?.rcq,
    resultados?.rcq,
    dados?.rcq
  )) ?? computeRatio(waist, hip);
  const ice = parseNumeric(firstDefined(
    resultadosCalculados?.indiceCinturaEstatura,
    resultadosCalculados?.indice_cintura_estatura,
    resultados?.indice_cintura_estatura,
    dados?.indice_cintura_estatura
  )) ?? computeRatio(waist, heightCm);
  const bsa = parseNumeric(firstDefined(
    resultadosCalculados?.areaSuperficieCorporal,
    resultadosCalculados?.area_superficie_corporal,
    resultados?.area_superficie_corporal,
    dados?.area_superficie_corporal
  )) ?? computeBsa(weight, heightCm);
  const conicity = parseNumeric(firstDefined(
    resultadosCalculados?.indiceConicidade,
    resultadosCalculados?.indice_conicidade,
    resultados?.indice_conicidade,
    dados?.indice_conicidade
  )) ?? computeConicity(weight, heightCm, waist);
  const ymcaPercentFat = parseNumeric(firstDefined(
    resultadosCalculados?.percentualGorduraYmca,
    resultadosCalculados?.percentual_gordura_ymca,
    resultados?.percentual_gordura_ymca,
    dados?.percentual_gordura_ymca
  )) ?? computeYmcaPercentFat({ sex, waistCm: waist, weightKg: weight });

  return {
    peso: Number.isFinite(weight) ? weight : null,
    imc: Number.isFinite(bmi) ? bmi : null,
    rcq: Number.isFinite(rcq) ? rcq : null,
    ice: Number.isFinite(ice) ? ice : null,
    bsa: Number.isFinite(bsa) ? bsa : null,
    conicity: Number.isFinite(conicity) ? conicity : null,
    ymcaPercentFat: Number.isFinite(ymcaPercentFat) ? ymcaPercentFat : null,
    cinturaCm: Number.isFinite(waist) ? waist : null,
    quadrilCm: Number.isFinite(hip) ? hip : null,
    pescocoCm: Number.isFinite(neck) ? neck : null,
    bracoRelaxadoCm: Number.isFinite(armRelaxed) ? armRelaxed : null,
    bracoContraidoCm: Number.isFinite(armContracted) ? armContracted : null,
    antebracoCm: Number.isFinite(forearm) ? forearm : null,
    coxaProximalCm: Number.isFinite(thighProximal) ? thighProximal : null,
    coxaMedialCm: Number.isFinite(thighMedial) ? thighMedial : null,
    panturrilhaCm: Number.isFinite(calf) ? calf : null,
    toraxInspiradoCm: Number.isFinite(thoraxInhaled) ? thoraxInhaled : null,
    toraxExpiradoCm: Number.isFinite(thoraxExhaled) ? thoraxExhaled : null
  };
}

function computeBmi(weight, heightCm) {
  if (!Number.isFinite(weight) || !Number.isFinite(heightCm) || heightCm <= 0) return null;
  const heightM = heightCm / 100;
  return weight / (heightM * heightM);
}

function computeRatio(numerator, denominator) {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) return null;
  return numerator / denominator;
}

function computeBsa(weight, heightCm) {
  if (!Number.isFinite(weight) || !Number.isFinite(heightCm)) return null;
  return Math.sqrt((heightCm * weight) / 3600);
}

function computeConicity(weight, heightCm, waistCm) {
  if (!Number.isFinite(weight) || !Number.isFinite(heightCm) || !Number.isFinite(waistCm)) return null;
  if (weight <= 0 || heightCm <= 0) return null;
  const heightM = heightCm / 100;
  const waistM = waistCm / 100;
  return waistM / (0.109 * Math.sqrt(weight / heightM));
}

function computeYmcaPercentFat({ sex, waistCm, weightKg }) {
  if (!sex || !Number.isFinite(waistCm) || !Number.isFinite(weightKg) || weightKg <= 0) return null;
  if (sex === 'male') {
    return ((-98.42 + (4.15 * waistCm) - (0.082 * weightKg)) / weightKg) * 100;
  }
  return ((-76.76 + (4.15 * waistCm) - (0.082 * weightKg)) / weightKg) * 100;
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

function formatProfileSummary(age, sex, weightKg, heightCm, fatFreeMassKg) {
  const segments = [];
  if (Number.isFinite(age)) segments.push(`${Math.round(age)} anos`);
  if (sex === 'male') segments.push('M');
  if (sex === 'female') segments.push('F');
  if (Number.isFinite(weightKg)) segments.push(`${formatNumber(weightKg, 1)} kg`);
  if (Number.isFinite(heightCm)) segments.push(`${formatNumber(heightCm, 1)} cm`);
  if (Number.isFinite(fatFreeMassKg)) segments.push(`MM ${formatNumber(fatFreeMassKg, 1)} kg`);
  if (!segments.length) return 'dados incompletos';
  return segments.join(' | ');
}

