import React from 'react';
import { TrendingUp } from 'lucide-react';
import ProgressBar from './ProgressBar';
import { periodOptions } from '../config/reportsConfig';

// O seletor é o mesmo período da página (filtro "Período de análise"), com
// os mesmos rótulos: antes oferecia só três opções e outros nomes.
const UsagePanel = ({
  dateRange,
  onDateRangeChange,
  generatedAt,
  periodText,
  visibleUsageData
}) => (
  <div className="usage-panel">
    <div className="usage-header">
      <div className="usage-header-left">
        <div className="usage-title-wrapper">
          <div className="usage-icon">
            <TrendingUp size={18} />
          </div>
          <h3 className="usage-title">Uso por categoria</h3>
        </div>
        <p className="usage-subtitle">
          Avaliações registradas no período, por tipo{periodText ? ` (${periodText})` : ''}.
        </p>
      </div>
      <div className="usage-controls">
        <select
          className="usage-select"
          value={dateRange}
          onChange={(event) => onDateRangeChange(event.target.value)}
          aria-label="Período do uso por categoria"
        >
          {periodOptions.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </div>
    </div>
    <div className="usage-progress">
      {visibleUsageData.map((item, index) => (
        <ProgressBar
          key={item.label}
          value={item.value}
          label={item.label}
          count={item.count}
          color={item.color}
          delay={0.3 + index * 0.1}
        />
      ))}
      {visibleUsageData.length === 0 && (
        <div className="reports-empty-state laines-feedback-state">
          Nenhuma categoria encontrada com os filtros atuais.
        </div>
      )}
    </div>
    <div className="usage-footer">
      <span className="last-update">
        Atualizado em: {generatedAt ? new Date(generatedAt).toLocaleDateString('pt-BR') : '--'}
      </span>
    </div>
  </div>
);

export default UsagePanel;
