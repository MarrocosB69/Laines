const normalizeToken = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[\s-]+/g, '_');

export const EVALUATION_REGISTRY = Object.freeze([
  // ── Etapa 1: Triagem ─────────────────────────────────────────────────────
  {
    type: 'anamnese_inicial',
    moduleId: 'anamnese-inicial',
    label: 'Anamnese inicial',
    shortLabel: 'Anamnese inicial',
    groupLabel: 'Triagem',
    macroStageId: 'triagem',
    macroStageLabel: 'Triagem',
    description: 'Contexto inicial clinico e objetivos do paciente',
    domain: 'anamnese',
    iconKey: 'clipboard_list',
    cursos: [],
    schemaVersion: 1,
    formulaIds: ['anamnese_risk_rules_v1'],
    requiredFields: ['nomePaciente', 'sexoBiologico', 'objetivos', 'scoreRisco', 'prioridade'],
    ordem: 1,
    supportsLongitudinalComparison: false,
    analyticsColor: 'progress-gradient-cyan',
    contexts: { avaliacaoCompleta: true, prontuario: true, analytics: true }
  },
  {
    type: 'avaliacao_clinica',
    moduleId: 'avaliacao-clinica',
    label: 'Avaliação clínica',
    shortLabel: 'Avaliacao clinica',
    groupLabel: 'Triagem',
    macroStageId: 'triagem',
    macroStageLabel: 'Triagem',
    description: 'Sinais vitais, red flags e classificacao automatica de risco',
    domain: 'clinica',
    iconKey: 'heart',
    cursos: ['nutricao'],
    schemaVersion: 1,
    formulaIds: ['avaliacao_clinica_has_2016_redflags_v1'],
    requiredFields: ['pressaoSistolica', 'pressaoDiastolica', 'frequenciaCardiaca', 'prioridadeCuidado'],
    ordem: 2,
    supportsLongitudinalComparison: true,
    analyticsColor: 'progress-gradient-rose',
    contexts: { avaliacaoCompleta: true, prontuario: true, analytics: true }
  },
  {
    type: 'avaliacao_socioeconomica',
    moduleId: 'socioeconomica',
    label: 'Socioeconômica (EBIA)',
    shortLabel: 'EBIA',
    groupLabel: 'Triagem',
    macroStageId: 'triagem',
    macroStageLabel: 'Triagem',
    description: 'Contexto socioeconomico e seguranca alimentar',
    domain: 'social',
    iconKey: 'file_text',
    cursos: ['nutricao'],
    schemaVersion: 2,
    formulaIds: ['ebia_14_itens'],
    requiredFields: ['temMenores', 'pontuacaoEBIA', 'classificacaoLabel'],
    ordem: 3,
    supportsLongitudinalComparison: true,
    analyticsColor: 'progress-gradient-cyan',
    contexts: { avaliacaoCompleta: true, prontuario: true, analytics: true }
  },

  // ── Etapa 2: Composição Corporal ─────────────────────────────────────────
  {
    type: 'perimetros',
    moduleId: 'perimetros',
    label: 'Perímetros',
    shortLabel: 'Perimetros',
    groupLabel: 'Composição corporal',
    macroStageId: 'composicao_corporal',
    macroStageLabel: 'Composição corporal',
    description: 'Circunferencias e proporcoes corporais',
    domain: 'antropometria',
    iconKey: 'scale',
    cursos: ['nutricao', 'fisioterapia'],
    schemaVersion: 3,
    formulaIds: ['mifflin_st_jeor_1990'],
    requiredFields: ['peso', 'estatura'],
    ordem: 4,
    supportsLongitudinalComparison: true,
    analyticsColor: 'progress-gradient-blue',
    contexts: { avaliacaoCompleta: true, prontuario: true, analytics: true }
  },
  {
    type: 'dobras_cutaneas',
    moduleId: 'dobras-cutaneas',
    label: 'Dobras cutâneas',
    shortLabel: 'Dobras cutaneas',
    groupLabel: 'Composição corporal',
    macroStageId: 'composicao_corporal',
    macroStageLabel: 'Composição corporal',
    description: 'Dobras e estimativas de composicao corporal',
    domain: 'antropometria',
    iconKey: 'activity',
    cursos: ['nutricao', 'fisioterapia'],
    schemaVersion: 3,
    formulaIds: ['{protocolo}-siri', '{protocolo}-brozek'],
    requiredFields: ['protocolo', 'sexo', 'dobras'],
    ordem: 5,
    supportsLongitudinalComparison: true,
    analyticsColor: 'progress-gradient-green',
    contexts: { avaliacaoCompleta: true, prontuario: true, analytics: true }
  },
  {
    type: 'bioimpedancia',
    moduleId: 'bioimpedancia',
    label: 'Bioimpedância',
    shortLabel: 'Bioimpedancia',
    groupLabel: 'Composição corporal',
    macroStageId: 'composicao_corporal',
    macroStageLabel: 'Composição corporal',
    description: 'Composicao corporal e bioimpedancia',
    domain: 'antropometria',
    iconKey: 'scale',
    cursos: ['nutricao', 'fisioterapia'],
    schemaVersion: 3,
    formulaIds: ['bia_cunningham_guedes_phase_ffmi'],
    requiredFields: ['percentualGordura', 'massaMagra', 'aguaTotal'],
    ordem: 6,
    supportsLongitudinalComparison: true,
    analyticsColor: 'progress-gradient-emerald',
    contexts: { avaliacaoCompleta: true, prontuario: true, analytics: true }
  },

  {
    type: 'composicao_corporal_imagem',
    moduleId: 'composicao-corporal-imagem',
    label: 'Composição corporal por imagem',
    shortLabel: 'Imagem corporal',
    groupLabel: 'Composição corporal',
    macroStageId: 'composicao_corporal',
    macroStageLabel: 'Composição corporal',
    description: 'Estimativa experimental de composicao corporal por fotos e video multivista',
    domain: 'antropometria',
    iconKey: 'camera',
    cursos: ['nutricao', 'fisioterapia'],
    schemaVersion: 1,
    formulaIds: ['body3d_experimental_v1'],
    requiredFields: ['percGordura', 'massaGorda', 'massaMagra'],
    ordem: 6.5,
    supportsLongitudinalComparison: true,
    analyticsColor: 'progress-gradient-blue',
    experimental: true,
    contexts: { avaliacaoCompleta: false, prontuario: true, analytics: true }
  },

  // ── Etapa 3: Demanda e Desempenho ────────────────────────────────────────
  {
    type: 'gasto_energetico_total',
    moduleId: 'gasto-energetico',
    label: 'Gasto energético total',
    shortLabel: 'Gasto energetico total',
    groupLabel: 'Demanda e desempenho',
    macroStageId: 'demanda_performance',
    macroStageLabel: 'Demanda e desempenho',
    description: 'Estimativa de GET e faixas caloricas por objetivo',
    domain: 'antropometria',
    iconKey: 'flame',
    cursos: ['nutricao'],
    schemaVersion: 1,
    formulaIds: ['mifflin_st_jeor_1990'],
    requiredFields: ['tmbBaseKcal', 'fatorAtividade', 'getEstimadoKcal'],
    ordem: 7,
    supportsLongitudinalComparison: true,
    analyticsColor: 'progress-gradient-amber',
    contexts: { avaliacaoCompleta: true, prontuario: true, analytics: true }
  },
  {
    type: 'carga_treino',
    moduleId: 'carga-treino',
    label: 'Carga de treino e periodização',
    shortLabel: 'Carga de Treino',
    groupLabel: 'Demanda e desempenho',
    macroStageId: 'demanda_performance',
    macroStageLabel: 'Demanda e desempenho',
    description: 'Monitoramento de ACWR, monotonia, strain e fase de periodizacao',
    domain: 'esportivo',
    iconKey: 'activity',
    cursos: ['nutricao'],
    schemaVersion: 1,
    formulaIds: ['acwr_monotonia_strain_v1'],
    requiredFields: ['faseAtual', 'sessoesSemana', 'cargaSemanaAtual'],
    ordem: 8,
    supportsLongitudinalComparison: true,
    analyticsColor: 'progress-gradient-cyan',
    contexts: { avaliacaoCompleta: true, prontuario: true, analytics: true }
  },

  // ── Etapa 4: Rotina Alimentar ─────────────────────────────────────────────
  {
    type: 'alimentar',
    moduleId: 'alimentar',
    label: 'Avaliação alimentar',
    shortLabel: 'Avaliacao alimentar',
    groupLabel: 'Rotina alimentar',
    macroStageId: 'rotina_alimentar',
    macroStageLabel: 'Rotina alimentar',
    description: 'Distribuicao energetica por grupos NOVA',
    domain: 'nutricao',
    iconKey: 'apple',
    cursos: ['nutricao'],
    schemaVersion: 2,
    formulaIds: ['nova_percentual_distribuicao'],
    requiredFields: ['categorias'],
    ordem: 9,
    supportsLongitudinalComparison: true,
    analyticsColor: 'progress-gradient-purple',
    contexts: { avaliacaoCompleta: true, prontuario: true, analytics: true }
  },
  {
    type: 'hidratacao',
    moduleId: 'hidratacao',
    label: 'Hidratação',
    shortLabel: 'Hidratacao',
    groupLabel: 'Rotina alimentar',
    macroStageId: 'rotina_alimentar',
    macroStageLabel: 'Rotina alimentar',
    description: 'Perda hidrica e estrategia de reposicao',
    domain: 'nutricao',
    iconKey: 'droplets',
    cursos: ['nutricao'],
    schemaVersion: 2,
    formulaIds: ['hidratacao_balanco_hidrico'],
    requiredFields: ['pesoAntesExercicio', 'pesoAposExercicio', 'duracaoExercicioMin', 'perdaPesoPercentual'],
    ordem: 10,
    supportsLongitudinalComparison: true,
    analyticsColor: 'progress-gradient-amber',
    contexts: { avaliacaoCompleta: true, prontuario: true, analytics: true }
  },

  // ── Etapa 5: Multiprofissional ────────────────────────────────────────────
  {
    type: 'psicologia',
    moduleId: 'psicologia',
    label: 'Psicologia',
    shortLabel: 'Psicologia',
    groupLabel: 'Multiprofissional',
    macroStageId: 'multiprofissional',
    macroStageLabel: 'Multiprofissional',
    description: 'Estado emocional e comportamento',
    domain: 'multiprofissional',
    iconKey: 'heart',
    cursos: ['psicologia', 'nutricao'],
    schemaVersion: 2,
    formulaIds: ['psicologia_triagem_emocional'],
    requiredFields: ['objetivo', 'estresse'],
    ordem: 11,
    supportsLongitudinalComparison: true,
    analyticsColor: 'progress-gradient-indigo',
    contexts: { avaliacaoCompleta: true, prontuario: true, analytics: true }
  },
  {
    type: 'fisioterapia',
    moduleId: 'fisioterapia',
    label: 'Fisioterapia',
    shortLabel: 'Fisioterapia',
    groupLabel: 'Multiprofissional',
    macroStageId: 'multiprofissional',
    macroStageLabel: 'Multiprofissional',
    description: 'Avaliação clínico-funcional multissessão',
    domain: 'multiprofissional',
    iconKey: 'activity',
    cursos: ['fisioterapia', 'nutricao'],
    schemaVersion: 3,
    formulaIds: ['fisioterapia_clinica_v2'],
    requiredFields: [],
    ordem: 12,
    supportsLongitudinalComparison: true,
    analyticsColor: 'progress-gradient-rose',
    contexts: { avaliacaoCompleta: true, prontuario: true, analytics: true }
  },

  // ── Etapa 6: Conduta ──────────────────────────────────────────────────────
  {
    type: 'triagem_reds',
    moduleId: 'triagem-reds',
    label: 'Triagem de disponibilidade energética',
    shortLabel: 'Disp. Energetica',
    groupLabel: 'Conduta',
    macroStageId: 'conduta',
    macroStageLabel: 'Conduta',
    description: 'Triagem de disponibilidade energética',
    domain: 'esportivo',
    iconKey: 'shield_alert',
    cursos: ['nutricao'],
    schemaVersion: 1,
    formulaIds: ['DE', 'leafQ'],
    requiredFields: ['disponibilidadeEnergetica', 'scoreLeafQ'],
    ordem: 13,
    supportsLongitudinalComparison: true,
    analyticsColor: 'progress-gradient-rose',
    contexts: { avaliacaoCompleta: true, prontuario: true, analytics: true }
  },
  {
    type: 'exames_laboratoriais',
    moduleId: 'exames-laboratoriais',
    label: 'Exames laboratoriais',
    shortLabel: 'Exames',
    groupLabel: 'Conduta',
    macroStageId: 'conduta',
    macroStageLabel: 'Conduta',
    description: 'Analitos laboratoriais com classificacao por referencia',
    domain: 'clinica',
    iconKey: 'file_text',
    cursos: ['nutricao'],
    schemaVersion: 1,
    formulaIds: ['lab_ref_range_v1'],
    requiredFields: ['painel', 'analitos'],
    ordem: 14,
    supportsLongitudinalComparison: true,
    analyticsColor: 'progress-gradient-cyan',
    contexts: { avaliacaoCompleta: true, prontuario: true, analytics: true }
  },
  {
    type: 'evolucao_retorno',
    moduleId: 'evolucao-retorno',
    label: 'Evolução/retorno',
    shortLabel: 'Retorno',
    groupLabel: 'Conduta',
    macroStageId: 'conduta',
    macroStageLabel: 'Conduta',
    description: 'Acompanhamento de adesao, sintomas e conduta',
    domain: 'anamnese',
    iconKey: 'refresh_cw',
    cursos: [],
    schemaVersion: 1,
    formulaIds: ['evolucao_adesao_score_v1'],
    requiredFields: ['adesaoPlanoAlimentar', 'adesaoAtividadeFisica', 'scoreAdesaoGeral'],
    ordem: 15,
    supportsLongitudinalComparison: true,
    analyticsColor: 'progress-gradient-amber',
    contexts: { avaliacaoCompleta: true, prontuario: true, analytics: true }
  },
  {
    type: 'plano_metas',
    moduleId: 'plano-metas',
    label: 'Plano de metas',
    shortLabel: 'Metas',
    groupLabel: 'Conduta',
    macroStageId: 'conduta',
    macroStageLabel: 'Conduta',
    description: 'Planejamento motivacional e estrategias de mudanca comportamental',
    domain: 'conduta',
    iconKey: 'target',
    cursos: [],
    schemaVersion: 1,
    formulaIds: ['plano_metas_motivacional_v1'],
    requiredFields: ['oQueQueroMudar', 'motivacao'],
    ordem: 16,
    supportsLongitudinalComparison: true,
    analyticsColor: 'progress-gradient-green',
    contexts: { avaliacaoCompleta: true, prontuario: true, analytics: true }
  }
]);

export const EVALUATION_REGISTRY_BY_TYPE = EVALUATION_REGISTRY.reduce((acc, item) => {
  acc[item.type] = item;
  return acc;
}, {});

export const normalizeEvaluationTypeToken = (value) => normalizeToken(value);

export const getEvaluationRegistryItem = (type) => {
  const key = normalizeToken(type);
  if (!key) return null;
  return EVALUATION_REGISTRY_BY_TYPE[key] || null;
};

export const getEvaluationTypeLabelFromRegistry = (type) => {
  const item = getEvaluationRegistryItem(type);
  return item?.label || '';
};

export const listEvaluationRegistryByContext = (contextKey) => {
  const key = String(contextKey || '').trim();
  if (!key) return [...EVALUATION_REGISTRY];
  return EVALUATION_REGISTRY.filter((item) => Boolean(item?.contexts?.[key]));
};

const STUDENT_ROLES = new Set(['aluno', 'presidente', 'vice']);
const EVALUATION_EDIT_AREAS_BY_TYPE = Object.freeze({
  psicologia: ['psicologia'],
  fisioterapia: ['fisioterapia'],
  composicao_corporal_imagem: ['nutricao', 'fisioterapia']
});

const normalizeCursoToken = (value) =>
  String(value || '')
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '_');

export const normalizeAreaToken = (value) => {
  const token = normalizeCursoToken(value)
    .replace(/[^\w_]/g, '')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
  if (!token) return '';
  if (token.includes('psicolog')) return 'psicologia';
  if (token.includes('fisioterap')) return 'fisioterapia';
  if (token.includes('nutri')) return 'nutricao';
  if (token.includes('educacao_fisica') || token.includes('educ_fisica')) return 'educacao_fisica';
  if (token.includes('medic')) return 'medicina';
  return token;
};

export const getEvaluationEditArea = (type) => {
  const key = normalizeToken(type);
  return (EVALUATION_EDIT_AREAS_BY_TYPE[key] || ['nutricao'])[0];
};

export const getEvaluationEditAreas = (type) => {
  const key = normalizeToken(type);
  return EVALUATION_EDIT_AREAS_BY_TYPE[key] || ['nutricao'];
};

export const getCaseEditableAreasForUser = (user, patient) => {
  const userId = String(user?.uid || user?.id || '').trim();
  if (!userId || !patient) return new Set();

  const areas = new Set();
  const equipeProfissional = Array.isArray(patient?.equipeProfissional)
    ? patient.equipeProfissional
    : [];
  const membership = equipeProfissional.find((member) => String(member?.userId || '') === userId);
  if (membership?.area) {
    areas.add(normalizeAreaToken(membership.area));
  }

  if (patient?.alunoResponsavelId === userId || patient?.alunoResponsavel?.id === userId) {
    areas.add(normalizeAreaToken(user?.curso) || 'nutricao');
  }

  if (!membership && Array.isArray(patient?.equipeMultiIds) && patient.equipeMultiIds.includes(userId)) {
    const cursoArea = normalizeAreaToken(user?.curso);
    if (cursoArea) areas.add(cursoArea);
  }

  return new Set([...areas].filter(Boolean));
};

export const canEditEvaluationTypeForUser = (user, patient, type) => {
  const role = String(user?.role || '').toLowerCase().trim();
  if (!STUDENT_ROLES.has(role)) return false;
  const areas = getCaseEditableAreasForUser(user, patient);
  return getEvaluationEditAreas(type).some((area) => areas.has(area));
};

export const getEditableTypesForUser = (user, patient) => new Set(
  EVALUATION_REGISTRY
    .filter((item) => canEditEvaluationTypeForUser(user, patient, item.type))
    .map((item) => item.type)
);

/**
 * Returns a Set of evaluation type strings visible to a given user.
 * Non-student roles always receive all types.
 * For students, entries with empty `cursos` are always visible;
 * entries with cursos are shown only when the student's curso matches.
 * If the student has no curso set, all entries are shown (fallback).
 */
export const getVisibleTypesForUser = (user, patient = null) => {
  const role = String(user?.role || '').toLowerCase().trim();
  if (!STUDENT_ROLES.has(role)) {
    return new Set(EVALUATION_REGISTRY.map((e) => e.type));
  }
  const caseAreas = getCaseEditableAreasForUser(user, patient);
  const curso = normalizeAreaToken(user?.curso);
  const effectiveAreas = caseAreas.size > 0
    ? caseAreas
    : new Set(curso ? [curso] : []);
  return new Set(
    EVALUATION_REGISTRY
      .filter((e) => !e.cursos?.length || effectiveAreas.size === 0 || e.cursos.some((item) => effectiveAreas.has(item)))
      .map((e) => e.type)
  );
};
