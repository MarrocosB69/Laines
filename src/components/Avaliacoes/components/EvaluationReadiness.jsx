import React from 'react';

const STATUS_LABELS = {
  ok: 'OK',
  warning: 'Atencao',
  danger: 'Critico',
  pending: 'Pendente'
};

const normalizeStatus = (status) => {
  const token = String(status || '').trim().toLowerCase();
  return ['ok', 'warning', 'danger', 'pending'].includes(token) ? token : 'pending';
};

const EvaluationReadiness = ({ title = 'Prontidao do modulo', items = [] }) => {
  const rows = Array.isArray(items) ? items.filter(Boolean) : [];
  if (!rows.length) return null;

  return (
    <section className="eval-readiness" aria-label={title}>
      <div className="eval-readiness__header">
        <strong>{title}</strong>
      </div>
      <div className="eval-readiness__grid">
        {rows.map((item) => {
          const status = normalizeStatus(item.status);
          return (
            <article className={`eval-readiness__item eval-readiness__item--${status}`} key={item.key || item.label}>
              <span className="eval-readiness__dot" aria-hidden="true" />
              <div>
                <span className="eval-readiness__label">{item.label}</span>
                <strong>{item.value || STATUS_LABELS[status]}</strong>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
};

export default EvaluationReadiness;
