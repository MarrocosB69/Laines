import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Apple,
  Brain,
  Camera,
  ChevronDown,
  ChevronRight,
  Droplets,
  Dumbbell,
  FileSpreadsheet,
  FlaskConical,
  HeartPulse,
  PersonStanding,
  RefreshCcw,
  Ruler,
  Scale,
  ShieldCheck,
  Zap
} from 'lucide-react';
import { AvaliacaoImagem } from '../Avaliacoes/avaliacao-imagem/AvaliacaoImagem';
import { Line, LineChart, ResponsiveContainer } from 'recharts';
import { EVALUATION_REGISTRY, getVisibleTypesForUser } from '../../constants/evaluationRegistry';
import {
  formatEnergyAvailabilityClassification,
  getEvaluationTypeLabel
} from '../shared/evaluationSummaryUtils';
import { formatAcwrZone, formatTrainingPhase } from '../shared/evaluationResultAdapter';
import { useAuth } from '../../contexts/AuthContext';
import { FeedbackState } from '../ui';
import { clinicalDate, eligibleEvaluations } from './prontuarioOverview';

const ICONS_BY_TYPE = {
  bioimpedancia: Scale,
  dobras_cutaneas: Activity,
  perimetros: Ruler,
  gasto_energetico_total: Activity,
  anamnese_inicial: FileSpreadsheet,
  avaliacao_clinica: HeartPulse,
  alimentar: Apple,
  hidratacao: Droplets,
  avaliacao_socioeconomica: ShieldCheck,
  fisioterapia: PersonStanding,
  psicologia: Brain,
  exames_laboratoriais: FlaskConical,
  evolucao_retorno: RefreshCcw,
  composicao_corporal_imagem: Camera,
  carga_treino: Dumbbell,
  triagem_reds: Zap,
};

// Carga semanal 0 é o que o cálculo grava quando não há sessão válida; o
// próprio formulário a trata como "não calculada". Aqui ela vira ausência.
const positiveOrNull = (value) => {
  const numeric = toNumber(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
};

const METRIC_SPECS = {
  bioimpedancia: [
    { label: '% Gordura', unit: '%', keys: ['percentual_gordura', 'percentualGordura'] },
    { label: 'Massa Magra', unit: 'kg', keys: ['massa_magra', 'massaMagra'] },
    { label: 'TMB', unit: 'kcal', keys: ['tmb', 'taxa_metabolica_basal', 'tmbKcal'] }
  ],
  dobras_cutaneas: [
    { label: '% Gordura', unit: '%', keys: ['percentual_gordura', 'percentualGordura'] },
    { label: 'Soma Dobras', unit: 'mm', keys: ['soma_dobras', 'somaSeteDobras', 'somaDobras'] },
    { label: 'Massa Magra', unit: 'kg', keys: ['massa_magra', 'massaMagra'] }
  ],
  perimetros: [
    { label: 'IMC', unit: '', keys: ['imc'] },
    { label: 'Cintura', unit: 'cm', keys: ['cintura', 'cintura_cm'] },
    { label: 'RCQ', unit: '', keys: ['rcq'] }
  ],
  gasto_energetico_total: [
    { label: 'GET', unit: 'kcal', keys: ['getEstimadoKcal', 'get_estimado', 'getKcal'] },
    { label: 'TMB Base', unit: 'kcal', keys: ['tmbBaseKcal', 'tmb_base', 'tmb'] },
    { label: 'Formula', unit: '', keys: ['formulaId', 'formula_id'] }
  ],
  anamnese_inicial: [
    { label: 'Queixa', unit: '', keys: ['queixaPrincipal', 'queixa_principal'] },
    { label: 'Risco', unit: '', keys: ['scoreRisco', 'score_risco'] },
    { label: 'Prioridade', unit: '', keys: ['prioridade', 'prioridadeCuidado'] }
  ],
  avaliacao_clinica: [
    { label: 'PA', unit: 'mmHg', keys: ['pressao_arterial', 'pressaoArterial'] },
    { label: 'FC', unit: 'bpm', keys: ['frequencia_cardiaca', 'frequenciaCardiaca'] },
    { label: 'HAS', unit: '', keys: ['classificacao_has', 'classificacaoHAS'] }
  ],
  alimentar: [
    { label: 'Kcal', unit: 'kcal', keys: ['energia_total', 'energiaTotalKcal', 'total_kcal'] },
    { label: '% Ultra', unit: '%', keys: ['percentual_ultraprocessados', 'percentualUltraprocessados'] },
    { label: 'Padrao', unit: '', keys: ['classificacao', 'classificacaoPadrao'] }
  ],
  hidratacao: [
    { label: 'Perda Hidrica', unit: '%', keys: ['perda_percentual', 'perdaPesoPercentual'] },
    { label: 'Taxa sudorese', unit: 'L/h', keys: ['taxa_sudorese', 'taxaSudorese'] },
    { label: 'Classificacao', unit: '', keys: ['classificacao_hidratacao', 'classificacaoHidratacao'] }
  ],
  avaliacao_socioeconomica: [
    { label: 'EBIA', unit: '', keys: ['classificacaoLabel', 'classificacao'] },
    { label: 'Pontuacao', unit: '', keys: ['pontuacaoEBIA', 'pontuacao'] },
    { label: 'Faixa', unit: '', keys: ['faixa', 'nivel'] }
  ],
  fisioterapia: [
    { label: 'Queixa', unit: '', keys: ['queixaPrincipal', 'queixa_principal'] },
    { label: 'Dor', unit: '/10', keys: ['intensidadeDor', 'intensidade_dor', 'nivelDor'] },
    { label: 'Funcional', unit: '', keys: ['classificacaoFuncional', 'nivelFuncional', 'funcionalidade'] }
  ],
  psicologia: [
    { label: 'Objetivo', unit: '', keys: ['objetivo', 'objetivoPrincipal'] },
    { label: 'Estresse', unit: '/10', keys: ['estresse', 'nivelEstresse', 'estressePercebido'] },
    { label: 'Humor', unit: '', keys: ['humor', 'estadoHumor', 'classificacaoHumor'] }
  ],
  exames_laboratoriais: [
    { label: 'Analitos', unit: '', keys: ['totalAnalitos', 'analitos_total'] },
    { label: 'Alterados', unit: '', keys: ['totalAlterados', 'alterados_total'] },
    { label: 'Painel', unit: '', keys: ['painel'] }
  ],
  evolucao_retorno: [
    { label: 'Aplicação da Dieta', unit: '%', keys: ['scoreAdesaoGeral', 'score_adesao'] },
    { label: 'Data', unit: '', keys: ['proximaAvaliacao', 'dataRetorno'] },
    { label: 'Conduta', unit: '', keys: ['conduta'] }
  ],
  composicao_corporal_imagem: [
    { label: 'Gordura estimada', unit: '%', keys: ['percGordura', 'perc_gordura_estimado', 'percentualGordura'] },
    { label: 'Massa magra estimada', unit: 'kg', keys: ['massaMagra', 'massa_magra_kg'] },
    { label: 'RCQ estimada', unit: '', keys: ['rcq'] }
  ],
  // `format` só traduz o valor gravado em texto; `optional` some sem valor.
  carga_treino: [
    { label: 'ACWR', unit: '', keys: ['acwr'], digits: 2 },
    { label: 'Carga da semana', unit: 'UA', keys: ['cargaSemanaAtual'], format: positiveOrNull },
    { label: 'Zona do ACWR', unit: '', keys: ['classificacaoAcwr'], format: formatAcwrZone },
    { label: 'Fase', unit: '', keys: ['faseAtual', 'fase_atual'], format: formatTrainingPhase, optional: true }
  ],
  triagem_reds: [
    {
      label: 'Disponibilidade energética',
      unit: 'kcal/kg MLG/dia',
      keys: ['disponibilidadeEnergetica', 'disponibilidade_energetica', 'DE']
    },
    {
      label: 'Classificação',
      unit: '',
      keys: ['classificacaoDE', 'classificacao_de'],
      format: formatEnergyAvailabilityClassification
    }
  ]
};

const PRONTUARIO_SUMMARY_TYPES = Object.freeze({
  CLINICA: 'avaliacao_clinica',
  ANAMNESE: 'anamnese_inicial',
  GET: 'gasto_energetico_total',
  // Módulo aberto pelo cartão "Composição" enquanto não há avaliação de
  // composição; com registro, o cartão segue COMPOSICAO_SOURCES.
  COMPOSICAO: 'bioimpedancia',
  PSICOLOGIA: 'psicologia'
});

// O cartão "Composição" mostra a avaliação mais recente destes tipos, inteira
// e com a fonte escrita. Não mistura valores de fontes diferentes: cada
// avaliação é independente (WI-007).
const COMPOSICAO_SOURCES = Object.freeze([
  { type: 'bioimpedancia', label: 'Bioimpedância' },
  { type: 'dobras_cutaneas', label: 'Dobras cutâneas' },
  { type: 'perimetros', label: 'Perímetros' },
  { type: 'composicao_corporal_integrada', label: 'Composição corporal integrada' }
]);

const toToken = (value) => String(value || '').trim().toLowerCase().normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/\s+/g, '_');

const toNumber = (value) => {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = Number(String(value).replace(',', '.').trim());
  return Number.isFinite(parsed) ? parsed : null;
};

const toDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value?.toDate === 'function') return value.toDate();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const readPath = (source, path) => {
  if (!source || !path) return undefined;
  return path.split('.').reduce((acc, key) => (
    acc === null || acc === undefined ? undefined : acc[key]
  ), source);
};

const getResultSources = (evaluation) => {
  const resultados = evaluation?.resultados;
  if (!resultados || typeof resultados !== 'object') return [];
  return [resultados?.calculated, resultados?.output, resultados]
    .filter((item) => item && typeof item === 'object');
};

const readResultValue = (evaluation, keys = []) => {
  const sources = getResultSources(evaluation);
  for (const key of keys) {
    for (const source of sources) {
      const value = key.includes('.') ? readPath(source, key) : source?.[key];
      if (value !== null && value !== undefined && String(value).trim() !== '') {
        return value;
      }
    }
  }
  return null;
};

const toStringList = (value) => {
  if (Array.isArray(value)) {
    return value
      .flatMap((item) => toStringList(item))
      .map((item) => String(item || '').trim())
      .filter(Boolean);
  }
  if (value && typeof value === 'object') {
    const named = value.nome || value.name || value.label || value.descricao || value.description || value.valor;
    if (named) return [String(named).trim()];
    return Object.entries(value)
      .filter(([, item]) => Boolean(item))
      .map(([key]) => String(key || '').trim())
      .filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(/[;,|]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  if (typeof value === 'number' && Number.isFinite(value)) return [String(value)];
  return [];
};

const formatListPreview = (items = []) => {
  if (!items.length) return 'Sem registro';
  if (items.length <= 2) return items.join(' · ');
  return `${items.slice(0, 2).join(' · ')} +${items.length - 2}`;
};

const resolveVitalTone = (metric, value) => {
  if (!Number.isFinite(value)) return 'neutral';
  if (metric === 'pas') {
    if (value < 90 || value >= 140) return 'danger';
    if (value >= 120) return 'warn';
    return 'ok';
  }
  if (metric === 'pad') {
    if (value < 60 || value >= 90) return 'danger';
    if (value >= 80) return 'warn';
    return 'ok';
  }
  if (metric === 'fc') {
    if (value < 50 || value > 120) return 'danger';
    if (value > 100) return 'warn';
    return 'ok';
  }
  if (metric === 'temperatura') {
    if (value < 35 || value >= 38) return 'danger';
    if (value >= 37.5) return 'warn';
    return 'ok';
  }
  return 'neutral';
};

const resolveRiskTone = (value, { inverted = false } = {}) => {
  const numeric = toNumber(value);
  if (Number.isFinite(numeric)) {
    if (inverted) {
      if (numeric <= 3) return 'danger';
      if (numeric <= 6) return 'warn';
      return 'ok';
    }
    if (numeric >= 7) return 'danger';
    if (numeric >= 4) return 'warn';
    return 'ok';
  }

  const token = toToken(value);
  if (!token) return 'neutral';
  if (inverted) {
    if (token.includes('baixa') || token.includes('baixo')) return 'danger';
    if (token.includes('moderada') || token.includes('media')) return 'warn';
    if (token.includes('alta') || token.includes('alto')) return 'ok';
    return 'neutral';
  }

  if (token.includes('alto') || token.includes('grave') || token.includes('critico')) return 'danger';
  if (token.includes('moderado') || token.includes('medio') || token.includes('atencao')) return 'warn';
  if (token.includes('baixo') || token.includes('leve') || token.includes('normal')) return 'ok';
  return 'neutral';
};

const resolveLatestByType = (groupedByType, type) => {
  const aliases = type === PRONTUARIO_SUMMARY_TYPES.PSICOLOGIA
    ? [PRONTUARIO_SUMMARY_TYPES.PSICOLOGIA, 'avaliacao_psicologica']
    : [type];
  for (const alias of aliases) {
    const row = groupedByType.get(alias)?.[0];
    if (row) return row;
  }
  return null;
};

// Mesma data e mesma ordem dos outros cartões do resumo (createdAt, data,
// updatedAt). Empate fica com a fonte que vem antes em COMPOSICAO_SOURCES.
const summaryTime = (row) => toDate(row?.createdAt || row?.data || row?.updatedAt)?.getTime() || 0;

const resolveLatestComposition = (groupedByType) => COMPOSICAO_SOURCES.reduce((latest, source) => {
  const row = groupedByType.get(source.type)?.[0];
  if (!row) return latest;
  if (latest && summaryTime(latest.row) >= summaryTime(row)) return latest;
  return { ...source, row };
}, null);

const getEvaluationSources = (evaluation) => ([
  evaluation?.resultados_calculados,
  evaluation?.resultados?.calculated,
  evaluation?.resultados,
  evaluation?.dados?.resultados_calculados,
  evaluation?.dados?.resultados?.calculated,
  evaluation?.dados?.resultados,
  evaluation?.dados,
  evaluation?.meta,
  evaluation
].filter(Boolean));

const readMetricValue = (evaluation, keys = []) => {
  const sources = getEvaluationSources(evaluation);
  for (const key of keys) {
    for (const source of sources) {
      if (Object.prototype.hasOwnProperty.call(source, key)) {
        const value = source[key];
        if (value !== null && value !== undefined && String(value).trim() !== '') {
          return value;
        }
      }
    }
  }
  return null;
};

const hasMetricValue = (value) => (
  value !== null && value !== undefined && String(value).trim() !== ''
);

const renderValue = (value, unit = '', digits) => {
  if (!hasMetricValue(value)) return '--';
  const numeric = toNumber(value);
  if (Number.isFinite(numeric)) {
    const precision = Number.isInteger(digits) ? digits : Math.abs(numeric) >= 1000 ? 0 : 1;
    const formatted = numeric.toLocaleString('pt-BR', {
      minimumFractionDigits: precision,
      maximumFractionDigits: precision
    });
    return unit ? `${formatted} ${unit}` : formatted;
  }
  return String(value);
};

const readCompositionMetric = (evaluation, keys, paths = []) => {
  const direct = toNumber(readMetricValue(evaluation, keys));
  if (Number.isFinite(direct)) return direct;
  for (const path of paths) {
    const nested = toNumber(readPath(evaluation, path));
    if (Number.isFinite(nested)) return nested;
  }
  return null;
};

const computeDelta = (currentValue, previousValue, unit = '') => {
  const current = toNumber(currentValue);
  const previous = toNumber(previousValue);
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous === 0) return null;
  const deltaAbs = current - previous;
  const deltaPct = (deltaAbs / Math.abs(previous)) * 100;
  const signal = deltaAbs >= 0 ? '+' : '-';
  const tone = deltaAbs >= 0 ? 'up' : 'down';
  const unitSuffix = unit ? ` ${unit}` : '';
  return {
    tone,
    label: `${signal}${Math.abs(deltaAbs).toFixed(1)}${unitSuffix} (${Math.abs(deltaPct).toFixed(1)}%)`
  };
};

const resolveCardStatus = (evaluation) => {
  if (!evaluation) return 'nao_realizada';
  if (evaluation?.meta?.aguardandoRevisao) return 'aguardando_revisao';
  const token = toToken(evaluation.status);
  if (['finalizada', 'concluida', 'realizada'].includes(token)) return 'realizada';
  if (token === 'rascunho') return 'rascunho';
  return 'pendente';
};

const statusClassMap = {
  realizada:          'pron-card-avaliacao--realizada',
  aguardando_revisao: 'pron-card-avaliacao--aguardando',
  rascunho:           'pron-card-avaliacao--rascunho',
  pendente:           'pron-card-avaliacao--pendente',
  nao_realizada:      'pron-card-avaliacao--nao-realizada'
};

const STATUS_BADGE = {
  realizada:          { cls: 'pron-badge-ok',   label: 'Finalizada' },
  aguardando_revisao: { cls: 'pron-badge--info', label: 'Aguardando revisão' },
  rascunho:           { cls: 'pron-badge-muted pron-badge--rascunho', label: 'Rascunho' },
  pendente:           { cls: 'pron-badge-warn', label: 'Pendente' },
  nao_realizada:      { cls: 'pron-badge-muted', label: 'Não iniciada' },
};

const STATUS_ACTION_LABEL = {
  realizada:          'Ver detalhes',
  aguardando_revisao: 'Ver envio do atleta',
  rascunho:           'Continuar rascunho',
  pendente:           'Iniciar avaliação',
  nao_realizada:      'Iniciar avaliação',
};

const buildSparklineData = (rows = [], metricKeys = []) => rows
  .slice()
  .sort((a, b) => {
    const aDate = toDate(a.createdAt || a.data || a.updatedAt)?.getTime() || 0;
    const bDate = toDate(b.createdAt || b.data || b.updatedAt)?.getTime() || 0;
    return aDate - bDate;
  })
  .map((row) => ({
    date: toDate(row.createdAt || row.data || row.updatedAt),
    value: toNumber(readMetricValue(row, metricKeys))
  }))
  .filter((row) => Number.isFinite(row.value))
  .slice(-6)
  .map((row, index) => ({ x: index + 1, y: row.value }));

const AvaliacaoCard = ({ card, formatDate, onOpenEvaluationType }) => {
  const Icon = ICONS_BY_TYPE[card.type] || Activity;
  const isImageEvaluation = card.type === 'composicao_corporal_imagem';
  const imageEntry = isImageEvaluation && card.status === 'nao_realizada';
  const actionLabel = imageEntry
    ? card.canEdit ? 'Abrir avaliação por imagem' : 'Consultar imagens'
    : STATUS_ACTION_LABEL[card.status] || 'Ver detalhes';

  const handleClick = () => {
    onOpenEvaluationType?.(card.type);
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onOpenEvaluationType?.(card.type);
    }
  };

  const hasRecord = card.status !== 'nao_realizada';

  return (
    <article
      className={`pron-avaliacao-card status-${card.status} ${statusClassMap[card.status] || ''} pron-card--interactive`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      aria-label={`${card.label} — ${imageEntry ? 'Módulo de imagem' : (STATUS_BADGE[card.status] || STATUS_BADGE.nao_realizada).label} — ${actionLabel}`}
    >
      <header className="pron-avaliacao-card__header">
        <div className="pron-title-inline">
          <Icon size={18} aria-hidden="true" />
          <strong>{card.label}</strong>
        </div>
        <div className="pron-avaliacao-card__badges">
          {card.isAthleteSubmission && (
            <span className="pron-badge pron-badge--athlete-tag">Atleta</span>
          )}
          {isImageEvaluation && <span className="pron-badge pron-badge--image-experimental">Experimental</span>}
          <span className={`pron-badge ${(STATUS_BADGE[card.status] || STATUS_BADGE.nao_realizada).cls}`}>
            {imageEntry ? 'Módulo de imagem' : (STATUS_BADGE[card.status] || STATUS_BADGE.nao_realizada).label}
          </span>
        </div>
      </header>

      {hasRecord && <div className="pron-avaliacao-metrics">
        {card.metrics.length ? card.metrics.map((metric, index) => (
          <div
            key={`${card.type}-${metric.label}`}
            className={`pron-avaliacao-metric ${index === 0 ? 'pron-avaliacao-metric--primary' : ''} ${!hasMetricValue(metric.value) ? 'is-empty' : ''}`}
          >
            <span>{metric.label}</span>
            <strong>{renderValue(metric.value, metric.unit, metric.digits)}</strong>
          </div>
        )) : (
          <span className="pron-text-muted">Sem indicadores configurados.</span>
        )}
      </div>}

      {hasRecord && <footer className="pron-avaliacao-card__footer">
        <span>Última: {card.latestDate ? formatDate(card.latestDate) : '--'}</span>
        {card.delta ? (
          <span className={`pron-delta ${card.delta.tone}`}>{card.delta.label}</span>
        ) : (
          <span className="pron-text-muted">{isImageEvaluation ? 'Sem comparação clínica' : 'Sem comparativo anterior'}</span>
        )}
      </footer>}

      <div className="pron-avaliacao-card__actions">
        <span className="pron-link-btn">
          {actionLabel}
        </span>
      </div>
    </article>
  );
};

const SUMMARY_BADGE_CLASS = {
  danger: 'pron-badge--danger',
  warn: 'pron-badge--warn',
  ok: 'pron-badge--ok',
  info: 'pron-badge--info',
  neutral: 'pron-badge--neutral'
};

const ProntuarioResumoCard = ({ card, formatDate, onOpenEvaluationType }) => {
  const handleOpen = () => {
    onOpenEvaluationType?.(card.openType || card.type);
  };

  return (
    <article className={`pron-prontuario-resumo-card ${card.hasData ? '' : 'is-empty'}`}>
      <header className="pron-prontuario-resumo-card__header">
        <div>
          <h3>{card.title}</h3>
          <p>
            {card.sourceLabel
              ? `Fonte: ${card.sourceLabel} · ${card.latestDate ? formatDate(card.latestDate) : 'data não informada'}`
              : card.subtitle}
          </p>
        </div>
        <span className={`pron-badge ${card.hasData ? 'pron-badge-ok' : 'pron-badge-muted'}`}>
          {card.hasData ? 'Atualizado' : 'Sem dados'}
        </span>
      </header>

      {card.kind === 'vitals' && (
        <div className="pron-prontuario-vitals-grid">
          {card.metrics.map((metric) => (
            <div key={metric.key} className={`pron-prontuario-vital tone-${metric.tone}`}>
              <span>{metric.label}</span>
              <strong>{renderValue(metric.value, metric.unit)}</strong>
              <i className={`pron-prontuario-vital-dot tone-${metric.tone}`} aria-hidden="true" />
            </div>
          ))}
        </div>
      )}

      {card.kind === 'anamnese' && (
        <div className="pron-prontuario-badge-grid">
          {card.badges.map((badge) => (
            <span key={badge.id} className={`pron-badge ${SUMMARY_BADGE_CLASS[badge.tone] || SUMMARY_BADGE_CLASS.neutral}`}>
              {badge.label}: {badge.preview}
            </span>
          ))}
        </div>
      )}

      {card.kind === 'get' && (
        <div className="pron-prontuario-get-widget">
          <div className="pron-prontuario-get-kcal">
            <span>GET estimado</span>
            <strong>{renderValue(card.getKcal, 'kcal')}</strong>
          </div>
          <div className="pron-prontuario-macros-grid">
            {card.macros.map((macro) => {
              const numeric = toNumber(macro.value);
              const width = Number.isFinite(numeric) ? Math.max(0, Math.min(100, numeric)) : 0;
              return (
                <div key={macro.key} className="pron-prontuario-macro-row">
                  <div className="pron-prontuario-macro-head">
                    <span>{macro.label}</span>
                    <strong>{renderValue(macro.value, '%')}</strong>
                  </div>
                  <div className="pron-prontuario-macro-bar">
                    <div style={{ width: `${width}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {card.kind === 'composicao' && (
        <div className="pron-prontuario-composicao-grid">
          {card.metrics.map((metric) => (
            <div key={metric.key} className="pron-prontuario-composicao-metric">
              <span>{metric.label}</span>
              <strong>{renderValue(metric.value, metric.unit, metric.digits)}</strong>
            </div>
          ))}
          <div className="pron-prontuario-composicao-diagnostico">
            <span>Diagnóstico nutricional</span>
            <strong>{card.diagnostico || 'Sem classificação'}</strong>
          </div>
        </div>
      )}

      {card.kind === 'psicologia' && (
        <div className="pron-prontuario-badge-grid">
          {card.badges.map((badge) => (
            <span key={badge.id} className={`pron-badge ${SUMMARY_BADGE_CLASS[badge.tone] || SUMMARY_BADGE_CLASS.neutral}`}>
              {badge.label}: {badge.value}
            </span>
          ))}
        </div>
      )}

      <footer className="pron-prontuario-resumo-card__footer">
        <span>Última avaliação: {card.latestDate ? formatDate(card.latestDate) : '--'}</span>
        <button type="button" className="pron-link-btn" onClick={handleOpen}>
          Ver módulo
        </button>
      </footer>
    </article>
  );
};

const DashboardAvaliacoes = ({
  /**
   * Blocos desligados por padrão.
   *
   * "Resumo clínico do prontuário" e "Painel de avaliações" respondiam à mesma
   * pergunta — o estado atual por tipo — com cartões diferentes, um embaixo do
   * outro. E "Evolução temporal" repetia os gráficos da aba Evoluções.
   *
   * Ficam como opção em vez de serem apagados: se a equipe sentir falta, é uma
   * prop, não um resgate de código removido.
   */
  mostrarResumoClinico = false,
  mostrarEvolucaoTemporal = false,

  patient,
  avaliacoes = [],
  editableTypes = new Set(),
  canCreateEvaluation = false,
  canManagePatient = false,
  consultationStatusSummary = {},
  nextAppointment,
  formatDate,
  onOpenEvaluationType,
  onCreateEvaluation,
  openImageRequest = 0,
  onImageClose
}) => {
  const { user } = useAuth();
  const [naoIniciadasExpanded, setNaoIniciadasExpanded] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [catalogStatus, setCatalogStatus] = useState('all');
  const [avaliacaoImagemOpen, setAvaliacaoImagemOpen] = useState(false);

  useEffect(() => {
    if (openImageRequest > 0) setAvaliacaoImagemOpen(true);
  }, [openImageRequest]);

  const handleOpenEvaluationType = useCallback((type) => {
    if (type === 'composicao_corporal_imagem') {
      setAvaliacaoImagemOpen(true);
      return;
    }
    onOpenEvaluationType?.(type);
  }, [onOpenEvaluationType]);

  const canEditType = useCallback((type) => (
    canManagePatient || (canCreateEvaluation && editableTypes.has(type))
  ), [canCreateEvaluation, canManagePatient, editableTypes]);

  const sortedEvaluations = useMemo(() => (
    avaliacoes.filter((row) => !row.deletedAt && String(row.pacienteId) === String(patient?.id)).sort((a, b) => {
      const aDate = toDate(a.createdAt || a.data || a.updatedAt)?.getTime() || 0;
      const bDate = toDate(b.createdAt || b.data || b.updatedAt)?.getTime() || 0;
      return bDate - aDate;
    })
  ), [avaliacoes, patient?.id]);

  const byType = useMemo(() => {
    const map = new Map();
    sortedEvaluations.forEach((row) => {
      const type = toToken(row.tipo);
      if (!type) return;
      if (!map.has(type)) map.set(type, []);
      map.get(type).push(row);
    });
    return map;
  }, [sortedEvaluations]);

  const eligibleByType = useMemo(() => {
    const map = new Map();
    eligibleEvaluations(sortedEvaluations, patient?.id).forEach((row) => {
      const type = toToken(row.tipo);
      if (!map.has(type)) map.set(type, []);
      map.get(type).push(row);
    });
    return map;
  }, [patient?.id, sortedEvaluations]);

  const lastEvaluationDate = useMemo(
    () => toDate(sortedEvaluations[0]?.createdAt || sortedEvaluations[0]?.data || sortedEvaluations[0]?.updatedAt),
    [sortedEvaluations]
  );

  const visibleRegistry = useMemo(() => {
    const visibleTypes = getVisibleTypesForUser(user, patient);
    return EVALUATION_REGISTRY.filter((e) => visibleTypes.has(e.type));
  }, [patient, user]);

  const cards = useMemo(() => visibleRegistry.map((registryItem) => {
    const rows = byType.get(registryItem.type) || [];
    const latest = rows[0] || null;
    if (!latest && !canEditType(registryItem.type) && registryItem.type !== 'composicao_corporal_imagem') return null;
    const previous = rows[1] || null;
    const specs = METRIC_SPECS[registryItem.type] || [];
    const readSpec = (spec, row) => {
      const value = readMetricValue(row, spec.keys);
      return spec.format ? spec.format(value) : value;
    };
    const metrics = specs.map((spec) => ({
      ...spec,
      value: readSpec(spec, latest),
      previousValue: readSpec(spec, previous)
    })).filter((metric) => !metric.optional || hasMetricValue(metric.value));
    const delta = metrics.length > 0 && registryItem.type !== 'composicao_corporal_imagem'
      ? computeDelta(metrics[0].value, metrics[0].previousValue, metrics[0].unit)
      : null;
    const latestDate = toDate(latest?.createdAt || latest?.data || latest?.updatedAt);
    return {
      type: registryItem.type,
      label: registryItem.shortLabel || getEvaluationTypeLabel(registryItem.type),
      latest,
      metrics,
      delta,
      latestDate,
      status: resolveCardStatus(latest),
      canEdit: canEditType(registryItem.type),
      isAthleteSubmission: Boolean(
        latest?.meta?.atletaSelfReport || latest?.meta?.origemPreenchimento === 'atleta'
      )
    };
  }).filter(Boolean), [byType, canEditType, visibleRegistry]);

  const cardsComDados = useMemo(
    () => cards.filter((card) => card.status !== 'nao_realizada'),
    [cards]
  );
  const cardsNaoIniciados = useMemo(
    () => cards.filter((card) => card.status === 'nao_realizada'),
    [cards]
  );
  const normalizedSearch = toToken(catalogSearch);
  const filteredCards = useMemo(() => cards.filter((card) => {
    if (catalogStatus === 'com_registro' && card.status === 'nao_realizada') return false;
    if (catalogStatus === 'nao_iniciadas' && card.status !== 'nao_realizada') return false;
    return !normalizedSearch || toToken(`${card.label} ${card.type}`).includes(normalizedSearch);
  }), [cards, catalogStatus, normalizedSearch]);
  const filteredCardsComDados = filteredCards.filter((card) => card.status !== 'nao_realizada');
  const filteredCardsNaoIniciados = filteredCards.filter((card) => card.status === 'nao_realizada');
  const showInactiveResults = naoIniciadasExpanded || cardsComDados.length === 0
    || Boolean(normalizedSearch) || catalogStatus === 'nao_iniciadas';

  const dashboardSummary = useMemo(() => {
    const realizadas = cards.filter((item) => item.status === 'realizada').length;
    const pendentes = cards.filter((item) => item.status === 'pendente').length;
    const naoRealizadas = cards.filter((item) => item.status === 'nao_realizada').length;
    return { realizadas, pendentes, naoRealizadas };
  }, [cards]);

  const compositionSnapshot = useMemo(() => {
    const sourcePriority = [
      'composicao_corporal_integrada',
      'bioimpedancia',
      'dobras_cutaneas',
      'perimetros'
    ];
    for (const type of sourcePriority) {
      const row = (eligibleByType.get(type) || [])[0];
      if (!row) continue;
      const massaMagra = toNumber(readMetricValue(row, ['massaMagraOficialKg', 'massa_magra', 'massaMagra']));
      const massaGorda = toNumber(readMetricValue(row, ['massaGordaOficialKg', 'massa_gorda', 'massaGorda']));
      const percentualGordura = toNumber(readMetricValue(row, ['percentualGorduraOficial', 'percentual_gordura', 'percentualGordura']));
      const imc = toNumber(readMetricValue(row, ['imc']));
      const cintura = toNumber(readMetricValue(row, ['cintura', 'cintura_cm']));
      if (
        Number.isFinite(massaMagra)
        || Number.isFinite(massaGorda)
        || Number.isFinite(percentualGordura)
        || Number.isFinite(imc)
      ) {
        const totalMass = (Number.isFinite(massaMagra) ? massaMagra : 0) + (Number.isFinite(massaGorda) ? massaGorda : 0);
        const pctMagra = totalMass > 0 ? (massaMagra / totalMass) * 100 : Number.isFinite(percentualGordura) ? 100 - percentualGordura : null;
        const pctGorda = totalMass > 0 ? (massaGorda / totalMass) * 100 : Number.isFinite(percentualGordura) ? percentualGordura : null;
        return {
          sourceType: type,
          date: toDate(clinicalDate(row)),
          massaMagra,
          massaGorda,
          pctMagra,
          pctGorda,
          imc,
          cintura
        };
      }
    }
    return null;
  }, [eligibleByType]);

  const compositionMethods = useMemo(() => {
    const methods = [
      { id: 'bioimpedancia', label: 'Bioimpedância', row: eligibleByType.get('bioimpedancia')?.[0] },
      { id: 'dobras_cutaneas', label: 'Dobras cutâneas', row: eligibleByType.get('dobras_cutaneas')?.[0] },
      {
        id: 'dexa', label: 'DEXA',
        row: [...eligibleByType.values()].flat().find((evaluation) => {
          const type = toToken(evaluation.tipo);
          return type.includes('dexa') || type.includes('dxa');
        })
      }
    ];
    return methods.map(({ id, label, row }) => {
      if (!row) return null;
      const percentFat = readCompositionMetric(row,
        ['percentual_gordura', 'percentualGordura', 'percentFat'],
        ['dados.dados_brutos.percentFat']);
      const leanMass = readCompositionMetric(row,
        ['massa_magra', 'massaMagra', 'massaMagraKg', 'leanMassKg'],
        ['dados.dados_brutos.leanMassKg']);
      if (!Number.isFinite(percentFat) && !Number.isFinite(leanMass)) return null;
      return {
        id, label, percentFat, leanMass,
        date: toDate(clinicalDate(row))
      };
    }).filter(Boolean);
  }, [eligibleByType]);

  const clinicalTrendEvaluations = useMemo(() => sortedEvaluations.filter(
    (row) => row.tipo !== 'composicao_corporal_imagem'
  ), [sortedEvaluations]);

  const weightSparkline = useMemo(
    () => buildSparklineData(clinicalTrendEvaluations, ['peso', 'weight', 'peso_kg']),
    [clinicalTrendEvaluations]
  );
  const fatSparkline = useMemo(
    () => buildSparklineData(clinicalTrendEvaluations, ['percentual_gordura', 'percentualGordura', 'percentualGorduraOficial']),
    [clinicalTrendEvaluations]
  );
  const leanSparkline = useMemo(
    () => buildSparklineData(clinicalTrendEvaluations, ['massa_magra', 'massaMagra', 'massaMagraOficialKg']),
    [clinicalTrendEvaluations]
  );

  const latestWeight = weightSparkline.length ? weightSparkline[weightSparkline.length - 1].y : null;
  const latestFat = fatSparkline.length ? fatSparkline[fatSparkline.length - 1].y : null;
  const latestLean = leanSparkline.length ? leanSparkline[leanSparkline.length - 1].y : null;

  const prontuarioSummaryCards = useMemo(() => {
    const clinica = resolveLatestByType(byType, PRONTUARIO_SUMMARY_TYPES.CLINICA);
    const clinicaMetrics = [
      {
        key: 'pas',
        label: 'PA sistólica',
        unit: 'mmHg',
        value: toNumber(readResultValue(clinica, [
          'pressaoSistolica',
          'pressao_sistolica',
          'sinaisVitais.pressaoSistolica',
          'sinais_vitais.pressao_sistolica'
        ]))
      },
      {
        key: 'pad',
        label: 'PA diastólica',
        unit: 'mmHg',
        value: toNumber(readResultValue(clinica, [
          'pressaoDiastolica',
          'pressao_diastolica',
          'sinaisVitais.pressaoDiastolica',
          'sinais_vitais.pressao_diastolica'
        ]))
      },
      {
        key: 'fc',
        label: 'FC',
        unit: 'bpm',
        value: toNumber(readResultValue(clinica, [
          'frequenciaCardiaca',
          'frequencia_cardiaca',
          'sinaisVitais.frequenciaCardiaca',
          'sinais_vitais.frequencia_cardiaca'
        ]))
      },
      {
        key: 'temperatura',
        label: 'Temperatura',
        unit: '°C',
        value: toNumber(readResultValue(clinica, [
          'temperatura',
          'temperaturaCelsius',
          'temperatura_celsius',
          'sinaisVitais.temperatura',
          'sinais_vitais.temperatura'
        ]))
      }
    ].map((metric) => ({
      ...metric,
      tone: resolveVitalTone(metric.key, metric.value)
    }));

    const anamnese = resolveLatestByType(byType, PRONTUARIO_SUMMARY_TYPES.ANAMNESE);
    const alergias = toStringList(readResultValue(anamnese, [
      'alergias',
      'alergiasAlimentares',
      'alergias_intolerancias',
      'historicoAlergias'
    ]));
    const medicamentos = toStringList(readResultValue(anamnese, [
      'medicamentos',
      'medicamentosUso',
      'medicamentos_uso',
      'medicamentosEmUso',
      'usoMedicamentos'
    ]));
    const restricoes = toStringList(readResultValue(anamnese, [
      'restricoesDieteticas',
      'restricoes_dieteticas',
      'restricoesAlimentares',
      'restricoes_alimentares'
    ]));

    const get = resolveLatestByType(byType, PRONTUARIO_SUMMARY_TYPES.GET);
    const getKcal = toNumber(readResultValue(get, [
      'getEstimadoKcal',
      'get_estimado_kcal',
      'getKcal',
      'get_kcal'
    ]));
    const cho = toNumber(readResultValue(get, [
      'distribuicaoMacros.choPercentual',
      'distribuicao_macros.cho_percentual',
      'choPercentual',
      'cho_percentual'
    ]));
    const ptn = toNumber(readResultValue(get, [
      'distribuicaoMacros.ptnPercentual',
      'distribuicao_macros.ptn_percentual',
      'ptnPercentual',
      'ptn_percentual',
      'proteinaPercentual'
    ]));
    const lip = toNumber(readResultValue(get, [
      'distribuicaoMacros.lipPercentual',
      'distribuicao_macros.lip_percentual',
      'lipPercentual',
      'lip_percentual',
      'lipidioPercentual'
    ]));

    const composicaoFonte = resolveLatestComposition(byType);
    const composicao = composicaoFonte?.row || null;
    // Perímetros não estimam %GC nem massa magra: o cartão mostra o que a
    // própria avaliação mede, em vez de "--" que pareceria dado faltante.
    const composicaoMetrics = composicaoFonte?.type === 'perimetros'
      ? [
        { key: 'imc', label: 'IMC', unit: '', value: toNumber(readResultValue(composicao, ['imc'])) },
        { key: 'rcq', label: 'RCQ', unit: '', digits: 2, value: toNumber(readResultValue(composicao, ['rcq'])) }
      ]
      : [
        {
          key: 'gordura',
          label: '%GC atual',
          unit: '%',
          value: toNumber(readResultValue(composicao, [
            'percentualGorduraOficial',
            'percentual_gordura_oficial',
            'percentualGordura',
            'percentual_gordura'
          ]))
        },
        {
          key: 'massa-magra',
          label: 'Massa magra',
          unit: 'kg',
          value: toNumber(readResultValue(composicao, [
            'massaMagraOficialKg',
            'massa_magra_oficial_kg',
            'massaMagraKg',
            'massa_magra_kg'
          ]))
        }
      ];
    // Na integrada (registro legado), a fonte oficial escolhida nela vai junto.
    const fonteOficial = composicaoFonte?.type === 'composicao_corporal_integrada'
      ? readPath(composicao, 'dados.classificacoes.fonte_oficial')
      : null;
    const composicaoSourceLabel = composicaoFonte
      ? `${composicaoFonte.label}${hasMetricValue(fonteOficial) ? ` (fonte oficial: ${String(fonteOficial).trim()})` : ''}`
      : '';
    const diagnostico = readResultValue(composicao, [
      'diagnosticoNutricional',
      'diagnostico_nutricional',
      'classificacaoComposicao',
      'classificacao'
    ]);

    const psicologia = resolveLatestByType(byType, PRONTUARIO_SUMMARY_TYPES.PSICOLOGIA);
    const compulsao = readResultValue(psicologia, [
      'riscos.compulsao',
      'riscoCompulsao',
      'compulsaoAlimentar',
      'compulsao_alimentar'
    ]);
    const transtorno = readResultValue(psicologia, [
      'riscos.transtorno',
      'riscoTranstorno',
      'transtornoAlimentar',
      'transtorno_alimentar'
    ]);
    const motivacao = readResultValue(psicologia, [
      'riscos.motivacao',
      'riscoMotivacao',
      'motivacao',
      'nivelMotivacao',
      'motivacaoTratamento'
    ]);

    return [
      {
        id: PRONTUARIO_SUMMARY_TYPES.CLINICA,
        type: PRONTUARIO_SUMMARY_TYPES.CLINICA,
        openType: toToken(clinica?.tipo) || PRONTUARIO_SUMMARY_TYPES.CLINICA,
        kind: 'vitals',
        title: 'Avaliação clínica',
        subtitle: 'Mini-dashboard de sinais vitais',
        latestDate: toDate(clinica?.createdAt || clinica?.data || clinica?.updatedAt),
        hasData: Boolean(clinica),
        metrics: clinicaMetrics
      },
      {
        id: PRONTUARIO_SUMMARY_TYPES.ANAMNESE,
        type: PRONTUARIO_SUMMARY_TYPES.ANAMNESE,
        openType: toToken(anamnese?.tipo) || PRONTUARIO_SUMMARY_TYPES.ANAMNESE,
        kind: 'anamnese',
        title: 'Anamnese inicial',
        subtitle: 'Alergias, medicamentos e restrições',
        latestDate: toDate(anamnese?.createdAt || anamnese?.data || anamnese?.updatedAt),
        hasData: Boolean(anamnese),
        badges: [
          {
            id: 'alergias',
            label: 'Alergias',
            tone: 'danger',
            preview: formatListPreview(alergias)
          },
          {
            id: 'medicamentos',
            label: 'Medicamentos',
            tone: 'warn',
            preview: formatListPreview(medicamentos)
          },
          {
            id: 'restricoes',
            label: 'Restrições',
            tone: 'info',
            preview: formatListPreview(restricoes)
          }
        ]
      },
      {
        id: PRONTUARIO_SUMMARY_TYPES.GET,
        type: PRONTUARIO_SUMMARY_TYPES.GET,
        openType: toToken(get?.tipo) || PRONTUARIO_SUMMARY_TYPES.GET,
        kind: 'get',
        title: 'Gasto energético total',
        subtitle: 'GET e distribuição de macronutrientes',
        latestDate: toDate(get?.createdAt || get?.data || get?.updatedAt),
        hasData: Boolean(get),
        getKcal,
        macros: [
          { key: 'cho', label: 'CHO', value: cho },
          { key: 'ptn', label: 'PTN', value: ptn },
          { key: 'lip', label: 'LIP', value: lip }
        ]
      },
      {
        id: PRONTUARIO_SUMMARY_TYPES.COMPOSICAO,
        type: PRONTUARIO_SUMMARY_TYPES.COMPOSICAO,
        openType: toToken(composicao?.tipo) || PRONTUARIO_SUMMARY_TYPES.COMPOSICAO,
        kind: 'composicao',
        title: 'Composição corporal',
        subtitle: 'Avaliação de composição mais recente',
        sourceLabel: composicaoSourceLabel,
        latestDate: toDate(composicao?.createdAt || composicao?.data || composicao?.updatedAt),
        hasData: Boolean(composicao),
        metrics: composicaoMetrics,
        diagnostico: diagnostico ? String(diagnostico) : ''
      },
      {
        id: PRONTUARIO_SUMMARY_TYPES.PSICOLOGIA,
        type: PRONTUARIO_SUMMARY_TYPES.PSICOLOGIA,
        openType: toToken(psicologia?.tipo) || PRONTUARIO_SUMMARY_TYPES.PSICOLOGIA,
        kind: 'psicologia',
        title: 'Avaliação psicológica',
        subtitle: 'Riscos comportamentais prioritários',
        latestDate: toDate(psicologia?.createdAt || psicologia?.data || psicologia?.updatedAt),
        hasData: Boolean(psicologia),
        badges: [
          {
            id: 'compulsao',
            label: 'Compulsão',
            value: hasMetricValue(compulsao) ? String(compulsao) : 'Sem registro',
            tone: resolveRiskTone(compulsao)
          },
          {
            id: 'transtorno',
            label: 'Transtorno',
            value: hasMetricValue(transtorno) ? String(transtorno) : 'Sem registro',
            tone: resolveRiskTone(transtorno)
          },
          {
            id: 'motivacao',
            label: 'Motivação',
            value: hasMetricValue(motivacao) ? String(motivacao) : 'Sem registro',
            tone: resolveRiskTone(motivacao, { inverted: true })
          }
        ]
      }
    ];
  }, [byType]);

  const metricCards = [
    {
      id: 'consultas',
      label: 'Consultas',
      value: (consultationStatusSummary.realizada || 0)
        + (consultationStatusSummary.falta || 0)
        + (consultationStatusSummary.remarcada || 0)
        + (consultationStatusSummary.agendada || 0),
      sub: `${consultationStatusSummary.realizada || 0} realizadas`
    },
    {
      id: 'avaliacoes',
      label: 'Avaliações',
      value: sortedEvaluations.length,
      sub: `${dashboardSummary.realizadas} tipos realizados`
    },
    {
      id: 'ultima-avaliacao',
      label: 'Última avaliação',
      value: lastEvaluationDate ? formatDate(lastEvaluationDate) : '--',
      sub: lastEvaluationDate ? 'registro mais recente' : 'sem histórico'
    },
    {
      id: 'proxima-consulta',
      label: 'Próx. consulta',
      value: nextAppointment?.scheduledDate ? formatDate(nextAppointment.scheduledDate) : '--',
      sub: nextAppointment?.time || 'não agendada'
    }
  ];

  return (
    <section className="pron-stack">
      {mostrarResumoClinico && (
      <article className="pron-card pron-panel pron-prontuario-resumo-panel">
        <header className="pron-panel-header">
          <div>
            <h2>Resumo clínico do prontuário</h2>
            <p>Dados da avaliação mais recente por módulo (origem: campo resultados).</p>
          </div>
        </header>
        <div className="pron-prontuario-resumo-grid">
          {prontuarioSummaryCards.map((card) => (
            <ProntuarioResumoCard
              key={card.id}
              card={card}
              formatDate={formatDate}
              onOpenEvaluationType={handleOpenEvaluationType}
            />
          ))}
        </div>
      </article>
      )}

      <article className="pron-card pron-panel pron-dashboard-panel">
        <header className="pron-panel-header">
          <div>
            <h2>Instrumentos de avaliação</h2>
            <p>Localize um instrumento para abrir o registro ou iniciar uma avaliação.</p>
          </div>
          <span className="pron-text-muted">{cardsComDados.length} de {cards.length} instrumentos com registro</span>
        </header>

        <div className="pron-dashboard-catalog-controls">
          <input
            type="search"
            value={catalogSearch}
            onChange={(event) => setCatalogSearch(event.target.value)}
            placeholder="Buscar instrumento..."
            aria-label="Buscar instrumento de avaliação"
          />
          <select
            value={catalogStatus}
            onChange={(event) => setCatalogStatus(event.target.value)}
            aria-label="Filtrar instrumentos por situação"
          >
            <option value="all">Todas as situações</option>
            <option value="com_registro">Com registro</option>
            <option value="nao_iniciadas">Não iniciadas</option>
          </select>
          <span role="status" aria-live="polite">{filteredCards.length} {filteredCards.length === 1 ? 'instrumento encontrado' : 'instrumentos encontrados'}</span>
        </div>

        {filteredCardsComDados.length > 0 && (
          <div className="avaliacoes-grid pron-dashboard-grid--active">
            {filteredCardsComDados.map((card) => (
              <AvaliacaoCard
                key={card.type}
                card={card}
                formatDate={formatDate}
                onOpenEvaluationType={handleOpenEvaluationType}
              />
            ))}
          </div>
        )}

        {filteredCards.length === 0 && (
          <FeedbackState
            empty
            size="sm"
            title="Nenhum instrumento encontrado."
            action="Limpar filtros"
            onAction={() => { setCatalogSearch(''); setCatalogStatus('all'); }}
          />
        )}

        {cardsComDados.length === 0 && cards.length > 0 && catalogStatus === 'all' && !normalizedSearch && (
          <FeedbackState
            empty
            size="sm"
            title="Nenhuma avaliação registrada ainda."
            description="Os instrumentos estão disponíveis logo abaixo."
            action={canCreateEvaluation ? 'Iniciar primeira avaliação' : undefined}
            onAction={canCreateEvaluation ? onCreateEvaluation : undefined}
          />
        )}

        {cards.length === 0 && (
          <FeedbackState empty size="sm" title="Nenhum instrumento disponível neste caso." />
        )}

        {filteredCardsNaoIniciados.length > 0 && (
          <div className="pron-dashboard-nao-iniciadas">
            {normalizedSearch || catalogStatus === 'nao_iniciadas' || cardsComDados.length === 0 ? (
              <h3 className="pron-dashboard-nao-iniciadas__heading">Não iniciadas</h3>
            ) : (
              <button
                type="button"
                className="pron-dashboard-nao-iniciadas__toggle"
                onClick={() => setNaoIniciadasExpanded((prev) => !prev)}
                aria-expanded={showInactiveResults}
              >
                {showInactiveResults ? <ChevronDown size={16} aria-hidden="true" /> : <ChevronRight size={16} aria-hidden="true" />}
                <span>{cardsNaoIniciados.length} instrumentos ainda não iniciados</span>
              </button>
            )}
            {showInactiveResults && (
              <div className="avaliacoes-grid pron-dashboard-grid--inactive">
                {filteredCardsNaoIniciados.map((card) => (
                  <AvaliacaoCard
                    key={card.type}
                    card={card}
                    formatDate={formatDate}
                    onOpenEvaluationType={handleOpenEvaluationType}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </article>

      <details className="pron-card pron-panel pron-dashboard-stats">
        <summary>Indicadores do histórico</summary>
        <div className="pron-metrics-grid pron-dashboard-overview">
          {metricCards.map((item) => (
            <div key={item.id} className="metric-card">
              <div className="metric-label">{item.label}</div>
              <div className="metric-value">{item.value}</div>
              <div className="metric-sub">{item.sub}</div>
            </div>
          ))}
        </div>
      </details>

      {compositionSnapshot ? (
        <article className="pron-card pron-panel pron-dashboard-composition">
          <header className="pron-panel-header">
            <div>
              <h2>Composição corporal</h2>
              <p>
                Última avaliação: {compositionSnapshot.date ? formatDate(compositionSnapshot.date) : '--'} ({getEvaluationTypeLabel(compositionSnapshot.sourceType)})
              </p>
            </div>
          </header>
          <div className="pron-comp-grid">
            <div className="pron-comp-row">
              <span>Massa Magra</span>
              <div className="comp-bar">
                <div className="comp-bar-fill" style={{ width: `${Math.max(0, Math.min(100, compositionSnapshot.pctMagra || 0))}%` }} />
              </div>
              <strong>{renderValue(compositionSnapshot.pctMagra, '%')} · {renderValue(compositionSnapshot.massaMagra, 'kg')}</strong>
            </div>
            <div className="pron-comp-row">
              <span>Massa Gorda</span>
              <div className="comp-bar">
                <div className="comp-bar-fill pron-comp-bar-warn" style={{ width: `${Math.max(0, Math.min(100, compositionSnapshot.pctGorda || 0))}%` }} />
              </div>
              <strong>{renderValue(compositionSnapshot.pctGorda, '%')} · {renderValue(compositionSnapshot.massaGorda, 'kg')}</strong>
            </div>
          </div>
          <div className="pron-comp-summary">
            <span>IMC: {renderValue(compositionSnapshot.imc)}</span>
            <span>Cintura: {renderValue(compositionSnapshot.cintura, 'cm')}</span>
          </div>
        </article>
      ) : null}

      {compositionMethods.length >= 2 && (
        <details className="pron-card pron-panel pron-method-comparison">
          <summary>Comparar métodos registrados ({compositionMethods.length})</summary>
          <p>Último registro de cada método, com a data de origem. As medições podem ser de sessões diferentes.</p>
          <div className="pron-method-comparison__grid">
            {compositionMethods.map((method) => (
              <div className="pron-method-comparison__item" key={method.id}>
                <h3>{method.label}</h3>
                <span>{method.date ? formatDate(method.date) : 'Data não informada'}</span>
                <dl>
                  <div><dt>Gordura</dt><dd>{renderValue(method.percentFat, '%')}</dd></div>
                  <div><dt>Massa magra</dt><dd>{renderValue(method.leanMass, 'kg')}</dd></div>
                </dl>
              </div>
            ))}
          </div>
        </details>
      )}

      {mostrarEvolucaoTemporal
        && (weightSparkline.length >= 2 || fatSparkline.length >= 2 || leanSparkline.length >= 2) ? (
        <article className="pron-card pron-panel pron-dashboard-evolution">
          <header className="pron-panel-header">
            <div>
              <h2>Evolução temporal</h2>
              <p>Últimos 6 pontos de tendência.</p>
            </div>
          </header>
          <div className="pron-spark-grid">
            <div className="pron-spark-card">
              <span>Peso</span>
              <strong className="pron-spark-value">{renderValue(latestWeight, 'kg')}</strong>
              <div className="pron-spark-wrap">
                <ResponsiveContainer width="100%" height={60}>
                  <LineChart data={weightSparkline}>
                    <Line type="monotone" dataKey="y" stroke="#1D9E75" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              {weightSparkline.length >= 2 && (
                <span className="pron-spark-range">
                  {renderValue(weightSparkline[0].y, 'kg')} → {renderValue(weightSparkline[weightSparkline.length - 1].y, 'kg')}
                </span>
              )}
            </div>
            <div className="pron-spark-card">
              <span>% Gordura</span>
              <strong className="pron-spark-value">{renderValue(latestFat, '%')}</strong>
              <div className="pron-spark-wrap">
                <ResponsiveContainer width="100%" height={60}>
                  <LineChart data={fatSparkline}>
                    <Line type="monotone" dataKey="y" stroke="#d97706" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              {fatSparkline.length >= 2 && (
                <span className="pron-spark-range">
                  {renderValue(fatSparkline[0].y, '%')} → {renderValue(fatSparkline[fatSparkline.length - 1].y, '%')}
                </span>
              )}
            </div>
            <div className="pron-spark-card">
              <span>Massa Magra</span>
              <strong className="pron-spark-value">{renderValue(latestLean, 'kg')}</strong>
              <div className="pron-spark-wrap">
                <ResponsiveContainer width="100%" height={60}>
                  <LineChart data={leanSparkline}>
                    <Line type="monotone" dataKey="y" stroke="#2563eb" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              {leanSparkline.length >= 2 && (
                <span className="pron-spark-range">
                  {renderValue(leanSparkline[0].y, 'kg')} → {renderValue(leanSparkline[leanSparkline.length - 1].y, 'kg')}
                </span>
              )}
            </div>
          </div>
        </article>
      ) : null}

      <AvaliacaoImagem
        isOpen={avaliacaoImagemOpen}
        onClose={() => {
          setAvaliacaoImagemOpen(false);
          onImageClose?.();
        }}
        patient={patient}
        readOnly={!canEditType('composicao_corporal_imagem')}
      />
    </section>
  );
};

export default DashboardAvaliacoes;
