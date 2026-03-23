import React from 'react';
import { Bell } from 'lucide-react';

const ReportsInfoFooter = ({ generatedAt, autoRefreshMinutes = 15, hasAutoRefresh = true }) => (
  <div className="info-footer">
    <div className="info-footer-content">
      <div className="info-notification">
        <div className="notification-icon">
          <Bell size={18} />
        </div>
        <div>
          <p className="notification-title">
            {hasAutoRefresh ? 'Atualização automática ativa' : 'Atualização manual'}
          </p>
          <p className="notification-subtitle">
            {hasAutoRefresh
              ? `Sincronização a cada ${autoRefreshMinutes} min. Última atualização: ${generatedAt ? new Date(generatedAt).toLocaleString('pt-BR') : '--'}`
              : `Última atualização: ${generatedAt ? new Date(generatedAt).toLocaleString('pt-BR') : '--'}`}
          </p>
        </div>
      </div>
    </div>
  </div>
);

export default ReportsInfoFooter;
