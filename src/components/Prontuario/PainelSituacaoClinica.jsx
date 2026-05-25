import React from 'react';
import { Activity, History, PlusCircle } from 'lucide-react';

const PainelSituacaoClinica = ({
  prontuarioSignals = [],
  pendingModulesSummary = '',
  canCreateEvaluation = false,
  onCreateEvaluation,
  onOpenHistory
}) => (
  <section className="pron-card pron-panel">
    <header className="pron-panel-header">
      <div className="pron-panel-header__title-row">
        <span className="pron-panel-header__icon" aria-hidden="true">
          <Activity size={15} strokeWidth={1.8} />
        </span>
        <div>
          <h2>Situação Clínica</h2>
          <p>Indicadores rápidos de acompanhamento.</p>
        </div>
      </div>
    </header>

    <div className="pron-signal-grid">
      {prontuarioSignals.map((signal) => (
        <article key={signal.id} className={`pron-signal-card tone-${signal.tone || 'neutral'}`}>
          <span>{signal.label}</span>
          <strong>{signal.value}</strong>
        </article>
      ))}
    </div>

    {pendingModulesSummary && (
      <div className="pron-pending-badge">
        <span className="pron-pending-badge__dot" aria-hidden="true" />
        <span className="pron-pending-badge__label">Pendências:</span>
        <span className="pron-pending-badge__value">{pendingModulesSummary}</span>
      </div>
    )}

    <div className="pron-inline-actions">
      {canCreateEvaluation && (
        <button type="button" className="pron-btn pron-btn-secondary" onClick={onCreateEvaluation}>
          <PlusCircle size={14} />
          Abrir avaliações
        </button>
      )}
      <button type="button" className="pron-btn pron-btn-secondary" onClick={onOpenHistory}>
        <History size={14} />
        Histórico
      </button>
    </div>
  </section>
);

export default PainelSituacaoClinica;
