import React from 'react';
import './ui.css';

const SectionHeader = ({ title, subtitle, action }) => (
  <div className="ui-section-header">
    <div>
      <h3>{title}</h3>
      {subtitle && <p>{subtitle}</p>}
    </div>
    {action && <div className="ui-section-action">{action}</div>}
  </div>
);

export default SectionHeader;
