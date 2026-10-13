import React from 'react';
import { AlertTriangle, ArrowDownWideNarrow, CheckCircle2, Sigma, TrendingUp } from 'lucide-react';
import { MIN_HIGHLIGHT_SAMPLE, isSmallSample } from '../config/reportsConfig';

const severityLabel = {
  high: 'Alta',
  medium: 'Média',
  low: 'Baixa'
};

const severityClass = {
  high: 'severity-high',
  medium: 'severity-medium',
  low: 'severity-low'
};

const toPercent = (value) => `${Number(value || 0).toFixed(1)}%`;

const renderTopRows = (rows, kind = 'rate') => {
  if (!Array.isArray(rows) || rows.length === 0) {
    return <div className="reports-empty-state laines-feedback-state">Dados insuficientes para correlação neste recorte.</div>;
  }

  return (
    <ul className="driver-detail-list">
      {rows.slice(0, 5).map((row) => (
        <li key={`${row.label}-${row.sampleSize || 0}`}>
          <span className="detail-label">{row.label}</span>
          <span className="detail-value">
            {kind === 'coefficient'
              ? `${Number(row.coefficient || 0).toFixed(3)}`
              : toPercent(row.eventRate || row.averageCompleteness || row.retentionRate)}
          </span>
          <span className="detail-meta">
            n={row.sampleSize || 0}
            {typeof row.oddsRatio === 'number' ? ` | OR ${Number(row.oddsRatio).toFixed(2)}` : ''}
            {isSmallSample(row) && <strong className="detail-small-sample"> · amostra pequena</strong>}
          </span>
        </li>
      ))}
    </ul>
  );
};

const DriversPanel = ({ correlations, loadError = false }) => {
  const drivers = Array.isArray(correlations?.drivers) ? correlations.drivers : [];
  const absenteeism = correlations?.absenteeism || {};
  const completeness = correlations?.completeness || {};
  const retention = correlations?.retention || {};
  const spearman = completeness?.spearmanFrequency || {};

  return (
    <section className="drivers-panel">
      <div className="drivers-header">
        <div>
          <h3>Drivers operacionais</h3>
          <p>
            Fatores associados a faltas, completude e retenção. Só vira destaque o grupo com {MIN_HIGHLIGHT_SAMPLE} casos
            ou mais; os menores ficam no detalhe, marcados como amostra pequena.
          </p>
        </div>
        <span className="drivers-badge">
          <TrendingUp size={14} />
          Leitura acionável
        </span>
      </div>

      <div className="drivers-grid">
        {drivers.length === 0 && (
          <div className="reports-empty-state laines-feedback-state">
            {loadError
              ? 'Não foi possível carregar as correlações agora.'
              : `Sem grupo com ${MIN_HIGHLIGHT_SAMPLE} casos ou mais para destacar neste recorte.`}
          </div>
        )}
        {drivers.map((driver) => (
          <article key={driver.id} className="driver-card">
            <div className="driver-card-head">
              <span className={`driver-severity ${severityClass[driver.severity] || severityClass.low}`}>
                <AlertTriangle size={12} />
                {severityLabel[driver.severity] || severityLabel.low}
              </span>
              <span className="driver-target">{driver.targetLabel || driver.target}</span>
            </div>
            <h4>{driver.title}</h4>
            <p>{driver.insight}</p>
            <div className="driver-card-foot">
              <span>{driver.metricLabel}: {driver.metricValue}</span>
              {Number.isFinite(Number(driver.sampleSize)) && (
                <span className="driver-sample">
                  {`n = ${Number(driver.sampleSize).toLocaleString('pt-BR')}${driver.sampleUnit ? ` ${driver.sampleUnit}` : ''}`}
                </span>
              )}
              <span>{driver.recommendation}</span>
            </div>
          </article>
        ))}
      </div>

      <div className="drivers-details-grid">
        <article className="driver-detail-card">
          <header>
            <ArrowDownWideNarrow size={16} />
            <h4>Faltas por dimensão</h4>
          </header>
          {renderTopRows(absenteeism.byTurn)}
          {renderTopRows(absenteeism.byLeadTime)}
        </article>

        <article className="driver-detail-card">
          <header>
            <Sigma size={16} />
            <h4>Completude e frequência</h4>
          </header>
          <div className="spearman-box">
            <strong>{spearman.coefficient === null || spearman.coefficient === undefined ? '--' : Number(spearman.coefficient).toFixed(3)}</strong>
            <span>Spearman</span>
            <small>
              {spearman.interpretation || 'Sem dados suficientes.'} | n={spearman.sampleSize || 0}
              {Number(spearman.sampleSize || 0) > 0 && isSmallSample(spearman) && ' · amostra pequena'}
            </small>
          </div>
          {renderTopRows(completeness.byEvaluationType, 'rate')}
        </article>

        <article className="driver-detail-card">
          <header>
            <CheckCircle2 size={16} />
            <h4>Retenção operacional</h4>
          </header>
          {renderTopRows(retention.byConsultInterval)}
          {renderTopRows(retention.byResponsible)}
        </article>
      </div>
    </section>
  );
};

export default DriversPanel;
