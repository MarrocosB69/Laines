import React from 'react';
import { Minus, TrendingDown, TrendingUp } from 'lucide-react';

const trendIcons = {
  up: TrendingUp,
  down: TrendingDown,
  flat: Minus
};

// Cartão no desenho de .painel-indicador (ReportsPage.css): parado, sem o
// salto no hover. `value` "—" é ausência de valor (o leitor de tela ouve
// "sem valor"). A tendência vem escrita (`trend.label`): o ícone só repete
// a direção; sem base de comparação (`direction: 'none'`) não há ícone.
const StatCard = ({ title, value, icon: Icon, color = '', trend, description }) => {
  const TrendIcon = trend ? trendIcons[trend.direction] : null;
  const semValor = value === '—';

  return (
    <div className="stat-card">
      <div className="stat-card-overlay" />

      <div className={`stat-card-icon ${color}`}>
        <Icon size={24} />
      </div>

      <div className="stat-card-content">
        <h3 className="stat-card-title">{title}</h3>
        <div className="stat-card-value-container">
          <p className="stat-card-value">
            {semValor ? (
              <>
                <span aria-hidden="true">—</span>
                <span className="reports-sr">sem valor</span>
              </>
            ) : value}
          </p>
          {trend && (
            <span className={`stat-card-trend trend-${trend.direction}`}>
              {TrendIcon && <TrendIcon size={12} />}
              {trend.label}
            </span>
          )}
        </div>
        {description && <p className="stat-card-description">{description}</p>}
      </div>
    </div>
  );
};

export default StatCard;
