import React from 'react';
import { motion } from 'framer-motion';

const ProgressBar = ({ value, label, count, color, delay, showPercentage = true }) => {
  const normalizedValue = Math.max(0, Math.min(100, Number(value || 0)));
  const normalizedCount = Number.isFinite(Number(count)) ? Number(count) : 0;
  const percentageLabel = Number.isInteger(normalizedValue)
    ? `${normalizedValue}%`
    : `${normalizedValue.toFixed(1)}%`;

  return (
    <div className="progress-bar-wrapper">
      <div className="progress-bar-header">
        <span className="progress-bar-label">{label}</span>
        <div className="progress-bar-numbers">
          {showPercentage && <span className="progress-bar-percentage">{percentageLabel}</span>}
          <span className="progress-bar-count">({normalizedCount.toLocaleString('pt-BR')})</span>
        </div>
      </div>

      <div className="progress-bar-container">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${normalizedValue}%` }}
          transition={{ delay, duration: 1.2, type: 'spring', stiffness: 100 }}
          className={`progress-bar-fill ${color}`}
        />
      </div>
    </div>
  );
};

export default ProgressBar;
