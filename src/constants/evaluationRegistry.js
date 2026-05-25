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
    label: 'Avaliacao clinica',
    shortLabel: 'Avaliacao clinica',
    groupLabel: 'Triagem',
    macroStageId: 'triagem',
    macroStageLabel: 'Triagem',
    description: 'Sinais vitais, red flags e classificacao automatica de risco',
    domain: 'clinica',
    iconKey: 'heart',
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
    label: 'Socioeconomica (EBIA)',
    shortLabel: 'EBIA',
    groupLabel: 'Triagem',
    macroStageId: 'triagem',
    macroStageLabel: 'Triagem',
    description: 'Contexto socioeconomico e seguranca alimentar',
    domain: 'social',
    iconKey: 'file_text',
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
    label: 'Perimetros',
    shortLabel: 'Perimetros',
    groupLabel: 'Composição corporal',
    macroStageId: 'composicao_corporal',
    macroStageLabel: 'Composição corporal',
    description: 'Circunferencias e proporcoes corporais',
    domain: 'antropometria',
    iconKey: 'scale',
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
    label: 'Dobras cutaneas',
    shortLabel: 'Dobras cutaneas',
    groupLabel: 'Composição corporal',
    macroStageId: 'composicao_corporal',
    macroStageLabel: 'Composição corporal',
    description: 'Dobras e estimativas de composicao corporal',
    domain: 'antropometria',
    iconKey: 'activity',
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
    label: 'Bioimpedancia',
    shortLabel: 'Bioimpedancia',
    groupLabel: 'Composição corporal',
    macroStageId: 'composicao_corporal',
    macroStageLabel: 'Composição corporal',
    description: 'Composicao corporal e bioimpedancia',
    domain: 'antropometria',
    iconKey: 'scale',
    schemaVersion: 3,
    formulaIds: ['bia_cunningham_guedes_phase_ffmi'],
    requiredFields: ['percentualGordura', 'massaMagra', 'aguaTotal'],
    ordem: 6,
    supportsLongitudinalComparison: true,
    analyticsColor: 'progress-gradient-emerald',
    contexts: { avaliacaoCompleta: true, prontuario: true, analytics: true }
  },

  // ── Etapa 3: Demanda e Performance ───────────────────────────────────────
  {
    type: 'gasto_energetico_total',
    moduleId: 'gasto-energetico',
    label: 'Gasto energetico total',
    shortLabel: 'Gasto energetico total',
    groupLabel: 'Demanda e performance',
    macroStageId: 'demanda_performance',
    macroStageLabel: 'Demanda e performance',
    description: 'Estimativa de GET e faixas caloricas por objetivo',
    domain: 'antropometria',
    iconKey: 'flame',
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
    label: 'Carga de Treino e Periodizacao',
    shortLabel: 'Carga de Treino',
    groupLabel: 'Demanda e performance',
    macroStageId: 'demanda_performance',
    macroStageLabel: 'Demanda e performance',
    description: 'Monitoramento de ACWR, monotonia, strain e fase de periodizacao',
    domain: 'esportivo',
    iconKey: 'activity',
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
    label: 'Avaliacao alimentar',
    shortLabel: 'Avaliacao alimentar',
    groupLabel: 'Rotina alimentar',
    macroStageId: 'rotina_alimentar',
    macroStageLabel: 'Rotina alimentar',
    description: 'Distribuicao energetica por grupos NOVA',
    domain: 'nutricao',
    iconKey: 'apple',
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
    label: 'Hidratacao',
    shortLabel: 'Hidratacao',
    groupLabel: 'Rotina alimentar',
    macroStageId: 'rotina_alimentar',
    macroStageLabel: 'Rotina alimentar',
    description: 'Perda hidrica e estrategia de reposicao',
    domain: 'nutricao',
    iconKey: 'droplets',
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
    label: 'Triagem RED-S',
    shortLabel: 'Triagem RED-S',
    groupLabel: 'Conduta',
    macroStageId: 'conduta',
    macroStageLabel: 'Conduta',
    description: 'Triagem de disponibilidade energetica e risco de RED-S',
    domain: 'esportivo',
    iconKey: 'shield_alert',
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
    label: 'Evolucao/retorno',
    shortLabel: 'Retorno',
    groupLabel: 'Conduta',
    macroStageId: 'conduta',
    macroStageLabel: 'Conduta',
    description: 'Acompanhamento de adesao, sintomas e conduta',
    domain: 'anamnese',
    iconKey: 'refresh_cw',
    schemaVersion: 1,
    formulaIds: ['evolucao_adesao_score_v1'],
    requiredFields: ['adesaoPlanoAlimentar', 'adesaoAtividadeFisica', 'scoreAdesaoGeral'],
    ordem: 15,
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
