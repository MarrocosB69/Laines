import React from 'react';

/**
 * Standard evaluation form header with domain icon, title, subtitle and optional badge.
 * Consumes the .eval-header / .eval-icon / .eval-title / .eval-subtitle classes
 * from avaliacoes.css.
 *
 * @param {React.ReactNode} icon      - Lucide icon element, e.g. <Droplets size={22} />
 * @param {string}          title     - Form title
 * @param {string}         [subtitle] - Optional subtitle
 * @param {React.ReactNode}[badge]    - Optional badge node (e.g. last saved date, status)
 *
 * Usage with date badge:
 *   <EvaluationHeader
 *     icon={<Scale size={22} />}
 *     title="Bioimpedância"
 *     subtitle="Avaliação da composição corporal por BIA"
 *     badge={<span className="eval-date-badge">Salvo 12/04/2026</span>}
 *   />
 */
// h3: o nivel do titulo do modulo no contrato
// (docs/implementacao/avaliacoes-v2/contrato-avaliacao.md). O icone e
// decorativo; o titulo ja diz o que e.
const EvaluationHeader = ({ icon, title, subtitle, badge }) => (
  <div className="eval-header">
    <div className="eval-icon" aria-hidden="true">
      {icon}
    </div>
    <div className="eval-header-text">
      <h3 className="eval-title">{title}</h3>
      {subtitle && <p className="eval-subtitle">{subtitle}</p>}
    </div>
    {badge && (
      <div className="eval-header-badge">
        {badge}
      </div>
    )}
  </div>
);

export default EvaluationHeader;
