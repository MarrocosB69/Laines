import React from 'react';

/**
 * Standard evaluation form header with domain icon, title, and subtitle.
 * Consumes the .eval-header / .eval-icon / .eval-title / .eval-subtitle classes
 * from avaliacoes.css.
 *
 * @param {React.ReactNode} icon   - Lucide icon element, e.g. <Droplets size={22} />
 * @param {string}          title  - Form title
 * @param {string}         [subtitle] - Optional subtitle
 */
const EvaluationHeader = ({ icon, title, subtitle }) => (
  <div className="eval-header">
    <div className="eval-icon">
      {icon}
    </div>
    <div>
      <h3 className="eval-title">{title}</h3>
      {subtitle && <p className="eval-subtitle">{subtitle}</p>}
    </div>
  </div>
);

export default EvaluationHeader;
