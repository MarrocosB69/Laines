import React from 'react';
import './ui.css';

const StatCard = ({ title, value, meta, icon: Icon }) => (
  <div className="ui-card ui-stat-card">
    <div className="ui-stat-icon" aria-hidden="true">{Icon && <Icon size={20} />}</div>
    <div>
      <p className="ui-stat-label">{title}</p>
      <strong className="ui-stat-value">{value}</strong>
      {meta && <span className="ui-stat-meta">{meta}</span>}
    </div>
  </div>
);

export default StatCard;
