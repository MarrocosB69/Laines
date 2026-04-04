import React from 'react';
import { History, PlusCircle } from 'lucide-react';

const PainelSituacaoClinica = ({
  prontuarioSignals = [],
  pendingModulesSummary = '',
  canCreateEvaluation = false,
  onCreateEvaluation,
  onOpenHistory
}) => (
  <section className="pron-card pron-panel">
    <header className="pron-panel-header">
      <div>
        <h2>Situação Clínica</h2>
        <p>Indicadores rápidos de acompanhamento.</p>
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

    <div className="pron-inline-status">
      <span className="campo-label">Pendências de avaliação</span>
      <span className="campo-valor">{pendingModulesSummary}</span>
    </div>

    <div className="pron-inline-actions">
      {canCreateEvaluation ? (
        <button type="button" className="pron-btn pron-btn-secondary" onClick={onCreateEvaluation}>
          <PlusCircle size={14} />
          Abrir avaliações
        </button>
      ) : null}
      <button type="button" className="pron-btn pron-btn-secondary" onClick={onOpenHistory}>
        <History size={14} />
        Histórico
      </button>
    </div>
  </section>
);

export default PainelSituacaoClinica;

