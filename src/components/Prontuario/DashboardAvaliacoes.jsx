import React, { useMemo, useState } from 'react';
import {
  Activity,
  Apple,
  Brain,
  ChevronDown,
  ChevronRight,
  Droplets,
  FileSpreadsheet,
  FlaskConical,
  HeartPulse,
  PersonStanding,
  RefreshCcw,
  Ruler,
  Scale,
  ShieldCheck
} from 'lucide-react';
import { Line, LineChart, ResponsiveContainer } from 'recharts';
import { EVALUATION_REGISTRY } from '../../constants/evaluationRegistry';
import { getEvaluationTypeLabel } from '../shared/evaluationSummaryUtils';
import { FeedbackState } from '../ui';

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
  evolucao_retorno: RefreshCcw
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
    { label: 'Score adesao', unit: '%', keys: ['scoreAdesaoGeral', 'score_adesao'] },
    { label: 'Data', unit: '', keys: ['proximaAvaliacao', 'dataRetorno'] },
    { label: 'Conduta', unit: '', keys: ['conduta'] }
  ]
};

const PRONTUARIO_SUMMARY_TYPES = Object.freeze({
  CLINICA: 'avaliacao_clinica',
  ANAMNESE: 'anamnese_inicial',
  GET: 'gasto_energetico_total',
  COMPOSICAO: 'bioimpedancia',
  PSICOLOGIA: 'psicologia'
});

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

const renderValue = (value, unit = '') => {
  if (!hasMetricValue(value)) return '--';
  const numeric = toNumber(value);
  if (Number.isFinite(numeric)) {
    const precision = Math.abs(numeric) >= 1000 ? 0 : 1;
    const formatted = numeric.toLocaleString('pt-BR', {
      minimumFractionDigits: precision,
      maximumFractionDigits: precision
    });
    return unit ? `${formatted} ${unit}` : formatted;
  }
  return String(value);
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
  const token = toToken(evaluation.status);
  if (['finalizada', 'concluida', 'realizada'].includes(token)) return 'realizada';
  if (token === 'rascunho') return 'rascunho';
  return 'pendente';
};

const statusClassMap = {
  realizada:    'pron-card-avaliacao--realizada',
  rascunho:     'pron-card-avaliacao--rascunho',
  pendente:     'pron-card-avaliacao--pendente',
  nao_realizada:'pron-card-avaliacao--nao-realizada'
};

const STATUS_BADGE = {
  realizada:    { cls: 'pron-badge-ok',   label: 'Finalizada' },
  rascunho:     { cls: 'pron-badge-muted pron-badge--rascunho', label: 'Rascunho' },
  pendente:     { cls: 'pron-badge-warn', label: 'Pendente' },
  nao_realizada:{ cls: 'pron-badge-muted',label: 'Não iniciada' },
};

const STATUS_ACTION_LABEL = {
  realizada:    'Ver detalhes',
  rascunho:     'Continuar rascunho',
  pendente:     'Iniciar avaliação',
  nao_realizada:'Iniciar avaliação',
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

  const handleClick = () => {
    onOpenEvaluationType?.(card.type);
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onOpenEvaluationType?.(card.type);
    }
  };

  const isInteractive = card.status !== 'nao_realizada';

  return (
    <article
      className={`pron-avaliacao-card status-${card.status} ${statusClassMap[card.status] || ''} ${isInteractive ? 'pron-card--interactive' : 'pron-card--static'}`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      aria-label={`${card.label} — ${STATUS_ACTION_LABEL[card.status] || 'Ver detalhes'}`}
    >
      <header className="pron-avaliacao-card__header">
        <div className="pron-title-inline">
          <Icon size={16} />
          <strong>{card.label}</strong>
        </div>
        <span className={`pron-badge ${(STATUS_BADGE[card.status] || STATUS_BADGE.nao_realizada).cls}`}>
          {(STATUS_BADGE[card.status] || STATUS_BADGE.nao_realizada).label}
        </span>
      </header>

      <div className="pron-avaliacao-metrics">
        {card.metrics.length ? card.metrics.map((metric, index) => (
          <div
            key={`${card.type}-${metric.label}`}
            className={`pron-avaliacao-metric ${index === 0 ? 'pron-avaliacao-metric--primary' : ''} ${!hasMetricValue(metric.value) ? 'is-empty' : ''}`}
          >
            <span>{metric.label}</span>
            <strong>{renderValue(metric.value, metric.unit)}</strong>
          </div>
        )) : (
          <span className="pron-text-muted">Sem indicadores configurados.</span>
        )}
      </div>

      <footer className="pron-avaliacao-card__footer">
        <span>Última: {card.latestDate ? formatDate(card.latestDate) : '--'}</span>
        {card.delta ? (
          <span className={`pron-delta ${card.delta.tone}`}>{card.delta.label}</span>
        ) : (
          <span className="pron-text-muted">Sem comparativo anterior</span>
        )}
      </footer>

      <div className="pron-avaliacao-card__actions">
        <span className="pron-link-btn">
          {STATUS_ACTION_LABEL[card.status] || 'Ver detalhes'}
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
          <p>{card.subtitle}</p>
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
          <div className="pron-prontuario-composicao-metric">
            <span>%GC atual</span>
            <strong>{renderValue(card.percentualGordura, '%')}</strong>
          </div>
          <div className="pron-prontuario-composicao-metric">
            <span>Massa magra</span>
            <strong>{renderValue(card.massaMagra, 'kg')}</strong>
          </div>
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
  patient,
  avaliacoes = [],
  consultationStatusSummary = {},
  nextAppointment,
  formatDate,
  onOpenEvaluationType,
  onCreateEvaluation
}) => {
  const [naoIniciadasExpanded, setNaoIniciadasExpanded] = useState(false);

  const sortedEvaluations = useMemo(() => (
    [...avaliacoes].sort((a, b) => {
      const aDate = toDate(a.createdAt || a.data || a.updatedAt)?.getTime() || 0;
      const bDate = toDate(b.createdAt || b.data || b.updatedAt)?.getTime() || 0;
      return bDate - aDate;
    })
  ), [avaliacoes]);

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

  const lastEvaluationDate = useMemo(
    () => toDate(sortedEvaluations[0]?.createdAt || sortedEvaluations[0]?.data || sortedEvaluations[0]?.updatedAt),
    [sortedEvaluations]
  );

  const cards = useMemo(() => EVALUATION_REGISTRY.map((registryItem) => {
    const rows = byType.get(registryItem.type) || [];
    const latest = rows[0] || null;
    const previous = rows[1] || null;
    const specs = METRIC_SPECS[registryItem.type] || [];
    const metrics = specs.map((spec) => ({
      ...spec,
      value: readMetricValue(latest, spec.keys),
      previousValue: readMetricValue(previous, spec.keys)
    }));
    const delta = metrics.length > 0
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
      status: resolveCardStatus(latest)
    };
  }), [byType]);

  const cardsComDados = useMemo(
    () => cards.filter((card) => card.status !== 'nao_realizada'),
    [cards]
  );
  const cardsNaoIniciados = useMemo(
    () => cards.filter((card) => card.status === 'nao_realizada'),
    [cards]
  );

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
      const row = (byType.get(type) || [])[0];
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
          date: toDate(row.createdAt || row.data || row.updatedAt),
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
  }, [byType]);

  const weightSparkline = useMemo(
    () => buildSparklineData(sortedEvaluations, ['peso', 'weight', 'peso_kg']),
    [sortedEvaluations]
  );
  const fatSparkline = useMemo(
    () => buildSparklineData(sortedEvaluations, ['percentual_gordura', 'percentualGordura', 'percentualGorduraOficial']),
    [sortedEvaluations]
  );
  const leanSparkline = useMemo(
    () => buildSparklineData(sortedEvaluations, ['massa_magra', 'massaMagra', 'massaMagraOficialKg']),
    [sortedEvaluations]
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

    const composicao = resolveLatestByType(byType, PRONTUARIO_SUMMARY_TYPES.COMPOSICAO);
    const percentualGordura = toNumber(readResultValue(composicao, [
      'percentualGorduraOficial',
      'percentual_gordura_oficial',
      'percentualGordura',
      'percentual_gordura'
    ]));
    const massaMagra = toNumber(readResultValue(composicao, [
      'massaMagraOficialKg',
      'massa_magra_oficial_kg',
      'massaMagraKg',
      'massa_magra_kg'
    ]));
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
        title: 'Composição corporal integrada',
        subtitle: 'Indicadores oficiais da sessão',
        latestDate: toDate(composicao?.createdAt || composicao?.data || composicao?.updatedAt),
        hasData: Boolean(composicao),
        percentualGordura,
        massaMagra,
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
      <article className="pron-metrics-grid pron-dashboard-overview">
        {metricCards.map((item) => (
          <div key={item.id} className="metric-card">
            <div className="metric-label">{item.label}</div>
            <div className="metric-value">{item.value}</div>
            <div className="metric-sub">{item.sub}</div>
          </div>
        ))}
      </article>

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
              onOpenEvaluationType={onOpenEvaluationType}
            />
          ))}
        </div>
      </article>

      <article className="pron-card pron-panel pron-dashboard-panel">
        <header className="pron-panel-header">
          <div>
            <h2>Dashboard de Avaliações</h2>
            <p>{patient?.nome || 'Atleta'} — visão por tipo de avaliação.</p>
          </div>
          <div className="pron-dashboard-summary">
            <span className="pron-badge pron-badge-ok">
              {dashboardSummary.realizadas} realizad{dashboardSummary.realizadas === 1 ? 'a' : 'as'}
            </span>
            {dashboardSummary.pendentes > 0 && (
              <span className="pron-badge pron-badge-warn">
                {dashboardSummary.pendentes} pendente{dashboardSummary.pendentes === 1 ? '' : 's'}
              </span>
            )}
            {dashboardSummary.naoRealizadas > 0 && (
              <span className="pron-badge pron-badge-muted">
                {dashboardSummary.naoRealizadas} não iniciada{dashboardSummary.naoRealizadas === 1 ? '' : 's'}
              </span>
            )}
          </div>
        </header>

        {cardsComDados.length > 0 ? (
          <div className="avaliacoes-grid pron-dashboard-grid--active">
            {cardsComDados.map((card) => (
              <AvaliacaoCard
                key={card.type}
                card={card}
                formatDate={formatDate}
                onOpenEvaluationType={onOpenEvaluationType}
              />
            ))}
          </div>
        ) : (
          <FeedbackState empty size="sm" title="Nenhuma avaliação registrada ainda." description="Inicie pelo botão abaixo." />
        )}

        {cardsNaoIniciados.length > 0 && (
          <div className="pron-dashboard-nao-iniciadas">
            <button
              type="button"
              className="pron-dashboard-nao-iniciadas__toggle"
              onClick={() => setNaoIniciadasExpanded((prev) => !prev)}
              aria-expanded={naoIniciadasExpanded}
            >
              {naoIniciadasExpanded
                ? <ChevronDown size={14} />
                : <ChevronRight size={14} />}
              <span>
                {cardsNaoIniciados.length} tipo{cardsNaoIniciados.length !== 1 ? 's' : ''} ainda não iniciado{cardsNaoIniciados.length !== 1 ? 's' : ''}
              </span>
            </button>
            {naoIniciadasExpanded && (
              <div className="avaliacoes-grid pron-dashboard-grid--inactive">
                {cardsNaoIniciados.map((card) => (
                  <AvaliacaoCard
                    key={card.type}
                    card={card}
                    formatDate={formatDate}
                    onOpenEvaluationType={onOpenEvaluationType}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </article>

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

      {(weightSparkline.length >= 2 || fatSparkline.length >= 2 || leanSparkline.length >= 2) ? (
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

      {!sortedEvaluations.length ? (
        <article className="pron-card">
          <FeedbackState
            empty
            title="Nenhuma avaliação registrada para este atleta."
            action="Iniciar primeira avaliação"
            onAction={onCreateEvaluation}
          />
        </article>
      ) : null}
    </section>
  );
};

export default DashboardAvaliacoes;
