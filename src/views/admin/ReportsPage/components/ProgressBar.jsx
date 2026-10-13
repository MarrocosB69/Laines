import React from 'react';

// A barra nasce na largura final. A entrada animava `width` (mola do
// framer-motion); agora é um scaleX do CSS, só sem preferência por menos
// movimento, e `delay` continua valendo como atraso da animação. A barra é
// só desenho: o rótulo, a porcentagem e a contagem já estão escritos acima.
// Porcentagem null (sem base no período) aparece como "—", não como 0%.
const ProgressBar = ({ value, label, count, color, delay, showPercentage = true }) => {
  const hasValue = value !== null && value !== undefined && Number.isFinite(Number(value));
  const normalizedValue = hasValue ? Math.max(0, Math.min(100, Number(value))) : 0;
  const hasCount = count !== null && count !== undefined && Number.isFinite(Number(count));
  const percentageLabel = Number.isInteger(normalizedValue)
    ? `${normalizedValue}%`
    : `${normalizedValue.toFixed(1)}%`;

  return (
    <div className="progress-bar-wrapper">
      <div className="progress-bar-header">
        <span className="progress-bar-label">{label}</span>
        <div className="progress-bar-numbers">
          {showPercentage && (
            <span className="progress-bar-percentage">
              {hasValue ? percentageLabel : (
                <>
                  <span aria-hidden="true">—</span>
                  <span className="reports-sr">sem valor</span>
                </>
              )}
            </span>
          )}
          <span className="progress-bar-count">({hasCount ? Number(count).toLocaleString('pt-BR') : '—'})</span>
        </div>
      </div>

      <div className="progress-bar-container" aria-hidden="true">
        <div
          className={`progress-bar-fill ${color}`}
          style={{
            width: `${normalizedValue}%`,
            animationDelay: Number.isFinite(Number(delay)) ? `${Number(delay)}s` : undefined
          }}
        />
      </div>
    </div>
  );
};

export default ProgressBar;
