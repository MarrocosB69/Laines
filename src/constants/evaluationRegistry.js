const normalizeToken = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\s-]+/g, '_');

export const EVALUATION_REGISTRY = Object.freeze([
  {
    type: 'bioimpedancia',
    moduleId: 'bioimpedancia',
    label: 'Bioimpedancia',
    shortLabel: 'Bioimpedancia',
    groupLabel: 'Antropometria',
    description: 'Composicao corporal e bioimpedancia',
    domain: 'antropometria',
    iconKey: 'scale',
    schemaVersion: 3,
    formulaIds: ['bia_cunningham_guedes_phase_ffmi'],
    requiredFields: ['percentualGordura', 'massaMagra', 'aguaTotal'],
    supportsLongitudinalComparison: true,
    analyticsColor: 'progress-gradient-emerald',
    contexts: { avaliacaoCompleta: true, prontuario: true, analytics: true }
  },
  {
    type: 'dobras_cutaneas',
    moduleId: 'dobras-cutaneas',
    label: 'Dobras cutaneas',
    shortLabel: 'Dobras cutaneas',
    groupLabel: 'Antropometria',
    description: 'Dobras e estimativas de composicao corporal',
    domain: 'antropometria',
    iconKey: 'activity',
    schemaVersion: 3,
    formulaIds: ['{protocolo}-siri', '{protocolo}-brozek'],
    requiredFields: ['protocolo', 'sexo', 'dobras'],
    supportsLongitudinalComparison: true,
    analyticsColor: 'progress-gradient-green',
    contexts: { avaliacaoCompleta: true, prontuario: true, analytics: true }
  },
  {
    type: 'perimetros',
    moduleId: 'perimetros',
    label: 'Perimetros',
    shortLabel: 'Perimetros',
    groupLabel: 'Antropometria',
    description: 'Circunferencias e proporcoes corporais',
    domain: 'antropometria',
    iconKey: 'scale',
    schemaVersion: 3,
    formulaIds: ['mifflin_st_jeor_1990'],
    requiredFields: ['peso', 'estatura'],
    supportsLongitudinalComparison: true,
    analyticsColor: 'progress-gradient-blue',
    contexts: { avaliacaoCompleta: true, prontuario: true, analytics: true }
  },
  {
    type: 'composicao_corporal_integrada',
    moduleId: 'composicao-integrada',
    label: 'Composicao integrada',
    shortLabel: 'Composicao integrada',
    groupLabel: 'Antropometria',
    description: 'Fonte oficial da composicao corporal da sessao',
    domain: 'antropometria',
    iconKey: 'layers',
    schemaVersion: 1,
    formulaIds: ['mifflin_st_jeor_1990'],
    requiredFields: ['fonte_oficial', 'percentualGorduraOficial', 'massaMagraOficialKg', 'tmbSelecionadaKcal'],
    supportsLongitudinalComparison: true,
    analyticsColor: 'progress-gradient-indigo',
    contexts: { avaliacaoCompleta: true, prontuario: false, analytics: true }
  },
  {
    type: 'gasto_energetico_total',
    moduleId: 'gasto-energetico',
    label: 'Gasto energetico total',
    shortLabel: 'Gasto energetico total',
    groupLabel: 'Antropometria',
    description: 'Estimativa de GET e faixas caloricas por objetivo',
    domain: 'antropometria',
    iconKey: 'flame',
    schemaVersion: 1,
    formulaIds: ['mifflin_st_jeor_1990'],
    requiredFields: ['tmbBaseKcal', 'fatorAtividade', 'getEstimadoKcal'],
    supportsLongitudinalComparison: true,
    analyticsColor: 'progress-gradient-amber',
    contexts: { avaliacaoCompleta: true, prontuario: false, analytics: true }
  },
  {
    type: 'anamnese_inicial',
    moduleId: 'anamnese-inicial',
    label: 'Anamnese inicial',
    shortLabel: 'Anamnese inicial',
    groupLabel: 'Nutricao e habitos',
    description: 'Contexto inicial clinico e objetivos do paciente',
    domain: 'anamnese',
    iconKey: 'clipboard_list',
    schemaVersion: 1,
    formulaIds: ['anamnese_risk_rules_v1'],
    requiredFields: ['nomePaciente', 'sexoBiologico', 'objetivos', 'scoreRisco', 'prioridade'],
    supportsLongitudinalComparison: false,
    analyticsColor: 'progress-gradient-cyan',
    contexts: { avaliacaoCompleta: true, prontuario: false, analytics: true }
  },
  {
    type: 'avaliacao_clinica',
    moduleId: 'avaliacao-clinica',
    label: 'Avaliacao clinica',
    shortLabel: 'Avaliacao clinica',
    groupLabel: 'Saude clinica',
    description: 'Sinais vitais, red flags e classificacao automatica de risco',
    domain: 'clinica',
    iconKey: 'heart',
    schemaVersion: 1,
    formulaIds: ['avaliacao_clinica_has_2016_redflags_v1'],
    requiredFields: ['pressaoSistolica', 'pressaoDiastolica', 'frequenciaCardiaca', 'prioridadeCuidado'],
    supportsLongitudinalComparison: true,
    analyticsColor: 'progress-gradient-rose',
    contexts: { avaliacaoCompleta: true, prontuario: false, analytics: true }
  },
  {
    type: 'alimentar',
    moduleId: 'alimentar',
    label: 'Avaliacao alimentar',
    shortLabel: 'Avaliacao alimentar',
    groupLabel: 'Nutricao e habitos',
    description: 'Distribuicao energetica por grupos NOVA',
    domain: 'nutricao',
    iconKey: 'apple',
    schemaVersion: 2,
    formulaIds: ['nova_percentual_distribuicao'],
    requiredFields: ['categorias'],
    supportsLongitudinalComparison: true,
    analyticsColor: 'progress-gradient-purple',
    contexts: { avaliacaoCompleta: true, prontuario: true, analytics: true }
  },
  {
    type: 'hidratacao',
    moduleId: 'hidratacao',
    label: 'Hidratacao',
    shortLabel: 'Hidratacao',
    groupLabel: 'Nutricao e habitos',
    description: 'Perda hidrica e estrategia de reposicao',
    domain: 'nutricao',
    iconKey: 'droplets',
    schemaVersion: 2,
    formulaIds: ['hidratacao_balanco_hidrico'],
    requiredFields: ['pesoAntesExercicio', 'pesoAposExercicio', 'duracaoExercicioMin', 'perdaPesoPercentual'],
    supportsLongitudinalComparison: true,
    analyticsColor: 'progress-gradient-amber',
    contexts: { avaliacaoCompleta: true, prontuario: true, analytics: true }
  },
  {
    type: 'avaliacao_socioeconomica',
    moduleId: 'socioeconomica',
    label: 'Socioeconomica (EBIA)',
    shortLabel: 'EBIA',
    groupLabel: 'Nutricao e habitos',
    description: 'Contexto socioeconomico e seguranca alimentar',
    domain: 'social',
    iconKey: 'file_text',
    schemaVersion: 2,
    formulaIds: ['ebia_14_itens'],
    requiredFields: ['temMenores', 'pontuacaoEBIA', 'classificacaoLabel'],
    supportsLongitudinalComparison: true,
    analyticsColor: 'progress-gradient-cyan',
    contexts: { avaliacaoCompleta: true, prontuario: true, analytics: true }
  },
  {
    type: 'fisioterapia',
    moduleId: 'fisioterapia',
    label: 'Fisioterapia',
    shortLabel: 'Fisioterapia',
    groupLabel: 'Equipe multiprofissional',
    description: 'Aspectos funcionais e dor',
    domain: 'multiprofissional',
    iconKey: 'activity',
    schemaVersion: 2,
    formulaIds: ['fisioterapia_funcional_basica'],
    requiredFields: ['queixaPrincipal', 'intensidadeDor'],
    supportsLongitudinalComparison: true,
    analyticsColor: 'progress-gradient-rose',
    contexts: { avaliacaoCompleta: true, prontuario: false, analytics: true }
  },
  {
    type: 'psicologia',
    moduleId: 'psicologia',
    label: 'Psicologia',
    shortLabel: 'Psicologia',
    groupLabel: 'Equipe multiprofissional',
    description: 'Estado emocional e comportamento',
    domain: 'multiprofissional',
    iconKey: 'heart',
    schemaVersion: 2,
    formulaIds: ['psicologia_triagem_emocional'],
    requiredFields: ['objetivo', 'estresse'],
    supportsLongitudinalComparison: true,
    analyticsColor: 'progress-gradient-indigo',
    contexts: { avaliacaoCompleta: true, prontuario: false, analytics: true }
  },
  {
    type: 'exames_laboratoriais',
    moduleId: 'exames-laboratoriais',
    label: 'Exames laboratoriais',
    shortLabel: 'Exames',
    groupLabel: 'Saude clinica',
    description: 'Analitos laboratoriais com classificacao por referencia',
    domain: 'clinica',
    iconKey: 'file_text',
    schemaVersion: 1,
    formulaIds: ['lab_ref_range_v1'],
    requiredFields: ['painel', 'analitos'],
    supportsLongitudinalComparison: true,
    analyticsColor: 'progress-gradient-cyan',
    contexts: { avaliacaoCompleta: true, prontuario: true, analytics: true }
  },
  {
    type: 'evolucao_retorno',
    moduleId: 'evolucao-retorno',
    label: 'Evolucao/retorno',
    shortLabel: 'Retorno',
    groupLabel: 'Nutricao e habitos',
    description: 'Acompanhamento de adesao, sintomas e conduta',
    domain: 'anamnese',
    iconKey: 'refresh_cw',
    schemaVersion: 1,
    formulaIds: ['evolucao_adesao_score_v1'],
    requiredFields: ['adesaoPlanoAlimentar', 'adesaoAtividadeFisica', 'scoreAdesaoGeral'],
    supportsLongitudinalComparison: true,
    analyticsColor: 'progress-gradient-amber',
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
