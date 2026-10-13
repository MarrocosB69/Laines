import React from 'react';
import { ESTILO_SO_LEITOR } from '../base/apoio';

const STATUS_LABELS = {
  ok: 'OK',
  attention: 'Atencao',
  warning: 'Atencao',
  danger: 'Critico',
  pending: 'Pendente'
};

// Quando o item traz um valor ("1,23%"), o estado ficava so na cor do
// ponto. O leitor de tela passa a ouvi-lo; quem ve tem a forma da marca
// (avaliacao-base.css, dentro de .av-modulo). Grafia acentuada so aqui,
// que nao aparece na tela: os textos visiveis continuam os de STATUS_LABELS.
const STATUS_FALADO = {
  ok: 'OK',
  attention: 'Atenção',
  warning: 'Atenção',
  danger: 'Crítico',
  pending: 'Pendente'
};

const normalizeStatus = (status) => {
  const token = String(status || '').trim().toLowerCase();
  return ['ok', 'attention', 'warning', 'danger', 'pending'].includes(token) ? token : 'pending';
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
                {item.value ? <span style={ESTILO_SO_LEITOR}>{` (${STATUS_FALADO[status]})`}</span> : null}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
};

export default EvaluationReadiness;
