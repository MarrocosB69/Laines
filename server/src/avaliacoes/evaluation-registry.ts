export type AvaliacaoRegistryEntry = {
  tipo: string;
  label: string;
  dominio: string;
  schemaVersion: number;
  formulaIds: string[];
  requiredFields: string[];
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
    tipo: 'bioimpedancia',
    label: 'Bioimpedancia',
    dominio: 'antropometria',
    schemaVersion: 3,
    formulaIds: ['bia_cunningham_guedes_phase_ffmi'],
    requiredFields: ['percentualGordura', 'massaMagra', 'aguaTotal'],
    supportsLongitudinalComparison: true,
    analytics: { label: 'Avaliacoes de Bioimpedancia', color: 'progress-gradient-emerald' }
  },
  {
    tipo: 'dobras_cutaneas',
    label: 'Dobras cutaneas',
    dominio: 'antropometria',
    schemaVersion: 3,
    formulaIds: ['{protocolo}-siri', '{protocolo}-brozek'],
    requiredFields: ['protocolo', 'sexo', 'dobras'],
    supportsLongitudinalComparison: true,
    analytics: { label: 'Dobras Cutaneas', color: 'progress-gradient-green' }
  },
  {
    tipo: 'perimetros',
    label: 'Perimetros',
    dominio: 'antropometria',
    schemaVersion: 3,
    formulaIds: ['mifflin_st_jeor_1990'],
    requiredFields: ['peso', 'estatura'],
    supportsLongitudinalComparison: true,
    analytics: { label: 'Perimetros', color: 'progress-gradient-blue' }
  },
  {
    tipo: 'composicao_corporal_integrada',
    label: 'Composicao integrada',
    dominio: 'antropometria',
    schemaVersion: 1,
    formulaIds: ['mifflin_st_jeor_1990'],
    requiredFields: ['fonte_oficial', 'percentualGorduraOficial', 'massaMagraOficialKg', 'tmbSelecionadaKcal'],
    supportsLongitudinalComparison: true,
    analytics: { label: 'Composicao Corporal Integrada', color: 'progress-gradient-indigo' }
  },
  {
    tipo: 'gasto_energetico_total',
    label: 'Gasto energetico total',
    dominio: 'antropometria',
    schemaVersion: 1,
    formulaIds: ['mifflin_st_jeor_1990'],
    requiredFields: ['tmbBaseKcal', 'fatorAtividade', 'getEstimadoKcal'],
    supportsLongitudinalComparison: true,
    analytics: { label: 'Gasto Energetico Total', color: 'progress-gradient-amber' }
  },
  {
    tipo: 'anamnese_inicial',
    label: 'Anamnese inicial',
    dominio: 'anamnese',
    schemaVersion: 1,
    formulaIds: ['anamnese_risk_rules_v1'],
    requiredFields: ['nomePaciente', 'sexoBiologico', 'objetivos', 'scoreRisco', 'prioridade'],
    supportsLongitudinalComparison: false,
    analytics: { label: 'Anamnese Inicial', color: 'progress-gradient-cyan' }
  },
  {
    tipo: 'avaliacao_clinica',
    label: 'Avaliacao clinica',
    dominio: 'clinica',
    schemaVersion: 1,
    formulaIds: ['avaliacao_clinica_has_2016_redflags_v1'],
    requiredFields: ['pressaoSistolica', 'pressaoDiastolica', 'frequenciaCardiaca', 'prioridadeCuidado'],
    supportsLongitudinalComparison: true,
    analytics: { label: 'Avaliacao Clinica', color: 'progress-gradient-rose' }
  },
  {
    tipo: 'alimentar',
    label: 'Avaliacao alimentar',
    dominio: 'nutricao',
    schemaVersion: 2,
    formulaIds: ['nova_percentual_distribuicao'],
    requiredFields: ['categorias'],
    supportsLongitudinalComparison: true,
    analytics: { label: 'Avaliacao Alimentar (NOVA)', color: 'progress-gradient-purple' }
  },
  {
    tipo: 'hidratacao',
    label: 'Hidratacao',
    dominio: 'nutricao',
    schemaVersion: 2,
    formulaIds: ['hidratacao_balanco_hidrico'],
    requiredFields: ['pesoAntesExercicio', 'pesoAposExercicio', 'duracaoExercicioMin', 'perdaPesoPercentual'],
    supportsLongitudinalComparison: true,
    analytics: { label: 'Hidratacao', color: 'progress-gradient-amber' }
  },
  {
    tipo: 'avaliacao_socioeconomica',
    label: 'Socioeconomica (EBIA)',
    dominio: 'social',
    schemaVersion: 2,
    formulaIds: ['ebia_14_itens'],
    requiredFields: ['temMenores', 'pontuacaoEBIA', 'classificacaoLabel'],
    supportsLongitudinalComparison: true,
    analytics: { label: 'Socioeconomica (EBIA)', color: 'progress-gradient-cyan' }
  },
  {
    tipo: 'fisioterapia',
    label: 'Fisioterapia',
    dominio: 'multiprofissional',
    schemaVersion: 2,
    formulaIds: ['fisioterapia_funcional_basica'],
    requiredFields: ['queixaPrincipal', 'intensidadeDor'],
    supportsLongitudinalComparison: true,
    analytics: { label: 'Fisioterapia', color: 'progress-gradient-rose' }
  },
  {
    tipo: 'psicologia',
    label: 'Psicologia',
    dominio: 'multiprofissional',
    schemaVersion: 2,
    formulaIds: ['psicologia_triagem_emocional'],
    requiredFields: ['objetivo', 'estresse'],
    supportsLongitudinalComparison: true,
    analytics: { label: 'Psicologia', color: 'progress-gradient-indigo' }
  },
  {
    tipo: 'exames_laboratoriais',
    label: 'Exames laboratoriais',
    dominio: 'clinica',
    schemaVersion: 1,
    formulaIds: ['lab_ref_range_v1'],
    requiredFields: ['painel', 'analitos'],
    supportsLongitudinalComparison: true,
    analytics: { label: 'Exames Laboratoriais', color: 'progress-gradient-cyan' }
  },
  {
    tipo: 'evolucao_retorno',
    label: 'Evolucao/retorno',
    dominio: 'anamnese',
    schemaVersion: 1,
    formulaIds: ['evolucao_adesao_score_v1'],
    requiredFields: ['adesaoPlanoAlimentar', 'adesaoAtividadeFisica', 'scoreAdesaoGeral'],
    supportsLongitudinalComparison: true,
    analytics: { label: 'Evolucao e Retorno', color: 'progress-gradient-amber' }
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
