import React from 'react';
import './EvaluationSummaryStrip.css';
import {
  getEvaluationStatusLabel,
  getEvaluationStatusTone
} from './evaluationSummaryUtils';

const formatValue = (value) => {
  if (value === null || value === undefined) return 'Não informado';
  const text = String(value).trim();
  return text || 'Não informado';
};

const EvaluationSummaryStrip = ({
  title = 'Resumo da avaliação',
  subtitle = '',
  status = 'sem_registro',
  empty = false,
  emptyMessage = 'Nenhuma avaliação registrada.',
  items = [],
  className = ''
}) => {
  const tone = getEvaluationStatusTone(status);
  const statusLabel = getEvaluationStatusLabel(status);

  return (
    <section className={`evaluation-summary-strip ${className}`.trim()}>
      <header className="evaluation-summary-strip__header">
        <div className="evaluation-summary-strip__title-group">
          <h4>{title}</h4>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        {!empty && (
          <span className={`evaluation-summary-strip__status tone-${tone}`}>
            {statusLabel}
          </span>
        )}
      </header>

      {empty ? (
        <p className="evaluation-summary-strip__empty">{emptyMessage}</p>
      ) : (
        <dl className="evaluation-summary-strip__grid">
          {items.map((item) => (
            <div key={item.label} className="evaluation-summary-strip__item">
              <dt>{item.label}</dt>
              <dd>{formatValue(item.value)}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
};

export default EvaluationSummaryStrip;
