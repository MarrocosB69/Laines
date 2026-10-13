const ACTIVITY_FACTOR_PRESETS = {
  sedentario: { male: 1.0, female: 1.0, generic: 1.0, label: 'Sedentario' },
  pouco_ativo: { male: 1.11, female: 1.12, generic: 1.2, label: 'Pouco ativo' },
  ativo: { male: 1.25, female: 1.27, generic: 1.55, label: 'Ativo' },
  muito_ativo: { male: 1.48, female: 1.45, generic: 1.725, label: 'Muito ativo' },
  extremamente_ativo: { male: 1.9, female: 1.9, generic: 1.9, label: 'Extremamente ativo' }
};

const TMB_FORMULAS = {
  harris_benedict_original_1919: {
    id: 'harris_benedict_original_1919',
    version: '1.0.0',
    label: 'Harris-Benedict (1919)',
    year: 1919,
    reference: 'Harris JA, Benedict FG. A biometric study of human basal metabolism. PNAS, 1918.',
    indicatedFor: 'Adultos saudaveis; menor precisao em obesos/atletas',
    type: 'tmb'
  },
  harris_benedict_revisada_1984: {
    id: 'harris_benedict_revisada_1984',
    version: '1.0.0',
    label: 'Harris-Benedict Revisada (1984)',
    year: 1984,
    reference: 'Roza AM, Shizgal HM. The Harris-Benedict equation reevaluated. Am J Clin Nutr, 1984.',
    indicatedFor: 'Adultos',
    type: 'tmb'
  },
  mifflin_st_jeor_1990: {
    id: 'mifflin_st_jeor_1990',
    version: '1.0.0',
    label: 'Mifflin-St Jeor (1990)',
    year: 1990,
    reference: 'Mifflin MD et al. A new predictive equation for resting energy expenditure in healthy individuals. Am J Clin Nutr, 1990.',
    indicatedFor: 'Adultos em geral',
    type: 'tmb',
    recommended: true
  },
  cunningham_1980: {
    id: 'cunningham_1980',
    version: '1.0.0',
    label: 'Cunningham (1980)',
    year: 1980,
    reference: 'Cunningham JJ. A reanalysis of the factors influencing basal metabolic rate in normal adults. Am J Clin Nutr, 1980.',
    indicatedFor: 'Atletas e individuos com massa magra conhecida',
    type: 'tmb'
  },
  owen_1987: {
    id: 'owen_1987',
    version: '1.0.0',
    label: 'Owen (1987)',
    year: 1987,
    reference: 'Owen OE et al. A reappraisal of the caloric requirements of men. Am J Clin Nutr, 1987.',
    indicatedFor: 'Estimativa rapida',
    type: 'tmb'
  },
  fao_schofield_1985: {
    id: 'fao_schofield_1985',
    version: '1.0.0',
    label: 'FAO/OMS/ONU - Schofield (1985)',
    year: 1985,
    reference: 'Schofield WN. Predicting basal metabolic rate, new standards and review of previous work. Human Nutrition Clinical Nutrition, 1985.',
    indicatedFor: 'Todas as faixas etarias',
    type: 'tmb'
  },
  henry_2005: {
    id: 'henry_2005',
    version: '1.0.0',
    label: 'Henry (2005)',
    year: 2005,
    reference: 'Henry CJK. Basal metabolic rate studies in humans: measurement and development of new equations. Public Health Nutrition, 2005.',
    indicatedFor: 'Populacoes tropicais',
    type: 'tmb'
  },
  guedes_2006: {
    id: 'guedes_2006',
    version: '1.0.0',
    label: 'Guedes (2006)',
    year: 2006,
    reference: 'Guedes DP, Guedes JERP. Manual Pratico para Avaliacao em Educacao Fisica. Manole, 2006.',
    indicatedFor: 'Adultos brasileiros com massa magra avaliada',
    type: 'tmb'
  },
  falkner_pediatrica: {
    id: 'falkner_pediatrica',
    version: '1.0.0',
    label: 'Falkner/Bernstein (Pediatrica)',
    year: 1966,
    reference: 'Falkner F (ed). Human Development. Saunders, 1966. Atualizada por Bernstein et al.',
    indicatedFor: 'Criancas e adolescentes (referencia complementar)',
    type: 'tmb'
  },
  dri_iom_2005_eer: {
    id: 'dri_iom_2005_eer',
    version: '1.0.0',
    label: 'DRI / IOM (2005) - EER/GET',
    year: 2005,
    reference: 'Institute of Medicine. Dietary Reference Intakes for Energy. NAP, 2005.',
    indicatedFor: 'Adultos com nivel de atividade conhecido',
    type: 'eer'
  }
};

const toNumber = (value) => {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = Number(String(value).replace(',', '.').trim());
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeSex = (value) => {
  const token = String(value || '').trim().toLowerCase();
  if (!token) return null;
  if (token.includes('fem') || token === 'f' || token === 'female') return 'female';
  if (token.includes('masc') || token === 'm' || token === 'male') return 'male';
  return null;
};

const normalizeHeightCm = (value) => {
  const numeric = toNumber(value);
  if (!Number.isFinite(numeric)) return null;
  if (numeric > 0 && numeric <= 3) return Number((numeric * 100).toFixed(1));
  return numeric;
};

const bmiClassification = ({ bmi, ageYears, bmiPercentile }) => {
  if (!Number.isFinite(bmi)) {
    return { label: 'IMC nao calculado', tone: 'neutral', source: 'N/A' };
  }

  if (Number.isFinite(ageYears) && ageYears > 60) {
    if (bmi < 22) return { label: 'Baixo peso (idoso)', tone: 'warning', source: 'Lipschitz 1994' };
    if (bmi <= 27) return { label: 'Eutrofia (idoso)', tone: 'success', source: 'Lipschitz 1994' };
    return { label: 'Excesso de peso (idoso)', tone: 'warning', source: 'Lipschitz 1994' };
  }

  if (Number.isFinite(ageYears) && ageYears >= 10 && ageYears < 20) {
    if (Number.isFinite(bmiPercentile)) {
      if (bmiPercentile < 3) return { label: 'Magreza acentuada (adolescente)', tone: 'danger', source: 'OMS 2007' };
      if (bmiPercentile < 15) return { label: 'Magreza (adolescente)', tone: 'warning', source: 'OMS 2007' };
      if (bmiPercentile < 85) return { label: 'Eutrofia (adolescente)', tone: 'success', source: 'OMS 2007' };
      if (bmiPercentile < 97) return { label: 'Sobrepeso (adolescente)', tone: 'warning', source: 'OMS 2007' };
      return { label: 'Obesidade (adolescente)', tone: 'danger', source: 'OMS 2007' };
    }
    return { label: 'Necessario percentil OMS (10-19 anos)', tone: 'info', source: 'OMS 2007' };
  }

  if (bmi < 18.5) return { label: 'Baixo peso', tone: 'warning', source: 'OMS adultos' };
  if (bmi < 25) return { label: 'Eutrofia', tone: 'success', source: 'OMS adultos' };
  if (bmi < 30) return { label: 'Sobrepeso', tone: 'warning', source: 'OMS adultos' };
  if (bmi < 35) return { label: 'Obesidade grau I', tone: 'danger', source: 'OMS adultos' };
  if (bmi < 40) return { label: 'Obesidade grau II', tone: 'danger', source: 'OMS adultos' };
  return { label: 'Obesidade grau III', tone: 'danger', source: 'OMS adultos' };
};

const rcqClassification = ({ rcq, sex }) => {
  if (!Number.isFinite(rcq) || !sex) return { label: 'Sem classificacao', tone: 'neutral', source: 'OMS RCQ' };
  if (sex === 'male') {
    if (rcq < 0.9) return { label: 'Baixo risco', tone: 'success', source: 'OMS RCQ' };
    if (rcq <= 0.95) return { label: 'Risco moderado', tone: 'warning', source: 'OMS RCQ' };
    return { label: 'Alto risco', tone: 'danger', source: 'OMS RCQ' };
  }
  if (rcq < 0.8) return { label: 'Baixo risco', tone: 'success', source: 'OMS RCQ' };
  if (rcq <= 0.85) return { label: 'Risco moderado', tone: 'warning', source: 'OMS RCQ' };
  return { label: 'Alto risco', tone: 'danger', source: 'OMS RCQ' };
};

const waistRiskClassification = ({ waistCm, sex }) => {
  if (!Number.isFinite(waistCm) || !sex) return { label: 'Nao classificado', tone: 'neutral', source: 'OMS cintura' };
  if (sex === 'male') {
    if (waistCm > 102) return { label: 'Risco elevado por cintura', tone: 'danger', source: 'OMS cintura' };
    if (waistCm > 94) return { label: 'Risco aumentado por cintura', tone: 'warning', source: 'OMS cintura' };
    return { label: 'Sem risco aumentado', tone: 'success', source: 'OMS cintura' };
  }
  if (waistCm > 88) return { label: 'Risco elevado por cintura', tone: 'danger', source: 'OMS cintura' };
  if (waistCm > 80) return { label: 'Risco aumentado por cintura', tone: 'warning', source: 'OMS cintura' };
  return { label: 'Sem risco aumentado', tone: 'success', source: 'OMS cintura' };
};

const iceClassification = (ice) => {
  if (!Number.isFinite(ice)) return { label: 'Nao classificado', tone: 'neutral', source: 'Indice cintura-estatura' };
  if (ice > 0.5) return { label: 'Risco cardiometabolico aumentado', tone: 'danger', source: 'Indice cintura-estatura' };
  return { label: 'Dentro do esperado', tone: 'success', source: 'Indice cintura-estatura' };
};

export const validatePhysiologicalRange = ({ metric, value }) => {
  const numeric = toNumber(value);
  if (!Number.isFinite(numeric)) {
    if (value === '' || value === null || value === undefined) {
      return { status: 'empty', message: '' };
    }
    return { status: 'error', message: 'Valor invalido' };
  }

  const ranges = {
    peso_kg: { min: 10, max: 400, label: 'Peso' },
    estatura_cm: { min: 50, max: 250, label: 'Estatura' },
    dobras_mm: { min: 1, max: 100, label: 'Dobra cutanea' },
    circunferencia_cm: { min: 10, max: 200, label: 'Circunferencia' },
    percentual_gordura: { min: 1, max: 80, label: '% Gordura' }
  };

  const rule = ranges[metric];
  if (!rule) return { status: 'ok', message: '' };
  if (numeric < rule.min || numeric > rule.max) {
    return {
      status: 'warning',
      message: `${rule.label} fora da faixa fisiologica. Verifique o valor informado.`
    };
  }
  return { status: 'ok', message: '' };
};

export const calculateAnthropometryIndicators = (input) => {
  const weightKg = toNumber(input?.weightKg);
  const heightCm = normalizeHeightCm(input?.heightCm);
  const waistCm = toNumber(input?.waistCm);
  const hipCm = toNumber(input?.hipCm);
  const neckCm = toNumber(input?.neckCm);
  const ageYears = toNumber(input?.ageYears);
  const sex = normalizeSex(input?.sex);
  const bmiPercentile = toNumber(input?.bmiPercentile);

  const heightM = Number.isFinite(heightCm) ? heightCm / 100 : null;
  const bmi = Number.isFinite(weightKg) && Number.isFinite(heightM) && heightM > 0
    ? weightKg / (heightM * heightM)
    : null;

  const rcq = Number.isFinite(waistCm) && Number.isFinite(hipCm) && hipCm > 0
    ? waistCm / hipCm
    : null;

  const ice = Number.isFinite(waistCm) && Number.isFinite(heightCm) && heightCm > 0
    ? waistCm / heightCm
    : null;

  const bodySurfaceArea = Number.isFinite(weightKg) && Number.isFinite(heightCm)
    ? Math.sqrt((heightCm * weightKg) / 3600)
    : null;

  const bmiClass = bmiClassification({ bmi, ageYears, bmiPercentile });
  const rcqClass = rcqClassification({ rcq, sex });
  const waistRisk = waistRiskClassification({ waistCm, sex });
  const iceClass = iceClassification(ice);

  return {
    inputs: {
      weightKg,
      heightCm,
      heightM,
      waistCm,
      hipCm,
      neckCm,
      ageYears,
      sex,
      bmiPercentile
    },
    indicators: {
      bmi,
      rcq,
      ice,
      bodySurfaceArea
    },
    classifications: {
      bmi: bmiClass,
      rcq: rcqClass,
      waistRisk,
      ice: iceClass
    },
    idealBmiRange: Number.isFinite(ageYears) && ageYears > 60 ? { min: 22, max: 27, source: 'Lipschitz 1994' } : { min: 18.5, max: 24.9, source: 'OMS adultos' }
  };
};

const conicityClassification = (index) => {
  if (!Number.isFinite(index)) {
    return { label: 'Indice de conicidade nao calculado', tone: 'neutral', source: 'Valdez 1991' };
  }
  if (index < 1.18) return { label: 'Baixo risco por conicidade', tone: 'success', source: 'Valdez 1991' };
  if (index < 1.25) return { label: 'Risco moderado por conicidade', tone: 'warning', source: 'Valdez 1991' };
  return { label: 'Risco elevado por conicidade', tone: 'danger', source: 'Valdez 1991' };
};

// % de gordura YMCA (WI-013, decisão 1). A equação original é em polegadas e
// libras; aplicada em cm e kg dava ~300%. Fora da faixa plausível o valor vira
// null com aviso: abaixo de 2% fica aquém da gordura essencial e acima de 70%
// não é resultado fisiológico.
export const YMCA_PERCENT_FAT_RANGE = Object.freeze({ min: 2, max: 70 });
export const YMCA_OUT_OF_RANGE_LABEL = 'Fora da faixa plausível (2 a 70%). Verifique cintura e peso.';
export const YMCA_LEGACY_UNITS_LABEL = 'Valor salvo calculado com unidades erradas (cm e kg); não exibido.';
const CM_PER_INCH = 2.54;
const LB_PER_KG = 2.20462;

export const isPlausibleYmcaPercentFat = (value) => {
  const numeric = toNumber(value);
  return Number.isFinite(numeric)
    && numeric >= YMCA_PERCENT_FAT_RANGE.min
    && numeric <= YMCA_PERCENT_FAT_RANGE.max;
};

export const calculateYmcaPercentFat = ({ sex, waistCm, weightKg } = {}) => {
  const normalizedSex = normalizeSex(sex);
  const waist = toNumber(waistCm);
  const weight = toNumber(weightKg);
  if (!normalizedSex || !Number.isFinite(waist) || waist <= 0 || !Number.isFinite(weight) || weight <= 0) {
    return { value: null, raw: null, outOfRange: false };
  }
  const waistIn = waist / CM_PER_INCH;
  const weightLb = weight * LB_PER_KG;
  const constant = normalizedSex === 'male' ? -98.42 : -76.76;
  const raw = ((constant + (4.15 * waistIn) - (0.082 * weightLb)) / weightLb) * 100;
  const plausible = isPlausibleYmcaPercentFat(raw);
  return { value: plausible ? raw : null, raw, outOfRange: !plausible };
};

// Leitura de um % YMCA já salvo. Código novo nunca grava valor fora da faixa;
// um valor assim vem de registro antigo, calculado em cm e kg.
export const readSavedYmcaPercentFat = (value) => {
  const numeric = toNumber(value);
  if (!Number.isFinite(numeric)) return { value: null, legacyUnits: false };
  if (!isPlausibleYmcaPercentFat(numeric)) return { value: null, legacyUnits: true };
  return { value: numeric, legacyUnits: false };
};

const ymcaBodyFatClassification = ({ sex, percentFat, outOfRange = false }) => {
  if (outOfRange) {
    return { label: YMCA_OUT_OF_RANGE_LABEL, tone: 'warning', source: 'YMCA' };
  }
  if (!Number.isFinite(percentFat) || !sex) {
    return { label: 'Sem classificacao YMCA', tone: 'neutral', source: 'YMCA' };
  }

  if (sex === 'male') {
    if (percentFat < 10) return { label: 'Baixo % gordura estimado', tone: 'warning', source: 'YMCA' };
    if (percentFat < 20) return { label: 'Adequado', tone: 'success', source: 'YMCA' };
    if (percentFat < 25) return { label: 'Atencao', tone: 'warning', source: 'YMCA' };
    return { label: 'Elevado', tone: 'danger', source: 'YMCA' };
  }

  if (percentFat < 18) return { label: 'Baixo % gordura estimado', tone: 'warning', source: 'YMCA' };
  if (percentFat < 30) return { label: 'Adequado', tone: 'success', source: 'YMCA' };
  if (percentFat < 35) return { label: 'Atencao', tone: 'warning', source: 'YMCA' };
  return { label: 'Elevado', tone: 'danger', source: 'YMCA' };
};

export const calculateCircumferenceIndicators = (input) => {
  const weightKg = toNumber(input?.weightKg);
  const heightCm = normalizeHeightCm(input?.heightCm);
  const waistCm = toNumber(input?.waistCm);
  const hipCm = toNumber(input?.hipCm);
  const sex = normalizeSex(input?.sex);

  const heightM = Number.isFinite(heightCm) ? heightCm / 100 : null;
  const waistM = Number.isFinite(waistCm) ? waistCm / 100 : null;

  const rcq = Number.isFinite(waistCm) && Number.isFinite(hipCm) && hipCm > 0
    ? waistCm / hipCm
    : null;

  const ice = Number.isFinite(waistCm) && Number.isFinite(heightCm) && heightCm > 0
    ? waistCm / heightCm
    : null;

  const conicity = Number.isFinite(waistM) && Number.isFinite(weightKg) && Number.isFinite(heightM) && heightM > 0 && weightKg > 0
    ? waistM / (0.109 * Math.sqrt(weightKg / heightM))
    : null;

  const ymca = calculateYmcaPercentFat({ sex, waistCm, weightKg });
  const ymcaPercentFat = ymca.value;

  const rcqClass = rcqClassification({ rcq, sex });
  const iceClass = iceClassification(ice);
  const conicityClass = conicityClassification(conicity);
  const ymcaClass = ymcaBodyFatClassification({ sex, percentFat: ymcaPercentFat, outOfRange: ymca.outOfRange });

  return {
    indicators: {
      rcq,
      ice,
      conicity,
      ymcaPercentFat
    },
    classifications: {
      rcq: rcqClass,
      ice: iceClass,
      conicity: conicityClass,
      ymcaPercentFat: ymcaClass
    },
    flags: {
      ymcaPercentFatOutOfRange: ymca.outOfRange
    },
    formulas: {
      rcq: 'cintura_cm / quadril_cm',
      ice: 'cintura_cm / estatura_cm',
      conicity: 'cintura_m / (0.109 * sqrt(peso_kg / estatura_m))',
      ymcaMale: '((-98.42 + 4.15*cintura_pol - 0.082*peso_lb)/peso_lb)*100; cintura_pol = cintura_cm/2.54; peso_lb = peso_kg*2.20462',
      ymcaFemale: '((-76.76 + 4.15*cintura_pol - 0.082*peso_lb)/peso_lb)*100; cintura_pol = cintura_cm/2.54; peso_lb = peso_kg*2.20462'
    }
  };
};

const schofield = ({ sex, ageYears, weightKg }) => {
  if (!Number.isFinite(weightKg) || !Number.isFinite(ageYears) || !sex) return null;
  if (sex === 'male') {
    if (ageYears < 3) return (60.9 * weightKg) - 54;
    if (ageYears < 10) return (22.7 * weightKg) + 495;
    if (ageYears < 18) return (17.5 * weightKg) + 651;
    if (ageYears < 30) return (15.3 * weightKg) + 679;
    if (ageYears < 60) return (11.6 * weightKg) + 879;
    return (13.5 * weightKg) + 487;
  }
  if (ageYears < 3) return (61.0 * weightKg) - 51;
  if (ageYears < 10) return (22.5 * weightKg) + 499;
  if (ageYears < 18) return (12.2 * weightKg) + 746;
  if (ageYears < 30) return (14.7 * weightKg) + 496;
  if (ageYears < 60) return (8.7 * weightKg) + 829;
  return (10.5 * weightKg) + 596;
};

const henry = ({ sex, ageYears, weightKg }) => {
  if (!Number.isFinite(weightKg) || !Number.isFinite(ageYears) || !sex) return null;
  if (sex === 'male') {
    if (ageYears < 3) return (61.0 * weightKg) - 33.7;
    if (ageYears < 10) return (23.3 * weightKg) + 477;
    if (ageYears < 18) return (18.4 * weightKg) + 581;
    if (ageYears < 30) return (16.0 * weightKg) + 545;
    if (ageYears < 60) return (14.2 * weightKg) + 593;
    return (13.0 * weightKg) + 567;
  }
  if (ageYears < 3) return (58.9 * weightKg) - 23.1;
  if (ageYears < 10) return (20.1 * weightKg) + 507;
  if (ageYears < 18) return (11.1 * weightKg) + 761;
  if (ageYears < 30) return (13.1 * weightKg) + 558;
  if (ageYears < 60) return (9.74 * weightKg) + 694;
  return (10.1 * weightKg) + 569;
};

const resolveActivityFactor = ({ activityLevel, activityFactor, sex }) => {
  const rawFactor = toNumber(activityFactor);
  if (Number.isFinite(rawFactor) && rawFactor >= 0.8 && rawFactor <= 2.5) {
    return rawFactor;
  }

  const token = String(activityLevel || '').trim().toLowerCase();
  if (!token || !ACTIVITY_FACTOR_PRESETS[token]) return ACTIVITY_FACTOR_PRESETS.sedentario.generic;
  const preset = ACTIVITY_FACTOR_PRESETS[token];
  if (sex === 'male') return preset.male;
  if (sex === 'female') return preset.female;
  return preset.generic;
};

const mapFormulaResult = ({ formula, valueKcal, equation, applicable = true, missingFields = [] }) => ({
  formulaId: formula.id,
  formulaVersion: formula.version,
  label: formula.label,
  valueKcal: Number.isFinite(valueKcal) ? Number(valueKcal.toFixed(0)) : null,
  valueKcalRaw: Number.isFinite(valueKcal) ? valueKcal : null,
  equation,
  reference: formula.reference,
  year: formula.year,
  indicatedFor: formula.indicatedFor,
  type: formula.type,
  recommended: formula.recommended === true,
  applicable,
  missingFields
});

export const calculateTmbComparative = (profileInput) => {
  const profile = {
    weightKg: toNumber(profileInput?.weightKg),
    heightCm: normalizeHeightCm(profileInput?.heightCm),
    ageYears: toNumber(profileInput?.ageYears),
    sex: normalizeSex(profileInput?.sex),
    fatFreeMassKg: toNumber(profileInput?.fatFreeMassKg),
    activityLevel: profileInput?.activityLevel,
    activityFactor: profileInput?.activityFactor,
    context: String(profileInput?.context || '').trim().toLowerCase(),
    population: String(profileInput?.population || '').trim().toLowerCase()
  };

  const heightM = Number.isFinite(profile.heightCm) ? profile.heightCm / 100 : null;
  const af = resolveActivityFactor({
    activityLevel: profile.activityLevel,
    activityFactor: profile.activityFactor,
    sex: profile.sex
  });

  const rows = [];
  const male = profile.sex === 'male';

  const hbOriginal = Number.isFinite(profile.weightKg) && Number.isFinite(profile.heightCm) && Number.isFinite(profile.ageYears) && profile.sex
    ? (male
      ? 66.5 + (13.75 * profile.weightKg) + (5.003 * profile.heightCm) - (6.775 * profile.ageYears)
      : 655.1 + (9.563 * profile.weightKg) + (1.85 * profile.heightCm) - (4.676 * profile.ageYears))
    : null;
  rows.push(mapFormulaResult({
    formula: TMB_FORMULAS.harris_benedict_original_1919,
    valueKcal: hbOriginal,
    equation: male
      ? '66.5 + (13.75 x peso) + (5.003 x altura_cm) - (6.775 x idade)'
      : '655.1 + (9.563 x peso) + (1.850 x altura_cm) - (4.676 x idade)',
    applicable: Number.isFinite(hbOriginal),
    missingFields: Number.isFinite(hbOriginal) ? [] : ['peso', 'altura', 'idade', 'sexo']
  }));

  const hbRevisada = Number.isFinite(profile.weightKg) && Number.isFinite(profile.heightCm) && Number.isFinite(profile.ageYears) && profile.sex
    ? (male
      ? 88.362 + (13.397 * profile.weightKg) + (4.799 * profile.heightCm) - (5.677 * profile.ageYears)
      : 447.593 + (9.247 * profile.weightKg) + (3.098 * profile.heightCm) - (4.33 * profile.ageYears))
    : null;
  rows.push(mapFormulaResult({
    formula: TMB_FORMULAS.harris_benedict_revisada_1984,
    valueKcal: hbRevisada,
    equation: male
      ? '88.362 + (13.397 x peso) + (4.799 x altura_cm) - (5.677 x idade)'
      : '447.593 + (9.247 x peso) + (3.098 x altura_cm) - (4.330 x idade)',
    applicable: Number.isFinite(hbRevisada),
    missingFields: Number.isFinite(hbRevisada) ? [] : ['peso', 'altura', 'idade', 'sexo']
  }));

  const mifflin = Number.isFinite(profile.weightKg) && Number.isFinite(profile.heightCm) && Number.isFinite(profile.ageYears) && profile.sex
    ? ((10 * profile.weightKg) + (6.25 * profile.heightCm) - (5 * profile.ageYears) + (male ? 5 : -161))
    : null;
  rows.push(mapFormulaResult({
    formula: TMB_FORMULAS.mifflin_st_jeor_1990,
    valueKcal: mifflin,
    equation: male
      ? '(10 x peso) + (6.25 x altura_cm) - (5 x idade) + 5'
      : '(10 x peso) + (6.25 x altura_cm) - (5 x idade) - 161',
    applicable: Number.isFinite(mifflin),
    missingFields: Number.isFinite(mifflin) ? [] : ['peso', 'altura', 'idade', 'sexo']
  }));

  const cunningham = Number.isFinite(profile.fatFreeMassKg)
    ? 500 + (22 * profile.fatFreeMassKg)
    : null;
  rows.push(mapFormulaResult({
    formula: TMB_FORMULAS.cunningham_1980,
    valueKcal: cunningham,
    equation: '500 + (22 x massa_magra_kg)',
    applicable: Number.isFinite(cunningham),
    missingFields: Number.isFinite(cunningham) ? [] : ['massa_magra_kg']
  }));

  const owen = Number.isFinite(profile.weightKg) && profile.sex
    ? (male ? 879 + (10.2 * profile.weightKg) : 795 + (7.18 * profile.weightKg))
    : null;
  rows.push(mapFormulaResult({
    formula: TMB_FORMULAS.owen_1987,
    valueKcal: owen,
    equation: male ? '879 + (10.2 x peso_kg)' : '795 + (7.18 x peso_kg)',
    applicable: Number.isFinite(owen),
    missingFields: Number.isFinite(owen) ? [] : ['peso', 'sexo']
  }));

  const schofieldValue = schofield({ sex: profile.sex, ageYears: profile.ageYears, weightKg: profile.weightKg });
  rows.push(mapFormulaResult({
    formula: TMB_FORMULAS.fao_schofield_1985,
    valueKcal: schofieldValue,
    equation: 'Equacao por faixa etaria e sexo (Schofield 1985)',
    applicable: Number.isFinite(schofieldValue),
    missingFields: Number.isFinite(schofieldValue) ? [] : ['peso', 'idade', 'sexo']
  }));

  const henryValue = henry({ sex: profile.sex, ageYears: profile.ageYears, weightKg: profile.weightKg });
  rows.push(mapFormulaResult({
    formula: TMB_FORMULAS.henry_2005,
    valueKcal: henryValue,
    equation: 'Equacao por faixa etaria e sexo (Henry 2005)',
    applicable: Number.isFinite(henryValue),
    missingFields: Number.isFinite(henryValue) ? [] : ['peso', 'idade', 'sexo']
  }));

  const guedes = Number.isFinite(profile.fatFreeMassKg)
    ? 426.2 + (14.334 * profile.fatFreeMassKg)
    : null;
  rows.push(mapFormulaResult({
    formula: TMB_FORMULAS.guedes_2006,
    valueKcal: guedes,
    equation: '426.2 + (14.334 x massa_magra_kg)',
    applicable: Number.isFinite(guedes),
    missingFields: Number.isFinite(guedes) ? [] : ['massa_magra_kg']
  }));

  const falkner = Number.isFinite(profile.weightKg) && Number.isFinite(profile.heightCm) && Number.isFinite(profile.ageYears)
    ? Math.sqrt((profile.heightCm * profile.weightKg) / 3600) * 1000
    : null;
  rows.push(mapFormulaResult({
    formula: TMB_FORMULAS.falkner_pediatrica,
    valueKcal: falkner,
    equation: 'SC = sqrt((altura_cm x peso_kg)/3600); TMB = SC x 1000',
    applicable: Number.isFinite(falkner),
    missingFields: Number.isFinite(falkner) ? [] : ['peso', 'altura', 'idade']
  }));

  const eer = Number.isFinite(profile.weightKg) && Number.isFinite(heightM) && Number.isFinite(profile.ageYears) && profile.sex
    ? (male
      ? 662 - (9.53 * profile.ageYears) + af * ((15.91 * profile.weightKg) + (539.6 * heightM))
      : 354 - (6.91 * profile.ageYears) + af * ((9.36 * profile.weightKg) + (726 * heightM)))
    : null;
  rows.push(mapFormulaResult({
    formula: TMB_FORMULAS.dri_iom_2005_eer,
    valueKcal: eer,
    equation: male
      ? '662 - (9.53 x idade) + NAF x [(15.91 x peso) + (539.6 x altura_m)]'
      : '354 - (6.91 x idade) + NAF x [(9.36 x peso) + (726 x altura_m)]',
    applicable: Number.isFinite(eer),
    missingFields: Number.isFinite(eer) ? [] : ['peso', 'altura', 'idade', 'sexo']
  }));

  const applicableRows = rows.filter((row) => row.applicable && Number.isFinite(row.valueKcalRaw));
  const values = applicableRows.map((row) => row.valueKcalRaw);
  const maxValue = values.length ? Math.max(...values) : null;
  const minValue = values.length ? Math.min(...values) : null;
  const spread = Number.isFinite(maxValue) && Number.isFinite(minValue) ? maxValue - minValue : null;

  let defaultFormulaId = 'mifflin_st_jeor_1990';
  if (profile.context === 'atleta' && Number.isFinite(profile.fatFreeMassKg)) {
    defaultFormulaId = 'cunningham_1980';
  } else if (Number.isFinite(profile.ageYears) && profile.ageYears < 18) {
    defaultFormulaId = 'fao_schofield_1985';
  } else if (profile.population === 'tropical') {
    defaultFormulaId = 'henry_2005';
  }

  return {
    profile: {
      ...profile,
      activityFactorResolved: af,
      heightM
    },
    rows,
    defaultFormulaId,
    spreadKcal: Number.isFinite(spread) ? Number(spread.toFixed(1)) : null,
    hasRelevantSpread: Number.isFinite(spread) && spread > 200
  };
};

export const resolveOfficialTmbSelection = ({ comparative, selectedFormulaId }) => {
  const rows = Array.isArray(comparative?.rows) ? comparative.rows : [];
  const targetId = selectedFormulaId || comparative?.defaultFormulaId;
  const selected = rows.find((row) => row.formulaId === targetId && row.applicable) || rows.find((row) => row.formulaId === comparative?.defaultFormulaId && row.applicable) || rows.find((row) => row.applicable) || null;
  if (!selected) {
    return {
      selected: null,
      formulaId: null,
      formulaVersion: null,
      tmbKcal: null,
      type: null
    };
  }
  return {
    selected,
    formulaId: selected.formulaId,
    formulaVersion: selected.formulaVersion,
    tmbKcal: selected.valueKcal,
    type: selected.type
  };
};

export const buildComparativeDeltas = ({ current, reference }) => {
  const currentNumber = toNumber(current);
  const referenceNumber = toNumber(reference);
  if (!Number.isFinite(currentNumber) || !Number.isFinite(referenceNumber) || referenceNumber === 0) {
    return {
      deltaAbs: null,
      deltaPct: null
    };
  }
  const deltaAbs = currentNumber - referenceNumber;
  const deltaPct = (deltaAbs / referenceNumber) * 100;
  return {
    deltaAbs,
    deltaPct
  };
};

const HYDRATION_ALERT_LABELS = {
  danger: 'Alto',
  warning: 'Moderado',
  info: 'Leve',
  success: 'Baixo',
  neutral: 'Indefinido'
};

export const classifyHydrationByLossPercent = (lossPercent) => {
  if (!Number.isFinite(lossPercent)) {
    return {
      label: 'Sem classificacao',
      tone: 'neutral',
      alertLevel: 'neutral',
      alertLabel: HYDRATION_ALERT_LABELS.neutral,
      reference: 'Perda de peso durante exercicio'
    };
  }

  if (lossPercent >= 3) {
    return {
      label: 'Desidratacao importante',
      tone: 'danger',
      alertLevel: 'danger',
      alertLabel: HYDRATION_ALERT_LABELS.danger,
      reference: 'Perda de peso durante exercicio'
    };
  }
  if (lossPercent >= 2) {
    return {
      label: 'Desidratacao moderada',
      tone: 'warning',
      alertLevel: 'warning',
      alertLabel: HYDRATION_ALERT_LABELS.warning,
      reference: 'Perda de peso durante exercicio'
    };
  }
  if (lossPercent > 0) {
    return {
      label: 'Leve desidratacao',
      tone: 'info',
      alertLevel: 'info',
      alertLabel: HYDRATION_ALERT_LABELS.info,
      reference: 'Perda de peso durante exercicio'
    };
  }

  return {
    label: 'Sem perda relevante',
    tone: 'success',
    alertLevel: 'success',
    alertLabel: HYDRATION_ALERT_LABELS.success,
    reference: 'Perda de peso durante exercicio'
  };
};

export const calculateHydrationEvaluation = (input = {}) => {
  const weightBeforeKg = toNumber(input?.pesoAntesExercicio ?? input?.weightBeforeKg);
  const weightAfterKg = toNumber(input?.pesoAposExercicio ?? input?.weightAfterKg);
  const durationMin = toNumber(input?.duracaoExercicioMin ?? input?.durationMin);
  const fluidIntakeMl = toNumber(input?.volumeIngeridoMl ?? input?.fluidIntakeMl);
  const urineVolumeMl = toNumber(input?.volumeUrinarioMl ?? input?.urineVolumeMl);
  const ambientTemperatureC = toNumber(input?.temperaturaAmbiente ?? input?.ambientTemperatureC);
  const modality = String((input?.modalidade ?? input?.modality) || '').trim();
  const notes = String((input?.observacoes ?? input?.notes) || '').trim();

  const intakeMlSafe = Number.isFinite(fluidIntakeMl) ? fluidIntakeMl : 0;
  const urineMlSafe = Number.isFinite(urineVolumeMl) ? urineVolumeMl : 0;

  // WI-013, decisão 5. A variação (antes - após) negativa é ganho de peso, não
  // "perda negativa". A perda de suor usa a variação com sinal; se der zero ou
  // menos, o registro é inconsistente e perda, sudorese e reposição ficam null.
  // Nenhuma dessas saídas é negativa.
  const weightChangeKg = Number.isFinite(weightBeforeKg) && Number.isFinite(weightAfterKg)
    ? weightBeforeKg - weightAfterKg
    : null;
  const weightLossKg = Number.isFinite(weightChangeKg) && weightChangeKg >= 0 ? weightChangeKg : null;
  const weightGainKg = Number.isFinite(weightChangeKg) && weightChangeKg < 0 ? -weightChangeKg : null;
  const signedLossPercent = Number.isFinite(weightChangeKg) && Number.isFinite(weightBeforeKg) && weightBeforeKg > 0
    ? (weightChangeKg / weightBeforeKg) * 100
    : null;
  const weightLossPercent = Number.isFinite(signedLossPercent) && signedLossPercent >= 0 ? signedLossPercent : null;
  const sweatLossRawMl = Number.isFinite(weightChangeKg)
    ? (weightChangeKg * 1000) + intakeMlSafe - urineMlSafe
    : null;
  const sweatLossInconsistent = Number.isFinite(sweatLossRawMl) && sweatLossRawMl <= 0;
  const netFluidLossMl = Number.isFinite(sweatLossRawMl) && sweatLossRawMl > 0 ? sweatLossRawMl : null;
  const sweatRateLh = Number.isFinite(netFluidLossMl) && Number.isFinite(durationMin) && durationMin > 0
    ? ((netFluidLossMl / durationMin) * 60) / 1000
    : null;
  const sweatRateMlMin = Number.isFinite(sweatRateLh)
    ? (sweatRateLh * 1000) / 60
    : null;
  const replacementTargetMl = Number.isFinite(netFluidLossMl) ? Math.round(netFluidLossMl * 1.5) : null;

  // A faixa continua lida sobre a variação com sinal: ganho de peso segue
  // "Sem perda relevante", como antes.
  const classification = classifyHydrationByLossPercent(signedLossPercent);
  const warnings = [];

  if (Number.isFinite(weightGainKg)) {
    warnings.push('Peso apos o exercicio maior que o peso antes. Verifique hidratacao excessiva ou registro.');
  }
  if (Number.isFinite(durationMin) && durationMin <= 0) {
    warnings.push('Duracao do exercicio deve ser maior que zero para calcular taxa de sudorese.');
  }
  if (sweatLossInconsistent) {
    warnings.push('Balanco hidrico liquido negativo ou zero para perda estimada. Revise entradas de volume.');
  }

  return {
    inputNormalized: {
      dataAvaliacao: String(input?.dataAvaliacao || '').trim() || null,
      pesoAntesExercicio: weightBeforeKg,
      pesoAposExercicio: weightAfterKg,
      duracaoExercicioMin: durationMin,
      volumeIngeridoMl: intakeMlSafe,
      volumeUrinarioMl: urineMlSafe,
      modalidade: modality,
      temperaturaAmbiente: ambientTemperatureC,
      observacoes: notes
    },
    metrics: {
      perdaPesoAbsolutaKg: weightLossKg,
      ganhoPesoKg: weightGainKg,
      perdaPesoPercentual: weightLossPercent,
      perdaHidricaLiquidaMl: netFluidLossMl,
      taxaSudoreseLh: sweatRateLh,
      taxaSudoreseMlMin: sweatRateMlMin,
      metaReposicaoMl: replacementTargetMl
    },
    flags: {
      ganhoPeso: Number.isFinite(weightGainKg),
      perdaSuorInconsistente: sweatLossInconsistent
    },
    classification,
    warnings,
    formulas: {
      perdaPesoAbsolutaKg: 'peso_antes_kg - peso_apos_kg (negativo = ganho de peso, nao perda)',
      perdaPesoPercentual: '(perda_peso_kg / peso_antes_kg) x 100',
      perdaHidricaLiquidaMl: '(variacao_peso_kg x 1000) + volume_ingerido_ml - volume_urinario_ml; <= 0 fica nulo',
      metaReposicaoMl: 'perda_hidrica_liquida_ml x 1.5',
      taxaSudoreseLh: '((perda_hidrica_liquida_ml / duracao_min) x 60) / 1000',
      classificacao: 'Faixas por perda percentual de peso durante exercicio'
    }
  };
};

export const NOVA_CATEGORY_CATALOG = {
  in_natura: { nome: 'In Natura' },
  minimamente_processados: { nome: 'Minimamente Processados' },
  processados: { nome: 'Processados' },
  ultraprocessados: { nome: 'Ultraprocessados' }
};

const normalizeNovaCategory = (value) => {
  const token = String(value || '').trim().toLowerCase();
  if (token in NOVA_CATEGORY_CATALOG) return token;
  return 'in_natura';
};

const normalizeNovaOrigin = (value) => {
  const token = String(value || '').trim().toLowerCase();
  if (token === 'questnova') return 'questnova';
  if (token === 'importacao') return 'importacao';
  return 'manual';
};

const normalizeNovaDate = (value, fallbackDate) => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  }
  const resolved = value?.toDate ? value.toDate() : new Date(value || fallbackDate);
  if (Number.isNaN(resolved?.getTime?.())) return fallbackDate;
  return resolved.toISOString().slice(0, 10);
};

const normalizeNovaRecord = (record, index, defaultDate) => ({
  id: String(record?.id || `${Date.now()}-${index}`),
  alimento: String(record?.alimento || '').trim(),
  categoria: normalizeNovaCategory(record?.categoria),
  energia: Number.isFinite(toNumber(record?.energia)) ? Number(toNumber(record?.energia)) : 0,
  data: normalizeNovaDate(record?.data, defaultDate)
});

const NOVA_DIRECT_INPUT_KEYS = {
  in_natura: ['kcalInNatura', 'kcal_in_natura', 'in_natura'],
  minimamente_processados: [
    'kcalMinimamenteProcessados',
    'kcal_minimamente_processados',
    'minimamente_processados'
  ],
  processados: ['kcalProcessados', 'kcal_processados', 'processados'],
  ultraprocessados: ['kcalUltraprocessados', 'kcal_ultraprocessados', 'ultraprocessados']
};

const readNovaEnergyValue = (value) => {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'object' && !Array.isArray(value)) {
    const nested = toNumber(value?.energiaTotal ?? value?.kcal ?? value?.value);
    return Number.isFinite(nested) ? nested : null;
  }
  const numeric = toNumber(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const resolveNovaGroupEnergy = ({ input, categoryKey }) => {
  const directKeys = NOVA_DIRECT_INPUT_KEYS[categoryKey] || [];
  const scopedSources = [
    input,
    input?.input,
    input?.kcalPorGrupo,
    input?.kcal_por_grupo,
    input?.groups,
    input?.categorias,
    input?.categories
  ];

  for (const source of scopedSources) {
    if (!source || typeof source !== 'object') continue;
    for (const key of directKeys) {
      const resolved = readNovaEnergyValue(source?.[key]);
      if (Number.isFinite(resolved)) return resolved;
    }
    const byCategory = readNovaEnergyValue(source?.[categoryKey]);
    if (Number.isFinite(byCategory)) return byCategory;
  }

  return null;
};

// WI-013, decisão 6: sem percentual de ultraprocessados (total zero) não há
// padrão a classificar; nunca "Padrão saudável".
export const classifyNovaPattern = (percentuais = {}) => {
  const ultra = toNumber(percentuais?.ultraprocessados);
  if (!Number.isFinite(ultra)) return { label: 'Sem classificacao', tone: 'neutral', reference: 'Classificacao NOVA por % ultraprocessados' };
  if (ultra < 10) return { label: 'Padrao saudavel', tone: 'success', reference: 'Classificacao NOVA por % ultraprocessados' };
  if (ultra < 20) return { label: 'Padrao moderado', tone: 'info', reference: 'Classificacao NOVA por % ultraprocessados' };
  if (ultra < 30) return { label: 'Padrao de risco', tone: 'warning', reference: 'Classificacao NOVA por % ultraprocessados' };
  return { label: 'Padrao de alto risco', tone: 'danger', reference: 'Classificacao NOVA por % ultraprocessados' };
};

export const calculateNovaEvaluation = (input = {}) => {
  const baseDate = normalizeNovaDate(input?.dataAvaliacao, new Date().toISOString().slice(0, 10));
  const normalizedRecords = Array.isArray(input?.registros)
    ? input.registros.map((record, index) => normalizeNovaRecord(record, index, baseDate))
    : [];
  const kcalTotalInformado = toNumber(input?.kcalTotalInformado);
  const origemDados = normalizeNovaOrigin(input?.origemDados);
  const fonteExterna = String(input?.fonteExterna || '').trim();

  const directGroupKcal = Object.keys(NOVA_CATEGORY_CATALOG).reduce((acc, key) => {
    const value = resolveNovaGroupEnergy({ input, categoryKey: key });
    if (Number.isFinite(value) && value >= 0) {
      acc[key] = Number(value.toFixed(2));
    } else if (Number.isFinite(value) && value < 0) {
      acc[key] = 0;
    } else {
      acc[key] = null;
    }
    return acc;
  }, {});

  const categorias = Object.entries(NOVA_CATEGORY_CATALOG).reduce((acc, [key, meta]) => {
    acc[key] = {
      nome: meta.nome,
      energiaTotal: 0,
      alimentos: [],
      quantidade: 0,
      fonteEnergia: 'registros'
    };
    return acc;
  }, {});

  normalizedRecords.forEach((record) => {
    const categoria = record.categoria;
    if (!categorias[categoria]) return;
    categorias[categoria].energiaTotal += record.energia;
    categorias[categoria].alimentos.push(record);
    categorias[categoria].quantidade += 1;
  });

  Object.keys(NOVA_CATEGORY_CATALOG).forEach((key) => {
    const directEnergy = directGroupKcal[key];
    if (Number.isFinite(directEnergy)) {
      categorias[key].energiaTotal = directEnergy;
      categorias[key].fonteEnergia = 'kcal_informada';
    }
  });

  const totalDiarioCalculado = Object.values(categorias)
    .reduce((sum, categoria) => sum + Number(categoria?.energiaTotal || 0), 0);
  const totalDiario = Number.isFinite(kcalTotalInformado) && kcalTotalInformado > 0
    ? kcalTotalInformado
    : totalDiarioCalculado;

  const totalBasePercentual = totalDiarioCalculado > 0 ? totalDiarioCalculado : 0;
  const percentuais = Object.keys(NOVA_CATEGORY_CATALOG).reduce((acc, key) => {
    if (!Number.isFinite(totalBasePercentual) || totalBasePercentual <= 0) {
      acc[key] = null;
    } else {
      acc[key] = Number(((categorias[key].energiaTotal / totalBasePercentual) * 100).toFixed(2));
    }
    return acc;
  }, {});

  const percentuaisSobreTotalInformado = Object.keys(NOVA_CATEGORY_CATALOG).reduce((acc, key) => {
    if (!Number.isFinite(kcalTotalInformado) || kcalTotalInformado <= 0) {
      acc[key] = null;
    } else {
      acc[key] = Number(((categorias[key].energiaTotal / kcalTotalInformado) * 100).toFixed(2));
    }
    return acc;
  }, {});

  const inconsistenciaKcal = Number.isFinite(kcalTotalInformado) && kcalTotalInformado > 0
    ? Number((kcalTotalInformado - totalDiarioCalculado).toFixed(2))
    : null;
  const classificacao = classifyNovaPattern(percentuais);

  const warnings = [];
  const hasDirectInput = Object.values(directGroupKcal).some((value) => Number.isFinite(value));
  if (!hasDirectInput && normalizedRecords.length === 0 && !Number.isFinite(kcalTotalInformado)) {
    warnings.push('Sem kcal por grupo NOVA e sem kcal total informado.');
  }
  if (!hasDirectInput && normalizedRecords.length > 0) {
    warnings.push('Kcal por grupo NOVA nao informado; total derivado dos registros legados.');
  }
  if (!hasDirectInput && Number.isFinite(kcalTotalInformado) && kcalTotalInformado > 0 && totalDiarioCalculado <= 0) {
    warnings.push('Informe as kcal por grupo NOVA para calcular a distribuicao percentual.');
  }
  if (Number.isFinite(inconsistenciaKcal) && Math.abs(inconsistenciaKcal) > 100) {
    warnings.push('Diferenca relevante entre total informado e soma dos grupos NOVA.');
  }

  return {
    inputNormalized: {
      dataAvaliacao: baseDate,
      origemDados,
      fonteExterna,
      kcalTotalInformado: Number.isFinite(kcalTotalInformado) ? kcalTotalInformado : null,
      registros: normalizedRecords,
      categorias: Object.keys(NOVA_CATEGORY_CATALOG).reduce((acc, key) => {
        acc[key] = Number.isFinite(directGroupKcal[key])
          ? directGroupKcal[key]
          : Number(Number(categorias[key].energiaTotal || 0).toFixed(2));
        return acc;
      }, {}),
      kcalInNatura: Number.isFinite(directGroupKcal.in_natura) ? directGroupKcal.in_natura : null,
      kcalMinimamenteProcessados: Number.isFinite(directGroupKcal.minimamente_processados) ? directGroupKcal.minimamente_processados : null,
      kcalProcessados: Number.isFinite(directGroupKcal.processados) ? directGroupKcal.processados : null,
      kcalUltraprocessados: Number.isFinite(directGroupKcal.ultraprocessados) ? directGroupKcal.ultraprocessados : null
    },
    categories: categorias,
    totals: {
      totalDiario,
      totalDiarioCalculado,
      totalBasePercentual,
      kcalTotalInformado: Number.isFinite(kcalTotalInformado) ? kcalTotalInformado : null,
      inconsistenciaKcal
    },
    percentuais,
    percentuaisSobreTotalInformado,
    classification: classificacao,
    warnings,
    formulas: {
      distribuicao: '% grupo = (energia_grupo / soma_energia_grupos) x 100',
      classificacao: 'Faixa de ultraprocessados: <10 saudavel | 10-19 moderado | 20-29 risco | >=30 alto risco'
    }
  };
};

const PHASE_ANGLE_REFERENCES = {
  male: {
    low: 5.0,
    adequate: 6.5
  },
  female: {
    low: 4.8,
    adequate: 6.0
  },
  generic: {
    low: 4.8,
    adequate: 6.2
  }
};

const classifyPhaseAngle = ({ sex, phaseAngle }) => {
  if (!Number.isFinite(phaseAngle)) {
    return {
      label: 'Angulo de fase nao calculado',
      tone: 'neutral',
      source: 'Barbosa-Silva et al. 2005'
    };
  }

  const ref = PHASE_ANGLE_REFERENCES[sex] || PHASE_ANGLE_REFERENCES.generic;
  if (phaseAngle < ref.low) {
    return {
      label: 'Angulo de fase baixo',
      tone: 'danger',
      source: 'Barbosa-Silva et al. 2005'
    };
  }
  if (phaseAngle < ref.adequate) {
    return {
      label: 'Angulo de fase limitrofe',
      tone: 'warning',
      source: 'Barbosa-Silva et al. 2005'
    };
  }
  return {
    label: 'Angulo de fase adequado',
    tone: 'success',
    source: 'Barbosa-Silva et al. 2005'
  };
};

const classifyBodyFatForBia = ({ sex, ageYears, percentFat }) => {
  if (!Number.isFinite(percentFat)) {
    return { label: 'Sem classificacao de % gordura', tone: 'neutral', source: 'Referencia clinica' };
  }

  const isAdult = !Number.isFinite(ageYears) || ageYears >= 18;
  if (sex === 'male') {
    if (!isAdult && percentFat < 10) return { label: 'Baixo', tone: 'warning', source: 'Pediatrico' };
    if (!isAdult && percentFat < 20) return { label: 'Adequado', tone: 'success', source: 'Pediatrico' };
    if (!isAdult && percentFat < 25) return { label: 'Atencao', tone: 'warning', source: 'Pediatrico' };
    if (!isAdult) return { label: 'Elevado', tone: 'danger', source: 'Pediatrico' };
    if (percentFat < 6) return { label: 'Muito baixo', tone: 'warning', source: 'Adultos' };
    if (percentFat < 20) return { label: 'Adequado', tone: 'success', source: 'Adultos' };
    if (percentFat < 25) return { label: 'Atencao', tone: 'warning', source: 'Adultos' };
    return { label: 'Elevado', tone: 'danger', source: 'Adultos' };
  }

  if (!isAdult && percentFat < 16) return { label: 'Baixo', tone: 'warning', source: 'Pediatrico' };
  if (!isAdult && percentFat < 26) return { label: 'Adequado', tone: 'success', source: 'Pediatrico' };
  if (!isAdult && percentFat < 32) return { label: 'Atencao', tone: 'warning', source: 'Pediatrico' };
  if (!isAdult) return { label: 'Elevado', tone: 'danger', source: 'Pediatrico' };
  if (percentFat < 14) return { label: 'Muito baixo', tone: 'warning', source: 'Adultos' };
  if (percentFat < 33) return { label: 'Adequado', tone: 'success', source: 'Adultos' };
  if (percentFat < 38) return { label: 'Atencao', tone: 'warning', source: 'Adultos' };
  return { label: 'Elevado', tone: 'danger', source: 'Adultos' };
};

const classifyHydrationForBia = ({ tbwL, weightKg }) => {
  if (!Number.isFinite(tbwL) || !Number.isFinite(weightKg) || weightKg <= 0) {
    return { label: 'Sem classificacao hidrica', tone: 'neutral', source: 'TBW/peso' };
  }
  const pct = (tbwL / weightKg) * 100;
  if (pct < 45) return { label: 'Hidratacao baixa', tone: 'danger', source: 'TBW/peso' };
  if (pct < 50) return { label: 'Hidratacao limitrofe', tone: 'warning', source: 'TBW/peso' };
  if (pct <= 65) return { label: 'Hidratacao adequada', tone: 'success', source: 'TBW/peso' };
  return { label: 'Hidratacao elevada', tone: 'warning', source: 'TBW/peso' };
};

const normalizeHydrationStatus = (value) => {
  const token = String(value || '').trim().toLowerCase();
  if (!token) return 'nao_informado';
  if (token.includes('desid')) return 'desidratado';
  if (token.includes('hiper')) return 'hiperidratado';
  if (token.includes('adequ')) return 'adequada';
  return token;
};

const normalizeBooleanToken = (value) => {
  if (typeof value === 'boolean') return value;
  const token = String(value || '').trim().toLowerCase();
  if (!token) return null;
  if (['sim', 'true', '1', 'yes', 'y'].includes(token)) return true;
  if (['nao', 'false', '0', 'no', 'n'].includes(token)) return false;
  return null;
};

export const calculateBiaEvaluation = (input = {}) => {
  const sex = normalizeSex(input?.sex);
  const ageYears = toNumber(input?.ageYears);
  const weightKg = toNumber(input?.weightKg);
  const heightCm = normalizeHeightCm(input?.heightCm);
  const heightM = Number.isFinite(heightCm) ? heightCm / 100 : null;

  const entryMode = String(input?.entryMode || 'manual').trim().toLowerCase();
  const biaType = String(input?.biaType || 'tetrapolar_segmentar').trim().toLowerCase();

  const resistanceOhm = toNumber(input?.resistanceOhm);
  const reactanceOhm = toNumber(input?.reactanceOhm);
  const phaseAngleInput = toNumber(input?.phaseAngle);
  const phaseAngle = Number.isFinite(phaseAngleInput)
    ? phaseAngleInput
    : (Number.isFinite(resistanceOhm) && Number.isFinite(reactanceOhm) && resistanceOhm > 0
      ? Math.atan(reactanceOhm / resistanceOhm) * (180 / Math.PI)
      : null);

  const percentFatInput = toNumber(input?.percentFat);
  const fatMassInput = toNumber(input?.fatMassKg);
  const leanMassInput = toNumber(input?.leanMassKg);
  const tbwL = toNumber(input?.tbwL);
  const icwL = toNumber(input?.icwL);
  const ecwL = toNumber(input?.ecwL);
  const deviceTmbKcal = toNumber(input?.deviceTmbKcal);

  const percentFat = Number.isFinite(percentFatInput)
    ? percentFatInput
    : (Number.isFinite(fatMassInput) && Number.isFinite(weightKg) && weightKg > 0
      ? (fatMassInput / weightKg) * 100
      : null);
  const fatMassKg = Number.isFinite(fatMassInput)
    ? fatMassInput
    : (Number.isFinite(percentFat) && Number.isFinite(weightKg)
      ? (percentFat / 100) * weightKg
      : null);
  const leanMassKg = Number.isFinite(leanMassInput)
    ? leanMassInput
    : (Number.isFinite(weightKg) && Number.isFinite(fatMassKg)
      ? weightKg - fatMassKg
      : null);

  const ffmi = Number.isFinite(leanMassKg) && Number.isFinite(heightM) && heightM > 0
    ? leanMassKg / (heightM * heightM)
    : null;
  const ecwIcwRatio = Number.isFinite(ecwL) && Number.isFinite(icwL) && icwL > 0
    ? ecwL / icwL
    : null;

  const tmbCunningham = Number.isFinite(leanMassKg)
    ? 500 + (22 * leanMassKg)
    : null;
  const tmbGuedes = Number.isFinite(leanMassKg)
    ? 426.2 + (14.334 * leanMassKg)
    : null;

  const diffDeviceVsCunningham = Number.isFinite(deviceTmbKcal) && Number.isFinite(tmbCunningham)
    ? deviceTmbKcal - tmbCunningham
    : null;
  const diffDeviceVsGuedes = Number.isFinite(deviceTmbKcal) && Number.isFinite(tmbGuedes)
    ? deviceTmbKcal - tmbGuedes
    : null;

  const fastingHours = toNumber(input?.fastingHours);
  const hydrationStatus = normalizeHydrationStatus(input?.hydrationStatus);
  const hadPhysicalActivity24h = normalizeBooleanToken(input?.hadPhysicalActivity24h);
  const menstrualPhase = String(input?.menstrualPhase || '').trim().toLowerCase();

  const precheckWarnings = [];
  if (Number.isFinite(fastingHours) && fastingHours < 4) {
    precheckWarnings.push('Jejum menor que 4h pode distorcer o resultado da BIA.');
  }
  if (hydrationStatus === 'desidratado') {
    precheckWarnings.push('Paciente desidratado: resultado pode superestimar gordura corporal.');
  }
  if (hydrationStatus === 'hiperidratado') {
    precheckWarnings.push('Paciente hiperidratado: resultado pode subestimar gordura corporal.');
  }
  if (hadPhysicalActivity24h === true) {
    precheckWarnings.push('Atividade fisica nas ultimas 24h pode alterar agua corporal e impedancia.');
  }
  if (menstrualPhase && menstrualPhase !== 'nao_informado' && menstrualPhase !== 'nenhuma') {
    precheckWarnings.push('Fase do ciclo menstrual pode alterar retencao hidrica e resultados da BIA.');
  }

  const phaseAngleClass = classifyPhaseAngle({ sex, phaseAngle });
  const bodyFatClass = classifyBodyFatForBia({ sex, ageYears, percentFat });
  const hydrationClass = classifyHydrationForBia({ tbwL, weightKg });

  const ecwIcwClass = Number.isFinite(ecwIcwRatio)
    ? (ecwIcwRatio > 1.0
      ? { label: 'Razao ECW/ICW elevada', tone: 'warning', source: 'Referencia clinica' }
      : { label: 'Razao ECW/ICW esperada', tone: 'success', source: 'Referencia clinica' })
    : { label: 'Razao ECW/ICW nao calculada', tone: 'neutral', source: 'Referencia clinica' };

  return {
    inputNormalized: {
      entryMode,
      biaType,
      sex,
      ageYears,
      weightKg,
      heightCm,
      heightM,
      resistanceOhm,
      reactanceOhm,
      phaseAngle,
      percentFat,
      fatMassKg,
      leanMassKg,
      tbwL,
      icwL,
      ecwL,
      deviceTmbKcal,
      fastingHours,
      hydrationStatus,
      hadPhysicalActivity24h,
      menstrualPhase
    },
    derived: {
      ffmi,
      ecwIcwRatio,
      tmbCunningham,
      tmbGuedes,
      diffDeviceVsCunningham,
      diffDeviceVsGuedes
    },
    classifications: {
      bodyFat: bodyFatClass,
      hydration: hydrationClass,
      phaseAngle: phaseAngleClass,
      ecwIcw: ecwIcwClass
    },
    warnings: {
      precheck: precheckWarnings
    },
    formulas: {
      ffmi: {
        id: 'ffmi_massa_magra_altura',
        equation: 'IMLG = massa_magra_kg / altura_m^2',
        reference: 'Indice de Massa Livre de Gordura'
      },
      phaseAngle: {
        id: 'fase_arctan_reactancia_resistencia',
        equation: 'Angulo = arctan(Xc / R) x (180 / PI)',
        reference: 'Barbosa-Silva et al. 2005'
      },
      cunningham: {
        id: 'cunningham_1980',
        version: '1.0.0',
        equation: '500 + (22 x massa_magra_kg)',
        reference: 'Cunningham 1980'
      },
      guedes: {
        id: 'guedes_2006',
        version: '1.0.0',
        equation: '426.2 + (14.334 x massa_magra_kg)',
        reference: 'Guedes 2006'
      }
    }
  };
};

const SKINFOLD_FIELD_LABELS = {
  peitoral: 'Peitoral',
  axilar_media: 'Axilar media',
  triceps: 'Triceps',
  subescapular: 'Subescapular',
  abdominal: 'Abdominal',
  suprailiaca: 'Suprailiaca',
  coxa: 'Coxa',
  panturrilha_medial: 'Panturrilha medial',
  biceps: 'Biceps'
};

const SKINFOLD_PROTOCOL_CATALOG = {
  jackson_pollock_3: {
    id: 'jackson_pollock_3',
    version: '1.0.0',
    label: 'Jackson & Pollock 3 dobras',
    reference: 'Jackson AS, Pollock ML. 1978/1980.',
    year: 1978,
    requiredBySex: {
      male: ['peitoral', 'abdominal', 'coxa'],
      female: ['triceps', 'suprailiaca', 'coxa']
    }
  },
  jackson_pollock_7: {
    id: 'jackson_pollock_7',
    version: '1.0.0',
    label: 'Jackson & Pollock 7 dobras',
    reference: 'Jackson AS, Pollock ML. 1978.',
    year: 1978,
    required: ['peitoral', 'axilar_media', 'triceps', 'subescapular', 'abdominal', 'suprailiaca', 'coxa']
  },
  durnin_womersley: {
    id: 'durnin_womersley',
    version: '1.0.0',
    label: 'Durnin & Womersley',
    reference: 'Durnin JVGA, Womersley J. 1974.',
    year: 1974,
    required: ['biceps', 'triceps', 'subescapular', 'suprailiaca']
  },
  guedes_1985: {
    id: 'guedes_1985',
    version: '1.0.0',
    label: 'Guedes (1985)',
    reference: 'Guedes DP. 1985.',
    year: 1985,
    requiredBySex: {
      male: ['abdominal', 'suprailiaca', 'coxa'],
      female: ['triceps', 'suprailiaca', 'coxa']
    }
  },
  petroski_1995: {
    id: 'petroski_1995',
    version: '1.0.0',
    label: 'Petroski (1995)',
    reference: 'Petroski EL. 1995.',
    year: 1995,
    required: ['triceps', 'subescapular', 'suprailiaca', 'panturrilha_medial']
  },
  slaughter_1988: {
    id: 'slaughter_1988',
    version: '1.0.0',
    label: 'Slaughter (pediatrico)',
    reference: 'Slaughter MH et al. 1988.',
    year: 1988,
    required: ['triceps', 'subescapular']
  }
};

const DURNIN_WOMERSLEY_CONSTANTS = {
  male: [
    { min: 17, max: 19, c: 1.162, m: 0.063 },
    { min: 20, max: 29, c: 1.1631, m: 0.0632 },
    { min: 30, max: 39, c: 1.1422, m: 0.0544 },
    { min: 40, max: 49, c: 1.162, m: 0.07 },
    { min: 50, max: 120, c: 1.1715, m: 0.0779 }
  ],
  female: [
    { min: 17, max: 19, c: 1.1549, m: 0.0678 },
    { min: 20, max: 29, c: 1.1599, m: 0.0717 },
    { min: 30, max: 39, c: 1.1423, m: 0.0632 },
    { min: 40, max: 49, c: 1.1333, m: 0.0612 },
    { min: 50, max: 120, c: 1.1339, m: 0.0645 }
  ]
};

const SLAUGHTER_CONSTANTS = {
  male: {
    pre_pubere: 1.7,
    pubere: 2.5,
    pos_pubere: 3.4,
    default: 1.7
  },
  female: {
    pre_pubere: 2.0,
    pubere: 2.7,
    pos_pubere: 3.4,
    default: 2.5
  }
};

const canonicalSkinfoldKey = (key) => String(key || '')
  .trim()
  .toLowerCase()
  .replace(/[\s-]+/g, '_')
  .replace(/axilarmedia/g, 'axilar_media')
  .replace(/axilar_m(?:e|\u00e9)dia/g, 'axilar_media')
  .replace(/suprailiaca/g, 'suprailiaca')
  .replace(/supra_iliaca/g, 'suprailiaca')
  .replace(/panturrilha_medial/g, 'panturrilha_medial');

const normalizeSkinfoldMap = (folds) => {
  const source = folds && typeof folds === 'object' ? folds : {};
  const normalized = {};

  Object.entries(source).forEach(([key, rawValue]) => {
    const mappedKey = canonicalSkinfoldKey(key);
    if (!mappedKey) return;
    const value = toNumber(rawValue);
    if (Number.isFinite(value)) {
      normalized[mappedKey] = value;
    }
  });

  return normalized;
};

const resolveSkinfoldRequiredFields = ({ protocolId, sex }) => {
  const protocol = SKINFOLD_PROTOCOL_CATALOG[protocolId] || SKINFOLD_PROTOCOL_CATALOG.jackson_pollock_7;
  if (Array.isArray(protocol.requiredBySex?.[sex])) return protocol.requiredBySex[sex];
  if (Array.isArray(protocol.required)) return protocol.required;
  return [];
};

const sumFoldFields = (folds, keys = []) => keys.reduce((sum, key) => sum + (toNumber(folds[key]) || 0), 0);

const findDurninConstants = ({ sex, ageYears }) => {
  const rows = DURNIN_WOMERSLEY_CONSTANTS[sex] || [];
  if (!rows.length) return null;
  const age = Number.isFinite(ageYears) ? ageYears : null;
  if (!Number.isFinite(age)) return rows[0];
  return rows.find((row) => age >= row.min && age <= row.max) || rows[rows.length - 1];
};

const calculateProtocolDensityOrFat = ({ protocolId, sex, ageYears, folds, maturationStage }) => {
  const male = sex === 'male';
  const female = sex === 'female';
  const stageKey = String(maturationStage || '').trim().toLowerCase() || 'default';

  switch (protocolId) {
    case 'jackson_pollock_3': {
      if (!male && !female) return null;
      const sum3 = male
        ? sumFoldFields(folds, ['peitoral', 'abdominal', 'coxa'])
        : sumFoldFields(folds, ['triceps', 'suprailiaca', 'coxa']);
      const density = male
        ? 1.10938 - (0.0008267 * sum3) + (0.0000016 * (sum3 ** 2)) - (0.0002574 * ageYears)
        : 1.0994921 - (0.0009929 * sum3) + (0.0000023 * (sum3 ** 2)) - (0.0001392 * ageYears);
      return {
        density,
        sum: sum3,
        equationId: male ? 'jp3_male_density' : 'jp3_female_density',
        equation: male
          ? 'DC = 1.10938 - (0.0008267 x S3) + (0.0000016 x S3^2) - (0.0002574 x idade)'
          : 'DC = 1.0994921 - (0.0009929 x S3) + (0.0000023 x S3^2) - (0.0001392 x idade)'
      };
    }
    case 'jackson_pollock_7': {
      if (!male && !female) return null;
      const sum7 = sumFoldFields(folds, ['peitoral', 'axilar_media', 'triceps', 'subescapular', 'abdominal', 'suprailiaca', 'coxa']);
      const density = male
        ? 1.112 - (0.00043499 * sum7) + (0.00000055 * (sum7 ** 2)) - (0.00028826 * ageYears)
        : 1.097 - (0.00046971 * sum7) + (0.00000056 * (sum7 ** 2)) - (0.00012828 * ageYears);
      return {
        density,
        sum: sum7,
        equationId: male ? 'jp7_male_density' : 'jp7_female_density',
        equation: male
          ? 'DC = 1.112 - (0.00043499 x S7) + (0.00000055 x S7^2) - (0.00028826 x idade)'
          : 'DC = 1.097 - (0.00046971 x S7) + (0.00000056 x S7^2) - (0.00012828 x idade)'
      };
    }
    case 'durnin_womersley': {
      if (!male && !female) return null;
      const sum4 = sumFoldFields(folds, ['biceps', 'triceps', 'subescapular', 'suprailiaca']);
      if (!Number.isFinite(sum4) || sum4 <= 0) return null;
      const constants = findDurninConstants({ sex, ageYears });
      if (!constants) return null;
      const density = constants.c - (constants.m * Math.log10(sum4));
      return {
        density,
        sum: sum4,
        equationId: `${sex}_durnin_womersley_density`,
        equation: `DC = c - (m x log10(S4)) | c=${constants.c}, m=${constants.m}`
      };
    }
    case 'guedes_1985': {
      if (!male && !female) return null;
      const sum3 = male
        ? sumFoldFields(folds, ['abdominal', 'suprailiaca', 'coxa'])
        : sumFoldFields(folds, ['triceps', 'suprailiaca', 'coxa']);
      if (!Number.isFinite(sum3) || sum3 <= 0) return null;
      const density = male
        ? 1.17136 - (0.06706 * Math.log10(sum3))
        : 1.1665 - (0.07063 * Math.log10(sum3));
      return {
        density,
        sum: sum3,
        equationId: male ? 'guedes_1985_male_density' : 'guedes_1985_female_density',
        equation: male
          ? 'DC = 1.17136 - (0.06706 x log10(S3))'
          : 'DC = 1.16650 - (0.07063 x log10(S3))'
      };
    }
    case 'petroski_1995': {
      if (!male && !female) return null;
      const sum4 = sumFoldFields(folds, ['triceps', 'subescapular', 'suprailiaca', 'panturrilha_medial']);
      const density = male
        ? 1.10726863 - (0.00081201 * sum4) + (0.00000212 * (sum4 ** 2)) - (0.00041761 * ageYears)
        : 1.04630485 - (0.00062282 * sum4) + (0.00000207 * (sum4 ** 2)) - (0.00017812 * ageYears);
      return {
        density,
        sum: sum4,
        equationId: male ? 'petroski_1995_male_density' : 'petroski_1995_female_density',
        equation: male
          ? 'DC = 1.10726863 - (0.00081201 x S4) + (0.00000212 x S4^2) - (0.00041761 x idade)'
          : 'DC = 1.04630485 - (0.00062282 x S4) + (0.00000207 x S4^2) - (0.00017812 x idade)'
      };
    }
    case 'slaughter_1988': {
      if (!male && !female) return null;
      const sum2 = sumFoldFields(folds, ['triceps', 'subescapular']);
      const constantsBySex = SLAUGHTER_CONSTANTS[sex] || SLAUGHTER_CONSTANTS.male;
      const stageConstant = constantsBySex[stageKey] ?? constantsBySex.default;

      let directBodyFat = null;
      if (sum2 <= 35) {
        directBodyFat = male
          ? (1.21 * sum2) - (0.008 * (sum2 ** 2)) - stageConstant
          : (1.33 * sum2) - (0.013 * (sum2 ** 2)) - stageConstant;
      } else {
        directBodyFat = male
          ? (0.783 * sum2) + 1.6
          : (0.546 * sum2) + 9.7;
      }

      return {
        density: null,
        sum: sum2,
        directBodyFat,
        equationId: male ? 'slaughter_male_direct_bodyfat' : 'slaughter_female_direct_bodyfat',
        equation: sum2 <= 35
          ? (male
            ? '%G = 1.21 x S2 - 0.008 x S2^2 - constante_maturacao'
            : '%G = 1.33 x S2 - 0.013 x S2^2 - constante_maturacao')
          : (male
            ? '%G = 0.783 x S2 + 1.6'
            : '%G = 0.546 x S2 + 9.7')
      };
    }
    default:
      return null;
  }
};

const classifyBodyFatByLohman = ({ sex, ageYears, percentFat }) => {
  if (!Number.isFinite(percentFat) || !sex) {
    return {
      label: 'Sem classificacao de % gordura',
      tone: 'neutral',
      source: 'Lohman 1992'
    };
  }

  const isAdult = !Number.isFinite(ageYears) || ageYears >= 18;

  if (sex === 'male') {
    if (isAdult) {
      if (percentFat < 6) return { label: 'Muito baixo', tone: 'warning', source: 'Lohman 1992' };
      if (percentFat < 14) return { label: 'Adequado', tone: 'success', source: 'Lohman 1992' };
      if (percentFat < 20) return { label: 'Levemente elevado', tone: 'warning', source: 'Lohman 1992' };
      return { label: 'Elevado', tone: 'danger', source: 'Lohman 1992' };
    }
    if (percentFat < 10) return { label: 'Baixo', tone: 'warning', source: 'Lohman 1992 (pediatrico)' };
    if (percentFat < 20) return { label: 'Adequado', tone: 'success', source: 'Lohman 1992 (pediatrico)' };
    if (percentFat < 25) return { label: 'Atencao', tone: 'warning', source: 'Lohman 1992 (pediatrico)' };
    return { label: 'Elevado', tone: 'danger', source: 'Lohman 1992 (pediatrico)' };
  }

  if (isAdult) {
    if (percentFat < 14) return { label: 'Muito baixo', tone: 'warning', source: 'Lohman 1992' };
    if (percentFat < 23) return { label: 'Adequado', tone: 'success', source: 'Lohman 1992' };
    if (percentFat < 30) return { label: 'Levemente elevado', tone: 'warning', source: 'Lohman 1992' };
    return { label: 'Elevado', tone: 'danger', source: 'Lohman 1992' };
  }
  if (percentFat < 16) return { label: 'Baixo', tone: 'warning', source: 'Lohman 1992 (pediatrico)' };
  if (percentFat < 26) return { label: 'Adequado', tone: 'success', source: 'Lohman 1992 (pediatrico)' };
  if (percentFat < 32) return { label: 'Atencao', tone: 'warning', source: 'Lohman 1992 (pediatrico)' };
  return { label: 'Elevado', tone: 'danger', source: 'Lohman 1992 (pediatrico)' };
};

export const SKINFOLD_PROTOCOLS = Object.values(SKINFOLD_PROTOCOL_CATALOG).map((protocol) => ({
  ...protocol
}));

export const getSkinfoldProtocolRequiredFields = ({ protocolId, sex }) =>
  resolveSkinfoldRequiredFields({ protocolId, sex });

export const calculateSkinfoldEvaluation = (input = {}) => {
  const protocolId = String(input?.protocolId || 'jackson_pollock_7').trim().toLowerCase();
  const protocol = SKINFOLD_PROTOCOL_CATALOG[protocolId] || SKINFOLD_PROTOCOL_CATALOG.jackson_pollock_7;
  const sex = normalizeSex(input?.sex);
  const ageYears = toNumber(input?.ageYears);
  const weightKg = toNumber(input?.weightKg);
  const conversionMethod = String(input?.conversionMethod || 'siri').trim().toLowerCase() === 'brozek'
    ? 'brozek'
    : 'siri';
  const maturationStage = String(input?.maturationStage || 'default').trim().toLowerCase();

  const folds = normalizeSkinfoldMap(input?.folds);
  const requiredFields = resolveSkinfoldRequiredFields({ protocolId: protocol.id, sex });
  const missingRequiredFields = requiredFields.filter((field) => !Number.isFinite(toNumber(folds[field])));

  const foldWarnings = [];
  Object.entries(folds).forEach(([field, value]) => {
    const range = validatePhysiologicalRange({ metric: 'dobras_mm', value });
    if (range.status === 'warning') {
      foldWarnings.push({ field, message: range.message });
    }
  });

  const computed = missingRequiredFields.length
    ? null
    : calculateProtocolDensityOrFat({
      protocolId: protocol.id,
      sex,
      ageYears,
      folds,
      maturationStage
    });

  const density = Number.isFinite(computed?.density) ? computed.density : null;
  const percentFatSiri = Number.isFinite(density)
    ? (495 / density) - 450
    : null;
  const percentFatBrozek = Number.isFinite(density)
    ? ((4.57 / density) - 4.142) * 100
    : null;
  const percentFatDirect = Number.isFinite(computed?.directBodyFat)
    ? computed.directBodyFat
    : null;

  const selectedPercentFat = Number.isFinite(percentFatDirect)
    ? percentFatDirect
    : (conversionMethod === 'brozek' ? percentFatBrozek : percentFatSiri);

  const selectedMethod = Number.isFinite(percentFatDirect)
    ? 'slaughter_direct'
    : conversionMethod;

  const fatMassKg = Number.isFinite(selectedPercentFat) && Number.isFinite(weightKg)
    ? (selectedPercentFat / 100) * weightKg
    : null;
  const leanMassKg = Number.isFinite(fatMassKg) && Number.isFinite(weightKg)
    ? weightKg - fatMassKg
    : null;

  const allMeasuredSum = Object.values(folds)
    .filter((value) => Number.isFinite(value))
    .reduce((sum, value) => sum + value, 0);

  const classification = classifyBodyFatByLohman({
    sex,
    ageYears,
    percentFat: selectedPercentFat
  });

  const radarSeries = Object.entries(SKINFOLD_FIELD_LABELS).map(([field, label]) => ({
    field,
    label,
    value: Number.isFinite(folds[field]) ? folds[field] : null,
    required: requiredFields.includes(field)
  }));

  return {
    protocol: {
      id: protocol.id,
      version: protocol.version,
      label: protocol.label,
      reference: protocol.reference,
      year: protocol.year
    },
    input: {
      sex,
      ageYears,
      weightKg,
      conversionMethod,
      maturationStage,
      folds
    },
    requiredFields,
    missingRequiredFields,
    foldWarnings,
    hasEnoughData: missingRequiredFields.length === 0,
    sums: {
      requiredFolds: Number.isFinite(computed?.sum) ? computed.sum : null,
      allMeasuredFolds: Number.isFinite(allMeasuredSum) ? allMeasuredSum : null
    },
    density,
    percentFat: {
      siri: Number.isFinite(percentFatSiri) ? percentFatSiri : null,
      brozek: Number.isFinite(percentFatBrozek) ? percentFatBrozek : null,
      direct: Number.isFinite(percentFatDirect) ? percentFatDirect : null,
      selected: Number.isFinite(selectedPercentFat) ? selectedPercentFat : null,
      selectedMethod
    },
    bodyComposition: {
      fatMassKg: Number.isFinite(fatMassKg) ? fatMassKg : null,
      leanMassKg: Number.isFinite(leanMassKg) ? leanMassKg : null
    },
    classification,
    formulas: {
      densityEquationId: computed?.equationId || null,
      densityEquation: computed?.equation || null,
      conversionSiri: 'Siri (1956): %G = (495 / DC) - 450',
      conversionBrozek: 'Brozek (1963): %G = (4.57 / DC - 4.142) x 100'
    },
    radarSeries
  };
};

const normalizeEvaluationType = (value) => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/-/g, '_');

const resolveRecordTimestamp = (record) => {
  const date = record?.updatedAt || record?.createdAt || record?.data;
  if (!date) return 0;
  if (date instanceof Date) return Number.isNaN(date.getTime()) ? 0 : date.getTime();
  if (typeof date?.toDate === 'function') {
    const converted = date.toDate();
    return Number.isNaN(converted?.getTime?.()) ? 0 : converted.getTime();
  }
  if (typeof date?.seconds === 'number') {
    return date.seconds * 1000;
  }
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
};

const readPath = (source, path) => String(path || '')
  .split('.')
  .reduce((acc, key) => (acc === null || acc === undefined ? undefined : acc[key]), source);

const pickFirstPath = (source, paths = []) => {
  for (const path of paths) {
    const value = readPath(source, path);
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return value;
    }
  }
  return null;
};

const extractWeightFromRecord = (record) => toNumber(pickFirstPath(record, [
  'dados.peso_kg',
  'dados.pesoKg',
  'dados.peso',
  'dados.weight',
  'dados.dados_brutos.pesoKg',
  'dados.dados_brutos.peso_kg',
  'dados.input.pesoKg',
  'dados.input.peso',
  'resultados.peso',
  'resultados.peso_kg'
]));

const extractHeightFromRecord = (record) => normalizeHeightCm(pickFirstPath(record, [
  'dados.estatura_cm',
  'dados.estaturaCm',
  'dados.estatura',
  'dados.altura',
  'dados.height',
  'dados.dados_brutos.estaturaCm',
  'dados.dados_brutos.estatura_cm',
  'dados.input.estaturaCm',
  'dados.input.estatura',
  'resultados.estatura_cm'
]));

const deriveBodyCompositionFromInputs = ({ percentFat, fatMassKg, leanMassKg, weightKg }) => {
  const initialWeight = toNumber(weightKg);
  const initialFat = toNumber(fatMassKg);
  const initialLean = toNumber(leanMassKg);
  const initialPercent = toNumber(percentFat);

  const resolvedWeight = Number.isFinite(initialWeight)
    ? initialWeight
    : (Number.isFinite(initialFat) && Number.isFinite(initialLean) ? initialFat + initialLean : null);
  const resolvedPercent = Number.isFinite(initialPercent)
    ? initialPercent
    : (Number.isFinite(initialFat) && Number.isFinite(resolvedWeight) && resolvedWeight > 0
      ? (initialFat / resolvedWeight) * 100
      : null);
  const resolvedFatMass = Number.isFinite(initialFat)
    ? initialFat
    : (Number.isFinite(resolvedPercent) && Number.isFinite(resolvedWeight)
      ? (resolvedPercent / 100) * resolvedWeight
      : null);
  const resolvedLeanMass = Number.isFinite(initialLean)
    ? initialLean
    : (Number.isFinite(resolvedWeight) && Number.isFinite(resolvedFatMass)
      ? resolvedWeight - resolvedFatMass
      : null);
  const finalWeight = Number.isFinite(resolvedWeight)
    ? resolvedWeight
    : (Number.isFinite(resolvedFatMass) && Number.isFinite(resolvedLeanMass)
      ? resolvedFatMass + resolvedLeanMass
      : null);

  return {
    percentFat: Number.isFinite(resolvedPercent) ? resolvedPercent : null,
    fatMassKg: Number.isFinite(resolvedFatMass) ? resolvedFatMass : null,
    leanMassKg: Number.isFinite(resolvedLeanMass) ? resolvedLeanMass : null,
    weightKg: Number.isFinite(finalWeight) ? finalWeight : null
  };
};

const buildSourceBase = ({ record, sourceId, label, rank, indicatedFor, reason }) => ({
  sourceId,
  label,
  rank,
  indicatedFor,
  reason,
  recordId: record?.id || null,
  type: normalizeEvaluationType(record?.tipo),
  measuredAt: resolveRecordTimestamp(record),
  sessionId: record?.sessaoId || null
});

const extractDexaSource = (record) => {
  const metrics = deriveBodyCompositionFromInputs({
    percentFat: pickFirstPath(record, [
      'dados.percentual_gordura',
      'dados.resultados_calculados.percentual_gordura',
      'resultados.percentual_gordura',
      'resultados.calculated.percentualGordura'
    ]),
    fatMassKg: pickFirstPath(record, [
      'dados.massa_gorda',
      'dados.resultados_calculados.massa_gorda_kg',
      'resultados.massa_gorda',
      'resultados.calculated.massaGordaKg'
    ]),
    leanMassKg: pickFirstPath(record, [
      'dados.massa_magra',
      'dados.resultados_calculados.massa_magra_kg',
      'resultados.massa_magra',
      'resultados.calculated.massaMagraKg'
    ]),
    weightKg: extractWeightFromRecord(record)
  });

  return {
    ...buildSourceBase({
      record,
      sourceId: 'dexa',
      label: 'DEXA',
      rank: 1,
      indicatedFor: 'Padrao ouro de composicao corporal',
      reason: 'Maior precisao instrumental para % gordura e massa magra.'
    }),
    ...metrics,
    bodyWaterL: toNumber(pickFirstPath(record, [
      'dados.agua_total',
      'resultados.agua_total',
      'resultados.calculated.aguaTotal'
    ])),
    heightCm: extractHeightFromRecord(record),
    protocol: 'dexa'
  };
};

const extractSkinfoldSource = (record) => {
  const metrics = deriveBodyCompositionFromInputs({
    percentFat: pickFirstPath(record, [
      'dados.percentual_gordura',
      'dados.resultados_calculados.percentual_gordura',
      'resultados.percentual_gordura',
      'resultados.calculated.percentualGordura'
    ]),
    fatMassKg: pickFirstPath(record, [
      'dados.massa_gorda',
      'dados.resultados_calculados.massa_gorda_kg',
      'resultados.massa_gorda',
      'resultados.calculated.massaGordaKg'
    ]),
    leanMassKg: pickFirstPath(record, [
      'dados.massa_magra',
      'dados.resultados_calculados.massa_magra_kg',
      'resultados.massa_magra',
      'resultados.calculated.massaMagraKg'
    ]),
    weightKg: extractWeightFromRecord(record)
  });

  return {
    ...buildSourceBase({
      record,
      sourceId: 'dobras_cutaneas',
      label: 'Dobras cutaneas',
      rank: 2,
      indicatedFor: 'Avaliador treinado com protocolo padronizado',
      reason: 'Estimativa valida quando protocolo e tecnica sao consistentes.'
    }),
    ...metrics,
    bodyWaterL: null,
    heightCm: extractHeightFromRecord(record),
    protocol: String(pickFirstPath(record, [
      'dados.protocolo',
      'dados.dados_brutos.protocolo',
      'dados.input.protocolo'
    ]) || 'dobras')
  };
};

const resolveBiaVariant = (record) => {
  const token = String(pickFirstPath(record, [
    'dados.biaType',
    'dados.dados_brutos.biaType',
    'dados.input.biaType'
  ]) || '').trim().toLowerCase();
  if (token.includes('segmentar')) return 'bia_tetrapolar_segmentar';
  if (token.includes('convencional')) return 'bia_tetrapolar_convencional';
  if (token.includes('bipolar')) return 'bia_bipolar';
  return 'bia_tetrapolar_convencional';
};

const extractBiaSource = (record) => {
  const variant = resolveBiaVariant(record);
  const rankByVariant = {
    bia_tetrapolar_segmentar: 3,
    bia_tetrapolar_convencional: 4,
    bia_bipolar: 5
  };
  const labelByVariant = {
    bia_tetrapolar_segmentar: 'BIA tetrapolar segmentar',
    bia_tetrapolar_convencional: 'BIA tetrapolar convencional',
    bia_bipolar: 'BIA bipolar'
  };

  const metrics = deriveBodyCompositionFromInputs({
    percentFat: pickFirstPath(record, [
      'dados.percentual_gordura',
      'dados.dados_brutos.percentFat',
      'dados.resultados_calculados.percentualGordura',
      'resultados.percentual_gordura',
      'resultados.calculated.percentualGordura'
    ]),
    fatMassKg: pickFirstPath(record, [
      'dados.massa_gorda',
      'dados.dados_brutos.fatMassKg',
      'dados.resultados_calculados.fatMassKg',
      'resultados.massa_gorda',
      'resultados.calculated.fatMassKg'
    ]),
    leanMassKg: pickFirstPath(record, [
      'dados.massa_magra',
      'dados.dados_brutos.leanMassKg',
      'dados.resultados_calculados.leanMassKg',
      'resultados.massa_magra',
      'resultados.calculated.leanMassKg'
    ]),
    weightKg: extractWeightFromRecord(record)
  });

  return {
    ...buildSourceBase({
      record,
      sourceId: variant,
      label: labelByVariant[variant],
      rank: rankByVariant[variant],
      indicatedFor: 'Composicao corporal por bioimpedancia',
      reason: variant === 'bia_bipolar'
        ? 'Metodo util para triagem, com menor precisao comparativa.'
        : 'Metodo instrumental de composicao corporal, dependente de padronizacao pre-analitica.'
    }),
    ...metrics,
    bodyWaterL: toNumber(pickFirstPath(record, [
      'dados.agua_total',
      'dados.dados_brutos.tbwL',
      'dados.resultados_calculados.tbwL',
      'resultados.agua_total',
      'resultados.calculated.tbwL'
    ])),
    heightCm: extractHeightFromRecord(record),
    protocol: variant
  };
};

const extractAnthropometricSource = (record) => {
  const rawWeight = extractWeightFromRecord(record);
  const ymcaPercent = readSavedYmcaPercentFat(pickFirstPath(record, [
    'dados.percentual_gordura_ymca',
    'dados.resultados_calculados.percentualGorduraYmca',
    'resultados.percentual_gordura_ymca',
    'resultados.calculated.percentualGorduraYmca'
  ])).value;

  const metrics = deriveBodyCompositionFromInputs({
    percentFat: ymcaPercent,
    fatMassKg: null,
    leanMassKg: null,
    weightKg: rawWeight
  });

  return {
    ...buildSourceBase({
      record,
      sourceId: 'equacao_antropometrica',
      label: 'Equacoes antropometricas',
      rank: 6,
      indicatedFor: 'Fallback quando metodos instrumentais nao estao disponiveis',
      reason: 'Estimativa indireta baseada em perimetros corporais.'
    }),
    ...metrics,
    bodyWaterL: null,
    heightCm: extractHeightFromRecord(record),
    protocol: 'ymca'
  };
};

const hasCompositionData = (source) => Number.isFinite(source?.percentFat)
  || Number.isFinite(source?.fatMassKg)
  || Number.isFinite(source?.leanMassKg);

export const calculateIntegratedBodyComposition = (input = {}) => {
  // Active assessments use only measurements entered in this instrument. The
  // historical integration branch below remains for explicit legacy review.
  if (input?.legacyIntegrationMode !== true) {
    const ageYears = toNumber(input?.ageYears);
    const sex = normalizeSex(input?.sex);
    const weightKg = toNumber(input?.weightKg);
    const heightCm = normalizeHeightCm(input?.heightCm);
    const measured = input?.ownMeasurements || {};
    const percentFat = toNumber(measured.percentFat);
    const fatMassKg = toNumber(measured.fatMassKg);
    const leanMassKg = toNumber(measured.leanMassKg);
    const bodyWaterL = toNumber(measured.bodyWaterL);
    const validPercent = Number.isFinite(percentFat) && percentFat >= 0 && percentFat <= 100 ? percentFat : null;
    const validFatMass = Number.isFinite(fatMassKg) && fatMassKg >= 0
      && (!Number.isFinite(weightKg) || fatMassKg <= weightKg) ? fatMassKg : null;
    const validLeanMass = Number.isFinite(leanMassKg) && leanMassKg >= 0
      && (!Number.isFinite(weightKg) || leanMassKg <= weightKg) ? leanMassKg : null;
    const validBodyWater = Number.isFinite(bodyWaterL) && bodyWaterL >= 0 ? bodyWaterL : null;
    const weightBasedConflict = Number.isFinite(weightKg) && weightKg > 0 && (
      (Number.isFinite(validFatMass) && Number.isFinite(validLeanMass)
        && Math.abs(validFatMass + validLeanMass - weightKg) > 1)
      || (Number.isFinite(validPercent) && Number.isFinite(validFatMass)
        && Math.abs(validFatMass - (validPercent / 100) * weightKg) > 1)
      || (Number.isFinite(validPercent) && Number.isFinite(validLeanMass)
        && Math.abs(validLeanMass - (1 - validPercent / 100) * weightKg) > 1)
    );
    const massBasedConflict = (!Number.isFinite(weightKg) || weightKg <= 0)
      && Number.isFinite(validPercent) && Number.isFinite(validFatMass)
      && Number.isFinite(validLeanMass) && validFatMass + validLeanMass > 0
      && Math.abs(validPercent - 100 * validFatMass / (validFatMass + validLeanMass)) > 1;
    const measurementConflict = weightBasedConflict || massBasedConflict;
    const hasOwnMeasurement = !measurementConflict && (Number.isFinite(validPercent)
      || Number.isFinite(validFatMass)
      || Number.isFinite(validLeanMass));
    const fatMassForDerivation = Number.isFinite(validFatMass)
      ? validFatMass
      : (Number.isFinite(validLeanMass) && Number.isFinite(weightKg) && weightKg > 0
        ? weightKg - validLeanMass
        : null);
    const metrics = deriveBodyCompositionFromInputs({
      percentFat: validPercent,
      fatMassKg: fatMassForDerivation,
      leanMassKg: validLeanMass,
      weightKg: Number.isFinite(weightKg) && weightKg > 0 ? weightKg : null
    });
    const source = hasOwnMeasurement ? {
      sourceId: 'medicao_propria',
      label: 'Medidas desta avaliacao',
      rank: 1,
      percentFat: metrics.percentFat,
      fatMassKg: metrics.fatMassKg,
      leanMassKg: metrics.leanMassKg,
      bodyWaterL: validBodyWater,
      weightKg: metrics.weightKg,
      heightCm,
      measuredAt: null,
      isRecommended: true,
      isOfficial: true,
      deltaVsOfficial: null
    } : null;
    const tmbComparative = calculateTmbComparative({
      weightKg: metrics.weightKg ?? weightKg,
      heightCm,
      ageYears,
      sex,
      fatFreeMassKg: source?.leanMassKg,
      activityLevel: input?.activityLevel,
      activityFactor: input?.activityFactor,
      population: 'tropical'
    });
    const selectedTmb = resolveOfficialTmbSelection({
      comparative: tmbComparative,
      selectedFormulaId: String(input?.selectedFormulaId || '').trim() || tmbComparative.defaultFormulaId
    });
    const activityFactorResolved = Number.isFinite(tmbComparative.profile.activityFactorResolved)
      ? tmbComparative.profile.activityFactorResolved
      : null;
    const getKcal = Number.isFinite(selectedTmb.tmbKcal)
      ? (selectedTmb.type === 'eer'
        ? selectedTmb.tmbKcal
        : (Number.isFinite(activityFactorResolved)
          ? selectedTmb.tmbKcal * activityFactorResolved
          : null))
      : null;

    return {
      sources: source ? [source] : [],
      recommendedSourceId: source?.sourceId || null,
      selectedSourceId: source?.sourceId || null,
      hasOverride: false,
      official: {
        sourceId: source?.sourceId || null,
        sourceLabel: source?.label || null,
        sourceReason: source ? 'Medicao informada neste instrumento.' : null,
        indicatedFor: null,
        percentFat: source?.percentFat ?? null,
        fatMassKg: source?.fatMassKg ?? null,
        leanMassKg: source?.leanMassKg ?? null,
        waterL: source?.bodyWaterL ?? null,
        weightKg: source?.weightKg ?? weightKg ?? null,
        heightCm,
        classification: sex
          ? classifyBodyFatForBia({ sex, ageYears, percentFat: source?.percentFat })
          : { label: 'Sexo nao informado para classificacao', tone: 'neutral', source: 'Cadastro' }
      },
      methodSpreadPp: null,
      hasRelevantMethodSpread: false,
      tmbComparative,
      selectedTmb,
      getKcal: Number.isFinite(getKcal) ? Number(getKcal.toFixed(0)) : null,
      activityFactorResolved,
      formulas: { sourceHierarchy: 'Medidas informadas neste instrumento' }
    };
  }

  const allHistory = Array.isArray(input?.allHistory) ? input.allHistory : [];
  const currentSessionId = String(input?.currentSessionId || '').trim();
  const ageYears = toNumber(input?.ageYears);
  const sex = normalizeSex(input?.sex);
  const fallbackWeightKg = toNumber(input?.weightKg);
  const fallbackHeightCm = normalizeHeightCm(input?.heightCm);
  const selectedSourceId = String(input?.selectedSourceId || '').trim().toLowerCase();
  const selectedFormulaId = String(input?.selectedFormulaId || '').trim();

  const sessionRows = allHistory
    .filter((record) => {
      if (!currentSessionId) return true;
      return String(record?.sessaoId || '').trim() === currentSessionId;
    })
    .sort((a, b) => resolveRecordTimestamp(b) - resolveRecordTimestamp(a));

  const pickLatest = (predicate) => sessionRows.find((row) => predicate(normalizeEvaluationType(row?.tipo), row)) || null;

  const sources = [];

  const dexaRecord = pickLatest((type) => type.includes('dexa') || type.includes('dxa'));
  if (dexaRecord) sources.push(extractDexaSource(dexaRecord));

  const dobrasRecord = pickLatest((type) => type === 'dobras_cutaneas');
  if (dobrasRecord) sources.push(extractSkinfoldSource(dobrasRecord));

  const bioimpRecords = sessionRows.filter((row) => normalizeEvaluationType(row?.tipo) === 'bioimpedancia');
  const latestBioByVariant = {};
  bioimpRecords.forEach((record) => {
    const variant = resolveBiaVariant(record);
    if (!latestBioByVariant[variant]) {
      latestBioByVariant[variant] = record;
    }
  });

  ['bia_tetrapolar_segmentar', 'bia_tetrapolar_convencional', 'bia_bipolar'].forEach((variant) => {
    const record = latestBioByVariant[variant];
    if (record) sources.push(extractBiaSource(record));
  });

  const anthropometricRecord = pickLatest((type) => type === 'perimetros');
  if (anthropometricRecord) sources.push(extractAnthropometricSource(anthropometricRecord));

  const orderedSources = sources
    .filter((source) => hasCompositionData(source))
    .sort((a, b) => a.rank - b.rank);

  const recommended = orderedSources[0] || null;
  const selected = orderedSources.find((source) => source.sourceId === selectedSourceId) || null;
  const officialSource = selected || recommended;

  const officialMetrics = deriveBodyCompositionFromInputs({
    percentFat: officialSource?.percentFat,
    fatMassKg: officialSource?.fatMassKg,
    leanMassKg: officialSource?.leanMassKg,
    weightKg: officialSource?.weightKg ?? fallbackWeightKg
  });

  const officialHeightCm = Number.isFinite(officialSource?.heightCm)
    ? officialSource.heightCm
    : fallbackHeightCm;
  const officialWaterL = Number.isFinite(officialSource?.bodyWaterL)
    ? officialSource.bodyWaterL
    : null;

  const rows = orderedSources.map((source) => ({
    ...source,
    deltaVsOfficial: Number.isFinite(source.percentFat) && Number.isFinite(officialMetrics.percentFat)
      ? source.percentFat - officialMetrics.percentFat
      : null,
    isRecommended: source.sourceId === recommended?.sourceId,
    isOfficial: source.sourceId === officialSource?.sourceId
  }));

  const methodValues = rows
    .map((source) => source.percentFat)
    .filter((value) => Number.isFinite(value));
  const spreadPp = methodValues.length >= 2
    ? Math.max(...methodValues) - Math.min(...methodValues)
    : null;

  const tmbComparative = calculateTmbComparative({
    weightKg: officialMetrics.weightKg ?? fallbackWeightKg,
    heightCm: officialHeightCm ?? fallbackHeightCm,
    ageYears,
    sex,
    fatFreeMassKg: officialMetrics.leanMassKg,
    activityLevel: input?.activityLevel,
    activityFactor: input?.activityFactor,
    population: 'tropical'
  });
  const selectedTmb = resolveOfficialTmbSelection({
    comparative: tmbComparative,
    selectedFormulaId: selectedFormulaId || tmbComparative?.defaultFormulaId
  });

  const activityFactorResolved = Number.isFinite(tmbComparative?.profile?.activityFactorResolved)
    ? tmbComparative.profile.activityFactorResolved
    : null;
  const getKcal = Number.isFinite(selectedTmb?.tmbKcal)
    ? (selectedTmb.type === 'eer'
      ? selectedTmb.tmbKcal
      : (Number.isFinite(activityFactorResolved)
        ? selectedTmb.tmbKcal * activityFactorResolved
        : null))
    : null;

  return {
    sources: rows,
    recommendedSourceId: recommended?.sourceId || null,
    selectedSourceId: officialSource?.sourceId || null,
    hasOverride: Boolean(
      recommended?.sourceId
      && officialSource?.sourceId
      && recommended.sourceId !== officialSource.sourceId
    ),
    official: {
      sourceId: officialSource?.sourceId || null,
      sourceLabel: officialSource?.label || null,
      sourceReason: officialSource?.reason || null,
      indicatedFor: officialSource?.indicatedFor || null,
      percentFat: officialMetrics.percentFat,
      fatMassKg: officialMetrics.fatMassKg,
      leanMassKg: officialMetrics.leanMassKg,
      waterL: officialWaterL,
      weightKg: officialMetrics.weightKg ?? fallbackWeightKg ?? null,
      heightCm: officialHeightCm ?? fallbackHeightCm ?? null,
      classification: classifyBodyFatForBia({
        sex,
        ageYears,
        percentFat: officialMetrics.percentFat
      })
    },
    methodSpreadPp: Number.isFinite(spreadPp) ? spreadPp : null,
    hasRelevantMethodSpread: Number.isFinite(spreadPp) && spreadPp > 3,
    tmbComparative,
    selectedTmb,
    getKcal: Number.isFinite(getKcal) ? Number(getKcal.toFixed(0)) : null,
    activityFactorResolved,
    formulas: {
      sourceHierarchy: 'DEXA > Dobras cutaneas > BIA tetrapolar segmentar > BIA tetrapolar convencional > BIA bipolar > Equacoes antropometricas'
    }
  };
};

export const restoreIntegratedCompositionSnapshot = (snapshot) => {
  if (!snapshot || typeof snapshot !== 'object') return null;
  const dados = snapshot.dados || {};
  const raw = dados.dados_brutos || dados.input || {};
  const calculated = dados.resultados_calculados || snapshot.resultados?.calculated || {};
  const classifications = dados.classificacoes || snapshot.resultados?.output || {};
  const formula = dados.metadados_formula || {};
  const percentFat = toNumber(calculated.percentualGorduraOficial ?? calculated.percentual_gordura_oficial ?? dados.percentual_gordura_oficial ?? snapshot.resultados?.percentual_gordura);
  const fatMassKg = toNumber(calculated.massaGordaOficialKg ?? calculated.massa_gorda_oficial_kg ?? dados.massa_gorda_oficial_kg ?? snapshot.resultados?.massa_gorda_kg);
  const leanMassKg = toNumber(calculated.massaMagraOficialKg ?? calculated.massa_magra_oficial_kg ?? dados.massa_magra_oficial_kg ?? snapshot.resultados?.massa_magra_kg);
  const waterL = toNumber(calculated.aguaCorporalOficialL ?? calculated.agua_corporal_oficial_l ?? dados.agua_corporal_oficial_l ?? snapshot.resultados?.agua_total_l);
  const tmbKcal = toNumber(calculated.tmbSelecionadaKcal ?? calculated.tmb_selecionada_kcal ?? dados.tmb_selecionada_kcal ?? snapshot.resultados?.tmb_kcal);
  const getKcal = toNumber(calculated.getEstimadoKcal ?? calculated.get_estimado_kcal ?? dados.get_estimado_kcal ?? snapshot.resultados?.get_kcal);
  if (![percentFat, fatMassKg, leanMassKg, waterL, tmbKcal, getKcal].some(Number.isFinite)) return null;

  const sourceId = String(dados.fonte_oficial || raw.selectedSourceId || '').trim() || null;
  const sources = (Array.isArray(raw.fontes_disponiveis) ? raw.fontes_disponiveis : []).map((source) => ({
    ...source,
    percentFat: toNumber(source?.percentFat),
    fatMassKg: toNumber(source?.fatMassKg),
    leanMassKg: toNumber(source?.leanMassKg),
    bodyWaterL: toNumber(source?.bodyWaterL),
    deltaVsOfficial: null,
    isOfficial: source?.sourceId === sourceId
  }));
  const sourceLabel = String(classifications.fonte_oficial || sources.find((source) => source.isOfficial)?.label || 'Resultado registrado');
  const formulaId = String(formula.formulaId || snapshot.formulaId || '').trim() || null;
  const formulaVersion = String(formula.formulaVersion || snapshot.formulaVersion || '').trim() || null;
  const formulaLabel = String(formula.formulaLabel || formulaId || '').trim() || null;
  const methodSpreadPp = toNumber(dados.comparacao?.spread_metodos_pp);

  return {
    historicalIntegration: !raw.ownMeasurements,
    sources,
    recommendedSourceId: sources.find((source) => source.isRecommended)?.sourceId || null,
    selectedSourceId: sourceId,
    hasOverride: false,
    official: {
      sourceId,
      sourceLabel,
      sourceReason: 'Resultado preservado do registro salvo.',
      indicatedFor: null,
      percentFat,
      fatMassKg,
      leanMassKg,
      waterL,
      weightKg: toNumber(dados.peso_kg),
      heightCm: normalizeHeightCm(dados.estatura_cm),
      classification: {
        label: String(classifications.percentual_gordura || 'Sem classificacao de % gordura'),
        tone: 'neutral',
        source: String(classifications.referencia || 'Registro salvo')
      }
    },
    methodSpreadPp,
    hasRelevantMethodSpread: Number.isFinite(methodSpreadPp) && methodSpreadPp > 3,
    tmbComparative: { rows: [], defaultFormulaId: formulaId },
    selectedTmb: {
      formulaId,
      formulaVersion,
      tmbKcal,
      selected: formulaLabel ? { label: formulaLabel } : null
    },
    getKcal,
    activityFactorResolved: toNumber(dados.fator_atividade_personalizado),
    formulas: { sourceHierarchy: 'Resultado preservado do registro salvo' }
  };
};

// Total semanal do registro de atividades do GET (WI-013, decisão 4). Só conta
// atividade com duração positiva e gasto calculado. Sem nenhuma, o total é
// null, não 0: um 0 virava PAL real 1,0 e anulava o nível de atividade.
export const sumWeeklyActivityExpenditure = (rows) => {
  if (!Array.isArray(rows)) return null;
  let total = 0;
  let counted = 0;
  rows.forEach((row) => {
    if (!row || typeof row !== 'object') return;
    const durationHours = toNumber(row.duracaoHoras ?? row.duracao_horas);
    const expenditureKcal = toNumber(row.gastoKcal ?? row.gasto_kcal);
    if (!Number.isFinite(durationHours) || durationHours <= 0 || !Number.isFinite(expenditureKcal)) return;
    total += expenditureKcal;
    counted += 1;
  });
  return counted > 0 ? Number(total.toFixed(2)) : null;
};

// PAL real = 1 + gasto semanal / (TMB x 7). Sem total semanal, é null e vale o
// fator do nível de atividade escolhido.
export const calculateWeeklyPal = ({ weeklyActivityKcal, tmbKcal } = {}) => {
  const weekly = toNumber(weeklyActivityKcal);
  const tmb = toNumber(tmbKcal);
  if (!Number.isFinite(weekly) || !Number.isFinite(tmb) || tmb <= 0) return null;
  const pal = 1 + (weekly / (tmb * 7));
  return Number.isFinite(pal) ? Number(pal.toFixed(3)) : null;
};

const GET_ACTIVITY_FACTORS = {
  sedentario: { factor: 1.2, label: 'Sedentario' },
  levemente_ativo: { factor: 1.375, label: 'Levemente ativo' },
  pouco_ativo: { factor: 1.375, label: 'Levemente ativo' },
  moderadamente_ativo: { factor: 1.55, label: 'Moderadamente ativo' },
  ativo: { factor: 1.55, label: 'Moderadamente ativo' },
  muito_ativo: { factor: 1.725, label: 'Muito ativo' },
  extremamente_ativo: { factor: 1.9, label: 'Extremamente ativo' }
};

const resolveGetActivityFactor = ({ activityLevel, customActivityFactor }) => {
  const custom = toNumber(customActivityFactor);
  if (Number.isFinite(custom) && custom >= 0.8 && custom <= 2.5) {
    return {
      factor: custom,
      label: 'Personalizado',
      isCustom: true,
      hasCustomOutOfRange: false
    };
  }

  const token = String(activityLevel || 'sedentario').trim().toLowerCase();
  const preset = GET_ACTIVITY_FACTORS[token] || GET_ACTIVITY_FACTORS.sedentario;
  return {
    factor: preset.factor,
    label: preset.label,
    isCustom: false,
    hasCustomOutOfRange: Number.isFinite(custom) && (custom < 0.8 || custom > 2.5)
  };
};

export const calculateGetEvaluation = (input = {}) => {
  const sex = normalizeSex(input?.sex);
  const comparative = calculateTmbComparative({
    weightKg: input?.weightKg,
    heightCm: input?.heightCm,
    ageYears: input?.ageYears,
    sex,
    population: 'tropical'
  });
  const ownBase = resolveOfficialTmbSelection({ comparative });
  const manualRaw = toNumber(input?.manualTmbKcal);
  const manualTmbKcal = Number.isFinite(manualRaw) && manualRaw > 0 ? manualRaw : null;
  const activityFactor = resolveGetActivityFactor({
    activityLevel: input?.activityLevel,
    customActivityFactor: input?.customActivityFactor
  });

  const tmbUsedKcal = Number.isFinite(manualTmbKcal)
    ? manualTmbKcal
    : ownBase.tmbKcal;
  const formulaId = Number.isFinite(manualTmbKcal) ? 'manual_override' : ownBase.formulaId;
  const formulaVersion = Number.isFinite(manualTmbKcal) ? '1.0.0' : ownBase.formulaVersion;
  const formulaLabel = Number.isFinite(manualTmbKcal) ? 'TMB informada neste instrumento' : (ownBase.selected?.label || null);

  const formulaIsEer = formulaId === 'dri_iom_2005_eer';
  const getKcal = Number.isFinite(tmbUsedKcal)
    ? (formulaIsEer && !Number.isFinite(manualTmbKcal)
      ? tmbUsedKcal
      : tmbUsedKcal * activityFactor.factor)
    : null;

  const maintenanceKcal = Number.isFinite(getKcal) ? getKcal : null;
  const weightLossLightKcal = Number.isFinite(getKcal) ? getKcal - 300 : null;
  const weightLossModerateKcal = Number.isFinite(getKcal) ? getKcal - 500 : null;
  const weightLossIntenseKcal = Number.isFinite(getKcal) ? getKcal - 750 : null;
  const hypertrophyMinKcal = Number.isFinite(getKcal) ? getKcal + 300 : null;
  const hypertrophyMaxKcal = Number.isFinite(getKcal) ? getKcal + 500 : null;

  const intenseMinThreshold = sex === 'female' ? 1200 : sex === 'male' ? 1500 : 1300;
  const hasIntenseLowIntakeRisk = Number.isFinite(weightLossIntenseKcal)
    && weightLossIntenseKcal < intenseMinThreshold;

  const warnings = [];
  if (!Number.isFinite(tmbUsedKcal)) {
    warnings.push('TMB indisponivel. Confira peso, estatura, idade e sexo ou informe a TMB neste instrumento.');
  }
  if (activityFactor.hasCustomOutOfRange) {
    warnings.push('Fator de atividade personalizado fora da faixa 0.8-2.5. Preset aplicado automaticamente.');
  }
  if (formulaIsEer && !Number.isFinite(manualTmbKcal)) {
    warnings.push('Formula DRI/EER ja estima GET diretamente. Fator de atividade nao foi reaplicado.');
  }
  if (hasIntenseLowIntakeRisk) {
    warnings.push(`Emagrecimento intenso abaixo do minimo seguro (${Math.round(intenseMinThreshold)} kcal/dia).`);
  }

  return {
    base: {
      integratedRecordId: null,
      tmbFromIntegratedKcal: null,
      tmbEstimatedKcal: Number.isFinite(ownBase.tmbKcal) ? ownBase.tmbKcal : null,
      manualTmbKcal: Number.isFinite(manualTmbKcal) ? manualTmbKcal : null,
      tmbUsedKcal: Number.isFinite(tmbUsedKcal) ? tmbUsedKcal : null,
      formulaId,
      formulaVersion,
      formulaLabel,
      formulaIsEer,
      sourceLabel: Number.isFinite(manualTmbKcal) ? 'Informada neste instrumento' : 'Perfil cadastral e medidas compartilhadas',
      sourceGetKcal: null
    },
    activity: {
      level: String(input?.activityLevel || 'sedentario').trim().toLowerCase(),
      factorApplied: Number.isFinite(activityFactor.factor) ? Number(activityFactor.factor.toFixed(3)) : null,
      label: activityFactor.label,
      isCustom: activityFactor.isCustom
    },
    results: {
      getKcal: Number.isFinite(getKcal) ? Number(getKcal.toFixed(0)) : null,
      maintenanceKcal: Number.isFinite(maintenanceKcal) ? Number(maintenanceKcal.toFixed(0)) : null,
      weightLossLightKcal: Number.isFinite(weightLossLightKcal) ? Number(weightLossLightKcal.toFixed(0)) : null,
      weightLossModerateKcal: Number.isFinite(weightLossModerateKcal) ? Number(weightLossModerateKcal.toFixed(0)) : null,
      weightLossIntenseKcal: Number.isFinite(weightLossIntenseKcal) ? Number(weightLossIntenseKcal.toFixed(0)) : null,
      hypertrophyMinKcal: Number.isFinite(hypertrophyMinKcal) ? Number(hypertrophyMinKcal.toFixed(0)) : null,
      hypertrophyMaxKcal: Number.isFinite(hypertrophyMaxKcal) ? Number(hypertrophyMaxKcal.toFixed(0)) : null
    },
    safety: {
      intenseMinThreshold: Number.isFinite(intenseMinThreshold) ? intenseMinThreshold : null,
      hasIntenseLowIntakeRisk
    },
    warnings,
    formulas: {
      get: 'GET = TMB x fator_atividade',
      maintenance: 'Manutencao = GET',
      emagrecimentoLeve: 'GET - 300 kcal',
      emagrecimentoModerado: 'GET - 500 kcal',
      emagrecimentoIntenso: 'GET - 750 kcal',
      hipertrofia: 'GET + 300 a 500 kcal'
    }
  };
};

const toLowerToken = (value) => String(value || '').trim().toLowerCase();

const normalizeBooleanLike = (value) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  const token = toLowerToken(value);
  if (!token) return false;
  return ['1', 'true', 'sim', 'yes', 'y', 'on'].includes(token);
};

const toStringList = (value) => {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item || '').trim())
      .filter(Boolean);
  }
  const raw = String(value || '').trim();
  if (!raw) return [];
  return raw
    .split(/[,\n;]+/g)
    .map((item) => item.trim())
    .filter(Boolean);
};

const pushFlag = (flags, {
  id,
  label,
  severity = 'warning',
  source = 'Regra clinica',
  detail = ''
}) => {
  flags.push({
    id,
    label,
    severity,
    source,
    detail
  });
};

const normalizeMedicationList = (value) => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => ({
      name: String(item?.name || item?.nome || '').trim(),
      dose: String(item?.dose || '').trim(),
      frequency: String(item?.frequency || item?.frequencia || '').trim()
    }))
    .filter((item) => item.name);
};

export const calculateAnamneseInitialEvaluation = (input = {}) => {
  const goals = toStringList(input?.goals);
  const pathologies = toStringList(input?.pathologies).map(toLowerToken);
  const medications = normalizeMedicationList(input?.medications);
  const allergies = toStringList(input?.allergies).map(toLowerToken);
  const surgeries = toStringList(input?.surgeries).map(toLowerToken);
  const familyHistory = {
    cardiovascular: normalizeBooleanLike(input?.familyCardiovascular),
    diabetes: normalizeBooleanLike(input?.familyDiabetes),
    cancer: normalizeBooleanLike(input?.familyCancer),
    obesity: normalizeBooleanLike(input?.familyObesity)
  };

  const sleepHours = toNumber(input?.sleepHours);
  const sleepQuality = toNumber(input?.sleepQuality);
  const stressLevel = toNumber(input?.stressLevel);
  const alcoholUse = toLowerToken(input?.alcoholUse);
  const tobaccoUse = toLowerToken(input?.tobaccoUse);
  const activityFrequency = toNumber(input?.activityFrequency);
  const activityDuration = toNumber(input?.activityDuration);
  const activityType = toLowerToken(input?.activityType);
  const menstrualRegularity = toLowerToken(input?.menstrualRegularity);

  const flags = [];
  const referrals = new Set();

  if (pathologies.some((item) => item.includes('diabetes') || item.includes('hiperten') || item.includes('cardio'))) {
    pushFlag(flags, {
      id: 'cardiometabolic_comorbidity',
      label: 'Comorbidade cardiometabolica relatada',
      severity: 'danger',
      source: 'Historico clinico',
      detail: 'Necessita acompanhamento medico conjunto.'
    });
    referrals.add('medico');
  }

  if (pathologies.some((item) => item.includes('transtorno alimentar') || item.includes('compuls'))) {
    pushFlag(flags, {
      id: 'eating_behavior_risk',
      label: 'Risco de comportamento alimentar alterado',
      severity: 'danger',
      source: 'Historico clinico',
      detail: 'Avaliar suporte psicologico especializado.'
    });
    referrals.add('psicologo');
  }

  if (medications.length >= 5) {
    pushFlag(flags, {
      id: 'polypharmacy',
      label: 'Polifarmacia (5 ou mais medicamentos)',
      severity: 'warning',
      source: 'Historico clinico',
      detail: 'Revisar interacoes e horario das refeicoes.'
    });
    referrals.add('medico');
  }

  if (sleepHours !== null && sleepHours < 5) {
    pushFlag(flags, {
      id: 'low_sleep_hours',
      label: 'Privacao de sono',
      severity: 'warning',
      source: 'Estilo de vida',
      detail: 'Sono < 5h/noite.'
    });
  } else if (sleepHours !== null && sleepHours < 6) {
    pushFlag(flags, {
      id: 'borderline_sleep_hours',
      label: 'Sono insuficiente',
      severity: 'warning',
      source: 'Estilo de vida',
      detail: 'Sono entre 5h e 6h/noite.'
    });
  }

  if (sleepQuality !== null && sleepQuality <= 2) {
    pushFlag(flags, {
      id: 'poor_sleep_quality',
      label: 'Qualidade de sono ruim',
      severity: 'warning',
      source: 'Estilo de vida',
      detail: 'Percepcao de sono baixa.'
    });
  }

  if (stressLevel !== null && stressLevel >= 8) {
    pushFlag(flags, {
      id: 'high_stress',
      label: 'Estresse elevado',
      severity: 'danger',
      source: 'Estilo de vida',
      detail: 'Escala de estresse >= 8.'
    });
    referrals.add('psicologo');
  } else if (stressLevel !== null && stressLevel >= 6) {
    pushFlag(flags, {
      id: 'moderate_stress',
      label: 'Estresse moderado',
      severity: 'warning',
      source: 'Estilo de vida',
      detail: 'Escala de estresse entre 6 e 7.'
    });
  }

  if (tobaccoUse.includes('sim') || tobaccoUse.includes('uso') || tobaccoUse.includes('diario')) {
    pushFlag(flags, {
      id: 'tobacco_use',
      label: 'Uso de tabaco',
      severity: 'danger',
      source: 'Estilo de vida',
      detail: 'Eleva risco cardiometabolico e inflamatorio.'
    });
    referrals.add('medico');
  }

  if (alcoholUse.includes('alto') || alcoholUse.includes('diario') || alcoholUse.includes('frequente')) {
    pushFlag(flags, {
      id: 'high_alcohol_use',
      label: 'Consumo elevado de alcool',
      severity: 'warning',
      source: 'Estilo de vida',
      detail: 'Pode impactar composicao corporal e adesao.'
    });
  }

  const lowActivity = (
    (activityFrequency !== null && activityFrequency <= 1)
    || (activityDuration !== null && activityDuration < 30)
    || (!activityType && activityFrequency === null && activityDuration === null)
  );
  if (lowActivity) {
    pushFlag(flags, {
      id: 'low_activity_level',
      label: 'Nivel de atividade fisica baixo',
      severity: 'warning',
      source: 'Estilo de vida',
      detail: 'Abaixo do recomendado para saude geral.'
    });
    referrals.add('fisioterapeuta');
  }

  if (menstrualRegularity === 'irregular') {
    pushFlag(flags, {
      id: 'irregular_cycle',
      label: 'Ciclo menstrual irregular',
      severity: 'warning',
      source: 'Estilo de vida',
      detail: 'Monitorar impacto hormonal e sintomas associados.'
    });
    referrals.add('medico');
  }

  if (familyHistory.cardiovascular || familyHistory.diabetes || familyHistory.cancer || familyHistory.obesity) {
    pushFlag(flags, {
      id: 'family_history_risk',
      label: 'Historico familiar relevante',
      severity: 'warning',
      source: 'Historico familiar',
      detail: 'Presenca de risco em parentes de 1 grau.'
    });
  }

  if (allergies.some((item) => item.includes('anafil') || item.includes('severa'))) {
    pushFlag(flags, {
      id: 'severe_allergy',
      label: 'Alergia/intolerancia grave relatada',
      severity: 'danger',
      source: 'Historico clinico',
      detail: 'Requer plano alimentar com controle rigoroso.'
    });
    referrals.add('medico');
  }

  if (surgeries.some((item) => item.includes('bariatr') || item.includes('gastropl'))) {
    pushFlag(flags, {
      id: 'bariatric_history',
      label: 'Historico de cirurgia bariatrica',
      severity: 'warning',
      source: 'Historico clinico',
      detail: 'Monitorar risco nutricional e suplementacao.'
    });
    referrals.add('medico');
  }

  if (goals.includes('reabilitacao')) {
    referrals.add('fisioterapeuta');
  }
  if (goals.includes('gestacao')) {
    referrals.add('medico');
  }

  const score = flags.reduce((sum, flag) => sum + (flag.severity === 'danger' ? 2 : 1), 0);
  const priority = score >= 6
    ? 'alta'
    : score >= 3
      ? 'moderada'
      : 'baixa';

  const priorityReason = priority === 'alta'
    ? 'Multiplos fatores de risco clinicos ou comportamentais relevantes.'
    : priority === 'moderada'
      ? 'Existe pelo menos um fator de risco que exige monitoramento proximo.'
      : 'Sem sinais de risco imediato; manter acompanhamento de rotina.';

  const recommendations = Array.from(referrals);

  return {
    normalized: {
      goals,
      pathologies,
      medications,
      allergies,
      surgeries,
      familyHistory,
      sleepHours,
      sleepQuality,
      stressLevel,
      alcoholUse,
      tobaccoUse,
      activityFrequency,
      activityDuration,
      activityType,
      menstrualRegularity
    },
    flags,
    score,
    priority: {
      level: priority,
      reason: priorityReason
    },
    recommendations,
    formulas: {
      riskScoring: 'danger=2 pontos, warning=1 ponto',
      priorityBands: 'baixa: 0-2 | moderada: 3-5 | alta: >=6'
    }
  };
};

const normalizeClinicalGlucoseContext = (value) => {
  const token = toLowerToken(value);
  if (!token) return 'nao_informado';
  if (token.includes('jejum')) return 'jejum';
  if (token.includes('pos') || token.includes('pprand')) return 'pos_prandial';
  return 'nao_informado';
};

const normalizeEdemaGrade = (value) => {
  const numeric = toNumber(value);
  if (!Number.isFinite(numeric)) return null;
  const grade = Math.round(numeric);
  return Math.min(4, Math.max(0, grade));
};

const classifyBloodPressureForClinical = ({ systolic, diastolic }) => {
  if (!Number.isFinite(systolic) || !Number.isFinite(diastolic)) {
    return {
      label: 'Sem classificacao',
      tone: 'neutral',
      stage: 'nao_classificado',
      source: '7a Diretriz Brasileira de HAS (2016)',
      interpretation: 'Preencha pressao sistolica e diastolica para classificar.'
    };
  }

  if (systolic >= 180 || diastolic >= 110) {
    return {
      label: 'HAS estagio 3',
      tone: 'danger',
      stage: 'has_estagio_3',
      source: '7a Diretriz Brasileira de HAS (2016)',
      interpretation: 'Pressao arterial em faixa critica.'
    };
  }

  if (systolic >= 160 || diastolic >= 100) {
    return {
      label: 'HAS estagio 2',
      tone: 'danger',
      stage: 'has_estagio_2',
      source: '7a Diretriz Brasileira de HAS (2016)',
      interpretation: 'Pressao arterial elevada, com risco aumentado.'
    };
  }

  if (systolic >= 140 || diastolic >= 90) {
    if (systolic >= 140 && diastolic < 90) {
      return {
        label: 'HAS sistolica isolada',
        tone: 'warning',
        stage: 'has_sistolica_isolada',
        source: '7a Diretriz Brasileira de HAS (2016)',
        interpretation: 'Sistolica elevada com diastolica < 90 mmHg.'
      };
    }
    return {
      label: 'HAS estagio 1',
      tone: 'warning',
      stage: 'has_estagio_1',
      source: '7a Diretriz Brasileira de HAS (2016)',
      interpretation: 'Pressao arterial acima da faixa normal.'
    };
  }

  if ((systolic >= 130 && systolic <= 139) || (diastolic >= 85 && diastolic <= 89)) {
    return {
      label: 'Limitrofe',
      tone: 'warning',
      stage: 'limitrofe',
      source: '7a Diretriz Brasileira de HAS (2016)',
      interpretation: 'Faixa limitrofe, monitorar evolucao.'
    };
  }

  if ((systolic >= 120 && systolic <= 129) || (diastolic >= 80 && diastolic <= 84)) {
    return {
      label: 'Normal',
      tone: 'success',
      stage: 'normal',
      source: '7a Diretriz Brasileira de HAS (2016)',
      interpretation: 'Pressao em faixa adequada para adultos.'
    };
  }

  if (systolic < 120 && diastolic < 80) {
    return {
      label: 'Otima',
      tone: 'success',
      stage: 'otima',
      source: '7a Diretriz Brasileira de HAS (2016)',
      interpretation: 'Pressao arterial dentro da melhor faixa.'
    };
  }

  return {
    label: 'Sem classificacao',
    tone: 'neutral',
    stage: 'nao_classificado',
    source: '7a Diretriz Brasileira de HAS (2016)',
    interpretation: 'Nao foi possivel classificar a pressao arterial.'
  };
};

const classifyHeartRateForClinical = ({ heartRate }) => {
  if (!Number.isFinite(heartRate)) {
    return {
      label: 'Sem classificacao',
      tone: 'neutral',
      source: 'Triagem clinica de sinais vitais'
    };
  }

  if (heartRate < 40 || heartRate > 120) {
    return {
      label: 'Critica',
      tone: 'danger',
      source: 'Triagem clinica de sinais vitais'
    };
  }

  if (heartRate < 60) {
    return {
      label: 'Bradicardia leve',
      tone: 'warning',
      source: 'Triagem clinica de sinais vitais'
    };
  }

  if (heartRate > 100) {
    return {
      label: 'Taquicardia leve',
      tone: 'warning',
      source: 'Triagem clinica de sinais vitais'
    };
  }

  return {
    label: 'Esperada',
    tone: 'success',
    source: 'Triagem clinica de sinais vitais'
  };
};

const classifyGlucoseForClinical = ({ glucoseMgDl, context }) => {
  if (!Number.isFinite(glucoseMgDl)) {
    return {
      label: 'Sem classificacao',
      tone: 'neutral',
      source: 'Referencia glicemica clinica'
    };
  }

  if (glucoseMgDl < 70) {
    return {
      label: 'Baixa (hipoglicemia)',
      tone: 'danger',
      source: 'Referencia glicemica clinica'
    };
  }

  if (context === 'jejum') {
    if (glucoseMgDl <= 99) {
      return {
        label: 'Jejum esperado',
        tone: 'success',
        source: 'Consenso ADA/SBD'
      };
    }
    if (glucoseMgDl <= 125) {
      return {
        label: 'Jejum alterado',
        tone: 'warning',
        source: 'Consenso ADA/SBD'
      };
    }
    return {
      label: 'Elevada no jejum',
      tone: 'danger',
      source: 'Consenso ADA/SBD'
    };
  }

  if (glucoseMgDl <= 140) {
    return {
      label: 'Pos-prandial esperada',
      tone: 'success',
      source: 'Consenso ADA/SBD'
    };
  }
  if (glucoseMgDl < 200) {
    return {
      label: 'Pos-prandial elevada',
      tone: 'warning',
      source: 'Consenso ADA/SBD'
    };
  }
  return {
    label: 'Hiperglicemia relevante',
    tone: 'danger',
    source: 'Consenso ADA/SBD'
  };
};

const classifyEdemaForClinical = ({ edemaGrade }) => {
  if (!Number.isFinite(edemaGrade)) {
    return {
      label: 'Sem classificacao',
      tone: 'neutral',
      source: 'Semiologia clinica'
    };
  }

  if (edemaGrade <= 0) {
    return {
      label: 'Sem edema',
      tone: 'success',
      source: 'Semiologia clinica'
    };
  }

  if (edemaGrade === 1) {
    return {
      label: 'Edema leve (1+)',
      tone: 'warning',
      source: 'Semiologia clinica'
    };
  }

  if (edemaGrade === 2) {
    return {
      label: 'Edema moderado (2+)',
      tone: 'warning',
      source: 'Semiologia clinica'
    };
  }

  return {
    label: `Edema importante (${edemaGrade}+)`,
    tone: 'warning',
    source: 'Semiologia clinica'
  };
};

export const calculateClinicalEvaluation = (input = {}) => {
  const systolic = toNumber(input?.systolic);
  const diastolic = toNumber(input?.diastolic);
  const heartRate = toNumber(input?.heartRate);
  const temperatureC = toNumber(input?.temperatureC);
  const glucoseMgDl = toNumber(input?.glucoseMgDl);
  const glucoseContext = normalizeClinicalGlucoseContext(input?.glucoseContext);
  const edemaLocation = String(input?.edemaLocation || '').trim();
  const edemaGrade = normalizeEdemaGrade(input?.edemaGrade);
  const clinicalSigns = toStringList(input?.clinicalSigns);

  const meanArterialPressure = Number.isFinite(systolic) && Number.isFinite(diastolic)
    ? ((systolic + (2 * diastolic)) / 3)
    : null;
  const pulsePressure = Number.isFinite(systolic) && Number.isFinite(diastolic)
    ? (systolic - diastolic)
    : null;

  const bloodPressure = classifyBloodPressureForClinical({ systolic, diastolic });
  const heartRateClass = classifyHeartRateForClinical({ heartRate });
  const glucose = classifyGlucoseForClinical({ glucoseMgDl, context: glucoseContext });
  const edema = classifyEdemaForClinical({ edemaGrade });

  const redFlags = [];

  if (Number.isFinite(systolic) && Number.isFinite(diastolic) && (systolic >= 180 || diastolic >= 110)) {
    pushFlag(redFlags, {
      id: 'critical_bp',
      label: 'PA critica (>= 180/110 mmHg)',
      severity: 'danger',
      source: '7a Diretriz Brasileira de HAS (2016)',
      detail: 'Encaminhamento medico imediato.'
    });
  }

  if (Number.isFinite(glucoseMgDl) && glucoseContext === 'jejum' && glucoseMgDl > 200) {
    pushFlag(redFlags, {
      id: 'critical_glucose_fasting',
      label: 'Glicemia em jejum > 200 mg/dL',
      severity: 'danger',
      source: 'Consenso ADA/SBD',
      detail: 'Encaminhamento medico imediato.'
    });
  }

  if (Number.isFinite(heartRate) && (heartRate < 40 || heartRate > 120)) {
    pushFlag(redFlags, {
      id: 'critical_heart_rate',
      label: 'Frequencia cardiaca critica (< 40 ou > 120 bpm)',
      severity: 'danger',
      source: 'Triagem clinica de sinais vitais',
      detail: 'Reavaliar sinais vitais e considerar encaminhamento.'
    });
  }

  if (Number.isFinite(edemaGrade) && edemaGrade >= 3) {
    pushFlag(redFlags, {
      id: 'important_edema',
      label: `Edema grau ${edemaGrade}+`,
      severity: 'warning',
      source: 'Semiologia clinica',
      detail: 'Investigar causa e acompanhar evolucao.'
    });
  }

  const warnings = [];
  if (!Number.isFinite(systolic) || !Number.isFinite(diastolic)) {
    warnings.push('Pressao arterial incompleta para classificacao automatica.');
  }
  if (Number.isFinite(glucoseMgDl) && glucoseContext === 'nao_informado') {
    warnings.push('Informe o contexto da glicemia (jejum/pos-prandial) para melhor interpretacao.');
  }
  if (Number.isFinite(temperatureC) && (temperatureC < 35 || temperatureC > 38.5)) {
    warnings.push('Temperatura fora da faixa habitual. Verifique o dado e contexto clinico.');
  }

  const hasCriticalFlag = redFlags.some((flag) => flag.severity === 'danger');
  const hasWarningFlag = redFlags.some((flag) => flag.severity === 'warning');
  const hasRiskClass = [bloodPressure, heartRateClass, glucose]
    .some((item) => item?.tone === 'danger' || item?.tone === 'warning');

  const carePriority = hasCriticalFlag
    ? 'alta'
    : (hasWarningFlag || hasRiskClass)
      ? 'moderada'
      : 'baixa';

  const careReason = carePriority === 'alta'
    ? 'Ha sinal vital critico ou alerta clinico de encaminhamento imediato.'
    : carePriority === 'moderada'
      ? 'Existem alteracoes que exigem acompanhamento clinico mais proximo.'
      : 'Sem alertas clinicos relevantes na triagem atual.';

  const referrals = new Set();
  if (hasCriticalFlag || bloodPressure.tone === 'danger' || glucose.tone === 'danger' || heartRateClass.tone === 'danger') {
    referrals.add('medico');
  }

  return {
    inputNormalized: {
      systolic,
      diastolic,
      heartRate,
      temperatureC,
      glucoseMgDl,
      glucoseContext,
      edemaLocation,
      edemaGrade,
      clinicalSigns
    },
    derived: {
      meanArterialPressure: Number.isFinite(meanArterialPressure)
        ? Number(meanArterialPressure.toFixed(1))
        : null,
      pulsePressure: Number.isFinite(pulsePressure)
        ? Number(pulsePressure.toFixed(1))
        : null
    },
    classifications: {
      bloodPressure,
      heartRate: heartRateClass,
      glucose,
      edema
    },
    redFlags,
    warnings,
    summary: {
      redFlagsCount: redFlags.length,
      carePriority: {
        level: carePriority,
        reason: careReason
      },
      referrals: Array.from(referrals)
    },
    formulas: {
      bloodPressure: '7a Diretriz Brasileira de HAS (2016)',
      meanArterialPressure: 'PAM = (PAS + 2 x PAD) / 3',
      pulsePressure: 'Pressao de pulso = PAS - PAD',
      redFlags: 'PA >= 180/110 | Glicemia jejum > 200 | FC < 40 ou > 120 | Edema >= 3+'
    }
  };
};

const clampPercent = (value) => Math.max(0, Math.min(100, value));

const normalizeIsoDate = (value) => {
  const raw = String(value || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const parsed = new Date(value || Date.now());
  if (Number.isNaN(parsed.getTime())) return new Date().toISOString().slice(0, 10);
  return parsed.toISOString().slice(0, 10);
};

const classifyLabValue = ({ value, referenceMin, referenceMax }) => {
  if (!Number.isFinite(value)) return 'sem_dado';

  if (Number.isFinite(referenceMin) && value < referenceMin) return 'alterado';
  if (Number.isFinite(referenceMax) && value > referenceMax) return 'alterado';

  if (Number.isFinite(referenceMin) && Number.isFinite(referenceMax) && referenceMax > referenceMin) {
    const span = referenceMax - referenceMin;
    const margin = span * 0.05;
    if (value <= referenceMin + margin || value >= referenceMax - margin) return 'limitrofe';
    return 'normal';
  }

  if (Number.isFinite(referenceMin) || Number.isFinite(referenceMax)) {
    return 'normal';
  }
  return 'sem_referencia';
};

// Tom do aviso de conduta dos Exames a partir do status real do painel
// (WI-013, decisão 2): alterado é no mínimo atenção, e risco quando o escore
// já indica (>= 70); limítrofe é atenção; normal é ok; sem classificação é
// "sem dados", nunca "consistente".
export const resolveLaboratoryConductTone = ({ statusPainel, scoreRisco } = {}) => {
  const token = String(statusPainel || '').trim().toLowerCase();
  const score = toNumber(scoreRisco);
  if (token === 'alterado') return Number.isFinite(score) && score >= 70 ? 'risk' : 'warn';
  if (token === 'limitrofe') return 'warn';
  if (token === 'normal') return 'ok';
  return 'sem_dados';
};

export const calculateLaboratoryEvaluation = (input = {}) => {
  const panel = String(input?.painel || 'geral').trim().toLowerCase() || 'geral';
  const baseDate = normalizeIsoDate(input?.dataAvaliacao);
  const rawAnalitos = Array.isArray(input?.analitos) ? input.analitos : [];
  const previousAnalitos = Array.isArray(input?.previousAnalitos) ? input.previousAnalitos : [];
  const previousByName = previousAnalitos.reduce((acc, item) => {
    const key = String(item?.nome || item?.analito || '').trim().toLowerCase();
    const value = toNumber(item?.valor ?? item?.value);
    if (key && Number.isFinite(value)) acc[key] = value;
    return acc;
  }, {});

  const normalizedAnalitos = rawAnalitos
    .map((item, index) => {
      const nome = String(item?.nome || item?.analito || '').trim();
      if (!nome) return null;
      const valor = toNumber(item?.valor ?? item?.value ?? item?.resultado);
      const unidade = String(item?.unidade || item?.unit || '').trim();
      const referenceMin = toNumber(item?.referenciaMin ?? item?.refMin ?? item?.valorRefMin);
      const referenceMax = toNumber(item?.referenciaMax ?? item?.refMax ?? item?.valorRefMax);
      const dataColeta = normalizeIsoDate(item?.dataColeta || item?.data || baseDate);
      const laboratorio = String(item?.laboratorio || item?.lab || '').trim();
      const status = classifyLabValue({ value: valor, referenceMin, referenceMax });

      const previousValue = previousByName[nome.toLowerCase()];
      const deltaAbs = Number.isFinite(valor) && Number.isFinite(previousValue)
        ? valor - previousValue
        : null;
      const deltaPct = Number.isFinite(deltaAbs) && Number.isFinite(previousValue) && previousValue !== 0
        ? (deltaAbs / previousValue) * 100
        : null;

      return {
        id: String(item?.id || `${Date.now()}-${index}`),
        nome,
        valor: Number.isFinite(valor) ? Number(valor.toFixed(4)) : null,
        unidade: unidade || null,
        referenciaMin: Number.isFinite(referenceMin) ? Number(referenceMin.toFixed(4)) : null,
        referenciaMax: Number.isFinite(referenceMax) ? Number(referenceMax.toFixed(4)) : null,
        dataColeta,
        laboratorio: laboratorio || null,
        status,
        variacao: {
          deltaAbs: Number.isFinite(deltaAbs) ? Number(deltaAbs.toFixed(4)) : null,
          deltaPct: Number.isFinite(deltaPct) ? Number(deltaPct.toFixed(2)) : null
        }
      };
    })
    .filter(Boolean);

  const alteracoesCount = normalizedAnalitos.filter((item) => item.status === 'alterado').length;
  const limitesCount = normalizedAnalitos.filter((item) => item.status === 'limitrofe').length;
  const normaisCount = normalizedAnalitos.filter((item) => item.status === 'normal').length;
  const semReferenciaCount = normalizedAnalitos.filter((item) => item.status === 'sem_referencia').length;

  const statusPainel = alteracoesCount > 0
    ? 'alterado'
    : limitesCount > 0
      ? 'limitrofe'
      : normaisCount > 0
        ? 'normal'
        : 'sem_classificacao';

  const scoreRisco = clampPercent(((alteracoesCount * 2) + limitesCount) * 10);
  const statusPorAnalito = normalizedAnalitos.reduce((acc, item) => {
    acc[item.nome] = item.status;
    return acc;
  }, {});

  const warnings = [];
  if (!normalizedAnalitos.length) {
    warnings.push('Nenhum analito informado para classificacao.');
  }
  if (semReferenciaCount > 0) {
    warnings.push(`${semReferenciaCount} analito(s) sem faixa de referencia.`);
  }

  return {
    inputNormalized: {
      painel: panel,
      dataAvaliacao: baseDate,
      analitos: normalizedAnalitos
    },
    calculated: {
      alteracoesCount,
      limitesCount,
      normaisCount,
      semReferenciaCount,
      scoreRisco,
      variacoes: normalizedAnalitos.map((item) => ({
        nome: item.nome,
        deltaAbs: item.variacao.deltaAbs,
        deltaPct: item.variacao.deltaPct
      }))
    },
    classifications: {
      statusPainel,
      statusPorAnalito
    },
    warnings,
    formulas: {
      rangeClassification: 'normal: dentro da referencia | limitrofe: faixa de 5% nas bordas | alterado: fora da referencia',
      scoreRisco: 'score = ((alterados x 2) + limitrofes) x 10, limitado em 0-100'
    }
  };
};

export const calculateEvolutionReturnEvaluation = (input = {}) => {
  const adesaoPlanoAlimentar = toNumber(input?.adesaoPlanoAlimentar);
  const adesaoAtividadeFisica = toNumber(input?.adesaoAtividadeFisica);
  const respostaPercebida = toNumber(input?.respostaPercebida);
  const intercorrencias = String(input?.intercorrencias || '').trim();
  const sintomas = String(input?.sintomas || '').trim();
  const conduta = String(input?.conduta || '').trim();
  const proximaAvaliacao = normalizeIsoDate(input?.proximaAvaliacao || input?.dataAvaliacao);

  const objectives = Array.isArray(input?.objetivos)
    ? input.objetivos.map((item) => String(item || '').trim()).filter(Boolean)
    : [];

  const planWeight = toNumber(input?.weights?.adesaoPlanoAlimentar) ?? 0.5;
  const activityWeight = toNumber(input?.weights?.adesaoAtividadeFisica) ?? 0.35;
  const perceivedWeight = toNumber(input?.weights?.respostaPercebida) ?? 0.15;

  const normalizedPlan = Number.isFinite(adesaoPlanoAlimentar) ? clampPercent(adesaoPlanoAlimentar) : null;
  const normalizedActivity = Number.isFinite(adesaoAtividadeFisica) ? clampPercent(adesaoAtividadeFisica) : null;
  const normalizedPerceived = Number.isFinite(respostaPercebida)
    ? clampPercent(((respostaPercebida - 1) / 4) * 100)
    : null;

  // WI-013, decisão 3: componente ausente sai do cálculo e os pesos se
  // redistribuem entre os presentes. Sem nenhum, escore e prioridade são null.
  const presentComponents = [
    { value: normalizedPlan, weight: planWeight },
    { value: normalizedActivity, weight: activityWeight },
    { value: normalizedPerceived, weight: perceivedWeight }
  ].filter((item) => Number.isFinite(item.value) && Number.isFinite(item.weight) && item.weight > 0);
  const presentWeight = presentComponents.reduce((sum, item) => sum + item.weight, 0);

  const scoreAdesaoGeral = presentWeight > 0
    ? Number((presentComponents.reduce((sum, item) => sum + (item.value * item.weight), 0) / presentWeight).toFixed(2))
    : null;
  const hasClinicalSignal = intercorrencias.length >= 15 || sintomas.length >= 15;

  const prioridadeRetorno = !Number.isFinite(scoreAdesaoGeral)
    ? null
    : scoreAdesaoGeral < 50 || hasClinicalSignal
      ? 'alta'
      : scoreAdesaoGeral < 75
        ? 'moderada'
        : 'baixa';

  const semComponenteMensagem = 'Informe adesao alimentar e/ou adesao de atividade fisica para calcular score.';
  const resumoObjetivos = (objectives.length ? objectives : ['Plano atual']).map((objetivo) => ({
    objetivo,
    status: !Number.isFinite(scoreAdesaoGeral)
      ? 'sem_classificacao'
      : scoreAdesaoGeral >= 75 ? 'melhora' : scoreAdesaoGeral >= 50 ? 'estavel' : 'piora',
    justificativa: !prioridadeRetorno
      ? semComponenteMensagem
      : prioridadeRetorno === 'alta'
        ? 'Baixa adesao global ou intercorrencias relevantes.'
        : prioridadeRetorno === 'moderada'
          ? 'Adesao parcial, manter ajustes progressivos.'
          : 'Boa adesao e resposta global favoravel.'
  }));

  const warnings = [];
  if (!Number.isFinite(adesaoPlanoAlimentar) && !Number.isFinite(adesaoAtividadeFisica)) {
    warnings.push(semComponenteMensagem);
  }
  if (!Number.isFinite(respostaPercebida)) {
    warnings.push('Resposta percebida nao informada. Score calculado sem esse componente.');
  }

  return {
    inputNormalized: {
      adesaoPlanoAlimentar: Number.isFinite(adesaoPlanoAlimentar) ? normalizedPlan : null,
      adesaoAtividadeFisica: Number.isFinite(adesaoAtividadeFisica) ? normalizedActivity : null,
      respostaPercebida: Number.isFinite(respostaPercebida) ? respostaPercebida : null,
      intercorrencias: intercorrencias || null,
      sintomas: sintomas || null,
      conduta: conduta || null,
      proximaAvaliacao,
      objetivos: objectives
    },
    calculated: {
      scoreAdesaoGeral,
      resumoObjetivos
    },
    classifications: {
      prioridadeRetorno
    },
    warnings,
    formulas: {
      scoreAdesaoGeral: 'media ponderada de adesao alimentar, atividade fisica e resposta percebida; componente ausente sai e os pesos se redistribuem',
      prioridadeRetorno: 'alta: score < 50 ou intercorrencias/sintomas relevantes | moderada: 50-74 | baixa: >=75'
    }
  };
};
