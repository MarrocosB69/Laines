import {
  getEvaluationTypeLabelFromRegistry,
  normalizeEvaluationTypeToken
} from '../../constants/evaluationRegistry';

const STATUS_META = {
  finalizada: { label: 'Finalizada', tone: 'success' },
  pendente: { label: 'Pendente', tone: 'warning' },
  em_analise: { label: 'Em análise', tone: 'info' },
  aguardando_revisao: { label: 'Aguardando revisão', tone: 'info' },
  rascunho: { label: 'Rascunho', tone: 'neutral' },
  falta: { label: 'Falta', tone: 'danger' },
  sem_registro: { label: 'Sem registro', tone: 'neutral' }
};

const normalizeToken = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_');

const toSentenceCase = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return 'Nao informado';
  return `${raw.charAt(0).toUpperCase()}${raw.slice(1)}`;
};

export const getEvaluationTypeLabel = (value) => {
  const key = normalizeEvaluationTypeToken(value);
  if (!key) return 'Nao informado';
  return getEvaluationTypeLabelFromRegistry(key) || toSentenceCase(String(value).replace(/_/g, ' '));
};

export const getEvaluationStatusLabel = (value) => {
  const key = normalizeToken(value);
  if (!key) return STATUS_META.sem_registro.label;
  return STATUS_META[key]?.label || toSentenceCase(String(value).replace(/_/g, ' '));
};

export const getEvaluationStatusTone = (value) => {
  const key = normalizeToken(value);
  return STATUS_META[key]?.tone || 'neutral';
};

// Glossário do WI-013 para a faixa de disponibilidade energética, com os
// mesmos textos de ROTULO_CLASSIFICACAO_DE (triagem-reds-normalizer.ts). O
// token gravado não muda; valor fora do mapa volta como veio.
export const ENERGY_AVAILABILITY_LABELS = Object.freeze({
  otima: 'Disponibilidade energética adequada',
  risco_relativo: 'Disponibilidade energética reduzida',
  reds_estabelecido: 'Baixa disponibilidade energética'
});

export const formatEnergyAvailabilityClassification = (value) => {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  return ENERGY_AVAILABILITY_LABELS[normalizeToken(value)] || value;
};

// ─── module metrics ─────────────────────────────────────────────────────────

const EVAL_METRIC_SPECS = {
  bioimpedancia: [
    { label: '% Gordura',   unit: '%',    keys: ['percentualGordura', 'percentual_gordura'] },
    { label: 'Massa Magra', unit: 'kg',   keys: ['massaMagra', 'massa_magra'] },
    { label: 'TMB',         unit: 'kcal', keys: ['tmbKcal', 'tmb', 'taxa_metabolica_basal'] },
  ],
  dobras_cutaneas: [
    { label: '% Gordura',   unit: '%',  keys: ['percentualGordura', 'percentual_gordura'] },
    { label: 'Soma Dobras', unit: 'mm', keys: ['somaSeteDobras', 'somaDobras', 'soma_dobras'] },
    { label: 'Massa Magra', unit: 'kg', keys: ['massaMagra', 'massa_magra'] },
  ],
  perimetros: [
    { label: 'IMC',     unit: '',   keys: ['imc'] },
    { label: 'Cintura', unit: 'cm', keys: ['cinturaCm', 'cintura', 'cintura_cm'] },
    { label: 'RCQ',     unit: '',   keys: ['rcq'] },
  ],
  composicao_corporal_integrada: [
    { label: '% Gordura',   unit: '%',  keys: ['percentualGorduraOficial', 'percentualGordura', 'percentual_gordura'] },
    { label: 'Massa Magra', unit: 'kg', keys: ['massaMagraOficialKg', 'massaMagraKg', 'massa_magra'] },
    { label: 'Diagnóstico', unit: '',   keys: ['diagnosticoNutricional', 'classificacaoComposicao', 'classificacao'] },
  ],
  gasto_energetico_total: [
    { label: 'GET',        unit: 'kcal', keys: ['getEstimadoKcal', 'get_estimado', 'getKcal'] },
    { label: 'TMB Base',   unit: 'kcal', keys: ['tmbBaseKcal', 'tmb_base', 'tmb'] },
    { label: 'Fator Ativ', unit: '',     keys: ['fatorAtividade', 'fator_atividade'] },
  ],
  anamnese_inicial: [
    { label: 'Queixa',     unit: '', keys: ['queixaPrincipal', 'queixa_principal'] },
    { label: 'Risco',      unit: '', keys: ['scoreRisco', 'score_risco'] },
    { label: 'Prioridade', unit: '', keys: ['prioridade', 'prioridadeCuidado'] },
  ],
  avaliacao_clinica: [
    { label: 'PA',           unit: 'mmHg', keys: ['pressaoArterial', 'pressao_arterial'] },
    { label: 'FC',           unit: 'bpm',  keys: ['frequenciaCardiaca', 'frequencia_cardiaca'] },
    { label: 'Classificação', unit: '',    keys: ['classificacaoHAS', 'classificacao_has', 'prioridadeCuidado'] },
  ],
  alimentar: [
    { label: 'Energia',  unit: 'kcal', keys: ['energiaTotalKcal', 'energia_total', 'total_kcal'] },
    { label: '% Ultra',  unit: '%',    keys: ['percentualUltraprocessados', 'percentual_ultraprocessados'] },
    { label: 'Padrão',   unit: '',     keys: ['classificacaoPadrao', 'classificacao'] },
  ],
  hidratacao: [
    { label: 'Perda Híd.',    unit: '%',   keys: ['perdaPesoPercentual', 'perda_percentual'] },
    { label: 'Taxa sudorese', unit: 'L/h', keys: ['taxaSudorese', 'taxa_sudorese'] },
    { label: 'Classificação', unit: '',    keys: ['classificacaoHidratacao', 'classificacao_hidratacao'] },
  ],
  avaliacao_socioeconomica: [
    { label: 'EBIA',      unit: '', keys: ['classificacaoLabel', 'classificacao'] },
    { label: 'Pontuação', unit: '', keys: ['pontuacaoEBIA', 'pontuacao'] },
    { label: 'Nível',     unit: '', keys: ['nivel', 'faixa'] },
  ],
  psicologia: [
    { label: 'Objetivo', unit: '',    keys: ['objetivo', 'objetivoPrincipal'] },
    { label: 'Estresse',  unit: '/10', keys: ['estresse', 'nivelEstresse', 'estressePercebido'] },
    { label: 'Humor',     unit: '',    keys: ['humor', 'estadoHumor', 'classificacaoHumor'] },
  ],
  exames_laboratoriais: [
    { label: 'Analitos',  unit: '', keys: ['totalAnalitos', 'analitos_total'] },
    { label: 'Alterados', unit: '', keys: ['totalAlterados', 'alterados_total'] },
    { label: 'Painel',    unit: '', keys: ['painel'] },
  ],
  evolucao_retorno: [
    { label: 'Adesão',       unit: '%', keys: ['scoreAdesaoGeral', 'score_adesao'] },
    { label: 'Próx. retorno', unit: '', keys: ['proximaAvaliacao', 'dataRetorno'] },
    { label: 'Conduta',      unit: '',  keys: ['conduta'] },
  ],
  triagem_reds: [
    { label: 'Classif. DE', unit: '', keys: ['classificacaoDE', 'disponibilidadeEnergetica'], format: formatEnergyAvailabilityClassification },
    { label: 'Score LEAF-Q', unit: '', keys: ['scoreLeafQ', 'score_leafq'] },
    { label: 'Risco Disp. Energetica',  unit: '', keys: ['riscoReds', 'risco_reds', 'classificacaoReds'] },
  ],
  carga_treino: [
    { label: 'ACWR',        unit: '', keys: ['acwr'] },
    { label: 'Fase',        unit: '', keys: ['faseAtual', 'fase_atual'] },
    { label: 'Sessões/sem', unit: '', keys: ['sessoesSemana', 'sessoes_semana'] },
  ],
};

const _evalSources = (ev) => [
  ev?.resultados?.calculated,
  ev?.resultados?.output,
  ev?.resultados,
  ev?.dados?.resultados_calculados,
  ev?.dados?.resultados?.calculated,
  ev?.dados?.resultados,
  ev?.dados,
  ev,
].filter(Boolean);

const _readEvalValue = (ev, keys) => {
  const sources = _evalSources(ev);
  for (const key of keys) {
    for (const src of sources) {
      if (Object.prototype.hasOwnProperty.call(src, key)) {
        const v = src[key];
        if (v !== null && v !== undefined && String(v).trim() !== '') return v;
      }
    }
  }
  return null;
};

const _fmtMetric = (value, unit) => {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const n = Number(String(value).replace(',', '.'));
  if (Number.isFinite(n)) {
    const precision = Math.abs(n) >= 100 ? 0 : 1;
    return unit ? `${n.toFixed(precision)} ${unit}` : n.toFixed(precision);
  }
  return unit ? `${value} ${unit}` : String(value);
};

export const getModuleMetrics = (tipo, evaluation) => {
  if (!evaluation) return [];
  const specs = EVAL_METRIC_SPECS[tipo];
  if (!specs) return [];
  return specs
    .map((spec) => {
      const raw = _readEvalValue(evaluation, spec.keys);
      const value = spec.format ? spec.format(raw) : raw;
      const formatted = _fmtMetric(value, spec.unit);
      return formatted ? { label: spec.label, formatted } : null;
    })
    .filter(Boolean);
};
