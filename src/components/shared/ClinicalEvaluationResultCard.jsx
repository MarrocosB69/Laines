import React, { useState } from 'react';
import {
  getEvaluationStatusLabel,
  getEvaluationStatusTone
} from './evaluationSummaryUtils';
import './ClinicalEvaluationResultCard.css';

const DOMAIN_BY_TYPE = {
  bioimpedancia: 'antropometria',
  dobras_cutaneas: 'antropometria',
  perimetros: 'antropometria',
  composicao_corporal_integrada: 'antropometria',
  gasto_energetico_total: 'antropometria',
  avaliacao_alimentar: 'nutricao',
  registro_consumo: 'nutricao',
  avaliacao_clinica: 'clinica',
  exames_laboratoriais: 'clinica',
  avaliacao_fisioterapia: 'multiprofissional',
  avaliacao_psicologia: 'multiprofissional',
  avaliacao_socioeconomica: 'social',
  anamnese_inicial: 'anamnese',
  evolucao_retorno: 'anamnese'
};

const ClinicalEvaluationResultCard = ({
  result,
  status = 'sem_registro',
  typeLabel = '',
  completion = null,
  responsible = '',
  dateLabel = '',
  project = '',
  className = '',
  compact = false
}) => {
  const [expanded, setExpanded] = useState(false);
  if (!result) return null;

  const statusTone = getEvaluationStatusTone(status);
  const statusLabel = getEvaluationStatusLabel(status);
  const completionLabel = typeof completion === 'number' ? `${completion}%` : 'Não informada';
  const isBioimp = result?.type === 'bioimpedancia' && result?.bioimp;

  const domain = DOMAIN_BY_TYPE[result?.type] || null;

  if (isBioimp) {
    const bioimp = result.bioimp;
    const targetDiff = Number.isFinite(bioimp?.targetDiff) ? bioimp.targetDiff : null;
    const targetWeightDiff = Number.isFinite(bioimp?.targetWeightDiff) ? bioimp.targetWeightDiff : null;
    const targetTone = targetDiff === null ? 'neutral' : (targetDiff <= 0 ? 'success' : targetDiff <= 3 ? 'warning' : 'danger');

    return (
      <article
        className={`clinical-result-card clinical-result-card--bioimp tone-${result.tone} ${compact ? 'compact' : ''} ${className}`.trim()}
        data-domain={domain || undefined}
      >
        <header className="clinical-result-card__header">
          <div className="clinical-result-card__title-wrap">
            <span className="clinical-result-card__type">{typeLabel || result.typeLabel}</span>
            <h4>{result.title}</h4>
            <span className="clinical-result-card__subtitle">
              {dateLabel ? `Data ${dateLabel}` : 'Data não informada'} • {responsible || 'Equipe LAINES'}
            </span>
          </div>
          <span className={`clinical-result-card__status tone-${statusTone}`}>
            {statusLabel}
          </span>
        </header>

        <div className="clinical-result-card__bio-grid">
          {(bioimp?.primaryMetrics || []).map((metric) => (
            <div key={metric.key} className="clinical-result-card__bio-metric">
              <div className="clinical-result-card__bio-metric-head">
                <span title={metric.tooltip || ''}>{metric.label}</span>
                {metric.key === 'percentualGordura' && targetDiff !== null && (
                  <small className={`clinical-result-card__target-chip tone-${targetTone}`}>
                    {targetDiff > 0 ? '+' : ''}{targetDiff.toFixed(1)} p.p. da meta
                  </small>
                )}
              </div>
              <strong>{metric.displayValue}</strong>
              <small className={`clinical-result-card__variation dir-${metric.variation?.direction || 'flat'}`}>
                {metric.variation?.label || 'Sem comparativo anterior'}
              </small>
            </div>
          ))}
        </div>

        <div className="clinical-result-card__bio-secondary">
          {(bioimp?.secondaryMetrics || []).map((metric) => (
            <span key={metric.key} title={metric.tooltip || ''}>
              <strong>{metric.label}:</strong> {metric.displayValue}
            </span>
          ))}
        </div>

        <p className="clinical-result-card__interpretation">{result.interpretation}</p>

        <div className="clinical-result-card__signals">
          <span className={`clinical-result-card__semaphore tone-${result.tone}`}>
            <i aria-hidden="true" />
            {result.toneLabel}
          </span>
          {targetWeightDiff !== null && (
            <span className={`clinical-result-card__variation dir-${targetWeightDiff <= 0 ? 'up' : 'down'}`}>
              {targetWeightDiff > 0 ? '+' : ''}{targetWeightDiff.toFixed(1)} kg gordura vs meta
            </span>
          )}
          <button
            type="button"
            className="clinical-result-card__detail-btn"
            onClick={() => setExpanded((prev) => !prev)}
          >
            {expanded ? 'Ocultar detalhes' : 'Ver detalhes completos'}
          </button>
        </div>

        {expanded && (
          <div className="clinical-result-card__bio-details">
            <span><strong>% Água/peso:</strong> {formatNumber(bioimp?.snapshot?.percentualAguaPesoCorporal, 1, '%')}</span>
            <span><strong>% Água/massa magra:</strong> {formatNumber(bioimp?.snapshot?.percentualAguaMassaMagra, 1, '%')}</span>
            <span><strong>Alvo % gordura:</strong> {formatNumber(bioimp?.snapshot?.alvoPercentualGordura, 1, '%')}</span>
            <span><strong>Alvo peso gordura:</strong> {formatNumber(bioimp?.snapshot?.alvoPesoGordura, 1, 'kg')}</span>
            <span><strong>Alvo peso total:</strong> {formatNumber(bioimp?.snapshot?.alvoPesoTotal, 1, 'kg')}</span>
            <span><strong>Projeto:</strong> {project || 'Não vinculado'}</span>
            <span><strong>Completude:</strong> {completionLabel}</span>
          </div>
        )}
      </article>
    );
  }

  return (
    <article
      className={`clinical-result-card tone-${result.tone} ${compact ? 'compact' : ''} ${className}`.trim()}
      data-domain={domain || undefined}
    >
      <header className="clinical-result-card__header">
        <div className="clinical-result-card__title-wrap">
          <span className="clinical-result-card__type">{typeLabel || result.typeLabel}</span>
          <h4>{result.title}</h4>
        </div>
        <span className={`clinical-result-card__status tone-${statusTone}`}>
          {statusLabel}
        </span>
      </header>

      <div className="clinical-result-card__main">
        <strong className="clinical-result-card__value">{result.primaryDisplay}</strong>
        <span className={`clinical-result-card__classification tone-${result.tone}`}>
          {result.classification}
        </span>
      </div>

      <p className="clinical-result-card__interpretation">{result.interpretation}</p>

      <div className="clinical-result-card__signals">
        <span className={`clinical-result-card__semaphore tone-${result.tone}`}>
          <i aria-hidden="true" />
          {result.toneLabel}
        </span>
        <span className={`clinical-result-card__variation dir-${result.variation?.direction || 'flat'}`}>
          {result.variation?.label || 'Sem comparativo anterior'}
        </span>
      </div>

      {(result.supportLabel || responsible || dateLabel || project || completion !== null) && (
        <dl className="clinical-result-card__meta">
          {result.supportLabel && (
            <div>
              <dt>{result.supportLabel}</dt>
              <dd>{result.supportValue || 'Não informado'}</dd>
            </div>
          )}
          {responsible && (
            <div>
              <dt>Responsável</dt>
              <dd>{responsible}</dd>
            </div>
          )}
          {dateLabel && (
            <div>
              <dt>Data</dt>
              <dd>{dateLabel}</dd>
            </div>
          )}
          {project && (
            <div>
              <dt>Projeto</dt>
              <dd>{project}</dd>
            </div>
          )}
          <div>
            <dt>Completude</dt>
            <dd>{completionLabel}</dd>
          </div>
        </dl>
      )}
    </article>
  );
};

const formatNumber = (value, digits = 1, unit = '') => {
  if (!Number.isFinite(value)) return 'Não informado';
  return `${Number(value).toFixed(digits)}${unit ? ` ${unit}` : ''}`;
};

export default ClinicalEvaluationResultCard;
