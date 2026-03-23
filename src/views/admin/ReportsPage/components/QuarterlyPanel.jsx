import React from 'react';
import { motion } from 'framer-motion';

const toPercent = (value, maxValue) => {
  if (!Number.isFinite(value) || value <= 0) return 0;
  const baseline = Math.max(1, maxValue);
  return Math.min(100, (value / baseline) * 100);
};

const QuarterlyPanel = ({ quarterlyData }) => {
  const maxAlunos = Math.max(1, ...quarterlyData.map((quarter) => Number(quarter.alunos || 0)));
  const maxPacientes = Math.max(1, ...quarterlyData.map((quarter) => Number(quarter.pacientes || 0)));
  const maxAvaliacoes = Math.max(
    1,
    ...quarterlyData.map((quarter) => Math.max(Number(quarter.avaliacoes || 0), Number(quarter.meta || 0)))
  );

  return (
    <div className="quarterly-panel">
      <div className="quarterly-header">
        <div className="quarterly-header-left">
          <h3 className="quarterly-title">Desempenho trimestral</h3>
          <p className="quarterly-subtitle">Escala dinâmica por série (normalizada pelo maior valor do período)</p>
        </div>
        <div className="quarterly-legend">
          <div className="legend-item">
            <div className="legend-dot blue"></div>
            <span className="legend-label">Alunos</span>
          </div>
          <div className="legend-item">
            <div className="legend-dot emerald"></div>
            <span className="legend-label">Pacientes</span>
          </div>
          <div className="legend-item">
            <div className="legend-dot purple"></div>
            <span className="legend-label">Avaliações</span>
          </div>
        </div>
      </div>

      <div className="quarterly-grid">
        {quarterlyData.map((quarter, index) => (
          <motion.div
            key={quarter.period}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5 + index * 0.1 }}
            whileHover={{ y: -8 }}
            className="quarter-card"
          >
            <div className="quarter-card-header">
              <h4 className="quarter-card-title">{quarter.period}</h4>
              <div className={`quarter-meta ${quarter.avaliacoes >= quarter.meta ? 'meta-achieved' : 'meta-pending'}`}>
                Meta
              </div>
            </div>

            <div className="quarter-metrics">
              <div className="quarter-metric">
                <div className="metric-header">
                  <span className="metric-label">Alunos</span>
                  <span className="metric-value blue">{quarter.alunos}</span>
                </div>
                <div className="metric-bar">
                  <div
                    className="metric-bar-fill blue"
                    style={{ width: `${toPercent(Number(quarter.alunos || 0), maxAlunos)}%` }}
                  />
                </div>
              </div>

              <div className="quarter-metric">
                <div className="metric-header">
                  <span className="metric-label">Pacientes</span>
                  <span className="metric-value emerald">{quarter.pacientes}</span>
                </div>
                <div className="metric-bar">
                  <div
                    className="metric-bar-fill emerald"
                    style={{ width: `${toPercent(Number(quarter.pacientes || 0), maxPacientes)}%` }}
                  />
                </div>
              </div>

              <div className="quarter-metric">
                <div className="metric-header">
                  <span className="metric-label">Avaliações</span>
                  <span className="metric-value purple">{quarter.avaliacoes}</span>
                </div>
                <div className="metric-bar">
                  <div
                    className="metric-bar-fill purple"
                    style={{ width: `${toPercent(Number(quarter.avaliacoes || 0), maxAvaliacoes)}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="quarter-card-footer">
              <div className="meta-info">
                <span className="meta-label">Meta:</span>
                <span className="meta-value">{quarter.meta} av.</span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default QuarterlyPanel;
