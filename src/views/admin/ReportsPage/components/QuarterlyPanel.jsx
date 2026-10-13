import React from 'react';
import { motion } from 'framer-motion';

// Trimestres do calendário (horário de Brasília) que caem no período, com
// o realizado e nada mais: o selo "Meta" saiu porque a meta era o próprio
// realizado (max(avaliações, 10)) e a direção ainda não definiu uma (WI-016,
// decisão 1). Trimestre só em parte dentro do período diz quais dias conta.
// Os números vêm escritos; as barras são só desenho (aria-hidden).

const toPercent = (value, maxValue) => {
  if (!Number.isFinite(value) || value <= 0) return 0;
  const baseline = Math.max(1, maxValue);
  return Math.min(100, (value / baseline) * 100);
};

const hasNumber = (value) => value !== null && value !== undefined && Number.isFinite(Number(value));

const formatDay = (day) => {
  const [year, month, date] = String(day || '').split('-');
  return year && month && date ? `${date}/${month}` : '';
};

const SERIES = [
  { key: 'atendimentos', label: 'Atendimentos realizados', color: 'blue' },
  { key: 'pacientes', label: 'Novos atletas', color: 'emerald' },
  { key: 'avaliacoes', label: 'Avaliações', color: 'purple' }
];

const QuarterlyPanel = ({ quarterlyData }) => {
  // Servidor antigo não manda `noPeriodo`: mostra tudo, como antes.
  const quarters = quarterlyData.filter((quarter) => quarter.noPeriodo !== false);
  const maxBySeries = Object.fromEntries(SERIES.map((serie) => [
    serie.key,
    Math.max(1, ...quarters.map((quarter) => Number(quarter[serie.key] || 0)))
  ]));

  return (
    <div className="quarterly-panel">
      <div className="quarterly-header">
        <div className="quarterly-header-left">
          <h3 className="quarterly-title">Realizado por trimestre</h3>
          <p className="quarterly-subtitle">
            Trimestres do calendário dentro do período. Sem meta definida: mostra só o realizado.
          </p>
        </div>
        <div className="quarterly-legend">
          {SERIES.map((serie) => (
            <div key={serie.key} className="legend-item">
              <div className={`legend-dot ${serie.color}`}></div>
              <span className="legend-label">{serie.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="quarterly-grid">
        {quarters.length === 0 && (
          <div className="reports-empty-state laines-feedback-state">
            Sem trimestre para mostrar neste período.
          </div>
        )}
        {quarters.map((quarter, index) => (
          <motion.div
            key={`${quarter.period}-${quarter.ano ?? index}`}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5 + index * 0.1 }}
            className="quarter-card"
          >
            <div className="quarter-card-header">
              <h4 className="quarter-card-title">
                {quarter.period}{quarter.ano ? ` ${quarter.ano}` : ''}
              </h4>
              {quarter.parcial && quarter.inicio && quarter.fim && (
                <span className="quarter-parcial">
                  {`Parcial: ${formatDay(quarter.inicio)} a ${formatDay(quarter.fim)}`}
                </span>
              )}
            </div>

            <div className="quarter-metrics">
              {SERIES.map((serie) => {
                const value = quarter[serie.key];
                return (
                  <div key={serie.key} className="quarter-metric">
                    <div className="metric-header">
                      <span className="metric-label">{serie.label}</span>
                      <span className="metric-value">
                        {hasNumber(value) ? Number(value).toLocaleString('pt-BR') : (
                          <>
                            <span aria-hidden="true">—</span>
                            <span className="reports-sr">sem valor</span>
                          </>
                        )}
                      </span>
                    </div>
                    <div className="metric-bar" aria-hidden="true">
                      <div
                        className={`metric-bar-fill ${serie.color}`}
                        style={{ width: `${toPercent(Number(value || 0), maxBySeries[serie.key])}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default QuarterlyPanel;
