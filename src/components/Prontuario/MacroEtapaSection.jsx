import React from 'react';
import './MacroEtapaSection.css';

const MacroEtapaSection = ({ label, icon, count, children }) => (
  <section className="macro-etapa-section" aria-label={label}>
    <div className="macro-etapa-section-divider">
      <div className="macro-etapa-section-heading">
        {icon && <span className="macro-etapa-section-icon">{icon}</span>}
        <span className="macro-etapa-section-label">{label}</span>
        {typeof count === 'number' && (
          <span className="macro-etapa-section-count" aria-label={`${count} módulos`}>
            {count}
          </span>
        )}
      </div>
      <span className="macro-etapa-section-line" aria-hidden="true" />
    </div>

    <div className="macro-etapa-section-content">
      {children}
    </div>
  </section>
);

export default MacroEtapaSection;
