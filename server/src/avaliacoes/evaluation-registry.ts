export type AvaliacaoRegistryEntry = {
  tipo: string;
  label: string;
  macroEtapaId: string;
  macroEtapaLabel: string;
  dominio: string;
  schemaVersion: number;
  formulaIds: string[];
  requiredFields: string[];
  ordem: number;
  prontuario?: boolean;
  supportsLongitudinalComparison: boolean;
  analytics: {
    label: string;
    color: string;
  };
};

const normalizeToken = (value?: string | null) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\s-]+/g, '_');

export const AVALIACAO_REGISTRY: ReadonlyArray<AvaliacaoRegistryEntry> = [
  {
    tipo: 'anamnese_inicial',
    label: 'Anamnese inicial',
    macroEtapaId: 'triagem',
    macroEtapaLabel: 'Triagem',
    dominio: 'anamnese',
    schemaVersion: 1,
    formulaIds: ['anamnese_risk_rules_v1'],
    requiredFields: ['nomePaciente', 'sexoBiologico', 'objetivos', 'scoreRisco', 'prioridade'],
    ordem: 1,
    supportsLongitudinalComparison: false,
    analytics: { label: 'Anamnese inicial', color: 'progress-gradient-cyan' }
  },
  {
    tipo: 'avaliacao_clinica',
    label: 'Avaliação clínica',
    macroEtapaId: 'triagem',
    macroEtapaLabel: 'Triagem',
    dominio: 'clinica',
    schemaVersion: 1,
    formulaIds: ['avaliacao_clinica_has_2016_redflags_v1'],
    requiredFields: ['pressaoSistolica', 'pressaoDiastolica', 'frequenciaCardiaca', 'prioridadeCuidado'],
    ordem: 2,
    supportsLongitudinalComparison: true,
    analytics: { label: 'Avaliação clínica', color: 'progress-gradient-rose' }
  },
  {
    tipo: 'avaliacao_socioeconomica',
    label: 'Socioeconômica (EBIA)',
    macroEtapaId: 'triagem',
    macroEtapaLabel: 'Triagem',
    dominio: 'social',
    schemaVersion: 2,
    formulaIds: ['ebia_14_itens'],
    requiredFields: ['temMenores', 'pontuacaoEBIA', 'classificacaoLabel'],
    ordem: 3,
    prontuario: true,
    supportsLongitudinalComparison: true,
    analytics: { label: 'Socioeconômica (EBIA)', color: 'progress-gradient-cyan' }
  },
  {
    tipo: 'perimetros',
    label: 'Perímetros',
    macroEtapaId: 'composicao_corporal',
    macroEtapaLabel: 'Composição corporal',
    dominio: 'antropometria',
    schemaVersion: 3,
    formulaIds: ['mifflin_st_jeor_1990'],
    requiredFields: ['peso', 'estatura'],
    ordem: 4,
    prontuario: true,
    supportsLongitudinalComparison: true,
    analytics: { label: 'Perímetros', color: 'progress-gradient-blue' }
  },
  {
    tipo: 'dobras_cutaneas',
    label: 'Dobras cutâneas',
    macroEtapaId: 'composicao_corporal',
    macroEtapaLabel: 'Composição corporal',
    dominio: 'antropometria',
    schemaVersion: 3,
    formulaIds: ['{protocolo}-siri', '{protocolo}-brozek'],
    requiredFields: ['protocolo', 'sexo', 'dobras'],
    ordem: 5,
    prontuario: true,
    supportsLongitudinalComparison: true,
    analytics: { label: 'Dobras cutâneas', color: 'progress-gradient-green' }
  },
  {
    tipo: 'bioimpedancia',
    label: 'Bioimpedância',
    macroEtapaId: 'composicao_corporal',
    macroEtapaLabel: 'Composição corporal',
    dominio: 'antropometria',
    schemaVersion: 3,
    formulaIds: ['bia_cunningham_guedes_phase_ffmi'],
    requiredFields: ['percentualGordura', 'massaMagra', 'aguaTotal'],
    ordem: 6,
    prontuario: true,
    supportsLongitudinalComparison: true,
    analytics: { label: 'Bioimpedância', color: 'progress-gradient-emerald' }
  },
  {
    tipo: 'composicao_corporal_imagem',
    label: 'Composição corporal por imagem',
    macroEtapaId: 'composicao_corporal',
    macroEtapaLabel: 'Composição corporal',
    dominio: 'antropometria',
    schemaVersion: 1,
    formulaIds: ['body3d_experimental_v1'],
    requiredFields: [],
    ordem: 6.5,
    prontuario: true,
    supportsLongitudinalComparison: true,
    analytics: { label: 'Composição corporal por imagem', color: 'progress-gradient-cyan' }
  },
  {
    tipo: 'gasto_energetico_total',
    label: 'Gasto energético total',
    macroEtapaId: 'demanda_performance',
    macroEtapaLabel: 'Demanda e desempenho',
    dominio: 'antropometria',
    schemaVersion: 1,
    formulaIds: ['mifflin_st_jeor_1990'],
    requiredFields: ['tmbBaseKcal', 'fatorAtividade', 'getEstimadoKcal'],
    ordem: 7,
    prontuario: true,
    supportsLongitudinalComparison: true,
    analytics: { label: 'Gasto energético total', color: 'progress-gradient-amber' }
  },
  {
    tipo: 'carga_treino',
    label: 'Carga de treino e periodização',
    macroEtapaId: 'demanda_performance',
    macroEtapaLabel: 'Demanda e desempenho',
    dominio: 'esportivo',
    schemaVersion: 1,
    formulaIds: ['acwr_monotonia_strain_v1'],
    requiredFields: ['faseAtual', 'sessoesSemana', 'cargaSemanaAtual'],
    ordem: 8,
    prontuario: true,
    supportsLongitudinalComparison: true,
    analytics: { label: 'Carga de treino e periodização', color: 'progress-gradient-cyan' }
  },
  {
    tipo: 'alimentar',
    label: 'Avaliação alimentar',
    macroEtapaId: 'rotina_alimentar',
    macroEtapaLabel: 'Rotina alimentar',
    dominio: 'nutricao',
    schemaVersion: 2,
    formulaIds: ['nova_percentual_distribuicao'],
    requiredFields: ['categorias'],
    ordem: 9,
    prontuario: true,
    supportsLongitudinalComparison: true,
    analytics: { label: 'Avaliação alimentar (NOVA)', color: 'progress-gradient-purple' }
  },
  {
    tipo: 'hidratacao',
    label: 'Hidratação',
    macroEtapaId: 'rotina_alimentar',
    macroEtapaLabel: 'Rotina alimentar',
    dominio: 'nutricao',
    schemaVersion: 2,
    formulaIds: ['hidratacao_balanco_hidrico'],
    requiredFields: ['pesoAntesExercicio', 'pesoAposExercicio', 'duracaoExercicioMin', 'perdaPesoPercentual'],
    ordem: 10,
    prontuario: true,
    supportsLongitudinalComparison: true,
    analytics: { label: 'Hidratação', color: 'progress-gradient-amber' }
  },
  {
    tipo: 'psicologia',
    label: 'Psicologia',
    macroEtapaId: 'multiprofissional',
    macroEtapaLabel: 'Multiprofissional',
    dominio: 'multiprofissional',
    schemaVersion: 2,
    formulaIds: ['psicologia_triagem_emocional'],
    requiredFields: ['objetivo', 'estresse'],
    ordem: 11,
    prontuario: true,
    supportsLongitudinalComparison: true,
    analytics: { label: 'Psicologia', color: 'progress-gradient-indigo' }
  },
  {
    tipo: 'fisioterapia',
    label: 'Fisioterapia',
    macroEtapaId: 'multiprofissional',
    macroEtapaLabel: 'Multiprofissional',
    dominio: 'multiprofissional',
    schemaVersion: 3,
    formulaIds: ['fisioterapia_clinica_v2'],
    requiredFields: [],
    ordem: 12,
    prontuario: true,
    supportsLongitudinalComparison: true,
    analytics: { label: 'Fisioterapia', color: 'progress-gradient-rose' }
  },
  {
    tipo: 'triagem_reds',
    label: 'Triagem de disponibilidade energética',
    macroEtapaId: 'conduta',
    macroEtapaLabel: 'Conduta',
    dominio: 'esportivo',
    schemaVersion: 1,
    formulaIds: ['DE', 'leafQ'],
    requiredFields: ['disponibilidadeEnergetica', 'scoreLeafQ'],
    ordem: 13,
    prontuario: true,
    supportsLongitudinalComparison: true,
    analytics: { label: 'Triagem de disponibilidade energética', color: 'progress-gradient-rose' }
  },
  {
    tipo: 'exames_laboratoriais',
    label: 'Exames laboratoriais',
    macroEtapaId: 'conduta',
    macroEtapaLabel: 'Conduta',
    dominio: 'clinica',
    schemaVersion: 1,
    formulaIds: ['lab_ref_range_v1'],
    requiredFields: ['painel', 'analitos'],
    ordem: 14,
    supportsLongitudinalComparison: true,
    analytics: { label: 'Exames laboratoriais', color: 'progress-gradient-cyan' }
  },
  {
    tipo: 'evolucao_retorno',
    label: 'Evolução/retorno',
    macroEtapaId: 'conduta',
    macroEtapaLabel: 'Conduta',
    dominio: 'anamnese',
    schemaVersion: 1,
    formulaIds: ['evolucao_adesao_score_v1'],
    requiredFields: ['adesaoPlanoAlimentar', 'adesaoAtividadeFisica', 'scoreAdesaoGeral'],
    ordem: 15,
    prontuario: true,
    supportsLongitudinalComparison: true,
    analytics: { label: 'Evolução e retorno', color: 'progress-gradient-amber' }
  },
  {
    tipo: 'plano_metas',
    label: 'Plano de metas',
    macroEtapaId: 'conduta',
    macroEtapaLabel: 'Conduta',
    dominio: 'conduta',
    schemaVersion: 1,
    formulaIds: ['plano_metas_motivacional_v1'],
    requiredFields: ['oQueQueroMudar', 'motivacao'],
    ordem: 16,
    prontuario: true,
    supportsLongitudinalComparison: true,
    analytics: { label: 'Plano de metas', color: 'progress-gradient-green' }
  }
];

export const AVALIACAO_REGISTRY_BY_TIPO = AVALIACAO_REGISTRY.reduce<Record<string, AvaliacaoRegistryEntry>>((acc, item) => {
  acc[item.tipo] = item;
  return acc;
}, {});

export const AVALIACAO_ANALYTICS_LABELS = AVALIACAO_REGISTRY.reduce<Record<string, string>>((acc, item) => {
  acc[item.tipo] = item.analytics.label;
  return acc;
}, {});

export const AVALIACAO_ANALYTICS_COLORS = AVALIACAO_REGISTRY.reduce<Record<string, string>>((acc, item) => {
  acc[item.tipo] = item.analytics.color;
  return acc;
}, {});

export const normalizeAvaliacaoTipo = (value?: string | null) => normalizeToken(value);
